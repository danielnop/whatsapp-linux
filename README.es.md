# WhatsApp Linux

<p align="center">
  <a href="README.md">🇬🇧 English</a> · <b>🇪🇸 Español</b>
</p>

Cliente de escritorio **no oficial** de WhatsApp para Linux. Envuelve WhatsApp Web en un
navegador de escritorio (Electron) para que tengas: ventana propia, icono en la bandeja
del sistema, notificaciones nativas, contador de mensajes sin leer, sesión persistente y
arrastrar y soltar. Sin cuentas, sin servidores intermedios: llega directo a
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

Instalación "limpia" para el usuario (mete icono en el menú + handler `whatsapp://`):

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

Hardware requerido: Linux x86_64, o Wayland con drivers modernos de GPU.
Descarga el `.deb` del release y ejecuta `dpkg -i WhatsApp-Linux-amd64.deb`.

## Uso

* Escanea el código QR **una vez** (la sesión queda guardada).
* Cerrar la ventana la deja viva en la bandeja → vuelve a lanzarla para mostrarla.
* `whatsapp://send?phone=...` y `https://wa.me/…` abren la app.
* Zoom: `Ctrl +` / `Ctrl -`. DevTools: `Ctrl+Shift+I`.
* Arrancar minimizado: `WA_START_MINIMIZED=1`.

### CLI

```bash
WhatsApp-Linux.AppImage --start-minimized
```

## ¿Y el `.exe` de Windows?

El instalador de Windows **no funciona en Linux** tal cual. Documentamos todo el
experimento, con logs y el punto exacto de reinicio (y el porqué), en
[`docs/WINE.md`](docs/WINE.md) y [`docs/ALPC.md`](docs/ALPC.md). Resumen:

| Paso | Resultado |
|---|---|
| Conseguir el `.msixbundle` oficial | ✅ |
| Extraerlo y ejecutar `WhatsApp.Root.exe` bajo Wine 11.21 | ✅ .NET 8 arranca |
| Registrar las clases WinRT del Windows App Runtime (1.033 clases) | ✅ |
| Saltar `DeploymentManager.Initialize` con un parche IL (NOP al `call`) | ✅ |
| Cargar `Microsoft.ui.xaml.dll` + runtime WinAppSDK 2.6.5 | ✅ importado |
| Handshake ALPC / CoreMessaging (`CoreMessagingRegistrar-32`) | ✅ con el fork `wine-ultimate` |
| WinUI 3 crea `Windows.UI.Core.CoreWindow`, VoIP e init de push | ✅ |
| Terminar la inicialización de `Microsoft.UI.Xaml.Window` | ❌ IID privado de composición + clases de activation context |

Wine upstream trae ALPC como un stub de 135 líneas (`dlls/ntdll/unix/alpc.c`) que devuelve
`STATUS_NOT_IMPLEMENTED` para todo, así que el broker de `CoreMessaging` no puede arrancar
y WinUI 3 nunca obtiene una cola de dispatcher. El fork
[`ZhymabekRoman/wine-ultimate`](https://github.com/ZhymabekRoman/wine-ultimate) (Wine 11.10)
implementa ALPC, wait completion packets, su propio `coremessaging` y la identidad de
paquete mediante variables de entorno `WINE_PACKAGE_*`. Con él, el handshake ALPC funciona
y la ventana de WinUI 3 se crea.

Los dos bloqueos que quedan están dentro de la composición *lifted* del Windows App SDK:

* XAML pide a la factory de `Windows.UI.Composition.Compositor` el IID privado
  `{5e03ab98-c7e0-4449-8518-568d62e9b396}` (`dcompi.dll`); Wine responde
  `E_NOINTERFACE`, lo que acaba en un fail-fast con `E_FAIL`.
* Tras aliasar ese IID de forma experimental, XAML consulta el activation context por la
  clase activable `Windows.UI.Composition.Compositor`; Wine devuelve
  `STATUS_SXS_KEY_NOT_FOUND` (`0x800736B7`) porque no expone clases WinRT ahí.

Ninguno de esos problemas es ya de ALPC: el transporte y el broker funcionan. La app es
**WinUI 3 + WebView2** y espera ser un *paquete MSIX* con identidad de paquete, algo que
Wine no implementa. Por eso el camino sensato es un **cliente Linux nativo** (este repo)
en lugar de portar el binario de Windows.

## Desarrollo

```bash
npm install
npm start          # abre la app
npm run build:all  # compila AppImage, deb y pacman en dist/
```

Estructura:

```
src/main.js     proceso principal (ventana, bandeja, permisos, UA)
src/preload.js  puente seguro (contextIsolation + sandbox)
assets/         iconos (SVG y PNG)
```

## Seguridad

* `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
* Solo se ata a dominios de WhatsApp; lo demás abre en el navegador del sistema.
* Permisos: solo se conceden notificaciones, cámara, micrófono y portapapeles.
* No se hace ninguna petición a servicios externos aparte de `web.whatsapp.com`.

## Licencia

MIT — ver [`LICENSE`](LICENSE). El nombre WhatsApp es propiedad de Meta Platforms, Inc.

<p align="center">
  <a href="README.md">🇬🇧 English</a> · <b>🇪🇸 Español</b>
</p>
