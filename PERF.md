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
| (none yet) | — | — | No performance attempts have been recorded under this ledger. The first attempt must be logged here, even if it is reverted. |

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
| Total JS in `dist/assets` | 3,978,773 bytes (2026-11-22, adopt-proper 67c48e2; branch build 4,050,102, inside the ratchet) | ≤ 4,177,711 bytes (today + ~5%) |
| Largest single JS chunk (`boundary-*.js`, the WASM engine chunk) | 2,901,695 bytes | ≤ 3,050,000 bytes (today + ~5%) |
| Total CSS in `dist/assets` | 432,288 bytes | recorded, not yet enforced |
| Total `dist/` | 32,665,605 bytes (includes the WASM binary and fonts) | recorded, not yet enforced |

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
