'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { validateResources } = require('../scripts/tauri/validate-resources.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-resource-links-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'torch/lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'torch/lib/library.dylib'), 'native-library');
  return root;
}
test('macOS preserves directory links before signing; Windows retains standard resource packaging', () => {
  const base = require('../src-tauri/tauri.conf.json');
  const mac = require('../src-tauri/tauri.macos.conf.json');
  const win = require('../src-tauri/tauri.windows.conf.json');
  assert.equal(base.bundle.resources['../resources/'], undefined);
  assert.equal(mac.bundle.macOS.files['Resources/runtime/resources'], '../resources');
  assert.equal(win.bundle.resources['../resources/'], 'runtime/resources/');
  assert.match(base.build.beforeBundleCommand, /validate-resources/);
});
test('internal relative library aliases are accepted and duplicate bytes are measured', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t);
  fs.symlinkSync('torch/lib/library.dylib', path.join(root, 'library.dylib'));
  assert.deepEqual(validateResources(root), { links: 1, savedBytes: 14 });
});
test('broken, absolute and escaping resource links fail before packaging', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t), link = path.join(root, 'alias');
  fs.symlinkSync('missing', link);
  assert.throws(() => validateResources(root), /Broken resource symlink/);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(root, 'torch/lib/library.dylib'), link);
  assert.throws(() => validateResources(root), /Absolute resource symlink/);
  fs.unlinkSync(link);
  const outside = path.join(root, '../' + path.basename(root) + '-outside');
  fs.writeFileSync(outside, 'outside');
  t.after(() => fs.rmSync(outside));
  fs.symlinkSync(path.relative(root, outside), link);
  assert.throws(() => validateResources(root), /Resource symlink escapes bundle/);
});
