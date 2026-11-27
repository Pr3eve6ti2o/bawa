// Provider-aware swap comparison — Lane C (providers programme, Phase 2, 2026-11-26).
//
// One swaps button, one screen: per pair, each covering provider's
// expected output + fee + time, with the cheapest/best pre-selected.
// Pairs no provider covers are shown as unavailable with the reason
// — never with an invented quote.
//
// Coverage is computed from the three provider clients, never from a
// second hand-written list: LI.FI via lifiChainIdFor (EVM chains +
// Solana, the existing tree authority), Relay via relayChainIdFor /
// relayCurrencyAddress (live /chains, verified 2026-11-26 — 58
// chains, LTC/DOGE absent, XRP present), STON.fi via
// stonfiCoversPair (stablecoins only, TON corridor). A chain is
// offered in the pickers when at least one provider covers it; the
// rest are listed as uncovered with the reason.
//
// Route selection prefers Relay / STON.fi where they cover the pair
// and are cheaper, and falls back to LI.FI otherwise. "Cheaper" is
// the highest expected output for the same pair (same destination
// token, so base units compare exactly); ties break toward Relay,
// then STON.fi, then LI.FI. Only LIVE quotes compete — honest
// not-set-up / not-covered states never win.
//
// LI.FI chain count (open verification #12, now closed): live
// `GET https://li.quest/v1/chains` returns 64 chains, all EVM type
// in that response (including 3 Sepolia testnets); Solana is not in
// that list — its LI.FI support is the separate chain id already in
// the tree (1151111081099710). And there is NO `@lifi/sdk` in this
// tree at all — no 4.x version to pin: Bawa quotes LI.FI over raw
// REST (li.quest), not the SDK. Nothing to pin, nothing invented.
import { SUPPORTED_CHAINS, chainConfig } from './chains';
import type { ChainId } from '../engine/boundary';
import { lifiChainIdFor } from './swap-quotes';
import type { SwapTokenChoice } from './swap-quotes';
import { relayChainIdFor, relayCurrencyAddress } from './relay-quotes';
import { STONFI_ASSETS, stonfiCoversPair } from './stonfi-quotes';

export type SwapProviderId = 'lifi' | 'relay' | 'stonfi';

export const PROVIDER_INFO: Record<
  SwapProviderId,
  { name: string; feeNote: string }
> = {
  lifi: { name: 'LI.FI', feeNote: '0.25% service fee + venue fees' },
  relay: {
    name: 'Relay',
    feeNote: '0.00% bridge, 0.01–0.15% swaps + $0.02',
  },
  stonfi: { name: 'STON.fi', feeNote: '0.3% pool fee (DEX default)' },
};

/** Preference order for route selection (cheapest wins first). */
const PROVIDER_PREFERENCE: readonly SwapProviderId[] = [
  'relay',
  'stonfi',
  'lifi',
];

/**
 * Chains at least one provider covers, in Bawa display order. These
 * are the chains the Swap pickers offer. (LI.FI covers every EVM
 * chain + Solana; Relay adds BTC, TRX, TON and XRP; STON.fi adds
 * nothing new to the chain set — its value is the TON corridor.)
 */
export const COMPARE_CHAINS: readonly ChainId[] = SUPPORTED_CHAINS.filter(
  (chain) =>
    lifiChainIdFor(chain) !== null ||
    relayChainIdFor(chain) !== null ||
    STONFI_ASSETS[chain] !== undefined,
);

/** Chains no provider covers — shown as unavailable, with a reason. */
export const UNCOVERED_CHAINS: readonly ChainId[] = SUPPORTED_CHAINS.filter(
  (chain) => !COMPARE_CHAINS.includes(chain),
);

/** Cosmos-family chains (no provider covers any of them). */
const COSMOS_FAMILY: ReadonlySet<ChainId> = new Set<ChainId>([
  'cosmos', 'osmosis', 'injective', 'celestia', 'dydx', 'seicosmos',
  'axelar', 'noble', 'juno',
]);

/** Honest reason a chain has no swap coverage. */
export function uncoveredReasonFor(chain: ChainId): string {
  if (COSMOS_FAMILY.has(chain)) {
    return `No swap provider covers ${chainConfig(chain).displayName} yet — the Cosmos family has no route in this wallet.`;
  }
  if (chain === 'ltc' || chain === 'doge') {
    return `No swap provider covers ${chainConfig(chain).displayName} yet — neither LI.FI nor Relay lists it.`;
  }
  return `No swap provider covers ${chainConfig(chain).displayName} yet.`;
}

type ProviderPairStatus =
  | { provider: SwapProviderId; status: 'covered' }
  | { provider: SwapProviderId; status: 'not-covered'; reason: string };

/** Per-provider coverage for one exact pair (chain + token each side). */
export function providersForPair(
  fromChain: ChainId,
  fromToken: SwapTokenChoice,
  toChain: ChainId,
  toToken: SwapTokenChoice,
): ProviderPairStatus[] {
  const lifi: ProviderPairStatus =
    lifiChainIdFor(fromChain) !== null && lifiChainIdFor(toChain) !== null
      ? { provider: 'lifi', status: 'covered' }
      : {
          provider: 'lifi',
          status: 'not-covered',
          reason: 'LI.FI does not cover one of these networks.',
        };
  const relay: ProviderPairStatus =
    relayChainIdFor(fromChain) !== null &&
    relayChainIdFor(toChain) !== null &&
    relayCurrencyAddress(fromChain, fromToken) !== null &&
    relayCurrencyAddress(toChain, toToken) !== null
      ? { provider: 'relay', status: 'covered' }
      : {
          provider: 'relay',
          status: 'not-covered',
          reason: 'Relay does not cover this pair.',
        };
  const stonfiCoverage = stonfiCoversPair(fromChain, fromToken, toChain, toToken);
  const stonfi: ProviderPairStatus = stonfiCoverage.covered
    ? { provider: 'stonfi', status: 'covered' }
    : {
        provider: 'stonfi',
        status: 'not-covered',
        reason: stonfiCoverage.reason,
      };
  return [lifi, relay, stonfi];
}

/** One live provider quote competing for a pair. */
export interface ComparableQuote {
  provider: SwapProviderId;
  /** Expected output, destination token base units (same pair = comparable). */
  toAmountBaseUnits: string;
  /** Expected output in USD, when the provider reports it. */
  toAmountUsd: string | null;
}

/**
 * Pick the best live quote for a pair: highest expected output wins;
 * ties break toward Relay, then STON.fi, then LI.FI. Returns null
 * when no provider returned a live quote. Honest states never win.
 */
export function selectBestRoute(
  quotes: readonly ComparableQuote[],
): SwapProviderId | null {
  let best: ComparableQuote | null = null;
  for (const quote of quotes) {
    if (best === null) {
      best = quote;
      continue;
    }
    const amount = safeBigInt(quote.toAmountBaseUnits);
    const bestAmount = safeBigInt(best.toAmountBaseUnits);
    if (amount > bestAmount) {
      best = quote;
      continue;
    }
    if (amount === bestAmount) {
      const rank = PROVIDER_PREFERENCE.indexOf(quote.provider);
      const bestRank = PROVIDER_PREFERENCE.indexOf(best.provider);
      if (rank !== -1 && bestRank !== -1 && rank < bestRank) {
        best = quote;
      }
    }
  }
  return best === null ? null : best.provider;
}

function safeBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}
