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
  writeFileSync,
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

// Regression tests for generate-project.mjs secret-file exclusion
// (T49 F-01). The generator copies starter trees from the working copy,
// not from git, so .gitignore does not stop a local secret file (.env,
// keystore material, seed backups) from being shipped inside a
// generated project. Planted contents are inert fake-only text, never
// real secrets. Every planted file is removed in afterEach, even when
// a test fails.
describe('generate-project secret-file exclusion (T49 F-01)', () => {
  // Paths relative to the starter root; the denylist must catch each
  // one at any depth, including nested and upper-case variants.
  const plantedWeb = [
    '.env',
    '.env.production',
    '.ENV.upper',
    'secrets/token.txt',
    'src/__t49-nested__/.env',
    'release.jks',
    '.environment.ts',
    '.env.example',
    '__t49-control__.txt',
  ];
  const plantedAndroid = [
    'keystore.properties',
    'app/release.keystore',
    'secrets/token.txt',
    '__t49-control__.txt',
  ];
  const webOut = join(generatedRoot, '__t49-web__');
  const androidOut = join(generatedRoot, '__t49-android__');
  const linkPath = join(repoRoot, 'apps', 'web', '__t49-link__');

  function plant(starter, relPaths) {
    for (const rel of relPaths) {
      const path = join(repoRoot, 'apps', starter, rel);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, 'T49-TEST-ONLY-NOT-A-SECRET\n', 'utf8');
    }
  }

  function unplant(starter, relPaths) {
    for (const rel of relPaths) {
      try {
        unlinkSync(join(repoRoot, 'apps', starter, rel));
      } catch {
        // Already removed or never created.
      }
    }
    rmSync(join(repoRoot, 'apps', starter, 'secrets'), { recursive: true, force: true });
    rmSync(join(repoRoot, 'apps', starter, 'src', '__t49-nested__'), { recursive: true, force: true });
  }

  beforeEach(() => {
    plant('web', plantedWeb);
    plant('android', plantedAndroid);
  });

  afterEach(() => {
    try {
      unlinkSync(linkPath);
    } catch {
      // Already removed or never created.
    }
    unplant('web', plantedWeb);
    unplant('android', plantedAndroid);
    rmSync(webOut, { recursive: true, force: true });
    rmSync(androidOut, { recursive: true, force: true });
  });

  test('web generation excludes planted secret files but copies normal files', () => {
    const result = runGenerate(['web-wallet', '--out', webOut]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const rel of plantedWeb) {
      if (rel === '__t49-control__.txt' || rel === '.environment.ts' || rel === '.env.example') continue;
      assert.equal(
        existsSync(join(webOut, rel)),
        false,
        'planted file must not reach the generated project: ' + rel,
      );
    }
    assert.equal(existsSync(join(webOut, 'secrets')), false);
    assert.equal(
      existsSync(join(webOut, '__t49-control__.txt')),
      true,
      'ordinary files must still be copied',
    );
    assert.equal(
      existsSync(join(webOut, '.environment.ts')),
      true,
      'a source file merely starting with .env must still be copied',
    );
    assert.equal(
      existsSync(join(webOut, '.env.example')),
      true,
      'the documented .env.example template must still be copied',
    );
    assert.ok(existsSync(join(webOut, 'profile.json')));
    assert.ok(existsSync(join(webOut, 'README-starter.md')));
    assert.ok(existsSync(join(webOut, 'index.html')));
  });

  test('android generation excludes planted secret files but copies normal files', () => {
    const result = runGenerate(['android-wallet', '--out', androidOut]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const rel of plantedAndroid) {
      if (rel === '__t49-control__.txt') continue;
      assert.equal(
        existsSync(join(androidOut, rel)),
        false,
        'planted file must not reach the generated project: ' + rel,
      );
    }
    assert.equal(existsSync(join(androidOut, 'secrets')), false);
    assert.equal(
      existsSync(join(androidOut, '__t49-control__.txt')),
      true,
      'ordinary files must still be copied',
    );
    assert.ok(existsSync(join(androidOut, 'profile.json')));
    assert.ok(existsSync(join(androidOut, 'README-starter.md')));
    assert.ok(existsSync(join(androidOut, 'app', 'src', 'main', 'AndroidManifest.xml')));
  });

  test('a symlink inside a starter fails the run instead of being copied', () => {
    symlinkSync(join(repoRoot, 'apps', 'web', '.env'), linkPath, 'file');
    const result = runGenerate(['web-wallet', '--out', webOut]);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /unsafe source entry/i);
  });
});
