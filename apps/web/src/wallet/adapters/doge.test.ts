import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDogeAdapter } from './doge';
import { BROADCAST_DISABLED_MESSAGE, type FetchTransport } from './types';

const ADDRESS = 'DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K';

function dogeTransport(handlers: { chain?: unknown; balance?: unknown }): FetchTransport {
  return {
    request: vi.fn(async (url: string) => {
      if (url === 'https://api.blockcypher.com/v1/doge/main') return handlers.chain;
      if (url.includes('/addrs/') && url.endsWith('/balance')) return handlers.balance;
      throw new Error(`unexpected url ${url}`);
    }),
  };
}

const okHandlers = {
  chain: { name: 'DOGE', height: 6468353 },
  balance: {
    address: ADDRESS,
    total_received: 2000000000,
    total_sent: 1000000000,
    balance: 999000000,
    unconfirmed_balance: 0,
    final_balance: 1000000000,
    n_tx: 3,
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dogecoin adapter — balance', () => {
  it('returns final_balance as the exact satoshi string with decimals 8', async () => {
    const adapter = createDogeAdapter({ transport: dogeTransport(okHandlers) });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('1000000000');
      expect(result.data.decimals).toBe(8);
      expect(result.data.networkId).toBe(
        'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
      );
      expect(result.data.chain).toBe('doge');
    }
  });

  it('reports an exact zero, not an error', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        balance: { ...okHandlers.balance, final_balance: 0 },
      }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createDogeAdapter({ transport: dogeTransport(okHandlers) });
    const result = await adapter.getBalance('not-an-address');
    expect(result.status).toBe('error');
  });

  it('errors when the chain endpoint does not report DOGE', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({ ...okHandlers, chain: { name: 'BTC', height: 1 } }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Network identity mismatch');
    }
  });

  it('checks chain identity once per adapter instance', async () => {
    const transport = dogeTransport(okHandlers);
    const adapter = createDogeAdapter({ transport });
    await adapter.getBalance(ADDRESS);
    await adapter.getBalance(ADDRESS);
    const calls = (transport.request as ReturnType<typeof vi.fn>).mock.calls;
    expect(
      calls.filter((call) => call[0] === 'https://api.blockcypher.com/v1/doge/main'),
    ).toHaveLength(1);
  });
});

describe('dogecoin adapter — unbuilt operations', () => {
  it('reports history, fee-quote and tx inputs unavailable, never faked', async () => {
    const adapter = createDogeAdapter({ transport: dogeTransport(okHandlers) });
    expect((await adapter.getHistory(ADDRESS)).status).toBe('unavailable');
    expect((await adapter.estimateFee()).status).toBe('unavailable');
    expect((await adapter.getTxInputs(ADDRESS)).status).toBe('unavailable');
  });

  it('always throws the broadcast-disabled message', async () => {
    const adapter = createDogeAdapter({ transport: dogeTransport(okHandlers) });
    await expect(adapter.broadcast({})).rejects.toThrow(BROADCAST_DISABLED_MESSAGE);
  });
});
