// Watch-only address families (Finish the Product, Lane B, 2026-11-23).
//
// Owner order 2026-11-23: when an EVM, SOL, TRX or BTC address is added
// watch-only, the wallet must detect balances from ALL the chains that
// address belongs to. One EVM address (0x...) is the same address on
// every EVM chain, so importing it watches all sixteen; SOL, TRX, BTC,
// LTC, DOGE and TON addresses each belong to one chain, so their family
// is that chain alone.
//
// A BTC address cannot fan out to LTC or DOGE: the three UTXO chains use
// different address formats (and different derivation paths), so the same
// seed derives a different address on each. The family is about the
// ADDRESS, not the seed.
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

/** The sixteen EVM chains: one 0x address is the same address on all of them. */
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
] as const;

const EVM_CHAIN_SET: ReadonlySet<ChainId> = new Set(EVM_WATCH_CHAINS);

/** Whether this chain is one of the sixteen EVM chains. */
export function isEvmChain(chain: ChainId): boolean {
  return EVM_CHAIN_SET.has(chain);
}

/**
 * Every chain a watch-only import of `chain` fans out to. An EVM chain
 * fans out to all sixteen EVM chains; every other chain fans out to
 * itself only.
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
      return 'xpub';
  }
}

/** True when the stored watch-only value is a plain public address. */
export function isWatchOnlyAddressValue(
  chain: ChainId,
  value: string,
): boolean {
  return watchOnlyValueKind(chain, value) === 'address';
}
