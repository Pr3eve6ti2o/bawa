import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDogeAdapter, sochainConfirmedToKoinu } from './doge';
import { BROADCAST_DISABLED_MESSAGE, type FetchTransport } from './types';

const ADDRESS = 'DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K';

function dogeTransport(handlers: {
  networkInfo?: unknown;
  sochainBalance?: unknown;
  chain?: unknown;
  balance?: unknown;
  sochainTxsIn?: unknown;
  sochainTxsOut?: unknown;
  blockcypherFull?: unknown;
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
      if (
        url ===
        `https://sochain.com/api/v3/transactions/DOGE/${ADDRESS}?direction=in`
      ) {
        if (handlers.sochainTxsIn instanceof Error) throw handlers.sochainTxsIn;
        return handlers.sochainTxsIn;
      }
      if (
        url ===
        `https://sochain.com/api/v3/transactions/DOGE/${ADDRESS}?direction=out`
      ) {
        if (handlers.sochainTxsOut instanceof Error) throw handlers.sochainTxsOut;
        return handlers.sochainTxsOut;
      }
      if (url.includes('/addrs/') && url.includes('/full')) {
        if (handlers.blockcypherFull instanceof Error) throw handlers.blockcypherFull;
        return handlers.blockcypherFull;
      }
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

  // Fix-All Lane A (2026-11-24): SoChain 429s (daily keyless quota
  // exhausted) and BlockCypher is the only remaining fallback —
  // dogechain.info was removed in this lane because it sends no CORS
  // headers, so a browser can never read it (proven in CDP round 2:
  // the same URL 200s in Node and ERR_FAILEDs in the browser).
  it('falls back to BlockCypher when SoChain 429s (Fix-All Lane A)', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainBalance: new Error('HTTP 429'),
      }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('1000000000');
      expect(result.data.source).toBe('blockcypher');
    }
  });

  it('errors when both identity sources are down', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        networkInfo: new Error('Network error: sochain unreachable'),
        chain: new Error('Network error: blockcypher unreachable'),
      }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
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

  it('converts the live ground-truth DOGE value exactly (Fix-All Lane A)', () => {
    // Probed live 2026-11-24 for DEgDVFa2DoW1533dxeDVdTxQFhMzs1pMke:
    // decimal "27164003668.40032381" (dogechain.info, Node only — no
    // CORS, so unusable in the browser) agrees exactly with
    // BlockCypher final_balance 2716400366840032381 koinu.
    expect(sochainConfirmedToKoinu('27164003668.40032381')).toBe(
      '2716400366840032381',
    );
  });

  it('returns null for a malformed confirmed value', () => {
    expect(sochainConfirmedToKoinu('not-a-number')).toBeNull();
    expect(sochainConfirmedToKoinu('1.123456789')).toBeNull();
    expect(sochainConfirmedToKoinu('-1')).toBeNull();
    expect(sochainConfirmedToKoinu('')).toBeNull();
  });
});

describe('dogecoin adapter — unbuilt operations', () => {
  it('reports fee-quote and tx inputs unavailable, never faked', async () => {
    const adapter = createDogeAdapter({ transport: dogeTransport(okHandlers) });
    expect((await adapter.estimateFee()).status).toBe('unavailable');
    expect((await adapter.getTxInputs(ADDRESS)).status).toBe('unavailable');
  });

  it('always throws the broadcast-disabled message', async () => {
    const adapter = createDogeAdapter({ transport: dogeTransport(okHandlers) });
    await expect(adapter.broadcast({})).rejects.toThrow(BROADCAST_DISABLED_MESSAGE);
  });
});

describe('dogecoin adapter — history', () => {
  // Lane C, item 16: history via SoChain v3 /transactions (direction in
  // + out), BlockCypher /full as fallback. Fixtures are the real live
  // shapes probed 2026-11-23 for the repo-fixture address.
  const TXS_IN = {
    status: 'success',
    data: {
      transactions: [
        {
          hash: '0ab4f31dd05d439b2af0149cb764d929e08d969bad79bc04190ff609139108ca',
          value_sent: '0.00000000',
          value_received: '0.01000000',
          balance_change: '0.01000000',
          time: 1795384920,
          block: 6468725,
          price: { value: '0.05512000', currency: 'USD' },
        },
        {
          hash: '00977c2a1f91eba201287bb1743ced3ca9260301cd23547c7ffeee59fd726a7d',
          value_sent: '0.00000000',
          value_received: '10007.79125175',
          balance_change: '10007.79125175',
          time: 1795361672,
          block: 6468353,
          price: { value: '0.05508500', currency: 'USD' },
        },
      ],
    },
  };
  const TXS_OUT = {
    status: 'success',
    data: {
      transactions: [
        {
          hash: '9630e5e7e4845a8606e88f0b686f3da6c0f65a96cefd048e0b48eff06fd7da07',
          value_sent: '0.01000000',
          value_received: '0.00000000',
          balance_change: '-0.01000000',
          time: 1795392055,
          block: 6468838,
          price: null,
        },
      ],
    },
  };

  it('merges in + out newest-first with direction, amount and explorer link', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainTxsIn: TXS_IN,
        sochainTxsOut: TXS_OUT,
      }),
    });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toMatchObject({
        hash: '9630e5e7e4845a8606e88f0b686f3da6c0f65a96cefd048e0b48eff06fd7da07',
        chain: 'doge',
        direction: 'out',
        amountBaseUnits: '1000000',
        timestamp: 1795392055 * 1000,
        status: 'confirmed',
        explorerUrl:
          'https://dogechain.info/tx/9630e5e7e4845a8606e88f0b686f3da6c0f65a96cefd048e0b48eff06fd7da07',
      });
      expect(result.data[1]).toMatchObject({
        direction: 'in',
        amountBaseUnits: '1000000',
      });
      expect(result.data[2]).toMatchObject({
        direction: 'in',
        amountBaseUnits: '1000779125175',
      });
    }
  });

  it('respects the limit', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainTxsIn: TXS_IN,
        sochainTxsOut: TXS_OUT,
      }),
    });
    const result = await adapter.getHistory(ADDRESS, 2);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(2);
    }
  });

  it('rejects an invalid address', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport(okHandlers),
    });
    const result = await adapter.getHistory('not-a-doge-address');
    expect(result.status).toBe('error');
  });

  it('falls back to BlockCypher /full when SoChain fails', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainTxsIn: new Error('Network error: sochain unreachable'),
        sochainTxsOut: new Error('Network error: sochain unreachable'),
        blockcypherFull: {
          address: ADDRESS,
          txs: [
            {
              hash: 'abc123',
              confirmed: '2026-11-23T00:00:00Z',
              inputs: [{ addresses: [ADDRESS], output_value: 2000000 }],
              outputs: [
                { addresses: ['DOtherAddress11111111111111111111'], value: 1000000 },
                { addresses: [ADDRESS], value: 900000 },
              ],
            },
          ],
        },
      }),
    });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: 'abc123',
        direction: 'out',
        amountBaseUnits: '1000000',
        status: 'confirmed',
      });
    }
  });

  it('errors when both sources fail', async () => {
    const adapter = createDogeAdapter({
      transport: dogeTransport({
        ...okHandlers,
        sochainTxsIn: new Error('Network error: sochain unreachable'),
        sochainTxsOut: new Error('Network error: sochain unreachable'),
        blockcypherFull: new Error('Network error: blockcypher unreachable'),
      }),
    });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('error');
  });
});
