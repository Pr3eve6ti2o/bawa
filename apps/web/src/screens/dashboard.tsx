import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BawaIcon } from '../ui/components/icons';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import { availableFor } from '../wallet/chains';
import {
  portfolioTotal,
  usePrices,
  PRICE_ATTRIBUTION_TEXT,
} from '../wallet/prices';
import { Button } from '../ui/components/button';
import { AssetRows } from './asset-rows';
import { RecentActivity } from './recent-activity';
import { Card } from '../ui/components/card';
import { PopularChainsStrip } from './chain-strip';

const ACTIONS = [
  { to: '/send', icon: 'send', label: 'Send' },
  { to: '/receive', icon: 'receive', label: 'Receive' },
  { to: '/transactions', icon: 'activity', label: 'Activity' },
] as const;

/**
 * Panel home — real balances plus the live CoinGecko price feed. The hero
 * total includes ONLY fresh-quoted balances and reads Partial when incomplete.
 * Missing, expired, or failed prices are shown as unavailable or an error,
 * never as $0.00 and never as fabricated prices.
 */
export function DashboardScreen() {
  const {
    balances,
    refreshBalances,
    vaultState,
  } = useWallet();
  const isLocked = vaultState === 'locked';
  const [hideZero, setHideZero] = useState(false);
  const [assetsTab, setAssetsTab] = useState<'tokens' | 'activity'>('tokens');
  // Hide-balance toggle (Rabby's DashboardPanel): masks the hero total
  // and the strip amounts. Local state only — it never hides a state
  // label such as "Unavailable". Persisted in localStorage (Rabby
  // persists it); a missing or unreadable store means visible.
  const HIDE_BALANCE_KEY = 'bawa:hide-balance:v1';
  const [hideBalance, setHideBalance] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(HIDE_BALANCE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleHideBalance = () => {
    setHideBalance((current) => {
      const next = !current;
      try {
        globalThis.localStorage?.setItem(HIDE_BALANCE_KEY, next ? '1' : '0');
      } catch {
        // Persistence is best-effort; the toggle still works in memory.
      }
      return next;
    });
  };

  const { state: pricesState, refresh: refreshPrices } = usePrices();
  const pricesLoading = pricesState.status === 'loading';

  // Auto-fetch on mount: prices previously loaded only after a manual
  // click, so the first paint never showed any price. The hook's own
  // guard prevents starting another fetch while one is in flight.
  useEffect(() => {
    if (pricesState.status === 'idle') {
      refreshPrices();
    }
  }, [pricesState.status, refreshPrices]);

  // Refresh about every 60 seconds while mounted (the price module
  // documents "Refresh ~60s"). The ref always holds the latest refresh
  // callback, so the interval is set once and never resets on status
  // changes. One call/minute per tab fits the keyless ~5 calls/min
  // budget; several open tabs share it.
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

  // Hold the last settled hero text while balances refresh so it never flashes
  // Unavailable mid-refresh. Missing, expired, or failed prices are never $0.00.
  const lastHeroRef = useRef<{
    text: string;
    noPriceFeed: boolean;
    retry: boolean;
    partialNote: boolean;
    showAttribution: boolean;
    priceError: 'rate-limited' | 'network' | 'provider' | 'timeout' | null;
    balancesFailed: boolean;
  }>({
    text: 'Unavailable',
    noPriceFeed: false,
    retry: false,
    partialNote: false,
    showAttribution: false,
    priceError: null,
    balancesFailed: false,
  });

  // Only chains with a verified balance adapter count toward the hero.
  // The multichain-extension chains have no balance adapter yet, so their
  // 'unavailable' status must not fail the hero.
  const heroBalances = availableFor('balance').map((chain) => balances[chain]);
  const heroLoading = heroBalances.some((b) => b?.status === 'loading');
  // A failed chain contributes 0 to the total (portfolioTotal's partial
  // path) and is marked on its own row/strip entry — it never blanks the
  // hero. allHeroFailed is only for the message when NO balance loaded
  // at all, so the hero can say balances (not prices) are the cause.
  const allHeroFailed =
    heroBalances.length > 0 &&
    heroBalances.every(
      (b) => b?.status === 'unavailable' || b?.status === 'error',
    );

  const priceEntries = Object.values(pricesState.entries);
  const priceErrorReasons = priceEntries.flatMap(
    (entry) => (entry?.status === 'error' ? [entry.reason] : []),
  );
  const sharedPriceError =
    priceEntries.length > 0 &&
    priceErrorReasons.length === priceEntries.length &&
    priceErrorReasons.every((reason) => reason === priceErrorReasons[0])
      ? (priceErrorReasons[0] ?? null)
      : null;

  const nextHero: typeof lastHeroRef.current | null = heroLoading
    ? null
    : (() => {
        const total = portfolioTotal(balances, pricesState.entries, Date.now());

        switch (total.status) {
          case 'zero':
            return {
              text: '$0.00',
              noPriceFeed: false,
              retry: false,
              partialNote: false,
              showAttribution: false,
              priceError: null,
              balancesFailed: false,
            };
          case 'total':
            return {
              text: total.text,
              noPriceFeed: false,
              retry: false,
              partialNote: false,
              showAttribution: true,
              priceError: null,
              balancesFailed: false,
            };
          case 'partial':
            return {
              text: `${total.text} (Partial)`,
              noPriceFeed: false,
              retry: false,
              partialNote: true,
              showAttribution: true,
              priceError: null,
              balancesFailed: false,
            };
          case 'unavailable':
            return {
              text: 'Unavailable',
              noPriceFeed: true,
              retry: allHeroFailed,
              partialNote: false,
              showAttribution: false,
              priceError: sharedPriceError,
              // Balances failed, not (only) prices: the message below names
              // the balances as the cause of the missing total. The price
              // error is still surfaced when the feed itself failed too, so
              // a rate-limited feed is never hidden behind the balances
              // failure. Only when every hero balance failed is the cause
              // the balances; otherwise the total is missing for want of a
              // fresh price (a partial total needs at least one priced
              // balance).
              balancesFailed: allHeroFailed,
            };
        }
      })();

  const hero = nextHero ?? lastHeroRef.current;

  useEffect(() => {
    if (nextHero !== null) {
      lastHeroRef.current = nextHero;
    }
  }, [nextHero]);

  // The toggle masks a real total only; "Unavailable" stays visible so
  // a missing total is never disguised as a hidden one.
  const heroText = isLocked ? 'Locked' : hideBalance && hero.text !== 'Unavailable' ? '••••••' : hero.text;

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[7fr_5fr] lg:gap-6 lg:space-y-0 xl:grid-cols-[2fr_1fr]">
      <h1 className="sr-only">Portfolio</h1>

      <div className="space-y-1 rounded-bawa border-2 border-ink bg-paper p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] leading-[18px] font-medium text-ink">Portfolio balance</p>
          <button
            type="button"
            aria-pressed={hideBalance}
            aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
            title={hideBalance ? 'Show balance' : 'Hide balance'}
            onClick={() => toggleHideBalance()}
            className="flex size-9 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-paper text-ink hover:bg-sun focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {hideBalance ? (
              <BawaIcon name="eye-off" className="size-5" />
            ) : (
              <BawaIcon name="eye" className="size-5" />
            )}
          </button>
        </div>
        <p className="text-display-lg font-bold tracking-tight text-ink"><span className="bawa-marker">{heroText}</span></p>
        <p className="font-display text-xl text-ink">Your coins, drawn to scale — almost</p>
        {hero.showAttribution && (
          <p className="text-xs leading-[18px] text-panel-text-muted">{PRICE_ATTRIBUTION_TEXT}</p>
        )}
        {hero.partialNote && (
          <p className="text-xs leading-[18px] text-panel-text-muted">Partial total — some balances or prices are missing, so this total may be incomplete. Failed balances count as 0.</p>
        )}
        {hero.noPriceFeed && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            {isLocked
              ? 'Locked — unlock to see balances.'
              : hero.balancesFailed
                ? 'Balances could not be loaded, so the portfolio total is unavailable.'
              : pricesState.status === 'idle'
                ? 'No prices loaded yet — refresh prices to see the portfolio total. Balances below are the exact amounts on each network.'
                : 'No fresh prices — portfolio total unavailable. Balances below are the exact amounts on each network.'}
          </p>
        )}
        {hero.priceError !== null && (
          <p className="text-xs leading-[18px] text-ink">
            {humanReasonMessage(hero.priceError, 'price')}
          </p>
        )}
        {isLocked ? (
          <Button type="button" variant="outline" asChild>
            <Link to="/lock">Unlock</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={heroLoading}
            onClick={() => void refreshBalances()}
          >
            {heroLoading ? 'Refreshing…' : hero.retry ? 'Retry' : 'Refresh balances'}
          </Button>
        )}
        <Button type="button" variant="outline" disabled={pricesLoading} onClick={() => refreshPrices()}>{pricesLoading ? 'Refreshing prices…' : 'Refresh prices'}</Button>
      </div>
      {/* Follow-up: the dashboard was md5-identical to the saved build
          on desktop, which is what the owner reported as "still mobile
          layout". The quick actions now run as a vertical rail beside
          the hero at lg (icon left, label left, full-width rows)
          instead of a three-wide row under it — the one visible
          desktop arrangement change on this screen. Below lg they
          stay a three-wide row, so the mobile layout is untouched. */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:self-center">
        {ACTIONS.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral lg:flex-row lg:justify-start lg:gap-4 lg:px-4 lg:py-3"
          >
            <span className="flex size-14 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink">
              <BawaIcon name={icon} className="size-6" />
            </span>
            <span className="text-xs leading-4 font-medium text-ink">{label}</span>
          </Link>
        ))}
      </div>

      <PopularChainsStrip
        mode="dashboard"
        hideBalance={hideBalance}
        entries={pricesState.entries}
        pricesLoading={pricesLoading}
        nowMs={Date.now()}
      />

      {/*
        Tokens/Activity tabs. Two errors corrected hands-on: tx.amount ->
        tx.amountBaseUnits (the real transaction field) and
        chainConfig[chain] -> chainConfig(chain) (chainConfig is a function,
        not a record). No NFTs tab: no NFT support exists, and unimplemented
        features stay absent.
      */}
      <div
        role="tablist"
        aria-label="Wallet views"
        className="sticky top-0 z-10 mb-4 flex w-fit gap-1 rounded-bawa border-2 border-ink bg-paper p-1 lg:col-span-2"
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
                ? 'bg-sun text-ink'
                : 'text-ink hover:bg-sun'
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
        className="lg:col-span-2"
      >
        {assetsTab === 'tokens' ? (
          <div className="lg:grid lg:grid-cols-[7fr_5fr] lg:gap-6 xl:grid-cols-[2fr_1fr]">
          <section aria-label="Assets">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Assets</h2>
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
              <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} prices={pricesState.entries} pricesNowMs={Date.now()} pricesLoading={pricesLoading} />
            </Card>
          </section>
            <div className="hidden lg:block">
              <RecentActivity />
            </div>
          </div>
        ) : (
          <RecentActivity />
        )}
      </div>

    </div>
  );
}
