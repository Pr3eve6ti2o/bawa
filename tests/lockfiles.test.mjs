// Regression tests for scripts/check-lockfiles.mjs (F-27, T44-F5).
// Each test builds a scratch root with fixture lockfiles and asserts the
// pin verdict. No network, no real lockfiles.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lockfiles } from '../scripts/check-lockfiles.mjs';

const FILE = 'tools/hdwallet-gen/package-lock.json';
const ENTRY = 'node_modules/@trustwallet/wallet-core';
const GOOD_URL =
  'https://registry.npmjs.org/@trustwallet/wallet-core/-/wallet-core-4.9.3.tgz';
const GOOD_INTEGRITY = 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function lockfile({ spec = '4.9.3', version = '4.9.3', resolved = GOOD_URL, integrity = GOOD_INTEGRITY, omitIntegrity = false } = {}) {
  const entry = { version, resolved };
  if (!omitIntegrity) entry.integrity = integrity;
  const packages = {
    '': { dependencies: { '@trustwallet/wallet-core': spec } },
    [ENTRY]: entry,
  };
  return JSON.stringify({ lockfileVersion: 3, packages }, null, 2);
}

describe('lockfiles (F-27, T44-F5)', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bawa-lockfiles-'));
    mkdirSync(join(root, 'tools', 'hdwallet-gen'), { recursive: true });
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function write(content, rel = FILE) {
    writeFileSync(join(root, rel), content, 'utf8');
  }

  test('the pinned 4.9.3 lockfile with registry URL and integrity passes', () => {
    write(lockfile());
    assert.equal(lockfiles(root, [FILE]), true);
  });

  test('a wrong resolved version fails', () => {
    write(lockfile({ version: '4.9.1' }));
    assert.equal(lockfiles(root, [FILE]), false);
  });

  test('a wrong spec fails', () => {
    write(lockfile({ spec: '^4.9.3' }));
    assert.equal(lockfiles(root, [FILE]), false);
  });

  test('T44-F5: a non-registry resolved URL fails even at 4.9.3', () => {
    write(lockfile({ resolved: 'https://evil.example/wallet-core-4.9.3.tgz' }));
    assert.equal(lockfiles(root, [FILE]), false);
  });

  test('T44-F5: a missing integrity hash fails even at 4.9.3', () => {
    write(lockfile({ omitIntegrity: true }));
    assert.equal(lockfiles(root, [FILE]), false);
  });

  test('T44-F5: a non-sha512 integrity hash fails', () => {
    write(lockfile({ integrity: 'sha1-AAAAAAAAAAAAAAAAAAAAAA==' }));
    assert.equal(lockfiles(root, [FILE]), false);
  });

  test('a missing lockfile fails', () => {
    assert.equal(lockfiles(root, [FILE]), false);
  });

  test('a symlinked lockfile fails', () => {
    write(lockfile(), 'real-lock.json');
    symlinkSync(join(root, 'real-lock.json'), join(root, FILE));
    assert.equal(lockfiles(root, [FILE]), false);
  });
});
