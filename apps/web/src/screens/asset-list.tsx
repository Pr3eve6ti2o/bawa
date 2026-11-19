import { useState } from 'react';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { AssetRows } from './asset-rows';

/**
 * Full asset list — the same real-balance rows as the dashboard. No fiat
 * total exists (no price feed), so none is shown or fabricated.
 */
export function AssetListScreen() {
  const [hideZero, setHideZero] = useState(false);

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
        <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} />
      </Card>
    </div>
  );
}
