import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const smokeFile = 'test/smoke.test.js';

const keyPatterns = {
  btc: /xpub: "(zpub[^"]+)"/,
  eth: /xpub: "(xpub6Bs[^"]+)"/,
  trx: /xpub: "(xpub6Bu[^"]+)"/,
};

const addressPatterns = {
  btc: /"(bc1q[a-z0-9]{38})"/,
  eth: /"(0x[A-Fa-f0-9]{40})"/,
  trx: /"(T[A-Za-z0-9]{33})"/,
};

function readRepo(file) {
  return readFileSync(resolve(repoRoot, file), 'utf8');
}

function requireMatch(text, pattern, name, occurrence = 0) {
  const match = [...text.matchAll(new RegExp(pattern.source, 'g'))][occurrence];
  assert.ok(match, `Missing ${name}`);
  return match;
}

function loadFixture(chain, index) {
  const smoke = readRepo(smokeFile);

  const xpub = requireMatch(
    smoke,
    keyPatterns[chain],
    `${chain} account extended public key in ${smokeFile}`
  )[1];
  const address = requireMatch(
    smoke,
    addressPatterns[chain],
    `${chain} index-${index} address in ${smokeFile}`,
    index
  )[1];

  return { xpub, address };
}

function derive(chain, index, xpub) {
  const result = spawnSync(
    process.execPath,
    ['tools/hdwallet-gen/derive.js', chain, String(index)],
    {
      cwd: repoRoot,
      input: xpub + '\n',
      encoding: 'utf8',
    }
  );

  assert.equal(
    result.status,
    0,
    `${chain} index ${index} derivation failed: ${result.error?.message || result.stderr}`
  );
  return result.stdout.trim();
}

describe('chain fixtures', () => {
  test('btc index 0 matches the published fixture', () => {
    const { xpub, address } = loadFixture('btc', 0);
    assert.equal(derive('btc', 0, xpub), address);
  });

  test('btc index 1 matches the published fixture', () => {
    const { xpub, address } = loadFixture('btc', 1);
    assert.equal(derive('btc', 1, xpub), address);
  });

  test('eth index 0 matches the published fixture', () => {
    const { xpub, address } = loadFixture('eth', 0);
    assert.equal(derive('eth', 0, xpub), address);
  });

  test('eth index 1 matches the published fixture', () => {
    const { xpub, address } = loadFixture('eth', 1);
    assert.equal(derive('eth', 1, xpub), address);
  });

  test('trx index 0 matches the published fixture', () => {
    const { xpub, address } = loadFixture('trx', 0);
    assert.equal(derive('trx', 0, xpub), address);
  });

  test('trx index 1 matches the published fixture', () => {
    const { xpub, address } = loadFixture('trx', 1);
    assert.equal(derive('trx', 1, xpub), address);
  });

  test('derivation paths match the documented policy', () => {
    const source = readRepo('tools/hdwallet-gen/derive.js');
    // Since T14 (M-41) the paths are branch-templated, not literals:
    // branch 0 instantiates to the documented receiving paths
    // (m/84'/0'/0'/0/i, m/44'/60'/0'/0/i, m/44'/195'/0'/0/i) and
    // branch 1 to the change path. The six fixture tests above prove
    // the branch-0 instantiation by deriving the published addresses.
    for (const template of [
      "m/84'/0'/0'/${branch}/${i}",
      "m/44'/60'/0'/${branch}/${i}",
      "m/44'/195'/0'/${branch}/${i}",
      "m/84'/0'/0'/1/${i}",
    ]) {
      assert.ok(source.includes(template), `Missing documented derivation path template ${template}`);
    }
  });

  test('ton fixture has the documented form', () => {
    // TON derivation is verified separately in the wallet test report, not by this test.
    const guideFile = 'docs/mainnet/MAINNET-GUIDE.md';
    const guide = readRepo(guideFile);
    const nonBounceable = requireMatch(
      guide,
      /UQ[A-Za-z0-9_-]{46}/,
      `TON non-bounceable address in ${guideFile}`
    )[0];
    assert.ok(guide.includes('V4 R2'), `Missing TON wallet version V4 R2 in ${guideFile}`);
    assert.ok(guide.includes('698983191'), `Missing TON wallet ID 698983191 in ${guideFile}`);
    assert.ok(nonBounceable.startsWith('UQ'));
    assert.equal(nonBounceable.length, 48);
    // The bounceable form is documented in the guides but is not
    // re-verified here (it does not appear in Doc 4).
  });
});
