// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { PRICE_IDS } from './prices';
import { TOKEN_PRICE_CACHE_KEY, useTokenPrices } from './token-prices';
import {
  TOKEN_PRICE_IDS,
  fetchTokenPrices,
  fiatValueForTokenBalance,
  loadCachedTokenPrices,
  parseTokenPriceResponse,
  saveCachedTokenPrices,
  tokenPriceEntries,
  tokenPriceRequests,
  type TokenPriceEntry,
  type TokenPriceRequest,
} from './token-prices';
import { DEFAULT_TOKENS, tokenKey } from './tokens';

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);
const secondsBefore = (ms: number): number => Math.floor((NOW_MS - ms) / 1000);

const TOKEN_KEYS = DEFAULT_TOKENS.map((t) => tokenKey(t.chain, t.contract));

function freshTokenPayload(ageMs = 30_000): Record<string, { usd: number; last_updated_at: number }> {
  return {
    'usd-coin': { usd: 0.999462, last_updated_at: secondsBefore(ageMs) },
    tether: { usd: 0.998894, last_updated_at: secondsBefore(ageMs) },
    dai: { usd: 1.0, last_updated_at: secondsBefore(ageMs) },
    chainlink: { usd: 8.79, last_updated_at: secondsBefore(ageMs) },
    uniswap: { usd: 4.69, last_updated_at: secondsBefore(ageMs) },
    'wrapped-bitcoin': { usd: 60950, last_updated_at: secondsBefore(ageMs) },
    // UI/UX fixes, item 18: the five new CoinGecko ids the 13 extra
    // defaults add (the other eight reuse the six above).
    weth: { usd: 1704.9, last_updated_at: secondsBefore(ageMs) },
    usdt0: { usd: 0.999, last_updated_at: secondsBefore(ageMs) },
    'bridged-usdt': { usd: 0.999, last_updated_at: secondsBefore(ageMs) },
    'l2-standard-bridged-usdt-base': { usd: 0.999, last_updated_at: secondsBefore(ageMs) },
    'binance-bridged-usdt-bnb-smart-chain': { usd: 0.999, last_updated_at: secondsBefore(ageMs) },
  };
}

function tokenIds(): TokenPriceRequest[] {
  return DEFAULT_TOKENS.map((t) => ({
    kind: 'coingecko',
    key: tokenKey(t.chain, t.contract),
    coingeckoId: t.coingeckoId ?? '',
  }));
}

describe('native price-id trap (regression)', () => {
  it('prices native ETH on Arbitrum from the ethereum id, not the ARB governance token', () => {
    expect(PRICE_IDS.arb).toBe('ethereum');
    expect(PRICE_IDS.arb).not.toBe('arbitrum');
  });

  it('prices native ETH on OP Mainnet from the ethereum id, not the OP governance token', () => {
    expect(PRICE_IDS.op).toBe('ethereum');
    expect(PRICE_IDS.op).not.toBe('optimism');
  });

  it('prices native ETH on Base from the ethereum id', () => {
    expect(PRICE_IDS.base).toBe('ethereum');
  });

  it('prices POL from the live polygon-ecosystem-token id, not the stale matic-network listing', () => {
    // matic-network last updated 2026-02-03 (verified live 2026-11-22):
    // its quote would parse as expired forever. polygon-ecosystem-token
    // is the live POL listing (last updated 2026-11-22).
    expect(PRICE_IDS.matic).toBe('polygon-ecosystem-token');
    expect(PRICE_IDS.matic).not.toBe('matic-network');
  });

  it('keeps every other native id unchanged', () => {
    expect(PRICE_IDS.btc).toBe('bitcoin');
    expect(PRICE_IDS.eth).toBe('ethereum');
    expect(PRICE_IDS.trx).toBe('tron');
    expect(PRICE_IDS.ton).toBe('the-open-network');
    expect(PRICE_IDS.sol).toBe('solana');
    expect(PRICE_IDS.bsc).toBe('binancecoin');
    expect(PRICE_IDS.avax).toBe('avalanche-2');
    expect(PRICE_IDS.ltc).toBe('litecoin');
    expect(PRICE_IDS.doge).toBe('dogecoin');
  });
});

describe('TOKEN_PRICE_IDS', () => {
  it('covers exactly the 21 default tokens', () => {
    expect(Object.keys(TOKEN_PRICE_IDS).sort()).toEqual([...TOKEN_KEYS].sort());
    expect(TOKEN_PRICE_IDS['eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']).toBe('usd-coin');
    expect(TOKEN_PRICE_IDS['trx:tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t']).toBe('tether');
  });

  it('shares one CoinGecko id for the two USDT deployments', () => {
    expect(TOKEN_PRICE_IDS['eth:0xdac17f958d2ee523a2206206994597c13d831ec7']).toBe(
      TOKEN_PRICE_IDS['trx:tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t'],
    );
  });
});

describe('parseTokenPriceResponse', () => {
  it('returns fresh quotes for all 21 default tokens', () => {
    const entries = parseTokenPriceResponse(freshTokenPayload(), tokenIds(), NOW_MS);
    for (const key of TOKEN_KEYS) {
      expect(entries[key]?.status).toBe('fresh');
    }
    expect(entries['eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']).toMatchObject({
      status: 'fresh',
      quote: { usdPrice: '0.999462', providerAssetId: 'usd-coin', source: 'CoinGecko' },
    });
  });

  it('marks a missing token unavailable without affecting the others', () => {
    const payload = freshTokenPayload();
    delete payload['dai'];
    const entries = parseTokenPriceResponse(payload, tokenIds(), NOW_MS);
    expect(entries['eth:0x6b175474e89094c44da98b954eedeac495271d0f']).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
    expect(entries['eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']?.status).toBe('fresh');
  });

  it('marks a non-object payload as a provider error for every token', () => {
    const entries = parseTokenPriceResponse(null, tokenIds(), NOW_MS);
    for (const key of TOKEN_KEYS) {
      expect(entries[key]).toEqual({ status: 'error', reason: 'provider' });
    }
  });

  it('marks a missing timestamp as missing-timestamp', () => {
    const payload = freshTokenPayload();
    const usdc = payload['usd-coin']!;
    payload['usd-coin'] = { usd: usdc.usd, last_updated_at: NaN };
    const entries = parseTokenPriceResponse(payload, tokenIds(), NOW_MS);
    expect(entries['eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']).toEqual({
      status: 'unavailable',
      reason: 'missing-timestamp',
    });
  });
});

describe('fetchTokenPrices', () => {
  it('makes one batched call carrying all eleven token ids', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => freshTokenPayload(),
        headers: { get: () => null },
      };
    });
    const entries = await fetchTokenPrices(
      fetchFn as unknown as typeof fetch,
      tokenIds(),
      NOW_MS,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,dai,chainlink,uniswap,wrapped-bitcoin,weth,usdt0,bridged-usdt,l2-standard-bridged-usdt-base,binance-bridged-usdt-bnb-smart-chain&vs_currencies=usd&include_last_updated_at=true&include_24hr_change=true',
    );
    for (const key of TOKEN_KEYS) {
      expect(entries[key]?.status).toBe('fresh');
    }
  });

  it('returns rate-limited errors for every token on HTTP 429', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
      headers: { get: (name: string) => (name === 'Retry-After' ? '5' : null) },
    }));
    const entries = await fetchTokenPrices(
      fetchFn as unknown as typeof fetch,
      tokenIds(),
      NOW_MS,
    );
    for (const key of TOKEN_KEYS) {
      expect(entries[key]).toEqual({
        status: 'error',
        reason: 'rate-limited',
        retryAfterMs: 5000,
      });
    }
  });

  it('returns provider errors on HTTP 500 and network errors on a throw', async () => {
    const failing = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      headers: { get: () => null },
    }));
    const entries500 = await fetchTokenPrices(
      failing as unknown as typeof fetch,
      tokenIds(),
      NOW_MS,
    );
    for (const key of TOKEN_KEYS) {
      expect(entries500[key]).toEqual({ status: 'error', reason: 'provider' });
    }
    const throwing = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const entriesNetwork = await fetchTokenPrices(
      throwing as unknown as typeof fetch,
      tokenIds(),
      NOW_MS,
    );
    for (const key of TOKEN_KEYS) {
      expect(entriesNetwork[key]).toEqual({ status: 'error', reason: 'network' });
    }
  });
});

describe('tokenPriceEntries', () => {
  it('builds idle entries for the requested tokens', () => {
    const entries = tokenPriceEntries(TOKEN_KEYS);
    for (const key of TOKEN_KEYS) {
      expect(entries[key]).toEqual({ status: 'unavailable', reason: 'missing' });
    }
  });
});

describe('fiatValueForTokenBalance', () => {
  const fresh = parseTokenPriceResponse(freshTokenPayload(), tokenIds(), NOW_MS);
  const usdcEntry = fresh['eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'] as TokenPriceEntry;

  it('returns zero for a zero balance', () => {
    expect(
      fiatValueForTokenBalance({ status: 'zero', value: '0' }, 6, usdcEntry, NOW_MS),
    ).toEqual({ kind: 'zero' });
  });

  it('returns a fiat total for an available balance with a fresh price', () => {
    // 2.5 USDC at $0.999462 = $2.50 (rounded to cents).
    const result = fiatValueForTokenBalance(
      { status: 'available', value: '2500000' },
      6,
      usdcEntry,
      NOW_MS,
    );
    expect(result).toEqual({ kind: 'fiat', minorUnits: 250, text: '$2.50' });
  });

  it('returns balance-unavailable when the balance is unavailable', () => {
    expect(
      fiatValueForTokenBalance({ status: 'unavailable', reason: 'no-adapter' }, 6, usdcEntry, NOW_MS),
    ).toEqual({ kind: 'balance-unavailable' });
  });

  it('returns unavailable when the price entry is missing', () => {
    expect(
      fiatValueForTokenBalance({ status: 'available', value: '2500000' }, 6, undefined, NOW_MS),
    ).toEqual({ kind: 'unavailable' });
  });
});

describe('tokenPriceRequests (unlisted-token fallback, item D)', () => {
  const ANTS = '0x74346aE29A2823DA37695d35A6d47cC4F57C06b4';
  const NOT_MASTER = 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT';

  it('sends a CoinGecko-listed token to CoinGecko', () => {
    const requests = tokenPriceRequests([DEFAULT_TOKENS[0]!]);
    expect(requests).toEqual([
      {
        kind: 'coingecko',
        key: tokenKey('eth', DEFAULT_TOKENS[0]!.contract),
        coingeckoId: 'usd-coin',
      },
    ]);
  });

  it('sends an unlisted BSC token to DexScreener, not CoinGecko', () => {
    const requests = tokenPriceRequests([
      {
        chain: 'bsc',
        contract: ANTS,
        name: '蚂蚁',
        symbol: 'ANTS',
        decimals: 18,
        coingeckoId: null,
        addedAtMs: 1,
      },
    ]);
    expect(requests).toEqual([
      { kind: 'dexscreener', key: tokenKey('bsc', ANTS), chain: 'bsc', contract: ANTS },
    ]);
  });

  it('sends an unlisted TON Jetton to TonAPI', () => {
    const requests = tokenPriceRequests([
      {
        chain: 'ton',
        contract: NOT_MASTER,
        name: 'Notcoin',
        symbol: 'NOT',
        decimals: 9,
        coingeckoId: null,
        addedAtMs: 1,
      },
    ]);
    expect(requests).toEqual([
      { kind: 'tonapi', key: tokenKey('ton', NOT_MASTER), contract: NOT_MASTER },
    ]);
  });

  it('sends an unlisted Gnosis token nowhere — DexScreener does not index Gnosis', () => {
    const requests = tokenPriceRequests([
      {
        chain: 'gnosis',
        contract: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
        name: 'Wrapped XDAI',
        symbol: 'WXDAI',
        decimals: 18,
        coingeckoId: null,
        addedAtMs: 1,
      },
    ]);
    expect(requests).toEqual([]);
  });
});

describe('fetchTokenPrices with the fallback', () => {
  const ANTS = '0x74346aE29A2823DA37695d35A6d47cC4F57C06b4';
  const antsKey = tokenKey('bsc', ANTS);

  function routeFetch(calls: string[]) {
    return vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('api.coingecko.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => freshTokenPayload(),
          headers: { get: (_name: string): string | null => null },
        };
      }
      if (url.includes('api.dexscreener.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              chainId: 'bsc',
              baseToken: { address: ANTS, name: '蚂蚁', symbol: 'ANTS' },
              quoteToken: {
                address: '0x55d398326f99059fF775485246999027B3197955',
                name: 'Tether USD',
                symbol: 'USDT',
              },
              priceUsd: '0.07673',
              liquidity: { usd: 337847.7 },
            },
          ],
          headers: { get: (_name: string): string | null => null },
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  it('prices a listed token from CoinGecko and an unlisted one from DexScreener', async () => {
    const calls: string[] = [];
    const fetchFn = routeFetch(calls);
    const requests: TokenPriceRequest[] = [
      ...tokenIds(),
      { kind: 'dexscreener', key: antsKey, chain: 'bsc', contract: ANTS },
    ];
    const entries = await fetchTokenPrices(
      fetchFn as unknown as typeof fetch,
      requests,
      NOW_MS,
      DEFAULT_TOKENS,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('api.coingecko.com');
    expect(calls[1]).toContain('api.dexscreener.com/tokens/v1/bsc/');
    for (const key of TOKEN_KEYS) {
      expect(entries[key]?.status).toBe('fresh');
      expect(entries[key]).toMatchObject({ quote: { source: 'CoinGecko' } });
    }
    expect(entries[antsKey]).toMatchObject({
      status: 'fresh',
      quote: { usdPrice: '0.07673', source: 'DexScreener' },
    });
  });

  it('falls back to DexScreener / TonAPI for LISTED tokens when CoinGecko 429s', async () => {
    // Lane B: before this, a blocked CoinGecko took down all 21
    // default token prices while the natives fell back. A listed
    // token whose CoinGecko quote is not fresh is priced from the
    // same legs the unlisted tokens use.
    const usdc = tokenKey('eth', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    const link = tokenKey('eth', '0x514910771AF9Ca656af840dff83E8264EcF986CA');
    const tonUsdt = tokenKey('ton', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('api.coingecko.com')) {
        return {
          ok: false,
          status: 429,
          json: async () => ({}),
          headers: { get: (name: string) => (name === 'Retry-After' ? '5' : null) },
        };
      }
      if (url.includes('api.dexscreener.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              chainId: 'ethereum',
              baseToken: {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                name: 'USD Coin',
                symbol: 'USDC',
              },
              quoteToken: {
                address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                name: 'Tether USD',
                symbol: 'USDT',
              },
              priceUsd: '0.9995',
              liquidity: { usd: 123456789 },
            },
            {
              chainId: 'ethereum',
              baseToken: {
                address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
                name: 'ChainLink Token',
                symbol: 'LINK',
              },
              quoteToken: {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                name: 'Wrapped Ether',
                symbol: 'WETH',
              },
              priceUsd: '8.81',
              liquidity: { usd: 98765432 },
            },
          ],
          headers: { get: (_name: string): string | null => null },
        };
      }
      if (url.includes('tonapi.io')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            rates: {
              EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs: {
                prices: { USD: 0.999 },
              },
            },
          }),
          headers: { get: (_name: string): string | null => null },
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const requests = tokenIds().filter((r) =>
      [usdc, link, tonUsdt].includes(r.key),
    );
    const entries = await fetchTokenPrices(
      fetchFn as unknown as typeof fetch,
      requests,
      NOW_MS,
      DEFAULT_TOKENS,
    );
    expect(entries[usdc]).toMatchObject({
      status: 'fresh',
      quote: { usdPrice: '0.9995', source: 'DexScreener' },
    });
    expect(entries[link]).toMatchObject({
      status: 'fresh',
      quote: { usdPrice: '8.81', source: 'DexScreener' },
    });
    expect(entries[tonUsdt]).toMatchObject({
      status: 'fresh',
      quote: { usdPrice: '0.999', source: 'TonAPI' },
    });
  });

  it('a CoinGecko 429 does not take down the DexScreener price', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('api.coingecko.com')) {
        return {
          ok: false,
          status: 429,
          json: async () => ({}),
          headers: { get: (name: string) => (name === 'Retry-After' ? '5' : null) },
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            chainId: 'bsc',
            baseToken: { address: ANTS, name: '蚂蚁', symbol: 'ANTS' },
            quoteToken: {
              address: '0x55d398326f99059fF775485246999027B3197955',
              name: 'Tether USD',
              symbol: 'USDT',
            },
            priceUsd: '0.07673',
            liquidity: { usd: 337847.7 },
          },
        ],
        headers: { get: () => null },
      };
    });
    const entries = await fetchTokenPrices(
      fetchFn as unknown as typeof fetch,
      [
        ...tokenIds(),
        { kind: 'dexscreener', key: antsKey, chain: 'bsc', contract: ANTS },
      ],
      NOW_MS,
      DEFAULT_TOKENS,
    );
    expect(entries[antsKey]?.status).toBe('fresh');
    expect(entries[TOKEN_KEYS[0]!]).toEqual({
      status: 'error',
      reason: 'rate-limited',
      retryAfterMs: 5000,
    });
  });
});

describe('token price cache', () => {
  function makeStore(initial = ''): { getItem: () => string | null; setItem: (key: string, v: string) => void; value: string } {
    let value = initial;
    return {
      get value() {
        return value;
      },
      getItem: () => (value === '' ? null : value),
      setItem: (_key: string, v: string) => {
        value = v;
      },
    };
  }

  it('round-trips fresh token quotes', () => {
    const entries = parseTokenPriceResponse(freshTokenPayload(), tokenIds(), NOW_MS, DEFAULT_TOKENS);
    const store = makeStore();
    saveCachedTokenPrices(entries, NOW_MS, DEFAULT_TOKENS, store as never);
    const loaded = loadCachedTokenPrices(NOW_MS, TOKEN_KEYS, store as never);
    expect(loaded).toEqual(entries);
  });

  it('round-trips the 24h change with the token quote', () => {
    // P0-A: the stale fallback survives a reload — the movement rides
    // with the cached token quote, as with native quotes.
    const entries = parseTokenPriceResponse(
      {
        ...freshTokenPayload(),
        'usd-coin': {
          usd: 0.999462,
          last_updated_at: secondsBefore(30_000),
          usd_24h_change: 0.12,
        },
      },
      tokenIds(),
      NOW_MS,
      DEFAULT_TOKENS,
    );
    const store = makeStore();
    saveCachedTokenPrices(entries, NOW_MS, DEFAULT_TOKENS, store as never);
    const loaded = loadCachedTokenPrices(NOW_MS, TOKEN_KEYS, store as never);
    const usdcKey = tokenKey('eth', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(loaded?.[usdcKey]).toMatchObject({
      status: 'fresh',
      quote: { change24hPct: 0.12 },
    });
  });

  it('round-trips a DexScreener quote with its source intact', () => {
    const antsKey = tokenKey('bsc', '0x74346aE29A2823DA37695d35A6d47cC4F57C06b4');
    const entries = {
      [antsKey]: {
        status: 'fresh' as const,
        quote: {
          chain: 'bsc' as const,
          assetId: '0x74346aE29A2823DA37695d35A6d47cC4F57C06b4',
          providerAssetId: '0x74346aE29A2823DA37695d35A6d47cC4F57C06b4',
          usdPrice: '0.07673',
          providerUpdatedAtMs: NOW_MS,
          fetchedAtMs: NOW_MS,
          source: 'DexScreener' as const,
        },
      },
    };
    const store = makeStore();
    saveCachedTokenPrices(entries, NOW_MS, [], store as never);
    const loaded = loadCachedTokenPrices(NOW_MS, [antsKey], store as never);
    expect(loaded).toEqual(entries);
  });

  it('returns null for an empty store', () => {
    expect(loadCachedTokenPrices(NOW_MS, TOKEN_KEYS, makeStore() as never)).toBeNull();
  });
});

describe('useTokenPrices', () => {
  let originalFetch: typeof globalThis.fetch;
  let latest: ReturnType<typeof useTokenPrices> | null = null;

  function ProbeWithSleep({
    sleep,
  }: {
    sleep: (ms: number) => Promise<void>;
  }) {
    latest = useTokenPrices(DEFAULT_TOKENS, { sleep });
    return null;
  }

  async function mountWithSleep(sleep: (ms: number) => Promise<void>) {
    const { createElement } = await import('react');
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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

  it('keeps the last good token quotes when a refresh ends rate-limited', async () => {
    // Item 11/12, token feed: same blanking bug as the native feed — a
    // 429 after a good load wiped every token price to "Price error".
    localStorage.removeItem(TOKEN_PRICE_CACHE_KEY);
    let cleanup: (() => void | Promise<void>) | undefined;

    try {
      const payload = freshTokenPayload();
      const expected = parseTokenPriceResponse(payload, tokenIds(), NOW_MS, DEFAULT_TOKENS);
      const sleep = vi.fn((_ms: number) => Promise.resolve());
      // Lane B: the hook now also fires the DexScreener / TonAPI
      // fallback legs on every retry attempt (same shape as the
      // native feed), so the total call count is no longer 4 — count
      // the CoinGecko calls instead, mirroring the native hook test.
      // The fallback legs answer empty here, so no fresh fallback
      // quote replaces the last good CoinGecko quotes.
      let coinGeckoCallCount = 0;
      const fetchStub = vi.fn(async (url: string) => {
        if (!url.includes('api.coingecko.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => [],
            headers: { get: (_name: string): string | null => null },
          };
        }
        coinGeckoCallCount += 1;
        if (coinGeckoCallCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => payload,
            headers: { get: () => null },
          };
        }
        return {
          ok: false,
          status: 429,
          headers: { get: () => '30' },
        };
      });
      vi.stubGlobal('fetch', fetchStub);

      ({ cleanup } = await mountWithSleep(sleep));

      await act(async () => {
        latest!.refresh();
      });
      expect(latest!.state.status).toBe('ready');
      expect(latest!.state.entries).toEqual(expected);

      await act(async () => {
        latest!.refresh();
      });
      expect(latest!.state.status).toBe('ready');
      expect(latest!.state.entries).toEqual(expected);
      expect(coinGeckoCallCount).toBe(4);
    } finally {
      try {
        await cleanup?.();
      } finally {
        localStorage.removeItem(TOKEN_PRICE_CACHE_KEY);
      }
    }
  });
});
