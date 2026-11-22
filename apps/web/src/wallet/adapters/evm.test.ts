import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { createEvmAdapter, type EvmAdapterConfig } from './evm';
import { BROADCAST_DISABLED_MESSAGE } from './types';

const ADDRESS = '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';

const BSC: EvmAdapterConfig = {
  chain: 'bsc',
  networkId: 'eip155:56',
  rpcUrl: 'https://bsc-rpc.publicnode.com',
  evmChainId: 56,
  chainName: 'BNB Smart Chain',
  nativeSymbol: 'BNB',
  source: 'publicnode',
};

function mockClient(overrides: Record<string, unknown> = {}): PublicClient {
  return {
    getChainId: vi.fn(async () => 56),
    getBalance: vi.fn(async () => 2000000000000000000n),
    getGasPrice: vi.fn(async () => 3000000000n),
    getTransactionCount: vi.fn(async () => 4),
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

describe('evm adapter — balance', () => {
  it('returns the exact base-unit string with the chain network id', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2000000000000000000');
      expect(result.data.decimals).toBe(18);
      expect(result.data.networkId).toBe('eip155:56');
      expect(result.data.chain).toBe('bsc');
    }
  });

  it('reports an exact zero, not an error', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({ getBalance: vi.fn(async () => 0n) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getBalance('not-an-address');
    expect(result).toEqual({ status: 'error', reason: 'Invalid Ethereum address' });
  });

  it('errors when the RPC reports the wrong chain id', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({ getChainId: vi.fn(async () => 1) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('expected chain 56');
      expect(result.reason).toContain('got 1');
    }
  });

  it('errors when the RPC throws', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({ getBalance: vi.fn(async () => { throw new Error('boom'); }) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result).toEqual({ status: 'error', reason: 'boom' });
  });
});

describe('evm adapter — fee and tx inputs', () => {
  it('estimates a native-transfer fee at 21000 gas', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.estimateFee();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.feeBaseUnits).toBe((3000000000n * 21000n).toString());
      expect(result.data.unit).toBe('wei');
    }
  });

  it('returns the nonce for tx inputs', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result).toMatchObject({ status: 'ok', data: { kind: 'nonce', nonce: 4 } });
  });
});

describe('evm adapter — history', () => {
  it('reports history unavailable when no history endpoint is configured', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('unavailable');
  });

  it('reads Blockscout history when a history endpoint is configured', async () => {
    mockFetchJson([
      {
        hash: '0xabc',
        from: ADDRESS,
        to: '0x000000000000000000000000000000000000dEaD',
        value: '1000',
        timeStamp: '1700000000',
        txreceipt_status: '1',
        isError: '0',
      },
    ]);
    const adapter = createEvmAdapter(
      { ...BSC, historyBaseUrl: 'https://eth.blockscout.com/api', historyExplorerBase: 'https://eth.blockscout.com' },
      { client: mockClient() },
    );
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: '0xabc',
        direction: 'out',
        amountBaseUnits: '1000',
        explorerUrl: 'https://eth.blockscout.com/tx/0xabc',
      });
    }
  });
});

describe('evm adapter — broadcast', () => {
  it('always throws the broadcast-disabled message', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    await expect(adapter.broadcast({})).rejects.toThrow(BROADCAST_DISABLED_MESSAGE);
  });
});
