// Regression tests for scripts/secret-scan.mjs (F-25/26).
// Each test builds a scratch git repo, plants files, and asserts the
// scanner's verdict. Planted secrets are fake literals (never real
// keys); the exempted lines are the exact reviewed contents.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { secretScan } from '../scripts/secret-scan.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function write(root, rel, content) {
  const path = join(root, rel);
  mkdirSync(join(root, rel.split('/').slice(0, -1).join('/')), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

describe('secret-scan (F-25/26)', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bawa-secret-scan-'));
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'test@example.invalid']);
    git(root, ['config', 'user.name', 'test']);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('F-26: the exact reviewed lines pass, a planted line in each file fails', () => {
    // tools/decrypt_seed.py — exact reviewed line only.
    write(root, 'tools/decrypt_seed.py', 'def decrypt(path, key):\n    pass\n\n\ndef main():\n    mnemonic = decrypt(args.path, key)\n');
    // test/differential_test.py — both exact reviewed lines.
    write(root, 'test/differential_test.py', 'MNEMONIC = (\n    "ripple scissors kick mammal hire column oak again sun offer wealth "\n    "tomorrow wagon turn fatal"\n)\n\n\ndef main():\n    seed = Bip39SeedGenerator(MNEMONIC).Generate()\n');
    // test/test_make_wallet.py — the exact reviewed line (x3).
    const reviewed = '        mnemonic = " ".join(["abandon"] * 23 + ["art"])\n';
    write(root, 'test/test_make_wallet.py', reviewed.repeat(3));
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true, 'the reviewed lines must pass');

    // Plant a NON-exempt secret assignment in each of the three files.
    write(root, 'tools/decrypt_seed.py', 'mnemonic = "hunter2 hunter2 hunter2 hunter2"\n');
    write(root, 'test/differential_test.py', 'seed = "abcdef0123456789"\n');
    write(root, 'test/test_make_wallet.py', 'private_key = "0x1234"\n');
    assert.equal(
      secretScan(root),
      false,
      'a non-exempt secret assignment must fail in each previously exempted file',
    );
  });

  test('F-26: a near-miss of the reviewed line is not exempt', () => {
    // Same shape, different value: the exemption is exact-content only.
    write(root, 'test/test_make_wallet.py', '        mnemonic = " ".join(["abandon"] * 23 + ["zoo"])\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), false);
  });

  test('F-25: an untracked file with a secret fails', () => {
    write(root, 'notes.txt', 'mnemonic = "word1 word2 word3 word4"\n');
    assert.equal(secretScan(root), false);
  });

  test('F-25: a TRACKED .log file with a secret fails (no longer excluded)', () => {
    write(root, 'reports/run.log', 'mnemonic = "word1 word2 word3 word4"\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), false);
  });

  test('F-25: an UNTRACKED .log file with a secret is still excluded', () => {
    write(root, 'scratch.log', 'mnemonic = "word1 word2 word3 word4"\n');
    assert.equal(secretScan(root), true);
  });

  test('F-25: a generated/ file with a secret fails, including a .log', () => {
    write(root, 'generated/web-wallet/notes.txt', 'mnemonic = "word1 word2 word3 word4"\n');
    write(root, 'generated/web-wallet/build.log', 'seed = "abcdef0123456789"\n');
    assert.equal(secretScan(root), false);
  });

  test('F-25: node_modules stays excluded', () => {
    write(root, 'node_modules/pkg/index.js', 'mnemonic = "word1 word2 word3 word4"\n');
    assert.equal(secretScan(root), true);
  });

  test('a clean tree passes', () => {
    write(root, 'README.md', '# hello\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true);
  });
});
