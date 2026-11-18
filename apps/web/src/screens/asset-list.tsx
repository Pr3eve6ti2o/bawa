import { useState } from 'react';
import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';
import { AssetRows } from './asset-rows';

/**
 * Full asset list — the same real-balance rows as the dashboard. No fiat
 * total exists (no price feed), so none is shown or fabricated.
 */
export function AssetListScreen() {
  const { refreshBalances } = useWallet();
  const [hideZero, setHideZero] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Assets</h1>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#243454] px-5 py-4 text-white">
        <div>
          <p className="text-xs text-[#aab5d1]">Portfolio balance</p>
          <p className="text-2xl font-bold">Unavailable</p>
          <p className="text-xs text-[#aab5d1]">
            No price feed connected — exact native balances below.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshBalances()}
          >
            Refresh
          </Button>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(event) => setHideZero(event.target.checked)}
            />
            Hide zero balances
          </label>
        </div>
      </div>

      <AssetRows hideZero={hideZero} />
    </div>
  );
}
