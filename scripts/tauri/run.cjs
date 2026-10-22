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
const bundles = process.platform === 'darwin' ? 'app,dmg' : 'nsis';
const config = updaterConfig();
const extra = config ? ['--config', JSON.stringify(config)] : [];
const args = mode === 'dev' ? ['tauri', 'dev', ...extra]
  : mode === 'package' ? ['tauri', 'bundle', '--bundles', bundles, ...extra]
    : ['tauri', 'build', '--bundles', bundles, ...extra, '--', '--locked'];
const result = spawnSync('cargo', args, { cwd: root, stdio: 'inherit' });
process.exitCode = result.status || (result.error ? 1 : 0);

// Updates are opt-in: without a public key the app has no updater and needs no signing key.
function updaterConfig() {
  const pubkey = (process.env.DESKTOP_UPDATER_PUBKEY || '').trim();
  if (!pubkey) return null;
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
