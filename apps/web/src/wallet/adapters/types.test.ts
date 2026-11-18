import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChainId } from '../../engine/boundary';
import {
  assertNetworkId,
  BROADCAST_DISABLED_MESSAGE,
  fetchJson,
  toBalanceProvider,
  type AdapterResult,
  type AdapterBalance,
  type ChainAdapter,
} from './types';
import { registerAdapter, getAdapter, registeredChains } from './index';

const okBalance = (valueBaseUnits: string): AdapterResult<AdapterBalance> => ({
  status: 'ok',
  data: {
    chain: 'eth',
    address: '0x0000000000000000000000000000000000000000',
    networkId: 'eip155:1',
    valueBaseUnits,
    decimals: 18,
    source: 'test',
    fetchedAt: 0,
  },
  source: 'test',
  fetchedAt: 0,
});

function stubAdapter(
  balance: AdapterResult<AdapterBalance> = okBalance('42'),
): ChainAdapter {
  return {
    chain: 'eth',
    networkId: 'eip155:1',
    getBalance: async () => balance,
    getHistory: async () => ({ status: 'ok', data: [], source: 'test', fetchedAt: 0 }),
    estimateFee: async () => ({
      status: 'ok',
      data: {
        chain: 'eth',
        networkId: 'eip155:1',
        feeBaseUnits: '21000',
        unit: 'wei',
        note: 'stub',
        source: 'test',
        fetchedAt: 0,
      },
      source: 'test',
      fetchedAt: 0,
    }),
    getTxInputs: async () => ({
      status: 'ok',
      data: { kind: 'nonce', nonce: 0 },
      source: 'test',
      fetchedAt: 0,
    }),
    broadcast: async () => {
      throw new Error(BROADCAST_DISABLED_MESSAGE);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchJson', () => {
  it('returns parsed JSON on 2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ a: 1 }) })),
    );
    await expect(fetchJson('https://example.invalid/x')).resolves.toEqual({ a: 1 });
  });

  it('throws HTTP <status> on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    await expect(fetchJson('https://example.invalid/x')).rejects.toThrow('HTTP 503');
  });

  it('throws Invalid response on bad JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('not json');
        },
      })),
    );
    await expect(fetchJson('https://example.invalid/x')).rejects.toThrow(
      'Invalid response',
    );
  });

  it('times out and calls fetch exactly once (no retry)', async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJson('https://example.invalid/x', undefined, 5)).rejects.toThrow(
      'Network error: request timed out',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws Network error on a rejected fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    await expect(fetchJson('https://example.invalid/x')).rejects.toThrow(
      'Network error: boom',
    );
  });
});

describe('assertNetworkId', () => {
  it('passes on a match', () => {
    expect(() => assertNetworkId('eip155:1', 'eip155:1', 'test')).not.toThrow();
  });

  it('throws naming expected vs actual on mismatch', () => {
    expect(() => assertNetworkId('eip155:11155111', 'eip155:1', 'test')).toThrow(
      /expected eip155:1, got eip155:11155111/,
    );
  });
});

describe('broadcast disabled', () => {
  it('throws the disabled message and never sends', async () => {
    await expect(stubAdapter().broadcast({})).rejects.toThrow(
      BROADCAST_DISABLED_MESSAGE,
    );
  });
});

describe('toBalanceProvider', () => {
  it('returns {value} on ok', async () => {
    const provider = toBalanceProvider(stubAdapter(okBalance('123')));
    await expect(provider.getBalance('eth' as ChainId, '0x0')).resolves.toEqual({
      value: '123',
    });
  });

  it('throws the adapter reason on unavailable/error', async () => {
    const provider = toBalanceProvider(
      stubAdapter({ status: 'unavailable', reason: 'no-adapter' }),
    );
    await expect(provider.getBalance('eth' as ChainId, '0x0')).rejects.toThrow(
      'no-adapter',
    );
  });
});

describe('adapter registry', () => {
  it('register/get/registeredChains round-trip', () => {
    registerAdapter(stubAdapter());
    expect(getAdapter('eth')).toBeDefined();
    expect(getAdapter('eth')?.networkId).toBe('eip155:1');
    expect(registeredChains()).toContain('eth');
    expect(getAdapter('btc')).toBeUndefined();
  });
});
