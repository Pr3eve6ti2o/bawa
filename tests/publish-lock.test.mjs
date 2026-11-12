// Regression tests for the generate.js publish lock (T44-F8).
// Imports the lock functions from tools/hdwallet-gen/generate.js, so
// this suite needs the engine dependencies installed, like the other
// engine suites (quality-gates runs engine-setup first).
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
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

  test('an unreadable lock is treated as live (fail closed), not reclaimed', () => {
    // T43 r1a §3: B must not remove A's lock when it cannot read it.
    // The lock names a dead PID, so only the fail-closed probe keeps it.
    // Root can read anything regardless of mode, so this is skipped there.
    if (typeof process.getuid === 'function' && process.getuid() === 0) return;
    writeFileSync(`${encPath}.lock`, '99999999');
    chmodSync(`${encPath}.lock`, 0o000);
    const start = Date.now();
    assert.throws(() => acquirePublishLock(encPath), /already in progress/);
    const waited = Date.now() - start;
    assert.ok(waited >= 9000 && waited < 20000, `bounded wait was ${waited} ms, expected ~10000`);
    chmodSync(`${encPath}.lock`, 0o600);
    assert.equal(readFileSync(`${encPath}.lock`, 'utf8').trim(), '99999999');
  });

  test('a FIFO lock is reclaimable promptly instead of blocking the open', () => {
    // T43 r1a §4: opening a FIFO for reading blocks until a writer
    // appears; the probe opens O_NONBLOCK and treats a non-regular lock
    // as dead, so reclaim is prompt.
    const fifo = `${encPath}.lock`;
    const made = spawnSync('mkfifo', [fifo]);
    assert.equal(made.status, 0, made.stderr?.toString());
    const start = Date.now();
    const lockPath = acquirePublishLock(encPath);
    const waited = Date.now() - start;
    assert.ok(waited < 5000, `FIFO reclaim took ${waited} ms, expected prompt (<5000)`);
    assert.equal(readFileSync(lockPath, 'utf8').trim(), String(process.pid));
    releasePublishLock(lockPath, process.pid);
    assert.equal(existsSync(lockPath), false);
  });
});
