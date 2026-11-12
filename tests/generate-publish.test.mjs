// Regression tests for generate.js publish path (F-12/F-13):
// per-destination lock + atomic link() publish + durable --force backup.
// generate.js is CommonJS; load it via createRequire.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
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

  test('stale lock from a dead PID or malformed content is NOT stolen (T40-F3 fail-closed)', () => {
    // T40-F3: automatic reclamation was removed — a contender unlinking a
    // lock it observed as stale could unlink a live holder's lock (the
    // empty-file window), so both processes could publish concurrently.
    // A stale lock now waits the bounded 10 s, refuses, names the lock
    // file for manual cleanup, and leaves the file in place.
    const dir = mkdtempSync(join(tmpdir(), 'gen-pub-'));
    try {
      const encPath = join(dir, 'seed.enc.json');
      const lockPath = encPath + '.lock';
      for (const stale of ['999999', 'not-a-pid']) {
        writeFileSync(lockPath, stale);
        const start = Date.now();
        assert.throws(
          () => acquirePublishLock(encPath),
          /seed bundle publish already in progress.*remove the stale lock file/
        );
        const waited = Date.now() - start;
        assert.ok(waited >= 9000 && waited < 20000, `bounded wait was ${waited} ms, expected ~10000`);
        assert.equal(readFileSync(lockPath, 'utf8'), stale);
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
});
