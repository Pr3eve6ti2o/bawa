import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { createEthAdapter } from './eth';
import { BROADCAST_DISABLED_MESSAGE } from './types';

const ADDRESS = '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';
const OTHER = '0x000000000000000000000000000000000000dEaD';

function mockClient(overrides: Record<string, unknown> = {}): PublicClient {
  return {
    getChainId: vi.fn(async () => 1),
    getBalance: vi.fn(async () => 1000000000000000000n),
    getGasPrice: vi.fn(async () => 20000000000n),
    getTransactionCount: vi.fn(async () => 7),
    ...overrides,
  } as unknown as PublicClient;
}

function mockFetchJson(result: unknown, status = '1', message = 'OK'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status, message, result }),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('eth adapter — balance', () => {
  it('returns the exact wei string with decimals 18', async () => {
    const adapter = createEthAdapter({ client: mockClient() });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('1000000000000000000');
      expect(result.data.decimals).toBe(18);
      expect(result.data.networkId).toBe('eip155:1');
    }
  });

  it('reports an exact zero, not an error', async () => {
    const adapter = createEthAdapter({
      client: mockClient({ getBalance: vi.fn(async () => 0n) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createEthAdapter({ client: mockClient() });
    const result = await adapter.getBalance('not-an-address');
    expect(result.status).toBe('error');
  });

  it('fails closed when the RPC reports another chain', async () => {
    const adapter = createEthAdapter({
      client: mockClient({ getChainId: vi.fn(async () => 11155111) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toMatch(/identity/i);
  });

  it('returns an error result (never throws) when the RPC throws', async () => {
    const adapter = createEthAdapter({
      client: mockClient({
        getBalance: vi.fn(async () => { throw new Error('rpc down'); }),
      }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toMatch(/rpc down/);
  });
});

describe('eth adapter — history', () => {
  it('maps in/out/self and a failed status', async () => {
    mockFetchJson([
      {
        hash: '0xout',
        from: ADDRESS,
        to: OTHER,
        value: '1000',
        timeStamp: '1700000000',
        txreceipt_status: '1',
        isError: '0',
      },
      {
        hash: '0xin',
        from: OTHER,
        to: ADDRESS,
        value: '2000',
        timeStamp: '1700000001',
        txreceipt_status: '1',
        isError: '0',
      },
      {
        hash: '0xself',
        from: ADDRESS,
        to: ADDRESS,
        value: '0',
        timeStamp: '1700000002',
        txreceipt_status: '0',
        isError: '1',
      },
    ]);
    const adapter = createEthAdapter({ client: mockClient() });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(3);
      expect(result.data[0]?.direction).toBe('out');
      expect(result.data[0]?.counterparty).toBe(OTHER);
      expect(result.data[1]?.direction).toBe('in');
      expect(result.data[1]?.amountBaseUnits).toBe('2000');
      expect(result.data[1]?.timestamp).toBe(1700000001000);
      expect(result.data[2]?.direction).toBe('self');
      expect(result.data[2]?.counterparty).toBeNull();
      expect(result.data[2]?.status).toBe('failed');
      expect(result.data[0]?.explorerUrl).toBe('https://eth.blockscout.com/tx/0xout');
    }
  });

  it('returns an empty list when Blockscout finds nothing', async () => {
    mockFetchJson([], '0', 'No transactions found');
    const adapter = createEthAdapter({ client: mockClient() });
    const result = await adapter.getHistory(ADDRESS);
    expect(result).toEqual(
      expect.objectContaining({ status: 'ok', data: [] }),
    );
  });
});

describe('eth adapter — fee, nonce, broadcast', () => {
  it('estimates a native-transfer fee as gasPrice * 21000', async () => {
    const adapter = createEthAdapter({ client: mockClient() });
    const result = await adapter.estimateFee();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.feeBaseUnits).toBe((20000000000n * 21000n).toString());
      expect(result.data.unit).toBe('wei');
    }
  });

  it('returns the nonce as tx inputs', async () => {
    const adapter = createEthAdapter({ client: mockClient() });
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data).toEqual({ kind: 'nonce', nonce: 7 });
  });

  it('broadcast stays disabled', async () => {
    const adapter = createEthAdapter({ client: mockClient() });
    await expect(adapter.broadcast('0xdead')).rejects.toThrow(
      BROADCAST_DISABLED_MESSAGE,
    );
  });
});
