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
      if (url.endsWith('/v1/blocks/0')) return handlers.genesis;
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
    expect(calls.filter((call) => String(call[0]).endsWith('/v1/blocks/0'))).toHaveLength(1);
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
