import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { usePrices } from '../wallet/prices';
import { AssetRows } from './asset-rows';

/**
 * Full asset list — the same real-balance rows as the dashboard, with the
 * same live CoinGecko per-unit prices. No portfolio total exists on this
 * screen, so none is shown or fabricated: a row shows its per-unit price
 * when fresh ("$61,706.00", labelled "per BTC") and says Price expired /
 * Price unavailable / Price error otherwise, never a silent empty and
 * never a fabricated number.
 */
export function AssetListScreen() {
  const [hideZero, setHideZero] = useState(false);

  const { state: pricesState, refresh: refreshPrices } = usePrices();
  const pricesLoading = pricesState.status === 'loading';

  // Auto-fetch on mount, as on the dashboard: without this the rows
  // would sit on idle entries and read "Price unavailable" forever.
  // The hook's own guard prevents starting another fetch while one is
  // in flight.
  useEffect(() => {
    if (pricesState.status === 'idle') {
      refreshPrices();
    }
  }, [pricesState.status, refreshPrices]);

  // Refresh about every 60 seconds while mounted (the price module
  // documents "Refresh ~60s"), same cadence as the dashboard, so a
  // failed feed recovers without a manual retry. The ref always holds
  // the latest refresh callback, so the interval is set once and never
  // resets on status changes.
  const refreshPricesRef = useRef(refreshPrices);
  useEffect(() => {
    refreshPricesRef.current = refreshPrices;
  });
  useEffect(() => {
    const interval = setInterval(() => {
      refreshPricesRef.current();
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-panel-text">Assets</h1>
        <Button
          type="button"
          aria-pressed={hideZero}
          onClick={() => setHideZero((current) => !current)}
          variant={hideZero ? 'default' : 'outline'}
          className="h-11 shrink-0 rounded-[22px] px-3 text-sm font-medium"
        >
          Hide zero balances
        </Button>
      </div>

      <Card>
        <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} prices={pricesState.entries} pricesNowMs={Date.now()} pricesLoading={pricesLoading} />
      </Card>
    </div>
  );
}
