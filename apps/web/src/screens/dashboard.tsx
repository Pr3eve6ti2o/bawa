import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowDownToLine, Send } from 'lucide-react';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';
import { AssetRows } from './asset-rows';
import { Card } from '../ui/components/card';

const ACTIONS = [
  { to: '/send', icon: Send, label: 'Send' },
  { to: '/receive', icon: ArrowDownToLine, label: 'Receive' },
  { to: '/transactions', icon: Activity, label: 'Activity' },
] as const;

/**
 * Panel home — real balances only. There is no price feed in this lane, so
 * no fiat portfolio total is shown (and none is fabricated): the hero states
 * that plainly. Asset rows come from the verified balance adapters.
 */
export function DashboardScreen() {
  const {
    balances,
    history,
    refreshBalances,
    refreshHistory,
    vaultState,
  } = useWallet();
  const [hideZero, setHideZero] = useState(false);
  const [assetsTab, setAssetsTab] = useState<'tokens' | 'activity'>('tokens');

  // Balance hero (Phase 5, Sol p8, landed 2026-11-19 in 367.2s). The hero
  // holds its last settled text in a ref while a refresh is loading, so it
  // never flashes Unavailable mid-refresh. No price feed exists, so the
  // only fiat figure ever shown is the honest $0.00 of zero holdings; an
  // error is never rendered as zero. Sol's JSX used new slate classes;
  // assembly keeps the existing dark-navy hero markup instead.
  const lastHeroRef = useRef({
    text: 'Unavailable',
    noPriceFeed: false,
    retry: false,
  });

  const heroBalances = Object.values(balances);
  const heroLoading = heroBalances.some((b) => b?.status === 'loading');
  const heroFailed = heroBalances.some(
    (b) => b?.status === 'unavailable' || b?.status === 'error',
  );
  const heroAllZero =
    heroBalances.length === 4 &&
    heroBalances.every(
      (b) =>
        b?.status === 'zero' ||
        (b?.status === 'available' && b.value === '0'),
    );

  // Known failures override a cached $0.00, even during a partial refresh.
  // The no-price-feed line still shows: the feed is missing as well as the
  // balances, and the hero must keep explaining why no fiat total exists.
  const nextHero = heroFailed
    ? { text: 'Unavailable', noPriceFeed: true, retry: true }
    : heroLoading
      ? null
      : {
          text: heroAllZero ? '$0.00' : 'Unavailable',
          noPriceFeed: !heroAllZero,
          retry: false,
        };

  const hero = nextHero ?? lastHeroRef.current;

  useEffect(() => {
    if (nextHero !== null) {
      lastHeroRef.current = nextHero;
    }
  }, [nextHero]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Portfolio</h1>

      <div className="space-y-1 rounded-2xl bg-panel-surface-raised p-5">
        <p className="text-[13px] leading-[18px] font-medium text-panel-text-muted">Portfolio balance</p>
        <p className="text-display-lg font-bold tracking-tight text-panel-text">{hero.text}</p>
        {hero.noPriceFeed && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            No price feed connected — portfolio total unavailable. Balances below
            are exact native amounts from the mainnet adapters.
          </p>
        )}
        {vaultState === 'locked' && (
          <Button asChild>
            <Link to="/lock">Unlock your wallet</Link>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={heroLoading}
          onClick={() => void refreshBalances()}
        >
          {heroLoading ? 'Refreshing…' : hero.retry ? 'Retry' : 'Refresh balances'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-panel-icon-tile text-panel-accent transition-colors hover:bg-panel-action-hover">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-xs leading-4 font-medium text-panel-text">{label}</span>
          </Link>
        ))}
      </div>

      {/*
        Tokens/Activity tabs (Phase 5, Sol p11b, landed 2026-11-19 in 445.6s).
        Two Sol errors corrected hands-on: tx.amount -> tx.amountBaseUnits
        (the real AdapterTx field) and chainConfig[chain] -> chainConfig(chain)
        (chainConfig is a function, not a record). No NFTs tab: no NFT support
        exists, and unimplemented features stay absent.
      */}
      <div
        role="tablist"
        aria-label="Wallet views"
        className="mb-4 flex w-fit gap-1 rounded-xl border border-panel-border bg-panel-surface p-1"
      >
        {(['tokens', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            id={`dashboard-assets-${tab}-tab`}
            type="button"
            role="tab"
            aria-selected={assetsTab === tab}
            aria-controls="dashboard-assets-panel"
            tabIndex={assetsTab === tab ? 0 : -1}
            onClick={() => setAssetsTab(tab)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

              event.preventDefault();
              const nextTab =
                event.key === 'Home'
                  ? 'tokens'
                  : event.key === 'End'
                    ? 'activity'
                    : tab === 'tokens'
                      ? 'activity'
                      : 'tokens';

              setAssetsTab(nextTab);
              document.getElementById(`dashboard-assets-${nextTab}-tab`)?.focus();
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent ${
              assetsTab === tab
                ? 'bg-panel-active text-panel-text'
                : 'text-panel-text-soft hover:bg-panel-hover hover:text-panel-text'
            }`}
          >
            {tab === 'tokens' ? 'Tokens' : 'Activity'}
          </button>
        ))}
      </div>

      <div
        id="dashboard-assets-panel"
        role="tabpanel"
        aria-labelledby={`dashboard-assets-${assetsTab}-tab`}
      >
        {assetsTab === 'tokens' ? (
          <section aria-label="Assets">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-panel-text">Assets</h2>
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
            <Card className="mt-4">
              <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} />
            </Card>
          </section>
        ) : (
          <section aria-label="Activity" className="space-y-3">
            <h2 className="text-lg font-semibold text-panel-text">Recent activity</h2>

            {(() => {
              const chains = availableFor('history');

              const timestampMs = (timestamp: number | string | null | undefined) => {
                if (timestamp == null) return null;

                const value =
                  typeof timestamp === 'number' && timestamp < 1_000_000_000_000
                    ? timestamp * 1000
                    : timestamp;
                const time = new Date(value).getTime();

                return Number.isFinite(time) ? time : null;
              };

              const rows = chains
                .flatMap((chain) =>
                  (history[chain]?.txs ?? []).map((tx) => ({ chain, tx })),
                )
                .sort(
                  (a, b) =>
                    (timestampMs(b.tx.timestamp) ?? 0) -
                    (timestampMs(a.tx.timestamp) ?? 0),
                );

              const loading = chains.some(
                (chain) => history[chain]?.status === 'loading',
              );

              const unavailableChains = chains.filter(
                (chain) =>
                  history[chain]?.status === 'unavailable' ||
                  history[chain]?.status === 'error',
              );

              return (
                <>
                  {rows.length > 0 ? (
                    <ul className="divide-y divide-panel-border overflow-hidden rounded-xl border border-panel-border bg-panel-surface">
                      {rows.map(({ chain, tx }) => {
                        const config = chainConfig(chain);
                        const time = timestampMs(tx.timestamp);
                        const direction =
                          tx.direction === 'in'
                            ? 'Received'
                            : tx.direction === 'out'
                              ? 'Sent'
                              : 'Self transfer';

                        return (
                          <li key={`${chain}:${tx.hash}`}>
                            <Link
                              to={`/transactions/${tx.hash}`}
                              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-panel-accent"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-panel-text">
                                  {direction}
                                  <span className="font-normal text-panel-text-soft">
                                    {' · '}{config.symbol}
                                  </span>
                                </span>
                                <span className="mt-1 block text-xs text-panel-text-muted">
                                  {time == null
                                    ? 'Pending'
                                    : new Date(time).toLocaleDateString('en-GB', {
                                        dateStyle: 'short',
                                      })}
                                  {tx.status === 'failed'
                                    ? ' · Failed'
                                    : tx.status === 'pending'
                                      ? ' · Pending'
                                      : ''}
                                </span>
                              </span>
                              <span className="shrink-0 text-right text-sm font-semibold text-panel-text">
                                {formatNativeWithSymbol(
                                  tx.amountBaseUnits,
                                  CHAIN_DECIMALS[chain],
                                  config.symbol,
                                )}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : loading ? (
                    <Skeleton className="h-20 w-full rounded-xl" />
                  ) : (
                    <p className="rounded-xl border border-panel-border bg-panel-surface p-4 text-sm text-panel-text-soft">No activity yet</p>
                  )}

                  {unavailableChains.map((chain) => (
                    <div
                      key={`history-unavailable:${chain}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-surface px-4 py-3"
                    >
                      <p className="text-sm text-panel-text-soft">
                        {chainConfig(chain).displayName} history unavailable
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void refreshHistory()}
                        className="h-11 shrink-0"
                      >
                        Retry
                      </Button>
                    </div>
                  ))}
                </>
              );
            })()}
          </section>
        )}
      </div>

    </div>
  );
}
