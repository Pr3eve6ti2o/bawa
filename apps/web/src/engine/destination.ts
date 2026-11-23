// Mainnet destination validation and mainnet-parameter selection for
// transaction preparation.
//
// Validation ONLY. This module contains no send, sign, or broadcast
// function, and none may be added here: transaction preparation stops
// before broadcasting, and M-35 execution is a separate approval gate.
//
// Address checks catch typos, not fraud (M-12). A scammer's address
// passes every checksum. Always compare the WHOLE address against an
// independently verified address-book entry, never an address copied
// from transaction history (history is where poisoned lookalikes
// live), and repeat the full-address check for the actual transfer:
// a test transfer validates only that payment.
//
// Limitations, stated plainly:
// - A TRON address string cannot prove mainnet: test networks share
//   the 0x41 prefix, so the network comes from the configured endpoint,
//   never the address.
// - An ETH address string is identical on every EVM chain; chainId
//   comes from the configured network, never the address.
// - A BTC address alone cannot distinguish mainnet from signet or
//   regtest except by its human-readable part / version byte.
//
// Parameter provenance is recorded in MAINNET_PARAMS[].sources; the
// confirmation thresholds are the register values (M-13, user-approved
// 2026-11-10). Confirmation policy is not a finality guarantee.

import {
  BECH32_CHARSET,
  BECH32_CONSTANT,
  BECH32M_CONSTANT,
  bech32Polymod,
  convertBits,
  crc16Xmodem,
  decodeBase58,
  hrpExpand,
} from './address-codecs';
import { keccak256Ascii } from './keccak';
import type {
  DestinationChain,
  DestinationValidation,
  MainnetParams,
} from '@bawa/contracts';

const TON_BOUNCEABLE_TAG = 0x11;
const TON_NON_BOUNCEABLE_TAG = 0x51;
const TON_TEST_FLAG = 0x80;

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed array: subtle.digest wants a
  // BufferSource, and a generic Uint8Array<ArrayBufferLike> is not
  // assignable to it under TS 5.9 (see boundary.ts, which passes a
  // freshly constructed array for the same reason).
  const copy = new Uint8Array(data.length);
  copy.set(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy);
  return new Uint8Array(digest);
}

async function doubleSha256(data: Uint8Array): Promise<Uint8Array> {
  return sha256(await sha256(data));
}

// ---------------------------------------------------------------------------
// Base58Check
// ---------------------------------------------------------------------------

interface Base58CheckDecoded {
  version: number;
  payload: Uint8Array;
}

// Decodes and checksum-verifies a Base58Check string. The caller maps the
// failure reason: 'invalid-character' | 'invalid-length' | 'invalid-checksum'.
async function decodeBase58Check(
  input: string,
): Promise<
  | { ok: true; decoded: Base58CheckDecoded }
  | { ok: false; reason: 'invalid-character' | 'invalid-length' | 'invalid-checksum' }
> {
  const bytes = decodeBase58(input);
  if (bytes === null) return { ok: false, reason: 'invalid-character' };
  if (bytes.length !== 25) return { ok: false, reason: 'invalid-length' };
  const checksum = await doubleSha256(bytes.subarray(0, 21));
  for (let i = 0; i < 4; i++) {
    if (bytes[21 + i] !== checksum[i]) {
      return { ok: false, reason: 'invalid-checksum' };
    }
  }
  return {
    ok: true,
    decoded: { version: bytes[0]!, payload: bytes.subarray(1, 21) },
  };
}

// ---------------------------------------------------------------------------
// Bech32 / Bech32m (BIP-173 / BIP-350)
// ---------------------------------------------------------------------------

type Bech32Failure =
  | 'invalid-format'
  | 'invalid-length'
  | 'invalid-character'
  | 'invalid-checksum'
  | 'wrong-network'
  | 'unsupported-version';

interface Bech32Decoded {
  witnessVersion: number;
  program: number[];
  addressType: 'p2wpkh' | 'p2wsh' | 'p2tr';
}

function decodeBech32Address(
  address: string,
  devnet = false,
): Bech32Decoded | Bech32Failure {
  if (address.length > 90) return 'invalid-length';
  const hasLower = /[a-z]/.test(address);
  const hasUpper = /[A-Z]/.test(address);
  if (hasLower && hasUpper) return 'invalid-character';
  const lower = address.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (separator < 1 || lower.length - separator - 1 < 6) {
    return 'invalid-format';
  }
  const hrp = lower.slice(0, separator);
  if (devnet) {
    // Devnet accepts the tb HRP only; bc is a mainnet address here and
    // bcrt (regtest) is never a devnet destination.
    if (hrp !== 'tb') {
      if (hrp === 'bc' || hrp === 'bcrt') return 'wrong-network';
      return 'invalid-format';
    }
  } else if (hrp !== 'bc') {
    if (hrp === 'tb' || hrp === 'bcrt') return 'wrong-network';
    return 'invalid-format';
  }
  const dataPart = lower.slice(separator + 1);
  const data: number[] = [];
  for (const character of dataPart) {
    const value = BECH32_CHARSET.indexOf(character);
    if (value === -1) return 'invalid-character';
    data.push(value);
  }
  const polymod = bech32Polymod([...hrpExpand(hrp), ...data]);
  const isBech32 = polymod === BECH32_CONSTANT;
  const isBech32m = polymod === BECH32M_CONSTANT;
  if (!isBech32 && !isBech32m) return 'invalid-checksum';
  const witnessVersion = data[0]!;
  const program = convertBits(data.slice(1, data.length - 6), 5, 8);
  if (program === null) return 'invalid-format';
  if (witnessVersion === 0) {
    if (!isBech32) return 'invalid-checksum';
    if (program.length === 20) {
      return { witnessVersion, program, addressType: 'p2wpkh' };
    }
    if (program.length === 32) {
      return { witnessVersion, program, addressType: 'p2wsh' };
    }
    return 'invalid-length';
  }
  if (witnessVersion === 1) {
    if (!isBech32m) return 'invalid-checksum';
    if (program.length === 32) {
      return { witnessVersion, program, addressType: 'p2tr' };
    }
    return 'invalid-length';
  }
  return 'unsupported-version';
}

// ---------------------------------------------------------------------------
// Per-chain validation
// ---------------------------------------------------------------------------

type DestinationFailureReason =
  | 'empty'
  | 'invalid-format'
  | 'invalid-length'
  | 'invalid-character'
  | 'invalid-checksum'
  | 'wrong-network'
  | 'unsupported-version';

function failure(
  chain: DestinationChain,
  reason: DestinationFailureReason,
  message: string,
): DestinationValidation {
  return { ok: false, chain, reason, message };
}

async function validateBtc(
  address: string,
  options?: DestinationValidationOptions,
): Promise<DestinationValidation> {
  const chain: DestinationChain = 'btc';
  const devnet = options?.devnet === true;
  if (address === '') {
    return failure(chain, 'empty', 'destination address is empty');
  }
  // Bech32-shaped input (letters, '1' separator, data) goes to the
  // Bech32 path, which sorts mainnet from testnet/regtest by HRP and
  // rejects unknown HRPs; everything else is Base58Check. Base58
  // P2PKH/P2SH addresses start with '1'/'3', so they never match.
  if (/^[a-zA-Z]{1,83}1[0-9a-zA-Z]+$/.test(address)) {
    const decoded = decodeBech32Address(address, devnet);
    if (typeof decoded === 'string') {
      return failure(chain, decoded, `invalid bech32 address: ${decoded}`);
    }
    return {
      ok: true,
      chain,
      checksum: 'verified',
      addressType: decoded.addressType,
    };
  }
  const decoded = await decodeBase58Check(address);
  if (!decoded.ok) {
    return failure(
      chain,
      decoded.reason,
      `invalid base58check address: ${decoded.reason}`,
    );
  }
  const { version } = decoded.decoded;
  if (devnet) {
    if (version === 0x6f) {
      return { ok: true, chain, checksum: 'verified', addressType: 'p2pkh' };
    }
    if (version === 0xc4) {
      return { ok: true, chain, checksum: 'verified', addressType: 'p2sh' };
    }
    if (version === 0x00 || version === 0x05) {
      return failure(
        chain,
        'wrong-network',
        'mainnet address version: devnet destinations only',
      );
    }
  } else {
    if (version === 0x00) {
      return { ok: true, chain, checksum: 'verified', addressType: 'p2pkh' };
    }
    if (version === 0x05) {
      return { ok: true, chain, checksum: 'verified', addressType: 'p2sh' };
    }
    if (version === 0x6f || version === 0xc4) {
      return failure(
        chain,
        'wrong-network',
        'testnet address version: mainnet destinations only',
      );
    }
  }
  return failure(
    chain,
    'unsupported-version',
    `unsupported address version 0x${version.toString(16).padStart(2, '0')}`,
  );
}

function validateEth(address: string): DestinationValidation {
  const chain: DestinationChain = 'eth';
  if (address === '') {
    return failure(chain, 'empty', 'destination address is empty');
  }
  if (!address.startsWith('0x')) {
    return failure(
      chain,
      'invalid-format',
      'Ethereum destinations must start with 0x',
    );
  }
  const body = address.slice(2);
  if (body.length !== 40) {
    return failure(
      chain,
      'invalid-length',
      'Ethereum destinations are 0x followed by 40 hex characters',
    );
  }
  if (!/^[0-9a-fA-F]{40}$/.test(body)) {
    return failure(
      chain,
      'invalid-character',
      'Ethereum destinations contain only hex characters',
    );
  }
  // EIP-55: the address is checksummed iff it equals the case pattern
  // derived from the Keccak-256 hash of its lowercase form. A uniform
  // case that happens to equal the checksummed form IS verified (the
  // EIP-55 test suite includes all-caps and all-lower cases); a uniform
  // case that differs is a valid address with no checksum ('absent').
  const hash = keccak256Ascii(body.toLowerCase());
  const hashHex = Array.from(hash, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  let checksummed = '0x';
  for (let i = 0; i < 40; i++) {
    const character = body.charAt(i).toLowerCase();
    if (/[a-f]/.test(character)) {
      const hashNibble = parseInt(hashHex[i]!, 16);
      checksummed += hashNibble >= 8 ? character.toUpperCase() : character;
    } else {
      checksummed += character;
    }
  }
  if (address === checksummed) {
    return { ok: true, chain, checksum: 'verified', addressType: 'eoa' };
  }
  const isAllLower = body === body.toLowerCase();
  const isAllUpper = body === body.toUpperCase();
  if (isAllLower || isAllUpper) {
    return { ok: true, chain, checksum: 'absent', addressType: 'eoa' };
  }
  return failure(
    chain,
    'invalid-checksum',
    'EIP-55 mixed-case checksum does not match',
  );
}

async function validateTrx(
  address: string,
): Promise<DestinationValidation> {
  const chain: DestinationChain = 'trx';
  if (address === '') {
    return failure(chain, 'empty', 'destination address is empty');
  }
  if (/^(0x)?41[0-9a-fA-F]{40}$/.test(address)) {
    return failure(
      chain,
      'invalid-format',
      'TRON destinations must be base58check T...; hex 41... is the wire form',
    );
  }
  const decoded = await decodeBase58Check(address);
  if (!decoded.ok) {
    return failure(
      chain,
      decoded.reason,
      `invalid base58check address: ${decoded.reason}`,
    );
  }
  const { version } = decoded.decoded;
  if (version === 0x41) {
    return {
      ok: true,
      chain,
      checksum: 'verified',
      addressType: 'base58check',
    };
  }
  if (version === 0xa0) {
    return failure(
      chain,
      'wrong-network',
      'legacy TRON testnet prefix 0xa0: mainnet destinations only',
    );
  }
  return failure(
    chain,
    'unsupported-version',
    `unsupported address version 0x${version.toString(16).padStart(2, '0')}`,
  );
}

function decodeTonFriendly(
  address: string,
): Uint8Array | 'invalid-character' | 'invalid-length' {
  if (!/^[A-Za-z0-9+/=_-]{48}$/.test(address)) {
    return /^[A-Za-z0-9+/=_-]*$/.test(address)
      ? 'invalid-length'
      : 'invalid-character';
  }
  const standard = address.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (bytes.length !== 36) return 'invalid-length';
  return bytes;
}

function validateTon(
  address: string,
  options?: DestinationValidationOptions,
): DestinationValidation {
  const chain: DestinationChain = 'ton';
  const devnet = options?.devnet === true;
  if (address === '') {
    return failure(chain, 'empty', 'destination address is empty');
  }
  const raw = /^(-1|0):([0-9a-fA-F]{64})$/.exec(address);
  if (raw !== null) {
    return { ok: true, chain, checksum: 'not-applicable', addressType: 'raw' };
  }
  if (/^-?\d+:/.test(address)) {
    return failure(
      chain,
      'unsupported-version',
      'raw TON workchain must be 0 or -1 with 64 hex characters',
    );
  }
  const bytes = decodeTonFriendly(address);
  if (typeof bytes === 'string') {
    return failure(
      chain,
      bytes,
      `invalid TON user-friendly address: ${bytes}`,
    );
  }
  const tag = bytes[0]!;
  const isTestnet = (tag & TON_TEST_FLAG) !== 0;
  const baseTag = tag & ~TON_TEST_FLAG;
  if (devnet) {
    // Devnet accepts the testnet flag only; a mainnet tag is a
    // mainnet destination, not a devnet one.
    if (!isTestnet) {
      return failure(
        chain,
        'wrong-network',
        'mainnet TON address: devnet destinations only',
      );
    }
  } else if (isTestnet) {
    return failure(
      chain,
      'wrong-network',
      'testnet-only TON address: mainnet destinations only',
    );
  }
  let addressType: 'bounceable' | 'non-bounceable';
  if (baseTag === TON_BOUNCEABLE_TAG) {
    addressType = 'bounceable';
  } else if (baseTag === TON_NON_BOUNCEABLE_TAG) {
    addressType = 'non-bounceable';
  } else {
    return failure(
      chain,
      'unsupported-version',
      `unsupported TON address tag 0x${tag.toString(16).padStart(2, '0')}`,
    );
  }
  const workchain = bytes[1]!;
  if (workchain !== 0x00 && workchain !== 0xff) {
    return failure(
      chain,
      'unsupported-version',
      `unsupported TON workchain byte 0x${workchain.toString(16).padStart(2, '0')}`,
    );
  }
  const expectedCrc = crc16Xmodem(bytes.subarray(0, 34));
  const actualCrc = (bytes[34]! << 8) | bytes[35]!;
  if (expectedCrc !== actualCrc) {
    return failure(
      chain,
      'invalid-checksum',
      'TON address CRC16 checksum does not match',
    );
  }
  return { ok: true, chain, checksum: 'verified', addressType };
}

/** Devnet threading (temporary devnet mode): pass `{ devnet: true }`
 * to validate a destination on the test network instead of mainnet.
 * BTC accepts tb HRP + base58 0x6f/0xc4 and rejects bc/0x00/0x05;
 * TON accepts the testnet flag and rejects mainnet tags; ETH/TRX are
 * unchanged (Sepolia shares Ethereum addresses, Nile shares 0x41). */
export type DestinationValidationOptions = { devnet?: boolean };

export async function validateDestination(
  chain: DestinationChain,
  address: string,
  options?: DestinationValidationOptions,
): Promise<DestinationValidation> {
  const trimmed = address.trim();
  switch (chain) {
    case 'btc':
      return validateBtc(trimmed, options);
    case 'eth':
      return validateEth(trimmed);
    case 'trx':
      return validateTrx(trimmed);
    case 'ton':
      return validateTon(trimmed, options);
    default:
      throw new Error('unknown chain');
  }
}

export function isSameDestination(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

// ---------------------------------------------------------------------------
// Mainnet parameters
// ---------------------------------------------------------------------------

function freezeParams(params: MainnetParams): MainnetParams {
  Object.freeze(params.sources);
  Object.freeze(params.limitations);
  return Object.freeze(params);
}

export const MAINNET_PARAMS: Readonly<
  Record<DestinationChain, MainnetParams>
> = Object.freeze({
  btc: freezeParams({
    chain: 'btc',
    network: 'mainnet',
    slip44CoinType: 0,
    derivationPrefix: "m/84'/0'/0'/0",
    chainId: null,
    addressPrefix: 'bc',
    confirmations: 6,
    confirmationsUnit: 'blocks',
    confirmationsNote:
      'Confirmation policy is not a finality guarantee; TON threshold user-approved 2026-11-10, register M-13',
    sources: [
      'https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki',
      'https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki',
    ],
    limitations: [
      'An address alone cannot distinguish mainnet from signet/regtest except by HRP/version',
    ],
  }),
  eth: freezeParams({
    chain: 'eth',
    network: 'mainnet',
    slip44CoinType: 60,
    derivationPrefix: "m/44'/60'/0'/0",
    chainId: 1,
    addressPrefix: '0x',
    confirmations: 12,
    confirmationsUnit: 'blocks',
    confirmationsNote:
      'Confirmation policy is not a finality guarantee; TON threshold user-approved 2026-11-10, register M-13',
    sources: [
      'https://eips.ethereum.org/EIPS/eip-55',
      'https://ethereum.publicnode.com (eth_chainId verified live 2026-11-12: 0x1)',
    ],
    limitations: [
      'Address format is identical on every EVM chain; chainId comes from the configured network',
    ],
  }),
  trx: freezeParams({
    chain: 'trx',
    network: 'mainnet',
    slip44CoinType: 195,
    derivationPrefix: "m/44'/195'/0'/0",
    chainId: null,
    addressPrefix: '0x41',
    confirmations: 19,
    confirmationsUnit: 'blocks',
    confirmationsNote:
      'Confirmation policy is not a finality guarantee; TON threshold user-approved 2026-11-10, register M-13',
    sources: [
      'https://developers.tron.network/docs/account',
      'https://developers.tron.network/docs/encoding',
    ],
    limitations: [
      'Address string cannot distinguish mainnet from test networks (shared 0x41 prefix); network comes from the configured endpoint',
    ],
  }),
  ton: freezeParams({
    chain: 'ton',
    network: 'mainnet',
    slip44CoinType: 607,
    derivationPrefix: 'n/a',
    chainId: null,
    addressPrefix: 'EQ/UQ friendly',
    confirmations: 1,
    confirmationsUnit: 'masterchain seqno',
    confirmationsNote:
      'Confirmation policy is not a finality guarantee; TON threshold user-approved 2026-11-10, register M-13',
    sources: [
      'https://docs.ton.org/foundations/addresses/formats',
      'https://docs.ton.org/applications/payments/overview',
    ],
    limitations: [
      'Raw form carries no checksum; prefer the friendly form',
    ],
  }),
});

export function selectMainnetParams(
  chain: DestinationChain,
): MainnetParams {
  const params = MAINNET_PARAMS[chain];
  if (params === undefined) {
    throw new Error('unknown chain');
  }
  return params;
}
