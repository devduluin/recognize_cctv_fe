const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTargetArgs, selectSigningPreference, signingEnvironment } = require('../scripts/desktop/platform-selector.cjs');

test('selects the native target when no target flags are supplied', () => {
  assert.deepEqual(resolveTargetArgs([], 'darwin', 'arm64'), ['--mac']);
  assert.deepEqual(resolveTargetArgs([], 'win32', 'x64'), ['--win', '--x64']);
  assert.deepEqual(resolveTargetArgs([], 'linux', 'x64'), ['--linux', '--x64']);
});

test('accepts explicit native targets and rejects cross-platform builds', () => {
  assert.deepEqual(resolveTargetArgs(['--mac', '--arm64'], 'darwin', 'arm64'), ['--mac', '--arm64']);
  assert.throws(() => resolveTargetArgs(['--win', '--x64'], 'darwin', 'arm64'), /harus dijalankan pada mesin Windows x64/);
  assert.throws(() => resolveTargetArgs(['--mac', '--x64'], 'darwin', 'arm64'), /harus dijalankan pada mesin macOS x64/);
});

test('rejects conflicting targets and unsupported architectures', () => {
  assert.throws(() => resolveTargetArgs(['--mac', '--linux'], 'darwin', 'arm64'), /Pilih hanya satu target/);
  assert.throws(() => resolveTargetArgs([], 'linux', 'arm64'), /tidak didukung/);
});

test('Linux builds skip code-signing selection and unsigned builds disable signing identities', async () => {
  let message = '';
  const output = { isTTY: true, write: value => { message += value; } };
  assert.equal(await selectSigningPreference(['--linux', '--x64'], { platform: 'darwin', input: { isTTY: true }, output }), false);
  assert.match(message, /tidak berlaku untuk paket Linux/);
  assert.deepEqual(signingEnvironment(false), {
    DESKTOP_REQUIRE_SIGNING: 'false', CSC_IDENTITY_AUTO_DISCOVERY: 'false', CSC_LINK: '', CSC_NAME: '', WIN_CSC_LINK: '', WIN_CSC_NAME: '',
  });
  assert.deepEqual(signingEnvironment(true), { DESKTOP_REQUIRE_SIGNING: 'true', CSC_IDENTITY_AUTO_DISCOVERY: 'true' });
});
