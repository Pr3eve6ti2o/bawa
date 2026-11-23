import { useState } from 'react';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { AssetRows } from './asset-rows';
import { AddTokenDialog } from './add-token';
import { useLivePrices } from './use-live-prices';

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
  const [addTokenOpen, setAddTokenOpen] = useState(false);
  const { pricesState, pricesLoading, tokenPricesState, tokenPricesLoading } =
    useLivePrices();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-panel-text">Assets</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            onClick={() => setAddTokenOpen(true)}
            variant="outline"
            className="h-11 shrink-0 rounded-[22px] px-3 text-sm font-medium"
          >
            Add token
          </Button>
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
      </div>

      <Card>
        <AssetRows variant="table" hideZero={hideZero} onShowAll={() => setHideZero(false)} prices={pricesState.entries} pricesNowMs={Date.now()} pricesLoading={pricesLoading} tokenPrices={tokenPricesState.entries} tokenPricesNowMs={Date.now()} tokenPricesLoading={tokenPricesLoading} />
      </Card>
      <AddTokenDialog open={addTokenOpen} onOpenChange={setAddTokenOpen} />
    </div>
  );
}
