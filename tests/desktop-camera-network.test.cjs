const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { cameraTarget, checkCameraNetwork } = require('../desktop/camera-network.cjs');
const source = 'rtsp://user:private-password@192.168.1.64:554/Streaming/Channels/101';
const runtime = { backendOrigin: 'http://127.0.0.1:40000', serviceToken: 'private-service-token' };
const authorized = async () => Response.json({ result: { user: { permissions: ['cameras.read'] } } });
function setup(outcome) {
  const socket = new EventEmitter();
  socket.destroy = () => { socket.destroyed = true; };
  return { socket, connect: target => {
    assert.deepEqual(target, { host: '192.168.1.64', port: 554 });
    queueMicrotask(() => outcome === 'connect' ? socket.emit('connect') : socket.emit('error', { code: outcome, message: source }));
    return socket;
  } };
}

test('only RTSP private literal camera addresses can be probed', () => {
  assert.deepEqual(cameraTarget(source), { host: '192.168.1.64', port: 554 });
  for (const url of ['rtsp://example.com/live', 'rtsp://127.0.0.1/live', 'rtsp://8.8.8.8/live']) assert.equal(cameraTarget(url), null);
  for (const url of ['https://192.168.1.64/', 'invalid', 'rtsp://192.168.1.64:99999/live']) assert.throws(() => cameraTarget(url));
});

test('main-process probe runs only after fresh backend authorization and never sends camera credentials', async () => {
  const env = setup('connect');
  const request = async (url, options) => {
    assert.equal(url, runtime.backendOrigin + '/api/v1/auth/me');
    assert.equal(options.headers.Authorization, 'Bearer user-token');
    assert.ok(!JSON.stringify(options).includes('private-password'));
    return authorized();
  };
  assert.deepEqual(await checkCameraNetwork(source, { ...env, token: 'user-token', runtime, platform: 'darwin', request }), { ok: true });
  assert.equal(env.socket.destroyed, true);
});

test('unauthorized users and failed validation cannot open sockets', async () => {
  for (const request of [async () => Response.json({ result: { user: { permissions: ['events.read'] } } }), async () => new Response(null, { status: 401 })]) {
    const result = await checkCameraNetwork(source, { token: 'user-token', runtime, platform: 'darwin', request, connect: () => { throw new Error('must not connect'); } });
    assert.equal(result.ok, false);
    assert.match(result.message, /izin/);
  }
});

test('network denial gives an actionable error without leaking RTSP credentials', async () => {
  const env = setup('EHOSTUNREACH');
  const result = await checkCameraNetwork(source, { ...env, token: 'user-token', runtime, platform: 'darwin', request: authorized });
  assert.equal(result.ok, false);
  assert.match(result.message, /Local Network/);
  assert.ok(!result.message.includes('private-password'));
  assert.equal(env.socket.destroyed, true);
});

test('unresponsive socket is closed at the deadline', async () => {
  const socket = new EventEmitter();
  socket.destroy = () => { socket.destroyed = true; };
  const result = await checkCameraNetwork(source, { token: 'user-token', runtime, platform: 'darwin', request: authorized, connect: () => socket, timeout: 10 });
  assert.equal(result.ok, false);
  assert.equal(socket.destroyed, true);
});
