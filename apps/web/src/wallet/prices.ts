/**
 * CoinGecko public API: https://api.coingecko.com/api/v3 (terms 2026-11-20).
 * GET /simple/price?ids=bitcoin,ethereum,tron,the-open-network&vs_currencies=usd&include_last_updated_at=true
 * IDs: btc=bitcoin; eth=ethereum; trx=tron; ton=the-open-network;
 * sol=solana; bsc=binancecoin; matic=matic-network; arb=arbitrum;
 * op=optimism; base=ethereum (Base native asset is ETH);
 * avax=avalanche-2; ltc=litecoin; doge=dogecoin.
 * Keyless: ~5 calls/min/shared IP; back off on 429; not recommended for production.
 * Optional import.meta.env.VITE_COINGECKO_DEMO_KEY -> x-cg-demo-api-key.
 * Demo tier: 10,000 credits/month; 100 calls/min.
 * Paid integration allowed; prominent "Powered by CoinGecko" (font 10+) required.
 * CoinPaprika rejected: Free personal-use only; customer display needs Enterprise.
 * DexPaprika rejected: forbids third-party display; no BTC; ETH/TRX only WETH/WTRX.
 * Live 2026-11-19: 'toncoin' returns {}; correct TON id is 'the-open-network'.
 * Refresh ~60s; MAX_QUOTE_AGE_MS permits at most 10 minutes of quote age.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import type { ChainId } from '../engine/boundary';
import { CHAIN_DECIMALS } from './format';
import { fiatMinorUnits, formatFiatUSD, sumFiatUSD } from './money';
import type { BalanceState } from '../state/wallet-context';

export const PRICE_PROVIDER_NAME = 'CoinGecko';
export const PRICE_PROVIDER_BASE_URL = 'https://api.coingecko.com/api/v3';

export const PRICE_IDS: Record<ChainId, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  trx: 'tron',
  ton: 'the-open-network',
  sol: 'solana',
  bsc: 'binancecoin',
  matic: 'matic-network',
  arb: 'arbitrum',
  op: 'optimism',
  base: 'ethereum',
  avax: 'avalanche-2',
  ltc: 'litecoin',
  doge: 'dogecoin',
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
};

export const MAX_QUOTE_AGE_MS = 10 * 60 * 1000;
export const PRICE_FETCH_TIMEOUT_MS = 10_000;
export const PRICE_ATTRIBUTION_TEXT = 'Powered by CoinGecko';

export type PriceQuote = {
  chain: ChainId;
  assetId: string;
  providerAssetId: string;
  usdPrice: string;
  providerUpdatedAtMs: number;
  fetchedAtMs: number;
  source: 'CoinGecko';
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

export const PRICE_CACHE_KEY = 'bawa:prices-cache:v1';

export type PriceCacheStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function saveCachedPrices(entries: PriceMap, nowMs: number, store?: PriceCacheStore): void {
  try {
    const quotes: Array<
      Pick<PriceQuote, 'chain' | 'usdPrice' | 'providerUpdatedAtMs' | 'fetchedAtMs'>
    > = [];

    for (const chain of Object.keys(PRICE_IDS) as ChainId[]) {
      const entry = entries[chain];
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

      quotes.push({
        chain,
        usdPrice: quote.usdPrice,
        providerUpdatedAtMs: quote.providerUpdatedAtMs,
        fetchedAtMs: quote.fetchedAtMs,
      });
    }

    if (quotes.length === 0) return;

    const cacheStore = store ?? globalThis.localStorage;
    if (!cacheStore) return;

    cacheStore.setItem(PRICE_CACHE_KEY, JSON.stringify({ version: 1, quotes }));
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

      const chainId = chain as ChainId;
      const quote: PriceQuote = {
        chain: chainId,
        assetId: PRICE_ASSET_IDS[chainId],
        providerAssetId: PRICE_IDS[chainId],
        usdPrice,
        providerUpdatedAtMs,
        fetchedAtMs,
        source: 'CoinGecko',
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
  // Guard inspection as well: unusual objects and proxies can throw.
  const isPlainObject = (
    value: unknown,
  ): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    try {
      if (Array.isArray(value)) {
        return false;
      }

      const prototype: unknown = Object.getPrototypeOf(value);
      return prototype === Object.prototype || prototype === null;
    } catch {
      return false;
    }
  };

  // Inherited fields and unreadable getters/properties count as absent.
  const ownValue = (
    object: Record<string, unknown>,
    key: string,
  ): unknown => {
    try {
      return Object.prototype.hasOwnProperty.call(object, key)
        ? object[key]
        : undefined;
    } catch {
      return undefined;
    }
  };

  const root = isPlainObject(payload) ? payload : null;

  const parseChain = (chain: ChainId): PriceEntry => {
    if (root === null) {
      return { status: 'error', reason: 'provider' };
    }

    const entry = ownValue(root, PRICE_IDS[chain]);
    if (!isPlainObject(entry)) {
      return { status: 'unavailable', reason: 'missing' };
    }

    // A timestamp is mandatory, regardless of whether a price is present.
    const updatedAt = ownValue(entry, 'last_updated_at');
    if (
      typeof updatedAt !== 'number' ||
      !Number.isFinite(updatedAt)
    ) {
      return { status: 'unavailable', reason: 'missing-timestamp' };
    }

    const price = ownValue(entry, 'usd');
    if (
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return { status: 'unavailable', reason: 'invalid-price' };
    }

    const quote: PriceQuote = {
      chain,
      assetId: PRICE_ASSET_IDS[chain],
      providerAssetId: PRICE_IDS[chain],
      usdPrice: String(price),
      // CoinGecko timestamps are seconds, not milliseconds.
      providerUpdatedAtMs: updatedAt * 1000,
      fetchedAtMs: nowMs,
      source: 'CoinGecko',
    };

    return isFreshQuote(quote, nowMs)
      ? { status: 'fresh', quote }
      : { status: 'expired', quote };
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
    ltc: parseChain('ltc'),
    doge: parseChain('doge'),
  };
}

export async function fetchPrices(
  fetchFn: typeof fetch,
  nowMs?: number,
): Promise<PriceMap> {
  const chains = ['btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge'] as const;
  const allError = (
    entry: Extract<PriceEntry, { status: 'error' }>,
  ): PriceMap =>
    Object.fromEntries(chains.map((chain) => [chain, { ...entry }])) as PriceMap;
  const isAbortError = (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError';

  const resolvedNowMs = nowMs ?? Date.now();
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Read the key with a direct member access on the cast env object.
  // Verified first-hand (2026-11-20): in this repo's Vitest, the direct form
  // `(import.meta.env as Record).VITE_...` tracks vi.stubEnv and process env,
  // while a cast on `import.meta` itself (or a bracket read) is statically
  // replaced with undefined at transform time. In a production build
  // import.meta.env is the inlined env object, so the same read works there.
  const demoKey: unknown = (import.meta.env as Record<string, unknown>)
    .VITE_COINGECKO_DEMO_KEY;
  if (typeof demoKey === 'string' && demoKey.length > 0) {
    headers['x-cg-demo-api-key'] = demoKey;
  }

  const ids = [...new Set(Object.values(PRICE_IDS))].join(',');
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
      return parsePriceResponse(await response.json(), resolvedNowMs);
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

export function fiatValueForBalance(
  chain: ChainId,
  balance: BalanceState,
  entry: PriceEntry,
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
    CHAIN_DECIMALS[chain],
    usdPriceToMinorUnitsPerWhole(entry.quote.usdPrice),
  );
  return { kind: 'fiat', minorUnits, text: formatFiatUSD(minorUnits) };
}

export function portfolioTotal(
  balances: Record<ChainId, BalanceState>,
  entries: PriceMap,
  nowMs: number,
): {
  status: 'zero' | 'total' | 'partial' | 'unavailable';
  text: string;
  partial: boolean;
} {
  const chains: ChainId[] = ['btc', 'eth', 'trx', 'ton'];
  const list = chains.map((chain) => balances[chain]);
  if (
    list.some(
      ({ status }) =>
        status === 'loading' || status === 'unavailable' || status === 'error',
    )
  ) {
    return { status: 'unavailable', text: 'Unavailable', partial: false };
  }
  if (
    list.every(
      ({ status, value }) =>
        status === 'zero' || (status === 'available' && value === '0'),
    )
  ) {
    return { status: 'zero', text: '$0.00', partial: false };
  }

  const contributed: number[] = [];
  let partial = false;
  for (const chain of chains) {
    const balance = balances[chain];
    if (balance.status === 'zero' || balance.value === '0') {
      continue;
    }
    const entry = entries[chain];
    if (
      balance.value === undefined ||
      entry.status !== 'fresh' ||
      !isFreshQuote(entry.quote, nowMs)
    ) {
      partial = true;
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
  if (contributed.length === 0) {
    return { status: 'unavailable', text: 'Unavailable', partial: false };
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

function idleEntries(): PriceMap {
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
    ltc: { status: 'unavailable', reason: 'missing' },
    doge: { status: 'unavailable', reason: 'missing' },
  };
}

export function usePrices(
  options?: { sleep?: (ms: number) => Promise<void> },
): { state: PricesState; refresh: () => void } {
  const [state, setState] = useState<PricesState>(() => {
    let entries: PriceMap;
    try {
      entries = loadCachedPrices(Date.now()) ?? idleEntries();
    } catch {
      entries = idleEntries();
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

    const networkEntries: PriceMap = { ...idleEntries() };
    for (const chain of Object.keys(networkEntries) as Array<keyof PriceMap>) {
      networkEntries[chain] = { status: 'error', reason: 'network' };
    }
    const networkError: PricesState = {
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

          const entries = await fetchPrices(globalThis.fetch, Date.now());
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
              (entry) =>
                entry.status === 'error' && entry.reason === 'rate-limited',
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

          setState({
            status: 'ready',
            entries,
            lastFetchedAtMs: Date.now(),
          });

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
          setState(networkError);
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [state.status, sleep]);

  return { state, refresh };
}
