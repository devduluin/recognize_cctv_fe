const fs = require('node:fs');
const path = require('node:path');

function resolveBackendPython(backendRoot, configuredPython, platform = process.platform) {
  if (configuredPython) {
    if (fs.existsSync(configuredPython)) return configuredPython;
    throw new Error(`DESKTOP_PYTHON tidak ditemukan: ${configuredPython}`);
  }

  const relativePaths = platform === 'win32'
    ? [path.join('desktop', '.venv', 'Scripts', 'python.exe')]
    : [path.join('desktop', '.venv', 'bin', 'python')];
  const candidate = relativePaths.map(relativePath => path.join(backendRoot, relativePath)).find(fs.existsSync);
  if (candidate) return candidate;

  const expected = path.join(backendRoot, relativePaths[0]);
  throw new Error(
    `Python environment backend tidak ditemukan di ${expected}. Buat dengan ` +
    '`uv sync --project desktop --locked`, atau set DESKTOP_PYTHON ke Python environment yang sudah disiapkan.',
  );
}

module.exports = { resolveBackendPython };
