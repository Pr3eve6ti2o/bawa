import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLtcAdapter } from './ltc';
import { BROADCAST_DISABLED_MESSAGE, type FetchTransport } from './types';

const ADDRESS = 'LYhttvnKawAv6RcHQ4eBkNtifuiEA99PFe';
const GENESIS_HASH = '12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2';

function ltcTransport(handlers: {
  genesis?: unknown;
  address?: unknown;
  txs?: unknown;
  fees?: unknown;
  utxo?: unknown;
}): FetchTransport {
  return {
    request: vi.fn(async (url: string) => {
      if (url.endsWith('/blocks/0')) return handlers.genesis;
      if (url.includes('/address/') && url.endsWith('/txs')) return handlers.txs;
      if (url.includes('/address/') && url.endsWith('/utxo')) return handlers.utxo;
      if (url.includes('/address/')) return handlers.address;
      if (url.endsWith('/v1/fees/recommended')) return handlers.fees;
      throw new Error(`unexpected url ${url}`);
    }),
  };
}

const okHandlers = {
  genesis: [{ id: GENESIS_HASH }],
  address: { chain_stats: { funded_txo_sum: 200000000, spent_txo_sum: 50000000 } },
  txs: [],
  fees: { fastestFee: 12 },
  utxo: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('litecoin adapter — balance', () => {
  it('returns the exact satoshi string with decimals 8', async () => {
    const adapter = createLtcAdapter({ transport: ltcTransport(okHandlers) });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('150000000');
      expect(result.data.decimals).toBe(8);
      expect(result.data.networkId).toBe(
        'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
      );
      expect(result.data.chain).toBe('ltc');
    }
  });

  it('reports an exact zero, not an error', async () => {
    const adapter = createLtcAdapter({
      transport: ltcTransport({
        ...okHandlers,
        address: { chain_stats: { funded_txo_sum: 100, spent_txo_sum: 100 } },
      }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createLtcAdapter({ transport: ltcTransport(okHandlers) });
    const result = await adapter.getBalance('not-an-address');
    expect(result.status).toBe('error');
  });

  it('errors when the genesis hash does not match Litecoin mainnet', async () => {
    const adapter = createLtcAdapter({
      transport: ltcTransport({ ...okHandlers, genesis: [{ id: '00'.repeat(32) }] }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Network identity mismatch');
    }
  });

  it('checks the genesis block once per adapter instance', async () => {
    const transport = ltcTransport(okHandlers);
    const adapter = createLtcAdapter({ transport });
    await adapter.getBalance(ADDRESS);
    await adapter.getBalance(ADDRESS);
    const calls = (transport.request as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.filter((call) => String(call[0]).endsWith('/blocks/0'))).toHaveLength(1);
  });
});

describe('litecoin adapter — history, fee, inputs', () => {
  it('returns an empty history for an address with no transactions', async () => {
    const adapter = createLtcAdapter({ transport: ltcTransport(okHandlers) });
    const result = await adapter.getHistory(ADDRESS);
    expect(result).toMatchObject({ status: 'ok', data: [] });
  });

  it('returns the recommended fee rate', async () => {
    const adapter = createLtcAdapter({ transport: ltcTransport(okHandlers) });
    const result = await adapter.estimateFee();
    expect(result).toMatchObject({
      status: 'ok',
      data: { feeBaseUnits: '12', unit: 'sat/vB' },
    });
  });

  it('returns UTXOs for tx inputs', async () => {
    const adapter = createLtcAdapter({
      transport: ltcTransport({
        ...okHandlers,
        utxo: [{ txid: 'ab'.repeat(32), vout: 0, value: 1000 }],
      }),
    });
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result).toMatchObject({
      status: 'ok',
      data: { kind: 'utxo', utxos: [{ txid: 'ab'.repeat(32), vout: 0, valueBaseUnits: '1000' }] },
    });
  });

  it('always throws the broadcast-disabled message', async () => {
    const adapter = createLtcAdapter({ transport: ltcTransport(okHandlers) });
    await expect(adapter.broadcast({})).rejects.toThrow(BROADCAST_DISABLED_MESSAGE);
  });
});

describe('litecoin adapter — RPC failover (UI/UX fixes, item 19)', () => {
  const PRIMARY = 'https://primary.invalid/api';
  const SECONDARY = 'https://secondary.invalid/api';
  const BLOCKCYPHER = 'https://blockcypher.invalid/v1/ltc/main';

  /** URL-keyed transport: mempool-shaped hosts fail or answer per flags. */
  function failoverTransport(flags: {
    mempoolDown?: boolean;
    genesis?: unknown;
    address?: unknown;
    blockcypherBalance?: number;
  }): FetchTransport {
    return {
      request: vi.fn(async (url: string) => {
        if (url.startsWith(BLOCKCYPHER)) {
          if (url.endsWith('/balance')) {
            return { final_balance: flags.blockcypherBalance ?? 0 };
          }
          return { name: 'LTC.main' };
        }
        if (flags.mempoolDown) {
          throw new Error('Network error: mempool endpoint down');
        }
        if (url.endsWith('/blocks/0')) return flags.genesis ?? [{ id: GENESIS_HASH }];
        if (url.includes('/address/')) {
          return (
            flags.address ?? {
              chain_stats: { funded_txo_sum: 200000000, spent_txo_sum: 50000000 },
            }
          );
        }
        throw new Error(`unexpected url ${url}`);
      }),
    };
  }

  it('loads a balance through the second mempool endpoint', async () => {
    const transport = failoverTransport({});
    // The primary throws; only the secondary answers.
    (transport.request as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.startsWith(PRIMARY)) {
          throw new Error('Network error: primary down');
        }
        if (url.endsWith('/blocks/0')) return [{ id: GENESIS_HASH }];
        if (url.includes('/address/')) {
          return { chain_stats: { funded_txo_sum: 200000000, spent_txo_sum: 50000000 } };
        }
        throw new Error(`unexpected url ${url}`);
      },
    );
    const adapter = createLtcAdapter({
      transport,
      baseUrls: [PRIMARY, SECONDARY],
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('150000000');
      expect(result.data.source).toBe('secondary.invalid');
    }
  });

  it('falls back to BlockCypher for the balance when mempool is entirely down', async () => {
    const adapter = createLtcAdapter({
      transport: failoverTransport({ mempoolDown: true, blockcypherBalance: 424242 }),
      baseUrls: [PRIMARY, SECONDARY],
      blockcypherBaseUrl: BLOCKCYPHER,
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('424242');
      expect(result.data.source).toBe('blockcypher');
    }
  });

  it('fails closed on a wrong genesis instead of falling back', async () => {
    const transport = failoverTransport({ genesis: [{ id: '00'.repeat(32) }] });
    const adapter = createLtcAdapter({
      transport,
      baseUrls: [PRIMARY, SECONDARY],
      blockcypherBaseUrl: BLOCKCYPHER,
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Network identity mismatch');
    }
    const calls = (transport.request as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((call) => String(call[0]).startsWith(BLOCKCYPHER))).toBe(
      false,
    );
  });
});
