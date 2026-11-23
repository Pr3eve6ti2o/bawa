# Performance — attempt ledger and bundle-size ratchet

This file is the performance attempt ledger and the bundle-size record
for the web wallet (`apps/web`). It exists so a dead idea is not re-run,
and so a bundle regression is a number, not an argument.

## Attempt ledger

Log every performance attempt here, including reverted ones: what was
tried, what was measured, what happened. An attempt with no measurement
is not an attempt.

| Date | Attempt | Measured before → after | Outcome |
| --- | --- | --- | --- |
| 2026-11-23 | Lane J, attempt 1: lazy engine import (dynamic `loadCore` in `create-wallet.tsx` and `wallet/core.ts`; coin-type key table moved to leaf module `engine/coin-type-keys.ts`) + warm-up gated on the `load` event and on `navigator.connection` (skip on slow-2g/2g/3g or `saveData`) | Cold load, `/bawa/`, fresh Chromium context, 3 attempts per condition, medians. FCP: mobile-390 Slow 4G 3,724 → 2,264 ms; desktop-1440 Slow 4G 3,720 → 2,260 ms; unthrottled 288 → 192 ms / 304 → 184 ms. Heading visible: Slow 4G 3,989 → 2,516 ms / 3,987 → 2,486 ms. Settled (networkidle): Slow 4G 55,095 → 69,009 ms / 55,450 → 68,944 ms — WORSE. | Partial, reverted in part: the first-paint win is real (the 2.9 MB engine chunk left the modulepreload graph) and is kept. The settle regression is real too: the WASM was still fetched on every cold load (CDP network emulation does not change `navigator.connection`, so the connection gate never fired in measurement) and the later start finished later. The gated warm-up was removed in attempt 2; the lazy import was kept. |
| 2026-11-23 | Lane J, attempt 2: idle warm-up removed entirely (`main.tsx`); engine loads only on demand through `loadCore()` (create-screen mount preload + Generate + derive paths share one cached download) | Same harness, medians. FCP: mobile-390 unthrottled 288 → 192 ms, Slow 4G 3,724 → 2,248 ms; desktop-1440 unthrottled 304 → 168 ms, Slow 4G 3,720 → 2,252 ms. Heading visible: 598 → 192 ms, 3,989 → 2,485 ms; 596 → 174 ms, 3,987 → 2,481 ms. Settled: 908 → 710 ms, 55,095 → 3,836 ms; 916 → 695 ms, 55,450 → 3,841 ms. Cold-load bytes 14,698,005 → 1,369,955 (-91%); resources 35 → 32; WASM no longer fetched on cold load. | Landed: the complete fix. Trade-off recorded: Generate on the create screen now pays the engine download on first use on a slow connection (measured 52.4 s on Slow 4G without warm-up); it keeps its honest "Loading wallet engine..." state, and the create-screen mount preload still warms the engine when the user heads toward creation. Do not re-add an idle warm-up without a cold-load measurement proving the settle cost is gone. |

## Bundle-size ratchet

Measured 2026-11-20 on `panel-rebuild/repo-study` at `0fd3a2e`
(`npm run build` in `apps/web`, after `npm ci`): 3,864,173 bytes total
(baseline 3,846,651). Re-measured 2026-11-22 on `adopt-proper` at
`67c48e2` (two independent builds, byte-identical): 3,978,773 bytes
total; largest chunk 2,901,695 bytes. The 3,846,651 baseline was
measured on the repo-study tree, not the adopt-proper base the
token-discovery branch builds on — the budget below is the +~5%
ratchet on the corrected 67c48e2 baseline, not a raised budget.
The +5% rule is unchanged.

| Metric | Measured | Budget (enforced in CI) |
| --- | --- | --- |
| Total JS in `dist/assets` | 4,163,926 bytes (2026-11-23, finish-product Lane J tree on token-gaps d47d282; inside the ratchet — the 2026-11-22 figure was 3,978,773 on adopt-proper 67c48e2, a different base) | ≤ 4,177,711 bytes (today + ~5%) |
| Largest single JS chunk (`boundary-*.js`, the WASM engine chunk) | 2,901,819 bytes | ≤ 3,050,000 bytes (today + ~5%) |
| Total CSS in `dist/assets` | 432,288 bytes | recorded, not yet enforced |
| Total `dist/` | 33,149,613 bytes (includes the WASM binary and fonts) | recorded, not yet enforced |

Rules:

- The budgets above are ratchets: when the measured size improves,
  lower the budget; when it grows, that is the finding. Do not raise a
  budget to make a change pass — route it through the exceptions table
  in `CONSTRAINTS.md` with an owner and an expiry.
- The `boundary` chunk is the Trust Wallet Core WASM engine. It
  dominates the bundle by design (the engine is ~2.9 MB of JS glue
  around a ~10.4 MB WASM binary). Vite warns that chunks are larger
  than 500 kB after minification; that warning is expected for this
  chunk and is not a failure. Code-splitting the engine chunk further
  is a separate decision, not a drive-by.
- The gate sums `dist/assets/*.js` after the build. It does not measure
  gzip, fonts, or the WASM binary itself; those are recorded here for
  context.

## How the gate is measured

CI runs `npm run build` in `apps/web`, then sums the byte sizes of
`dist/assets/*.js` and takes the largest single chunk, and fails the
build if either budget is exceeded. The same numbers can be reproduced
locally:

```sh
cd apps/web && npm run build
find dist/assets -name '*.js' -type f -exec stat -c %s {} + | awk '{s+=$1} END {print s}'
find dist/assets -name '*.js' -type f -exec stat -c %s {} + | sort -n | tail -1
```
