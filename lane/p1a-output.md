```ts
/**
 * CoinGecko public API: https://api.coingecko.com/api/v3 (terms 2026-11-20).
 * GET /simple/price?ids=bitcoin,ethereum,tron,the-open-network&vs_currencies=usd&include_last_updated_at=true
 * IDs: btc=bitcoin; eth=ethereum; trx=tron; ton=the-open-network.
 * Keyless: ~5 calls/min/shared IP; back off on 429; not recommended for production.
 * Optional import.meta.env.VITE_COINGECKO_DEMO_KEY -> x-cg-demo-api-key.
 * Demo tier: 10,000 credits/month; 100 calls/min.
 * Paid integration allowed; prominent "Powered by CoinGecko" (font 10+) required.
 * CoinPaprika rejected: Free personal-use only; customer display needs Enterprise.
 * DexPaprika rejected: forbids third-party display; no BTC; ETH/TRX only WETH/WTRX.
 * Live 2026-11-19: 'toncoin' returns {}; correct TON id is 'the-open-network'.
 * Refresh ~60s; MAX_QUOTE_AGE_MS permits at most 10 minutes of quote age.
 */

import type { ChainId } from '../engine/boundary';

export const PRICE_PROVIDER_NAME = 'CoinGecko';
export const PRICE_PROVIDER_BASE_URL = 'https://api.coingecko.com/api/v3';

export const PRICE_IDS: Record<ChainId, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  trx: 'tron',
  ton: 'the-open-network',
};

export const PRICE_ASSET_IDS: Record<ChainId, string> = {
  btc: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  eth: 'eip155:1/slip44:60',
  trx: 'tron:0x2b6653dc/slip44:195',
  ton: 'ton:-239/slip44:607',
};

export const MAX_QUOTE_AGE_MS = 10 * 60 * 1000;
export const PRICE_FETCH_TIMEOUT_MS = 10_000;
export const PRICE_ATTRIBUTION_TEXT = 'Powered by CoinGecko';

export type PriceQuote = {
  chain: ChainId;
  assetId: string;
  providerAssetId: string;
  usdPrice: string;
  providerUpdatedAtMs: number;
  fetchedAtMs: number;
  source: 'CoinGecko';
};

export type PriceEntry =
  | { status: 'fresh'; quote: PriceQuote }
  | { status: 'expired'; quote: PriceQuote }
  | {
      status: 'unavailable';
      reason: 'missing' | 'missing-timestamp' | 'invalid-price';
    }
  | {
      status: 'error';
      reason: 'rate-limited' | 'network' | 'provider' | 'timeout';
      retryAfterMs?: number;
    };

export type PriceMap = Record<ChainId, PriceEntry>;

export type PricesState = {
  status: 'idle' | 'loading' | 'ready';
  entries: PriceMap;
  lastFetchedAtMs: number | null;
};

export function isFreshQuote(quote: PriceQuote, nowMs: number): boolean {
  const providerAgeMs = nowMs - quote.providerUpdatedAtMs;
  const fetchAgeMs = nowMs - quote.fetchedAtMs;

  return (
    Number.isFinite(quote.providerUpdatedAtMs) &&
    providerAgeMs >= -60_000 &&
    providerAgeMs <= MAX_QUOTE_AGE_MS &&
    fetchAgeMs >= 0 &&
    fetchAgeMs <= MAX_QUOTE_AGE_MS
  );
}

export function parsePriceResponse(
  payload: unknown,
  nowMs: number,
): PriceMap {
  // Guard inspection as well: unusual objects and proxies can throw.
  const isPlainObject = (
    value: unknown,
  ): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    try {
      if (Array.isArray(value)) {
        return false;
      }

      const prototype: unknown = Object.getPrototypeOf(value);
      return prototype === Object.prototype || prototype === null;
    } catch {
      return false;
    }
  };

  // Inherited fields and unreadable getters/properties count as absent.
  const ownValue = (
    object: Record<string, unknown>,
    key: string,
  ): unknown => {
    try {
      return Object.prototype.hasOwnProperty.call(object, key)
        ? object[key]
        : undefined;
    } catch {
      return undefined;
    }
  };

  const root = isPlainObject(payload) ? payload : null;

  const parseChain = (chain: ChainId): PriceEntry => {
    if (root === null) {
      return { status: 'error', reason: 'provider' };
    }

    const entry = ownValue(root, PRICE_IDS[chain]);
    if (!isPlainObject(entry)) {
      return { status: 'unavailable', reason: 'missing' };
    }

    // A timestamp is mandatory, regardless of whether a price is present.
    const updatedAt = ownValue(entry, 'last_updated_at');
    if (
      typeof updatedAt !== 'number' ||
      !Number.isFinite(updatedAt)
    ) {
      return { status: 'unavailable', reason: 'missing-timestamp' };
    }

    const price = ownValue(entry, 'usd');
    if (
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return { status: 'unavailable', reason: 'invalid-price' };
    }

    const quote: PriceQuote = {
      chain,
      assetId: PRICE_ASSET_IDS[chain],
      providerAssetId: PRICE_IDS[chain],
      usdPrice: String(price),
      // CoinGecko timestamps are seconds, not milliseconds.
      providerUpdatedAtMs: updatedAt * 1000,
      fetchedAtMs: nowMs,
      source: 'CoinGecko',
    };

    return isFreshQuote(quote, nowMs)
      ? { status: 'fresh', quote }
      : { status: 'expired', quote };
  };

  return {
    btc: parseChain('btc'),
    eth: parseChain('eth'),
    trx: parseChain('trx'),
    ton: parseChain('ton'),
  };
}
```