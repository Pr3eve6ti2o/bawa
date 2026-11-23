/**
 * Live price feeds shared by the dashboard, asset list and asset detail
 * screens (marketing-fix Lane 2): the native CoinGecko feed plus the
 * token CoinGecko feed. The three screens had copied the same wiring —
 * auto-fetch on mount plus a ~60 s refresh while mounted, via a ref so
 * the interval is set once and never resets on status changes (jscpd:
 * 60 lines dashboard/asset-list, 17 asset-detail/asset-list, 14
 * asset-detail/dashboard). One hook, one place.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useWallet } from '../state/wallet-context';
import { usePrices } from '../wallet/prices';
import { useTokenPrices } from '../wallet/token-prices';
import { DEFAULT_TOKENS, type TokenRecord } from '../wallet/tokens';

/**
 * Auto-fetch a price feed when idle, then refresh about every 60 s
 * while mounted. The ref always holds the latest refresh callback, so
 * the interval is set once and never resets on status changes. A failed
 * feed recovers without a manual retry; the hook's own guard prevents
 * starting another fetch while one is in flight.
 */
export function usePriceFeedAutoRefresh(
  status: 'idle' | 'loading' | 'ready',
  refresh: () => void,
): void {
  // Auto-fetch on mount: without this the rows would sit on idle
  // entries and read "Price unavailable" forever.
  useEffect(() => {
    if (status === 'idle') {
      refresh();
    }
  }, [status, refresh]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRef.current();
    }, 60_000);

    return () => clearInterval(interval);
  }, []);
}

/**
 * Both live feeds for a screen that shows the whole portfolio
 * (dashboard, asset list): native prices plus token prices for the
 * default tokens and user-added tokens. Same auto-fetch on mount and
 * ~60 s refresh as before — two calls a minute, inside the keyless
 * ~5 calls/min budget.
 */
export function useLivePrices() {
  const { customTokens } = useWallet();

  const { state: pricesState, refresh: refreshPrices } = usePrices();
  const pricesLoading = pricesState.status === 'loading';
  usePriceFeedAutoRefresh(pricesState.status, refreshPrices);

  // Token prices (token discovery): the same CoinGecko feed, one batched
  // call for the default 7 tokens (six unique ids) plus user-added
  // tokens.
  const tokenList: readonly TokenRecord[] = useMemo(
    () => [...DEFAULT_TOKENS, ...(customTokens ?? [])],
    [customTokens],
  );
  const { state: tokenPricesState, refresh: refreshTokenPrices } =
    useTokenPrices(tokenList);
  const tokenPricesLoading = tokenPricesState.status === 'loading';
  usePriceFeedAutoRefresh(tokenPricesState.status, refreshTokenPrices);

  return {
    pricesState,
    pricesLoading,
    refreshPrices,
    tokenPricesState,
    tokenPricesLoading,
    refreshTokenPrices,
    tokenList,
  };
}
