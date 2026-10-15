const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveBackendPython } = require('../scripts/desktop/python-path.cjs');

test('automatically selects the locked Python environment for macOS and Windows', () => {
  const backend = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-backend-'));
  try {
    const macPython = path.join(backend, 'desktop', '.venv', 'bin', 'python');
    const winPython = path.join(backend, 'desktop', '.venv', 'Scripts', 'python.exe');
    fs.mkdirSync(path.dirname(macPython), { recursive: true });
    fs.mkdirSync(path.dirname(winPython), { recursive: true });
    fs.writeFileSync(macPython, '');
    fs.writeFileSync(winPython, '');
    assert.equal(resolveBackendPython(backend, undefined, 'darwin'), macPython);
    assert.equal(resolveBackendPython(backend, undefined, 'win32'), winPython);
  } finally {
    fs.rmSync(backend, { recursive: true, force: true });
  }
});

test('honors a configured Python path and explains when the locked environment is missing', () => {
  const backend = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-backend-'));
  const customPython = path.join(backend, 'python');
  try {
    fs.writeFileSync(customPython, '');
    assert.equal(resolveBackendPython(backend, customPython, 'darwin'), customPython);
    assert.throws(() => resolveBackendPython(backend, undefined, 'darwin'), /uv sync --project desktop --locked/);
    assert.throws(() => resolveBackendPython(backend, path.join(backend, 'missing'), 'darwin'), /DESKTOP_PYTHON tidak ditemukan/);
  } finally {
    fs.rmSync(backend, { recursive: true, force: true });
  }
});
