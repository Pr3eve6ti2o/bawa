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
        },
        {
          chain: 'base',
          contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          coingeckoId: 'usd-coin',
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
      },
    });
    const result = await searchTokensByNameOrTicker('usdc', fetchFn);
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      // The Wormhole listing has no supported platform, so only the
      // exact USDC candidates remain.
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0]?.coingeckoId).toBe('usd-coin');
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
});
