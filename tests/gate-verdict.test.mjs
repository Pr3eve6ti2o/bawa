// Unit tests for scripts/gate-verdict.mjs (F-41).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict } from '../scripts/gate-verdict.mjs';

describe('verdict()', () => {
  test('no failures and no skips is a plain OK', () => {
    assert.equal(verdict(0, []), 'quality-gates: OK');
  });

  test('skips are named and the run is still OK', () => {
    assert.equal(
      verdict(0, ['android-tests']),
      'quality-gates: OK with skips (1 skipped: android-tests)',
    );
    assert.equal(
      verdict(0, ['android-tests', 'web-build']),
      'quality-gates: OK with skips (2 skipped: android-tests, web-build)',
    );
  });

  test('failures are FAILED, and skips are listed too', () => {
    assert.equal(
      verdict(2, []),
      'quality-gates: FAILED (2 gates failed)',
    );
    assert.equal(
      verdict(1, ['android-tests']),
      'quality-gates: FAILED (1 gates failed) (1 skipped: android-tests)',
    );
  });
});
