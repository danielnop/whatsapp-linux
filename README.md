# WhatsApp Linux

<p align="center">
  <b>🇬🇧 English</b> · <a href="README.es.md">🇪🇸 Español</a>
</p>

**Unofficial** WhatsApp desktop client for Linux. It wraps WhatsApp Web in a desktop
browser (Electron) so you get: its own window, system tray icon, native notifications,
unread counter, persistent session and drag & drop. No accounts, no middle servers: it
connects directly to `web.whatsapp.com` with WhatsApp's encryption (the keys stay on
your disk).

> ⚠️ Not affiliated with Meta. WhatsApp is a trademark of Meta Platforms, Inc.

![status](https://img.shields.io/badge/status-working-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

## Installation

### Option 1 · AppImage (recommended)

Download the latest `WhatsApp-Linux-x64.AppImage` from
[Releases](https://github.com/danielnop/whatsapp-linux/releases) and make it executable:

```bash
chmod +x WhatsApp-Linux-x64.AppImage
./WhatsApp-Linux-x64.AppImage
```

Clean per-user install (adds a menu icon + `whatsapp://` handler):

```bash
./install.sh WhatsApp-Linux-x64.AppImage
```

### Option 2 · Arch / CachyOS

```bash
git clone https://github.com/danielnop/whatsapp-linux.git
cd whatsapp-linux
makepkg -sfci
```

### Option 3 · Debian / Ubuntu

Required hardware: Linux x86_64, or Wayland with modern GPU drivers.
Download the `.deb` from the release and run `dpkg -i WhatsApp-Linux-amd64.deb`.

## Usage

* Scan the QR code **once** (the session is saved).
* Closing the window keeps it running in the tray → launch it again to show it.
* `whatsapp://send?phone=...` and `https://wa.me/…` open the app.
* Zoom: `Ctrl +` / `Ctrl -`. DevTools: `Ctrl+Shift+I`.
* Start minimized: `WA_START_MINIMIZED=1`.

### CLI

```bash
WhatsApp-Linux.AppImage --start-minimized
```

## What about the Windows `.exe`?

The Windows installer **does not work on Linux** as-is. We documented the whole
experiment, with logs and the exact restart point (and why), in
[`docs/WINE.md`](docs/WINE.md) and [`docs/ALPC.md`](docs/ALPC.md). Summary:

| Step | Result |
|---|---|
| Get the official `.msixbundle` | ✅ |
| Extract it and run `WhatsApp.Root.exe` under Wine 11.21 | ✅ .NET 8 starts |
| Register the Windows App Runtime WinRT classes (1,033 classes) | ✅ |
| Skip `DeploymentManager.Initialize` with an IL patch (NOP the `call`) | ✅ |
| Load `Microsoft.ui.xaml.dll` + WinAppSDK 2.6.5 runtime | ✅ imported |
| ALPC / CoreMessaging handshake (`CoreMessagingRegistrar-32`) | ✅ with the `wine-ultimate` fork |
| WinUI 3 creates `Windows.UI.Core.CoreWindow`, VoIP and push init | ✅ |
| Finish `Microsoft.UI.Xaml.Window` initialization | ❌ private composition IID + activation-context classes |

Wine upstream ships ALPC as a 135-line stub (`dlls/ntdll/unix/alpc.c`) that returns
`STATUS_NOT_IMPLEMENTED` for everything, so the `CoreMessaging` broker cannot start and
WinUI 3 never gets a dispatcher queue. The
[`ZhymabekRoman/wine-ultimate`](https://github.com/ZhymabekRoman/wine-ultimate) fork
(Wine 11.10) implements ALPC, wait completion packets, its own `coremessaging` and
package identity through `WINE_PACKAGE_*` environment variables. With it, the ALPC
handshake works and the WinUI 3 window is created.

The two blockers left are inside the Windows App SDK's *lifted* composition:

* XAML asks the `Windows.UI.Composition.Compositor` factory for the private IID
  `{5e03ab98-c7e0-4449-8518-568d62e9b396}` (`dcompi.dll`); Wine answers
  `E_NOINTERFACE`, which ends in a fail-fast with `E_FAIL`.
* After aliasing that IID experimentally, XAML queries the activation context for the
  activatable class `Windows.UI.Composition.Compositor`; Wine returns
  `STATUS_SXS_KEY_NOT_FOUND` (`0x800736B7`) because it does not expose WinRT classes
  there.

None of those are ALPC problems anymore: the transport and the broker already work.
The app is **WinUI 3 + WebView2** and expects to be an *MSIX package* with package
identity, something Wine does not implement. That is why the sane path is a **real
Linux client** (this repo) instead of a port of the Windows binary.

## Development

```bash
npm install
npm start          # opens the app
npm run build:all  # builds AppImage, deb and pacman into dist/
```

Structure:

```
src/main.js     main process (window, tray, permissions, UA)
src/preload.js  secure bridge (contextIsolation + sandbox)
assets/         icons (SVG and PNG)
```

## Security

* `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
* It only binds to WhatsApp domains; everything else opens in the system browser.
* Permissions: only notifications, camera, microphone and clipboard are granted.
* No requests are made to any external service other than `web.whatsapp.com`.

## License

MIT — see [`LICENSE`](LICENSE). The name WhatsApp is property of Meta Platforms, Inc.

<p align="center">
  <b>🇬🇧 English</b> · <a href="README.es.md">🇪🇸 Español</a>
</p>
