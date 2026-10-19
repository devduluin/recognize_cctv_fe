'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../src-tauri/bootstrap/index.html'), 'utf8');
function screen() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', className: '', attributes: {}, classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; } });
    return elements.get(id);
  };
  const window = {};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { window, document: { getElementById: get }, Date, setInterval() {} });
  return { window, get };
}
test('startup follows actual service stages and exposes recoverable failure', () => {
  const { window, get } = screen();
  window.setStartupStage('backend');
  assert.equal(get('status').textContent, 'Menyiapkan data lokal');
  assert.equal(get('step-services').className, 'active');
  window.setStartupStage('session');
  assert.equal(get('step-services').className, 'done');
  assert.equal(get('step-session').className, 'active');
  window.setStartupStage('unknown');
  assert.equal(get('step-session').className, 'active');
  window.setStartupStage('failed');
  assert.equal(get('startup').attributes['aria-busy'], 'false');
  assert.match(get('description').textContent, /Tutup aplikasi lalu buka kembali/);
  assert.match(get('hint').textContent, /tetap tersimpan/);
});
