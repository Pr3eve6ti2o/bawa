import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { Input } from '../ui/components/input';
import { useWallet, type BalanceState } from '../state/wallet-context';
import { Card } from '../ui/components/card';
import { BawaIcon } from '../ui/components/icons';
import { AssetRows } from './asset-rows';
import { AddTokenDialog } from './add-token';
import { useLivePrices } from './use-live-prices';

/** A balance failure a refetch could fix: status 'error', or
    'unavailable' for a reason that is not a permanent never-fetch
    state (no adapter, no address, disabled chain, a devnet token
    with no contract). A row still loading is not a failure, and a
    permanent state never shows a retry — retrying those could only
    fail again. */
function isFailedBalance(balance: BalanceState | undefined): boolean {
  if (balance === undefined) return false;
  if (balance.status === 'error') return true;
  if (balance.status !== 'unavailable') return false;
  return (
    balance.reason !== undefined &&
    balance.reason !== 'no-adapter' &&
    balance.reason !== 'no-address' &&
    balance.reason !== 'disabled' &&
    balance.reason !== 'devnet-no-tokens'
  );
}

/**
 * P1 (Lane S4, P0-C follow-up): the list-level retry, shared by the
 * Assets screen and the dashboard — the dashboard renders AssetRows
 * directly, so the line has to live in both places or the main
 * surface never shows it. One line naming how many balances failed,
 * with a Retry that re-fetches them (the same refetch the Refresh
 * button runs). The per-row Retry stays gone (Lane J); this is the
 * list's one retry path. Locked and no-wallet states never see it: a
 * locked vault's balances cannot load by definition, and the
 * no-wallet branch hides the list entirely.
 */
export function FailedBalancesRetry(): ReactNode {
  const { vaultState, refreshBalances, refreshTokenBalances, balances, tokenBalances } =
    useWallet();
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
  const failedBalanceCount =
    vaultState === 'unlocked'
      ? Object.values(balances ?? {}).filter(isFailedBalance).length +
        Object.values(tokenBalances ?? {}).filter(isFailedBalance).length
      : 0;
  if (failedBalanceCount === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <p className="text-base text-ink">
        {failedBalanceCount === 1
          ? '1 balance failed'
          : `${failedBalanceCount} balances failed`}
      </p>
      <Button
        type="button"
        onClick={() => {
          void handleRefresh();
        }}
        disabled={refreshing}
        variant="secondary"
        size="sm"
      >
        {refreshing ? 'Refreshing…' : 'Retry'}
      </Button>
    </div>
  );
}

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
      <h1 className="font-bold text-panel-text">Assets</h1>

      {/*
        P0-A (no-wallet zeros): with no wallet the list is hidden
        entirely — 43 rows of $0.00 presented as the user's money are
        gone, not bannered over. The empty state (Aceternity Empty
        States structure, RESEARCH.md §11: illustration + one plain
        line + actions) says why and offers the two ways in: Create
        and Import. Live prices stay one tap away: the Bitcoin asset
        page shows the live market price with no wallet ("See live
        prices"). Locked and unlocked vaults never see this state —
        they get the filter bar and the rows below.
      */}
      {/* P3-B (style B): the no-wallet state is a flat card — no hard
          offset shadow, no wobble. The shadow was the most cartoon
          element on this screen after the radius. */}
      {vaultState === 'no-vault' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-flat-lg border border-ink bg-paper p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-flat-sm border border-ink bg-sun text-ink">
            <BawaIcon name="wallet" className="size-6" />
          </span>
          <p className="min-w-40 flex-1 text-base leading-6 font-medium text-ink">
            Zero balances — no wallet yet.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="lg" asChild>
              <Link to="/create-wallet">Create a wallet</Link>
            </Button>
            <Button type="button" variant="secondary" size="md" asChild>
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/assets/btc">See live prices</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
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
      {/* P3-B (style B): the filter bar is flat — no hard shadow, no
          wobble. The Filters panel itself is untouched (owner: it is
          a feature); only its frame is polished. */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-flat-lg border border-ink bg-paper p-2"
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
        {/* Lane 4 (UX-major, data): while searching, name what the
            search matches — name, symbol, chain or the whole contract
            address — so an empty result reads as "not here", not as a
            broken search. The verified mark stays on the token rows
            themselves; this line only states the scope. */}
        {query.trim() !== '' ? (
          <p className="w-full px-2 text-xs leading-4 text-ink">
            Searching name, symbol, chain or contract address.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
            variant="secondary"
            size="sm"
          >
            {refreshing ? 'Refreshing…' : 'Refresh balances'}
          </Button>
          <Button
            type="button"
            onClick={() => setAddTokenOpen(true)}
            variant="secondary"
            size="sm"
          >
            Add token
          </Button>
          <Button
            type="button"
            aria-pressed={hideZero}
            onClick={() => setHideZero((current) => !current)}
            variant={hideZero ? 'primary' : 'secondary'}
            size="sm"
          >
            Hide zero balances
          </Button>
        </div>
      </div>

      <FailedBalancesRetry />

      <Card>
        <AssetRows variant="table" hideZero={hideZero} onShowAll={() => setHideZero(false)} prices={pricesState.entries} pricesNowMs={Date.now()} pricesLoading={pricesLoading} tokenPrices={tokenPricesState.entries} tokenPricesNowMs={Date.now()} tokenPricesLoading={tokenPricesLoading} query={query} onClearQuery={() => setQuery('')} />
      </Card>
        </>
      )}
      <AddTokenDialog open={addTokenOpen} onOpenChange={setAddTokenOpen} />
    </div>
  );
}
