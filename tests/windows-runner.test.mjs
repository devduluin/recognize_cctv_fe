import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Windows runner stops foreground/background process trees and rejects stale PIDs', { skip: process.platform !== 'win32' }, () => {
  const script = fileURLToPath(new URL('./windows-runner-processes.ps1', import.meta.url));
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
    encoding: 'utf8', timeout: 60000,
  });
  assert.equal(result.status, 0, result.error?.message || `${result.stdout}\n${result.stderr}`);
});
