const { spawn } = require('node:child_process');

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function estimatePercent(progress, elapsedMs) {
  if (!progress) return null;
  const { start, end, expectedDurationMs } = progress;
  const fraction = Math.min(Math.max(elapsedMs / expectedDurationMs, 0), 0.99);
  return Math.min(end - 1, Math.floor(start + (end - start) * fraction));
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  if (hours) return `${hours} jam ${minutes} mnt`;
  if (minutes) return `${minutes} mnt ${remainingSeconds} dtk`;
  return `${remainingSeconds} dtk`;
}

function estimateRemainingSeconds(progress, elapsedMs) {
  if (!progress || !Number.isFinite(progress.expectedDurationMs) || progress.expectedDurationMs <= 0) return null;
  return Math.max(0, (progress.expectedDurationMs - elapsedMs) / 1000);
}

function runWithProgress(executable, args, { cwd, env = process.env, label, progress }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true });
    const startedAt = Date.now();
    let lastOutputAt = startedAt;
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
    if (!process.stderr.isTTY) {
      const startPercent = progress ? ` (${progress.start}%)` : '';
      process.stderr.write(`▶ ${label}${startPercent}\n`);
    }

    const timer = setInterval(() => {
      if (!process.stderr.isTTY || Date.now() - lastOutputAt < 800) return;
      const percent = estimatePercent(progress, Date.now() - startedAt);
      const progressText = percent === null ? '' : ` ${percent}%`;
      const remaining = estimateRemainingSeconds(progress, Date.now() - startedAt);
      const timeText = remaining === null ? '' : ` — sisa ~${formatDuration(remaining)}`;
      process.stderr.write(`\r\u001b[2K${frames[frameIndex++ % frames.length]} ${label}${progressText}${timeText} — masih berjalan`);
      spinnerVisible = true;
    }, 500);

    child.once('error', error => {
      clearInterval(timer);
      clearSpinner();
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearInterval(timer);
      clearSpinner();
      if (code === 0) {
        const endPercent = progress ? ` (${progress.end}%)` : '';
        process.stderr.write(`✓ ${label}${endPercent}\n`);
        resolve();
      } else {
        reject(new Error(`${label} gagal${signal ? ` (signal ${signal})` : ` (exit ${code})`}.`));
      }
    });
  });
}

module.exports = { estimatePercent, estimateRemainingSeconds, formatDuration, runWithProgress };
