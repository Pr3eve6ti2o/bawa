// STON.fi Omniston quotes — Lane C (providers programme, Phase 2, 2026-11-26).
//
// STON.fi is the TON corridor: the only provider of the four that
// covers TON↔EVM swaps at all. Omniston is RFQ quotes from competing
// resolvers, settled by HTLC atomic swaps (API v1beta8, production
// WebSocket wss://omni-ws.ston.fi). No key, no account, MIT SDKs.
// Stablecoins ONLY (USDT / USDC / USDT0 / pUSD / USDG + TON GRAM);
// Solana is NOT covered; TRON is listed but no live TRON quote has
// been seen yet (see below). DEX pool fee default 0.3%.
//
// WHAT THIS MODULE IS: the Omniston asset table (from the live
// chains page), the pair-coverage check, the documented QuoteRequest
// builder, AND the live RFQ client. The RFQ protocol is a typed
// JSON-RPC-over-WebSocket stream (protobuf-shaped QuoteRequest
// objects with $case unions, streaming ack / quote_updated /
// no_quote / keep_alive, HTLC secret hashes for cross-chain
// orders, order signing, and secret disclosure on the right
// execution phases — see the Node.js SDK guide, docs.ston.fi,
// read 2026-11-26). Re-implementing that by hand would be a second
// SDK, so the live client runs on the real SDK:
//
//   @ston-fi/omniston-sdk@0.8.13 — exact pin (the SDK README warns
//   breaking changes may happen even in minor releases while major
//   version is 0, so the pin must stay exact). MIT — verified
//   first-hand 2026-11-27: package.json "license": "MIT" plus the
//   LICENSE file text (Copyright (c) 2024 STON.fi), both read from
//   the installed package. The SDK is loaded with a dynamic import
//   inside fetchStonfiQuote, so it lands in its own async chunk —
//   never in the main chunk — and only loads when a STON.fi quote
//   is actually fetched. The Swap screen shows live quotes where
//   the corridor covers the pair, and the honest not-covered /
//   no-quote state where it does not. No STON.fi quote is ever
//   invented.
//
// LIVE PROOF (2026-11-27, loud-stone, real SDK over
// wss://omni-ws.ston.fi — full record in stonfi-quotes.test.ts):
// 1 USDT on TON -> USDC on Base (1,000,000 base units in) returned
// a live order quote of 972,487 USDC base units out (resolver
// Arbiter, 5-minute tradeStartDeadline, ~13 s settlement). 1 TON
// -> USDT on TON (1,000,000,000 in) returned a live swap quote of
// 960,344 USDT base units out (min 950,741, resolver Omniston).
// Both quotes arrived <1 s after the ack. RFQ only — no trade is
// built, signed or sent here.
//
// Asset table: the live chains page
// (docs.ston.fi/developer-section/omniston/chains.md, fetched
// 2026-11-26 — 15 chains; the 11 that are Bawa chains are listed
// here with their contract addresses exactly as published).
// TRON (open verification #10): still listed on the live page with
// USDT (TRC-20 TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t), and the
// production WebSocket wss://omni-ws.ston.fi accepts connections
// (probed 2026-11-26: open, clean close). But NO live TRON quote
// has been seen — that needs the RFQ flow, i.e. the SDK — and NO
// current per-transaction limit is published anywhere on the page
// (the $1,000/tx figure is a June-2026 secondary report, not a
// current official figure, so it is not quoted). TRON pairs are
// therefore flagged live-unverified and are NOT offered until a live
// quote is seen. TRON status: partially closed — live listing
// confirmed, live quote + current limit still open.
//
// TON signing (the main engineering cost): Bawa already signs TON
// transfers offline (signTonOffline in wallet/send.ts, V4R2) — but
// Omniston orders need TON Connect-style signing of the order's
// messages (orderTx.messages), a different message shape, and that
// path is NOT wired. Quotes need no signature; execution needs the
// SDK + that signing path + the owner's separate go-ahead. Broadcast
// stays DISABLED on mainnet until then.
import type { ChainId } from '../engine/boundary';
import type { SwapTokenChoice } from './swap-quotes';
import type {
  InferObservableData,
  Omniston,
  Quote,
  QuoteRequest,
} from '@ston-fi/omniston-sdk';

/** Omniston production WebSocket (trading / RFQ, JSON-RPC). */
export const STONFI_OMNISTON_WS_URL = 'wss://omni-ws.ston.fi';
/** Omniston API version. */
export const STONFI_API_VERSION = 'v1beta8';
/** SDK package (NOT yet a dependency — see the module note). */
export const STONFI_SDK_PACKAGE = '@ston-fi/omniston-sdk';
/** Exact pin for the SDK add (latest 0.8.x, MIT, verified 2026-11-26). */
export const STONFI_SDK_EXACT_VERSION = '0.8.13';
/** DEX pool fee default, percent (0.2% LPs + 0.1% protocol). */
export const STONFI_DEX_POOL_FEE_PERCENT = 0.3;

/** One quote attempt gets 15 s; a hung provider must not hang the form. */
export const STONFI_QUOTE_TIMEOUT_MS = 15_000;
const STONFI_UNAVAILABLE_MESSAGE =
  'STON.fi quotes are unavailable right now. Check your connection and try again.';
export const STONFI_TRON_UNVERIFIED_MESSAGE =
  'TRON is listed by STON.fi, but no live TRON quote has been seen yet — ' +
  'it is not offered until one is.';
export const STONFI_TON_SIGNING_MESSAGE =
  'TON signing for STON.fi orders is not wired yet — Bawa signs TON ' +
  'transfers offline, but Omniston order messages need a separate path.';

/** Bawa chain -> Omniston chain id (docs chains page). */
export const STONFI_CHAIN_IDS: Readonly<Record<string, string>> = {
  arb: 'arbitrum',
  avax: 'avalanche',
  base: 'base',
  bsc: 'bnb',
  eth: 'ethereum',
  hyperevm: 'hyperevm',
  matic: 'polygon',
  ton: 'ton',
  trx: 'tron',
  xlayer: 'xlayer',
};

export type StonfiAssetKind = 'native' | 'jetton' | 'erc20' | 'trc20';

export interface StonfiAsset {
  symbol: string;
  kind: StonfiAssetKind;
  /** Contract / jetton address; null for native GRAM. */
  contract: string | null;
  /** True when the listing is live-unverified (TRON — see module note). */
  liveUnverified: boolean;
}

/**
 * Omniston assets per Bawa chain, exactly as published on the live
 * chains page (2026-11-26). Stablecoins only, plus TON GRAM.
 */
export const STONFI_ASSETS: Readonly<Record<string, readonly StonfiAsset[]>> = {
  arb: [
    { symbol: 'USDT0', kind: 'erc20', contract: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', liveUnverified: false },
  ],
  avax: [
    { symbol: 'USDT', kind: 'erc20', contract: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', liveUnverified: false },
  ],
  base: [
    { symbol: 'USDT', kind: 'erc20', contract: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', liveUnverified: false },
  ],
  bsc: [
    { symbol: 'USDT', kind: 'erc20', contract: '0x55d398326f99059fF775485246999027B3197955', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', liveUnverified: false },
  ],
  eth: [
    { symbol: 'USDT', kind: 'erc20', contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', liveUnverified: false },
  ],
  hyperevm: [
    { symbol: 'USDT0', kind: 'erc20', contract: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0xb88339CB7199b77E23DB6E890353E22632Ba630f', liveUnverified: false },
  ],
  matic: [
    { symbol: 'pUSD', kind: 'erc20', contract: '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', liveUnverified: false },
    { symbol: 'USDT0', kind: 'erc20', contract: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', liveUnverified: false },
  ],
  ton: [
    { symbol: 'GRAM', kind: 'native', contract: null, liveUnverified: false },
    { symbol: 'USDT', kind: 'jetton', contract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', liveUnverified: false },
  ],
  trx: [
    { symbol: 'USDT', kind: 'trc20', contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', liveUnverified: true },
  ],
  xlayer: [
    { symbol: 'USDT0', kind: 'erc20', contract: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736', liveUnverified: false },
    { symbol: 'USDC', kind: 'erc20', contract: '0xb6ceceab302e2e4948951ee7843fc24e92933061', liveUnverified: false },
  ],
};

/**
 * The Omniston asset for a token choice on a chain, or null when the
 * token is not a listed Omniston asset there. Native TON maps to
 * GRAM; native coins on EVM chains are not Omniston assets
 * (stablecoins only).
 */
export function stonfiAssetFor(
  chain: ChainId,
  token: SwapTokenChoice,
): StonfiAsset | null {
  const assets = STONFI_ASSETS[chain];
  if (assets === undefined) return null;
  if (token.kind === 'native') {
    return assets.find((asset) => asset.kind === 'native') ?? null;
  }
  const contract = token.contract.toLowerCase();
  return (
    assets.find(
      (asset) =>
        asset.contract !== null && asset.contract.toLowerCase() === contract,
    ) ?? null
  );
}

export type StonfiCoverage =
  | { covered: true }
  | { covered: false; reason: string };

/**
 * Whether Omniston covers a pair: both sides must be listed assets.
 * TRON pairs are listed but live-unverified — covered:false with
 * the TRON reason until a live quote is seen. Anything else (SOL,
 * BTC, the long tail, non-stablecoins) is honestly not covered.
 */
export function stonfiCoversPair(
  fromChain: ChainId,
  fromToken: SwapTokenChoice,
  toChain: ChainId,
  toToken: SwapTokenChoice,
): StonfiCoverage {
  const fromAsset = stonfiAssetFor(fromChain, fromToken);
  const toAsset = stonfiAssetFor(toChain, toToken);
  if (fromAsset === null || toAsset === null) {
    return {
      covered: false,
      reason:
        'STON.fi covers stablecoins only, between TON and 13 EVM chains — ' +
        'this pair is outside that corridor.',
    };
  }
  if (fromAsset.liveUnverified || toAsset.liveUnverified) {
    return { covered: false, reason: STONFI_TRON_UNVERIFIED_MESSAGE };
  }
  return { covered: true };
}

/** The documented QuoteRequest shape (SDK guide, order example). */
export interface StonfiQuoteRequest {
  inputAsset: unknown;
  outputAsset: unknown;
  amount: { $case: 'inputUnits'; value: string };
  settlementParams: unknown[];
}

function assetId(chain: ChainId, asset: StonfiAsset): unknown {
  const chainId = STONFI_CHAIN_IDS[chain];
  if (asset.kind === 'native') {
    return {
      chain: {
        $case: chainId,
        value: { kind: { $case: 'native', value: {} } },
      },
    };
  }
  return {
    chain: {
      $case: chainId,
      value: { kind: { $case: asset.kind, value: asset.contract } },
    },
  };
}

/**
 * Build the QuoteRequest for a covered pair, in the exact shape the
 * SDK guide documents (order settlement for cross-chain, swap
 * settlement for TON-intrachain, 1% max slippage). Returns null for
 * an uncovered pair — the caller checks stonfiCoversPair first for
 * the reason. Building the request needs no SDK; SENDING it (the
 * RFQ stream, HTLC secrets, order signing, secret disclosure) does.
 */
export function buildStonfiQuoteRequest(
  fromChain: ChainId,
  fromToken: SwapTokenChoice,
  toChain: ChainId,
  toToken: SwapTokenChoice,
  fromAmountBaseUnits: string,
): StonfiQuoteRequest | null {
  const coverage = stonfiCoversPair(fromChain, fromToken, toChain, toToken);
  if (!coverage.covered) return null;
  const fromAsset = stonfiAssetFor(fromChain, fromToken);
  const toAsset = stonfiAssetFor(toChain, toToken);
  if (fromAsset === null || toAsset === null) return null;
  const crossChain = fromChain !== toChain;
  return {
    inputAsset: assetId(fromChain, fromAsset),
    outputAsset: assetId(toChain, toAsset),
    amount: { $case: 'inputUnits', value: fromAmountBaseUnits },
    settlementParams: crossChain
      ? [{ params: { $case: 'order', value: {} } }]
      : [
          {
            params: {
              $case: 'swap',
              value: { maxPriceSlippagePips: 10_000, flexibleIntegratorFee: true },
            },
          },
        ],
  };
}

/** One event of the RFQ stream, as the SDK delivers it. */
export type StonfiRfqEvent = InferObservableData<
  ReturnType<Omniston['requestForQuote']>
>;

/**
 * The sliver of the Omniston client fetchStonfiQuote needs: one RFQ
 * stream plus the transport close. The real client (default factory
 * below) satisfies this structurally; tests inject a fake that
 * replays canned events. Note the SDK's Omniston class declares no
 * public close() in 0.8.13 (verified against its .d.ts and at
 * runtime — `typeof omniston.close` is 'undefined'); the close path
 * is the transport, `omniston.transport.close()`.
 */
export interface StonfiRfqClient {
  readonly transport: { close: () => void };
  requestForQuote: (request: QuoteRequest) => {
    subscribe: (observer: {
      next?: (event: StonfiRfqEvent | null) => void;
      error?: (error: unknown) => void;
      complete?: () => void;
    }) => { unsubscribe: () => void };
  };
}

/** A live STON.fi quote, parsed down to what the screen shows. */
export interface StonfiQuote {
  /** ID of the quote generated by the platform. */
  quoteId: string;
  /** Net amount the recipient would get, destination token base units. */
  toAmountBaseUnits: string;
  /** Minimum received (swap settlement only; null for orders). */
  toAmountMinBaseUnits: string | null;
  /** Estimated settlement time in seconds (null when not reported). */
  estimatedSettlementDurationSeconds: number | null;
  /** Order trade-start deadline, epoch ms (null for swap settlement). */
  tradeStartDeadlineMs: number | null;
  /** Epoch ms the quote was fetched — re-quote before acting on it. */
  fetchedAtMs: number;
}

export type StonfiQuoteResult =
  | { status: 'ok'; quote: StonfiQuote }
  | { status: 'no-quote' }
  | { status: 'not-covered'; reason: string }
  | { status: 'unavailable'; reason: string };

export interface StonfiQuoteInput {
  fromChain: ChainId;
  toChain: ChainId;
  fromToken: SwapTokenChoice;
  toToken: SwapTokenChoice;
  /** Amount to swap, in the source token's smallest units. */
  fromAmountBaseUnits: string;
}

export interface StonfiQuoteDeps {
  /** Client factory override (tests); otherwise a live client is opened. */
  createClient?: () => Promise<StonfiRfqClient> | StonfiRfqClient;
  /** Quote wait budget override (tests); default STONFI_QUOTE_TIMEOUT_MS. */
  timeoutMs?: number;
}

function asBaseUnits(value: unknown): string | null {
  return typeof value === 'string' && /^\d+$/.test(value) ? value : null;
}

/**
 * Convert one SDK Quote into the screen's StonfiQuote, or null when
 * the quote is not usable: a missing/empty quote id, a zero or
 * malformed output, a malformed swap minimum, or an order quote
 * whose tradeStartDeadline has already passed. An unusable quote is
 * ignored and the stream keeps running — the next quoteUpdated may
 * be a good one. Never a partial quote.
 */
export function parseStonfiQuote(quote: Quote): StonfiQuote | null {
  if (typeof quote.quoteId !== 'string' || quote.quoteId.length === 0) {
    return null;
  }
  const toAmount = asBaseUnits(quote.outputUnits);
  if (toAmount === null) return null;
  try {
    if (BigInt(toAmount) === 0n) return null;
  } catch {
    return null;
  }
  const estimated =
    typeof quote.estimatedSettlementDuration === 'number' &&
    Number.isFinite(quote.estimatedSettlementDuration) &&
    quote.estimatedSettlementDuration >= 0
      ? Math.round(quote.estimatedSettlementDuration)
      : null;
  const settlement = quote.settlementData;
  if (settlement.$case === 'order') {
    const deadline = settlement.value.tradeStartDeadline;
    if (typeof deadline !== 'number' || !Number.isFinite(deadline)) {
      return null;
    }
    const tradeStartDeadlineMs = deadline * 1000;
    // An order quote past its trade-start deadline is expired: the
    // resolver may still settle it at its discretion, but Bawa never
    // offers an expired quote — the stream may deliver a fresh one.
    if (tradeStartDeadlineMs <= Date.now()) return null;
    return {
      quoteId: quote.quoteId,
      toAmountBaseUnits: toAmount,
      toAmountMinBaseUnits: null,
      estimatedSettlementDurationSeconds: estimated,
      tradeStartDeadlineMs,
      fetchedAtMs: Date.now(),
    };
  }
  const minOutput = asBaseUnits(settlement.value.minOutputAmount);
  if (minOutput === null) return null;
  return {
    quoteId: quote.quoteId,
    toAmountBaseUnits: toAmount,
    toAmountMinBaseUnits: minOutput,
    estimatedSettlementDurationSeconds: estimated,
    tradeStartDeadlineMs: null,
    fetchedAtMs: Date.now(),
  };
}

/**
 * Open a live Omniston client. Dynamic import: the SDK lands in its
 * own async chunk, loaded only when a STON.fi quote is fetched —
 * never in the main chunk, and never until it is needed.
 */
async function defaultCreateClient(): Promise<StonfiRfqClient> {
  const { Omniston } = await import('@ston-fi/omniston-sdk');
  const omniston = new Omniston({ apiUrl: STONFI_OMNISTON_WS_URL });
  return {
    transport: omniston.transport,
    requestForQuote: (request) => {
      const stream = omniston.requestForQuote(request);
      return { subscribe: (observer) => stream.subscribe(observer) };
    },
  };
}

/**
 * Fetch one live STON.fi quote for a covered pair. Uncovered pairs
 * return `not-covered` WITHOUT touching the network. The first valid
 * quoteUpdated wins and the stream is closed; noQuote (or a null
 * event, which the SDK sends when no resolver has a quote) is an
 * honest `no-quote`; a stream error, a server-closed stream, or the
 * 15 s timeout is `unavailable`. Quotes only: the returned quote
 * carries no transaction data, nothing here signs, and execution
 * (order building + TON message signing) is a separate step that is
 * NOT wired — see the module note.
 */
export async function fetchStonfiQuote(
  input: StonfiQuoteInput,
  deps: StonfiQuoteDeps = {},
): Promise<StonfiQuoteResult> {
  const coverage = stonfiCoversPair(
    input.fromChain,
    input.fromToken,
    input.toChain,
    input.toToken,
  );
  if (!coverage.covered) {
    return { status: 'not-covered', reason: coverage.reason };
  }
  const request = buildStonfiQuoteRequest(
    input.fromChain,
    input.fromToken,
    input.toChain,
    input.toToken,
    input.fromAmountBaseUnits,
  );
  if (request === null) {
    // Defensive: the builder returns null exactly when the pair is
    // uncovered, which the coverage check above already excluded.
    return {
      status: 'not-covered',
      reason: 'STON.fi does not cover this pair.',
    };
  }
  const timeoutMs = deps.timeoutMs ?? STONFI_QUOTE_TIMEOUT_MS;
  let client: StonfiRfqClient;
  try {
    const createClient = deps.createClient ?? defaultCreateClient;
    client = await createClient();
  } catch {
    return { status: 'unavailable', reason: STONFI_UNAVAILABLE_MESSAGE };
  }
  return new Promise<StonfiQuoteResult>((resolve) => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    const timer = setTimeout(() => {
      settle({ status: 'unavailable', reason: STONFI_UNAVAILABLE_MESSAGE });
    }, timeoutMs);
    function settle(result: StonfiQuoteResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        subscription?.unsubscribe();
      } catch {
        // Closing a dead stream must not fail the quote.
      }
      try {
        client.transport.close();
      } catch {
        // Closing a dead transport must not fail the quote.
      }
      resolve(result);
    }
    let stream: ReturnType<StonfiRfqClient['requestForQuote']>;
    try {
      // The scaffold request is the documented guide shape (proven
      // by the deep-equality test against the guide's order
      // example); the cast is the seam to the SDK's generated type.
      stream = client.requestForQuote(request as unknown as QuoteRequest);
    } catch {
      settle({ status: 'unavailable', reason: STONFI_UNAVAILABLE_MESSAGE });
      return;
    }
    try {
      subscription = stream.subscribe({
        next: (event) => {
          if (event === null) {
            // The SDK sends null when no resolver has a quote after
            // an old one expired: no valid quote for this RFQ.
            settle({ status: 'no-quote' });
            return;
          }
          if (event.$case === 'ack') return;
          if (event.$case === 'quoteUpdated') {
            const quote = parseStonfiQuote(event.value);
            if (quote !== null) settle({ status: 'ok', quote });
            return;
          }
          if (event.$case === 'noQuote') {
            settle({ status: 'no-quote' });
            return;
          }
          // 'unsubscribed': the server closed the stream before any
          // usable quote arrived.
          settle({ status: 'unavailable', reason: STONFI_UNAVAILABLE_MESSAGE });
        },
        error: () => {
          settle({ status: 'unavailable', reason: STONFI_UNAVAILABLE_MESSAGE });
        },
        complete: () => {
          settle({ status: 'unavailable', reason: STONFI_UNAVAILABLE_MESSAGE });
        },
      });
    } catch {
      settle({ status: 'unavailable', reason: STONFI_UNAVAILABLE_MESSAGE });
    }
  });
}
