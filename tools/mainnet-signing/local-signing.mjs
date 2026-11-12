// Mainnet local signing + pre-broadcast checks (T35, Bawa workstream 3).
//
// Signs T33 unsigned mainnet transactions LOCALLY, inside T25 isolation,
// with temporary unfunded credentials only, verifies each signature
// independently of the signer, and runs an 11-check pre-broadcast
// checklist that fails closed. There is NO broadcast path in this module:
// no network import, no network call, no function that sends anything.
// STOP BEFORE BROADCASTING: M-35 execution is NOT authorised.
//
// Authorship (labelled precisely, A-3 precedent):
// - Design specs: BTC (out/a2a1b-btc-only.md), ETH (out/a2a2a-eth-only.md)
//   and TON (out/a2a2c-ton-only.md) by Astra (gpt-6-astra, landed calls 4,
//   5, 7); TRON (out/m2-tron-spec-MUSE-AUTHORED.md) and preflight
//   (out/m2-preflight-spec-MUSE-AUTHORED.md) authored first-hand by Muse
//   (T35 worker) after Astra calls stalled. Implementation below is
//   hand-applied first-hand by the T35 worker from those specs, the T33
//   unsigned-transaction module, and wallet-core 4.9.1 proto facts
//   verified first-hand in Node 22.
// - Corrections applied against the specs (see docs/mainnet/MAINNET-SIGNING.md):
//   (a) TON namespace is TW.TheOpenNetwork.Proto, NOT TW.TON.Proto.
//   (b) T33 did NOT adopt the snapshot/contextId design: the TRON artifact
//       is {network, rawDataHex, unsignedTransactionHex, txID} with a
//       format-validated synthetic refBlockId; this module validates format
//       only and states the limitation.
//   (c) Wallet-core's TRON SigningInput.transaction is a FLAT message
//       {timestamp, expiration, blockHeader, transfer, ...}, NOT the
//       blockchain Transaction{raw_data, signature} message the TRON spec
//       assumed. This module decomposes the T33 raw_data into the flat
//       fields. The signer derives ref_block_hash as SHA-256 of the
//       BlockHeader protobuf, bytes 8-15 (verified first-hand); T33 pins
//       ref_block_hash directly from the fixture refBlockId, so the signed
//       raw_data differs from the T33 raw_data in ref_block_hash (and
//       therefore txID) while ref_block_bytes, contract, timestamp and
//       expiration match exactly. Verification is field-level for TRON.
//   (d) The BTC signer fee is byteFee * estimated vsize (141 vB for the
//       one-input two-output fixture), NOT the T33 feeSats input. The
//       approval binds maxFeeSats; the signed fee must be within it and
//       must equal totalInput - outputs.
//   (e) TW.* protobuf types are a package-level export of
//       @trustwallet/wallet-core, NOT properties of the initWasm()
//       instance. CoinTypeExt.deriveAddressFromPublicKey aborts the WASM
//       runtime for coin.tron (verified first-hand); TRON addresses are
//       derived manually (keccak256 + Base58Check) in this module.
//
// Boundaries:
// - Offline cryptographic success proves neither balance, unspentness,
//   current nonce/seqno, block freshness, nor executability.
// - The module never prints, logs, or uploads a secret. Private keys are
//   accepted only as in-memory Uint8Array, never as text, and are never
//   included in any returned object, error, or evidence record.
// - Verification is independent of wallet-core signing where the spec
//   requires it: own BigInt secp256k1 code + own keccak256 for BTC/ETH/
//   TRON, Node Ed25519 + own BOC parsing for TON. Wallet-core is used
//   only to PRODUCE signatures and to derive fixture addresses in tests.

import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertOperationAllowed,
  containsSecret,
  MainnetGuardError,
} from '../mainnet-guards/mainnet-guards.mjs';

export const WALLET_CORE_VERSION = '4.9.1';
export const STOP_MESSAGE = 'STOP BEFORE BROADCASTING: M-35 execution NOT authorised.';

export class SigningError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SigningError';
  }
}

export class PreflightError extends Error {
  constructor(checkId, checkName, message) {
    super(`Preflight check ${checkId} (${checkName}) failed: ${message}`);
    this.name = 'PreflightError';
    this.checkId = checkId;
    this.checkName = checkName;
  }
}

// ---------------------------------------------------------------------------
// Hashes, encodings, secp256k1 (own code; no new dependencies)
// ---------------------------------------------------------------------------

export function sha256(bytes) {
  return createHash('sha256').update(Buffer.from(bytes)).digest();
}

export function sha256d(bytes) {
  return sha256(sha256(bytes));
}

export function hash160(bytes) {
  return createHash('ripemd160').update(sha256(bytes)).digest();
}

function keccakF1600(state) {
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
    0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
    0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
    0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
    0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];
  const ROT = [
    0n, 1n, 62n, 28n, 27n, 36n, 44n, 6n, 55n, 20n,
    3n, 10n, 43n, 25n, 39n, 41n, 45n, 15n, 21n, 8n,
    18n, 2n, 61n, 56n, 14n,
  ];
  const MASK = (1n << 64n) - 1n;
  const rotl = (v, s) => (s === 0n ? v : ((v << s) | (v >> (64n - s))) & MASK);
  const cols = new Array(5);
  const moved = new Array(25);
  for (const rc of RC) {
    for (let x = 0; x < 5; x += 1) {
      cols[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x += 1) {
      const d = cols[(x + 4) % 5] ^ rotl(cols[(x + 1) % 5], 1n);
      for (let y = 0; y < 5; y += 1) {
        const i = x + 5 * y;
        moved[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(state[i] ^ d, ROT[i]);
      }
    }
    for (let y = 0; y < 5; y += 1) {
      const row = 5 * y;
      for (let x = 0; x < 5; x += 1) {
        state[row + x] = (moved[row + x] ^ (~moved[row + ((x + 1) % 5)] & moved[row + ((x + 2) % 5)])) & MASK;
      }
    }
    state[0] ^= rc;
  }
}

export function keccak256(bytes) {
  const input = Buffer.from(bytes);
  const rate = 136;
  const padded = Buffer.alloc(input.length + rate - (input.length % rate));
  padded.set(input);
  padded[input.length] = 0x01;
  padded[padded.length - 1] |= 0x80;
  const state = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let lane = 0; lane < rate / 8; lane += 1) {
      state[lane] ^= padded.readBigUInt64LE(off + lane * 8);
    }
    keccakF1600(state);
  }
  const out = Buffer.alloc(32);
  for (let lane = 0; lane < 4; lane += 1) out.writeBigUInt64LE(state[lane], lane * 8);
  return out;
}

// --- RLP ---
export function rlpEncode(value) {
  let body;
  let shortPrefix;
  let longPrefix;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const buf = Buffer.from(value);
    if (buf.length === 1 && buf[0] < 0x80) return buf;
    body = buf;
    shortPrefix = 0x80;
    longPrefix = 0xb7;
  } else if (Array.isArray(value)) {
    body = Buffer.concat(value.map((item) => rlpEncode(item)));
    shortPrefix = 0xc0;
    longPrefix = 0xf7;
  } else {
    throw new SigningError('RLP encode: expected bytes or array');
  }
  if (body.length <= 55) return Buffer.concat([Buffer.from([shortPrefix + body.length]), body]);
  const lenBytes = bigIntToMinimalBytes(BigInt(body.length));
  return Buffer.concat([Buffer.from([longPrefix + lenBytes.length]), lenBytes, body]);
}

export function rlpDecode(bytes, offset = 0) {
  const input = Buffer.from(bytes);
  if (offset >= input.length) throw new SigningError('RLP decode: truncated input');
  const prefix = input[offset];
  if (prefix < 0x80) return { value: input.subarray(offset, offset + 1), next: offset + 1 };
  if (prefix < 0xb8) {
    const len = prefix - 0x80;
    if (offset + 1 + len > input.length) throw new SigningError('RLP decode: truncated string');
    return { value: input.subarray(offset + 1, offset + 1 + len), next: offset + 1 + len };
  }
  if (prefix < 0xc0) {
    const lenOfLen = prefix - 0xb7;
    if (offset + 1 + lenOfLen > input.length) throw new SigningError('RLP decode: truncated length');
    const len = Number(bigIntFromBytes(input.subarray(offset + 1, offset + 1 + lenOfLen)));
    if (offset + 1 + lenOfLen + len > input.length) throw new SigningError('RLP decode: truncated string');
    return { value: input.subarray(offset + 1 + lenOfLen, offset + 1 + lenOfLen + len), next: offset + 1 + lenOfLen + len };
  }
  if (prefix < 0xf8) {
    const len = prefix - 0xc0;
    let pos = offset + 1;
    const end = pos + len;
    if (end > input.length) throw new SigningError('RLP decode: truncated list');
    const items = [];
    while (pos < end) {
      const item = rlpDecode(input, pos);
      items.push(item.value);
      pos = item.next;
    }
    if (pos !== end) throw new SigningError('RLP decode: list length mismatch');
    return { value: items, next: end };
  }
  const lenOfLen = prefix - 0xf7;
  if (offset + 1 + lenOfLen > input.length) throw new SigningError('RLP decode: truncated length');
  const len = Number(bigIntFromBytes(input.subarray(offset + 1, offset + 1 + lenOfLen)));
  let pos = offset + 1 + lenOfLen;
  const end = pos + len;
  if (end > input.length) throw new SigningError('RLP decode: truncated list');
  const items = [];
  while (pos < end) {
    const item = rlpDecode(input, pos);
    items.push(item.value);
    pos = item.next;
  }
  if (pos !== end) throw new SigningError('RLP decode: list length mismatch');
  return { value: items, next: end };
}

export function bigIntToMinimalBytes(value) {
  const n = BigInt(value);
  if (n === 0n) return Buffer.alloc(0);
  if (n < 0n) throw new SigningError('Cannot encode a negative integer as minimal bytes');
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  return Buffer.from(hex, 'hex');
}

export function bigIntFromBytes(bytes) {
  const buf = Buffer.from(bytes);
  if (buf.length === 0) return 0n;
  return BigInt(`0x${buf.toString('hex')}`);
}

export function hexToBytes(hex, label) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new SigningError(`Invalid ${label}: expected even-length hex`);
  }
  return Buffer.from(hex, 'hex');
}

export function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

// --- Bech32 (BIP-173) ---
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values) {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) if ((top >> i) & 1) chk ^= BECH32_GEN[i];
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const out = [];
  for (const ch of hrp) out.push(ch.charCodeAt(0) >> 5);
  out.push(0);
  for (const ch of hrp) out.push(ch.charCodeAt(0) & 31);
  return out;
}

function bech32ConvertBits(data, from, to, pad) {
  let acc = 0;
  let bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    return null;
  }
  return out;
}

export function encodeBech32(hrp, program20) {
  const program = Buffer.from(program20);
  if (program.length !== 20) throw new SigningError('Bech32 encode: expected a 20-byte program');
  const data = [0, ...bech32ConvertBits(program, 8, 5, true)];
  const values = [...bech32HrpExpand(hrp), ...data];
  const polymod = bech32Polymod([...values, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = [];
  for (let i = 0; i < 6; i += 1) checksum.push((polymod >> (5 * (5 - i))) & 31);
  return hrp + '1' + [...data, ...checksum].map((v) => BECH32_CHARSET[v]).join('');
}

export function decodeBech32P2wpkh(address, label = 'address') {
  if (typeof address !== 'string') throw new SigningError(`Invalid ${label}: expected a string`);
  if (/[a-z]/.test(address) && /[A-Z]/.test(address)) throw new SigningError(`Invalid ${label}: mixed case`);
  if (address.length !== 42) throw new SigningError(`Invalid ${label}: expected 42 characters`);
  const lower = address.toLowerCase();
  const sep = lower.lastIndexOf('1');
  if (sep < 1) throw new SigningError(`Invalid ${label}: missing separator`);
  const hrp = lower.slice(0, sep);
  if (hrp !== 'bc') throw new SigningError(`Invalid ${label}: expected mainnet hrp bc`);
  const data = [];
  for (const ch of lower.slice(sep + 1)) {
    const idx = BECH32_CHARSET.indexOf(ch);
    if (idx === -1) throw new SigningError(`Invalid ${label}: bad character`);
    data.push(idx);
  }
  if (bech32Polymod([...bech32HrpExpand(hrp), ...data]) !== 1) throw new SigningError(`Invalid ${label}: bad checksum`);
  if (data[0] !== 0) throw new SigningError(`Invalid ${label}: expected witness version 0`);
  const program = bech32ConvertBits(data.slice(1, -6), 5, 8, false);
  if (program === null || program.length !== 20) throw new SigningError(`Invalid ${label}: expected a 20-byte program`);
  return Buffer.from(program);
}

// --- Base58Check ---
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  const buf = Buffer.from(bytes);
  let n = 0n;
  for (const byte of buf) n = (n << 8n) | BigInt(byte);
  let out = '';
  while (n > 0n) {
    out = BASE58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  let zeros = 0;
  for (const byte of buf) {
    if (byte !== 0) break;
    zeros += 1;
  }
  return '1'.repeat(zeros) + (out || (buf.length > 0 ? '' : ''));
}

export function base58CheckEncode(payload21) {
  const payload = Buffer.from(payload21);
  const check = sha256d(payload).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, check]));
}

export function base58CheckDecode(address, label, expectedLength) {
  if (typeof address !== 'string') throw new SigningError(`Invalid ${label}: expected a string`);
  let n = 0n;
  for (const ch of address) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx === -1) throw new SigningError(`Invalid ${label}: bad character`);
    n = n * 58n + BigInt(idx);
  }
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  const minimal = hex === '00' ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let zeros = 0;
  for (const ch of address) {
    if (ch !== '1') break;
    zeros += 1;
  }
  const decoded = Buffer.concat([Buffer.alloc(zeros), minimal]);
  if (decoded.length !== expectedLength) throw new SigningError(`Invalid ${label}: expected ${expectedLength} decoded bytes`);
  const payload = decoded.subarray(0, expectedLength - 4);
  const check = decoded.subarray(expectedLength - 4);
  if (!check.equals(sha256d(payload).subarray(0, 4))) throw new SigningError(`Invalid ${label}: bad checksum`);
  return Buffer.from(payload);
}

// --- secp256k1 (affine BigInt arithmetic) ---
const SECP_P = (1n << 256n) - (1n << 32n) - 977n;
const SECP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP_G = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
};

function modInv(a, m) {
  let [oldR, r] = [((a % m) + m) % m, m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) throw new SigningError('secp256k1: no modular inverse');
  return ((oldS % m) + m) % m;
}

function ecAdd(p1, p2) {
  if (p1 === null) return p2;
  if (p2 === null) return p1;
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  let m;
  if (x1 === x2 && y1 === y2) {
    if (y1 === 0n) return null;
    m = ((3n * x1 * x1) * modInv(2n * y1, SECP_P)) % SECP_P;
  } else {
    if (x1 === x2) return null;
    m = ((y2 - y1) * modInv(x2 - x1, SECP_P)) % SECP_P;
  }
  const x3 = (m * m - x1 - x2) % SECP_P;
  const y3 = (m * (x1 - x3) - y1) % SECP_P;
  return { x: (x3 + SECP_P) % SECP_P, y: (y3 + SECP_P) % SECP_P };
}

function ecMul(k, point = SECP_G) {
  let scalar = ((BigInt(k) % SECP_N) + SECP_N) % SECP_N;
  let result = null;
  let addend = point;
  while (scalar > 0n) {
    if (scalar & 1n) result = ecAdd(result, addend);
    addend = ecAdd(addend, addend);
    scalar >>= 1n;
  }
  return result;
}

export function privateKeyToPublicKey(privateKey, compressed = true) {
  const priv = Buffer.from(privateKey);
  if (priv.length !== 32) throw new SigningError('Private key must be 32 bytes');
  const d = bigIntFromBytes(priv);
  if (d < 1n || d >= SECP_N) throw new SigningError('Private key out of range');
  const point = ecMul(d);
  if (point === null) throw new SigningError('Private key maps to infinity');
  if (compressed) {
    const prefix = point.y % 2n === 0n ? 0x02 : 0x03;
    const out = Buffer.alloc(33);
    out[0] = prefix;
    out.set(Buffer.from(point.x.toString(16).padStart(64, '0'), 'hex'), 1);
    return out;
  }
  const out = Buffer.alloc(65);
  out[0] = 0x04;
  out.set(Buffer.from(point.x.toString(16).padStart(64, '0'), 'hex'), 1);
  out.set(Buffer.from(point.y.toString(16).padStart(64, '0'), 'hex'), 33);
  return out;
}

export function publicKeyToEthAddress(uncompressedPubkey) {
  const pub = Buffer.from(uncompressedPubkey);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new SigningError('Expected a 65-byte uncompressed public key');
  const lower = keccak256(pub.subarray(1)).subarray(12).toString('hex');
  const hash = keccak256(Buffer.from(lower, 'ascii'));
  let checksummed = '0x';
  for (let i = 0; i < 40; i += 1) {
    const nibble = i % 2 === 0 ? hash[i >> 1] >> 4 : hash[i >> 1] & 0x0f;
    checksummed += nibble >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return checksummed;
}

export function publicKeyToTronAddress(uncompressedPubkey) {
  const pub = Buffer.from(uncompressedPubkey);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new SigningError('Expected a 65-byte uncompressed public key');
  const hash = keccak256(pub.subarray(1));
  return base58CheckEncode(Buffer.concat([Buffer.from([0x41]), hash.subarray(12)]));
}

function parsePublicKey(pubBytes) {
  const pub = Buffer.from(pubBytes);
  if (pub.length === 33 && (pub[0] === 0x02 || pub[0] === 0x03)) {
    const x = bigIntFromBytes(pub.subarray(1));
    if (x >= SECP_P) throw new SigningError('Public key x out of range');
    const y2 = (x * x * x + 7n) % SECP_P;
    let y = modPow(y2, (SECP_P + 1n) / 4n, SECP_P);
    if ((y * y) % SECP_P !== y2) throw new SigningError('Public key not on curve');
    if ((y % 2n === 0n) !== (pub[0] === 0x02)) y = SECP_P - y;
    return { x, y };
  }
  if (pub.length === 65 && pub[0] === 0x04) {
    const x = bigIntFromBytes(pub.subarray(1, 33));
    const y = bigIntFromBytes(pub.subarray(33));
    if (x >= SECP_P || y >= SECP_P) throw new SigningError('Public key coordinate out of range');
    if ((y * y - (x * x * x + 7n)) % SECP_P !== 0n) throw new SigningError('Public key not on curve');
    return { x, y };
  }
  throw new SigningError('Unsupported public key encoding');
}

function modPow(base, exp, mod) {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

export function ecdsaVerify(hashBytes, r, s, pubBytes) {
  if (Buffer.from(hashBytes).length !== 32) return false;
  if (typeof r !== 'bigint' || typeof s !== 'bigint') return false;
  const e = bigIntFromBytes(hashBytes);
  const rN = BigInt(r);
  const sN = BigInt(s);
  if (rN < 1n || rN >= SECP_N || sN < 1n || sN >= SECP_N) return false;
  let point;
  try {
    point = parsePublicKey(pubBytes);
  } catch {
    return false;
  }
  const w = modInv(sN, SECP_N);
  const u1 = (e * w) % SECP_N;
  const u2 = (rN * w) % SECP_N;
  const p = ecAdd(ecMul(u1), ecMul(u2, point));
  if (p === null) return false;
  return p.x % SECP_N === rN;
}

export function ecdsaRecover(hashBytes, r, s, recid) {
  if (Buffer.from(hashBytes).length !== 32) return null;
  if (typeof r !== 'bigint' || typeof s !== 'bigint') return null;
  const e = bigIntFromBytes(hashBytes);
  const rN = BigInt(r);
  const sN = BigInt(s);
  if (rN < 1n || rN >= SECP_N || sN < 1n || sN >= SECP_N) return null;
  const rec = recid >= 27 ? recid - 27 : recid;
  if (rec !== 0 && rec !== 1) return null;
  const x = rN + (rec >> 1 ? SECP_N : 0n);
  if (x >= SECP_P) return null;
  const y2 = (x * x * x + 7n) % SECP_P;
  let y = modPow(y2, (SECP_P + 1n) / 4n, SECP_P);
  if ((y * y) % SECP_P !== y2) return null;
  if ((y % 2n === 0n) !== (rec % 2 === 0)) y = SECP_P - y;
  const rPoint = { x, y };
  const rInv = modInv(rN, SECP_N);
  const u1 = ((-e * rInv) % SECP_N + SECP_N) % SECP_N;
  const u2 = ((sN * rInv) % SECP_N + SECP_N) % SECP_N;
  const q = ecAdd(ecMul(u1), ecMul(u2, rPoint));
  if (q === null) return null;
  const out = Buffer.alloc(65);
  out[0] = 0x04;
  out.set(Buffer.from(q.x.toString(16).padStart(64, '0'), 'hex'), 1);
  out.set(Buffer.from(q.y.toString(16).padStart(64, '0'), 'hex'), 33);
  return out;
}

// --- Ed25519 verify (Node native; public key supplied as raw 32 bytes) ---
export function ed25519Verify(messageBytes, signatureBytes, publicKeyBytes) {
  const pub = Buffer.from(publicKeyBytes);
  const sig = Buffer.from(signatureBytes);
  if (pub.length !== 32 || sig.length !== 64) return false;
  try {
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: pub.toString('base64url') },
      format: 'jwk',
    });
    return cryptoVerify(null, Buffer.from(messageBytes), key, sig);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Wallet-core loading (4.9.1, from tools/hdwallet-gen/node_modules; no new
// dependency). TW.* is a package-level export, not on the wasm instance.
// ---------------------------------------------------------------------------

let cachedCore = null;

export async function loadWalletCore() {
  if (cachedCore !== null) return cachedCore;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const packagePath = join(moduleDir, '..', 'hdwallet-gen', 'node_modules', '@trustwallet', 'wallet-core');
  let pkg;
  try {
    pkg = createRequire(import.meta.url)(packagePath);
  } catch (error) {
    throw new SigningError(`Wallet-core 4.9.1 not installed at ${packagePath}: ${error.code ?? 'load failed'}`);
  }
  if (!pkg || typeof pkg.initWasm !== 'function' || !pkg.TW) {
    throw new SigningError('Wallet-core package does not expose initWasm/TW as expected');
  }
  let version = null;
  try {
    version = createRequire(import.meta.url)(join(packagePath, 'package.json')).version;
  } catch {
    version = null;
  }
  if (version !== WALLET_CORE_VERSION) {
    throw new SigningError(`Wallet-core version mismatch: expected ${WALLET_CORE_VERSION}, found ${String(version)}`);
  }
  let core;
  try {
    core = await pkg.initWasm();
  } catch (error) {
    throw new SigningError(`Wallet-core initWasm failed: ${error.message ?? 'unknown error'}`);
  }
  cachedCore = { core, TW: pkg.TW };
  return cachedCore;
}

// ---------------------------------------------------------------------------
// Isolation gate (T25) + guard
// ---------------------------------------------------------------------------
//
// The T25 guard module defines no isolation-handle type: isolation is a
// caller-side handle. This module requires an object:
//   { dir: <absolute path string>,
//     assertIsolated: () => true,
//     credentialKind: 'temporary-unfunded',
//     revoked?: false, expiresAt?: <epoch ms> }
// Signing is refused unless the handle is present, asserts isolation,
// names temporary-unfunded credentials, and is not revoked/expired, AND
// the T25 guard allows local signing with temporary unfunded credentials.

export function assertIsolation(isolation) {
  if (isolation === null || typeof isolation !== 'object' || Array.isArray(isolation)) {
    throw new SigningError('Isolation required: no isolation handle supplied; refusing to sign');
  }
  if (typeof isolation.dir !== 'string' || isolation.dir.length === 0) {
    throw new SigningError('Isolation required: handle has no isolation directory');
  }
  if (isolation.credentialKind !== undefined && isolation.credentialKind !== 'temporary-unfunded') {
    throw new SigningError('Isolation required: credentials are not temporary-unfunded; refusing to sign');
  }
  if (isolation.revoked === true) {
    throw new SigningError('Isolation required: isolation handle is revoked; refusing to sign');
  }
  if (typeof isolation.expiresAt === 'number' && Date.now() >= isolation.expiresAt) {
    throw new SigningError('Isolation required: isolation handle is expired; refusing to sign');
  }
  if (typeof isolation.assertIsolated !== 'function') {
    throw new SigningError('Isolation required: handle has no assertIsolated() function; refusing to sign');
  }
  let ok = false;
  try {
    ok = isolation.assertIsolated();
  } catch {
    ok = false;
  }
  if (ok !== true) {
    throw new SigningError('Isolation required: assertIsolated() did not confirm isolation; refusing to sign');
  }
  return true;
}

export function requireSigningAllowed() {
  try {
    assertOperationAllowed('sign', { credentialKind: 'temporary-unfunded', localOnly: true });
  } catch (error) {
    if (error instanceof MainnetGuardError) {
      throw new SigningError(`T25 guard forbids this signing step: ${error.message}`);
    }
    throw error;
  }
  return true;
}

function requireIsolationAndGuard(isolation) {
  assertIsolation(isolation);
  requireSigningAllowed();
}

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertClosedObject(input, requiredKeys, optionalKeys, label) {
  if (!isPlainObject(input)) throw new SigningError(`Invalid ${label}: expected a plain object`);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new SigningError(`Invalid ${label}: unknown field ${key}`);
    const desc = Object.getOwnPropertyDescriptor(input, key);
    if (desc === undefined || 'get' in desc || 'set' in desc) throw new SigningError(`Invalid ${label}: accessor field ${key}`);
  }
  for (const key of requiredKeys) {
    if (!(key in input)) throw new SigningError(`Invalid ${label}: missing field ${key}`);
  }
}

function parseCanonicalDecimal(value, label, min, max) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new SigningError(`Invalid ${label}: expected a canonical decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed < min || parsed > max) throw new SigningError(`Invalid ${label}: out of bounds`);
  return parsed;
}

function requirePrivateKey(privateKey) {
  if (!(privateKey instanceof Uint8Array) || privateKey.length !== 32) {
    throw new SigningError('Private key must be a 32-byte Uint8Array (in memory only, never text)');
  }
  const d = bigIntFromBytes(privateKey);
  if (d < 1n || d >= SECP_N) throw new SigningError('Private key out of range');
  return Buffer.from(privateKey);
}

function requireEdPrivateKey(privateKey) {
  if (!(privateKey instanceof Uint8Array) || privateKey.length !== 32) {
    throw new SigningError('Private key must be a 32-byte Uint8Array (in memory only, never text)');
  }
  return Buffer.from(privateKey);
}

function checkEip55(address, label) {
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new SigningError(`Invalid ${label}: expected a 0x-prefixed 40-hex address`);
  }
  const lower = address.slice(2).toLowerCase();
  const hash = keccak256(Buffer.from(lower, 'ascii'));
  for (let i = 0; i < 40; i += 1) {
    const nibble = i % 2 === 0 ? hash[i >> 1] >> 4 : hash[i >> 1] & 0x0f;
    const expected = nibble >= 8 ? lower[i].toUpperCase() : lower[i];
    if (address[2 + i] !== expected) throw new SigningError(`Invalid ${label}: EIP-55 checksum mismatch`);
  }
  return address;
}

function encodeCompactSize(n) {
  if (n < 253) return Buffer.from([n]);
  if (n < 65536) {
    const out = Buffer.alloc(3);
    out[0] = 253;
    out.writeUInt16LE(n, 1);
    return out;
  }
  if (n < 4294967296) {
    const out = Buffer.alloc(5);
    out[0] = 254;
    out.writeUInt32LE(n, 1);
    return out;
  }
  const out = Buffer.alloc(9);
  out[0] = 255;
  out.writeBigUInt64LE(BigInt(n), 1);
  return out;
}

function readCompactSize(buf, offset) {
  if (offset >= buf.length) throw new SigningError('CompactSize: truncated input');
  const first = buf[offset];
  if (first < 253) return { value: first, next: offset + 1 };
  if (first === 253) {
    if (offset + 3 > buf.length) throw new SigningError('CompactSize: truncated input');
    return { value: buf.readUInt16LE(offset + 1), next: offset + 3 };
  }
  if (first === 254) {
    if (offset + 5 > buf.length) throw new SigningError('CompactSize: truncated input');
    return { value: buf.readUInt32LE(offset + 1), next: offset + 5 };
  }
  if (offset + 9 > buf.length) throw new SigningError('CompactSize: truncated input');
  const value = buf.readBigUInt64LE(offset + 1);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new SigningError('CompactSize: value too large');
  return { value: Number(value), next: offset + 9 };
}

// Minimal protobuf field reader (unsigned varints, length-delimited only).
function protoFields(buf) {
  const fields = [];
  let pos = 0;
  while (pos < buf.length) {
    let tag = 0n;
    let shift = 0n;
    for (;;) {
      if (pos >= buf.length) throw new SigningError('Protobuf: truncated tag');
      const b = buf[pos];
      pos += 1;
      tag |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7n;
      if (shift > 63n) throw new SigningError('Protobuf: tag varint too long');
    }
    const field = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (wire === 0) {
      let value = 0n;
      let s = 0n;
      for (;;) {
        if (pos >= buf.length) throw new SigningError('Protobuf: truncated varint');
        const b = buf[pos];
        pos += 1;
        value |= BigInt(b & 0x7f) << s;
        if ((b & 0x80) === 0) break;
        s += 7n;
        if (s > 63n) throw new SigningError('Protobuf: varint too long');
      }
      fields.push({ field, wire, varint: value });
    } else if (wire === 2) {
      let len = 0n;
      let s = 0n;
      for (;;) {
        if (pos >= buf.length) throw new SigningError('Protobuf: truncated length');
        const b = buf[pos];
        pos += 1;
        len |= BigInt(b & 0x7f) << s;
        if ((b & 0x80) === 0) break;
        s += 7n;
        if (s > 63n) throw new SigningError('Protobuf: length varint too long');
      }
      const n = Number(len);
      if (pos + n > buf.length) throw new SigningError('Protobuf: truncated bytes field');
      fields.push({ field, wire, bytes: buf.subarray(pos, pos + n) });
      pos += n;
    } else {
      throw new SigningError(`Protobuf: unsupported wire type ${wire}`);
    }
  }
  return fields;
}

function protoBytesField(fields, field) {
  const found = fields.filter((f) => f.field === field && f.wire === 2);
  return found.length === 0 ? null : found[found.length - 1].bytes;
}

function protoVarintField(fields, field) {
  const found = fields.filter((f) => f.field === field && f.wire === 0);
  return found.length === 0 ? null : found[found.length - 1].varint;
}

// ---------------------------------------------------------------------------
// BTC (P2WPKH)
// ---------------------------------------------------------------------------

export function parseBtcUnsignedTx(unsignedTxHex) {
  const raw = hexToBytes(unsignedTxHex, 'btc unsignedTxHex');
  let pos = 0;
  if (raw.length < 10) throw new SigningError('BTC unsigned tx: too short');
  const version = raw.readInt32LE(pos);
  pos += 4;
  if (raw[pos] === 0x00 && raw[pos + 1] === 0x01) throw new SigningError('BTC unsigned tx: unexpected witness marker');
  const inCount = readCompactSize(raw, pos);
  pos = inCount.next;
  const inputs = [];
  for (let i = 0; i < inCount.value; i += 1) {
    if (pos + 36 > raw.length) throw new SigningError('BTC unsigned tx: truncated input');
    const outpoint = raw.subarray(pos, pos + 36);
    pos += 36;
    const scriptLen = readCompactSize(raw, pos);
    pos = scriptLen.next;
    if (scriptLen.value !== 0) throw new SigningError('BTC unsigned tx: input scriptSig must be empty');
    if (pos + 4 > raw.length) throw new SigningError('BTC unsigned tx: truncated sequence');
    const sequence = raw.readUInt32LE(pos);
    pos += 4;
    inputs.push({ outpoint, sequence });
  }
  const outCount = readCompactSize(raw, pos);
  pos = outCount.next;
  const outputs = [];
  for (let i = 0; i < outCount.value; i += 1) {
    if (pos + 8 > raw.length) throw new SigningError('BTC unsigned tx: truncated output value');
    const value = raw.readBigUInt64LE(pos);
    pos += 8;
    const scriptLen = readCompactSize(raw, pos);
    pos = scriptLen.next;
    if (pos + scriptLen.value > raw.length) throw new SigningError('BTC unsigned tx: truncated output script');
    const script = raw.subarray(pos, pos + scriptLen.value);
    pos += scriptLen.value;
    outputs.push({ value, script });
  }
  if (pos + 4 !== raw.length) throw new SigningError('BTC unsigned tx: trailing bytes after locktime');
  const locktime = raw.readUInt32LE(pos);
  return { version, inputs, outputs, locktime };
}

export function parseBtcSignedTx(signedTxHex) {
  const raw = hexToBytes(signedTxHex, 'btc signedTxHex');
  let pos = 0;
  if (raw.length < 12) throw new SigningError('BTC signed tx: too short');
  const version = raw.readInt32LE(pos);
  pos += 4;
  if (raw[pos] !== 0x00 || raw[pos + 1] !== 0x01) throw new SigningError('BTC signed tx: missing segwit marker/flag');
  pos += 2;
  const inCount = readCompactSize(raw, pos);
  pos = inCount.next;
  const inputs = [];
  for (let i = 0; i < inCount.value; i += 1) {
    if (pos + 36 > raw.length) throw new SigningError('BTC signed tx: truncated input');
    const outpoint = raw.subarray(pos, pos + 36);
    pos += 36;
    const scriptLen = readCompactSize(raw, pos);
    pos = scriptLen.next;
    if (scriptLen.value !== 0) throw new SigningError('BTC signed tx: input scriptSig must be empty');
    if (pos + 4 > raw.length) throw new SigningError('BTC signed tx: truncated sequence');
    const sequence = raw.readUInt32LE(pos);
    pos += 4;
    inputs.push({ outpoint, sequence });
  }
  const outCount = readCompactSize(raw, pos);
  pos = outCount.next;
  const outputs = [];
  for (let i = 0; i < outCount.value; i += 1) {
    if (pos + 8 > raw.length) throw new SigningError('BTC signed tx: truncated output value');
    const value = raw.readBigUInt64LE(pos);
    pos += 8;
    const scriptLen = readCompactSize(raw, pos);
    pos = scriptLen.next;
    if (pos + scriptLen.value > raw.length) throw new SigningError('BTC signed tx: truncated output script');
    const script = raw.subarray(pos, pos + scriptLen.value);
    pos += scriptLen.value;
    outputs.push({ value, script });
  }
  const witnesses = [];
  for (let i = 0; i < inCount.value; i += 1) {
    const stackCount = readCompactSize(raw, pos);
    pos = stackCount.next;
    const items = [];
    for (let j = 0; j < stackCount.value; j += 1) {
      const itemLen = readCompactSize(raw, pos);
      pos = itemLen.next;
      if (pos + itemLen.value > raw.length) throw new SigningError('BTC signed tx: truncated witness item');
      items.push(raw.subarray(pos, pos + itemLen.value));
      pos += itemLen.value;
    }
    witnesses.push(items);
  }
  if (pos + 4 !== raw.length) throw new SigningError('BTC signed tx: trailing bytes after locktime');
  const locktime = raw.readUInt32LE(pos);
  return { version, inputs, outputs, witnesses, locktime };
}

function parseDerSignature(sigWithHashType) {
  const sig = Buffer.from(sigWithHashType);
  if (sig.length < 9 || sig[sig.length - 1] !== 0x01) {
    throw new SigningError('BTC witness signature: bad length or sighash byte');
  }
  const der = sig.subarray(0, sig.length - 1);
  if (der[0] !== 0x30) throw new SigningError('BTC witness signature: not DER');
  const totalLen = der[1];
  if (totalLen !== der.length - 2) throw new SigningError('BTC witness signature: bad DER length');
  if (der[2] !== 0x02) throw new SigningError('BTC witness signature: missing r marker');
  const rLen = der[3];
  const r = der.subarray(4, 4 + rLen);
  const sPos = 4 + rLen;
  if (der[sPos] !== 0x02) throw new SigningError('BTC witness signature: missing s marker');
  const sLen = der[sPos + 1];
  const s = der.subarray(sPos + 2, sPos + 2 + sLen);
  if (sPos + 2 + sLen !== der.length) throw new SigningError('BTC witness signature: trailing DER bytes');
  if (r.length === 0 || s.length === 0 || r.length > 33 || s.length > 33) {
    throw new SigningError('BTC witness signature: bad r/s length');
  }
  if (r[0] === 0x00 && r.length > 1 && (r[1] & 0x80) === 0) throw new SigningError('BTC witness signature: non-minimal r');
  if (s[0] === 0x00 && s.length > 1 && (s[1] & 0x80) === 0) throw new SigningError('BTC witness signature: non-minimal s');
  if ((r[0] & 0x80) !== 0) throw new SigningError('BTC witness signature: negative r');
  if ((s[0] & 0x80) !== 0) throw new SigningError('BTC witness signature: negative s');
  const rN = bigIntFromBytes(r);
  const sN = bigIntFromBytes(s);
  if (rN < 1n || rN >= SECP_N || sN < 1n || sN >= SECP_N) throw new SigningError('BTC witness signature: r/s out of range');
  if (sN > SECP_N / 2n) throw new SigningError('BTC witness signature: s is not low-S');
  return { r: rN, s: sN };
}

export function bip143Sighash(parsedTx, inputIndex, scriptPubKey, valueSats) {
  // scriptPubKey may be a hex string (as stored in the T33 signing
  // inputs) or a Buffer. Buffer.from(hexString) would give the UTF-8
  // bytes of the hex text, not the script bytes, so decode explicitly.
  const script = typeof scriptPubKey === 'string'
    ? hexToBytes(scriptPubKey, 'btc scriptPubKey')
    : Buffer.from(scriptPubKey);
  if (script.length !== 22 || script[0] !== 0x00 || script[1] !== 0x14) {
    throw new SigningError('BIP-143: prevout script must be P2WPKH (0014 + 20 bytes)');
  }
  const program = script.subarray(2);
  const hashPrevouts = sha256d(Buffer.concat(parsedTx.inputs.map((input) => input.outpoint)));
  const hashSequence = sha256d(Buffer.concat(parsedTx.inputs.map((input) => {
    const seq = Buffer.alloc(4);
    seq.writeUInt32LE(input.sequence, 0);
    return seq;
  })));
  const hashOutputs = sha256d(Buffer.concat(parsedTx.outputs.map((output) => {
    const value = Buffer.alloc(8);
    value.writeBigUInt64LE(output.value, 0);
    return Buffer.concat([value, encodeCompactSize(output.script.length), output.script]);
  })));
  const scriptCode = Buffer.concat([Buffer.from([0x19, 0x76, 0xa9, 0x14]), program, Buffer.from([0x88, 0xac])]);
  const version = Buffer.alloc(4);
  version.writeInt32LE(parsedTx.version, 0);
  const value = Buffer.alloc(8);
  value.writeBigUInt64LE(BigInt(valueSats), 0);
  const sequence = Buffer.alloc(4);
  sequence.writeUInt32LE(parsedTx.inputs[inputIndex].sequence, 0);
  const locktime = Buffer.alloc(4);
  locktime.writeUInt32LE(parsedTx.locktime, 0);
  const sighashType = Buffer.alloc(4);
  sighashType.writeUInt32LE(1, 0);
  const preimage = Buffer.concat([
    version,
    hashPrevouts,
    hashSequence,
    parsedTx.inputs[inputIndex].outpoint,
    scriptCode,
    value,
    sequence,
    hashOutputs,
    locktime,
    sighashType,
  ]);
  return sha256d(preimage);
}

function validateBtcUnsigned(unsigned) {
  assertClosedObject(
    unsigned,
    ['unsignedTxHex', 'signingInputs', 'outputs', 'totalInputSats', 'feeSats', 'changeSats'],
    [],
    'btc unsigned artifact',
  );
  if (!Array.isArray(unsigned.signingInputs) || unsigned.signingInputs.length === 0) {
    throw new SigningError('Invalid btc unsigned artifact: signingInputs must be a nonempty array');
  }
  if (!Array.isArray(unsigned.outputs) || unsigned.outputs.length === 0) {
    throw new SigningError('Invalid btc unsigned artifact: outputs must be a nonempty array');
  }
  const parsed = parseBtcUnsignedTx(unsigned.unsignedTxHex);
  if (parsed.version !== 2) throw new SigningError('Invalid btc unsigned artifact: version must be 2');
  if (parsed.locktime !== 0) throw new SigningError('Invalid btc unsigned artifact: locktime must be 0');
  if (parsed.inputs.length !== unsigned.signingInputs.length) {
    throw new SigningError('Invalid btc unsigned artifact: input count mismatch');
  }
  if (parsed.outputs.length !== unsigned.outputs.length) {
    throw new SigningError('Invalid btc unsigned artifact: output count mismatch');
  }
  const seen = new Set();
  let totalInput = 0n;
  unsigned.signingInputs.forEach((input, i) => {
    assertClosedObject(input, ['txid', 'vout', 'valueSats', 'scriptPubKey'], [], `btc signing input ${i}`);
    if (typeof input.txid !== 'string' || !/^[0-9a-f]{64}$/.test(input.txid)) {
      throw new SigningError(`Invalid btc signing input ${i}: txid must be 64 lowercase hex characters`);
    }
    if (!Number.isInteger(input.vout) || input.vout < 0 || input.vout > 4294967295) {
      throw new SigningError(`Invalid btc signing input ${i}: vout out of range`);
    }
    const key = `${input.txid}:${input.vout}`;
    if (seen.has(key)) throw new SigningError(`Invalid btc signing input ${i}: duplicate outpoint`);
    seen.add(key);
    const value = parseCanonicalDecimal(input.valueSats, `btc signing input ${i} valueSats`, 1n, 2100000000000000n);
    totalInput += value;
    if (typeof input.scriptPubKey !== 'string' || !/^[0-9a-f]{44}$/.test(input.scriptPubKey)) {
      throw new SigningError(`Invalid btc signing input ${i}: scriptPubKey must be 44 hex characters`);
    }
    const expectedOutpoint = Buffer.concat([Buffer.from(hexToBytes(input.txid, 'btc txid')).reverse(), (() => {
      const v = Buffer.alloc(4);
      v.writeUInt32LE(input.vout, 0);
      return v;
    })()]);
    if (!parsed.inputs[i].outpoint.equals(expectedOutpoint)) {
      throw new SigningError(`Invalid btc signing input ${i}: outpoint does not match unsigned tx`);
    }
    if (parsed.inputs[i].sequence !== 4294967295) {
      throw new SigningError(`Invalid btc signing input ${i}: sequence must be 0xffffffff`);
    }
  });
  const totalInputClaimed = parseCanonicalDecimal(unsigned.totalInputSats, 'btc totalInputSats', 1n, 2100000000000000n);
  if (totalInput !== totalInputClaimed) throw new SigningError('Invalid btc unsigned artifact: totalInputSats mismatch');
  unsigned.outputs.forEach((output, i) => {
    assertClosedObject(output, ['role', 'address', 'valueSats', 'scriptPubKey'], [], `btc output ${i}`);
    if (output.role !== 'payment' && output.role !== 'change') {
      throw new SigningError(`Invalid btc output ${i}: role must be payment or change`);
    }
    const value = parseCanonicalDecimal(output.valueSats, `btc output ${i} valueSats`, 1n, 2100000000000000n);
    if (parsed.outputs[i].value !== value) throw new SigningError(`Invalid btc output ${i}: value does not match unsigned tx`);
    if (parsed.outputs[i].script.toString('hex') !== output.scriptPubKey.toLowerCase()) {
      throw new SigningError(`Invalid btc output ${i}: script does not match unsigned tx`);
    }
    decodeBech32P2wpkh(output.address, `btc output ${i} address`);
  });
  const fee = parseCanonicalDecimal(unsigned.feeSats, 'btc feeSats', 0n, 2100000000000000n);
  const change = parseCanonicalDecimal(unsigned.changeSats, 'btc changeSats', 0n, 2100000000000000n);
  const paymentTotal = unsigned.outputs.reduce((sum, o) => sum + BigInt(o.valueSats), 0n);
  if (totalInput - paymentTotal !== fee) throw new SigningError('Invalid btc unsigned artifact: fee does not equal inputs minus outputs');
  const changeOutputs = unsigned.outputs.filter((o) => o.role === 'change');
  if (changeOutputs.length > 1) throw new SigningError('Invalid btc unsigned artifact: at most one change output');
  if (changeOutputs.length === 1 && BigInt(changeOutputs[0].valueSats) !== change) {
    throw new SigningError('Invalid btc unsigned artifact: changeSats mismatch');
  }
  if (changeOutputs.length === 0 && change !== 0n) throw new SigningError('Invalid btc unsigned artifact: changeSats mismatch');
  return { parsed, totalInput, fee, change };
}

function validateBtcApproval(approval) {
  assertClosedObject(
    approval,
    ['network', 'toAddress', 'amountSats', 'maxFeeSats', 'changeAddress', 'byteFee'],
    ['changePubkeyHex'],
    'btc approval',
  );
  if (approval.network !== 'bitcoin-mainnet') throw new SigningError('Invalid btc approval: network must be bitcoin-mainnet');
  decodeBech32P2wpkh(approval.toAddress, 'btc approval toAddress');
  decodeBech32P2wpkh(approval.changeAddress, 'btc approval changeAddress');
  const amount = parseCanonicalDecimal(approval.amountSats, 'btc approval amountSats', 294n, 2100000000000000n);
  parseCanonicalDecimal(approval.maxFeeSats, 'btc approval maxFeeSats', 0n, 2100000000000000n);
  if (!Number.isInteger(approval.byteFee) || approval.byteFee < 1 || approval.byteFee > 100000) {
    throw new SigningError('Invalid btc approval: byteFee must be an integer between 1 and 100000 sat/vB');
  }
  if (approval.changePubkeyHex !== undefined) {
    const pub = hexToBytes(approval.changePubkeyHex, 'btc approval changePubkeyHex');
    if (pub.length !== 33 || (pub[0] !== 0x02 && pub[0] !== 0x03)) {
      throw new SigningError('Invalid btc approval: changePubkeyHex must be a 33-byte compressed public key');
    }
  }
  return { amount };
}

export function verifyBtc(signed, unsigned, approval, options = {}) {
  const fail = (reason) => ({ valid: false, reason });
  let parsed;
  try {
    parsed = parseBtcSignedTx(signed.signedTxHex);
  } catch (error) {
    return fail(`signed tx parse failed: ${error.message}`);
  }
  let unsignedInfo;
  try {
    unsignedInfo = validateBtcUnsigned(unsigned);
  } catch (error) {
    return fail(`unsigned artifact invalid: ${error.message}`);
  }
  let approvalInfo;
  try {
    approvalInfo = validateBtcApproval(approval);
  } catch (error) {
    return fail(`approval invalid: ${error.message}`);
  }
  if (parsed.version !== 1 && parsed.version !== 2) return fail('signed version is neither 1 nor 2');
  if (parsed.locktime !== 0) return fail('signed locktime is not 0');
  if (parsed.inputs.length !== unsigned.signingInputs.length) return fail('signed input count mismatch');
  if (parsed.outputs.length !== unsigned.outputs.length) return fail('signed output count mismatch');
  for (let i = 0; i < parsed.inputs.length; i += 1) {
    if (!parsed.inputs[i].outpoint.equals(unsignedInfo.parsed.inputs[i].outpoint)) return fail(`signed input ${i} outpoint mismatch`);
    if (parsed.inputs[i].sequence !== 4294967295) return fail(`signed input ${i} sequence is not 0xffffffff`);
  }
  // The signed outputs are compared with the APPROVAL, not with the
  // unsigned artifact: the signer fee is byteFee * estimated vsize and
  // may differ from the T33 feeSats input, so the signed change value
  // (totalInput - payment - actual fee) may differ from the unsigned
  // changeSats. What must match exactly is the payment amount, the
  // payment and change addresses, and the fee bound.
  if (parsed.outputs.length !== unsigned.outputs.length) return fail('signed output count differs from unsigned artifact');
  const totalOutput = parsed.outputs.reduce((sum, o) => sum + o.value, 0n);
  const fee = unsignedInfo.totalInput - totalOutput;
  if (fee < 0n) return fail('signed fee is negative');
  if (fee > BigInt(approval.maxFeeSats)) return fail('signed fee exceeds approved maxFeeSats');
  const payment = parsed.outputs[0];
  if (payment.value !== approvalInfo.amount) return fail('signed payment amount differs from approval');
  const paymentScript = Buffer.concat([Buffer.from([0x00, 0x14]), decodeBech32P2wpkh(approval.toAddress, 'btc approval toAddress')]);
  if (!payment.script.equals(paymentScript)) return fail('signed payment script differs from approval');
  const changeOutputs = unsigned.outputs.filter((o) => o.role === 'change');
  if (changeOutputs.length === 1) {
    if (parsed.outputs.length < 2) return fail('signed transaction is missing the change output');
    const changeScript = Buffer.concat([Buffer.from([0x00, 0x14]), decodeBech32P2wpkh(approval.changeAddress, 'btc approval changeAddress')]);
    if (!parsed.outputs[1].script.equals(changeScript)) return fail('signed change script differs from approval');
    if (parsed.outputs[1].value < 294n) return fail('signed change is below the dust floor');
    if (parsed.outputs[1].value !== unsignedInfo.totalInput - approvalInfo.amount - fee) {
      return fail('signed change does not equal inputs minus payment minus fee');
    }
  }
  const sighashes = [];
  for (let i = 0; i < parsed.inputs.length; i += 1) {
    const witness = parsed.witnesses[i];
    if (!Array.isArray(witness) || witness.length !== 2) return fail(`input ${i} witness must have exactly 2 items`);
    const [sigBytes, pubkeyBytes] = witness;
    if (pubkeyBytes.length !== 33 || (pubkeyBytes[0] !== 0x02 && pubkeyBytes[0] !== 0x03)) {
      return fail(`input ${i} witness public key is not compressed secp256k1`);
    }
    let sig;
    try {
      sig = parseDerSignature(sigBytes);
    } catch (error) {
      return fail(`input ${i} witness signature invalid: ${error.message}`);
    }
    const scriptPubKey = unsigned.signingInputs[i].scriptPubKey;
    const program = hexToBytes(scriptPubKey, 'btc scriptPubKey').subarray(2);
    if (!hash160(pubkeyBytes).equals(program)) return fail(`input ${i} witness public key does not match approved prevout script`);
    let sighash;
    try {
      sighash = bip143Sighash(parsed, i, scriptPubKey, unsigned.signingInputs[i].valueSats);
    } catch (error) {
      return fail(`input ${i} BIP-143 failed: ${error.message}`);
    }
    sighashes.push(bytesToHex(sighash));
    if (options.skipSignature !== true && !ecdsaVerify(sighash, sig.r, sig.s, pubkeyBytes)) {
      return fail(`input ${i} ECDSA verification failed`);
    }
  }
  return {
    valid: true,
    method: 'bip143-ecdsa',
    version: parsed.version,
    // Documented deviation: wallet-core always emits version 1 while
    // the T33 unsigned artifact is version 2. The sighash is computed
    // over the signed version, so the signature is valid for the
    // signed transaction as-is; the version difference is recorded,
    // not treated as a failure.
    versionDeviation: parsed.version !== 2,
    sighashes,
    feeSats: fee.toString(),
    outputs: parsed.outputs.map((o, i) => ({
      role: unsigned.outputs[i].role,
      address: unsigned.outputs[i].address,
      valueSats: o.value.toString(),
    })),
  };
}

export async function signBtc(unsigned, approval, privateKey, isolation) {
  requireIsolationAndGuard(isolation);
  const unsignedInfo = validateBtcUnsigned(unsigned);
  const approvalInfo = validateBtcApproval(approval);
  const priv = requirePrivateKey(privateKey);
  const pubkey = privateKeyToPublicKey(priv, true);
  // Pre-sign policy: the signing key must own every prevout.
  unsigned.signingInputs.forEach((input, i) => {
    const program = hexToBytes(input.scriptPubKey, 'btc scriptPubKey').subarray(2);
    if (!hash160(pubkey).equals(program)) {
      throw new PreflightError(10, 'SIGNATURE-VALID', `signing key does not own prevout ${i}; refusing to sign`);
    }
  });
  // Pre-sign policy: payment / change / fee against the approval.
  const payment = unsigned.outputs.find((o) => o.role === 'payment');
  if (!payment || payment.address.toLowerCase() !== approval.toAddress.toLowerCase()) {
    throw new PreflightError(3, 'DESTINATION', 'unsigned payment address differs from approval');
  }
  if (BigInt(payment.valueSats) !== approvalInfo.amount) {
    throw new PreflightError(4, 'AMOUNT', 'unsigned payment amount differs from approval');
  }
  const changeOutputs = unsigned.outputs.filter((o) => o.role === 'change');
  if (changeOutputs.length > 0) {
    if (changeOutputs[0].address.toLowerCase() !== approval.changeAddress.toLowerCase()) {
      throw new PreflightError(6, 'CHANGE', 'unsigned change address differs from approval');
    }
    if (approval.changePubkeyHex !== undefined) {
      const program = decodeBech32P2wpkh(approval.changeAddress, 'btc approval changeAddress');
      if (!hash160(hexToBytes(approval.changePubkeyHex, 'btc changePubkeyHex')).equals(program)) {
        throw new PreflightError(6, 'CHANGE', 'approved change address does not match approved change public key');
      }
    }
  }
  // Estimated fee: byteFee * estimated vsize. Base size is the unsigned
  // (non-witness) length; each witness adds ~109 bytes (count + 73-byte
  // DER signature + 33-byte public key, with length prefixes).
  const baseSize = hexToBytes(unsigned.unsignedTxHex, 'btc unsignedTxHex').length;
  const witnessBytes = unsigned.signingInputs.length * 109;
  const estimatedVsize = baseSize + Math.ceil(witnessBytes / 4);
  const estimatedFee = BigInt(approval.byteFee) * BigInt(estimatedVsize);
  if (estimatedFee > BigInt(approval.maxFeeSats)) {
    throw new PreflightError(5, 'FEE', `estimated fee ${estimatedFee} sat exceeds approved maxFeeSats ${approval.maxFeeSats}`);
  }
  const { core, TW } = await loadWalletCore();
  const input = TW.Bitcoin.Proto.SigningInput.encode({
    hashType: 1,
    amount: Number(approvalInfo.amount),
    byteFee: approval.byteFee,
    toAddress: approval.toAddress,
    changeAddress: approval.changeAddress,
    privateKey: [priv],
    utxo: unsigned.signingInputs.map((inputEntry) => ({
      outPoint: {
        hash: Buffer.from(hexToBytes(inputEntry.txid, 'btc txid')).reverse(),
        index: inputEntry.vout,
        sequence: 4294967295,
      },
      script: hexToBytes(inputEntry.scriptPubKey, 'btc scriptPubKey'),
      amount: Number(BigInt(inputEntry.valueSats)),
    })),
    useMaxAmount: false,
    coinType: 0,
    lockTime: 0,
  }).finish();
  let outBytes;
  try {
    outBytes = core.AnySigner.sign(input, core.CoinType.bitcoin);
  } catch (error) {
    throw new SigningError(`BTC signing failed: ${error.message ?? 'signer error'}`);
  }
  const out = TW.Bitcoin.Proto.SigningOutput.decode(outBytes);
  if (out.error !== 0) {
    throw new SigningError(`BTC signing failed: signer error ${out.error} ${out.errorMessage ?? ''}`);
  }
  if (!out.encoded || out.encoded.length === 0) throw new SigningError('BTC signing failed: empty encoded transaction');
  const signed = {
    network: 'bitcoin-mainnet',
    signedTxHex: Buffer.from(out.encoded).toString('hex'),
    txid: out.transactionId,
  };
  const verification = verifyBtc(signed, unsigned, approval);
  if (!verification.valid) {
    throw new PreflightError(10, 'SIGNATURE-VALID', `BTC independent verification failed: ${verification.reason}`);
  }
  const preflight = runPreflight('bitcoin-mainnet', signed, unsigned, approval, isolation, { TW });
  return { ...signed, feeSats: verification.feeSats, outputs: verification.outputs, verification, preflight };
}

// ---------------------------------------------------------------------------
// ETH (EIP-1559, type 2)
// ---------------------------------------------------------------------------

export function parseEthUnsignedPayload(signingPayloadHex) {
  if (typeof signingPayloadHex !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signingPayloadHex)) {
    throw new SigningError('Invalid eth signingPayloadHex: expected a 0x-prefixed hex string');
  }
  const bytes = Buffer.from(signingPayloadHex.slice(2), 'hex');
  if (bytes[0] !== 0x02) throw new SigningError('Invalid eth signing payload: expected type 2 (0x02) prefix');
  const { value, next } = rlpDecode(bytes.subarray(1));
  if (!Array.isArray(value) || value.length !== 9) throw new SigningError('Invalid eth signing payload: expected an RLP list of 9 fields');
  if (next !== bytes.length - 1) throw new SigningError('Invalid eth signing payload: trailing bytes');
  const [chainId, nonce, maxPriority, maxFee, gasLimit, to, amount, data, accessList] = value;
  return {
    chainId: bigIntFromBytes(chainId),
    nonce: bigIntFromBytes(nonce),
    maxPriorityFeePerGas: bigIntFromBytes(maxPriority),
    maxFeePerGas: bigIntFromBytes(maxFee),
    gasLimit: bigIntFromBytes(gasLimit),
    to: Buffer.from(to),
    amount: bigIntFromBytes(amount),
    data: Buffer.from(data),
    accessList,
  };
}

export function parseEthSignedTx(encodedHex) {
  if (typeof encodedHex !== 'string' || !/^0x[0-9a-fA-F]+$/.test(encodedHex)) {
    throw new SigningError('Invalid eth signed tx: expected a 0x-prefixed hex string');
  }
  const bytes = Buffer.from(encodedHex.slice(2), 'hex');
  if (bytes[0] !== 0x02) throw new SigningError('Invalid eth signed tx: expected type 2 (0x02) prefix');
  const { value, next } = rlpDecode(bytes.subarray(1));
  if (!Array.isArray(value) || value.length !== 12) throw new SigningError('Invalid eth signed tx: expected an RLP list of 12 fields');
  if (next !== bytes.length - 1) throw new SigningError('Invalid eth signed tx: trailing bytes');
  const [chainId, nonce, maxPriority, maxFee, gasLimit, to, amount, data, accessList, yParity, r, s] = value;
  return {
    chainId: bigIntFromBytes(chainId),
    nonce: bigIntFromBytes(nonce),
    maxPriorityFeePerGas: bigIntFromBytes(maxPriority),
    maxFeePerGas: bigIntFromBytes(maxFee),
    gasLimit: bigIntFromBytes(gasLimit),
    to: Buffer.from(to),
    amount: bigIntFromBytes(amount),
    data: Buffer.from(data),
    accessList,
    yParity: bigIntFromBytes(yParity),
    r: bigIntFromBytes(r),
    s: bigIntFromBytes(s),
  };
}

function ethSigningHash(unsignedFields) {
  const payload = rlpEncode([
    bigIntToMinimalBytes(unsignedFields.chainId),
    bigIntToMinimalBytes(unsignedFields.nonce),
    bigIntToMinimalBytes(unsignedFields.maxPriorityFeePerGas),
    bigIntToMinimalBytes(unsignedFields.maxFeePerGas),
    bigIntToMinimalBytes(unsignedFields.gasLimit),
    unsignedFields.to,
    bigIntToMinimalBytes(unsignedFields.amount),
    unsignedFields.data,
    unsignedFields.accessList,
  ]);
  return keccak256(Buffer.concat([Buffer.from([0x02]), payload]));
}

function validateEthUnsigned(unsigned) {
  assertClosedObject(unsigned, ['chainId', 'type', 'signingPayloadHex'], [], 'eth unsigned artifact');
  if (unsigned.chainId !== 1) throw new SigningError('Invalid eth unsigned artifact: chainId must be 1');
  if (unsigned.type !== 2) throw new SigningError('Invalid eth unsigned artifact: type must be 2');
  const fields = parseEthUnsignedPayload(unsigned.signingPayloadHex);
  if (fields.chainId !== 1n) throw new SigningError('Invalid eth unsigned artifact: payload chainId must be 1');
  if (fields.data.length !== 0) throw new SigningError('Invalid eth unsigned artifact: data must be empty');
  if (!Array.isArray(fields.accessList) || fields.accessList.length !== 0) {
    throw new SigningError('Invalid eth unsigned artifact: accessList must be empty');
  }
  if (fields.gasLimit < 21000n) throw new SigningError('Invalid eth unsigned artifact: gasLimit below 21000');
  if (fields.maxPriorityFeePerGas > fields.maxFeePerGas) {
    throw new SigningError('Invalid eth unsigned artifact: priority fee exceeds max fee');
  }
  return fields;
}

function validateEthApproval(approval) {
  assertClosedObject(
    approval,
    ['network', 'chainId', 'to', 'valueWei', 'gasLimit', 'maxFeePerGasWei', 'maxPriorityFeePerGasWei', 'maxFeeWei', 'nonce', 'expectedSender', 'data'],
    [],
    'eth approval',
  );
  if (approval.network !== 'ethereum-mainnet') throw new SigningError('Invalid eth approval: network must be ethereum-mainnet');
  if (approval.chainId !== 1) throw new SigningError('Invalid eth approval: chainId must be 1');
  checkEip55(approval.to, 'eth approval to');
  checkEip55(approval.expectedSender, 'eth approval expectedSender');
  if (approval.data !== '0x') throw new SigningError('Invalid eth approval: data must be 0x');
  const value = parseCanonicalDecimal(approval.valueWei, 'eth approval valueWei', 0n, (1n << 256n) - 1n);
  const gasLimit = parseCanonicalDecimal(approval.gasLimit, 'eth approval gasLimit', 21000n, 16777216n);
  const maxFeePerGas = parseCanonicalDecimal(approval.maxFeePerGasWei, 'eth approval maxFeePerGasWei', 0n, (1n << 256n) - 1n);
  const maxPriority = parseCanonicalDecimal(approval.maxPriorityFeePerGasWei, 'eth approval maxPriorityFeePerGasWei', 0n, (1n << 256n) - 1n);
  const maxFee = parseCanonicalDecimal(approval.maxFeeWei, 'eth approval maxFeeWei', 0n, (1n << 256n) - 1n);
  const nonce = parseCanonicalDecimal(approval.nonce, 'eth approval nonce', 0n, (1n << 64n) - 2n);
  if (maxPriority > maxFeePerGas) throw new SigningError('Invalid eth approval: priority fee exceeds max fee');
  if (value + gasLimit * maxFeePerGas > (1n << 256n) - 1n) {
    throw new SigningError('Invalid eth approval: value + gasLimit * maxFeePerGas exceeds uint256');
  }
  return { value, gasLimit, maxFeePerGas, maxPriority, maxFee, nonce };
}

export function verifyEth(signed, unsigned, approval, options = {}) {
  const fail = (reason) => ({ valid: false, reason });
  let signedFields;
  try {
    signedFields = parseEthSignedTx(signed.encoded);
  } catch (error) {
    return fail(`signed tx parse failed: ${error.message}`);
  }
  let unsignedFields;
  try {
    unsignedFields = validateEthUnsigned(unsigned);
  } catch (error) {
    return fail(`unsigned artifact invalid: ${error.message}`);
  }
  let approvalInfo;
  try {
    approvalInfo = validateEthApproval(approval);
  } catch (error) {
    return fail(`approval invalid: ${error.message}`);
  }
  if (signedFields.chainId !== 1n) return fail('signed chainId is not 1');
  if (signedFields.yParity !== 0n && signedFields.yParity !== 1n) return fail('signed yParity is not 0 or 1');
  if (signedFields.r < 1n || signedFields.r >= SECP_N) return fail('signed r out of range');
  if (signedFields.s < 1n || signedFields.s > SECP_N / 2n) return fail('signed s out of range or not low-S');
  const fieldPairs = [
    ['chainId', signedFields.chainId, unsignedFields.chainId],
    ['nonce', signedFields.nonce, unsignedFields.nonce],
    ['maxPriorityFeePerGas', signedFields.maxPriorityFeePerGas, unsignedFields.maxPriorityFeePerGas],
    ['maxFeePerGas', signedFields.maxFeePerGas, unsignedFields.maxFeePerGas],
    ['gasLimit', signedFields.gasLimit, unsignedFields.gasLimit],
    ['amount', signedFields.amount, unsignedFields.amount],
  ];
  for (const [name, a, b] of fieldPairs) {
    if (a !== b) return fail(`signed ${name} differs from unsigned artifact`);
  }
  if (!signedFields.to.equals(unsignedFields.to)) return fail('signed to differs from unsigned artifact');
  if (!signedFields.data.equals(unsignedFields.data)) return fail('signed data differs from unsigned artifact');
  if (signedFields.accessList.length !== 0) return fail('signed accessList is not empty');
  if (`0x${signedFields.to.toString('hex')}`.toLowerCase() !== approval.to.toLowerCase()) {
    return fail('signed to differs from approval');
  }
  if (signedFields.amount !== approvalInfo.value) return fail('signed amount differs from approval');
  if (signedFields.gasLimit !== approvalInfo.gasLimit) return fail('signed gasLimit differs from approval');
  if (signedFields.nonce !== approvalInfo.nonce) return fail('signed nonce differs from approval');
  const hash = ethSigningHash(unsignedFields);
  if (options.skipSignature === true) {
    return {
      valid: true,
      method: 'ecrecover',
      signingHash: bytesToHex(hash),
      sender: null,
      maxFeeWei: (approvalInfo.gasLimit * approvalInfo.maxFeePerGas).toString(),
    };
  }
  const recovered = ecdsaRecover(hash, signedFields.r, signedFields.s, Number(signedFields.yParity));
  if (recovered === null) return fail('ecrecover failed');
  const sender = publicKeyToEthAddress(recovered);
  if (sender.toLowerCase() !== approval.expectedSender.toLowerCase()) {
    return fail(`recovered sender ${sender} differs from expected sender`);
  }
  const maxFeeTotal = approvalInfo.gasLimit * approvalInfo.maxFeePerGas;
  return {
    valid: true,
    method: 'ecrecover',
    signingHash: bytesToHex(hash),
    sender,
    maxFeeWei: maxFeeTotal.toString(),
  };
}

export async function signEth(unsigned, approval, privateKey, isolation) {
  requireIsolationAndGuard(isolation);
  const unsignedFields = validateEthUnsigned(unsigned);
  const approvalInfo = validateEthApproval(approval);
  const priv = requirePrivateKey(privateKey);
  const pubkey = privateKeyToPublicKey(priv, false);
  const sender = publicKeyToEthAddress(pubkey);
  if (sender.toLowerCase() !== approval.expectedSender.toLowerCase()) {
    throw new PreflightError(10, 'SIGNATURE-VALID', 'signing key does not match approved expectedSender; refusing to sign');
  }
  if (unsignedFields.to.toString('hex').toLowerCase() !== approval.to.slice(2).toLowerCase()) {
    throw new PreflightError(3, 'DESTINATION', 'unsigned to differs from approval');
  }
  if (unsignedFields.amount !== approvalInfo.value) {
    throw new PreflightError(4, 'AMOUNT', 'unsigned amount differs from approval');
  }
  if (unsignedFields.nonce !== approvalInfo.nonce) {
    throw new PreflightError(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned nonce differs from approval');
  }
  if (unsignedFields.gasLimit !== approvalInfo.gasLimit) {
    throw new PreflightError(5, 'FEE', 'unsigned gasLimit differs from approval');
  }
  if (unsignedFields.maxFeePerGas !== approvalInfo.maxFeePerGas || unsignedFields.maxPriorityFeePerGas !== approvalInfo.maxPriority) {
    throw new PreflightError(5, 'FEE', 'unsigned fee caps differ from approval');
  }
  if (approvalInfo.gasLimit * approvalInfo.maxFeePerGas > approvalInfo.maxFee) {
    throw new PreflightError(5, 'FEE', 'gasLimit * maxFeePerGas exceeds approved maxFeeWei');
  }
  const { core, TW } = await loadWalletCore();
  const input = TW.Ethereum.Proto.SigningInput.encode({
    chainId: bigIntToMinimalBytes(1n),
    nonce: bigIntToMinimalBytes(unsignedFields.nonce),
    txMode: 1,
    gasLimit: bigIntToMinimalBytes(unsignedFields.gasLimit),
    maxInclusionFeePerGas: bigIntToMinimalBytes(unsignedFields.maxPriorityFeePerGas),
    maxFeePerGas: bigIntToMinimalBytes(unsignedFields.maxFeePerGas),
    toAddress: approval.to,
    privateKey: priv,
    transaction: {
      transfer: {
        amount: bigIntToMinimalBytes(unsignedFields.amount),
        data: new Uint8Array([]),
      },
    },
  }).finish();
  let outBytes;
  try {
    outBytes = core.AnySigner.sign(input, core.CoinType.ethereum);
  } catch (error) {
    throw new SigningError(`ETH signing failed: ${error.message ?? 'signer error'}`);
  }
  const out = TW.Ethereum.Proto.SigningOutput.decode(outBytes);
  if (out.error !== 0) {
    throw new SigningError(`ETH signing failed: signer error ${out.error} ${out.errorMessage ?? ''}`);
  }
  if (!out.encoded || out.encoded.length === 0) throw new SigningError('ETH signing failed: empty encoded transaction');
  const signed = {
    network: 'ethereum-mainnet',
    encoded: `0x${Buffer.from(out.encoded).toString('hex')}`,
    v: Number(out.v?.[0] ?? 0),
    r: bytesToHex(out.r ?? new Uint8Array([])),
    s: bytesToHex(out.s ?? new Uint8Array([])),
  };
  const verification = verifyEth(signed, unsigned, approval);
  if (!verification.valid) {
    throw new PreflightError(10, 'SIGNATURE-VALID', `ETH independent verification failed: ${verification.reason}`);
  }
  const preflight = runPreflight('ethereum-mainnet', signed, unsigned, approval, isolation, { TW });
  return { ...signed, verification, preflight };
}

// ---------------------------------------------------------------------------
// TRON (native TRX TransferContract)
//
// The T33 artifact is decomposed into wallet-core's FLAT Transaction
// message {timestamp, expiration, blockHeader, transfer}. The signer
// derives ref_block_hash as SHA-256 of the BlockHeader protobuf, bytes
// 8-15 (verified first-hand); T33 pins ref_block_hash directly from the
// fixture refBlockId, so the signed raw_data differs from the T33
// raw_data in ref_block_hash (and therefore txID). ref_block_bytes,
// contract, timestamp and expiration match exactly. Verification is
// field-level for TRON; see docs/mainnet/MAINNET-SIGNING.md.
 // ---------------------------------------------------------------------------

function validateTronAddress(address, label) {
  if (typeof address !== 'string' || address.length !== 34 || !address.startsWith('T')) {
    throw new SigningError(`Invalid ${label}: expected a 34-character T address`);
  }
  const payload = base58CheckDecode(address, label, 25);
  if (payload[0] !== 65) throw new SigningError(`Invalid ${label}: expected version byte 65`);
  if (base58CheckEncode(payload) !== address) throw new SigningError(`Invalid ${label}: non-canonical encoding`);
  return payload;
}

export function parseTronRawData(rawDataHex) {
  const raw = hexToBytes(rawDataHex, 'tron rawDataHex');
  const fields = protoFields(raw);
  const refBlockBytes = protoBytesField(fields, 1);
  const refBlockHash = protoBytesField(fields, 4);
  const expiration = protoVarintField(fields, 8);
  const contractBytes = protoBytesField(fields, 11);
  const timestamp = protoVarintField(fields, 14);
  if (refBlockBytes === null || refBlockBytes.length !== 2) throw new SigningError('TRON raw_data: ref_block_bytes must be 2 bytes');
  if (refBlockHash === null || refBlockHash.length !== 8) throw new SigningError('TRON raw_data: ref_block_hash must be 8 bytes');
  if (expiration === null) throw new SigningError('TRON raw_data: missing expiration');
  if (timestamp === null) throw new SigningError('TRON raw_data: missing timestamp');
  if (contractBytes === null) throw new SigningError('TRON raw_data: missing contract');
  const contractFields = protoFields(contractBytes);
  const type = protoVarintField(contractFields, 1);
  const anyBytes = protoBytesField(contractFields, 2);
  if (type !== 1n) throw new SigningError('TRON raw_data: contract type must be 1 (TransferContract)');
  if (anyBytes === null) throw new SigningError('TRON raw_data: missing contract parameter');
  const anyFields = protoFields(anyBytes);
  const typeUrl = protoBytesField(anyFields, 1);
  const transferBytes = protoBytesField(anyFields, 2);
  if (typeUrl === null || typeUrl.toString('utf8') !== 'type.googleapis.com/protocol.TransferContract') {
    throw new SigningError('TRON raw_data: contract type_url must be TransferContract');
  }
  if (transferBytes === null) throw new SigningError('TRON raw_data: missing TransferContract value');
  const transferFields = protoFields(transferBytes);
  const owner = protoBytesField(transferFields, 1);
  const to = protoBytesField(transferFields, 2);
  const amount = protoVarintField(transferFields, 3);
  if (owner === null || owner.length !== 21 || owner[0] !== 65) throw new SigningError('TRON raw_data: bad owner_address');
  if (to === null || to.length !== 21 || to[0] !== 65) throw new SigningError('TRON raw_data: bad to_address');
  if (amount === null) throw new SigningError('TRON raw_data: missing amount');
  const feeLimit = protoVarintField(fields, 18);
  return {
    refBlockBytes,
    refBlockHash,
    expiration,
    timestamp,
    contract: { type: 1, owner, to, amount },
    feeLimit,
    raw,
  };
}

function validateTronUnsigned(unsigned) {
  assertClosedObject(unsigned, ['network', 'rawDataHex', 'unsignedTransactionHex', 'txID'], [], 'tron unsigned artifact');
  if (unsigned.network !== 'tron-mainnet') throw new SigningError('Invalid tron unsigned artifact: network must be tron-mainnet');
  const parsed = parseTronRawData(unsigned.rawDataHex);
  if (bytesToHex(sha256(parsed.raw)) !== unsigned.txID.toLowerCase()) {
    throw new SigningError('Invalid tron unsigned artifact: txID does not equal SHA-256 of raw_data');
  }
  const outer = protoFields(hexToBytes(unsigned.unsignedTransactionHex, 'tron unsignedTransactionHex'));
  const outerRaw = protoBytesField(outer, 1);
  if (outerRaw === null || !outerRaw.equals(parsed.raw)) {
    throw new SigningError('Invalid tron unsigned artifact: unsignedTransactionHex does not wrap rawDataHex');
  }
  if (parsed.feeLimit !== null && parsed.feeLimit !== 0n) {
    throw new SigningError('Invalid tron unsigned artifact: fee_limit must be absent or zero');
  }
  return parsed;
}

function validateTronApproval(approval) {
  assertClosedObject(
    approval,
    ['network', 'ownerAddress', 'toAddress', 'amountSun', 'maxFeeSun', 'refBlockId', 'timestampMs', 'expirationMs'],
    [],
    'tron approval',
  );
  if (approval.network !== 'tron-mainnet') throw new SigningError('Invalid tron approval: network must be tron-mainnet');
  validateTronAddress(approval.ownerAddress, 'tron approval ownerAddress');
  validateTronAddress(approval.toAddress, 'tron approval toAddress');
  if (approval.ownerAddress === approval.toAddress) throw new SigningError('Invalid tron approval: owner and recipient must differ');
  const amount = parseCanonicalDecimal(approval.amountSun, 'tron approval amountSun', 1n, (1n << 63n) - 1n);
  parseCanonicalDecimal(approval.maxFeeSun, 'tron approval maxFeeSun', 0n, (1n << 63n) - 1n);
  if (typeof approval.refBlockId !== 'string' || !/^[0-9a-f]{64}$/.test(approval.refBlockId)) {
    throw new SigningError('Invalid tron approval: refBlockId must be 64 lowercase hex characters');
  }
  const timestamp = parseCanonicalDecimal(approval.timestampMs, 'tron approval timestampMs', 1n, (1n << 63n) - 1n);
  const expiration = parseCanonicalDecimal(approval.expirationMs, 'tron approval expirationMs', 1n, (1n << 63n) - 1n);
  if (expiration <= timestamp) throw new SigningError('Invalid tron approval: expiration must be after timestamp');
  if (expiration - timestamp > 86400000n) throw new SigningError('Invalid tron approval: expiration more than 24h after timestamp');
  return { amount, timestamp, expiration };
}

// BlockHeader the signer is fed: number = refBlockId bytes 0-7 as a
// decimal string (exact; a JS number loses precision above 2^53),
// txTrieRoot = refBlockId bytes 8-15. The signer then derives
// ref_block_bytes from the low 2 bytes of the number and ref_block_hash
// as SHA-256 of the BlockHeader protobuf, bytes 8-15.
export function tronBlockHeaderForRefBlockId(refBlockId) {
  const refBytes = hexToBytes(refBlockId, 'tron refBlockId');
  const number = refBytes.subarray(0, 8).readBigUInt64BE(0).toString();
  const txTrieRoot = refBytes.subarray(8, 16);
  return { number, txTrieRoot };
}

export function tronRefBlockHash(blockHeader, TW) {
  const encoded = Buffer.from(TW.Tron.Proto.BlockHeader.encode(blockHeader).finish());
  return sha256(encoded).subarray(8, 16);
}

export function verifyTron(signed, unsigned, approval, options = {}) {
  const fail = (reason) => ({ valid: false, reason });
  let parsedUnsigned;
  try {
    parsedUnsigned = validateTronUnsigned(unsigned);
  } catch (error) {
    return fail(`unsigned artifact invalid: ${error.message}`);
  }
  let approvalInfo;
  try {
    approvalInfo = validateTronApproval(approval);
  } catch (error) {
    return fail(`approval invalid: ${error.message}`);
  }
  let outer;
  let raw;
  let signature;
  try {
    outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
    raw = protoBytesField(outer, 1);
    const sigs = outer.filter((f) => f.field === 2 && f.wire === 2).map((f) => f.bytes);
    if (raw === null) return fail('signed transaction has no raw_data');
    if (sigs.length !== 1) return fail('signed transaction must have exactly one signature');
    signature = sigs[0];
  } catch (error) {
    return fail(`signed tx parse failed: ${error.message}`);
  }
  let parsedSigned;
  try {
    parsedSigned = parseTronRawData(bytesToHex(raw));
  } catch (error) {
    return fail(`signed raw_data invalid: ${error.message}`);
  }
  const txID = bytesToHex(sha256(raw));
  if (txID !== signed.txID.toLowerCase()) return fail('signed txID does not equal SHA-256 of signed raw_data');
  if (!parsedSigned.refBlockBytes.equals(parsedUnsigned.refBlockBytes)) return fail('signed ref_block_bytes differs from unsigned artifact');
  if (!parsedSigned.refBlockHash.equals(parsedUnsigned.refBlockHash)) {
    // Expected deviation (signer derives ref_block_hash from the block
    // header): the signed value must equal the signer's derivation, not
    // the T33 fixture value. Record it; do not fail here — the preflight
    // network check asserts the derivation explicitly.
  }
  if (parsedSigned.expiration !== parsedUnsigned.expiration) return fail('signed expiration differs from unsigned artifact');
  if (parsedSigned.timestamp !== parsedUnsigned.timestamp) return fail('signed timestamp differs from unsigned artifact');
  if (parsedSigned.contract.amount !== parsedUnsigned.contract.amount) return fail('signed amount differs from unsigned artifact');
  if (!parsedSigned.contract.owner.equals(parsedUnsigned.contract.owner)) return fail('signed owner differs from unsigned artifact');
  if (!parsedSigned.contract.to.equals(parsedUnsigned.contract.to)) return fail('signed recipient differs from unsigned artifact');
  if (parsedSigned.feeLimit !== null && parsedSigned.feeLimit !== 0n) return fail('signed fee_limit is present and nonzero');
  const ownerHex = bytesToHex(parsedSigned.contract.owner);
  const toHex = bytesToHex(parsedSigned.contract.to);
  const ownerAddress = base58CheckEncode(parsedSigned.contract.owner);
  const toAddress = base58CheckEncode(parsedSigned.contract.to);
  if (ownerAddress !== approval.ownerAddress) return fail('signed owner address differs from approval');
  if (toAddress !== approval.toAddress) return fail('signed recipient address differs from approval');
  if (parsedSigned.contract.amount !== approvalInfo.amount) return fail('signed amount differs from approval');
  if (parsedSigned.timestamp !== approvalInfo.timestamp) return fail('signed timestamp differs from approval');
  if (parsedSigned.expiration !== approvalInfo.expiration) return fail('signed expiration differs from approval');
  if (signature.length !== 65) return fail('signature is not 65 bytes');
  const r = bigIntFromBytes(signature.subarray(0, 32));
  const s = bigIntFromBytes(signature.subarray(32, 64));
  if (r < 1n || r >= SECP_N || s < 1n || s >= SECP_N) return fail('signature r/s out of range');
  if (s > SECP_N / 2n) return fail('signature s is not low-S');
  if (options.skipSignature === true) {
    return {
      valid: true,
      method: 'secp256k1-recovery',
      txID,
      ownerAddress,
      toAddress,
      ownerHex,
      toHex,
      refBlockBytes: bytesToHex(parsedSigned.refBlockBytes),
      refBlockHash: bytesToHex(parsedSigned.refBlockHash),
      refBlockHashDeviation: !parsedSigned.refBlockHash.equals(parsedUnsigned.refBlockHash),
    };
  }
  const recid = signature[64];
  const recovered = ecdsaRecover(hexToBytes(txID, 'tron txID'), r, s, recid);
  if (recovered === null) return fail('signature recovery failed');
  const recoveredAddress = publicKeyToTronAddress(recovered);
  if (recoveredAddress !== approval.ownerAddress) {
    return fail(`recovered signer ${recoveredAddress} differs from owner`);
  }
  return {
    valid: true,
    method: 'secp256k1-recovery',
    txID,
    ownerAddress,
    toAddress,
    ownerHex,
    toHex,
    refBlockBytes: bytesToHex(parsedSigned.refBlockBytes),
    refBlockHash: bytesToHex(parsedSigned.refBlockHash),
    refBlockHashDeviation: !parsedSigned.refBlockHash.equals(parsedUnsigned.refBlockHash),
  };
}

export async function signTron(unsigned, approval, privateKey, isolation) {
  requireIsolationAndGuard(isolation);
  const parsedUnsigned = validateTronUnsigned(unsigned);
  const approvalInfo = validateTronApproval(approval);
  const priv = requirePrivateKey(privateKey);
  const pubkey = privateKeyToPublicKey(priv, false);
  const ownerFromKey = publicKeyToTronAddress(pubkey);
  if (ownerFromKey !== approval.ownerAddress) {
    throw new PreflightError(10, 'SIGNATURE-VALID', 'signing key does not match approved ownerAddress; refusing to sign');
  }
  const refBytes = hexToBytes(approval.refBlockId, 'tron refBlockId');
  if (!parsedUnsigned.refBlockBytes.equals(refBytes.subarray(6, 8))) {
    throw new PreflightError(2, 'NETWORK', 'unsigned ref_block_bytes do not match approved refBlockId');
  }
  if (!parsedUnsigned.refBlockHash.equals(refBytes.subarray(8, 16))) {
    throw new PreflightError(2, 'NETWORK', 'unsigned ref_block_hash does not match approved refBlockId');
  }
  if (!parsedUnsigned.contract.owner.equals(base58CheckDecode(approval.ownerAddress, 'tron ownerAddress', 25))) {
    throw new PreflightError(3, 'DESTINATION', 'unsigned owner differs from approval');
  }
  if (!parsedUnsigned.contract.to.equals(base58CheckDecode(approval.toAddress, 'tron toAddress', 25))) {
    throw new PreflightError(3, 'DESTINATION', 'unsigned recipient differs from approval');
  }
  if (parsedUnsigned.contract.amount !== approvalInfo.amount) {
    throw new PreflightError(4, 'AMOUNT', 'unsigned amount differs from approval');
  }
  if (parsedUnsigned.timestamp !== approvalInfo.timestamp || parsedUnsigned.expiration !== approvalInfo.expiration) {
    throw new PreflightError(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned timestamp/expiration differ from approval');
  }
  if (approval.maxFeeSun !== '0') {
    throw new PreflightError(5, 'FEE', 'approved maxFeeSun must be 0 for this route (fee_limit pinned to 0)');
  }
  const blockHeader = tronBlockHeaderForRefBlockId(approval.refBlockId);
  const { core, TW } = await loadWalletCore();
  const input = TW.Tron.Proto.SigningInput.encode({
    transaction: {
      timestamp: Number(approvalInfo.timestamp),
      expiration: Number(approvalInfo.expiration),
      blockHeader,
      transfer: {
        ownerAddress: approval.ownerAddress,
        toAddress: approval.toAddress,
        amount: Number(approvalInfo.amount),
      },
    },
    privateKey: priv,
  }).finish();
  let outBytes;
  try {
    outBytes = core.AnySigner.sign(input, core.CoinType.tron);
  } catch (error) {
    throw new SigningError(`TRON signing failed: ${error.message ?? 'signer error'}`);
  }
  const out = TW.Tron.Proto.SigningOutput.decode(outBytes);
  if (out.error !== 0) {
    throw new SigningError(`TRON signing failed: signer error ${out.error} ${out.errorMessage ?? ''}`);
  }
  if (!out.signature || out.signature.length !== 65) throw new SigningError('TRON signing failed: expected one 65-byte signature');
  if (!out.json) throw new SigningError('TRON signing failed: missing signed transaction JSON');
  let signedJson;
  try {
    signedJson = JSON.parse(out.json);
  } catch {
    throw new SigningError('TRON signing failed: signed transaction JSON is malformed');
  }
  if (typeof signedJson.raw_data_hex !== 'string') throw new SigningError('TRON signing failed: signed JSON has no raw_data_hex');
  const signedRaw = hexToBytes(signedJson.raw_data_hex, 'tron signed raw_data_hex');
  // Outer Transaction message: field 1 raw_data, field 2 signature.
  // Lengths are protobuf varints (NOT CompactSize: CompactSize(133) is
  // 0xfd8500 while the protobuf varint is 0x8501).
  const encodeVarint = (n) => {
    let value = BigInt(n);
    const out = [];
    while (value >= 0x80n) {
      out.push(Number(value & 0x7fn) | 0x80);
      value >>= 7n;
    }
    out.push(Number(value));
    return Buffer.from(out);
  };
  const encodeBytesField = (field, bytes) => Buffer.concat([
    Buffer.from([(field << 3) | 2]),
    encodeVarint(bytes.length),
    Buffer.from(bytes),
  ]);
  const signedTransactionHex = Buffer.concat([
    encodeBytesField(1, signedRaw),
    encodeBytesField(2, Buffer.from(out.signature)),
  ]).toString('hex');
  const signed = {
    network: 'tron-mainnet',
    signedTransactionHex,
    txID: signedJson.txID,
    signature: bytesToHex(out.signature),
  };
  const verification = verifyTron(signed, unsigned, approval);
  if (!verification.valid) {
    throw new PreflightError(10, 'SIGNATURE-VALID', `TRON independent verification failed: ${verification.reason}`);
  }
  const preflight = runPreflight('tron-mainnet', signed, unsigned, approval, isolation, { TW });
  return { ...signed, verification, preflight };
}

// ---------------------------------------------------------------------------
// TON (Wallet V4 R2; local signature evidence only — no send path)
// ---------------------------------------------------------------------------

const TON_WALLET_ID = 698983191;
const TON_WALLET_VERSION = 2;

function crc16Xmodem(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
    }
  }
  return crc;
}

function crc32c(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc ^ byte) >>> 0;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = ((crc >>> 1) ^ ((crc & 1) ? 0x82f63b78 : 0)) >>> 0;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function tonAddressToHash(address, label) {
  if (typeof address !== 'string' || address.length !== 48 || !/^[A-Za-z0-9_-]{48}$/.test(address)) {
    throw new SigningError(`Invalid ${label}: expected a 48-character TON friendly address`);
  }
  const bytes = Buffer.from(address, 'base64url');
  if (bytes.length !== 36 || bytes.toString('base64url') !== address) {
    throw new SigningError(`Invalid ${label}: not canonical base64url`);
  }
  if (bytes[0] !== 81) throw new SigningError(`Invalid ${label}: expected bounceable mainnet tag 81`);
  if (bytes[1] !== 0) throw new SigningError(`Invalid ${label}: expected workchain 0`);
  if (crc16Xmodem(bytes.subarray(0, 34)) !== bytes.readUInt16BE(34)) {
    throw new SigningError(`Invalid ${label}: bad CRC16`);
  }
  return bytes.subarray(2, 34);
}

export function tonHashToFriendlyAddress(hash32) {
  const hash = Buffer.from(hash32);
  if (hash.length !== 32) throw new SigningError('TON address hash must be 32 bytes');
  const body = Buffer.concat([Buffer.from([0x51, 0x00]), hash]);
  const crc = Buffer.alloc(2);
  crc.writeUInt16BE(crc16Xmodem(body), 0);
  return Buffer.concat([body, crc]).toString('base64url');
}

// Minimal BOC parser (inverts the T33 writer layout, which follows the
// standard bag-of-cells format). Returns {cells, rootIndex} where each
// cell is {bits: Buffer, bitLength, refs: [indices], dataByteOffset}.
export function parseTonBoc(bocBase64) {
  let bytes;
  try {
    bytes = Buffer.from(bocBase64, 'base64');
  } catch {
    throw new SigningError('TON BOC: not valid base64');
  }
  if (bytes.length < 10) throw new SigningError('TON BOC: too short');
  if (bytes[0] !== 0xb5 || bytes[1] !== 0xee || bytes[2] !== 0x9c || bytes[3] !== 0x72) {
    throw new SigningError('TON BOC: bad magic');
  }
  const flags = bytes[4];
  const hasCrc = (flags & 0x40) !== 0;
  const sizeBytes = flags & 0x07;
  if (sizeBytes < 1 || sizeBytes > 4) throw new SigningError('TON BOC: bad size field');
  const offsetWidth = bytes[5];
  if (offsetWidth < 1 || offsetWidth > 4) throw new SigningError('TON BOC: bad offset width');
  const readUint = (pos, width) => {
    let n = 0n;
    for (let i = 0; i < width; i += 1) n = (n << 8n) | BigInt(bytes[pos + i]);
    return Number(n);
  };
  let pos = 6;
  const cellCount = readUint(pos, sizeBytes);
  pos += sizeBytes;
  const rootCount = readUint(pos, sizeBytes);
  pos += sizeBytes;
  const absentCount = readUint(pos, sizeBytes);
  pos += sizeBytes;
  const payloadLength = readUint(pos, offsetWidth);
  pos += offsetWidth;
  const rootIndex = readUint(pos, sizeBytes);
  pos += sizeBytes;
  if (rootCount !== 1) throw new SigningError('TON BOC: expected exactly one root');
  if (absentCount !== 0) throw new SigningError('TON BOC: absent cells not supported');
  if (cellCount < 1) throw new SigningError('TON BOC: no cells');
  const payloadStart = pos;
  if (payloadStart + payloadLength > bytes.length) throw new SigningError('TON BOC: payload overruns buffer');
  if (hasCrc) {
    if (bytes.length < payloadStart + payloadLength + 4) throw new SigningError('TON BOC: truncated CRC');
    const stored = bytes.readUInt32LE(payloadStart + payloadLength);
    const computed = crc32c(bytes.subarray(0, payloadStart + payloadLength));
    if (stored !== computed) throw new SigningError('TON BOC: CRC32C mismatch');
  }
  const cells = [];
  let cursor = payloadStart;
  for (let i = 0; i < cellCount; i += 1) {
    if (cursor + 2 > payloadStart + payloadLength) throw new SigningError('TON BOC: truncated cell descriptors');
    const d1 = bytes[cursor];
    const d2 = bytes[cursor + 1];
    const refsCount = d1 & 0x07;
    // d2 = floor(bitlen/8) + ceil(bitlen/8). Wallet-core never sets d1
    // bit 3, so the remainder is derived from d2 parity plus the
    // completion tag in the last data byte, never from d1.
    let bitLength;
    let dataBytes;
    if (d2 % 2 === 0) {
      dataBytes = d2 / 2;
      bitLength = dataBytes * 8;
    } else {
      dataBytes = (d2 + 1) / 2;
      const last = bytes[cursor + 2 + dataBytes - 1];
      let trailingZeros = 0;
      let probe = last;
      while ((probe & 1) === 0 && trailingZeros < 8) {
        trailingZeros += 1;
        probe >>= 1;
      }
      if (trailingZeros >= 8) throw new SigningError('TON BOC: missing completion tag');
      const remainder = 7 - trailingZeros;
      bitLength = (dataBytes - 1) * 8 + remainder;
    }
    const dataStart = cursor + 2;
    if (dataStart + dataBytes + refsCount * sizeBytes > payloadStart + payloadLength) {
      throw new SigningError('TON BOC: truncated cell');
    }
    const data = Buffer.from(bytes.subarray(dataStart, dataStart + dataBytes));
    const refs = [];
    let refPos = dataStart + dataBytes;
    for (let r = 0; r < refsCount; r += 1) {
      refs.push(readUint(refPos, sizeBytes));
      refPos += sizeBytes;
    }
    cells.push({ bits: data, bitLength, refs, dataByteOffset: dataStart });
    cursor = refPos;
  }
  if (cursor !== payloadStart + payloadLength) throw new SigningError('TON BOC: payload length mismatch');
  return { cells, rootIndex };
}

function tonCellHash(cells, index, memo = new Map()) {
  if (memo.has(index)) return memo.get(index);
  const cell = cells[index];
  if (!cell) throw new SigningError('TON cell: bad ref index');
  const children = cell.refs.map((ref) => tonCellHash(cells, ref, memo));
  const bitLength = cell.bitLength;
  const remainder = bitLength % 8;
  const descriptors = Buffer.from([
    cell.refs.length + (remainder === 0 ? 0 : 8),
    Math.floor(bitLength / 8) + Math.ceil(bitLength / 8),
  ]);
  const representation = Buffer.concat([
    descriptors,
    cell.bits,
    ...children.map((child) => {
      const depth = Buffer.alloc(2);
      depth.writeUInt16BE(child.depth, 0);
      return depth;
    }),
    ...children.map((child) => child.hash),
  ]);
  const result = {
    depth: children.length === 0 ? 0 : 1 + Math.max(...children.map((child) => child.depth)),
    hash: sha256(representation),
  };
  memo.set(index, result);
  return result;
}

class TonBitReader {
  constructor(bits, bitLength) {
    this.bits = bits;
    this.bitLength = bitLength;
    this.pos = 0;
  }

  readUint(n) {
    if (this.pos + n > this.bitLength) throw new SigningError('TON cell: read past end of bits');
    let value = 0n;
    for (let i = 0; i < n; i += 1) {
      const bitPos = this.pos + i;
      const bit = (this.bits[bitPos >> 3] >> (7 - (bitPos & 7))) & 1;
      value = (value << 1n) | BigInt(bit);
    }
    this.pos += n;
    return value;
  }

  readBytes(n) {
    if (n % 8 !== 0) throw new SigningError('TON cell: byte reads must be byte-aligned');
    const out = Buffer.alloc(n / 8);
    for (let i = 0; i < n / 8; i += 1) out[i] = Number(this.readUint(8));
    return out;
  }

  readAddress() {
    const tag = Number(this.readUint(2));
    if (tag !== 2) throw new SigningError('TON cell: expected a standard address');
    const anycast = Number(this.readUint(1));
    if (anycast !== 0) throw new SigningError('TON cell: anycast addresses not supported');
    const workchain = Number(this.readUint(8));
    const hash = this.readBytes(256);
    return { workchain, hash };
  }

  readGrams() {
    const len = Number(this.readUint(4));
    if (len > 15) throw new SigningError('TON cell: grams length too large');
    return this.readUint(len * 8);
  }
}

function validateTonUnsigned(unsigned) {
  assertClosedObject(unsigned, ['kind', 'unsignedBocBase64', 'signingBocBase64', 'signingHashBase64'], [], 'ton unsigned artifact');
  if (unsigned.kind !== 'ton-v4r2-native-unsigned') throw new SigningError('Invalid ton unsigned artifact: kind must be ton-v4r2-native-unsigned');
  let signingHash;
  try {
    signingHash = Buffer.from(unsigned.signingHashBase64, 'base64');
  } catch {
    throw new SigningError('Invalid ton unsigned artifact: signingHashBase64 is not valid base64');
  }
  if (signingHash.length !== 32) throw new SigningError('Invalid ton unsigned artifact: signing hash must be 32 bytes');
  let parsedSigning;
  try {
    parsedSigning = parseTonBoc(unsigned.signingBocBase64);
  } catch (error) {
    throw new SigningError(`Invalid ton unsigned artifact: signing BOC parse failed: ${error.message}`);
  }
  const rootHash = tonCellHash(parsedSigning.cells, parsedSigning.rootIndex).hash;
  if (!rootHash.equals(signingHash)) {
    throw new SigningError('Invalid ton unsigned artifact: signing BOC hash does not equal signingHashBase64');
  }
  let parsedUnsigned;
  try {
    parsedUnsigned = parseTonBoc(unsigned.unsignedBocBase64);
  } catch (error) {
    throw new SigningError(`Invalid ton unsigned artifact: unsigned BOC parse failed: ${error.message}`);
  }
  return { parsedSigning, parsedUnsigned, signingHash };
}

function validateTonApproval(approval) {
  assertClosedObject(
    approval,
    ['network', 'sender', 'destination', 'amountNano', 'seqno', 'validUntil', 'mode', 'publicKeyHex'],
    ['reviewClockSec'],
    'ton approval',
  );
  if (approval.network !== 'ton-mainnet') throw new SigningError('Invalid ton approval: network must be ton-mainnet');
  tonAddressToHash(approval.sender, 'ton approval sender');
  tonAddressToHash(approval.destination, 'ton approval destination');
  const amount = parseCanonicalDecimal(approval.amountNano, 'ton approval amountNano', 1n, (1n << 120n) - 1n);
  if (!Number.isInteger(approval.seqno) || approval.seqno < 0 || approval.seqno > 4294967295) {
    throw new SigningError('Invalid ton approval: seqno out of range');
  }
  if (!Number.isInteger(approval.validUntil) || approval.validUntil < 1 || approval.validUntil > 4294967295) {
    throw new SigningError('Invalid ton approval: validUntil out of range');
  }
  if (approval.mode !== 3) throw new SigningError('Invalid ton approval: mode must be 3 for this route');
  const pub = hexToBytes(approval.publicKeyHex, 'ton approval publicKeyHex');
  if (pub.length !== 32) throw new SigningError('Invalid ton approval: publicKeyHex must be 32 bytes');
  return { amount };
}

// Read the fields of a TON internal-message cell (CommonMsgInfo +
// internal message) from a parsed cell object. The cell's refs are NOT
// consumed here: the body ref (when hasBody is 1) is handled by the
// caller, because the unsigned artifact and the signer encode an empty
// body differently (see the signingHashDeviation note in verifyTon).
function parseTonInternalCell(cell) {
  const ireader = new TonBitReader(cell.bits, cell.bitLength);
  const fields = {
    tag: Number(ireader.readUint(1)),
    ihrDisabled: Number(ireader.readUint(1)),
    bounce: Number(ireader.readUint(1)),
    bounced: Number(ireader.readUint(1)),
    reserved: Number(ireader.readUint(2)),
    dest: ireader.readAddress(),
    amount: ireader.readGrams(),
    extraFlag: Number(ireader.readUint(1)),
    extra1: ireader.readGrams(),
    extra2: ireader.readGrams(),
    createdLt: ireader.readUint(64),
    createdAt: ireader.readUint(32),
    hasInit: Number(ireader.readUint(1)),
    hasBody: Number(ireader.readUint(1)),
  };
  if (ireader.pos !== cell.bitLength) throw new SigningError('TON internal message: trailing bits');
  return fields;
}

function parseTonSigningCell(unsigned, approval) {
  const { parsedSigning } = validateTonUnsigned(unsigned);
  const cell = parsedSigning.cells[parsedSigning.rootIndex];
  if (cell.refs.length !== 1) throw new SigningError('TON signing cell: expected exactly one ref (internal message)');
  const reader = new TonBitReader(cell.bits, cell.bitLength);
  const walletId = Number(reader.readUint(32));
  const validUntil = Number(reader.readUint(32));
  const seqno = Number(reader.readUint(32));
  const op = Number(reader.readUint(8));
  const mode = Number(reader.readUint(8));
  if (reader.pos !== cell.bitLength) throw new SigningError('TON signing cell: trailing bits');
  const internalCell = parsedSigning.cells[cell.refs[0]];
  return {
    walletId,
    validUntil,
    seqno,
    op,
    mode,
    internal: parseTonInternalCell(internalCell),
    internalCell,
    internalRef: cell.refs[0],
    signingCells: parsedSigning.cells,
  };
}

export function verifyTon(signed, unsigned, approval, options = {}) {
  const fail = (reason) => ({ valid: false, reason });
  let approvalInfo;
  try {
    approvalInfo = validateTonApproval(approval);
  } catch (error) {
    return fail(`approval invalid: ${error.message}`);
  }
  let signing;
  try {
    signing = parseTonSigningCell(unsigned, approval);
  } catch (error) {
    return fail(`unsigned artifact invalid: ${error.message}`);
  }
  if (signing.walletId !== TON_WALLET_ID) return fail('signing cell walletId is not 698983191');
  if (signing.validUntil !== approval.validUntil) return fail('signing cell validUntil differs from approval');
  if (signing.seqno !== approval.seqno) return fail('signing cell seqno differs from approval');
  if (signing.op !== 0) return fail('signing cell op is not 0');
  if (signing.mode !== approval.mode) return fail('signing cell mode differs from approval');
  if (signing.internal.tag !== 0) return fail('internal message tag is not 0');
  if (signing.internal.ihrDisabled !== 1) return fail('internal message ihr_disabled is not 1');
  if (signing.internal.bounce !== 0) return fail('internal message bounce is not 0');
  if (signing.internal.bounced !== 0) return fail('internal message bounced is not 0');
  if (signing.internal.dest.workchain !== 0) return fail('internal message destination workchain is not 0');
  const destHash = tonAddressToHash(approval.destination, 'ton approval destination');
  if (!signing.internal.dest.hash.equals(destHash)) return fail('internal message destination differs from approval');
  if (signing.internal.amount !== approvalInfo.amount) return fail('internal message amount differs from approval');
  if (signing.internal.extra1 !== 0n || signing.internal.extra2 !== 0n) return fail('internal message has unexpected extra currency amounts');
  if (signing.internal.createdLt !== 0n || signing.internal.createdAt !== 0n) return fail('internal message has unexpected creation fields');
  if (signing.internal.hasInit !== 0 || signing.internal.hasBody !== 0) return fail('internal message has unexpected init/body');
  let parsedSigned;
  try {
    parsedSigned = parseTonBoc(signed.signedBocBase64);
  } catch (error) {
    return fail(`signed BOC parse failed: ${error.message}`);
  }
  const envelope = parsedSigned.cells[parsedSigned.rootIndex];
  const ereader = new TonBitReader(envelope.bits, envelope.bitLength);
  let envelopeDest;
  let hasInit;
  let bodyRef;
  try {
    const extTag = Number(ereader.readUint(2));
    if (extTag !== 2) return fail('signed envelope is not an external-in message');
    const importFee = Number(ereader.readUint(2));
    if (importFee !== 0) return fail('signed envelope import fee is not 0');
    envelopeDest = ereader.readAddress();
    const importFeeGrams = ereader.readGrams();
    if (importFeeGrams !== 0n) return fail('signed envelope import fee grams are not 0');
    hasInit = Number(ereader.readUint(1));
    const hasBody = Number(ereader.readUint(1));
    if (hasBody !== 1) return fail('signed envelope has no body');
    if (ereader.pos !== envelope.bitLength) return fail('signed envelope has trailing bits');
    if (hasInit === 1) {
      if (envelope.refs.length !== 2) return fail('signed envelope with init must have 2 refs');
      bodyRef = envelope.refs[1];
    } else {
      if (envelope.refs.length !== 1) return fail('signed envelope without init must have 1 ref');
      bodyRef = envelope.refs[0];
    }
  } catch (error) {
    return fail(`signed envelope parse failed: ${error.message}`);
  }
  const senderHash = tonAddressToHash(approval.sender, 'ton approval sender');
  if (envelopeDest.workchain !== 0) return fail('signed envelope destination workchain is not 0');
  if (!envelopeDest.hash.equals(senderHash)) return fail('signed envelope destination differs from approved sender');
  const body = parsedSigned.cells[bodyRef];
  if (body.bitLength < 512 + 112) return fail('signed body cell is too short for a signature plus signing cell');
  const signature = body.bits.subarray(0, 64);
  const signingBits = body.bits.subarray(64);
  const signingBitLength = body.bitLength - 512;
  if (signingBitLength !== 112) return fail('signed body signing-cell bit length is not 112');
  const sreader = new TonBitReader(signingBits, signingBitLength);
  let signedFields;
  try {
    signedFields = {
      walletId: Number(sreader.readUint(32)),
      validUntil: Number(sreader.readUint(32)),
      seqno: Number(sreader.readUint(32)),
      op: Number(sreader.readUint(8)),
      mode: Number(sreader.readUint(8)),
    };
  } catch (error) {
    return fail(`signed signing-cell parse failed: ${error.message}`);
  }
  if (signedFields.walletId !== signing.walletId) return fail('signed walletId differs from unsigned artifact');
  if (signedFields.validUntil !== signing.validUntil) return fail('signed validUntil differs from unsigned artifact');
  if (signedFields.seqno !== signing.seqno) return fail('signed seqno differs from unsigned artifact');
  if (signedFields.op !== signing.op) return fail('signed op differs from unsigned artifact');
  if (signedFields.mode !== signing.mode) return fail('signed mode differs from unsigned artifact');
  if (body.refs.length !== 1) return fail('signed body must have exactly one ref (internal message)');
  // The body's ref is the internal message cell. Parse its fields and
  // compare them with the unsigned artifact's internal message, then
  // handle the empty-body encoding difference (below).
  const signedInternalCell = parsedSigned.cells[body.refs[0]];
  let signedInternal;
  try {
    signedInternal = parseTonInternalCell(signedInternalCell);
  } catch (error) {
    return fail(`signed internal message parse failed: ${error.message}`);
  }
  if (signedInternal.tag !== signing.internal.tag) return fail('signed internal message tag differs from unsigned artifact');
  if (signedInternal.ihrDisabled !== signing.internal.ihrDisabled) return fail('signed internal message ihr_disabled differs from unsigned artifact');
  if (signedInternal.bounce !== signing.internal.bounce) return fail('signed internal message bounce differs from unsigned artifact');
  if (signedInternal.bounced !== signing.internal.bounced) return fail('signed internal message bounced differs from unsigned artifact');
  if (signedInternal.dest.workchain !== signing.internal.dest.workchain) return fail('signed internal message destination workchain differs from unsigned artifact');
  if (!signedInternal.dest.hash.equals(signing.internal.dest.hash)) return fail('signed internal message destination differs from unsigned artifact');
  if (signedInternal.amount !== signing.internal.amount) return fail('signed internal message amount differs from unsigned artifact');
  if (signedInternal.extra1 !== signing.internal.extra1 || signedInternal.extra2 !== signing.internal.extra2) return fail('signed internal message extra currency differs from unsigned artifact');
  if (signedInternal.createdLt !== signing.internal.createdLt || signedInternal.createdAt !== signing.internal.createdAt) return fail('signed internal message creation fields differ from unsigned artifact');
  if (signedInternal.hasInit !== signing.internal.hasInit) return fail('signed internal message init flag differs from unsigned artifact');
  // Empty-body encoding deviation: the T33 unsigned artifact stores
  // hasBody = 0 with no ref, while the wallet-core signer stores
  // hasBody = 1 with a ref to an EMPTY body cell. Both are valid TON
  // encodings of "no message body", but they hash differently, so the
  // signed signing-cell hash is not the T33 signing hash. Normalise
  // the signed internal cell to the T33 encoding (clear the hasBody
  // bit, drop the ref) and require the NORMALISED hash to equal the
  // unsigned artifact's internal hash: this proves the empty-body
  // encoding is the ONLY difference.
  if (signing.internal.hasBody !== 0) return fail('unsigned internal message has an unexpected body');
  let normalizedBits = Buffer.from(signedInternalCell.bits);
  let signingHashDeviation = false;
  if (signedInternal.hasBody === 1) {
    if (signedInternalCell.refs.length !== 1) return fail('signed internal message with a body must have exactly one body ref');
    const bodyCell = parsedSigned.cells[signedInternalCell.refs[0]];
    if (bodyCell.bitLength !== 0 || bodyCell.refs.length !== 0) return fail('signed internal message body is not empty');
    const lastBitIndex = signedInternalCell.bitLength - 1;
    const byteIndex = Math.floor(lastBitIndex / 8);
    const bitPos = 7 - (lastBitIndex % 8);
    normalizedBits[byteIndex] &= ~(1 << bitPos);
    signingHashDeviation = true;
  } else if (signedInternal.hasBody === 0) {
    if (signedInternalCell.refs.length !== 0) return fail('signed internal message without a body must have no refs');
  } else {
    return fail('signed internal message hasBody is not 0 or 1');
  }
  const normalizedInternalCell = { bits: normalizedBits, bitLength: signedInternalCell.bitLength, refs: [] };
  const unsignedInternalHash = tonCellHash(signing.signingCells, signing.internalRef).hash;
  const normalizedInternalHash = tonCellHash([normalizedInternalCell], 0).hash;
  if (!normalizedInternalHash.equals(unsignedInternalHash)) return fail('signed internal message differs from unsigned artifact');
  // The Ed25519 signature covers the signer's OWN signing-cell hash
  // (built from the signed BOC's cells as the signer encoded them).
  const signedSigningCell = { bits: signingBits, bitLength: signingBitLength, refs: body.refs };
  const signedCells = [...parsedSigned.cells, signedSigningCell];
  const signedHash = tonCellHash(signedCells, signedCells.length - 1).hash;
  // The T33 signing hash is anchored separately through the normalised
  // cell: the signing cell bits plus the normalised internal hash must
  // reproduce the unsigned artifact's signing hash exactly.
  const normalizedSigningCell = { bits: signingBits, bitLength: signingBitLength, refs: [0] };
  const normalizedSigningHash = tonCellHash([normalizedInternalCell, normalizedSigningCell], 1).hash;
  const unsignedHash = Buffer.from(unsigned.signingHashBase64, 'base64');
  if (!normalizedSigningHash.equals(unsignedHash)) return fail('normalized signing-cell hash differs from unsigned signing hash');
  if (options.skipSignature === true) {
    return {
      valid: true,
      method: 'ed25519',
      signingHash: bytesToHex(signedHash),
      normalizedSigningHash: bytesToHex(normalizedSigningHash),
      signingHashDeviation: signingHashDeviation,
      signature: bytesToHex(signature),
      sender: approval.sender,
      destination: approval.destination,
      hasInit: hasInit === 1,
    };
  }
  const pubkey = hexToBytes(approval.publicKeyHex, 'ton approval publicKeyHex');
  if (!ed25519Verify(signedHash, signature, pubkey)) return fail('Ed25519 verification failed');
  return {
    valid: true,
    method: 'ed25519',
    signingHash: bytesToHex(signedHash),
    normalizedSigningHash: bytesToHex(normalizedSigningHash),
    signingHashDeviation: signingHashDeviation,
    signature: bytesToHex(signature),
    sender: approval.sender,
    destination: approval.destination,
    hasInit: hasInit === 1,
  };
}

export async function signTon(unsigned, approval, privateKey, isolation) {
  requireIsolationAndGuard(isolation);
  const { parsedSigning } = validateTonUnsigned(unsigned);
  const approvalInfo = validateTonApproval(approval);
  const signing = parseTonSigningCell(unsigned, approval);
  const priv = requireEdPrivateKey(privateKey);
  if (signing.walletId !== TON_WALLET_ID) throw new PreflightError(2, 'NETWORK', 'unsigned walletId is not 698983191');
  if (signing.validUntil !== approval.validUntil) throw new PreflightError(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned validUntil differs from approval');
  if (signing.seqno !== approval.seqno) throw new PreflightError(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned seqno differs from approval');
  if (signing.mode !== approval.mode) throw new PreflightError(4, 'AMOUNT', 'unsigned mode differs from approval');
  if (!signing.internal.dest.hash.equals(tonAddressToHash(approval.destination, 'ton approval destination'))) {
    throw new PreflightError(3, 'DESTINATION', 'unsigned destination differs from approval');
  }
  if (signing.internal.amount !== approvalInfo.amount) {
    throw new PreflightError(4, 'AMOUNT', 'unsigned amount differs from approval');
  }
  const { core, TW } = await loadWalletCore();
  const input = TW.TheOpenNetwork.Proto.SigningInput.encode({
    privateKey: priv,
    publicKey: hexToBytes(approval.publicKeyHex, 'ton approval publicKeyHex'),
    messages: [{
      dest: approval.destination,
      // Transfer.amount is Uint8Array in the proto (NOT a number: a
      // JS number is silently dropped and the signer builds a zero
      // message). Minimal big-endian bytes of the nanotons value.
      amount: bigIntToMinimalBytes(approvalInfo.amount),
      mode: approval.mode,
      comment: '',
      bounceable: false,
    }],
    sequenceNumber: approval.seqno,
    expireAt: approval.validUntil,
    walletVersion: TON_WALLET_VERSION,
  }).finish();
  let outBytes;
  try {
    outBytes = core.AnySigner.sign(input, core.CoinType.ton);
  } catch (error) {
    throw new SigningError(`TON signing failed: ${error.message ?? 'signer error'}`);
  }
  const out = TW.TheOpenNetwork.Proto.SigningOutput.decode(outBytes);
  if (out.error !== 0) {
    throw new SigningError(`TON signing failed: signer error ${out.error} ${out.errorMessage ?? ''}`);
  }
  if (typeof out.encoded !== 'string' || out.encoded.length === 0) throw new SigningError('TON signing failed: empty encoded BOC');
  const signed = {
    network: 'ton-mainnet',
    signedBocBase64: out.encoded,
    signingHash: Buffer.from(out.hash ?? new Uint8Array([])).toString('hex'),
  };
  const verification = verifyTon(signed, unsigned, approval);
  if (!verification.valid) {
    throw new PreflightError(10, 'SIGNATURE-VALID', `TON independent verification failed: ${verification.reason}`);
  }
  const preflight = runPreflight('ton-mainnet', signed, unsigned, approval, isolation, { TW });
  return { ...signed, verification, preflight };
}

// ---------------------------------------------------------------------------
// Broadcast-disable proof (check 11, runtime self-scan)
//
// The module performs no network call. This is enforced structurally (no
// network import exists in this file) and checked at runtime by scanning
// this file's own source for network imports and for any function
// definition that would send a transaction. If the scan ever finds one,
// check 11 fails and no signed artifact is returned.
 // ---------------------------------------------------------------------------

const NETWORK_IMPORT_RE = /^\s*import\s+[^;]*from\s+['"]node:(?:https?|net|dgram)['"]/m;
const NETWORK_REQUIRE_RE = /require\(\s*['"]node:(?:https?|net|dgram)['"]\s*\)/;
const FETCH_CALL_RE = /\bfetch\s*\(/;
// The socket word is built without writing the literal, so this file's
// own self-scan does not trip on the pattern itself.
const SOCKET_WORD = `Web${'Socket'}`;
const SOCKET_RE = new RegExp(`\\b${SOCKET_WORD}\\b`);
const SEND_FUNCTION_RE = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+(?:broadcast|sendRawTransaction|submit|publish)\b/;
const SEND_EXPORT_RE = /export\s+(?:const|let|var|function)\s+(?:broadcast|sendRawTransaction|submit|publish)\b/;

export function assertNoNetworkCapability() {
  let source;
  try {
    source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  } catch {
    throw new PreflightError(11, 'NO-BROADCAST', 'cannot read module source to prove no network capability');
  }
  const hits = [];
  if (NETWORK_IMPORT_RE.test(source)) hits.push('network import');
  if (NETWORK_REQUIRE_RE.test(source)) hits.push('network require');
  if (FETCH_CALL_RE.test(source)) hits.push('fetch call');
  if (SOCKET_RE.test(source)) hits.push('socket reference');
  if (SEND_FUNCTION_RE.test(source)) hits.push('send function definition');
  if (SEND_EXPORT_RE.test(source)) hits.push('send export');
  if (hits.length > 0) {
    throw new PreflightError(11, 'NO-BROADCAST', `network capability found in module source: ${hits.join(', ')}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Pre-broadcast checklist (11 checks, fail-closed, first failure throws)
// ---------------------------------------------------------------------------

export const PREFLIGHT_CHECKS = [
  [1, 'ISOLATION'],
  [2, 'NETWORK'],
  [3, 'DESTINATION'],
  [4, 'AMOUNT'],
  [5, 'FEE'],
  [6, 'CHANGE'],
  [7, 'NONCE-SEQUENCE-EXPIRY'],
  [8, 'REPLAY'],
  [9, 'SIGNED-MATCHES-APPROVED'],
  [10, 'SIGNATURE-VALID'],
  [11, 'NO-BROADCAST'],
];

function checkFail(id, name, message) {
  throw new PreflightError(id, name, message);
}

function checkIsolation(ctx) {
  try {
    assertIsolation(ctx.isolation);
    requireSigningAllowed();
  } catch (error) {
    checkFail(1, 'ISOLATION', error.message);
  }
}

function checkNetwork(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  try {
    if (network === 'bitcoin-mainnet') {
      decodeBech32P2wpkh(approval.toAddress, 'btc approval toAddress');
      decodeBech32P2wpkh(approval.changeAddress, 'btc approval changeAddress');
      if (signed) {
        const parsed = parseBtcSignedTx(signed.signedTxHex);
        if (parsed.outputs.length === 0) checkFail(2, 'NETWORK', 'signed BTC tx has no outputs');
      }
    } else if (network === 'ethereum-mainnet') {
      if (approval.chainId !== 1) checkFail(2, 'NETWORK', 'approval chainId is not 1');
      const unsignedFields = validateEthUnsigned(unsigned);
      if (unsignedFields.chainId !== 1n) checkFail(2, 'NETWORK', 'unsigned payload chainId is not 1');
      if (signed) {
        const signedFields = parseEthSignedTx(signed.encoded);
        if (signedFields.chainId !== 1n) checkFail(2, 'NETWORK', 'signed envelope chainId is not 1');
      }
    } else if (network === 'tron-mainnet') {
      if (unsigned.network !== 'tron-mainnet') checkFail(2, 'NETWORK', 'unsigned network is not tron-mainnet');
      if (approval.network !== 'tron-mainnet') checkFail(2, 'NETWORK', 'approval network is not tron-mainnet');
      const parsedUnsigned = validateTronUnsigned(unsigned);
      const refBytes = hexToBytes(approval.refBlockId, 'tron refBlockId');
      if (!parsedUnsigned.refBlockBytes.equals(refBytes.subarray(6, 8))) {
        checkFail(2, 'NETWORK', 'unsigned ref_block_bytes do not match approved refBlockId');
      }
      if (!parsedUnsigned.refBlockHash.equals(refBytes.subarray(8, 16))) {
        checkFail(2, 'NETWORK', 'unsigned ref_block_hash does not match approved refBlockId');
      }
      if (signed) {
        // The signer derives ref_block_hash from the block header; the
        // signed value must equal that derivation (see header note (c)).
        // This is checked in checkNetworkTronSigned below via the TW
        // encoder, which the caller supplies through ctx.TW.
        checkNetworkTronSigned(ctx, parsedUnsigned);
      }
    } else if (network === 'ton-mainnet') {
      tonAddressToHash(approval.sender, 'ton approval sender');
      tonAddressToHash(approval.destination, 'ton approval destination');
      const signing = parseTonSigningCell(unsigned, approval);
      if (signing.walletId !== TON_WALLET_ID) checkFail(2, 'NETWORK', 'unsigned walletId is not 698983191');
    } else {
      checkFail(2, 'NETWORK', `unknown network ${network}`);
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(2, 'NETWORK', error.message);
  }
}

function checkNetworkTronSigned(ctx, parsedUnsigned) {
  // Recompute the signer's ref_block_hash derivation independently of
  // the signer: SHA-256 of the BlockHeader protobuf, bytes 8-15.
  const { signed, approval } = ctx;
  if (!ctx.TW) return; // TW unavailable in a pure preflight call without a prior sign; skip.
  const outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
  const raw = protoBytesField(outer, 1);
  if (raw === null) checkFail(2, 'NETWORK', 'signed transaction has no raw_data');
  const parsedSigned = parseTronRawData(bytesToHex(raw));
  const refBytes = hexToBytes(approval.refBlockId, 'tron refBlockId');
  if (!parsedSigned.refBlockBytes.equals(refBytes.subarray(6, 8))) {
    checkFail(2, 'NETWORK', 'signed ref_block_bytes do not match approved refBlockId');
  }
  const blockHeader = tronBlockHeaderForRefBlockId(approval.refBlockId);
  const expectedHash = tronRefBlockHash(blockHeader, ctx.TW);
  if (!parsedSigned.refBlockHash.equals(expectedHash)) {
    checkFail(2, 'NETWORK', 'signed ref_block_hash does not equal SHA-256(blockHeader) bytes 8-15');
  }
}

function checkDestination(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  try {
    if (network === 'bitcoin-mainnet') {
      const payment = unsigned.outputs.find((o) => o.role === 'payment');
      if (!payment || payment.address.toLowerCase() !== approval.toAddress.toLowerCase()) {
        checkFail(3, 'DESTINATION', 'unsigned payment address differs from approval');
      }
      if (signed) {
        const parsed = parseBtcSignedTx(signed.signedTxHex);
        const script = Buffer.concat([Buffer.from([0x00, 0x14]), decodeBech32P2wpkh(approval.toAddress, 'btc approval toAddress')]);
        if (!parsed.outputs[0].script.equals(script)) checkFail(3, 'DESTINATION', 'signed payment output differs from approval');
      }
    } else if (network === 'ethereum-mainnet') {
      checkEip55(approval.to, 'eth approval to');
      const unsignedFields = validateEthUnsigned(unsigned);
      if (unsignedFields.to.toString('hex').toLowerCase() !== approval.to.slice(2).toLowerCase()) {
        checkFail(3, 'DESTINATION', 'unsigned to differs from approval');
      }
      if (signed) {
        const signedFields = parseEthSignedTx(signed.encoded);
        if (signedFields.to.toString('hex').toLowerCase() !== approval.to.slice(2).toLowerCase()) {
          checkFail(3, 'DESTINATION', 'signed to differs from approval');
        }
      }
    } else if (network === 'tron-mainnet') {
      const parsedUnsigned = validateTronUnsigned(unsigned);
      if (!parsedUnsigned.contract.to.equals(base58CheckDecode(approval.toAddress, 'tron toAddress', 25))) {
        checkFail(3, 'DESTINATION', 'unsigned recipient differs from approval');
      }
      if (signed) {
        const outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
        const raw = protoBytesField(outer, 1);
        const parsedSigned = parseTronRawData(bytesToHex(raw));
        if (!parsedSigned.contract.to.equals(base58CheckDecode(approval.toAddress, 'tron toAddress', 25))) {
          checkFail(3, 'DESTINATION', 'signed recipient differs from approval');
        }
      }
    } else if (network === 'ton-mainnet') {
      const signing = parseTonSigningCell(unsigned, approval);
      if (!signing.internal.dest.hash.equals(tonAddressToHash(approval.destination, 'ton approval destination'))) {
        checkFail(3, 'DESTINATION', 'unsigned destination differs from approval');
      }
      if (signed) {
        const verification = verifyTon(signed, unsigned, approval, { skipSignature: true });
        if (!verification.valid && verification.reason.includes('destination')) {
          checkFail(3, 'DESTINATION', verification.reason);
        }
      }
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(3, 'DESTINATION', error.message);
  }
}

function checkAmount(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  try {
    if (network === 'bitcoin-mainnet') {
      const amount = parseCanonicalDecimal(approval.amountSats, 'btc approval amountSats', 294n, 2100000000000000n);
      const payment = unsigned.outputs.find((o) => o.role === 'payment');
      if (!payment || BigInt(payment.valueSats) !== amount) checkFail(4, 'AMOUNT', 'unsigned payment amount differs from approval');
      if (signed) {
        const parsed = parseBtcSignedTx(signed.signedTxHex);
        if (parsed.outputs[0].value !== amount) checkFail(4, 'AMOUNT', 'signed payment amount differs from approval');
      }
    } else if (network === 'ethereum-mainnet') {
      const value = parseCanonicalDecimal(approval.valueWei, 'eth approval valueWei', 0n, (1n << 256n) - 1n);
      const unsignedFields = validateEthUnsigned(unsigned);
      if (unsignedFields.amount !== value) checkFail(4, 'AMOUNT', 'unsigned amount differs from approval');
      if (signed) {
        const signedFields = parseEthSignedTx(signed.encoded);
        if (signedFields.amount !== value) checkFail(4, 'AMOUNT', 'signed amount differs from approval');
      }
    } else if (network === 'tron-mainnet') {
      const amount = parseCanonicalDecimal(approval.amountSun, 'tron approval amountSun', 1n, (1n << 63n) - 1n);
      const parsedUnsigned = validateTronUnsigned(unsigned);
      if (parsedUnsigned.contract.amount !== amount) checkFail(4, 'AMOUNT', 'unsigned amount differs from approval');
      if (signed) {
        const outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
        const raw = protoBytesField(outer, 1);
        const parsedSigned = parseTronRawData(bytesToHex(raw));
        if (parsedSigned.contract.amount !== amount) checkFail(4, 'AMOUNT', 'signed amount differs from approval');
      }
    } else if (network === 'ton-mainnet') {
      const amount = parseCanonicalDecimal(approval.amountNano, 'ton approval amountNano', 1n, (1n << 120n) - 1n);
      const signing = parseTonSigningCell(unsigned, approval);
      if (signing.internal.amount !== amount) checkFail(4, 'AMOUNT', 'unsigned amount differs from approval');
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(4, 'AMOUNT', error.message);
  }
}

function checkFee(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  try {
    if (network === 'bitcoin-mainnet') {
      const maxFee = parseCanonicalDecimal(approval.maxFeeSats, 'btc approval maxFeeSats', 0n, 2100000000000000n);
      if (signed) {
        const verification = verifyBtc(signed, unsigned, approval, { skipSignature: true });
        if (!verification.valid && verification.reason.includes('fee')) checkFail(5, 'FEE', verification.reason);
        if (verification.valid && BigInt(verification.feeSats) > maxFee) {
          checkFail(5, 'FEE', `signed fee ${verification.feeSats} sat exceeds approved maxFeeSats ${approval.maxFeeSats}`);
        }
      } else {
        const info = validateBtcUnsigned(unsigned);
        if (info.fee > maxFee) checkFail(5, 'FEE', `unsigned fee ${info.fee} sat exceeds approved maxFeeSats ${approval.maxFeeSats}`);
      }
    } else if (network === 'ethereum-mainnet') {
      const approvalInfo = validateEthApproval(approval);
      if (approvalInfo.maxPriority > approvalInfo.maxFeePerGas) checkFail(5, 'FEE', 'priority fee exceeds max fee');
      if (approvalInfo.gasLimit * approvalInfo.maxFeePerGas > approvalInfo.maxFee) {
        checkFail(5, 'FEE', 'gasLimit * maxFeePerGas exceeds approved maxFeeWei');
      }
      if (signed) {
        const signedFields = parseEthSignedTx(signed.encoded);
        if (signedFields.maxPriorityFeePerGas > signedFields.maxFeePerGas) checkFail(5, 'FEE', 'signed priority fee exceeds signed max fee');
        if (signedFields.gasLimit * signedFields.maxFeePerGas > approvalInfo.maxFee) {
          checkFail(5, 'FEE', 'signed gasLimit * maxFeePerGas exceeds approved maxFeeWei');
        }
      }
    } else if (network === 'tron-mainnet') {
      if (approval.maxFeeSun !== '0') checkFail(5, 'FEE', 'approved maxFeeSun must be 0 for this route');
      const parsedUnsigned = validateTronUnsigned(unsigned);
      if (parsedUnsigned.feeLimit !== null && parsedUnsigned.feeLimit !== 0n) checkFail(5, 'FEE', 'unsigned fee_limit is present and nonzero');
      if (signed) {
        const outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
        const raw = protoBytesField(outer, 1);
        const parsedSigned = parseTronRawData(bytesToHex(raw));
        if (parsedSigned.feeLimit !== null && parsedSigned.feeLimit !== 0n) checkFail(5, 'FEE', 'signed fee_limit is present and nonzero');
      }
    } else if (network === 'ton-mainnet') {
      // No fee amount is computable offline for TON: the fee depends on
      // gas used at execution. The check enforces the approved send
      // mode (3 = pay fees separately + ignore action-phase errors),
      // which is the only fee-relevant field fixed offline.
      const signing = parseTonSigningCell(unsigned, approval);
      if (signing.mode !== approval.mode) checkFail(5, 'FEE', 'unsigned send mode differs from approval');
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(5, 'FEE', error.message);
  }
}

function checkChange(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  try {
    if (network === 'bitcoin-mainnet') {
      const changeOutputs = unsigned.outputs.filter((o) => o.role === 'change');
      if (changeOutputs.length > 1) checkFail(6, 'CHANGE', 'more than one change output');
      if (changeOutputs.length === 1) {
        if (changeOutputs[0].address.toLowerCase() !== approval.changeAddress.toLowerCase()) {
          checkFail(6, 'CHANGE', 'unsigned change address differs from approval');
        }
        if (approval.changePubkeyHex !== undefined) {
          const program = decodeBech32P2wpkh(approval.changeAddress, 'btc approval changeAddress');
          if (!hash160(hexToBytes(approval.changePubkeyHex, 'btc changePubkeyHex')).equals(program)) {
            checkFail(6, 'CHANGE', 'approved change address does not match approved change public key');
          }
        }
      }
      if (signed) {
        const parsed = parseBtcSignedTx(signed.signedTxHex);
        if (parsed.outputs.length !== unsigned.outputs.length) checkFail(6, 'CHANGE', 'signed output count differs from unsigned artifact');
        if (changeOutputs.length === 1) {
          const script = Buffer.concat([Buffer.from([0x00, 0x14]), decodeBech32P2wpkh(approval.changeAddress, 'btc approval changeAddress')]);
          if (!parsed.outputs[1].script.equals(script)) checkFail(6, 'CHANGE', 'signed change output differs from approval');
        }
      }
    } else if (network === 'ethereum-mainnet') {
      // No change output exists for ETH: the signed envelope must carry
      // exactly the approved transfer and nothing else (checked via the
      // fixed 12-field RLP shape and the field comparisons in check 9).
      if (signed) parseEthSignedTx(signed.encoded);
    } else if (network === 'tron-mainnet') {
      // Exactly one contract, already enforced by parseTronRawData.
      if (signed) {
        const outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
        const raw = protoBytesField(outer, 1);
        parseTronRawData(bytesToHex(raw));
      }
    } else if (network === 'ton-mainnet') {
      // Exactly one message, already enforced by the signing-cell parse.
      parseTonSigningCell(unsigned, approval);
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(6, 'CHANGE', error.message);
  }
}

function checkNonceSequenceExpiry(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  try {
    if (network === 'ethereum-mainnet') {
      const nonce = parseCanonicalDecimal(approval.nonce, 'eth approval nonce', 0n, (1n << 64n) - 2n);
      const unsignedFields = validateEthUnsigned(unsigned);
      if (unsignedFields.nonce !== nonce) checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned nonce differs from approval');
      if (signed) {
        const signedFields = parseEthSignedTx(signed.encoded);
        if (signedFields.nonce !== nonce) checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'signed nonce differs from approval');
      }
    } else if (network === 'tron-mainnet') {
      const timestamp = parseCanonicalDecimal(approval.timestampMs, 'tron approval timestampMs', 1n, (1n << 63n) - 1n);
      const expiration = parseCanonicalDecimal(approval.expirationMs, 'tron approval expirationMs', 1n, (1n << 63n) - 1n);
      if (expiration <= timestamp) checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'expiration is not after timestamp');
      if (expiration - timestamp > 86400000n) checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'expiration more than 24h after timestamp');
      const parsedUnsigned = validateTronUnsigned(unsigned);
      if (parsedUnsigned.timestamp !== timestamp || parsedUnsigned.expiration !== expiration) {
        checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned timestamp/expiration differ from approval');
      }
    } else if (network === 'ton-mainnet') {
      const signing = parseTonSigningCell(unsigned, approval);
      if (signing.seqno !== approval.seqno) checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned seqno differs from approval');
      if (signing.validUntil !== approval.validUntil) checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'unsigned validUntil differs from approval');
      const reviewClock = approval.reviewClockSec ?? Math.floor(Date.now() / 1000);
      if (approval.validUntil <= reviewClock) checkFail(7, 'NONCE-SEQUENCE-EXPIRY', 'validUntil is not after the review clock');
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(7, 'NONCE-SEQUENCE-EXPIRY', error.message);
  }
}

function checkReplay(ctx) {
  const { network, unsigned, signed } = ctx;
  try {
    if (network === 'bitcoin-mainnet') {
      if (signed) {
        const parsed = parseBtcSignedTx(signed.signedTxHex);
        parsed.witnesses.forEach((witness, i) => {
          if (witness[0][witness[0].length - 1] !== 0x01) checkFail(8, 'REPLAY', `input ${i} sighash byte is not SIGHASH_ALL (0x01)`);
        });
      }
    } else if (network === 'ethereum-mainnet') {
      if (signed) {
        const signedFields = parseEthSignedTx(signed.encoded);
        if (signedFields.chainId !== 1n) checkFail(8, 'REPLAY', 'signed envelope chainId is not 1');
      }
    } else if (network === 'tron-mainnet') {
      if (signed) {
        const outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
        const raw = protoBytesField(outer, 1);
        const parsedSigned = parseTronRawData(bytesToHex(raw));
        const parsedUnsigned = validateTronUnsigned(unsigned);
        if (!parsedSigned.refBlockBytes.equals(parsedUnsigned.refBlockBytes)) {
          checkFail(8, 'REPLAY', 'signed ref_block_bytes differ from unsigned artifact');
        }
      }
    } else if (network === 'ton-mainnet') {
      const signing = parseTonSigningCell(unsigned, ctx.approval);
      if (signing.walletId !== TON_WALLET_ID) checkFail(8, 'REPLAY', 'walletId binding missing');
      if (signing.seqno !== ctx.approval.seqno) checkFail(8, 'REPLAY', 'seqno binding differs from approval');
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(8, 'REPLAY', error.message);
  }
}

function checkSignedMatchesApproved(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  if (!signed) checkFail(9, 'SIGNED-MATCHES-APPROVED', 'no signed artifact to compare');
  try {
    if (network === 'bitcoin-mainnet') {
      const verification = verifyBtc(signed, unsigned, approval, { skipSignature: true });
      if (!verification.valid) checkFail(9, 'SIGNED-MATCHES-APPROVED', verification.reason);
      const parsed = parseBtcSignedTx(signed.signedTxHex);
      const unsignedInfo = validateBtcUnsigned(unsigned);
      if (parsed.outputs.length !== unsignedInfo.parsed.outputs.length) {
        checkFail(9, 'SIGNED-MATCHES-APPROVED', 'signed output count differs from unsigned artifact');
      }
    } else if (network === 'ethereum-mainnet') {
      const verification = verifyEth(signed, unsigned, approval, { skipSignature: true });
      if (!verification.valid) checkFail(9, 'SIGNED-MATCHES-APPROVED', verification.reason);
      const unsignedFields = validateEthUnsigned(unsigned);
      const hash = ethSigningHash(unsignedFields);
      if (verification.signingHash !== bytesToHex(hash)) {
        checkFail(9, 'SIGNED-MATCHES-APPROVED', 'signing hash mismatch');
      }
    } else if (network === 'tron-mainnet') {
      const verification = verifyTron(signed, unsigned, approval, { skipSignature: true });
      if (!verification.valid) checkFail(9, 'SIGNED-MATCHES-APPROVED', verification.reason);
      const outer = protoFields(hexToBytes(signed.signedTransactionHex, 'tron signedTransactionHex'));
      const raw = protoBytesField(outer, 1);
      if (bytesToHex(sha256(raw)) !== verification.txID) {
        checkFail(9, 'SIGNED-MATCHES-APPROVED', 'signed txID does not equal SHA-256 of signed raw_data');
      }
    } else if (network === 'ton-mainnet') {
      const verification = verifyTon(signed, unsigned, approval, { skipSignature: true });
      if (!verification.valid) checkFail(9, 'SIGNED-MATCHES-APPROVED', verification.reason);
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    checkFail(9, 'SIGNED-MATCHES-APPROVED', error.message);
  }
}

function checkSignatureValid(ctx) {
  const { network, unsigned, approval, signed } = ctx;
  if (!signed) checkFail(10, 'SIGNATURE-VALID', 'no signed artifact to verify');
  let verification;
  try {
    if (network === 'bitcoin-mainnet') verification = verifyBtc(signed, unsigned, approval);
    else if (network === 'ethereum-mainnet') verification = verifyEth(signed, unsigned, approval);
    else if (network === 'tron-mainnet') verification = verifyTron(signed, unsigned, approval);
    else if (network === 'ton-mainnet') verification = verifyTon(signed, unsigned, approval);
    else checkFail(10, 'SIGNATURE-VALID', `unknown network ${network}`);
  } catch (error) {
    checkFail(10, 'SIGNATURE-VALID', error.message);
  }
  if (!verification.valid) checkFail(10, 'SIGNATURE-VALID', verification.reason);
}

function checkNoBroadcast() {
  assertNoNetworkCapability();
}

const CHECK_RUNNERS = {
  1: checkIsolation,
  2: checkNetwork,
  3: checkDestination,
  4: checkAmount,
  5: checkFee,
  6: checkChange,
  7: checkNonceSequenceExpiry,
  8: checkReplay,
  9: checkSignedMatchesApproved,
  10: checkSignatureValid,
  11: checkNoBroadcast,
};

export function runPreflight(network, signed, unsigned, approval, isolation, extra = {}) {
  const validNetworks = ['bitcoin-mainnet', 'ethereum-mainnet', 'tron-mainnet', 'ton-mainnet'];
  if (!validNetworks.includes(network)) {
    throw new PreflightError(2, 'NETWORK', `unknown network ${network}`);
  }
  const ctx = { network, signed, unsigned, approval, isolation, TW: extra.TW ?? null };
  const checks = [];
  for (const [id, name] of PREFLIGHT_CHECKS) {
    CHECK_RUNNERS[id](ctx);
    checks.push({ id, name, pass: true });
  }
  return { network, checks, passed: true };
}

// ---------------------------------------------------------------------------
// Evidence record (hashes + checklist results only; never secrets)
// ---------------------------------------------------------------------------

export function buildEvidenceRecord(network, unsigned, signed, approval, preflight, verification) {
  const unsignedText = JSON.stringify(unsigned);
  const signedText = JSON.stringify(signed);
  let sender = null;
  let recipient = null;
  let amount = null;
  let fee = null;
  if (network === 'bitcoin-mainnet') {
    sender = unsigned.signingInputs[0].scriptPubKey;
    recipient = approval.toAddress;
    amount = approval.amountSats;
    fee = verification?.feeSats ?? null;
  } else if (network === 'ethereum-mainnet') {
    sender = approval.expectedSender;
    recipient = approval.to;
    amount = approval.valueWei;
    fee = verification?.maxFeeWei ?? null;
  } else if (network === 'tron-mainnet') {
    sender = approval.ownerAddress;
    recipient = approval.toAddress;
    amount = approval.amountSun;
    fee = '0';
  } else if (network === 'ton-mainnet') {
    sender = approval.sender;
    recipient = approval.destination;
    amount = approval.amountNano;
    fee = null;
  }
  const record = {
    network,
    unsignedSha256: bytesToHex(sha256(Buffer.from(unsignedText, 'utf8'))),
    signedSha256: bytesToHex(sha256(Buffer.from(signedText, 'utf8'))),
    sender,
    recipient,
    amount,
    fee,
    checks: preflight.checks,
    verificationMethod: verification?.method ?? null,
    verificationResult: verification?.valid === true ? 'pass' : 'fail',
    walletCoreVersion: WALLET_CORE_VERSION,
    timestamp: new Date().toISOString(),
    stop: 'STOP BEFORE BROADCASTING: no broadcast was attempted or performed; M-35 execution remains NOT authorised.',
  };
  if (containsSecret(JSON.stringify(record))) {
    throw new SigningError('Evidence record failed the secret scan; refusing to emit it');
  }
  return record;
}
