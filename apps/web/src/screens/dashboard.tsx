import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BawaIcon } from '../ui/components/icons';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import { availableFor } from '../wallet/chains';
import {
  idlePriceEntries,
  portfolioTotal,
  usePrices,
  PRICE_ATTRIBUTION_TEXT,
  type PortfolioTokenContribution,
} from '../wallet/prices';
import { fiatValueForTokenBalance, useTokenPrices } from '../wallet/token-prices';
import { DEFAULT_TOKENS, tokenKey } from '../wallet/tokens';
import { Button } from '../ui/components/button';
import { AssetRows } from './asset-rows';
import { AddTokenDialog } from './add-token';
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
 * total is the whole portfolio — natives plus priced token balances —
 * and reads Partial when incomplete. Missing, expired, or failed prices
 * are shown as unavailable or an error, never as $0.00 and never as
 * fabricated prices.
 */
export function DashboardScreen() {
  const {
    balances,
    refreshBalances,
    vaultState,
    customTokens,
    tokenBalances,
    devnetEnabled,
  } = useWallet();
  const isLocked = vaultState === 'locked';
  const [hideZero, setHideZero] = useState(false);
  const [addTokenOpen, setAddTokenOpen] = useState(false);
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

  // Token prices (token discovery): the same CoinGecko feed, one batched
  // call for the default 7 tokens (six unique ids) plus user-added
  // tokens. Same auto-fetch on mount and ~60 s refresh as the native
  // feed — two calls a minute, inside the keyless ~5 calls/min budget.
  const tokenList = useMemo(
    () => [...DEFAULT_TOKENS, ...(customTokens ?? [])],
    [customTokens],
  );
  const { state: tokenPricesState, refresh: refreshTokenPrices } = useTokenPrices(tokenList);
  const tokenPricesLoading = tokenPricesState.status === 'loading';

  useEffect(() => {
    if (tokenPricesState.status === 'idle') {
      refreshTokenPrices();
    }
  }, [tokenPricesState.status, refreshTokenPrices]);

  const refreshTokenPricesRef = useRef(refreshTokenPrices);
  useEffect(() => {
    refreshTokenPricesRef.current = refreshTokenPrices;
  });
  useEffect(() => {
    const interval = setInterval(() => {
      refreshTokenPricesRef.current();
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

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

  // Token fiat folded into the hero total (token gaps, item 7): the
  // priced token balances, with the same honesty rules as the natives.
  // A token never fetched yet is skipped — not a failure — while a
  // token still loading holds the hero like a native chain does.
  const tokenContribution: PortfolioTokenContribution = useMemo(() => {
    const minorUnits: number[] = [];
    let partial = false;
    let loadedZero = false;
    let unpricedNonzero = false;
    const nowMs = Date.now();
    for (const token of tokenList) {
      const balance = (tokenBalances ?? {})[tokenKey(token.chain, token.contract)];
      if (balance === undefined) continue;
      const entry = tokenPricesState.entries[tokenKey(token.chain, token.contract)];
      const value = fiatValueForTokenBalance(balance, token.decimals, entry, nowMs);
      switch (value.kind) {
        case 'fiat':
          minorUnits.push(value.minorUnits);
          break;
        case 'zero':
          loadedZero = true;
          break;
        case 'balance-unavailable':
          partial = true;
          break;
        case 'unavailable':
        case 'expired':
        case 'error':
          unpricedNonzero = true;
          partial = true;
          break;
      }
    }
    return { minorUnits, partial, loadedZero, unpricedNonzero };
  }, [tokenList, tokenBalances, tokenPricesState.entries]);

  // Only chains with a verified balance adapter count toward the hero.
  // The multichain-extension chains have no balance adapter yet, so their
  // 'unavailable' status must not fail the hero.
  const heroChains = availableFor('balance');
  const heroBalances = heroChains.map((chain) => balances[chain]);
  const heroLoading =
    heroBalances.some((b) => b?.status === 'loading') ||
    tokenList.some(
      (token) =>
        (tokenBalances ?? {})[tokenKey(token.chain, token.contract)]?.status ===
        'loading',
    );
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
        // Round 2, item 6: in devnet mode the hero totals against idle
        // entries, never against live prices — test tokens are valueless,
        // so a funded test wallet must never show a dollar total. The
        // per-unit prices still show on the rows below.
        const total = portfolioTotal(
          balances,
          devnetEnabled ? idlePriceEntries() : pricesState.entries,
          Date.now(),
          heroChains,
          tokenContribution,
        );

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
        <p className="font-display text-xl text-ink">Your coins, drawn to scale. Almost.</p>
        {hero.showAttribution && (
          <p className="text-xs leading-[18px] text-panel-text-muted">{PRICE_ATTRIBUTION_TEXT}</p>
        )}
        {hero.partialNote && (
          <p className="text-xs leading-[18px] text-panel-text-muted">Partial total. Some balances or prices are missing, so this total may be incomplete. Failed balances count as 0.</p>
        )}
        {hero.noPriceFeed && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            {isLocked
              ? 'Locked. Unlock to see balances.'
              : devnetEnabled
                ? 'Devnet test mode — test tokens have no market value, so there is no portfolio total. Live market prices show on each asset below.'
                : hero.balancesFailed
                  ? 'Balances could not be loaded, so the portfolio total is unavailable.'
                  : pricesState.status === 'idle'
                    ? 'No prices loaded yet. Refresh prices to see the portfolio total. Balances below are the exact amounts on each network.'
                    : 'No fresh prices, so the portfolio total is unavailable. Balances below are the exact amounts on each network.'}
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
      <div className="grid grid-cols-3 gap-2 lg:self-center">
        {ACTIONS.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
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
            <Card className="mt-4">
              {devnetEnabled && (
                <p className="border-b px-4 pt-4 text-sm text-ink">
                  Devnet test mode — only the four test networks show
                  balances. Prices below are live market prices; test
                  tokens have no market value, so there is no portfolio
                  total.
                </p>
              )}
              <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} prices={pricesState.entries} pricesNowMs={Date.now()} pricesLoading={pricesLoading} tokenPrices={tokenPricesState.entries} tokenPricesNowMs={Date.now()} tokenPricesLoading={tokenPricesLoading} />
            </Card>
            <AddTokenDialog open={addTokenOpen} onOpenChange={setAddTokenOpen} />
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
