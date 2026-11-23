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
 * Jettons. A token no source prices stays "Price unavailable" — the
 * feed never invents a price. The row label shows the quote's real
 * source (see asset-rows / asset-detail), never a hardcoded provider.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PRICE_ATTRIBUTION_TEXT,
  PRICE_FETCH_TIMEOUT_MS,
  PRICE_PROVIDER_BASE_URL,
  isFreshQuote,
  usdPriceToMinorUnitsPerWhole,
  type PriceEntry,
  type PriceQuote,
  type PriceSource,
} from './prices';
import {
  DEXSCREENER_CHAIN_FOR_CHAIN,
  fetchDexScreenerPrices,
  fetchTonJettonPrices,
} from './dex-prices';
import { fiatMinorUnits, formatFiatUSD } from './money';
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownValue(object: Record<string, unknown>, key: string): unknown {
  try {
    return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;
  } catch {
    return undefined;
  }
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
  const entry = ownValue(root, request.coingeckoId);
  if (!isPlainObject(entry)) {
    return { status: 'unavailable', reason: 'missing' };
  }
  const updatedAt = ownValue(entry, 'last_updated_at');
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
    return { status: 'unavailable', reason: 'missing-timestamp' };
  }
  const price = ownValue(entry, 'usd');
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return { status: 'unavailable', reason: 'invalid-price' };
  }
  const quote: PriceQuote = {
    chain: (token?.chain ?? 'eth') as PriceQuote['chain'],
    assetId: token?.contract ?? request.key,
    providerAssetId: request.coingeckoId,
    usdPrice: String(price),
    providerUpdatedAtMs: updatedAt * 1000,
    fetchedAtMs: nowMs,
    source: 'CoinGecko',
  };
  return isFreshQuote(quote, nowMs)
    ? { status: 'fresh', quote }
    : { status: 'expired', quote };
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
  const isAbortError = (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError';

  const headers: Record<string, string> = { Accept: 'application/json' };
  const demoKey: unknown = (import.meta.env as Record<string, unknown>)
    .VITE_COINGECKO_DEMO_KEY;
  if (typeof demoKey === 'string' && demoKey.length > 0) {
    headers['x-cg-demo-api-key'] = demoKey;
  }

  const ids = [...new Set(requests.map((request) => request.coingeckoId))].join(',');
  const url =
    `${PRICE_PROVIDER_BASE_URL}/simple/price?ids=${ids}` +
    '&vs_currencies=usd&include_last_updated_at=true';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRICE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const seconds =
        retryAfter !== null && retryAfter.trim() !== ''
          ? Number(retryAfter)
          : NaN;
      const retryAfterMs = seconds * 1000;
      return allError({
        status: 'error',
        reason: 'rate-limited',
        ...(Number.isFinite(retryAfterMs) && retryAfterMs >= 0
          ? { retryAfterMs }
          : {}),
      });
    }
    if (!response.ok) {
      return allError({ status: 'error', reason: 'provider' });
    }

    try {
      return parseTokenPriceResponse(await response.json(), requests, nowMs, tokens);
    } catch (error: unknown) {
      return allError({
        status: 'error',
        reason: isAbortError(error) ? 'timeout' : 'provider',
      });
    }
  } catch (error: unknown) {
    return allError({
      status: 'error',
      reason: isAbortError(error) ? 'timeout' : 'network',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prices every requested token: CoinGecko for listed tokens, DexScreener
 * for unlisted EVM/Solana/TRON tokens, TonAPI rates for unlisted TON
 * Jettons — the three fetches run in parallel and merge by tokenKey.
 * A source that fails reports errors only for its own tokens; the other
 * sources' quotes are unaffected.
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
  return { ...coingeckoEntries, ...dexEntries, ...tonEntries };
}

/** Fiat value of a token balance, mirroring fiatValueForBalance in prices.ts. */
export function fiatValueForTokenBalance(
  balance: BalanceState,
  decimals: number,
  entry: PriceEntry | undefined,
  nowMs: number,
):
  | { kind: 'zero' }
  | { kind: 'fiat'; minorUnits: number; text: string }
  | { kind: 'unavailable' }
  | { kind: 'expired' }
  | {
      kind: 'error';
      reason: 'rate-limited' | 'network' | 'provider' | 'timeout';
    }
  | { kind: 'balance-unavailable' } {
  if (
    balance.status === 'loading' ||
    balance.status === 'unavailable' ||
    balance.status === 'error'
  ) {
    return { kind: 'balance-unavailable' };
  }
  if (
    balance.status === 'zero' ||
    (balance.status === 'available' && balance.value === '0')
  ) {
    return { kind: 'zero' };
  }
  if (balance.value === undefined) {
    return { kind: 'balance-unavailable' };
  }
  if (entry === undefined) {
    return { kind: 'unavailable' };
  }
  if (entry.status === 'error') {
    return { kind: 'error', reason: entry.reason };
  }
  if (entry.status === 'unavailable') {
    return { kind: 'unavailable' };
  }
  if (entry.status === 'expired' || !isFreshQuote(entry.quote, nowMs)) {
    return { kind: 'expired' };
  }
  const minorUnits = fiatMinorUnits(
    balance.value,
    decimals,
    usdPriceToMinorUnitsPerWhole(entry.quote.usdPrice),
  );
  return { kind: 'fiat', minorUnits, text: formatFiatUSD(minorUnits) };
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
      if (
        typeof quote.usdPrice !== 'string' ||
        quote.usdPrice.trim() !== quote.usdPrice ||
        !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(quote.usdPrice) ||
        !Number.isFinite(Number(quote.usdPrice)) ||
        Number(quote.usdPrice) <= 0 ||
        !Number.isFinite(quote.providerUpdatedAtMs) ||
        !Number.isFinite(quote.fetchedAtMs) ||
        !isFreshQuote(quote, nowMs)
      ) {
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
    if (quotes.length === 0) return;
    const cacheStore = store ?? globalThis.localStorage;
    if (!cacheStore) return;
    cacheStore.setItem(TOKEN_PRICE_CACHE_KEY, JSON.stringify({ version: 2, quotes }));
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
        usdPrice.trim() !== usdPrice ||
        !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(usdPrice) ||
        !Number.isFinite(Number(usdPrice)) ||
        Number(usdPrice) <= 0 ||
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
/**
 * Item 11/12: same blanking bug as the native feed — a failed refresh
 * must not wipe token prices that are already on screen. Keep the last
 * good quote for a token when the new fetch ends in error.
 */
function mergePreservingFreshTokenQuotes(
  next: TokenPricesState['entries'],
  previous: TokenPricesState['entries'],
): TokenPricesState['entries'] {
  const merged = { ...next };
  for (const key of Object.keys(merged)) {
    const current = merged[key];
    const prev = previous[key];
    if (current?.status === 'error' && prev?.status === 'fresh') {
      merged[key] = prev;
    }
  }
  return merged;
}

export function useTokenPrices(
  tokens: readonly TokenRecord[],
  options?: { sleep?: (ms: number) => Promise<void>; devnet?: boolean },
): { state: TokenPricesState; refresh: () => void } {
  // TEMPORARY devnet mode: devnet tokens have no market price. Never
  // load cached mainnet prices for testnet balances, and never fetch.
  const devnet = options?.devnet === true;
  const requests = tokenPriceRequests(tokens);
  const requestKey = requests.map((r) => tokenPriceRequestKey(r)).sort().join('|');
  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const [state, setState] = useState<TokenPricesState>(() => {
    const keys = requests.map((r) => r.key);
    let entries: TokenPriceMap;
    if (devnet) {
      entries = tokenPriceEntries(keys);
    } else {
      try {
        entries = loadCachedTokenPrices(Date.now(), keys) ?? tokenPriceEntries(keys);
      } catch {
        entries = tokenPriceEntries(keys);
      }
    }
    return { status: 'idle', entries, lastFetchedAtMs: null };
  });

  const inFlight = useRef(false);
  const mounted = useRef(true);
  const sleep = options?.sleep;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Reset to no-prices when devnet mode turns on; the caller re-fetches
  // when it turns back off.
  useEffect(() => {
    if (devnet) {
      setState({
        status: 'idle',
        entries: tokenPriceEntries(requestsRef.current.map((r) => r.key)),
        lastFetchedAtMs: null,
      });
    }
  }, [devnet]);

  const refresh = useCallback(() => {
    // Devnet tokens have no market price: refresh is a no-op.
    if (devnet) return;
    if (!mounted.current || state.status === 'loading' || inFlight.current) return;
    const currentRequests = requestsRef.current;
    const keys = currentRequests.map((r) => r.key);
    const networkEntries = tokenPriceEntries(keys);
    for (const key of keys) {
      networkEntries[key] = { status: 'error', reason: 'network' };
    }
    const networkError: TokenPricesState = {
      status: 'ready',
      entries: networkEntries,
      lastFetchedAtMs: null,
    };
    if (typeof globalThis.fetch !== 'function') {
      setState((previous) => ({
        ...networkError,
        entries: mergePreservingFreshTokenQuotes(
          networkEntries,
          previous.entries,
        ),
      }));
      return;
    }
    const wait =
      sleep ??
      ((ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));
    inFlight.current = true;
    setState((previous) => ({ ...previous, status: 'loading' }));
    void (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (!mounted.current) return;
          const entries = await fetchTokenPrices(globalThis.fetch, currentRequests, Date.now(), tokensRef.current);
          if (!mounted.current) return;
          const values = Object.values(entries);
          if (
            attempt < 2 &&
            values.length > 0 &&
            values.every(
              (entry) =>
                entry.status === 'error' &&
                (entry.reason === 'rate-limited' ||
                  entry.reason === 'network' ||
                  entry.reason === 'timeout'),
            )
          ) {
            let delayMs = 1000 * (attempt + 1);
            const rateLimited = values.find(
              (entry) => entry.status === 'error' && entry.reason === 'rate-limited',
            );
            if (
              rateLimited?.status === 'error' &&
              rateLimited.reason === 'rate-limited'
            ) {
              const retryAfterMs = rateLimited.retryAfterMs;
              delayMs = Math.min(
                30_000,
                Math.max(
                  0,
                  typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs)
                    ? retryAfterMs
                    : 1000,
                ),
              );
            }
            await wait(delayMs);
            continue;
          }
          setState((previous) => ({
            status: 'ready',
            entries: mergePreservingFreshTokenQuotes(entries, previous.entries),
            lastFetchedAtMs: Date.now(),
          }));
          if (values.some((entry) => entry.status === 'fresh')) {
            try {
              saveCachedTokenPrices(entries, Date.now(), tokensRef.current);
            } catch {
              // Cache writes are best-effort.
            }
          }
          return;
        }
      } catch {
        if (mounted.current) {
          setState((previous) => ({
            ...networkError,
            entries: mergePreservingFreshTokenQuotes(
              networkEntries,
              previous.entries,
            ),
          }));
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [state.status, sleep, requestKey, devnet]);

  return { state, refresh };
}
