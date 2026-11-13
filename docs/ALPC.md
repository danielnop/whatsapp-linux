# El "puente" ALPC: `wine-ultimate`

> Investigación del 12-nov-2026. Wine upstream tiene ALPC en un stub de 135 líneas
> (`dlls/ntdll/unix/alpc.c`) que devuelve `STATUS_NOT_IMPLEMENTED` en todo. Sin ALPC
> no hay broker `CoreMessagingRegistrar` y por tanto no hay WinUI 3. Pero existe un
> fork con una implementación real.

## Qué encontramos

| Recurso | Qué aporta |
|---|---|
| [`ZhymabekRoman/wine-ultimate`](https://github.com/ZhymabekRoman/wine-ultimate) | Fork de Wine 11.10 con implementación de **ALPC** (`dlls/ntdll/unix/alpc.c` 63 KB + `server/alpc.c` 96 KB), *wait completion packets*, handshake de CoreMessaging, `dlls/coremessaging` propio (50 KB), identidad de paquete y DComp |
| `patches/ntdll-WaitCompletionPacket` (13 parches) | Serie que añade syscalls ALPC, secciones/views, impersonation, routing de mensajes, WNF |
| `patches/ntdll-NtAlpcCreatePort` | `NtAlpcCreatePort`/`NtAlpcConnectPort`/servidor |
| `patches/coremessaging-DispatcherQueue` | `IDispatcherQueue` + CoreUICall |
| [`ReWindows/CoreMessaging`](https://github.com/ReWindows/CoreMessaging) | Análisis reverso de CoreMessaging (referencia para depurar el protocolo) |

No existe build precompilado del fork: hay que compilarlo. La rama `ultimate` ya trae
el árbol completo parcheado (base **Wine 11.10**).

## Cómo reproducirlo (sin root)

```bash
# 1. Toolchain mingw-w64 sin root (paquetes de Arch extraídos en ~/.local/mingw)
#    mingw-w64-{binutils,gcc,crt,headers,winpthreads}
export PATH="$HOME/.local/mingw/usr/bin:$PATH"

# 2. Fuente parcheada
curl -L -o ultimate.tar.gz \
  https://github.com/ZhymabekRoman/wine-ultimate/archive/refs/heads/ultimate.tar.gz
tar xzf ultimate.tar.gz

# 3. Compilar (x86_64; ~20-40 min)
./configure --enable-archs=x86_64 --prefix="$PWD/../wine-alpc"
make -j$(nproc) && make install

# 4. Ejecutar la app con el prefix dedicado
export WINEPREFIX=~/.local/share/whatsapp-wine/prefix
../wine-alpc/bin/wine ~/.local/share/whatsapp-wine/app/WhatsApp.Root.exe
```

Sigue haciendo falta el parche IL de `docs/wine-experiment/patch_boot_il.py` (identidad
de paquete), porque el fork no elimina `DeploymentManager.Initialize` de la app.

## Estado

- [x] Localizar implementación de ALPC (no existe en Wine upstream ni en Proton)
- [x] Toolchain mingw-w64 rootless
- [x] Compilar Wine 11.10 + ALPC + coremessaging
- [x] Ejecutar WhatsApp: handshake ALPC de CoreMessaging (`CONNECT_ALPC_PORT` /
      `ACCEPT_ALPC_CONN`, puerto `\BaseNamedObjects\CoreMessagingRegistrar-32:...`)
- [x] Identidad de paquete por entorno (`WINE_PACKAGE_*`) → se supera el
      `XamlParseException` de `ms-appx:///Microsoft.UI.Xaml/Themes/themeresources.xaml`
- [x] WinUI 3 crea la ventana `Windows.UI.Core.CoreWindow` y arranca VoIP,
      `MediaFilesService`, `WebLifecycleController` y el canal de push
- [ ] Inicialización completa de `Microsoft.UI.Xaml.Window` (ver bloqueos abajo)

### Bloqueos restantes (dentro de `Microsoft.UI.Xaml.dll`)

1. **Interfaz privada de composición.** Tras activar
   `Windows.UI.Composition.Compositor`, XAML pide al *activation factory* el IID
   `{5e03ab98-c7e0-4449-8518-568d62e9b396}` (`dcompi.dll`, composición "lifted"
   del WinAppSDK); Wine devuelve `E_NOINTERFACE` → fail-fast con `E_FAIL`
   (`0x80004005`). Ese IID no aparece en el SDK público ni en ninguna rama del
   fork. Aliasarlo a `ICompositorDesktopInterop` (parche local en
   `dlls/windows.ui.composition/compositor.c`) avanza el error, pero provoca un
   AV en el window-proc y el siguiente fallo.
2. **Sección de clases activables en el activation context.** Con el alias, XAML
   llama `RtlFindActivationContextSectionString(ACTIVATABLE_CLASS,
   L"Windows.UI.Composition.Compositor")` y Wine responde
   `STATUS_SXS_KEY_NOT_FOUND` → `0x800736B7`. Wine no publica clases WinRT en el
   actctx (solo DLL/window-class/typelib redirects).

Ningún bloqueo es de ALPC: el transporte y el broker ya funcionan.

### Siguiente paso técnico

- Extender `dlls/ntdll/actctx.c` para exponer una sección `ACTIVATABLE_CLASS`
  sintética (clase → DLL ya registrada en `HKLM\Software\Microsoft\WindowsRuntime`),
  o hacer que `dcompi`/XAML usen el registro.
- Reversear el vtable real del IID `{5e03ab98-…}` en `dcompi.dll` (referencias a
  la constante, tamaño de vtable) antes de darle un objeto válido.
- Alternativa: ejecutar la app **sin el parche IL** para que el bootstrapper real
  de WinAppSDK registre las clases (requiere el `WhatsApp.Root.dll` prístino del
  MSIX; no quedó copia en disco).
