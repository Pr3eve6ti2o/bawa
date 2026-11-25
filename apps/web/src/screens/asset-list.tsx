import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { Input } from '../ui/components/input';
import { useWallet } from '../state/wallet-context';
import { Card } from '../ui/components/card';
import { BawaIcon } from '../ui/components/icons';
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
  // Lane 2: the filter bar's search — 43 rows are not scannable by
  // scrolling alone. Client-side only, matches name, symbol or chain.
  const [query, setQuery] = useState('');
  const { vaultState, refreshBalances, refreshTokenBalances } = useWallet();
  // Lane J: the rows carry no per-row Retry (see asset-rows.tsx), so
  // this is the screen's one retry path — the same "Refresh balances"
  // the dashboard hero offers. It re-fetches natives and tokens.
  // Aceternity Stateful Button pattern (structure only, re-skinned to
  // Bawa's Button): while the refetch is in flight the button shows its
  // loading state and cannot be double-clicked; it settles back to
  // "Refresh balances" when the rows land — no fake success state.
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh(): Promise<void> {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshBalances();
      await refreshTokenBalances?.();
    } finally {
      setRefreshing(false);
    }
  }
  const { pricesState, pricesLoading, tokenPricesState, tokenPricesLoading } =
    useLivePrices();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-panel-text">Assets</h1>

      {/*
        Lane 2: the filter bar — the visible Filters panel is a
        feature, kept and restyled, never removed. Search first (the
        list is 43 rows; finding "USDC on Base" by scrolling is the
        slow path), then the three controls the screen already had:
        Refresh balances, Add token, Hide zero balances. All three
        keep their behaviour and labels; the bar wraps on mobile
        (search full-width, controls below) and fits one row on
        desktop.
      */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-bawa border-2 border-ink bg-paper p-2 shadow-bawa"
        role="search"
        aria-label="Filter assets"
      >
        <div className="min-w-44 flex-1">
          <Input
            type="search"
            aria-label="Search assets"
            placeholder="Search name, symbol or chain"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
            variant="outline"
            size="pill"
          >
            {refreshing ? 'Refreshing…' : 'Refresh balances'}
          </Button>
          <Button
            type="button"
            onClick={() => setAddTokenOpen(true)}
            variant="outline"
            size="pill"
          >
            Add token
          </Button>
          <Button
            type="button"
            aria-pressed={hideZero}
            onClick={() => setHideZero((current) => !current)}
            variant={hideZero ? 'default' : 'outline'}
            size="pill"
          >
            Hide zero balances
          </Button>
        </div>
      </div>

      {/* No-wallet empty state (Aceternity Empty States structure,
          RESEARCH.md §11: illustration + one plain line + one action).
          The rows below already show honest zero balances; this banner
          says why, so 43 zero rows are not mistaken for a loaded
          wallet. Locked and unlocked vaults never see it. */}
      {vaultState === 'no-vault' && (
        <div className="flex flex-wrap items-center gap-3 rounded-bawa border-2 border-ink bg-paper p-4 shadow-bawa">
          <span className="flex size-12 shrink-0 -rotate-3 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink">
            <BawaIcon name="wallet" className="size-6" />
          </span>
          <p className="min-w-40 flex-1 text-sm leading-5 font-medium text-ink">
            No wallet yet — these are zero balances, not your money. Create
            a wallet to see your real balances.
          </p>
          <Button type="button" asChild>
            <Link to="/create-wallet">Create a wallet</Link>
          </Button>
        </div>
      )}

      <Card>
        <AssetRows variant="table" hideZero={hideZero} onShowAll={() => setHideZero(false)} prices={pricesState.entries} pricesNowMs={Date.now()} pricesLoading={pricesLoading} tokenPrices={tokenPricesState.entries} tokenPricesNowMs={Date.now()} tokenPricesLoading={tokenPricesLoading} query={query} onClearQuery={() => setQuery('')} />
      </Card>
      <AddTokenDialog open={addTokenOpen} onOpenChange={setAddTokenOpen} />
    </div>
  );
}
