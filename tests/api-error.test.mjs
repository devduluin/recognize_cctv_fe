import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorMessage } from '../components/auth/api-error.ts';

test('monitoring errors support both backend message and FastAPI detail', () => {
  assert.equal(apiErrorMessage({ message: 'Mesin AI dimatikan.', errors: null }, 409, 'Gagal.'), 'Mesin AI dimatikan.');
  assert.equal(apiErrorMessage({ detail: 'Pilih event.' }, 400, 'Gagal.'), 'Pilih event.');
  assert.match(apiErrorMessage({ message: 'Validation error', errors: [{ loc: ['body', 'event_id'], msg: 'Invalid UUID' }] }, 400, 'Gagal.'), /event_id: Invalid UUID/);
});

test('unexpected SQL errors and RTSP credentials are not exposed', () => {
  const message = apiErrorMessage({ message: 'INSERT secret SQL rtsp://user:password@camera/live' }, 500, 'Gagal.');
  assert.match(message, /HTTP 500/);
  assert.ok(!message.includes('password'));
  assert.ok(!message.includes('INSERT'));
  assert.equal(apiErrorMessage({ message: 'Cannot open rtsp://user:password@camera/live' }, 400, 'Gagal.'), 'Cannot open [alamat kamera]');
  assert.match(apiErrorMessage(null, 502, 'Gagal.'), /502/);
});
