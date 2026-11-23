// Remote ticker/name search (token gaps, item 2).
//
// Resolves a ticker or name through CoinGecko's keyless public API:
// /search for candidate coins, then /coins/{id} for each hit's
// contract addresses per platform (detail_platforms, which carries
// decimal_place). Only platforms this wallet supports are kept
// (EVM chains + TRON + Solana — the chains tokenStandardFor offers); a
// platform without known decimals is skipped rather than invented.
// A query that resolves to nothing returns not-found honestly.
//
// The local half — matching against the in-repo registry — is
// resolveTokenByTickerOrName in tokens.ts. The Add Token dialog tries
// the local registry first, then this remote search.
import type { ChainId } from './chains';

export interface TokenSearchCandidate {
  chain: ChainId;
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
  coingeckoId: string;
}

export type TokenSearchResult =
  | { status: 'found'; candidates: TokenSearchCandidate[] }
  | { status: 'not-found' }
  | { status: 'error'; reason: string };

/** CoinGecko platform id -> wallet chain (inverse of the Add Token flow's map). */
const CHAIN_FOR_PLATFORM: Partial<Record<string, ChainId>> = {
  ethereum: 'eth',
  tron: 'trx',
  'binance-smart-chain': 'bsc',
  'polygon-pos': 'matic',
  'arbitrum-one': 'arb',
  'optimistic-ethereum': 'op',
  base: 'base',
  avalanche: 'avax',
  // UI/UX fixes, item 13: SPL on Solana + ERC-20 on the 9 new EVM chains.
  solana: 'sol',
  xdai: 'gnosis',
  celo: 'celo',
  linea: 'linea',
  mantle: 'mantle',
  scroll: 'scroll',
  opbnb: 'opbnb',
  metis: 'metis',
  aurora: 'aurora',
  fantom: 'fantom',
};

/** At most this many search hits get a detail fetch (bounds the calls). */
const MAX_DETAIL_FETCHES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function searchTokensByNameOrTicker(
  query: string,
  fetchFn: typeof fetch,
): Promise<TokenSearchResult> {
  const needle = query.trim();
  if (needle === '') return { status: 'not-found' };
  let searchJson: unknown;
  try {
    const response = await fetchFn(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(needle)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      return { status: 'error', reason: `CoinGecko search failed: HTTP ${response.status}` };
    }
    searchJson = await response.json();
  } catch (error: unknown) {
    return {
      status: 'error',
      reason: error instanceof Error ? error.message : 'CoinGecko search failed.',
    };
  }
  const coins = isRecord(searchJson) && Array.isArray(searchJson['coins'])
    ? searchJson['coins']
    : [];
  if (coins.length === 0) return { status: 'not-found' };

  const candidates: TokenSearchCandidate[] = [];
  const seen = new Set<string>();
  for (const coin of coins.slice(0, MAX_DETAIL_FETCHES)) {
    if (!isRecord(coin) || typeof coin['id'] !== 'string') continue;
    const id = coin['id'];
    let detail: unknown;
    try {
      const response = await fetchFn(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) continue;
      detail = await response.json();
    } catch {
      continue;
    }
    if (!isRecord(detail)) continue;
    const platforms = detail['detail_platforms'];
    if (!isRecord(platforms)) continue;
    const name = typeof detail['name'] === 'string' ? detail['name'] : '';
    const symbol =
      typeof coin['symbol'] === 'string' && coin['symbol'] !== ''
        ? coin['symbol'].toUpperCase()
        : typeof detail['symbol'] === 'string'
          ? detail['symbol'].toUpperCase()
          : '';
    if (name === '' || symbol === '') continue;
    for (const [platform, info] of Object.entries(platforms)) {
      const chain = CHAIN_FOR_PLATFORM[platform];
      if (chain === undefined) continue;
      if (!isRecord(info)) continue;
      const contract = info['contract_address'];
      const decimals = info['decimal_place'];
      // Decimals unknown -> skip the platform; never invent them.
      if (typeof contract !== 'string' || contract === '') continue;
      if (typeof decimals !== 'number' || !Number.isInteger(decimals)) continue;
      const key = `${chain}:${contract.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ chain, contract, name, symbol, decimals, coingeckoId: id });
    }
  }
  if (candidates.length === 0) return { status: 'not-found' };
  // Exact symbol first, then exact name, then search order.
  const rank = (candidate: TokenSearchCandidate): number => {
    if (candidate.symbol.toLowerCase() === needle.toLowerCase()) return 0;
    if (candidate.name.toLowerCase() === needle.toLowerCase()) return 1;
    return 2;
  };
  candidates.sort((a, b) => rank(a) - rank(b));
  return { status: 'found', candidates };
}
