'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.join(__dirname, '../scripts/tauri/run.cjs');
function run(mode, platform, env = {}, files = {}) {
  const calls = [];
  const fileOps = [];
  const process = { argv: ['node', filename, mode], platform, env, execPath: '/node', exit(code) { throw new Error(`Unexpected exit: ${code}`); } };
  const mockFs = {
    existsSync() { return true; },
    readdirSync(dir) { return path.basename(dir) === 'x64' ? (files.work || ['app1.cab']) : (files.output || []); },
    rmSync(file) { fileOps.push(['rm', path.basename(file)]); },
    renameSync(from, to) { fileOps.push(['move', path.basename(from), path.basename(path.dirname(to))]); },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    __dirname: path.dirname(filename), process, console: { log() {} },
    require(name) {
      if (name === 'node:child_process') return { spawnSync(command, args) { calls.push({ command, args: Array.from(args) }); return { status: 0 }; } };
      if (name === 'node:fs') return mockFs;
      return require(name);
    },
  });
  calls.fileOps = fileOps;
  return calls;
}
test('build forwards lockfile flag to Cargo after the Tauri argument separator on both platforms', () => {
  for (const [platform, bundles] of [['darwin', 'app,dmg'], ['win32', 'msi']]) {
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
  const args = run('build', 'darwin', env).at(-1).args;
  assert.deepEqual(args.slice(0, 4), ['tauri', 'build', '--bundles', 'app,dmg']);
  assert.equal(args[4], '--config');
  const config = JSON.parse(args[5]);
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.plugins.updater.pubkey, 'public-key');
  assert.deepEqual(config.plugins.updater.endpoints, ['https://github.com/devduluin/recognize_cctv_fe/releases/latest/download/latest.json']);
  assert.deepEqual(args.slice(-2), ['--', '--locked']);
});
test('Windows builds ship without the updater because it cannot install a split-cabinet MSI', () => {
  const env = { DESKTOP_UPDATER_PUBKEY: 'public-key', TAURI_SIGNING_PRIVATE_KEY: 'private-key' };
  assert.deepEqual(run('build', 'win32', env).at(-1).args, ['tauri', 'build', '--bundles', 'msi', '--', '--locked']);
  assert.deepEqual(run('dev', 'win32', env).at(-1).args, ['tauri', 'dev']);
});
test('an update public key without the signing key stops the build instead of shipping unsigned updates', () => {
  assert.throws(() => run('build', 'darwin', { DESKTOP_UPDATER_PUBKEY: 'public-key' }), /TAURI_SIGNING_PRIVATE_KEY/);
  assert.throws(() => run('package', 'darwin', { DESKTOP_UPDATER_PUBKEY: 'k', TAURI_SIGNING_PRIVATE_KEY: 'p', DESKTOP_UPDATER_ENDPOINT: 'http://insecure' }), /HTTPS/);
});
test('Windows MSI cabinets are moved next to the installer and stale cabinets removed', () => {
  const calls = run('package', 'win32', {}, { work: ['app1.cab', 'app2.cab', 'main.wxs', 'output.wixpdb'], output: ['Visitor Counter_0.1.0_x64_en-US.msi', 'app3.cab'] });
  assert.deepEqual(calls.fileOps, [['rm', 'app3.cab'], ['move', 'app1.cab', 'msi'], ['move', 'app2.cab', 'msi']]);
  assert.deepEqual(run('package', 'darwin').fileOps, []);
  assert.deepEqual(run('dev', 'win32').fileOps, []);
});
test('a Windows MSI build without split cabinets fails instead of shipping an installer that cannot install', () => {
  assert.throws(() => run('build', 'win32', {}, { work: ['main.wxs'], output: [] }), /MSI cabinets not found/);
});
