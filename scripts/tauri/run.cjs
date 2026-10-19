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
const args = mode === 'dev' ? ['tauri', 'dev']
  : mode === 'package' ? ['tauri', 'bundle', '--bundles', bundles]
    : ['tauri', 'build', '--bundles', bundles, '--', '--locked'];
const result = spawnSync('cargo', args, { cwd: root, stdio: 'inherit' });
process.exitCode = result.status || (result.error ? 1 : 0);
