const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-package-smoke-'));
const defaultExecutable = process.platform === 'win32' ? path.join(root, 'dist-desktop/win-unpacked/Visitor Counter.exe')
  : process.platform === 'darwin' ? path.join(root, `dist-desktop/mac${process.arch === 'arm64' ? '-arm64' : ''}/Visitor Counter.app/Contents/MacOS/Visitor Counter`)
    : path.join(root, 'dist-desktop/linux-unpacked/visitor-counter');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--executable')) {
  throw new Error('Usage: node scripts/desktop/packaged-smoke.cjs [--executable <installed-app-path>]');
}
const executable = args.length ? path.resolve(args[1]) : defaultExecutable;
if (!fs.statSync(executable).isFile()) throw new Error('Desktop smoke executable is not a file.');

async function launch() {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, ['--desktop-smoke'], { env: { ...process.env, DESKTOP_TEST_DATA: directory }, stdio: 'inherit', windowsHide: true });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Packaged smoke test timed out')); }, 240000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`Packaged smoke exit ${code}`)); });
  });
  const reportPath = path.join(directory, 'desktop-smoke.json');
  if (!fs.existsSync(reportPath)) {
    const startupError = path.join(directory, 'desktop-smoke-error.txt');
    if (fs.existsSync(startupError)) throw new Error(fs.readFileSync(startupError, 'utf8'));
    const logs = ['backend', 'mediamtx', 'frontend'].map(name => {
      const file = path.join(directory, 'data/logs', `${name}.log`);
      return fs.existsSync(file) ? `\n--- ${name} ---\n${fs.readFileSync(file, 'utf8').slice(-6000)}` : '';
    }).join('');
    throw new Error(`Packaged app exited without writing its smoke report.${logs}`);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.ok, true);
}
(async () => {
  await launch();
  const secret = fs.readFileSync(path.join(directory, 'data/jwt-secret'), 'utf8');
  const database = fs.statSync(path.join(directory, 'data/visitor.sqlite')).size;
  await launch();
  assert.equal(fs.readFileSync(path.join(directory, 'data/jwt-secret'), 'utf8'), secret);
  assert.ok(fs.statSync(path.join(directory, 'data/visitor.sqlite')).size >= database);
  console.log(`Packaged desktop and restart persistence verified: ${directory}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
