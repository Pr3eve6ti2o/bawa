// Regression tests for generate.js publish path (F-12/F-13):
// per-destination lock + atomic link() publish + durable --force backup.
// generate.js is CommonJS; load it via createRequire.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, unlinkSync, statSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const toolsDir = fileURLToPath(new URL('../tools/hdwallet-gen/', import.meta.url));
const {
  acquirePublishLock,
  releasePublishLock,
  publishSeedBundle,
  backupExistingBundle,
} = require(join(toolsDir, 'generate.js'));

describe('generate.js publish (F-12/F-13)', () => {
  test('acquire writes own PID, release removes it, double release is safe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      const lockPath = acquirePublishLock(encPath);
      assert.equal(lockPath, encPath + '.lock');
      assert.equal(readFileSync(lockPath, 'utf8'), String(process.pid));
      releasePublishLock(lockPath);
      assert.equal(existsSync(lockPath), false);
      releasePublishLock(lockPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('stale lock from a dead PID or malformed content IS reclaimed via rename-aside (T44-F8 supersedes T40-F3)', () => {
    // T44-F8 supersedes T40-F3: automatic reclamation was restored, but
    // only for provably-dead PIDs (or malformed content), via an atomic
    // rename-aside — never an unlink — plus a post-write ownership check,
    // so a contender cannot steal a live holder's lock. A live lock still
    // waits the bounded 10 s then refuses (next test). Reclaim must be
    // prompt (no 10 s wait) and the lock must end up owned by us.
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      const lockPath = encPath + '.lock';
      for (const stale of ['999999', 'not-a-pid']) {
        writeFileSync(lockPath, stale);
        const start = Date.now();
        const acquired = acquirePublishLock(encPath);
        const waited = Date.now() - start;
        assert.equal(acquired, lockPath);
        assert.ok(waited < 5000, `reclaim took ${waited} ms, expected prompt (<5000)`);
        assert.equal(readFileSync(lockPath, 'utf8'), String(process.pid));
        releasePublishLock(lockPath, process.pid);
        assert.equal(existsSync(lockPath), false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('live lock waits the bounded 10 s then refuses', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    const encPath = join(dir, 'seed.enc.json');
    const holder = spawn(process.execPath, ['-e',
      "const {acquirePublishLock} = require('./generate.js');" +
      'acquirePublishLock(process.argv[1]);' +
      'setTimeout(()=>{}, 30000);',
      encPath], { cwd: toolsDir, stdio: 'ignore' });
    try {
      const lockPath = encPath + '.lock';
      const deadline = Date.now() + 5000;
      while (!existsSync(lockPath) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.ok(existsSync(lockPath), 'holder did not create the lock');
      const start = Date.now();
      assert.throws(
        () => acquirePublishLock(encPath),
        /seed bundle publish already in progress/
      );
      const waited = Date.now() - start;
      assert.ok(waited >= 9000 && waited < 20000, `bounded wait was ${waited} ms, expected ~10000`);
    } finally {
      holder.kill('SIGKILL');
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('publish non-force links when absent, refuses and preserves when present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      const tmp1 = encPath + '.tmp.1';
      writeFileSync(tmp1, 'bundle-one');
      publishSeedBundle({ encPath, tmpPath: tmp1, force: false });
      assert.equal(readFileSync(encPath, 'utf8'), 'bundle-one');
      assert.equal(existsSync(tmp1), false);
      const tmp2 = encPath + '.tmp.2';
      writeFileSync(tmp2, 'bundle-two');
      assert.throws(
        () => publishSeedBundle({ encPath, tmpPath: tmp2, force: false }),
        /Refusing to overwrite existing seed\.enc\.json; pass --force to replace/
      );
      assert.equal(readFileSync(encPath, 'utf8'), 'bundle-one');
      assert.equal(readFileSync(tmp2, 'utf8'), 'bundle-two');
      unlinkSync(tmp2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('publish force replaces via rename', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      writeFileSync(encPath, 'bundle-old');
      const tmp3 = encPath + '.tmp.3';
      writeFileSync(tmp3, 'bundle-three');
      publishSeedBundle({ encPath, tmpPath: tmp3, force: true });
      assert.equal(readFileSync(encPath, 'utf8'), 'bundle-three');
      assert.equal(existsSync(tmp3), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('publish fence refuses when the lock no longer names our PID', () => {
    // T43 r1c §4: a lock stolen between acquisition and publication must
    // refuse instead of publishing concurrently with the thief.
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      const lockPath = encPath + '.lock';
      writeFileSync(lockPath, '99999999');
      const tmp = encPath + '.tmp.1';
      writeFileSync(tmp, 'bundle-one');
      assert.throws(
        () => publishSeedBundle({ encPath, tmpPath: tmp, force: false, lockPath, lockPid: process.pid }),
        /publish lock lost/,
      );
      assert.equal(existsSync(encPath), false);
      assert.equal(readFileSync(tmp, 'utf8'), 'bundle-one');
      unlinkSync(tmp);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('publish fence passes when the lock names our PID', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      const lockPath = encPath + '.lock';
      writeFileSync(lockPath, String(process.pid));
      const tmp = encPath + '.tmp.1';
      writeFileSync(tmp, 'bundle-one');
      publishSeedBundle({ encPath, tmpPath: tmp, force: false, lockPath, lockPid: process.pid });
      assert.equal(readFileSync(encPath, 'utf8'), 'bundle-one');
      assert.equal(existsSync(tmp), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('backupExistingBundle preserves bytes at 0600 under a random-suffix name', () => {
    // T43 r1b Fix 2 / c1b: the name carries a random suffix, so a
    // rolled-back clock cannot collide two backups; a second backup
    // gets a distinct name.
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      writeFileSync(encPath, 'bundle-old');
      const backupPath = backupExistingBundle(encPath);
      assert.equal(readFileSync(backupPath, 'utf8'), 'bundle-old');
      assert.match(backupPath, /\.bak\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.[0-9a-f]{16}$/);
      assert.equal(statSync(backupPath).mode & 0o777, 0o600);
      assert.equal(readFileSync(encPath, 'utf8'), 'bundle-old');
      const second = backupExistingBundle(encPath);
      assert.notEqual(second, backupPath);
      assert.equal(readFileSync(second, 'utf8'), 'bundle-old');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('backupExistingBundle refuses a symlinked bundle without touching its target', () => {
    // T43 r1b Fix 2 / c1b: a symlinked bundle path must fail instead of
    // backing up (or chmodding) its target.
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const target = join(dir, 'target.json');
      writeFileSync(target, 'sentinel');
      const encPath = join(dir, 'seed.enc.json');
      symlinkSync(target, encPath);
      assert.throws(() => backupExistingBundle(encPath), /refusing symlinked seed bundle/);
      assert.equal(readFileSync(target, 'utf8'), 'sentinel');
      assert.equal(readdirSync(dir).filter((n) => n.includes('.bak.')).length, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
