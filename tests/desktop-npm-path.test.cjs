const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureNpmOnPath } = require('../scripts/desktop/npm-path.cjs');

test('adds the active Node runtime directory to PATH when it contains npm', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-node-bin-'));
  try {
    fs.writeFileSync(path.join(directory, 'node'), '');
    fs.writeFileSync(path.join(directory, 'npm'), '');
    const result = ensureNpmOnPath({ PATH: '/usr/bin' }, path.join(directory, 'node'), 'darwin');
    assert.equal(result.PATH.split(path.delimiter)[0], directory);
    assert.equal(result.PATH.split(path.delimiter).filter(item => item === '/usr/bin').length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('does not duplicate Node directory or modify PATH when npm is not bundled there', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-node-bin-'));
  try {
    fs.writeFileSync(path.join(directory, 'node'), '');
    const current = { PATH: `${directory}${path.delimiter}/usr/bin` };
    assert.equal(ensureNpmOnPath(current, path.join(directory, 'node'), 'win32'), current);
    assert.equal(ensureNpmOnPath({ PATH: '/usr/bin' }, path.join(directory, 'node'), 'win32').PATH, '/usr/bin');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
