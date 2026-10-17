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
});

test('unsigned child process receives no certificate links or inherited signing credentials', () => {
  const base = { PATH: process.env.PATH, CSC_LINK: '', WIN_CSC_LINK: 'certificate.pfx',
    CSC_NAME: 'Developer', CSC_KEY_PASSWORD: 'test-only', CSC_INSTALLER_LINK: 'installer.p12' };
  const env = signingEnvironment(false, base);
  const { spawnSync } = require('node:child_process');
  const child = spawnSync(process.execPath, ['-e',
    'process.stdout.write(JSON.stringify(Object.keys(process.env).filter(k => /^(?:WIN_)?CSC_/i.test(k))))'],
  { env, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ['CSC_IDENTITY_AUTO_DISCOVERY']);
  assert.equal(env.CSC_IDENTITY_AUTO_DISCOVERY, 'false');
  assert.equal(env.DESKTOP_REQUIRE_SIGNING, 'false');
  assert.equal(base.CSC_LINK, '');
  assert.equal(base.CSC_KEY_PASSWORD, 'test-only');
});

test('signed builds preserve certificate credentials and unsigned releases fail early', () => {
  const base = { CSC_LINK: 'certificate.p12', CSC_KEY_PASSWORD: 'test-only', DESKTOP_RELEASE: 'true' };
  const env = signingEnvironment(true, base);
  assert.equal(env.CSC_LINK, base.CSC_LINK);
  assert.equal(env.CSC_KEY_PASSWORD, base.CSC_KEY_PASSWORD);
  assert.equal(env.DESKTOP_REQUIRE_SIGNING, 'true');
  assert.equal(env.CSC_IDENTITY_AUTO_DISCOVERY, 'true');
  assert.throws(() => signingEnvironment(false, base), /release wajib signed/);
});

test('macOS requires signing even in a non-interactive local build', async () => {
  let message = '';
  const signed = await selectSigningPreference(['--mac'], {
    input: { isTTY: false }, output: { isTTY: false, write: value => { message += value; } },
  });
  assert.equal(signed, true);
  assert.match(message, /signing ulang/);
});
