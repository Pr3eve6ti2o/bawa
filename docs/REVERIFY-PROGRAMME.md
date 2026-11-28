# Reverify + Professional Polish programme (2026-11-23)

Owner order 2026-11-23 ~18:14 IST: five lanes, reported per lane.
Coordinator `3e052fbd`, merge lane hands-on Muse, 0 Sol calls,
0 AgentRouter calls, 0 runner invocations. Branch
`panel-rebuild/reverify-pro`, branched from token-gaps `b089c28`
(the Round 2 tip). Fast-forwarded into `panel-rebuild/token-gaps`
to `ccb8195` on 2026-11-23 (no merge commit: the token-gaps tip was
the reverify-pro base, so the merge is a fast-forward). No code
merged into `panel-rebuild/adopt-proper`
or `main` — those stay untouched for code. Doc-only updates from
this programme were pushed to `main` and every active remote branch
the same day, per the owner's order.

The brief for this programme was to reverify every owner order from
2026-11-22 through 2026-11-23 ~18:14 IST against the code, fix
genuinely missed items in place, put real screenshots of the wallet
in the README, polish the repo so it reads like a professional
project, check the architecture for duplicates and dead code, and
close the skills gap the lanes exposed. The parallel Deep Audit +
Devnet E2E programme (owner order 2026-11-23 ~18:10 IST) ran at the
same time on `panel-rebuild/deep-audit-devnet`; this programme did
not duplicate its CDP re-verification — it verified only what this
programme changed.

## What each lane did

| Lane | Work | Lane commit | Merged as |
|---|---|---|---|
| 1 | Reverify checklist + 3 missed-item fixes | `0cb983d` | `95d4bbb` |
| 2 | README wallet images (4 real screenshots) | `a2c1c0f` | `7fc0a93` |
| 3 | Professional polish (README, docs, links, templates) | `73863c0` + follow-up `2611056` | `5898d05` (follow-up already applied in the merge — see Merge notes) |
| 4 | Architecture, duplicates, dead code | `d2417a0` | `d8f431a` |
| 5 | Skills gap (no repo commit) | — | — |

### Lane 1 — Reverify checklist + missed-item fixes

`docs/REVERIFY-CHECKLIST.md` (268 lines, 39 rows): every owner order
from 2026-11-22 through 2026-11-23 ~18:14 IST, reconstructed from
the daily logs, the programme records, `docs/DECISIONS.md` and the
token-gaps log, each with a verdict and evidence. 28 implemented, 3
partially implemented, 2 missed and fixed by this lane, 2 in progress
in the parallel programme, 4 standing rules complied with. The 12
open follow-ups (O-01–O-12) are listed in the checklist and carried
forward in "Still open" below.

Three missed items, all fixed in place, each RED-first (a failing
test before the fix, passing after):

- **F-1 — the 40 px Receive fix was missing from the token-gaps
  tree.** The status `<p role="status">` under the Copy/Share buttons
  rendered unconditionally again; the UI/UX Receive rework had
  reintroduced the empty line the owner ordered kept on 2026-11-23
  ~14:17. Now conditional on `copyStatus !== ''`
  (`apps/web/src/screens/receive.tsx`). The 14:17 decision note
  saying the fix was "already in the token-gaps tree" was wrong for
  token-gaps; the checklist corrects it.
- **F-2 — the import path had no "Continue to your send" button.**
  Round 2 item 2 fixed the shared-link deep-link failure for create
  only; the import flow never got the button. Added to the "Wallet
  restored" step, mirroring create exactly
  (`apps/web/src/screens/import-wallet.tsx`). The same-phrase "add as
  Account N" path lands on the wallets list, where the stored link
  still resumes through the Send tab — noted, not rebuilt.
- **F-3 — the item-14 cannot-add chain list was never recorded.**
  `docs/UI-UX-FIXES-PROGRAMME.md` now records the 9 added chains with
  chainId and both verified keyless endpoints, plus the bar and the
  exclusion reasons. Stale "40 px question awaits the owner's pick"
  bullets corrected in the programme docs and `docs/DECISIONS.md`
  §§10–11. No per-chain enumeration of the other 146 Core chains was
  preserved anywhere, and none is invented; the record says so
  plainly.

Lane 1 gates: focused tests 47 passed; `tsc` 0; full vitest 1722
passed / 5 skipped (baseline 1718 — the delta is exactly the 4 new
tests); `npm run build` 0; lint 0; audit 0; root `npm test` 0.
Skills used (read in full on the VM): `test-driven-development`,
`code-review-and-quality`.

### Lane 2 — README wallet images

Four real screenshots under `docs/images/`, captured in headless
Chromium from a fresh build of the branch, each from its own fresh
disposable unfunded test wallet (zero balances, live prices), plus a
`### Screenshots` section under `## The example web wallet` in the
README:

- `web-wallet-dashboard-desktop.png` (1440 px) — dashboard, live
  prices ($61,114/BTC, $1,715.54/ETH at capture).
- `web-wallet-dashboard-mobile.png` (390 px) — dashboard, marked
  "$0.00 (Partial)" because public balance and price feeds were
  rate-limited during capture; the README section says so explicitly.
- `web-wallet-receive-desktop.png` (1440 px) — Receive step 3, QR
  card, Bitcoin native.
- `web-wallet-receive-mobile.png` (390 px) — Receive step 3, QR card.

All four PNGs were viewed by the lane before committing. No layout
defect, no broken render, no fake balance or price in any shot. The
two Receive addresses are disposable test addresses of unfunded
wallets whose phrases were never recorded. The mobile dashboard
re-shoot attempted by the merge lane (one attempt, see CDP below)
still showed "(Partial)" — the shared VM egress was still
rate-limited — so Lane 2's shot stays, as the README already states.

### Lane 3 — Professional polish

README structure (CI badge and clone branch retargeted from
`adopt-proper` to `token-gaps`, Help links to GitHub Issues with the
new bug report template, no "template" wording for the wallet
anywhere), `docs/index.md` (stale vitest figures updated to the
first-hand 1718 run, six missing navigation links added),
`WALLET_BUILDER.md` capability block regenerated from the current
`chains.ts` (22 rows, balance verified for all 18 additional chains),
`docs/12-chain-registry-and-assets/README.md` (13-chain counts and
labels corrected to 22, derivation table extended to 22 rows),
`docs/adr/0007-price-feed-provider.md` (second dated amendment: 15
unique CoinGecko ids for 22 chains), `docs/inventory.md` (three
missing programme docs added; drift-check inventory leg green),
`.github/ISSUE_TEMPLATE/bug_report.md` and
`.github/PULL_REQUEST_TEMPLATE.md` (new, mirroring CONTRIBUTING.md),
and 4 external links fixed after verification (1 moved test path in
MAINNET-GUIDE.md, 3 moved Solana RPC doc links). Internal link check:
OK (155 files). External link check: 431 unique URLs, 376 OK, 54
flagged — 4 fixed, 11 verified alive (rate-limited or HEAD
artefacts), 39 deliberately not fixed (API roots, template URLs,
bot-guard 403s, placeholders, documented dead links, expired
tunnels), 1 skipped checker artefact. Full per-URL results in the
lane's linkcheck file on the VM.

Lane 3's own Screenshots section (first commit) was removed by its
follow-up commit: Lane 2 had already landed the canonical section
with different filenames, and keeping Lane 3's would have duplicated
it and referenced files that do not exist. Skills used (read in full
on the VM): `documentation-and-adrs`, `markdown-mermaid-writing`,
`writing-guidelines`.

### Lane 4 — Architecture, duplicates, dead code

35 files, +110/−1115 (net −1005 lines). Layering holds:
`scripts/check-wallet-cycles.mjs` reports OK (103 files, 350 edges
after the merge, 0 cycles, 0 layer violations). Three duplicate
groups consolidated (byte-identical before merging): `isRecord` (14
copies) and `ownValue` (3 copies) into new
`apps/web/src/wallet/guards.ts`; `ensureAdapters()` (defined twice,
so the ~3 MB adapter chunk could load twice) into new
`apps/web/src/state/ensure-adapters.ts` with one shared cache; the
`lastOkAt` vs `fetchedAtMs` naming split renamed to `fetchedAtMs`
at 13 sites. Twelve vendored token-ui files with zero importers
removed (967 lines) plus 3 dead exports (`AdapterStatus`,
`PRICE_PROVIDER_NAME`, `SendProgressStage`). Four unwired modules
flagged, not removed: `engine/destination.ts` (700 lines),
`wallet/adapters/confirmation.ts` (302 lines),
`wallet/evm-typed-data.ts` (121 lines), `wallet/secret-handoff.ts`
(54 lines) — tested, documented capabilities with no non-test
importer. The `send.ts`/`core.ts` split and the `wallet-refresh.ts`
re-wire were recorded as still open, not attempted (see "Still
open"). Six `@radix-ui/*` packages have no importer left after the
deletions; the merge lane's knip run adds `react-hook-form` to that
list (see Hygiene scan below). `package.json` was left alone:
removing dependencies is a separate change.

Lane 4 gates: baseline and after both 1718 passed / 5 skipped
(90 files) — identical, zero regressions; `tsc` 0; `eslint` 0;
`npm run build` 0; `npm audit` 0; root `npm test` 0. Skills used
(read in full on the VM): `dead-code-cleanup`,
`code-review-and-quality`.

### Lane 5 — Skills gap (no repo commit)

Audited the 1,408-skill library against lanes 1–4 and created three
skills in both skill dirs (`order-traceability-checklist`,
`cdp-visual-verification`, `repo-hygiene-scan`). Its tool-based scan
steps (`npx -y madge` / `ts-prune` / `knip` / `jscpd`) were written
but never executed in that lane (an exec result failed an
execution-risk check). The merge lane ran them against the merged
tree with explicit go-ahead — see "Hygiene scan" below. No repo
branch was touched by Lane 5.

## Merge notes (merge lane)

Cherry-pick order from the base `b089c28`: Lane 1 `0cb983d`
(clean, `95d4bbb`), Lane 2 `a2c1c0f` (clean, `7fc0a93`), Lane 3
`73863c0` (1 conflict), Lane 3 follow-up `2611056` (skipped —
already applied), Lane 4 `d2417a0` (clean, `d8f431a`). `tsc --noEmit`
0 and targeted vitest after every pick. Merged diff against the
base: 57 files, +705/−1180.

- **The one conflict (README.md, Lane 3 first commit):** Lane 3's
  `## Screenshots` section collided with Lane 2's canonical
  `### Screenshots` section in the same spot. Resolved by keeping
  Lane 2's section and dropping Lane 3's — the section Lane 3's own
  follow-up removes, referencing filenames that do not exist. Lane
  3's other README edits in the same commit (CI badge, clone branch,
  Help link) merged cleanly and are all in the tree.
- **The follow-up skip:** cherry-picking `2611056` conflicted
  because its entire content (deleting Lane 3's Screenshots section)
  was already in the tree from the conflict resolution above. It was
  skipped with `git cherry-pick --skip`; nothing was dropped — the
  change it carries is present in `5898d05`.
- **Spot-checks after the merge:** `docs/REVERIFY-CHECKLIST.md`
  present (268 lines); 4 images under `docs/images/` plus the single
  Screenshots section present; all Lane 3 polish files present;
  `wallet/guards.ts` and `state/ensure-adapters.ts` present; all 12
  vendored files absent. The cycle-check edge count moved 349 → 350
  after the merge (Lane 1's import-wallet change adds one import
  edge); cycles and violations stay 0.

## Gates — merged reverify-pro tree (merge lane, first-hand, 2026-11-23)

Run on the merged tree (commit `d8f431a` before the documentation
commit), Node 22.23.4, `apps/web` unless noted:

- `npx tsc --noEmit`: 0
- `npm run build`: 0 (palette audit passed, 29 approved literals)
- Full vitest: 90 files, **1722 passed / 5 skipped** (1727 total)
- `npm run lint`: 0
- `npm audit`: 0 vulnerabilities
- Root `npm test`: 0 (after `npm ci` in `tools/hdwallet-gen`;
  the repo root has no `package-lock.json`, so root `npm ci` is
  impossible — `npm ci` in `apps/web` and `tools/hdwallet-gen`
  instead, as in prior lanes)
- `node scripts/check-wallet-cycles.mjs`: OK (103 files, 350 edges,
  0 cycles, 0 layer violations)
- `python3 tools/check-links.py`: OK (156 files)

### The true vitest baseline

The untouched tip `b089c28` measures **90 files, 1718 passed /
5 skipped**, first-hand in the programme worktree before any
cherry-pick — and Lanes 1, 3 and 4 independently measured the same
1718 on the same tip. The Round 2 programme record says 89 files /
1697 passed / 5 skipped on the same tip. That figure does not
reproduce: four independent first-hand runs agree on 1718. The
difference (+1 file, +21 tests) predates this programme and its
cause was not established — no test file was added by any lane of
this programme except Lane 1's 4 new tests, which account exactly
for 1718 → 1722. The Round 2 figure is recorded here as stale, not
corrected in the Round 2 record itself. Nothing was waived: there
were no failures to waive.

## Hygiene scan — merged tree (merge lane, first-hand, 2026-11-23)

Skill `repo-hygiene-scan`, read in full on the VM. Scope
`apps/web/src`. Nothing was deleted in this scan; candidates are
listed for a separate in-place pass.

- **Scan 1 — cycles (madge):** `npx -y madge --circular
  --extensions ts,tsx src` — **no circular dependency found**
  (215 files processed). Confirms Lane 4 and the repo's own cycle
  script.
- **Scan 2 — dead code (ts-prune + knip):** ts-prune reports 117
  lines: 113 are "used in module" (exported but only used inside
  their own file — alive, over-exported, not dead) and 4 are
  genuinely unreferenced: the `default` exports of `vite.config.ts`
  and `vitest.config.ts` (framework entry points, false positives),
  `BalanceStatus` in `state/wallet-context.tsx:37` (a duplicate
  type definition — the same union is also defined in
  `wallet/balance-state.ts` and `state/wallet-refresh.ts` — used
  inside its own file), and `registerLookupHandler` in
  `wallet/tracker.ts:326` (zero references anywhere; Lane 4 already
  flagged it as a designed extension point, not deleted). Knip
  agrees: 4 unused files, all false positives
  (`scripts/generate-chains.mjs` is live through the DECISIONS.md
  gate reference, `scripts/wasm-integrity.d.mts` is a type
  declaration, 2 `__typetests__` files are tsc type tests); 8 unused
  dependencies — 7 `@radix-ui/*` (`react-avatar`, `react-popover`,
  `react-progress`, `react-radio-group`, `react-select`,
  `react-separator`, `react-toggle`) plus `react-hook-form`, all
  orphaned by Lane 4's deletions (the deleted `form.tsx` was the
  last `react-hook-form` importer); 35 unused exports and 24 unused
  exported types, mostly used-in-module or test-only.
- **Scan 3 — duplicates (jscpd):** `npx -y jscpd src --min-lines 5
  --min-tokens 50` — 449 clone groups, **78 with both sides in
  production code** (the rest are test files, which mirror
  production data by design and are not duplication). Largest
  production clusters: `wallet/adapters/btc.ts` vs `ltc.ts` (64
  lines, 457 tokens — the UTXO adapters are near-copies),
  `wallet/prices.ts` vs `token-prices.ts` (many groups up to 44
  lines — the two price modules share fetch and cache logic),
  `screens/asset-list.tsx` vs `dashboard.tsx` (60 lines),
  `engine/destination.ts` vs `wallet/devnet.ts` (25 + 32 + 18
  lines), `wallet/send.ts` (3 BTC pairs: UTXO validation, UTXO to
  signing-input mapping differing in one field, fee-result
  assembly), and `wallet/adapters/token-balances.ts` internal
  repeats. These are consolidation candidates for a future lane,
  not this one.

## CDP re-verification — merged tree (merge lane, first-hand, 2026-11-23)

Static serve of the merged `dist` (hash-verified: `index.html` md5
`2cf7b6f4de25c83efb85ee771b94ccb7`, main JS
`index-Co_iBr5E.js` md5 `884255af7b47b258b4e5eb44d1133cfc`, served
copies identical), headless Chromium on gray-pinee, fresh disposable
unfunded wallets. Script `verify.mjs`, screenshots viewed by eye.
**16 of 17 checks passed.**

- **Lane 1 F-1, live:** Receive step 3 shows no status `<p>`
  before any copy action (`p[role="status"]` count 0); after
  "Copy address" the line appears with "Address copied." Viewed in
  the screenshot.
- **Lane 1 F-2, live end to end:** opening
  `/send?chain=eth&to=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&amount=0.01`
  with no wallet stores the pending link (`bawa-pending-send-link`
  in sessionStorage); importing the phrase shows "Continue to your
  send" on the "Wallet restored" step (viewed in the screenshot);
  clicking it lands on `/send` with the recipient and amount
  prefilled. The imported wallet derived the same addresses as the
  created one (same phrase).
- **Lane 4 spot-checks, live:** dashboard renders at 390, 820,
  1440 and 1919 with no horizontal overflow anywhere; Send renders;
  the Add Token dialog opens from the dashboard; the watch-only
  import tab renders.
- **Mobile dashboard re-shoot (one attempt):** still "$0.00
  (Partial)" — CoinGecko 429s and TronGrid 403s in the console; the
  shared VM egress was still rate-limited. The desktop dashboard
  showed "(Partial)" in the same run. This is the app's honest
  degraded-network state, not a layout defect: layout, live prices
  where they loaded ($61,223/BTC, $1,722.08/ETH on mobile) and zero
  balances all render correctly. Lane 2's shot stays, as the README
  already states. No further retakes were attempted.
- Console errors across all runs are external-feed noise (CoinGecko
  rate-limit, TronGrid CORS/403, one CSP meta warning). No
  pageerrors, no app exceptions.

Not re-proven live by this programme: the review and sign steps
(CDP-unverified, vitest only), the live camera scan path (needs the
owner's phone), the E2E suite (environment-blocked items, see
"Still open").

## Branch state (2026-11-23, after the merge)

| Branch | SHA | State |
|---|---|---|
| `main` | `e64679e` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/adopt-proper` | `d0aa6ba` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/desktop-layout-v2` | `df6e54d` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/devnet-temp` | `bd4bdd4` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/token-discovery` | `81994e8` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/token-gaps` | `ccb8195` | Fast-forward of `reverify-pro` into token-gaps. Further work continues on top of token-gaps. |
| `panel-rebuild/reverify-pro` | `ccb8195` | Programme branch. Code complete; doc updates pushed here first. |
| `panel-rebuild/deep-audit-devnet` | — | Parallel programme. Not touched by this lane. |
| `gh-pages` | `ee63a13` | Pages site source. Not touched by this programme. |

This follow-up commit records the fast-forward (`ccb8195`) and the
doc-only update SHAs in the table above (same pattern as Round 2
item 10, commit `b089c28`).

## Preview / Pages pointers

- Durable preview: GitHub Pages — https://pr3eve6ti2o.github.io/bawa/
  — serves the saved adopt-proper-based build. It does **not**
  include this programme: the reverify work lives on
  `panel-rebuild/token-gaps` only. To preview the programme, check
  out `panel-rebuild/token-gaps` and run the web starter locally
  (`apps/web`: `npm ci`, `npm run dev`).
- The merge lane minted a hash-verified Pinggy tunnel for the merged
  tree (see the coordinator's report for the link). Free tunnels
  expire within about an hour and resolve IPv6-only; the owner's DNS
  cannot resolve them. Do not rely on a tunnel link as the durable
  preview.

## Still open

**Resolved since (2026-11-28, Lane A docs audit):** (1) the
SOL/LTC/DOGE history discrepancy is closed — the registry now
records history I&V for 17 chains including sol, doge and ltc
(`registry/capabilities.json`, v4); the `send.ts`/`core.ts` split
is done — marketing-fix Lane 2 created `wallet/signing-intent.ts`;
the `wallet-refresh.ts` re-wire is moot — fix-all Lane H deleted
`wallet-refresh.ts` (823 lines); the four unwired modules
(`engine/destination.ts`, `wallet/adapters/confirmation.ts`,
`wallet/evm-typed-data.ts`, `wallet/secret-handoff.ts`) were all
deleted by fix-all Lane H; the 7 orphaned `@radix-ui/*` packages
plus `react-hook-form` are gone (5 Radix packages remain: checkbox,
label, slot, switch, tabs); the E2E harness was fixed by deep-audit
Lane E; devnet Issues 5 and 6 are closed/fixed (deep-audit Lane B);
the Receive tagline was restored by fix-all Lane H; the README
mobile dashboard shot was re-shot clean (marketing-fix Lane 4);
GitHub Pages now serves the token-gaps build (`1a85258`), not the
saved `67c48e2` build. Still open: the reference-repo link, the
jscpd consolidation candidates, and the remaining O-01–O-12 items
not listed here (see `docs/REVERIFY-CHECKLIST.md`).

- **Lane 3's three discrepancies, recorded not resolved:**
  (1) SOL/LTC/DOGE history: `chains.ts` records history verified,
  `registry/capabilities.json` records it NOT_SUPPORTED for all 18
  additional chains. Which source is right needs re-verification.
  (2) Web vitest count: Round 2 recorded 1697, four first-hand runs
  on the tip measure 1718 (see "The true vitest baseline"). (3)
  ADR-0007's 2026-11-20 amendment says 12 unique CoinGecko ids for
  the original 13 chains; the current `prices.ts` map yields 10 for
  those 13. The 2026-11-23 amendment states the current verified map
  (15 unique for 22); the old amendment was left as written.
- **Reference-repo link still missing.** The owner never named the
  repo or attached a link for the README showcase (item A). No layout
  from it was used or invented. What depends on the link, once it
  arrives: whether the README's section order, the docs landing
  structure or the screenshots section should mirror that repo's
  layout, and any visual or structural convention it sets.
- **`send.ts` / `core.ts` split — still open.** The intent section
  of `core.ts` is entangled with `core.ts`-private helpers and the
  secret-handling path (`withSigningKey` wipes key bytes). A future
  lane should move only the pure intent-value model to
  `wallet/signing-intent.ts` and leave key-touching operations in
  `core.ts`. The jscpd scan adds three more BTC near-duplicates in
  `send.ts` to that lane's scope.
- **`wallet-refresh.ts` re-wire — still open.** `createRefresh` is
  imported by nothing except its own tests; the context runs its own
  inline refresh. The gaps are measured: 4 hardcoded chains vs 21
  registry chains, mainnet-only vs devnet-aware, no
  `refreshing`/`stale` flags or balance cache, different retry
  policy. Wiring it in would change refresh behaviour for 18 chains,
  devnet mode, caching and the stale/refreshing UI flags — a
  functional change, not polish.
- **Unwired modules (Lane 4):** `engine/destination.ts`,
  `wallet/adapters/confirmation.ts`, `wallet/evm-typed-data.ts`,
  `wallet/secret-handoff.ts` — wire them, or delete them by explicit
  decision. Largest remaining dead-looking surface (1277 lines
  combined).
- **Unused dependencies (merge-lane knip run):** 7 `@radix-ui/*`
  packages plus `react-hook-form` have no importer left.
  `package.json` + lockfile cleanup is a separate change; it needs
  the owner's word only in the sense that it touches dependencies,
  not because anything is blocked.
- **jscpd production clusters (merge lane):** btc/ltc adapters,
  prices/token-prices, asset-list/dashboard, destination/devnet —
  consolidation candidates for a future lane.
- **Mobile dashboard clean re-shoot:** the README mobile shot still
  shows "(Partial)". Re-shoot in a quiet window when the shared
  egress is calm.
- **Checklist follow-ups O-01–O-12** (`docs/REVERIFY-CHECKLIST.md`):
  E2E harness vs `base: '/bawa/'` (2 specs fail at boot — needs a
  decision); devnet Issues 5 and 6 (deep-audit Lane B is checking
  Issues 5–10); BTC/ETH/TRX faucets captcha-blocked (owner-side
  only); non-zero DOGE watch-row render unproven; E2E-03/06
  stable-network run and 1919 settled-dashboard widths; review and
  sign steps CDP-unverified; live camera scan path (owner's phone);
  Receive tagline removed (restore it somewhere, or leave it
  removed); word grid at 1024 px (~34 px slack); publish the new
  desktop build to GitHub Pages vs leave Pages on the saved
  `67c48e2` build (offered 2026-11-22 ~18:26, never answered);
  README wallet-UI showcase (blocked on the reference-repo link).
- Out of scope, unchanged: M-39 (GUI TON withdrawal), broadcast
  authorisation (mainnet broadcast still disabled), Android Gradle
  build (no SDK/JDK on gray-pinee), merging any branch into
  adopt-proper or main.

## Safety

No transfer, send or broadcast of real (mainnet) crypto in this
programme. No balances, prices or token metadata invented — every
number comes from a real source. No keyed/paid RPC or API used. All
test wallets were fresh disposable phrases, unfunded, never funded,
and their phrases were never printed, logged or committed.
