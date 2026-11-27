// Tests for the LI.FI quote client (Lane 6). The ok fixture is the
// shape of a real live response fetched from li.quest on 2026-11-26
// (0.1 ETH -> USDC.e on Polygon via Layerswap); the amounts are that
// response's own figures, not invented ones.
import { describe, expect, it } from 'vitest';
import {
  LIFI_SOLANA_CHAIN_ID,
  fetchSwapQuote,
  formatQuoteUsd,
  lifiChainIdFor,
  lifiTokenAddress,
  SWAP_CHAINS,
  type SwapQuoteInput,
} from './swap-quotes';

const LIFI_OK_FIXTURE = {
  type: 'lifi',
  id: 'e6034cd8-d905-4d81-a8af-e4aff4e411bc:0',
  tool: 'layerswap',
  action: {
    fromToken: { address: '0x0000000000000000000000000000000000000000', chainId: 1, symbol: 'ETH', decimals: 18 },
    toToken: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', chainId: 137, symbol: 'USDC.e', decimals: 6 },
    fromAmount: '100000000000000000',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  },
  estimate: {
    tool: 'layerswap',
    approvalAddress: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    toAmountMin: '166163059',
    toAmount: '167627101',
    fromAmount: '100000000000000000',
    feeCosts: [
      {
        name: 'LIFI Fixed Fee',
        token: { symbol: 'ETH', decimals: 18 },
        amount: '250000000000000',
        amountUSD: '0.4207',
        percentage: '0.0025',
        included: true,
      },
      {
        name: 'LayerSwap fee',
        token: { symbol: 'ETH', decimals: 18 },
        amount: '13520000000000',
        amountUSD: '0.022754',
        percentage: '0.0001',
        included: true,
      },
    ],
    gasCosts: [
      {
        type: 'SEND',
        price: '59722428',
        estimate: '179005',
        limit: '232707',
        amount: '10690613224140',
        amountUSD: '0.0180',
        token: { symbol: 'ETH', decimals: 18 },
      },
    ],
    executionDuration: 15,
    fromAmountUSD: '168.2710',
    toAmountUSD: '167.7414',
    skipApproval: true,
  },
};

const INPUT: SwapQuoteInput = {
  fromChain: 'eth',
  toChain: 'matic',
  fromToken: { kind: 'native', symbol: 'ETH', decimals: 18 },
  toToken: {
    kind: 'token',
    contract: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    symbol: 'USDC.e',
    decimals: 6,
  },
  fromAmountBaseUnits: '100000000000000000',
  fromAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  toAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
};

function fetchJson(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('lifiChainIdFor', () => {
  it('maps EVM chains to their own chain id and Solana to its LI.FI id', () => {
    expect(lifiChainIdFor('eth')).toBe(1);
    expect(lifiChainIdFor('matic')).toBe(137);
    expect(lifiChainIdFor('sol')).toBe(LIFI_SOLANA_CHAIN_ID);
  });

  it('returns null for chains LI.FI cannot route', () => {
    expect(lifiChainIdFor('btc')).toBeNull();
    expect(lifiChainIdFor('trx')).toBeNull();
    expect(lifiChainIdFor('ton')).toBeNull();
    expect(lifiChainIdFor('cardano')).toBeNull();
  });

  it('offers only routable chains, and at least the majors', () => {
    expect(SWAP_CHAINS).toContain('eth');
    expect(SWAP_CHAINS).toContain('sol');
    expect(SWAP_CHAINS).not.toContain('btc');
    expect(SWAP_CHAINS).not.toContain('ton');
  });
});

describe('lifiTokenAddress', () => {
  it('uses the zero address for EVM natives and the system address for SOL', () => {
    expect(
      lifiTokenAddress('eth', { kind: 'native', symbol: 'ETH', decimals: 18 }),
    ).toBe('0x0000000000000000000000000000000000000000');
    expect(
      lifiTokenAddress('sol', { kind: 'native', symbol: 'SOL', decimals: 9 }),
    ).toBe('11111111111111111111111111111111');
    expect(
      lifiTokenAddress('matic', {
        kind: 'token',
        contract: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        symbol: 'USDC.e',
        decimals: 6,
      }),
    ).toBe('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
  });
});

describe('fetchSwapQuote', () => {
  it('parses a live-shaped LI.FI quote into the screen fields', async () => {
    const result = await fetchSwapQuote(INPUT, {
      fetchFn: fetchJson(LIFI_OK_FIXTURE),
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.quote.tool).toBe('layerswap');
    expect(result.quote.toAmountBaseUnits).toBe('167627101');
    expect(result.quote.toAmountMinBaseUnits).toBe('166163059');
    expect(result.quote.toAmountUsd).toBe('167.7414');
    expect(result.quote.fromAmountUsd).toBe('168.2710');
    // 0.4207 LI.FI fee + 0.0228 bridge fee, summed to 4 decimals.
    expect(result.quote.feeUsd).toBe('0.4435');
    expect(result.quote.gasUsd).toBe('0.0180');
    expect(result.quote.executionDurationSeconds).toBe(15);
  });

  it('never surfaces the executable transactionRequest — quotes only', async () => {
    const result = await fetchSwapQuote(INPUT, {
      fetchFn: fetchJson({
        ...LIFI_OK_FIXTURE,
        transactionRequest: { to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE', data: '0xdeadbeef' },
      }),
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.quote).not.toHaveProperty('transactionRequest');
  });

  it('reports no-route when LI.FI says there is none, never a guessed quote', async () => {
    const result = await fetchSwapQuote(INPUT, {
      fetchFn: fetchJson({ message: 'No route found', code: 1001 }, 400),
    });
    expect(result).toEqual({ status: 'no-route' });
  });

  it('reports no-route for an unroutable chain without calling the network', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const result = await fetchSwapQuote(
      { ...INPUT, fromChain: 'btc', toChain: 'eth' },
      { fetchFn: spy },
    );
    expect(result).toEqual({ status: 'no-route' });
    expect(called).toBe(false);
  });

  it('maps a 429 to the rate-limited sentence, never the raw code', async () => {
    const result = await fetchSwapQuote(INPUT, {
      fetchFn: fetchJson({ message: 'Rate limit exceeded', code: 1005 }, 429),
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toContain('rate-limited');
      expect(result.reason).not.toContain('1005');
    }
  });

  it('maps a network failure to unavailable, never a thrown error', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const result = await fetchSwapQuote(INPUT, { fetchFn: failing });
    expect(result.status).toBe('unavailable');
  });

  it('treats a malformed success body as unavailable, never a partial quote (A-6)', async () => {
    // A 200 that does not parse is a provider hiccup, not proof that
    // no route exists — the same case maps to unavailable for Relay.
    const result = await fetchSwapQuote(INPUT, {
      fetchFn: fetchJson({ estimate: { toAmount: 'not-a-number' } }),
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toContain('unavailable');
    }
  });
});

describe('formatQuoteUsd', () => {
  it('formats LI.FI dollar figures to cents and passes null through', () => {
    expect(formatQuoteUsd('167.7414')).toBe('$167.74');
    expect(formatQuoteUsd('0.0180')).toBe('$0.02');
    expect(formatQuoteUsd(null)).toBeNull();
    expect(formatQuoteUsd(undefined)).toBeNull();
    expect(formatQuoteUsd('not-a-number')).toBeNull();
  });
});
