You are editing one React file for the Bawa web wallet (repo at /home/boxd/workspace/bawa-multichain-d-prices, app in apps/web). You have no shell or filesystem access. EMIT ONLY three replacement snippets for `apps/web/src/screens/dashboard.tsx`, each in its own ```tsx fenced block, in order, with a one-line `// SNIPPET N replaces: ...` comment before each block naming the exact anchor. No prose, no other files, no full-file rewrite.

CONTEXT: the prices module `apps/web/src/wallet/prices.ts` already exists in this lane with this exact API (do not re-derive, do not change it):
- `import { portfolioTotal, usePrices, PRICE_ATTRIBUTION_TEXT } from '../wallet/prices';`
- `usePrices()` returns `{ state: PricesState, refresh: () => void }`; PricesState is `{ status: 'idle' | 'loading' | 'ready', entries: PriceMap, lastFetchedAtMs: number | null }`; refresh() fetches nothing on mount and never polls.
- `portfolioTotal(balances, entries, nowMs)` returns `{ status: 'zero' | 'total' | 'partial' | 'unavailable', text: string, partial: boolean }` where text is '$0.00' for zero, the sumFiatUSD total for total, the subtotal of ONLY fresh-quoted nonzero balances for partial, and 'Unavailable' for unavailable. The caller appends the 'Partial' label for a partial total.
- `PriceEntry` is `{ status: 'fresh', quote } | { status: 'expired', quote } | { status: 'unavailable', reason } | { status: 'error', reason: 'rate-limited' | 'network' | 'provider' | 'timeout', retryAfterMs?: number }`.
- The `AssetRows` component now accepts optional props `prices?: PriceMap; pricesNowMs?: number` (import type { PriceMap } from '../wallet/prices' if needed for the pass-through; no other AssetRows change is needed here).
- Balances come from `useWallet()` as `Record<ChainId, BalanceState>` with BalanceState status 'loading' | 'zero' | 'available' | 'unavailable' | 'error' and optional base-units string `value`.

SNIPPET 1 replaces the file's top comment and imports (exact current text):
```
/**
 * Panel home — real balances only. There is no price feed in this lane, so
 * no fiat portfolio total is shown (and none is fabricated): the hero states
 * that plainly. Asset rows come from the verified balance adapters.
 */
```
and
```
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
```
New top comment: panel home shows real balances plus the live CoinGecko price feed; the hero total includes ONLY fresh-quoted balances and reads Partial when incomplete; a missing/expired/failed price is shown as unavailable or an error, never as $0.00 and never as a fabricated price. New imports: add `import { portfolioTotal, usePrices, PRICE_ATTRIBUTION_TEXT } from '../wallet/prices';` after the wallet-context import. Keep every other import line unchanged.

SNIPPET 2 replaces the whole hero-computation block (exact current text, from the Balance hero comment through the useEffect):
```
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
```
Replacement rules: keep the lastHeroRef hold-last-settled behaviour and the heroFailed / heroLoading guards exactly (same shape: lastHeroRef holds { text, noPriceFeed, retry, partialNote, showAttribution, priceError } — extend the ref object with the three new fields, all defaulting to false / null). Add `const { state: pricesState, refresh: refreshPrices } = usePrices();` and `const pricesLoading = pricesState.status === 'loading';` before the hero computation. When balances are settled (not heroFailed, not heroLoading), compute `const total = portfolioTotal(balances, pricesState.entries, Date.now());` and map it: total.status 'zero' gives { text: '$0.00', noPriceFeed: false, retry: false, partialNote: false, showAttribution: false, priceError: null }; 'total' gives { text: total.text, noPriceFeed: false, retry: false, partialNote: false, showAttribution: true, priceError: null }; 'partial' gives { text: `${total.text} (Partial)`, noPriceFeed: false, retry: false, partialNote: true, showAttribution: true, priceError: null }; 'unavailable' gives { text: 'Unavailable', noPriceFeed: true, retry: false, partialNote: false, showAttribution: false, priceError: <the shared price error reason or null> }. The shared price error reason: collect the `reason` of every entry with status 'error'; if all four entries are errors and share one reason, that reason, else null. When heroFailed is true, nextHero is { text: 'Unavailable', noPriceFeed: true, retry: true, partialNote: false, showAttribution: false, priceError: null }. When heroLoading is true, nextHero is null (hold the last settled hero, as today). Keep the useEffect that stores nextHero into lastHeroRef. Add a short comment explaining the hero holds its last settled text while a refresh is loading so it never flashes Unavailable mid-refresh, and that a missing/expired/failed price is never rendered as zero.

SNIPPET 3 replaces the hero JSX div (exact current text):
```
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
```
Replacement rules: keep the outer div, the 'Portfolio balance' label, the hero.text line, the locked-vault button and the Refresh balances button exactly. Change the noPriceFeed paragraph to: when pricesState.status is 'idle', 'No prices loaded yet — refresh prices to see the portfolio total. Balances below are exact native amounts from the mainnet adapters.'; otherwise, 'No fresh prices — portfolio total unavailable. Balances below are exact native amounts from the mainnet adapters.' Add, directly under the hero.text line and only when hero.showAttribution is true, a line `<p className="text-xs leading-[18px] text-panel-text-muted">{PRICE_ATTRIBUTION_TEXT}</p>`. Add, only when hero.partialNote is true, a line `<p className="text-xs leading-[18px] text-panel-text-muted">Partial total — only balances with a fresh price are included.</p>`. Add, only when hero.priceError is non-null, a line with the message for that reason: 'rate-limited' gives 'Price feed rate-limited — try again shortly.'; 'network' gives 'Could not reach the price feed — check your connection and retry.'; 'timeout' gives 'Price feed timed out — retry.'; 'provider' gives 'Price feed error — retry.' Add a second button after the Refresh balances button: `<Button type="button" variant="outline" disabled={pricesLoading} onClick={() => refreshPrices()}>{pricesLoading ? 'Refreshing prices…' : 'Refresh prices'}</Button>`. The attribution line must use font size 10 or larger (text-xs is 12px: compliant with the CoinGecko terms).

ALSO, in the same file, the AssetRows usage line (do not emit a snippet for this; note it here for the assembler): change `<AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} />` to `<AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} prices={pricesState.entries} pricesNowMs={Date.now()} />`. The assembler makes this one-line change by hand; your snippets must not include it.

CONSTRAINTS: TypeScript strict, no `any`, no new dependencies, no AVOID-list names anywhere, no fake prices, no $0.00 for a missing/expired/error price, no polling, no localStorage, no broadcast/send code. Do not touch the tabs, the activity section, or anything below the hero div.
