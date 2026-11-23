/**
 * Shared address-encoding primitives: bech32/bech32m (BIP-173/350),
 * base58/base58check building blocks, and the TON CRC16-XMODEM
 * checksum. These were duplicated across engine/destination.ts,
 * wallet/devnet.ts, wallet/adapters/trx.ts (base58 encode), and
 * engine/boundary.ts + wallet/core.ts (CRC only); the copies are now
 * one module so a codec fix lands everywhere at once.
 *
 * Only the pure codecs live here. The checksum-verified wrappers keep
 * their own homes and contracts: destination.ts decodes base58check
 * with WebCrypto (async), devnet.ts with viem (sync), and the two
 * bech32 decoders keep their own failure shapes.
 */

export const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Decodes a Base58 string to bytes; returns null on an invalid character.
// Leading '1' characters are leading zero bytes.
export function decodeBase58(input: string): Uint8Array | null {
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

export function encodeBase58(bytes: Uint8Array): string {
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

export const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
export const BECH32_GENERATORS = [
  0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
];
export const BECH32_CONSTANT = 1;
export const BECH32M_CONSTANT = 0x2bc830a3;

export function bech32Polymod(values: readonly number[]): number {
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

export function hrpExpand(hrp: string): number[] {
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
export function convertBits(
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

// CRC16-XMODEM (poly 0x1021, init 0x0000, MSB-first, no lookup table),
// the checksum of TON user-friendly addresses (TEP-0002).
export function crc16Xmodem(data: Uint8Array): number {
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
