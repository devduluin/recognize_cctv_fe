const { app, BrowserWindow, Menu, dialog, session, ipcMain, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { DesktopRuntime } = require('./runtime.cjs');
const { DesktopUpdates } = require('./updates.cjs');
const { allowedPermission } = require('./permissions.cjs');
const { AuthSessionStore, restoreSession, trustedSender } = require('./auth-session.cjs');
let runtime, window, updater;
let quitting = false;
const development = process.argv.includes('--desktop-dev');
const validation = process.argv.includes('--desktop-smoke');
app.setName('Visitor Counter');

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    Promise.resolve(runtime?.stop()).finally(() => app.quit());
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start).catch(async error => {
    console.error('Desktop startup failed:', error);
    if (validation && process.env.DESKTOP_TEST_DATA) {
      fs.writeFileSync(path.join(process.env.DESKTOP_TEST_DATA, 'desktop-smoke-error.txt'), error.stack || error.message);
      process.exitCode = 1;
      app.quit();
      return;
    }
    await dialog.showMessageBox({ type: 'error', title: 'Visitor Counter startup failed', message: error.message, detail: 'Local data is preserved. Logs are in the application data directory.' });
    app.quit();
  });
}

async function start() {
  const root = path.resolve(__dirname, '..');
  const userData = validation && process.env.DESKTOP_TEST_DATA ? path.resolve(process.env.DESKTOP_TEST_DATA) : app.getPath('userData');
  runtime = new DesktopRuntime({
    resources: app.isPackaged ? process.resourcesPath : path.join(root, 'resources'), userData, version: app.getVersion(),
    development, validation, frontendRoot: root, backendRoot: path.resolve(process.env.DESKTOP_BACKEND_ROOT || path.join(root, '../recognize_cctv')),
    python: process.env.DESKTOP_PYTHON, node: process.env.DESKTOP_NODE,
  });
  runtime.on('failure', async error => {
    if (quitting) return;
    await dialog.showMessageBox(window || undefined, { type: 'error', title: 'Local service stopped', message: error.message, detail: 'Restart the application. Your local data is preserved.' });
    app.quit();
  });
  const origin = await runtime.start();
  const authStore = new AuthSessionStore(runtime.paths.data, safeStorage);
  let authSession = await restoreSession(authStore, runtime);
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${origin}/*`, `${runtime.mediaWhepOrigin}/*`, `${runtime.mediaHlsOrigin}/*`] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    if (new URL(details.url).origin === origin) headers['X-Desktop-Window-Token'] = runtime.windowToken;
    else headers.Authorization = `Basic ${Buffer.from(`desktop:${runtime.serviceToken}`).toString('base64')}`;
    callback({ requestHeaders: headers });
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(allowedPermission(contents, permission, origin, details.requestingUrl, details)));
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) =>
    allowedPermission(contents, permission, origin, details.requestingUrl || requestingOrigin, details));
  window = new BrowserWindow({ show: false, width: 1440, height: 960, minWidth: 960, minHeight: 640, webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
    preload: path.join(__dirname, 'preload.cjs'),
  } });
  ipcMain.on('desktop-auth-session', (event, message) => {
    if (!trustedSender(event, window, origin)) { event.returnValue = { ok: false, error: 'Akses sesi ditolak.' }; return; }
    try {
      if (message?.action === 'read') event.returnValue = { ok: true, session: authSession };
      else if (message?.action === 'save') {
        authStore.write(message.session);
        authSession = { token: message.session.token, user: message.session.user };
        event.returnValue = { ok: true };
      } else if (message?.action === 'clear') {
        authStore.clear(); authSession = null;
        event.returnValue = { ok: true };
      } else event.returnValue = { ok: false, error: 'Operasi sesi tidak valid.' };
    } catch { event.returnValue = { ok: false, error: 'Penyimpanan sesi desktop gagal. Periksa penyimpanan kredensial OS lalu coba lagi.' }; }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  await window.loadURL(origin);
  if (validation) {
    await require('../scripts/desktop/window-smoke.cjs')({ window, runtime, userData });
    app.quit();
    return;
  }
  window.show();
  updater = new DesktopUpdates({ updater: require('electron-updater').autoUpdater, dialog, getWindow: () => window,
    stopServices: () => runtime.stop(), packaged: app.isPackaged && require('../package.json').desktopRelease === true, version: app.getVersion(),
    notify: message => dialog.showMessageBox(window, { type: 'info', title: 'Visitor Counter updates', message }),
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'Application', submenu: [{ label: 'Check for Updates', click: () => updater.check() }, { label: 'Install Downloaded Update', click: () => updater.install() }, { type: 'separator' }, { role: 'quit' }] },
    { role: 'editMenu' }, { role: 'viewMenu' },
  ]));
  if (updater.packaged) setTimeout(() => updater.check(), 5000).unref();
}
