// Swap quotes — Lane 6 (UX-major programme, 2026-11-26).
//
// READ-ONLY quotes from LI.FI's public routing API (https://li.quest/v1).
// No key, no account: LI.FI's own docs (docs.li.fi, Authentication,
// updated 2026-11-12) say "Public routing endpoints on https://li.quest
// can be used without a key, subject to their rate limits" — without a
// key /quote is 75 requests per 2 hours; a free key from the LI.FI
// Partner Portal (portal.li.fi) raises the limit. Verified live
// first-hand from loud-stone 2026-11-26, no key, no header:
//   ETH (chain 1) 0.1 -> USDC.e on Polygon (137): toAmount 167627101
//   (~$167.74) via Layerswap, LI.FI fee $0.42, gas $0.018, 15 s.
//   SOL -> USDC on Solana: toAmount 7039786 (~$7.05) via dflow,
//   gas $0.0021.
// Jupiter's api.jup.ag/swap/v1/quote was also verified live the same day
// (0.1 SOL -> 7.058749 USDC, no key) but is Solana-only, so LI.FI is the
// single quote source: it covers same-chain swaps and cross-chain
// bridges for EVM chains + Solana.
//
// QUOTES ONLY. The LI.FI response also carries a `transactionRequest`
// (ready-to-sign calldata) — this module never returns it and nothing
// in this lane signs, sends, swaps or bridges anything: mainnet
// broadcast stays DISABLED until separately authorised, and executing
// a quote needs a swap provider + signing + broadcast, which the Swap
// screen states plainly. A quote is informational: amounts, route,
// fees and timing, all from the live response, never invented.
//
// What LI.FI cannot quote: chains it does not support (BTC, TRX, TON
// and the non-EVM expansion chains have no LI.FI chain id here), and
// pairs with no liquidity — both surface as `no-route`, never as a
// guessed number. A failed fetch surfaces as `unavailable` with a
// human sentence; the raw provider error is never rendered.
import { chainConfig } from './chains';
import { isRecord, ownValue } from './guards';
import type { ChainId } from '../engine/boundary';

/** LI.FI public routing API base. Keyless; see the module note. */
const LIFI_QUOTE_BASE_URL = 'https://li.quest/v1';
const LIFI_QUOTE_URL = `${LIFI_QUOTE_BASE_URL}/quote`;
/** Slippage tolerance sent with every quote, as a decimal (0.01 = 1%). */
export const LIFI_SLIPPAGE = 0.01;
/** LI.FI chain id for Solana (its non-EVM chain ids are not EVM ids). */
export const LIFI_SOLANA_CHAIN_ID = 1151111081099710;
/** Native-token placeholder LI.FI expects on EVM chains. */
const LIFI_NATIVE_EVM_ADDRESS =
  '0x0000000000000000000000000000000000000000';
/** Native-token placeholder LI.FI expects on Solana. */
const LIFI_NATIVE_SOL_ADDRESS = '11111111111111111111111111111111';
/** One quote attempt gets 15 s; a hung provider must not hang the form. */
const LIFI_QUOTE_TIMEOUT_MS = 15_000;

/**
 * LI.FI chain id for a Bawa chain, or null when LI.FI cannot route it.
 * EVM chains use their own chain id; Solana uses its LI.FI id; every
 * other chain (BTC, TRX, TON, the non-EVM expansion chains, Cardano,
 * Kaspa, Starknet) has no LI.FI route and is honestly unquotable.
 */
export function lifiChainIdFor(chain: ChainId): number | null {
  if (chain === 'sol') return LIFI_SOLANA_CHAIN_ID;
  return chainConfig(chain).evmChainId;
}

/** One side of a swap: the native coin or one verified token. */
export type SwapTokenChoice =
  | { kind: 'native'; symbol: string; decimals: number }
  | {
      kind: 'token';
      contract: string;
      symbol: string;
      decimals: number;
    };

/** The token address LI.FI expects for a choice on a chain. */
export function lifiTokenAddress(chain: ChainId, token: SwapTokenChoice): string {
  if (token.kind === 'token') return token.contract;
  return chain === 'sol' ? LIFI_NATIVE_SOL_ADDRESS : LIFI_NATIVE_EVM_ADDRESS;
}

/** A live LI.FI quote, parsed down to what the screen shows. */
export interface SwapQuote {
  /** Bridge/DEX that would execute the route (e.g. 'layerswap'). */
  tool: string;
  /** Amount the recipient would get, in the destination token's units. */
  toAmountBaseUnits: string;
  /** Minimum received at the quoted slippage, same units. */
  toAmountMinBaseUnits: string;
  /** What the sender pays, in USD (LI.FI's own figure). */
  fromAmountUsd: string | null;
  /** What the recipient gets, in USD (LI.FI's own figure). */
  toAmountUsd: string | null;
  /** Bridge + aggregator fees, in USD (sum of the response feeCosts). */
  feeUsd: string | null;
  /** Network gas for the route, in USD (sum of the response gasCosts). */
  gasUsd: string | null;
  /** Rough settlement time in seconds (LI.FI executionDuration). */
  executionDurationSeconds: number | null;
  /** Epoch ms the quote was fetched — quotes stale in ~60 s. */
  fetchedAtMs: number;
}

export type SwapQuoteResult =
  | { status: 'ok'; quote: SwapQuote }
  | { status: 'no-route' }
  | { status: 'unavailable'; reason: string };

export interface SwapQuoteInput {
  fromChain: ChainId;
  toChain: ChainId;
  fromToken: SwapTokenChoice;
  toToken: SwapTokenChoice;
  /** Amount to swap, in the source token's smallest units. */
  fromAmountBaseUnits: string;
  /** Sender address on the source chain (LI.FI needs it for the quote). */
  fromAddress: string;
  /** Recipient address on the destination chain. */
  toAddress: string;
}

interface SwapQuoteDeps {
  fetchFn?: typeof fetch;
}

function asDecimalString(value: unknown): string | null {
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asBaseUnits(value: unknown): string | null {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}

/** Sum the amountUSD fields of a LI.FI cost list, or null when none. */
function sumUsdCosts(costs: unknown): string | null {
  if (!Array.isArray(costs)) return null;
  let total = 0;
  let seen = false;
  for (const cost of costs) {
    if (!isRecord(cost)) continue;
    const usd = asDecimalString(ownValue(cost, 'amountUSD'));
    if (usd === null) continue;
    total += Number(usd);
    seen = true;
  }
  return seen ? total.toFixed(4) : null;
}

function parseQuote(raw: unknown): SwapQuote | null {
  if (!isRecord(raw)) return null;
  const estimate = ownValue(raw, 'estimate');
  if (!isRecord(estimate)) return null;
  const tool = ownValue(raw, 'tool');
  const toAmount = asBaseUnits(ownValue(estimate, 'toAmount'));
  const toAmountMin = asBaseUnits(ownValue(estimate, 'toAmountMin'));
  if (typeof tool !== 'string' || tool.length === 0) return null;
  if (toAmount === null || toAmountMin === null) return null;
  const duration = ownValue(estimate, 'executionDuration');
  return {
    tool,
    toAmountBaseUnits: toAmount,
    toAmountMinBaseUnits: toAmountMin,
    fromAmountUsd: asDecimalString(ownValue(estimate, 'fromAmountUSD')),
    toAmountUsd: asDecimalString(ownValue(estimate, 'toAmountUSD')),
    feeUsd: sumUsdCosts(ownValue(estimate, 'feeCosts')),
    gasUsd: sumUsdCosts(ownValue(estimate, 'gasCosts')),
    executionDurationSeconds:
      typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
        ? Math.round(duration)
        : null,
    fetchedAtMs: Date.now(),
  };
}

const RATE_LIMITED_MESSAGE =
  'Swap quotes are rate-limited right now. Try again in a little while.';
const UNAVAILABLE_MESSAGE =
  'Swap quotes are unavailable right now. Check your connection and try again.';

/**
 * Fetch one LI.FI quote. The caller passes real addresses and a real
 * amount; the result is the provider's own numbers or an honest
 * no-route/unavailable — never a fallback or invented figure.
 */
export async function fetchSwapQuote(
  input: SwapQuoteInput,
  deps: SwapQuoteDeps = {},
): Promise<SwapQuoteResult> {
  const fromChainId = lifiChainIdFor(input.fromChain);
  const toChainId = lifiChainIdFor(input.toChain);
  if (fromChainId === null || toChainId === null) return { status: 'no-route' };
  const fetchFn = deps.fetchFn ?? fetch;
  const params = new URLSearchParams({
    fromChain: String(fromChainId),
    toChain: String(toChainId),
    fromToken: lifiTokenAddress(input.fromChain, input.fromToken),
    toToken: lifiTokenAddress(input.toChain, input.toToken),
    fromAmount: input.fromAmountBaseUnits,
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    slippage: String(LIFI_SLIPPAGE),
  });
  let response: Response;
  try {
    response = await fetchFn(`${LIFI_QUOTE_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(LIFI_QUOTE_TIMEOUT_MS),
    });
  } catch {
    return { status: 'unavailable', reason: UNAVAILABLE_MESSAGE };
  }
  let raw: unknown = null;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    raw = null;
  }
  if (!response.ok) {
    if (response.status === 429) {
      return { status: 'unavailable', reason: RATE_LIMITED_MESSAGE };
    }
    const message =
      isRecord(raw) && typeof ownValue(raw, 'message') === 'string'
        ? (ownValue(raw, 'message') as string)
        : '';
    if (/no route/i.test(message)) return { status: 'no-route' };
    return { status: 'unavailable', reason: UNAVAILABLE_MESSAGE };
  }
  const quote = parseQuote(raw);
  // A 200 whose body does not parse is a provider hiccup, not proof
  // that no route exists — Relay maps the same case to unavailable,
  // and so must LI.FI (A-6).
  if (quote === null) {
    return { status: 'unavailable', reason: UNAVAILABLE_MESSAGE };
  }
  return { status: 'ok', quote };
}

/**
 * Format a LI.FI USD figure ("167.7414") as "$167.74". Null in, null
 * out — a missing USD figure renders as no dollar value, never $0.00.
 */
export function formatQuoteUsd(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return `$${parsed.toFixed(2)}`;
}
