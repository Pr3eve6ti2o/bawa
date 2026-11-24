// Watch-only address families (Finish the Product, Lane B, 2026-11-23).
//
// Owner order 2026-11-23: when an EVM, SOL, TRX or BTC address is added
// watch-only, the wallet must detect balances from ALL the chains that
// address belongs to. One EVM address (0x...) is the same address on
// every EVM chain, so importing it watches all fifty-nine (Lane 80-APP:
// 16 + 43 new 0x chains); SOL, TRX, BTC, LTC, DOGE and TON addresses
// each belong to one chain, so their family is that chain alone.
//
// A BTC address cannot fan out to LTC or DOGE: the three UTXO chains use
// different address formats (and different derivation paths), so the same
// seed derives a different address on each. The family is about the
// ADDRESS, not the seed. Ronin does not join the 0x family: its address
// is ronin:…, so one stored value cannot serve it and a bare-0x chain.
//
// This module is pure shape detection only: it routes a stored value to
// "address" or "xpub" without checking any checksum. Checksum validation
// happens once, at import, in engine/boundary.ts (validateWatchOnlyImport);
// every value that reaches deriveAddress has already passed it. An xpub
// can never match an address shape below: xpubs start with xpub/ypub/
// zpub/Ltub/dpub/dgub and are ~111 chars, while every address shape is
// length-bounded (TRX 34, DOGE 34, BTC/LTC legacy 26-35, bech32 <= 62,
// EVM exactly 42).
import type { ChainId } from '../engine/boundary';

/** The fifty-nine 0x EVM chains: one 0x address is the same address on all of them. Filecoin is not here — its wallet address is f1…, not 0x. Ronin is not here either — its wallet address is ronin:…, so the same value string cannot be stored for it and for a bare-0x chain (wallet-context stores one value per family chain); see EVM_TX_CHAINS. */
export const EVM_WATCH_CHAINS: readonly ChainId[] = [
  'eth',
  'bsc',
  'matic',
  'arb',
  'op',
  'base',
  'avax',
  'gnosis',
  'celo',
  'linea',
  'mantle',
  'scroll',
  'opbnb',
  'metis',
  'aurora',
  'fantom',
  'zksync',
  'cronos',
  'kava',
  'zora',
  'mode',
  'fraxtal',
  'berachain',
  'sei',
  'arbnova',
  'worldchain',
  'manta',
  'unichain',
  'ink',
  'abstract',
  'soneium',
  'apechain',
  'sonic',
  'hyperevm',
  'monad',
  'immutable',
  'fuse',
  'velas',
  'syscoin',
  'theta',
  'iotex',
  'xlayer',
  'boba',
  'taiko',
  'astar',
  'telos',
  'conflux',
  'core',
  'songbird',
  'rootstock',
  'pulsechain',
  'xdc',
  'chiliz',
  'etc',
  'flare',
  'zetachain',
  'hemi',
  'bob',
  'flowevm',
] as const;

/**
 * All sixty chains whose transactions are EVM transactions — the
 * generalised EVM adapter and signer serve them. Ronin is here but not
 * in EVM_WATCH_CHAINS: its transactions are EVM (chain id 2020, 0x
 * addresses on the wire) while its wallet address carries the ronin:
 * prefix, so the adapter normalises the prefix before RPC calls
 * (adapters/evm.ts) and the watch-only family stays 0x-only.
 */
export const EVM_TX_CHAINS: readonly ChainId[] = [
  ...EVM_WATCH_CHAINS,
  'ronin',
] as const;

const EVM_CHAIN_SET: ReadonlySet<ChainId> = new Set(EVM_WATCH_CHAINS);
const EVM_TX_CHAIN_SET: ReadonlySet<ChainId> = new Set(EVM_TX_CHAINS);

/** Whether this chain is one of the fifty-nine 0x EVM chains (its wallet address is a bare 0x address). */
export function isEvmChain(chain: ChainId): boolean {
  return EVM_CHAIN_SET.has(chain);
}

/** Whether this chain's transactions are EVM transactions (the generalised EVM adapter + signer serve it) — the 59 0x chains plus Ronin. */
export function isEvmTxChain(chain: ChainId): boolean {
  return EVM_TX_CHAIN_SET.has(chain);
}

/**
 * Every chain a watch-only import of `chain` fans out to. An EVM chain
 * fans out to all fifty-nine 0x EVM chains; every other chain fans out
 * to itself only.
 */
export function watchOnlyFamilyChains(chain: ChainId): readonly ChainId[] {
  return isEvmChain(chain) ? EVM_WATCH_CHAINS : [chain];
}

export type WatchOnlyValueKind = 'address' | 'xpub';

// Shape only — no checksum. See the module header: validation happens in
// engine/boundary.ts; this routes values that already passed it.
const EVM_ADDRESS_SHAPE = /^0x[0-9a-fA-F]{40}$/;
const TRON_ADDRESS_SHAPE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const BTC_ADDRESS_SHAPE =
  /^(?:[13][1-9A-HJ-NP-Za-km-z]{25,34}|bc1[02-9ac-hj-np-z]{11,71})$/;
const LTC_ADDRESS_SHAPE =
  /^(?:[LM][1-9A-HJ-NP-Za-km-z]{25,34}|ltc1[02-9ac-hj-np-z]{11,71})$/;
const DOGE_ADDRESS_SHAPE = /^D[1-9A-HJ-NP-Za-km-z]{33}$/;

/**
 * Whether a stored watch-only value is a plain public address (one
 * address, index 0 only) or an extended public key (derivable addresses).
 * TON and SOL have no xpub form: their stored value is always an address.
 */
export function watchOnlyValueKind(
  chain: ChainId,
  value: string,
): WatchOnlyValueKind {
  const trimmed = value.trim();
  if (chain === 'sol' || chain === 'ton') return 'address';
  if (isEvmChain(chain)) {
    return EVM_ADDRESS_SHAPE.test(trimmed) ? 'address' : 'xpub';
  }
  switch (chain) {
    case 'trx':
      return TRON_ADDRESS_SHAPE.test(trimmed) ? 'address' : 'xpub';
    case 'btc':
      return BTC_ADDRESS_SHAPE.test(trimmed) ? 'address' : 'xpub';
    case 'ltc':
      return LTC_ADDRESS_SHAPE.test(trimmed) ? 'address' : 'xpub';
    case 'doge':
      return DOGE_ADDRESS_SHAPE.test(trimmed) ? 'address' : 'xpub';
    default:
      // Lane 80-APP: the expanded non-EVM chains (Cosmos-family,
      // Filecoin, XRP, Injective, and the seven Ed25519 chains) have
      // no per-chain shape here — an extended-key-shaped value routes
      // to 'xpub', anything else to 'address'. Checksum validation
      // still happens once, at import, in engine/boundary.ts.
      return looksLikeExtendedKey(trimmed) ? 'xpub' : 'address';
  }
}

// Extended public keys start with a known version prefix (xpub/ypub/
// zpub/Ltub/dpub/dgub) and are ~111 chars; every address shape is
// shorter and starts differently. See the module header.
function looksLikeExtendedKey(value: string): boolean {
  return /^(?:xpub|ypub|zpub|Ltub|dpub|dgub)[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(value);
}

/** True when the stored watch-only value is a plain public address. */
export function isWatchOnlyAddressValue(
  chain: ChainId,
  value: string,
): boolean {
  return watchOnlyValueKind(chain, value) === 'address';
}
