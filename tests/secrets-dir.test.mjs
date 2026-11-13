import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSecretsDir } from '../tools/hdwallet-gen/generate.js';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

function captureStderr(fn) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => {
    lines.push(args.join(' '));
  };
  try {
    const result = fn();
    return { result, stderr: lines.join('\n') };
  } finally {
    console.error = original;
  }
}

describe('secrets directory resolution (BAWA_SECRETS_DIR migration)', () => {
  test('new name alone is used without a warning', () => {
    const { result, stderr } = captureStderr(() =>
      resolveSecretsDir({ BAWA_SECRETS_DIR: '/tmp/bawa-secrets' }),
    );
    assert.equal(result, '/tmp/bawa-secrets');
    assert.equal(stderr, '');
  });

  test('old name alone works with a deprecation warning naming no values', () => {
    const { result, stderr } = captureStderr(() =>
      resolveSecretsDir({ NOVA_SECRETS_DIR: '/tmp/legacy-secrets' }),
    );
    assert.equal(result, '/tmp/legacy-secrets');
    assert.match(stderr, /NOVA_SECRETS_DIR/);
    assert.match(stderr, /deprecated/);
    assert.doesNotMatch(stderr, /\/tmp\/legacy-secrets/);
  });

  test('both names set to different values refuse', () => {
    assert.throws(
      () =>
        resolveSecretsDir({
          BAWA_SECRETS_DIR: '/tmp/a',
          NOVA_SECRETS_DIR: '/tmp/b',
        }),
      /conflicting secrets directories/,
    );
  });

  test('neither set uses the repository default', () => {
    assert.equal(resolveSecretsDir({}), join(repoRoot, 'secrets'));
  });

  test('both names set to the same value use the new name with a warning', () => {
    const { result, stderr } = captureStderr(() =>
      resolveSecretsDir({
        BAWA_SECRETS_DIR: '/tmp/same',
        NOVA_SECRETS_DIR: '/tmp/same',
      }),
    );
    assert.equal(result, '/tmp/same');
    assert.match(stderr, /NOVA_SECRETS_DIR/);
    assert.doesNotMatch(stderr, /\/tmp\/same/);
  });

  test('a symlinked secrets directory is refused (fresh and legacy names)', () => {
    // T43 r2a Fix 1 / F3: a standalone generate.js run must not bypass
    // the wrapper's refusal — resolveSecretsDir refuses every returned
    // path that is a symlink.
    const dir = fs.mkdtempSync(join(os.tmpdir(), 'bawa-secrets-dir-'));
    try {
      const target = join(dir, 'real');
      fs.mkdirSync(target);
      const link = join(dir, 'link');
      fs.symlinkSync(target, link, 'dir');
      assert.throws(
        () => resolveSecretsDir({ BAWA_SECRETS_DIR: link }),
        /refusing symlinked secrets directory/,
      );
      assert.throws(
        () => resolveSecretsDir({ NOVA_SECRETS_DIR: link }),
        /refusing symlinked secrets directory/,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a missing secrets directory is fine (it is created later)', () => {
    const missing = join(os.tmpdir(), `bawa-secrets-missing-${process.pid}`);
    assert.equal(resolveSecretsDir({ BAWA_SECRETS_DIR: missing }), missing);
  });
});
