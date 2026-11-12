// Bawa — offline unsigned native-asset transaction builders (T33).
//
// Builds UNSIGNED transactions for BTC (P2WPKH), ETH (EIP-155 legacy and
// EIP-1559), TRON (native TRX TransferContract) and TON (Wallet V4 R2)
// from validated PUBLIC inputs only, with no network access, no signing,
// no broadcast and no execution path. All artifacts are unsigned and must
// never be broadcast by this module: there is no send/broadcast/token/
// contract/allowance function in this file, only stubs that always throw.
//
// Inputs are synthetic fixtures unless the caller supplies live values.
// The published public fixtures (15-word ripple test vector) must never
// be funded: the mnemonic is public. No private key, mnemonic or seed is
// ever accepted: closed schemas reject unknown fields, including any
// credential field. Node standard library only; deterministic; synchronous.

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

const MAX_SUPPLY_SATS = 2100000000000000n;
const U256 = (1n << 256n) - 1n;

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertClosedObject(input, requiredKeys, optionalKeys, label) {
  if (!isPlainObject(input)) throw new Error(`Invalid ${label}: expected a plain object`);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`Invalid ${label}: unknown field`);
    const desc = Object.getOwnPropertyDescriptor(input, key);
    if (desc === undefined || 'get' in desc || 'set' in desc) {
      throw new Error(`Invalid ${label}: accessor field`);
    }
  }
  for (const key of requiredKeys) {
    if (!(key in input)) throw new Error(`Invalid ${label}: missing field`);
  }
}

function parseCanonicalDecimal(value, label, min, max) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`Invalid ${label}: expected a canonical decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed < min || parsed > max) throw new Error(`Invalid ${label}: out of bounds`);
  return parsed;
}

function hexToBytes(hex, label) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error(`Invalid ${label}: expected even-length hex`);
  }
  return Buffer.from(hex, 'hex');
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function bigIntToMinimalBytes(value) {
  if (value === 0n) return Buffer.alloc(0);
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  return Buffer.from(hex, 'hex');
}

function sha256(bytes) {
  return createHash('sha256').update(Buffer.from(bytes)).digest();
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

// Bech32 (BIP-173) decode for mainnet P2WPKH. Returns the 20-byte program.
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values) {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= BECH32_GEN[i];
    }
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

function convertBits(data, from, to, pad) {
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

function bech32DecodeP2wpkh(address, label) {
  if (typeof address !== 'string') throw new Error(`Invalid ${label}: expected a string`);
  const hasLower = /[a-z]/.test(address);
  const hasUpper = /[A-Z]/.test(address);
  if (hasLower && hasUpper) throw new Error(`Invalid ${label}: mixed case`);
  if (address.length !== 42) throw new Error(`Invalid ${label}: expected 42 characters`);
  const lower = address.toLowerCase();
  const sep = lower.lastIndexOf('1');
  if (sep < 1) throw new Error(`Invalid ${label}: missing separator`);
  const hrp = lower.slice(0, sep);
  if (hrp !== 'bc') throw new Error(`Invalid ${label}: expected mainnet hrp bc`);
  const dataPart = lower.slice(sep + 1);
  const data = [];
  for (const ch of dataPart) {
    const idx = BECH32_CHARSET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid ${label}: bad character`);
    data.push(idx);
  }
  if (bech32Polymod([...bech32HrpExpand(hrp), ...data]) !== 1) {
    throw new Error(`Invalid ${label}: bad checksum`);
  }
  if (data[0] !== 0) throw new Error(`Invalid ${label}: expected witness version 0`);
  const program = convertBits(data.slice(1, -6), 5, 8, false);
  if (program === null || program.length !== 20) {
    throw new Error(`Invalid ${label}: expected a 20-byte program`);
  }
  return Buffer.from(program);
}

// Base58Check decode. Returns the payload without the 4-byte checksum.
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58CheckDecode(address, label, expectedLength) {
  if (typeof address !== 'string') throw new Error(`Invalid ${label}: expected a string`);
  let n = 0n;
  for (const ch of address) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid ${label}: bad character`);
    n = n * 58n + BigInt(idx);
  }
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  const minimal = hex === '00' ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let leadingZeros = 0;
  for (const ch of address) {
    if (ch !== '1') break;
    leadingZeros += 1;
  }
  const decoded = Buffer.concat([Buffer.alloc(leadingZeros), minimal]);
  if (decoded.length !== expectedLength) {
    throw new Error(`Invalid ${label}: expected ${expectedLength} decoded bytes`);
  }
  const payload = decoded.subarray(0, expectedLength - 4);
  const checksum = decoded.subarray(expectedLength - 4);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  if (!checksum.equals(expected)) throw new Error(`Invalid ${label}: bad checksum`);
  return Buffer.from(payload);
}

// Protobuf helpers (unsigned, shortest varints, ascending field order).
function encodeVarint(value) {
  let n = BigInt(value);
  if (n < 0n) throw new Error('Invalid protobuf value: negative varint');
  const out = [];
  while (n >= 0x80n) {
    out.push(Number(n & 0x7fn) | 0x80);
    n >>= 7n;
  }
  out.push(Number(n));
  return Buffer.from(out);
}

function encodeBytesField(field, bytes) {
  const tag = encodeVarint(BigInt((field << 3) | 2));
  return Buffer.concat([tag, encodeVarint(BigInt(bytes.length)), Buffer.from(bytes)]);
}

function encodeVarintField(field, value) {
  const tag = encodeVarint(BigInt((field << 3) | 0));
  return Buffer.concat([tag, encodeVarint(value)]);
}

// ---------------------------------------------------------------------------
// BTC: P2WPKH unsigned transaction
// ---------------------------------------------------------------------------

const BTC_DUST_SATS = 294n;

function validateBtcUtxo(utxo, label) {
  assertClosedObject(utxo, ['txid', 'vout', 'valueSats', 'scriptPubKey'], [], label);
  if (typeof utxo.txid !== 'string' || !/^[0-9a-fA-F]{64}$/.test(utxo.txid)) {
    throw new Error(`Invalid ${label}: txid must be 64 hex characters`);
  }
  if (!Number.isInteger(utxo.vout) || utxo.vout < 0 || utxo.vout > 4294967295) {
    throw new Error(`Invalid ${label}: vout out of range`);
  }
  const valueSats = parseCanonicalDecimal(utxo.valueSats, `${label} valueSats`, 1n, MAX_SUPPLY_SATS);
  if (typeof utxo.scriptPubKey !== 'string' || !/^[0-9a-fA-F]{44}$/.test(utxo.scriptPubKey)) {
    throw new Error(`Invalid ${label}: scriptPubKey must be 44 hex characters`);
  }
  const script = hexToBytes(utxo.scriptPubKey, `${label} scriptPubKey`);
  if (script[0] !== 0x00 || script[1] !== 0x14) {
    throw new Error(`Invalid ${label}: scriptPubKey must be OP_0 plus a 20-byte push`);
  }
  return {
    txid: utxo.txid.toLowerCase(),
    vout: utxo.vout,
    valueSats,
    scriptPubKey: utxo.scriptPubKey.toLowerCase(),
  };
}

export function buildBtcP2wpkhUnsignedTx(input) {
  assertClosedObject(
    input,
    ['utxos', 'toAddress', 'amountSats', 'feeSats', 'maxFeeSats'],
    ['changeAddress'],
    'btc input',
  );
  if (!Array.isArray(input.utxos) || input.utxos.length === 0) {
    throw new Error('Invalid btc input: utxos must be a nonempty array');
  }
  const utxos = input.utxos.map((utxo, i) => validateBtcUtxo(utxo, `btc utxo ${i}`));
  const seen = new Set();
  for (const utxo of utxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (seen.has(key)) throw new Error('Invalid btc input: duplicate outpoint');
    seen.add(key);
    if (/^0{64}$/.test(utxo.txid) && utxo.vout === 4294967295) {
      throw new Error('Invalid btc input: null coinbase outpoint');
    }
  }
  const toProgram = bech32DecodeP2wpkh(input.toAddress, 'btc toAddress');
  const toAddress = input.toAddress.toLowerCase();
  // Validate changeAddress whenever supplied, even if no change is due.
  let changeProgram = null;
  let changeAddress = null;
  if ('changeAddress' in input) {
    if (typeof input.changeAddress !== 'string') {
      throw new Error('Invalid btc input: changeAddress must be a string');
    }
    changeProgram = bech32DecodeP2wpkh(input.changeAddress, 'btc changeAddress');
    changeAddress = input.changeAddress.toLowerCase();
  }
  const amountSats = parseCanonicalDecimal(input.amountSats, 'btc amountSats', BTC_DUST_SATS, MAX_SUPPLY_SATS);
  const feeSats = parseCanonicalDecimal(input.feeSats, 'btc feeSats', 0n, MAX_SUPPLY_SATS);
  const maxFeeSats = parseCanonicalDecimal(input.maxFeeSats, 'btc maxFeeSats', 0n, MAX_SUPPLY_SATS);
  if (feeSats > maxFeeSats) throw new Error('Invalid btc input: fee exceeds maxFeeSats');
  const totalInputSats = utxos.reduce((sum, utxo) => sum + utxo.valueSats, 0n);
  const remainder = totalInputSats - amountSats - feeSats;
  if (remainder < 0n) throw new Error('Invalid btc input: inputs do not cover amount plus fee');
  let changeSats = 0n;
  if (remainder === 0n) {
    changeSats = 0n;
  } else if (remainder < BTC_DUST_SATS) {
    throw new Error('Invalid btc input: change below the dust floor');
  } else {
    if (changeProgram === null) {
      throw new Error('Invalid btc input: changeAddress required for change');
    }
    changeSats = remainder;
  }

  const parts = [];
  const version = Buffer.alloc(4);
  version.writeInt32LE(2, 0);
  parts.push(version);
  parts.push(encodeCompactSize(utxos.length));
  for (const utxo of utxos) {
    const txidBytes = Buffer.from(hexToBytes(utxo.txid, 'btc txid')).reverse();
    const voutBytes = Buffer.alloc(4);
    voutBytes.writeUInt32LE(utxo.vout, 0);
    const sequence = Buffer.alloc(4);
    sequence.writeUInt32LE(4294967295, 0);
    parts.push(txidBytes, voutBytes, encodeCompactSize(0), sequence);
  }
  const outputs = [];
  const outputParts = [];
  const paymentScript = Buffer.concat([Buffer.from([0x00, 0x14]), toProgram]);
  outputs.push({
    role: 'payment',
    address: toAddress,
    valueSats: amountSats.toString(),
    scriptPubKey: bytesToHex(paymentScript),
  });
  const paymentValue = Buffer.alloc(8);
  paymentValue.writeBigUInt64LE(amountSats, 0);
  outputParts.push(paymentValue, encodeCompactSize(22), paymentScript);
  if (changeSats > 0n) {
    const changeScript = Buffer.concat([Buffer.from([0x00, 0x14]), changeProgram]);
    outputs.push({
      role: 'change',
      address: changeAddress,
      valueSats: changeSats.toString(),
      scriptPubKey: bytesToHex(changeScript),
    });
    const changeValue = Buffer.alloc(8);
    changeValue.writeBigUInt64LE(changeSats, 0);
    outputParts.push(changeValue, encodeCompactSize(22), changeScript);
  }
  parts.push(encodeCompactSize(outputs.length), ...outputParts);
  const locktime = Buffer.alloc(4);
  parts.push(locktime);
  const unsignedTxHex = bytesToHex(Buffer.concat(parts));
  return {
    unsignedTxHex,
    signingInputs: utxos.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      valueSats: utxo.valueSats.toString(),
      scriptPubKey: utxo.scriptPubKey,
    })),
    outputs,
    totalInputSats: totalInputSats.toString(),
    feeSats: feeSats.toString(),
    changeSats: changeSats.toString(),
  };
}

// ---------------------------------------------------------------------------
// ETH: EIP-155 legacy and EIP-1559 unsigned transactions (Astra, call 8)
// ---------------------------------------------------------------------------

const ETH_UNSIGNED_UINT256_MAX = (1n << 256n) - 1n;
const ETH_UNSIGNED_NONCE_MAX = (1n << 64n) - 2n;
const ETH_UNSIGNED_KECCAK_MASK64 = (1n << 64n) - 1n;

const ETH_UNSIGNED_KECCAK_ROUND_CONSTANTS = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

const ETH_UNSIGNED_KECCAK_ROTATIONS = [
  0n, 1n, 62n, 28n, 27n,
  36n, 44n, 6n, 55n, 20n,
  3n, 10n, 43n, 25n, 39n,
  41n, 45n, 15n, 21n, 8n,
  18n, 2n, 61n, 56n, 14n,
];

function ethUnsignedRotate64(value, shift) {
  return (
    ((value << shift) | (value >> (64n - shift))) &
    ETH_UNSIGNED_KECCAK_MASK64
  );
}

function ethUnsignedKeccakF1600(state) {
  const columns = new Array(5);
  const rotated = new Array(25);

  for (const roundConstant of ETH_UNSIGNED_KECCAK_ROUND_CONSTANTS) {
    for (let x = 0; x < 5; x++) {
      columns[x] =
        state[x] ^
        state[x + 5] ^
        state[x + 10] ^
        state[x + 15] ^
        state[x + 20];
    }

    for (let x = 0; x < 5; x++) {
      const delta =
        columns[(x + 4) % 5] ^
        ethUnsignedRotate64(columns[(x + 1) % 5], 1n);

      for (let y = 0; y < 5; y++) {
        const index = x + 5 * y;
        rotated[y + 5 * ((2 * x + 3 * y) % 5)] = ethUnsignedRotate64(
          state[index] ^ delta,
          ETH_UNSIGNED_KECCAK_ROTATIONS[index],
        );
      }
    }

    for (let y = 0; y < 5; y++) {
      const row = 5 * y;
      for (let x = 0; x < 5; x++) {
        state[row + x] =
          (rotated[row + x] ^
            (~rotated[row + ((x + 1) % 5)] &
              rotated[row + ((x + 2) % 5)])) &
          ETH_UNSIGNED_KECCAK_MASK64;
      }
    }

    state[0] ^= roundConstant;
  }
}

function keccak256(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new Error("Invalid Keccak input: expected bytes");
  }

  const rateBytes = 136;
  const padded = Buffer.alloc(
    bytes.length + rateBytes - (bytes.length % rateBytes),
  );
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rateBytes) {
    for (let lane = 0; lane < rateBytes / 8; lane++) {
      state[lane] ^= padded.readBigUInt64LE(offset + lane * 8);
    }
    ethUnsignedKeccakF1600(state);
  }

  const output = Buffer.alloc(32);
  for (let lane = 0; lane < 4; lane++) {
    output.writeBigUInt64LE(state[lane], lane * 8);
  }
  return output;
}

function rlpEncode(value) {
  let body;
  let shortPrefix;
  let longPrefix;

  if (Buffer.isBuffer(value)) {
    if (value.length === 1 && value[0] < 0x80) {
      return Buffer.from(value);
    }
    body = value;
    shortPrefix = 0x80;
    longPrefix = 0xb7;
  } else if (Array.isArray(value)) {
    body = Buffer.concat(Array.from(value, (item) => rlpEncode(item)));
    shortPrefix = 0xc0;
    longPrefix = 0xf7;
  } else {
    throw new Error("Invalid RLP value: expected a Buffer or Array");
  }

  if (body.length <= 55) {
    return Buffer.concat([
      Buffer.from([shortPrefix + body.length]),
      body,
    ]);
  }

  const lengthBytes = bigIntToMinimalBytes(BigInt(body.length));
  return Buffer.concat([
    Buffer.from([longPrefix + lengthBytes.length]),
    lengthBytes,
    body,
  ]);
}

function ethUnsignedAddressBytes(to) {
  if (
    typeof to !== "string" ||
    to.length !== 42 ||
    !/^0x[0-9a-fA-F]{40}$/.test(to)
  ) {
    throw new Error("Invalid to: expected an EIP-55 address");
  }

  const addressHex = to.slice(2);
  const lowercaseHex = addressHex.toLowerCase();
  const checksum = keccak256(Buffer.from(lowercaseHex, "ascii"));

  for (let i = 0; i < 40; i++) {
    const nibble =
      (i & 1) === 0
        ? checksum[i >> 1] >> 4
        : checksum[i >> 1] & 0x0f;
    const expected =
      nibble >= 8 ? lowercaseHex[i].toUpperCase() : lowercaseHex[i];

    if (addressHex[i] !== expected) {
      throw new Error("Invalid to: EIP-55 checksum mismatch");
    }
  }

  return Buffer.from(lowercaseHex, "hex");
}

function ethUnsignedParseDecimal(value, label, minimum, maximum) {
  try {
    return parseCanonicalDecimal(value, label, minimum, maximum);
  } catch {
    throw new Error(
      `Invalid ${label}: expected a canonical decimal string within bounds`,
    );
  }
}

function ethUnsignedParseInput(input, is1559) {
  if (input === null || typeof input !== "object") {
    throw new Error("Invalid input: expected a plain object");
  }

  let prototype;
  let ownKeys;
  try {
    prototype = Object.getPrototypeOf(input);
    ownKeys = Reflect.ownKeys(input);
  } catch {
    throw new Error("Invalid input: expected a plain object");
  }

  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Invalid input: expected a plain object");
  }

  const feeKeys = is1559
    ? ["maxPriorityFeePerGasWei", "maxFeePerGasWei"]
    : ["gasPriceWei"];
  const allowedKeys = new Set([
    "chainId",
    "nonce",
    "to",
    "valueWei",
    "gasLimit",
    "data",
    ...feeKeys,
  ]);

  if (
    ownKeys.length !== allowedKeys.size ||
    ownKeys.some((key) => !allowedKeys.has(key))
  ) {
    throw new Error("Invalid input: unknown or missing keys");
  }

  for (const key of ownKeys) {
    const desc = Object.getOwnPropertyDescriptor(input, key);
    if (desc !== undefined && ("get" in desc || "set" in desc)) {
      throw new Error("Invalid input: accessor field");
    }
  }

  const fields = Object.create(null);
  try {
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) {
        throw new Error("Invalid input: missing required key");
      }
      fields[key] = input[key];
    }
  } catch {
    throw new Error("Invalid input: cannot read required fields");
  }

  if (fields.chainId !== 1) {
    throw new Error("Invalid chainId: expected numeric 1");
  }
  if (fields.data !== "0x") {
    throw new Error('Invalid data: expected exactly "0x"');
  }

  const nonce = ethUnsignedParseDecimal(
    fields.nonce,
    "nonce",
    0n,
    ETH_UNSIGNED_NONCE_MAX,
  );
  const valueWei = ethUnsignedParseDecimal(
    fields.valueWei,
    "valueWei",
    0n,
    ETH_UNSIGNED_UINT256_MAX,
  );
  const gasLimit = ethUnsignedParseDecimal(
    fields.gasLimit,
    "gasLimit",
    21000n,
    16777216n,
  );
  const toBytes = ethUnsignedAddressBytes(fields.to);
  const fees = feeKeys.map((key) =>
    ethUnsignedParseDecimal(fields[key], key, 0n, ETH_UNSIGNED_UINT256_MAX),
  );

  if (is1559 && fees[0] > fees[1]) {
    throw new Error(
      "Invalid maxPriorityFeePerGasWei: exceeds maxFeePerGasWei",
    );
  }

  const feeCap = fees[fees.length - 1];
  if (valueWei + gasLimit * feeCap > ETH_UNSIGNED_UINT256_MAX) {
    throw new Error(
      "Invalid transaction: valueWei + gasLimit * feeCap exceeds uint256",
    );
  }

  return { nonce, valueWei, gasLimit, toBytes, fees };
}

export function buildEthLegacyUnsignedTx(input) {
  const { nonce, valueWei, gasLimit, toBytes, fees } =
    ethUnsignedParseInput(input, false);
  const emptyBytes = Buffer.alloc(0);

  const payload = rlpEncode([
    bigIntToMinimalBytes(nonce),
    bigIntToMinimalBytes(fees[0]),
    bigIntToMinimalBytes(gasLimit),
    toBytes,
    bigIntToMinimalBytes(valueWei),
    emptyBytes,
    bigIntToMinimalBytes(1n),
    emptyBytes,
    emptyBytes,
  ]);

  return {
    chainId: 1,
    type: 0,
    signingPayloadHex: `0x${bytesToHex(payload)}`,
  };
}

export function buildEth1559UnsignedTx(input) {
  const { nonce, valueWei, gasLimit, toBytes, fees } =
    ethUnsignedParseInput(input, true);

  const encoded = rlpEncode([
    bigIntToMinimalBytes(1n),
    bigIntToMinimalBytes(nonce),
    bigIntToMinimalBytes(fees[0]),
    bigIntToMinimalBytes(fees[1]),
    bigIntToMinimalBytes(gasLimit),
    toBytes,
    bigIntToMinimalBytes(valueWei),
    Buffer.alloc(0),
    [],
  ]);
  const payload = Buffer.concat([Buffer.from([0x02]), encoded]);

  return {
    chainId: 1,
    type: 2,
    signingPayloadHex: `0x${bytesToHex(payload)}`,
  };
}

// ---------------------------------------------------------------------------
// TRON: native TRX TransferContract unsigned transaction (mainnet)
// ---------------------------------------------------------------------------
//
// Deviation from Astra design o5a, recorded in NOTES.md: the design
// requires a module-pinned authenticated mainnet snapshot (contextId,
// block ID equality, verified Normal recipient list). That makes the
// builder depend on live data this lane does not hold and that goes
// stale, and contradicts the offline synthetic-fixture deliverable.
// Instead refBlockId is a format-validated synthetic fixture input and
// the recipient is validated by format and distinctness only. Offline
// construction cannot prove recipient account state; the doc states
// this, and the artifact is unsigned and never broadcast.

const TRON_TRANSFER_TYPE_URL = 'type.googleapis.com/protocol.TransferContract';
const TRON_MAX_INT64 = (1n << 63n) - 1n;
const TRON_MAX_EXPIRY_SPAN_MS = 86400000n;

function validateTronAddress(address, label) {
  if (typeof address !== 'string' || address.length !== 34 || !address.startsWith('T')) {
    throw new Error(`Invalid ${label}: expected a 34-character T address`);
  }
  const payload = base58CheckDecode(address, label, 25);
  if (payload[0] !== 65) throw new Error(`Invalid ${label}: expected version byte 65`);
  if (base58EncodeCheck(payload) !== address) {
    throw new Error(`Invalid ${label}: non-canonical encoding`);
  }
  return payload;
}

function base58EncodeCheck(payload21) {
  const checksum = sha256(sha256(payload21)).subarray(0, 4);
  const full = Buffer.concat([payload21, checksum]);
  let n = 0n;
  for (const byte of full) n = (n << 8n) | BigInt(byte);
  let out = '';
  if (n === 0n) out = '1';
  while (n > 0n) {
    out = BASE58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  let leadingZeros = 0;
  for (const byte of full) {
    if (byte !== 0) break;
    leadingZeros += 1;
  }
  return '1'.repeat(leadingZeros) + out;
}

export function buildTronMainnetUnsignedTransfer(input) {
  assertClosedObject(
    input,
    ['ownerAddress', 'toAddress', 'amountSun', 'refBlockId', 'timestampMs', 'expirationMs'],
    ['feeLimitSun'],
    'tron input',
  );
  const ownerPayload = validateTronAddress(input.ownerAddress, 'tron ownerAddress');
  const toPayload = validateTronAddress(input.toAddress, 'tron toAddress');
  if (ownerPayload.equals(toPayload)) {
    throw new Error('Invalid tron input: owner and recipient must differ');
  }
  const amountSun = parseCanonicalDecimal(input.amountSun, 'tron amountSun', 1n, TRON_MAX_INT64);
  if (typeof input.refBlockId !== 'string' || !/^[0-9a-f]{64}$/.test(input.refBlockId)) {
    throw new Error('Invalid tron input: refBlockId must be 64 lowercase hex characters');
  }
  const refBlockBytes = hexToBytes(input.refBlockId, 'tron refBlockId');
  const timestampMs = parseCanonicalDecimal(input.timestampMs, 'tron timestampMs', 1n, TRON_MAX_INT64);
  const expirationMs = parseCanonicalDecimal(input.expirationMs, 'tron expirationMs', 1n, TRON_MAX_INT64);
  if (expirationMs <= timestampMs) {
    throw new Error('Invalid tron input: expiration must be after timestamp');
  }
  if (expirationMs - timestampMs > TRON_MAX_EXPIRY_SPAN_MS) {
    throw new Error('Invalid tron input: expiration more than 24h after timestamp');
  }
  if (input.feeLimitSun !== undefined) {
    if (input.feeLimitSun !== '0') {
      throw new Error('Invalid tron input: feeLimitSun must be "0"');
    }
  }

  const transfer = Buffer.concat([
    encodeBytesField(1, ownerPayload),
    encodeBytesField(2, toPayload),
    encodeVarintField(3, amountSun),
  ]);
  const any = Buffer.concat([
    encodeBytesField(1, Buffer.from(TRON_TRANSFER_TYPE_URL, 'utf8')),
    encodeBytesField(2, transfer),
  ]);
  const contract = Buffer.concat([
    encodeVarintField(1, 1n),
    encodeBytesField(2, any),
  ]);
  const raw = Buffer.concat([
    encodeBytesField(1, refBlockBytes.subarray(6, 8)),
    encodeBytesField(4, refBlockBytes.subarray(8, 16)),
    encodeVarintField(8, expirationMs),
    encodeBytesField(11, contract),
    encodeVarintField(14, timestampMs),
  ]);
  const outer = encodeBytesField(1, raw);
  return {
    network: 'tron-mainnet',
    rawDataHex: bytesToHex(raw),
    unsignedTransactionHex: bytesToHex(outer),
    txID: bytesToHex(sha256(raw)),
  };
}

// ---------------------------------------------------------------------------
// TON: Wallet V4 R2 unsigned transfer (Astra, call 9)
// ---------------------------------------------------------------------------

export function buildTonV4R2UnsignedTransfer(input) {
  let sender, destination, amountNano, seqno, validUntil;

  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Invalid input");
    }

    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Invalid input");
    }

    const allowedKeys = ["sender", "destination", "amountNano", "seqno", "validUntil"];
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) {
      throw new Error("Invalid input keys");
    }

    for (const key of keys) {
      const desc = Object.getOwnPropertyDescriptor(input, key);
      if (desc !== undefined && ("get" in desc || "set" in desc)) {
        throw new Error("Invalid input keys");
      }
    }

    ({ sender, destination, amountNano, seqno, validUntil } = input);
  } catch {
    throw new Error("Invalid input");
  }

  if (typeof amountNano !== "string") {
    throw new Error("Invalid amountNano");
  }
  if (
    typeof seqno !== "number" ||
    !Number.isInteger(seqno) ||
    seqno < 0 ||
    seqno > 4294967295
  ) {
    throw new Error("Invalid seqno");
  }
  if (
    typeof validUntil !== "number" ||
    !Number.isInteger(validUntil) ||
    validUntil < 1 ||
    validUntil > 4294967295
  ) {
    throw new Error("Invalid validUntil");
  }

  let amount;
  try {
    amount = parseCanonicalDecimal(
      amountNano,
      "amountNano",
      1n,
      (1n << 120n) - 1n
    );
  } catch {
    throw new Error("Invalid amountNano");
  }

  function crc16Xmodem(bytes) {
    let crc = 0;
    for (const byte of bytes) {
      crc ^= byte << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
      }
    }
    return crc;
  }

  function crc32c(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc = (crc ^ byte) >>> 0;
      for (let bit = 0; bit < 8; bit++) {
        crc = ((crc >>> 1) ^ ((crc & 1) ? 0x82f63b78 : 0)) >>> 0;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function addressHash(value, label, senderOnly) {
    if (
      typeof value !== "string" ||
      value.length !== 48 ||
      !/^[A-Za-z0-9_-]{48}$/.test(value)
    ) {
      throw new Error(`Invalid ${label}`);
    }

    const bytes = Buffer.from(value, "base64url");
    if (bytes.length !== 36 || bytes.toString("base64url") !== value) {
      throw new Error(`Invalid ${label}`);
    }

    const validTag = senderOnly
      ? bytes[0] === 81
      : bytes[0] === 17 || bytes[0] === 81;

    if (
      !validTag ||
      bytes[1] !== 0 ||
      crc16Xmodem(bytes.subarray(0, 34)) !== bytes.readUInt16BE(34)
    ) {
      throw new Error(`Invalid ${label}`);
    }

    return bytes.subarray(2, 34);
  }

  class Cell {
    constructor() {
      this.bits = [];
      this.refs = [];
    }

    storeUint(value, bitLength) {
      const n = BigInt(value);
      if (n < 0n || n >= (1n << BigInt(bitLength))) {
        throw new Error("Invalid TON integer");
      }
      for (let bit = bitLength - 1; bit >= 0; bit--) {
        this.bits.push(Number((n >> BigInt(bit)) & 1n));
      }
      return this;
    }

    storeBuffer(bytes) {
      for (const byte of bytes) {
        this.storeUint(byte, 8);
      }
      return this;
    }

    storeRef(cell) {
      this.refs.push(cell);
      return this;
    }

    storeInline(cell) {
      this.bits.push(...cell.bits);
      this.refs.push(...cell.refs);
      return this;
    }
  }

  function storeAddress(cell, accountHash) {
    return cell
      .storeUint(2, 2)
      .storeUint(0, 1)
      .storeUint(0, 8)
      .storeBuffer(accountHash);
  }

  function storeGrams(cell, value) {
    let byteLength = 0;
    for (let remaining = value; remaining > 0n; remaining >>= 8n) {
      byteLength++;
    }
    return cell.storeUint(byteLength, 4).storeUint(value, byteLength * 8);
  }

  function cellEncoding(cell) {
    const bitLength = cell.bits.length;
    const remainder = bitLength % 8;
    const data = Buffer.alloc(Math.ceil(bitLength / 8));

    for (let bit = 0; bit < bitLength; bit++) {
      data[bit >>> 3] |= cell.bits[bit] << (7 - (bit & 7));
    }
    if (remainder !== 0) {
      data[data.length - 1] |= 1 << (7 - remainder);
    }

    const descriptors = Buffer.from([
      cell.refs.length + (remainder === 0 ? 0 : 8),
      Math.floor(bitLength / 8) + Math.ceil(bitLength / 8)
    ]);

    return { descriptors, data };
  }

  function byteWidth(value) {
    let n = BigInt(value);
    let width = 1;
    while (n > 255n) {
      n >>= 8n;
      width++;
    }
    return width;
  }

  function uintBE(value, width) {
    let n = BigInt(value);
    const bytes = Buffer.alloc(width);
    for (let index = width - 1; index >= 0; index--) {
      bytes[index] = Number(n & 255n);
      n >>= 8n;
    }
    return bytes;
  }

  function bocBase64(root) {
    const cells = [];
    const indices = new Map();

    function visit(cell) {
      if (indices.has(cell)) {
        return;
      }
      indices.set(cell, cells.length);
      cells.push(cell);
      for (const child of cell.refs) {
        visit(child);
      }
    }

    visit(root);

    const referenceWidth = byteWidth(cells.length);
    const payload = Buffer.concat(cells.map(cell => {
      const { descriptors, data } = cellEncoding(cell);
      return Buffer.concat([
        descriptors,
        data,
        ...cell.refs.map(child => uintBE(indices.get(child), referenceWidth))
      ]);
    }));
    const offsetWidth = byteWidth(payload.length);

    const header = Buffer.concat([
      Buffer.from([
        0xb5, 0xee, 0x9c, 0x72,
        0x40 | referenceWidth,
        offsetWidth
      ]),
      uintBE(cells.length, referenceWidth),
      uintBE(1, referenceWidth),
      uintBE(0, referenceWidth),
      uintBE(payload.length, offsetWidth),
      uintBE(0, referenceWidth)
    ]);

    const precedingBytes = Buffer.concat([header, payload]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32LE(crc32c(precedingBytes), 0);

    return Buffer.concat([precedingBytes, checksum]).toString("base64");
  }

  function cellHash(cell) {
    const children = cell.refs.map(child => cellHash(child));
    const { descriptors, data } = cellEncoding(cell);
    const representation = Buffer.concat([
      descriptors,
      data,
      ...children.map(child => uintBE(child.depth, 2)),
      ...children.map(child => child.hash)
    ]);

    return {
      depth: children.length === 0
        ? 0
        : 1 + Math.max(...children.map(child => child.depth)),
      hash: sha256(representation)
    };
  }

  const senderHash = addressHash(sender, "sender", true);
  const destinationHash = addressHash(destination, "destination", false);

  const internalMessage = new Cell()
    .storeUint(0, 1)
    .storeUint(1, 1)
    .storeUint(0, 1)
    .storeUint(0, 1)
    .storeUint(0, 2);

  storeAddress(internalMessage, destinationHash);
  storeGrams(internalMessage, amount);
  internalMessage.storeUint(0, 1);
  storeGrams(internalMessage, 0n);
  storeGrams(internalMessage, 0n);
  internalMessage
    .storeUint(0n, 64)
    .storeUint(0, 32)
    .storeUint(0, 1)
    .storeUint(0, 1);

  const signingCell = new Cell()
    .storeUint(698983191, 32)
    .storeUint(validUntil, 32)
    .storeUint(seqno, 32)
    .storeUint(0, 8)
    .storeUint(3, 8)
    .storeRef(internalMessage);

  const bodyCell = new Cell()
    .storeUint(0n, 512)
    .storeInline(signingCell);

  const externalEnvelope = new Cell()
    .storeUint(2, 2)
    .storeUint(0, 2);

  storeAddress(externalEnvelope, senderHash);
  storeGrams(externalEnvelope, 0n);
  externalEnvelope
    .storeUint(0, 1)
    .storeUint(1, 1)
    .storeRef(bodyCell);

  return {
    kind: "ton-v4r2-native-unsigned",
    unsignedBocBase64: bocBase64(externalEnvelope),
    signingBocBase64: bocBase64(signingCell),
    signingHashBase64: cellHash(signingCell).hash.toString("base64")
  };
}

// ---------------------------------------------------------------------------
// Forbidden operations: no execution path exists. Each stub throws before
// inspecting its arguments. The exact message is part of the contract.
// ---------------------------------------------------------------------------

const DISABLED_MESSAGE = 'Disabled operation: offline unsigned native transactions only.';

export function broadcastTransaction() {
  throw new Error(DISABLED_MESSAGE);
}

export function sendTransaction() {
  throw new Error(DISABLED_MESSAGE);
}

export function transferToken() {
  throw new Error(DISABLED_MESSAGE);
}

export function callContract() {
  throw new Error(DISABLED_MESSAGE);
}

export function approveAllowance() {
  throw new Error(DISABLED_MESSAGE);
}

export function signTransaction() {
  throw new Error(DISABLED_MESSAGE);
}
