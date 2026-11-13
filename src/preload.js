// Bridge: exposes only what the web app needs, keeps the web page in its sandbox.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('__waLinux', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  isLinux: true,
});
