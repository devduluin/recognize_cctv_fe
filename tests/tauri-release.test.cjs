'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collect, publish } = require('../scripts/tauri/release.cjs');

const root = path.join(__dirname, '..');
const version = '1.2.3';
const changelog = `# Changelog\n\n## Unreleased\n- next\n\n## ${version}\n- Faster counting.\n\n## 1.2.30\n- other\n`;

const temps = [];
test.after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-release-'));
  temps.push(dir);
  return dir;
}
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function windowsBundle(cabinets = ['app1.cab', 'app2.cab']) {
  const bundle = tempDir();
  write(path.join(bundle, 'msi', 'Visitor Counter_1.2.3_x64_en-US.msi'), 'msi');
  for (const name of cabinets) write(path.join(bundle, 'msi', name), `cab ${name}`);
  return bundle;
}
function macBundle() {
  const bundle = tempDir();
  write(path.join(bundle, 'macos', 'Visitor Counter.app.tar.gz'), 'app');
  write(path.join(bundle, 'macos', 'Visitor Counter.app.tar.gz.sig'), 'signature\n');
  write(path.join(bundle, 'dmg', 'Visitor Counter_1.2.3_aarch64.dmg'), 'dmg');
  return bundle;
}
function releaseDir() {
  const out = tempDir();
  collect({ bundle: windowsBundle(), out, version, platform: 'windows-x86_64', readCabinets: () => ['app1.cab', 'app2.cab'] });
  for (const platform of ['darwin-aarch64', 'darwin-x86_64']) collect({ bundle: macBundle(), out, version, platform });
  return out;
}

test('Windows release files are the renamed MSI, every cabinet it references and their checksums', () => {
  const out = tempDir();
  const assets = collect({ bundle: windowsBundle(), out, version, platform: 'windows-x86_64', readCabinets: () => ['app1.cab', 'app2.cab'] });
  const sums = 'VisitorCounter_1.2.3_windows-x86_64.SHA256SUMS.txt';
  assert.deepEqual(assets, ['VisitorCounter_1.2.3_windows-x86_64.msi', 'app1.cab', 'app2.cab', sums]);
  assert.deepEqual(fs.readdirSync(out).sort(), [...assets].sort());
  const hash = crypto.createHash('sha256').update('cab app2.cab').digest('hex');
  assert.match(fs.readFileSync(path.join(out, sums), 'utf8'), new RegExp(`^${hash}  app2\\.cab$`, 'm'));
  assert.ok(!assets.some(name => name.endsWith('.update.json')), 'Windows has no updater entry');
});

test('Windows collection fails when cabinets are missing, stale or embedded', () => {
  const run = (cabinets, referenced) => collect({ bundle: windowsBundle(cabinets), out: tempDir(), version, platform: 'windows-x86_64', readCabinets: () => referenced });
  assert.throws(() => run(['app1.cab'], ['app1.cab', 'app2.cab']), /missing.*app2\.cab/);
  assert.throws(() => run(['app1.cab', 'app2.cab', 'app3.cab'], ['app1.cab', 'app2.cab']), /not referenced.*app3\.cab/);
  assert.throws(() => run([], []), /external app\*\.cab/);
  assert.throws(() => run([], ['#app1.cab']), /external app\*\.cab/);
});

test('macOS release files keep the signed updater package', () => {
  const out = tempDir();
  const assets = collect({ bundle: macBundle(), out, version, platform: 'darwin-aarch64' });
  assert.deepEqual(assets, [
    'VisitorCounter_1.2.3_darwin-aarch64.app.tar.gz',
    'VisitorCounter_1.2.3_darwin-aarch64.app.tar.gz.sig',
    'VisitorCounter_1.2.3_darwin-aarch64.dmg',
    'darwin-aarch64.update.json',
  ]);
  const bundle = macBundle();
  fs.writeFileSync(path.join(bundle, 'macos', 'Visitor Counter.app.tar.gz.sig'), '');
  assert.throws(() => collect({ bundle, out: tempDir(), version, platform: 'darwin-x86_64' }), /signature/);
});

test('latest.json lists only macOS update packages and the notes explain the Windows download', () => {
  const dir = releaseDir();
  const notes = publish({ dir, version, repository: 'owner/repo', changelog, now: new Date('2026-01-02T03:04:05Z') });
  const latest = JSON.parse(fs.readFileSync(path.join(dir, 'latest.json'), 'utf8'));
  assert.equal(latest.version, version);
  assert.equal(latest.notes, '- Faster counting.');
  assert.deepEqual(Object.keys(latest.platforms).sort(), ['darwin-aarch64', 'darwin-x86_64']);
  assert.deepEqual(latest.platforms['darwin-aarch64'], {
    signature: 'signature',
    url: 'https://github.com/owner/repo/releases/download/v1.2.3/VisitorCounter_1.2.3_darwin-aarch64.app.tar.gz',
  });
  assert.ok(!fs.readdirSync(dir).some(name => name.endsWith('.update.json')), 'manifest fragments are not uploaded');
  assert.match(notes, /^- Faster counting\./);
  assert.match(notes, /VisitorCounter_1\.2\.3_windows-x86_64\.msi.*app1\.cab, app2\.cab/);
});

test('publishing fails when a Windows file is missing, corrupted or a changelog section is absent', () => {
  let dir = releaseDir();
  fs.rmSync(path.join(dir, 'app2.cab'));
  assert.throws(() => publish({ dir, version, repository: 'owner/repo', changelog }), /app2\.cab is missing/);
  dir = releaseDir();
  fs.appendFileSync(path.join(dir, 'app1.cab'), 'x');
  assert.throws(() => publish({ dir, version, repository: 'owner/repo', changelog }), /app1\.cab does not match/);
  dir = releaseDir();
  fs.rmSync(path.join(dir, 'VisitorCounter_1.2.3_windows-x86_64.SHA256SUMS.txt'));
  assert.throws(() => publish({ dir, version, repository: 'owner/repo', changelog }), /checksum/);
  assert.throws(() => publish({ dir: releaseDir(), version: '9.9.9', repository: 'owner/repo', changelog }), /## 9\.9\.9/);
});

test('release workflow builds the Windows MSI and delegates collection and latest.json to the release script', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.doesNotMatch(workflow, /nsis|setup\.exe/i);
  assert.match(workflow, /node scripts\/tauri\/release\.cjs collect "\$VERSION" "\$PLATFORM" \.\.\/release/);
  assert.match(workflow, /node scripts\/tauri\/release\.cjs publish "\$version" release/);
  assert.match(workflow, /--notes-file release-notes\.md/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/tauri/run.cjs'), 'utf8'), /process\.platform === 'darwin' \? 'app,dmg' : 'msi'/);
});
