'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { optimizeBackend, compressSamples } = require('../scripts/desktop/optimize-resources.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-optimize-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const internal = path.join(root, 'backend', '_internal');
  const names = ['tensorflow/include/header.h', 'tensorflow/runtime.dylib', 'torch/include/header.h', 'torch/runtime.dll', 'models/yolo/person.pt', 'models/yolo/head.onnx', 'models/yolo/person.directml.onnx', 'models/yolo/person.directml.json', 'models/gender/model.pth', 'facenet-cache/weights.h5'];
  for (const name of names) { const file = path.join(internal, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'data'); }
  return { root, internal };
}
test('macOS excludes development headers and Windows-only models while retaining all inference weights and libraries', t => {
  const { root, internal } = fixture(t);
  assert.equal(optimizeBackend(root, 'darwin'), 16);
  for (const name of ['tensorflow/include', 'torch/include', 'models/yolo/person.directml.onnx', 'models/yolo/person.directml.json']) assert.equal(fs.existsSync(path.join(internal, name)), false);
  for (const name of ['tensorflow/runtime.dylib', 'torch/runtime.dll', 'models/yolo/person.pt', 'models/yolo/head.onnx', 'models/gender/model.pth', 'facenet-cache/weights.h5']) assert.equal(fs.readFileSync(path.join(internal, name), 'utf8'), 'data');
  assert.equal(optimizeBackend(root, 'darwin'), 0);
});
test('Windows keeps DirectML models and metadata', t => {
  const { root, internal } = fixture(t);
  assert.equal(optimizeBackend(root, 'win32'), 8);
  assert.equal(fs.existsSync(path.join(internal, 'models/yolo/person.directml.onnx')), true);
  assert.equal(fs.existsSync(path.join(internal, 'models/yolo/person.directml.json')), true);
});
test('sample compression never follows the public source symlink', { skip: process.platform === 'win32' }, t => {
  const { root } = fixture(t);
  const publicDir = path.join(root, 'next', 'public'); fs.mkdirSync(publicDir, { recursive: true });
  fs.symlinkSync(root, path.join(publicDir, 'samples'));
  assert.throws(() => compressSamples(root), /not the source symlink/);
});

test('sample compression keeps sources and repeated runs avoid another lossy encode', { skip: process.platform === 'win32' }, t => {
  const executable = path.resolve(__dirname, '../resources/media/ffmpeg');
  if (!fs.existsSync(executable)) { t.skip('Bundled FFmpeg is not prepared'); return; }
  const { execFileSync } = require('node:child_process');
  const { root } = fixture(t);
  const media = path.join(root, 'media'), samples = path.join(root, 'next/public/samples');
  fs.mkdirSync(media); fs.mkdirSync(samples, { recursive: true });
  fs.symlinkSync(executable, path.join(media, 'ffmpeg'));
  const original = path.join(root, 'original.mp4'), target = path.join(samples, 'demo.mp4');
  execFileSync(executable, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=10', '-t', '1', '-c:v', 'libx264', '-crf', '0', '-threads', '1', original]);
  const originalBytes = fs.readFileSync(original);
  fs.copyFileSync(original, target);
  const cache = path.join(root, 'cache');
  assert.ok(compressSamples(root, cache) > 0);
  const compressed = fs.readFileSync(target), cacheCount = fs.readdirSync(cache).length;
  assert.deepEqual(fs.readFileSync(original), originalBytes);
  assert.equal(compressSamples(root, cache), 0);
  assert.deepEqual(fs.readFileSync(target), compressed);
  assert.equal(fs.readdirSync(cache).length, cacheCount);
  execFileSync(executable, ['-v', 'error', '-xerror', '-i', target, '-f', 'null', '-']);
});
