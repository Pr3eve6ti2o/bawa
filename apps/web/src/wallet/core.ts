import { bytesToBase64Url, crc16Xmodem } from '../engine/address-codecs';
import { COIN_TYPE_KEY_FOR_CHAIN } from '../engine/coin-type-keys';
import type { ChainId } from '../engine/boundary';
import { pathFor, SUPPORTED_CHAINS } from './chains';
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

type WalletCore = Awaited<
  ReturnType<typeof import('../engine/boundary').loadCore>
>;

// Lane J (perf): loadCore is dynamic-imported, not statically
// imported — wallet/core is in the eager graph (create-wallet route,
// wallet context), and a static import pulled the 2.9 MB engine chunk
// into the first-paint modulepreload graph. loadCore's internal promise
// cache still shares ONE download across the warm-up, the create-screen
// preload and every caller here.
async function loadCore(): Promise<WalletCore> {
  const { loadCore: load } = await import('../engine/boundary');
  return load();
}
export type WalletAddresses = Record<ChainId, string>;
type WalletCoin = Parameters<
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
  zksync: "m/44'/60'/0'/0/0",
  cronos: "m/44'/60'/0'/0/0",
  kava: "m/44'/60'/0'/0/0",
  filecoin: "m/44'/461'/0'/0/0",
  zora: "m/44'/60'/0'/0/0",
  mode: "m/44'/60'/0'/0/0",
  fraxtal: "m/44'/60'/0'/0/0",
  berachain: "m/44'/60'/0'/0/0",
  sei: "m/44'/60'/0'/0/0",
  arbnova: "m/44'/60'/0'/0/0",
  worldchain: "m/44'/60'/0'/0/0",
  manta: "m/44'/60'/0'/0/0",
  unichain: "m/44'/60'/0'/0/0",
  ink: "m/44'/60'/0'/0/0",
  abstract: "m/44'/60'/0'/0/0",
  soneium: "m/44'/60'/0'/0/0",
  apechain: "m/44'/60'/0'/0/0",
  sonic: "m/44'/60'/0'/0/0",
  hyperevm: "m/44'/60'/0'/0/0",
  monad: "m/44'/60'/0'/0/0",
  ronin: "m/44'/60'/0'/0/0",
  immutable: "m/44'/60'/0'/0/0",
  fuse: "m/44'/60'/0'/0/0",
  velas: "m/44'/60'/0'/0/0",
  syscoin: "m/44'/60'/0'/0/0",
  theta: "m/44'/500'/0'/0/0",
  iotex: "m/44'/304'/0'/0/0",
  xlayer: "m/44'/60'/0'/0/0",
  boba: "m/44'/60'/0'/0/0",
  taiko: "m/44'/60'/0'/0/0",
  astar: "m/44'/60'/0'/0/0",
  telos: "m/44'/60'/0'/0/0",
  conflux: "m/44'/60'/0'/0/0",
  core: "m/44'/60'/0'/0/0",
  songbird: "m/44'/60'/0'/0/0",
  rootstock: "m/44'/137'/0'/0/0",
  pulsechain: "m/44'/60'/0'/0/0",
  xdc: "m/44'/60'/0'/0/0",
  chiliz: "m/44'/60'/0'/0/0",
  etc: "m/44'/61'/0'/0/0",
  flare: "m/44'/60'/0'/0/0",
  zetachain: "m/44'/60'/0'/0/0",
  hemi: "m/44'/60'/0'/0/0",
  bob: "m/44'/60'/0'/0/0",
  flowevm: "m/44'/60'/0'/0/0",
  cosmos: "m/44'/118'/0'/0/0",
  osmosis: "m/44'/118'/0'/0/0",
  xrp: "m/44'/144'/0'/0/0",
  stellar: "m/44'/148'/0'",
  polkadot: "m/44'/354'/0'/0'/0'",
  near: "m/44'/397'/0'",
  aptos: "m/44'/637'/0'/0'/0'",
  tezos: "m/44'/1729'/0'/0'",
  algorand: "m/44'/283'/0'/0'/0'",
  hedera: "m/44'/3030'/0'/0'/0",
  injective: "m/44'/60'/0'/0/0",
  celestia: "m/44'/118'/0'/0/0",
  dydx: "m/44'/118'/0'/0/0",
  seicosmos: "m/44'/118'/0'/0/0",
  axelar: "m/44'/118'/0'/0/0",
  noble: "m/44'/118'/0'/0/0",
  juno: "m/44'/118'/0'/0/0",
  cardano: "m/1852'/1815'/0'/0/0",
  kaspa: "m/44'/111111'/0'/0/0",
  starknet: "m/44'/9004'/0'/0/0",
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
 * fully hardened path m/44'/607'/0', with no change/index suffix. Lane A
 * derives further SOL/TON addresses on distinct hardened paths;
 * account 0 index 0 is unchanged.
 */
/**
 * All registry chains' addresses from one address function (Lane
 * 80-APP: iterates SUPPORTED_CHAINS — 87 after the Lane B addition —
 * instead of a hardcoded 22-chain literal, so a new chain can never
 * be registered without being derived). The deriveAddresses /
 * deriveAddressesAt pair differ only in how a single address is
 * derived, not in the chain map.
 */
async function allChainAddresses(
  addressFor: (chain: ChainId) => Promise<string>,
): Promise<WalletAddresses> {
  const out = {} as WalletAddresses;
  for (const chain of SUPPORTED_CHAINS) {
    out[chain] = await addressFor(chain);
  }
  return out;
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
    // Lane B: derivation goes through deriveOneAddress for every chain
    // (single path) — Cardano via Wallet Core, Kaspa/Starknet via the
    // lazy in-app modules. At account 0 index 0 this equals the old
    // getAddressForCoin path exactly (pinned by the wiring test).
    return await allChainAddresses((chain) =>
      deriveOneAddress(core, wallet, chain, 0, 0),
    );
  } finally {
    wallet.delete();
  }
}

/**
 * Derive one chain's address at a non-default account/index.
 * Paths come from pathFor(chain, account, index). SOL and TON use the
 * Lane A Ed25519 scheme (see chains.ts ed25519PathFor): account 0
 * index 0 keeps the legacy path, new accounts and rotations derive
 * additional addresses on distinct hardened paths.
 * Pubkey form is normalised at the deriveAddressFromPublicKey call site
 * (Phase 3, Lane H): the secp256k1 key is always extracted compressed,
 * then .uncompressed() for ETH/TRX/EVM chains — the 65-byte
 * secp256k1Extended form that Tron/Address.cpp and Ethereum/Address.cpp
 * require (a 33-byte key throws across the WASM boundary uncaught and
 * aborts the instance) — while BTC-family chains use the compressed form
 * as extracted. Ed25519 keys (ED25519_CHAINS: TON, SOL and the eight
 * expanded Ed25519 chains) are used as-is. Lane 80-APP
 * (probe 3, 2026-11-24): the eight Cosmos-family chains plus XRP and
 * Injective are the exception — their addresses only agree with
 * getAddressForCoin when the COMPRESSED key is passed, so they stay
 * compressed (COMPRESSED_PUBKEY_CHAINS below). Filecoin is the
 * opposite: only the uncompressed form agrees. At account 0 index 0
 * the result equals deriveAddresses() exactly.
 */
// Lane 80-APP (probe 3 + probe-form, 2026-11-24): these secp256k1 chains
// derive the getAddressForCoin address only from the COMPRESSED pubkey;
// passing the 65-byte uncompressed form yields a different
// (valid-looking) address. Every other secp256k1 chain agrees with
// either form (EVM 0x chains), needs the uncompressed form (ETH/TRX/
// Filecoin), or — Injective — is an ETH-style bech32 address (keccak of
// the uncompressed pubkey), so it stays uncompressed too. XRP agrees
// with either form and stays here for symmetry with the Cosmos set.
const COMPRESSED_PUBKEY_CHAINS: ReadonlySet<ChainId> = new Set([
  'cosmos',
  'osmosis',
  'celestia',
  'dydx',
  'seicosmos',
  'axelar',
  'noble',
  'juno',
  'xrp',
]);

// Lane 80-APP (2026-11-24): the seven expanded Ed25519 chains join TON
// and SOL — their keys are Ed25519, never secp256k1. Calling
// getPublicKeySecp256k1 on one throws across the WASM boundary uncaught
// and aborts the instance (exception catching is disabled in the WASM
// build), poisoning every later core call in the same test file. Every
// Ed25519-gated site in this file must use this set, not a ton/sol
// special case. Lane B (2026-11-25) adds Cardano (CIP-1852 Ed25519):
// its pubkey must come from getPublicKeyEd25519Cardano — the plain
// Ed25519 getter aborts the WASM instance for Cardano (probe 2026-11-25).
const ED25519_CHAINS: ReadonlySet<ChainId> = new Set([
  'ton',
  'sol',
  'stellar',
  'polkadot',
  'near',
  'aptos',
  'tezos',
  'algorand',
  'hedera',
  'cardano',
]);
async function deriveOneAddress(
  core: WalletCore,
  wallet: ReturnType<WalletCore['HDWallet']['createWithMnemonic']>,
  chain: ChainId,
  account: number,
  index: number,
): Promise<string> {
  if (chain === 'kaspa') {
    // Lane B: Kaspa has no Wallet Core coin — the secp256k1 key at the
    // 111111 path (ethereum coin as curve carrier) is CashAddr-encoded
    // in-app. Lazy import keeps the encoder out of the first paint.
    const { isValidKaspaAddress, kaspaAddressFromCompressedPubkey } =
      await import('./kaspa-address');
    const path = pathFor(chain, account, index);
    const key = wallet.getKey(core.CoinType.ethereum, path);
    try {
      const pubkey = key.getPublicKeySecp256k1(true);
      try {
        const bytes = pubkey.data();
        try {
          const address = kaspaAddressFromCompressedPubkey(bytes);
          if (!isValidKaspaAddress(address)) {
            throw new Error('Wallet returned an invalid Kaspa address.');
          }
          return address;
        } finally {
          bytes.fill(0);
        }
      } finally {
        pubkey.delete();
      }
    } finally {
      key.delete();
    }
  }
  if (chain === 'starknet') {
    // Lane B: Starknet has no Wallet Core coin — the ETH key at
    // m/44'/60'/{account}'/0/0 seeds the 9004 double-derivation, then
    // grindKey + the Argent proxy address (see starknet-derive.ts).
    const { isValidStarknetAddress, starknetAddressFromEthKey } =
      await import('./starknet-derive');
    const ethKey = wallet.getKey(
      core.CoinType.ethereum,
      pathFor('eth', account, 0),
    );
    try {
      const bytes = ethKey.data();
      try {
        const address = starknetAddressFromEthKey(bytes, account, index);
        if (!isValidStarknetAddress(address)) {
          throw new Error('Wallet returned an invalid Starknet address.');
        }
        return address;
      } finally {
        bytes.fill(0);
      }
    } finally {
      ethKey.delete();
    }
  }
  const coin = coinForChain(core, chain);
  const path = pathFor(chain, account, index);
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
    // Lane B: Cardano's pubkey must come from getPublicKeyEd25519Cardano
    // — the plain Ed25519 getter aborts the WASM instance for Cardano
    // (probe 2026-11-25). The other Ed25519 chains use the plain getter.
    const rawPubkey =
      chain === 'cardano'
        ? key.getPublicKeyEd25519Cardano()
        : ED25519_CHAINS.has(chain)
          ? key.getPublicKeyEd25519()
          : key.getPublicKeySecp256k1(true);

    try {
      const isSecp256k1 = !ED25519_CHAINS.has(chain);
      const needsExtended =
        isSecp256k1 &&
        chain !== 'btc' &&
        chain !== 'ltc' &&
        chain !== 'doge' &&
        !COMPRESSED_PUBKEY_CHAINS.has(chain);
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
 * Paths come from pathFor(chain, account, index) — SOL and TON included
 * (Lane A Ed25519 scheme: legacy address at account 0 index 0, distinct
 * addresses for new accounts and rotations).
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
    return await allChainAddresses((chain) =>
      deriveOneAddress(core, wallet, chain, account, index),
    );
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
    return await deriveOneAddress(core, wallet, chain, account, index);
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
 * paths are fully hardened Ed25519, so no non-hardened children can be
 * derived from a public key — export the address itself instead (one
 * per account/index; see deriveAddressesAt).
 * The serialisation is per chain: BTC zpub (BIP-84), LTC Ltub (BIP-84),
 * DOGE dpub (BIP-44), every other secp256k1 chain xpub (BIP-44).
 */
// Lane 80-APP (probe 4, 2026-11-24): the seven expanded Ed25519 chains
// have no extended public key — Wallet Core exports a key for them, but
// getPublicKeyFromExtended aborts the WASM instance on it. Like TON and
// SOL, they throw here instead of issuing or consuming one. Lane B
// (2026-11-25) adds Cardano (the eighth Ed25519 chain).
const ED25519_NO_XPUB_CHAINS: ReadonlySet<ChainId> = new Set([
  'stellar',
  'polkadot',
  'near',
  'aptos',
  'tezos',
  'algorand',
  'hedera',
  'cardano',
]);

// Lane B (2026-11-25): Kaspa and Starknet have no extended public key
// either, for different reasons — Kaspa has no Wallet Core coin to
// export one with, and Starknet keys are ground from a private key, so
// no address can be derived from a public key. They throw with their
// own honest message, not the Ed25519 one.
const NO_XPUB_CHAINS: Readonly<Record<'kaspa' | 'starknet', string>> = {
  kaspa:
    'KASPA has no Wallet Core coin, so no extended public key can be exported for it.',
  starknet:
    'STARKNET addresses are derived from a private key (grindKey) and cannot be derived from an extended public key.',
};
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
  if (ED25519_NO_XPUB_CHAINS.has(chain)) {
    throw new Error(
      `${chain.toUpperCase()} uses fully hardened Ed25519 derivation and cannot derive children from an xpub.`,
    );
  }
  if (chain === 'kaspa' || chain === 'starknet') {
    // Lane B: no extended public key for a different reason each —
    // see NO_XPUB_CHAINS above.
    throw new Error(NO_XPUB_CHAINS[chain]);
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
  if (ED25519_NO_XPUB_CHAINS.has(chain)) {
    throw new Error(
      `${chain.toUpperCase()} uses fully hardened Ed25519 derivation and cannot derive children from an xpub.`,
    );
  }
  if (chain === 'kaspa' || chain === 'starknet') {
    // Lane B: no extended public key for a different reason each —
    // see NO_XPUB_CHAINS above.
    throw new Error(NO_XPUB_CHAINS[chain]);
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
        const pubkey = ED25519_CHAINS.has(chain)
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
    const curve = ED25519_CHAINS.has(chain)
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
