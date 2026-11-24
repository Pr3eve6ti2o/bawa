// Engine facade contract: typed validation results, address strings, booleans,
// and the ready-gate cross this boundary. Embind handles, CoinType values, and
// protobuf codecs stay inside this file.
// loadCore remains the transitional raw escape hatch for wallet/core.ts and
// wallet/send.ts until their signer migration moves them onto facade operations.
// No new raw-core consumers.
import { initWasm } from '@trustwallet/wallet-core';
import { getAddress, isAddress } from 'viem';
import type { TonAddressValidation } from '@bawa/contracts';
import {
  isEvmChain,
  watchOnlyValueKind,
  type WatchOnlyValueKind,
} from '../wallet/watch-only-families';

import { crc16Xmodem } from './address-codecs';
import { COIN_TYPE_KEY_FOR_CHAIN } from './coin-type-keys';

export type ChainId = 'btc' | 'eth' | 'trx' | 'ton' | 'sol' | 'bsc' | 'matic' | 'arb' | 'op' | 'base' | 'avax' | 'ltc' | 'doge' | 'gnosis' | 'celo' | 'linea' | 'mantle' | 'scroll' | 'opbnb' | 'metis' | 'aurora' | 'fantom' | 'zksync' | 'cronos' | 'kava' | 'filecoin' | 'zora' | 'mode' | 'fraxtal' | 'berachain' | 'sei' | 'arbnova' | 'worldchain' | 'manta' | 'unichain' | 'ink' | 'abstract' | 'soneium' | 'apechain' | 'sonic' | 'hyperevm' | 'monad' | 'ronin' | 'immutable' | 'fuse' | 'velas' | 'syscoin' | 'theta' | 'iotex' | 'xlayer' | 'boba' | 'taiko' | 'astar' | 'telos' | 'conflux' | 'core' | 'songbird' | 'rootstock' | 'pulsechain' | 'xdc' | 'chiliz' | 'etc' | 'flare' | 'zetachain' | 'hemi' | 'bob' | 'flowevm' | 'cosmos' | 'osmosis' | 'xrp' | 'stellar' | 'polkadot' | 'near' | 'aptos' | 'tezos' | 'algorand' | 'hedera' | 'injective' | 'celestia' | 'dydx' | 'seicosmos' | 'axelar' | 'noble' | 'juno';

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const PRIVATE_VERSIONS = new Set([
  '0488ade4',
  '049d7878',
  '04b2430c',
  '0295b005',
  '02aa7a99',
  '04358394',
  '044a4e28',
  '045f18bc',
]);

// T42: a valid 82-byte extended key needs at most 112 Base58 characters
// (ceil(82 * log(256) / log(58))); the shared Node validator caps here.
const MAX_BASE58_LENGTH = 112;

const ALLOWED_VERSIONS: Readonly<Record<ChainId, readonly string[]>> = {
  // F-17: BIP-49 ypub (049d7cb2) is accepted for BTC, like the shared
  // validator (tools/hdwallet-gen/extended-key.js).
  sol: [], // Like TON, no xpub.
  bsc: ['0488b21e'],
  matic: ['0488b21e'],
  arb: ['0488b21e'],
  op: ['0488b21e'],
  base: ['0488b21e'],
  avax: ['0488b21e'],
  gnosis: ['0488b21e'],
  celo: ['0488b21e'],
  linea: ['0488b21e'],
  mantle: ['0488b21e'],
  scroll: ['0488b21e'],
  opbnb: ['0488b21e'],
  metis: ['0488b21e'],
  aurora: ['0488b21e'],
  fantom: ['0488b21e'],
  // Lane A: LTC accepts both serialisations of the same account key —
  // Ltub (019da462, what this wallet exports) and zpub (04b24746, what
  // Trust Wallet lists as Litecoin's segwit xpub and what other LTC
  // wallets export). The version alone cannot tell a BTC zpub from an
  // LTC zpub; the chain is chosen explicitly at import, exactly as for
  // the 0488b21e xpub shared by BTC/ETH/TRX — so this is the same
  // accepted semantics, not a new ambiguity. A BTC key pasted as LTC
  // derives LTC addresses from it; that is user error with an explicit
  // chain choice, and the derived addresses are still valid LTC
  // addresses of that key.
  ltc: ['019da462', '04b24746'],
  // Lane C: DOGE accepts both serialisations of the same account key —
  // dgub (02facafd, what bip_utils emits) and dpub (02fda926, what Trust
  // Wallet Core's HDVersion.dpub emits and what the wallet itself exports).
  // Both versions are DOGE-only, so accepting both cannot confuse chains.
  // LTC is the shared-version case: zpub (04b24746) is BTC's version too,
  // and the chain chosen at import is the disambiguator (see the ltc entry).
  doge: ['02facafd', '02fda926'],
  btc: ['0488b21e', '049d7cb2', '04b24746'],
  eth: ['0488b21e'],
  trx: ['0488b21e'],
  // TON has no xpub, so no extended-key version is allowed for it.
  // validateExtendedKey is never called for ton (validateWatchOnlyImport
  // routes ton to validateTonAddress); the empty list is a backstop.
  ton: [],
  // Lane 80-APP (2026-11-24): the 55 secp256k1 expanded chains export
  // the standard xpub (0488b21e) and round-trip index 0/1 through it
  // (Wallet Core 4.9.3 probe 4); the 7 Ed25519 chains export a key no
  // derivation can consume, so they allow none — like TON/SOL.
  zksync: ['0488b21e'],
  cronos: ['0488b21e'],
  kava: ['0488b21e'],
  filecoin: ['0488b21e'],
  zora: ['0488b21e'],
  mode: ['0488b21e'],
  fraxtal: ['0488b21e'],
  berachain: ['0488b21e'],
  sei: ['0488b21e'],
  arbnova: ['0488b21e'],
  worldchain: ['0488b21e'],
  manta: ['0488b21e'],
  unichain: ['0488b21e'],
  ink: ['0488b21e'],
  abstract: ['0488b21e'],
  soneium: ['0488b21e'],
  apechain: ['0488b21e'],
  sonic: ['0488b21e'],
  hyperevm: ['0488b21e'],
  monad: ['0488b21e'],
  ronin: ['0488b21e'],
  immutable: ['0488b21e'],
  fuse: ['0488b21e'],
  velas: ['0488b21e'],
  syscoin: ['0488b21e'],
  theta: ['0488b21e'],
  iotex: ['0488b21e'],
  xlayer: ['0488b21e'],
  boba: ['0488b21e'],
  taiko: ['0488b21e'],
  astar: ['0488b21e'],
  telos: ['0488b21e'],
  conflux: ['0488b21e'],
  core: ['0488b21e'],
  songbird: ['0488b21e'],
  rootstock: ['0488b21e'],
  pulsechain: ['0488b21e'],
  xdc: ['0488b21e'],
  chiliz: ['0488b21e'],
  etc: ['0488b21e'],
  flare: ['0488b21e'],
  zetachain: ['0488b21e'],
  hemi: ['0488b21e'],
  bob: ['0488b21e'],
  flowevm: ['0488b21e'],
  cosmos: ['0488b21e'],
  osmosis: ['0488b21e'],
  xrp: ['0488b21e'],
  stellar: [],
  polkadot: [],
  near: [],
  aptos: [],
  tezos: [],
  algorand: [],
  hedera: [],
  injective: ['0488b21e'],
  celestia: ['0488b21e'],
  dydx: ['0488b21e'],
  seicosmos: ['0488b21e'],
  axelar: ['0488b21e'],
  noble: ['0488b21e'],
  juno: ['0488b21e'],
};

const DERIVATION_PREFIXES: Readonly<Record<Exclude<ChainId, 'ton' | 'sol'>, string>> = {
  ltc: "m/84'/2'/0'/0",
  doge: "m/44'/3'/0'/0",
  bsc: "m/44'/60'/0'/0",
  matic: "m/44'/60'/0'/0",
  arb: "m/44'/60'/0'/0",
  op: "m/44'/60'/0'/0",
  base: "m/44'/60'/0'/0",
  avax: "m/44'/60'/0'/0",
  gnosis: "m/44'/60'/0'/0",
  celo: "m/44'/60'/0'/0",
  linea: "m/44'/60'/0'/0",
  mantle: "m/44'/60'/0'/0",
  scroll: "m/44'/60'/0'/0",
  opbnb: "m/44'/60'/0'/0",
  metis: "m/44'/60'/0'/0",
  aurora: "m/44'/60'/0'/0",
  fantom: "m/44'/60'/0'/0",
  btc: "m/84'/0'/0'/0",
  eth: "m/44'/60'/0'/0",
  trx: "m/44'/195'/0'/0",
  // Lane 80-APP: the account-level prefix (derivation path minus the
  // index segment). The 7 Ed25519 prefixes are unreachable — those
  // chains allow no xpub version — but the Record type requires them.
  zksync: "m/44'/60'/0'/0",
  cronos: "m/44'/60'/0'/0",
  kava: "m/44'/60'/0'/0",
  filecoin: "m/44'/461'/0'/0",
  zora: "m/44'/60'/0'/0",
  mode: "m/44'/60'/0'/0",
  fraxtal: "m/44'/60'/0'/0",
  berachain: "m/44'/60'/0'/0",
  sei: "m/44'/60'/0'/0",
  arbnova: "m/44'/60'/0'/0",
  worldchain: "m/44'/60'/0'/0",
  manta: "m/44'/60'/0'/0",
  unichain: "m/44'/60'/0'/0",
  ink: "m/44'/60'/0'/0",
  abstract: "m/44'/60'/0'/0",
  soneium: "m/44'/60'/0'/0",
  apechain: "m/44'/60'/0'/0",
  sonic: "m/44'/60'/0'/0",
  hyperevm: "m/44'/60'/0'/0",
  monad: "m/44'/60'/0'/0",
  ronin: "m/44'/60'/0'/0",
  immutable: "m/44'/60'/0'/0",
  fuse: "m/44'/60'/0'/0",
  velas: "m/44'/60'/0'/0",
  syscoin: "m/44'/60'/0'/0",
  theta: "m/44'/500'/0'/0",
  iotex: "m/44'/304'/0'/0",
  xlayer: "m/44'/60'/0'/0",
  boba: "m/44'/60'/0'/0",
  taiko: "m/44'/60'/0'/0",
  astar: "m/44'/60'/0'/0",
  telos: "m/44'/60'/0'/0",
  conflux: "m/44'/60'/0'/0",
  core: "m/44'/60'/0'/0",
  songbird: "m/44'/60'/0'/0",
  rootstock: "m/44'/137'/0'/0",
  pulsechain: "m/44'/60'/0'/0",
  xdc: "m/44'/60'/0'/0",
  chiliz: "m/44'/60'/0'/0",
  etc: "m/44'/61'/0'/0",
  flare: "m/44'/60'/0'/0",
  zetachain: "m/44'/60'/0'/0",
  hemi: "m/44'/60'/0'/0",
  bob: "m/44'/60'/0'/0",
  flowevm: "m/44'/60'/0'/0",
  cosmos: "m/44'/118'/0'/0",
  osmosis: "m/44'/118'/0'/0",
  xrp: "m/44'/144'/0'/0",
  stellar: "m/44'/148'/0'",
  polkadot: "m/44'/354'/0'/0'",
  near: "m/44'/397'/0'",
  aptos: "m/44'/637'/0'/0'",
  tezos: "m/44'/1729'/0'",
  algorand: "m/44'/283'/0'/0'",
  hedera: "m/44'/3030'/0'/0'",
  injective: "m/44'/60'/0'/0",
  celestia: "m/44'/118'/0'/0",
  dydx: "m/44'/118'/0'/0",
  seicosmos: "m/44'/118'/0'/0",
  axelar: "m/44'/118'/0'/0",
  noble: "m/44'/118'/0'/0",
  juno: "m/44'/118'/0'/0",
};

export type WalletCore = Awaited<ReturnType<typeof initWasm>>;

let wasmPromise: Promise<WalletCore> | undefined;
let engineReady = false;

export function loadCore(): Promise<WalletCore> {
  if (wasmPromise === undefined) {
    // F-40: In-flight loadCore() calls share one init attempt, and failures are surfaced without retrying within a call.
    // Rejected promises are evicted so a subsequent call starts a fresh attempt; success stays cached for the page lifetime.
    const promise = (async () => {
      // No options: the wallet-core 4.9.3 Emscripten build rejects both
      // locateFile and wasmBinary (not in INCOMING_MODULE_JS_API). It
      // resolves wallet-core.wasm relative to the page URL in the
      // browser, so the file is served from public/ (see
      // scripts/copy-wasm.mjs); in Node it reads its own directory.
      const core = await initWasm();
      engineReady = true;
      return core;
    })();
    promise.catch(() => {
      if (wasmPromise === promise) wasmPromise = undefined;
    });
    wasmPromise = promise;
  }

  return wasmPromise;
}

const SECP256K1_P = (1n << 256n) - (1n << 32n) - 977n;

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

// Compressed public key: prefix 0x02/0x03, x < p, and x^3 + 7 a quadratic
// residue mod p (y^2 = x^3 + 7 has a solution). T42: y^2 == 0 is NOT
// accepted as a special case any more — the Legendre symbol must be exactly
// 1, matching the shared Node validator. The case is unreachable anyway:
// -7 is not a cubic residue mod p, so no x has x^3 + 7 == 0 mod p.
function isValidCompressedPoint(keyBytes: Uint8Array): boolean {
  const prefix = keyBytes[0];
  if (prefix !== 0x02 && prefix !== 0x03) return false;
  let x = 0n;
  for (let i = 1; i < 33; i++) x = (x << 8n) | BigInt(keyBytes[i]!);
  if (x >= SECP256K1_P) return false;
  const ySquared = ((x * x) % SECP256K1_P * x + 7n) % SECP256K1_P;
  return modPow(ySquared, (SECP256K1_P - 1n) / 2n, SECP256K1_P) === 1n;
}

type DecodedExtendedKeyValidation =
  | { ok: true; bytes: Uint8Array }
  | Extract<import('@bawa/contracts').ExtendedKeyValidation, { ok: false }>;

async function decodeAndValidateExtendedKey(
  xpub: string,
  chain: ChainId,
): Promise<DecodedExtendedKeyValidation> {
  const key = xpub.trim();

  // T42: bound the input before decoding, like the shared Node validator.
  // Without this, a huge pasted string is scanned character by character
  // on the browser main thread (the loop keeps scanning after overflow to
  // preserve alphabet-error precedence).
  if (key.length > MAX_BASE58_LENGTH) {
    return {
      ok: false,
      reason: 'invalid-length',
      message: 'invalid extended key length',
    };
  }

  // Fixed-width, big-endian accumulator; leading '1's represent zero bytes.
  const bytes = new Uint8Array(82);
  let leadingZeroes = 0;
  while (
    leadingZeroes < key.length &&
    key.charAt(leadingZeroes) === '1'
  ) {
    leadingZeroes++;
  }

  let overflow = false;
  for (let i = leadingZeroes; i < key.length; i++) {
    const digit = BASE58_ALPHABET.indexOf(key.charAt(i));
    if (digit === -1) {
      return {
        ok: false,
        reason: 'invalid-base58',
        message: 'invalid base58 character in extended key',
      };
    }

    // Check all remaining characters even after overflow, preserving precedence.
    if (overflow) continue;

    let carry = digit;
    for (let j = bytes.length - 1; j >= 0; j--) {
      const value = bytes[j]! * 58 + carry;
      bytes[j] = value & 0xff;
      carry = value >>> 8;
    }
    overflow = carry !== 0;
  }

  let firstNonZero = 0;
  while (firstNonZero < bytes.length && bytes[firstNonZero] === 0) {
    firstNonZero++;
  }

  const decodedLength = leadingZeroes + bytes.length - firstNonZero;
  if (overflow || decodedLength !== 82) {
    return {
      ok: false,
      reason: 'invalid-length',
      message: 'invalid extended key length',
    };
  }

  const firstHash = await globalThis.crypto.subtle.digest(
    'SHA-256',
    bytes.slice(0, 78),
  );
  const checksum = new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', firstHash),
  );

  let checksumDifference = 0;
  for (let i = 0; i < 4; i++) {
    checksumDifference |= bytes[78 + i]! ^ checksum[i]!;
  }
  if (checksumDifference !== 0) {
    return {
      ok: false,
      reason: 'invalid-checksum',
      message: 'invalid extended key checksum',
    };
  }

  const versionHex = Array.from(bytes.subarray(0, 4), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  if (bytes[45] === 0x00 || PRIVATE_VERSIONS.has(versionHex)) {
    return {
      ok: false,
      reason: 'private-key',
      message:
        'extended public key required (private extended keys are rejected)',
    };
  }
  // secp256k1 point validation (R-01): a checksum-correct key whose 33-byte
  // public key is not a valid compressed curve point must be rejected, or
  // derivation would return a valid-looking address nobody can spend from.
  if (!isValidCompressedPoint(bytes.subarray(45, 78))) {
    return {
      ok: false,
      reason: 'invalid-point',
      message: 'extended key contains an invalid secp256k1 public key point',
    };
  }

  // T40-F1: depth-0 extended keys must have zero fingerprint and child
  // number (matches tools/hdwallet-gen/extended-key.js check 5c).
  if (bytes[4] === 0 && bytes.subarray(5, 13).some((b) => b !== 0)) {
    return {
      ok: false,
      reason: 'invalid-depth-metadata',
      message: 'depth-0 extended key must have zero fingerprint and child number',
    };
  }

  // BTC/ETH/TRX xpubs share version 0488b21e, so cross-chain xpub misuse
  // between those three is undetectable from serialisation alone.
  if (!ALLOWED_VERSIONS[chain]?.includes(versionHex)) {
    return {
      ok: false,
      reason: 'version-not-allowed',
      message: `extended key version ${versionHex} is not allowed for ${chain}`,
    };
  }

  return { ok: true, bytes };
}

export async function validateExtendedKey(
  xpub: string,
  chain: ChainId,
): Promise<import('@bawa/contracts').ExtendedKeyValidation> {
  const validation = await decodeAndValidateExtendedKey(xpub, chain);
  if (validation.ok === false) return validation;
  return { ok: true };
}

export async function validateAccountKey(
  xpub: string,
  chain: ChainId,
): Promise<import('@bawa/contracts').ExtendedKeyValidation> {
  const validation = await decodeAndValidateExtendedKey(xpub, chain);
  if (validation.ok === false) return validation;

  const { bytes } = validation;
  const childNumber = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(9, false);
  if (bytes[4] !== 3 || childNumber !== 0x80000000) {
    return {
      ok: false,
      reason: 'not-account-key',
      message: 'extended key must be an account-level key (depth 3, account 0)',
    };
  }

  return { ok: true };
}

// TON friendly addresses contain complete, unpadded base64 quartets.
// Decodes standard base64 (after normalising base64url '-'/'_' to
// '+/'), so the same address is accepted in either spelling, like
// destination.ts. No atob, no Buffer: runs in browser and Node alike.
function decodeTonBase64(value: string): Uint8Array | null {
  if (value.length % 4 !== 0) {
    return null;
  }
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array((value.length / 4) * 3);
  let offset = 0;
  for (let i = 0; i < value.length; i += 4) {
    const a = alphabet.indexOf(value.charAt(i));
    const b = alphabet.indexOf(value.charAt(i + 1));
    const c = alphabet.indexOf(value.charAt(i + 2));
    const d = alphabet.indexOf(value.charAt(i + 3));
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      return null;
    }
    bytes[offset] = (a << 2) | (b >>> 4);
    bytes[offset + 1] = ((b & 0x0f) << 4) | (c >>> 2);
    bytes[offset + 2] = ((c & 0x03) << 6) | d;
    offset += 3;
  }
  return bytes;
}

// TON watch-only import validation (R01, Sol-authored, hands-on
// verified against the P1 vectors). Pure and synchronous: no WASM, no
// private-key material. TON has no xpub and exactly one address per
// wallet, so this validates a public address, not an extended key.
// Semantics mirror destination.ts validateTon: tag 0x11 bounceable /
// 0x51 non-bounceable (0x80 testnet flag rejected on mainnet), workchain
// 0x00/0xff, CRC16-XMODEM over the first 34 bytes; raw "0:"/"-1:" + 64
// hex has no checksum by design. Inputs containing whitespace or a
// private-key prefix are secret-like and rejected without echoing the
// input. TEMPORARY devnet mode: pass `{ devnet: true }` to require the
// testnet flag instead (mainnet tags are rejected); the watch-only call
// sites stay mainnet-only and pass no option.
export function validateTonAddress(
  address: string,
  options?: { devnet?: boolean },
): TonAddressValidation {
  const devnet = options?.devnet === true;
  const value = address.trim();

  if (value.length === 0) {
    return { ok: false, reason: 'empty', message: 'Enter a TON address.' };
  }

  if (/\s/.test(value) || /^(?:xprv|zprv|tprv|yprv)/i.test(value)) {
    return {
      ok: false,
      reason: 'secret-like',
      message: 'Use a public TON address only.',
    };
  }

  const rawMatch = /^(0|-1):[0-9a-fA-F]{64}$/.exec(value);
  if (rawMatch !== null) {
    const workchain: 0 | -1 = rawMatch[1] === '0' ? 0 : -1;
    return { ok: true, form: 'raw', workchain };
  }

  // Bare public-key hex is not an address, regardless of its length.
  if (/^-?\d+:/.test(value) || /^[0-9a-fA-F]{64}$/.test(value)) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Invalid TON address format.',
    };
  }

  if (value.length !== 48) {
    return {
      ok: false,
      reason: 'invalid-length',
      message: 'Invalid TON address length.',
    };
  }

  if (!/^[A-Za-z0-9+/=_-]{48}$/.test(value)) {
    return {
      ok: false,
      reason: 'invalid-character',
      message: 'Invalid TON address characters.',
    };
  }

  const bytes = decodeTonBase64(value.replace(/-/g, '+').replace(/_/g, '/'));
  if (bytes === null) {
    return {
      ok: false,
      reason: 'invalid-character',
      message: 'Invalid TON address characters.',
    };
  }
  if (bytes.length !== 36) {
    return {
      ok: false,
      reason: 'invalid-length',
      message: 'Invalid TON address length.',
    };
  }

  const tag = bytes[0]!;
  const baseTag = tag & 0x7f;
  if (baseTag !== 0x11 && baseTag !== 0x51) {
    return {
      ok: false,
      reason: 'unsupported-version',
      message: 'Unsupported TON address tag.',
    };
  }
  if (devnet) {
    if ((tag & 0x80) === 0) {
      return {
        ok: false,
        reason: 'wrong-network',
        message: 'Mainnet TON addresses are not supported in devnet mode.',
      };
    }
  } else if ((tag & 0x80) !== 0) {
    return {
      ok: false,
      reason: 'wrong-network',
      message: 'Testnet TON addresses are not supported.',
    };
  }

  const workchainByte = bytes[1]!;
  if (workchainByte !== 0x00 && workchainByte !== 0xff) {
    return {
      ok: false,
      reason: 'unsupported-version',
      message: 'Unsupported TON workchain.',
    };
  }

  const storedCrc = (bytes[34]! << 8) | bytes[35]!;
  if (crc16Xmodem(bytes.subarray(0, 34)) !== storedCrc) {
    return {
      ok: false,
      reason: 'invalid-checksum',
      message: 'Invalid TON address checksum.',
    };
  }

  const workchain: 0 | -1 = workchainByte === 0x00 ? 0 : -1;
  return {
    ok: true,
    form: baseTag === 0x11 ? 'bounceable' : 'non-bounceable',
    workchain,
  };
}

export function validateSolanaAddress(
  address: string
): { ok: true } | { ok: false; reason: string; message: string } {
  const value = address.trim();

  if (value.length === 0) {
    return {
      ok: false,
      reason: 'empty',
      message: 'Solana address is required.',
    };
  }

  const words = value.split(/ +/);
  const isMnemonic =
    /^[a-z ]+$/i.test(value) && (words.length === 12 || words.length === 24);

  if (/\s/.test(value) || /^(?:xprv|zprv|tprv|yprv)/i.test(value) || isMnemonic) {
    return {
      ok: false,
      reason: 'secret-like',
      message: 'Use a public Solana address only.',
    };
  }

  function decodeBase58(input: string): Uint8Array | null {
    const bytes: number[] = [];

    for (const character of input) {
      const digit = BASE58_ALPHABET.indexOf(character);
      if (digit < 0) return null;

      let carry = digit;

      for (let i = 0; i < bytes.length; i++) {
        carry += (bytes[i] ?? 0) * 58;
        bytes[i] = carry & 0xff;
        carry >>>= 8;
      }

      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>>= 8;
      }
    }

    for (const character of input) {
      if (character !== '1') break;
      bytes.push(0);
    }

    return Uint8Array.from(bytes.reverse());
  }

  const decoded = decodeBase58(value);

  if (decoded?.length === 64) {
    return {
      ok: false,
      reason: 'secret-like',
      message: 'Use a public Solana address only.',
    };
  }

  if (decoded === null || decoded.length !== 32) {
    return {
      ok: false,
      reason: 'invalid-length',
      message: 'Invalid Solana address length.',
    };
  }

  return { ok: true };
}

// Watch-only import validation for any chain: TON and SOL validate a
// public address; every other chain validates an extended public key —
// and the key must be the account-level key (depth 3, account 0;
// R02-F01), so a depth-0/1/2 key cannot be imported and silently derive
// addresses from the wrong level. validateAccountKey returns the exact
// not-account-key message for that case.
//
// Lane B (Finish the Product, 2026-11-23): a plain public address is
// accepted too. The returned `kind` tells the caller which it is, so an
// address can fan out to every chain in its family (one EVM address is
// the same address on all fifty-nine EVM chains) while an xpub keeps the
// one-chain behaviour.
export type WatchOnlyImportValidation =
  | { ok: true; kind: WatchOnlyValueKind }
  | { ok: false; reason: string; message: string };

// Checksum validation for a plain watch-only address. EVM uses viem's
// isAddress (EIP-55 checksum for mixed-case input; the same check the
// EVM adapter uses). TRX/BTC/LTC/DOGE use Wallet Core's per-coin
// validate (base58check / bech32 checksum and prefix for that coin).
async function validateWatchOnlyAddress(
  chain: Exclude<ChainId, 'sol' | 'ton'>,
  value: string,
): Promise<{ ok: true } | { ok: false; reason: string; message: string }> {
  if (isEvmChain(chain)) {
    return isAddress(value)
      ? { ok: true }
      : {
          ok: false,
          reason: 'invalid-address',
          message: 'Invalid Ethereum address.',
        };
  }
  const core = await loadCore();
  const coin = coinTypeForChain(core, chain);
  return core.CoinTypeExt.validate(coin, value)
    ? { ok: true }
    : {
        ok: false,
        reason: 'invalid-address',
        message: `Invalid ${chain.toUpperCase()} address.`,
      };
}

export async function validateWatchOnlyImport(
  chain: ChainId,
  value: string,
): Promise<WatchOnlyImportValidation> {
  if (chain === 'sol' || chain === 'ton') {
    const validation = (chain === 'sol' ? validateSolanaAddress : validateTonAddress)(value);
    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.reason,
        message: validation.message,
      };
    }
    return { ok: true, kind: 'address' };
  }
  const trimmed = value.trim();
  if (watchOnlyValueKind(chain, trimmed) === 'address') {
    const validation = await validateWatchOnlyAddress(chain, trimmed);
    if (!validation.ok) return validation;
    return { ok: true, kind: 'address' };
  }
  const keyValidation = await validateAccountKey(trimmed, chain);
  if (!keyValidation.ok) return keyValidation;
  return { ok: true, kind: 'xpub' };
}

// The coin-type key table lives in ./coin-type-keys (Lane J, perf):
// a leaf module with no engine dependency. Re-exported here so the
// existing import path keeps working.
export { COIN_TYPE_KEY_FOR_CHAIN };

function coinTypeForChain(core: WalletCore, chain: Exclude<ChainId, 'ton'>) {
  const key = COIN_TYPE_KEY_FOR_CHAIN[chain];
  if (key === undefined) {
    throw new Error('unsupported chain for WASM coin mapping: ' + chain);
  }
  return core.CoinType[key];
}

function deriveAddressWithCore(
  core: WalletCore,
  chain: Exclude<ChainId, 'ton'>,
  key: string,
  path: string,
): { address: string; valid: boolean } {
  const coin = coinTypeForChain(core, chain);
  const pubkey = core.HDWallet.getPublicKeyFromExtended(key, coin, path);

  if (pubkey === null || pubkey === undefined) {
    throw new Error('engine returned no public key');
  }

  try {
    const address = core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
    if (!address) {
      throw new Error('engine returned an empty address');
    }

    const valid = core.CoinTypeExt.validate(coin, address);
    return { address, valid };
  } finally {
    pubkey.delete();
  }
}

export async function deriveAddress(
  chain: ChainId,
  xpub: string,
  index: number,
): Promise<string> {
  if (!Number.isInteger(index) || index < 0 || index > 2147483647) {
    throw new Error('index out of range');
  }

  // TON and SOL have no xpub (fully hardened paths), so a watch-only
  // import is one public address, usable at index 0 only — siblings
  // cannot be derived from it. No WASM call.
  if (chain === 'sol' || chain === 'ton') {
    if (index !== 0) {
      throw new Error('index out of range');
    }
    const addressValidation = (chain === 'sol' ? validateSolanaAddress : validateTonAddress)(xpub);
    if (!addressValidation.ok) {
      throw new Error(addressValidation.message);
    }
    return xpub.trim();
  }

  const key = xpub.trim();

  // Lane B: a watch-only entry holding a plain address (not an xpub) is
  // that address itself, at index 0 only — like SOL/TON. The value was
  // checksum-validated at import; it is re-validated here so a hand-edited
  // stored value cannot yield an unchecked address.
  if (watchOnlyValueKind(chain, key) === 'address') {
    if (index !== 0) {
      throw new Error('index out of range');
    }
    if (isEvmChain(chain)) {
      if (!isAddress(key)) {
        throw new Error('Invalid Ethereum address.');
      }
      return getAddress(key);
    }
    const addressCore = await loadCore();
    const addressCoin = coinTypeForChain(addressCore, chain);
    if (!addressCore.CoinTypeExt.validate(addressCoin, key)) {
      throw new Error(`Invalid ${chain.toUpperCase()} address.`);
    }
    return key;
  }

  const validation = await validateAccountKey(key, chain);
  if (validation.ok === false) {
    throw new Error(validation.message);
  }

  let address: string;
  let valid: boolean;

  try {
    const core = await loadCore();
    const path = `${DERIVATION_PREFIXES[chain]}/${index}`;
    ({ address, valid } = deriveAddressWithCore(core, chain, key, path));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error('derivation failed: ' + message);
  }

  // A negative validation result is distinct from a thrown WASM failure.
  if (!valid) {
    throw new Error('derived address failed validation');
  }

  return address;
}

export async function deriveAddresses(
  chain: ChainId,
  xpub: string,
  count: number,
): Promise<string[]> {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('count out of range');
  }

  // TON, SOL and plain-address entries each have one address; callers
  // must use derivedCount 1. The count is still range-checked above so
  // a bad count fails the same way.
  if (
    chain === 'sol' ||
    chain === 'ton' ||
    watchOnlyValueKind(chain, xpub) === 'address'
  ) {
    return [await deriveAddress(chain, xpub, 0)];
  }

  const addresses: string[] = [];
  for (let index = 0; index < count; index++) {
    addresses.push(await deriveAddress(chain, xpub, index));
  }
  return addresses;
}

export function engineIsReady(): boolean {
  return engineReady;
}

export async function engineWaitReady(): Promise<boolean> {
  try {
    await loadCore();
    return true;
  } catch {
    return false;
  }
}

// Compatibility alias retained because an existing test file imports isEngineReady.
export function isEngineReady(): boolean {
  return engineIsReady();
}
