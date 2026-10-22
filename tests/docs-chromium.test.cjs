'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserExecutable, CDP } = require('../scripts/docs/chromium.cjs');
test('documentation capture finds an installed browser or validates an explicit executable', () => {
  assert.equal(browserExecutable({ DOCS_BROWSER_PATH: '/custom/chrome' }, 'darwin', name => name === '/custom/chrome'), '/custom/chrome');
  assert.throws(() => browserExecutable({ DOCS_BROWSER_PATH: '/missing' }, 'darwin', () => false), /tidak ditemukan/);
  assert.match(browserExecutable({}, 'darwin', name => name.includes('Google Chrome')), /Google Chrome/);
  assert.match(browserExecutable({ PROGRAMFILES: 'C:\\Program Files' }, 'win32', name => name.endsWith('msedge.exe')), /msedge.exe$/);
  assert.throws(() => browserExecutable({}, 'darwin', () => false), /belum tersedia/);
});
class Socket extends EventTarget {
  constructor(reply) { super(); this.reply = reply; }
  send(value) {
    const command = JSON.parse(value);
    const response = this.reply(command);
    if (response) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: command.id, ...response }) })));
  }
}
test('CDP correlates replies and surfaces protocol and page failures', async () => {
  const client = new CDP(new Socket(command => command.method === 'Runtime.evaluate'
    ? { result: { result: { value: 42 } } } : { error: { message: 'Failed command' } }));
  assert.equal(await client.evaluate('42'), 42);
  await assert.rejects(client.send('Page.invalid'), /Failed command/);
  assert.equal(client.pending.size, 0);
  const badPage = new CDP(new Socket(() => ({ result: { exceptionDetails: { text: 'Script failed' } } })));
  await assert.rejects(badPage.evaluate('bad()'), /Script failed/);
});
test('browser disconnection rejects pending operations and clears timers', async () => {
  const socket = new Socket(() => null), client = new CDP(socket);
  const result = client.send('Page.captureScreenshot');
  socket.dispatchEvent(new Event('close'));
  await assert.rejects(result, /disconnected/);
  assert.equal(client.pending.size, 0);
});
