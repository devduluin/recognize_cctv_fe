'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
function bytes(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) return 0;
  if (stat.isFile()) return stat.size;
  return fs.readdirSync(file).reduce((total, name) => total + bytes(path.join(file, name)), 0);
}
function optimizeBackend(resources, platform = process.platform) {
  const internal = path.join(resources, 'backend', '_internal');
  const base = fs.realpathSync(resources);
  const relative = path.relative(base, fs.realpathSync(internal));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Backend resources must stay inside the generated resource directory.');
  let saved = 0;
  const remove = file => {
    if (!fs.existsSync(file)) return;
    const relative = path.relative(base, fs.realpathSync(file));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Refusing to optimize outside generated resources.');
    saved += bytes(file); fs.rmSync(file, { recursive: true, force: true });
  };
  // Inference does not compile TensorFlow/PyTorch C++ extensions. Keep every
  // shared library, Python module and model weight; exclude development headers.
  for (const packageName of ['tensorflow', 'torch']) remove(path.join(internal, packageName, 'include'));
  const yolo = path.join(internal, 'models', 'yolo');
  if (platform !== 'win32' && fs.existsSync(yolo)) {
    for (const name of fs.readdirSync(yolo)) if (/\.directml\.(onnx|json)$/.test(name)) remove(path.join(yolo, name));
  }
  console.log(`Backend resource optimization: ${(saved / 1024 ** 2).toFixed(1)} MiB removed (development headers/platform-only assets).`);
  return saved;
}
function compressSamples(resources, cacheRoot = path.join(root, 'desktop-cache', 'compressed-samples')) {
  const samples = path.join(resources, 'next', 'public', 'samples');
  if (!fs.existsSync(samples)) return 0;
  // Never follow public/samples back into the source repository.
  if (fs.lstatSync(samples).isSymbolicLink()) throw new Error('Compress only the generated sample directory, not the source symlink.');
  const relativeSamples = path.relative(fs.realpathSync(resources), fs.realpathSync(samples));
  if (relativeSamples.startsWith('..') || path.isAbsolute(relativeSamples)) throw new Error('Sample directory escapes generated resources.');
  const ffmpeg = path.join(resources, 'media', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const preset = ['-map', '0:v:0', '-map', '0:a?', '-map_metadata', '0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-threads', '2', '-c:a', 'copy', '-fps_mode', 'passthrough', '-movflags', '+faststart'];
  const encoder = crypto.createHash('sha256').update(fs.readFileSync(ffmpeg)).digest('hex');
  const profile = crypto.createHash('sha256').update(JSON.stringify(preset)).update(encoder).digest('hex');
  fs.mkdirSync(cacheRoot, { recursive: true });
  let saved = 0;
  for (const name of fs.readdirSync(samples).sort()) {
    const source = path.join(samples, name);
    if (!name.toLowerCase().endsWith('.mp4') || !fs.lstatSync(source).isFile()) continue;
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    if (fs.existsSync(path.join(cacheRoot, `optimized-${profile}-${sourceHash}.json`))) {
      console.log(`${name}: already compressed with this profile.`); continue;
    }
    const key = crypto.createHash('sha256').update(sourceHash).update(profile).digest('hex');
    const cached = path.join(cacheRoot, key + '.mp4');
    if (!fs.existsSync(cached)) {
      const temporary = path.join(cacheRoot, `${key}.partial-${process.pid}.mp4`);
      console.log(`Compressing sample ${name} (original resolution and frame rate)...`);
      try {
        execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source, ...preset, temporary], { stdio: 'inherit', windowsHide: true });
        execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-xerror', '-threads', '2', '-i', temporary, '-map', '0:v:0', '-f', 'null', '-'], { stdio: 'inherit', windowsHide: true });
        fs.renameSync(temporary, cached);
      } finally { fs.rmSync(temporary, { force: true }); }
    }
    const before = fs.statSync(source).size, after = fs.statSync(cached).size;
    if (after < before) {
      const temporary = source + '.compressed';
      try { fs.copyFileSync(cached, temporary); fs.renameSync(temporary, source); }
      finally { fs.rmSync(temporary, { force: true }); }
      const outputHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
      fs.writeFileSync(path.join(cacheRoot, `optimized-${profile}-${outputHash}.json`), JSON.stringify({ profile, outputHash }));
      saved += before - after;
      console.log(`${name}: ${(before / 1024 ** 2).toFixed(1)} → ${(after / 1024 ** 2).toFixed(1)} MiB`);
    } else console.log(`${name}: keeping the smaller original.`);
  }
  console.log(`Sample compression saved ${(saved / 1024 ** 2).toFixed(1)} MiB.`);
  return saved;
}
if (require.main === module) {
  const resources = path.join(root, 'resources');
  optimizeBackend(resources);
  compressSamples(resources);
}
module.exports = { optimizeBackend, compressSamples };
