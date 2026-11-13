#!/usr/bin/env python3
"""Redirige los imports de WaitCompletionPacket (no implementados en Wine)
a funciones equivalentes implementadas (NtCreateEvent/NtSetEvent/NtResetEvent).
Aplica a TODAS las copias de CoreMessagingXP.dll (app/ y runtime/)."""
import sys
p = sys.argv[1]
d = open(p, 'rb').read()
def rep(old, newname):
    return newname + b"\x00" * (len(old) - len(newname))
subs = [
    (b"NtCreateWaitCompletionPacket\x00", b"NtCreateEvent"),
    (b"NtAssociateWaitCompletionPacket\x00", b"NtSetEvent"),
    (b"NtCancelWaitCompletionPacket\x00", b"NtResetEvent"),
]
out = d
for old, new in subs:
    print(old.decode()[:-1], "->", new.decode(), "x", out.count(old))
    out = out.replace(old, rep(old, new))
assert len(out) == len(d)
open(p, 'wb').write(out)
print("OK")
