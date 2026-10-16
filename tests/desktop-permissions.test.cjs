const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowedPermission } = require('../electron/permissions.cjs');
const origin = 'http://127.0.0.1:42000';
const contents = { getURL: () => `${origin}/events` };

test('trusted desktop main frame can play local media through browser network permissions', () => {
  for (const permission of ['media', 'fullscreen', 'local-network', 'local-network-access', 'loopback-network']) {
    assert.equal(allowedPermission(contents, permission, origin, `${origin}/events`, { isMainFrame: true }), true);
    assert.equal(allowedPermission(contents, permission, origin, origin, { isMainFrame: true }), true);
  }
});

test('network permissions reject other ports, origins, frames, and unrelated privileges', () => {
  for (const url of ['http://127.0.0.1:42001', 'http://127.0.0.1.evil.test:42000', 'https://example.com', 'file:///tmp/a', 'invalid', '']) {
    assert.equal(allowedPermission(contents, 'local-network', origin, url), false);
  }
  assert.equal(allowedPermission(null, 'local-network', origin, origin), false);
  assert.equal(allowedPermission({ getURL: () => 'https://example.com' }, 'local-network', origin, origin), false);
  assert.equal(allowedPermission(contents, 'local-network', origin, origin, { isMainFrame: false }), false);
  assert.equal(allowedPermission(contents, 'local-network', origin, origin, { embeddingOrigin: 'https://example.com' }), false);
  assert.equal(allowedPermission(contents, 'openExternal', origin, origin), false);
});
