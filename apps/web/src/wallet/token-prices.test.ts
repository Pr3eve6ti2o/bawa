import { describe, expect, it, vi } from 'vitest';
import { PRICE_IDS } from './prices';
import {
  TOKEN_PRICE_IDS,
  fetchTokenPrices,
  fiatValueForTokenBalance,
  loadCachedTokenPrices,
  parseTokenPriceResponse,
  saveCachedTokenPrices,
  tokenPriceEntries,
  type TokenPriceEntry,
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
  };
}

function tokenIds(): Array<{ key: string; coingeckoId: string }> {
  return DEFAULT_TOKENS.map((t) => ({
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
  it('covers exactly the 7 default tokens', () => {
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
  it('returns fresh quotes for all 7 default tokens', () => {
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
  it('makes one batched call carrying all six token ids', async () => {
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
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,dai,chainlink,uniswap,wrapped-bitcoin&vs_currencies=usd&include_last_updated_at=true',
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

  it('returns null for an empty store', () => {
    expect(loadCachedTokenPrices(NOW_MS, TOKEN_KEYS, makeStore() as never)).toBeNull();
  });
});
