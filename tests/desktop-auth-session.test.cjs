const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { AuthSessionStore, restoreSession, trustedSender } = require('../electron/auth-session.cjs');
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

test('session IPC accepts only the current window main frame and exact origin', () => {
  const frame = { url: 'http://127.0.0.1:40001/events' };
  const window = { webContents: { mainFrame: frame } };
  const event = { sender: window.webContents, senderFrame: frame };
  assert.equal(trustedSender(event, window, 'http://127.0.0.1:40001'), true);
  assert.equal(trustedSender(event, window, 'http://127.0.0.1:40002'), false);
  assert.equal(trustedSender({ ...event, sender: {} }, window, 'http://127.0.0.1:40001'), false);
  assert.equal(trustedSender({ ...event, senderFrame: { url: frame.url } }, window, 'http://127.0.0.1:40001'), false);
});

test('preload hydrates before page scripts and clears stale origin storage after logout', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../electron/preload.cjs'), 'utf8');
  for (const saved of [session, null]) {
    const storage = new Map([['auth_token', 'stale-origin-token'], ['user_info', '{}']]);
    const operations = [];
    let bridge;
    vm.runInNewContext(source, {
      require: name => {
        assert.equal(name, 'electron');
        return {
          ipcRenderer: { sendSync: (channel, message) => { operations.push(message.action); return { ok: true, session: message.action === 'read' ? saved : undefined }; } },
          contextBridge: { exposeInMainWorld: (name, value) => { if (name === 'desktopAuthSession') bridge = value; else assert.equal(name, 'desktopCameraNetwork'); } },
        };
      },
      localStorage: { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    });
    assert.equal(storage.get('auth_token'), saved?.token);
    if (saved) assert.equal(JSON.parse(storage.get('user_info')).id, saved.user.id);
    bridge.save(session); bridge.clear();
    assert.deepEqual(operations, ['read', 'save', 'clear']);
  }
});
