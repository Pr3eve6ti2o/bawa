/**
 * TEMPORARY devnet mode (owner order 2026-11-22): a test-only switch that
 * points the four adapter chains (BTC, ETH, TRX, TON) at their public
 * test networks so send/receive can be exercised with valueless tokens.
 * Devnet is TEMPORARY: see docs/DECISIONS.md for the removal checklist.
 *
 * This module stores a preference only, never a mnemonic, password, or
 * key. It also holds the pure address helpers the devnet derivation
 * needs: bech32 re-encoding (Wallet Core always encodes BTC as bc1q,
 * so the devnet tb1q form is re-encoded from the same witness
 * program), base58check decoding for testnet version bytes, and the
 * TON testnet-flag re-encode (tag 0xD1 non-bounceable / 0x91
 * bounceable, CRC recomputed).
 */

import { hexToBytes, sha256 } from 'viem';

export const DEVNET_ENABLED_KEY = 'bawa-devnet-enabled';

export function readDevnetEnabled(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(DEVNET_ENABLED_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function writeDevnetEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVNET_ENABLED_KEY, enabled ? '1' : '0');
    }
  } catch {
    // Storage may be unavailable or disabled; ignore write failures.
  }
}

// ---------------------------------------------------------------------------
// Bech32 / Bech32m (BIP-173 / BIP-350). Mirrors engine/destination.ts.
// ---------------------------------------------------------------------------

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATORS = [
  0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
];
const BECH32_CONSTANT = 1;
const BECH32M_CONSTANT = 0x2bc830a3;

function bech32Polymod(values: readonly number[]): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if (((top >> i) & 1) !== 0) {
        checksum ^= BECH32_GENERATORS[i]!;
      }
    }
  }
  return checksum;
}

function hrpExpand(hrp: string): number[] {
  const expanded: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    expanded.push(hrp.charCodeAt(i) >> 5);
  }
  expanded.push(0);
  for (let i = 0; i < hrp.length; i++) {
    expanded.push(hrp.charCodeAt(i) & 31);
  }
  return expanded;
}

// Strict convertbits: no padding allowed, non-zero padding bits and
// incomplete final groups are rejected — unless `pad` is set, for
// encoding: the final partial group is zero-padded and emitted (the
// BIP-173 reference convertbits with pad=true).
function convertBits(
  data: readonly number[],
  fromBits: number,
  toBits: number,
  pad = false,
): number[] | null {
  let accumulator = 0;
  let bits = 0;
  const result: number[] = [];
  const maxValue = (1 << toBits) - 1;
  for (const value of data) {
    accumulator = (accumulator << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((accumulator >> bits) & maxValue);
    }
    accumulator &= (1 << bits) - 1;
  }
  if (bits > 0) {
    if (pad) {
      result.push((accumulator << (toBits - bits)) & maxValue);
      return result;
    }
    if (bits >= fromBits) return null;
    if (((accumulator << (toBits - bits)) & maxValue) !== 0) return null;
  }
  return result;
}

export interface BtcBech32Decoded {
  hrp: 'bc' | 'tb';
  witnessVersion: number;
  program: number[];
}

/** Decode a bc1/tb1 address, or null when it is not a valid one. */
export function decodeBtcBech32(
  address: string,
): BtcBech32Decoded | null {
  if (address.length > 90) return null;
  if (/[a-z]/.test(address) && /[A-Z]/.test(address)) return null;
  const lower = address.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (separator < 1 || lower.length - separator - 1 < 6) return null;
  const hrp = lower.slice(0, separator);
  if (hrp !== 'bc' && hrp !== 'tb') return null;
  const dataPart = lower.slice(separator + 1);
  const data: number[] = [];
  for (const character of dataPart) {
    const value = BECH32_CHARSET.indexOf(character);
    if (value === -1) return null;
    data.push(value);
  }
  const polymod = bech32Polymod([...hrpExpand(hrp), ...data]);
  const witnessVersion = data[0]!;
  const isBech32 = polymod === BECH32_CONSTANT;
  const isBech32m = polymod === BECH32M_CONSTANT;
  if (witnessVersion === 0 && !isBech32) return null;
  if (witnessVersion === 1 && !isBech32m) return null;
  if (witnessVersion !== 0 && witnessVersion !== 1) return null;
  const program = convertBits(data.slice(1, data.length - 6), 5, 8);
  if (program === null) return null;
  if (witnessVersion === 0 && program.length !== 20 && program.length !== 32) {
    return null;
  }
  if (witnessVersion === 1 && program.length !== 32) return null;
  return { hrp, witnessVersion, program };
}

/** Encode a witness program with the given HRP (bech32m for version 1). */
export function encodeBtcBech32(
  hrp: 'bc' | 'tb',
  witnessVersion: number,
  program: readonly number[],
): string {
  if (witnessVersion !== 0 && witnessVersion !== 1) {
    throw new Error('Unsupported witness version.');
  }
  if (witnessVersion === 0 && program.length !== 20 && program.length !== 32) {
    throw new Error('Invalid witness program length for version 0.');
  }
  if (witnessVersion === 1 && program.length !== 32) {
    throw new Error('Invalid witness program length for version 1.');
  }
  const data = [witnessVersion, ...convertBits(program, 8, 5, true)!];
  const checksumConstant =
    witnessVersion === 0 ? BECH32_CONSTANT : BECH32M_CONSTANT;
  const polymod =
    bech32Polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^
    checksumConstant;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  return (
    hrp + '1' + [...data, ...checksum].map((value) => BECH32_CHARSET[value]).join('')
  );
}

/**
 * Re-encode a mainnet bech32 address (bc1q/bc1p) as its testnet form
 * (tb1q/tb1p): the witness program is identical, only the HRP and the
 * checksum change. Returns null for non-bech32 input.
 */
export function reencodeBtcAddressToTestnet(address: string): string | null {
  const decoded = decodeBtcBech32(address);
  if (decoded === null || decoded.hrp !== 'bc') return null;
  return encodeBtcBech32('tb', decoded.witnessVersion, decoded.program);
}

/**
 * Re-encode a testnet address as its mainnet form — the form Wallet
 * Core's mainnet-coin calls need (the script is identical, only the
 * presentation differs):
 * - tb1q/tb1p -> bc1q/bc1p (same witness program);
 * - base58 testnet P2PKH (0x6f) -> P2PKH (0x00), P2SH (0xc4) -> P2SH
 *   (0x05), with the checksum recomputed over the same hash.
 * Returns null for non-testnet input.
 */
export function reencodeBtcAddressToMainnet(address: string): string | null {
  const bech32 = decodeBtcBech32(address);
  if (bech32 !== null) {
    if (bech32.hrp !== 'tb') return null;
    return encodeBtcBech32('bc', bech32.witnessVersion, bech32.program);
  }
  const decoded = decodeBase58Check(address);
  if (decoded === null) return null;
  if (decoded.version === 0x6f) {
    return encodeBase58Check(0x00, decoded.payload);
  }
  if (decoded.version === 0xc4) {
    return encodeBase58Check(0x05, decoded.payload);
  }
  return null;
}

/** True for tb1q/tb1p and testnet base58 (0x6f/0xc4) addresses only. */
export function isValidTestnetBtcAddress(address: string): boolean {
  const bech32 = decodeBtcBech32(address);
  if (bech32 !== null) return bech32.hrp === 'tb';
  const decoded = decodeBase58Check(address);
  if (decoded === null) return false;
  return decoded.version === 0x6f || decoded.version === 0xc4;
}

// ---------------------------------------------------------------------------
// Base58Check
// ---------------------------------------------------------------------------

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(input: string): Uint8Array | null {
  let value = 0n;
  for (const character of input) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit === -1) return null;
    value = value * 58n + BigInt(digit);
  }
  const reversed: number[] = [];
  while (value > 0n) {
    reversed.push(Number(value % 256n));
    value /= 256n;
  }
  let leadingZeroes = 0;
  while (
    leadingZeroes < input.length &&
    input.charAt(leadingZeroes) === '1'
  ) {
    leadingZeroes++;
  }
  const bytes = new Uint8Array(leadingZeroes + reversed.length);
  for (let i = 0; i < reversed.length; i++) {
    bytes[leadingZeroes + i] = reversed[reversed.length - 1 - i]!;
  }
  return bytes;
}

function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i] as number;
    for (let j = 0; j < digits.length; j += 1) {
      carry += (digits[j] as number) * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return (
    '1'.repeat(zeros) +
    digits
      .reverse()
      .map((digit) => BASE58_ALPHABET[digit] as string)
      .join('')
  );
}

function doubleSha256(bytes: Uint8Array): Uint8Array {
  return hexToBytes(sha256(hexToBytes(sha256(bytes))));
}

export interface Base58CheckDecoded {
  version: number;
  payload: Uint8Array;
}

/** Decode and checksum-verify a Base58Check string, or null. */
export function decodeBase58Check(
  input: string,
): Base58CheckDecoded | null {
  const bytes = decodeBase58(input);
  if (bytes === null || bytes.length !== 25) return null;
  const checksum = doubleSha256(bytes.subarray(0, 21));
  for (let i = 0; i < 4; i++) {
    if (bytes[21 + i] !== checksum[i]) return null;
  }
  return { version: bytes[0]!, payload: bytes.subarray(1, 21) };
}

function encodeBase58Check(version: number, payload: Uint8Array): string {
  const body = new Uint8Array(21);
  body[0] = version;
  body.set(payload, 1);
  const checksum = doubleSha256(body);
  const full = new Uint8Array(25);
  full.set(body, 0);
  full.set(checksum.subarray(0, 4), 21);
  return encodeBase58(full);
}

// ---------------------------------------------------------------------------
// TON user-friendly addresses (TEP-0002)
// ---------------------------------------------------------------------------

// CRC16-XMODEM (poly 0x1021, init 0x0000), the checksum of TON
// user-friendly addresses.
function crc16Xmodem(data: Uint8Array): number {
  let crc = 0x0000;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function decodeTonFriendly(
  address: string,
): Uint8Array | null {
  if (!/^[A-Za-z0-9+/=_-]{48}$/.test(address)) return null;
  const standard = address.replace(/-/g, '+').replace(/_/g, '/');
  let binary: string;
  try {
    binary = globalThis.atob(standard);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.length === 36 ? bytes : null;
}

function encodeTonFriendly(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function tonTagAndWorkchain(bytes: Uint8Array): {
  tag: number;
  workchain: number;
} {
  return { tag: bytes[0]!, workchain: bytes[1]! };
}

function tonChecksumValid(bytes: Uint8Array): boolean {
  const storedCrc = (bytes[34]! << 8) | bytes[35]!;
  return crc16Xmodem(bytes.subarray(0, 34)) === storedCrc;
}

/**
 * Re-encode a mainnet TON UQ address (tag 0x51, workchain 0) as its
 * testnet UQ form (tag 0xD1, workchain 0, CRC recomputed): the account
 * hash is identical, only the network tag changes. A bounceable mainnet
 * address (0x11) is accepted and also lands on the non-bounceable
 * testnet form. Throws on testnet input, another workchain, or a bad
 * checksum.
 */
export function toTonTestnetUqAddress(mainnetAddress: string): string {
  const bytes = decodeTonFriendly(mainnetAddress.trim());
  if (bytes === null) {
    throw new Error('Invalid TON user-friendly address encoding.');
  }
  const { tag, workchain } = tonTagAndWorkchain(bytes);
  if (tag !== 0x51 && tag !== 0x11) {
    throw new Error('Expected a mainnet TON address.');
  }
  if (workchain !== 0x00 && workchain !== 0xff) {
    throw new Error('Expected a workchain-zero TON address.');
  }
  if (!tonChecksumValid(bytes)) {
    throw new Error('Invalid TON address checksum.');
  }
  bytes[0] = 0xd1;
  const checksum = crc16Xmodem(bytes.subarray(0, 34));
  bytes[34] = checksum >>> 8;
  bytes[35] = checksum & 0xff;
  return encodeTonFriendly(bytes);
}

/** True for testnet-flagged TON addresses (0Q non-bounceable, kQ bounceable). */
export function isValidTestnetTonAddress(address: string): boolean {
  const bytes = decodeTonFriendly(address.trim());
  if (bytes === null) return false;
  const { tag, workchain } = tonTagAndWorkchain(bytes);
  if (tag !== 0x91 && tag !== 0xd1) return false;
  if (workchain !== 0x00 && workchain !== 0xff) return false;
  return tonChecksumValid(bytes);
}
