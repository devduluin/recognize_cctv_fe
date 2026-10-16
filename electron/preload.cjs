'use strict';
// Only scoped session and camera checks are exposed; no files, processes, or generic IPC.
const { contextBridge, ipcRenderer } = require('electron');
function request(action, session) {
  const result = ipcRenderer.sendSync('desktop-auth-session', { action, session });
  if (!result?.ok) throw new Error(result?.error || 'Sesi desktop belum dapat disimpan.');
  return result.session;
}
const stored = request('read');
if (stored) {
  localStorage.setItem('auth_token', stored.token);
  localStorage.setItem('user_info', JSON.stringify(stored.user));
} else {
  // A reused port must not resurrect localStorage from an earlier signed-out user.
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
}
contextBridge.exposeInMainWorld('desktopAuthSession', {
  save: session => request('save', session),
  clear: () => request('clear'),
});

contextBridge.exposeInMainWorld('desktopCameraNetwork', {
  check: source => ipcRenderer.invoke('desktop-camera-network-check', source),
});
