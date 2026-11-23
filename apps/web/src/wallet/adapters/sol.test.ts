import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSolanaAdapter } from './sol';
import { BROADCAST_DISABLED_MESSAGE, type FetchTransport } from './types';

// System program address: valid base58, holds 1 lamport on mainnet.
const ADDRESS = '11111111111111111111111111111111';

function solTransport(handlers: {
  getBalance?: unknown;
  getHealth?: unknown;
  getSignaturesForAddress?: unknown;
  getTransaction?: Record<string, unknown>;
}): FetchTransport {
  return {
    request: vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string;
        params?: unknown[];
      };
      if (body.method === 'getBalance') {
        if (handlers.getBalance instanceof Error) throw handlers.getBalance;
        return handlers.getBalance;
      }
      if (body.method === 'getHealth') {
        if (handlers.getHealth instanceof Error) throw handlers.getHealth;
        return handlers.getHealth;
      }
      if (body.method === 'getSignaturesForAddress') {
        if (handlers.getSignaturesForAddress instanceof Error) {
          throw handlers.getSignaturesForAddress;
        }
        return handlers.getSignaturesForAddress;
      }
      if (body.method === 'getTransaction') {
        const signature = String(body.params?.[0] ?? '');
        const response = handlers.getTransaction?.[signature];
        if (response instanceof Error) throw response;
        if (response === undefined) {
          throw new Error(`unexpected getTransaction ${signature}`);
        }
        return response;
      }
      throw new Error(`unexpected method ${body.method ?? ''}`);
    }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('solana adapter — balance', () => {
  it('returns the exact lamport string with decimals 9', async () => {
    const transport = solTransport({
      getHealth: { jsonrpc: '2.0', id: 2, result: 'ok' },
      getBalance: { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value: 123456789 } },
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('123456789');
      expect(result.data.decimals).toBe(9);
      expect(result.data.networkId).toBe('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
      expect(result.data.chain).toBe('sol');
    }
  });

  it('reports an exact zero, not an error', async () => {
    const transport = solTransport({
      getHealth: { jsonrpc: '2.0', id: 2, result: 'ok' },
      getBalance: { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value: 0 } },
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createSolanaAdapter({ transport: solTransport({}) });
    const result = await adapter.getBalance('not-an-address!!');
    expect(result.status).toBe('error');
  });

  it('errors when getHealth does not return ok', async () => {
    const transport = solTransport({
      getHealth: { jsonrpc: '2.0', id: 2, result: 'behind' },
      getBalance: { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value: 1 } },
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('getHealth');
    }
  });

  it('errors when the RPC returns an error object', async () => {
    const transport = solTransport({
      getHealth: { jsonrpc: '2.0', id: 2, result: 'ok' },
      getBalance: { jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'Invalid param' } },
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Invalid param');
    }
  });

  it('checks getHealth once per adapter instance', async () => {
    const transport = solTransport({
      getHealth: { jsonrpc: '2.0', id: 2, result: 'ok' },
      getBalance: { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value: 5 } },
    });
    const adapter = createSolanaAdapter({ transport });
    await adapter.getBalance(ADDRESS);
    await adapter.getBalance(ADDRESS);
    const calls = (transport.request as ReturnType<typeof vi.fn>).mock.calls;
    const healthCalls = calls.filter((call) =>
      String(call[1]?.body ?? '').includes('getHealth'),
    );
    expect(healthCalls).toHaveLength(1);
  });

  it('posts to solana-rpc.publicnode.com by default (token gaps, item 1)', async () => {
    // api.mainnet-beta.solana.com 403s browser requests ("Access
    // forbidden", re-confirmed 2026-11-22); Lane 1 (token gaps) probed
    // solana-rpc.publicnode.com in-page: 200, getBalance 2368210
    // lamports for 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM.
    const transport = solTransport({
      getHealth: { jsonrpc: '2.0', id: 2, result: 'ok' },
      getBalance: { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value: 5 } },
    });
    const adapter = createSolanaAdapter({ transport });
    await adapter.getBalance(ADDRESS);
    const calls = (transport.request as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call[0]).toBe('https://solana-rpc.publicnode.com');
    }
  });

  it('falls back to the Vibe Station RPC when publicnode throws', async () => {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      if (url === 'https://solana-rpc.publicnode.com') {
        throw new Error('Network error: publicnode unreachable');
      }
      if (url === 'https://public.rpc.solanavibestation.com') {
        if (body.method === 'getHealth') return { jsonrpc: '2.0', id: 2, result: 'ok' };
        if (body.method === 'getBalance') {
          return { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value: 2368210 } };
        }
      }
      throw new Error(`unexpected url ${url}`);
    });
    const adapter = createSolanaAdapter({ transport: { request } });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2368210');
      expect(result.data.source).toBe('solana-vibe-station');
    }
  });

  it('falls back to the Vibe Station RPC when publicnode returns an error object', async () => {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      if (url === 'https://solana-rpc.publicnode.com') {
        return { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Access forbidden' } };
      }
      if (url === 'https://public.rpc.solanavibestation.com') {
        if (body.method === 'getHealth') return { jsonrpc: '2.0', id: 2, result: 'ok' };
        if (body.method === 'getBalance') {
          return { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value: 7 } };
        }
      }
      throw new Error(`unexpected url ${url}`);
    });
    const adapter = createSolanaAdapter({ transport: { request } });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('7');
  });

  it('errors when both Solana RPCs fail', async () => {
    const request = vi.fn(async () => {
      throw new Error('Network error: all Solana RPCs unreachable');
    });
    const adapter = createSolanaAdapter({ transport: { request } });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
  });
});

describe('solana adapter — unbuilt operations', () => {
  it('reports fee-quote and tx inputs unavailable, never faked', async () => {
    const adapter = createSolanaAdapter({ transport: solTransport({}) });
    expect((await adapter.estimateFee()).status).toBe('unavailable');
    expect((await adapter.getTxInputs(ADDRESS)).status).toBe('unavailable');
  });

  it('always throws the broadcast-disabled message', async () => {
    const adapter = createSolanaAdapter({ transport: solTransport({}) });
    await expect(adapter.broadcast({})).rejects.toThrow(BROADCAST_DISABLED_MESSAGE);
  });
});

describe('solana adapter — history', () => {
  // Lane C, item 16: history via JSON-RPC getSignaturesForAddress +
  // getTransaction (jsonParsed). Direction and amount come from the
  // address's pre/post balance delta in the transaction's meta.
  const HEALTH = { jsonrpc: '2.0', id: 2, result: 'ok' };
  const SIG_IN = 'sig-in-1111111111111111111111111111111111111111111111111111111111';
  const SIG_OUT = 'sig-out-2222222222222222222222222222222222222222222222222222222222';
  const SIG_FAIL = 'sig-fail-3333333333333333333333333333333333333333333333333333333333';

  function txFixture(pre: number, post: number, err: unknown = null) {
    return {
      jsonrpc: '2.0',
      id: 1,
      result: {
        blockTime: 1795392000,
        meta: { err, fee: 5000, preBalances: [5000000, pre], postBalances: [4995000, post] },
        transaction: {
          message: {
            accountKeys: [{ pubkey: 'Other111111111111111111111111111111111111' }, { pubkey: ADDRESS }],
          },
        },
      },
    };
  }

  it('reads direction and amount from the balance delta, newest first', async () => {
    const transport = solTransport({
      getHealth: HEALTH,
      getSignaturesForAddress: {
        jsonrpc: '2.0',
        id: 1,
        result: [
          { signature: SIG_IN, slot: 100, blockTime: 1795392000, confirmationStatus: 'finalized', err: null },
          { signature: SIG_OUT, slot: 99, blockTime: 1795391000, confirmationStatus: 'finalized', err: null },
        ],
      },
      getTransaction: {
        [SIG_IN]: txFixture(1000000, 1500000),
        [SIG_OUT]: txFixture(1500000, 1000000),
      },
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        hash: SIG_IN,
        chain: 'sol',
        direction: 'in',
        amountBaseUnits: '500000',
        timestamp: 1795392000 * 1000,
        status: 'confirmed',
        explorerUrl: `https://explorer.solana.com/tx/${SIG_IN}`,
      });
      expect(result.data[1]).toMatchObject({
        hash: SIG_OUT,
        direction: 'out',
        amountBaseUnits: '500000',
      });
    }
  });

  it('marks a failed transaction failed', async () => {
    const transport = solTransport({
      getHealth: HEALTH,
      getSignaturesForAddress: {
        jsonrpc: '2.0',
        id: 1,
        result: [
          { signature: SIG_IN, slot: 100, blockTime: 1795392000, confirmationStatus: 'finalized', err: null },
        ],
      },
      getTransaction: {
        [SIG_IN]: txFixture(1000000, 1000000, { InstructionError: [0, 'Custom'] }),
      },
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        direction: 'self',
        amountBaseUnits: '0',
        status: 'failed',
      });
    }
  });

  it('returns an empty list for an address with no signatures', async () => {
    const transport = solTransport({
      getHealth: HEALTH,
      getSignaturesForAddress: { jsonrpc: '2.0', id: 1, result: [] },
      getTransaction: {},
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getHistory(ADDRESS);
    expect(result).toMatchObject({ status: 'ok', data: [] });
  });

  it('skips a signature whose transaction cannot be read', async () => {
    const transport = solTransport({
      getHealth: HEALTH,
      getSignaturesForAddress: {
        jsonrpc: '2.0',
        id: 1,
        result: [
          { signature: SIG_IN, slot: 100, blockTime: 1795392000, confirmationStatus: 'finalized', err: null },
          { signature: SIG_FAIL, slot: 99, blockTime: 1795391000, confirmationStatus: 'finalized', err: null },
        ],
      },
      getTransaction: {
        [SIG_IN]: txFixture(1000000, 1500000),
        [SIG_FAIL]: new Error('Network error: transaction pruned'),
      },
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.hash).toBe(SIG_IN);
    }
  });

  it('rejects an invalid address', async () => {
    const adapter = createSolanaAdapter({ transport: solTransport({}) });
    const result = await adapter.getHistory('not-an-address!!');
    expect(result.status).toBe('error');
  });

  it('errors when the signatures call returns an RPC error object', async () => {
    const transport = solTransport({
      getHealth: HEALTH,
      getSignaturesForAddress: {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'Invalid param' },
      },
      getTransaction: {},
    });
    const adapter = createSolanaAdapter({ transport });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Invalid param');
    }
  });
});
