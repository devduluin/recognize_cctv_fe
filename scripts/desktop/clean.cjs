const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const backend = path.resolve(process.env.DESKTOP_BACKEND_ROOT || path.join(root, '../recognize_cctv'));
const targets = [
  path.join(root, '.next'),
  path.join(root, 'resources'),
  path.join(root, 'dist-desktop'),
  path.join(backend, 'desktop', 'build'),
];

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  console.log(`Cleaned ${path.relative(root, target) || target}`);
}
console.log('Kept desktop-cache and the backend Python environment.');
