// Build with isolated API settings, capture real UI, then install the resulting images.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const env = { ...process.env, DESKTOP_BUILD: 'true', NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV: '',
  IS_MAINTENANCE: 'false', IS_MAINTANANCE: 'false',
  NEXT_PUBLIC_IS_MAINTENANCE: 'false', NEXT_PUBLIC_IS_MAINTANANCE: 'false' };
for (const args of [
  [require.resolve('next/dist/bin/next'), 'build', '--webpack'],
  [path.join(__dirname, 'capture.cjs')],
  [path.join(__dirname, 'install-assets.cjs')],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Screenshot siap di Manual Guide. Untuk deployment atau installer, build ulang setelah langkah ini.');
