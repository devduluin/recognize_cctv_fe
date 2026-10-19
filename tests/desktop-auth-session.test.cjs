const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { AuthSessionStore, restoreSession } = require('../desktop/auth-session.cjs');
const key = randomBytes(32);
const encryption = {
  isEncryptionAvailable: () => true,
  encryptString(text) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]);
  },
  decryptString(bytes) {
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString();
  },
};
const session = { token: 'test-session-token', user: { id: 'user-id', email: 'user@example.test', full_name: 'User' } };
function setup(t, crypto = encryption) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-session-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return new AuthSessionStore(directory, crypto, 'linux');
}

test('session survives restart and port changes, is encrypted, and excludes passwords', async t => {
  const store = setup(t);
  store.write({ ...session, password: 'not-stored', user: { ...session.user, password: 'also-not-stored' } });
  assert.ok(!fs.readFileSync(store.file).includes(session.token));
  const restarted = new AuthSessionStore(path.dirname(store.file), encryption);
  const urls = [];
  for (const port of [40001, 40002]) {
    const restored = await restoreSession(restarted, { backendOrigin: `http://127.0.0.1:${port}`, serviceToken: 'service' }, async (url, options) => {
      urls.push(url);
      assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
      assert.equal(options.headers['X-Desktop-Service-Token'], 'service');
      return Response.json({ result: { user: { ...session.user, full_name: 'Validated user' } } });
    });
    assert.equal(restored.user.full_name, 'Validated user');
  }
  assert.notEqual(urls[0], urls[1]);
  assert.ok(!encryption.decryptString(fs.readFileSync(store.file)).includes('password'));
  restarted.clear();
  assert.equal(restarted.read(), null);
});

test('revoked or expired session is removed; transient failures retain stored session', async t => {
  const store = setup(t), runtime = { backendOrigin: 'http://127.0.0.1:40000', serviceToken: 'service' };
  store.write(session);
  await assert.rejects(restoreSession(store, runtime, async () => new Response(null, { status: 503 })));
  assert.deepEqual(store.read(), session);
  await assert.rejects(restoreSession(store, runtime, async () => { throw new Error('network'); }));
  assert.deepEqual(store.read(), session);
  assert.equal(await restoreSession(store, runtime, async () => new Response(null, { status: 401 })), null);
  assert.equal(store.read(), null);
});

test('plaintext fallback and unavailable OS encryption never persist session', t => {
  for (const crypto of [{ ...encryption, isEncryptionAvailable: () => false }, { ...encryption, getSelectedStorageBackend: () => 'basic_text' }]) {
    const store = setup(t, crypto);
    assert.throws(() => store.write(session));
    assert.equal(fs.existsSync(store.file), false);
  }
});

test('invalid or unreadable credentials fail closed', t => {
  const store = setup(t);
  assert.throws(() => store.write({ token: 'x', user: {} }));
  fs.writeFileSync(store.file, 'corrupt');
  assert.equal(store.read(), null);
});
