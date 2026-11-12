// T01 regression tests — Bawa Doc 4 (MAINNET-GUIDE.md) register rows
// M-05, M-06, M-07, M-09. Pins the corrected claims so a later edit
// cannot silently reintroduce the wrong fee-unit record, drop the
// decided vault identifiers, or mark a row resolved without evidence.
// Run: node --test tests/register-t01.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const guide = readFileSync(
  path.join(repoRoot, 'docs/mainnet/MAINNET-GUIDE.md'),
  'utf8',
);

function rowSpan(id, nextId) {
  const start = guide.indexOf(`### ${id} —`);
  assert.notEqual(start, -1, `${id} row missing`);
  const end = guide.indexOf(`### ${nextId} —`, start);
  assert.notEqual(end, -1, `${nextId} row missing`);
  return guide.slice(start, end);
}

test('M-07: the wrong BTC/kB fee record is gone', () => {
  // The old combined record must not return. The corrected text may still
  // quote the old error in words ("approximately 97 sat/vB") when
  // explaining the correction, so pin the exact old record string instead.
  assert.equal(guide.includes('0.972 BTC/kB (≈97 sat/vB)'), false);
  assert.equal(guide.includes('BTC/kB (≈97'), false);
  assert.ok(guide.includes('| 2026-11-09 | 3 | 0.972 |'));
  assert.ok(guide.includes('| 2026-11-12, about 07:59 UTC | 2 | 2.004 |'));
});

test('M-07: fee-estimates unit is stated as sat/vB', () => {
  assert.ok(guide.includes('returns sat/vB, not BTC/kB'));
  assert.ok(guide.includes('2.004 sat/vB'));
  assert.ok(guide.includes('2026-11-12, about 07:59 UTC'));
});

test('M-07: row is RESOLVED with the 2026-11-12 evidence', () => {
  const row = rowSpan('M-07', 'M-08');
  assert.ok(row.includes('RESOLVED 2026-11-12'));
  assert.ok(row.includes('Met 2026-11-12'));
});

test('M-05: section 10 decides distinct mainnet vault identifiers', () => {
  assert.ok(guide.includes('bawa-web-vault-v1-mainnet'));
  assert.ok(guide.includes('bawa-web-wallet-mainnet'));
  assert.ok(guide.includes('To migrate an existing vault, first verify independent offline recovery material.'));
});

test('M-05: row stays OPEN with the local-only blocker', () => {
  const row = rowSpan('M-05', 'M-06');
  assert.ok(row.includes('**Status:** OPEN.'));
  assert.ok(row.includes('local-only and not in the repository'));
});

test('M-06: section 13 covers the three previously uncovered gaps', () => {
  assert.ok(guide.includes('**Zero-amount sends.**'));
  assert.ok(guide.includes('unit-confused on the fourth'));
  assert.ok(guide.includes('TonSeqnoTracker'));
});

test('M-06: row stays OPEN, gaps documented-not-fixed', () => {
  const row = rowSpan('M-06', 'M-07');
  assert.ok(row.includes('**Status:** OPEN.'));
  assert.ok(row.includes('documented, unfixed'));
});

test('M-09: verified USDC receipt is recorded with hash and block', () => {
  assert.ok(guide.includes('40,348 gas'));
  assert.ok(guide.includes('0xb57bf3aca3305caaf5ef7cb4bfa2dd83fb9ad656ed17fef15b16d737f7dc44f9'));
  assert.ok(guide.includes('26,397,529'));
  assert.equal(guide.includes('No genuine transfer figure has been verified'), false);
});

test('M-09: section 11 records the 2026-11-12 RPC re-check', () => {
  assert.ok(guide.includes('2026-11-12 at about 08:03 UTC'));
  assert.ok(guide.includes('26,397,537'));
  assert.ok(guide.includes('error -32046'));
});

test('M-09: row stays OPEN with both blockers named', () => {
  const row = rowSpan('M-09', 'M-10');
  assert.ok(row.includes('**Status:** OPEN'));
  assert.ok(row.includes('M-35 authorisation not granted'));
  assert.ok(row.includes('independent second source still not established'));
});
