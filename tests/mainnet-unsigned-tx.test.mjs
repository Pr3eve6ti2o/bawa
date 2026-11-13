import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildBtcP2wpkhUnsignedTx,
  buildEthLegacyUnsignedTx,
  buildEth1559UnsignedTx,
  buildTronMainnetUnsignedTransfer,
  buildTonV4R2UnsignedTransfer,
  broadcastTransaction,
  sendTransaction,
  transferToken,
  callContract,
  approveAllowance,
  signTransaction,
} from '../tools/mainnet-tx/unsigned-tx.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const modulePath = resolve(repoRoot, 'tools/mainnet-tx/unsigned-tx.mjs');

// Public fixtures only (15-word ripple test vector, MAINNET-GUIDE §7).
// The mnemonic is public: NEVER fund any of these addresses.
const BTC_FROM = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';
const BTC_TO = 'bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za';
const ETH_TO = '0xD6c3112a8Db4991a7359018F15e501dfEE316d59';
const TRX_FROM = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';
const TRX_TO = 'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B';
const TON_ADDR = 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn';
// BTC_FROM witness program, decoded independently below; its scriptPubKey.
const BTC_FROM_SCRIPT = '00140c03e507f38033aca9ac5c32b32dce56051d097b';
const BTC_TO_SCRIPT = '0014df96d8a361835b85d4feed2ae013fbfbd6706a61';

const DISABLED_MESSAGE = 'Disabled operation: offline unsigned native transactions only.';

const sha256 = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest();

// --- Independent decoders (test-local; never the implementation) ---

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Program(address) {
  const lower = address.toLowerCase();
  const sep = lower.lastIndexOf('1');
  const data = [...lower.slice(sep + 1)].map((c) => BECH32_CHARSET.indexOf(c));
  const hrp = lower.slice(0, sep);
  const expanded = [];
  for (const c of hrp) expanded.push(c.charCodeAt(0) >> 5);
  expanded.push(0);
  for (const c of hrp) expanded.push(c.charCodeAt(0) & 31);
  let chk = 1;
  for (const v of [...expanded, ...data]) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= BECH32_GEN[i];
  }
  assert.equal(chk, 1, 'bech32 checksum');
  assert.equal(data[0], 0, 'witness version 0');
  let acc = 0;
  let bits = 0;
  const out = [];
  for (const v of data.slice(1, -6)) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  assert.equal(out.length, 20, '20-byte program');
  return Buffer.from(out);
}

function rlpDecode(buf, pos = 0) {
  const prefix = buf[pos];
  if (prefix < 0x80) return { value: buf.subarray(pos, pos + 1), next: pos + 1 };
  if (prefix < 0xb8) {
    const len = prefix - 0x80;
    return { value: buf.subarray(pos + 1, pos + 1 + len), next: pos + 1 + len };
  }
  if (prefix < 0xc0) {
    const lenOfLen = prefix - 0xb7;
    const len = Number(buf.subarray(pos + 1, pos + 1 + lenOfLen).reduce((a, b) => (a << 8n) | BigInt(b), 0n));
    return { value: buf.subarray(pos + 1 + lenOfLen, pos + 1 + lenOfLen + len), next: pos + 1 + lenOfLen + len };
  }
  if (prefix < 0xf8) {
    const len = prefix - 0xc0;
    let p = pos + 1;
    const items = [];
    while (p < pos + 1 + len) { const r = rlpDecode(buf, p); items.push(r.value); p = r.next; }
    return { value: items, next: pos + 1 + len };
  }
  const lenOfLen = prefix - 0xf7;
  const len = Number(buf.subarray(pos + 1, pos + 1 + lenOfLen).reduce((a, b) => (a << 8n) | BigInt(b), 0n));
  let p = pos + 1 + lenOfLen;
  const items = [];
  while (p < pos + 1 + lenOfLen + len) { const r = rlpDecode(buf, p); items.push(r.value); p = r.next; }
  return { value: items, next: pos + 1 + lenOfLen + len };
}

const bufToBig = (b) => (b.length === 0 ? 0n : BigInt(`0x${b.toString('hex')}`));

function protobufDecode(buf) {
  const fields = [];
  let p = 0;
  while (p < buf.length) {
    let tag = 0n;
    let shift = 0n;
    while (true) { const b = buf[p++]; tag |= BigInt(b & 0x7f) << shift; shift += 7n; if (!(b & 0x80)) break; }
    const field = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (wire === 0) {
      let v = 0n;
      shift = 0n;
      while (true) { const b = buf[p++]; v |= BigInt(b & 0x7f) << shift; shift += 7n; if (!(b & 0x80)) break; }
      fields.push({ field, wire, value: v });
    } else if (wire === 2) {
      let len = 0n;
      shift = 0n;
      while (true) { const b = buf[p++]; len |= BigInt(b & 0x7f) << shift; shift += 7n; if (!(b & 0x80)) break; }
      const bytes = buf.subarray(p, p + Number(len));
      p += Number(len);
      fields.push({ field, wire, value: bytes });
    } else {
      throw new Error(`unsupported wire type ${wire}`);
    }
  }
  return fields;
}

function crc16Xmodem(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc;
}

const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0x82f63b78 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32c(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC32C_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58CheckPayload(address) {
  let n = 0n;
  for (const ch of address) n = n * 58n + BigInt(BASE58_ALPHABET.indexOf(ch));
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  const minimal = Buffer.from(hex, 'hex');
  let leadingZeros = 0;
  for (const ch of address) { if (ch !== '1') break; leadingZeros += 1; }
  const decoded = Buffer.concat([Buffer.alloc(leadingZeros), minimal]);
  assert.equal(decoded.length, 25, 'TRON address decodes to 25 bytes');
  const payload = decoded.subarray(0, 21);
  assert.ok(decoded.subarray(21).equals(sha256(sha256(payload)).subarray(0, 4)), 'TRON checksum');
  return payload;
}

function btcInput() {
  return {
    utxos: [{ txid: '11'.repeat(32), vout: 0, valueSats: '100000', scriptPubKey: BTC_FROM_SCRIPT }],
    toAddress: BTC_TO,
    amountSats: '50000',
    feeSats: '1000',
    maxFeeSats: '2000',
    changeAddress: BTC_FROM,
  };
}

function ethLegacyInput() {
  return {
    chainId: 1, nonce: '9', to: ETH_TO, valueWei: '1000000000000000000',
    gasLimit: '21000', gasPriceWei: '20000000000', data: '0x',
  };
}

function eth1559Input() {
  return {
    chainId: 1, nonce: '3', to: ETH_TO, valueWei: '500', gasLimit: '21000',
    maxPriorityFeePerGasWei: '1000000000', maxFeePerGasWei: '30000000000', data: '0x',
  };
}

function tronInput() {
  return {
    ownerAddress: TRX_FROM,
    toAddress: TRX_TO,
    amountSun: '1000000',
    refBlockId: '0123456789abcdef'.repeat(4),
    timestampMs: '1790000000000',
    expirationMs: '1790000060000',
  };
}

function tonEqForm(uqAddress) {
  const bytes = Buffer.from(uqAddress, 'base64url');
  const out = Buffer.alloc(36);
  out[0] = 17;
  out[1] = 0;
  bytes.copy(out, 2, 2, 34);
  out.writeUInt16BE(crc16Xmodem(out.subarray(0, 34)), 34);
  return out.toString('base64url');
}

function tonInput() {
  return {
    sender: TON_ADDR,
    destination: tonEqForm(TON_ADDR),
    amountNano: '1000000000',
    seqno: 5,
    validUntil: 1790000000,
  };
}

describe('golden vectors (frozen; verified first-hand with independent decoders)', () => {
  test('btc unsigned hex and parsed fields', () => {
    const btc = buildBtcP2wpkhUnsignedTx(btcInput());
    assert.equal(
      btc.unsignedTxHex,
      '020000000111111111111111111111111111111111111111111111111111111111111111110000000000ffffffff0250c3000000000000160014df96d8a361835b85d4feed2ae013fbfbd6706a6168bf0000000000001600140c03e507f38033aca9ac5c32b32dce56051d097b00000000',
    );
    assert.equal(btc.totalInputSats, '100000');
    assert.equal(btc.feeSats, '1000');
    assert.equal(btc.changeSats, '49000');
    assert.equal(btc.outputs[0].scriptPubKey, BTC_TO_SCRIPT);
    assert.equal(btc.outputs[1].scriptPubKey, BTC_FROM_SCRIPT);
    const raw = Buffer.from(btc.unsignedTxHex, 'hex');
    assert.equal(raw.readInt32LE(0), 2);
    assert.equal(raw[4], 1);
    assert.equal(Buffer.from(raw.subarray(5, 37)).reverse().toString('hex'), '11'.repeat(32));
    assert.equal(raw.readUInt32LE(37), 0);
    assert.equal(raw[41], 0);
    assert.equal(raw.readUInt32LE(42), 4294967295);
    assert.equal(raw[46], 2);
    assert.equal(raw.readBigUInt64LE(47), 50000n);
    assert.equal(raw.readUInt32LE(raw.length - 4), 0);
  });

  test('eth legacy signing payload and RLP decode', () => {
    const leg = buildEthLegacyUnsignedTx(ethLegacyInput());
    assert.equal(leg.chainId, 1);
    assert.equal(leg.type, 0);
    assert.equal(
      leg.signingPayloadHex,
      '0xec098504a817c80082520894d6c3112a8db4991a7359018f15e501dfee316d59880de0b6b3a764000080018080',
    );
    const raw = Buffer.from(leg.signingPayloadHex.slice(2), 'hex');
    const { value: list, next } = rlpDecode(raw);
    assert.equal(next, raw.length);
    assert.equal(list.length, 9);
    assert.equal(bufToBig(list[0]), 9n);
    assert.equal(bufToBig(list[1]), 20000000000n);
    assert.equal(bufToBig(list[2]), 21000n);
    assert.equal(list[3].toString('hex'), ETH_TO.slice(2).toLowerCase());
    assert.equal(bufToBig(list[4]), 1000000000000000000n);
    assert.equal(list[5].length, 0);
    assert.equal(bufToBig(list[6]), 1n);
    assert.equal(list[7].length, 0);
    assert.equal(list[8].length, 0);
  });

  test('eth 1559 signing payload and RLP decode', () => {
    const tx = buildEth1559UnsignedTx(eth1559Input());
    assert.equal(tx.chainId, 1);
    assert.equal(tx.type, 2);
    assert.equal(
      tx.signingPayloadHex,
      '0x02ea0103843b9aca008506fc23ac0082520894d6c3112a8db4991a7359018f15e501dfee316d598201f480c0',
    );
    const raw = Buffer.from(tx.signingPayloadHex.slice(2), 'hex');
    assert.equal(raw[0], 0x02);
    const { value: list, next } = rlpDecode(raw, 1);
    assert.equal(next, raw.length);
    assert.equal(list.length, 9);
    assert.equal(bufToBig(list[0]), 1n);
    assert.equal(bufToBig(list[1]), 3n);
    assert.equal(bufToBig(list[2]), 1000000000n);
    assert.equal(bufToBig(list[3]), 30000000000n);
    assert.equal(bufToBig(list[4]), 21000n);
    assert.equal(list[5].toString('hex'), ETH_TO.slice(2).toLowerCase());
    assert.equal(bufToBig(list[6]), 500n);
    assert.equal(list[7].length, 0);
    assert.deepEqual(list[8], []);
  });

  test('tron raw data, txid and protobuf decode', () => {
    const trx = buildTronMainnetUnsignedTransfer(tronInput());
    assert.equal(trx.network, 'tron-mainnet');
    assert.equal(
      trx.rawDataHex,
      '0a02cdef22080123456789abcdef40e0acc5a28c345a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a154159b2f14f54513afa5b324aabd5c70362e7aa0836121541e59e20e6d2e1a3578498594574b0e9aa792261f218c0843d7080d8c1a28c34',
    );
    assert.equal(trx.txID, '8e27a7327623ced1c59b654b70c8f2be422a4f149fe27146747d532fab16745f');
    const raw = Buffer.from(trx.rawDataHex, 'hex');
    assert.equal(trx.txID, sha256(raw).toString('hex'));
    const outer = protobufDecode(Buffer.from(trx.unsignedTransactionHex, 'hex'));
    assert.equal(outer.length, 1);
    assert.equal(outer[0].field, 1);
    assert.ok(outer[0].value.equals(raw));
    const fields = protobufDecode(raw);
    const get = (n) => fields.find((x) => x.field === n);
    const refBlockId = Buffer.from('0123456789abcdef'.repeat(4), 'hex');
    assert.ok(get(1).value.equals(refBlockId.subarray(6, 8)));
    assert.ok(get(4).value.equals(refBlockId.subarray(8, 16)));
    assert.equal(get(8).value, 1790000060000n);
    assert.equal(get(14).value, 1790000000000n);
    assert.equal(get(18), undefined);
    const contract = protobufDecode(get(11).value);
    assert.equal(contract.find((x) => x.field === 1).value, 1n);
    const any = protobufDecode(contract.find((x) => x.field === 2).value);
    assert.equal(any.find((x) => x.field === 1).value.toString(), 'type.googleapis.com/protocol.TransferContract');
    const transfer = protobufDecode(any.find((x) => x.field === 2).value);
    assert.equal(transfer.find((x) => x.field === 3).value, 1000000n);
    assert.equal(transfer.find((x) => x.field === 1).value.length, 21);
    assert.equal(transfer.find((x) => x.field === 1).value[0], 65);
  });

  test('ton signing hash and unsigned BoC', () => {
    const ton = buildTonV4R2UnsignedTransfer(tonInput());
    assert.equal(ton.kind, 'ton-v4r2-native-unsigned');
    assert.equal(ton.signingHashBase64, 'JTT2ozh28ytwaw3G873t63D1ljjEUKJrmGTNL/2W5bo=');
    assert.equal(
      ton.unsignedBocBase64,
      'te6cckEBAwEArQAJRYgBdwM3jKuhYswngNZsx8bttQAuJMPm34IM0TPRvTGc4B4MAQGcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmpoxdqsTuAAAAABQADAgBoQgBdwM3jKuhYswngNZsx8bttQAuJMPm34IM0TPRvTGc4B6Hc1lAAAAAAAAAAAAAAAAAAANEbwlE=',
    );
    const boc = Buffer.from(ton.unsignedBocBase64, 'base64');
    assert.deepEqual([...boc.subarray(0, 4)], [0xb5, 0xee, 0x9c, 0x72]);
    assert.equal(boc[4], 0x41);
    const storedCrc = boc.readUInt32LE(boc.length - 4);
    assert.equal(crc32c(boc.subarray(0, boc.length - 4)), storedCrc);
    const signing = Buffer.from(ton.signingBocBase64, 'base64');
    assert.deepEqual([...signing.subarray(0, 4)], [0xb5, 0xee, 0x9c, 0x72]);
    assert.equal(crc32c(signing.subarray(0, signing.length - 4)), signing.readUInt32LE(signing.length - 4));
    assert.equal(Buffer.from(ton.signingHashBase64, 'base64').length, 32);
  });

  test('builders are deterministic and do not mutate inputs', () => {
    const a = buildEthLegacyUnsignedTx(ethLegacyInput());
    const b = buildEthLegacyUnsignedTx(ethLegacyInput());
    assert.equal(a.signingPayloadHex, b.signingPayloadHex);
    const input = ethLegacyInput();
    const snapshot = JSON.stringify(input);
    buildEthLegacyUnsignedTx(input);
    assert.equal(JSON.stringify(input), snapshot);
    const tonA = buildTonV4R2UnsignedTransfer(tonInput());
    const tonB = buildTonV4R2UnsignedTransfer(tonInput());
    assert.equal(tonA.unsignedBocBase64, tonB.unsignedBocBase64);
    assert.equal(tonA.signingHashBase64, tonB.signingHashBase64);
  });
});

describe('validation', () => {
  test('btc rejects bad inputs', () => {
    const good = () => btcInput();
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), toAddress: 'bc1qinvalid' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), toAddress: 'Bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), toAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), amountSats: '293' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), amountSats: '50.5' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), amountSats: '050000' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), amountSats: 50000 }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), feeSats: '2001' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), amountSats: '99000', feeSats: '2000' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), amountSats: '98750' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), changeAddress: undefined, amountSats: '50000' }), /Invalid/);
    const noChange = btcInput();
    delete noChange.changeAddress;
    assert.throws(() => buildBtcP2wpkhUnsignedTx(noChange), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), changeAddress: 'not-an-address' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), extra: 1 }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), privateKey: '00'.repeat(32) }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({ ...good(), mnemonic: 'abandon '.repeat(11) + 'about' }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx(null), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx([]), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({
      ...good(),
      utxos: [{ txid: '11'.repeat(32), vout: 0, valueSats: '50000', scriptPubKey: BTC_FROM_SCRIPT },
        { txid: '11'.repeat(32), vout: 0, valueSats: '50000', scriptPubKey: BTC_FROM_SCRIPT }],
    }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({
      ...good(),
      utxos: [{ txid: '00'.repeat(32), vout: 4294967295, valueSats: '100000', scriptPubKey: BTC_FROM_SCRIPT }],
    }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({
      ...good(),
      utxos: [{ txid: 'zz'.repeat(32), vout: 0, valueSats: '100000', scriptPubKey: BTC_FROM_SCRIPT }],
    }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({
      ...good(),
      utxos: [{ txid: '11'.repeat(32), vout: -1, valueSats: '100000', scriptPubKey: BTC_FROM_SCRIPT }],
    }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({
      ...good(),
      utxos: [{ txid: '11'.repeat(32), vout: 0, valueSats: '0', scriptPubKey: BTC_FROM_SCRIPT }],
    }), /Invalid/);
    assert.throws(() => buildBtcP2wpkhUnsignedTx({
      ...good(),
      utxos: [{ txid: '11'.repeat(32), vout: 0, valueSats: '100000', scriptPubKey: '0014' + '00'.repeat(21) }],
    }), /Invalid/);
    // Exact-change (no change output) is valid.
    const exact = buildBtcP2wpkhUnsignedTx({ ...good(), amountSats: '99000', feeSats: '1000' });
    assert.equal(exact.outputs.length, 1);
    assert.equal(exact.changeSats, '0');
    // Uppercase input is accepted and normalised to lowercase.
    const upper = buildBtcP2wpkhUnsignedTx({ ...good(), toAddress: BTC_TO.toUpperCase(), changeAddress: BTC_FROM.toUpperCase() });
    assert.equal(upper.outputs[0].address, BTC_TO);
  });

  test('eth rejects bad inputs', () => {
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), chainId: 137 }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), chainId: '1' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), to: ETH_TO.toLowerCase() }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), to: '0xD6c3112a8Db4991a7359018F15e501dfEE316d58' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), data: '0x1234' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), gasLimit: '20999' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), gasLimit: '16777217' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), nonce: '-1' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), valueWei: '1e18' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), valueWei: (1n << 256n).toString() }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), seed: 'abandon' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), signature: '00'.repeat(65) }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), accessList: [] }), /Invalid/);
    assert.throws(() => buildEth1559UnsignedTx({ ...eth1559Input(), maxPriorityFeePerGasWei: '30000000001' }), /Invalid/);
    assert.throws(() => buildEth1559UnsignedTx({ ...eth1559Input(), maxFeePerGasWei: '999999999' }), /Invalid/);
    assert.throws(() => buildEth1559UnsignedTx({ ...eth1559Input(), gasPriceWei: '1' }), /Invalid/);
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), gasPriceWei: '1', valueWei: (1n << 256n).toString() }), /Invalid/);
    // EIP-55 spec vectors are accepted; a flipped case is not.
    for (const addr of [
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
      '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
    ]) {
      assert.equal(buildEthLegacyUnsignedTx({ ...ethLegacyInput(), to: addr }).type, 0);
    }
    assert.throws(() => buildEthLegacyUnsignedTx({ ...ethLegacyInput(), to: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'.replace('5aA', '5aa') }), /Invalid/);
  });

  test('tron rejects bad inputs', () => {
    const good = () => tronInput();
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), toAddress: 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9d' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), toAddress: TRX_FROM }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), amountSun: '0' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), amountSun: '9223372036854775808' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), amountSun: '1.5' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), refBlockId: 'AB'.repeat(32) }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), refBlockId: 'ab'.repeat(31) }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), expirationMs: '1790000000000' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), expirationMs: '1790086400001' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), feeLimitSun: '1' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), feeLimitSun: '1000000' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), network: 'tron-mainnet' }), /Invalid/);
    assert.throws(() => buildTronMainnetUnsignedTransfer({ ...good(), contractAddress: TRX_TO }), /Invalid/);
    assert.equal(buildTronMainnetUnsignedTransfer({ ...good(), feeLimitSun: '0' }).network, 'tron-mainnet');
  });

  test('ton rejects bad inputs', () => {
    const good = () => tonInput();
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), amountNano: '0' }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), amountNano: (1n << 120n).toString() }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), amountNano: '01' }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), seqno: -1 }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), seqno: 4294967296 }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), seqno: 1.5 }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), validUntil: 0 }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), sender: 'EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn' }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), destination: 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), bounce: true }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), payload: '00' }), /Invalid/);
    assert.throws(() => buildTonV4R2UnsignedTransfer({ ...good(), privateKey: '00'.repeat(32) }), /Invalid/);
    // EQ (bounceable) destination for the same account is valid.
    assert.equal(buildTonV4R2UnsignedTransfer(good()).kind, 'ton-v4r2-native-unsigned');
  });

  test('accessor fields are rejected', () => {
    const input = ethLegacyInput();
    Object.defineProperty(input, 'to', { get: () => ETH_TO });
    assert.throws(() => buildEthLegacyUnsignedTx(input), /Invalid/);
    const ton = tonInput();
    Object.defineProperty(ton, 'seqno', { get: () => 5 });
    assert.throws(() => buildTonV4R2UnsignedTransfer(ton), /Invalid/);
    const btc = btcInput();
    Object.defineProperty(btc, 'amountSats', { get: () => '50000' });
    assert.throws(() => buildBtcP2wpkhUnsignedTx(btc), /Invalid/);
  });
});

describe('disabled operations', () => {
  const stubs = [
    ['broadcastTransaction', broadcastTransaction],
    ['sendTransaction', sendTransaction],
    ['transferToken', transferToken],
    ['callContract', callContract],
    ['approveAllowance', approveAllowance],
    ['signTransaction', signTransaction],
  ];
  for (const [name, fn] of stubs) {
    test(`${name} always throws the exact disabled error`, () => {
      assert.throws(() => fn(), (e) => e instanceof Error && e.message === DISABLED_MESSAGE);
      assert.throws(() => fn({ to: ETH_TO, value: '1' }), (e) => e instanceof Error && e.message === DISABLED_MESSAGE);
      assert.throws(() => fn('x', 1, {}), (e) => e instanceof Error && e.message === DISABLED_MESSAGE);
      let inspected = false;
      const hostile = {};
      Object.defineProperty(hostile, 'x', { get: () => { inspected = true; return 1; } });
      assert.throws(() => fn(hostile), (e) => e instanceof Error && e.message === DISABLED_MESSAGE);
      assert.equal(inspected, false);
    });
  }
});

describe('public fixtures', () => {
  test('btc fixture addresses decode independently', () => {
    assert.equal(bech32Program(BTC_FROM).toString('hex'), '0c03e507f38033aca9ac5c32b32dce56051d097b');
    assert.equal(bech32Program(BTC_TO).toString('hex'), 'df96d8a361835b85d4feed2ae013fbfbd6706a61');
    assert.equal(BTC_FROM.length, 42);
    assert.equal(BTC_TO.length, 42);
    assert.ok(readFileSync(resolve(repoRoot, 'docs/mainnet/MAINNET-GUIDE.md'), 'utf8').includes(BTC_FROM));
    assert.ok(readFileSync(resolve(repoRoot, 'test/smoke.test.js'), 'utf8').includes(BTC_TO));
  });

  test('eth fixture address is checksummed and accepted', () => {
    assert.equal(buildEthLegacyUnsignedTx({ ...ethLegacyInput(), to: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7' }).type, 0);
  });

  test('tron fixture addresses decode independently', () => {
    const from = base58CheckPayload(TRX_FROM);
    const to = base58CheckPayload(TRX_TO);
    assert.equal(from[0], 65);
    assert.equal(to[0], 65);
    assert.equal(from.length, 21);
    assert.equal(to.length, 21);
  });

  test('ton fixture address decodes independently', () => {
    const bytes = Buffer.from(TON_ADDR, 'base64url');
    assert.equal(bytes.length, 36);
    assert.equal(bytes[0], 81);
    assert.equal(bytes[1], 0);
    assert.equal(crc16Xmodem(bytes.subarray(0, 34)), bytes.readUInt16BE(34));
    assert.equal(TON_ADDR.length, 48);
    assert.ok(readFileSync(resolve(repoRoot, 'docs/mainnet/MAINNET-GUIDE.md'), 'utf8').includes(TON_ADDR));
  });
});

describe('static no-execution rules', () => {
  function codeWithoutComments(source) {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  test('module imports only Buffer and createHash', () => {
    const source = readFileSync(modulePath, 'utf8');
    const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    assert.deepEqual(imports, ['node:buffer', 'node:crypto']);
    assert.ok(source.includes("import { Buffer } from 'node:buffer';"));
    assert.ok(source.includes("import { createHash } from 'node:crypto';"));
  });

  test('module contains no network, secret, signing, clock or randomness API', () => {
    const source = codeWithoutComments(readFileSync(modulePath, 'utf8'));
    const forbidden = [
      'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
      'http', 'https', 'net', 'tls', 'dgram', 'dns',
      'require', 'eval', 'Function', 'process', 'globalThis',
      'Date', 'Math.random', 'randomBytes', 'randomInt', 'randomUUID',
      'createSign', 'createPrivateKey', 'createSecretKey', 'generateKey',
      'pbkdf2', 'scrypt', 'sign', 'privateKey', 'mnemonic', 'seed', 'xprv', 'wif',
    ];
    for (const word of forbidden) {
      const pattern = new RegExp(`\\b${word}\\b`);
      assert.ok(!pattern.test(source), `forbidden word present: ${word}`);
    }
    // The six stub names are the only permitted "disabled operation" words.
    for (const name of ['broadcastTransaction', 'sendTransaction', 'transferToken', 'callContract', 'approveAllowance', 'signTransaction']) {
      assert.ok(source.includes(`export function ${name}()`), `missing stub ${name}`);
    }
    assert.equal(source.split(DISABLED_MESSAGE).length - 1, 1, 'disabled message appears exactly once');
  });

  test('module contains no endpoint URL and no broadcast/send string outside the stubs', () => {
    let source = codeWithoutComments(readFileSync(modulePath, 'utf8'));
    assert.ok(!/https?:\/\//.test(source), 'no http URL');
    assert.ok(!/wss?:\/\//.test(source), 'no ws URL');
    // The six stub names are the only permitted occurrences of these words.
    for (const name of ['broadcastTransaction', 'sendTransaction', 'transferToken', 'callContract', 'approveAllowance', 'signTransaction']) {
      source = source.replaceAll(`export function ${name}()`, '');
    }
    assert.ok(!/broadcast|sendRawTransaction|eth_send|submitTransaction/.test(source), 'no send/broadcast identifiers outside stubs');
  });
});

describe('offline behaviour', () => {
  test('builders and stubs run in a fresh process with network APIs trapped', () => {
    const script = [
      'let calls = 0;',
      'globalThis.fetch = () => { calls += 1; throw new Error("network trapped"); };',
      'globalThis.XMLHttpRequest = function () { calls += 1; throw new Error("network trapped"); };',
      `const m = await import(${JSON.stringify(pathToFileURL(modulePath).href)});`,
      `m.buildBtcP2wpkhUnsignedTx(${JSON.stringify(btcInput())});`,
      `m.buildEthLegacyUnsignedTx(${JSON.stringify(ethLegacyInput())});`,
      `m.buildEth1559UnsignedTx(${JSON.stringify(eth1559Input())});`,
      `m.buildTronMainnetUnsignedTransfer(${JSON.stringify(tronInput())});`,
      `m.buildTonV4R2UnsignedTransfer(${JSON.stringify(tonInput())});`,
      'for (const fn of [m.broadcastTransaction, m.sendTransaction, m.transferToken, m.callContract, m.approveAllowance, m.signTransaction]) { try { fn(); } catch {} }',
      'if (calls !== 0) throw new Error("network API was called");',
      'console.log("OFFLINE-OK");',
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('OFFLINE-OK'), result.stdout);
  });
});
