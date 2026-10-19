const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DesktopRuntime, mediaPorts } = require('../desktop/runtime.cjs');

function runtime(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-media-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const instance = new DesktopRuntime({ resources: directory, userData: directory });
  instance.frontendOrigin = 'http://127.0.0.1:40001';
  instance.backendOrigin = 'http://127.0.0.1:40002';
  return instance;
}

test('media listeners exclude frontend/backend and duplicates with a bounded allocation loop', async () => {
  const candidates = [40001, 40002, 40003, 40003, 40004, 40005, 40006, 40007];
  assert.deepEqual(await mediaPorts([40001, 40002], async () => candidates.shift()), [40003, 40004, 40005, 40006, 40007]);
  await assert.rejects(mediaPorts([40001], async () => 40001), /distinct/);
});

test('startup retries address collisions on new ports before announcing service failure', async t => {
  const instance = runtime(t);
  let port = 40000;
  instance.allocateMediaPort = async () => ++port;
  const seen = [];
  instance.startMediaAttempt = async ports => {
    seen.push(ports);
    if (seen.length === 1) throw Object.assign(new Error('bind'), { code: 'MEDIA_PORT_BUSY' });
  };
  await instance.startMedia();
  assert.equal(seen.length, 2);
  assert.equal(new Set(seen.flat()).size, 10);
  assert.ok(!seen.flat().includes(40001));
  assert.ok(!seen.flat().includes(40002));
});

test('startup does not hide other errors or retry port collisions indefinitely', async t => {
  const instance = runtime(t);
  let port = 45000, attempts = 0;
  instance.allocateMediaPort = async () => ++port;
  instance.startMediaAttempt = async () => { attempts++; throw new Error('invalid config'); };
  await assert.rejects(instance.startMedia(), /invalid config/);
  assert.equal(attempts, 1);
  attempts = 0;
  instance.startMediaAttempt = async () => { attempts++; throw Object.assign(new Error('bind'), { code: 'MEDIA_PORT_BUSY' }); };
  await assert.rejects(instance.startMedia(), /bind/);
  assert.equal(attempts, 3);
});

test('bind detection reads only this launch log and releases startup suppression after health check', async t => {
  const instance = runtime(t);
  const file = path.join(instance.paths.logs, 'mediamtx.log');
  fs.writeFileSync(file, 'old: bind: address already in use\n');
  instance.startChild = () => ({ exitCode: 1 });
  await assert.rejects(instance.startMediaAttempt([45001,45002,45003,45004,45005]), error => error.code !== 'MEDIA_PORT_BUSY');
  instance.startChild = () => { fs.appendFileSync(file, 'ERR listen tcp 127.0.0.1:45001: bind: address already in use\n'); return { exitCode: 1 }; };
  await assert.rejects(instance.startMediaAttempt([45001,45002,45003,45004,45005]), error => error.code === 'MEDIA_PORT_BUSY');
  const child = { exitCode: null, desktopStarting: true };
  instance.startChild = () => child;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true }));
  await instance.startMediaAttempt([45011,45012,45013,45014,45015]);
  assert.equal(child.desktopStarting, false);
});

test('managed startup exit is handled by retry logic; later service exits still report failures', async t => {
  const { once } = require('node:events');
  const instance = runtime(t);
  const failures = [];
  instance.on('failure', error => failures.push(error));
  const pending = instance.startChild('pending', process.execPath, ['-e', 'process.exit(1)'], instance.paths.data, {}, { managedStartup: true });
  await once(pending, 'exit');
  assert.equal(failures.length, 0);
  const active = instance.startChild('active', process.execPath, ['-e', 'process.exit(1)'], instance.paths.data, {});
  await once(active, 'exit');
  assert.equal(failures.length, 1);
  assert.match(failures[0].message, /active stopped unexpectedly/);
});
