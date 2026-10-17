const path = require('node:path');
const { runWithProgress } = require('./progress.cjs');
const { selectTargetArgs, selectSigningPreference, signingEnvironment } = require('./platform-selector.cjs');

const root = path.resolve(__dirname, '../..');

async function main() {
  const targetArgs = await selectTargetArgs();
  const signed = await selectSigningPreference(targetArgs);
  const packageEnv = signingEnvironment(signed);
  await runWithProgress(process.execPath, [path.join(__dirname, 'clean.cjs')], {
    cwd: root, label: 'Membersihkan output build lama',
    progress: { start: 0, end: 4, expectedDurationMs: 8_000 },
  });
  await runWithProgress(process.execPath, [path.join(__dirname, 'build.cjs')], {
    cwd: root, label: 'Membangun backend dan frontend',
    progress: { start: 4, end: 78, expectedDurationMs: 8 * 60_000 },
  });
  await runWithProgress(process.execPath, [path.join(__dirname, 'package.cjs'), ...targetArgs], {
    cwd: root, label: 'Menyiapkan installer desktop',
    env: packageEnv,
    progress: { start: 78, end: 99, expectedDurationMs: 4 * 60_000 },
  });
  process.stderr.write('✓ Build selesai (100%)\n');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
