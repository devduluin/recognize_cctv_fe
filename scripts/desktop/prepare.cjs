const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const config = require('../../desktop.config.json');
const lockPath = path.join(root, 'desktop-assets.lock.json');
const lockMode = process.argv.includes('--lock-assets');

async function main() {
  const targets = [{ platform: 'darwin', arch: 'arm64', media: 'darwin_arm64' }, { platform: 'darwin', arch: 'x64', media: 'darwin_amd64' }, { platform: 'win32', arch: 'x64', media: 'windows_amd64' }];
  const mediaRelease = lockMode ? await (await fetch(`https://api.github.com/repos/bluenviron/mediamtx/releases/tags/v${config.mediaMtxVersion}`)).json() : null;
  const nodeChecksums = lockMode ? await (await fetch(`https://nodejs.org/dist/v${config.nodeVersion}/SHASUMS256.txt`)).text() : '';
  const lock = lockMode ? {} : JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lockMode) {
    for (const target of targets) {
      const nodeFile = `node-v${config.nodeVersion}-${target.platform === 'win32' ? 'win' : 'darwin'}-${target.arch}.${target.platform === 'win32' ? 'zip' : 'tar.gz'}`;
      const mediaFile = `mediamtx_v${config.mediaMtxVersion}_${target.media}.${target.platform === 'win32' ? 'zip' : 'tar.gz'}`;
      const nodeLine = nodeChecksums.split('\n').find(line => line.trim().endsWith(` ${nodeFile}`));
      const asset = mediaRelease.assets?.find(asset => asset.name === mediaFile);
      const mediaHash = asset?.digest?.replace('sha256:', '');
      if (!nodeLine || !/^[0-9a-f]{64}$/.test(mediaHash || '')) throw new Error(`Missing trusted upstream checksum for ${nodeFile}/${mediaFile}`);
      lock[`${target.platform}-${target.arch}`] = {
        node: { url: `https://nodejs.org/dist/v${config.nodeVersion}/${nodeFile}`, sha256: nodeLine.split(/\s+/)[0] },
        mediamtx: { url: asset.browser_download_url, sha256: mediaHash },
      };
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    return;
  }
  const target = targets.find(target => target.platform === process.platform && target.arch === process.arch);
  if (!target) throw new Error('Build on Windows x64, macOS arm64 or macOS x64.');
  const assets = lock[`${process.platform}-${process.arch}`];
  const resources = path.join(root, 'resources');
  const cache = path.join(root, 'desktop-cache');
  fs.mkdirSync(cache, { recursive: true });
  for (const [kind, item] of Object.entries(assets)) {
    const archive = path.join(cache, path.basename(new URL(item.url).pathname));
    if (!fs.existsSync(archive)) {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error(`Download failed (${response.status}): ${item.url}`);
      fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()), { flag: 'wx' });
    }
    if (crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== item.sha256) throw new Error(`Checksum failed: ${archive}`);
    const destination = path.join(cache, `${kind}-${process.platform}-${process.arch}`);
    fs.mkdirSync(destination, { recursive: true });
    execFileSync('tar', ['-xf', archive, '-C', destination]);
    const source = kind === 'node' ? path.join(destination, fs.readdirSync(destination).find(name => name.startsWith('node-')), process.platform === 'win32' ? 'node.exe' : 'bin/node') : path.join(destination, process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx');
    const output = path.join(resources, kind === 'node' ? 'node' : 'media', path.basename(source));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(source, output);
    if (process.platform !== 'win32') fs.chmodSync(output, 0o755);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
