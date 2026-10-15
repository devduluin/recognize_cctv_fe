const test = require('node:test');
const assert = require('node:assert/strict');
const { estimatePercent, estimateRemainingSeconds, formatDuration, formatTimeEstimate } = require('../scripts/desktop/progress.cjs');

test('estimated build progress advances within a stage and stops before completion', () => {
  const stage = { start: 20, end: 80, expectedDurationMs: 1000 };
  assert.equal(estimatePercent(stage, 0), 20);
  assert.equal(estimatePercent(stage, 500), 50);
  assert.equal(estimatePercent(stage, 5000), 79);
});

test('progress estimate is optional', () => {
  assert.equal(estimatePercent(undefined, 1000), null);
});

test('remaining time estimate decreases as the stage runs', () => {
  const stage = { expectedDurationMs: 120_000 };
  assert.equal(estimateRemainingSeconds(stage, 30_000), 90);
  assert.equal(estimateRemainingSeconds(undefined, 30_000), null);
  assert.equal(formatDuration(90), '1 mnt 30 dtk');
  assert.equal(formatDuration(3660), '1 jam 1 mnt');
});

test('remaining time estimate does not imply zero seconds after a stage overruns', () => {
  const stage = { expectedDurationMs: 120_000 };
  const elapsedMs = 150_000;
  assert.equal(estimateRemainingSeconds(stage, elapsedMs), 0);
  assert.equal(formatTimeEstimate(stage, elapsedMs), ' — estimasi terlampaui 30 dtk');
  assert.equal(formatTimeEstimate(stage, 60_000), ' — sisa ~1 mnt 0 dtk');
});
