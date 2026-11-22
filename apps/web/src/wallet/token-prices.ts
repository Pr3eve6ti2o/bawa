/**
 * CoinGecko prices for tokens (token discovery).
 *
 * prices.ts is chain-keyed (PriceMap); token prices need a parallel
 * token-keyed map keyed by tokenKey (`${chain}:${contract}`). Same
 * provider, same keyless ~5 calls/min budget, same 10-minute freshness,
 * same 429/backoff shape — one batched /simple/price call per refresh
 * for the default 7 tokens (six unique ids; the two USDT deployments
 * share 'tether'). User-added tokens resolve their CoinGecko id once at
 * add time (token-balances resolveTokenCoingeckoId) and join the batch.
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
} from './prices';
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

export const TOKEN_PRICE_CACHE_KEY = 'bawa:token-prices-cache:v1';

export function tokenPriceEntries(keys: readonly string[]): TokenPriceMap {
  const entries: TokenPriceMap = {};
  for (const key of keys) {
    entries[key] = { status: 'unavailable', reason: 'missing' };
  }
  return entries;
}

export interface TokenPriceRequest {
  key: string;
  coingeckoId: string;
}

export function tokenPriceRequests(tokens: readonly TokenRecord[]): TokenPriceRequest[] {
  const requests: TokenPriceRequest[] = [];
  for (const token of tokens) {
    const coingeckoId =
      token.coingeckoId ?? TOKEN_PRICE_IDS[tokenKey(token.chain, token.contract)];
    if (typeof coingeckoId !== 'string' || coingeckoId === '') continue;
    requests.push({ key: tokenKey(token.chain, token.contract), coingeckoId });
  }
  return requests;
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
  request: TokenPriceRequest,
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
    const token = tokens?.find(
      (candidate) => tokenKey(candidate.chain, candidate.contract) === request.key,
    );
    entries[request.key] = parseToken(root, request, token, nowMs);
  }
  return entries;
}

export async function fetchTokenPrices(
  fetchFn: typeof fetch,
  requests: TokenPriceRequest[],
  nowMs?: number,
  tokens?: readonly TokenRecord[],
): Promise<TokenPriceMap> {
  const resolvedNowMs = nowMs ?? Date.now();
  const allError = (entry: Extract<PriceEntry, { status: 'error' }>): TokenPriceMap =>
    Object.fromEntries(requests.map((request) => [request.key, { ...entry }]));
  const isAbortError = (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError';

  if (requests.length === 0) return {};

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
      return parseTokenPriceResponse(await response.json(), requests, resolvedNowMs, tokens);
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
      coingeckoId: string;
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
        coingeckoId: quote.providerAssetId,
        usdPrice: quote.usdPrice,
        providerUpdatedAtMs: quote.providerUpdatedAtMs,
        fetchedAtMs: quote.fetchedAtMs,
      });
    }
    if (quotes.length === 0) return;
    const cacheStore = store ?? globalThis.localStorage;
    if (!cacheStore) return;
    cacheStore.setItem(TOKEN_PRICE_CACHE_KEY, JSON.stringify({ version: 1, quotes }));
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
    if (parsed.version !== 1 || !Array.isArray(parsed.quotes)) return null;
    const entries = tokenPriceEntries(keys);
    let hasUsableRecord = false;
    for (const value of parsed.quotes as unknown[]) {
      if (!isPlainObject(value)) continue;
      const {
        tokenKey: key,
        chain,
        contract,
        coingeckoId,
        usdPrice,
        providerUpdatedAtMs,
        fetchedAtMs,
      } = value;
      if (
        typeof key !== 'string' ||
        !keys.includes(key) ||
        typeof chain !== 'string' ||
        typeof contract !== 'string' ||
        typeof coingeckoId !== 'string' ||
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
        providerAssetId: coingeckoId,
        usdPrice,
        providerUpdatedAtMs,
        fetchedAtMs,
        source: 'CoinGecko',
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
  const requests = tokenPriceRequests(tokens);
  const requestKey = requests.map((r) => `${r.key}=${r.coingeckoId}`).sort().join('|');
  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const [state, setState] = useState<TokenPricesState>(() => {
    const keys = requests.map((r) => r.key);
    let entries: TokenPriceMap;
    try {
      entries = loadCachedTokenPrices(Date.now(), keys) ?? tokenPriceEntries(keys);
    } catch {
      entries = tokenPriceEntries(keys);
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

  const refresh = useCallback(() => {
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
      setState(networkError);
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
          setState({ status: 'ready', entries, lastFetchedAtMs: Date.now() });
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
          setState(networkError);
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [state.status, sleep, requestKey]);

  return { state, refresh };
}
