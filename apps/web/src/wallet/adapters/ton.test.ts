import { afterEach, describe, expect, it, vi } from 'vitest';
import { base64ToHex, createTonAdapter } from './ton';
import { BROADCAST_DISABLED_MESSAGE, type TonWalletVersion } from './types';

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

const okRpc = (result: unknown): RawResponse => ({
  ok: true,
  status: 200,
  body: { ok: true, result },
});
const http503 = (): RawResponse => ({ ok: false, status: 503, body: {} });
const http404 = (): RawResponse => ({ ok: false, status: 404, body: {} });

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

describe('ton adapter — rate limiting', () => {
  it('concurrent balance and history share one identity check', async () => {
    mockRpcSequence([MASTERCHAIN, '123456789', []]);
    const adapter = createTonAdapter();

    const [balance, history] = await Promise.all([
      adapter.getBalance(ADDRESS),
      adapter.getHistory(ADDRESS),
    ]);

    expect(balance.status).toBe('ok');
    expect(history.status).toBe('ok');
    expect(
      (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
    ).toBe(3);
  });

  it('spaces concurrent calls by the minimum gap (serial gate)', async () => {
    // Phase 3, Lane H: TonCenter's keyless tier allows ~1 req/s. The
    // identity check, the balance and the history must start at least
    // one gap apart, or history 429s. A 50 ms test gap keeps this fast.
    const startedAt: number[] = [];
    const queue = [MASTERCHAIN, '123456789', []];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        startedAt.push(Date.now());
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: queue.shift() }),
        };
      }),
    );
    const adapter = createTonAdapter({ minCallGapMs: 50 });

    const [balance, history] = await Promise.all([
      adapter.getBalance(ADDRESS),
      adapter.getHistory(ADDRESS),
    ]);

    expect(balance.status).toBe('ok');
    expect(history.status).toBe('ok');
    expect(startedAt).toHaveLength(3);
    // 45 ms allows timer slop on the 50 ms gap; a missing gate would
    // show ~0 ms between the identity check and the balance.
    expect((startedAt[1] as number) - (startedAt[0] as number)).toBeGreaterThanOrEqual(45);
    expect((startedAt[2] as number) - (startedAt[1] as number)).toBeGreaterThanOrEqual(45);
  });

  it('a 429 then a 200 returns the balance', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({
            ok: false,
            result: 'Ratelimit exceed',
            code: 429,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: MASTERCHAIN }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: '456' }),
        }),
    );
    const adapter = createTonAdapter({ retryDelaysMs: [1, 1] });

    const result = await adapter.getBalance(ADDRESS);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('456');
    }
  });

  it('a persistent 429 returns an honest error, never zero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          ok: false,
          result: 'Ratelimit exceed',
          code: 429,
        }),
      })),
    );
    const adapter = createTonAdapter({ retryDelaysMs: [1, 1] });

    const result = await adapter.getBalance(ADDRESS);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toMatch(/rate limit/i);
    }
    expect(result.status).not.toBe('ok');
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
      expect(result.data).toEqual({ kind: 'seqno', seqno: 26, walletVersion: 'v4r2' });
    }
  });

  it('seqno 0 is a valid seqno, never a missing value (item 3 regression)', async () => {
    // A fresh wallet has seqno 0. The ton 16.3.0 validUntil regression was
    // exactly this: seqno 0 treated as absent/bogus. It must parse to 0.
    mockRpcSequence([MASTERCHAIN, { stack: [['num', '0x0']] }]);
    const adapter = createTonAdapter();
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toEqual({ kind: 'seqno', seqno: 0, walletVersion: 'v4r2' });
    }
  });

  it('broadcast stays disabled', async () => {
    const adapter = createTonAdapter();
    await expect(adapter.broadcast('deadbeef')).rejects.toThrow(
      BROADCAST_DISABLED_MESSAGE,
    );
  });
});

describe('ton adapter — schema validation (item 3)', () => {
  it('rejects a non-string balance instead of passing it on', async () => {
    mockRpcSequence([MASTERCHAIN, 12345]);
    const adapter = createTonAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toMatch(/Invalid response/);
    }
  });

  it('rejects a masterchain response without a seqno', async () => {
    mockRpcSequence([{ last: {} }]);
    const adapter = createTonAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toMatch(/identity/i);
  });

  it('rejects a malformed seqno stack', async () => {
    mockRpcSequence([MASTERCHAIN, { stack: [['num', 'not-hex']] }]);
    const adapter = createTonAdapter();
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toMatch(/Invalid response/);
    }
  });

  it('rejects a non-list transaction response', async () => {
    mockRpcSequence([MASTERCHAIN, { not: 'a list' }]);
    const adapter = createTonAdapter();
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toMatch(/Invalid response/);
    }
  });
});

describe('ton adapter — wallet version (item 4)', () => {
  it('carries the configured version in the tx inputs', async () => {
    mockRpcSequence([MASTERCHAIN, { stack: [['num', '0x1a']] }]);
    const adapter = createTonAdapter({ version: 'v5r1' });
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toEqual({ kind: 'seqno', seqno: 26, walletVersion: 'v5r1' });
    }
  });

  it('throws at construction on an unknown version', () => {
    // assertTonWalletVersion throws BawaError INVALID_INPUT ('Invalid input.').
    expect(
      () => createTonAdapter({ version: 'v9' as unknown as TonWalletVersion }),
    ).toThrow('Invalid input.');
  });
});

describe('ton adapter — retry (item 2)', () => {
  it('retries a transient 503 and then succeeds', async () => {
    const fetchMock = mockFetchRawSequence([
      okRpc(MASTERCHAIN),
      http503(),
      http503(),
      okRpc('123456789'),
    ]);
    const adapter = createTonAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('123456789');
    // 1 identity + 3 balance attempts: the two 503s were retried, not lost.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry a terminal 404', async () => {
    const fetchMock = mockFetchRawSequence([okRpc(MASTERCHAIN), http404()]);
    const adapter = createTonAdapter();
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    // 1 identity + 1 balance attempt: a 404 is terminal, never retried.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
