const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { persistentPaths, ensureNextRuntime, freePort, waitForService, scrubbedEnvironment } = require('../electron/runtime.cjs');
const { DesktopUpdates } = require('../electron/updates.cjs');

test('persistent secret and files survive another application version', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-desktop-data-'));
  const first = persistentPaths(directory);
  const secret = fs.readFileSync(first.secret, 'utf8');
  fs.writeFileSync(path.join(first.data, 'visitor.sqlite'), 'existing database');
  const second = persistentPaths(directory);
  assert.equal(fs.readFileSync(second.secret, 'utf8'), secret);
  assert.equal(fs.readFileSync(path.join(second.data, 'visitor.sqlite'), 'utf8'), 'existing database');
  assert.equal(second.data, first.data);
});

test('service health checks fail when a process exits', async () => {
  await assert.rejects(waitForService('http://127.0.0.1:1', {}, () => false, 100), /exited/);
});

test('Next runtime cache is refreshed when dependencies are missing or the build changes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-next-runtime-'));
  const source = path.join(directory, 'bundle');
  const cached = path.join(directory, 'user-data', 'next-runtime', '0.1.0');
  const writeRuntime = (root, buildId, includeNext = true) => {
    fs.mkdirSync(path.join(root, '.next'), { recursive: true });
    fs.writeFileSync(path.join(root, '.next/BUILD_ID'), buildId);
    fs.writeFileSync(path.join(root, 'server.js'), '');
    if (includeNext) {
      fs.mkdirSync(path.join(root, 'node_modules/next'), { recursive: true });
      fs.writeFileSync(path.join(root, 'node_modules/next/package.json'), '{}');
    }
  };

  writeRuntime(source, 'new-build');
  writeRuntime(cached, 'old-build', false);
  ensureNextRuntime(source, cached);
  assert.equal(fs.readFileSync(path.join(cached, '.next/BUILD_ID'), 'utf8'), 'new-build');
  assert.ok(fs.existsSync(path.join(cached, 'node_modules/next/package.json')));

  fs.writeFileSync(path.join(cached, 'local-marker'), 'same build reused');
  ensureNextRuntime(source, cached);
  assert.ok(fs.existsSync(path.join(cached, 'local-marker')));

  fs.writeFileSync(path.join(cached, '.next/BUILD_ID'), 'older-build-with-dependencies');
  ensureNextRuntime(source, cached);
  assert.equal(fs.readFileSync(path.join(cached, '.next/BUILD_ID'), 'utf8'), 'new-build');
  assert.equal(fs.existsSync(path.join(cached, 'local-marker')), false);
});

test('free ports bind to loopback and shell credentials are not inherited', async () => {
  assert.ok(await freePort() > 1024);
  process.env.DESKTOP_TEST_SECRET = 'private';
  assert.equal(scrubbedEnvironment().DESKTOP_TEST_SECRET, undefined);
  delete process.env.DESKTOP_TEST_SECRET;
});

test('updates allow postponement and stop services before installation', async () => {
  const updater = new EventEmitter();
  const actions = [];
  updater.downloadUpdate = async () => actions.push('download');
  updater.quitAndInstall = () => actions.push('install');
  updater.checkForUpdates = async () => actions.push('check');
  const dialog = { showMessageBox: async () => ({ response: 1 }) };
  const updates = new DesktopUpdates({ updater, dialog, packaged: true, version: '0.1.0', getWindow: () => ({ setProgressBar() {} }), stopServices: async () => actions.push('stop') });
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowDowngrade, false);
  await updates.check();
  updater.emit('update-available', { version: '0.2.0', releaseNotes: 'New version' });
  updater.emit('update-downloaded');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(actions, ['check']);
  await updates.install();
  assert.deepEqual(actions, ['check', 'stop', 'install']);
});

test('failed update checks preserve data and never install', async () => {
  const updater = new EventEmitter();
  const notifications = [];
  updater.checkForUpdates = async () => { throw new Error('offline'); };
  updater.quitAndInstall = () => assert.fail('must not install');
  const updates = new DesktopUpdates({ updater, dialog: {}, packaged: true, version: '0.1.0', getWindow: () => undefined, stopServices: async () => {}, notify: text => notifications.push(text) });
  await updates.check();
  assert.match(notifications[0], /offline/);
  await updates.install();
  assert.match(notifications[1], /No downloaded update/);
});
