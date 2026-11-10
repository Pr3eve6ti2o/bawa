import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
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
});
