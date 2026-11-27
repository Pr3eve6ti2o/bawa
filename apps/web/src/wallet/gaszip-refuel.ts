// gas.zip refuel quotes — Lane C (providers programme, Phase 2, 2026-11-26).
//
// gas.zip is gas refuel ONLY, not a swap: one deposit of a chain's
// native gas asset is split across one or more destination chains so a
// wallet with no gas on a new chain can transact there. It does not
// swap tokens, does not move stablecoins, does not do token-to-token
// trades. It appears on the Swap screen as a separate "Refuel gas"
// action, never labelled a swap.
//
// API: public GETs on https://backend.gas.zip/v2, no key, no account,
// no SDK. `GET /v2/chains` is the chain list (never hardcoded);
// `GET /v2/quotes/<deposit_chain>/<deposit_wei>/<outbound_chains>`
// is the quote + calldata. The quote response carries
// `contractDepositTxn` — its `to` is the deposit address for THAT
// deposit chain and is the only deposit address this module ever uses.
//
// Verified live first-hand from loud-stone 2026-11-26 (open
// verification #11, now closed):
// - `GET /v2/chains` returns 186 entries. Each entry carries the
//   numeric chain id, name, symbol, decimals, live USD price,
//   `inbound` / `mainnet` flags and per-chain USD min/max — but NO
//   deposit address anywhere in the response, so the docs' example
//   address (0x391E7C679d29bD940d63be94AD22A25d25b5A604) is NOT used
//   as a fallback: a quote without `contractDepositTxn.to` is
//   malformed and surfaces as unavailable.
// - Live quote, 0.005 ETH on Ethereum -> Arbitrum (chain 8453):
//   expected 4999610396600102 wei (~$8.54), speed 3 s,
//   `contractDepositTxn.to` 0x2a37D63EAdFe4b4682a3c28C1c2cD4F109Cc2762
//   — a DIFFERENT address from the docs example, which is why the
//   quote's own address is authoritative per deposit chain.
// - Solana IS listed as a destination (chain 501474, mainnet, inbound)
//   but is NOT quotable right now: live quotes for 0.005 ETH and for
//   0.001 ETH both fail with the per-chain error "Chain Limit
//   Exceeded", and the chains entry shows maxOutbound 0. Solana is
//   therefore excluded from the destination list with that reason,
//   never offered dead.
// - The docs' example address is a well-known address that gas.zip's
//   own screening flags ("Restricted: Address has been flagged as high
//   risk") — quotes use the wallet's own addresses only.
//
// Fees — NO published schedule (verified gap, research §3.2): the fee
// lives only in the quote (deposit minus delivered amount) plus
// source-chain gas. The UI must show the quote's per-chain
// `expected`/`usd` BEFORE signing — that is the only fee disclosure
// available, and this module returns those figures untouched.
// Limits (docs overview): $0.25–$50.00 USD per destination chain.
// Quotes expire (`expires` in the response) — re-quote if stale.
//
// QUOTES ONLY. Nothing here signs, sends or bridges anything: the
// deposit transaction (one user-signed transaction to the quote's
// deposit address with the returned calldata) needs the owner's
// separate go-ahead, and mainnet broadcast stays DISABLED until then.
import { chainConfig, SUPPORTED_CHAINS } from './chains';
import { isRecord, ownValue } from './guards';
import type { ChainId } from '../engine/boundary';

/** gas.zip public API base. Keyless; see the module note. */
const GASZIP_BASE_URL = 'https://backend.gas.zip/v2';
const GASZIP_CHAINS_URL = `${GASZIP_BASE_URL}/chains`;
/** Minimum refuel per destination chain, USD (docs overview). */
export const GASZIP_MIN_USD_PER_CHAIN = 0.25;
/** Maximum refuel per destination chain, USD (docs overview). */
export const GASZIP_MAX_USD_PER_CHAIN = 50;
/** gas.zip chain id for Solana (listed, but live quotes fail — see note). */
export const GASZIP_SOLANA_CHAIN_ID = 501474;
/** Quotes go stale quickly — the screen shows the age and re-quotes. */
const GASZIP_QUOTE_STALE_MS = 60_000;
/** One quote attempt gets 15 s; a hung provider must not hang the form. */
const GASZIP_QUOTE_TIMEOUT_MS = 15_000;

const GASZIP_NOT_COVERED_SOLANA_MESSAGE =
  'Solana is listed by gas.zip but live quotes fail there right now ' +
  '(“Chain Limit Exceeded”), so it is not offered as a refuel destination.';
const GASZIP_UNAVAILABLE_MESSAGE =
  'Refuel quotes are unavailable right now. Check your connection and try again.';
const GASZIP_RATE_LIMITED_MESSAGE =
  'Refuel quotes are rate-limited right now. Try again in a little while.';

/** One chain from the live `GET /v2/chains` list. */
export interface GasZipChain {
  /** Numeric chain id gas.zip uses in quote URLs. */
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  /** Live USD price of one native unit (CoinGecko, via gas.zip). */
  priceUsd: number | null;
  /** True when the chain can be a deposit (source) chain. */
  inbound: boolean;
  /** True for mainnet entries (devnet/testnet rows are excluded). */
  mainnet: boolean;
  /** Per-chain USD floor / cap from the live list, when reported. */
  minOutboundUsd: number | null;
  maxOutboundUsd: number | null;
}

/** One destination line of a live gas.zip quote. */
interface GasZipQuoteLine {
  chainId: number;
  /** Delivered amount, in the destination chain's smallest units. */
  expectedBaseUnits: string;
  /** Delivered amount, native units as gas.zip reports it. */
  expectedNative: string;
  /** Destination gas, in wei (0 for non-EVM destinations). */
  gasWei: string | null;
  /** Rough settlement time in seconds. */
  speedSeconds: number | null;
  /** Delivered value in USD — the only fee disclosure available. */
  usd: number | null;
}

/** A live gas.zip refuel quote, parsed down to what the screen shows. */
export interface GasZipQuote {
  /** Deposit address for THIS deposit chain, from the live quote. */
  depositTo: string;
  /** Calldata for the deposit transaction (shown truncated, never sent). */
  depositData: string;
  /** Deposit value, hex wei, as the quote reports it. */
  depositValueHex: string;
  /** Epoch ms the quote expires (from the response `expires`). */
  expiresAtMs: number;
  quotes: GasZipQuoteLine[];
  /** Epoch ms the quote was fetched — quotes stale quickly. */
  fetchedAtMs: number;
}

type GasZipChainsResult =
  | { status: 'ok'; chains: GasZipChain[] }
  | { status: 'unavailable'; reason: string };

type GasZipQuoteResult =
  | { status: 'ok'; quote: GasZipQuote }
  | { status: 'no-route'; reason: string }
  | { status: 'unavailable'; reason: string };

interface GasZipDeps {
  fetchFn?: typeof fetch;
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  return null;
}

function asDecimalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBaseUnits(value: unknown): string | null {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}

function parseChain(raw: unknown): GasZipChain | null {
  if (!isRecord(raw)) return null;
  const chainId = asNonNegativeInt(ownValue(raw, 'chain'));
  const name = ownValue(raw, 'name');
  const symbol = ownValue(raw, 'symbol');
  const decimals = asNonNegativeInt(ownValue(raw, 'decimals'));
  if (chainId === null) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof symbol !== 'string' || symbol.length === 0) return null;
  if (decimals === null) return null;
  return {
    chainId,
    name,
    symbol,
    decimals,
    priceUsd: asDecimalNumber(ownValue(raw, 'price')),
    inbound: ownValue(raw, 'inbound') === true,
    mainnet: ownValue(raw, 'mainnet') === true,
    minOutboundUsd: asDecimalNumber(ownValue(raw, 'minOutbound')),
    maxOutboundUsd: asDecimalNumber(ownValue(raw, 'maxOutbound')),
  };
}

/**
 * Fetch the live gas.zip chain list. The list is the authority for
 * which chains can be deposit/destination chains — it is never
 * hardcoded. It carries no deposit address (verified live): the
 * quote response is the only source for that.
 */
export async function fetchGasZipChains(
  deps: GasZipDeps = {},
): Promise<GasZipChainsResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(GASZIP_CHAINS_URL, {
      signal: AbortSignal.timeout(GASZIP_QUOTE_TIMEOUT_MS),
    });
  } catch {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  let raw: unknown = null;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    raw = null;
  }
  if (!response.ok) {
    if (response.status === 429) {
      return { status: 'unavailable', reason: GASZIP_RATE_LIMITED_MESSAGE };
    }
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  if (!isRecord(raw)) {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  const entries = ownValue(raw, 'chains');
  if (!Array.isArray(entries)) {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  const chains = entries
    .map((entry) => parseChain(entry))
    .filter((entry): entry is GasZipChain => entry !== null);
  if (chains.length === 0) {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  return { status: 'ok', chains };
}

/**
 * gas.zip chain id for a Bawa chain, or null when gas.zip has no such
 * chain. EVM chains use their own chain id; Solana uses its gas.zip
 * id (listed, but live quotes fail — the screen excludes it with the
 * reason). Every other chain has no gas.zip route.
 */
export function gasZipChainIdFor(chain: ChainId): number | null {
  if (chain === 'sol') return GASZIP_SOLANA_CHAIN_ID;
  return chainConfig(chain).evmChainId;
}

/**
 * Bawa chains that can be gas.zip deposit chains, from the live list:
 * mainnet entries flagged inbound, that Bawa knows. The wallet must
 * also hold an address on the chain — the screen checks that.
 */
export function gasZipDepositChains(
  live: readonly GasZipChain[],
): readonly ChainId[] {
  const ids = new Set(
    live
      .filter((entry) => entry.inbound && entry.mainnet)
      .map((entry) => entry.chainId),
  );
  return SUPPORTED_CHAINS.filter((chain) => {
    const id = gasZipChainIdFor(chain);
    return id !== null && ids.has(id);
  });
}


/** USD value of a refuel, against the $0.25–$50 per-chain limits. */
export function gasZipLimitCheck(
  usd: number | null | undefined,
): 'ok' | 'below-minimum' | 'above-maximum' | 'unknown' {
  if (usd === null || usd === undefined) return 'unknown';
  if (!Number.isFinite(usd) || usd < 0) return 'unknown';
  if (usd < GASZIP_MIN_USD_PER_CHAIN) return 'below-minimum';
  if (usd > GASZIP_MAX_USD_PER_CHAIN) return 'above-maximum';
  return 'ok';
}

export function gasZipLimitMessage(
  check: ReturnType<typeof gasZipLimitCheck>,
): string | null {
  if (check === 'below-minimum') {
    return `Below the $${GASZIP_MIN_USD_PER_CHAIN.toFixed(2)} minimum per destination chain.`;
  }
  if (check === 'above-maximum') {
    return `Above the $${GASZIP_MAX_USD_PER_CHAIN.toFixed(2)} maximum per destination chain.`;
  }
  return null;
}

/** True when the quote must be re-fetched (60 s old, or past `expires`). */
export function isGasZipQuoteStale(quote: GasZipQuote, nowMs = Date.now()): boolean {
  if (nowMs - quote.fetchedAtMs > GASZIP_QUOTE_STALE_MS) return true;
  return nowMs >= quote.expiresAtMs;
}

function parseQuoteLine(raw: unknown): GasZipQuoteLine | null {
  if (!isRecord(raw)) return null;
  const chainId = asNonNegativeInt(ownValue(raw, 'chain'));
  const expected = asBaseUnits(ownValue(raw, 'expected'));
  const expectedNative = asBaseUnits(ownValue(raw, 'expectedNative'));
  if (chainId === null || expected === null || expectedNative === null) {
    return null;
  }
  const speed = asDecimalNumber(ownValue(raw, 'speed'));
  const gas = ownValue(raw, 'gas');
  return {
    chainId,
    expectedBaseUnits: expected,
    expectedNative,
    gasWei:
      typeof gas === 'string' && /^\d+$/.test(gas)
        ? gas
        : typeof gas === 'number' && Number.isSafeInteger(gas) && gas >= 0
          ? String(gas)
          : null,
    speedSeconds: speed === null ? null : Math.round(speed),
    usd: asDecimalNumber(ownValue(raw, 'usd')),
  };
}

export interface GasZipQuoteInput {
  fromChain: ChainId;
  toChain: ChainId;
  /** Deposit amount, in the deposit chain's native smallest units. */
  fromAmountBaseUnits: string;
  /** Sender address on the deposit chain. */
  fromAddress: string;
  /** Recipient address on the destination chain. */
  toAddress: string;
}

/**
 * Fetch one gas.zip refuel quote. One destination chain per call, so
 * the $0.25–$50 per-chain limit is exact. A per-chain provider error
 * (e.g. "Chain Limit Exceeded" for Solana) is `no-route` with the
 * provider's own words — never a guessed figure.
 */
export async function fetchGasZipQuote(
  input: GasZipQuoteInput,
  deps: GasZipDeps = {},
): Promise<GasZipQuoteResult> {
  const fromChainId = gasZipChainIdFor(input.fromChain);
  const toChainId = gasZipChainIdFor(input.toChain);
  if (fromChainId === null || toChainId === null) {
    return {
      status: 'no-route',
      reason: 'gas.zip does not list one of these chains.',
    };
  }
  if (input.toChain === 'sol') {
    return { status: 'no-route', reason: GASZIP_NOT_COVERED_SOLANA_MESSAGE };
  }
  const fetchFn = deps.fetchFn ?? fetch;
  const url =
    `${GASZIP_BASE_URL}/quotes/${fromChainId}/${input.fromAmountBaseUnits}/${toChainId}` +
    `?from=${encodeURIComponent(input.fromAddress)}` +
    `&to=${encodeURIComponent(input.toAddress)}`;
  let response: Response;
  try {
    response = await fetchFn(url, {
      signal: AbortSignal.timeout(GASZIP_QUOTE_TIMEOUT_MS),
    });
  } catch {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  let raw: unknown = null;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    raw = null;
  }
  if (!response.ok) {
    if (response.status === 429) {
      return { status: 'unavailable', reason: GASZIP_RATE_LIMITED_MESSAGE };
    }
    const perChainError = perChainErrorMessage(raw);
    if (perChainError !== null) {
      return { status: 'no-route', reason: `gas.zip could not quote this refuel: ${perChainError}` };
    }
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  if (!isRecord(raw)) {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  const perChainError = perChainErrorMessage(raw);
  if (perChainError !== null) {
    return { status: 'no-route', reason: `gas.zip could not quote this refuel: ${perChainError}` };
  }
  const deposit = ownValue(raw, 'contractDepositTxn');
  if (!isRecord(deposit)) {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  const depositTo = ownValue(deposit, 'to');
  const depositData = ownValue(deposit, 'data');
  const depositValue = ownValue(deposit, 'value');
  const expires = asDecimalNumber(ownValue(raw, 'expires'));
  const lines = ownValue(raw, 'quotes');
  if (
    typeof depositTo !== 'string' ||
    !/^0x[0-9a-fA-F]{40}$/.test(depositTo) ||
    typeof depositData !== 'string' ||
    !/^0x[0-9a-fA-F]*$/.test(depositData) ||
    typeof depositValue !== 'string' ||
    !/^0x[0-9a-fA-F]+$/.test(depositValue) ||
    expires === null ||
    !Array.isArray(lines)
  ) {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  const parsed = lines
    .map((line) => parseQuoteLine(line))
    .filter((line): line is GasZipQuoteLine => line !== null);
  if (parsed.length === 0) {
    return { status: 'unavailable', reason: GASZIP_UNAVAILABLE_MESSAGE };
  }
  return {
    status: 'ok',
    quote: {
      depositTo,
      depositData,
      depositValueHex: depositValue,
      expiresAtMs: Math.round(expires * 1000),
      quotes: parsed,
      fetchedAtMs: Date.now(),
    },
  };
}

/** The provider's own per-chain error, if the body carries one. */
function perChainErrorMessage(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const quotes = ownValue(raw, 'quotes');
  if (!Array.isArray(quotes)) return null;
  for (const line of quotes) {
    if (!isRecord(line)) continue;
    const error = ownValue(line, 'error');
    if (typeof error === 'string' && error.length > 0) return error;
  }
  return null;
}
