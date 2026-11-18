import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTronAdapter, getLatestBlockHeader } from './trx';
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

describe('trx adapter — latest block header', () => {
  const FULL_BLOCK = {
    block_header: {
      raw_data: {
        number: 88121800,
        timestamp: 1795039455000,
        txTrieRoot:
          '3465ec46ab35159981a2db5a3607932b155e4e4e27277d1137f48a5734cd272e',
        parentHash:
          '000000000540a1c75fa0fcc62e1cd6bf7558e4bb3ef43d1f8fa4169398d34b64',
        // Known pair: this hex is TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c
        // (verified by tronAddressToBytes in send.test.ts).
        witness_address: '4159b2f14f54513afa5b324aabd5c70362e7aa0836',
      },
    },
  };

  it('returns the header with the witness as a base58 T-address', async () => {
    mockFetchOnce(FULL_BLOCK);
    const result = await getLatestBlockHeader();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.number).toBe(88121800);
      expect(result.data.timestamp).toBe(1795039455000);
      expect(result.data.txTrieRoot).toBe(
        '3465ec46ab35159981a2db5a3607932b155e4e4e27277d1137f48a5734cd272e',
      );
      expect(result.data.parentHash).toBe(
        '000000000540a1c75fa0fcc62e1cd6bf7558e4bb3ef43d1f8fa4169398d34b64',
      );
      expect(result.data.witnessAddress).toBe(
        'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
      );
    }
  });

  it('fails closed on a malformed header', async () => {
    mockFetchOnce({ block_header: { raw_data: { number: 1 } } });
    const result = await getLatestBlockHeader();
    expect(result.status).toBe('error');
  });

  it('fails closed on an unrecognised witness address', async () => {
    mockFetchOnce({
      block_header: {
        raw_data: {
          number: 1,
          timestamp: 1700000000000,
          txTrieRoot: '00'.repeat(32),
          parentHash: '00'.repeat(32),
          witness_address: 'not-an-address',
        },
      },
    });
    const result = await getLatestBlockHeader();
    expect(result.status).toBe('error');
  });
});
