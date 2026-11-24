/**
 * Fallback token prices for tokens CoinGecko does not list (README
 * showcase + Add Token, item D).
 *
 * CoinGecko stays the first source: a token with a CoinGecko id is
 * priced by the batched /simple/price call in token-prices.ts and
 * never reaches this module first. Only tokens WITHOUT a CoinGecko
 * id come here first, in this order — and Lane B (2026-11-24) sends
 * listed tokens here too as a fallback when their CoinGecko quote
 * is not fresh (see token-prices.ts fetchTokenPrices).
 *
 * 1. DexScreener (EVM, Solana, TRON) — keyless public API, no key,
 *    no registration. GET /tokens/v1/{chainId}/{address[,address...]}
 *    (up to 30 addresses per call; ~300 req/min). One batched call
 *    per chain, so a wallet with many unlisted tokens costs one call
 *    per chain, not one per token.
 * 2. TonAPI rates (TON Jettons) — GET /v2/rates?tokens={masters}
 *    &currencies=usd, keyless, already the TON balance fallback and
 *    already in the CSP. DexScreener does not price Jettons.
 *
 * The DexScreener trap (verified live 2026-11-23): priceUsd is the
 * BASE token's price, not the queried token's. tokens/v1/tron/USDT
 * returns a BTC-base pair priced $61,571.71 — USDT is only the quote
 * there — so priceUsd itself must never price the queried token.
 * A base-side pair (baseToken.address IS the queried token, chainId
 * matches) prices it directly. A quote-side pair prices it ONLY by
 * the exact implied price priceUsd / priceNative (Lane B,
 * 2026-11-24 — the same arithmetic as the native leg in
 * price-fallbacks.ts): the base token's USD price divided by its
 * price in queried-token units. Live proof: Polygon USDT0 appears
 * only as the quote in AIPF/USDT0 ($5.98M liquidity, priceUsd
 * $0.2953, priceNative 0.2953), and the implied price is exactly
 * $1.00. A quote-side pair WITHOUT priceNative (the TRON USDT
 * trap fixture) still prices nothing. When several pairs match,
 * the highest-liquidity one wins, base-side first.
 *
 * No timestamp comes back from either source, so providerUpdatedAtMs
 * is the fetch time: the quote is fresh for the same 10-minute window
 * as a CoinGecko quote (isFreshQuote) and then expires honestly.
 * A token no source prices stays { status: 'unavailable', reason:
 * 'missing' } — never a guessed price.
 *
 * Gnosis and Aurora are NOT in the map (verified live 2026-11-23):
 * dexscreener.com/gnosis and /aurora are 404 and tokens/v1 returns []
 * for known tokens there (WXDAI, GNO, USDC on Gnosis). Tokens on those
 * chains stay "Price unavailable" unless CoinGecko lists them.
 */
import { divideToString, parseDecimalString } from './decimal';
import type { ChainId } from '../engine/boundary';
import { isRecord, ownValue } from './guards';
import {
  buildFreshQuote,
  liquidityUsd,
  sameTokenAddress,
  validUsdPrice,
} from './price-helpers';
import {
  fetchJsonWithTimeout,
  type PriceEntry,
} from './prices';

export const DEXSCREENER_BASE_URL = 'https://api.dexscreener.com';
export const TONAPI_RATES_BASE_URL = 'https://tonapi.io';

/** DexScreener chainId per wallet chain (see the module note for the two omissions). */
export const DEXSCREENER_CHAIN_FOR_CHAIN: Partial<Record<ChainId, string>> = {
  eth: 'ethereum',
  bsc: 'bsc',
  matic: 'polygon',
  arb: 'arbitrum',
  op: 'optimism',
  base: 'base',
  avax: 'avalanche',
  sol: 'solana',
  trx: 'tron',
  celo: 'celo',
  linea: 'linea',
  mantle: 'mantle',
  scroll: 'scroll',
  opbnb: 'opbnb',
  metis: 'metis',
  fantom: 'fantom',
  kava: 'kava',
  berachain: 'berachain',
  worldchain: 'worldchain',
  manta: 'manta',
  soneium: 'soneium',
  sonic: 'sonic',
  monad: 'monad',
  fuse: 'fuse',
  telos: 'telos',
  conflux: 'conflux',
  pulsechain: 'pulsechain',
  aptos: 'aptos',
  algorand: 'algorand',
};

/** DexScreener only accepts 30 token addresses per tokens/v1 call. */
const DEXSCREENER_MAX_ADDRESSES_PER_CALL = 30;

export interface DexPriceRequest {
  key: string;
  chain: ChainId;
  contract: string;
}

export interface TonPriceRequest {
  key: string;
  contract: string;
}

type PriceMap = Record<string, PriceEntry>;



export function parseDexScreenerResponse(
  payload: unknown,
  requests: readonly DexPriceRequest[],
  nowMs: number,
): PriceMap {
  const entries: PriceMap = {};
  if (!Array.isArray(payload)) {
    for (const request of requests) {
      entries[request.key] = { status: 'error', reason: 'provider' };
    }
    return entries;
  }
  for (const request of requests) {
    const dexChain = DEXSCREENER_CHAIN_FOR_CHAIN[request.chain];
    let bestBase: { price: string; liquidity: number } | null = null;
    let bestQuote: { price: string; liquidity: number } | null = null;
    if (dexChain !== undefined) {
      for (const value of payload as unknown[]) {
        if (!isRecord(value)) continue;
        if (ownValue(value, 'chainId') !== dexChain) continue;
        const liquidity = liquidityUsd(value);
        const baseToken = ownValue(value, 'baseToken');
        if (isRecord(baseToken)) {
          const baseAddress = ownValue(baseToken, 'address');
          if (
            typeof baseAddress === 'string' &&
            sameTokenAddress(baseAddress, request.contract)
          ) {
            const price = validUsdPrice(ownValue(value, 'priceUsd'));
            if (price !== null && (bestBase === null || liquidity > bestBase.liquidity)) {
              bestBase = { price, liquidity };
            }
            continue;
          }
        }
        // Quote-side only: the implied price priceUsd / priceNative
        // (Lane B — same exact arithmetic as the native leg in
        // price-fallbacks.ts). Never priceUsd itself, which is the
        // base token's price. Needs priceNative: a quote-side pair
        // without it (the TRON USDT trap fixture) prices nothing.
        const quoteToken = ownValue(value, 'quoteToken');
        if (!isRecord(quoteToken)) continue;
        const quoteAddress = ownValue(quoteToken, 'address');
        if (typeof quoteAddress !== 'string') continue;
        if (!sameTokenAddress(quoteAddress, request.contract)) continue;
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
          // Exact BigInt division at Decimal's default 20 significant
          // digits; null when the ratio is not a finite positive number.
          implied = divideToString(
            parseDecimalString(String(basePrice)),
            parseDecimalString(String(priceNative)),
          );
        } catch {
          implied = null;
        }
        if (implied === null) continue;
        if (bestQuote === null || liquidity > bestQuote.liquidity) {
          bestQuote = { price: implied, liquidity };
        }
      }
    }
    const best = bestBase ?? bestQuote;
    entries[request.key] =
      best === null
        ? { status: 'unavailable', reason: 'missing' }
        : buildFreshQuote(request.chain, request.contract, request.contract, best.price, 'DexScreener', nowMs);
  }
  return entries;
}

export function parseTonRatesResponse(
  payload: unknown,
  requests: readonly TonPriceRequest[],
  nowMs: number,
): PriceMap {
  const entries: PriceMap = {};
  const rates = isRecord(payload) && isRecord(ownValue(payload, 'rates'))
    ? (ownValue(payload, 'rates') as Record<string, unknown>)
    : null;
  for (const request of requests) {
    let price: string | null = null;
    if (rates !== null) {
      const entry = ownValue(rates, request.contract);
      if (isRecord(entry)) {
        const prices = ownValue(entry, 'prices');
        if (isRecord(prices)) {
          price = validUsdPrice(ownValue(prices, 'USD'));
        }
      }
    }
    entries[request.key] =
      price === null
        ? { status: 'unavailable', reason: 'missing' }
        : buildFreshQuote('ton', request.contract, request.contract, price, 'TonAPI', nowMs);
  }
  return entries;
}

type FetchFn = typeof fetch;

function errorEntries(
  requests: readonly { key: string }[],
  reason: 'rate-limited' | 'network' | 'provider' | 'timeout',
  retryAfterMs?: number,
): PriceMap {
  const entry: PriceEntry =
    reason === 'rate-limited' && retryAfterMs !== undefined
      ? { status: 'error', reason, retryAfterMs }
      : { status: 'error', reason };
  return Object.fromEntries(requests.map((request) => [request.key, { ...entry }]));
}

export async function fetchJson(
  fetchFn: FetchFn,
  url: string,
): Promise<
  | { status: 'ok'; payload: unknown }
  | { status: 'error'; entries: Extract<PriceEntry, { status: 'error' }> }
> {
  // Fix-all Lane H, item 12 (jscpd family P): this was a second copy
  // of fetchJsonWithTimeout's timeout/429/!ok/parse/catch shape with
  // the error nested under `entries` instead of `error` — one call +
  // remap now, same result in every branch (FetchJsonResult's error
  // IS the entries type, and FetchFn IS typeof fetch).
  const result = await fetchJsonWithTimeout(fetchFn, url);
  if (result.status === 'ok') return { status: 'ok', payload: result.payload };
  return { status: 'error', entries: result.error };
}

export async function fetchDexScreenerPrices(
  fetchFn: FetchFn,
  requests: readonly DexPriceRequest[],
  nowMs?: number,
): Promise<PriceMap> {
  const resolvedNowMs = nowMs ?? Date.now();
  if (requests.length === 0) return {};
  // One batched call per chain: group the requests, chunk at 30
  // addresses, and parse each chain's pairs against its own requests.
  const byChain = new Map<string, DexPriceRequest[]>();
  for (const request of requests) {
    const dexChain = DEXSCREENER_CHAIN_FOR_CHAIN[request.chain];
    if (dexChain === undefined) continue;
    const list = byChain.get(dexChain) ?? [];
    list.push(request);
    byChain.set(dexChain, list);
  }
  const merged: PriceMap = {};
  for (const request of requests) {
    if (DEXSCREENER_CHAIN_FOR_CHAIN[request.chain] === undefined) {
      merged[request.key] = { status: 'unavailable', reason: 'missing' };
    }
  }
  await Promise.all(
    [...byChain.entries()].map(async ([dexChain, chainRequests]) => {
      for (let offset = 0; offset < chainRequests.length; offset += DEXSCREENER_MAX_ADDRESSES_PER_CALL) {
        const chunk = chainRequests.slice(offset, offset + DEXSCREENER_MAX_ADDRESSES_PER_CALL);
        const addresses = chunk.map((request) => request.contract).join(',');
        const result = await fetchJsonWithTimeout(fetchFn, `${DEXSCREENER_BASE_URL}/tokens/v1/${dexChain}/${addresses}`);
        if (result.status === 'error') {
          const retryAfterMs =
            'retryAfterMs' in result.error ? result.error.retryAfterMs : undefined;
          Object.assign(merged, errorEntries(chunk, result.error.reason, retryAfterMs));
        } else {
          Object.assign(merged, parseDexScreenerResponse(result.payload, chunk, resolvedNowMs));
        }
      }
    }),
  );
  return merged;
}

export async function fetchTonJettonPrices(
  fetchFn: FetchFn,
  requests: readonly TonPriceRequest[],
  nowMs?: number,
): Promise<PriceMap> {
  const resolvedNowMs = nowMs ?? Date.now();
  if (requests.length === 0) return {};
  const masters = requests.map((request) => request.contract).join(',');
  const url = `${TONAPI_RATES_BASE_URL}/v2/rates?tokens=${masters}&currencies=usd`;
  const result = await fetchJsonWithTimeout(fetchFn, url);
  if (result.status === 'error') {
    const retryAfterMs =
      'retryAfterMs' in result.error ? result.error.retryAfterMs : undefined;
    return errorEntries(requests, result.error.reason, retryAfterMs);
  }
  return parseTonRatesResponse(result.payload, requests, resolvedNowMs);
}
