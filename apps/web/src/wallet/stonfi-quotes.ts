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
// WHAT THIS MODULE IS: the quote-flow scaffolding — the Omniston
// asset table (from the live chains page), the pair-coverage check,
// and the documented QuoteRequest builder — plus the honest state
// that live quotes need the SDK. WHAT IT IS NOT: a hand-rolled RFQ
// client. The RFQ protocol is a typed JSON-RPC-over-WebSocket stream
// (protobuf-shaped QuoteRequest objects with $case unions, streaming
// ack / quote_updated / no_quote / keep_alive, HTLC secret hashes
// for cross-chain orders, order signing, and secret disclosure on
// the right execution phases — see the Node.js SDK guide,
// docs.ston.fi, read 2026-11-26). Re-implementing that by hand would
// be a second SDK, so the remaining step is the dependency add:
//
//   npm install @ston-fi/omniston-sdk@0.8.13
//
// — exact pin 0.8.13 (latest 0.8.x, MIT verified first-hand from
// the installed LICENSE file + package.json "license" field,
// 2026-11-27; the SDK README warns breaking changes may
// happen even in minor releases while major version is 0, so the pin
// must stay exact). The dep add is NOT committed here: the SDK was
// installed only to run the live-RFQ probe below and then reverted;
// package.json belongs to another lane (Lane A, panel-rebuild/stonfi)
// and a dep add would collide.
// Until it lands, the Swap screen shows the corridor honestly:
// which pairs it would cover, and that live STON.fi quotes need the
// SDK. No STON.fi quote is ever invented.
//
// Asset table: the live chains page
// (docs.ston.fi/developer-section/omniston/chains.md, fetched
// 2026-11-26 — 15 chains; the 11 that are Bawa chains are listed
// here with their contract addresses exactly as published).
// TRON (open verification #10 — Lane C, 2026-11-27): chains page
// re-fetched 2026-11-27 (HTTP 200): TRON still listed with USDT
// (TRC-20 TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t); production
// WebSocket wss://omni-ws.ston.fi re-probed the same day: open,
// clean close (code 1000, wasClean, 967 ms). LIVE RFQ ATTEMPTED
// with the SDK (@ston-fi/omniston-sdk@0.8.13, production WS):
// control 1 USDT TON -> USDC Base quoted live in 926 ms
// (quoteId 29febd35…42ba, outputUnits 972488), so the harness
// works — but every TRON RFQ came back noQuote (server ack, then
// noQuote ~5 s in, nothing in 45 s): TRON -> TON 10 and 1 USDT,
// TON -> TRON 10 and 1 USDT, TRON -> Base 10 USDT. No resolver is
// quoting TRON in either direction at any tried amount. TRON
// therefore STAYS live-unverified and is NOT offered. NO current
// per-transaction limit exists anywhere official: the chains page,
// environments page, SDK guide and SDK 0.8.13 source contain no
// tx-limit figure (only the reconnection max-5 and the HTLC
// one-execution-per-order max, both unrelated). The only figure is
// the official STON.fi blog launch post (2026-06-16, "temporarily
// limited to $1,000 per transaction" AT LAUNCH) — five months
// stale, not current, so it is not quoted. TRON status: listing
// confirmed, live quote still open (no resolvers quoting), current
// limit still open (no official figure).
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

export const STONFI_SDK_NEEDED_MESSAGE =
  `Live STON.fi quotes need ${STONFI_SDK_PACKAGE}@${STONFI_SDK_EXACT_VERSION} — ` +
  'not installed yet, so no STON.fi quote is shown here.';
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
