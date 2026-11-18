import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTronAdapter } from './trx';
import { BROADCAST_DISABLED_MESSAGE } from './types';

const ADDRESS = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';
const OTHER = 'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B';

function mockFetchOnce(response: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => response,
    })),
  );
}

function mockFetchSequence(responses: unknown[]): void {
  const queue = [...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => queue.shift(),
    })),
  );
}

const NOW_BLOCK = {
  block_header: { raw_data: { number: 70000000, timestamp: 1700000000000 } },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('trx adapter — balance', () => {
  it('returns the SUN balance with decimals 6', async () => {
    mockFetchSequence([NOW_BLOCK, { data: [{ balance: 123456789 }], success: true }]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('123456789');
      expect(result.data.decimals).toBe(6);
      expect(result.data.networkId).toBe('tron:0x2b6653dc');
    }
  });

  it('reports an exact zero for an unfunded account (empty data)', async () => {
    mockFetchSequence([NOW_BLOCK, { data: [], success: true }]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createTronAdapter();
    const result = await adapter.getBalance('not-a-tron-address');
    expect(result.status).toBe('error');
  });

  it('fails closed when getnowblock returns no block header', async () => {
    mockFetchOnce({});
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toMatch(/identity/i);
  });
});

describe('trx adapter — history', () => {
  it('maps in/out/self native transfers and skips other contracts', async () => {
    mockFetchSequence([
      NOW_BLOCK,
      {
        data: [
          {
            txID: 'abc-out',
            block_timestamp: 1700000000000,
            raw_data: {
              contract: [
                {
                  type: 'TransferContract',
                  parameter: {
                    value: { amount: 5000000, owner_address: ADDRESS, to_address: OTHER },
                  },
                },
              ],
            },
          },
          {
            txID: 'abc-in',
            block_timestamp: 1700000001000,
            raw_data: {
              contract: [
                {
                  type: 'TransferContract',
                  parameter: {
                    value: { amount: 1000000, owner_address: OTHER, to_address: ADDRESS },
                  },
                },
              ],
            },
          },
          {
            txID: 'abc-other',
            block_timestamp: 1700000002000,
            raw_data: {
              contract: [{ type: 'TriggerSmartContract', parameter: { value: {} } }],
            },
          },
        ],
        success: true,
      },
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.direction).toBe('out');
      expect(result.data[0]?.amountBaseUnits).toBe('5000000');
      expect(result.data[0]?.counterparty).toBe(OTHER);
      expect(result.data[1]?.direction).toBe('in');
      expect(result.data[1]?.timestamp).toBe(1700000001000);
      expect(result.data[0]?.explorerUrl).toBe(
        'https://tronscan.org/#/transaction/abc-out',
      );
    }
  });

  it('returns an empty list when there are no transactions', async () => {
    mockFetchSequence([NOW_BLOCK, { data: [], success: true }]);
    const adapter = createTronAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result).toEqual(expect.objectContaining({ status: 'ok', data: [] }));
  });
});

describe('trx adapter — fee, inputs, broadcast', () => {
  it('returns the energy fee from chain parameters', async () => {
    mockFetchSequence([
      NOW_BLOCK,
      { chainParameter: [{ key: 'getEnergyFee', value: 420 }] },
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.estimateFee();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.feeBaseUnits).toBe('420');
      expect(result.data.unit).toBe('SUN per unit of energy');
    }
  });

  it('returns the balance as tx inputs', async () => {
    mockFetchSequence([NOW_BLOCK, { data: [{ balance: 999 }], success: true }]);
    const adapter = createTronAdapter();
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toEqual({ kind: 'account', balanceSun: '999' });
    }
  });

  it('broadcast stays disabled', async () => {
    const adapter = createTronAdapter();
    await expect(adapter.broadcast('deadbeef')).rejects.toThrow(
      BROADCAST_DISABLED_MESSAGE,
    );
  });
});
