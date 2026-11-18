The ref needs component-scope setup before any early returns. Import `useRef` and `useEffect` from React; this setup affects only the hero:

```tsx
const lastHeroRef = useRef({
  text: "Unavailable",
  noPriceFeed: false,
  retry: false,
});

const heroBalances = Object.values(balances);
const heroLoading = heroBalances.some((b) => b?.status === "loading");
const heroFailed = heroBalances.some(
  (b) => b?.status === "unavailable" || b?.status === "error",
);
const heroAllZero =
  heroBalances.length === 4 &&
  heroBalances.every(
    (b) =>
      b?.status === "zero" ||
      (b?.status === "available" && b.value === "0"),
  );

// Known failures override a cached $0.00, even during a partial refresh.
const nextHero = heroFailed
  ? { text: "Unavailable", noPriceFeed: false, retry: true }
  : heroLoading
    ? null
    : {
        text: heroAllZero ? "$0.00" : "Unavailable",
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

**Replacement hero JSX:** retain your existing wrapper/button class strings if they differ—the original markup wasn’t included.

```tsx
<div className="balance-hero rounded-2xl border border-slate-800 bg-[#0b1220] p-6">
  <div className="flex items-center justify-between gap-4">
    <div className="text-sm text-slate-400">Portfolio balance</div>

    <button
      type="button"
      onClick={() => void refreshBalances()}
      className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700/60"
    >
      Refresh
    </button>
  </div>

  <div className="mt-3 text-4xl font-semibold tracking-tight text-white">
    {hero.text}
  </div>

  {hero.noPriceFeed && (
    <p className="mt-2 text-sm text-slate-400">
      No price feed connected — portfolio total unavailable.
    </p>
  )}

  {hero.retry && (
    <button
      type="button"
      onClick={() => void refreshBalances()}
      className="mt-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700/60"
    >
      Retry
    </button>
  )}
</div>
```