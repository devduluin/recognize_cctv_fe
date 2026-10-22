const fs = require('node:fs');
const path = require('node:path');
const { documentationResponse } = require('./package-output.cjs');
const { fixture, user } = require('./fixtures.cjs');
const { launchBrowser } = require('./chromium.cjs');
const [origin, output, profile] = process.argv.slice(2);
if (!origin || new URL(origin).hostname !== '127.0.0.1' || !output || !profile) throw new Error('Capture membutuhkan server loopback dan direktori keluaran.');
const failures = new Set(), captured = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, client;
async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if (await client.evaluate(expression)) return; }
    catch (error) { if (!/context|navigat/i.test(error.message)) throw error; }
    await pause(100);
  }
  throw new Error(`Tampilan belum siap: ${expression}`);
}
async function page(route, ready) {
  const result = await client.send('Page.navigate', { url: origin + route });
  if (result.errorText) throw new Error(result.errorText);
  await waitFor(`location.pathname + location.search === ${JSON.stringify(route)} && document.body && document.body.innerText.includes(${JSON.stringify(ready)}) && !document.body.innerText.includes('Memuat hak akses')`);
  await client.evaluate('document.fonts.ready.then(() => true)');
  await pause(1000);
}
async function click(label) {
  const found = await client.evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(el => el.innerText.trim() === ${JSON.stringify(label)}); if (!el || el.disabled) return false; el.click(); return true; })()`);
  if (!found) throw new Error(`Tombol tidak ditemukan: ${label}`);
}
async function capture(name) {
  await pause(600);
  const alerts = await client.evaluate(`Array.from(document.querySelectorAll('[role="alert"]')).map(el => el.innerText).filter(Boolean)`);
  if (alerts.length) throw new Error(`Halaman ${name} memiliki peringatan: ${alerts.join('; ')}`);
  const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const bytes = Buffer.from(image.data, 'base64');
  if (!bytes.length) throw new Error(`Screenshot kosong: ${name}`);
  fs.writeFileSync(path.join(output, 'screenshots', name + '.png'), bytes);
  captured.push(name);
}
async function main() {
  fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
  browser = await launchBrowser(profile); client = browser.client;
  await client.send('Page.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  client.on('Fetch.requestPaused', params => {
    (async () => {
      const request = params.request, url = new URL(request.url);
      let response;
      if (url.origin !== origin) { failures.add('Permintaan eksternal diblokir: ' + url.origin); response = new Response('Blocked', { status: 403 }); }
      else if (url.pathname.startsWith('/__manual/')) response = documentationResponse(url, output);
      else if (url.pathname.startsWith('/api/')) {
        const body = fixture(url, request.method);
        if (body === undefined) { failures.add(`${request.method} ${url.pathname}`); response = Response.json({ detail: 'Endpoint belum tersedia dalam data contoh dokumentasi.' }, { status: 501 }); }
        else response = Response.json(body);
      } else if (!['GET', 'HEAD'].includes(request.method)) response = new Response('Read only', { status: 405 });
      else { await client.send('Fetch.continueRequest', { requestId: params.requestId }); return; }
      await client.send('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: response.status,
        responseHeaders: [...response.headers].map(([name, value]) => ({ name, value })), body: Buffer.from(await response.arrayBuffer()).toString('base64') });
    })().catch(error => { failures.add(error.message); void client.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' }).catch(() => {}); });
  });
  await client.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await page('/login', 'Masuk');
  await capture('01-login');
  await client.evaluate(`localStorage.setItem('auth_token', 'documentation-fixture-token'); localStorage.setItem('user_info', ${JSON.stringify(JSON.stringify(user))});`);
  await page('/', 'Dashboard'); await capture('02-dashboard');
  await page('/master-cctv', 'Pintu Utama'); await capture('03-cameras');
  await page('/events', 'Pameran Contoh'); await capture('04-events');
  await page('/events?create=1', 'Buat Event Baru'); await capture('05-create-event');
  await page('/users', 'Pembaca Laporan'); await capture('06-users');
  await click('Tambah pengguna'); await waitFor(`document.body.innerText.includes('Identitas dan hak akses')`); await capture('07-user-permissions');
  await page('/settings', 'Zona waktu global'); await capture('08-settings');
  await page('/settings?tab=sync', 'Sinkronkan sekarang'); await capture('09-sync');
  if (failures.size) throw new Error(`Capture tidak lengkap:\n${[...failures].join('\n')}`);
  await client.send('Page.navigate', { url: origin + '/__manual/index.html' });
  await waitFor("location.pathname === '/__manual/index.html' && document.readyState === 'complete'");
  await client.evaluate('Promise.all([...document.images].map(image => image.decode())).then(() => document.fonts.ready).then(() => true)');
  const pdf = await client.send('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, preferCSSPageSize: true });
  fs.writeFileSync(path.join(output, 'Visitor-Counter-Manual.pdf'), Buffer.from(pdf.data, 'base64'));
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ version: require('../../package.json').version,
    source: process.env.GITHUB_SHA || 'local', captured_at: new Date().toISOString(), fixture_data: true, complete: true,
    note: 'UI aplikasi asli dengan respons API contoh; bukan pengujian integrasi backend.', screenshots: captured }, null, 2));
  console.log(`Selesai: ${captured.length} screenshot dan PDF.`);

}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
