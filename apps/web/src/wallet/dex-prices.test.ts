// Fallback token prices for tokens CoinGecko does not list (README
// showcase + Add Token, item D): DexScreener for EVM/SPL/TRC-20 tokens,
// TonAPI rates for TON Jettons. Every number comes from the live
// provider response — a token no source prices stays "unavailable".
import { describe, expect, it, vi } from 'vitest';
import {
  DEXSCREENER_CHAIN_FOR_CHAIN,
  fetchDexScreenerPrices,
  fetchTonJettonPrices,
  parseDexScreenerResponse,
  parseTonRatesResponse,
} from './dex-prices';
import { tokenKey } from './tokens';

const NOW_MS = Date.UTC(2026, 10, 23, 10, 0, 0);

const ANTS = '0x74346aE29A2823DA37695d35A6d47cC4F57C06b4';
const ANTS_KEY = tokenKey('bsc', ANTS);

// Live shape, DexScreener tokens/v1, 2026-11-23: one pair, ANTS as the
// base token, priceUsd $0.07673, liquidity $337,847.70.
function antsPair(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chainId: 'bsc',
    dexId: 'pancakeswap',
    pairAddress: '0xPair00000000000000000000000000000000000001',
    baseToken: { address: ANTS, name: '蚂蚁', symbol: 'ANTS' },
    quoteToken: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      name: 'Tether USD',
      symbol: 'USDT',
    },
    priceNative: '0.0767',
    priceUsd: '0.07673',
    liquidity: { usd: 337847.7, base: 4400000, quote: 337847 },
    ...overrides,
  };
}

describe('DEXSCREENER_CHAIN_FOR_CHAIN', () => {
  it('covers the EVM majors, Solana and TRON — and leaves out Gnosis and Aurora', () => {
    // Gnosis and Aurora are NOT indexed by DexScreener (verified live
    // 2026-11-23): dexscreener.com/gnosis and /aurora are 404 and
    // tokens/v1 returns [] for known tokens there (WXDAI/GNO/USDC).
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.eth).toBe('ethereum');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.bsc).toBe('bsc');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.matic).toBe('polygon');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.arb).toBe('arbitrum');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.op).toBe('optimism');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.base).toBe('base');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.avax).toBe('avalanche');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.sol).toBe('solana');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.trx).toBe('tron');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.celo).toBe('celo');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.linea).toBe('linea');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.scroll).toBe('scroll');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.mantle).toBe('mantle');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.metis).toBe('metis');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.opbnb).toBe('opbnb');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.fantom).toBe('fantom');
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.gnosis).toBeUndefined();
    expect(DEXSCREENER_CHAIN_FOR_CHAIN.aurora).toBeUndefined();
  });
});

describe('parseDexScreenerResponse', () => {
  const requests = [{ key: ANTS_KEY, chain: 'bsc' as const, contract: ANTS }];

  it('returns a fresh DexScreener quote for a listed-by-pair token', () => {
    const entries = parseDexScreenerResponse([antsPair()], requests, NOW_MS);
    expect(entries[ANTS_KEY]).toEqual({
      status: 'fresh',
      quote: {
        chain: 'bsc',
        assetId: ANTS,
        providerAssetId: ANTS,
        usdPrice: '0.07673',
        providerUpdatedAtMs: NOW_MS,
        fetchedAtMs: NOW_MS,
        source: 'DexScreener',
      },
    });
  });

  it('accepts a numeric priceUsd as well as a string one', () => {
    const entries = parseDexScreenerResponse(
      [antsPair({ priceUsd: 0.07673 })],
      requests,
      NOW_MS,
    );
    expect(entries[ANTS_KEY]).toMatchObject({
      status: 'fresh',
      quote: { usdPrice: '0.07673', source: 'DexScreener' },
    });
  });

  it('never prices a token with its pair partner price (the TRON USDT trap)', () => {
    // Verified live 2026-11-23: tokens/v1/tron/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
    // returns a BTC-base pair priced $61,571.71 — priceUsd is the BASE
    // token's price, so a pair where the queried token is only the quote
    // must not price it.
    const usdtKey = tokenKey('trx', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    const entries = parseDexScreenerResponse(
      [
        {
          chainId: 'tron',
          baseToken: {
            address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
            name: 'Bitcoin',
            symbol: 'BTC',
          },
          quoteToken: {
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            name: 'Tether USD',
            symbol: 'USDT',
          },
          priceUsd: '61571.71',
          liquidity: { usd: 2101370.85 },
        },
      ],
      [{ key: usdtKey, chain: 'trx', contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' }],
      NOW_MS,
    );
    expect(entries[usdtKey]).toEqual({ status: 'unavailable', reason: 'missing' });
  });

  it('picks the highest-liquidity pair when several match', () => {
    const entries = parseDexScreenerResponse(
      [
        antsPair({ pairAddress: '0xThin0000000000000000000000000000000000001', priceUsd: '0.05', liquidity: { usd: 100 } }),
        antsPair({ pairAddress: '0xDeep0000000000000000000000000000000000002', priceUsd: '0.07673', liquidity: { usd: 337847.7 } }),
      ],
      requests,
      NOW_MS,
    );
    expect(entries[ANTS_KEY]).toMatchObject({
      status: 'fresh',
      quote: { usdPrice: '0.07673' },
    });
  });

  it('marks a token unavailable when no pair, no price, or a bad price comes back', () => {
    expect(parseDexScreenerResponse([], requests, NOW_MS)[ANTS_KEY]).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
    expect(
      parseDexScreenerResponse([antsPair({ priceUsd: '0' })], requests, NOW_MS)[ANTS_KEY],
    ).toEqual({ status: 'unavailable', reason: 'missing' });
    expect(
      parseDexScreenerResponse([antsPair({ priceUsd: 'not-a-price' })], requests, NOW_MS)[ANTS_KEY],
    ).toEqual({ status: 'unavailable', reason: 'missing' });
    expect(
      parseDexScreenerResponse([antsPair({ priceUsd: undefined })], requests, NOW_MS)[ANTS_KEY],
    ).toEqual({ status: 'unavailable', reason: 'missing' });
    expect(parseDexScreenerResponse(null, requests, NOW_MS)[ANTS_KEY]).toEqual({
      status: 'error',
      reason: 'provider',
    });
  });

  it('ignores pairs on the wrong chain', () => {
    const entries = parseDexScreenerResponse(
      [antsPair({ chainId: 'ethereum' })],
      requests,
      NOW_MS,
    );
    expect(entries[ANTS_KEY]).toEqual({ status: 'unavailable', reason: 'missing' });
  });
});

describe('fetchDexScreenerPrices', () => {
  it('batches two BSC tokens into one comma-separated call', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => [antsPair()],
        headers: { get: () => null },
      };
    });
    const other = '0x1111111111111111111111111111111111111111';
    const entries = await fetchDexScreenerPrices(
      fetchFn as unknown as typeof fetch,
      [
        { key: ANTS_KEY, chain: 'bsc', contract: ANTS },
        { key: tokenKey('bsc', other), chain: 'bsc', contract: other },
      ],
      NOW_MS,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(
      `https://api.dexscreener.com/tokens/v1/bsc/${ANTS},${other}`,
    );
    expect(entries[ANTS_KEY]?.status).toBe('fresh');
    expect(entries[tokenKey('bsc', other)]).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });

  it('returns rate-limited errors on HTTP 429 and provider errors on HTTP 500', async () => {
    const rateLimited = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
      headers: { get: (name: string) => (name === 'Retry-After' ? '10' : null) },
    }));
    const entries429 = await fetchDexScreenerPrices(
      rateLimited as unknown as typeof fetch,
      [{ key: ANTS_KEY, chain: 'bsc', contract: ANTS }],
      NOW_MS,
    );
    expect(entries429[ANTS_KEY]).toEqual({
      status: 'error',
      reason: 'rate-limited',
      retryAfterMs: 10000,
    });
    const failing = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      headers: { get: () => null },
    }));
    const entries500 = await fetchDexScreenerPrices(
      failing as unknown as typeof fetch,
      [{ key: ANTS_KEY, chain: 'bsc', contract: ANTS }],
      NOW_MS,
    );
    expect(entries500[ANTS_KEY]).toEqual({ status: 'error', reason: 'provider' });
    const throwing = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const entriesNetwork = await fetchDexScreenerPrices(
      throwing as unknown as typeof fetch,
      [{ key: ANTS_KEY, chain: 'bsc', contract: ANTS }],
      NOW_MS,
    );
    expect(entriesNetwork[ANTS_KEY]).toEqual({ status: 'error', reason: 'network' });
  });
});

describe('parseTonRatesResponse', () => {
  const NOT_MASTER = 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT';
  const requests = [{ key: tokenKey('ton', NOT_MASTER), contract: NOT_MASTER }];

  it('returns a fresh TonAPI quote for a rated Jetton', () => {
    // Live shape, TonAPI /v2/rates, 2026-11-23 (USDT Jetton: USD 0.9989).
    const entries = parseTonRatesResponse(
      {
        rates: {
          [NOT_MASTER]: {
            prices: { USD: 0.0234 },
            diff_24h: { USD: '+1.00%' },
          },
        },
      },
      requests,
      NOW_MS,
    );
    expect(entries[tokenKey('ton', NOT_MASTER)]).toEqual({
      status: 'fresh',
      quote: {
        chain: 'ton',
        assetId: NOT_MASTER,
        providerAssetId: NOT_MASTER,
        usdPrice: '0.0234',
        providerUpdatedAtMs: NOW_MS,
        fetchedAtMs: NOW_MS,
        source: 'TonAPI',
      },
    });
  });

  it('marks a Jetton unavailable when TonAPI has no rate for it', () => {
    const entries = parseTonRatesResponse({ rates: {} }, requests, NOW_MS);
    expect(entries[tokenKey('ton', NOT_MASTER)]).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
    const bad = parseTonRatesResponse(
      { rates: { [NOT_MASTER]: { prices: { USD: 0 } } } },
      requests,
      NOW_MS,
    );
    expect(bad[tokenKey('ton', NOT_MASTER)]).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });
});

describe('fetchTonJettonPrices', () => {
  it('calls the TonAPI rates endpoint with the Jetton masters', async () => {
    const calls: string[] = [];
    const master = 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT';
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ rates: { [master]: { prices: { USD: 0.0234 } } } }),
        headers: { get: () => null },
      };
    });
    const entries = await fetchTonJettonPrices(
      fetchFn as unknown as typeof fetch,
      [{ key: tokenKey('ton', master), contract: master }],
      NOW_MS,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(
      `https://tonapi.io/v2/rates?tokens=${master}&currencies=usd`,
    );
    expect(entries[tokenKey('ton', master)]?.status).toBe('fresh');
  });
});
