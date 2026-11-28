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
const http429 = (): RawResponse => ({ ok: false, status: 429, body: {} });

// TronScan fallback fixtures (Fix-All Lane A): the live shapes probed
// 2026-11-24 for TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5.
const TRONSCAN_ACCOUNT = {
  balance: 20032755932541,
  address: ADDRESS,
  trc20token_balances: [],
};
// PublicNode fallback fixture (2026-11-28): the live
// /wallet/getaccount shape probed the same day — a funded account
// answers { balance: <SUN>, address }, a never-funded one answers {}.
const PUBLIC_NODE_ACCOUNT = {
  balance: 987654321,
  address: ADDRESS,
};
const TRONSCAN_TXS = {
  total: 3,
  rangeTotal: 3,
  data: [
    {
      hash: 'tx-out',
      contractType: 1,
      ownerAddress: ADDRESS,
      toAddress: OTHER,
      amount: '5000000',
      timestamp: 1700000000000,
      confirmed: true,
    },
    {
      hash: 'tx-trigger',
      contractType: 31,
      ownerAddress: OTHER,
      toAddress: ADDRESS,
      amount: '0',
      timestamp: 1700000001000,
      confirmed: true,
    },
    {
      hash: 'tx-in',
      contractType: 1,
      ownerAddress: OTHER,
      toAddress: ADDRESS,
      amount: '1000000',
      timestamp: 1700000002000,
      confirmed: true,
    },
  ],
};

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
    // Identity fails AND both fallbacks fail: the identity error is
    // what surfaces. (The fallbacks run after an identity failure, so
    // a bare mockFetchOnce({}) would let the PublicNode read answer {}
    // — an exact zero for a never-funded account — and mask the
    // identity failure.)
    mockFetchRawSequence([okBody({}), http404(), http404()]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toMatch(/identity/i);
  });
});

describe('trx adapter — retry (item 2)', () => {
  it('retries a transient 503 and then succeeds', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http503(),
      http503(),
      okBody({ data: [{ balance: 123456789 }], success: true }),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('123456789');
    // 1 identity + 3 balance attempts: the two 503s were retried, not lost.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry a terminal 404, and falls back to TronScan', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http404(),
      http404(),
      okBody(TRONSCAN_ACCOUNT),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('20032755932541');
      expect(result.source).toBe('tronscan');
    }
    // 1 identity + 1 balance attempt (the 404 was terminal, never
    // retried) + 1 PublicNode fallback read (404) + 1 TronScan fallback read.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('reports the Trongrid error when TronScan also fails', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http404(),
      http404(),
      http404(),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toBe('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(4);
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

describe('trx adapter — TronScan fallback (Fix-All Lane A)', () => {
  it('reads the balance from TronScan when Trongrid identity 429s', async () => {
    const fetchMock = mockFetchRawSequence([
      http429(),
      http429(),
      http429(),
      http404(),
      okBody(TRONSCAN_ACCOUNT),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('20032755932541');
      expect(result.source).toBe('tronscan');
    }
    // 3 identity attempts (429 is retried, then gives up) + 1
    // PublicNode fallback read (404) + 1 TronScan read.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('reads the balance from TronScan when the Trongrid balance 429s', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http429(),
      http429(),
      http429(),
      http404(),
      okBody(TRONSCAN_ACCOUNT),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('20032755932541');
      expect(result.source).toBe('tronscan');
    }
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('reads history from TronScan when the Trongrid history 429s', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http429(),
      http429(),
      http429(),
      okBody(TRONSCAN_TXS),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.source).toBe('tronscan');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        hash: 'tx-out',
        direction: 'out',
        amountBaseUnits: '5000000',
        counterparty: OTHER,
      });
      expect(result.data[1]).toMatchObject({
        hash: 'tx-in',
        direction: 'in',
        amountBaseUnits: '1000000',
      });
      expect(result.data[0]?.explorerUrl).toBe(
        'https://tronscan.org/#/transaction/tx-out',
      );
    }
    // 1 identity + 3 Trongrid history attempts + 1 TronScan read.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('rejects a TronScan balance for a different address', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http404(),
      okBody({ balance: 1, address: OTHER }),
      okBody({ balance: 1, address: OTHER }),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toBe('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('never touches TronScan on the devnet adapter', async () => {
    const fetchMock = mockFetchRawSequence([
      http429(),
      http429(),
      http429(),
    ]);
    const adapter = createTronAdapter({
      networkId: 'tron:nile',
      baseUrl: 'https://nile.trongrid.io',
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    const urls = fetchMock.mock.calls.map((call) => String(call[0] ?? ''));
    expect(urls).toHaveLength(3);
    expect(urls.every((url) => url.includes('nile.trongrid.io'))).toBe(true);
    expect(urls.some((url) => url.includes('tronscanapi'))).toBe(false);
    expect(urls.some((url) => url.includes('publicnode'))).toBe(false);
  });
});

describe('trx adapter — PublicNode fallback (2026-11-28)', () => {
  it('reads the balance from PublicNode when Trongrid identity 429s', async () => {
    const fetchMock = mockFetchRawSequence([
      http429(),
      http429(),
      http429(),
      okBody(PUBLIC_NODE_ACCOUNT),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('987654321');
      expect(result.source).toBe('publicnode');
    }
    // 3 identity attempts (429 is retried, then gives up) + 1
    // PublicNode fallback read — TronScan is never reached.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('reads the balance from PublicNode when the Trongrid balance 404s', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http404(),
      okBody(PUBLIC_NODE_ACCOUNT),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('987654321');
      expect(result.source).toBe('publicnode');
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports an exact zero for a never-funded account (PublicNode {})', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http404(),
      okBody({}),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('0');
      expect(result.source).toBe('publicnode');
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects a PublicNode balance for a different address and falls through to TronScan', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http404(),
      okBody({ balance: 1, address: OTHER }),
      okBody(TRONSCAN_ACCOUNT),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('20032755932541');
      expect(result.source).toBe('tronscan');
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('never reads a PublicNode error body as a balance', async () => {
    const fetchMock = mockFetchRawSequence([
      okBody(NOW_BLOCK),
      http404(),
      okBody({ Error: 'invalid address for field: protocol.Account.address' }),
      okBody(TRONSCAN_ACCOUNT),
    ]);
    const adapter = createTronAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('20032755932541');
      expect(result.source).toBe('tronscan');
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
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

describe('trx adapter — RPC failover (UI/UX fixes, item 19)', () => {
  const PRIMARY = 'https://primary.invalid';
  const SECONDARY = 'https://secondary.invalid';

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
  });

  /** The primary host is down; the secondary answers every path. */
  function mockTrxFailover(): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith(PRIMARY)) {
          throw new Error('Network error: primary down');
        }
        if (url.endsWith('/wallet/getnowblock')) return ok(NOW_BLOCK);
        if (url.includes('/v1/accounts/')) {
          return ok({ data: [{ balance: 123456789 }], success: true });
        }
        if (url.endsWith('/wallet/getchainparameters')) {
          return ok({ chainParameter: [{ key: 'getEnergyFee', value: 420 }] });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );
  }

  it('loads a balance through the second endpoint when the first is down', async () => {
    mockTrxFailover();
    const adapter = createTronAdapter({ baseUrls: [PRIMARY, SECONDARY] });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('123456789');
      expect(result.data.source).toBe('secondary.invalid');
    }
  });

  it('reads the energy fee through the second endpoint', async () => {
    mockTrxFailover();
    const adapter = createTronAdapter({ baseUrls: [PRIMARY, SECONDARY] });
    const result = await adapter.estimateFee();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.feeBaseUnits).toBe('420');
      expect(result.data.source).toBe('secondary.invalid');
    }
  });

  it('errors when every endpoint is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error: all endpoints down');
      }),
    );
    const adapter = createTronAdapter({ baseUrls: [PRIMARY, SECONDARY] });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
  });
});
