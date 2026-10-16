const { app, BrowserWindow, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { documentationResponse } = require('./package-output.cjs');
const { fixture, user } = require('./fixtures.cjs');
const [origin, output, profile] = process.argv.slice(2);
if (!origin || new URL(origin).hostname !== '127.0.0.1' || !output || !profile) throw new Error('Capture membutuhkan server loopback dan direktori keluaran.');
app.setPath('userData', profile);
const failures = new Set();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let window;
async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await window.webContents.executeJavaScript(expression)) return;
    await pause(100);
  }
  throw new Error(`Tampilan belum siap: ${expression}`);
}
async function page(route, ready) {
  await window.loadURL(origin + route);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(ready)}) && !document.body.innerText.includes('Memuat hak akses')`);
  await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await pause(1000);
}
async function click(label) {
  const found = await window.webContents.executeJavaScript(`(() => { const el = [...document.querySelectorAll('button')].find(el => el.innerText.trim() === ${JSON.stringify(label)}); if (!el || el.disabled) return false; el.click(); return true; })()`);
  if (!found) throw new Error(`Tombol tidak ditemukan: ${label}`);
}
const captured = [];
async function capture(name) {
  await pause(600);
  const alerts = await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[role="alert"]')).map(el => el.innerText).filter(Boolean)`);
  if (alerts.length) throw new Error(`Halaman ${name} memiliki peringatan: ${alerts.join('; ')}${failures.size ? '\nRequest yang belum tercakup:\n' + [...failures].join('\n') : ''}`);
  const image = await window.webContents.capturePage();
  if (image.isEmpty()) throw new Error(`Screenshot kosong: ${name}`);
  fs.writeFileSync(path.join(output, 'screenshots', name + '.png'), image.toPNG());
  captured.push(name);
}
app.whenReady().then(async () => {
  fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
  window = new BrowserWindow({ width: 1440, height: 1050, show: false, webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false,
  } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const session = window.webContents.session;
  session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (request, done) => {
    const allowed = new URL(request.url).origin === origin;
    if (!allowed) failures.add(`Permintaan eksternal diblokir: ${new URL(request.url).origin}`);
    done({ cancel: !allowed });
  });
  session.protocol.handle('http', request => {
    const url = new URL(request.url);
    if (url.origin !== origin) return new Response('Blocked', { status: 403 });
    if (url.pathname.startsWith('/__manual/')) return documentationResponse(url, output);
    if (url.pathname.startsWith('/api/')) {
      const body = fixture(url, request.method);
      if (body === undefined) {
        failures.add(`${request.method} ${url.pathname}`);
        console.error(`Fixture belum tersedia: ${request.method} ${url.pathname}`);
        return new Response(JSON.stringify({ detail: 'Endpoint belum tersedia dalam data contoh dokumentasi.' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Read only', { status: 405 });
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });
  await page('/login', 'Masuk');
  await capture('01-login');
  await window.webContents.executeJavaScript(`localStorage.setItem('auth_token', 'documentation-fixture-token'); localStorage.setItem('user_info', ${JSON.stringify(JSON.stringify(user))});`);
  await page('/', 'Dashboard'); await capture('02-dashboard');
  await page('/master-cctv', 'Pintu Utama'); await capture('03-cameras');
  await page('/events', 'Pameran Contoh'); await capture('04-events');
  await page('/events?create=1', 'Buat Event Baru'); await capture('05-create-event');
  await page('/users', 'Pembaca Laporan'); await capture('06-users');
  await click('Tambah pengguna'); await waitFor(`document.body.innerText.includes('Identitas dan hak akses')`); await capture('07-user-permissions');
  await page('/settings', 'Zona waktu global'); await capture('08-settings');
  await page('/settings?tab=sync', 'Sinkronkan sekarang'); await capture('09-sync');
  if (failures.size) throw new Error(`Capture tidak lengkap:\n${[...failures].join('\n')}`);
  // Reuse the sandboxed window and serve the guide on the allowed loopback origin.
  await window.loadURL(origin + '/__manual/index.html');
  await window.webContents.executeJavaScript('Promise.all([...document.images].map(image => image.decode())).then(() => document.fonts.ready).then(() => true)');
  const pdf = await window.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
  fs.writeFileSync(path.join(output, 'Visitor-Counter-Manual.pdf'), pdf);
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ version: require('../../package.json').version,
    source: process.env.GITHUB_SHA || 'local', captured_at: new Date().toISOString(), fixture_data: true, complete: true,
    note: 'UI aplikasi asli dengan respons API contoh; bukan pengujian integrasi backend.', screenshots: captured }, null, 2));
  console.log(`Selesai: ${captured.length} screenshot dan PDF.`);
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
