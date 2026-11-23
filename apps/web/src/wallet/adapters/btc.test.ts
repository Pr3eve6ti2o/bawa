import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBtcAdapter } from './btc';
import { BROADCAST_DISABLED_MESSAGE } from './types';

const ADDRESS = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';
const OTHER = 'bc1qotheraddressxxxxxxxxxxxxxxxxxxxxxxxxxx';
const GENESIS = {
  id: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
  height: 0,
};

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

type RawResponse = { ok: boolean; status: number; body: unknown };

/** Raw HTTP responses (ok/status), for retry tests where fetch must fail. */
function mockFetchRawSequence(responses: RawResponse[]): ReturnType<typeof vi.fn> {
  const queue = [...responses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('fetch queue exhausted');
    return { ok: next.ok, status: next.status, json: async () => next.body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const okBody = (body: unknown): RawResponse => ({ ok: true, status: 200, body });
const http503 = (): RawResponse => ({ ok: false, status: 503, body: {} });
const http404 = (): RawResponse => ({ ok: false, status: 404, body: {} });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('btc adapter — balance', () => {
  it('returns funded minus spent in sats with decimals 8', async () => {
    mockFetchSequence([
      [GENESIS],
      { chain_stats: { funded_txo_sum: 311775, spent_txo_sum: 311775 } },
    ]);
    const adapter = createBtcAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('0');
      expect(result.data.decimals).toBe(8);
      expect(result.data.networkId).toBe(
        'bip122:000000000019d6689c085ae165831e93',
      );
    }
  });

  it('reports a non-zero balance exactly', async () => {
    mockFetchSequence([
      [GENESIS],
      { chain_stats: { funded_txo_sum: 500000, spent_txo_sum: 123456 } },
    ]);
    const adapter = createBtcAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('376544');
  });

  it('rejects an invalid address', async () => {
    const adapter = createBtcAdapter();
    const result = await adapter.getBalance('not-a-bitcoin-address');
    expect(result.status).toBe('error');
  });

  it('fails closed when the genesis hash is not mainnet', async () => {
    mockFetchSequence([[{ id: '00'.repeat(32), height: 0 }]]);
    const adapter = createBtcAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toMatch(/identity/i);
  });
});

describe('btc adapter — retry (item 2)', () => {
  it('retries a transient 503 and then succeeds', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody([GENESIS]),
      http503(),
      http503(),
      okBody({ chain_stats: { funded_txo_sum: 500000, spent_txo_sum: 123456 } }),
    ]);
    const adapter = createBtcAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('376544');
    // 1 identity + 3 balance attempts: the two 503s were retried, not lost.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry a terminal 404', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody([GENESIS]),
      http404(),
      http404(),
    ]);
    const adapter = createBtcAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    // 1 identity + 1 primary attempt + 1 fallback attempt: a 404 is
    // terminal, never retried — the fallback attempt is a different
    // endpoint, not a retry of the same one.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry an identity mismatch (a shape error, not a fetch failure)', async () => {
    const fetchMock = mockFetchRawSequence([okBody([{ id: '00'.repeat(32), height: 0 }])]);
    const adapter = createBtcAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('btc adapter — history', () => {
  it('maps in/out/self + pending', async () => {
    mockFetchSequence([
      [GENESIS],
      [
        {
          txid: 'tx-in',
          status: { confirmed: true, block_time: 1700000000 },
          vin: [{ prevout: { scriptpubkey_address: OTHER, value: 10000 } }],
          vout: [{ scriptpubkey_address: ADDRESS, value: 9000 }],
        },
        {
          txid: 'tx-out',
          status: { confirmed: true, block_time: 1700000001 },
          vin: [{ prevout: { scriptpubkey_address: ADDRESS, value: 9000 } }],
          vout: [
            { scriptpubkey_address: OTHER, value: 8000 },
            { scriptpubkey_address: ADDRESS, value: 500 },
          ],
        },
        {
          txid: 'tx-self',
          status: { confirmed: true, block_time: 1700000002 },
          vin: [{ prevout: { scriptpubkey_address: ADDRESS, value: 500 } }],
          vout: [{ scriptpubkey_address: ADDRESS, value: 400 }],
        },
        {
          txid: 'tx-pending',
          status: { confirmed: false },
          vin: [{ prevout: { scriptpubkey_address: OTHER, value: 7000 } }],
          vout: [{ scriptpubkey_address: ADDRESS, value: 7000 }],
        },
      ],
    ]);
    const adapter = createBtcAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(4);
      expect(result.data[0]?.direction).toBe('in');
      expect(result.data[0]?.amountBaseUnits).toBe('9000');
      expect(result.data[0]?.counterparty).toBe(OTHER);
      expect(result.data[0]?.timestamp).toBe(1700000000000);
      expect(result.data[1]?.direction).toBe('out');
      expect(result.data[1]?.amountBaseUnits).toBe('8000');
      expect(result.data[2]?.direction).toBe('self');
      expect(result.data[2]?.amountBaseUnits).toBe('400');
      expect(result.data[3]?.direction).toBe('in');
      expect(result.data[3]?.status).toBe('pending');
      expect(result.data[3]?.timestamp).toBeNull();
      expect(result.data[0]?.explorerUrl).toBe('https://mempool.space/tx/tx-in');
    }
  });

  it('returns an empty list when there are no transactions', async () => {
    mockFetchSequence([[GENESIS], []]);
    const adapter = createBtcAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result).toEqual(expect.objectContaining({ status: 'ok', data: [] }));
  });
});

describe('btc adapter — fee, UTXOs, broadcast', () => {
  it('returns the fastest fee in sat/vB', async () => {
    mockFetchSequence([[GENESIS], { fastestFee: 4, halfHourFee: 1 }]);
    const adapter = createBtcAdapter();
    const result = await adapter.estimateFee();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.feeBaseUnits).toBe('4');
      expect(result.data.unit).toBe('sat/vB');
    }
  });

  it('returns UTXOs as tx inputs', async () => {
    mockFetchSequence([
      [GENESIS],
      [{ txid: 'u1', vout: 0, value: 12345, status: { confirmed: true } }],
    ]);
    const adapter = createBtcAdapter();
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toEqual({
        kind: 'utxo',
        utxos: [{ txid: 'u1', vout: 0, valueBaseUnits: '12345' }],
      });
    }
  });

  it('broadcast stays disabled', async () => {
    const adapter = createBtcAdapter();
    await expect(adapter.broadcast('deadbeef')).rejects.toThrow(
      BROADCAST_DISABLED_MESSAGE,
    );
  });
});

describe('btc adapter — RPC failover (UI/UX fixes, item 19)', () => {
  const PRIMARY = 'https://primary.invalid/api';
  const FALLBACK = 'https://fallback.invalid/api';

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
  });

  /** The primary host is down; the fallback answers every path. */
  function mockBtcFailover(): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith(PRIMARY)) {
          throw new Error('Network error: primary down');
        }
        if (url.endsWith('/blocks/0')) return ok([GENESIS]);
        if (url.includes('/address/') && url.endsWith('/utxo')) return ok([]);
        if (url.includes('/address/') && url.endsWith('/txs')) return ok([]);
        if (url.includes('/address/')) {
          return ok({ chain_stats: { funded_txo_sum: 500000, spent_txo_sum: 123456 } });
        }
        if (url.endsWith('/v1/fees/recommended')) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        if (url.endsWith('/fee-estimates')) {
          return ok({ '1': 5.2, '6': 2.1 });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );
  }

  it('loads a balance through the fallback when the primary is down', async () => {
    mockBtcFailover();
    const adapter = createBtcAdapter({ baseUrls: [PRIMARY, FALLBACK] });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('376544');
      expect(result.data.source).toBe('fallback.invalid');
    }
  });

  it('checks the genesis block on the fallback when the primary is down', async () => {
    mockBtcFailover();
    const adapter = createBtcAdapter({ baseUrls: [PRIMARY, FALLBACK] });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
  });

  it('reads the fee from the fallback fee-estimates map (Esplora shape)', async () => {
    mockBtcFailover();
    const adapter = createBtcAdapter({ baseUrls: [PRIMARY, FALLBACK] });
    const result = await adapter.estimateFee();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // Esplora reports 5.2 sat/vB for the fastest target: rounded up.
      expect(result.data.feeBaseUnits).toBe('6');
      expect(result.data.source).toBe('fallback.invalid');
    }
  });

  it('errors when every endpoint is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error: all endpoints down');
      }),
    );
    const adapter = createBtcAdapter({ baseUrls: [PRIMARY, FALLBACK] });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
  });
});
