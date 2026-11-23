import type { ChainId, WalletCore } from './boundary';

/**
 * WASM CoinType key per chain (all chains except TON, which has no
 * Wallet Core coin mapping in the engine). Shared by coinTypeForChain
 * in boundary.ts and coinForChain in wallet/core.ts (which adds the
 * TON case). The table holds key NAMES only — the CoinType values
 * themselves stay inside boundary.ts, per the facade contract there;
 * callers resolve `core.CoinType[key]` on their own core handle.
 *
 * Merge 1 (Lane B): the 9 extra chains adopt-proper added via the
 * inline coin map in deriveAddress. Repo-study's deriveAddressWithCore
 * helper only mapped btc/eth/trx, so the mappings move here instead
 * of re-adding the inline map. Values verified against HEAD's map.
 *
 * Lane J (perf): this table lives in its own leaf module — a pure
 * record with no engine dependency — so wallet/core can import the
 * key names without importing boundary.ts, which would pull the
 * 2.9 MB engine chunk into the first-paint modulepreload graph.
 * boundary.ts re-exports it, so existing import paths keep working.
 */
export const COIN_TYPE_KEY_FOR_CHAIN: Record<
  Exclude<ChainId, 'ton'>,
  keyof WalletCore['CoinType']
> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  trx: 'tron',
  sol: 'solana',
  bsc: 'smartChain',
  matic: 'polygon',
  arb: 'arbitrum',
  op: 'optimism',
  base: 'base',
  avax: 'avalancheCChain',
  gnosis: 'xdai',
  celo: 'celo',
  linea: 'linea',
  mantle: 'mantle',
  scroll: 'scroll',
  opbnb: 'opBNB',
  metis: 'metis',
  aurora: 'aurora',
  fantom: 'fantom',
  ltc: 'litecoin',
  doge: 'dogecoin',
};
