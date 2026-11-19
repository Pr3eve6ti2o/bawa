```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_QUOTE_AGE_MS,
  PRICE_ASSET_IDS,
  PRICE_IDS,
  isFreshQuote,
  parsePriceResponse,
  usdPriceToMinorUnitsPerWhole,
} from './prices';
import type { PriceQuote } from './prices';

const NOW_MS = Date.UTC(2026, 10, 19, 19, 15, 0);
const secondsBefore = (ms: number): number => Math.floor((NOW_MS - ms) / 1000);

function freshPayload(ageMs = 30_000): Record<string, { usd: number; last_updated_at: number }> {
  return {
    bitcoin: { usd: 62683, last_updated_at: secondsBefore(ageMs) },
    ethereum: { usd: 1774.93, last_updated_at: secondsBefore(ageMs) },
    tron: { usd: 0.310229, last_updated_at: secondsBefore(ageMs) },
    'the-open-network': { usd: 1.028, last_updated_at: secondsBefore(ageMs) },
  };
}

function quoteAt(ageMs: number): PriceQuote {
  return {
    chain: 'btc',
    assetId: PRICE_ASSET_IDS.btc,
    providerAssetId: 'bitcoin',
    usdPrice: '62683',
    providerUpdatedAtMs: NOW_MS - ageMs,
    fetchedAtMs: NOW_MS,
    source: 'CoinGecko',
  };
}

describe('parsePriceResponse', () => {
  const expectedUsd = {
    btc: '62683',
    eth: '1774.93',
    trx: '0.310229',
    ton: '1.028',
  };

  it('returns fresh quotes with exact prices, identities, and timestamps', () => {
    const prices = parsePriceResponse(freshPayload(), NOW_MS);

    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      expect(prices[chain]).toMatchObject({
        status: 'fresh',
        quote: {
          chain,
          assetId: PRICE_ASSET_IDS[chain],
          providerAssetId: PRICE_IDS[chain],
          usdPrice: expectedUsd[chain],
          providerUpdatedAtMs: secondsBefore(30_000) * 1000,
          fetchedAtMs: NOW_MS,
          source: 'CoinGecko',
        },
      });
    }
  });

  it('retains quotes when provider timestamps have expired', () => {
    const ageMs = 11 * 60 * 1000;
    const prices = parsePriceResponse(freshPayload(ageMs), NOW_MS);

    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      expect(prices[chain]).toMatchObject({
        status: 'expired',
        quote: {
          chain,
          assetId: PRICE_ASSET_IDS[chain],
          providerAssetId: PRICE_IDS[chain],
          usdPrice: expectedUsd[chain],
          providerUpdatedAtMs: secondsBefore(ageMs) * 1000,
          fetchedAtMs: NOW_MS,
          source: 'CoinGecko',
        },
      });
    }
  });

  it('includes the freshness boundary and expires the next second', () => {
    const atLimit = parsePriceResponse(freshPayload(MAX_QUOTE_AGE_MS), NOW_MS);
    const pastLimit = parsePriceResponse(freshPayload(MAX_QUOTE_AGE_MS + 1000), NOW_MS);

    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      expect(atLimit[chain]).toMatchObject({ status: 'fresh' });
      expect(pastLimit[chain]).toMatchObject({ status: 'expired' });
    }
  });

  it('marks a missing coin unavailable without affecting other coins', () => {
    const payload = freshPayload();
    delete payload['the-open-network'];
    const prices = parsePriceResponse(payload, NOW_MS);

    expect(prices.ton).toEqual({ status: 'unavailable', reason: 'missing' });
    for (const chain of ['btc', 'eth', 'trx'] as const) {
      expect(prices[chain]).toMatchObject({ status: 'fresh' });
    }
  });

  it('does not accept toncoin instead of the-open-network', () => {
    const payload = freshPayload();
    delete payload['the-open-network'];
    payload.toncoin = { usd: 1.028, last_updated_at: secondsBefore(30_000) };

    expect(parsePriceResponse(payload, NOW_MS).ton).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });

  it('marks a price without a provider timestamp unavailable', () => {
    const prices = parsePriceResponse(
      { ...freshPayload(), bitcoin: { usd: 62683 } },
      NOW_MS,
    );

    expect(prices.btc).toEqual({
      status: 'unavailable',
      reason: 'missing-timestamp',
    });
  });

  it('rejects zero, negative, string, and missing USD prices', () => {
    for (const entry of [{ usd: 0 }, { usd: -5 }, { usd: '62683' }, {}]) {
      const payload = {
        ...freshPayload(),
        bitcoin: { ...entry, last_updated_at: secondsBefore(30_000) },
      };

      expect(parsePriceResponse(payload, NOW_MS).btc).toEqual({
        status: 'unavailable',
        reason: 'invalid-price',
      });
    }
  });

  it('returns provider errors for malformed top-level payloads', () => {
    for (const payload of [null, [], 'x']) {
      const prices = parsePriceResponse(payload, NOW_MS);

      for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
        expect(prices[chain]).toEqual({ status: 'error', reason: 'provider' });
      }
    }
  });
});

describe('isFreshQuote', () => {
  it('accepts a quote exactly MAX_QUOTE_AGE_MS old', () => {
    expect(isFreshQuote(quoteAt(MAX_QUOTE_AGE_MS), NOW_MS)).toBe(true);
  });

  it('rejects a quote one millisecond beyond MAX_QUOTE_AGE_MS', () => {
    expect(isFreshQuote(quoteAt(MAX_QUOTE_AGE_MS + 1), NOW_MS)).toBe(false);
  });

  it('allows a provider timestamp thirty seconds in the future', () => {
    const quote = {
      ...quoteAt(0),
      providerUpdatedAtMs: NOW_MS + 30_000,
    };

    expect(isFreshQuote(quote, NOW_MS)).toBe(true);
  });

  it('rejects a fetchedAtMs in the future', () => {
    const quote = {
      ...quoteAt(30_000),
      fetchedAtMs: NOW_MS + 1,
    };

    expect(isFreshQuote(quote, NOW_MS)).toBe(false);
  });
});

describe('usdPriceToMinorUnitsPerWhole', () => {
  it('converts the BTC price to minor units', () => {
    expect(usdPriceToMinorUnitsPerWhole('62683')).toBe('6268300');
  });

  it('converts the ETH price exactly', () => {
    expect(usdPriceToMinorUnitsPerWhole('1774.93')).toBe('177493');
  });

  it('rounds the TRX price down to the nearest minor unit', () => {
    expect(usdPriceToMinorUnitsPerWhole('0.310229')).toBe('31');
  });

  it('rounds the TON price up to the nearest minor unit', () => {
    expect(usdPriceToMinorUnitsPerWhole('1.028')).toBe('103');
  });

  it('throws for zero, negative, and invalid input', () => {
    for (const price of ['0', '-1', 'not-a-number']) {
      expect(() => usdPriceToMinorUnitsPerWhole(price)).toThrow();
    }
  });
});
```