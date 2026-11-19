Make five targeted edits across three files (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only. Change NO balance logic, NO chain order, NO navigation. Spec is UI-UX-REFERENCE.md §6 (MetaMask TokenCell list; real MIT chain logos replace ticker-letter chips).

The four chain logos are already in the worktree at `apps/web/src/assets/chains/{bitcoin,ethereum,tron,ton}.png` (copied from `trustwallet/assets`, `blockchains/<chain>/info/logo.png`, MIT, Copyright (c) 2019-2023 Trust Wallet). Import them from `../assets/chains/*.png` in `src/screens/asset-rows.tsx` (vite/client types cover `*.png` imports).

EDIT 1 — New `ChainLogo` component in `apps/web/src/screens/asset-rows.tsx`, exported for reuse. Add after the imports:
```tsx
// Chain logos: Trust Wallet asset registry (trustwallet/assets, MIT,
// Copyright (c) 2019-2023 Trust Wallet) — blockchains/<chain>/info/logo.png.
// Full licence note: apps/web/README.md "Chain logos".
import bitcoinLogo from '../assets/chains/bitcoin.png';
import ethereumLogo from '../assets/chains/ethereum.png';
import tronLogo from '../assets/chains/tron.png';
import tonLogo from '../assets/chains/ton.png';
```
(Place the comment + imports with the other imports at the top of the file.) Then add:
```tsx
const CHAIN_LOGOS: Record<ChainId, string> = {
  btc: bitcoinLogo,
  eth: ethereumLogo,
  trx: tronLogo,
  ton: tonLogo,
};

/** Native chain logo (40px default). Decorative: the chain name is adjacent text, so alt is empty. */
export function ChainLogo({ chain, size = 40 }: { chain: ChainId; size?: number }) {
  return (
    <img
      src={CHAIN_LOGOS[chain]}
      alt=""
      width={size}
      height={size}
      className="size-10 shrink-0 rounded-full"
      style={size !== 40 ? { width: size, height: size } : undefined}
    />
  );
}
```
`ChainId` is NOT imported in this file yet — add `import type { ChainId } from '../engine/boundary';` to the imports. Do NOT delete `CHAIN_CHIP_COLORS` — it stays as chain-colour data per spec §1.1 (its last consumer, wallet-management, was re-skinned to ChainLogo in the same lane; the constant remains as data).

EDIT 2 — Replace the ticker-disc avatar in `AssetRows` with the logo. Exact current code:
```tsx
        const avatar = (
          <span className="relative flex size-10 shrink-0 items-center justify-center">
            <span
              className="flex size-10 items-center justify-center rounded-full text-[11px] font-bold text-[#19223a]"
              style={{ backgroundColor: CHAIN_CHIP_COLORS[chain] ?? '#9daeff' }}
            >
              {config.symbol}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-4 items-center rounded-full bg-[#293654] px-1 text-[8px] font-bold text-[#c8d0e8] ring-1 ring-[#19223a]">
              {config.symbol}
            </span>
          </span>
        );
```
Replace with:
```tsx
        const avatar = <ChainLogo chain={chain} />;
```
This removes the ticker disc AND the duplicated ticker badge (spec §6 REMOVE). The same `avatar` is used by the loading skeleton (no), the error row (yes) and the link row (yes) — the logo now appears in all three states.

EDIT 3 — Remap the row props per §6 (symbol ← ticker, amount ← native quantity + ticker, detail ← network name, value omitted) and re-skin the rows to light-Card tokens (the rows live inside a light `Card` on both the dashboard and the asset list, so foreground/muted tokens apply). Exact current code:
```tsx
  return (
    <ul className="divide-y divide-white/10">
```
becomes `<ul className="divide-y divide-border">`. And the empty states:
```tsx
    return <p className="text-sm text-[#aab5d1]">No balance adapters verified yet.</p>;
```
becomes `<p className="p-4 text-sm text-muted-foreground">No balance adapters verified yet.</p>;` and
```tsx
    return (
      <p className="text-sm text-[#aab5d1]">
        All balances are zero — turn off “Hide zero balances” to see them.
      </p>
    );
```
becomes the filtered-empty state (spec §6: show "No non-zero balances" and a "Show all" button that clears the filter). `AssetRows` gains an optional prop `onShowAll?: () => void`; when `visible.length === 0` AND `hideZero` is true, render:
```tsx
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">No non-zero balances</p>
        <Button type="button" variant="outline" onClick={() => onShowAll?.()}>
          Show all
        </Button>
      </div>
    );
```
When `visible.length === 0` and `hideZero` is false (cannot happen with the current filter, but keep a safe fallback), keep the existing paragraph text "All balances are zero — turn off “Hide zero balances” to see them." with classes `p-4 text-sm text-muted-foreground`. Update the component signature to `export function AssetRows({ hideZero, onShowAll }: { hideZero: boolean; onShowAll?: () => void })`.
Error row: replace `text-[15px] font-bold text-[#eff2fc]` with `text-[15px] font-bold text-foreground`, `text-xs text-[#9da9c7]` with `text-xs text-muted-foreground`, and keep the Retry Button (outline variant, already imported). The error row's `<li key={chain} className="flex items-center gap-3 py-4">` becomes `<li key={chain} className="flex items-center gap-3 px-4 py-3">` (12px vertical / 16px horizontal padding — spec §6 row geometry; rows are minimum 68px high via the AssetRow change in EDIT 4).
Link row: replace
```tsx
              <AssetRow
                avatar={avatar}
                symbol={config.displayName}
                amount={`${config.symbol} · ${config.displayName} mainnet`}
                value={value}
                detail={balance.status === 'zero' ? 'Zero balance' : undefined}
              />
```
with
```tsx
              <AssetRow
                avatar={avatar}
                symbol={config.symbol}
                amount={balance.status === 'zero' ? 'Zero balance' : value}
                detail={`${config.displayName} mainnet`}
              />
```
(`value` is the formatted native quantity + ticker computed just above, e.g. "0.5 BTC"; for zero balances the amount line reads "Zero balance" per §6. `value` stays computed and used — no unused variable. The `value` prop is omitted: see EDIT 4.)

EDIT 4 — `apps/web/src/ui/components/asset-row.tsx`: make `value` optional and fix row geometry. Exact current code:
```tsx
interface AssetRowProps extends React.ComponentProps<'div'> {
  avatar: ReactNode
  symbol: string
  amount: string
  value: string
  detail?: string
  detailColor?: string
}
```
Change `value: string` to `value?: string`. In the component, change the root div classes from `'flex items-center justify-between rounded-lg px-3 py-3'` to `'flex min-h-[68px] items-center justify-between rounded-lg px-4 py-3'` (minimum 68px high; 12px vertical / 16px horizontal padding). Change the detail div from `className="text-sm font-medium"` to `className="text-xs"` (12px/400 — spec §6) and render the right-hand block only when `value` or `detail` is present:
```tsx
      {(value || detail) && (
        <div className="text-right">
          {value ? <div className="text-base font-semibold">{value}</div> : null}
          {detail ? (
            <div
              data-design-audit-allow="dynamic-token-color"
              className="text-xs"
              style={detailColor ? { color: detailColor } : undefined}
            >
              {detail}
            </div>
          ) : null}
        </div>
      )}
```
Keep `detailColor`, the `data-design-audit-allow` attribute and everything else. The symbol line stays `text-base font-semibold` (16px/600) and the amount line `text-sm text-muted-foreground` (14px/400).

Acceptance: no `#` hex, no `white/`, no `slate-*` remain in the returned blocks or in `asset-rows.tsx` outside `CHAIN_CHIP_COLORS` (kept as data per spec §1.1); the badge/disc avatar is gone; rows show ticker / native amount / network name; zero shows "Zero balance" in the amount line; filtered-empty shows "No non-zero balances" + "Show all"; `tsc`-clean (all imports used; `config.symbol` still used in the amount computation).

EDIT 5 — Wire the "Show all" button in `apps/web/src/screens/dashboard.tsx` (the dashboard wraps `AssetRows` in a Card and owns the `hideZero` state). Exact current code:
```tsx
            <AssetRows hideZero={hideZero} />
```
Replace with:
```tsx
            <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} />
```
`setHideZero` is already in scope in that file. No other dashboard change.

Return ONLY the five edits, numbered 1-5, each with the exact old text quoted and the replacement in its own ```tsx fenced block. No explanation, no other changes.
