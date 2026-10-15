const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const backend = path.resolve(process.env.DESKTOP_BACKEND_ROOT || path.join(root, '../recognize_cctv'));
const python = process.env.DESKTOP_PYTHON || execFileSync('pipenv', ['--py'], { cwd: backend, encoding: 'utf8' }).trim();
const child = spawn(require('electron'), ['.', '--desktop-dev'], { cwd: root, stdio: 'inherit', env: {
  ...process.env, DESKTOP_PYTHON: python, DESKTOP_NODE: process.execPath, DESKTOP_BACKEND_ROOT: backend,
} });
child.on('exit', code => { process.exitCode = code; });
