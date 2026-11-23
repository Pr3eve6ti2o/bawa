// Native-price fallbacks after CoinGecko (Lane C, finish-the-product).
// Every fixture below is a live provider shape captured 2026-11-23
// (see the module note in price-fallbacks.ts for the per-source
// verdicts). A token no source prices stays "unavailable" — never a
// guessed price.
import { describe, expect, it, vi } from 'vitest';
import {
  COINLORE_NATIVE_IDS,
  NATIVE_WRAPPED_TOKENS,
  applyPriceFallbacks,
  fetchCoinLorePrices,
  fetchCoinbaseLtcPrice,
  fetchDexScreenerNativePrices,
  parseCoinLoreResponse,
  parseCoinbaseResponse,
  parseDexScreenerNativeResponse,
} from './price-fallbacks';
import {
  PRICE_ASSET_IDS,
  idlePriceEntries,
  type PriceEntry,
  type PriceMap,
} from './prices';

const NOW_MS = Date.UTC(2026, 10, 23, 10, 0, 0);

const WFTM = '0x21be370d5312f44cB42ce377BC9b8a0cEF1A4C83';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// Live shape, CoinLore /api/ticker/?id=90,80, 2026-11-23: BTC
// $62,966.86, ETH $1,779.75 (CoinGecko then: $63,132 / $1,782.26).
function coinLoreBatch(): Record<string, unknown>[] {
  return [
    {
      id: '90',
      symbol: 'BTC',
      name: 'Bitcoin',
      nameid: 'bitcoin',
      rank: 1,
      price_usd: '62966.86',
      percent_change_24h: '3.34',
      price_btc: '1.00',
      market_cap_usd: '1257501768387.90',
      volume24: 98852253090.8955,
      csupply: '19970852.00',
      tsupply: '19970852',
      msupply: '21000000',
    },
    {
      id: '80',
      symbol: 'ETH',
      name: 'Ethereum',
      nameid: 'ethereum',
      rank: 2,
      price_usd: '1779.75',
      percent_change_24h: '3.55',
      price_btc: '0.029752',
      market_cap_usd: '217796057477.29',
      volume24: 12345678901.23,
      csupply: '120000000.00',
      tsupply: '120000000',
      msupply: '0',
    },
  ];
}

// Live shape, DexScreener tokens/v1/fantom/<WFTM>, 2026-11-23: the
// single top pair is BOO/WFTM — WFTM is the QUOTE token, so priceUsd
// ($0.02610) is BOO's price, not WFTM's. The implied WFTM price is
// priceUsd / priceNative = 0.02610 / 0.8779 = $0.02973, which matches
// Sonic (S) at $0.029725 on CoinLore the same day.
function wftmPair(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chainId: 'fantom',
    dexId: 'spookyswap',
    pairAddress: '0xEc7178F4C41f346b2721907F5cF7628E388A7a58',
    baseToken: {
      address: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE',
      name: 'SpookyToken',
      symbol: 'BOO',
    },
    quoteToken: { address: WFTM, name: 'Wrapped Fantom', symbol: 'WFTM' },
    priceNative: '0.8779',
    priceUsd: '0.02610',
    liquidity: { usd: 54560.39, base: 2090000, quote: 1835000 },
    ...overrides,
  };
}

// Live shape, DexScreener tokens/v1/ethereum/<WETH>, 2026-11-23:
// WETH/USDC on Uniswap v3, WETH as the base token, $1,777.95.
function wethPair(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chainId: 'ethereum',
    dexId: 'uniswap',
    pairAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    baseToken: { address: WETH, name: 'Wrapped Ether', symbol: 'WETH' },
    quoteToken: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      name: 'USD Coin',
      symbol: 'USDC',
    },
    priceNative: '1777.9564',
    priceUsd: '1777.95',
    liquidity: { usd: 123456789, base: 69400, quote: 123456789 },
    ...overrides,
  };
}

// Live shape, Coinbase Exchange GET /products/LTC-USD/ticker,
// 2026-11-23: LTC $42.956 (Kraken $42.92, CoinGecko $42.95).
function coinbaseLtcTicker(): Record<string, unknown> {
  return {
    ask: '42.972',
    bid: '42.951',
    volume: '147494.1773326',
    trade_id: 202353916,
    price: '42.956',
    size: '4.75184314',
    time: '2026-11-23T15:11:26.468124473Z',
  };
}

type Route = { match: string; body: unknown; status?: number; throws?: boolean };

function stubFetch(routes: Route[]) {
  const calls: string[] = [];
  const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    calls.push(u);
    const route = routes.find((r) => u.includes(r.match));
    if (route === undefined) throw new Error(`unexpected fetch: ${u}`);
    if (route.throws === true) throw new Error('boom');
    const status = route.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => route.body,
      headers: { get: () => null },
    };
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

function freshCg(chain: keyof PriceMap, usdPrice: string, ageMs = 30_000): PriceEntry {
  return {
    status: 'fresh',
    quote: {
      chain,
      assetId: PRICE_ASSET_IDS[chain],
      providerAssetId: 'coingecko',
      usdPrice,
      providerUpdatedAtMs: NOW_MS - ageMs,
      fetchedAtMs: NOW_MS,
      source: 'CoinGecko',
    },
  };
}

function expiredCg(chain: keyof PriceMap, usdPrice: string): PriceEntry {
  // CoinGecko's live Fantom quote, 2026-11-23: $0.02543177 with
  // last_updated_at ~8h old, far past the 10-minute window.
  return {
    status: 'expired',
    quote: {
      chain,
      assetId: PRICE_ASSET_IDS[chain],
      providerAssetId: 'fantom',
      usdPrice,
      providerUpdatedAtMs: NOW_MS - 8 * 3_600_000,
      fetchedAtMs: NOW_MS,
      source: 'CoinGecko',
    },
  };
}

describe('COINLORE_NATIVE_IDS', () => {
  it('maps each native asset to its CoinLore id — and nothing else', () => {
    expect(COINLORE_NATIVE_IDS.btc).toBe('90');
    expect(COINLORE_NATIVE_IDS.eth).toBe('80');
    // ETH-native L2s price as ETH, never as their governance tokens.
    expect(COINLORE_NATIVE_IDS.arb).toBe('80');
    expect(COINLORE_NATIVE_IDS.op).toBe('80');
    expect(COINLORE_NATIVE_IDS.base).toBe('80');
    expect(COINLORE_NATIVE_IDS.linea).toBe('80');
    expect(COINLORE_NATIVE_IDS.scroll).toBe('80');
    expect(COINLORE_NATIVE_IDS.aurora).toBe('80');
    expect(COINLORE_NATIVE_IDS.bsc).toBe('2710');
    expect(COINLORE_NATIVE_IDS.opbnb).toBe('2710');
    expect(COINLORE_NATIVE_IDS.sol).toBe('48543');
    expect(COINLORE_NATIVE_IDS.trx).toBe('2713');
    expect(COINLORE_NATIVE_IDS.doge).toBe('2');
    expect(COINLORE_NATIVE_IDS.avax).toBe('44883');
    expect(COINLORE_NATIVE_IDS.celo).toBe('44425');
    expect(COINLORE_NATIVE_IDS.metis).toBe('49563');
    // TON: CoinLore quoted $1.78 live against CoinGecko/TonAPI $1.015
    // — a stale quote, so TON is priced by TonAPI instead.
    expect(COINLORE_NATIVE_IDS.ton).toBeUndefined();
    // MATIC: CoinLore quoted $0.377 live against CoinGecko POL
    // $0.0788 — a stale legacy listing, so Polygon is priced by
    // DexScreener (WPOL) instead.
    expect(COINLORE_NATIVE_IDS.matic).toBeUndefined();
    // LTC and FTM are absent from CoinLore's top-500 tickers (live):
    // LTC is priced by Coinbase, FTM by DexScreener.
    expect(COINLORE_NATIVE_IDS.ltc).toBeUndefined();
    expect(COINLORE_NATIVE_IDS.fantom).toBeUndefined();
    // Gnosis (xDAI) and Mantle (MNT) have no verified CoinLore quote.
    expect(COINLORE_NATIVE_IDS.gnosis).toBeUndefined();
    expect(COINLORE_NATIVE_IDS.mantle).toBeUndefined();
  });
});

describe('NATIVE_WRAPPED_TOKENS', () => {
  it('maps the wrapped natives DexScreener prices live — and nothing unverified', () => {
    expect(NATIVE_WRAPPED_TOKENS.eth).toEqual({
      dexChain: 'ethereum',
      contract: WETH,
    });
    expect(NATIVE_WRAPPED_TOKENS.bsc?.contract).toBe(
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    );
    expect(NATIVE_WRAPPED_TOKENS.matic?.contract).toBe(
      '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    );
    expect(NATIVE_WRAPPED_TOKENS.fantom).toEqual({
      dexChain: 'fantom',
      contract: WFTM,
    });
    expect(NATIVE_WRAPPED_TOKENS.sol?.contract).toBe(
      'So11111111111111111111111111111111111111112',
    );
    expect(NATIVE_WRAPPED_TOKENS.avax?.contract).toBe(
      '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    );
    // Linea and Aurora return [] from tokens/v1 for WETH (live), so
    // they have no DexScreener leg — CoinLore (ETH) covers them.
    expect(NATIVE_WRAPPED_TOKENS.linea).toBeUndefined();
    expect(NATIVE_WRAPPED_TOKENS.aurora).toBeUndefined();
    // No verified wrapped contract for TRX, Metis or Mantle.
    expect(NATIVE_WRAPPED_TOKENS.trx).toBeUndefined();
    expect(NATIVE_WRAPPED_TOKENS.metis).toBeUndefined();
    expect(NATIVE_WRAPPED_TOKENS.mantle).toBeUndefined();
    // BTC, LTC, DOGE and TON have no DEX-wrapped native.
    expect(NATIVE_WRAPPED_TOKENS.btc).toBeUndefined();
    expect(NATIVE_WRAPPED_TOKENS.ltc).toBeUndefined();
    expect(NATIVE_WRAPPED_TOKENS.doge).toBeUndefined();
    expect(NATIVE_WRAPPED_TOKENS.ton).toBeUndefined();
    expect(NATIVE_WRAPPED_TOKENS.gnosis).toBeUndefined();
  });
});

describe('parseCoinLoreResponse', () => {
  it('returns fresh CoinLore quotes for the requested chains', () => {
    const entries = parseCoinLoreResponse(coinLoreBatch(), ['btc', 'eth'], NOW_MS);
    expect(entries.btc).toEqual({
      status: 'fresh',
      quote: {
        chain: 'btc',
        assetId: PRICE_ASSET_IDS.btc,
        providerAssetId: '90',
        usdPrice: '62966.86',
        providerUpdatedAtMs: NOW_MS,
        fetchedAtMs: NOW_MS,
        source: 'CoinLore',
      },
    });
    expect(entries.eth?.status).toBe('fresh');
    if (entries.eth?.status === 'fresh') {
      expect(entries.eth.quote.usdPrice).toBe('1779.75');
      expect(entries.eth.quote.source).toBe('CoinLore');
    }
  });

  it('prices ETH-native L2s from the shared ETH id', () => {
    const entries = parseCoinLoreResponse(coinLoreBatch(), ['arb', 'base'], NOW_MS);
    expect(entries.arb?.status).toBe('fresh');
    expect(entries.base?.status).toBe('fresh');
    if (entries.arb?.status === 'fresh') {
      expect(entries.arb.quote.usdPrice).toBe('1779.75');
    }
  });

  it('marks a chain unavailable when its id is absent from the batch', () => {
    const entries = parseCoinLoreResponse(coinLoreBatch(), ['btc', 'sol'], NOW_MS);
    expect(entries.btc?.status).toBe('fresh');
    expect(entries.sol).toEqual({ status: 'unavailable', reason: 'missing' });
  });

  it('rejects zero, negative and non-numeric prices', () => {
    const payload = [
      { id: '90', symbol: 'BTC', price_usd: '0' },
      { id: '80', symbol: 'ETH', price_usd: '-5' },
      { id: '2710', symbol: 'BNB', price_usd: 'not-a-price' },
    ];
    const entries = parseCoinLoreResponse(payload, ['btc', 'eth', 'bsc'], NOW_MS);
    expect(entries.btc).toEqual({ status: 'unavailable', reason: 'invalid-price' });
    expect(entries.eth).toEqual({ status: 'unavailable', reason: 'invalid-price' });
    expect(entries.bsc).toEqual({ status: 'unavailable', reason: 'invalid-price' });
  });

  it('returns provider errors for a malformed payload', () => {
    const entries = parseCoinLoreResponse({ error: 'nope' }, ['btc'], NOW_MS);
    expect(entries.btc).toEqual({ status: 'error', reason: 'provider' });
  });
});

describe('parseDexScreenerNativeResponse', () => {
  it('returns a fresh DexScreener quote when the wrapped token is the base token', () => {
    const entry = parseDexScreenerNativeResponse([wethPair()], 'eth', WETH, NOW_MS);
    expect(entry).toEqual({
      status: 'fresh',
      quote: {
        chain: 'eth',
        assetId: PRICE_ASSET_IDS.eth,
        providerAssetId: WETH,
        usdPrice: '1777.95',
        providerUpdatedAtMs: NOW_MS,
        fetchedAtMs: NOW_MS,
        source: 'DexScreener',
      },
    });
  });

  it('derives the quote-side price for WFTM instead of misreading the base price', () => {
    // The trap: priceUsd $0.02610 is BOO's price. The implied WFTM
    // price is 0.02610 / 0.8779 = $0.02973 (live, matches Sonic S).
    const entry = parseDexScreenerNativeResponse([wftmPair()], 'fantom', WFTM, NOW_MS);
    expect(entry.status).toBe('fresh');
    if (entry.status === 'fresh') {
      expect(entry.quote.source).toBe('DexScreener');
      expect(Number(entry.quote.usdPrice)).toBeCloseTo(0.02973, 4);
      expect(entry.quote.usdPrice).not.toBe('0.02610');
    }
  });

  it('marks the chain unavailable when no pair involves the wrapped token', () => {
    expect(parseDexScreenerNativeResponse([], 'linea', WETH, NOW_MS)).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });

  it('returns a provider error for a malformed payload', () => {
    expect(parseDexScreenerNativeResponse({ nope: true }, 'eth', WETH, NOW_MS)).toEqual({
      status: 'error',
      reason: 'provider',
    });
  });

  it('rejects a quote-side pair with an unusable priceNative', () => {
    const entry = parseDexScreenerNativeResponse(
      [wftmPair({ priceNative: '0' })],
      'fantom',
      WFTM,
      NOW_MS,
    );
    expect(entry).toEqual({ status: 'unavailable', reason: 'invalid-price' });
  });
});

describe('parseCoinbaseResponse', () => {
  it('returns a fresh Coinbase quote for LTC', () => {
    const entry = parseCoinbaseResponse(coinbaseLtcTicker(), 'ltc', NOW_MS);
    expect(entry).toEqual({
      status: 'fresh',
      quote: {
        chain: 'ltc',
        assetId: PRICE_ASSET_IDS.ltc,
        providerAssetId: 'LTC-USD',
        usdPrice: '42.956',
        providerUpdatedAtMs: NOW_MS,
        fetchedAtMs: NOW_MS,
        source: 'Coinbase',
      },
    });
  });

  it('marks the chain unavailable for a delisted product', () => {
    expect(parseCoinbaseResponse({ message: 'NotFound' }, 'ltc', NOW_MS)).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });

  it('rejects a missing or invalid price', () => {
    expect(parseCoinbaseResponse({ price: '0' }, 'ltc', NOW_MS)).toEqual({
      status: 'unavailable',
      reason: 'invalid-price',
    });
    expect(parseCoinbaseResponse({}, 'ltc', NOW_MS)).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });
});

describe('fetchCoinLorePrices', () => {
  it('batches the requested ids into one keyless call', async () => {
    const { fetchFn, calls } = stubFetch([
      { match: 'api.coinlore.net', body: coinLoreBatch() },
    ]);
    const entries = await fetchCoinLorePrices(fetchFn, ['btc', 'eth'], NOW_MS);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe('https://api.coinlore.net/api/ticker/?id=90,80');
    expect(entries.btc?.status).toBe('fresh');
    expect(entries.eth?.status).toBe('fresh');
  });

  it('deduplicates ids shared by ETH-native chains', async () => {
    const { fetchFn, calls } = stubFetch([
      { match: 'api.coinlore.net', body: coinLoreBatch() },
    ]);
    await fetchCoinLorePrices(fetchFn, ['eth', 'arb', 'op'], NOW_MS);
    expect(calls[0]).toBe('https://api.coinlore.net/api/ticker/?id=80');
  });

  it('maps a 429 to rate-limited entries', async () => {
    const { fetchFn } = stubFetch([
      { match: 'api.coinlore.net', body: { error: 'slow down' }, status: 429 },
    ]);
    const entries = await fetchCoinLorePrices(fetchFn, ['btc'], NOW_MS);
    expect(entries.btc).toEqual({ status: 'error', reason: 'rate-limited' });
  });
});

describe('fetchDexScreenerNativePrices', () => {
  it('prices natives from their wrapped-token pairs, one call per chain', async () => {
    const { fetchFn, calls } = stubFetch([
      { match: 'tokens/v1/ethereum', body: [wethPair()] },
      { match: 'tokens/v1/fantom', body: [wftmPair()] },
    ]);
    const entries = await fetchDexScreenerNativePrices(fetchFn, ['eth', 'fantom'], NOW_MS);
    expect(calls).toHaveLength(2);
    expect(calls.some((u) => u.includes('tokens/v1/ethereum/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'))).toBe(true);
    expect(calls.some((u) => u.includes('tokens/v1/fantom/0x21be370d5312f44cB42ce377BC9b8a0cEF1A4C83'))).toBe(true);
    expect(entries.eth?.status).toBe('fresh');
    expect(entries.fantom?.status).toBe('fresh');
    if (entries.fantom?.status === 'fresh') {
      expect(Number(entries.fantom.quote.usdPrice)).toBeCloseTo(0.02973, 4);
    }
  });
});

describe('fetchCoinbaseLtcPrice', () => {
  it('fetches the LTC-USD ticker', async () => {
    const { fetchFn, calls } = stubFetch([
      { match: 'api.exchange.coinbase.com', body: coinbaseLtcTicker() },
    ]);
    const entry = await fetchCoinbaseLtcPrice(fetchFn, NOW_MS);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe('https://api.exchange.coinbase.com/products/LTC-USD/ticker');
    expect(entry.status).toBe('fresh');
  });
});

describe('applyPriceFallbacks', () => {
  function cgEntries(overrides: Partial<PriceMap>): PriceMap {
    return { ...idlePriceEntries(), ...overrides };
  }

  it('replaces an expired Fantom quote with the live DexScreener implied price', async () => {
    const { fetchFn } = stubFetch([
      { match: 'tokens/v1/fantom', body: [wftmPair()] },
    ]);
    const merged = await applyPriceFallbacks(
      fetchFn,
      cgEntries({ fantom: expiredCg('fantom', '0.02543177') }),
      NOW_MS,
    );
    expect(merged.fantom?.status).toBe('fresh');
    if (merged.fantom?.status === 'fresh') {
      expect(merged.fantom.quote.source).toBe('DexScreener');
      expect(Number(merged.fantom.quote.usdPrice)).toBeCloseTo(0.02973, 4);
    }
  });

  it('fills a fully rate-limited CoinGecko map from CoinLore, TonAPI and Coinbase', async () => {
    const errorEntry: PriceEntry = { status: 'error', reason: 'rate-limited' };
    const cg = cgEntries({
      btc: errorEntry,
      eth: errorEntry,
      ton: errorEntry,
      ltc: errorEntry,
      gnosis: errorEntry,
      mantle: errorEntry,
    });
    const { fetchFn, calls } = stubFetch([
      { match: 'api.coinlore.net', body: coinLoreBatch() },
      {
        match: 'tonapi.io',
        body: { rates: { TON: { prices: { USD: 1.0150255754475703 } } } },
      },
      { match: 'api.exchange.coinbase.com', body: coinbaseLtcTicker() },
      // Every other needing chain falls through to DexScreener, which
      // has no pair for it in this stub — honestly unavailable.
      { match: 'tokens/v1', body: [] },
    ]);
    const merged = await applyPriceFallbacks(fetchFn, cg, NOW_MS);
    expect(merged.btc?.status).toBe('fresh');
    if (merged.btc?.status === 'fresh') {
      expect(merged.btc.quote.source).toBe('CoinLore');
      expect(merged.btc.quote.usdPrice).toBe('62966.86');
    }
    expect(merged.eth?.status).toBe('fresh');
    if (merged.eth?.status === 'fresh') {
      expect(merged.eth.quote.source).toBe('CoinLore');
    }
    expect(merged.ton?.status).toBe('fresh');
    if (merged.ton?.status === 'fresh') {
      expect(merged.ton.quote.source).toBe('TonAPI');
      expect(merged.ton.quote.usdPrice).toBe('1.0150255754475703');
    }
    expect(merged.ltc?.status).toBe('fresh');
    if (merged.ltc?.status === 'fresh') {
      expect(merged.ltc.quote.source).toBe('Coinbase');
      expect(merged.ltc.quote.usdPrice).toBe('42.956');
    }
    // Gnosis and Mantle have no verified fallback: the CoinGecko
    // error stands, honestly, instead of an invented price.
    expect(merged.gnosis).toEqual(errorEntry);
    expect(merged.mantle).toEqual(errorEntry);
    expect(calls.some((u) => u.includes('api.coinlore.net'))).toBe(true);
    expect(calls.some((u) => u.includes('tonapi.io'))).toBe(true);
    expect(calls.some((u) => u.includes('api.exchange.coinbase.com'))).toBe(true);
  });

  it('leaves a fresh CoinGecko quote untouched and tries no fallback', async () => {
    const { fetchFn } = stubFetch([]);
    // Every chain is fresh except the two under test — nothing needs
    // a fallback, so no provider is called at all.
    const cg = cgEntries({ btc: freshCg('btc', '62683'), eth: freshCg('eth', '1774.93') });
    for (const chain of Object.keys(cg) as Array<keyof PriceMap>) {
      if (chain !== 'btc' && chain !== 'eth') cg[chain] = freshCg(chain, '1');
    }
    const merged = await applyPriceFallbacks(fetchFn, cg, NOW_MS);
    expect(merged.btc).toEqual(freshCg('btc', '62683'));
    expect(merged.eth).toEqual(freshCg('eth', '1774.93'));
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('keeps the original CoinGecko entry when every fallback fails', async () => {
    const { fetchFn } = stubFetch([
      { match: 'tokens/v1/fantom', body: [], status: 200, throws: true },
    ]);
    const original = expiredCg('fantom', '0.02543177');
    const merged = await applyPriceFallbacks(
      fetchFn,
      cgEntries({ fantom: original }),
      NOW_MS,
    );
    expect(merged.fantom).toEqual(original);
  });

  it('prefers CoinLore over DexScreener when both could price the chain', async () => {
    const { fetchFn, calls } = stubFetch([
      { match: 'api.coinlore.net', body: coinLoreBatch() },
      { match: 'tokens/v1/ethereum', body: [wethPair()] },
    ]);
    // Only ETH needs a fallback — every other chain is fresh, so no
    // other provider is called for any other chain either.
    const cg = cgEntries({ eth: { status: 'error', reason: 'network' } });
    for (const chain of Object.keys(cg) as Array<keyof PriceMap>) {
      if (chain !== 'eth') cg[chain] = freshCg(chain, '1');
    }
    const merged = await applyPriceFallbacks(fetchFn, cg, NOW_MS);
    expect(merged.eth?.status).toBe('fresh');
    if (merged.eth?.status === 'fresh') {
      expect(merged.eth.quote.source).toBe('CoinLore');
      expect(merged.eth.quote.usdPrice).toBe('1779.75');
    }
    // CoinLore filled ETH, so no DexScreener call for it at all.
    expect(calls.some((u) => u.includes('tokens/v1'))).toBe(false);
  });
});
