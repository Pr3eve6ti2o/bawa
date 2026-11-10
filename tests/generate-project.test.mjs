// Regression tests for generate-project.mjs containment (F-23).
// A lexical prefix check is not enough: a symlinked ancestor may point
// outside the repo. These tests create symlinks inside generated/ (and
// remove them in finally) and assert the script refuses an escape while
// still accepting a symlink that stays inside the repo.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const generatedRoot = join(repoRoot, 'generated');

function runGenerate(args) {
  return spawnSync(process.execPath, ['scripts/generate-project.mjs', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

describe('generate-project containment (F-23)', () => {
  let outsideDir;
  let linkPath;
  let realDir;

  beforeEach(() => {
    outsideDir = mkdtempSync(join(tmpdir(), 'bawa-f23-outside-'));
    linkPath = join(generatedRoot, '__f23-test__');
    realDir = join(generatedRoot, '__f23-real__');
  });

  afterEach(() => {
    try {
      unlinkSync(linkPath);
    } catch {
      // Already removed or never created.
    }
    rmSync(realDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  });

  test('a symlinked output component pointing outside the repo is refused', () => {
    mkdirSync(generatedRoot, { recursive: true });
    symlinkSync(outsideDir, linkPath, 'dir');
    const result = runGenerate(['web-wallet', '--out', linkPath, '--force']);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /refusing to write outside/i);
    assert.deepEqual(
      readdirSync(outsideDir),
      [],
      'nothing must be written outside the repo',
    );
  });

  test('a symlinked output component staying inside the repo still works', () => {
    mkdirSync(generatedRoot, { recursive: true });
    mkdirSync(realDir, { recursive: true });
    symlinkSync(realDir, linkPath, 'dir');
    const result = runGenerate(['web-wallet', '--out', linkPath, '--force']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(
      existsSync(join(realDir, 'profile.json')),
      'files land in the real in-repo directory',
    );
    assert.ok(existsSync(join(realDir, 'README.md')));
  });

  test('a plain --out outside the repo is still refused', () => {
    const result = runGenerate(['web-wallet', '--out', outsideDir, '--force']);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /refusing to write outside/i);
    assert.deepEqual(readdirSync(outsideDir), []);
  });
});
