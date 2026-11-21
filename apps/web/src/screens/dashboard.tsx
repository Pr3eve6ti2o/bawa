import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowDownToLine, Eye, EyeOff, Network, Send } from 'lucide-react';
import { useWallet } from '../state/wallet-context';
import type { BalanceState } from '../state/wallet-context';
import type { ChainId } from '../engine/boundary';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import {
  fiatValueForBalance,
  portfolioTotal,
  quoteFreshnessLabel,
  unitPriceForChain,
  usePrices,
  PRICE_ATTRIBUTION_TEXT,
} from '../wallet/prices';
import type { PriceEntry } from '../wallet/prices';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';
import { AssetRows, ChainLogo } from './asset-rows';
import { RecentActivity } from './recent-activity';
import { Card } from '../ui/components/card';

const ACTIONS = [
  { to: '/send', icon: Send, label: 'Send' },
  { to: '/receive', icon: ArrowDownToLine, label: 'Receive' },
  { to: '/transactions', icon: Activity, label: 'Activity' },
] as const;

// Popular chains strip order (layout findings §5.2): Bawa's canonical
// order — Bitcoin, Ethereum, TRON, TON — never value-sorted, so the strip
// never reorders itself on refresh, and never alphabetical, so BTC is
// never buried.
const STRIP_CHAINS: ChainId[] = ['btc', 'eth', 'trx', 'ton'];

/**
 * One Popular chains strip entry (layout findings §5.2, Rabby's
 * value-sorted per-chain breakdown adapted to a fixed-order shortcut
 * strip): logo, chain name, native balance, and the fiat value
 * underneath only when a fresh price exists. A per-unit price always
 * carries its "per BTC" label, so it can never be mistaken for a fiat
 * value of the balance. A failed balance reads "Unavailable" and a
 * failed price reads "Price expired" / "Price unavailable" /
 * "Price error" — never $0.00, never a silent empty. Tapping an entry
 * opens the asset detail; the strip never switches a global network
 * (Bawa has none).
 */
function PopularChainEntry({
  chain,
  balance,
  entry,
  nowMs,
  pricesLoading,
  hideBalance,
}: {
  chain: ChainId;
  balance: BalanceState;
  entry: PriceEntry | undefined;
  nowMs: number;
  pricesLoading: boolean;
  hideBalance: boolean;
}) {
  const config = chainConfig(chain);
  const unit = unitPriceForChain(entry, nowMs);
  // While the first fetch is still in flight, idle entries read as
  // 'unavailable' — show nothing rather than a premature failure (the
  // same rule the asset rows use).
  const displayUnit =
    pricesLoading === true && unit.kind === 'unavailable'
      ? { kind: 'missing' as const }
      : unit;
  const priceIsFresh = entry?.status === 'fresh';

  if (balance.status === 'loading') {
    return (
      <div className="w-40 shrink-0 rounded-2xl border border-panel-border bg-panel-surface p-3 sm:w-auto">
        <Skeleton className="h-[68px] w-full" />
        <span className="sr-only">{`Loading ${config.displayName} balance…`}</span>
      </div>
    );
  }

  // Line 1: the native balance, or the per-chain failure mark. A failed
  // row is marked here, on its own entry — the hero total never blanks
  // for one chain's failure (that aggregation is Phase 3; the strip
  // already has a place for the mark).
  let line1: string;
  let line1IsAmount = false;
  if (balance.status === 'unavailable' || balance.status === 'error') {
    line1 = 'Unavailable';
  } else if (balance.status === 'zero') {
    line1 = `0 ${config.symbol}`;
    line1IsAmount = true;
  } else {
    line1 = formatNativeWithSymbol(
      balance.value ?? '0',
      CHAIN_DECIMALS[chain],
      config.symbol,
    );
    line1IsAmount = true;
  }

  // Line 2: the fiat value when a fresh price exists, else the per-unit
  // price (labelled "per BTC") or the price feed's state.
  let line2: string | undefined;
  let line2IsAmount = false;
  const priceStateText = (kind: string) =>
    kind === 'expired'
      ? 'Price expired'
      : kind === 'unavailable'
        ? 'Price unavailable'
        : kind === 'error'
          ? 'Price error'
          : undefined;
  if (entry !== undefined && (balance.status === 'available' || balance.status === 'zero')) {
    const fiat = fiatValueForBalance(chain, balance, entry, nowMs);
    if (fiat.kind === 'fiat' && entry.status === 'fresh') {
      line2 = fiat.text;
      line2IsAmount = true;
    } else if (fiat.kind === 'zero' || fiat.kind === 'balance-unavailable') {
      if (displayUnit.kind === 'fresh' && entry.status === 'fresh') {
        line2 = `${displayUnit.text} per ${config.symbol}`;
        line2IsAmount = true;
      } else {
        line2 = priceStateText(displayUnit.kind);
      }
    } else {
      line2 = priceStateText(fiat.kind);
    }
  } else if (balance.status === 'unavailable' || balance.status === 'error') {
    if (displayUnit.kind === 'fresh') {
      line2 = `${displayUnit.text} per ${config.symbol}`;
      line2IsAmount = true;
    } else {
      line2 = priceStateText(displayUnit.kind);
    }
  }

  // The hide-balance toggle (Rabby) masks amounts only — state labels
  // such as "Unavailable" or "Price expired" stay visible.
  const masked = (text: string, isAmount: boolean) =>
    hideBalance && isAmount ? '••••••' : text;

  return (
    <Link
      to={`/assets/${chain}`}
      aria-label={`${config.displayName} asset details`}
      className="w-40 shrink-0 rounded-2xl border border-panel-border bg-panel-surface p-3 transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent sm:w-auto"
    >
      <span className="flex items-center gap-2">
        <ChainLogo chain={chain} size={32} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-panel-text">
          {config.displayName}
        </span>
        {priceIsFresh && (
          <span
            className="size-2 shrink-0 rounded-full bg-success"
            title={entry !== undefined ? quoteFreshnessLabel(entry.quote, nowMs) : undefined}
            aria-hidden="true"
          />
        )}
      </span>
      <span className="mt-2 block truncate text-sm font-semibold text-panel-text">
        {masked(line1, line1IsAmount)}
      </span>
      <span className="block min-h-[16px] truncate text-xs text-panel-text-muted">
        {line2 === undefined ? null : masked(line2, line2IsAmount)}
      </span>
    </Link>
  );
}

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
  } = useWallet();
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

  const stripChains = STRIP_CHAINS.filter((chain) =>
    availableFor('balance').includes(chain),
  );
  // The toggle masks a real total only; "Unavailable" stays visible so
  // a missing total is never disguised as a hidden one.
  const heroText = hideBalance && hero.text !== 'Unavailable' ? '••••••' : hero.text;

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[7fr_5fr] lg:gap-6 lg:space-y-0 xl:grid-cols-[2fr_1fr]">
      <h1 className="sr-only">Portfolio</h1>

      <div className="space-y-1 rounded-2xl bg-panel-surface-raised p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] leading-[18px] font-medium text-panel-text-muted">Portfolio balance</p>
          <button
            type="button"
            aria-pressed={hideBalance}
            aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
            title={hideBalance ? 'Show balance' : 'Hide balance'}
            onClick={() => toggleHideBalance()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted transition-colors hover:bg-panel-action-hover hover:text-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
          >
            {hideBalance ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="text-display-lg font-bold tracking-tight text-panel-text">{heroText}</p>
        {hero.showAttribution && (
          <p className="text-xs leading-[18px] text-panel-text-muted">{PRICE_ATTRIBUTION_TEXT}</p>
        )}
        {hero.partialNote && (
          <p className="text-xs leading-[18px] text-panel-text-muted">Partial total — some balances or prices are missing, so this total may be incomplete. Failed balances count as 0.</p>
        )}
        {hero.noPriceFeed && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            {hero.balancesFailed
              ? 'Balances could not be loaded, so the portfolio total is unavailable.'
              : pricesState.status === 'idle'
                ? 'No prices loaded yet — refresh prices to see the portfolio total. Balances below are the exact amounts on each network.'
                : 'No fresh prices — portfolio total unavailable. Balances below are the exact amounts on each network.'}
          </p>
        )}
        {hero.priceError !== null && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            {hero.priceError === 'rate-limited'
              ? 'Price feed rate-limited — try again shortly.'
              : hero.priceError === 'network'
                ? 'Could not reach the price feed — check your connection and retry.'
                : hero.priceError === 'timeout'
                  ? 'Price feed timed out — retry.'
                  : 'Price feed error — retry.'}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={heroLoading}
          onClick={() => void refreshBalances()}
        >
          {heroLoading ? 'Refreshing…' : hero.retry ? 'Retry' : 'Refresh balances'}
        </Button>
        <Button type="button" variant="outline" disabled={pricesLoading} onClick={() => refreshPrices()}>{pricesLoading ? 'Refreshing prices…' : 'Refresh prices'}</Button>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:self-center">
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
        Popular chains strip (layout findings §5.2): under the action
        tiles, above the tabs — the first thing below the fold on a
        phone, filling the empty area below the home content. Desktop is
        a 4 + 1 card row; phones get a horizontally scrollable row with
        the same entries (fixed-width cards, min-w-0 + shrink-0, so
        nothing clips — cf. the flex-row clip lesson in AGENTS.md).
        Lane A builds the strip component on Welcome; the dashboard
        renders its own strip from the same live data.
      */}
      <section aria-label="Popular chains" className="lg:col-span-2">
        <h2 className="text-lg font-semibold text-panel-text">Popular chains</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
          {stripChains.map((chain) => (
            <PopularChainEntry
              key={chain}
              chain={chain}
              balance={balances[chain]}
              entry={pricesState.entries[chain]}
              nowMs={Date.now()}
              pricesLoading={pricesLoading}
              hideBalance={hideBalance}
            />
          ))}
          <Link
            to="/networks"
            aria-label="All networks"
            className="flex w-40 shrink-0 flex-col justify-center gap-1 rounded-2xl border border-panel-border bg-panel-surface p-3 transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent sm:w-auto"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-panel-icon-tile text-panel-accent">
              <Network className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[15px] font-bold text-panel-text">All networks</span>
            <span className="text-xs text-panel-text-muted">View all chains</span>
          </Link>
        </div>
      </section>

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
        className="sticky top-0 z-10 mb-4 flex w-fit gap-1 rounded-xl border border-panel-border bg-panel-surface p-1 lg:col-span-2"
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
        className="lg:col-span-2"
      >
        {assetsTab === 'tokens' ? (
          <div className="lg:grid lg:grid-cols-[7fr_5fr] lg:gap-6 xl:grid-cols-[2fr_1fr]">
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
