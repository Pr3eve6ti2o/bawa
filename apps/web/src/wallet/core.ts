import { bytesToBase64Url, crc16Xmodem } from '../engine/address-codecs';
import { COIN_TYPE_KEY_FOR_CHAIN, loadCore } from '../engine/boundary';
import type { ChainId } from '../engine/boundary';
import { pathFor } from './chains';
import {
  decodeBtcBech32,
  encodeBtcBech32,
  toTonTestnetUqAddress,
} from './devnet';
import {
  assertPartialSignerDigest,
  hashPartialSignerMessage,
  isPartialSignerChain,
  partialSignerSignatureLength,
  type PartialSigner,
} from './signing-intent';

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
  sol: "m/44'/501'/0'",
  bsc: "m/44'/60'/0'/0/0",
  matic: "m/44'/60'/0'/0/0",
  arb: "m/44'/60'/0'/0/0",
  op: "m/44'/60'/0'/0/0",
  base: "m/44'/60'/0'/0/0",
  avax: "m/44'/60'/0'/0/0",
  gnosis: "m/44'/60'/0'/0/0",
  celo: "m/44'/60'/0'/0/0",
  linea: "m/44'/60'/0'/0/0",
  mantle: "m/44'/60'/0'/0/0",
  scroll: "m/44'/60'/0'/0/0",
  opbnb: "m/44'/60'/0'/0/0",
  metis: "m/44'/60'/0'/0/0",
  aurora: "m/44'/60'/0'/0/0",
  fantom: "m/44'/60'/0'/0/0",
  ltc: "m/84'/2'/0'/0/0",
  doge: "m/44'/3'/0'/0/0",
});

function coinForChain(core: WalletCore, chain: ChainId): WalletCoin {
  if (chain === 'ton') return core.CoinType.ton;
  const key = COIN_TYPE_KEY_FOR_CHAIN[chain];
  if (key === undefined) {
    throw new Error('Unsupported chain.');
  }
  return core.CoinType[key];
}

function assertValidMnemonic(core: WalletCore, mnemonic: string): void {
  if (!core.Mnemonic.isValid(mnemonic)) {
    throw new Error('Invalid mnemonic.');
  }
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

  return bytesToBase64Url(bytes);
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
/**
 * Load Wallet Core, validate the mnemonic and open the HD wallet. The
 * caller owns the wallet and must delete() it. Shared by the two sites
 * that already did these steps with the same null check (restoreWallet,
 * deriveDevnetBtcAddress).
 */
async function openWallet(mnemonic: string, passphrase: string) {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }
  return { core, wallet };
}

export async function restoreWallet(
  mnemonic: string,
  passphrase = '',
): Promise<string> {
  const { wallet } = await openWallet(mnemonic, passphrase);

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
/**
 * All 22 registry chains' addresses from one address function. The
 * deriveAddresses / deriveAddressesAt pair differ only in how a single
 * address is derived, not in the chain map.
 */
function allChainAddresses(
  addressFor: (chain: ChainId) => string,
): WalletAddresses {
  return {
    btc: addressFor('btc'),
    eth: addressFor('eth'),
    trx: addressFor('trx'),
    ton: addressFor('ton'),
    sol: addressFor('sol'),
    bsc: addressFor('bsc'),
    matic: addressFor('matic'),
    arb: addressFor('arb'),
    op: addressFor('op'),
    base: addressFor('base'),
    avax: addressFor('avax'),
    gnosis: addressFor('gnosis'),
    celo: addressFor('celo'),
    linea: addressFor('linea'),
    mantle: addressFor('mantle'),
    scroll: addressFor('scroll'),
    opbnb: addressFor('opbnb'),
    metis: addressFor('metis'),
    aurora: addressFor('aurora'),
    fantom: addressFor('fantom'),
    ltc: addressFor('ltc'),
    doge: addressFor('doge'),
  };
}

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

    return allChainAddresses(addressFor);
  } finally {
    wallet.delete();
  }
}

/**
 * Derive one chain's address at a non-default account/index.
 * Paths come from pathFor(chain, account, index) — except TON, which always
 * uses m/44'/607'/0' and ignores account/index (one address per wallet),
 * and SOL, whose path is likewise fully hardened (one address per wallet).
 * Pubkey form is normalised at the deriveAddressFromPublicKey call site
 * (Phase 3, Lane H): the secp256k1 key is always extracted compressed,
 * then .uncompressed() for ETH/TRX/EVM chains — the 65-byte
 * secp256k1Extended form that Tron/Address.cpp and Ethereum/Address.cpp
 * require (a 33-byte key throws across the WASM boundary uncaught and
 * aborts the instance) — while BTC-family chains use the compressed form
 * as extracted. TON/SOL Ed25519 keys are used as-is. At account 0 index 0
 * the result equals deriveAddresses() exactly.
 */
function deriveOneAddress(
  core: WalletCore,
  wallet: ReturnType<WalletCore['HDWallet']['createWithMnemonic']>,
  chain: ChainId,
  account: number,
  index: number,
): string {
  const coin = coinForChain(core, chain);
  const path =
    chain === 'ton' ? "m/44'/607'/0'" : pathFor(chain, account, index);
  const key = wallet.getKey(coin, path);

  try {
    // Extract compressed (the store/transport form, cf. @scure/bip32:
    // store compressed, decompress at the point of use), then
    // normalise the form AT the deriveAddressFromPublicKey call site.
    // Wallet Core 4.9.3's Tron/Address.cpp and Ethereum/Address.cpp
    // throw unless the key is the 65-byte secp256k1Extended form, and
    // the throw crosses the WASM boundary uncaught and aborts the
    // instance; BTC-family chains throw on the 65-byte form instead.
    // Normalising here — not via the extraction boolean — fixes every
    // caller, including future ones. uncompressed() is bound in the
    // shipped WASM binary (probe 2026-11-20: .data().length === 65).
    // BTC-family keys are already compressed as extracted, so no
    // .compressed() call is made for them (it would return *this and
    // a delete would double-free the shared object).
    const rawPubkey =
      chain === 'ton' || chain === 'sol'
        ? key.getPublicKeyEd25519()
        : key.getPublicKeySecp256k1(true);

    try {
      const isSecp256k1 = chain !== 'ton' && chain !== 'sol';
      const needsExtended =
        isSecp256k1 &&
        chain !== 'btc' &&
        chain !== 'ltc' &&
        chain !== 'doge';
      const pubkey = needsExtended ? rawPubkey.uncompressed() : rawPubkey;

      try {
        return checkedAddress(
          core,
          chain,
          core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey),
        );
      } finally {
        if (pubkey !== rawPubkey) pubkey.delete();
      }
    } finally {
      rawPubkey.delete();
    }
  } finally {
    key.delete();
  }
}

function assertAccountIndex(account: number, index: number): void {
  if (!Number.isSafeInteger(account) || account < 0) {
    throw new RangeError('account must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) {
    throw new RangeError(
      'index must be a non-negative safe integer below 0x80000000',
    );
  }
}

/**
 * Derive addresses at a non-default account/index.
 * Paths come from pathFor(chain, account, index) — except TON, which always
 * uses m/44'/607'/0' and ignores account/index (one address per wallet).
 * At account 0 index 0 the result equals deriveAddresses() exactly.
 */
export async function deriveAddressesAt(
  mnemonic: string,
  passphrase: string,
  account: number,
  index: number,
): Promise<WalletAddresses> {
  assertAccountIndex(account, index);

  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);

  try {
    const addressFor = (chain: ChainId): string =>
      deriveOneAddress(core, wallet, chain, account, index);

    return allChainAddresses(addressFor);
  } finally {
    wallet.delete();
  }
}

/**
 * Lane C, item 8 (HD rotation): derive ONE chain's address at an
 * account/index, without deriving the other twelve. At account 0 index 0
 * it equals deriveAddresses()[chain] exactly.
 */
export async function deriveAddressAt(
  mnemonic: string,
  passphrase: string,
  chain: ChainId,
  account: number,
  index: number,
): Promise<string> {
  assertAccountIndex(account, index);

  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);

  try {
    return deriveOneAddress(core, wallet, chain, account, index);
  } finally {
    wallet.delete();
  }
}

/**
 * TEMPORARY devnet derivation (owner order 2026-11-22). Same wallet,
 * test networks, account 0 index 0 by default:
 * - BTC at m/84'/1'/${account}'/0/${index} (coin type 1), re-encoded
 *   with the tb HRP — Wallet Core always encodes the bitcoin coin as
 *   bc1q, so the same witness program is re-encoded (see wallet/
 *   devnet.ts). CoinTypeExt.validate is bypassed for devnet BTC only:
 *   the bech32 checksum/program is the validation.
 * - ETH / TRX reuse the mainnet derivation (the same address).
 * - TON re-encodes the mainnet UQ address with the testnet flag
 *   (tag 0xD1, CRC recomputed).
 * - The other nine chains stay mainnet-only (derive-only, no adapter).
 * DEFAULT_PATHS and pathFor are untouched: recovery profiles are pinned.
 */
export async function deriveDevnetAddressesAt(
  mnemonic: string,
  passphrase: string,
  account: number,
  index: number,
): Promise<WalletAddresses> {
  assertAccountIndex(account, index);

  const base = await deriveAddressesAt(mnemonic, passphrase, account, index);
  const btc = await deriveDevnetBtcAddress(mnemonic, passphrase, account, index);
  return { ...base, btc, ton: toTonTestnetUqAddress(base.ton) };
}

async function deriveDevnetBtcAddress(
  mnemonic: string,
  passphrase: string,
  account: number,
  index: number,
): Promise<string> {
  const { core, wallet } = await openWallet(mnemonic, passphrase);

  try {
    const coin = core.CoinType.bitcoin;
    const key = wallet.getKey(coin, `m/84'/1'/${account}'/0/${index}`);
    try {
      const rawPubkey = key.getPublicKeySecp256k1(true);
      try {
        const mainnet = core.CoinTypeExt.deriveAddressFromPublicKey(
          coin,
          rawPubkey,
        );
        const decoded = decodeBtcBech32(mainnet);
        if (decoded === null || decoded.hrp !== 'bc') {
          throw new Error('Wallet Core returned an invalid BTC address.');
        }
        return encodeBtcBech32('tb', decoded.witnessVersion, decoded.program);
      } finally {
        rawPubkey.delete();
      }
    } finally {
      key.delete();
    }
  } finally {
    wallet.delete();
  }
}

/**
 * Lane C (bot use case): export the account-level extended public key for
 * one chain, so the owner can take it to their bot and derive many
 * receiving addresses from it (m/<account path>/0/<index>) without the
 * recovery phrase. The key is public data — it reveals addresses,
 * balances and history — but it can never sign, so it is safe to copy
 * out of the vault. The vault must be unlocked; the mnemonic never
 * leaves this function. TON and SOL have no extended public key: their
 * paths are fully hardened Ed25519, so one wallet has exactly one
 * address — export that address instead (see deriveAddresses).
 * The serialisation is per chain: BTC zpub (BIP-84), LTC Ltub (BIP-84),
 * DOGE dpub (BIP-44), every other secp256k1 chain xpub (BIP-44).
 */
export async function getAccountExtendedPublicKey(
  mnemonic: string,
  passphrase: string,
  chain: ChainId,
  account: number,
): Promise<string> {
  if (chain === 'ton') {
    throw new Error(
      'TON uses fully hardened Ed25519 derivation and cannot derive children from an xpub.',
    );
  }
  if (chain === 'sol') {
    throw new Error('SOL uses fully hardened Ed25519 derivation and cannot derive children from an xpub.');
  }
  assertAccountIndex(account, 0);

  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }

  try {
    const coin = coinForChain(core, chain);
    const purpose =
      chain === 'btc' || chain === 'ltc'
        ? core.Purpose.bip84
        : core.Purpose.bip44;
    const derivation =
      chain === 'btc' ? core.Derivation.bitcoinSegwit : core.Derivation.default;
    const version =
      chain === 'btc'
        ? core.HDVersion.zpub
        : chain === 'ltc'
          ? core.HDVersion.ltub
          : chain === 'doge'
            ? core.HDVersion.dpub
            : core.HDVersion.xpub;
    return wallet.getExtendedPublicKeyAccount(
      purpose,
      coin,
      derivation,
      version,
      account,
    );
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
  if (chain === 'sol') {
    throw new Error('SOL uses fully hardened Ed25519 derivation and cannot derive children from an xpub.');
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
