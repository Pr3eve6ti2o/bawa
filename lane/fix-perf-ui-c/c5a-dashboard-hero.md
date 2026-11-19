Make three targeted edits to apps/web/src/screens/dashboard.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only. Change NO balance/history logic, NO hero-state derivation, NO copy except the new button label given below. Spec is UI-UX-REFERENCE.md §5 (Rabby summary-first, cache-preserving balance view).

EDIT 1 — Balance hero becomes a dark hero card. Exact current code:
```tsx
      <div className="space-y-1 pt-1">
        <p className="text-[13px] font-medium text-[#aab5d1]">Portfolio balance</p>
        <p className="text-2xl font-bold tracking-tight text-white">{hero.text}</p>
        {hero.noPriceFeed && (
          <p className="text-[13px] text-[#aab5d1]">
            No price feed connected — portfolio total unavailable. Balances below
            are exact native amounts from the mainnet adapters.
          </p>
        )}
        <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
          {hero.retry ? 'Retry' : 'Refresh balances'}
        </Button>
      </div>
```
Replace with a hero Card: container `rounded-2xl bg-panel-surface-raised p-5` (radius 16px, padding 20px — spec proposal), label `text-[13px] leading-[18px] font-medium text-panel-text-muted`, main value `text-display-lg font-bold tracking-tight text-panel-text` (40px/48px, the display-lg token), explanation `text-xs leading-[18px] text-panel-text-muted`, same words. Keep the Refresh/Retry Button (outline variant). Add the refreshing state: while `heroLoading` is true the Button is `disabled={heroLoading}` and reads "Refreshing…" (spec: show "Refreshing" and prevent duplicate requests); otherwise it reads 'Retry' when `hero.retry` is true, else 'Refresh balances'. `heroLoading` already exists in this file. Keep all hero logic (`lastHeroRef`, `nextHero`) untouched.

EDIT 2 — Action row: labels 11px to 12px, circles to tokens. Exact current code:
```tsx
            className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#263451] text-[#b4aaff] transition-colors hover:bg-[#2a3651]">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold text-[#edf0fc]">{label}</span>
```
Replace with: link focus ring `focus-visible:ring-panel-accent`; circle `bg-panel-icon-tile text-panel-accent transition-colors hover:bg-panel-action-hover` (56px circles, 24px icons stay); label `text-xs leading-4 font-medium text-panel-text` (12px/16px weight 500 — spec proposal). Keep the three actions, routes and icons.

EDIT 3 — REMOVE the three home-screen lock/no-vault banners at the bottom of the screen (spec §5/§10: no-vault is the Welcome screen, locked is the `/lock` route; do not replace them with another banner or an app-wide gate). Exact current code — delete this whole block:
```tsx
      {locked ? (
        <div className="space-y-4 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Locked — derived addresses are hidden until you unlock.
          </p>
          <Button type="button" onClick={() => void unlock()}>
            Unlock
          </Button>
        </div>
      ) : vaultState === 'locked' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Vault locked — your vault addresses are hidden until you unlock.
          </p>
          <Link
            to="/lock"
            className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
          >
            Unlock
          </Link>
        </div>
      ) : vaultState === 'no-vault' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            No wallet yet — create a wallet or import one to see its balances.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/create-wallet"
              className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
            >
              Create wallet
            </Link>
            <Link
              to="/import-wallet"
              className="inline-block rounded-full border border-white/10 bg-[#263451] px-4 py-2 text-sm font-semibold text-[#eff2fc]"
            >
              Import wallet
            </Link>
          </div>
        </div>
      ) : null}
```
After deleting it, also remove `locked`, `unlock` and `vaultState` from the `useWallet()` destructure at the top of `DashboardScreen` IF they become unused — check: `vaultState` is used nowhere else in the file, `locked`/`unlock` nowhere else. Remove exactly those three names from the destructure and keep the rest. `Link` stays imported (activity rows use it). `Button` stays imported (hero + Retry use it).

Acceptance: hero value uses `text-display-lg`; no `#` hex, no `white/`, no `slate-*`, no gradient classes remain in the returned blocks or the deleted block's neighbourhood; the banners and their Unlock/Create/Import controls are gone; `tsc`-clean (no unused imports or variables).

Return ONLY the three edits, numbered 1-3, each with the exact old text quoted and the replacement in its own ```tsx fenced block (edit 3's replacement is empty — say so). No explanation, no other changes.
