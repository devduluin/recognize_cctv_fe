'use strict';
// Release asset helpers for .github/workflows/release.yml.
//   collect <version> <platform> <out>  copy one platform's build output into release assets
//   publish <version> <dir>             verify all assets, write latest.json and release notes
// Windows ships an MSI with external cabinets (see src-tauri/wix/main.wxs). The Tauri
// updater can install only one downloaded file, so Windows is a manual download and is not
// part of latest.json; see docs/windows-exe-build.md "Updates on Windows".
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ASSET_LIMIT = 2 * 1024 ** 3; // GitHub release assets are limited to 2 GiB each.
const WINDOWS = 'windows-x86_64';
const UPDATER_PLATFORMS = ['darwin-aarch64', 'darwin-x86_64'];
const isCabinet = name => /^app\d+\.cab$/i.test(name);

function collect({ bundle, out, version, platform, readCabinets = msiCabinets }) {
  if (![WINDOWS, ...UPDATER_PLATFORMS].includes(platform)) throw new Error(`Unknown release platform ${platform}`);
  fs.mkdirSync(out, { recursive: true });
  const prefix = `VisitorCounter_${version}_${platform}`;
  const assets = platform === WINDOWS
    ? collectWindows({ bundle, out, prefix, readCabinets })
    : collectMac({ bundle, out, prefix, platform });
  for (const name of assets) {
    if (fs.statSync(path.join(out, name)).size >= ASSET_LIMIT) throw new Error(`${name} exceeds the 2 GiB release asset limit`);
  }
  return assets;
}

function collectWindows({ bundle, out, prefix, readCabinets }) {
  const dir = path.join(bundle, 'msi');
  const msi = single(dir, name => name.toLowerCase().endsWith('.msi'));
  const referenced = readCabinets(path.join(dir, msi));
  if (!referenced.length || referenced.some(name => !isCabinet(name))) {
    throw new Error(`${msi} must reference external app*.cab cabinets only, got [${referenced.join(', ')}]; check src-tauri/wix/main.wxs.`);
  }
  const present = new Map(fs.readdirSync(dir).filter(isCabinet).map(name => [name.toLowerCase(), name]));
  const missing = referenced.filter(name => !present.has(name.toLowerCase()));
  if (missing.length) throw new Error(`Cabinets referenced by ${msi} are missing from ${dir}: ${missing.join(', ')}`);
  const stale = [...present.values()].filter(name => !referenced.some(ref => ref.toLowerCase() === name.toLowerCase()));
  if (stale.length) throw new Error(`Cabinets in ${dir} not referenced by ${msi} (stale build?): ${stale.join(', ')}`);
  // The MSI finds cabinets by name in its own folder, so the cabinets keep their names.
  const installer = `${prefix}.msi`;
  fs.copyFileSync(path.join(dir, msi), path.join(out, installer));
  for (const name of referenced) fs.copyFileSync(path.join(dir, present.get(name.toLowerCase())), path.join(out, name));
  const files = [installer, ...referenced];
  const sums = `${prefix}.SHA256SUMS.txt`;
  fs.writeFileSync(path.join(out, sums), files.map(name => `${sha256(path.join(out, name))}  ${name}\n`).join(''));
  return [...files, sums];
}

function collectMac({ bundle, out, prefix, platform }) {
  const archive = single(path.join(bundle, 'macos'), name => name.endsWith('.app.tar.gz'));
  const dmg = single(path.join(bundle, 'dmg'), name => name.endsWith('.dmg'));
  const update = `${prefix}.app.tar.gz`;
  const signature = path.join(bundle, 'macos', `${archive}.sig`);
  if (!fs.existsSync(signature) || !fs.readFileSync(signature, 'utf8').trim()) throw new Error(`Missing updater signature ${signature}`);
  fs.copyFileSync(path.join(bundle, 'macos', archive), path.join(out, update));
  fs.copyFileSync(signature, path.join(out, `${update}.sig`));
  fs.copyFileSync(path.join(bundle, 'dmg', dmg), path.join(out, `${prefix}.dmg`));
  const manifest = `${platform}.update.json`;
  fs.writeFileSync(path.join(out, manifest), JSON.stringify({ platform, file: update }));
  return [update, `${update}.sig`, `${prefix}.dmg`, manifest];
}

function publish({ dir, version, repository, changelog, now = new Date() }) {
  const section = changelog.split(/^## /m).find(part => part.startsWith(`${version}\n`) || part.startsWith(`${version}\r\n`));
  if (!section) throw new Error(`CHANGELOG.md has no "## ${version}" section; add release notes first.`);
  const notes = section.split('\n').slice(1).join('\n').trim();
  const platforms = {};
  for (const name of fs.readdirSync(dir).filter(file => file.endsWith('.update.json'))) {
    const { platform, file } = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (!UPDATER_PLATFORMS.includes(platform)) throw new Error(`${platform} cannot be installed by the updater`);
    const signature = fs.readFileSync(path.join(dir, `${file}.sig`), 'utf8').trim();
    if (!signature) throw new Error(`Missing signature for ${file}`);
    platforms[platform] = { signature, url: `https://github.com/${repository}/releases/download/v${version}/${file}` };
    fs.rmSync(path.join(dir, name));
  }
  for (const platform of UPDATER_PLATFORMS) {
    if (!platforms[platform]) throw new Error(`Missing ${platform} update package`);
  }
  const windows = verifyWindows(dir, version);
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify({ version, notes, pub_date: now.toISOString(), platforms }, null, 2));
  return `${notes}\n\n${windowsNotes(windows)}`;
}

// Re-hash the Windows files after the artifact round trip so a truncated cabinet fails here.
function verifyWindows(dir, version) {
  const sums = `VisitorCounter_${version}_${WINDOWS}.SHA256SUMS.txt`;
  if (!fs.existsSync(path.join(dir, sums))) throw new Error(`Missing Windows release checksum file ${sums}`);
  const files = fs.readFileSync(path.join(dir, sums), 'utf8').trim().split('\n').map(line => {
    const [, hash, name] = /^([0-9a-f]{64}) {2}(\S+)$/.exec(line.trim()) || [];
    if (!name) throw new Error(`Malformed line in ${sums}: ${line}`);
    if (!fs.existsSync(path.join(dir, name))) throw new Error(`Windows release file ${name} is missing`);
    if (sha256(path.join(dir, name)) !== hash) throw new Error(`Windows release file ${name} does not match ${sums}`);
    return name;
  });
  const installer = `VisitorCounter_${version}_${WINDOWS}.msi`;
  if (!files.includes(installer) || !files.some(isCabinet)) throw new Error(`${sums} must list ${installer} and its app*.cab cabinets`);
  const unlisted = fs.readdirSync(dir).filter(isCabinet).filter(name => !files.includes(name));
  if (unlisted.length) throw new Error(`Cabinets not listed in ${sums}: ${unlisted.join(', ')}`);
  return { installer, cabinets: files.filter(isCabinet), sums };
}

function windowsNotes({ installer, cabinets, sums }) {
  return [
    '### Instalasi Windows',
    `Unduh \`${installer}\` **dan semua** ${cabinets.length} file \`app*.cab\` (${cabinets.join(', ')}) ke satu folder yang sama, lalu jalankan file \`.msi\`. Installer gagal tanpa file CAB.`,
    `Periksa unduhan dengan \`${sums}\` (PowerShell: \`Get-FileHash <file> -Algorithm SHA256\`).`,
    'Windows belum mendapat pembaruan otomatis: untuk memperbarui, keluar dari Visitor Counter lewat menu tray lalu pasang MSI versi baru di atas versi lama. Data di profil aplikasi tidak dihapus.',
  ].join('\n\n');
}

// Reads the Media table, i.e. the external cabinets the MSI needs next to it.
function msiCabinets(msi) {
  const script = [
    '$installer = New-Object -ComObject WindowsInstaller.Installer',
    "$db = $installer.GetType().InvokeMember('OpenDatabase', 'InvokeMethod', $null, $installer, @($env:RELEASE_MSI, 0))",
    "$view = $db.GetType().InvokeMember('OpenView', 'InvokeMethod', $null, $db, @('SELECT `Cabinet` FROM `Media`'))",
    "[void]$view.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $view, $null)",
    "while ($record = $view.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $view, $null)) { $record.GetType().InvokeMember('StringData', 'GetProperty', $null, $record, 1) }",
  ].join('\n');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8', env: { ...process.env, RELEASE_MSI: msi },
  });
  if (result.error || result.status !== 0) throw new Error(`Could not read cabinets from ${msi}: ${result.error || result.stderr}`);
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function single(dir, match) {
  const found = fs.existsSync(dir) ? fs.readdirSync(dir).filter(match) : [];
  if (found.length !== 1) throw new Error(`Expected exactly one release file in ${dir}, found ${found.length}: ${found.join(', ')}`);
  return found[0];
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.alloc(1 << 20);
  const fd = fs.openSync(file, 'r');
  try {
    for (let read; (read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0;) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

module.exports = { collect, publish, msiCabinets, ASSET_LIMIT };

if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const [command, version, ...rest] = process.argv.slice(2);
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error('Usage: release.cjs collect <version> <platform> <out> | publish <version> <dir>');
  if (command === 'collect') {
    const [platform, out] = rest;
    const assets = collect({ bundle: path.join(root, 'src-tauri/target/release/bundle'), out: path.resolve(out), version, platform });
    console.log(`Collected ${platform} release files:\n${assets.join('\n')}`);
  } else if (command === 'publish') {
    const dir = path.resolve(rest[0]);
    const repository = process.env.REPOSITORY;
    if (!repository) throw new Error('Set REPOSITORY (owner/name).');
    const notes = publish({ dir, version, repository, changelog: fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8') });
    fs.writeFileSync(path.join(root, 'release-notes.md'), notes);
    console.log(`Wrote ${path.join(dir, 'latest.json')} and release-notes.md`);
  } else {
    throw new Error(`Unknown command ${command}`);
  }
}
