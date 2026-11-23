import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BawaIcon, ScanIcon } from '../ui/components/icons';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import { availableFor } from '../wallet/chains';
import {
  idlePriceEntries,
  portfolioTotal,
  PRICE_ATTRIBUTION_TEXT,
  type PortfolioTokenContribution,
} from '../wallet/prices';
import { fiatValueForTokenBalance } from '../wallet/token-prices';
import { tokenKey } from '../wallet/tokens';
import { Button } from '../ui/components/button';
import { NumberTicker } from '../ui/components/number-ticker';
import { AssetRows } from './asset-rows';
import { AddTokenDialog } from './add-token';
import { RecentActivity } from './recent-activity';
import { Card } from '../ui/components/card';
import { useLivePrices } from './use-live-prices';
import { useAnimatedHeroValue } from './use-hero-ticker';

// Fourth action is Scan (Lane J): the dashboard's way into the Round 2
// QR scanner. It links to /send?scan=1, which opens the scanner on
// arrival — the welcome screen has no Scan tile because without a vault
// there is nothing to send from. The icon is the ScanIcon SVG (the
// owner-reference glyph), not a BawaIconName.
const ACTIONS = [
  { to: '/send', icon: <BawaIcon name="send" className="size-6" />, label: 'Send' },
  { to: '/receive', icon: <BawaIcon name="receive" className="size-6" />, label: 'Receive' },
  { to: '/send?scan=1', icon: <ScanIcon className="size-6" />, label: 'Scan' },
  { to: '/transactions', icon: <BawaIcon name="activity" className="size-6" />, label: 'Activity' },
] as const;

/**
 * Panel home — real balances plus the live CoinGecko price feed. The hero
 * total is the whole portfolio — natives plus priced token balances —
 * and reads Partial when incomplete. Missing, expired, or failed prices
 * are shown as unavailable or an error, never as $0.00 and never as
 * fabricated prices. The hero total counts to its value (Magic UI Number
 * Ticker pattern, RESEARCH.md §12) and stays static under
 * prefers-reduced-motion.
 */
export function DashboardScreen() {
  const {
    balances,
    refreshBalances,
    vaultState,
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

  const {
    pricesState,
    pricesLoading,
    refreshPrices,
    tokenPricesState,
    tokenPricesLoading,
    tokenList,
  } = useLivePrices();

  // Hold the last settled hero text while balances refresh so it never flashes
  // Unavailable mid-refresh. Missing, expired, or failed prices are never $0.00.
  const lastHeroRef = useRef<{
    text: string;
    noPriceFeed: boolean;
    retry: boolean;
    partialNote: boolean;
    quietNote: boolean;
    freshZeroNote: boolean;
    showAttribution: boolean;
    priceError: 'rate-limited' | 'network' | 'provider' | 'timeout' | null;
    balancesFailed: boolean;
  }>({
    text: 'Unavailable',
    noPriceFeed: false,
    retry: false,
    partialNote: false,
    quietNote: false,
    freshZeroNote: false,
    showAttribution: false,
    priceError: null,
    balancesFailed: false,
  });

  // Token fiat folded into the hero total (token gaps, item 7): the
  // priced token balances, with the same honesty rules as the natives.
  // A token never fetched yet is skipped — not a failure — while a
  // token still loading holds the hero like a native chain does.
  const tokenContribution: PortfolioTokenContribution = useMemo(() => {
    // Fix-all Lane H, item 2 (follow-up): in devnet mode test tokens
    // contribute nothing to the hero — the same rule as the natives,
    // whose hero totals against idle entries in devnet. Without this,
    // 25 test USDC put a "$25.00 (Partial)" total in the hero even
    // though the token row itself correctly suppressed the fiat value.
    if (devnetEnabled) {
      return { minorUnits: [], partial: false, loadedZero: false, unpricedNonzero: false };
    }
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
  }, [devnetEnabled, tokenList, tokenBalances, tokenPricesState.entries]);

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
            // A zero total reads as a clean $0.00 even when some loads
            // failed (portfolioTotal reports that as zero + partial:
            // true). The failure is disclosed by a quiet note under
            // the hero, never by an alarming "(Partial)" on it — a
            // fresh wallet whose balances all loaded as zero must not
            // look broken.
            return {
              text: '$0.00',
              noPriceFeed: false,
              retry: false,
              partialNote: false,
              quietNote: total.partial,
              // Fix-all Lane H, item 4b: a genuinely fresh $0.00 (every
              // balance loaded as zero, nothing failed) gets a quiet
              // note saying so — the partial case keeps its failure
              // note instead, never both.
              freshZeroNote: !total.partial,
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
              quietNote: false,
              freshZeroNote: false,
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
              quietNote: false,
              freshZeroNote: false,
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
              quietNote: false,
              freshZeroNote: false,
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

  // Magic UI Number Ticker pattern, honest variant (Lane J): the hero
  // counts between settled dollar values; first load, Partial,
  // Unavailable, Locked and masked totals render at once (see
  // use-hero-ticker.ts — it never counts from a fabricated $0.00).
  const animatedHeroText = useAnimatedHeroValue(hero.text);

  // The toggle masks a real total only; "Unavailable" stays visible so
  // a missing total is never disguised as a hidden one.
  const heroText = isLocked ? 'Locked' : hideBalance && hero.text !== 'Unavailable' ? '••••••' : animatedHeroText;

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
        <p className="text-display-lg font-bold tracking-tight text-ink"><span className="bawa-marker"><NumberTicker text={heroText} /></span></p>
        <p className="font-display text-xl text-ink">The total value of your coins, in US dollars.</p>
        {hero.showAttribution && (
          <p className="text-xs leading-[18px] text-panel-text-muted">{PRICE_ATTRIBUTION_TEXT}</p>
        )}
        {hero.partialNote && (
          <p className="text-xs leading-[18px] text-panel-text-muted">Partial total. Some balances or prices are missing, so this total may be incomplete. Failed balances count as 0.</p>
        )}
        {hero.quietNote && (
          <p className="text-xs leading-[18px] text-panel-text-muted">Some balances or prices couldn&apos;t be checked just now.</p>
        )}
        {hero.freshZeroNote && (
          <p className="text-xs leading-[18px] text-panel-text-muted">Nothing here yet — receive on any chain to get started.</p>
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
      <div className="grid grid-cols-4 gap-2 lg:self-center">
        {ACTIONS.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper py-1 hover:bg-sun/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral active:bg-sun"
          >
            <span className="flex size-14 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink">
              {icon}
            </span>
            <span className="text-xs leading-4 font-medium text-ink">{label}</span>
          </Link>
        ))}
      </div>

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
