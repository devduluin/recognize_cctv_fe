'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.join(__dirname, '../scripts/tauri/run.cjs');
function run(mode, platform, env = {}) {
  const calls = [];
  const process = { argv: ['node', filename, mode], platform, env, execPath: '/node', exit(code) { throw new Error(`Unexpected exit: ${code}`); } };
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
test('updates are opt-in and signed release builds point at the GitHub release feed', () => {
  const env = { DESKTOP_UPDATER_PUBKEY: 'public-key', TAURI_SIGNING_PRIVATE_KEY: 'private-key' };
  const args = run('build', 'win32', env).at(-1).args;
  assert.deepEqual(args.slice(0, 4), ['tauri', 'build', '--bundles', 'nsis']);
  assert.equal(args[4], '--config');
  const config = JSON.parse(args[5]);
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.plugins.updater.pubkey, 'public-key');
  assert.deepEqual(config.plugins.updater.endpoints, ['https://github.com/devduluin/recognize_cctv_fe/releases/latest/download/latest.json']);
  assert.deepEqual(args.slice(-2), ['--', '--locked']);
});
test('an update public key without the signing key stops the build instead of shipping unsigned updates', () => {
  assert.throws(() => run('build', 'darwin', { DESKTOP_UPDATER_PUBKEY: 'public-key' }), /TAURI_SIGNING_PRIVATE_KEY/);
  assert.throws(() => run('package', 'darwin', { DESKTOP_UPDATER_PUBKEY: 'k', TAURI_SIGNING_PRIVATE_KEY: 'p', DESKTOP_UPDATER_ENDPOINT: 'http://insecure' }), /HTTPS/);
});
