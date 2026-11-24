// Remote ticker/name search (token gaps, item 2): resolve a ticker or
// name through CoinGecko /search + /coins/{id}, keeping only platforms
// this wallet supports. A query that resolves to nothing reports
// not-found honestly — never invents a token. Pattern: Uniswap
// token-list identity (chainId + address) + Trust Wallet assets
// (a reviewed listing is the verification — here the CoinGecko
// listing for that exact chain + contract).
import { describe, expect, it, vi } from 'vitest';
import { searchTokensByNameOrTicker } from './token-search';

function searchFetch(handlers: {
  search?: unknown;
  coins?: Record<string, unknown>;
  throwOn?: string;
}): typeof fetch {
  return vi.fn(async (url: string) => {
    if (handlers.throwOn !== undefined && url.includes(handlers.throwOn)) {
      throw new Error('Network error: coingecko unreachable');
    }
    if (url.includes('/api/v3/search?')) {
      return {
        ok: true,
        status: 200,
        json: async () => handlers.search,
        headers: { get: (_name: string): string | null => null },
      };
    }
    const coinMatch = url.match(/\/api\/v3\/coins\/([^?]+)/);
    if (coinMatch !== null) {
      const detail = handlers.coins?.[coinMatch[1]!];
      if (detail === undefined) throw new Error(`unexpected coin ${coinMatch[1]}`);
      return {
        ok: true,
        status: 200,
        json: async () => detail,
        headers: { get: (_name: string): string | null => null },
      };
    }
    throw new Error(`unexpected url ${url}`);
  }) as unknown as typeof fetch;
}

const USDC_DETAIL = {
  id: 'usd-coin',
  name: 'USD Coin',
  symbol: 'usdc',
  detail_platforms: {
    ethereum: {
      decimal_place: 6,
      contract_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    base: {
      decimal_place: 6,
      contract_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
  },
};

describe('searchTokensByNameOrTicker', () => {
  it('resolves a ticker to its chains with contracts and decimals', async () => {
    const fetchFn = searchFetch({
      search: { coins: [{ id: 'usd-coin', name: 'USD Coin', symbol: 'USDC' }] },
      coins: { 'usd-coin': USDC_DETAIL },
    });
    const result = await searchTokensByNameOrTicker('usdc', fetchFn);
    expect(result).toEqual({
      status: 'found',
      candidates: [
        {
          chain: 'eth',
          contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          coingeckoId: 'usd-coin',
          verified: true,
        },
        {
          chain: 'base',
          contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          coingeckoId: 'usd-coin',
          verified: true,
        },
      ],
    });
  });

  it('ranks an exact symbol match ahead of a partial one', async () => {
    const fetchFn = searchFetch({
      search: {
        coins: [
          { id: 'usd-coin-wormhole', name: 'USD Coin (Wormhole)', symbol: 'USDC' },
          { id: 'usd-coin', name: 'USD Coin', symbol: 'USDC' },
          { id: 'usd-coin-x', name: 'USDC Extra', symbol: 'USDCX' },
        ],
      },
      coins: {
        'usd-coin-wormhole': {
          id: 'usd-coin-wormhole',
          name: 'USD Coin (Wormhole)',
          symbol: 'usdc',
          detail_platforms: {
            solana: { decimal_place: 6, contract_address: '5p2v...' },
          },
        },
        'usd-coin': USDC_DETAIL,
        'usd-coin-x': {
          id: 'usd-coin-x',
          name: 'USDC Extra',
          symbol: 'usdcx',
          detail_platforms: {
            ethereum: {
              decimal_place: 6,
              contract_address: '0x0000000000000000000000000000000000000001',
            },
          },
        },
      },
    });
    const result = await searchTokensByNameOrTicker('usdc', fetchFn);
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      // UI/UX fixes, item 13: Solana is now a supported platform, so
      // the Wormhole USDC (solana) is a legitimate candidate — and it
      // is an exact symbol match too, so it keeps its search order
      // ahead of the partial-symbol hit. Exact before partial still
      // holds: the USDCX hit ranks last.
      expect(result.candidates).toHaveLength(4);
      expect(result.candidates.slice(0, 3).map((c) => c.symbol)).toEqual([
        'USDC',
        'USDC',
        'USDC',
      ]);
      expect(result.candidates[3]?.coingeckoId).toBe('usd-coin-x');
      expect(
        result.candidates.some(
          (candidate) =>
            candidate.coingeckoId === 'usd-coin-wormhole' &&
            candidate.chain === 'sol',
        ),
      ).toBe(true);
    }
  });

  it('reports not-found when CoinGecko has no coin for the query', async () => {
    const fetchFn = searchFetch({ search: { coins: [] } });
    expect(await searchTokensByNameOrTicker('NOTATOKEN', fetchFn)).toEqual({
      status: 'not-found',
    });
  });

  it('reports not-found for a blank query without fetching', async () => {
    const fetchFn = searchFetch({ search: { coins: [] } });
    expect(await searchTokensByNameOrTicker('   ', fetchFn)).toEqual({
      status: 'not-found',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports an error when the search request fails', async () => {
    const fetchFn = searchFetch({
      search: { coins: [] },
      throwOn: '/api/v3/search?',
    });
    const result = await searchTokensByNameOrTicker('usdc', fetchFn);
    expect(result.status).toBe('error');
  });

  it('skips a platform whose decimals are unknown rather than inventing them', async () => {
    const fetchFn = searchFetch({
      search: { coins: [{ id: 'usd-coin', name: 'USD Coin', symbol: 'USDC' }] },
      coins: {
        'usd-coin': {
          ...USDC_DETAIL,
          detail_platforms: {
            ethereum: { contract_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
          },
        },
      },
    });
    expect(await searchTokensByNameOrTicker('usdc', fetchFn)).toEqual({
      status: 'not-found',
    });
  });

  it('fetches details for at most the first three search hits', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/api/v3/search?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            coins: [
              { id: 'c1', name: 'Coin 1', symbol: 'C1' },
              { id: 'c2', name: 'Coin 2', symbol: 'C2' },
              { id: 'c3', name: 'Coin 3', symbol: 'C3' },
              { id: 'c4', name: 'Coin 4', symbol: 'C4' },
              { id: 'c5', name: 'Coin 5', symbol: 'C5' },
            ],
          }),
          headers: { get: (_name: string): string | null => null },
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'x', name: 'X', symbol: 'x', detail_platforms: {} }),
        headers: { get: (_name: string): string | null => null },
      };
    }) as unknown as typeof fetch;
    await searchTokensByNameOrTicker('coin', fetchFn);
    const detailCalls = calls.filter((url) => url.includes('/api/v3/coins/'));
    expect(detailCalls).toHaveLength(3);
  });

  // Lane 1: the owner's "sushi" case. CoinGecko's /search puts the
  // exact-symbol coin second (after sushicat); the exact match's
  // details are fetched first, so its chains resolve even when the
  // other hits are rate-limited — and every candidate is verified,
  // because its contract came from CoinGecko itself.
  it('resolves sushi to its chains, exact match first, all verified', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/api/v3/search?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            coins: [
              { id: 'sushicat', name: 'sushicat', symbol: 'SUSHICAT' },
              { id: 'sushi', name: 'Sushi', symbol: 'SUSHI' },
              { id: 'sushi-cat', name: 'Sushi Cat', symbol: 'SUSHICAT' },
            ],
          }),
          headers: { get: (_name: string): string | null => null },
        };
      }
      if (url.includes('/api/v3/coins/sushi?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'sushi',
            name: 'Sushi',
            symbol: 'sushi',
            detail_platforms: {
              // Real contracts, read live from CoinGecko 2026-11-24.
              ethereum: {
                decimal_place: 18,
                contract_address: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
              },
              fantom: {
                decimal_place: 18,
                contract_address: '0xae75a438b2e0cb8bb01ec1e1e376de11d44477cc',
              },
              base: {
                decimal_place: 18,
                contract_address: '0x7d49a065d17d6d4a55dc13649901fdbb98b2afba',
              },
            },
          }),
          headers: { get: (_name: string): string | null => null },
        };
      }
      return {
        ok: false,
        status: 429,
        json: async () => ({}),
        headers: { get: (_name: string): string | null => null },
      };
    }) as unknown as typeof fetch;
    const result = await searchTokensByNameOrTicker('sushi', fetchFn);
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates.map((c) => c.chain)).toEqual([
        'eth',
        'fantom',
        'base',
      ]);
      expect(result.candidates.every((c) => c.verified)).toBe(true);
      expect(result.candidates.every((c) => c.symbol === 'SUSHI')).toBe(true);
      expect(result.candidates.every((c) => c.coingeckoId === 'sushi')).toBe(true);
    }
    // The exact-symbol coin's details were fetched before the others.
    const detailCalls = calls.filter((url) => url.includes('/api/v3/coins/'));
    expect(detailCalls[0]).toContain('/api/v3/coins/sushi?');
  });

  // Lane 1: a genuinely ambiguous symbol — two different coins share
  // it — shows both matches for the user to pick, never silently
  // picks one.
  it('shows every match when several coins share a symbol', async () => {
    const fetchFn = searchFetch({
      search: {
        coins: [
          { id: 'foo-coin', name: 'Foo Coin', symbol: 'FOO' },
          { id: 'foo-token', name: 'Foo Token', symbol: 'FOO' },
        ],
      },
      coins: {
        'foo-coin': {
          id: 'foo-coin',
          name: 'Foo Coin',
          symbol: 'foo',
          detail_platforms: {
            ethereum: {
              decimal_place: 18,
              contract_address: '0x00000000000000000000000000000000000000F0',
            },
          },
        },
        'foo-token': {
          id: 'foo-token',
          name: 'Foo Token',
          symbol: 'foo',
          detail_platforms: {
            'binance-smart-chain': {
              decimal_place: 18,
              contract_address: '0x00000000000000000000000000000000000000F1',
            },
          },
        },
      },
    });
    const result = await searchTokensByNameOrTicker('foo', fetchFn);
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.name)).toEqual([
        'Foo Coin',
        'Foo Token',
      ]);
      expect(result.candidates.map((c) => c.chain)).toEqual(['eth', 'bsc']);
    }
  });

  // Lane 1: the search found coins but every detail fetch was
  // rate-limited — that is an error, never a false "no token found".
  it('reports an error, not not-found, when every detail fetch is rate-limited', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('/api/v3/search?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            coins: [{ id: 'sushi', name: 'Sushi', symbol: 'SUSHI' }],
          }),
          headers: { get: (_name: string): string | null => null },
        };
      }
      return {
        ok: false,
        status: 429,
        json: async () => ({}),
        headers: { get: (_name: string): string | null => null },
      };
    }) as unknown as typeof fetch;
    const result = await searchTokensByNameOrTicker('sushi', fetchFn);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('rate-limiting');
    }
  });

  it('reports an error, not not-found, when every detail fetch fails', async () => {
    const fetchFn = searchFetch({
      search: { coins: [{ id: 'sushi', name: 'Sushi', symbol: 'SUSHI' }] },
      throwOn: '/api/v3/coins/',
    });
    const result = await searchTokensByNameOrTicker('sushi', fetchFn);
    expect(result.status).toBe('error');
  });

  // Lane 1: a partial rate limit still yields the coin that did load.
  it('still returns the loaded coin when another detail fetch is rate-limited', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('/api/v3/search?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            coins: [
              { id: 'sushi', name: 'Sushi', symbol: 'SUSHI' },
              { id: 'sushicat', name: 'sushicat', symbol: 'SUSHICAT' },
            ],
          }),
          headers: { get: (_name: string): string | null => null },
        };
      }
      if (url.includes('/api/v3/coins/sushi?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'sushi',
            name: 'Sushi',
            symbol: 'sushi',
            detail_platforms: {
              ethereum: {
                decimal_place: 18,
                contract_address: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
              },
            },
          }),
          headers: { get: (_name: string): string | null => null },
        };
      }
      return {
        ok: false,
        status: 429,
        json: async () => ({}),
        headers: { get: (_name: string): string | null => null },
      };
    }) as unknown as typeof fetch;
    const result = await searchTokensByNameOrTicker('sushi', fetchFn);
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]?.chain).toBe('eth');
      expect(result.candidates[0]?.verified).toBe(true);
    }
  });
});
