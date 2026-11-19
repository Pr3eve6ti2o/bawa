You are writing PART 1 of one test file for the Bawa web wallet (app in apps/web). You have no shell or filesystem access. EMIT ONLY the file fragment below inside a single ```ts fenced block, nothing else. No prose, no other files. Keep it short: this fragment is about 200 lines.

CONTEXT: the module under test is `apps/web/src/wallet/prices.ts` (already written). Its API relevant here:
- PRICE_IDS = { btc: 'bitcoin', eth: 'ethereum', trx: 'tron', ton: 'the-open-network' }; PRICE_ASSET_IDS (CAIP-19 ids); MAX_QUOTE_AGE_MS = 600_000; PRICE_ATTRIBUTION_TEXT = 'Powered by CoinGecko'.
- isFreshQuote(quote, nowMs): true iff providerUpdatedAtMs is finite and nowMs - providerUpdatedAtMs is within [-60_000, MAX_QUOTE_AGE_MS] and nowMs - fetchedAtMs is within [0, MAX_QUOTE_AGE_MS].
- parsePriceResponse(payload: unknown, nowMs: number): PriceMap. Never throws for payload shapes. A missing per-coin entry is unavailable 'missing'; a present price with a missing/non-numeric last_updated_at is unavailable 'missing-timestamp'; a missing/non-finite/zero/negative usd is unavailable 'invalid-price'; last_updated_at is SECONDS (multiplied by 1000); usd stored as String(price). Non-object top level gives every chain error 'provider'.
- usdPriceToMinorUnitsPerWhole(usdPrice: string): string — exact Decimal math, usd * 100 rounded half-up to an integer string; throws on invalid/negative/zero input.

EMIT THIS FRAGMENT for `apps/web/src/wallet/prices.test.ts` (the assembler will append Parts 2–3 after it; do NOT close the file with anything extra — end after the last describe block):
1. Imports: `import { describe, expect, it } from 'vitest';` and the module imports: MAX_QUOTE_AGE_MS, PRICE_ASSET_IDS, PRICE_IDS, isFreshQuote, parsePriceResponse, usdPriceToMinorUnitsPerWhole from './prices'. Also `import type { PriceQuote } from './prices';`.
2. Shared fixtures (later parts reuse these exact names — define them exactly so): `const NOW_MS = Date.UTC(2026, 10, 19, 19, 15, 0);` `const secondsBefore = (ms: number): number => Math.floor((NOW_MS - ms) / 1000);` and `function freshPayload(ageMs = 30_000): Record<string, { usd: number; last_updated_at: number }> { return { bitcoin: { usd: 62683, last_updated_at: secondsBefore(ageMs) }, ethereum: { usd: 1774.93, last_updated_at: secondsBefore(ageMs) }, tron: { usd: 0.310229, last_updated_at: secondsBefore(ageMs) }, 'the-open-network': { usd: 1.028, last_updated_at: secondsBefore(ageMs) } }; }` and `function quoteAt(ageMs: number): PriceQuote { return { chain: 'btc', assetId: PRICE_ASSET_IDS.btc, providerAssetId: 'bitcoin', usdPrice: '62683', providerUpdatedAtMs: NOW_MS - ageMs, fetchedAtMs: NOW_MS, source: 'CoinGecko' }; }`.
3. describe('parsePriceResponse', ...) with one it() per case, exact assertions:
   - fresh: freshPayload() gives all four entries fresh with usdPrice strings '62683', '1774.93', '0.310229', '1.028', providerAssetId matching PRICE_IDS, assetId matching PRICE_ASSET_IDS, source 'CoinGecko', providerUpdatedAtMs equal to secondsBefore(30_000) * 1000, fetchedAtMs equal to NOW_MS.
   - expired: freshPayload(11 * 60 * 1000) gives all four entries expired and still carrying their quotes.
   - freshness boundary: freshPayload(MAX_QUOTE_AGE_MS) is fresh for all four; freshPayload(MAX_QUOTE_AGE_MS + 1000) is expired for all four.
   - missing coin: payload without 'the-open-network' (other three fresh) gives ton unavailable 'missing' while btc/eth/trx are fresh.
   - identity: payload keyed by 'toncoin' instead of 'the-open-network' (live-verified: CoinGecko 'toncoin' returns empty) gives ton unavailable 'missing'.
   - missing timestamp: a coin with usd present but no last_updated_at gives unavailable 'missing-timestamp'.
   - invalid prices: usd 0 gives invalid-price; usd -5 gives invalid-price; usd as the string '62683' gives invalid-price; usd missing gives invalid-price. (Four assertions in one it() is fine, or split them — your choice, keep it tight.)
   - malformed top level: payload null, payload an array, payload the string 'x' each give every chain error 'provider'.
4. describe('isFreshQuote', ...) with its: quote at exactly MAX_QUOTE_AGE_MS old is fresh; MAX_QUOTE_AGE_MS + 1 ms old is not fresh; a provider timestamp 30 seconds in the future is fresh (clock skew); a fetchedAtMs in the future is not fresh. Use quoteAt() and object spread to vary fields.
5. describe('usdPriceToMinorUnitsPerWhole', ...) with its: '62683' gives '6268300'; '1774.93' gives '177493'; '0.310229' gives '31'; '1.028' gives '103'; it throws for '0', '-1' and 'not-a-number'.

CONSTRAINTS: no live network calls anywhere; no new dependencies; no AVOID-list names; all timestamps derived from NOW_MS.
