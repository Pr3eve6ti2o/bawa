// Tests for the Relay quote client (Lane C). The ok fixture is the
// v3 response shape from Relay's own migration guide
// ("Migrating to Quote v3", docs.relay.link, read 2026-11-26): flat
// steps, top-level requestId, fees components as { usd, amount,
// amountFormatted }, origin gas in originGas, and
// details.currencyOut as { amount, amountUsd, minimumAmount }.
// No network is touched and no API key exists anywhere here: with no
// proxy configured the client must not even call fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RELAY_PROXY_URL_ENV,
  fetchRelayChains,
  fetchRelayQuote,
  relayChainIdFor,
  relayCurrencyAddress,
  relayProxyBaseUrl,
  type RelayQuoteInput,
} from './relay-quotes';

// v3 quote shape (migration guide): one flat transaction step, fees
// as { usd, amount, amountFormatted } components, details with
// currencyIn/currencyOut, totalImpact nullable.
const QUOTE_V3_FIXTURE = {
  requestId:
    '0x20538510fd9eab7a90c3e54418f8f477bfef24d83c11955a8ca835e6154b59d3',
  steps: [
    {
      id: 'deposit',
      kind: 'transaction',
      status: 'incomplete',
      data: {
        to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
        data: '0xdeadbeef',
        value: '100000000000000',
        chainId: 8453,
      },
      check: {
        endpoint: '/intents/status/v3?requestId=0x20538510fd9eab7a90c3e54418f8f477bfef24d83c11955a8ca835e6154b59d3',
      },
    },
  ],
  fees: {
    gas: { usd: '0.02', amount: '100', amountFormatted: '0.0001' },
    relayer: { usd: '0.01', amount: '50', amountFormatted: '0.00005' },
  },
  originGas: { amount: '200', amountUsd: '0.03' },
  details: {
    operation: 'bridge',
    currencyIn: {
      amount: '100000000000000',
      amountFormatted: '0.0001',
      amountUsd: '0.17',
      minimumAmount: '100000000000000',
    },
    currencyOut: {
      amount: '99900000000000',
      amountFormatted: '0.0000999',
      amountUsd: '0.1699',
      minimumAmount: '99000000000000',
    },
    timeEstimate: 20,
    totalImpact: null,
    rate: '0.999',
  },
};

const CHAINS_FIXTURE = {
  chains: [
    {
      id: 1,
      name: 'ethereum',
      displayName: 'Ethereum',
      tokenSupport: 'All',
      disabled: false,
      vmType: 'evm',
    },
    {
      id: 537724,
      name: 'xrp',
      displayName: 'XRP',
      tokenSupport: 'Limited',
      disabled: false,
      vmType: 'xrpvm',
    },
  ],
};

const INPUT: RelayQuoteInput = {
  fromChain: 'base',
  toChain: 'arb',
  fromToken: { kind: 'native', symbol: 'ETH', decimals: 18 },
  toToken: { kind: 'native', symbol: 'ETH', decimals: 18 },
  fromAmountBaseUnits: '100000000000000',
  fromAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  toAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
};

function fetchJson(body: unknown, status = 200): typeof fetch {
  return (async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('relayProxyBaseUrl', () => {
  it('is null by default — no proxy, no Relay quotes', () => {
    expect(relayProxyBaseUrl()).toBeNull();
  });

  it('reads the env and strips a trailing slash', () => {
    vi.stubEnv(RELAY_PROXY_URL_ENV, 'https://proxy.example.com/relay/');
    expect(relayProxyBaseUrl()).toBe('https://proxy.example.com/relay');
  });

  it('treats a blank value as unset', () => {
    vi.stubEnv(RELAY_PROXY_URL_ENV, '   ');
    expect(relayProxyBaseUrl()).toBeNull();
  });
});

describe('relayChainIdFor', () => {
  it('maps EVM chains to their own id and non-EVM chains to Relay ids', () => {
    expect(relayChainIdFor('eth')).toBe(1);
    expect(relayChainIdFor('matic')).toBe(137);
    expect(relayChainIdFor('base')).toBe(8453);
    expect(relayChainIdFor('btc')).toBe(8253038);
    expect(relayChainIdFor('sol')).toBe(792703809);
    expect(relayChainIdFor('ton')).toBe(224235520);
    expect(relayChainIdFor('trx')).toBe(728126428);
    expect(relayChainIdFor('xrp')).toBe(537724);
  });

  it('returns null for chains Relay does not list (live /chains, 2026-11-26)', () => {
    expect(relayChainIdFor('ltc')).toBeNull();
    expect(relayChainIdFor('doge')).toBeNull();
    expect(relayChainIdFor('fraxtal')).toBeNull();
    expect(relayChainIdFor('cosmos')).toBeNull();
    expect(relayChainIdFor('cardano')).toBeNull();
    expect(relayChainIdFor('starknet')).toBeNull();
  });
});

describe('relayCurrencyAddress', () => {
  it('uses the zero address for EVM natives and contracts for EVM tokens', () => {
    expect(
      relayCurrencyAddress('eth', { kind: 'native', symbol: 'ETH', decimals: 18 }),
    ).toBe('0x0000000000000000000000000000000000000000');
    expect(
      relayCurrencyAddress('matic', {
        kind: 'token',
        contract: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        symbol: 'USDC.e',
        decimals: 6,
      }),
    ).toBe('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
  });

  it('uses the live /chains currency addresses for non-EVM natives', () => {
    expect(
      relayCurrencyAddress('sol', { kind: 'native', symbol: 'SOL', decimals: 9 }),
    ).toBe('11111111111111111111111111111111');
    expect(
      relayCurrencyAddress('btc', { kind: 'native', symbol: 'BTC', decimals: 8 }),
    ).toBe('bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqmql8k8');
    expect(
      relayCurrencyAddress('ton', { kind: 'native', symbol: 'TON', decimals: 9 }),
    ).toBe('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c');
    expect(
      relayCurrencyAddress('xrp', { kind: 'native', symbol: 'XRP', decimals: 6 }),
    ).toBe('xrp');
  });

  it('limits the non-EVM legs to their solver currencies', () => {
    // TON: GRAM only — a TON USDT is not a Relay solver currency.
    expect(
      relayCurrencyAddress('ton', {
        kind: 'token',
        contract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        symbol: 'USDT',
        decimals: 6,
      }),
    ).toBeNull();
    // TRON: USDT and TRX only.
    expect(
      relayCurrencyAddress('trx', {
        kind: 'token',
        contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        symbol: 'USDT',
        decimals: 6,
      }),
    ).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    expect(
      relayCurrencyAddress('trx', {
        kind: 'token',
        contract: 'TXYZFakeTokenAddress00000000000000000001',
        symbol: 'FAKE',
        decimals: 6,
      }),
    ).toBeNull();
    // BTC / XRP: native only.
    expect(
      relayCurrencyAddress('btc', {
        kind: 'token',
        contract: 'wrapped-btc',
        symbol: 'WBTC',
        decimals: 8,
      }),
    ).toBeNull();
  });
});

describe('fetchRelayQuote', () => {
  it('reports not-configured without touching the network', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const result = await fetchRelayQuote(INPUT, {
      fetchFn: spy,
      proxyUrl: null,
    });
    expect(result.status).toBe('not-configured');
    if (result.status === 'not-configured') {
      expect(result.reason).toContain('proxy or access-token endpoint');
      expect(result.reason).toContain('not set up yet');
    }
    expect(called).toBe(false);
  });

  it('posts the quickstart body to the proxy and parses a v3 quote', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const spy = (async (url: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), init: init as RequestInit });
      return new Response(JSON.stringify(QUOTE_V3_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const result = await fetchRelayQuote(INPUT, {
      fetchFn: spy,
      proxyUrl: 'https://proxy.example.com/relay',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://proxy.example.com/relay/quote/v3');
    expect(seen[0]?.init.method).toBe('POST');
    // No API key is ever sent from the browser: the proxy appends it.
    const headers = seen[0]?.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(String(seen[0]?.init.body)) as Record<string, unknown>;
    expect(body.originChainId).toBe(8453);
    expect(body.destinationChainId).toBe(42161);
    expect(body.tradeType).toBe('EXACT_INPUT');
    expect(result.quote.requestId).toBe(
      '0x20538510fd9eab7a90c3e54418f8f477bfef24d83c11955a8ca835e6154b59d3',
    );
    expect(result.quote.toAmountBaseUnits).toBe('99900000000000');
    expect(result.quote.toAmountMinBaseUnits).toBe('99000000000000');
    expect(result.quote.toAmountUsd).toBe('0.1699');
    expect(result.quote.feeUsd).toBe('0.0300');
    expect(result.quote.gasUsd).toBe('0.03');
    expect(result.quote.executionDurationSeconds).toBe(20);
    expect(result.quote.stepCount).toBe(1);
    // Quotes only: no executable step data is ever returned.
    expect(result.quote).not.toHaveProperty('steps');
  });

  it('sends an access token as a Bearer header when one is held', async () => {
    const seen: RequestInit[] = [];
    const spy = (async (_url: unknown, init?: RequestInit) => {
      seen.push(init as RequestInit);
      return new Response(JSON.stringify(QUOTE_V3_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const result = await fetchRelayQuote(INPUT, {
      fetchFn: spy,
      proxyUrl: 'https://proxy.example.com/relay',
      accessToken: 'token-15-min',
    });
    expect(result.status).toBe('ok');
    const headers = seen[0]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-15-min');
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('maps a 401 to not-configured — the proxy or token is not set up', async () => {
    const result = await fetchRelayQuote(INPUT, {
      fetchFn: fetchJson({ errorCode: 'UNAUTHORIZED_QUOTE' }, 401),
      proxyUrl: 'https://proxy.example.com/relay',
    });
    expect(result.status).toBe('not-configured');
  });

  it('maps a 429 to the rate-limited sentence', async () => {
    const result = await fetchRelayQuote(INPUT, {
      fetchFn: fetchJson({}, 429),
      proxyUrl: 'https://proxy.example.com/relay',
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toContain('rate-limited');
    }
  });

  it('reports no-route for an unlisted token without calling the network', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const result = await fetchRelayQuote(
      {
        ...INPUT,
        fromChain: 'ton',
        fromToken: {
          kind: 'token',
          contract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          symbol: 'USDT',
          decimals: 6,
        },
      },
      { fetchFn: spy, proxyUrl: 'https://proxy.example.com/relay' },
    );
    expect(result).toEqual({ status: 'no-route' });
    expect(called).toBe(false);
  });

  it('treats a malformed success body as unavailable, never a partial quote', async () => {
    const result = await fetchRelayQuote(INPUT, {
      fetchFn: fetchJson({ steps: [], requestId: '0xabc' }),
      proxyUrl: 'https://proxy.example.com/relay',
    });
    expect(result.status).toBe('unavailable');
  });

  it('maps a network failure to unavailable, never a thrown error', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const result = await fetchRelayQuote(INPUT, {
      fetchFn: failing,
      proxyUrl: 'https://proxy.example.com/relay',
    });
    expect(result.status).toBe('unavailable');
  });
});

describe('fetchRelayChains', () => {
  it('reports not-configured without a proxy', async () => {
    const result = await fetchRelayChains({ proxyUrl: null });
    expect(result.status).toBe('not-configured');
  });

  it('parses the live chain list shape', async () => {
    const result = await fetchRelayChains({
      fetchFn: fetchJson(CHAINS_FIXTURE),
      proxyUrl: 'https://proxy.example.com/relay',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.chains).toHaveLength(2);
    const xrp = result.chains.find((entry) => entry.name === 'xrp');
    expect(xrp?.id).toBe(537724);
    expect(xrp?.vmType).toBe('xrpvm');
    expect(xrp?.tokenSupport).toBe('Limited');
    expect(xrp?.disabled).toBe(false);
  });
});
