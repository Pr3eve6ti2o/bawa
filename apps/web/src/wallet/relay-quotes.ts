// Relay (RelaySwap) quotes — Lane C (providers programme, Phase 2, 2026-11-26).
//
// Relay is the cheapest/broadest general swap engine of the new
// providers (0.00% bridge, 0.01–0.15% swaps, +$0.02 flat, per its
// docs) — but `POST /quote/v3` on https://api.relay.link requires a
// secret API key or a short-lived access token on EVERY request (no
// key returns 401 UNAUTHORIZED_QUOTE). The key is server-side only
// and must NEVER ship in the app, and Bawa is a static site with no
// backend — so this client talks to a CONFIGURABLE proxy that
// appends the key server-side (the docs' own recommendation), or
// sends an access token minted by a backend. The proxy base URL comes
// from the build-time env `VITE_RELAY_PROXY_URL` and is EMPTY by
// default: with no proxy configured, quotes report `not-configured`
// with the honest sentence — this module NEVER fakes keyless
// operation and NEVER accepts an API key (there is no apiKey
// parameter anywhere in this file, by design).
//
// The proxy's origin must also be added to connect-src in
// app/security-headers.ts at deploy time: the CSP cannot learn a host
// at runtime (see the note in security-headers.test.ts).
//
// Request shape: the official quickstart (docs.relay.link,
// read 2026-11-26): user, originChainId, destinationChainId,
// originCurrency, destinationCurrency, amount, tradeType
// EXACT_INPUT, plus recipient. Response shape: the migration guide
// "Migrating to Quote v3" (docs.relay.link, read 2026-11-26) —
// flat steps (each step carries status/data/check directly, no
// items array), top-level requestId, a `fees` object whose components
// are { usd, amount, amountFormatted }, origin gas in `originGas`,
// and `details.currencyIn` / `details.currencyOut` as
// { amount, amountFormatted, amountUsd, minimumAmount }.
// `details.totalImpact` / `details.swapImpact` and `amountUsd` may
// be null. The parser below reads exactly those fields and treats
// anything else as malformed — never a partial quote.
//
// Coverage (open verification #9, now closed — live
// `GET https://api.relay.link/chains`, 2026-11-26): 58 chains,
// none disabled. Bawa chains covered: 33 EVM chains (eth, op,
// cronos, bsc, gnosis, unichain, matic, monad, sonic, manta,
// xlayer, boba, zksync, worldchain, flowevm, hyperevm, metis,
// soneium, ronin, abstract, mantle, base, apechain, mode, arb,
// celo, avax, ink, linea, bob, berachain, scroll, zora) plus btc,
// sol, ton and trx — and XRP, which the research had listed as not
// covered: Relay lists it (xrpvm, Limited, XRP only, bridging
// supported). NOT covered: ltc, doge (neither appears in /chains),
// fraxtal, immutable, taiko, astar, telos, conflux, core, songbird,
// rootstock, pulsechain, xdc, chiliz, flare, zetachain, hemi,
// opbnb, aurora, fantom, kava, filecoin, and the whole Cosmos /
// Polkadot / NEAR / Aptos / Tezos / Algorand / Hedera / Cardano /
// Kaspa / Starknet slice. Non-EVM legs are Limited: BTC native only,
// TON GRAM (native Toncoin) only, TRON USDT/TRX only, XRP native
// only; Solana is tokenSupport All. The chain ids for the non-EVM
// chains are Relay's own (Bitcoin 8253038, Solana 792703809, TON
// 224235520, TRON 728126428, XRP 537724) and the currency addresses
// below are the live /chains values for those chains.
//
// QUOTES ONLY. The response's steps carry executable transaction
// data — this module never returns it. Nothing here signs, sends or
// bridges anything; broadcast stays DISABLED on mainnet until the
// owner's separate go-ahead.
import { chainConfig } from './chains';
import { isRecord, ownValue } from './guards';
import type { ChainId } from '../engine/boundary';
import type { SwapTokenChoice } from './swap-quotes';

/** Relay public API base. Only used through the proxy — never directly. */
export const RELAY_API_BASE_URL = 'https://api.relay.link';
/** Build-time env name for the Relay proxy base URL (no key in the app). */
export const RELAY_PROXY_URL_ENV = 'VITE_RELAY_PROXY_URL';
/** One quote attempt gets 15 s; a hung provider must not hang the form. */
export const RELAY_QUOTE_TIMEOUT_MS = 15_000;
/** Native-token placeholder Relay expects on EVM chains. */
export const RELAY_NATIVE_EVM_ADDRESS =
  '0x0000000000000000000000000000000000000000';
/** Native SOL, from Relay's live /chains (same value LI.FI uses). */
export const RELAY_NATIVE_SOL_ADDRESS = '11111111111111111111111111111111';
/** Native BTC, from Relay's live /chains (its placeholder address). */
export const RELAY_NATIVE_BTC_ADDRESS =
  'bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqmql8k8';
/** Native Toncoin (GRAM), from Relay's live /chains. */
export const RELAY_NATIVE_TON_ADDRESS =
  'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
/** Native TRX, from Relay's live /chains. */
export const RELAY_NATIVE_TRX_ADDRESS =
  'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
/** USDT on TRON (TRC-20), from Relay's live /chains. */
export const RELAY_TRON_USDT_ADDRESS =
  'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
/** Native XRP, from Relay's live /chains. */
export const RELAY_NATIVE_XRP_ADDRESS = 'xrp';
/** Relay's own chain ids for the non-EVM chains (live /chains). */
export const RELAY_BITCOIN_CHAIN_ID = 8253038;
export const RELAY_SOLANA_CHAIN_ID = 792703809;
export const RELAY_TON_CHAIN_ID = 224235520;
export const RELAY_TRON_CHAIN_ID = 728126428;
export const RELAY_XRP_CHAIN_ID = 537724;

/** Bawa EVM chains in Relay's live /chains (verified 2026-11-26). */
export const RELAY_EVM_CHAINS: ReadonlySet<ChainId> = new Set<ChainId>([
  'eth', 'op', 'cronos', 'bsc', 'gnosis', 'unichain', 'matic', 'monad',
  'sonic', 'manta', 'xlayer', 'boba', 'zksync', 'worldchain', 'flowevm',
  'hyperevm', 'metis', 'soneium', 'ronin', 'abstract', 'mantle', 'base',
  'apechain', 'mode', 'arb', 'celo', 'avax', 'ink', 'linea', 'bob',
  'berachain', 'scroll', 'zora',
]);

export const RELAY_NOT_CONFIGURED_MESSAGE =
  'Relay quotes need a proxy or access-token endpoint — not set up yet';
const RELAY_UNAVAILABLE_MESSAGE =
  'Relay quotes are unavailable right now. Check your connection and try again.';
const RELAY_RATE_LIMITED_MESSAGE =
  'Relay quotes are rate-limited right now. Try again in a little while.';
const RELAY_UNAUTHORISED_MESSAGE =
  'Relay refused the quote — the proxy or access token is not set up correctly.';

/**
 * The configured Relay proxy base URL, or null when unset/blank.
 * The proxy appends the secret API key server-side; the URL itself
 * is not a secret. Mirrors the VITE_ read pattern in wallet/prices.ts
 * (direct member access on the cast env object, so Vitest stubEnv
 * tracks it).
 */
export function relayProxyBaseUrl(): string | null {
  const raw: unknown = (
    import.meta.env as Record<string, unknown>
  )[RELAY_PROXY_URL_ENV];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed === '' ? null : trimmed;
}

/**
 * Relay chain id for a Bawa chain, or null when Relay does not list
 * it (verified live 2026-11-26 — this is a coverage table, not a
 * guess: EVM chains use their own chain id only when Relay lists
 * them; the non-EVM chains use Relay's own ids).
 */
export function relayChainIdFor(chain: ChainId): number | null {
  if (chain === 'btc') return RELAY_BITCOIN_CHAIN_ID;
  if (chain === 'sol') return RELAY_SOLANA_CHAIN_ID;
  if (chain === 'ton') return RELAY_TON_CHAIN_ID;
  if (chain === 'trx') return RELAY_TRON_CHAIN_ID;
  if (chain === 'xrp') return RELAY_XRP_CHAIN_ID;
  if (!RELAY_EVM_CHAINS.has(chain)) return null;
  return chainConfig(chain).evmChainId;
}

/**
 * Relay currency address for a token choice on a chain, or null when
 * Relay does not offer that token there. Non-EVM legs are Limited to
 * the solver currencies in the live /chains response; EVM legs take
 * the token contract (the quote itself is the authority — a token
 * with no liquidity comes back as no-route, honestly).
 */
export function relayCurrencyAddress(
  chain: ChainId,
  token: SwapTokenChoice,
): string | null {
  if (chain === 'btc') {
    return token.kind === 'native' ? RELAY_NATIVE_BTC_ADDRESS : null;
  }
  if (chain === 'sol') {
    return token.kind === 'native'
      ? RELAY_NATIVE_SOL_ADDRESS
      : token.contract;
  }
  if (chain === 'ton') {
    return token.kind === 'native' ? RELAY_NATIVE_TON_ADDRESS : null;
  }
  if (chain === 'trx') {
    if (token.kind === 'native') return RELAY_NATIVE_TRX_ADDRESS;
    return token.contract.toLowerCase() ===
      RELAY_TRON_USDT_ADDRESS.toLowerCase()
      ? RELAY_TRON_USDT_ADDRESS
      : null;
  }
  if (chain === 'xrp') {
    return token.kind === 'native' ? RELAY_NATIVE_XRP_ADDRESS : null;
  }
  if (!RELAY_EVM_CHAINS.has(chain)) return null;
  return token.kind === 'native'
    ? RELAY_NATIVE_EVM_ADDRESS
    : token.contract;
}

/** A live Relay quote, parsed down to what the screen shows. */
export interface RelayQuote {
  /** Top-level requestId, for status tracking (never executed here). */
  requestId: string;
  /** Amount the recipient would get, in the destination token's units. */
  toAmountBaseUnits: string;
  /** Minimum received, same units. */
  toAmountMinBaseUnits: string;
  /** What the recipient gets, in USD (Relay's own figure). */
  toAmountUsd: string | null;
  /** Relay + venue fees, in USD (sum of the response fee components). */
  feeUsd: string | null;
  /** Origin-chain gas the wallet would pay, in USD. */
  gasUsd: string | null;
  /** Rough settlement time in seconds (details.timeEstimate). */
  executionDurationSeconds: number | null;
  /** Number of flat v3 steps the quote would need (informational). */
  stepCount: number;
  /** Epoch ms the quote was fetched — re-quote before acting on it. */
  fetchedAtMs: number;
}

export type RelayQuoteResult =
  | { status: 'ok'; quote: RelayQuote }
  | { status: 'no-route' }
  | { status: 'not-configured'; reason: string }
  | { status: 'unavailable'; reason: string };

export interface RelayQuoteInput {
  fromChain: ChainId;
  toChain: ChainId;
  fromToken: SwapTokenChoice;
  toToken: SwapTokenChoice;
  /** Amount to swap, in the source token's smallest units. */
  fromAmountBaseUnits: string;
  /** Sender address on the source chain. */
  fromAddress: string;
  /** Recipient address on the destination chain. */
  toAddress: string;
}

export interface RelayQuoteDeps {
  fetchFn?: typeof fetch;
  /** Proxy base URL override (tests); otherwise the env is read. */
  proxyUrl?: string | null;
  /** Short-lived access token minted by a backend, if one is held. */
  accessToken?: string;
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

/** Sum the `usd` fields of a Relay fees object, or null when none. */
function sumFeeUsd(fees: unknown): string | null {
  if (!isRecord(fees)) return null;
  let total = 0;
  let seen = false;
  for (const key of Object.keys(fees)) {
    const component = ownValue(fees, key);
    if (!isRecord(component)) continue;
    const usd = asDecimalString(ownValue(component, 'usd'));
    if (usd === null) continue;
    total += Number(usd);
    seen = true;
  }
  return seen ? total.toFixed(4) : null;
}

function parseQuote(raw: unknown): RelayQuote | null {
  if (!isRecord(raw)) return null;
  const requestId = ownValue(raw, 'requestId');
  const steps = ownValue(raw, 'steps');
  const details = ownValue(raw, 'details');
  if (typeof requestId !== 'string' || requestId.length === 0) return null;
  if (!Array.isArray(steps) || steps.length === 0) return null;
  if (!isRecord(details)) return null;
  const currencyOut = ownValue(details, 'currencyOut');
  if (!isRecord(currencyOut)) return null;
  const toAmount = asBaseUnits(ownValue(currencyOut, 'amount'));
  const toAmountMin = asBaseUnits(ownValue(currencyOut, 'minimumAmount'));
  if (toAmount === null || toAmountMin === null) return null;
  const timeEstimate = ownValue(details, 'timeEstimate');
  const originGas = ownValue(raw, 'originGas');
  const gasUsd = isRecord(originGas)
    ? asDecimalString(ownValue(originGas, 'amountUsd')) ??
      asDecimalString(ownValue(originGas, 'usd'))
    : null;
  return {
    requestId,
    toAmountBaseUnits: toAmount,
    toAmountMinBaseUnits: toAmountMin,
    toAmountUsd: asDecimalString(ownValue(currencyOut, 'amountUsd')),
    feeUsd: sumFeeUsd(ownValue(raw, 'fees')),
    gasUsd,
    executionDurationSeconds:
      typeof timeEstimate === 'number' &&
      Number.isFinite(timeEstimate) &&
      timeEstimate >= 0
        ? Math.round(timeEstimate)
        : null,
    stepCount: steps.length,
    fetchedAtMs: Date.now(),
  };
}

/**
 * Fetch one Relay quote through the configured proxy. With no proxy
 * configured this returns `not-configured` WITHOUT touching the
 * network — Relay cannot be quoted keyless, and this module never
 * pretends otherwise. No API key is ever sent from the browser: the
 * proxy appends it server-side, or an access token (minted by a
 * backend, 15-minute expiry) goes in the Authorization header.
 */
export async function fetchRelayQuote(
  input: RelayQuoteInput,
  deps: RelayQuoteDeps = {},
): Promise<RelayQuoteResult> {
  const proxyUrl = deps.proxyUrl !== undefined ? deps.proxyUrl : relayProxyBaseUrl();
  if (proxyUrl === null || proxyUrl === '') {
    return { status: 'not-configured', reason: RELAY_NOT_CONFIGURED_MESSAGE };
  }
  const fromChainId = relayChainIdFor(input.fromChain);
  const toChainId = relayChainIdFor(input.toChain);
  const fromCurrency = relayCurrencyAddress(input.fromChain, input.fromToken);
  const toCurrency = relayCurrencyAddress(input.toChain, input.toToken);
  if (
    fromChainId === null ||
    toChainId === null ||
    fromCurrency === null ||
    toCurrency === null
  ) {
    return { status: 'no-route' };
  }
  const fetchFn = deps.fetchFn ?? fetch;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (deps.accessToken !== undefined && deps.accessToken !== '') {
    headers.Authorization = `Bearer ${deps.accessToken}`;
  }
  let response: Response;
  try {
    response = await fetchFn(`${proxyUrl}/quote/v3`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user: input.fromAddress,
        recipient: input.toAddress,
        originChainId: fromChainId,
        destinationChainId: toChainId,
        originCurrency: fromCurrency,
        destinationCurrency: toCurrency,
        amount: input.fromAmountBaseUnits,
        tradeType: 'EXACT_INPUT',
      }),
      signal: AbortSignal.timeout(RELAY_QUOTE_TIMEOUT_MS),
    });
  } catch {
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  let raw: unknown = null;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    raw = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      return { status: 'not-configured', reason: RELAY_UNAUTHORISED_MESSAGE };
    }
    if (response.status === 429) {
      return { status: 'unavailable', reason: RELAY_RATE_LIMITED_MESSAGE };
    }
    if (isRecord(raw)) {
      const code = ownValue(raw, 'errorCode');
      const message = ownValue(raw, 'message');
      if (
        (typeof code === 'string' && /NO_ROUTE|QUOTE/i.test(code)) ||
        (typeof message === 'string' && /no route/i.test(message))
      ) {
        return { status: 'no-route' };
      }
    }
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  const quote = parseQuote(raw);
  if (quote === null) {
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  return { status: 'ok', quote };
}

/** Minimal per-chain record from the live `GET /chains` response. */
export interface RelayChainRecord {
  id: number;
  name: string;
  vmType: string;
  disabled: boolean;
  tokenSupport: string;
}

/**
 * Fetch the live Relay chain list through the proxy — the source of
 * truth for coverage when a proxy is configured. (Without a proxy
 * the static RELAY_EVM_CHAINS table, verified live 2026-11-26, is
 * what the UI labels with.)
 */
export async function fetchRelayChains(
  deps: RelayQuoteDeps = {},
): Promise<
  | { status: 'ok'; chains: RelayChainRecord[] }
  | { status: 'not-configured'; reason: string }
  | { status: 'unavailable'; reason: string }
> {
  const proxyUrl = deps.proxyUrl !== undefined ? deps.proxyUrl : relayProxyBaseUrl();
  if (proxyUrl === null || proxyUrl === '') {
    return { status: 'not-configured', reason: RELAY_NOT_CONFIGURED_MESSAGE };
  }
  const fetchFn = deps.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`${proxyUrl}/chains`, {
      signal: AbortSignal.timeout(RELAY_QUOTE_TIMEOUT_MS),
    });
  } catch {
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  let raw: unknown = null;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    raw = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      return { status: 'not-configured', reason: RELAY_UNAUTHORISED_MESSAGE };
    }
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  if (!isRecord(raw)) {
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  const entries = ownValue(raw, 'chains');
  if (!Array.isArray(entries)) {
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  const chains: RelayChainRecord[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const id = ownValue(entry, 'id');
    const name = ownValue(entry, 'name');
    const vmType = ownValue(entry, 'vmType');
    const tokenSupport = ownValue(entry, 'tokenSupport');
    if (
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      typeof name !== 'string' ||
      typeof vmType !== 'string' ||
      typeof tokenSupport !== 'string'
    ) {
      continue;
    }
    chains.push({
      id,
      name,
      vmType,
      disabled: ownValue(entry, 'disabled') === true,
      tokenSupport,
    });
  }
  if (chains.length === 0) {
    return { status: 'unavailable', reason: RELAY_UNAVAILABLE_MESSAGE };
  }
  return { status: 'ok', chains };
}
