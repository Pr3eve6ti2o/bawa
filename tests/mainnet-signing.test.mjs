// T35 mainnet local-signing tests (T1–T14, preflight spec section 4).
//
// All fixtures use deterministic, temporary, unfunded test keys held in
// memory only (private key = 32 bytes with a small integer in the last
// byte). No key is ever written to disk, printed, or logged. The keys
// are test-only and must never be funded.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { buildBtcP2wpkhUnsignedTx, buildEth1559UnsignedTx, buildTonV4R2UnsignedTransfer, buildTronMainnetUnsignedTransfer } from '../tools/mainnet-tx/unsigned-tx.mjs';
import { containsSecret, guardedLog, redactText } from '../tools/mainnet-guards/mainnet-guards.mjs';
import {
  assertNoNetworkCapability,
  bigIntToMinimalBytes,
  buildEvidenceRecord,
  bytesToHex,
  decodeBech32P2wpkh,
  encodeBech32,
  hash160,
  hexToBytes,
  loadWalletCore,
  parseBtcSignedTx,
  parseEthSignedTx,
  parseTonBoc,
  PreflightError,
  privateKeyToPublicKey,
  publicKeyToEthAddress,
  publicKeyToTronAddress,
  rlpEncode,
  runPreflight,
  signBtc,
  signEth,
  signTon,
  signTron,
  tonHashToFriendlyAddress,
  tronRefBlockHash,
  tronBlockHeaderForRefBlockId,
  verifyBtc,
  verifyEth,
  verifyTon,
  verifyTron,
} from '../tools/mainnet-signing/local-signing.mjs';
import * as localSigning from '../tools/mainnet-signing/local-signing.mjs';

function priv(n) {
  const b = Buffer.alloc(32);
  b[31] = n;
  return b;
}

const tmpIsolationDir = mkdtempSync(join(tmpdir(), 't35-isolation-'));
function isolation(overrides = {}) {
  return {
    dir: tmpIsolationDir,
    assertIsolated: () => true,
    credentialKind: 'temporary-unfunded',
    ...overrides,
  };
}

// --- Fixture keys and addresses (derived with the module's own helpers) ---
const btcPub0 = privateKeyToPublicKey(priv(1), true);
const btcPub1 = privateKeyToPublicKey(priv(2), true);
const btcPub2 = privateKeyToPublicKey(priv(3), true);
const BTC_A0 = encodeBech32('bc', hash160(btcPub0));
const BTC_A1 = encodeBech32('bc', hash160(btcPub1));
const BTC_AC = encodeBech32('bc', hash160(btcPub2));
const BTC_SCRIPT0 = `0014${bytesToHex(hash160(btcPub0))}`;
const BTC_TXID = Buffer.from([...Array(32).keys()]).toString('hex');
const ETH_SENDER = publicKeyToEthAddress(privateKeyToPublicKey(priv(1), false));
const ETH_DEAD = '0x000000000000000000000000000000000000dEaD';
const TRON_OWNER = publicKeyToTronAddress(privateKeyToPublicKey(priv(1), false));
const TRON_TO = publicKeyToTronAddress(privateKeyToPublicKey(priv(2), false));
const TRON_REF_BLOCK_ID = '11'.repeat(32);
const { core, TW } = await loadWalletCore();
const tonEdPub = core.PrivateKey.createWithData(priv(1)).getPublicKeyEd25519();
const TON_PUB_HEX = bytesToHex(tonEdPub.data());
const TON_SENDER = tonHashToFriendlyAddress(core.AnyAddress.createWithPublicKey(tonEdPub, core.CoinType.ton).data());
// The TON destination is key 2's derived address, NOT the all-zero
// address UQAA...JKZ used by the earlier fixture: the wallet-core
// signer encodes an all-zero destination hash as addr_none (the
// transfer then has no destination), so the all-zero fixture cannot
// be signed. Any non-zero valid mainnet address works.
const tonEdPub2 = core.PrivateKey.createWithData(priv(2)).getPublicKeyEd25519();
const TON_DEST = tonHashToFriendlyAddress(core.AnyAddress.createWithPublicKey(tonEdPub2, core.CoinType.ton).data());

function btcUnsigned(changeAddress = BTC_AC) {
  return buildBtcP2wpkhUnsignedTx({
    utxos: [{ txid: BTC_TXID, vout: 0, valueSats: '30000', scriptPubKey: BTC_SCRIPT0 }],
    toAddress: BTC_A1,
    amountSats: '20000',
    feeSats: '200',
    maxFeeSats: '200',
    changeAddress,
  });
}

function btcApproval(overrides = {}) {
  return {
    network: 'bitcoin-mainnet',
    toAddress: BTC_A1,
    amountSats: '20000',
    maxFeeSats: '200',
    changeAddress: BTC_AC,
    byteFee: 1,
    changePubkeyHex: bytesToHex(btcPub2),
    ...overrides,
  };
}

function ethUnsigned() {
  return buildEth1559UnsignedTx({
    chainId: 1,
    nonce: '0',
    to: ETH_DEAD,
    valueWei: '1000000000000000',
    gasLimit: '21000',
    maxPriorityFeePerGasWei: '1000000000',
    maxFeePerGasWei: '20000000000',
    data: '0x',
  });
}

function ethApproval(overrides = {}) {
  return {
    network: 'ethereum-mainnet',
    chainId: 1,
    to: ETH_DEAD,
    valueWei: '1000000000000000',
    gasLimit: '21000',
    maxFeePerGasWei: '20000000000',
    maxPriorityFeePerGasWei: '1000000000',
    maxFeeWei: '420000000000000',
    nonce: '0',
    expectedSender: ETH_SENDER,
    data: '0x',
    ...overrides,
  };
}

function tronUnsigned() {
  return buildTronMainnetUnsignedTransfer({
    ownerAddress: TRON_OWNER,
    toAddress: TRON_TO,
    amountSun: '1000000',
    refBlockId: TRON_REF_BLOCK_ID,
    timestampMs: '1700000000000',
    expirationMs: '1700003600000',
    feeLimitSun: '0',
  });
}

function tronApproval(overrides = {}) {
  return {
    network: 'tron-mainnet',
    ownerAddress: TRON_OWNER,
    toAddress: TRON_TO,
    amountSun: '1000000',
    maxFeeSun: '0',
    refBlockId: TRON_REF_BLOCK_ID,
    timestampMs: '1700000000000',
    expirationMs: '1700003600000',
    ...overrides,
  };
}

function tonUnsigned() {
  return buildTonV4R2UnsignedTransfer({
    sender: TON_SENDER,
    destination: TON_DEST,
    amountNano: '50000000',
    seqno: 1,
    validUntil: 2000000000,
  });
}

function tonApproval(overrides = {}) {
  return {
    network: 'ton-mainnet',
    sender: TON_SENDER,
    destination: TON_DEST,
    amountNano: '50000000',
    seqno: 1,
    validUntil: 2000000000,
    mode: 3,
    publicKeyHex: TON_PUB_HEX,
    ...overrides,
  };
}

function assertPreflightThrows(fn, checkId) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof PreflightError, `expected a PreflightError, got ${caught}`);
  assert.equal(caught.checkId, checkId, `expected check ${checkId}, got ${caught.checkId}: ${caught.message}`);
}

describe('T35 mainnet local signing', () => {
  test('T1 BTC happy path: fixture signs, verifies, preflight 11/11 pass', async () => {
    const unsigned = btcUnsigned();
    const approval = btcApproval();
    const signed = await signBtc(unsigned, approval, priv(1), isolation());
    assert.equal(signed.network, 'bitcoin-mainnet');
    assert.equal(signed.feeSats, '141');
    assert.equal(signed.outputs[0].valueSats, '20000');
    assert.equal(signed.outputs[1].valueSats, '9859');
    assert.equal(signed.outputs[1].address, BTC_AC);
    assert.equal(signed.verification.valid, true);
    assert.equal(signed.verification.method, 'bip143-ecdsa');
    // Documented deviation: wallet-core emits version 1, the T33
    // unsigned artifact is version 2; the signature is valid for the
    // signed transaction as-is.
    assert.equal(signed.verification.version, 1);
    assert.equal(signed.verification.versionDeviation, true);
    assert.equal(signed.preflight.passed, true);
    assert.equal(signed.preflight.checks.length, 11);
    assert.ok(signed.preflight.checks.every((c) => c.pass === true));
    const again = verifyBtc(signed, unsigned, approval);
    assert.equal(again.valid, true);
    const parsed = parseBtcSignedTx(signed.signedTxHex);
    // Wallet-core emits version 1 (see the versionDeviation note
    // above); the T33 unsigned artifact is version 2.
    assert.equal(parsed.version, 1);
    assert.equal(parsed.locktime, 0);
    assert.equal(parsed.witnesses.length, 1);
    assert.equal(parsed.witnesses[0].length, 2);
  });

  test('T2 ETH happy path: fixture signs, ecrecover matches expected sender, preflight 11/11 pass', async () => {
    const unsigned = ethUnsigned();
    const approval = ethApproval();
    const signed = await signEth(unsigned, approval, priv(1), isolation());
    assert.equal(signed.network, 'ethereum-mainnet');
    assert.ok(signed.encoded.startsWith('0x02'));
    assert.equal(signed.v, 0);
    assert.equal(signed.verification.valid, true);
    assert.equal(signed.verification.method, 'ecrecover');
    assert.equal(signed.verification.sender.toLowerCase(), ETH_SENDER.toLowerCase());
    assert.equal(signed.preflight.passed, true);
    assert.equal(signed.preflight.checks.length, 11);
    const again = verifyEth(signed, unsigned, approval);
    assert.equal(again.valid, true);
    assert.equal(again.sender.toLowerCase(), ETH_SENDER.toLowerCase());
    const parsed = parseEthSignedTx(signed.encoded);
    assert.equal(parsed.chainId, 1n);
    assert.equal(parsed.amount, 1000000000000000n);
    assert.equal(parsed.gasLimit, 21000n);
  });

  test('T3 TRON happy path: fixture signs, recovery matches owner, txID recompute matches, preflight 11/11 pass', async () => {
    const unsigned = tronUnsigned();
    const approval = tronApproval();
    const signed = await signTron(unsigned, approval, priv(1), isolation());
    assert.equal(signed.network, 'tron-mainnet');
    assert.equal(signed.signature.length, 130);
    assert.equal(signed.verification.valid, true);
    assert.equal(signed.verification.method, 'secp256k1-recovery');
    assert.equal(signed.verification.ownerAddress, TRON_OWNER);
    assert.equal(signed.verification.toAddress, TRON_TO);
    assert.equal(signed.verification.refBlockBytes, '1111');
    // Signer-derived ref_block_hash: SHA-256(BlockHeader) bytes 8-15.
    const expectedHash = bytesToHex(tronRefBlockHash(tronBlockHeaderForRefBlockId(TRON_REF_BLOCK_ID), TW));
    assert.equal(signed.verification.refBlockHash, expectedHash);
    // Documented deviation: the signed ref_block_hash differs from the
    // T33 fixture value (raw refBlockId bytes 8-15).
    assert.equal(signed.verification.refBlockHashDeviation, true);
    assert.notEqual(signed.verification.refBlockHash, '1111111111111111');
    assert.equal(signed.preflight.passed, true);
    assert.equal(signed.preflight.checks.length, 11);
    const again = verifyTron(signed, unsigned, approval);
    assert.equal(again.valid, true);
    assert.equal(again.txID, signed.txID);
  });

  test('T4 TON happy path: fixture signs, Ed25519 verifies, normalised hash matches T33 signing hash, preflight 11/11 pass', async () => {
    const unsigned = tonUnsigned();
    const approval = tonApproval();
    const signed = await signTon(unsigned, approval, priv(1), isolation());
    assert.equal(signed.network, 'ton-mainnet');
    assert.ok(signed.signedBocBase64.startsWith('te6'));
    assert.equal(signed.verification.valid, true);
    assert.equal(signed.verification.method, 'ed25519');
    // The signer attaches an empty body cell (hasBody 1) where T33
    // stores no body (hasBody 0), so the signer's own signing hash is
    // not the T33 hash. The Ed25519 signature verifies against the
    // signer's hash, and the NORMALISED hash (empty-body encoding
    // removed) equals the T33 signing hash exactly.
    assert.equal(signed.verification.signingHashDeviation, true);
    assert.equal(signed.verification.normalizedSigningHash, Buffer.from(unsigned.signingHashBase64, 'base64').toString('hex'));
    assert.equal(signed.verification.sender, TON_SENDER);
    assert.equal(signed.preflight.passed, true);
    assert.equal(signed.preflight.checks.length, 11);
    const again = verifyTon(signed, unsigned, approval);
    assert.equal(again.valid, true);
  });

  test('T5 tampered payload after approval: tampering fails preflight, no signed artifact returned', async () => {
    const unsigned = ethUnsigned();
    const approval = ethApproval();
    const signed = await signEth(unsigned, approval, priv(1), isolation());
    const fields = parseEthSignedTx(signed.encoded);
    const retamper = (mutate) => {
      const list = [
        bigIntToMinimalBytes(fields.chainId),
        bigIntToMinimalBytes(fields.nonce),
        bigIntToMinimalBytes(fields.maxPriorityFeePerGas),
        bigIntToMinimalBytes(fields.maxFeePerGas),
        bigIntToMinimalBytes(fields.gasLimit),
        fields.to,
        bigIntToMinimalBytes(fields.amount),
        fields.data,
        [],
        bigIntToMinimalBytes(fields.yParity),
        bigIntToMinimalBytes(fields.r),
        bigIntToMinimalBytes(fields.s),
      ];
      mutate(list);
      return { ...signed, encoded: `0x02${rlpEncode(list).toString('hex')}` };
    };
    // Amount tampering is caught even earlier, by check 4 (AMOUNT).
    assertPreflightThrows(
      () => runPreflight('ethereum-mainnet', retamper((list) => { list[6] = bigIntToMinimalBytes(fields.amount + 1n); }), unsigned, approval, isolation()),
      4,
    );
    // An access-list entry is not covered by checks 2-8, so it reaches
    // check 9 (SIGNED-MATCHES-APPROVED), which re-decodes the envelope
    // and compares every field with the approved request.
    assertPreflightThrows(
      () => runPreflight('ethereum-mainnet', retamper((list) => { list[8] = [[hexToBytes('000000000000000000000000000000000000dead', 'eth dead'), []]]; }), unsigned, approval, isolation()),
      9,
    );
  });

  test('T6 wrong chainId: ETH approval chainId 1 vs signed envelope chainId 11155111 fails check 2', async () => {
    const unsigned = ethUnsigned();
    const approval = ethApproval();
    const input = TW.Ethereum.Proto.SigningInput.encode({
      chainId: bigIntToMinimalBytes(11155111n),
      nonce: bigIntToMinimalBytes(0n),
      txMode: 1,
      gasLimit: bigIntToMinimalBytes(21000n),
      maxInclusionFeePerGas: bigIntToMinimalBytes(1000000000n),
      maxFeePerGas: bigIntToMinimalBytes(20000000000n),
      toAddress: ETH_DEAD,
      privateKey: priv(1),
      transaction: {
        transfer: { amount: bigIntToMinimalBytes(1000000000000000n), data: new Uint8Array([]) },
      },
    }).finish();
    const out = TW.Ethereum.Proto.SigningOutput.decode(core.AnySigner.sign(input, core.CoinType.ethereum));
    assert.equal(out.error, 0);
    const sepoliaSigned = {
      network: 'ethereum-mainnet',
      encoded: `0x${Buffer.from(out.encoded).toString('hex')}`,
      v: Number(out.v?.[0] ?? 0),
      r: bytesToHex(out.r ?? new Uint8Array([])),
      s: bytesToHex(out.s ?? new Uint8Array([])),
    };
    assert.equal(parseEthSignedTx(sepoliaSigned.encoded).chainId, 11155111n);
    assertPreflightThrows(
      () => runPreflight('ethereum-mainnet', sepoliaSigned, unsigned, approval, isolation()),
      2,
    );
  });

  test('T7 wrong network: BTC testnet address in approval fails check 2', async () => {
    const unsigned = btcUnsigned();
    const signed = await signBtc(unsigned, btcApproval(), priv(1), isolation());
    const testnetAddress = encodeBech32('tb', hash160(btcPub1));
    assertPreflightThrows(
      () => runPreflight('bitcoin-mainnet', signed, unsigned, btcApproval({ toAddress: testnetAddress }), isolation()),
      2,
    );
    await assert.rejects(
      () => signBtc(unsigned, btcApproval({ toAddress: testnetAddress }), priv(1), isolation()),
      /mainnet hrp bc/,
    );
  });

  test('T8 fee overrun: BTC fee above approved maxFee fails check 5', async () => {
    const unsigned = btcUnsigned();
    await assert.rejects(
      () => signBtc(unsigned, btcApproval({ maxFeeSats: '100' }), priv(1), isolation()),
      (error) => error instanceof PreflightError && error.checkId === 5,
    );
  });

  test('T9 unreviewed change: BTC change address not the approved one fails check 6', async () => {
    const unsigned = btcUnsigned(BTC_A1);
    await assert.rejects(
      () => signBtc(unsigned, btcApproval(), priv(1), isolation()),
      (error) => error instanceof PreflightError && error.checkId === 6,
    );
  });

  test('T10 broadcast-attempt refusal: no broadcast entry, no network tokens in module source', () => {
    assert.equal(localSigning.broadcast, undefined);
    assert.equal(localSigning.sendRawTransaction, undefined);
    assert.equal(localSigning.sendTransaction, undefined);
    assert.equal(localSigning.submit, undefined);
    assert.equal(localSigning.publish, undefined);
    assert.equal(assertNoNetworkCapability(), true);
    const modulePath = new URL('../tools/mainnet-signing/local-signing.mjs', import.meta.url);
    const source = readFileSync(modulePath, 'utf8');
    assert.ok(!/^\s*import\s+[^;]*from\s+['"]node:(?:https?|net|dgram)['"]/m.test(source), 'module has a network import');
    assert.ok(!/require\(\s*['"]node:(?:https?|net|dgram)['"]\s*\)/.test(source), 'module has a network require');
    assert.ok(!/\bfetch\s*\(/.test(source), 'module calls fetch');
    assert.ok(!/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+(?:broadcast|sendRawTransaction|submit|publish)\b/.test(source), 'module defines a send function');
    assert.ok(!/export\s+(?:const|let|var|function)\s+(?:broadcast|sendRawTransaction|submit|publish)\b/.test(source), 'module exports a send entry');
  });

  test('T11 secret redaction: a log line with a planted key and mnemonic is redacted by T25 patterns', async () => {
    const keyHex = bytesToHex(priv(1));
    const words = `${Array(11).fill('abandon').join(' ')} about`;
    const line = `privateKey: '${keyHex}' mnemonic: ${words}`;
    assert.equal(containsSecret(line), true);
    const redacted = redactText(line);
    assert.ok(!redacted.includes(keyHex), 'redacted line still contains the key');
    assert.ok(!redacted.includes('abandon'), 'redacted line still contains the mnemonic');
    assert.ok(redacted.includes('[REDACTED]'));
    let captured = '';
    const count = guardedLog((text) => {
      captured = text;
    }, line);
    assert.ok(count > 0);
    assert.ok(!captured.includes(keyHex));
    const unsigned = btcUnsigned();
    const signed = await signBtc(unsigned, btcApproval(), priv(1), isolation());
    const record = buildEvidenceRecord('bitcoin-mainnet', unsigned, signed, btcApproval(), signed.preflight, signed.verification);
    assert.equal(containsSecret(JSON.stringify(record)), false);
    assert.equal(record.checks.length, 11);
  });

  test('T12 isolation gate: signing without an isolation handle, or with a revoked/expired handle, throws', async () => {
    const unsigned = btcUnsigned();
    const approval = btcApproval();
    await assert.rejects(() => signBtc(unsigned, approval, priv(1), undefined), /Isolation required/);
    await assert.rejects(
      () => signBtc(unsigned, approval, priv(1), isolation({ revoked: true })),
      /revoked/,
    );
    await assert.rejects(
      () => signBtc(unsigned, approval, priv(1), isolation({ assertIsolated: () => false })),
      /did not confirm isolation/,
    );
    await assert.rejects(
      () => signBtc(unsigned, approval, priv(1), isolation({ expiresAt: Date.now() - 1000 })),
      /expired/,
    );
  });

  test('T13 negative verification: corrupt one signature byte per chain, check 10 fails', async () => {
    const flipHexChar = (hex, index) => {
      const chars = hex.split('');
      chars[index] = chars[index] === '0' ? '1' : '0';
      return chars.join('');
    };
    // BTC: flip one hex digit inside the witness DER signature.
    const btcUnsignedFixture = btcUnsigned();
    const btcSigned = await signBtc(btcUnsignedFixture, btcApproval(), priv(1), isolation());
    const btcParsed = parseBtcSignedTx(btcSigned.signedTxHex);
    const sigHex = bytesToHex(btcParsed.witnesses[0][0]);
    const badBtcHex = btcSigned.signedTxHex.replace(sigHex, flipHexChar(sigHex, 10));
    assert.equal(verifyBtc({ ...btcSigned, signedTxHex: badBtcHex }, btcUnsignedFixture, btcApproval()).valid, false);
    assertPreflightThrows(
      () => runPreflight('bitcoin-mainnet', { ...btcSigned, signedTxHex: badBtcHex }, btcUnsignedFixture, btcApproval(), isolation()),
      10,
    );
    // ETH: flip one hex digit inside s.
    const ethSigned = await signEth(ethUnsigned(), ethApproval(), priv(1), isolation());
    const ethFields = parseEthSignedTx(ethSigned.encoded);
    const badS = flipHexChar(bytesToHex(bigIntToMinimalBytes(ethFields.s)), 0);
    const badEthList = [
      bigIntToMinimalBytes(ethFields.chainId),
      bigIntToMinimalBytes(ethFields.nonce),
      bigIntToMinimalBytes(ethFields.maxPriorityFeePerGas),
      bigIntToMinimalBytes(ethFields.maxFeePerGas),
      bigIntToMinimalBytes(ethFields.gasLimit),
      ethFields.to,
      bigIntToMinimalBytes(ethFields.amount),
      ethFields.data,
      [],
      bigIntToMinimalBytes(ethFields.yParity),
      bigIntToMinimalBytes(ethFields.r),
      hexToBytes(badS, 'eth s'),
    ];
    const badEth = { ...ethSigned, encoded: `0x02${rlpEncode(badEthList).toString('hex')}` };
    assert.equal(verifyEth(badEth, ethUnsigned(), ethApproval()).valid, false);
    assertPreflightThrows(
      () => runPreflight('ethereum-mainnet', badEth, ethUnsigned(), ethApproval(), isolation()),
      10,
    );
    // TRON: flip one hex digit inside the 65-byte signature.
    const tronSigned = await signTron(tronUnsigned(), tronApproval(), priv(1), isolation());
    const badTronHex = tronSigned.signedTransactionHex.replace(tronSigned.signature, flipHexChar(tronSigned.signature, 10));
    assert.equal(
      verifyTron({ ...tronSigned, signedTransactionHex: badTronHex }, tronUnsigned(), tronApproval()).valid,
      false,
    );
    // TON: flip one byte of the signed BOC at the body cell data offset.
    const tonSigned = await signTon(tonUnsigned(), tonApproval(), priv(1), isolation());
    const tonBytes = Buffer.from(tonSigned.signedBocBase64, 'base64');
    const tonParsed = parseTonBoc(tonSigned.signedBocBase64);
    const envelope = tonParsed.cells[tonParsed.rootIndex];
    const bodyCell = tonParsed.cells[envelope.refs[envelope.refs.length - 1]];
    const badTonBytes = Buffer.from(tonBytes);
    badTonBytes[bodyCell.dataByteOffset] ^= 0x01;
    const badTon = { ...tonSigned, signedBocBase64: badTonBytes.toString('base64') };
    assert.equal(verifyTon(badTon, tonUnsigned(), tonApproval()).valid, false);
  });

  test('T14 determinism: same fixture + same key signs to identical bytes twice; different key fails the sender check', async () => {
    const unsigned = btcUnsigned();
    const approval = btcApproval();
    const first = await signBtc(unsigned, approval, priv(1), isolation());
    const second = await signBtc(unsigned, approval, priv(1), isolation());
    assert.equal(first.signedTxHex, second.signedTxHex);
    assert.equal(first.txid, second.txid);
    await assert.rejects(
      () => signBtc(unsigned, approval, priv(2), isolation()),
      (error) => error instanceof PreflightError && error.checkId === 10,
    );
  });
});

describe('T35 fixture sanity', () => {
  test('derived fixture addresses match the first-hand probe values', () => {
    assert.equal(BTC_A0, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    assert.equal(BTC_A1, 'bc1qq6hag67dl53wl99vzg42z8eyzfz2xlkvxechjp');
    assert.equal(BTC_AC, 'bc1q0ht9tyks4vh7p5p904t340cr9nvahy7u3re7zg');
    assert.equal(ETH_SENDER, '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
    assert.equal(TRON_OWNER, 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC');
    assert.equal(TRON_TO, 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K');
    assert.equal(TON_SENDER, 'UQAkxuybaeBflbgYW3vgQvcFgyAQVcLtXZwdrpeLNqzZ0xDZ');
    assert.equal(decodeBech32P2wpkh(BTC_A0).toString('hex'), '751e76e8199196d454941c45d1b3a323f1433bd6');
  });
});
