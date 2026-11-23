// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import {
  MAX_QUOTE_AGE_MS,
  PRICE_ASSET_IDS,
  PRICE_CACHE_KEY,
  PRICE_IDS,
  fetchPrices,
  fiatValueForBalance,
  formatUnitPriceUsd,
  isFreshQuote,
  loadCachedPrices,
  parsePriceResponse,
  portfolioTotal,
  quoteFreshnessLabel,
  saveCachedPrices,
  usePrices,
  unitPriceForChain,
  usdPriceToMinorUnitsPerWhole,
} from './prices';
import type { PriceQuote } from './prices';

const NOW_MS = Date.UTC(2026, 10, 19, 19, 15, 0);
const secondsBefore = (ms: number): number => Math.floor((NOW_MS - ms) / 1000);

function freshPayload(ageMs = 30_000): Record<string, { usd: number; last_updated_at: number }> {
  return {
    bitcoin: { usd: 62683, last_updated_at: secondsBefore(ageMs) },
    ethereum: { usd: 1774.93, last_updated_at: secondsBefore(ageMs) },
    tron: { usd: 0.310229, last_updated_at: secondsBefore(ageMs) },
    'the-open-network': { usd: 1.028, last_updated_at: secondsBefore(ageMs) },
    solana: { usd: 150, last_updated_at: secondsBefore(ageMs) },
    binancecoin: { usd: 600, last_updated_at: secondsBefore(ageMs) },
    'polygon-ecosystem-token': { usd: 0.5, last_updated_at: secondsBefore(ageMs) },
    'avalanche-2': { usd: 25, last_updated_at: secondsBefore(ageMs) },
    litecoin: { usd: 80, last_updated_at: secondsBefore(ageMs) },
    dogecoin: { usd: 0.15, last_updated_at: secondsBefore(ageMs) },
    // UI/UX fixes item 14 (2026-11-23): live-verified CoinGecko ids
    // and prices for the nine new chains (probed 2026-11-23).
    xdai: { usd: 0.999932, last_updated_at: secondsBefore(ageMs) },
    celo: { usd: 0.054041, last_updated_at: secondsBefore(ageMs) },
    mantle: { usd: 0.387288, last_updated_at: secondsBefore(ageMs) },
    'metis-token': { usd: 2.18, last_updated_at: secondsBefore(ageMs) },
    fantom: { usd: 0.02543893, last_updated_at: secondsBefore(ageMs) },
  };
}

function quoteAt(ageMs: number): PriceQuote {
  return {
    chain: 'btc',
    assetId: PRICE_ASSET_IDS.btc,
    providerAssetId: 'bitcoin',
    usdPrice: '62683',
    providerUpdatedAtMs: NOW_MS - ageMs,
    fetchedAtMs: NOW_MS,
    source: 'CoinGecko',
  };
}

describe('parsePriceResponse', () => {
  const expectedUsd = {
    btc: '62683',
    eth: '1774.93',
    trx: '0.310229',
    ton: '1.028',
  };

  it('returns fresh quotes with exact prices, identities, and timestamps', () => {
    const prices = parsePriceResponse(freshPayload(), NOW_MS);

    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      expect(prices[chain]).toMatchObject({
        status: 'fresh',
        quote: {
          chain,
          assetId: PRICE_ASSET_IDS[chain],
          providerAssetId: PRICE_IDS[chain],
          usdPrice: expectedUsd[chain],
          providerUpdatedAtMs: secondsBefore(30_000) * 1000,
          fetchedAtMs: NOW_MS,
          source: 'CoinGecko',
        },
      });
    }
  });

  it('retains quotes when provider timestamps have expired', () => {
    const ageMs = 11 * 60 * 1000;
    const prices = parsePriceResponse(freshPayload(ageMs), NOW_MS);

    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      expect(prices[chain]).toMatchObject({
        status: 'expired',
        quote: {
          chain,
          assetId: PRICE_ASSET_IDS[chain],
          providerAssetId: PRICE_IDS[chain],
          usdPrice: expectedUsd[chain],
          providerUpdatedAtMs: secondsBefore(ageMs) * 1000,
          fetchedAtMs: NOW_MS,
          source: 'CoinGecko',
        },
      });
    }
  });

  it('includes the freshness boundary and expires the next second', () => {
    const atLimit = parsePriceResponse(freshPayload(MAX_QUOTE_AGE_MS), NOW_MS);
    const pastLimit = parsePriceResponse(freshPayload(MAX_QUOTE_AGE_MS + 1000), NOW_MS);

    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      expect(atLimit[chain]).toMatchObject({ status: 'fresh' });
      expect(pastLimit[chain]).toMatchObject({ status: 'expired' });
    }
  });

  it('marks a missing coin unavailable without affecting other coins', () => {
    const payload = freshPayload();
    delete payload['the-open-network'];
    const prices = parsePriceResponse(payload, NOW_MS);

    expect(prices.ton).toEqual({ status: 'unavailable', reason: 'missing' });
    for (const chain of ['btc', 'eth', 'trx'] as const) {
      expect(prices[chain]).toMatchObject({ status: 'fresh' });
    }
  });

  it('does not accept toncoin instead of the-open-network', () => {
    const payload = freshPayload();
    delete payload['the-open-network'];
    payload.toncoin = { usd: 1.028, last_updated_at: secondsBefore(30_000) };

    expect(parsePriceResponse(payload, NOW_MS).ton).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });

  it('prices Arbitrum and Optimism as native ETH, not their governance tokens', () => {
    // Regression: PRICE_IDS once mapped arb → `arbitrum` and op →
    // `optimism`, which are the ARB/OP governance-token prices, not the
    // native ETH the wallet holds on those chains. Both must resolve to
    // the ethereum quote.
    const prices = parsePriceResponse(freshPayload(), NOW_MS);

    for (const chain of ['arb', 'op'] as const) {
      expect(prices[chain]).toMatchObject({
        status: 'fresh',
        quote: {
          chain,
          providerAssetId: 'ethereum',
          usdPrice: '1774.93',
        },
      });
    }
  });

  it('prices Polygon as POL, not the stale MATIC listing', () => {
    // Regression: `matic-network` on CoinGecko was last updated
    // 2026-02-03 and would parse as expired forever; the live POL
    // listing is `polygon-ecosystem-token`.
    const prices = parsePriceResponse(freshPayload(), NOW_MS);

    expect(prices.matic).toMatchObject({
      status: 'fresh',
      quote: {
        chain: 'matic',
        providerAssetId: 'polygon-ecosystem-token',
        usdPrice: '0.5',
      },
    });
  });

  it('marks a price without a provider timestamp unavailable', () => {
    const prices = parsePriceResponse(
      { ...freshPayload(), bitcoin: { usd: 62683 } },
      NOW_MS,
    );

    expect(prices.btc).toEqual({
      status: 'unavailable',
      reason: 'missing-timestamp',
    });
  });

  it('rejects zero, negative, string, and missing USD prices', () => {
    for (const entry of [{ usd: 0 }, { usd: -5 }, { usd: '62683' }, {}]) {
      const payload = {
        ...freshPayload(),
        bitcoin: { ...entry, last_updated_at: secondsBefore(30_000) },
      };

      expect(parsePriceResponse(payload, NOW_MS).btc).toEqual({
        status: 'unavailable',
        reason: 'invalid-price',
      });
    }
  });

  it('returns provider errors for malformed top-level payloads', () => {
    for (const payload of [null, [], 'x']) {
      const prices = parsePriceResponse(payload, NOW_MS);

      for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
        expect(prices[chain]).toEqual({ status: 'error', reason: 'provider' });
      }
    }
  });
});

describe('isFreshQuote', () => {
  it('accepts a quote exactly MAX_QUOTE_AGE_MS old', () => {
    expect(isFreshQuote(quoteAt(MAX_QUOTE_AGE_MS), NOW_MS)).toBe(true);
  });

  it('rejects a quote one millisecond beyond MAX_QUOTE_AGE_MS', () => {
    expect(isFreshQuote(quoteAt(MAX_QUOTE_AGE_MS + 1), NOW_MS)).toBe(false);
  });

  it('allows a provider timestamp thirty seconds in the future', () => {
    const quote = {
      ...quoteAt(0),
      providerUpdatedAtMs: NOW_MS + 30_000,
    };

    expect(isFreshQuote(quote, NOW_MS)).toBe(true);
  });

  it('rejects a fetchedAtMs in the future', () => {
    const quote = {
      ...quoteAt(30_000),
      fetchedAtMs: NOW_MS + 1,
    };

    expect(isFreshQuote(quote, NOW_MS)).toBe(false);
  });
});

describe('usdPriceToMinorUnitsPerWhole', () => {
  it('converts the BTC price to minor units', () => {
    expect(usdPriceToMinorUnitsPerWhole('62683')).toBe('6268300');
  });

  it('converts the ETH price exactly', () => {
    expect(usdPriceToMinorUnitsPerWhole('1774.93')).toBe('177493');
  });

  it('rounds the TRX price down to the nearest minor unit', () => {
    expect(usdPriceToMinorUnitsPerWhole('0.310229')).toBe('31');
  });

  it('rounds the TON price up to the nearest minor unit', () => {
    expect(usdPriceToMinorUnitsPerWhole('1.028')).toBe('103');
  });

  it('throws for zero, negative, and invalid input', () => {
    for (const price of ['0', '-1', 'not-a-number']) {
      expect(() => usdPriceToMinorUnitsPerWhole(price)).toThrow();
    }
  });
});


describe('price cache', () => {
  const makeStore = (initialCache?: string) => {
    const data: Record<string, string> =
      initialCache === undefined ? {} : { [PRICE_CACHE_KEY]: initialCache };

    return {
      data,
      getItem(key: string): string | null {
        return data[key] ?? null;
      },
      setItem(key: string, value: string): void {
        data[key] = value;
      },
    };
  };

  const cacheRecord = (ageMs = 30_000) => {
    const quote = quoteAt(ageMs);
    return {
      chain: 'btc',
      usdPrice: quote.usdPrice,
      providerUpdatedAtMs: quote.providerUpdatedAtMs,
      fetchedAtMs: quote.fetchedAtMs,
    };
  };

  const storeWithQuotes = (...quotes: unknown[]) =>
    makeStore(JSON.stringify({ version: 1, quotes }));

  const chains = Object.keys(PRICE_IDS) as Array<keyof typeof PRICE_IDS>;

  it('round-trips fresh quotes with exact prices and ids', () => {
    const entries = parsePriceResponse(freshPayload(), NOW_MS);
    const store = makeStore();

    saveCachedPrices(entries, NOW_MS, store);
    const loaded = loadCachedPrices(NOW_MS, store);

    expect(loaded).toEqual(entries);
    for (const chain of chains) {
      expect(loaded?.[chain]).toMatchObject({
        status: 'fresh',
        quote: {
          assetId: PRICE_ASSET_IDS[chain],
          providerAssetId: PRICE_IDS[chain],
          source: 'CoinGecko',
        },
      });
    }
  });

  it('loads a 20-minute-old cache as expired quotes', () => {
    const entries = parsePriceResponse(freshPayload(), NOW_MS);
    const store = makeStore();

    saveCachedPrices(entries, NOW_MS, store);
    const loaded = loadCachedPrices(NOW_MS + 20 * 60_000, store);

    for (const chain of chains) {
      expect(loaded?.[chain]).toEqual({
        ...entries[chain],
        status: 'expired',
      });
    }
  });

  it.each([
    { name: 'an absent cache', value: undefined },
    { name: 'corrupt JSON', value: '{broken' },
    {
      name: 'a wrong version',
      value: JSON.stringify({ version: 2, quotes: [cacheRecord()] }),
    },
    {
      name: 'an empty cache',
      value: JSON.stringify({ version: 1, quotes: [] }),
    },
    {
      name: 'no usable records',
      value: JSON.stringify({
        version: 1,
        quotes: [{ ...cacheRecord(), usdPrice: '0' }],
      }),
    },
  ])('returns null for $name', ({ value }) => {
    expect(loadCachedPrices(NOW_MS, makeStore(value))).toBeNull();
  });

  it.each([
    { usdPrice: 0 },
    { usdPrice: -1 },
    { usdPrice: 1 },
    { usdPrice: '0' },
    { usdPrice: '-1' },
    { usdPrice: 'not-a-price' },
    { usdPrice: 'Infinity' },
    { usdPrice: '1e309' },
    { providerUpdatedAtMs: 'bad' },
    { fetchedAtMs: 'bad' },
    { chain: undefined },
    { usdPrice: undefined },
    { providerUpdatedAtMs: undefined },
    { fetchedAtMs: undefined },
  ])('drops invalid fields (%j) while keeping a good record', (patch) => {
    const store = storeWithQuotes(
      cacheRecord(),
      { ...cacheRecord(), chain: 'eth', ...patch },
    );
    const loaded = loadCachedPrices(NOW_MS, store);

    expect(loaded?.btc).toEqual({ status: 'fresh', quote: quoteAt(30_000) });
    expect(loaded?.eth).toEqual({ status: 'unavailable', reason: 'missing' });
  });

  it('ignores unknown chains and marks missing chains unavailable', () => {
    const store = storeWithQuotes(
      cacheRecord(),
      { ...cacheRecord(), chain: 'unknown' },
    );
    const loaded = loadCachedPrices(NOW_MS, store);

    expect(loaded?.btc).toEqual({ status: 'fresh', quote: quoteAt(30_000) });
    expect(loaded).not.toHaveProperty('unknown');
    for (const chain of chains.filter((chain) => chain !== 'btc')) {
      expect(loaded?.[chain]).toEqual({ status: 'unavailable', reason: 'missing' });
    }
  });

  it('round-trips an exponent-form price as a usable quote', () => {
    const entries = parsePriceResponse(freshPayload(), NOW_MS);
    const btc = {
      status: 'fresh' as const,
      quote: { ...quoteAt(30_000), usdPrice: '1e-7' },
    };
    const store = makeStore();

    saveCachedPrices({ ...entries, btc }, NOW_MS, store);

    expect(loadCachedPrices(NOW_MS, store)?.btc).toEqual(btc);
  });

  it('leaves the store untouched when there are no fresh quotes', () => {
    const entries = parsePriceResponse(
      freshPayload(MAX_QUOTE_AGE_MS + 60_000),
      NOW_MS,
    );
    const store = makeStore('existing cache');

    saveCachedPrices(entries, NOW_MS, store);

    expect(store.data).toEqual({ [PRICE_CACHE_KEY]: 'existing cache' });
  });

  it.each([
    { ...quoteAt(30_000), usdPrice: '0' },
    { ...quoteAt(30_000), usdPrice: '-1' },
    { ...quoteAt(30_000), usdPrice: 'not-a-price' },
    { ...quoteAt(30_000), usdPrice: '1e309' },
    quoteAt(MAX_QUOTE_AGE_MS + 1),
    quoteAt(-60_001),
    { ...quoteAt(30_000), fetchedAtMs: NOW_MS + 1 },
  ])('does not save invalid or stale quotes labelled fresh (%j)', (quote) => {
    const entries = {
      ...parsePriceResponse({}, NOW_MS),
      btc: { status: 'fresh' as const, quote },
    };
    const store = makeStore('existing cache');

    saveCachedPrices(entries, NOW_MS, store);

    expect(store.data).toEqual({ [PRICE_CACHE_KEY]: 'existing cache' });
  });

  it('never throws when the store throws', () => {
    const store = {
      ...makeStore(),
      getItem(): string | null {
        throw new Error('read blocked');
      },
      setItem(): void {
        throw new Error('write blocked');
      },
    };
    const entries = parsePriceResponse(freshPayload(), NOW_MS);

    expect(() => saveCachedPrices(entries, NOW_MS, store)).not.toThrow();
    expect(() => loadCachedPrices(NOW_MS, store)).not.toThrow();
    expect(loadCachedPrices(NOW_MS, store)).toBeNull();
  });

  it.each([
    { field: 'providerUpdatedAtMs', futureByMs: 60_001 },
    { field: 'fetchedAtMs', futureByMs: 1 },
  ])('loads a quote with future $field as expired', ({ field, futureByMs }) => {
    const store = storeWithQuotes({
      ...cacheRecord(),
      [field]: NOW_MS + futureByMs,
    });

    expect(loadCachedPrices(NOW_MS, store)?.btc).toEqual({
      status: 'expired',
      quote: { ...quoteAt(30_000), [field]: NOW_MS + futureByMs },
    });
  });
});

describe('fetchPrices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches all twenty-two fresh prices in one batch without a demo key', async () => {
    vi.stubEnv('VITE_COINGECKO_DEMO_KEY', '');
    try {
      const calls: Array<{ url: string; init: unknown }> = [];
      const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return {
          ok: true,
          status: 200,
          json: async () => freshPayload(),
          headers: { get: () => null },
        };
      });
      const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

      expect(calls).toHaveLength(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(calls[0]!.url).toBe(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tron,the-open-network,solana,binancecoin,polygon-ecosystem-token,avalanche-2,litecoin,dogecoin,xdai,celo,mantle,metis-token,fantom&vs_currencies=usd&include_last_updated_at=true',
      );
      const headers = (
        calls[0]!.init as { headers: Record<string, string> }
      ).headers;
      expect(headers['Accept']).toBe('application/json');
      expect(headers).not.toHaveProperty('x-cg-demo-api-key');
      expect(Object.values(prices)).toHaveLength(22);
      for (const price of Object.values(prices)) {
        expect(price).toMatchObject({ status: 'fresh' });
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('reads and sends the demo key at call time', async () => {
    vi.stubEnv('VITE_COINGECKO_DEMO_KEY', 'demo-key-123');
    try {
      const fetchFn = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => freshPayload(),
        headers: { get: () => null },
      }));
      await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

      const headers = fetchFn.mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers['x-cg-demo-api-key']).toBe('demo-key-123');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('maps 429 with Retry-After seconds without retrying', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === 'Retry-After' ? '120' : null) },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(22);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        reason: 'rate-limited',
        retryAfterMs: 120_000,
      });
    }
  });

  it('maps 429 without Retry-After to an undefined retry delay', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: () => null },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(22);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        reason: 'rate-limited',
      });
      expect((price as { retryAfterMs?: number }).retryAfterMs).toBeUndefined();
    }
  });

  it('maps HTTP 500 to provider errors', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(22);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        reason: 'provider',
      });
    }
  });

  it('maps a thrown fetch to network errors', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('down');
    });
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(22);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        reason: 'network',
      });
    }
  });

  it('maps an AbortError to timeout errors', async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(22);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        reason: 'timeout',
      });
    }
  });

  it('maps a successful response with invalid JSON to provider errors', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
      headers: { get: () => null },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(22);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        reason: 'provider',
      });
    }
  });
});

describe('fiatValueForBalance', () => {
  const fresh = parsePriceResponse(freshPayload(), NOW_MS);
  const expired = parsePriceResponse(freshPayload(11 * 60 * 1000), NOW_MS);
  const btc = { status: 'available', value: '100000000' } as const;

  it('values 1 BTC using a fresh quote', () => {
    expect(fiatValueForBalance('btc', btc, fresh.btc, NOW_MS)).toMatchObject({
      kind: 'fiat', text: '$62,683.00',
    });
  });

  it('returns zero for a zero balance', () => {
    expect(fiatValueForBalance('btc', { status: 'zero' }, fresh.btc, NOW_MS)).toEqual({ kind: 'zero' });
  });

  it('returns zero for an available balance of 0', () => {
    expect(fiatValueForBalance('btc', { status: 'available', value: '0' }, fresh.btc, NOW_MS))
      .toEqual({ kind: 'zero' });
  });

  it('returns expired for an expired entry', () => {
    expect(fiatValueForBalance('btc', btc, expired.btc, NOW_MS)).toEqual({ kind: 'expired' });
  });

  it('returns unavailable when the coin is absent', () => {
    const payload: Record<string, unknown> = { ...freshPayload() };
    delete payload.bitcoin;
    const entries = parsePriceResponse(payload, NOW_MS);
    expect(fiatValueForBalance('btc', btc, entries.btc, NOW_MS)).toEqual({ kind: 'unavailable' });
  });

  it('preserves a rate-limited error', () => {
    expect(fiatValueForBalance('btc', btc, { status: 'error', reason: 'rate-limited' }, NOW_MS))
      .toEqual({ kind: 'error', reason: 'rate-limited' });
  });

  it('returns balance-unavailable for an error balance', () => {
    expect(fiatValueForBalance('btc', { status: 'error' }, fresh.btc, NOW_MS))
      .toEqual({ kind: 'balance-unavailable' });
  });

  it('returns balance-unavailable when an available balance has no value', () => {
    expect(fiatValueForBalance('btc', { status: 'available' }, fresh.btc, NOW_MS))
      .toEqual({ kind: 'balance-unavailable' });
  });

  it('expires a fresh entry as time advances', () => {
    expect(fresh.btc.status).toBe('fresh');
    expect(fiatValueForBalance('btc', btc, fresh.btc, NOW_MS + 11 * 60 * 1000))
      .toEqual({ kind: 'expired' });
  });
});

describe('formatUnitPriceUsd', () => {
  it('formats whole-dollar prices with two decimals and separators', () => {
    expect(formatUnitPriceUsd('62683')).toBe('$62,683.00');
    expect(formatUnitPriceUsd('1774.93')).toBe('$1,774.93');
    expect(formatUnitPriceUsd('1000000')).toBe('$1,000,000.00');
  });

  it('rounds a price above one dollar half-up to two decimals', () => {
    expect(formatUnitPriceUsd('1.028')).toBe('$1.03');
  });

  it('keeps up to six decimals below one dollar', () => {
    expect(formatUnitPriceUsd('0.310229')).toBe('$0.310229');
    expect(formatUnitPriceUsd('0.073494')).toBe('$0.073494');
  });

  it('keeps at least two decimals when trimming trailing zeros', () => {
    expect(formatUnitPriceUsd('0.5')).toBe('$0.50');
    expect(formatUnitPriceUsd('0.310200')).toBe('$0.3102');
  });

  it('throws for zero, negative, and invalid input', () => {
    for (const price of ['0', '-1', 'not-a-number', '']) {
      expect(() => formatUnitPriceUsd(price)).toThrow();
    }
  });
});

describe('unitPriceForChain', () => {
  const fresh = parsePriceResponse(freshPayload(), NOW_MS);
  const expired = parsePriceResponse(freshPayload(11 * 60 * 1000), NOW_MS);

  it('returns the formatted unit price for a fresh quote', () => {
    expect(unitPriceForChain(fresh.btc, NOW_MS)).toEqual({
      kind: 'fresh', text: '$62,683.00',
    });
    expect(unitPriceForChain(fresh.trx, NOW_MS)).toEqual({
      kind: 'fresh', text: '$0.310229',
    });
  });

  it('returns missing when no price entry was passed', () => {
    expect(unitPriceForChain(undefined, NOW_MS)).toEqual({ kind: 'missing' });
  });

  it('returns expired for an expired entry', () => {
    expect(unitPriceForChain(expired.btc, NOW_MS)).toEqual({ kind: 'expired' });
  });

  it('expires a fresh entry as time advances', () => {
    expect(unitPriceForChain(fresh.btc, NOW_MS + 11 * 60 * 1000)).toEqual({ kind: 'expired' });
  });

  it('returns unavailable when the coin is absent', () => {
    const payload: Record<string, unknown> = { ...freshPayload() };
    delete payload.bitcoin;
    const entries = parsePriceResponse(payload, NOW_MS);
    expect(unitPriceForChain(entries.btc, NOW_MS)).toEqual({ kind: 'unavailable' });
  });

  it('preserves a rate-limited error', () => {
    expect(unitPriceForChain({ status: 'error', reason: 'rate-limited' }, NOW_MS))
      .toEqual({ kind: 'error', reason: 'rate-limited' });
  });
});

describe('portfolioTotal', () => {
  const fresh = parsePriceResponse(freshPayload(), NOW_MS);
  const expired = parsePriceResponse(freshPayload(11 * 60 * 1000), NOW_MS);
  const zero = { status: 'zero' } as const;
  const zeros = { btc: zero, eth: zero, trx: zero, ton: zero, sol: zero, bsc: zero, matic: zero, arb: zero, op: zero, base: zero, avax: zero, gnosis: zero, celo: zero, linea: zero, mantle: zero, scroll: zero, opbnb: zero, metis: zero, aurora: zero, fantom: zero, ltc: zero, doge: zero };
  const btc = { status: 'available', value: '100000000' } as const;
  const eth = { status: 'available', value: '1500000000000000000' } as const;

  it('returns zero when all balances are zero', () => {
    expect(portfolioTotal(zeros, fresh, NOW_MS)).toEqual({
      status: 'zero', text: '$0.00', partial: false,
    });
  });

  it('totals 1 BTC alongside three zero balances', () => {
    expect(portfolioTotal({ ...zeros, btc }, fresh, NOW_MS)).toMatchObject({
      status: 'total', text: '$62,683.00',
    });
  });

  it('excludes expired ETH from the partial subtotal', () => {
    const entries = { ...fresh, eth: expired.eth };
    expect(portfolioTotal({ ...zeros, btc, eth }, entries, NOW_MS)).toEqual({
      status: 'partial', text: '$62,683.00', partial: true,
    });
  });

  it('returns unavailable when all nonzero balances have expired quotes', () => {
    const balances = {
      ...zeros,
      btc, eth,
      trx: { status: 'available', value: '1000000' },
      ton: { status: 'available', value: '1000000000' },
    } as const;
    expect(portfolioTotal(balances, expired, NOW_MS)).toMatchObject({
      status: 'unavailable', text: 'Unavailable',
    });
  });

  it('produces a partial total over an unavailable balance (failed chain counts as 0)', () => {
    // Phase 3, Lane H: the all-or-nothing gate is gone — a failed chain
    // contributes 0 (Safe's aggregateBalance shape) and the total reads
    // Partial instead of blanking.
    const balances = { ...zeros, btc, eth: { status: 'unavailable' } } as const;
    expect(portfolioTotal(balances, fresh, NOW_MS)).toEqual({
      status: 'partial',
      text: '$62,683.00',
      partial: true,
    });
  });

  it('produces a partial total over an error balance', () => {
    const balances = {
      ...zeros,
      btc,
      eth: { status: 'error', reason: 'rpc-error' },
    } as const;
    expect(portfolioTotal(balances, fresh, NOW_MS)).toEqual({
      status: 'partial',
      text: '$62,683.00',
      partial: true,
    });
  });

  it('returns unavailable while any balance is loading', () => {
    const balances = { ...zeros, btc, eth: { status: 'loading' } } as const;
    expect(portfolioTotal(balances, fresh, NOW_MS).status).toBe('unavailable');
  });

  it('returns a partial $0.00 total when every loaded balance is zero and a chain failed', () => {
    // Token gaps, item 7: a fresh wallet whose SOL balance errors (the
    // old 403) and DOGE flakes has every other balance zero — the old
    // code returned 'unavailable' here even though the loaded total is
    // genuinely $0.00. The failed chain is disclosed by partial: true
    // (the dashboard's "some balances are missing" note).
    const balances = { ...zeros, sol: { status: 'error', reason: 'rpc-error' } } as const;
    expect(portfolioTotal(balances, fresh, NOW_MS)).toEqual({
      status: 'partial',
      text: '$0.00',
      partial: true,
    });
  });

  it('returns unavailable when every balance failed and none loaded as zero', () => {
    const failed = Object.fromEntries(
      Object.keys(zeros).map((chain) => [chain, { status: 'unavailable' }]),
    ) as Record<string, { status: 'unavailable' }>;
    expect(portfolioTotal(failed as never, fresh, NOW_MS)).toEqual({
      status: 'unavailable',
      text: 'Unavailable',
      partial: false,
    });
  });

  it('adds priced token values to the hero total', () => {
    // Token gaps, item 7: the hero totals the whole portfolio, natives
    // + tokens. 1 BTC ($62,683.00) + $25.00 of tokens = $62,708.00.
    const tokens = { minorUnits: [2500], partial: false, loadedZero: false, unpricedNonzero: false };
    expect(portfolioTotal({ ...zeros, btc }, fresh, NOW_MS, undefined, tokens)).toEqual({
      status: 'total',
      text: '$62,708.00',
      partial: false,
    });
  });

  it('returns a partial $0.00 total when a token failed and all natives are zero', () => {
    const tokens = { minorUnits: [], partial: true, loadedZero: false, unpricedNonzero: false };
    expect(portfolioTotal(zeros, fresh, NOW_MS, undefined, tokens)).toEqual({
      status: 'partial',
      text: '$0.00',
      partial: true,
    });
  });

  it('returns unavailable when a loaded non-zero token has no fresh price', () => {
    // A known non-zero amount with an unknown price must never read $0.00.
    const tokens = { minorUnits: [], partial: true, loadedZero: false, unpricedNonzero: true };
    expect(portfolioTotal(zeros, fresh, NOW_MS, undefined, tokens)).toEqual({
      status: 'unavailable',
      text: 'Unavailable',
      partial: false,
    });
  });

  it('still returns zero when all natives and tokens loaded as zero', () => {
    const tokens = { minorUnits: [], partial: false, loadedZero: true, unpricedNonzero: false };
    expect(portfolioTotal(zeros, fresh, NOW_MS, undefined, tokens)).toEqual({
      status: 'zero',
      text: '$0.00',
      partial: false,
    });
  });
});

describe('quoteFreshnessLabel', () => {
  function freshQuote() {
    const entry = parsePriceResponse(freshPayload(), NOW_MS).btc;
    expect(entry.status).toBe('fresh');
    if (entry.status !== 'fresh') throw new Error('Expected a fresh BTC quote');
    return entry.quote;
  }

  it('labels a 10-second-old quote as just updated', () => {
    const quote = { ...freshQuote(), providerUpdatedAtMs: NOW_MS - 10_000 };
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe('Updated just now');
  });

  it('labels a two-minute-old quote in minutes', () => {
    const quote = { ...freshQuote(), providerUpdatedAtMs: NOW_MS - 2 * 60 * 1000 };
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe('Updated 2 min ago');
  });

  it('labels a 90-minute-old quote with its provider time', () => {
    const providerUpdatedAtMs = NOW_MS - 90 * 60 * 1000;
    const quote = { ...freshQuote(), providerUpdatedAtMs };
    const time = new Date(providerUpdatedAtMs).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe(`Updated ${time}`);
  });

  it('labels a provider timestamp 30 seconds in the future as just updated', () => {
    const quote = { ...freshQuote(), providerUpdatedAtMs: NOW_MS + 30_000 };
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe('Updated just now');
  });
});

describe('usePrices', () => {
  let originalFetch: typeof globalThis.fetch;
  let latest: ReturnType<typeof usePrices> | null = null;
  function Probe(): null { latest = usePrices(); return null; }

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    latest = null;
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function mount() {
    const div = document.createElement('div');
    document.body.appendChild(div);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(div);
    await act(async () => { root.render(<Probe />); });
    return {
      div, root,
      cleanup: async () => {
        await act(async () => { root.unmount(); });
        div.remove();
      },
    };
  }

  function ProbeWithSleep({
    sleep,
  }: {
    sleep: (ms: number) => Promise<void>;
  }) {
    latest = usePrices({ sleep });
    return null;
  }

  async function mountWithSleep(sleep: (ms: number) => Promise<void>) {
    const { createElement } = await import('react');
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    await act(async () => {
      root.render(createElement(ProbeWithSleep, { sleep }));
    });

    return {
      div,
      root,
      cleanup: async () => {
        await act(async () => {
          root.unmount();
        });
        div.remove();
      },
    };
  }

  it('stays idle on mount and loads fresh prices on refresh', async () => {
    const stub = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => freshPayload(),
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', stub);
    const { cleanup } = await mount();
    try {
      expect(latest!.state).toMatchObject({ status: 'idle', lastFetchedAtMs: null });
      expect(stub).not.toHaveBeenCalled();
      await act(async () => {
        latest?.refresh();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(latest!.state.status).toBe('ready');
      const entries = Object.values(latest!.state.entries);
      expect(entries).toHaveLength(22);
      for (const entry of entries) expect(entry).toMatchObject({ status: 'fresh' });
      expect(Number.isFinite(latest!.state.lastFetchedAtMs)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('reports network errors when fetch throws', async () => {
    const stub = vi.fn(async () => { throw new Error('down'); });
    vi.stubGlobal('fetch', stub);
    const { cleanup } = await mount();
    try {
      await act(async () => {
        latest?.refresh();
        // The hook retries transient failures twice (1000 ms + 2000 ms
        // back-off) before settling on network errors; wait it out.
        await new Promise((resolve) => setTimeout(resolve, 4000));
      });
      expect(latest!.state.status).toBe('ready');
      const entries = Object.values(latest!.state.entries);
      expect(entries).toHaveLength(22);
      for (const entry of entries) expect(entry).toMatchObject({ status: 'error', reason: 'network' });
      expect(stub).toHaveBeenCalledTimes(3);
    } finally {
      await cleanup();
    }
  });

  it('ignores duplicate refresh calls while loading', async () => {
    const stub = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', stub);
    const { cleanup } = await mount();
    try {
      await act(async () => {
        latest?.refresh();
        latest?.refresh();
      });
      expect(stub).toHaveBeenCalledTimes(1);
    } finally {
      await cleanup();
    }
  });

  it('reports network errors when fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    delete (globalThis as Record<string, unknown>).fetch;
    const { cleanup } = await mount();
    try {
      await act(async () => { latest?.refresh(); });
      expect(latest!.state.status).toBe('ready');
      const entries = Object.values(latest!.state.entries);
      expect(entries).toHaveLength(22);
      for (const entry of entries) expect(entry).toMatchObject({ status: 'error', reason: 'network' });
    } finally {
      await cleanup();
    }
  });

  it('seeds fresh entries from cache on mount without fetching', async () => {
    localStorage.removeItem(PRICE_CACHE_KEY);
    let cleanup: (() => void | Promise<void>) | undefined;

    try {
      const cached = parsePriceResponse(freshPayload(), NOW_MS);
      saveCachedPrices(cached, NOW_MS);
      expect(loadCachedPrices(NOW_MS)).toEqual(cached);

      const fetchStub = vi.fn();
      vi.stubGlobal('fetch', fetchStub);

      ({ cleanup } = await mount());

      expect(latest!.state.status).toBe('idle');
      expect(latest!.state.entries).toEqual(cached);
      for (const entry of Object.values(latest!.state.entries)) {
        expect(entry.status).toBe('fresh');
      }
      expect(fetchStub).not.toHaveBeenCalled();
    } finally {
      try {
        await cleanup?.();
      } finally {
        localStorage.removeItem(PRICE_CACHE_KEY);
      }
    }
  });

  it('retries a 429 after Retry-After and settles with fresh entries', async () => {
    localStorage.removeItem(PRICE_CACHE_KEY);
    let cleanup: (() => void | Promise<void>) | undefined;

    try {
      const payload = freshPayload();
      const sleep = vi.fn((_ms: number) => Promise.resolve());
      const fetchStub = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => '30' },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => payload,
        });
      vi.stubGlobal('fetch', fetchStub);

      ({ cleanup } = await mountWithSleep(sleep));

      await act(async () => {
        latest!.refresh();
      });

      expect(latest!.state.status).toBe('ready');
      expect(latest!.state.entries).toEqual(
        parsePriceResponse(payload, NOW_MS),
      );
      expect(fetchStub).toHaveBeenCalledTimes(2);
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([30_000]);
    } finally {
      try {
        await cleanup?.();
      } finally {
        localStorage.removeItem(PRICE_CACHE_KEY);
      }
    }
  });

  it('retries a thrown fetch after 1000 ms and settles with fresh entries', async () => {
    localStorage.removeItem(PRICE_CACHE_KEY);
    let cleanup: (() => void | Promise<void>) | undefined;

    try {
      const payload = freshPayload();
      const sleep = vi.fn((_ms: number) => Promise.resolve());
      const fetchStub = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => payload,
        });
      vi.stubGlobal('fetch', fetchStub);

      ({ cleanup } = await mountWithSleep(sleep));

      await act(async () => {
        latest!.refresh();
      });

      expect(latest!.state.status).toBe('ready');
      expect(latest!.state.entries).toEqual(
        parsePriceResponse(payload, NOW_MS),
      );
      expect(fetchStub).toHaveBeenCalledTimes(2);
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000]);
    } finally {
      try {
        await cleanup?.();
      } finally {
        localStorage.removeItem(PRICE_CACHE_KEY);
      }
    }
  });

  it('stops after three 429 attempts and settles with rate-limited errors', async () => {
    localStorage.removeItem(PRICE_CACHE_KEY);
    let cleanup: (() => void | Promise<void>) | undefined;

    try {
      const sleep = vi.fn((_ms: number) => Promise.resolve());
      const fetchStub = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => '30' },
      });
      vi.stubGlobal('fetch', fetchStub);

      ({ cleanup } = await mountWithSleep(sleep));

      await act(async () => {
        latest!.refresh();
      });

      expect(latest!.state.status).toBe('ready');
      expect(Object.values(latest!.state.entries)).toHaveLength(22);
      for (const entry of Object.values(latest!.state.entries)) {
        expect(entry).toMatchObject({
          status: 'error',
          reason: 'rate-limited',
        });
      }
      expect(fetchStub).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenCalledTimes(2);
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([
        30_000,
        30_000,
      ]);
    } finally {
      try {
        await cleanup?.();
      } finally {
        localStorage.removeItem(PRICE_CACHE_KEY);
      }
    }
  });

  it('accepts a mixed fresh/unavailable result without retrying', async () => {
    localStorage.removeItem(PRICE_CACHE_KEY);
    let cleanup: (() => void | Promise<void>) | undefined;

    try {
      const payload = Object.fromEntries(
        Object.entries(freshPayload()).slice(1),
      );
      const mixed = parsePriceResponse(payload, NOW_MS);
      expect(
        Object.values(mixed).filter((entry) => entry.status === 'fresh'),
      ).toHaveLength(21);
      expect(
        Object.values(mixed).filter(
          (entry) => entry.status === 'unavailable',
        ),
      ).toHaveLength(1);

      const sleep = vi.fn((_ms: number) => Promise.resolve());
      const fetchStub = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      });
      vi.stubGlobal('fetch', fetchStub);

      ({ cleanup } = await mountWithSleep(sleep));

      await act(async () => {
        latest!.refresh();
      });

      expect(latest!.state.status).toBe('ready');
      expect(latest!.state.entries).toEqual(mixed);
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    } finally {
      try {
        await cleanup?.();
      } finally {
        localStorage.removeItem(PRICE_CACHE_KEY);
      }
    }
  });

  it('writes successful refresh results to localStorage', async () => {
    localStorage.removeItem(PRICE_CACHE_KEY);
    let cleanup: (() => void | Promise<void>) | undefined;

    try {
      const payload = freshPayload();
      const expected = parsePriceResponse(payload, NOW_MS);
      const fetchStub = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      });
      vi.stubGlobal('fetch', fetchStub);

      ({ cleanup } = await mount());

      await act(async () => {
        latest!.refresh();
      });

      expect(latest!.state.status).toBe('ready');
      expect(latest!.state.entries).toEqual(expected);
      expect(localStorage.getItem(PRICE_CACHE_KEY)).not.toBeNull();
      expect(loadCachedPrices(NOW_MS)).toEqual(expected);
    } finally {
      try {
        await cleanup?.();
      } finally {
        localStorage.removeItem(PRICE_CACHE_KEY);
      }
    }
  });
});

describe('usePrices devnet (temporary devnet mode)', () => {
  let devnetLatest: ReturnType<typeof usePrices> | null = null;

  function ProbeDevnet(): null {
    devnetLatest = usePrices({ devnet: true });
    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    devnetLatest = null;
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  async function mountDevnet() {
    const div = document.createElement('div');
    document.body.appendChild(div);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(div);
    await act(async () => {
      root.render(<ProbeDevnet />);
    });
    return {
      div,
      root,
      cleanup: async () => {
        await act(async () => {
          root.unmount();
        });
        div.remove();
      },
    };
  }

  it('never loads cached mainnet prices and never fetches in devnet mode', async () => {
    // Seed a fresh mainnet cache: the normal probe would show it.
    saveCachedPrices(parsePriceResponse(freshPayload(), NOW_MS), NOW_MS);
    expect(loadCachedPrices(NOW_MS)).not.toBeNull();
    const stub = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', stub);
    const { cleanup } = await mountDevnet();
    try {
      expect(devnetLatest!.state).toMatchObject({
        status: 'idle',
        lastFetchedAtMs: null,
      });
      for (const entry of Object.values(devnetLatest!.state.entries)) {
        expect(entry).toMatchObject({
          status: 'unavailable',
          reason: 'missing',
        });
      }
      await act(async () => {
        devnetLatest?.refresh();
        await Promise.resolve();
      });
      expect(stub).not.toHaveBeenCalled();
      expect(devnetLatest!.state.status).toBe('idle');
      for (const entry of Object.values(devnetLatest!.state.entries)) {
        expect(entry).toMatchObject({
          status: 'unavailable',
          reason: 'missing',
        });
      }
    } finally {
      await cleanup();
    }
  });
});
