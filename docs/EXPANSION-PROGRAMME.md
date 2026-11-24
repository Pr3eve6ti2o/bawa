# Bawa expansion programme — record

Date: 2026-11-24. Owner order 2026-11-24 ~17:14 IST: expand Bawa to at least
80 chains (ticker, icon, RPC, explorer, live price feed), fix Solana sending
from official repos, add the FuckCaptcha import (Lane F) and the captcha merge
(Lane E), and run a smoothness/performance pass. Owner go-ahead 2026-11-24
~19:38 IST ("Yes, both") resumed the FuckCaptcha import and the smoothness
pass. All lane work was done by Sol 6.1 (gpt-6.1-sol) with max reasoning on
gray-pinee via the API 2 runner (cap 32,000), except the two merge lanes
(merge-main and merge), which were hands-on Muse, 0 Sol calls.

## Lanes

| Lane | Branch | Commit(s) | What it did | Where it landed |
|---|---|---|---|---|
| B — diagrams redraw | `panel-rebuild/expansion-lane-b` | `460b8f9` | Redrew `architecture.svg` + `explainer.svg` (purpose-first, honest limits, planned outputs) and placed them under H1 in the README; 22-chain banner at the time | Merged into `panel-rebuild/expansion` as `738c666`; fast-forwarded to `panel-rebuild/token-gaps` `6c93e66` |
| E — captcha merge | — | `0095d82` | Captcha guidance merged into the guide | Cherry-picked to `main` as `b579f3b` + README fix `6a5dae4` by the merge-main lane; `main` `7f9d364` |
| F — FuckCaptcha import | — | `e751b87` | FuckCaptcha (referred to as @fcukcaptcha) by @vsmutok, CC0-1.0, 39 field guides | Imported to `main` as `e751b87` by the merge-main lane; `main` `7f9d364` |
| SOL — Solana send fix | `panel-rebuild/expansion-lane-sol` | `192e53b` | @solana/web3.js 1.99.0 + @solana/spl-token 0.4.15, hand-built SPL instructions, offline signing only; native SOL + SPL USDC sign and verify in the browser | Merged into `panel-rebuild/expansion` as `ed69da4`; fast-forwarded to `panel-rebuild/token-gaps` `6c93e66` |
| 80-DATA — chain data | `panel-rebuild/expansion-lane-80data` | `70b3f7a` | Verified data for 62 new chains (22 → 84): tickers, icons, RPCs (124 endpoints verified live), explorers, price feeds | Cherry-picked into the 80-APP branch (`70b3f7a`); NOT merged separately |
| 80-APP — 84 chains wired | `panel-rebuild/expansion-lane-80app` | `bdc3332` | 84 chains wired into the app: adapters, prices, icons, explorers, dashboard curation (still 43 rows), docs + diagrams to 84 | Merged into `panel-rebuild/expansion` as `a0a94e6` (+ merge fixes `b7bb21c`, `9068cec`); fast-forwarded to `panel-rebuild/token-gaps` `6c93e66` |
| PERF — smoothness pass | `panel-rebuild/expansion-lane-perf` | `47eeedc` | Boot adapter-chunk guard, latin-only font subsets, provider-update batching | Merged into `panel-rebuild/expansion` as `744c7f3`; fast-forwarded to `panel-rebuild/token-gaps` `6c93e66` |
| merge-main | `panel-rebuild/expansion-merge-main` | — | Lanes E and F onto `main` | `main` `7f9d364` |
| merge (this lane) | `panel-rebuild/expansion` | `738c666`, `ed69da4`, `a0a94e6`, `744c7f3`, `6c93e66` | Merged B, SOL, 80-APP, PERF into expansion; fixed the watch-only picker (84 chains), the second SOL reason string, and the SOL address-length flake; updated the marketing programme record (E/F landed) | `panel-rebuild/expansion` `6c93e66` and `panel-rebuild/token-gaps` `6c93e66` |

## Counts — merged tree (final, `6c93e66`)

- Chains: **84** (22 enabled by default; 60 EVM chains, 59 of them 0x). Dashboard
  stays at **43 rows** (22 natives + 21 tokens), per the owner's 2026-11-23 decision.
- vitest: **2,154 passed / 5 skipped, 96 files** (base 8806e4a: 1,952 / 94;
  after SOL: 1,967 / 94).
- tsc 0, build 0 (`dist/assets/index-a5CVylQ2.js`), eslint 0.
- npm audit: **FAIL — 9 vulnerabilities (6 moderate, 3 high)** from the new
  Solana dependency tree (bigint-buffer, stream-json, uuid). `npm audit fix
  --force` would install breaking majors (spl-token 0.1.8, web3.js 3.2.1) and
  was NOT attempted. Owner decision needed.
- Bundle: total JS **4,474,784** vs the 4,177,711 budget — **over by 297,073
  (~7.1%)**; largest chunk 2,905,273 vs the 3,050,000 budget — PASS.
  `CONSTRAINTS.md` was not re-baselined and the gate was not weakened.
- Cold load (Slow 4G, same harness as PERF): **842,924 bytes**, FCP 3,976 ms,
  settle 5,103 ms (390 px); 842,924 bytes, FCP 4,008 ms, settle 5,124 ms
  (1440 px). Baseline (8806e4a): 1,398,217 bytes / 8.3 s settle. Byte bar
  (1,369,955) **beaten** on the merged 84-chain tree.
- Wallet-ready polling: dashboard 75 s, 3 requests / 4,247 bytes, 101
  mutation records in 4 batches; boot reload 30 s, 110 records in 5 batches.
  Batching holds on the 84-chain tree.
- SOL + SPL: native SOL and SPL USDC review and sign verified in CDP
  (mocked balances only — the flow honestly refuses unfundable sends with a
  real zero balance). Both transactions signed offline only, `verifySignatures()
  === true`, no broadcast attempted.
- Diagrams: both SVGs redrawn at 84 chains, rendered and viewed by eye,
  clean. README counts say 84.

## Final remote tips (verified by fresh ls-remote 2026-11-24)

- `main` — `7f9d364af520ba51e071fa16611fb4d6e2cefdeb` (Lanes E + F; untouched by
  this lane)
- `panel-rebuild/token-gaps` — `6c93e662dba3898fa8db5f0ea2a17a509f542c05`
- `panel-rebuild/expansion` — `6c93e662dba3898fa8db5f0ea2a17a509f542c05`

Live demo: `https://pr3eve6ti2o.github.io/bawa/` — still serves the previous
token-gaps build until republished from the new tip (republish was not part of
this programme lane; follow-up).

## Open items (for the owner)

1. Bundle budget: the merged tree is 297,073 bytes over the 4,177,711 budget.
   Re-baseline or accept — not decided here.
2. npm audit: 9 vulnerabilities from the Solana dependency tree. Accept, or
   authorise a dependency upgrade + re-verification of SOL/SPL signing.
3. GitHub Pages republish from `6c93e66` so the durable link serves the new
   build.
4. The marketing programme record's Lane B rows still say "BLOCKED, no
   commit" — B landed on expansion/token-gaps, not main; update by whoever
   owns that doc.
5. `docs/sample-requests.md:18`'s send list ("offline signing for BTC, ETH,
   TRX, and TON") is stale re SOL + 60 EVM chains (only the count was fixed
   in the merge).
6. E2E Playwright suite not run on the merged tree.
7. Live camera scan still unverified — needs the owner's phone.
8. PNG share/download still draws the old QR card layout; SOL SPL sending
   works in the app but the PNG port is separate. Token balances still load
   only via the dashboard (a direct deep-link or fresh reload on /send shows
   "balance not loaded yet" until the dashboard is visited).

## Reports

- `MERGE-REPORT.md` (merge lane, full detail)
- `MERGE-MAIN-REPORT.md` (merge-main lane)
- `LANE-B-REPORT.md`, `LANE-SOL-REPORT.md`, `LANE-80APP-REPORT.md`,
  `LANE-PERF-REPORT.md` (lane reports)
- Evidence: `gates-m*.log`, `build-final.log`, `lane-perf-*.log`,
  `lane-perf-cdp/merged-*`, `push-merge.log`, `push-token-gaps.log`
