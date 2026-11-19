# Bawa naming map — Lane A (repo-organisation programme)

- **Lane:** naming, branch `panel-rebuild/org-naming`, base `panel-rebuild/adopt-proper` at `e493720`
- **Worktree:** `/home/boxd/workspace/bawa-org/naming` (gray-pinee)
- **Date:** 2026-11-20
- **Scope:** all 4 branches audited for confusing, misleading, or inconsistent file/folder names: `main` (74ae078, 99 files), `main-adopt-fixes` (df3dd25, 99 files), `panel-rebuild/adopt-proper` (e493720, 411 files — this lane's base), `panel-rebuild/multichain-create` (40d8cc5, 445 files).
- **Method:** every rename candidate was verified first-hand by reading the file before any rename (no renames by guessing). Sol (gpt-6.1-sol, API 1, max reasoning, 4 calls) analysed each batch; every Sol recommendation was then verified against the actual references before applying. Only renames that genuinely improve clarity were applied.
- **Naming bar (skills used):** `file-organizer` — descriptive names, consistent patterns, no version numbers in names, archive-don't-delete; `code-review-and-quality` — readability axis (names descriptive and consistent with project conventions; a refactor must reduce complexity, not relocate it). Both skills were read first-hand; they changed the bar applied (see "Skills used" below). No other skill in the 1,400-skill library fitted this lane better.

## 1. Renames applied on this branch (all via `git mv`)

| Old path | New path | Reason | References updated |
|---|---|---|---|
| `scripts/build.mjs` | `scripts/build-platforms.mjs` | Bare "build" was ambiguous beside `scripts/build-wallet.mjs` (the one-prompt workflow). This script builds the web/Android platform apps. | Usage string in the file; `docs/index.md`, `docs/CAPABILITY-MAP.md`, `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md`, `ARCHITECTURE.md`. |
| `tools/hdwallet-gen/derive_daemon.js` | `tools/hdwallet-gen/derive-daemon.js` | The only snake_case JS file in the repo; every other JS/TS file is kebab-case (Python files use snake_case by convention). | `tools/hdwallet-gen/package.json` (`check` script), `test/smoke.test.js`, `tests/diagram-references.test.mjs`, `tests/failure-modes.test.mjs`, `tests/negative-inputs.test.mjs`, `tools/hdwallet-gen/extended-key.js` (comment), the file's own header comment, `ARCHITECTURE.md`, `AGENTS.md`, `docs/IMPLEMENTATION.md`, `docs/02-chains/README.md`, `docs/04-wallet-generation/README.md`, `docs/05-watch-only/README.md` (live refs only), `docs/10-operations-and-testing/README.md`, `docs/12-chain-registry-and-assets/README.md`, `docs/13-wallet-app-architecture/README.md`, `docs/14-wallet-app-implementation/README.md` (§live part), `docs/CAPABILITY-MAP.md`, `docs/TESTING.md`, `docs/web-wallet/WEB-GUIDE.md`, `docs/mainnet/MAINNET-GUIDE.md` (§live parts). |
| `apps/web/src/wallet/providers.ts` | `apps/web/src/wallet/balance-providers.ts` | "providers" was vague and collided with the app's `WalletProvider` (from `src/state/wallet-context.tsx`). The module is the read-only balance/history provider registry. | `apps/web/src/wallet/adapters/index.ts`, `apps/web/src/wallet/adapters/types.ts`. |
| `apps/web/src/wallet/wallet-context.test.tsx` | `apps/web/src/state/wallet-provider.test.tsx` | The test lived in `src/wallet/` but tests the provider in `src/state/wallet-context.tsx`, and shared its basename with the test that already sits next to that module (`src/state/wallet-context.test.tsx`). Moved beside the implementation and renamed to remove the duplicate basename. | Imports rewritten to the new relative paths (`./wallet-context`, `../wallet/core`, `../wallet/vault`, `../wallet/chains`, `../wallet/adapters`). |
| `apps/web/src/wallet/wallet-context-balances.test.tsx` | `apps/web/src/state/wallet-provider-balances.test.tsx` | Same as above (adapter-backed balances/history tests for the same provider). | Imports rewritten to the new relative paths. |
| `apps/web/src/wallet/format.ts` | `apps/web/src/wallet/chain-amount-format.ts` | "format" was vague beside `src/wallet/money.ts` (fiat display math). The module is chain decimals + native-amount formatting (`CHAIN_DECIMALS`, `formatNativeAmount`, `formatNativeWithSymbol`, `decimalToBaseUnits`). | 7 screens (`asset-detail`, `asset-rows`, `dashboard`, `receive`, `send`, `transaction-detail`, `transaction-history`), `apps/web/src/wallet/send.ts`. |
| `apps/web/src/wallet/format.test.ts` | `apps/web/src/wallet/chain-amount-format.test.ts` | Test file follows its module. | Its own `from './format'` import. |
| `docs/security-AUDIT-TOOLCHAIN.md` | `docs/SECURITY-AUDIT-TOOLCHAIN.md` | The only mixed-case filename in `docs/`; neighbours are SCREAMING-CASE or kebab-case. | None — zero references elsewhere in the repo. |
| `docs/05-watch-only/GUI-WATCH-ONLY-WORKFLOW.md` | `docs/05-watch-only/gui-watch-only-workflow.md` | SCREAMING-CASE broke the numbered-sections kebab-case guide convention. | `docs/05-watch-only/ton-watch-only-testing.md`, `docs/CAPABILITY-MAP.md`, `docs/handoff.md`, `docs/mainnet/MAINNET-GUIDE.md`, `tools/bawa_cli.py` (doc-path map). |
| `docs/05-watch-only/TON-WATCH-ONLY-TESTING.md` | `docs/05-watch-only/ton-watch-only-testing.md` | Same as above. | `docs/05-watch-only/gui-watch-only-workflow.md`, `docs/CAPABILITY-MAP.md`, `tools/bawa_cli.py` (doc-path map). |
| `docs/UI-UX-REFERENCE-research.md` | `docs/UI-UX-REFERENCE-RESEARCH.md` | Mixed casing (`-research` lowercase) and the name collides with the governing spec `apps/web/UI-UX-REFERENCE.md`; the suffix now consistently marks it as the historical research copy. | None — zero references elsewhere in the repo. |
| `PR1-EVIDENCE.md` | `NOV18-TRUTH-REPRODUCIBILITY-EVIDENCE.md` | "PR1" is lane jargon; the file is the 2026-11-18 truth-and-reproducibility evidence report. Date prefix marks it as a dated lane report at the root. | None live — the only mentions are historical (see §3). |
| `RESEARCH-REPORT.md` | `NOV18-WALLET-PANEL-RESEARCH.md` | "RESEARCH-REPORT" says nothing about its subject (the wallet-panel rebuild research, 2026-11-18). | None live — the only mentions are historical (see §3). |
| `SDK-PICK.md` | `NOV18-WALLET-GENERATION-SDK-PICK.md` | "SDK-PICK" says nothing about its subject (the wallet-generation engine SDK pick, 2026-11-18). | None live — the only mentions are historical (see §3). |

## 2. Proposed but NOT applied on this branch (and why)

| Candidate | Verdict | Reason |
|---|---|---|
| `registry/ui.json` → `registry/ui-implementations.json` (Sol call 2) | NOT applied | Verified false premise: the filename IS the registry key. `scripts/validate-registry.mjs:597` loads it explicitly as `["ui", join(registryDir, "ui.json")]`, `tests/registry.test.mjs` builds paths as `` `${name}.json` ``, and the file itself declares `"registry": "ui"`. Renaming would break the filename==key convention and two code paths for a marginal gain. The `ui.json` (implementations) vs `docs/UI-TEMPLATE-REGISTRY.yaml` (templates) distinction is documented in `docs/registry-maintenance.md` instead. |
| `test/` vs `tests/` (singular vs plural) | NOT applied (KEEP pair) | Real but mild confusion: `test/` = Python pytest + 2 legacy JS tests (run by CI and by `tools/hdwallet-gen` npm test); `tests/` = Node `node:test` suite for `scripts/` + `registry/` (run manually per file, `node --test tests/<file>.mjs`). Renaming either breaks CI paths (`python test/*.py`, bandit/ruff on `tools test`), npm scripts, and many doc references. Cost outweighs the gain. Convention recorded here instead. |
| `docs/index.md` vs `docs/README.md` (two doc entry points) | NOT applied | Genuine overlap (Diátaxis index vs guide map), but it is a navigation/content problem, not a filename defect. Renaming `index.md` would break `README.md`, `CHANGELOG.md`, `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md`, and `tools/bawa_cli.py`. Left for the docs lane. |
| `apps/web/src/engine/boundary.ts` → `chain-validation.ts` or similar | NOT applied | "boundary" is vague, but the module genuinely is the engine/WASM integration boundary (ChainId, extended-key validation, address validation, WASM init), and 19 files import it. Renaming 19 import sites for a marginal gain violates the "do not rename for the sake of it" rule. `src/wallet/chains.ts` (supported-chains list) stays distinct. |
| `apps/web/src/ui/LICENSE-token-ui` → `LICENSE.md` | NOT applied | Sol judged KEEP: the suffixed name clearly identifies the vendored token-ui licence, and its references (`src/ui/NOTICE.md`, `templates/web/UPSTREAM.md`) are consistent. |
| `apps/web/src/app/app.tsx` → `shell.tsx` or similar | NOT applied | The `app/app` stutter is real but conventional and not misleading; renaming would also move `app.test.tsx`. KEEP. |
| `apps/web/src/app/theme-toggle.tsx` | NOT applied (name fine) | The name is accurate. The component is UNUSED (zero imports; the dark theme it would toggle is never applied) — that is dead code, not a naming defect, and deletion is out of scope for this lane (renames only). Flagged for the diagnostics lane. |
| `scripts/gate-verdict.mjs`, `scripts/classify-request.mjs`, `scripts/plan-build.mjs`, `tools/verify-sign/run-verify-sign.mjs`, `tools/mainnet-*/` single-file dirs, `test/fixture-oracle.py`, `requirements.lock`, `apps/web/src/wallet/bip39-oracle.test.ts`, `apps/web/src/screens/asset-rows.tsx`, `apps/web/src/engine/confirmation-policy.md`, `docs/EXTERNAL-TOOLS.md` vs `docs/EXTERNAL-TOOLS-RESEARCH-NOTES.md` | NOT applied (KEEP) | Each verified first-hand and judged clear: `gate-verdict` (verdict line) vs `quality-gates` (runs the gates); `classify-request` (request→profile) vs `ai/detect-capabilities.mjs` (toolchain check); `plan-build` (planning) vs `generate-project` (generation); `run-verify-sign` names its check; the `mainnet-*` dirs hold one tool each whose name identifies it; "oracle" is the correct term for the independent BIP39 reference implementation; `asset-rows` accurately names shared row components; the `.md` suffix distinguishes the confirmation-policy spec from its implementation; `-RESEARCH-NOTES` clearly distinguishes the supporting notes from the guide. |
| Full `docs/` case normalisation (SCREAMING vs kebab) | NOT applied | Systemic inconsistency (most guide docs SCREAMING-CASE, some kebab-case, one mixed-case). Only the worst offenders were renamed (§1). Renaming all of `docs/` would churn dozens of links for no functional gain. |

## 3. Where the OLD name intentionally remains

Renaming a file does not rewrite history. These references keep the old name on purpose:

- **Pin-cited sentences** (the file had the old name at the cited commit): `docs/05-watch-only/README.md:3,76` and `docs/14-wallet-app-implementation/README.md:371` and `docs/mainnet/MAINNET-GUIDE.md:4358` keep `derive_daemon.js` — each cites a specific historical pin/commit.
- **Verbatim-preserved record:** `docs/README-FULL.md` (the 1,308-line README preserved verbatim) keeps `scripts/build.mjs` and `derive_daemon.js`.
- **Audit reports of historical states:** `docs/BRANCH-AUDIT.md`, `docs/MULTIBRANCH-REPORT.md` keep `derive_daemon.js` (they describe commits where that was the name).
- **Baseline plan record:** `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md` keeps `derive_daemon.js` in its baseline/H5-era descriptions (including the "do not touch" instruction, which names the file as it was).
- **Historical prose about other branches:** `docs/wallet-reference-map.md:5` mentions `RESEARCH-REPORT.md` as the file on branch `panel-rebuild/research` (commit `57a6d37`), not the root file; `apps/web/IMPLEMENTATION-REPORT.md:214-215` cites absolute VM worktree paths (`/home/boxd/workspace/bawa-panel-rebuild/research/RESEARCH-REPORT.md`, `.../sdk-pick/SDK-PICK.md`). Both left untouched.
- **Lane working records:** `sol/prompt1-scripts-tools.md` (this lane's own Sol prompt) mentions the old names; it is a historical record of what was asked, not a live reference.

## 4. Findings for the other branches

### `main` (74ae078) and `main-adopt-fixes` (df3dd25)
`main-adopt-fixes` has the identical 99-file set as `main` (the diff is content-only: `docs/03`, `docs/08`, `requirements.txt`, `test/test_make_wallet.py`, `tools/make_wallet.py`), so every `main` finding applies to both.

| Finding | Applies to adopt-proper? |
|---|---|
| `captcha/` — vendored third-party challenge-solving reference code + a working runner for the TronScan Approval-tab check (audit pointer P22). The directory name says nothing about TronScan. Proposed: `tronscan-approval-experiment/`. | No — `captcha/` was deleted in the panel rebuild; adopt-proper has no such directory. |
| `docs/06-tracking/providers.json` — a machine-readable JSON data file (chain provider fallback lists) stored inside the `docs/` tree. The name itself is fine (KEEP); the placement is the issue — it belongs with the machine registries (`registry/`). | No — the file is absent on adopt-proper (dropped in the panel rebuild). |
| Root `IMPLEMENTATION.md` vs `docs/IMPLEMENTATION.md` — on `main` the reference-implementation doc sits at the root. | Already resolved on adopt-proper: the file lives at `docs/IMPLEMENTATION.md` (moved during the repo-craft work; the CHANGELOG records the move). |
| `test/` vs `tests/` — `main` has only `test/` (no `tests/` dir yet), so the singular/plural collision does not exist there. | The collision is adopt-proper-only (see §2). |

### `panel-rebuild/multichain-create` (40d8cc5)
All adopt-proper renames in §1 apply here too (same files, same problems), plus these multichain-only findings (NOT applied — different branch):

| Finding | Proposed |
|---|---|
| `apps/web/src/screens/create.tsx` (the Create hub screen showing 7 tool cards) vs `apps/web/src/screens/create-wallet.tsx` (the mnemonic create-wallet flow). Two screens differing only by `-wallet`. | Rename the hub only: `create.tsx` → `create-hub.tsx`. Keep `create-wallet.tsx`. |
| `docs/adr/0006-price-feed-provider.md` REPLACED `docs/adr/0006-use-case-split.md` — ADR number 0006 was reused for a different decision than on adopt-proper. ADR numbers must be stable, never reused. | Renumber the price-feed ADR to the next unused number (0007) and restore `0006-use-case-split.md` (or record the supersession explicitly in `docs/adr/README.md`). |
| `lane/` committed in the tree (`lane/evidence/*.json`, `lane/probe-2026-11-20.jsonl`, `lane/report-b.md`, `lane/run-log-*.jsonl`) — lane scratch/evidence files live in the branch tree. | Organisation finding, not a rename: lane working records do not belong in the branch tree (deletion is out of this lane's scope; needs a coordinator decision). |
| New files follow the adopted conventions (`apps/web/src/wallet/prices.ts`, `tracker.ts`, `token-logo.tsx`, `track-transaction.tsx`, `apps/web/src/assets/tokens/`) — no naming issues found in the multichain additions. | — |

## 5. Verification after the renames

| Check | Result |
|---|---|
| `tools/hdwallet-gen`: `npm run check` | PASS (checks `derive-daemon.js` by its new name) |
| Root `npm test` (hdwallet-gen smoke + register-links) | PASS |
| `node --test tests/diagram-references.test.mjs` | 5/5 PASS |
| `node --test tests/failure-modes.test.mjs` (spawns the daemon 5×) | 10/10 PASS |
| `node --test tests/negative-inputs.test.mjs` (spawns the daemon) | 51/51 PASS |
| `node --test tests/registry.test.mjs` | PASS (full file, 0 fail) |
| Full `tests/*.mjs` suite | 380/382 pass; the 2 failures are pre-existing on base `e493720` (see below), not caused by these renames |
| `apps/web`: `npx tsc --noEmit` | PASS, exit 0 |
| `apps/web`: `npm run build` | PASS, built in 1.31s |
| `apps/web`: `npx vitest run` | 457/457 PASS across 40 files |
| `python3 tools/check-links.py` | OK (113 files) |
| `python3 -m py_compile tools/bawa_cli.py` | OK |
| Stale-name sweeps (`derive_daemon`, `scripts/build.mjs`, `wallet/format`, `GUI-WATCH-ONLY`, `TON-WATCH-ONLY`, `security-AUDIT`, `UI-UX-REFERENCE-research`, `PR1-EVIDENCE`, `SDK-PICK`) | Only the intentional historical remainders in §3 |

**Pre-existing failures (verified on pristine base `e493720` in a temp worktree, identical results):**
- `tests/stale-data.test.mjs` — "M-31 must stay OPEN" assertion fails. The guide was updated when M-31/M-15 closed (owner decision 2026-11-13, commit `18ce692`); the test still asserts OPEN. My diff contains zero added/removed lines mentioning M-31. Not caused by this lane; needs a test update by whoever owns the stale-data suite.
- `tests/clean-checkout.test.mjs` — "android wallet request verifies from a clean checkout" fails with `build-wallet: PLAN REJECTED` (`OPERATION_NOT_SUPPORTED`: operation `create` not supported for chains on profile `android-wallet`). Reproduced identically on base `e493720` (exit 2, same error code). A registry/profile data issue, unrelated to filenames. Note: this file's header says these slow e2e tests are "not part of the fast test:all gate".

## 6. Sol calls (all gpt-6.1-sol, API 1, max reasoning, cap 32,000, via `/home/boxd/workspace/bawa-sourceaudit2/mcp-chat-sol-api1.mjs`, detached)

| Call | Prompt (words) | Output | Duration | Verdicts |
|---|---|---|---|---|
| 1 — scripts + tools | 368 | `sol/out1-scripts-tools.md` (1,260 chars) | 68,028 ms | RENAME `build.mjs` → `build-platforms.mjs`, RENAME `derive_daemon.js` → `derive-daemon.js`; KEEP the rest |
| 2 — test/tests + registry + root reports | 367 | `sol/out2-test-registry-root.md` (1,165 chars) | 98,522 ms | KEEP `test/` + `tests/` pair, KEEP `requirements.lock`, KEEP `fixture-oracle.py`; RENAME `registry/ui.json` → `ui-implementations.json` (**rejected on verification, see §2**); RENAME root reports with NOV18- prefix |
| 3 — apps/web src | 395 | `sol/out3-apps-web.md` (1,780 chars) | 106,634 ms | RENAME `providers.ts` → `balance-providers.ts`, move+rename the two `wallet-context` tests to `src/state/`, RENAME `format.ts` → `chain-amount-format.ts`; KEEP the rest |
| 4 — docs + cross-branch | 480 | `sol/out4-docs-crossbranch.md` (1,961 chars) | 108,490 ms | RENAME `security-AUDIT-TOOLCHAIN.md`, both 05-watch-only files to kebab-case, `UI-UX-REFERENCE-research.md` to SCREAMING-CASE; KEEP `docs/index.md`, EXTERNAL-TOOLS pair; main-only RENAME `captcha/`; multichain-only RENAME `create.tsx` → `create-hub.tsx`, renumber ADR 0006 |

Total: 4 calls, 4 landed, 0 failed, 0 retries. Full per-call log in `RUN-LOG.jsonl`; prompts and outputs in `sol/`.

## 7. Skills used

- **`file-organizer`** (`~/workspace/custom-skills/file-organizer/SKILL.md`) — read first-hand. Applied: descriptive specific names ("build-platforms" not "build", "balance-providers" not "providers"), consistent patterns (kebab-case for JS, SCREAMING for root/docs reports), no version numbers in names, and its "propose a plan before moving, log all moves" discipline (this map is that log).
- **`code-review-and-quality`** (`~/workspace/custom-skills/code-review-and-quality/SKILL.md`) — read first-hand. Applied: the readability axis (names descriptive and consistent with project conventions; no `temp`/`data`-style vagueness) and the "refactor must reduce complexity, not relocate it" rule — the reason several plausible renames (e.g. `boundary.ts`, the `docs/` case sweep) were rejected: they would have moved confusion around without removing any.
- Searched the 1,400-skill library for repo-organisation / naming / refactoring / code-review skills first; these two were the best fits. No skill covered the Sol-runner workflow or the per-branch audit; those followed the lane brief.
