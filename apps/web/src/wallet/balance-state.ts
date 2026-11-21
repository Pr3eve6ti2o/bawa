// Per-chain balance state (wallet layer leaf).
//
// BalanceState lives here — not in state/wallet-context.tsx — because the
// layer rule forbids wallet/ from importing state/ (see
// scripts/check-wallet-cycles.mjs), and wallet/prices.ts needs the type
// for fiatValueForBalance / portfolioTotal. state/wallet-context.tsx
// imports and re-exports it, so screens keep importing it from the
// context. The shape is the context's: a provider result plus the
// last-good / freshness flags the UI renders from.

export type BalanceStatus = 'loading' | 'zero' | 'available' | 'unavailable' | 'error';

export interface BalanceState {
  status: BalanceStatus;
  /** Raw native balance as a decimal string, when a provider returned one. */
  value?: string;
  /** Short machine-readable reason for unavailable/error (e.g. no-adapter). */
  reason?: string;
  /** True while a refetch is in flight and value is the last good one. */
  refreshing?: boolean;
  /** True when value is the last good one kept after a failed refetch, or from cache. */
  stale?: boolean;
  /** Epoch ms when the last good value was fetched (cache freshness). */
  fetchedAtMs?: number;
}
