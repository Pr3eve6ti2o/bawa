// Regression tests for tools/mainnet-guards/mainnet-guards.mjs (T25).
//
// All fixtures are fake literals built by concatenation at runtime (never
// real keys); the file itself contains no secret-shaped literal, so the
// repo secret-scan gate stays green. The abandon-word mnemonic used here
// is the published BIP-39 test-vector word, never a funded phrase.
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORBIDDEN_OPS,
  MainnetGuardError,
  READ_ONLY_OPS,
  assertOperationAllowed,
  containsSecret,
  destroyCredentialFile,
  fingerprintSecret,
  guardedLog,
  redactText,
  verifyNoCopies,
} from '../tools/mainnet-guards/mainnet-guards.mjs';

const modulePath = fileURLToPath(
  new URL('../tools/mainnet-guards/mainnet-guards.mjs', import.meta.url),
);

// Fake fixtures, built at runtime so no secret-shaped literal sits in
// this file.
const fakeXprv = 'xprv' + '1'.repeat(111);
const fakeZprv = 'zprv' + '1'.repeat(111);
const fakeWif = '5' + 'a'.repeat(50);
const fakeWords = Array(12).fill('abandon').join(' ');
const fakeHex64 = 'a'.repeat(64);
const fakeTxHash = 'b'.repeat(64);

function field(name) {
  // Rebuild a secret field name so the source line never looks like a
  // secret assignment to the repo secret scanner.
  return name;
}

describe('redactText (T25 guard 1)', () => {
  test('redacts an extended private key literal', () => {
    const out = redactText(`key ${fakeXprv} end`);
    assert.equal(out.includes('xprv'), false);
    assert.equal(out.includes('[REDACTED]'), true);
    assert.equal(out, 'key [REDACTED] end');
  });

  test('redacts a zprv literal', () => {
    assert.equal(redactText(fakeZprv), '[REDACTED]');
  });

  test('redacts a WIF-shaped string', () => {
    assert.equal(redactText(`wif ${fakeWif} done`), 'wif [REDACTED] done');
  });

  test('redacts a quoted mnemonic assignment value, keeps the field name', () => {
    const line = field('mnemonic') + ' = "' + fakeWords + '"';
    const out = redactText(line);
    assert.equal(out, 'mnemonic = "[REDACTED]"');
    assert.equal(out.includes('abandon'), false);
  });

  test('redacts an unquoted multi-word mnemonic assignment value', () => {
    const line = field('seed_phrase') + ': ' + fakeWords;
    const out = redactText(line);
    assert.equal(out, 'seed_phrase: [REDACTED]');
    assert.equal(out.includes('abandon'), false);
  });

  test('redacts a 64-hex value only in assignment context', () => {
    const line = field('private_key') + ' = ' + fakeHex64;
    assert.equal(redactText(line), 'private_key = [REDACTED]');
  });

  test('never redacts a bare 64-hex string (tx hash shape)', () => {
    assert.equal(redactText(fakeTxHash), fakeTxHash);
    assert.equal(redactText(`tx: ${fakeTxHash}`), `tx: ${fakeTxHash}`);
  });

  test('never redacts public addresses', () => {
    const line = 'address bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq and 0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    assert.equal(redactText(line), line);
  });

  test('containsSecret agrees with redactText', () => {
    assert.equal(containsSecret(fakeXprv), true);
    assert.equal(containsSecret('nothing secret here'), false);
    assert.equal(containsSecret(fakeTxHash), false);
  });
});

describe('guardedLog (T25 guard 1)', () => {
  test('emits only redacted text and returns the redaction count', () => {
    const emitted = [];
    const count = guardedLog((line) => emitted.push(line), 'key', fakeXprv, 'ok');
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].includes('xprv'), false);
    assert.equal(emitted[0], 'key [REDACTED] ok');
    assert.equal(count, 1);
  });

  test('clean text passes through with count 0', () => {
    const emitted = [];
    assert.equal(guardedLog((line) => emitted.push(line), 'balance', '42'), 0);
    assert.equal(emitted[0], 'balance 42');
  });
});

describe('assertOperationAllowed (T25 guard 2)', () => {
  test('read-only operations pass', () => {
    for (const op of READ_ONLY_OPS) {
      assert.equal(assertOperationAllowed(op), true);
    }
    assert.deepEqual(READ_ONLY_OPS, ['getBalance', 'getChainId', 'call', 'estimateGas']);
  });

  test('every forbidden verb throws MainnetGuardError naming M-35', () => {
    for (const [op, message] of Object.entries(FORBIDDEN_OPS)) {
      assert.throws(
        () => assertOperationAllowed(op),
        (error) => error instanceof MainnetGuardError &&
          error.message === message &&
          error.message.startsWith('STOP BEFORE BROADCASTING') &&
          error.message.includes('M-35 execution NOT authorised'),
        op,
      );
    }
  });

  test('unknown operations are forbidden as not allowlisted', () => {
    assert.throws(
      () => assertOperationAllowed('request'),
      (error) => error instanceof MainnetGuardError &&
        error.message === 'STOP BEFORE BROADCASTING: operation not allowlisted; M-35 execution NOT authorised.',
    );
  });

  test('local-only signing with temporary unfunded credentials is allowed', () => {
    for (const op of ['sign', 'signTransaction', 'signMessage', 'signTypedData']) {
      assert.equal(
        assertOperationAllowed(op, { credentialKind: 'temporary-unfunded', localOnly: true }),
        true,
        op,
      );
    }
  });

  test('signing is forbidden without temporary-unfunded local-only context', () => {
    for (const options of [{}, { credentialKind: 'funded' }, { credentialKind: 'temporary-unfunded' }, { credentialKind: 'temporary-unfunded', localOnly: false }]) {
      assert.throws(
        () => assertOperationAllowed('signTransaction', options),
        (error) => error instanceof MainnetGuardError &&
          error.message.startsWith('STOP BEFORE BROADCASTING'),
      );
    }
  });
});

describe('destroyCredentialFile (T25 guard 3a)', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bawa-mainnet-guards-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('destroys the file and reports its size', () => {
    const path = join(dir, 'cred.json');
    const content = 'temporary credential material';
    writeFileSync(path, content, { mode: 0o600 });
    const result = destroyCredentialFile(path);
    assert.equal(result.destroyed, true);
    assert.equal(result.bytes, Buffer.byteLength(content));
    assert.equal(result.passes, 3);
    assert.equal(existsSync(path), false);
  });

  test('missing file throws and nothing is unlinked', () => {
    assert.throws(
      () => destroyCredentialFile(join(dir, 'nope.json')),
      (error) => error instanceof MainnetGuardError,
    );
  });

  test('symlink is refused and its target stays intact', () => {
    const target = join(dir, 'target.json');
    const link = join(dir, 'link.json');
    writeFileSync(target, 'target material', { mode: 0o600 });
    symlinkSync(target, link);
    assert.throws(
      () => destroyCredentialFile(link),
      (error) => error instanceof MainnetGuardError,
    );
    assert.equal(existsSync(target), true);
    assert.equal(readFileSync(target, 'utf8'), 'target material');
  });
});

describe('fingerprintSecret (T25 guard 3a)', () => {
  test('hashes without exposing the secret and detects formats', () => {
    const mnemonicPrint = fingerprintSecret(fakeWords);
    assert.equal(mnemonicPrint.format, 'mnemonic');
    assert.match(mnemonicPrint.sha256, /^[0-9a-f]{64}$/);
    assert.equal(mnemonicPrint.sha256.includes('abandon'), false);
    assert.equal(fingerprintSecret(fakeHex64).format, 'hex64');
    assert.equal(fingerprintSecret('hello world').format, 'opaque');
    assert.notEqual(
      fingerprintSecret(fakeWords).sha256,
      fingerprintSecret(fakeHex64).sha256,
    );
    assert.equal(
      fingerprintSecret(fakeWords).sha256,
      fingerprintSecret(fakeWords).sha256,
    );
  });
});

describe('verifyNoCopies (T25 guard 3b)', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bawa-mainnet-guards-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('clean scope passes', () => {
    writeFileSync(join(dir, 'notes.txt'), 'balance 42\nchain 1\n');
    const result = verifyNoCopies({ scopeDirs: [dir] });
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
    assert.equal(result.scannedFiles, 1);
    assert.equal(result.coverageComplete, true);
  });

  test('planted secret-shaped copy is found at file:line, never echoed', () => {
    writeFileSync(join(dir, 'a.txt'), 'clean\n');
    writeFileSync(join(dir, 'leak.txt'), 'clean\nkey ' + fakeXprv + '\n');
    const result = verifyNoCopies({ scopeDirs: [dir] });
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].file, join(dir, 'leak.txt'));
    assert.equal(result.findings[0].line, 2);
    assert.equal(JSON.stringify(result).includes('xprv'), false);
  });

  test('in-memory secret copies are found, including quoted variants', () => {
    writeFileSync(join(dir, 'copy.json'), '{"k": "' + fakeWords + '"}');
    const result = verifyNoCopies({ scopeDirs: [dir], secrets: [fakeWords] });
    assert.equal(result.passed, false);
    assert.equal(result.findings[0].file, join(dir, 'copy.json'));
  });

  test('remaining credential pathname is a finding', () => {
    const cred = join(dir, 'cred.json');
    writeFileSync(cred, 'material');
    const result = verifyNoCopies({ scopeDirs: [dir], credentialPath: cred });
    assert.equal(result.passed, false);
    assert.deepEqual(result.findings, [{ file: cred, line: 0 }]);
  });

  test('binary file makes coverage incomplete', () => {
    writeFileSync(join(dir, 'blob.bin'), Buffer.from([0, 1, 2, 3]));
    const result = verifyNoCopies({ scopeDirs: [dir] });
    assert.equal(result.passed, false);
    assert.equal(result.coverageComplete, false);
    assert.equal(result.skipped.length, 1);
  });
});

describe('CLI (T25 guard 3)', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bawa-mainnet-guards-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(args) {
    return spawnSync(process.execPath, [modulePath, ...args], { encoding: 'utf8' });
  }

  test('destroy exits 0 and removes the file; verify exits 0 on a clean scope', () => {
    const cred = join(dir, 'cred.json');
    writeFileSync(cred, 'temporary material', { mode: 0o600 });
    const destroyed = run(['destroy', '--file', cred]);
    assert.equal(destroyed.status, 0, destroyed.stderr);
    assert.equal(existsSync(cred), false);
    const verified = run(['verify', '--scope', dir, '--credential-path', cred]);
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(verified.stdout, '');
  });

  test('verify exits 1 on a planted secret-shaped copy, locations only', () => {
    writeFileSync(join(dir, 'leak.txt'), 'key ' + fakeXprv + '\n');
    const result = run(['verify', '--scope', dir]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /leak\.txt:1/);
    assert.equal(result.stderr.includes('xprv'), false);
  });

  test('usage errors exit 2', () => {
    assert.equal(run(['verify']).status, 2);
    assert.equal(run(['destroy']).status, 2);
    assert.equal(run(['nonsense']).status, 2);
  });
});
