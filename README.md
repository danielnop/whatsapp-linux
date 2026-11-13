# WhatsApp Linux

Cliente de escritorio **no oficial** de WhatsApp para Linux. Envuelve WhatsApp Web en un
navegador de escritorio (Electron) para que tengas: ventana propia, icono en la bandeja
del sistema, notificaciones nativas, contador de mensajes sin leer, sesión persistente y
arrastar-y-soltar. Sin cuentas, sin servidores intermedios: llega directo a
`web.whatsapp.com` con el cifrado de WhatsApp (las llaves se guardan en tu disco).

> ⚠️ No afiliado a Meta. WhatsApp es marca de Meta Platforms, Inc.

![estado](https://img.shields.io/badge/estado-funcionando-brightgreen)
![licencia](https://img.shields.io/badge/licencia-MIT-blue)

## Instalación

### Opción 1 · AppImage (recomendada)

Descarga el último `WhatsApp-Linux-x64.AppImage` de
[Releases](https://github.com/danielnop/whatsapp-linux/releases) y hazlo ejecutable:

```bash
chmod +x WhatsApp-Linux-x64.AppImage
./WhatsApp-Linux-x64.AppImage
```

Instalación “limpia” para el usuario (mete icono en el menú + handler `whatsapp://`):

```bash
./install.sh WhatsApp-Linux-x64.AppImage
```

### Opción 2 · Arch / CachyOS

```bash
git clone https://github.com/danielnop/whatsapp-linux.git
cd whatsapp-linux
makepkg -sfci
```

### Opción 3 · Debian / Ubuntu

Hardware requerido: Linux x86_64 o Wayland con Drivers de GPU modernos.
Descarga el `.deb` de la release y `dpkg -i WhatsApp-Linux-amd64.deb`.

## Uso

* Escanea el QR **una sola vez** (se guarda la sesión).
* Al cerrar la ventana sigue activo en la bandeja → corre para volver.
* `whatsapp://send?phone=...` y `https://wa.me/…` abren la app.
* Zoom: `Ctrl +` / `Ctrl -`. DevTools: `Ctrl+Shift+I`.
* Arranque minimizado: `WA_START_MINIMIZED=1`.

### CLI

```bash
WhatsApp-Linux.AppImage --start-minimized
```

## ¿Qué pasa con el archivo .exe de Windows?

El instalador de Windows **no funciona en Linux** tal cual. Documentamos el experimento
completo, con registros y el punto exacto de reinicio (y por qué), en
[`docs/WINE.md`](docs/WINE.md). Resumen:

| Paso | Resultado |
|---|---|
| Obtener el `.msixbundle` oficial | ✅ |
| Extraerlo y ejecutar `WhatsApp.Root.exe` bajo Wine 11.21 | ✅ arranca .NET 8 |
| Registrar clases WinRT del Windows App Runtime (1033 clases) | ✅ |
| Saltar `DeploymentManager.Initialize` con parche IL (NOP al `call`) | ✅ |
| Cargar `Microsoft.ui.xaml.dll` + runtime WinAppSDK 2.6.5 | ✅ importado |
| Activar `Microsoft.UI.Xaml.Application` (WinUI 3) | ❌ `NtCreateWaitCompletionPacket` no implementado |

**El bloqueo final es estructural**, no un parche más:

* `NtCreateWaitCompletionPacket` (ntdll) lo llaman `CoreMessagingXP.dll` / `Microsoft.UI.dll`
  al crear el CoreMessaging de WinRT. **No existe en Wine upstream** (verificado en el
  código fuente de `wine/wine` en gitlab.winehq.org: 0 resultados) ni en la build
  `wine-11.21-staging-tkg` de Kron4ek, ni siquiera en **GE-Proton 11-12** (verificado por
  binaria en `ntdll.so` y `ntdll.dll`). reimplementarlo requería recompilar ntdll y aún así
  el siguiente muro es DWM/composición, que WinUI 3 exige para pintar la ventana.
* El formato MSIX exige identidad de paquete (`APPMODEL_ERROR_NO_PACKAGE` en Wine), y por
  diseño WinUI 3 + WebView2 no tienen equivalente en Wine hoy.

La app es **WinUI 3 + WebView2** y espera ser un *paquete MSIX* con identidad de paquete,
algo que Wine no implementa. Por eso la vía sana es un **cliente real** de Linux (este
repo), no un «port» del binario de Windows.

## Desarrollo

```bash
npm install
npm start          # abre la app
npm run build:all  # genera AppImage, deb y pacman en dist/
```

Estructura:

```
src/main.js     proceso principal (ventana, tray, permisos, UA)
src/preload.js  puente seguro (contextIsolation + sandbox)
assets/         iconos (SVG y PNG)
```

## Seguridad

* `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
* Solo se enlaza a dominios de WhatsApp; el resto abre en el navegador del sistema.
* Permisos: se autorizan solo notificaciones, cámara, micrófono y portapapeles.
* No se hacen peticiones a ningún servicio externo aparte de `web.whatsapp.com`.

## Licencia

MIT — ver [`LICENSE`](LICENSE). El nombre WhatsApp es de Meta Platforms, Inc.
