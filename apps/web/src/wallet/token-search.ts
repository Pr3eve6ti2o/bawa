// Remote ticker/name search (token gaps, item 2; Lane 1).
//
// Resolves a ticker or name through CoinGecko's keyless public API:
// /search for candidate coins, then /coins/{id} for each hit's
// contract addresses per platform (detail_platforms, which carries
// decimal_place). Only platforms this wallet supports are kept — the
// canonical map in wallet/tokens.ts (all 87 chains: 60 EVM platforms
// + Solana + TRON + TON; Bob has no CoinGecko platform); a
// platform without known decimals is skipped rather than invented.
// A query that resolves to nothing returns not-found honestly.
//
// Lane 1: every candidate here is CoinGecko-confirmed — the contract
// came from CoinGecko's own detail_platforms for that exact coin —
// so every remote candidate is VERIFIED by the isVerifiedToken rule
// (coingeckoId set, see wallet/tokens.ts). Detail fetches run
// exact-symbol first, then exact-name, then search order, so a
// rate limit that bites mid-way still leaves the coin the user asked
// for. And a detail fetch that fails (429 / 5xx / network) is an
// ERROR, never not-found: the search found coins but their details
// could not be read, and saying "no token found" for a real token is
// a false negative. Not-found is returned only when the search finds
// no coins at all, or when every detail fetch succeeds yet yields
// nothing usable (no supported platform, no decimals).
//
// The local half — matching against the in-repo registry — is
// resolveTokenByTickerOrName in tokens.ts. The Add Token dialog tries
// the local registry first, then this remote search.
import type { ChainId } from './chains';
import { isRecord } from './guards';
import { COINGECKO_PLATFORM_FOR_CHAIN, type TokenIconSource } from './tokens';

export interface TokenSearchCandidate {
  chain: ChainId;
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
  coingeckoId: string;
  /** Lane 1: true for every remote candidate — its contract was
   * confirmed by CoinGecko for this exact coin (see the header). */
  verified: boolean;
  /** Lane A: the CoinGecko token image (image.small), when the
   * detail response carries one — the candidate's icon, shown in
   * the search results instead of the link mark. */
  iconUrl?: string | null;
  /** Lane A: which source the icon came from. */
  iconSource?: TokenIconSource | null;
}

export type TokenSearchResult =
  | { status: 'found'; candidates: TokenSearchCandidate[] }
  | { status: 'not-found' }
  | { status: 'error'; reason: string };

/**
 * CoinGecko platform id -> wallet chain (inverse of the canonical
 * map in wallet/tokens.ts — the single source of truth, so a new
 * chain's platform is added once and search, Add Token and the
 * contract lookup all see it). Bob (60808) has no CoinGecko
 * platform, so it never appears here.
 */
const CHAIN_FOR_PLATFORM: Partial<Record<string, ChainId>> = Object.fromEntries(
  Object.entries(COINGECKO_PLATFORM_FOR_CHAIN).map(([chain, platform]) => [
    platform as string,
    chain as ChainId,
  ]),
);

/** At most this many search hits get a detail fetch (bounds the calls). */
const MAX_DETAIL_FETCHES = 3;


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
      return {
        status: 'error',
        reason:
          response.status === 429
            ? 'CoinGecko is rate-limiting searches right now — try again in a minute, or add the token by contract address.'
            : `CoinGecko search failed: HTTP ${response.status}`,
      };
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

  // Lane 1: detail fetches run exact-symbol first, then exact-name,
  // then search order — the coin the user asked for is fetched first,
  // so a rate limit that bites mid-way still leaves its candidates.
  const lowerNeedle = needle.toLowerCase();
  const coinRank = (coin: unknown): number => {
    if (!isRecord(coin)) return 2;
    if (
      typeof coin['symbol'] === 'string' &&
      coin['symbol'].toLowerCase() === lowerNeedle
    ) {
      return 0;
    }
    if (
      typeof coin['name'] === 'string' &&
      coin['name'].toLowerCase() === lowerNeedle
    ) {
      return 1;
    }
    return 2;
  };
  const ordered = coins
    .map((coin, index) => ({ coin, index }))
    .sort((a, b) => coinRank(a.coin) - coinRank(b.coin) || a.index - b.index)
    .map(({ coin }) => coin);

  const candidates: TokenSearchCandidate[] = [];
  const seen = new Set<string>();
  // Lane 1: a detail fetch that fails is not "no token" (see the
  // header). Only a clean run that yields nothing usable is not-found.
  let detailFailed = false;
  let detailRateLimited = false;
  for (const coin of ordered.slice(0, MAX_DETAIL_FETCHES)) {
    if (!isRecord(coin) || typeof coin['id'] !== 'string') continue;
    const id = coin['id'];
    let detail: unknown;
    try {
      const response = await fetchFn(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) {
        detailFailed = true;
        if (response.status === 429) detailRateLimited = true;
        continue;
      }
      detail = await response.json();
    } catch {
      detailFailed = true;
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
    // Lane A: the CoinGecko token image, when the detail carries
    // one — the search candidate's icon (source: CoinGecko).
    const image = isRecord(detail['image']) ? detail['image']['small'] : undefined;
    const iconUrl =
      typeof image === 'string' && image !== '' ? image : null;
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
      // Lane 1: CoinGecko-confirmed contract — verified (see header).
      candidates.push({ chain, contract, name, symbol, decimals, coingeckoId: id, verified: true, iconUrl, iconSource: iconUrl === null ? null : 'coingecko' });
    }
  }
  if (candidates.length === 0) {
    if (detailFailed) {
      return {
        status: 'error',
        reason: detailRateLimited
          ? 'CoinGecko is rate-limiting searches right now — try again in a minute, or add the token by contract address.'
          : 'CoinGecko token details could not be loaded — try again, or add the token by contract address.',
      };
    }
    return { status: 'not-found' };
  }
  // Exact symbol first, then exact name, then search order.
  const rank = (candidate: TokenSearchCandidate): number => {
    if (candidate.symbol.toLowerCase() === needle.toLowerCase()) return 0;
    if (candidate.name.toLowerCase() === needle.toLowerCase()) return 1;
    return 2;
  };
  candidates.sort((a, b) => rank(a) - rank(b));
  return { status: 'found', candidates };
}
