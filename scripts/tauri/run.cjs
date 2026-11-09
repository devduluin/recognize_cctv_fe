'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2];
if (!['dev', 'build', 'package'].includes(mode)) throw new Error('Use desktop:dev, desktop:build or desktop:package.');
if (!['win32', 'darwin'].includes(process.platform)) throw new Error('This migration currently targets Windows and macOS.');
const cargo = spawnSync('cargo', ['--version'], { encoding: 'utf8' });
if (cargo.error || cargo.status !== 0) throw new Error('Rust/Cargo belum tersedia. Install toolchain Rust dan prasyarat Tauri, lalu ulangi.');
const cli = spawnSync('cargo', ['tauri', '--version'], { encoding: 'utf8' });
if (cli.status !== 0) throw new Error('Install Tauri CLI: cargo install tauri-cli --version "^2" --locked');
const node = path.join(root, 'resources/node', process.platform === 'win32' ? 'node.exe' : 'node');
if (!fs.existsSync(node)) throw new Error('Siapkan runtime lokal: npm run desktop:assets');
if (mode === 'build') {
  // Build the platform-specific Python, Next.js, Node.js and media resources.
  const result = spawnSync(process.execPath, ['scripts/desktop/build.cjs'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
// NSIS cannot package the Windows ML payload at its current size; WiX MSI can.
const bundles = process.platform === 'darwin' ? 'app,dmg' : 'msi';
const config = updaterConfig();
const extra = config ? ['--config', JSON.stringify(config)] : [];
const args = mode === 'dev' ? ['tauri', 'dev', ...extra]
  : mode === 'package' ? ['tauri', 'bundle', '--bundles', bundles, ...extra]
    : ['tauri', 'build', '--bundles', bundles, ...extra, '--', '--locked'];
const result = spawnSync('cargo', args, { cwd: root, stdio: 'inherit' });
process.exitCode = result.status || (result.error ? 1 : 0);
if (process.exitCode === 0 && mode !== 'dev' && process.platform === 'win32') collectMsiCabinets();

// src-tauri/wix/main.wxs splits the payload into external cabinets because the ML
// payload exceeds the ~2 GiB single-cabinet/MSI limit. Tauri moves only the .msi out of
// the WiX work directory, so copy the cabinets next to it; the MSI cannot install without them.
function collectMsiCabinets() {
  const release = path.join(root, 'src-tauri/target/release');
  const work = path.join(release, 'wix/x64');
  const output = path.join(release, 'bundle/msi');
  const isCabinet = name => /^app\d+\.cab$/i.test(name);
  const cabinets = fs.existsSync(work) ? fs.readdirSync(work).filter(isCabinet) : [];
  if (!cabinets.length) throw new Error(`MSI cabinets not found in ${work}; check src-tauri/wix/main.wxs.`);
  for (const name of fs.readdirSync(output).filter(isCabinet)) fs.rmSync(path.join(output, name));
  for (const name of cabinets) fs.renameSync(path.join(work, name), path.join(output, name));
  console.log(`MSI cabinets (${cabinets.length}) copied to ${output}. Distribute the .msi together with every app*.cab file in the same folder.`);
}

// Updates are opt-in: without a public key the app has no updater and needs no signing key.
function updaterConfig() {
  const pubkey = (process.env.DESKTOP_UPDATER_PUBKEY || '').trim();
  if (!pubkey) return null;
  // The Tauri updater downloads and installs one file, but the Windows MSI needs its external
  // cabinets, and an MSI+CAB ZIP exceeds the 2 GiB GitHub asset limit. Windows builds therefore
  // ship without the updater and are updated by installing the new MSI (docs/windows-exe-build.md).
  if (process.platform === 'win32') {
    console.log('DESKTOP_UPDATER_PUBKEY ignored on Windows: the split-cabinet MSI is updated manually.');
    return null;
  }
  if (mode !== 'dev' && !process.env.TAURI_SIGNING_PRIVATE_KEY) {
    throw new Error('DESKTOP_UPDATER_PUBKEY membutuhkan TAURI_SIGNING_PRIVATE_KEY untuk menandatangani paket pembaruan.');
  }
  const release = require(path.join(root, 'desktop.config.json'));
  const endpoint = process.env.DESKTOP_UPDATER_ENDPOINT
    || `https://github.com/${release.releaseOwner}/${release.releaseRepository}/releases/latest/download/latest.json`;
  if (!endpoint.startsWith('https://')) throw new Error('DESKTOP_UPDATER_ENDPOINT harus memakai HTTPS.');
  return {
    bundle: { createUpdaterArtifacts: mode !== 'dev' },
    plugins: { updater: { pubkey, endpoints: [endpoint], windows: { installMode: 'passive' } } },
  };
}
