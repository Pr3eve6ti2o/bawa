import { afterEach, describe, expect, it, vi } from 'vitest';
import { BawaError, WalletErrorCodes, walletErrorCodeOf } from '../errors';
import {
  assertNetworkId,
  assertTonWalletVersion,
  BROADCAST_DISABLED_MESSAGE,
  DEFAULT_TON_WALLET_VERSION,
  fetchJson,
  httpFetchTransport,
  TON_WALLET_VERSIONS,
  type AdapterResult,
  type AdapterBalance,
  type ChainAdapter,
  type TonWalletVersion,
  type TxInput,
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


describe('httpFetchTransport', () => {
  it('returns parsed JSON and forwards the init through to fetch', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ a: 1 }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const init = { method: 'POST', body: '{}' };
    await expect(
      httpFetchTransport.request('https://example.invalid/x', init),
    ).resolves.toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // fetchJson forwards the init fields and adds its own abort signal.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.invalid/x',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('throws HTTP <status> on non-2xx, exactly once (no retry)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      httpFetchTransport.request('https://example.invalid/x'),
    ).rejects.toThrow('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('TON wallet versions (item 4)', () => {
  it('defaults to v4r2 and lists exactly the three supported versions', () => {
    expect(DEFAULT_TON_WALLET_VERSION).toBe('v4r2');
    expect([...TON_WALLET_VERSIONS]).toEqual(['v3r2', 'v4r2', 'v5r1']);
  });

  it('accepts each supported version', () => {
    for (const version of TON_WALLET_VERSIONS) {
      expect(assertTonWalletVersion(version)).toBe(version);
    }
  });

  it('rejects an unknown version as a validation error (code 3002)', () => {
    let thrown: unknown;
    try {
      assertTonWalletVersion('v9' as unknown as TonWalletVersion);
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BawaError);
    expect(walletErrorCodeOf(thrown)).toBe(WalletErrorCodes.INVALID_INPUT);
  });

  it('a seqno TxInput carries the wallet version (item 4)', () => {
    const input: TxInput = { kind: 'seqno', seqno: 0, walletVersion: 'v4r2' };
    expect(input).toEqual({ kind: 'seqno', seqno: 0, walletVersion: 'v4r2' });
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
