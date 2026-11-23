/**
 * CoinGecko public API: https://api.coingecko.com/api/v3 (terms 2026-11-20).
 * GET /simple/price?ids=bitcoin,ethereum,tron,the-open-network&vs_currencies=usd&include_last_updated_at=true
 * IDs: btc=bitcoin; eth=ethereum; trx=tron; ton=the-open-network;
 * sol=solana; bsc=binancecoin; matic=polygon-ecosystem-token;
 * arb=ethereum (Arbitrum native asset is ETH — NOT 'arbitrum', the ARB
 * governance token); op=ethereum (OP native asset is ETH — NOT
 * 'optimism', the OP governance token); base=ethereum (Base native
 * base, avalanche; ltc=litecoin; doge=dogecoin.
 * gnosis=xdai; celo=celo; linea=ethereum (Linea native asset is ETH);
 * mantle=mantle; scroll=ethereum (Scroll native asset is ETH);
 * opbnb=binancecoin (opBNB native asset is BNB); metis=metis-token;
 * aurora=ethereum (Aurora native asset is ETH); fantom=fantom.
 * matic-network is the STALE MATIC listing (last updated 2026-02-03,
 * verified live 2026-11-22): its quote would parse as expired forever.
 * polygon-ecosystem-token is the live POL listing.
 * Keyless: ~5 calls/min/shared IP; back off on 429; not recommended for production.
 * Optional import.meta.env.VITE_COINGECKO_DEMO_KEY -> x-cg-demo-api-key.
 * Demo tier: 10,000 credits/month; 100 calls/min.
 * Paid integration allowed; prominent "Powered by CoinGecko" (font 10+) required.
 * CoinPaprika rejected: Free personal-use only; customer display needs Enterprise.
 * DexPaprika rejected: forbids third-party display; no BTC; ETH/TRX only WETH/WTRX.
 * Live 2026-11-19: 'toncoin' returns {}; correct TON id is 'the-open-network'.
 * Refresh ~60s; MAX_QUOTE_AGE_MS permits at most 10 minutes of quote age.
 * Fallbacks (Lane C, 2026-11-23; see wallet/price-fallbacks.ts for
 * the live evidence): when a chain's CoinGecko quote is not fresh —
 * rate-limited, error, or expired, as Fantom's `fantom` id is
 * (~8h stale live, so it read "Price expired" forever) — usePrices
 * fills the gap from CoinLore (batched, first), DexScreener wrapped
 * natives (base-side, or the exact priceUsd/priceNative implied
 * price for quote-side pairs), TonAPI for TON, Coinbase for LTC.
 * 22 of 22 chains have a fallback (Lane B, 2026-11-24: Gnosis
 * xDAI via CoinLore DAI, Mantle MNT via CoinLore + DexScreener
 * WMNT, Fantom FTM via CoinLore Sonic (S) + DexScreener implied
 * — see wallet/price-fallbacks.ts for the live evidence). Rejected
 * live: Binance (451 geo-block; binance.us FTM $0.4806 is a frozen
 * quote, ~16x the live ~$0.03), CoinPaprika (same frozen FTM
 * $0.4803), CoinCodex (fantom "not_trading_anymore"), Kraken (no
 * CORS header, no FTM pair). The row label shows the quote's real
 * source.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isPlainObject, ownValue } from './guards';
import { applyPriceFallbacks } from './price-fallbacks';
import Decimal from 'decimal.js';
import type { ChainId } from '../engine/boundary';
import { CHAIN_DECIMALS } from './chain-amount-format';
import { fiatMinorUnits, formatFiatUSD, sumFiatUSD } from './money';
import type { BalanceState } from './balance-state';

export const PRICE_PROVIDER_BASE_URL = 'https://api.coingecko.com/api/v3';

export const PRICE_IDS: Record<ChainId, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  trx: 'tron',
  ton: 'the-open-network',
  sol: 'solana',
  bsc: 'binancecoin',
  matic: 'polygon-ecosystem-token',
  arb: 'ethereum',
  op: 'ethereum',
  base: 'ethereum',
  avax: 'avalanche-2',
  ltc: 'litecoin',
  doge: 'dogecoin',
  gnosis: 'xdai',
  celo: 'celo',
  linea: 'ethereum',
  mantle: 'mantle',
  scroll: 'ethereum',
  opbnb: 'binancecoin',
  metis: 'metis-token',
  aurora: 'ethereum',
  fantom: 'fantom',
};

export const PRICE_ASSET_IDS: Record<ChainId, string> = {
  btc: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  eth: 'eip155:1/slip44:60',
  trx: 'tron:0x2b6653dc/slip44:195',
  ton: 'ton:-239/slip44:607',
  sol: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
  bsc: 'eip155:56/slip44:60',
  matic: 'eip155:137/slip44:60',
  arb: 'eip155:42161/slip44:60',
  op: 'eip155:10/slip44:60',
  base: 'eip155:8453/slip44:60',
  avax: 'eip155:43114/slip44:60',
  ltc: 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2/slip44:2',
  doge: 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691/slip44:3',
  gnosis: 'eip155:100/slip44:60',
  celo: 'eip155:42220/slip44:527',
  linea: 'eip155:59144/slip44:60',
  mantle: 'eip155:5000/slip44:60',
  scroll: 'eip155:534352/slip44:60',
  opbnb: 'eip155:204/slip44:60',
  metis: 'eip155:1088/slip44:60',
  aurora: 'eip155:1313161554/slip44:60',
  fantom: 'eip155:250/slip44:250',
};

export const MAX_QUOTE_AGE_MS = 10 * 60 * 1000;
export const PRICE_FETCH_TIMEOUT_MS = 10_000;
export const PRICE_ATTRIBUTION_TEXT = 'Powered by CoinGecko';

export type PriceSource = 'CoinGecko' | 'DexScreener' | 'TonAPI' | 'CoinLore' | 'Coinbase';

export type PriceQuote = {
  chain: ChainId;
  assetId: string;
  providerAssetId: string;
  usdPrice: string;
  providerUpdatedAtMs: number;
  fetchedAtMs: number;
  source: PriceSource;
};

export type PriceEntry =
  | { status: 'fresh'; quote: PriceQuote }
  | { status: 'expired'; quote: PriceQuote }
  | {
      status: 'unavailable';
      reason: 'missing' | 'missing-timestamp' | 'invalid-price';
    }
  | {
      status: 'error';
      reason: 'rate-limited' | 'network' | 'provider' | 'timeout';
      retryAfterMs?: number;
    };

export type PriceMap = Record<ChainId, PriceEntry>;

export type PricesState = {
  status: 'idle' | 'loading' | 'ready';
  entries: PriceMap;
  lastFetchedAtMs: number | null;
};

export function isFreshQuote(quote: PriceQuote, nowMs: number): boolean {
  const providerAgeMs = nowMs - quote.providerUpdatedAtMs;
  const fetchAgeMs = nowMs - quote.fetchedAtMs;

  return (
    Number.isFinite(quote.providerUpdatedAtMs) &&
    providerAgeMs >= -60_000 &&
    providerAgeMs <= MAX_QUOTE_AGE_MS &&
    fetchAgeMs >= 0 &&
    fetchAgeMs <= MAX_QUOTE_AGE_MS
  );
}

/**
 * True for an abort: the price fetch timed out (AbortController fired).
 * One definition — prices.ts, token-prices.ts and dex-prices.ts each had
 * their own copy with the same semantics (marketing-fix Lane 2).
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

/**
 * CoinGecko request headers: JSON accept plus the optional demo key.
 * Read the key with a direct member access on the cast env object.
 * Verified first-hand (2026-11-20): in this repo's Vitest, the direct form
 * `(import.meta.env as Record).VITE_...` tracks vi.stubEnv and process env,
 * while a cast on `import.meta` itself (or a bracket read) is statically
 * replaced with undefined at transform time. In a production build
 * import.meta.env is the inlined env object, so the same read works there.
 */
export function coingeckoHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const demoKey: unknown = (import.meta.env as Record<string, unknown>)
    .VITE_COINGECKO_DEMO_KEY;
  if (typeof demoKey === 'string' && demoKey.length > 0) {
    headers['x-cg-demo-api-key'] = demoKey;
  }
  return headers;
}

export type FetchJsonResult =
  | { status: 'ok'; payload: unknown }
  | { status: 'error'; error: Extract<PriceEntry, { status: 'error' }> };

/**
 * One JSON GET with the price-feed timeout, shared by every price
 * fetcher (native CoinGecko, token CoinGecko, DexScreener, TonAPI):
 * 429 maps to rate-limited with Retry-After honoured, other non-OK to
 * provider, a JSON parse failure to timeout/provider, a transport
 * failure to timeout/network. The caller fans the single error entry
 * out per key and parses the payload itself, so the fetch shape lives
 * in exactly one place. Callers that need the CoinGecko demo-key header
 * pass coingeckoHeaders(); the rest take the plain JSON accept header.
 */
export async function fetchJsonWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  headers: Record<string, string> = { Accept: 'application/json' },
): Promise<FetchJsonResult> {
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
      return {
        status: 'error',
        error: {
          status: 'error',
          reason: 'rate-limited',
          ...(Number.isFinite(retryAfterMs) && retryAfterMs >= 0
            ? { retryAfterMs }
            : {}),
        },
      };
    }
    if (!response.ok) {
      return {
        status: 'error',
        error: { status: 'error', reason: 'provider' },
      };
    }
    try {
      return { status: 'ok', payload: await response.json() };
    } catch (error: unknown) {
      return {
        status: 'error',
        error: {
          status: 'error',
          reason: isAbortError(error) ? 'timeout' : 'provider',
        },
      };
    }
  } catch (error: unknown) {
    return {
      status: 'error',
      error: {
        status: 'error',
        reason: isAbortError(error) ? 'timeout' : 'network',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One CoinGecko /simple/price entry, shared by parsePriceResponse
 * (per chain) and parseTokenPriceResponse (per token): the payload
 * shape, timestamp rule and freshness rule are identical — only the
 * quote identity (chain, asset id, provider id) differs per caller.
 * The caller checks the payload root (null means a provider error)
 * and resolves the per-key entry before calling this.
 */
export function parseCoingeckoPriceEntry(
  entry: unknown,
  identity: {
    chain: PriceQuote['chain'];
    assetId: string;
    providerAssetId: string;
  },
  nowMs: number,
): PriceEntry {
  if (!isPlainObject(entry)) {
    return { status: 'unavailable', reason: 'missing' };
  }
  // A timestamp is mandatory, regardless of whether a price is present.
  const updatedAt = ownValue(entry, 'last_updated_at');
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
    return { status: 'unavailable', reason: 'missing-timestamp' };
  }
  const price = ownValue(entry, 'usd');
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return { status: 'unavailable', reason: 'invalid-price' };
  }
  const quote: PriceQuote = {
    chain: identity.chain,
    assetId: identity.assetId,
    providerAssetId: identity.providerAssetId,
    usdPrice: String(price),
    // CoinGecko timestamps are seconds, not milliseconds.
    providerUpdatedAtMs: updatedAt * 1000,
    fetchedAtMs: nowMs,
    source: 'CoinGecko',
  };
  return isFreshQuote(quote, nowMs)
    ? { status: 'fresh', quote }
    : { status: 'expired', quote };
}

/** A USD price string is well-formed for caching: no surrounding space, decimal syntax, finite and positive. */
export function isValidUsdPriceString(value: string): boolean {
  return (
    value.trim() === value &&
    /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0
  );
}

/** A fresh quote with a well-formed price and finite timestamps may be cached. */
export function isCacheableQuote(quote: PriceQuote, nowMs: number): boolean {
  return (
    typeof quote.usdPrice === 'string' &&
    isValidUsdPriceString(quote.usdPrice) &&
    Number.isFinite(quote.providerUpdatedAtMs) &&
    Number.isFinite(quote.fetchedAtMs) &&
    isFreshQuote(quote, nowMs)
  );
}

/**
 * Item 11/12: a failed refresh must not blank prices already on
 * screen. Keep the last good quote for a key when the new fetch ends
 * in error; only keys with no previous quote show the error. Generic
 * over the map type so the native and token feeds share it.
 */
export function mergePreservingFreshEntries<
  T extends Record<string, PriceEntry>,
>(next: T, previous: T): T {
  // A generic map cannot be indexed for writing (TS2862), so merge over
  // a plain record and cast back: the keys are unchanged, only values
  // are carried over from the previous map.
  const merged: Record<string, PriceEntry> = { ...next };
  for (const key of Object.keys(merged)) {
    const current = merged[key];
    const prev = previous[key];
    if (current?.status === 'error' && prev?.status === 'fresh') {
      merged[key] = prev;
    }
  }
  return merged as T;
}

/**
 * Retry delay for a failed price fetch: null when the fetch settled
 * (not every entry is a retryable error, or attempts are exhausted),
 * otherwise the backoff — 1s per attempt, or the provider's
 * Retry-After capped at 30s when rate-limited. Shared by usePrices
 * and useTokenPrices.
 */
export function priceRetryDelayMs(
  values: readonly PriceEntry[],
  attempt: number,
): number | null {
  if (
    attempt >= 2 ||
    values.length === 0 ||
    !values.every(
      (entry) =>
        entry.status === 'error' &&
        (entry.reason === 'rate-limited' ||
          entry.reason === 'network' ||
          entry.reason === 'timeout'),
    )
  ) {
    return null;
  }
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
  return delayMs;
}

/** Sleep used by the price hooks: the injected one in tests, else setTimeout. */
export function resolvePriceWait(
  sleep?: (ms: number) => Promise<void>,
): (ms: number) => Promise<void> {
  return (
    sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }))
  );
}

export const PRICE_CACHE_KEY = 'bawa:prices-cache:v1';

export type PriceCacheStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function saveCachedPrices(entries: PriceMap, nowMs: number, store?: PriceCacheStore): void {
  try {
    const quotes: Array<
      Pick<
        PriceQuote,
        | 'chain'
        | 'usdPrice'
        | 'providerUpdatedAtMs'
        | 'fetchedAtMs'
        | 'source'
        | 'providerAssetId'
      >
    > = [];

    for (const chain of Object.keys(PRICE_IDS) as ChainId[]) {
      const entry = entries[chain];
      if (entry?.status !== 'fresh') continue;

      const quote = entry.quote;
      if (!isCacheableQuote(quote, nowMs)) {
        continue;
      }

      quotes.push({
        chain,
        usdPrice: quote.usdPrice,
        providerUpdatedAtMs: quote.providerUpdatedAtMs,
        fetchedAtMs: quote.fetchedAtMs,
        // Lane C: a fallback quote (CoinLore/DexScreener/TonAPI/
        // Coinbase) must reload with its real source and provider
        // id, or the row would misattribute it to CoinGecko. Old
        // v1 records have neither field and still load as
        // CoinGecko below.
        source: quote.source,
        providerAssetId: quote.providerAssetId,
      });
    }

    writePriceCache(store, PRICE_CACHE_KEY, 1, quotes);
  } catch {
    // Cache persistence is best-effort, including access to localStorage.
  }
}

export function loadCachedPrices(nowMs: number, store?: PriceCacheStore): PriceMap | null {
  try {
    const cacheStore = store ?? globalThis.localStorage;
    if (!cacheStore) return null;

    const serialized = cacheStore.getItem(PRICE_CACHE_KEY);
    if (serialized === null) return null;

    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Object.getPrototypeOf(parsed) !== Object.prototype
    ) {
      return null;
    }

    const cache = parsed as Record<string, unknown>;
    const hasOwn = Object.prototype.hasOwnProperty;
    if (
      !hasOwn.call(cache, 'version') ||
      cache.version !== 1 ||
      !hasOwn.call(cache, 'quotes') ||
      !Array.isArray(cache.quotes)
    ) {
      return null;
    }

    const entries = {} as PriceMap;
    for (const chain of Object.keys(PRICE_IDS) as ChainId[]) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
    }

    let hasUsableRecord = false;
    for (const value of cache.quotes as unknown[]) {
      if (
        typeof value !== 'object' ||
        value === null ||
        Object.getPrototypeOf(value) !== Object.prototype
      ) {
        continue;
      }

      const record = value as Record<string, unknown>;
      if (
        !['chain', 'usdPrice', 'providerUpdatedAtMs', 'fetchedAtMs'].every(
          (key) => hasOwn.call(record, key),
        )
      ) {
        continue;
      }

      const { chain, usdPrice, providerUpdatedAtMs, fetchedAtMs } = record;
      if (
        typeof chain !== 'string' ||
        !hasOwn.call(PRICE_IDS, chain) ||
        typeof usdPrice !== 'string' ||
        !isValidUsdPriceString(usdPrice) ||
        typeof providerUpdatedAtMs !== 'number' ||
        !Number.isFinite(providerUpdatedAtMs) ||
        typeof fetchedAtMs !== 'number' ||
        !Number.isFinite(fetchedAtMs)
      ) {
        continue;
      }

      const chainId = chain as ChainId;
      // Lane C: restore the cached quote's real source when the
      // record carries one (fallback quotes, written since this
      // lane). Anything else — old records, or a forged/unknown
      // value — loads as CoinGecko, which is what every record
      // written before this lane was.
      const sourceValue = record['source'];
      const source: PriceSource =
        sourceValue === 'CoinGecko' ||
        sourceValue === 'DexScreener' ||
        sourceValue === 'TonAPI' ||
        sourceValue === 'CoinLore' ||
        sourceValue === 'Coinbase'
          ? sourceValue
          : 'CoinGecko';
      const providerAssetIdValue = record['providerAssetId'];
      const providerAssetId =
        typeof providerAssetIdValue === 'string' && providerAssetIdValue !== ''
          ? providerAssetIdValue
          : PRICE_IDS[chainId];
      const quote: PriceQuote = {
        chain: chainId,
        assetId: PRICE_ASSET_IDS[chainId],
        providerAssetId,
        usdPrice,
        providerUpdatedAtMs,
        fetchedAtMs,
        source,
      };

      entries[chainId] = isFreshQuote(quote, nowMs)
        ? { status: 'fresh', quote }
        : { status: 'expired', quote };
      hasUsableRecord = true;
    }

    return hasUsableRecord ? entries : null;
  } catch {
    return null;
  }
}

export function parsePriceResponse(
  payload: unknown,
  nowMs: number,
): PriceMap {
  const root = isPlainObject(payload) ? payload : null;

  const parseChain = (chain: ChainId): PriceEntry => {
    if (root === null) {
      return { status: 'error', reason: 'provider' };
    }

    return parseCoingeckoPriceEntry(ownValue(root, PRICE_IDS[chain]), {
      chain,
      assetId: PRICE_ASSET_IDS[chain],
      providerAssetId: PRICE_IDS[chain],
    }, nowMs);
  };

  return {
    btc: parseChain('btc'),
    eth: parseChain('eth'),
    trx: parseChain('trx'),
    ton: parseChain('ton'),
    sol: parseChain('sol'),
    bsc: parseChain('bsc'),
    matic: parseChain('matic'),
    arb: parseChain('arb'),
    op: parseChain('op'),
    base: parseChain('base'),
    avax: parseChain('avax'),
    gnosis: parseChain('gnosis'),
    celo: parseChain('celo'),
    linea: parseChain('linea'),
    mantle: parseChain('mantle'),
    scroll: parseChain('scroll'),
    opbnb: parseChain('opbnb'),
    metis: parseChain('metis'),
    aurora: parseChain('aurora'),
    fantom: parseChain('fantom'),
    ltc: parseChain('ltc'),
    doge: parseChain('doge'),
  };
}

/**
 * Shared CoinGecko /simple/price fetch: build the URL from the ids,
 * fetch with the demo-key header, map a transport failure to the
 * all-error result, parse the payload on success. fetchPrices and
 * fetchCoingeckoTokenPrices differ only in the ids, the all-error map
 * and the parse step.
 */
export async function fetchCoingeckoSimplePrices<T>(
  fetchFn: typeof fetch,
  ids: string,
  allError: (entry: Extract<PriceEntry, { status: 'error' }>) => T,
  parse: (payload: unknown) => T,
): Promise<T> {
  const url =
    `${PRICE_PROVIDER_BASE_URL}/simple/price?ids=${ids}` +
    '&vs_currencies=usd&include_last_updated_at=true';
  const result = await fetchJsonWithTimeout(fetchFn, url, coingeckoHeaders());
  if (result.status === 'error') {
    return allError(result.error);
  }
  return parse(result.payload);
}

/** Shared last-good-cache write tail (native v1, token v2). */
export function writePriceCache(
  store: PriceCacheStore | undefined,
  key: string,
  version: number,
  quotes: unknown[],
): void {
  if (quotes.length === 0) return;
  const cacheStore = store ?? globalThis.localStorage;
  if (!cacheStore) return;
  cacheStore.setItem(key, JSON.stringify({ version, quotes }));
}

export async function fetchPrices(
  fetchFn: typeof fetch,
  nowMs?: number,
): Promise<PriceMap> {
  const chains = ['btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom'] as const;
  const allError = (
    entry: Extract<PriceEntry, { status: 'error' }>,
  ): PriceMap =>
    Object.fromEntries(chains.map((chain) => [chain, { ...entry }])) as PriceMap;

  const resolvedNowMs = nowMs ?? Date.now();
  return fetchCoingeckoSimplePrices(
    fetchFn,
    [...new Set(Object.values(PRICE_IDS))].join(','),
    allError,
    (payload) => parsePriceResponse(payload, resolvedNowMs),
  );
}

export function usdPriceToMinorUnitsPerWhole(usdPrice: string): string {
  const invalidMessage =
    'Invalid USD price: expected a finite decimal string greater than zero.';
  let price: Decimal;
  try {
    price = new Decimal(usdPrice);
  } catch {
    throw new Error(invalidMessage);
  }
  if (!price.isFinite() || !price.gt('0')) {
    throw new Error(invalidMessage);
  }

  const ExactDecimal = Decimal.clone({
    precision: Math.max(Decimal.precision, price.precision() + 2),
  });
  return new ExactDecimal(usdPrice)
    .times('100')
    .toFixed(0, Decimal.ROUND_HALF_UP);
}

// Per-unit price for display (Lane A): the price of one whole unit of the
// chain's native asset, e.g. "$61,706.00" for BTC. Shown on every asset
// row regardless of balance, so the feed is observable even on a
// zero-balance or locked wallet — previously no surface rendered a
// per-unit price at all, and a working feed looked identical to a dead
// one. Never a balance value: it is labelled "per <symbol>" at the call
// site, and it is never used in totals.
export type UnitPrice =
  | { kind: 'fresh'; text: string }
  | { kind: 'expired' }
  | { kind: 'unavailable' }
  | {
      kind: 'error';
      reason: 'rate-limited' | 'network' | 'provider' | 'timeout';
    }
  | { kind: 'missing' };

export function formatUnitPriceUsd(usdPrice: string): string {
  const invalidPriceMessage =
    'Invalid USD price: expected a finite decimal string greater than zero.';

  if (
    typeof usdPrice !== 'string' ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(usdPrice)
  ) {
    throw new Error(invalidPriceMessage);
  }

  const PriceDecimal = Decimal.clone({
    precision: Math.max(40, usdPrice.length + 8),
    rounding: Decimal.ROUND_HALF_UP,
  });

  let price: Decimal;
  try {
    price = new PriceDecimal(usdPrice);
  } catch {
    throw new Error(invalidPriceMessage);
  }

  if (!price.isFinite() || !price.gt(0)) {
    throw new Error(invalidPriceMessage);
  }

  const fixed = price.toFixed(
    price.gte(1) ? 2 : 6,
    PriceDecimal.ROUND_HALF_UP,
  );
  const [whole = '0', fraction = ''] = fixed.split('.');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFraction = fraction.replace(/0+$/, '').padEnd(2, '0');

  return `$${groupedWhole}.${trimmedFraction}`;
}

export function unitPriceForChain(
  entry: PriceEntry | undefined,
  nowMs: number,
): UnitPrice {
  if (entry === undefined) {
    return { kind: 'missing' };
  }

  switch (entry.status) {
    case 'error':
      return { kind: 'error', reason: entry.reason };
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'expired':
      return { kind: 'expired' };
    case 'fresh':
      return isFreshQuote(entry.quote, nowMs)
        ? {
            kind: 'fresh',
            text: formatUnitPriceUsd(entry.quote.usdPrice),
          }
        : { kind: 'expired' };
  }
}

export type FiatValueResult =
  | { kind: 'zero' }
  | { kind: 'fiat'; minorUnits: number; text: string }
  | { kind: 'unavailable' }
  | { kind: 'expired' }
  | {
      kind: 'error';
      reason: 'rate-limited' | 'network' | 'provider' | 'timeout';
    }
  | { kind: 'balance-unavailable' };

/**
 * Fiat value of a priced balance, shared by fiatValueForBalance
 * (native: decimals from the chain) and fiatValueForTokenBalance
 * (token: decimals from the token record). An entry of undefined
 * means the token was never fetched — unavailable, not an error.
 */
export function fiatValueForPricedBalance(
  balance: BalanceState,
  decimals: number,
  entry: PriceEntry | undefined,
  nowMs: number,
): FiatValueResult {
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

export function fiatValueForBalance(
  chain: ChainId,
  balance: BalanceState,
  entry: PriceEntry,
  nowMs: number,
): FiatValueResult {
  return fiatValueForPricedBalance(balance, CHAIN_DECIMALS[chain], entry, nowMs);
}

/** Token fiat folded into the hero portfolio total (token gaps, item 7). */
export interface PortfolioTokenContribution {
  /** Fiat minor units of priced, non-zero token balances. */
  minorUnits: number[];
  /** True when a token balance failed to load or has no fresh price. */
  partial: boolean;
  /** True when at least one token balance loaded as zero. */
  loadedZero: boolean;
  /** True when a loaded non-zero token balance has no fresh price. */
  unpricedNonzero: boolean;
}

export function portfolioTotal(
  balances: Record<ChainId, BalanceState>,
  entries: PriceMap,
  nowMs: number,
  // Chains to total. Defaults to all 22 registry chains; the dashboard
  // passes availableFor('balance') so the hero totals exactly the chains
  // its loading/failed detection counts (in the screen tests that mock
  // is the original 4, which keeps the hero's 4-chain expectations).
  // Token values ARE in this total (token gaps, item 7): the hero is the
  // whole portfolio — natives plus the priced token balances the caller
  // folds in via tokenContribution. Token fiat values also show on
  // their own rows.
  chains: readonly ChainId[] = [
    'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom',
  ],
  tokenContribution?: PortfolioTokenContribution,
): {
  status: 'zero' | 'total' | 'partial' | 'unavailable';
  text: string;
  partial: boolean;
} {
  const list = chains.map((chain) => balances[chain]);
  // A chain still loading means the total is not decidable yet; the
  // dashboard holds the previous hero text in that case. Loading is not
  // a failure, so it is the one status that still yields 'unavailable'.
  if (list.some((balance) => balance?.status === 'loading')) {
    return { status: 'unavailable', text: 'Unavailable', partial: false };
  }
  const tokensSettledZero =
    tokenContribution === undefined ||
    (tokenContribution.minorUnits.length === 0 &&
      !tokenContribution.partial &&
      !tokenContribution.unpricedNonzero);
  if (
    tokensSettledZero &&
    list.every(
      (balance) =>
        balance !== undefined &&
        (balance.status === 'zero' || (balance.status === 'available' && balance.value === '0')),
    )
  ) {
    return { status: 'zero', text: '$0.00', partial: false };
  }

  // Partial total (Safe's aggregateBalance shape): sum the chains that
  // loaded; a failed chain contributes 0 and marks the total partial.
  // No all-or-nothing gate — one chain's failure never blanks the total.
  // A missing balance record counts as a failed chain, never as zero.
  const contributed: number[] = [];
  let partial = false;
  // A loaded non-zero balance whose price is not fresh: its value is
  // genuinely unknown, so the total is undecidable (unlike a failed
  // load, which the partial shape treats as 0 and discloses).
  let hasUnpricedNonzero = false;
  let loadedZero =
    tokenContribution !== undefined && tokenContribution.loadedZero;
  for (const chain of chains) {
    const balance = balances[chain];
    if (balance === undefined) {
      partial = true;
      continue;
    }
    if (balance.status === 'zero' || balance.value === '0') {
      loadedZero = true;
      continue;
    }
    if (balance.status === 'unavailable' || balance.status === 'error') {
      partial = true;
      continue;
    }
    const entry = entries[chain];
    if (
      balance.value === undefined ||
      entry === undefined ||
      entry.status !== 'fresh' ||
      !isFreshQuote(entry.quote, nowMs)
    ) {
      partial = true;
      if (balance.value !== undefined && balance.value !== '0') {
        hasUnpricedNonzero = true;
      }
      continue;
    }
    contributed.push(
      fiatMinorUnits(
        balance.value,
        CHAIN_DECIMALS[chain],
        usdPriceToMinorUnitsPerWhole(entry.quote.usdPrice),
      ),
    );
  }
  if (tokenContribution !== undefined) {
    contributed.push(...tokenContribution.minorUnits);
    partial = partial || tokenContribution.partial;
    hasUnpricedNonzero = hasUnpricedNonzero || tokenContribution.unpricedNonzero;
  }
  if (contributed.length === 0) {
    // Nothing priced. A known non-zero amount with no fresh price makes
    // the total undecidable — never report $0.00 for it. But when every
    // balance that did load is zero and only failed loads are unknown,
    // the loaded total is genuinely $0.00: report it as a clean zero
    // total with partial: true (the dashboard shows the plain $0.00
    // hero plus a quiet "couldn't check every balance" note, never the
    // alarming "$0.00 (Partial)" a fresh wallet used to see). Nothing
    // loaded at all stays 'unavailable'.
    if (hasUnpricedNonzero || !loadedZero) {
      return { status: 'unavailable', text: 'Unavailable', partial: false };
    }
    return { status: 'zero', text: '$0.00', partial: true };
  }
  return {
    status: partial ? 'partial' : 'total',
    text: sumFiatUSD(contributed),
    partial,
  };
}

export function quoteFreshnessLabel(quote: PriceQuote, nowMs: number): string {
  const ageMs = nowMs - quote.providerUpdatedAtMs;
  if (ageMs < 60_000) {
    return 'Updated just now';
  }
  if (ageMs < 3_600_000) {
    return `Updated ${Math.max(1, Math.floor(ageMs / 60_000))} min ago`;
  }
  const time = new Date(quote.providerUpdatedAtMs).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `Updated ${time}`;
}

/**
 * The all-unavailable price map (idle / no feed yet). Exported for the
 * dashboard: in devnet mode the hero total is computed against idle
 * entries, so test balances are never valued at mainnet prices.
 */
export function idlePriceEntries(): PriceMap {
  return {
    btc: { status: 'unavailable', reason: 'missing' },
    eth: { status: 'unavailable', reason: 'missing' },
    trx: { status: 'unavailable', reason: 'missing' },
    ton: { status: 'unavailable', reason: 'missing' },
    sol: { status: 'unavailable', reason: 'missing' },
    bsc: { status: 'unavailable', reason: 'missing' },
    matic: { status: 'unavailable', reason: 'missing' },
    arb: { status: 'unavailable', reason: 'missing' },
    op: { status: 'unavailable', reason: 'missing' },
    base: { status: 'unavailable', reason: 'missing' },
    avax: { status: 'unavailable', reason: 'missing' },
    gnosis: { status: 'unavailable', reason: 'missing' },
    celo: { status: 'unavailable', reason: 'missing' },
    linea: { status: 'unavailable', reason: 'missing' },
    mantle: { status: 'unavailable', reason: 'missing' },
    scroll: { status: 'unavailable', reason: 'missing' },
    opbnb: { status: 'unavailable', reason: 'missing' },
    metis: { status: 'unavailable', reason: 'missing' },
    aurora: { status: 'unavailable', reason: 'missing' },
    fantom: { status: 'unavailable', reason: 'missing' },
    ltc: { status: 'unavailable', reason: 'missing' },
    doge: { status: 'unavailable', reason: 'missing' },
  };
}


export function usePrices(
  options?: { sleep?: (ms: number) => Promise<void> },
): { state: PricesState; refresh: () => void } {
  // Round 2, item 6: the price feed is public market data for the native
  // asset, so it loads in devnet mode too — a testnet BTC balance is
  // still priced per BTC, and the rows show that per-unit price. What
  // stays off in devnet is the FIAT VALUATION of test balances: the
  // dashboard hero totals against idle entries, and the asset rows show
  // the per-unit price instead of a fiat value (see dashboard.tsx and
  // asset-rows.tsx). Test tokens are valueless, so no dollar value is
  // ever computed from a devnet balance.
  const [state, setState] = useState<PricesState>(() => {
    let entries: PriceMap;
    try {
      entries = loadCachedPrices(Date.now()) ?? idlePriceEntries();
    } catch {
      entries = idlePriceEntries();
    }
    return {
      status: 'idle',
      entries,
      lastFetchedAtMs: null,
    };
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

    const networkEntries: PriceMap = { ...idlePriceEntries() };
    for (const chain of Object.keys(networkEntries) as Array<keyof PriceMap>) {
      networkEntries[chain] = { status: 'error', reason: 'network' };
    }
    const networkError: PricesState = {
      status: 'ready',
      entries: networkEntries,
      lastFetchedAtMs: null,
    };

    if (typeof globalThis.fetch !== 'function') {
      setState((previous) => ({
        ...networkError,
        entries: mergePreservingFreshEntries(networkEntries, previous.entries),
      }));
      return;
    }

    const wait = resolvePriceWait(sleep);

    inFlight.current = true;
    setState((previous) => ({ ...previous, status: 'loading' }));

    void (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (!mounted.current) return;

          // Lane C: CoinGecko first, then the keyless fallbacks
          // (price-fallbacks.ts) for every chain whose quote is
          // not fresh — a 429, an error, or an expired quote such
          // as Fantom's. A chain no fallback prices keeps its
          // CoinGecko entry, so the retry/backoff below still sees
          // the real all-error state when nothing resolved.
          const cgEntries = await fetchPrices(globalThis.fetch, Date.now());
          if (!mounted.current) return;

          const entries = await applyPriceFallbacks(
            globalThis.fetch,
            cgEntries,
            Date.now(),
          );
          if (!mounted.current) return;

          const values = Object.values(entries);
          const retryDelayMs = priceRetryDelayMs(values, attempt);
          if (retryDelayMs !== null) {
            await wait(retryDelayMs);
            continue;
          }

          setState((previous) => ({
            status: 'ready',
            entries: mergePreservingFreshEntries(entries, previous.entries),
            lastFetchedAtMs: Date.now(),
          }));

          if (values.some((entry) => entry.status === 'fresh')) {
            try {
              saveCachedPrices(entries, Date.now());
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
            entries: mergePreservingFreshEntries(networkEntries, previous.entries),
          }));
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [state.status, sleep]);

  return { state, refresh };
}
