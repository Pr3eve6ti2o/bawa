/**
 * Token prices (token discovery).
 *
 * prices.ts is chain-keyed (PriceMap); token prices need a parallel
 * token-keyed map keyed by tokenKey (`${chain}:${contract}`). Same
 * keyless budget shape, same 10-minute freshness, same 429/backoff
 * shape — one batched /simple/price call per refresh for the default
 * 21 tokens. User-added tokens resolve their CoinGecko id once at add
 * time (token-balances resolveTokenCoingeckoId) and join the batch.
 *
 * Tokens CoinGecko does NOT list are priced by the fallback in
 * dex-prices.ts instead (README showcase + Add Token, item D):
 * DexScreener for EVM/Solana/TRON tokens, TonAPI rates for TON
 * Jettons. Lane B (2026-11-24): the same legs now back up the
 * CoinGecko-LISTED tokens too — before this, a blocked CoinGecko
 * took down all 21 default token prices while the natives fell
 * back; a listed token whose CoinGecko quote is not fresh is
 * priced from DexScreener / TonAPI instead (see fetchTokenPrices).
 * A token no source prices stays "Price unavailable" — the
 * feed never invents a price. The row label shows the quote's real
 * source (see asset-rows / asset-detail), never a hardcoded provider.
 */
import { useRef } from 'react';
import { isPlainObject, ownValue } from './guards';
import {
  PRICE_ATTRIBUTION_TEXT,
  fetchCoingeckoSimplePrices,
  fiatValueForPricedBalance,
  isCacheableQuote,
  isFreshQuote,
  isValidUsdPriceString,
  parseCoingeckoPriceEntry,
  usePriceRefresh,
  writePriceCache,
  type FiatValueResult,
  type PriceEntry,
  type PriceQuote,
  type PriceSource,
} from './prices';
import {
  DEXSCREENER_CHAIN_FOR_CHAIN,
  fetchDexScreenerPrices,
  fetchTonJettonPrices,
} from './dex-prices';
import type { BalanceState } from './balance-state';
import { DEFAULT_TOKENS, tokenKey, type TokenRecord } from './tokens';

export { PRICE_ATTRIBUTION_TEXT };

export type TokenPriceMap = Record<string, PriceEntry>;

export type TokenPriceEntry = PriceEntry;

export const TOKEN_PRICE_IDS: Record<string, string> = Object.fromEntries(
  DEFAULT_TOKENS.map((token) => [
    tokenKey(token.chain, token.contract),
    token.coingeckoId as string,
  ]),
);

export const TOKEN_PRICE_CACHE_KEY = 'bawa:token-prices-cache:v2';

export function tokenPriceEntries(keys: readonly string[]): TokenPriceMap {
  const entries: TokenPriceMap = {};
  for (const key of keys) {
    entries[key] = { status: 'unavailable', reason: 'missing' };
  }
  return entries;
}

/**
 * One price request per token. CoinGecko first (a token with an id is
 * priced there and never reaches the fallback); without an id, the
 * DexScreener chain map decides (EVM/Solana/TRON), then TonAPI for
 * TON Jettons. A token on a chain no fallback covers (Gnosis, Aurora
 * — DexScreener does not index them) gets no request and stays
 * "Price unavailable" (see tokenPriceEntries / fiatValueForTokenBalance).
 */
export type TokenPriceRequest =
  | { kind: 'coingecko'; key: string; coingeckoId: string }
  | { kind: 'dexscreener'; key: string; chain: TokenRecord['chain']; contract: string }
  | { kind: 'tonapi'; key: string; contract: string };

export function tokenPriceRequests(tokens: readonly TokenRecord[]): TokenPriceRequest[] {
  const requests: TokenPriceRequest[] = [];
  for (const token of tokens) {
    const key = tokenKey(token.chain, token.contract);
    const coingeckoId =
      token.coingeckoId ?? TOKEN_PRICE_IDS[key];
    if (typeof coingeckoId === 'string' && coingeckoId !== '') {
      requests.push({ kind: 'coingecko', key, coingeckoId });
    } else if (DEXSCREENER_CHAIN_FOR_CHAIN[token.chain] !== undefined) {
      requests.push({ kind: 'dexscreener', key, chain: token.chain, contract: token.contract });
    } else if (token.chain === 'ton') {
      requests.push({ kind: 'tonapi', key, contract: token.contract });
    }
  }
  return requests;
}

/** The provider id a request is priced by (CoinGecko id, or the contract for the fallback). */
export function tokenPriceRequestKey(request: TokenPriceRequest): string {
  return request.kind === 'coingecko'
    ? `${request.key}=coingecko:${request.coingeckoId}`
    : `${request.key}=${request.kind}:${request.contract}`;
}

function parseToken(
  root: Record<string, unknown> | null,
  request: Extract<TokenPriceRequest, { kind: 'coingecko' }>,
  token: TokenRecord | undefined,
  nowMs: number,
): PriceEntry {
  if (root === null) {
    return { status: 'error', reason: 'provider' };
  }
  return parseCoingeckoPriceEntry(ownValue(root, request.coingeckoId), {
    chain: (token?.chain ?? 'eth') as PriceQuote['chain'],
    assetId: token?.contract ?? request.key,
    providerAssetId: request.coingeckoId,
  }, nowMs);
}

export function parseTokenPriceResponse(
  payload: unknown,
  requests: TokenPriceRequest[],
  nowMs: number,
  tokens?: readonly TokenRecord[],
): TokenPriceMap {
  const root = isPlainObject(payload) ? payload : null;
  const entries: TokenPriceMap = {};
  for (const request of requests) {
    // Only CoinGecko requests are priced from this payload; fallback
    // requests are priced by fetchDexScreenerPrices / fetchTonJettonPrices.
    if (request.kind !== 'coingecko') continue;
    const token = tokens?.find(
      (candidate) => tokenKey(candidate.chain, candidate.contract) === request.key,
    );
    entries[request.key] = parseToken(root, request, token, nowMs);
  }
  return entries;
}

/**
 * One batched CoinGecko /simple/price call for the CoinGecko requests.
 * Unchanged behaviour: a single call carrying every distinct id, 429 /
 * provider / network errors reported per token. Only called when at
 * least one request is a CoinGecko request.
 */
async function fetchCoingeckoTokenPrices(
  fetchFn: typeof fetch,
  requests: Extract<TokenPriceRequest, { kind: 'coingecko' }>[],
  nowMs: number,
  tokens?: readonly TokenRecord[],
): Promise<TokenPriceMap> {
  const allError = (entry: Extract<PriceEntry, { status: 'error' }>): TokenPriceMap =>
    Object.fromEntries(requests.map((request) => [request.key, { ...entry }]));

  return fetchCoingeckoSimplePrices(
    fetchFn,
    [...new Set(requests.map((request) => request.coingeckoId))].join(','),
    allError,
    (payload) => parseTokenPriceResponse(payload, requests, nowMs, tokens),
  );
}

/**
 * Prices every requested token: CoinGecko for listed tokens, DexScreener
 * for unlisted EVM/Solana/TRON tokens, TonAPI rates for unlisted TON
 * Jettons — the three fetches run in parallel and merge by tokenKey.
 * A source that fails reports errors only for its own tokens; the other
 * sources' quotes are unaffected. Lane B: a listed token whose
 * CoinGecko quote is not fresh then falls back to the same
 * DexScreener / TonAPI legs (only fresh fallback quotes replace the
 * CoinGecko entry); Gnosis and Aurora tokens have no DexScreener leg
 * (no pairs indexed live) and keep their honest CoinGecko state.
 */
export async function fetchTokenPrices(
  fetchFn: typeof fetch,
  requests: TokenPriceRequest[],
  nowMs?: number,
  tokens?: readonly TokenRecord[],
): Promise<TokenPriceMap> {
  const resolvedNowMs = nowMs ?? Date.now();
  if (requests.length === 0) return {};

  const coingecko = requests.filter(
    (request): request is Extract<TokenPriceRequest, { kind: 'coingecko' }> =>
      request.kind === 'coingecko',
  );
  const dex = requests.filter(
    (request): request is Extract<TokenPriceRequest, { kind: 'dexscreener' }> =>
      request.kind === 'dexscreener',
  );
  const ton = requests.filter(
    (request): request is Extract<TokenPriceRequest, { kind: 'tonapi' }> =>
      request.kind === 'tonapi',
  );

  const [coingeckoEntries, dexEntries, tonEntries] = await Promise.all([
    coingecko.length > 0
      ? fetchCoingeckoTokenPrices(fetchFn, coingecko, resolvedNowMs, tokens)
      : Promise.resolve({} as TokenPriceMap),
    dex.length > 0
      ? fetchDexScreenerPrices(fetchFn, dex, resolvedNowMs)
      : Promise.resolve({} as TokenPriceMap),
    ton.length > 0
      ? fetchTonJettonPrices(fetchFn, ton, resolvedNowMs)
      : Promise.resolve({} as TokenPriceMap),
  ]);
  const merged: TokenPriceMap = { ...coingeckoEntries, ...dexEntries, ...tonEntries };

  // Lane B (2026-11-24): back up the CoinGecko-listed tokens from
  // DexScreener / TonAPI when their CoinGecko quote is not fresh —
  // a blocked CoinGecko used to take down all 21 default token
  // prices while the natives fell back. Only a fresh fallback quote
  // replaces the CoinGecko entry; a token no fallback prices keeps
  // its honest CoinGecko error / unavailable state. Needs the token
  // records to resolve chain + contract, so a call without them
  // (unit tests) simply skips this leg.
  const staleListed = coingecko.filter(
    (request) => merged[request.key]?.status !== 'fresh',
  );
  if (staleListed.length > 0 && tokens !== undefined) {
    const dexFallback: Array<{
      key: string;
      chain: TokenRecord['chain'];
      contract: string;
    }> = [];
    const tonFallback: Array<{ key: string; contract: string }> = [];
    for (const request of staleListed) {
      const token = tokens.find(
        (candidate) =>
          tokenKey(candidate.chain, candidate.contract) === request.key,
      );
      if (token === undefined) continue;
      if (token.chain === 'ton') {
        tonFallback.push({ key: request.key, contract: token.contract });
      } else if (DEXSCREENER_CHAIN_FOR_CHAIN[token.chain] !== undefined) {
        dexFallback.push({
          key: request.key,
          chain: token.chain,
          contract: token.contract,
        });
      }
    }
    const [dexFallbackEntries, tonFallbackEntries] = await Promise.all([
      dexFallback.length > 0
        ? fetchDexScreenerPrices(fetchFn, dexFallback, resolvedNowMs)
        : Promise.resolve({} as TokenPriceMap),
      tonFallback.length > 0
        ? fetchTonJettonPrices(fetchFn, tonFallback, resolvedNowMs)
        : Promise.resolve({} as TokenPriceMap),
    ]);
    for (const entries of [dexFallbackEntries, tonFallbackEntries]) {
      for (const [key, value] of Object.entries(entries)) {
        if (value?.status === 'fresh') merged[key] = value;
      }
    }
  }
  return merged;
}

/** Fiat value of a token balance, mirroring fiatValueForBalance in prices.ts. */
/**
 * Fiat value of a token balance, mirroring fiatValueForBalance in prices.ts.
 * Implemented by the shared fiatValueForPricedBalance — same balance,
 * entry and freshness rules, decimals from the token record.
 */
export function fiatValueForTokenBalance(
  balance: BalanceState,
  decimals: number,
  entry: PriceEntry | undefined,
  nowMs: number,
): FiatValueResult {
  return fiatValueForPricedBalance(balance, decimals, entry, nowMs);
}

export type TokenPriceCacheStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function saveCachedTokenPrices(
  entries: TokenPriceMap,
  nowMs: number,
  tokens?: readonly TokenRecord[],
  store?: TokenPriceCacheStore,
): void {
  try {
    const quotes: Array<{
      tokenKey: string;
      chain: string;
      contract: string;
      providerAssetId: string;
      source: PriceSource;
      usdPrice: string;
      providerUpdatedAtMs: number;
      fetchedAtMs: number;
    }> = [];
    for (const [key, entry] of Object.entries(entries)) {
      if (entry?.status !== 'fresh') continue;
      const quote = entry.quote;
      if (!isCacheableQuote(quote, nowMs)) {
        continue;
      }
      const token = tokens?.find(
        (candidate) => tokenKey(candidate.chain, candidate.contract) === key,
      );
      quotes.push({
        tokenKey: key,
        chain: String(quote.chain),
        contract: token?.contract ?? quote.assetId,
        providerAssetId: quote.providerAssetId,
        source: quote.source,
        usdPrice: quote.usdPrice,
        providerUpdatedAtMs: quote.providerUpdatedAtMs,
        fetchedAtMs: quote.fetchedAtMs,
      });
    }
    writePriceCache(store, TOKEN_PRICE_CACHE_KEY, 2, quotes);
  } catch {
    // Cache persistence is best-effort, including access to localStorage.
  }
}

export function loadCachedTokenPrices(
  nowMs: number,
  keys: readonly string[],
  store?: TokenPriceCacheStore,
): TokenPriceMap | null {
  try {
    const cacheStore = store ?? globalThis.localStorage;
    if (!cacheStore) return null;
    const serialized = cacheStore.getItem(TOKEN_PRICE_CACHE_KEY);
    if (serialized === null) return null;
    const parsed: unknown = JSON.parse(serialized);
    if (!isPlainObject(parsed)) return null;
    if (parsed.version !== 2 || !Array.isArray(parsed.quotes)) return null;
    const entries = tokenPriceEntries(keys);
    let hasUsableRecord = false;
    for (const value of parsed.quotes as unknown[]) {
      if (!isPlainObject(value)) continue;
      const {
        tokenKey: key,
        chain,
        contract,
        providerAssetId,
        source,
        usdPrice,
        providerUpdatedAtMs,
        fetchedAtMs,
      } = value;
      if (
        typeof key !== 'string' ||
        !keys.includes(key) ||
        typeof chain !== 'string' ||
        typeof contract !== 'string' ||
        typeof providerAssetId !== 'string' ||
        (source !== 'CoinGecko' && source !== 'DexScreener' && source !== 'TonAPI') ||
        typeof usdPrice !== 'string' ||
        !isValidUsdPriceString(usdPrice) ||
        typeof providerUpdatedAtMs !== 'number' ||
        !Number.isFinite(providerUpdatedAtMs) ||
        typeof fetchedAtMs !== 'number' ||
        !Number.isFinite(fetchedAtMs)
      ) {
        continue;
      }
      const quote: PriceQuote = {
        chain: chain as PriceQuote['chain'],
        assetId: contract,
        providerAssetId,
        usdPrice,
        providerUpdatedAtMs,
        fetchedAtMs,
        source: source as PriceSource,
      };
      entries[key] = isFreshQuote(quote, nowMs)
        ? { status: 'fresh', quote }
        : { status: 'expired', quote };
      hasUsableRecord = true;
    }
    return hasUsableRecord ? entries : null;
  } catch {
    return null;
  }
}

export type TokenPricesState = {
  status: 'idle' | 'loading' | 'ready';
  entries: TokenPriceMap;
  lastFetchedAtMs: number | null;
};

/**
 * Token price hook, mirroring usePrices: idle → loading → ready, up to
 * 3 attempts on rate-limit/network/timeout with the same backoff, last
 * settled entries kept while refetching. The token list is an argument
 * so user-added tokens join the batch; the hook refetches when the set
 * of requested ids changes.
 */

export function useTokenPrices(
  tokens: readonly TokenRecord[],
  options?: { sleep?: (ms: number) => Promise<void> },
): { state: TokenPricesState; refresh: () => void } {
  // Round 2, item 6: same as usePrices — token prices are public market
  // data, so they load in devnet mode too and the token rows show their
  // per-unit price. In devnet mode token balances stay unavailable
  // ('devnet-no-tokens'), so no fiat value is ever computed from a
  // devnet token balance; the hero total never sees token prices either
  // (see dashboard.tsx).
  const requests = tokenPriceRequests(tokens);
  const requestKey = requests.map((r) => tokenPriceRequestKey(r)).sort().join('|');
  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  return usePriceRefresh<TokenPriceMap>({
    initialEntries: () => {
      const keys = requests.map((r) => r.key);
      try {
        return loadCachedTokenPrices(Date.now(), keys) ?? tokenPriceEntries(keys);
      } catch {
        return tokenPriceEntries(keys);
      }
    },
    networkEntries: () => {
      const currentRequests = requestsRef.current;
      const keys = currentRequests.map((r) => r.key);
      const entries = tokenPriceEntries(keys);
      for (const key of keys) {
        entries[key] = { status: 'error', reason: 'network' };
      }
      return entries;
    },
    fetchEntries: () =>
      fetchTokenPrices(globalThis.fetch, requestsRef.current, Date.now(), tokensRef.current),
    saveCache: (entries) => {
      saveCachedTokenPrices(entries, Date.now(), tokensRef.current);
    },
    sleep: options?.sleep,
    refreshKey: requestKey,
  });
}
