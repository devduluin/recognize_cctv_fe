const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, randomInt } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolveBackendPython } = require('./python-path.cjs');
const { optimizeBackend, compressSamples } = require('./optimize-resources.cjs');
const root = path.resolve(__dirname, '../..');
const backend = path.resolve(process.env.DESKTOP_BACKEND_ROOT || path.join(root, '../recognize_cctv'));
const python = resolveBackendPython(backend, process.env.DESKTOP_PYTHON);
const resources = path.join(root, 'resources');
const version = require('../../package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Desktop version must be MAJOR.MINOR.PATCH.');
const buildNumber = String(randomInt(100000, 1000000));
console.log(`Building Visitor Counter ${version} (Build ${buildNumber})`);
const run = (executable, args, cwd = root, env = {}) => execFileSync(executable, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env }, windowsHide: true });
run(process.execPath, [path.join(__dirname, 'prepare.cjs')]);
run(python, [path.join(backend, 'tools/prepare_models.py'), '--models-dir', path.join(backend, 'models')], backend);
if (process.platform === 'win32') {
  const directml = execFileSync(python, ['-c', 'import onnxruntime; print(int("DmlExecutionProvider" in onnxruntime.get_available_providers()))'], { encoding: 'utf8', windowsHide: true }).trim() === '1';
  if (directml) run(python, [path.join(backend, 'tools/export_directml_models.py')], backend);
}
run(python, ['-c', 'from keras_facenet import FaceNet; FaceNet()'], backend);
const backendBundle = path.join(resources, 'visitor-backend');
fs.rmSync(backendBundle, { recursive: true, force: true });
fs.rmSync(path.join(resources, 'backend'), { recursive: true, force: true });
run(python, ['-m', 'PyInstaller', '--noconfirm', '--clean', '--distpath', resources, '--workpath', path.join(backend, 'desktop/build'), path.join(backend, 'desktop/backend.spec')], backend,
  { PYINSTALLER_CONFIG_DIR: path.join(backend, 'desktop/cache'), MPLCONFIGDIR: path.join(backend, 'desktop/cache/matplotlib'), YOLO_AUTOINSTALL: 'false' });
fs.renameSync(backendBundle, path.join(resources, 'backend'));
optimizeBackend(resources);
const finalizedBackend = path.join(resources, 'backend');
const backendExecutable = path.join(finalizedBackend, process.platform === 'win32' ? 'visitor-backend.exe' : 'visitor-backend');
const selfTestData = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-backend-selftest-'));
let inferenceRuntime;
try {
  fs.writeFileSync(path.join(selfTestData, 'jwt-secret'), randomBytes(48).toString('hex'), { mode: 0o600 });
  const report = execFileSync(backendExecutable, ['--data-dir', selfTestData, '--resources', path.join(finalizedBackend, '_internal'),
    '--port', '0', '--frontend-origin', 'http://127.0.0.1:3000', '--runtime-info'], { cwd: backend, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
  inferenceRuntime = JSON.parse(report.trim().split(/\r?\n/).at(-1));
  if (typeof inferenceRuntime.cuda_built !== 'boolean' || !inferenceRuntime.torch_version || typeof inferenceRuntime.cuda_available !== 'boolean') throw new Error('Invalid packaged inference runtime report.');
  console.log(`Packaged PyTorch ${inferenceRuntime.torch_version}; CUDA build: ${inferenceRuntime.cuda_version || 'none'}; CUDA usable on build machine: ${inferenceRuntime.cuda_available}`);
  if (process.platform === 'win32' && !inferenceRuntime.cuda_built) console.warn('This Windows installer uses a CPU-only PyTorch build. NVIDIA acceleration will not be available.');
  run(backendExecutable, ['--data-dir', selfTestData, '--resources', path.join(finalizedBackend, '_internal'),
    '--port', '0', '--frontend-origin', 'http://127.0.0.1:3000', '--self-test'], backend);
} finally {
  fs.rmSync(selfTestData, { recursive: true, force: true });
}
const ffmpeg = execFileSync(python, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
const ffmpegDestination = path.join(resources, 'media', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
fs.copyFileSync(ffmpeg, ffmpegDestination);
if (process.platform !== 'win32') fs.chmodSync(ffmpegDestination, 0o755);
run(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], root,
    { DESKTOP_BUILD: 'true', NEXT_PUBLIC_DESKTOP_VERSION: version, NEXT_PUBLIC_DESKTOP_BUILD_NUMBER: buildNumber,
      NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV: '', NEXT_PUBLIC_APP_MODE: 'multi_tenant', IS_MAINTANANCE: 'false', IS_MAINTENANCE: 'false', NEXT_PUBLIC_IS_MAINTANANCE: 'false', NEXT_PUBLIC_IS_MAINTENANCE: 'false' });
fs.cpSync(path.join(root, '.next/standalone'), path.join(resources, 'next'), { recursive: true });
fs.cpSync(path.join(root, '.next/static'), path.join(resources, 'next/.next/static'), { recursive: true });
fs.rmSync(path.join(resources, 'next/public'), { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), path.join(resources, 'next/public'), { recursive: true, dereference: true });
// Git may check out the public/samples symlink as a regular text file on Windows
// when core.symlinks is disabled. Materialize the linked backend samples before
// optimizing them so the packaged public directory contains the actual files.
const sourceSamples = path.join(root, 'public', 'samples');
const packagedSamples = path.join(resources, 'next', 'public', 'samples');
if (fs.existsSync(packagedSamples) && fs.lstatSync(packagedSamples).isFile()) {
  const linkTarget = fs.readFileSync(sourceSamples, 'utf8').trim();
  const resolvedTarget = path.resolve(path.dirname(sourceSamples), linkTarget);
  const backendSamples = path.resolve(backend, 'samples');
  if (resolvedTarget !== backendSamples || !fs.statSync(backendSamples).isDirectory()) {
    throw new Error(`Cannot resolve public/samples to the backend sample directory: ${backendSamples}`);
  }
  fs.rmSync(packagedSamples);
  fs.cpSync(backendSamples, packagedSamples, { recursive: true, dereference: true });
}
compressSamples(resources);
// Next's standalone output may contain the developer's .env. Desktop secrets
// are created under the desktop application data directory and injected at runtime instead.
function removeEnvironmentFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) removeEnvironmentFiles(file);
    else if (entry.name === '.env' || entry.name.startsWith('.env.')) fs.rmSync(file);
  }
}
removeEnvironmentFiles(path.join(resources, 'next'));
function gitRevision(directory) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: directory, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}
fs.writeFileSync(path.join(resources, 'build-manifest.json'), JSON.stringify({ version, buildNumber, platform: process.platform, arch: process.arch,
  inferenceRuntime,
  backendRevision: gitRevision(backend),
  frontendRevision: gitRevision(root) }, null, 2));
