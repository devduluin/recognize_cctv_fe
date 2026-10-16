// Starts an isolated Next instance; the renderer intercepts every API request with fixtures.
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validatePackage } = require('./package-output.cjs');
const { output, root } = require('./render.cjs');
async function main() {
  if (!fs.existsSync(path.join(root, '.next/BUILD_ID'))) throw new Error('Jalankan build dokumentasi terlebih dahulu; lihat docs/manual/capture.md.');
  const standalone = path.join(root, '.next/standalone');
  const entry = path.join(standalone, 'server.js');
  if (!fs.existsSync(entry)) throw new Error('Output standalone belum tersedia. Jalankan npm run docs:generate.');
  // Next standalone needs these assets copied explicitly, as in desktop packaging.
  for (const [source, destination] of [['public', 'public'], ['.next/static', '.next/static']]) {
    const target = path.join(standalone, destination);
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(path.join(root, source), target, { recursive: true });
  }
  const port = await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, DESKTOP_MODE: 'false', HOSTNAME: '127.0.0.1', PORT: String(port), IS_MAINTENANCE: 'false', IS_MAINTANANCE: 'false', NEXT_PUBLIC_IS_MAINTENANCE: 'false', NEXT_PUBLIC_IS_MAINTANANCE: 'false' };
  delete env.ELECTRON_RUN_AS_NODE;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-manual-'));
  let electron;
  const server = spawn(process.execPath, [entry], { cwd: standalone, env, stdio: 'inherit' });
  let serverError;
  server.on('error', error => { serverError = error; });
  const stop = () => { electron?.kill(); server.kill(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (serverError) throw serverError;
      if (server.exitCode !== null) throw new Error('Next.js berhenti sebelum siap.');
      try { const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('Next.js tidak siap dalam 60 detik.');
    // A previous run must never make an interrupted capture appear complete.
    for (const name of ['manifest.json', 'Visitor-Counter-Manual.pdf']) fs.rmSync(path.join(output, name), { force: true });
    await new Promise((resolve, reject) => {
      electron = spawn(require('electron'), [path.join(__dirname, 'capture-window.cjs'), origin, output, profile], { cwd: root, env, stdio: 'inherit' });
      electron.once('error', reject);
      electron.once('exit', code => code === 0 ? resolve() : reject(new Error(`Capture gagal (${code}).`)));
    });
    validatePackage(output);
  } finally {
    stop();
    await new Promise(resolve => setTimeout(resolve, 500));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
