/**
 * Live balances (watch-only display programme, 2026-11-28): balances
 * refresh on a ~45 s poll while a portfolio screen is mounted — the
 * 30–60 s cadence the polling guide recommends for token balances and
 * portfolio values — plus a refresh when the tab becomes visible
 * again. Prices already poll on ~60 s (use-live-prices); this is the
 * balances half. No websocket, no push service: Bawa has no backend
 * and no keys in the browser. Polling pauses while the tab is hidden.
 *
 * The poll re-runs the refreshers, which is also the bounded
 * auto-retry for failed fetches: a chain that 429'd on load recovers
 * on the next tick, and its last-good value stays visible meanwhile
 * (stale) — a failed fetch never silently counts as $0.
 */
import { useEffect, useRef } from 'react';
import { useWallet } from '../state/wallet-context';

export const BALANCE_POLL_INTERVAL_MS = 45_000;

export function useLiveBalances(enabled = true): void {
  const { refreshBalances, refreshTokenBalances, refreshHistory } =
    useWallet();
  const refreshRef = useRef({
    refreshBalances,
    refreshTokenBalances,
    refreshHistory,
  });
  useEffect(() => {
    refreshRef.current = {
      refreshBalances,
      refreshTokenBalances,
      refreshHistory,
    };
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const {
        refreshBalances: runBalances,
        refreshTokenBalances: runTokens,
        refreshHistory: runHistory,
      } = refreshRef.current;
      void runBalances?.();
      void runTokens?.();
      void runHistory?.();
    };
    const interval = setInterval(tick, BALANCE_POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled]);
}
