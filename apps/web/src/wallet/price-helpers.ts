/**
 * Shared price-response helpers (Fix-all Lane H, item 12: jscpd
 * family H).
 *
 * `sameTokenAddress`, `validUsdPrice` and `liquidityUsd` were
 * byte-identical in dex-prices.ts and price-fallbacks.ts; `freshQuote`
 * differed only in the assetId it stamped (the DexScreener contract
 * vs PRICE_ASSET_IDS[chain]) — and the dex-prices freshness check is
 * provably always true at its call sites: both timestamps are nowMs,
 * so both ages are 0 and isFreshQuote always passes. One builder
 * taking the assetId covers both, with no behaviour change.
 *
 * A leaf module on purpose: it imports only guards (runtime) and
 * prices/boundary (types, erased) — it adds no edge to the
 * prices <-> price-fallbacks <-> dex-prices cycle those modules
 * already document.
 */
import type { ChainId } from '../engine/boundary';
import { isRecord, ownValue } from './guards';
import type { PriceEntry, PriceQuote, PriceSource } from './prices';

/**
 * Same token address: EVM hex compares case-insensitively (checksummed
 * vs lowercase), base58 (Solana/TRON) compares exactly — lowercasing
 * two different base58 strings could falsely equate them.
 */
export function sameTokenAddress(left: string, right: string): boolean {
  if (left.startsWith('0x') && right.startsWith('0x')) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

/** A provider USD price: a finite number > 0, string or numeric. */
export function validUsdPrice(value: unknown): string | null {
  const price = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(price) || price <= 0) return null;
  return String(price);
}

/** A fresh quote for a just-fetched price: both timestamps are now. */
export function buildFreshQuote(
  chain: ChainId,
  assetId: string,
  providerAssetId: string,
  usdPrice: string,
  source: PriceSource,
  nowMs: number,
): PriceEntry {
  const quote: PriceQuote = {
    chain,
    assetId,
    providerAssetId,
    usdPrice,
    providerUpdatedAtMs: nowMs,
    fetchedAtMs: nowMs,
    source,
  };
  return { status: 'fresh', quote };
}

export function liquidityUsd(pair: Record<string, unknown>): number {
  const liquidity = ownValue(pair, 'liquidity');
  if (!isRecord(liquidity)) return 0;
  const usd = ownValue(liquidity, 'usd');
  return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : 0;
}
