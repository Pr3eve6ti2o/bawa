// Regression tests for the generate.js publish lock (T44-F8).
// Imports the lock functions from tools/hdwallet-gen/generate.js, so
// this suite needs the engine dependencies installed, like the other
// engine suites (quality-gates runs engine-setup first).
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { acquirePublishLock, releasePublishLock } = require(
  '../tools/hdwallet-gen/generate.js',
);

describe('publish lock (T44-F8)', () => {
  let dir;
  let encPath;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bawa-publish-lock-'));
    encPath = join(dir, 'seed.enc.json');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('acquire creates the lock with our pid; release removes it', () => {
    const lockPath = acquirePublishLock(encPath);
    assert.equal(readFileSync(lockPath, 'utf8').trim(), String(process.pid));
    releasePublishLock(lockPath, process.pid);
    assert.equal(existsSync(lockPath), false);
  });

  test('release does not remove a foreign lock', () => {
    const lockPath = acquirePublishLock(encPath);
    writeFileSync(lockPath, '99999999');
    releasePublishLock(lockPath, process.pid);
    assert.equal(existsSync(lockPath), true);
    assert.equal(readFileSync(lockPath, 'utf8').trim(), '99999999');
  });

  test('acquire reclaims a stale (dead-pid) lock', () => {
    writeFileSync(`${encPath}.lock`, '99999999');
    const lockPath = acquirePublishLock(encPath);
    assert.equal(readFileSync(lockPath, 'utf8').trim(), String(process.pid));
    releasePublishLock(lockPath, process.pid);
    assert.equal(existsSync(lockPath), false);
  });

  test('acquire refuses while a live lock is held', () => {
    writeFileSync(`${encPath}.lock`, String(process.pid));
    assert.throws(() => acquirePublishLock(encPath), /already in progress/);
    assert.equal(
      readFileSync(`${encPath}.lock`, 'utf8').trim(),
      String(process.pid),
    );
  });
});
