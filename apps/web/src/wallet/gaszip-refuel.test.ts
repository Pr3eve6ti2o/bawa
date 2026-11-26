// Tests for the gas.zip refuel client (Lane C). The ok fixtures are
// the shapes of real live responses fetched from backend.gas.zip on
// 2026-11-26 (0.005 ETH -> Base; the chains entries are verbatim
// rows from the live /v2/chains list) — real figures, not invented
// ones. No network is touched: fetch is stubbed.
import { describe, expect, it } from 'vitest';
import {
  GASZIP_MAX_USD_PER_CHAIN,
  GASZIP_MIN_USD_PER_CHAIN,
  fetchGasZipChains,
  fetchGasZipQuote,
  gasZipChainIdFor,
  gasZipDepositChains,
  gasZipLimitCheck,
  gasZipLimitMessage,
  isGasZipQuoteStale,
  type GasZipQuoteInput,
} from './gaszip-refuel';

const CHAINS_FIXTURE = {
  chains: [
    {
      bal: '566051882662003718',
      chain: 1,
      decimals: 18,
      explorer: 'https://etherscan.io',
      gas: '21000',
      gwei: '112240136',
      inbound: true,
      mainnet: true,
      maxInbound: 125000,
      maxInboundNative: 73230888202796830000,
      maxOutbound: 100,
      maxOutboundNative: 58584710562237464,
      minInbound: 0.015,
      minInboundNative: 8787706584335,
      minOutbound: 0.05,
      minOutboundNative: 29292355281118,
      name: 'Ethereum',
      price: 1706.93,
      rpcs: [],
      short: 255,
      symbol: 'ETH',
    },
    {
      bal: '6121737200000000000',
      chain: 501474,
      decimals: 9,
      explorer: 'https://solscan.io',
      gas: '0',
      gwei: '0',
      inbound: true,
      mainnet: true,
      maxInbound: 24000,
      maxInboundNative: 338218714768,
      maxOutbound: 0,
      maxOutboundNative: 0,
      minInbound: 0.015,
      minInboundNative: 211386,
      minOutbound: 0.015,
      minOutboundNative: 211386,
      name: 'Solana',
      price: 70.96,
      rpcs: [],
      short: 245,
      symbol: 'SOL',
    },
    {
      bal: '0',
      chain: 8453,
      decimals: 18,
      explorer: 'https://basescan.org',
      gas: '21000',
      gwei: '1000000',
      inbound: true,
      mainnet: true,
      maxInbound: 10000,
      maxInboundNative: 10000000000000000000000,
      maxOutbound: 2000,
      maxOutboundNative: 2000000000000000000000,
      minInbound: 0.015,
      minInboundNative: 15000000000000000,
      minOutbound: 0.015,
      minOutboundNative: 15000000000000000,
      name: 'Base',
      price: 1706.93,
      rpcs: [],
      short: 255,
      symbol: 'ETH',
    },
  ],
};

// Live 0.005 ETH -> Base quote, fetched 2026-11-26 (the docs example
// is 0.05 ETH -> Arbitrum; this is the real response for the smaller,
// in-limit amount).
const QUOTE_FIXTURE = {
  calldata: '0x010036',
  contractDepositTxn: {
    data: '0xc9630cb00000000000000000000000000000000000000000000000000000000000000036eafd154aed18c7b98205d008dd21f5de29122042000000000000000000000000',
    to: '0x2a37D63EAdFe4b4682a3c28C1c2cD4F109Cc2762',
    value: '0x11c37937e08000',
  },
  expires: 1795697166,
  quotes: [
    {
      chain: 8453,
      decimals: 18,
      expected: 4999610396600102,
      expectedNative: 4999610396600102,
      gas: 126000000000,
      speed: 3.0,
      usd: 8.5351,
    },
  ],
};

const SOLANA_FAILURE_FIXTURE = {
  error: 'Quote: Calldata Failure',
  quotes: [{ chain: 501474, error: 'Quote: Chain Limit Exceeded' }],
};

const INPUT: GasZipQuoteInput = {
  fromChain: 'eth',
  toChain: 'base',
  fromAmountBaseUnits: '5000000000000000',
  fromAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  toAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
};

function fetchJson(body: unknown, status = 200): typeof fetch {
  return (async (url: unknown) => {
    void url;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('gasZipChainIdFor', () => {
  it('maps EVM chains to their own id and Solana to its gas.zip id', () => {
    expect(gasZipChainIdFor('eth')).toBe(1);
    expect(gasZipChainIdFor('base')).toBe(8453);
    expect(gasZipChainIdFor('sol')).toBe(501474);
  });

  it('returns null for chains gas.zip does not list', () => {
    expect(gasZipChainIdFor('btc')).toBeNull();
    expect(gasZipChainIdFor('ton')).toBeNull();
    expect(gasZipChainIdFor('cosmos')).toBeNull();
  });
});

describe('fetchGasZipChains', () => {
  it('parses the live chain list, including prices and flags', async () => {
    const result = await fetchGasZipChains({ fetchFn: fetchJson(CHAINS_FIXTURE) });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.chains).toHaveLength(3);
    const eth = result.chains.find((entry) => entry.chainId === 1);
    expect(eth?.priceUsd).toBe(1706.93);
    expect(eth?.inbound).toBe(true);
    expect(eth?.mainnet).toBe(true);
    const sol = result.chains.find((entry) => entry.chainId === 501474);
    expect(sol?.maxOutboundUsd).toBe(0);
  });

  it('maps a 429 to the rate-limited sentence, never the raw code', async () => {
    const result = await fetchGasZipChains({ fetchFn: fetchJson({}, 429) });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toContain('rate-limited');
    }
  });

  it('maps a network failure to unavailable, never a thrown error', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const result = await fetchGasZipChains({ fetchFn: failing });
    expect(result.status).toBe('unavailable');
  });
});

describe('gasZipDepositChains', () => {
  it('offers mainnet inbound chains Bawa knows', async () => {
    const listed = await fetchGasZipChains({ fetchFn: fetchJson(CHAINS_FIXTURE) });
    expect(listed.status).toBe('ok');
    if (listed.status !== 'ok') return;
    const deposit = gasZipDepositChains(listed.chains);
    expect(deposit).toContain('eth');
    expect(deposit).toContain('base');
    expect(deposit).toContain('sol');
    expect(deposit).not.toContain('btc');
  });
});

describe('fetchGasZipQuote', () => {
  it('parses a live quote, including the per-chain deposit address', async () => {
    const result = await fetchGasZipQuote(INPUT, {
      fetchFn: fetchJson(QUOTE_FIXTURE),
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    // The deposit address comes from the live quote — and it is NOT
    // the docs example address (0x391E…604). That is the point.
    expect(result.quote.depositTo).toBe(
      '0x2a37D63EAdFe4b4682a3c28C1c2cD4F109Cc2762',
    );
    expect(result.quote.depositTo).not.toBe(
      '0x391E7C679d29bD940d63be94AD22A25d25b5A604',
    );
    expect(result.quote.depositValueHex).toBe('0x11c37937e08000');
    expect(result.quote.quotes).toHaveLength(1);
    expect(result.quote.quotes[0]?.expectedBaseUnits).toBe('4999610396600102');
    expect(result.quote.quotes[0]?.usd).toBe(8.5351);
    expect(result.quote.quotes[0]?.speedSeconds).toBe(3);
    // The fixture's real `expires` (1795697166) is the moment the
    // live quote was fetched — it has passed by now, so staleness is
    // covered by the dedicated test below, not here.
    expect(result.quote.expiresAtMs).toBe(1795697166000);
  });

  it('never quotes without a deposit address — a missing one is unavailable', async () => {
    const { contractDepositTxn: _dropped, ...withoutDeposit } = QUOTE_FIXTURE;
    void _dropped;
    const result = await fetchGasZipQuote(INPUT, {
      fetchFn: fetchJson(withoutDeposit),
    });
    expect(result.status).toBe('unavailable');
  });

  it('reports Solana as no-route with the live failure words', async () => {
    const result = await fetchGasZipQuote(
      { ...INPUT, toChain: 'sol' },
      { fetchFn: fetchJson(SOLANA_FAILURE_FIXTURE, 400) },
    );
    expect(result.status).toBe('no-route');
    if (result.status === 'no-route') {
      expect(result.reason).toContain('Chain Limit Exceeded');
    }
  });

  it('never calls the network for a chain gas.zip does not list', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const result = await fetchGasZipQuote(
      { ...INPUT, toChain: 'btc' },
      { fetchFn: spy },
    );
    expect(result.status).toBe('no-route');
    expect(called).toBe(false);
  });

  it('maps a network failure to unavailable, never a thrown error', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const result = await fetchGasZipQuote(INPUT, { fetchFn: failing });
    expect(result.status).toBe('unavailable');
  });
});

describe('gasZipLimitCheck', () => {
  it('enforces the $0.25–$50 per-chain limits', () => {
    expect(gasZipLimitCheck(0.24)).toBe('below-minimum');
    expect(gasZipLimitCheck(GASZIP_MIN_USD_PER_CHAIN)).toBe('ok');
    expect(gasZipLimitCheck(8.54)).toBe('ok');
    expect(gasZipLimitCheck(GASZIP_MAX_USD_PER_CHAIN)).toBe('ok');
    expect(gasZipLimitCheck(50.01)).toBe('above-maximum');
    expect(gasZipLimitCheck(null)).toBe('unknown');
    expect(gasZipLimitMessage('below-minimum')).toContain('$0.25');
    expect(gasZipLimitMessage('above-maximum')).toContain('$50.00');
    expect(gasZipLimitMessage('ok')).toBeNull();
  });
});

describe('isGasZipQuoteStale', () => {
  it('goes stale past 60 s or past expires, whichever is first', () => {
    const now = Date.now();
    const quote = {
      depositTo: '0x2a37D63EAdFe4b4682a3c28C1c2cD4F109Cc2762',
      depositData: '0x010036',
      depositValueHex: '0x11c37937e08000',
      expiresAtMs: now + 300_000,
      quotes: [
        {
          chainId: 8453,
          expectedBaseUnits: '4999610396600102',
          expectedNative: '4999610396600102',
          gasWei: '126000000000',
          speedSeconds: 3,
          usd: 8.5351,
        },
      ],
      fetchedAtMs: now,
    };
    expect(isGasZipQuoteStale(quote, now)).toBe(false);
    expect(isGasZipQuoteStale(quote, now + 61_000)).toBe(true);
    expect(isGasZipQuoteStale(quote, quote.expiresAtMs)).toBe(true);
    // A quote whose `expires` is nearer than 60 s goes stale then.
    expect(
      isGasZipQuoteStale({ ...quote, expiresAtMs: now + 30_000 }, now + 31_000),
    ).toBe(true);
  });
});
