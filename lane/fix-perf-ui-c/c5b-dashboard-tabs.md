Make three targeted edits to apps/web/src/screens/dashboard.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only. Change NO balance/history logic, NO tab keyboard handling, NO transaction rendering except the empty-history copy given below. Spec is UI-UX-REFERENCE.md §5 (Rabby summary-first balance view) and §6 (filter as a chip). Assume the hero, action row and bottom banners are already handled by a parallel edit — do NOT touch them.

EDIT 1 — Re-skin the Tokens/Activity tablist to tokens. Exact current code:
```tsx
      <div
        role="tablist"
        aria-label="Wallet views"
        className="mb-4 flex w-fit gap-1 rounded-xl border border-[#263454] bg-[#0b1326] p-1"
      >
```
becomes `className="mb-4 flex w-fit gap-1 rounded-xl border border-panel-border bg-panel-surface p-1"`. And the tab button:
```tsx
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8daeff] ${
              assetsTab === tab
                ? 'bg-[#1a2948] text-white'
                : 'text-[#c8d0e8] hover:bg-[#14213b] hover:text-white'
            }`}
```
becomes: focus outline `focus-visible:outline-panel-accent`; active tab `bg-panel-active text-panel-text`; inactive tab `text-panel-text-soft hover:bg-panel-hover hover:text-panel-text`. Keep the role/aria/keyboard handler exactly as it is — the hand-rolled tablist already matches the §1.2 Tabs geometry and carries the tested arrow/Home/End navigation, so it is kept and re-skinned, not replaced with the Tabs component.

EDIT 2 — Replace the bare "Hide zero balances" checkbox with an `aria-pressed` Button/chip (spec §6). Exact current code:
```tsx
              <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={(event) => setHideZero(event.target.checked)}
                />
                Hide zero balances
              </label>
```
Replace with a `Button` (already imported) with `type="button"`, `aria-pressed={hideZero}`, `onClick={() => setHideZero((current) => !current)}`, `variant={hideZero ? 'default' : 'outline'}`, `className="h-11 shrink-0 rounded-[22px] px-3 text-sm font-medium"` (44px high, 12px horizontal padding, 22px radius, 14px/500 — spec §6), labelled "Hide zero balances". Keep the surrounding flex row. Also change the "Assets" heading in that same row from `className="text-lg font-bold text-white"` to `className="text-lg font-semibold text-panel-text"`. `hideZero` state and the `AssetRows hideZero={hideZero}` prop stay exactly as they are.

EDIT 3 — Re-skin the Activity panel to tokens and fix the empty-history copy. Exact current fragments:
(a) `<ul className="divide-y divide-[#263454] overflow-hidden rounded-xl border border-[#263454] bg-[#0b1326]">` becomes `divide-panel-border ... border-panel-border bg-panel-surface`.
(b) Row link: `className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#14213b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#8daeff]"` becomes hover `hover:bg-panel-hover`, outline `focus-visible:outline-panel-accent`, rest unchanged.
(c) Direction line `text-white` stays as `text-panel-text`; the symbol suffix `text-[#c8d0e8]` becomes `text-panel-text-soft`; the date line `text-xs text-[#a5b2d3]` becomes `text-xs text-panel-text-muted`; the amount `text-sm font-semibold text-white` becomes `text-sm font-semibold text-panel-text`.
(d) Loading skeleton: `<Skeleton className="h-20 w-full rounded-xl bg-[#14213b]" />` becomes `<Skeleton className="h-20 w-full rounded-xl" />` (the Skeleton's own token background applies).
(e) Empty history: `<p className="rounded-xl border border-[#263454] bg-[#0b1326] p-4 text-sm text-[#c8d0e8]">No transactions yet</p>` becomes `<p className="rounded-xl border border-panel-border bg-panel-surface p-4 text-sm text-panel-text-soft">No activity yet</p>` — spec §5 empty-history copy.
(f) History-unavailable box: `<div key={`history-unavailable:${chain}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#263454] bg-[#0b1326] px-4 py-3">` becomes border `border-panel-border`, bg `bg-panel-surface`; its text `className="text-sm text-[#c8d0e8]"` becomes `text-sm text-panel-text-soft`; its Retry button
```tsx
                      <Button
                        type="button"
                        onClick={() => void refreshHistory()}
                        className="shrink-0 rounded-lg border border-[#334767] bg-[#1a2948] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#223658]"
                      >
                        Retry
                      </Button>
```
becomes a plain outline Button with a 44px target:
```tsx
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void refreshHistory()}
                        className="h-11 shrink-0"
                      >
                        Retry
                      </Button>
```
Keep the per-chain Retry behaviour (it refreshes history; the per-chain scoping is unchanged).

Acceptance: no `#` hex, no `white/`, no `slate-*` remain in the returned blocks; the checkbox is gone; the chip has `aria-pressed`; empty history reads exactly "No activity yet"; keyboard tab navigation code untouched; `tsc`-clean.

EDIT 4 — Wrap the dashboard token rows in a light Card (spec §5 "--card for rows" and §6 "Card containing native rows"; the rows themselves use foreground/muted tokens, which are only readable on a light surface). Exact current code:
```tsx
            <AssetRows hideZero={hideZero} />
```
Replace with:
```tsx
            <Card className="mt-4">
              <AssetRows hideZero={hideZero} />
            </Card>
```
Add the import at the top of the file: `import { Card } from '../ui/components/card';` (dashboard.tsx does not import Card yet). The Card root carries its own rounded-xl border and background; no extra padding class — the list Card has no padding outside rows (spec §6). Do NOT wrap the Activity panel in a Card — only the Tokens rows.

Return ONLY the four edits, numbered 1-4, each with the exact old text quoted and the replacement in its own ```tsx fenced block. No explanation, no other changes.
