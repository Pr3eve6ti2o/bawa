import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSolanaAdapter } from './sol';
import { BROADCAST_DISABLED_MESSAGE, type FetchTransport } from './types';

// System program address: valid base58, holds 1 lamport on mainnet.
const ADDRESS = '11111111111111111111111111111111';

function solTransport(handlers: {
  getBalance?: unknown;
  getHealth?: unknown;
}): FetchTransport {
  return {
    request: vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      if (body.method === 'getBalance') {
        if (handlers.getBalance instanceof Error) throw handlers.getBalance;
        return handlers.getBalance;
      }
      if (body.method === 'getHealth') {
        if (handlers.getHealth instanceof Error) throw handlers.getHealth;
        return handlers.getHealth;
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
});

describe('solana adapter — unbuilt operations', () => {
  it('reports history, fee-quote and tx inputs unavailable, never faked', async () => {
    const adapter = createSolanaAdapter({ transport: solTransport({}) });
    expect((await adapter.getHistory(ADDRESS)).status).toBe('unavailable');
    expect((await adapter.estimateFee()).status).toBe('unavailable');
    expect((await adapter.getTxInputs(ADDRESS)).status).toBe('unavailable');
  });

  it('always throws the broadcast-disabled message', async () => {
    const adapter = createSolanaAdapter({ transport: solTransport({}) });
    await expect(adapter.broadcast({})).rejects.toThrow(BROADCAST_DISABLED_MESSAGE);
  });
});
