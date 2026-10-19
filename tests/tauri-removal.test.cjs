'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('desktop scripts and dependency graph use only the native Tauri runtime', () => {
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  for (const name of ['electron', 'electron-builder', 'electron-updater']) {
    assert.equal(pkg.dependencies?.[name], undefined);
    assert.equal(pkg.devDependencies?.[name], undefined);
    assert.equal(lock.packages[`node_modules/${name}`], undefined);
  }
  assert.equal(pkg.main, undefined);
  assert.match(pkg.scripts['desktop:dev'], /scripts\/tauri\/run/);
  assert.match(pkg.scripts['desktop:build'], /scripts\/tauri\/run/);
  assert.equal(fs.existsSync(path.join(root, 'electron')), false);
  assert.equal(fs.existsSync(path.join(root, 'electron-builder.cjs')), false);
  const config = require('../src-tauri/tauri.conf.json');
  const files = Object.keys(config.bundle.resources).filter(name => !name.endsWith('/'));
  for (const file of files) assert.ok(fs.existsSync(path.resolve(root, 'src-tauri', file)), file);
});
