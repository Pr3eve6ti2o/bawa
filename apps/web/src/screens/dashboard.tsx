import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowDownToLine, Send } from 'lucide-react';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';
import { AssetRows } from './asset-rows';

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
    locked,
    unlock,
    vaultState,
    refreshBalances,
    refreshHistory,
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

      <div className="space-y-1 pt-1">
        <p className="text-[13px] font-medium text-[#aab5d1]">Portfolio balance</p>
        <p className="text-2xl font-bold tracking-tight text-white">{hero.text}</p>
        {hero.noPriceFeed && (
          <p className="text-[13px] text-[#aab5d1]">
            No price feed connected — portfolio total unavailable. Balances below
            are exact native amounts from the mainnet adapters.
          </p>
        )}
        <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
          {hero.retry ? 'Retry' : 'Refresh balances'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#263451] text-[#b4aaff] transition-colors hover:bg-[#2a3651]">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold text-[#edf0fc]">{label}</span>
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
        className="mb-4 flex w-fit gap-1 rounded-xl border border-[#263454] bg-[#0b1326] p-1"
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
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8daeff] ${
              assetsTab === tab
                ? 'bg-[#1a2948] text-white'
                : 'text-[#c8d0e8] hover:bg-[#14213b] hover:text-white'
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
              <h2 className="text-lg font-bold text-white">Assets</h2>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={(event) => setHideZero(event.target.checked)}
                />
                Hide zero balances
              </label>
            </div>
            <AssetRows hideZero={hideZero} />
          </section>
        ) : (
          <section aria-label="Activity" className="space-y-3">
            <h2 className="text-lg font-bold text-white">Recent activity</h2>

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
                    <ul className="divide-y divide-[#263454] overflow-hidden rounded-xl border border-[#263454] bg-[#0b1326]">
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
                              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#14213b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#8daeff]"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-white">
                                  {direction}
                                  <span className="font-normal text-[#c8d0e8]">
                                    {' · '}{config.symbol}
                                  </span>
                                </span>
                                <span className="mt-1 block text-xs text-[#a5b2d3]">
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
                              <span className="shrink-0 text-right text-sm font-semibold text-white">
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
                    <Skeleton className="h-20 w-full rounded-xl bg-[#14213b]" />
                  ) : (
                    <p className="rounded-xl border border-[#263454] bg-[#0b1326] p-4 text-sm text-[#c8d0e8]">
                      No transactions yet
                    </p>
                  )}

                  {unavailableChains.map((chain) => (
                    <div
                      key={`history-unavailable:${chain}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#263454] bg-[#0b1326] px-4 py-3"
                    >
                      <p className="text-sm text-[#c8d0e8]">
                        {chainConfig(chain).displayName} history unavailable
                      </p>
                      <Button
                        type="button"
                        onClick={() => void refreshHistory()}
                        className="shrink-0 rounded-lg border border-[#334767] bg-[#1a2948] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#223658]"
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

      {locked ? (
        <div className="space-y-4 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Locked — derived addresses are hidden until you unlock.
          </p>
          <Button type="button" onClick={() => void unlock()}>
            Unlock
          </Button>
        </div>
      ) : vaultState === 'locked' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Vault locked — your vault addresses are hidden until you unlock.
          </p>
          <Link
            to="/lock"
            className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
          >
            Unlock
          </Link>
        </div>
      ) : vaultState === 'no-vault' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            No wallet yet — create a wallet or import one to see its balances.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/create-wallet"
              className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
            >
              Create wallet
            </Link>
            <Link
              to="/import-wallet"
              className="inline-block rounded-full border border-white/10 bg-[#263451] px-4 py-2 text-sm font-semibold text-[#eff2fc]"
            >
              Import wallet
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
