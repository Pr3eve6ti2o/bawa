import { hashMessage, hexToBytes, sha256, stringToHex } from 'viem';
import { loadCore } from '../engine/boundary';
import type { ChainId } from '../engine/boundary';
import { pathFor } from './chains';

export type { ChainId };

type WalletCore = Awaited<ReturnType<typeof loadCore>>;
export type WalletAddresses = Record<ChainId, string>;
export type WalletCoin = Parameters<
  WalletCore['HDWallet']['getPublicKeyFromExtended']
>[1];

// These are getAddressForCoin's default derivation paths in Wallet Core 4.9.3.
const DEFAULT_PATHS: Readonly<Record<ChainId, string>> = Object.freeze({
  btc: "m/84'/0'/0'/0/0",
  eth: "m/44'/60'/0'/0/0",
  trx: "m/44'/195'/0'/0/0",
  ton: "m/44'/607'/0'",
});

function coinForChain(core: WalletCore, chain: ChainId): WalletCoin {
  switch (chain) {
    case 'btc':
      return core.CoinType.bitcoin;
    case 'eth':
      return core.CoinType.ethereum;
    case 'trx':
      return core.CoinType.tron;
    case 'ton':
      return core.CoinType.ton;
    default:
      throw new Error('Unsupported chain.');
  }
}

function assertValidMnemonic(core: WalletCore, mnemonic: string): void {
  if (!core.Mnemonic.isValid(mnemonic)) {
    throw new Error('Invalid mnemonic.');
  }
}

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;

  for (const byte of bytes) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

/**
 * Preserve the V4R2 contract hash supplied by Wallet Core and emit a mainnet,
 * workchain-zero, URL-safe UQ address.
 *
 * TON terminology: UQ uses the non-bounceable tag; EQ is bounceable. This file
 * follows the explicitly requested UQ prefix.
 */
function toTonUqAddress(address: string): string {
  let decoded: string;

  try {
    decoded = globalThis.atob(
      address.replace(/-/g, '+').replace(/_/g, '/'),
    );
  } catch {
    throw new Error('Invalid TON user-friendly address encoding.');
  }

  if (decoded.length !== 36) {
    throw new Error('Invalid TON user-friendly address length.');
  }

  const bytes = Uint8Array.from(decoded, (character) =>
    character.charCodeAt(0),
  );

  // Reject testnet addresses and any workchain other than zero.
  if (
    bytes[1] !== 0 ||
    (bytes[0] !== 0x11 && bytes[0] !== 0x51)
  ) {
    throw new Error('Expected a mainnet workchain-zero TON address.');
  }

  bytes[0] = 0x51;

  const checksum = crc16Xmodem(bytes.subarray(0, 34));
  bytes[34] = checksum >>> 8;
  bytes[35] = checksum & 0xff;

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

function checkedAddress(
  core: WalletCore,
  chain: ChainId,
  address: string,
): string {
  const coin = coinForChain(core, chain);

  if (!core.CoinTypeExt.validate(coin, address)) {
    throw new Error(`Wallet Core returned an invalid ${chain} address.`);
  }

  if (chain !== 'ton') {
    return address;
  }

  const normalized = toTonUqAddress(address);

  if (
    !normalized.startsWith('UQ') ||
    !core.CoinTypeExt.validate(coin, normalized)
  ) {
    throw new Error('Invalid workchain-zero TON UQ address.');
  }

  return normalized;
}

/** Generate a 24-word mnemonic from 256 bits of secure entropy. */
export async function createWallet(passphrase = ''): Promise<string> {
  const cryptoProvider = globalThis.crypto;

  if (
    !cryptoProvider ||
    typeof cryptoProvider.getRandomValues !== 'function'
  ) {
    throw new Error('Secure random number generation is unavailable.');
  }

  const core = await loadCore();
  const entropy = new Uint8Array(32);

  try {
    cryptoProvider.getRandomValues(entropy);

    const wallet = core.HDWallet.createWithEntropy(entropy, passphrase);
    if (!wallet) {
      throw new Error('Unable to create wallet.');
    }

    try {
      return wallet.mnemonic();
    } finally {
      wallet.delete();
    }
  } finally {
    entropy.fill(0);
  }
}

/** Validate and restore a mnemonic without retaining a WASM wallet object. */
export async function restoreWallet(
  mnemonic: string,
  passphrase = '',
): Promise<string> {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }

  try {
    return wallet.mnemonic();
  } finally {
    wallet.delete();
  }
}

/**
 * Derive account-zero, index-zero addresses using DEFAULT_PATHS.
 * Wallet Core 4.9.3's TON default is a workchain-zero V4R2 wallet, using the
 * single fully hardened path m/44'/607'/0', with no change/index suffix.
 */
export async function deriveAddresses(
  mnemonic: string,
  passphrase = '',
): Promise<WalletAddresses> {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }

  try {
    const addressFor = (chain: ChainId): string =>
      checkedAddress(
        core,
        chain,
        wallet.getAddressForCoin(coinForChain(core, chain)),
      );

    return {
      btc: addressFor('btc'),
      eth: addressFor('eth'),
      trx: addressFor('trx'),
      ton: addressFor('ton'),
    };
  } finally {
    wallet.delete();
  }
}

/**
 * Derive addresses at a non-default account/index.
 * Paths come from pathFor(chain, account, index) — except TON, which always
 * uses m/44'/607'/0' and ignores account/index (one address per wallet).
 * Per-chain pubkey form, proven first-hand on Wallet Core 4.9.3: BTC
 * getPublicKeySecp256k1(true) (33-byte compressed), ETH and TRX
 * getPublicKeySecp256k1(false) (65-byte uncompressed), TON
 * getPublicKeyEd25519(); then CoinTypeExt.deriveAddressFromPublicKey.
 * At account 0 index 0 the result equals deriveAddresses() exactly.
 */
export async function deriveAddressesAt(
  mnemonic: string,
  passphrase: string,
  account: number,
  index: number,
): Promise<WalletAddresses> {
  if (!Number.isSafeInteger(account) || account < 0) {
    throw new RangeError('account must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) {
    throw new RangeError(
      'index must be a non-negative safe integer below 0x80000000',
    );
  }

  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);

  try {
    const addressFor = (chain: ChainId): string => {
      const coin = coinForChain(core, chain);
      const path =
        chain === 'ton' ? "m/44'/607'/0'" : pathFor(chain, account, index);
      const key = wallet.getKey(coin, path);

      try {
        const pubkey =
          chain === 'ton'
            ? key.getPublicKeyEd25519()
            : key.getPublicKeySecp256k1(chain === 'btc');

        try {
          return checkedAddress(
            core,
            chain,
            core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey),
          );
        } finally {
          pubkey.delete();
        }
      } finally {
        key.delete();
      }
    };

    return {
      btc: addressFor('btc'),
      eth: addressFor('eth'),
      trx: addressFor('trx'),
      ton: addressFor('ton'),
    };
  } finally {
    wallet.delete();
  }
}

/** Derive an external-chain address from an account-level extended public key. */
export async function deriveFromXpub(
  chain: ChainId,
  xpub: string,
  index: number,
): Promise<string> {
  if (chain === 'ton') {
    throw new Error(
      'TON uses fully hardened Ed25519 derivation and cannot derive children from an xpub.',
    );
  }

  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= 0x80000000
  ) {
    throw new Error('Address index must be an unhardened 31-bit integer.');
  }

  if (xpub.trim().length === 0) {
    throw new Error('An extended public key is required.');
  }

  const core = await loadCore();
  const coin = coinForChain(core, chain);
  const path = DEFAULT_PATHS[chain].replace(/\/0$/u, `/${index}`);

  const publicKey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, path);
  if (!publicKey) {
    throw new Error('Unable to derive an extended public key.');
  }

  try {
    // Per-chain pubkey form, verified first-hand on Wallet Core 4.9.3
    // (probe 2026-11-18): getPublicKeyFromExtended already returns the form
    // each chain's derivation needs — BTC 33-byte compressed (keyType 0),
    // ETH and TRX 65-byte uncompressed (keyType 1). Do NOT normalize here:
    // forcing .uncompressed() aborts BTC derivation, and forcing a
    // compressed key aborts TRX derivation. The TRX 33-byte abort only bites
    // on pubkeys obtained from a private key (getPublicKeySecp256k1(true));
    // that path is covered by the raw-WASM test, not by this function.
    const address = core.CoinTypeExt.deriveAddressFromPublicKey(coin, publicKey);

    return checkedAddress(core, chain, address);
  } finally {
    publicKey.delete();
  }
}

/** Sign-only capability; credentials and raw keys are never exposed. */
export interface PartialSigner {
  readonly chain: ChainId;
  readonly address: string;

  /** Exactly 32 bytes; returns raw 65-byte secp256k1 or 64-byte ed25519 signatures. */
  signDigest(digest: Uint8Array): Promise<Uint8Array>;

  /** ETH uses EIP-191; other chains use SHA-256 before signing. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

/** Watch-only data, not a signing capability. */
export type AddressOnlyAccount = {
  readonly kind: 'address-only';
  readonly chain: ChainId;
  readonly address: string;
};

export type LocalAccount = {
  readonly kind: 'local';
  readonly chain: ChainId;
  readonly address: string;
  readonly signer: PartialSigner;
};

export type SigningIntent =
  | {
      readonly kind: 'transaction';
      readonly chain: ChainId;
      readonly to: string;
      readonly amountBaseUnits: string;
      /** ETH nonce, TON seqno, TRX block number; empty string for BTC. */
      readonly sequence: string;
    }
  | {
      readonly kind: 'message';
      readonly chain: ChainId;
      readonly messageHash: string;
    };

/** Build a secret-free transaction intent; preserve the exact strings for approval. */
export function createTransactionIntent(
  chain: ChainId,
  to: string,
  amountBaseUnits: string,
  sequence: string,
): SigningIntent {
  if (typeof to !== 'string' || to.trim().length === 0) {
    throw new Error('Invalid signing intent field "to": expected a non-empty string.');
  }

  if (
    typeof amountBaseUnits !== 'string' ||
    !/^[0-9]+$/.test(amountBaseUnits)
  ) {
    throw new Error(
      'Invalid signing intent field "amountBaseUnits": expected an unsigned decimal string.',
    );
  }

  if (
    typeof sequence !== 'string' ||
    (sequence !== '' && !/^[0-9]+$/.test(sequence))
  ) {
    throw new Error(
      'Invalid signing intent field "sequence": expected an unsigned decimal string or an empty string.',
    );
  }

  return Object.freeze({
    kind: 'transaction' as const,
    chain,
    to,
    amountBaseUnits,
    sequence,
  });
}

/** Build a secret-free message intent from a supplied hash; this does not sign. */
export function createMessageIntent(
  chain: ChainId,
  messageHash: string,
): SigningIntent {
  if (
    typeof messageHash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(messageHash)
  ) {
    throw new Error(
      'Invalid signing intent field "messageHash": expected 0x followed by exactly 64 hexadecimal characters.',
    );
  }

  return Object.freeze({
    kind: 'message' as const,
    chain,
    messageHash,
  });
}

/** Encode exact UTF-16 code units as length-prefixed ASCII, avoiding field ambiguity. */
function encodeSigningIntentField(value: string): string {
  let hex = '';
  for (let index = 0; index < value.length; index += 1) {
    hex += value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return `${hex.length}:${hex}`;
}

/** Fingerprint fixed-order public fields for approval; hashing is not signing. */
export function intentFingerprint(intent: SigningIntent): string {
  const fields: readonly string[] =
    intent.kind === 'transaction'
      ? [
          intent.kind,
          String(intent.chain),
          intent.to,
          intent.amountBaseUnits,
          intent.sequence,
        ]
      : [intent.kind, String(intent.chain), intent.messageHash];

  const canonical =
    'bawa:signing-intent:v1|' +
    fields.map(encodeSigningIntentField).join('');

  return sha256(stringToHex(canonical));
}

/** Call before PartialSigner signing; sign only when the approved intent matches. */
export function assertIntentMatchesTransaction(
  intent: SigningIntent,
  tx: {
    readonly chain: ChainId;
    readonly to: string;
    readonly amountBaseUnits: string;
    readonly sequence: string;
  },
): void {
  if (intent.kind !== 'transaction') {
    throw new Error('Signing intent mismatch: kind (expected "transaction").');
  }

  const fields = ['chain', 'to', 'amountBaseUnits', 'sequence'] as const;
  for (const field of fields) {
    if (intent[field] !== tx[field]) {
      throw new Error(`Signing intent mismatch: ${field}.`);
    }
  }
}

function isPartialSignerChain(value: unknown): value is ChainId {
  return value === 'btc' || value === 'eth' || value === 'trx' || value === 'ton';
}

function assertPartialSignerDigest(digest: Uint8Array): void {
  if (!(digest instanceof Uint8Array) || digest.byteLength !== 32) {
    throw new Error('signDigest requires exactly 32 bytes');
  }
}

function partialSignerSignatureLength(chain: ChainId): 64 | 65 {
  return chain === 'ton' ? 64 : 65;
}

function hashPartialSignerMessage(
  chain: ChainId,
  message: Uint8Array,
): Uint8Array {
  if (!(message instanceof Uint8Array)) {
    throw new Error('signMessage requires a Uint8Array');
  }

  const bytes = Uint8Array.from(message);
  return hexToBytes(
    chain === 'eth' ? hashMessage({ raw: bytes }) : sha256(bytes),
  );
}

/**
 * Build a sign-only facade over a mnemonic-derived key. The address is
 * derived with the same checked derivation as deriveAddresses (including
 * the TON UQ normalisation); signing opens the wallet and signs with the
 * key object, so raw key bytes never leave this file.
 */
export async function createPartialSigner(
  mnemonic: string,
  passphrase: string,
  chain: ChainId,
  path?: string,
): Promise<PartialSigner> {
  if (!isPartialSignerChain(chain)) {
    throw new Error('Unsupported signer chain');
  }

  const derivationPath = path ?? DEFAULT_PATHS[chain];
  if (derivationPath.length === 0) {
    throw new Error('Derivation path must not be empty');
  }

  const core = await loadCore();
  const coin = coinForChain(core, chain);
  const signatureLength = partialSignerSignatureLength(chain);

  // A custom path uses the same pubkey route as deriveAddressesAt; the
  // default path reuses deriveAddresses exactly.
  let address: string;
  if (path === undefined) {
    address = (await deriveAddresses(mnemonic, passphrase))[chain];
  } else {
    assertValidMnemonic(core, mnemonic);
    const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
    if (!wallet) {
      throw new Error('Unable to restore wallet.');
    }
    try {
      const key = wallet.getKey(coin, derivationPath);
      try {
        const pubkey =
          chain === 'ton'
            ? key.getPublicKeyEd25519()
            : key.getPublicKeySecp256k1(chain === 'btc');
        try {
          address = checkedAddress(
            core,
            chain,
            core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey),
          );
        } finally {
          pubkey.delete();
        }
      } finally {
        key.delete();
      }
    } finally {
      wallet.delete();
    }
  }

  async function signDigest(digest: Uint8Array): Promise<Uint8Array> {
    assertPartialSignerDigest(digest);
    // Snapshot caller-owned input before asynchronous key access.
    const digestCopy = Uint8Array.from(digest);
    const signingCore = await loadCore();
    assertValidMnemonic(signingCore, mnemonic);
    const signingCoin = coinForChain(signingCore, chain);
    const curve =
      chain === 'ton'
        ? signingCore.Curve.ed25519
        : signingCore.Curve.secp256k1;
    const wallet = signingCore.HDWallet.createWithMnemonic(
      mnemonic,
      passphrase,
    );
    if (!wallet) {
      throw new Error('Unable to restore wallet.');
    }
    try {
      const key = wallet.getKey(signingCoin, derivationPath);
      try {
        const signature = key.sign(digestCopy, curve);
        if (signature.byteLength !== signatureLength) {
          throw new Error('Unexpected Wallet Core signature length');
        }

        // Preserve raw recovery 0/1; copy before disposing the WASM key.
        return Uint8Array.from(signature);
      } finally {
        key.delete();
      }
    } finally {
      wallet.delete();
    }
  }

  async function signMessage(message: Uint8Array): Promise<Uint8Array> {
    return signDigest(hashPartialSignerMessage(chain, message));
  }

  return Object.freeze({ chain, address, signDigest, signMessage });
}

export function isPartialSigner(value: unknown): value is PartialSigner {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  // Accounts are wrappers/data: signing requires the capability itself.
  if (candidate.kind === 'address-only' || candidate.kind === 'local') {
    return false;
  }

  return (
    isPartialSignerChain(candidate.chain) &&
    typeof candidate.address === 'string' &&
    typeof candidate.signDigest === 'function' &&
    typeof candidate.signMessage === 'function'
  );
}

function partialSignerBadKind(value: unknown): string {
  if (value === null) return 'null';

  if (typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.kind === 'string') {
      return candidate.kind || '(empty kind)';
    }
    if (Array.isArray(value)) return 'array';
  }

  // Do not include arbitrary input values or credentials in errors.
  return typeof value;
}

export function assertPartialSigner(
  value: unknown,
): asserts value is PartialSigner {
  if (!isPartialSigner(value)) {
    throw new Error(
      `Expected PartialSigner; bad kind: ${partialSignerBadKind(value)}`,
    );
  }
}

/** Test-only: fresh, deterministic all-zero signatures; signs nothing real. */
export function createNoopSigner(
  chain: ChainId,
  address: string,
): PartialSigner {
  if (!isPartialSignerChain(chain)) {
    throw new Error('Unsupported signer chain');
  }
  if (typeof address !== 'string') {
    throw new Error('Signer address must be a string');
  }

  async function signDigest(digest: Uint8Array): Promise<Uint8Array> {
    assertPartialSignerDigest(digest);
    return new Uint8Array(partialSignerSignatureLength(chain));
  }

  async function signMessage(message: Uint8Array): Promise<Uint8Array> {
    return signDigest(hashPartialSignerMessage(chain, message));
  }

  return Object.freeze({ chain, address, signDigest, signMessage });
}

/**
 * @internal Vault-only raw-key primitive; new code must prefer createPartialSigner.
 * Borrowed bytes are wiped after fn settles; fn must not retain or export them.
 */
export async function withSigningKey<T>(
  mnemonic: string,
  passphrase: string,
  coin: WalletCoin,
  path: string,
  fn: (privateKeyBytes: Uint8Array) => T | PromiseLike<T>,
): Promise<T> {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }

  try {
    const privateKey = wallet.getKey(coin, path);
    if (!privateKey) {
      throw new Error('Unable to derive a signing key.');
    }

    try {
      // Use the returned bytes directly, avoiding an additional secret copy.
      const bytes = privateKey.data();

      try {
        if (bytes.length === 0) {
          throw new Error('Wallet Core returned an empty signing key.');
        }

        return await fn(bytes);
      } finally {
        bytes.fill(0);
      }
    } finally {
      privateKey.delete();
    }
  } finally {
    wallet.delete();
  }
}
