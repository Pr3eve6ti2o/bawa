/**
 * Native-price fallbacks after CoinGecko (Lane C, finish-the-product,
 * 2026-11-23). CoinGecko stays the first source: usePrices() fetches
 * its batched /simple/price call first, and only the chains whose
 * quote is NOT fresh reach this module (see applyPriceFallbacks).
 * A chain no source prices stays on its CoinGecko entry — expired,
 * error or unavailable — never a guessed price. The row label shows
 * the quote's real source (see asset-rows / asset-detail), never a
 * hardcoded provider.
 *
 * Fallback order per chain (live research, VM probes 2026-11-23):
 *
 * 1. CoinLore (https://api.coinlore.net/api/ticker/?id=...) — one
 *    batched call for every mapped chain. Keyless, no registration,
 *    CORS `access-control-allow-origin: *`, no rate-limit header
 *    observed across ~15 calls. Each mapped quote was cross-checked
 *    against CoinGecko live and agrees within 0.7% (BTC, ETH, BNB,
 *    SOL, TRX, DOGE, AVAX, CELO, METIS). It goes first because it is
 *    one call for many chains and its verified quotes track
 *    CoinGecko tightest; DexScreener's thin pairs wobble (CELO 8.5%,
 *    opBNB 1.4% off CoinGecko live).
 * 2. DexScreener (tokens/v1/<chain>/<wrapped>) — on-chain price of
 *    the wrapped native, one call per chain. Base-side pair wins
 *    (highest liquidity). Quote-side only: the implied price
 *    priceUsd / priceNative — NOT priceUsd itself, which is the
 *    base token's price (the trap documented in dex-prices.ts).
 *    The implied price is exact arithmetic, and it is validated
 *    live: WFTM implied $0.02973 matches Sonic (S) at $0.029725
 *    on CoinLore the same day.
 * 3. TonAPI rates for TON, Coinbase Exchange ticker for LTC — the
 *    two chains CoinLore cannot cover (see the map notes).
 *
 * REJECTED live (do not re-add without fresh evidence):
 * - Binance (api.binance.com): HTTP 451 "Service unavailable from
 *   a restricted location" from this egress — geo-blocked. Its US
 *   endpoint (api.binance.us) answers but quotes FTM at $0.4806
 *   against CoinGecko $0.0254, DexScreener-implied $0.02973 and
 *   Sonic $0.0297 — a frozen pre-delisting quote, ~16x too high.
 * - CoinPaprika: answers keyless and quotes the same frozen FTM
 *   $0.4803 — and its free tier is personal-use only; customer
 *   display needs Enterprise (already rejected in prices.ts).
 * - CoinCodex: its /get_coin/fantom endpoint returns a
 *   "not_trading_anymore" record, not a price.
 * - Kraken: no Access-Control-Allow-Origin header, so a browser
 *   fetch is CORS-blocked (and it has no FTM pair at all).
 * - CoinLore TON ($1.78 live vs CoinGecko/TonAPI $1.015) and
 *   CoinLore MATIC ($0.377 live vs CoinGecko POL $0.0788) are
 *   stale legacy quotes — both are excluded from the map below,
 *   not trusted. CoinLore also lists neither LTC nor FTM in its
 *   top-500 tickers, and no XDAI or MNT quote was found.
 * - Gnosis (xDAI) and Mantle (MNT) have no verified keyless
 *   fallback at all: DexScreener returns [] there, CoinLore has
 *   no quote, and no wrapped contract verified. They stay
 *   CoinGecko-only; their CoinGecko quotes were fresh live.
 *
 * Coverage after this module: 20 of 22 chains have at least one
 * fallback (all except Gnosis and Mantle). Fantom — the flagged
 * "Price expired" case — is covered by the DexScreener implied
 * price: CoinGecko's `fantom` id was ~8h stale live
 * (last_updated_at 1795417691 vs now 1795446545), so its quote
 * expires and the fallback replaces it with a live price.
 *
 * No timestamp comes back from any fallback source, so
 * providerUpdatedAtMs is the fetch time: the quote is fresh for
 * the same 10-minute window as a CoinGecko quote and then expires
 * honestly.
 *
 * Module shape (intentional): this module imports values from
 * prices.ts (PRICE_ASSET_IDS) and dex-prices.ts (fetchJson,
 * fetchTonJettonPrices), and prices.ts imports applyPriceFallbacks
 * from here — a cycle, but a safe one: every cross-module value is
 * read only inside functions invoked after module evaluation
 * (hoisted function declarations on both sides), never at
 * top-level evaluation time. tsc + vitest + vite build verify it.
 */
import Decimal from 'decimal.js';
import type { ChainId } from '../engine/boundary';
import { isRecord, ownValue } from './guards';
import {
  DEXSCREENER_BASE_URL,
  fetchJson,
  fetchTonJettonPrices,
} from './dex-prices';
import {
  PRICE_ASSET_IDS,
  type PriceEntry,
  type PriceMap,
  type PriceQuote,
  type PriceSource,
} from './prices';

export const COINLORE_BASE_URL = 'https://api.coinlore.net';
export const COINBASE_BASE_URL = 'https://api.exchange.coinbase.com';

/**
 * Native asset -> CoinLore coin id. ETH-native chains (Arbitrum,
 * Optimism, Base, Linea, Scroll, Aurora) price as ETH — never as
 * their governance tokens (ARB, OP) — and opBNB prices as BNB.
 * Every mapped id was verified live 2026-11-23 (see the module
 * note for the two excluded stale quotes and the two absent coins).
 */
export const COINLORE_NATIVE_IDS: Partial<Record<ChainId, string>> = {
  btc: '90',
  eth: '80',
  arb: '80',
  op: '80',
  base: '80',
  linea: '80',
  scroll: '80',
  aurora: '80',
  bsc: '2710',
  opbnb: '2710',
  sol: '48543',
  trx: '2713',
  doge: '2',
  avax: '44883',
  celo: '44425',
  metis: '49563',
};

/**
 * Wrapped native token per chain for the DexScreener leg. Each
 * contract was verified live 2026-11-23 via tokens/v1 returning a
 * pair for it (see the module note): bsc WBNB $572.32, matic
 * WPOL $0.07889 (the contract reports symbol WPOL since the
 * MATIC->POL migration; CoinGecko POL $0.07882), arb/op/base/
 * scroll WETH ~$1,775-1,781, avax WAVAX $7.025, sol WSOL $75.98,
 * celo CELO $0.05273 (thin, $71k liquidity — last resort only),
 * opbnb WBNB quote-side implied $579.82, fantom WFTM quote-side
 * implied $0.02973.
 *
 * Linea and Aurora return [] from tokens/v1 for WETH (live), so
 * they have no DexScreener leg. TRX has no verified WTRX contract
 * on file; Metis and Mantle have no verified wrapped contract.
 * Gnosis is not indexed by DexScreener (see dex-prices.ts).
 */
export const NATIVE_WRAPPED_TOKENS: Partial<
  Record<ChainId, { dexChain: string; contract: string }>
> = {
  eth: {
    dexChain: 'ethereum',
    contract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  bsc: {
    dexChain: 'bsc',
    contract: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  },
  matic: {
    dexChain: 'polygon',
    contract: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  },
  arb: {
    dexChain: 'arbitrum',
    contract: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  op: {
    dexChain: 'optimism',
    contract: '0x4200000000000000000000000000000000000006',
  },
  base: {
    dexChain: 'base',
    contract: '0x4200000000000000000000000000000000000006',
  },
  avax: {
    dexChain: 'avalanche',
    contract: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  },
  sol: {
    dexChain: 'solana',
    contract: 'So11111111111111111111111111111111111111112',
  },
  celo: {
    dexChain: 'celo',
    contract: '0x471EcE3750Da237f93B8E339c536989b8978a438',
  },
  scroll: {
    dexChain: 'scroll',
    contract: '0x5300000000000000000000000000000000000004',
  },
  opbnb: {
    dexChain: 'opbnb',
    contract: '0x4200000000000000000000000000000000000006',
  },
  fantom: {
    dexChain: 'fantom',
    contract: '0x21be370d5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
};

/** Coinbase product id per chain (LTC only — the one chain CoinLore misses). */
const COINBASE_PRODUCT_IDS: Partial<Record<ChainId, string>> = {
  ltc: 'LTC-USD',
};

/**
 * Same token address: EVM hex compares case-insensitively
 * (checksummed vs lowercase), base58 (Solana) compares exactly —
 * lowercasing two different base58 strings could falsely equate
 * them. (Mirrors dex-prices.ts; that helper is not exported.)
 */
function sameTokenAddress(left: string, right: string): boolean {
  if (left.startsWith('0x') && right.startsWith('0x')) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

/** A provider USD price: a finite number > 0, string or numeric. */
function validUsdPrice(value: unknown): string | null {
  const price =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  if (!Number.isFinite(price) || price <= 0) return null;
  return String(price);
}

function freshQuote(
  chain: ChainId,
  providerAssetId: string,
  usdPrice: string,
  source: PriceSource,
  nowMs: number,
): PriceEntry {
  const quote: PriceQuote = {
    chain,
    assetId: PRICE_ASSET_IDS[chain],
    providerAssetId,
    usdPrice,
    providerUpdatedAtMs: nowMs,
    fetchedAtMs: nowMs,
    source,
  };
  return { status: 'fresh', quote };
}

function liquidityUsd(pair: Record<string, unknown>): number {
  const liquidity = ownValue(pair, 'liquidity');
  if (!isRecord(liquidity)) return 0;
  const usd = ownValue(liquidity, 'usd');
  return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : 0;
}

export function parseCoinLoreResponse(
  payload: unknown,
  chains: readonly ChainId[],
  nowMs: number,
): Partial<Record<ChainId, PriceEntry>> {
  const entries: Partial<Record<ChainId, PriceEntry>> = {};
  if (!Array.isArray(payload)) {
    for (const chain of chains) {
      entries[chain] = { status: 'error', reason: 'provider' };
    }
    return entries;
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const value of payload as unknown[]) {
    if (!isRecord(value)) continue;
    const id = ownValue(value, 'id');
    if (typeof id === 'string') byId.set(id, value);
  }

  for (const chain of chains) {
    const id = COINLORE_NATIVE_IDS[chain];
    if (id === undefined) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
      continue;
    }
    const coin = byId.get(id);
    if (coin === undefined) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
      continue;
    }
    const raw = ownValue(coin, 'price_usd');
    if (raw === undefined) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
      continue;
    }
    const price = validUsdPrice(raw);
    if (price === null) {
      entries[chain] = { status: 'unavailable', reason: 'invalid-price' };
      continue;
    }
    entries[chain] = freshQuote(chain, id, price, 'CoinLore', nowMs);
  }
  return entries;
}

/**
 * DexScreener native price: the wrapped token's pair. Base-side
 * wins (priceUsd IS the wrapped token's price). Quote-side only:
 * the implied price priceUsd / priceNative — the base token's USD
 * price divided by its price in wrapped-token units. That is exact
 * division, not the trap of reading priceUsd as the queried
 * token's price (see the module note for the live WFTM proof).
 * No pair involving the token at all stays "unavailable".
 */
export function parseDexScreenerNativeResponse(
  payload: unknown,
  chain: ChainId,
  contract: string,
  nowMs: number,
): PriceEntry {
  if (!Array.isArray(payload)) {
    return { status: 'error', reason: 'provider' };
  }
  const wrapped = NATIVE_WRAPPED_TOKENS[chain];
  if (wrapped === undefined || !sameTokenAddress(wrapped.contract, contract)) {
    return { status: 'unavailable', reason: 'missing' };
  }

  let bestBase: { price: string; liquidity: number } | null = null;
  let bestQuote: { price: string; liquidity: number } | null = null;
  for (const value of payload as unknown[]) {
    if (!isRecord(value)) continue;
    if (ownValue(value, 'chainId') !== wrapped.dexChain) continue;
    const liquidity = liquidityUsd(value);
    const baseToken = ownValue(value, 'baseToken');
    if (isRecord(baseToken)) {
      const baseAddress = ownValue(baseToken, 'address');
      if (
        typeof baseAddress === 'string' &&
        sameTokenAddress(baseAddress, contract)
      ) {
        const price = validUsdPrice(ownValue(value, 'priceUsd'));
        if (price !== null && (bestBase === null || liquidity > bestBase.liquidity)) {
          bestBase = { price, liquidity };
        }
        continue;
      }
    }
    const quoteToken = ownValue(value, 'quoteToken');
    if (!isRecord(quoteToken)) continue;
    const quoteAddress = ownValue(quoteToken, 'address');
    if (typeof quoteAddress !== 'string') continue;
    if (!sameTokenAddress(quoteAddress, contract)) continue;
    const basePrice = ownValue(value, 'priceUsd');
    const priceNative = ownValue(value, 'priceNative');
    if (
      (typeof basePrice !== 'number' && typeof basePrice !== 'string') ||
      (typeof priceNative !== 'number' && typeof priceNative !== 'string')
    ) {
      continue;
    }
    let implied: string | null = null;
    try {
      const ratio = new Decimal(String(basePrice)).div(new Decimal(String(priceNative)));
      if (ratio.isFinite() && ratio.gt(0)) {
        implied = ratio.toString();
      }
    } catch {
      implied = null;
    }
    if (implied === null) continue;
    if (bestQuote === null || liquidity > bestQuote.liquidity) {
      bestQuote = { price: implied, liquidity };
    }
  }

  if (bestBase !== null) {
    return freshQuote(chain, contract, bestBase.price, 'DexScreener', nowMs);
  }
  if (bestQuote !== null) {
    return freshQuote(chain, contract, bestQuote.price, 'DexScreener', nowMs);
  }
  // A quote-side pair existed but its numbers were unusable (e.g.
  // priceNative 0): an invalid price, not a missing pair.
  const sawQuoteSide = (payload as unknown[]).some((value) => {
    if (!isRecord(value)) return false;
    if (ownValue(value, 'chainId') !== wrapped.dexChain) return false;
    const quoteToken = ownValue(value, 'quoteToken');
    if (!isRecord(quoteToken)) return false;
    const quoteAddress = ownValue(quoteToken, 'address');
    return typeof quoteAddress === 'string' && sameTokenAddress(quoteAddress, contract);
  });
  return {
    status: 'unavailable',
    reason: sawQuoteSide ? 'invalid-price' : 'missing',
  };
}

/** Coinbase Exchange ticker: {"price": "42.956", ...} — LTC only. */
export function parseCoinbaseResponse(
  payload: unknown,
  chain: ChainId,
  nowMs: number,
): PriceEntry {
  const productId = COINBASE_PRODUCT_IDS[chain];
  if (productId === undefined) {
    return { status: 'unavailable', reason: 'missing' };
  }
  if (!isRecord(payload)) {
    return { status: 'error', reason: 'provider' };
  }
  const raw = ownValue(payload, 'price');
  if (raw === undefined) {
    return { status: 'unavailable', reason: 'missing' };
  }
  const price = validUsdPrice(raw);
  if (price === null) {
    return { status: 'unavailable', reason: 'invalid-price' };
  }
  return freshQuote(chain, productId, price, 'Coinbase', nowMs);
}

type FetchFn = typeof fetch;

export async function fetchCoinLorePrices(
  fetchFn: FetchFn,
  chains: readonly ChainId[],
  nowMs?: number,
): Promise<Partial<Record<ChainId, PriceEntry>>> {
  const resolvedNowMs = nowMs ?? Date.now();
  const ids: string[] = [];
  for (const chain of chains) {
    const id = COINLORE_NATIVE_IDS[chain];
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0) {
    const entries: Partial<Record<ChainId, PriceEntry>> = {};
    for (const chain of chains) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
    }
    return entries;
  }
  const result = await fetchJson(
    fetchFn,
    `${COINLORE_BASE_URL}/api/ticker/?id=${ids.join(',')}`,
  );
  if (result.status === 'error') {
    const entries: Partial<Record<ChainId, PriceEntry>> = {};
    for (const chain of chains) {
      entries[chain] = { ...result.entries };
    }
    return entries;
  }
  return parseCoinLoreResponse(result.payload, chains, resolvedNowMs);
}

export async function fetchDexScreenerNativePrices(
  fetchFn: FetchFn,
  chains: readonly ChainId[],
  nowMs?: number,
): Promise<Partial<Record<ChainId, PriceEntry>>> {
  const resolvedNowMs = nowMs ?? Date.now();
  const merged: Partial<Record<ChainId, PriceEntry>> = {};
  await Promise.all(
    chains.map(async (chain) => {
      const wrapped = NATIVE_WRAPPED_TOKENS[chain];
      if (wrapped === undefined) {
        merged[chain] = { status: 'unavailable', reason: 'missing' };
        return;
      }
      const result = await fetchJson(
        fetchFn,
        `${DEXSCREENER_BASE_URL}/tokens/v1/${wrapped.dexChain}/${wrapped.contract}`,
      );
      merged[chain] =
        result.status === 'error'
          ? { ...result.entries }
          : parseDexScreenerNativeResponse(
              result.payload,
              chain,
              wrapped.contract,
              resolvedNowMs,
            );
    }),
  );
  return merged;
}

export async function fetchCoinbaseLtcPrice(
  fetchFn: FetchFn,
  nowMs?: number,
): Promise<PriceEntry> {
  const resolvedNowMs = nowMs ?? Date.now();
  const result = await fetchJson(
    fetchFn,
    `${COINBASE_BASE_URL}/products/LTC-USD/ticker`,
  );
  if (result.status === 'error') {
    return { ...result.entries };
  }
  return parseCoinbaseResponse(result.payload, 'ltc', resolvedNowMs);
}

/**
 * Fill the gaps in a CoinGecko price map from the fallbacks, in
 * the order the live research justifies: CoinLore batch first,
 * then DexScreener per wrapped native, then TonAPI for TON and
 * Coinbase for LTC. A chain whose CoinGecko quote is already
 * fresh is never re-fetched. A chain no fallback prices keeps its
 * original CoinGecko entry — the honest expired/error/
 * unavailable state, never an invented price. One provider's
 * failure never blocks the others: each leg is caught and the
 * merge continues with the chains it did price.
 */
export async function applyPriceFallbacks(
  fetchFn: FetchFn,
  cgEntries: PriceMap,
  nowMs?: number,
): Promise<PriceMap> {
  const resolvedNowMs = nowMs ?? Date.now();
  const merged: PriceMap = { ...cgEntries };
  const isFresh = (chain: ChainId): boolean =>
    merged[chain]?.status === 'fresh';

  const needing = (Object.keys(merged) as ChainId[]).filter(
    (chain) => !isFresh(chain),
  );
  if (needing.length === 0) return merged;

  const takeFresh = (
    chain: ChainId,
    entry: PriceEntry | undefined,
  ): void => {
    if (entry?.status === 'fresh') merged[chain] = entry;
  };

  try {
    const coinLoreChains = needing.filter(
      (chain) => COINLORE_NATIVE_IDS[chain] !== undefined,
    );
    if (coinLoreChains.length > 0) {
      const entries = await fetchCoinLorePrices(
        fetchFn,
        coinLoreChains,
        resolvedNowMs,
      );
      for (const chain of coinLoreChains) takeFresh(chain, entries[chain]);
    }
  } catch {
    // CoinLore down: the DexScreener leg still runs below.
  }

  try {
    const dexChains = (Object.keys(merged) as ChainId[]).filter(
      (chain) => !isFresh(chain) && NATIVE_WRAPPED_TOKENS[chain] !== undefined,
    );
    if (dexChains.length > 0) {
      const entries = await fetchDexScreenerNativePrices(
        fetchFn,
        dexChains,
        resolvedNowMs,
      );
      for (const chain of dexChains) takeFresh(chain, entries[chain]);
    }
  } catch {
    // DexScreener down: TON/LTC legs still run below.
  }

  if (!isFresh('ton')) {
    try {
      const entries = await fetchTonJettonPrices(
        fetchFn,
        [{ key: 'ton', contract: 'TON' }],
        resolvedNowMs,
      );
      takeFresh('ton', entries['ton']);
    } catch {
      // TonAPI down: keep the CoinGecko entry for TON.
    }
  }

  if (!isFresh('ltc')) {
    try {
      takeFresh('ltc', await fetchCoinbaseLtcPrice(fetchFn, resolvedNowMs));
    } catch {
      // Coinbase down: keep the CoinGecko entry for LTC.
    }
  }

  return merged;
}
