#!/usr/bin/env python3
"""Parchea el IL de WhatsApp.Root.dll para saltarse el bootstrap que exige
identidad de paquete MSIX:

  1. Reemplaza el cuerpo de `DeploymentManagerCS.AutoInitialize.AccessWindowsAppSDK`
     (y `get_Options`) por `ret` -> evita `0x80073D54 APPMODEL_ERROR_NO_PACKAGE`.
  2. Sustituye el `call <AccessWindowsAppSDK>` dentro de
     `Common.AutoInitialize.InitializeWindowsAppSDK` por NOPs (mas robusto:
     no reescribe cabeceras ni secciones EH).

Uso: python3 patch_boot_il.py <ruta-a-WhatsApp.Root.dll>
Requiere: pip install dnfile
"""
import sys, struct, dnfile

path = sys.argv[1]
pe = dnfile.dnPE(path)
d = bytearray(open(path, 'rb').read())

def patch_ret(name, rva):
    off = pe.get_offset_from_rva(rva)
    h = d[off]
    if h & 0x3 == 0x2:
        il_len = h >> 2; il = off + 1
    elif h & 0x3 == 0x3:
        hdrlen = (int.from_bytes(d[off:off+2], 'little') >> 12) * 4
        code = int.from_bytes(d[off+4:off+8], 'little')
        il = off + hdrlen; il_len = code
        if int.from_bytes(d[off:off+2], 'little') & 0x0008:
            u = int.from_bytes(d[off:off+2], 'little')
            d[off:off+2] = (u & ~0x0008).to_bytes(2, 'little')
    else:
        print(f"{name}: cabecera desconocida"); return 0
    d[il:il + il_len] = b"\x2a" + b"\x00" * (il_len - 1)
    return 1

def nop_call(name, rva):
    off = pe.get_offset_from_rva(rva)
    assert d[off] & 0x3 == 0x2, "cabecera tiny esperada"
    il = off + 1; size = d[off] >> 2
    assert d[il] == 0x28, "se esperaba una instrucion call"
    d[il:il+5] = b"\x00" * 5
    return 1

for t in pe.net.mdtables.TypeDef:
    ns = str(t.TypeNamespace or ''); nm = str(t.TypeName)
    if not (nm == 'AutoInitialize' and 'WindowsAppRuntime' in ns):
        continue
    for m in t.MethodList:
        r = m.row; n = str(r.Name)
        if n in ('AccessWindowsAppSDK', 'get_Options', 'set_Options'):
            patch_ret(f"{ns}.{nm}.{n}", r.Rva)
        if ns.endswith('Common') and n == 'InitializeWindowsAppSDK':
            nop_call(f"{ns}.{nm}.{n}", r.Rva)

open(path, 'wb').write(d)
print("OK")
