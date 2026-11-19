Make two edits (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only. Change NO balance logic, NO chain order, NO navigation targets. Spec is UI-UX-REFERENCE.md §6 (MetaMask TokenCell list; Phantom detail-owns-actions).

EDIT 1 — Rewrite `apps/web/src/screens/asset-list.tsx` completely. Current file (48 lines, exact):
```tsx
import { useState } from 'react';
import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';
import { AssetRows } from './asset-rows';

/**
 * Full asset list — the same real-balance rows as the dashboard. No fiat
 * total exists (no price feed), so none is shown or fabricated.
 */
export function AssetListScreen() {
  const { refreshBalances } = useWallet();
  const [hideZero, setHideZero] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Assets</h1>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#243454] px-5 py-4 text-white">
        <div>
          <p className="text-xs text-[#aab5d1]">Portfolio balance</p>
          <p className="text-2xl font-bold">Unavailable</p>
          <p className="text-xs text-[#aab5d1]">
            No price feed connected — exact native balances below.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshBalances()}
          >
            Refresh
          </Button>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(event) => setHideZero(event.target.checked)}
            />
            Hide zero balances
          </label>
        </div>
      </div>

      <AssetRows hideZero={hideZero} />
    </div>
  );
}
```
New file (spec §6 list order: Assets heading → filter → Card containing native rows):
- Keep the doc comment and `useState` for `hideZero`. Drop `useWallet`/`refreshBalances` (the summary card and its Refresh button go away — the summary duplicates the dashboard hero, and refresh lives on the dashboard hero plus per-chain Retry; no refresh path is removed from the app).
- Heading: `<h1 className="text-2xl font-semibold text-panel-text">Assets</h1>` (24px/600).
- Filter row: heading and chip in one flex row (`flex items-center justify-between gap-3`): the chip is a `Button` with `type="button"`, `aria-pressed={hideZero}`, `onClick={() => setHideZero((current) => !current)}`, `variant={hideZero ? 'default' : 'outline'}`, `className="h-11 shrink-0 rounded-[22px] px-3 text-sm font-medium"` (44px high, 12px horizontal padding, 22px radius, 14px/500), labelled "Hide zero balances".
- Rows: `<Card><AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} /></Card>` — import `Card` from `../ui/components/card`. The list Card has no padding outside rows.
- No priced columns, no fiat, no demo data. No `#` hex, no `white/`, no `slate-*`.

EDIT 2 — `apps/web/src/screens/asset-detail.tsx`, header only (the hero/actions/breakdown are a separate edit — do NOT touch the balance Card, transactions, xpub Card or derived addresses here, except the two small fixes at the end).
(a) Imports: remove `import { CHAIN_CHIP_COLORS } from './asset-rows';` and add `import { ChainLogo } from './asset-rows';` and `import { ArrowLeft } from 'lucide-react';`. Keep all other imports (`useState`, `Link, useParams`, `useWallet`, `ChainId`, `chainConfig`, format helpers, `Alert`, `Button`, `Card`, `Skeleton`).
(b) Replace the whole `<header>...</header>` block (exact current code):
```tsx
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <span
            className="flex size-10 items-center justify-center rounded-full text-base font-bold text-[#19223a]"
            style={{ backgroundColor: CHAIN_CHIP_COLORS[chain] ?? '#9daeff' }}
          >
            {config.displayName.slice(0, 1)}
          </span>
          {config.displayName}
        </h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={state === 'loading'}
            onClick={refreshAll}
          >
            Refresh
          </Button>
          <Button asChild>
            <Link to="/receive" onClick={() => setSelectedChain(chain)}>
              Receive
            </Link>
          </Button>
        </div>
      </header>
```
with a 44px Back target only (the logo + name live in the dark holding-card hero, added by the next edit — the header holds no buttons and no title row):
```tsx
      <Link
        to="/assets"
        aria-label="Back to assets"
        className="flex h-11 w-11 items-center justify-center rounded-full text-panel-text hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Link>
```
Note: after this edit `refreshAll` is temporarily unused until the next edit re-adds Refresh below the hero — that is expected; do NOT delete `refreshAll`, `refreshChain`, `refreshBalances`, `refreshHistory` or `setSelectedChain` (the next edit uses them). `state` is still used below (derived-addresses loading). `Button` is still used below (Retry, Copy). The `config` variable is still used below (balance Card, transactions, xpub Card).
(c) Small fixes in the untouched sections: the transaction row link `focus-visible:ring-[#b4aaff]` becomes `focus-visible:ring-panel-accent` (there is exactly one such occurrence in the transactions list); the xpub Card — the one followed by `<CardContent className="pt-6">` and `<dl className="space-y-4">`, NOT the balance Card (which is followed by `<CardContent className="space-y-2 pt-6">` and is handled by the next edit) — changes `className="rounded-[20px] border-[#d6deed]"` to `className="rounded-xl"`.

Acceptance: asset-list has no summary card, no Refresh, no checkbox; chip has `aria-pressed`; detail has a 44px Back link to /assets (the 48px logo comes with the next edit, not this one); no `#` hex, no `white/`, no `slate-*`, no gradient classes in the returned code; `tsc`-clean except for the known-temporary unused `refreshAll` (the next edit uses it — if your toolchain flags it, say so in one line instead of deleting it).

Return ONLY the two edits, numbered 1-2, each with the exact old text quoted and the replacement in its own ```tsx fenced block. No explanation, no other changes.
