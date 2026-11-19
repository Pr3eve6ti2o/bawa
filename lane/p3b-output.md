// SNIPPET 1 replaces: top comment beginning " * Panel home — real balances only. There is no price feed in this lane, so" and the imports "import { useWallet } from '../state/wallet-context';" and "import { availableFor, chainConfig } from '../wallet/chains';"
```tsx
/**
 * Panel home — real balances plus the live CoinGecko price feed. The hero
 * total includes ONLY fresh-quoted balances and reads Partial when incomplete.
 * Missing, expired, or failed prices are shown as unavailable or an error,
 * never as $0.00 and never as fabricated prices.
 */

import { useWallet } from '../state/wallet-context';
import { portfolioTotal, usePrices, PRICE_ATTRIBUTION_TEXT } from '../wallet/prices';
import { availableFor, chainConfig } from '../wallet/chains';
```

// SNIPPET 2 replaces: the Balance hero comment and computation from const lastHeroRef = useRef({ through the useEffect ending }, [nextHero]);
```tsx
  const { state: pricesState, refresh: refreshPrices } = usePrices();
  const pricesLoading = pricesState.status === 'loading';

  // Hold the last settled hero text while balances refresh so it never flashes
  // Unavailable mid-refresh. Missing, expired, or failed prices are never $0.00.
  const lastHeroRef = useRef<{
    text: string;
    noPriceFeed: boolean;
    retry: boolean;
    partialNote: boolean;
    showAttribution: boolean;
    priceError: 'rate-limited' | 'network' | 'provider' | 'timeout' | null;
  }>({
    text: 'Unavailable',
    noPriceFeed: false,
    retry: false,
    partialNote: false,
    showAttribution: false,
    priceError: null,
  });

  const heroBalances = Object.values(balances);
  const heroLoading = heroBalances.some((b) => b?.status === 'loading');
  const heroFailed = heroBalances.some(
    (b) => b?.status === 'unavailable' || b?.status === 'error',
  );

  const priceEntries = Object.values(pricesState.entries);
  const priceErrorReasons = priceEntries.flatMap(
    (entry) => (entry?.status === 'error' ? [entry.reason] : []),
  );
  const sharedPriceError =
    priceEntries.length === 4 &&
    priceErrorReasons.length === 4 &&
    priceErrorReasons.every((reason) => reason === priceErrorReasons[0])
      ? (priceErrorReasons[0] ?? null)
      : null;

  const nextHero: typeof lastHeroRef.current | null = heroFailed
    ? {
        text: 'Unavailable',
        noPriceFeed: true,
        retry: true,
        partialNote: false,
        showAttribution: false,
        priceError: null,
      }
    : heroLoading
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
              };
            case 'total':
              return {
                text: total.text,
                noPriceFeed: false,
                retry: false,
                partialNote: false,
                showAttribution: true,
                priceError: null,
              };
            case 'partial':
              return {
                text: `${total.text} (Partial)`,
                noPriceFeed: false,
                retry: false,
                partialNote: true,
                showAttribution: true,
                priceError: null,
              };
            case 'unavailable':
              return {
                text: 'Unavailable',
                noPriceFeed: true,
                retry: false,
                partialNote: false,
                showAttribution: false,
                priceError: sharedPriceError,
              };
          }
        })();

  const hero = nextHero ?? lastHeroRef.current;

  useEffect(() => {
    if (nextHero !== null) {
      lastHeroRef.current = nextHero;
    }
  }, [nextHero]);
```

// SNIPPET 3 replaces: the entire Portfolio balance hero div beginning <div className="space-y-1 rounded-2xl bg-panel-surface-raised p-5">
```tsx
      <div className="space-y-1 rounded-2xl bg-panel-surface-raised p-5">
        <p className="text-[13px] leading-[18px] font-medium text-panel-text-muted">Portfolio balance</p>
        <p className="text-display-lg font-bold tracking-tight text-panel-text">{hero.text}</p>
        {hero.showAttribution && (
          <p className="text-xs leading-[18px] text-panel-text-muted">{PRICE_ATTRIBUTION_TEXT}</p>
        )}
        {hero.partialNote && (
          <p className="text-xs leading-[18px] text-panel-text-muted">Partial total — only balances with a fresh price are included.</p>
        )}
        {hero.noPriceFeed && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            {pricesState.status === 'idle'
              ? 'No prices loaded yet — refresh prices to see the portfolio total. Balances below are exact native amounts from the mainnet adapters.'
              : 'No fresh prices — portfolio total unavailable. Balances below are exact native amounts from the mainnet adapters.'}
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
        <Button type="button" variant="outline" disabled={pricesLoading} onClick={() => refreshPrices()}>{pricesLoading ? 'Refreshing prices…' : 'Refresh prices'}</Button>
      </div>
```