/**
 * Fallback token prices for tokens CoinGecko does not list (README
 * showcase + Add Token, item D).
 *
 * CoinGecko stays the first source: a token with a CoinGecko id is
 * priced by the batched /simple/price call in token-prices.ts and
 * never reaches this module. Only tokens WITHOUT a CoinGecko id come
 * here, in this order:
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
 * there. A pair counts only when its baseToken.address IS the queried
 * token (and its chainId matches). Otherwise the token is
 * "unavailable" from this source, never priced with its pair
 * partner's price. When several pairs match, the highest-liquidity
 * one wins.
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
import type { ChainId } from '../engine/boundary';
import { isRecord, ownValue } from './guards';
import {
  PRICE_FETCH_TIMEOUT_MS,
  fetchJsonWithTimeout,
  isFreshQuote,
  type PriceEntry,
  type PriceQuote,
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



/**
 * Same token address: EVM hex compares case-insensitively (checksummed
 * vs lowercase), base58 (Solana/TRON) compares exactly — lowercasing
 * two different base58 strings could falsely equate them.
 */
function sameTokenAddress(left: string, right: string): boolean {
  if (left.startsWith('0x') && right.startsWith('0x')) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

/** A DexScreener priceUsd: a finite number > 0, string or numeric. */
function validUsdPrice(value: unknown): string | null {
  const price = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(price) || price <= 0) return null;
  return String(price);
}

function freshQuote(
  chain: ChainId,
  contract: string,
  usdPrice: string,
  source: PriceQuote['source'],
  nowMs: number,
): PriceEntry {
  const quote: PriceQuote = {
    chain,
    assetId: contract,
    providerAssetId: contract,
    usdPrice,
    providerUpdatedAtMs: nowMs,
    fetchedAtMs: nowMs,
    source,
  };
  return isFreshQuote(quote, nowMs) ? { status: 'fresh', quote } : { status: 'expired', quote };
}

function liquidityUsd(pair: Record<string, unknown>): number {
  const liquidity = ownValue(pair, 'liquidity');
  if (!isRecord(liquidity)) return 0;
  const usd = ownValue(liquidity, 'usd');
  return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : 0;
}

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
    let best: { price: string; liquidity: number } | null = null;
    if (dexChain !== undefined) {
      for (const value of payload as unknown[]) {
        if (!isRecord(value)) continue;
        if (ownValue(value, 'chainId') !== dexChain) continue;
        const baseToken = ownValue(value, 'baseToken');
        if (!isRecord(baseToken)) continue;
        const baseAddress = ownValue(baseToken, 'address');
        if (typeof baseAddress !== 'string') continue;
        if (!sameTokenAddress(baseAddress, request.contract)) continue;
        const price = validUsdPrice(ownValue(value, 'priceUsd'));
        if (price === null) continue;
        const liquidity = liquidityUsd(value);
        if (best === null || liquidity > best.liquidity) {
          best = { price, liquidity };
        }
      }
    }
    entries[request.key] =
      best === null
        ? { status: 'unavailable', reason: 'missing' }
        : freshQuote(request.chain, request.contract, best.price, 'DexScreener', nowMs);
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
        : freshQuote('ton', request.contract, price, 'TonAPI', nowMs);
  }
  return entries;
}

type FetchFn = typeof fetch;

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRICE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const seconds = retryAfter !== null && retryAfter.trim() !== '' ? Number(retryAfter) : NaN;
      const retryAfterMs = seconds * 1000;
      return {
        status: 'error',
        entries: {
          status: 'error',
          reason: 'rate-limited',
          ...(Number.isFinite(retryAfterMs) && retryAfterMs >= 0 ? { retryAfterMs } : {}),
        },
      };
    }
    if (!response.ok) {
      return { status: 'error', entries: { status: 'error', reason: 'provider' } };
    }
    try {
      return { status: 'ok', payload: await response.json() };
    } catch (error: unknown) {
      return {
        status: 'error',
        entries: { status: 'error', reason: isAbortError(error) ? 'timeout' : 'provider' },
      };
    }
  } catch (error: unknown) {
    return {
      status: 'error',
      entries: { status: 'error', reason: isAbortError(error) ? 'timeout' : 'network' },
    };
  } finally {
    clearTimeout(timer);
  }
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
