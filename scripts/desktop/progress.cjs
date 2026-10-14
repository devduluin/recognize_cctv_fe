const { spawn } = require('node:child_process');

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function runWithProgress(executable, args, { cwd, env = process.env, label }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true });
    let lastOutputAt = Date.now();
    let frameIndex = 0;
    let spinnerVisible = false;

    const clearSpinner = () => {
      if (!spinnerVisible) return;
      process.stderr.write('\r\u001b[2K');
      spinnerVisible = false;
    };
    const forward = (stream, destination) => {
      stream.on('data', chunk => {
        clearSpinner();
        lastOutputAt = Date.now();
        destination.write(chunk);
      });
    };

    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    if (!process.stderr.isTTY) process.stderr.write(`▶ ${label}\n`);

    const timer = setInterval(() => {
      if (!process.stderr.isTTY || Date.now() - lastOutputAt < 800) return;
      process.stderr.write(`\r\u001b[2K${frames[frameIndex++ % frames.length]} ${label} — masih berjalan`);
      spinnerVisible = true;
    }, 100);

    child.once('error', error => {
      clearInterval(timer);
      clearSpinner();
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearInterval(timer);
      clearSpinner();
      if (code === 0) {
        process.stderr.write(`✓ ${label}\n`);
        resolve();
      } else {
        reject(new Error(`${label} gagal${signal ? ` (signal ${signal})` : ` (exit ${code})`}.`));
      }
    });
  });
}

module.exports = { runWithProgress };
