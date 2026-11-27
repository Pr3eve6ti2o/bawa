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
| 2026-11-24 | Lane PERF (expansion programme), attempt 1: boot-refresh guard, storage-based variant - skip the boot refresh when no persisted vault addresses and no stored xpubs are in state | Vitest: 1 failed (wallet-context-lane-g.test, "starts at loading when a stored xpub may yield an address"). | Reverted: the guard read the wrong source. A stored xpub that fails validation never becomes an in-state wallet, yet the initial state still starts that chain at 'loading' - and the persistence effect (same hydrated commit, declared first) overwrites the stored xpubs with the in-state ones (all null for the invalid key) before the guard reads storage, so the guard saw "nothing stored" and skipped the refresh that resolves the chain to 'unavailable'. Do not re-try a storage-based boot guard without accounting for that overwrite. |
| 2026-11-24 | Lane PERF (expansion programme), attempt 2: (1) boot-refresh guard, state-based - skip only when no chain is 'loading' or stale-cached; (2) refreshBalances/refreshHistory no-fetch early return - resolve all chains without loading the ~294 KB adapters chunk when no chain has a verified capability plus a real address; (3) batch refresher writes - one update for start states + immediate resolutions, one for all fetched results (refreshBalances, refreshHistory, refreshTokenBalances incl. devnet branch); (4) Noto Sans SC latin-only font imports + drop unused Noto Sans variable import | Same harness as Lane J (fresh Chromium context, 3 runs per condition, medians; CDP Slow 4G 1.6 Mbps/750 Kbps/150 ms RTT; static serve, no gzip). Cold load, no-wallet: total bytes 1,398,217 → 801,140 (-43%); FCP mobile-390 Slow 4G 5,248 → 3,808 ms, desktop-1440 5,248 → 3,812 ms; heading 5,292 → 3,860 ms / 5,369 → 3,858 ms; settled (networkidle) 8,298 → 4,931 ms / 8,297 → 4,932 ms; resources 27 → 26; adapters chunk no longer fetched on cold load; CSS 368,397 → 63,673 bytes (-83%). Unthrottled FCP 112 → 112 ms / 116 → 116 ms, settle 625 → 615 ms / 627 → 616 ms. Boot churn (wallet-ready reload, 30 s): DOM mutation batches 32 → 5 (-84%), records 151 → 146. Steady-state 75 s dashboard: batches 4 → 3, records 49 → 55 (price tick only; polling itself untouched). | Landed. NOTE on the bar: the 1,369,955-byte bar is beaten (801,140), but the 3.8 s settle bar is NOT reproduced by this harness even on the unmodified base (8.3 s) - Lane J's time figures come from a harness whose throttle/method details are not recorded in this file, so same-harness before/after is the valid comparison here. Trade-off recorded: CJK glyphs now fall back to system-ui instead of the Noto Sans SC webfont (latin subsets kept); revert by restoring the three full-weight imports in globals.css. Total JS ratchet: base 8806e4a was ALREADY 4,213,894 (over the 4,177,711 budget before this lane); this lane adds 1,756 (4,215,650). The budget was not raised; the pre-existing breach is a finding for the merge lane / owner. |
| 2026-11-25 | Lane C (WalletConnect, "install all usable" programme): `@walletconnect/sign-client` + `@walletconnect/utils` 2.21.0 (Apache-2.0), lazy-loaded via dynamic import; `/walletconnect` screen + session approve/reject + message signing only | `npm run build` in `apps/web` after `npm ci`. Base token-gaps `7fea3e4`: total JS 4,180,185, largest chunk 2,905,015. This lane: total JS 4,577,447 (+397,262); lazy `walletconnect-client` chunk 348,194; route chunk 17,372; `hashTypedData` 15,929; `secp256k1` 30,367 (imported only by the lazy chunk). Dist total excluding the lazy chunk 4,229,253; excluding all four WalletConnect-only chunks 4,165,585. Browser-measured (Playwright network log, `vite preview`): home cold load fetches 21 JS files, 564,002 bytes, none WalletConnect; the lazy chunk loads only on the WalletConnect screen with a projectId configured. | Measurement only, no trim attempted: the lazy chunk is the cost and it is not on the cold-load path. The CI bundle gate (sums all of `dist/assets/*.js`) fails as written at 4,577,447 vs the 4,185,000 budget; `ci.yml` was NOT edited — the gate scope is the coordinator/owner's call. See DECISIONS.md §26. |
| 2026-11-26 | Guide-update pass: merged tree on token-gaps `7a170f4` (owner-ordered re-baseline to 4,650,000) | Fresh `npm run build` in `apps/web` (Node 22.23.4): total JS **4,648,952**, largest chunk **2,906,541** — passes the 4,650,000 budget by **1,048 bytes**. Lazy chunks in the total: `walletconnect-client` 348,194, `jsQR` 129,986, `backup-shares` route chunk 10,085. Home cold load fetches 564,002 B, no WalletConnect. | Landed (measurement + re-baseline record): the gate passes as written at 4,650,000. Headroom is 1,048 bytes (0.02%) — any addition over ~1 KB is a budget decision. Whether the gate should exclude lazy chunks is an open owner question (`docs/CREATE-THIS-SPEC.md` §0.2). |

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
| Total JS in `dist/assets` | 4,457,308 bytes (2026-11-27, merged tree on token-gaps `f1f0e6c`; fresh build, Node 22; largest chunk 2,906,489) | ≤ 6,000,000 bytes — PASSES by 1,542,692 bytes (owner-ordered re-baseline `f5a5f19`, 2026-11-26) |
| Largest single JS chunk (`boundary-*.js`, the WASM engine chunk) | 2,906,489 bytes (2026-11-27, merged tree on token-gaps `8a1d681`; was 2,906,541 on `7a170f4`, 2,905,067 on the Lane C tree, 2,905,015 on base `7fea3e4`) | ≤ 3,050,000 bytes (today + ~5%) |
| Total CSS in `dist/assets` | 63,673 bytes (2026-11-24, Lane PERF: Noto Sans SC latin-only subsets; was 368,397 on base 8806e4a and 432,288 on d47d282) | recorded, not yet enforced |
| Total `dist/` | 15,939,512 bytes (2026-11-24, Lane PERF; was 33,222,901 on base 8806e4a — the drop is the ~17 MB of unneeded Noto Sans SC subset font files no longer bundled, plus the WASM binary) | recorded, not yet enforced |

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
