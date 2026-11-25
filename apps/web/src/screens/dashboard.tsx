import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BawaIcon, ScanIcon } from '../ui/components/icons';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import {
  fiatValueForBalance,
  formatChangePct,
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
import { Skeleton } from '../ui/components/skeleton';
import { useLivePrices } from './use-live-prices';
import { useAnimatedHeroValue } from './use-hero-ticker';

// Fourth action is Scan (Lane J): the dashboard's way into the Round 2
// QR scanner. It links to /send?scan=1, which opens the scanner on
// arrival — the welcome screen has no Scan tile because without a vault
// there is nothing to send from. The icon is the ScanIcon SVG (the
// owner-reference glyph), not a BawaIconName. Buy (Lane D,
// usable-install) is the third action: fiat top-up via Coinbase
// Onramp, opening the Receive screen's Buy panel
// (/receive?buy=1, the /send?scan=1 precedent) — a separate /buy
// route cannot fit the bundle budget (see onramp.ts).
const ACTIONS = [
  { to: '/send', icon: <BawaIcon name="send" className="size-6" />, label: 'Send' },
  { to: '/receive', icon: <BawaIcon name="receive" className="size-6" />, label: 'Receive' },
  { to: '/receive?buy=1', icon: <BawaIcon name="plus" className="size-6" />, label: 'Buy' },
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

  // Lane 4 (UX-major, data): the portfolio breakdown — one unified
  // list across chains and tokens, sorted by fiat value, with each
  // holding's share of the priced total and its 24 h movement where
  // the feed sent one. A funded holding whose value cannot be priced
  // stays in the list as "Value unavailable" (never $0.00, never
  // dropped); zero balances are counted in the footnote, not listed.
  // In devnet mode test tokens have no market value, so there is no
  // breakdown at all — same rule as the hero total.
  type BreakdownHolding = {
    key: string;
    label: string;
    detail: string;
    minorUnits: number | null;
    valueText: string | null;
    change24hPct: number | undefined;
  };
  const breakdown = useMemo(() => {
    if (devnetEnabled) {
      return { holdings: [] as BreakdownHolding[], zeroCount: 0, pricedTotal: 0 };
    }
    const holdings: BreakdownHolding[] = [];
    let zeroCount = 0;
    let pricedTotal = 0;
    const nowMs = Date.now();
    for (const chain of availableFor('balance')) {
      const balance = balances[chain];
      if (balance === undefined || balance.status === 'loading') continue;
      if (balance.status === 'unavailable' || balance.status === 'error') continue;
      if (balance.status === 'zero' || balance.value === '0') {
        zeroCount += 1;
        continue;
      }
      const entry = pricesState.entries[chain];
      const fiat = fiatValueForBalance(chain, balance, entry, nowMs);
      const change24hPct =
        entry?.status === 'fresh' ? entry.quote.change24hPct : undefined;
      if (fiat.kind === 'fiat') {
        pricedTotal += fiat.minorUnits;
        holdings.push({
          key: chain,
          label: chainConfig(chain).displayName,
          detail: chainConfig(chain).symbol,
          minorUnits: fiat.minorUnits,
          valueText: fiat.text,
          change24hPct,
        });
      } else {
        holdings.push({
          key: chain,
          label: chainConfig(chain).displayName,
          detail: chainConfig(chain).symbol,
          minorUnits: null,
          valueText: null,
          change24hPct,
        });
      }
    }
    for (const token of tokenList) {
      const balance = (tokenBalances ?? {})[tokenKey(token.chain, token.contract)];
      if (balance === undefined || balance.status === 'loading') continue;
      if (balance.status === 'unavailable' || balance.status === 'error') continue;
      if (balance.status === 'zero' || balance.value === '0') {
        zeroCount += 1;
        continue;
      }
      const entry = tokenPricesState.entries[tokenKey(token.chain, token.contract)];
      const fiat = fiatValueForTokenBalance(balance, token.decimals, entry, nowMs);
      const change24hPct =
        entry?.status === 'fresh' ? entry.quote.change24hPct : undefined;
      if (fiat.kind === 'fiat') {
        pricedTotal += fiat.minorUnits;
        holdings.push({
          key: tokenKey(token.chain, token.contract),
          label: token.name,
          detail: `${token.symbol} · ${chainConfig(token.chain).displayName}`,
          minorUnits: fiat.minorUnits,
          valueText: fiat.text,
          change24hPct,
        });
      } else {
        holdings.push({
          key: tokenKey(token.chain, token.contract),
          label: token.name,
          detail: `${token.symbol} · ${chainConfig(token.chain).displayName}`,
          minorUnits: null,
          valueText: null,
          change24hPct,
        });
      }
    }
    holdings.sort((a, b) => (b.minorUnits ?? -1) - (a.minorUnits ?? -1));
    return { holdings, zeroCount, pricedTotal };
  }, [devnetEnabled, balances, pricesState.entries, tokenList, tokenBalances, tokenPricesState.entries]);

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

      <div className="space-y-1 rounded-bawa border-2 border-ink bg-paper p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] leading-[18px] font-medium text-ink">Portfolio balance</p>
          <button
            type="button"
            aria-pressed={hideBalance}
            aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
            title={hideBalance ? 'Show balance' : 'Hide balance'}
            onClick={() => toggleHideBalance()}
            className="flex size-11 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-paper text-ink hover:bg-sun focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {hideBalance ? (
              <BawaIcon name="eye-off" className="size-5" />
            ) : (
              <BawaIcon name="eye" className="size-5" />
            )}
          </button>
        </div>
        {/* UX-major Lane 2: break-words — a long total (whale wallet,
            "$12,345,678.90 (Partial)") wraps inside the card at 390 px
            instead of clipping past its edge; tabular-nums (break-ui)
            stops the digits jittering while the ticker counts; normal
            totals render exactly as before. */}
        <p className="break-words tabular-nums text-display-lg font-bold tracking-tight text-ink"><span className="bawa-marker"><NumberTicker text={heroText} /></span></p>
        <p className="font-display text-xl text-ink">Total value in US dollars.</p>
        {hero.showAttribution && (
          <p className="text-xs leading-[18px] text-panel-text-muted">{PRICE_ATTRIBUTION_TEXT}</p>
        )}
        {/* Lane 4 (UX-major, data): when the prices were last fetched —
            the freshness signal for the total above. Only once a fetch
            has landed; before that the rows carry their own states. */}
        {hero.showAttribution && pricesState.lastFetchedAtMs !== null && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            {`Prices updated ${new Date(pricesState.lastFetchedAtMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}.`}
          </p>
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
        {/* Refresh actions sit in one row with the 8px touch-target gap
            (DESIGN-SYSTEM §2.5): two adjacent outline buttons with no
            gap read as one control and are a miss-tap risk. Same
            labels, same order, same behaviour — only the gap. */}
        <div className="flex flex-wrap gap-2">
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
      </div>
      {/* Actions sit at the hero's baseline on desktop (lg:self-end):
          vertically centred they floated mid-air in the 5fr column next
          to the wide hero. Mobile is unchanged: the row follows the hero
          in the single column, balance first, actions second. */}
      <div className="grid grid-cols-5 gap-2 lg:self-end">
        {ACTIONS.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper py-1 hover:bg-sun/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral active:bg-sun"
          >
            {/* UX-major Lane 2 (break-ui, measured first-hand): the 56 px
                discs overflow their 49.6 px tracks at 320 px viewport
                (page +14 px) — below 360 px they render at 44 px, which
                fits the track with the label. 390 px and up are
                untouched. */}
            <span className="flex size-14 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink max-[359px]:size-11">
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
            // UX-major Lane 2: min-h-11 (44 px tab) + rounded-bawa-sm
            // (the old rounded-lg was a geometric radius, and py-2
            // alone made a 36 px tab — below DESIGN-SYSTEM §2.5).
            className={`min-h-11 rounded-bawa-sm px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent ${
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
            {/* UX-major Lane 2: the row wraps below 360 px — at 320 px
                "Assets" + both pills are ~300 px against 280 px of
                room, and the row ran past the viewport edge (probe:
                dashboard@320 overflow +14). */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">Assets</h2>
              <div className="flex shrink-0 items-center gap-2">
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
            {/* Lane 4 (UX-major, data): portfolio breakdown — the unified
                per-chain / per-token view of the total above. Funded
                holdings only, largest first; an unpriced holding reads
                "Value unavailable", never $0.00. NFTs have no indexer
                configured, so they are named as unavailable rather than
                listed with a fake value. */}
            <section aria-label="Portfolio breakdown" className="mt-6">
              <h2 className="text-lg font-semibold text-ink">Breakdown</h2>
              {devnetEnabled ? (
                <p className="mt-4 text-sm text-ink">
                  Devnet test mode — test tokens have no market value, so
                  there is no breakdown.
                </p>
              ) : heroLoading ? (
                <>
                  {/* h-[140px], not 68px: Skeleton embeds BawaLoading
                      (48px spinner + dots + 1.5rem label ≈ 130px tall),
                      so a 68px box lets "Loading…" overflow and paint
                      over the NFT card below — seen in the CDP capture. */}
                  <div role="status" className="mt-4">
                    <Skeleton className="h-[140px] w-full" />
                    <span className="sr-only">Loading portfolio breakdown…</span>
                  </div>
                </>
              ) : breakdown.holdings.length === 0 ? (
                <p className="mt-4 text-sm text-ink">
                  Nothing to break down yet — receive on any chain to get started.
                </p>
              ) : (
                <>
                  <ul className="mt-4 divide-y divide-border rounded-bawa border-2 border-ink bg-paper">
                    {breakdown.holdings.slice(0, 8).map((holding) => (
                      <li key={holding.key} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{holding.label}</span>
                          <span className="block text-xs text-panel-text-muted">
                            {holding.detail}
                            {holding.change24hPct !== undefined ? ` · 24h ${formatChangePct(holding.change24hPct)}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold text-ink">
                            {hideBalance
                              ? '••••••'
                              : (holding.valueText ?? 'Value unavailable')}
                          </span>
                          <span className="block text-xs text-panel-text-muted">
                            {holding.minorUnits !== null && breakdown.pricedTotal > 0 && !hideBalance
                              ? `${((holding.minorUnits / breakdown.pricedTotal) * 100).toFixed(1)}% of portfolio`
                              : holding.minorUnits === null
                                ? 'Share unknown'
                                : '—'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {breakdown.holdings.length > 8 ? (
                    <p className="mt-2 text-xs leading-[18px] text-panel-text-muted">
                      {`And ${breakdown.holdings.length - 8} more holding${breakdown.holdings.length - 8 === 1 ? '' : 's'} — see Assets above for the full list.`}
                    </p>
                  ) : null}
                  {breakdown.zeroCount > 0 ? (
                    <p className="mt-2 text-xs leading-[18px] text-panel-text-muted">
                      {`${breakdown.zeroCount} asset${breakdown.zeroCount === 1 ? '' : 's'} at zero balance — not listed here.`}
                    </p>
                  ) : null}
                </>
              )}
              <div className="mt-4 rounded-bawa border-2 border-dashed border-ink bg-paper p-4">
                <p className="text-sm font-semibold text-ink">NFTs — not connected yet</p>
                <p className="mt-1 text-sm text-ink">
                  Bawa has no NFT indexer configured, so NFTs are not listed
                  here and are never given a made-up value. Connecting one
                  needs an NFT indexer provider and key — an owner decision.
                </p>
              </div>
            </section>
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
