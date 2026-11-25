/**
 * Kaspa address encoding (CashAddr-style bech32, `kaspa:` prefix).
 *
 * A Kaspa P2PK address is version byte 0x00 followed by the 32-byte
 * X-only secp256k1 public key, encoded CashAddr-style (8-to-5-bit
 * conversion + 40-bit polymod checksum over the `kaspa` prefix).
 *
 * Algorithm reference: OKX js-wallet-sdk, bu-packages/coin-kaspa/src/lib
 * (address.ts, base32.ts, convertBits.ts), which itself derives from
 * cashaddrjs (Emilio Almansi, MIT) and Pieter Wuille's bech32 reference.
 * This file re-implements that algorithm from the reference (no SDK code
 * is imported — @okxweb3/crypto-lib must never enter the bundle); the
 * vectors in kaspa-address.test.ts pin it against the SDK's own tests.
 */

/** Bech32 charset (CashAddr order). */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

const CHARSET_INVERSE_INDEX: Record<string, number> = {
  q: 0,
  p: 1,
  z: 2,
  r: 3,
  y: 4,
  '9': 5,
  x: 6,
  '8': 7,
  g: 8,
  f: 9,
  '2': 10,
  t: 11,
  v: 12,
  d: 13,
  w: 14,
  '0': 15,
  s: 16,
  '3': 17,
  j: 18,
  n: 19,
  '5': 20,
  '4': 21,
  k: 22,
  h: 23,
  c: 24,
  e: 25,
  '6': 26,
  m: 27,
  u: 28,
  a: 29,
  '7': 30,
  l: 31,
};

/** Convert between bit widths (Pieter Wuille's bech32 reference). */
function convertBits(
  data: Uint8Array,
  from: number,
  to: number,
  strictMode: boolean,
): Uint8Array {
  const length = strictMode
    ? Math.floor((data.length * from) / to)
    : Math.ceil((data.length * from) / to);
  const mask = (1 << to) - 1;
  const result = new Uint8Array(length);
  let index = 0;
  let accumulator = 0;
  let bits = 0;
  for (let i = 0; i < data.length; ++i) {
    const value = data[i]!;
    if (!(value >= 0 && (value >> from) === 0)) {
      throw new Error('Invalid value: ' + value + '.');
    }
    accumulator = (accumulator << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      result[index] = (accumulator >> bits) & mask;
      ++index;
    }
  }
  if (!strictMode) {
    if (bits > 0) {
      result[index] = (accumulator << (to - bits)) & mask;
      ++index;
    }
  } else if (
    !(
      bits < from &&
      ((accumulator << (to - bits)) & mask) === 0
    )
  ) {
    throw new Error(
      'Input cannot be converted to ' + to + ' bits without padding.',
    );
  }
  return result;
}

function prefixToArray(prefix: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < prefix.length; i++) {
    result.push(prefix.charCodeAt(i) & 31);
  }
  return result;
}

const GENERATOR1 = [0x98, 0x79, 0xf3, 0xae, 0x1e];
const GENERATOR2 = [0xf2bc8e61, 0xb76d99e2, 0x3e5fb3c4, 0x2eabe2a8, 0x4f43e470];

/** CashAddr polymod checksum (40-bit, split as 8 + 32 bits). */
function polymod(data: Uint8Array): number {
  let c0 = 0;
  let c1 = 1;
  let c = 0;
  for (let j = 0; j < data.length; j++) {
    c = c0 >>> 3;
    c0 &= 0x07;
    c0 <<= 5;
    c0 |= c1 >>> 27;
    c1 &= 0x07ffffff;
    c1 <<= 5;
    c1 ^= data[j]!;
    for (let i = 0; i < GENERATOR1.length; ++i) {
      if (c & (1 << i)) {
        c0 ^= GENERATOR1[i]!;
        c1 ^= GENERATOR2[i]!;
      }
    }
  }
  c1 ^= 1;
  if (c1 < 0) {
    c1 ^= 1 << 31;
    c1 += (1 << 30) * 2;
  }
  return c0 * (1 << 30) * 4 + c1;
}

function checksumToArray(checksum: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < 8; ++i) {
    result.push(checksum & 31);
    checksum /= 32;
  }
  return result.reverse();
}

function base32Encode(data: Uint8Array): string {
  let out = '';
  for (let i = 0; i < data.length; ++i) {
    const value = data[i]!;
    if (!(value >= 0 && value < 32)) {
      throw new Error('Invalid value: ' + value + '.');
    }
    out += CHARSET[value]!;
  }
  return out;
}

function base32Decode(str: string): Uint8Array {
  const data = new Uint8Array(str.length);
  for (let i = 0; i < str.length; ++i) {
    const value = str[i]!;
    if (!(value in CHARSET_INVERSE_INDEX)) {
      throw new Error('Invalid value: ' + value + '.');
    }
    data[i] = CHARSET_INVERSE_INDEX[value]!;
  }
  return data;
}

/**
 * Encode a Kaspa P2PK address from the 32-byte X-only secp256k1 public
 * key (the compressed key with its 02/03 prefix byte removed — the form
 * the OKX SDK's pubKeyFromPrvKey produces).
 */
export function kaspaAddressFromXOnlyPubkey(xOnly: Uint8Array): string {
  if (xOnly.length !== 32) {
    throw new Error('Kaspa X-only public key must be 32 bytes.');
  }
  const eight0 = [0, 0, 0, 0, 0, 0, 0, 0];
  const prefixData = prefixToArray('kaspa').concat([0]);
  const versionByte = 0;
  const payloadData = convertBits(
    new Uint8Array([versionByte, ...xOnly]),
    8,
    5,
    false,
  );
  const checksumData = new Uint8Array(
    prefixData.length + payloadData.length + eight0.length,
  );
  checksumData.set(prefixData);
  checksumData.set(payloadData, prefixData.length);
  checksumData.set(eight0, prefixData.length + payloadData.length);
  const polymodData = checksumToArray(polymod(checksumData));
  const payload = new Uint8Array(payloadData.length + polymodData.length);
  payload.set(payloadData);
  payload.set(polymodData, payloadData.length);
  return 'kaspa:' + base32Encode(payload);
}

/**
 * Encode a Kaspa P2PK address from the 33-byte compressed secp256k1
 * public key (the form Wallet Core's getPublicKeySecp256k1 returns).
 */
export function kaspaAddressFromCompressedPubkey(
  compressed: Uint8Array,
): string {
  if (compressed.length !== 33) {
    throw new Error('Kaspa compressed public key must be 33 bytes.');
  }
  if (compressed[0] !== 0x02 && compressed[0] !== 0x03) {
    throw new Error('Kaspa compressed public key must start with 02 or 03.');
  }
  return kaspaAddressFromXOnlyPubkey(compressed.slice(1));
}

/** True when the string is a well-formed Kaspa P2PK address. */
export function isValidKaspaAddress(address: string): boolean {
  try {
    if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
      return false;
    }
    const lower = address.toLowerCase();
    const pieces = lower.split(':');
    if (pieces.length !== 2 || pieces[0] !== 'kaspa') return false;
    const decoded = base32Decode(pieces[1]!);
    const prefixData = prefixToArray('kaspa');
    const data = new Uint8Array(
      prefixData.length + 1 + decoded.length,
    );
    data.set(prefixData);
    data.set([0], prefixData.length);
    data.set(decoded, prefixData.length + 1);
    if (polymod(data) !== 0) return false;
    const converted = convertBits(decoded.slice(0, -8), 5, 8, true);
    const version = converted[0];
    const payload = converted.slice(1);
    return version === 0x00 && payload.length === 32;
  } catch {
    return false;
  }
}
