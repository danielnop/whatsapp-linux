#!/usr/bin/env node
// WhatsApp Linux - main process
// Wraps the official WhatsApp Web client so you get the same security model
// as the browser, plus a real desktop shell (tray, notifications, badge...).
const { app, BrowserWindow, Tray, Menu, shell, session, nativeImage, ipcMain, globalShortcut, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://web.whatsapp.com';
const isWin = (arg) => app.commandLine.hasSwitch?.(arg);

// ---------- feature flags / cli ----------
argvGet('start-minimized');
const START_MINIMIZED = !!(process.env.WA_START_MINIMIZED || argvGet('start-minimized'));
const CHROME_UA = argvGet('user-agent') ||
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function argvGet(name) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : null;
}

// Electron 45 disables requesting OS notifications in some cases on Linux
app.commandLine.appendSwitch('enable-features', 'LinuxUiScaling');
app.disableHardwareAcceleration = undefined; // keep HW accel

let tray = null;
let win = null;
let quitting = false;

// ---------- window ----------
function createWindow(first) {
  win = new BrowserWindow({
    width: first?.w || 1200,
    height: first?.h || 800,
    minWidth: 520,
    minHeight: 480,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111b21' : '#ffffff',
    title: 'WhatsApp Linux',
    icon: findAsset('icon.png') || undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.js'),
      partition: undefined, // default session for persistence
    },
  });

  // keep our UA so WhatsApp serves the desktop web client
  win.webContents.setUserAgent(CHROME_UA);
  session.defaultSession.setUserAgent(CHROME_UA);

  win.loadURL(APP_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('page-title-updated', (_e, title) => {
    // WhatsApp puts the unread count in the title, e.g. "WhatsApp (3)"
    const m = title.match(/\((\d+)\s*\+?\)?/);
    const count = m ? parseInt(m[1], 10) : 0;
    if (tray) {
      try {
        tray.setToolTip(count ? `WhatsApp Linux — ${count} sin leer` : 'WhatsApp Linux');
        const img = findAsset(count > 0 ? 'tray-unread.png' : 'tray.png');
        if (img) tray.setImage(img);
      } catch { /* tray icons are best-effort */ }
    }
    app.setBadgeCount?.(count);
  });

  win.on('close', (e) => {
    if (!quitting) {          // close-to-tray behaviour
      e.preventDefault();
      win.hide();
    }
  });

  if (!START_MINIMIZED) win.once('ready-to-show', () => win.show());
  return win;
}

// ---------- permissions ----------
const ALLOWED_PERMISSIONS = new Set([
  'notifications', 'media', 'audioCapture', 'videoCapture', 'clipboard-read',
  'clipboard-sanitized-write', 'fullscreen', 'display-capture', 'mediaKeySystem',
  'midi', 'persistent-storage',
]);
function setSessionPolicy() {
  const s = session.defaultSession;
  s.setUserAgent(CHROME_UA);
  s.setPermissionRequestHandler((_wc, permission, cb) =>
    cb(ALLOWED_PERMISSIONS.has(permission)));
}

// ---------- single instance ----------
const got = app.requestSingleInstanceLock();
if (!got) app.quit();
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

// ---------- whatsapp:// and https://wa.me launchers ----------
function openWithApp(url) {
  app.commandLine.appendSwitch('app', url);
  if (win) { win.show(); win.webContents.loadURL(url); }
}

// ---------- app lifecycle ----------
app.whenReady().then(() => {
  setSessionPolicy();
  registerProtocol();
  createWindow(readGeometry());
  makeTray();
  makeMenu();
  globalShortcut.register('MediaPlayPause', () => {});
});

function registerProtocol() {
  const proto = 'whatsapp';
  if (app.isDefaultProtocolClient(proto)) return;
  try { app.setAsDefaultProtocolClient(proto); } catch { /* not critical yet */ }
}

function readGeometry() {
  try {
    const p = path.join(app.getPath('userData'), 'geometry.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

function saveGeometry() {
  if (!win) return;
  const b = win.getBounds();
  try {
    const p = path.join(app.getPath('userData'), 'geometry.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(b));
  } catch { /* ignore */ }
}

app.on('before-quit', () => { quitting = true; saveGeometry(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin' || quitting) app.quit(); });

// ---------- asset resolution (works in dev and in packaged app) ----------
function findAsset(name) {
  const candidates = [
    path.join(process.resourcesPath || '', 'assets', name),  // packaged
    path.join(__dirname, '..', 'assets', name),              // dev / dir build
  ];
  for (const p of candidates) {
    try { if (p && fs.statSync(p).isFile()) return p; } catch { /* keep looking */ }
  }
  return null;
}

// ---------- tray ----------
function makeTray() {
  const iconPath = findAsset('tray.png');
  let img = null;
  try { img = iconPath ? nativeImage.createFromPath(iconPath) : null; } catch { img = null; }
  tray = new Tray(img && !img.isEmpty() ? img : null);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir WhatsApp', click: () => (win ? win.show() : createWindow()) },
    { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => win?.reload() },
    { type: 'separator' },
    { label: 'Salir', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => (win ? (win.isVisible() ? win.hide() : win.show()) : createWindow()));
}

// ---------- application menu ----------
function makeMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Archivo', submenu: [
      { label: 'Nueva ventana', click: () => createWindow(readGeometry() || { w: 1000, h: 700 }) },
      { type: 'separator' }, { role: 'quit', label: 'Salir' },
    ] },
    { label: 'Ver', submenu: [
      { role: 'reload', label: 'Recargar' }, { role: 'forceReload' },
      { type: 'separator' },
      { role: 'zoomIn', label: 'Ampliar' }, { role: 'zoomOut', label: 'Reducir' },
      { role: 'resetZoom', label: 'Zoom 100%' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Pantalla completa' },
      { role: 'toggleDevTools', label: 'Herramientas de desarrollador' },
    ] },
    { label: 'Ayuda', submenu: [
      { label: 'Acerca de WhatsApp Linux', click: () =>
        dialog.showMessageBox(win, { type: 'info', title: 'WhatsApp Linux',
          message: 'WhatsApp Linux', detail: `Versión ${app.getVersion()}\n\nCliente no oficial basado en WhatsApp Web (Electron).\nNo afiliado a Meta.` }),
      },
    ] },
  ]);
  Menu.setApplicationMenu(menu);
}

// Allow the renderer to ask main to open an external link (safe pattern)
ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
  return true;
});
