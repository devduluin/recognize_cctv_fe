const readline = require('node:readline/promises');

const TARGETS = [
  { key: 'mac', label: 'macOS', platform: 'darwin', arch: null, args: ['--mac'] },
  { key: 'win', label: 'Windows', platform: 'win32', arch: 'x64', args: ['--win', '--x64'] },
  { key: 'linux', label: 'Linux', platform: 'linux', arch: 'x64', args: ['--linux', '--x64'] },
];

function hostDescription(platform, arch) {
  const name = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : platform;
  return `${name} ${arch}`;
}

function targetForHost(platform, arch) {
  return TARGETS.find(target => target.platform === platform && (!target.arch || target.arch === arch));
}

function resolveTargetArgs(args, platform = process.platform, arch = process.arch) {
  const targetFlags = args.filter(arg => ['--mac', '--win', '--linux'].includes(arg));
  if (targetFlags.length > 1) throw new Error('Pilih hanya satu target: --mac, --win, atau --linux.');

  const target = targetFlags.length
    ? TARGETS.find(item => item.args[0] === targetFlags[0])
    : targetForHost(platform, arch);
  if (!target) throw new Error(`Build lokal tidak didukung pada ${hostDescription(platform, arch)}.`);

  const requestedArch = args.find(arg => ['--arm64', '--x64', '--ia32'].includes(arg))?.slice(2);
  const resolvedArch = requestedArch || (target.platform === 'darwin' ? arch : target.arch);
  const hostTarget = targetForHost(platform, arch);
  if (!hostTarget || target.platform !== platform || resolvedArch !== arch || (target.arch && resolvedArch !== target.arch)) {
    const targetArch = resolvedArch || target.arch || arch;
    throw new Error(
      `Build ${hostDescription(target.platform, targetArch)} harus dijalankan pada mesin ${hostDescription(target.platform, targetArch)}. ` +
      `Mesin ini adalah ${hostDescription(platform, arch)}. Backend FastAPI memakai PyInstaller dan tidak bisa di-cross-compile. ` +
      'Jalankan perintah ini pada OS target atau gunakan GitHub Actions.',
    );
  }

  return args.length ? args : target.args;
}

async function selectTargetArgs(args = process.argv.slice(2), options = {}) {
  if (args.length) return resolveTargetArgs(args, options.platform, options.arch);

  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Pilih target lewat terminal interaktif, atau berikan --mac, --win, atau --linux secara eksplisit.');
  }

  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const local = targetForHost(platform, arch);
  output.write('Pilih target installer desktop (build harus dijalankan pada OS target):\n');
  TARGETS.forEach((target, index) => {
    const targetArch = target.platform === 'darwin' ? (platform === 'darwin' ? arch : 'arm64 atau x64') : target.arch;
    const suffix = local?.platform === target.platform ? ` — build lokal (${arch})` : ` — jalankan di ${hostDescription(target.platform, targetArch)}`;
    output.write(`  ${index + 1}. ${target.label}${suffix}\n`);
  });
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question('Masukkan pilihan [1-3]: ');
    const index = Number(answer.trim()) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= TARGETS.length) {
      throw new Error('Pilihan tidak valid. Jalankan ulang dan pilih angka 1, 2, atau 3.');
    }
    return resolveTargetArgs(TARGETS[index].args, platform, arch);
  } finally {
    rl.close();
  }
}

module.exports = { resolveTargetArgs, selectTargetArgs, targetForHost };
