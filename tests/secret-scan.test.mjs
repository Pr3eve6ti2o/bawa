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
    // test/fixture-oracle.py — the exact reviewed lines (MNEMONIC = (
    // plus the seed line twice, as in the real file, lines 62 and 236).
    write(root, 'test/fixture-oracle.py', 'MNEMONIC = (\n    "ripple scissors kick mammal hire column oak again sun offer wealth "\n    "tomorrow wagon turn fatal"\n)\n\n\ndef oracle_addresses():\n    seed = Bip39SeedGenerator(MNEMONIC).Generate()\n\n\ndef wrong_path():\n    seed = Bip39SeedGenerator(MNEMONIC).Generate()\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true, 'the reviewed lines must pass');

    // Plant a NON-exempt secret assignment in each of the four files.
    write(root, 'tools/decrypt_seed.py', 'mnemonic = "hunter2 hunter2 hunter2 hunter2"\n');
    write(root, 'test/differential_test.py', 'seed = "abcdef0123456789"\n');
    write(root, 'test/test_make_wallet.py', 'private_key = "0x1234"\n');
    write(root, 'test/fixture-oracle.py', 'mnemonic = "hunter2 hunter2 hunter2 hunter2"\n');
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

  test('T44-F1: every documented private extended-key prefix fails', () => {
    // Fake shape-only literals (repeated '1's), never real keys.
    const long = '1'.repeat(105);
    for (const prefix of ['yprv', 'tprv', 'vprv', 'uprv', 'Yprv', 'Zprv']) {
      write(root, `keys-${prefix}.txt`, `${prefix}${long}\n`);
      assert.equal(
        secretScan(root),
        false,
        `${prefix} literal must fail the gate`,
      );
    }
  });

  test('T44-F2: WIF private keys fail', () => {
    write(root, 'wif-k.txt', `K${'1'.repeat(50)}\n`);
    assert.equal(secretScan(root), false, 'compressed WIF must fail');
    write(root, 'wif-5.txt', `5${'1'.repeat(50)}\n`);
    assert.equal(secretScan(root), false, 'uncompressed WIF must fail');
  });

  test('T44-F2 (s4b): compressed and testnet WIF fail', () => {
    // 52-char compressed mainnet (K/L) and testnet (c); 51-char
    // testnet uncompressed (9). The first fix covered 51-char 5/K/L
    // only. Fake shape-only literals (repeated '1's), never real keys.
    write(root, 'wif-k52.txt', `K${'1'.repeat(51)}\n`);
    assert.equal(secretScan(root), false, '52-char compressed WIF must fail');
    write(root, 'wif-l52.txt', `L${'1'.repeat(51)}\n`);
    assert.equal(secretScan(root), false, '52-char compressed WIF must fail');
    write(root, 'wif-c52.txt', `c${'1'.repeat(51)}\n`);
    assert.equal(secretScan(root), false, '52-char testnet WIF must fail');
    write(root, 'wif-9.txt', `9${'1'.repeat(50)}\n`);
    assert.equal(secretScan(root), false, '51-char testnet WIF must fail');
  });

  test('T44-F2 (s4b): a too-short Base58 run starting with K still passes', () => {
    // 50 chars total is too short to be WIF: the gate must not flag it.
    write(root, 'wif-short.txt', `K${'1'.repeat(49)}\n`);
    assert.equal(secretScan(root), true);
  });

  test('T44-F3: seedPhrase / secret_key assignment spellings fail', () => {
    write(root, 'a.txt', 'seedPhrase = "abandon abandon abandon"\n');
    assert.equal(secretScan(root), false, 'seedPhrase assignment must fail');
    write(root, 'b.txt', 'seed_phrase = "abandon abandon abandon"\n');
    assert.equal(secretScan(root), false, 'seed_phrase assignment must fail');
    write(root, 'c.txt', 'secret_key = "hunter2"\n');
    assert.equal(secretScan(root), false, 'secret_key assignment must fail');
    write(root, 'd.txt', 'mnemonic_words = ["abandon"]\n');
    assert.equal(secretScan(root), false, 'mnemonic_words assignment must fail');
  });

  test('T44-F3 (s4b): declaration, export, JSON and member forms fail', () => {
    // The member and JSON planted strings are built by concatenation:
    // written out in full, the test file itself would trip the gate it
    // is testing (the planted content is identical either way).
    write(root, 'a.js', 'const mnemonic = "abandon abandon abandon"\n');
    assert.equal(secretScan(root), false, 'const mnemonic must fail');
    write(root, 'b.sh', 'export SEED="abandon abandon abandon"\n');
    assert.equal(secretScan(root), false, 'export SEED must fail');
    write(root, 'c.json', '{"private' + '_key": "1111111111111111"}\n');
    assert.equal(secretScan(root), false, 'JSON private_key must fail');
    write(root, 'd.js', 'wallet.' + 'seed = "abandon abandon abandon"\n');
    assert.equal(secretScan(root), false, 'member seed assignment must fail');
    write(root, 'e.txt', 'priv_key = "1111111111111111"\n');
    assert.equal(secretScan(root), false, 'priv_key must fail');
    write(root, 'f.txt', 'private-key = "1111111111111111"\n');
    assert.equal(secretScan(root), false, 'private-key must fail');
    write(root, 'g.txt', 'private_key_hex = "1111111111111111"\n');
    assert.equal(secretScan(root), false, 'private_key_hex must fail');
    write(root, 'h.txt', 'recovery_phrase = "abandon abandon abandon"\n');
    assert.equal(secretScan(root), false, 'recovery_phrase must fail');
    write(root, 'i.txt', 'passphrase = "hunter2 hunter2"\n');
    assert.equal(secretScan(root), false, 'passphrase must fail');
  });

  test('T44-F3 (s9): a property on its own line of formatted JSON fails', () => {
    // s9 High: the { or , must be on the same line as the key, so an
    // indented property of pretty-printed JSON was missed.
    write(root, 'config.json', '{\n  "private_key": "1111111111111111111111111111111111111111111111111111111111111111"\n}\n');
    assert.equal(secretScan(root), false, 'multiline JSON private_key must fail');
  });

  test('T44-F3 (s8): unquoted object-property keys fail', () => {
    // Built by concatenation: written out in full, the test file
    // itself would trip the gate it is testing (the planted content
    // is identical either way). s8 High: the old quoted-key branch
    // missed unquoted property keys entirely.
    write(root, 'e.js', 'const wallet = { private' + 'Key: "1111111111111111111111111111111111111111111111111111111111111111" };\n');
    assert.equal(secretScan(root), false, 'unquoted privateKey property must fail');
  });

  test('T44-F3 (s4b): comparisons and prose about keys still pass', () => {
    // == / != must not flag: the separator is a single = or :.
    write(root, 'a.js', 'if (seed == "expected") { ok(); }\n');
    write(root, 'b.js', 'if (config.seed !== "expected") { ok(); }\n');
    write(root, 'c.md', 'The mnemonic is twelve words; the seed derives the keys.\n');
    write(root, 'd.md', 'Set SEED to your phrase before running the tool.\n');
    // s8 Low: a ternary is not an object property assignment.
    write(root, 'e.js', 'const label = useMnemonic ? "mnemonic" : "seed";\n');
    // s9 Low: a member followed by a colon is a ternary, not an
    // assignment.
    write(root, 'f.js', 'const display = unlocked ? wallet.mnemonic : "";\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true);
  });

  test('T44-F1/F2: bare prefix mentions in prose still pass', () => {
    // The docs name the prefixes without a key literal; naming them
    // must not trip the gate.
    write(
      root,
      'docs-note.md',
      'Any of `xprv`/`xpub`, `yprv`/`ypub`, `zprv`/`zpub`, `tprv`/`tpub`, `uprv`/`upub` or `vprv`/`vpub`, followed by Base58 characters.\n',
    );
    write(root, 'wif-note.md', 'A WIF key starts with 5, K or L and is 51 characters.\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true);
  });

  test('T43: PEM private-key blocks fail', () => {
    // Built by concatenation: written out in full, this test file
    // would trip the gate it is testing (the planted content is
    // identical either way).
    write(root, 'key.pem', '-----BEGIN ' + 'PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n');
    assert.equal(secretScan(root), false, 'PEM block must fail');
  });

  test('T43: a 64-hex value next to a data-key name fails', () => {
    const hex = 'a'.repeat(64);
    write(root, 'a.txt', 'BAWA_DATA_KEY_HEX = "' + hex + '"\n');
    assert.equal(secretScan(root), false, 'data-key hex must fail');
  });

  test('T43: seed_hex with a 64-hex value fails', () => {
    write(root, 'a.txt', 'seed_hex = "' + 'b'.repeat(64) + '"\n');
    assert.equal(secretScan(root), false, 'seed_hex must fail');
  });

  test('T43: a bare 64-hex string still passes', () => {
    write(root, 'a.txt', 'sha256 = "' + 'c'.repeat(64) + '"\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true, 'bare 64-hex must pass');
  });

  test('T43: a 12-word BIP-39 run fails', () => {
    // Built from fragments across two source lines: written out in
    // full, this test file would trip the gate it is testing (the
    // planted content is identical either way).
    const run = ['abandon', 'ability', 'able', 'about', 'above', 'absent',
      'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'].join(' ');
    write(root, 'm.txt', run + '\n');
    assert.equal(secretScan(root), false, '12-word run must fail');
  });

  test('T43: the known published vectors pass', () => {
    // Each planted line is exactly one known vector, so the complete-
    // run exemption applies; a longer run starting with one still fails
    // (next test).
    write(root, 'v.txt', 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal\n');
    write(root, 'h.txt', 'test test test test test test test test test test test junk\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true, 'known vectors must pass');
  });

  test('T43: a 24-word run starting with the allowlisted 15-word vector still fails', () => {
    // r2a §2: allowlisting complete runs, not substrings of longer
    // mnemonics — removing the 15-word prefix would leave nine words
    // and hide a non-allowlisted secret.
    const vector = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
    const extra = ['abandon', 'ability', 'able', 'about', 'above', 'absent',
      'absorb', 'abstract', 'absurd'].join(' ');
    write(root, 'm.txt', vector + ' ' + extra + '\n');
    assert.equal(secretScan(root), false, 'vector-prefix 24-word run must fail');
  });

  test('T43: a known vector with one extra word attached still passes', () => {
    // The documented vectors read as 16-word runs in prose: "15-word"
    // contributes the BIP-39 word "word", and the WEB-GUIDE table rows
    // follow the vector with the "Empty" passphrase cell. One extra
    // word is exempt; two are not (next test).
    const vector = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
    write(root, 'a.txt', vector + ' word\n');
    write(root, 'b.txt', vector + ' empty\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true, 'vector plus one word must pass');
  });

  test('T43: a known vector with two extra words attached still fails', () => {
    // The one-word allowance is tight: two extra words are real
    // mnemonic material, not prose.
    const vector = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
    write(root, 'm.txt', vector + ' word empty\n');
    assert.equal(secretScan(root), false, 'vector plus two words must fail');
  });

  test('T43: a TRACKED file under a build tree fails (no longer excluded)', () => {
    write(root, 'apps/web/dist/probe.txt', 'mnemonic = "word1 word2 word3 word4"\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), false, 'tracked build file must fail');
  });

  test('T43: a TRACKED file under node_modules fails (no longer excluded)', () => {
    write(root, 'node_modules/pkg/index.js', 'mnemonic = "word1 word2 word3 word4"\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), false, 'tracked node_modules file must fail');
  });

  test('a clean tree passes', () => {
    write(root, 'README.md', '# hello\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true);
  });

  test('T35: the exact reviewed privateKey protobuf lines pass, a literal key in the same files fails', () => {
    // tools/mainnet-signing/local-signing.mjs — wallet-core SigningInput
    // protobuf field assignments; the value is a runtime variable, never
    // a literal secret. Two distinct exact lines (one covers 3 occurrences).
    write(root, 'tools/mainnet-signing/local-signing.mjs', '    privateKey: [priv],\n    privateKey: priv,\n    privateKey: priv,\n    privateKey: priv,\n');
    // tests/mainnet-signing.test.mjs — the same field in a test fixture.
    write(root, 'tests/mainnet-signing.test.mjs', '      privateKey: priv(1),\n');
    git(root, ['add', '.']);
    assert.equal(secretScan(root), true, 'the reviewed privateKey lines must pass');

    // Plant a NON-exempt literal key in each file. Built by
    // concatenation: written out in full, the test file itself would
    // trip the gate it is testing.
    write(root, 'tools/mainnet-signing/local-signing.mjs', '    private' + 'Key: "1111111111111111111111111111111111111111111111111111111111111111",\n');
    write(root, 'tests/mainnet-signing.test.mjs', '      private' + 'Key: "1111111111111111111111111111111111111111111111111111111111111111",\n');
    assert.equal(secretScan(root), false, 'a literal private key must fail in each previously exempted file');
  });
});
