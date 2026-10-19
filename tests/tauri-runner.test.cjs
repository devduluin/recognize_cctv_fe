'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.join(__dirname, '../scripts/tauri/run.cjs');
function run(mode, platform) {
  const calls = [];
  const process = { argv: ['node', filename, mode], platform, execPath: '/node', exit(code) { throw new Error(`Unexpected exit: ${code}`); } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    __dirname: path.dirname(filename), process,
    require(name) {
      if (name === 'node:child_process') return { spawnSync(command, args) { calls.push({ command, args: Array.from(args) }); return { status: 0 }; } };
      if (name === 'node:fs') return { existsSync() { return true; } };
      return require(name);
    },
  });
  return calls;
}
test('build forwards lockfile flag to Cargo after the Tauri argument separator on both platforms', () => {
  for (const [platform, bundles] of [['darwin', 'app,dmg'], ['win32', 'nsis']]) {
    const calls = run('build', platform);
    assert.equal(calls.at(-2).command, '/node');
    assert.deepEqual(calls.at(-1).args, ['tauri', 'build', '--bundles', bundles, '--', '--locked']);
  }
});
test('package reuses an existing build without rerunning backend or frontend', () => {
  const calls = run('package', 'darwin');
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.at(-1).args, ['tauri', 'bundle', '--bundles', 'app,dmg']);
});
