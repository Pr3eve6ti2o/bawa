import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDogeAdapter, sochainConfirmedToKoinu } from './doge';
import { BROADCAST_DISABLED_MESSAGE, type FetchTransport } from './types';

const ADDRESS = 'DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K';

function dogeTransport(handlers: {
  networkInfo?: unknown;
  sochainBalance?: unknown;
  chain?: unknown;
  balance?: unknown;
}): FetchTransport {
  return {
    request: vi.fn(async (url: string) => {
      if (url === 'https://sochain.com/api/v3/network_info/DOGE') {
        if (handlers.networkInfo instanceof Error) throw handlers.networkInfo;
        return handlers.networkInfo;
      }
      if (url === `https://sochain.com/api/v3/balance/DOGE/${ADDRESS}`) {
        if (handlers.sochainBalance instanceof Error) throw handlers.sochainBalance;
        return handlers.sochainBalance;
      }
      if (url === 'https://api.blockcypher.com/v1/doge/main') return handlers.chain;
      if (url.includes('/addrs/') && url.endsWith('/balance')) return handlers.balance;
      throw new Error(`unexpected url ${url}`);
    }),
  };
}

const okHandlers = {
  // Token gaps, item 1 (Lane 1, 2026-11-22): SoChain is the primary
  // DOGE source — in-page 200, confirmed "10007.79125175" DOGE for the
  // repo-fixture address, agreeing exactly with BlockCypher's
  // final_balance 1000779125175 koinu. BlockCypher stays as fallback.
  networkInfo: { status: 'success', data: { block_count: 6468497 } },
  sochainBalance: {
    status: 'success',
    data: { confirmed: '10007.79125175', unconfirmed: '0.00000000' },
  },
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
  it('returns the SoChain confirmed balance as the exact koinu string with decimals 8', async () => {
    const adapter = createDogeAdapter({ transport: dogeTransport(okHandlers) });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('1000779125175');
      expect(result.data.decimals).toBe(8);
      expect(result.data.source).toBe('sochain');
      expect(result.data.networkId).toBe(
        'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
      );
      expect(result.data.chain).toBe('doge');
    }
  });

  it('falls back to BlockCypher final_balance when SoChain fails', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainBalance: new Error('Network error: sochain unreachable'),
      }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('1000000000');
      expect(result.data.source).toBe('blockcypher');
    }
  });

  it('falls back to BlockCypher when the SoChain shape is invalid', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainBalance: { status: 'success', data: { confirmed: 'not-a-number' } },
      }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('1000000000');
      expect(result.data.source).toBe('blockcypher');
    }
  });

  it('reports an exact zero, not an error', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainBalance: {
          status: 'success',
          data: { confirmed: '0.00000000', unconfirmed: '0.00000000' },
        },
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

  it('errors when neither identity source reports the DOGE network', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        networkInfo: new Error('Network error: sochain unreachable'),
        chain: { name: 'BTC', height: 1 },
      }),
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
      calls.filter((call) => call[0] === 'https://sochain.com/api/v3/network_info/DOGE'),
    ).toHaveLength(1);
  });
});

describe('sochainConfirmedToKoinu', () => {
  it('converts a decimal DOGE string to koinu exactly, without floats', () => {
    expect(sochainConfirmedToKoinu('10007.79125175')).toBe('1000779125175');
    expect(sochainConfirmedToKoinu('0.00000001')).toBe('1');
    expect(sochainConfirmedToKoinu('0')).toBe('0');
    expect(sochainConfirmedToKoinu('1.5')).toBe('150000000');
  });

  it('returns null for a malformed confirmed value', () => {
    expect(sochainConfirmedToKoinu('not-a-number')).toBeNull();
    expect(sochainConfirmedToKoinu('1.123456789')).toBeNull();
    expect(sochainConfirmedToKoinu('-1')).toBeNull();
    expect(sochainConfirmedToKoinu('')).toBeNull();
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
