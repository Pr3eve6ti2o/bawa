import { afterEach, describe, expect, it, vi } from 'vitest';
import { base64ToHex, createTonAdapter } from './ton';
import { BROADCAST_DISABLED_MESSAGE } from './types';

const ADDRESS = 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn';
const OTHER = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';

// base64 of 32 zero bytes except the last byte 0x01 — deterministic fixture.
const HASH_B64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE=';

function mockRpcSequence(results: unknown[]): void {
  const queue = [...results];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: queue.shift() }),
    })),
  );
}

const MASTERCHAIN = { last: { seqno: 12345678 } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('base64ToHex', () => {
  it('converts a TonCenter tx hash to hex', () => {
    expect(base64ToHex(HASH_B64)).toBe(
      '0000000000000000000000000000000000000000000000000000000000000001',
    );
  });
});

describe('ton adapter — balance', () => {
  it('returns the nanoTON balance with decimals 9', async () => {
    mockRpcSequence([MASTERCHAIN, '123456789']);
    const adapter = createTonAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('123456789');
      expect(result.data.decimals).toBe(9);
      expect(result.data.networkId).toBe('ton:-239');
    }
  });

  it('reports an exact zero, not an error', async () => {
    mockRpcSequence([MASTERCHAIN, '0']);
    const adapter = createTonAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createTonAdapter();
    const result = await adapter.getBalance('not-a-ton-address');
    expect(result.status).toBe('error');
  });

  it('maps TonCenter ok:false to an error result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, error: 'account not found' }),
      })),
    );
    const adapter = createTonAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toMatch(/account not found/);
  });
});

describe('ton adapter — history', () => {
  it('maps in/out with base64→hex hashes', async () => {
    mockRpcSequence([
      MASTERCHAIN,
      [
        {
          transaction_id: { lt: '100', hash: HASH_B64 },
          utime: 1700000000,
          in_msg: { source: OTHER, destination: ADDRESS, value: '500000000' },
          out_msgs: [],
        },
        {
          transaction_id: { lt: '101', hash: HASH_B64 },
          utime: 1700000001,
          in_msg: { source: '', destination: ADDRESS, value: '0' },
          out_msgs: [{ destination: OTHER, value: '250000000' }],
        },
      ],
    ]);
    const adapter = createTonAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.direction).toBe('in');
      expect(result.data[0]?.amountBaseUnits).toBe('500000000');
      expect(result.data[0]?.counterparty).toBe(OTHER);
      expect(result.data[0]?.hash).toBe(
        '0000000000000000000000000000000000000000000000000000000000000001',
      );
      expect(result.data[0]?.timestamp).toBe(1700000000000);
      expect(result.data[1]?.direction).toBe('out');
      expect(result.data[1]?.amountBaseUnits).toBe('250000000');
      expect(result.data[1]?.explorerUrl).toContain('https://tonviewer.com/transaction/');
    }
  });

  it('returns an empty list when there are no transactions', async () => {
    mockRpcSequence([MASTERCHAIN, []]);
    const adapter = createTonAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result).toEqual(expect.objectContaining({ status: 'ok', data: [] }));
  });
});

describe('ton adapter — fee, seqno, broadcast', () => {
  it('fee estimation is unavailable, never a fabricated number', async () => {
    const adapter = createTonAdapter();
    const result = await adapter.estimateFee();
    expect(result.status).toBe('unavailable');
  });

  it('returns the wallet seqno from runGetMethod', async () => {
    mockRpcSequence([MASTERCHAIN, { stack: [['num', '0x1a']] }]);
    const adapter = createTonAdapter();
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toEqual({ kind: 'seqno', seqno: 26 });
    }
  });

  it('broadcast stays disabled', async () => {
    const adapter = createTonAdapter();
    await expect(adapter.broadcast('deadbeef')).rejects.toThrow(
      BROADCAST_DISABLED_MESSAGE,
    );
  });
});
