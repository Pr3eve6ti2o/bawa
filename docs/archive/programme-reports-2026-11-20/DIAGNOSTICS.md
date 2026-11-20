# Bawa diagnostics — Lane E (repo-organisation programme)

- **Date:** 2026-11-19 (runs 21:51–22:10 UTC)
- **Branch:** `panel-rebuild/org-diagnostics` (base `panel-rebuild/adopt-proper` e493720), local only, no push
- **Worktree:** `/home/boxd/workspace/bawa-org/diagnostics` (gray-pinee)
- **Method:** every claim verified first-hand on gray-pinee (Node v22.23.4, Python 3.12.3, lane venv). Sol (gpt-6.1-sol, API 1, max reasoning, 32k cap) used for analysis/recommendation only — no Sol output was acted on without a first-hand check.
- **Skills used:** `dead-code-cleanup` (verify-before-delete, one-thing-at-a-time, compiler/test-suite as safety net — drove the dead-code method); `security-and-hardening` (native-audit-against-lockfile, secret-scan, triage-by-reachability — drove the dependency/security sections); `code-review-and-quality` (five-axis review, severity labels, verify-the-verification — drove the findings structure); `webapp-testing` (consulted; its Playwright approach does not apply here — diagnostics are build/test/audit based, so only its run-it-don't-read-it principle was used).

## Branches diagnosed (all SHAs verified against the remote)

| Branch | SHA | Files | Shape |
|---|---|---|---|
| main | 74ae078 | 99 | Guide repo, no `apps/web` |
| main-adopt-fixes | df3dd25 | 99 | main + Python adoption port (trezor `mnemonic`, recovery techniques) |
| panel-rebuild/adopt-proper (this branch) | e493720 | 411 | Full panel work |
| panel-rebuild/multichain-create | 40d8cc5 | 445 | adopt-proper + multichain work |

Temp worktrees (detached, removed after the run): `tmp-diag-main`, `tmp-diag-main-adopt`, `tmp-diag-multichain`.

## 1. Build health — ALL GREEN

| Check | main | main-adopt | adopt-proper | multichain |
|---|---|---|---|---|
| `tools/hdwallet-gen` `npm run check` (`node --check` × 5–6 files) | 0 | 0 | 0 | 0 |
| `apps/web` `npm ci` | n/a | n/a | 0 | 0 |
| `apps/web` `tsc --noEmit` | n/a | n/a | 0 | 0 |
| `apps/web` `npm run build` | n/a | n/a | 0 | 0 |

Build warnings (both panel branches, pre-existing, not fixed here):
- One chunk > 500 kB after minification: `boundary` chunk 2,899.89 kB (gzip 289.58 kB) — the known wallet-core WASM glue chunk. Unchanged from the recorded open item.
- No other warnings/errors in any build log.

## 2. Test health — ALL GREEN, zero failures on any branch

| Suite | main | main-adopt | adopt-proper | multichain |
|---|---|---|---|---|
| Root `npm test` (`test/smoke.test.js` [+ `register-links.test.js` on panel branches]) | PASS, 130 ok | PASS, 130 ok | PASS, 217 ok | PASS, 217 ok |
| `test/test_make_wallet.py` | 14 OK | 19 OK | 89 OK | 89 OK |
| `test/test_decrypt_seed.py` | absent | absent | 30 OK | 30 OK |
| `test/test_bawa_cli.py` (extra, not in the brief) | 48 OK (3 skipped) | — not run | 25 OK (2 skipped) | — not run |
| `test/differential_test.py` (extra, not in the brief) | PASS | — not run | PASS | — not run |
| `apps/web` `vitest run` | n/a | n/a | 457 passed, 40 files | 564 passed + 1 skipped, 45 files |

- **Known pre-existing failures — neither reproduced:** the clean-checkout Android test and the stale-data M-31 test did not fail anywhere in these runs (zero failures total). The Android suite (`apps/android`, Gradle) could not be executed on this VM — no Java/Gradle installed — so the Android test is **not verified here**, it is environmental, not a code failure. M-31 is a review gate (see `docs/index.md`), not a test file; no M-31 test exists in the tree.
- Note: `test_bawa_cli.py` counts differ by branch (48 on main vs 25 on adopt-proper) — different test files per branch, not a failure. Recorded, not chased.
- No test was weakened. The only test change is the addition of 3 new tests for the fee-cap fix (§5).

## 3. Dependency health

### npm audit — 0 vulnerabilities everywhere
- `tools/hdwallet-gen`: 0 total on all 4 branches (14 prod deps).
- `apps/web`: 0 total on both panel branches.

### pip-audit — 1 finding, identical on all 4 branches
- `ecdsa 0.19.2`: 2 records of the same advisory, `PYSEC-2026-1325` / `CVE-2024-23342` / `GHSA-wj6h-64fc-37mp` (Minerva timing attack, P-256 `sign_digest()`). **No fix version exists** — upstream considers side channels out of scope.
- **Reachability (verified first-hand):** `ecdsa` is transitive via `bip-utils 2.12.3`. Our tools never import `ecdsa` and never sign: `tools/make_wallet.py` uses only `Bip39SeedGenerator`/`Bip39MnemonicValidator` + AESGCM, and the `ecdsa` backend key files in installed `bip_utils` contain no `Sign`/`sign_digest` methods. A timing attack needs timed signatures; we produce none. P-256 (`nist256p1`) key classes exist in `bip_utils` but our chains (BTC/ETH/TRX secp256k1, TON Ed25519) do not exercise them.
- **Verdict:** accepted residual risk, documented here. Reachability trace (Sol-02's requested check, done first-hand): `ecdsa` is installed but **not executed** on our secp256k1 path — `bip_utils` selects the coincurve backend when available (`EccConf.USE_COINCURVE`), verified at runtime (`Secp256k1PrivateKey` resolves to `...secp256k1_keys_coincurve`); the `ecdsa` backend key files contain no `Sign`/`sign_digest` methods; our tools never sign (only BIP-39 validation/seed generation + AESGCM, plus BIP-32/BIP-44/BIP-84 public derivation in `assert_bundle_matches_public_roots`, which is scalar multiplication, not signing); P-256 (`nist256p1`) classes exist in `bip_utils` but our coin set (BTC/ETH/TRX secp256k1, TON Ed25519) never reaches them. A Minerva timing attack needs timed signatures; we produce none. No code change. Re-review if crypto usage or dependencies change.
- Everything else clean: `cryptography 50.0.2`, `bip-utils 2.12.3`, `mnemonic 0.21`, `pynacl 1.6.2`, `requests 2.34.2`.

### npm outdated — 50 outdated on adopt-proper (multichain similar)
- Mostly minor/patch bumps (fontsource 5.2.x → 5.3.x, Radix 1.x → 1.x+1, etc.). Full list in the lane log `logs/adopt-proper__web-npm-outdated.log`.
- **Note:** 11 of the outdated packages are the dead Radix deps in §4 — they disappear with the deletion instead of being bumped.
- No outdated package was bumped in this lane (bulk bumps are out of scope; per the code-review skill, one dependency per change with changelog review).

## 4. Dead code

### Proven dead (adopt-proper `apps/web`, verified by import analysis)
- **36 of 62 `src/ui/components/*.tsx` files** have zero `import` of the module anywhere in the repo (all `.ts/.tsx/.js/.mjs/.md/.json` searched; no `import.meta.glob`; no barrel re-export): accordion, action-bar, alert-dialog, aspect-ratio, bottom-sheet-modal, breadcrumb, calendar, carousel, chart, chat-bubble, chip, collapsible, command, context-menu, drawer, dropdown-menu, feature-item, holding-card, hover-card, icon-box, icon-button, input-otp, menubar, nav-item, navigation-menu, pagination, resizable, scroll-area, section-panel, sidebar, slider, stat-cell, task-card, textarea, toggle-group, tooltip. (Three of these — collapsible, command, tooltip — only matched as English words in comments/other files, never as imports.)
- **`src/app/theme-toggle.tsx`** (ThemeToggle): zero imports. The `.dark` theme it toggles never applies — known open item.
- **20 dead dependencies** in `apps/web/package.json`, each imported only by one of the dead components: `@radix-ui/react-accordion`, `react-alert-dialog`, `react-aspect-ratio`, `react-collapsible`, `react-context-menu`, `react-dropdown-menu`, `react-hover-card`, `react-menubar`, `react-navigation-menu`, `react-scroll-area`, `react-slider`, `react-toggle-group`, `react-tooltip`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`, `recharts`, `input-otp`, `vaul`, `cmdk`. (False positives excluded: `vaul` hits were the substring "vault"; `long` is live via `src/wallet/send.ts`; `@types/*` and `typescript` show no import but are tooling, not dead.)
- **Deletion status — DONE, verified:** all 36 dead components + `theme-toggle.tsx` deleted (two batches, `tsc --noEmit` + `vitest run` green after each: 460/460); then the 20 dead deps removed with `npm uninstall` (lockfile updated by npm, never hand-edited), followed by a clean `npm ci` and full re-verification: `tsc` 0, `vite build` 0, `vitest` 460/460, `npm audit` 0. Final diff: 41 files changed, +56/−5,047 (37 deletions + `package.json`/`package-lock.json` + the fee-cap fix). Sol-01 (gpt-6.1-sol) reviewed the plan first and agreed: DELETE all 36 + ThemeToggle + 20 deps, KEEP `confirmation-policy.ts`/`long`/`typescript`/`@types/*`. Its residual risks were checked first-hand: computed `import()`s touch only live modules (`wallet/core`, `wallet/adapters`, `engine/boundary`); no `.mdx`/`.cjs`/`.jsx` or config references to the deleted names; the `--chart-*`/`--sidebar-*` tokens live in `globals.css`, not in the deleted files. CSS impact: built stylesheet 563 → 414 selectors, 0 gained; the 149 removed selectors were dead-only — the 17 that looked live on a naive token grep were verified to be variant-prefixed forms still present in the rebuilt CSS (e.g. `data-[state=open]:animate-in`), JSX props (`aria-selected={…}`), English words, or arbitrary values (`max-h-[8rem]`). No live styling changed. Note for the programme: the desktop-layout lane was not consulted — if it wants any of these primitives back, they are in git history on this branch's parent.

### Reported, NOT deleted
- **`src/engine/confirmation-policy.ts`**: no production importer, but covered by 29 tests. Per the dead-code skill, test-only use is alive use, and the module looks like a shared spec awaiting integration — needs an owner/lane decision, not a silent deletion.
- **`mnemonic-words`** (npm): in `dependencies` but used only by `bip39-wordlist.test.ts`. Candidate to move to `devDependencies` — belongs to the requirements lane, reported here only.
- The same dead-component set exists on multichain-create (same `apps/web` lineage); reported, not fixed there (fixes land on adopt-proper only).

## 5. Security

| Check | Result |
|---|---|
| Secrets in tree (private keys, `AKIA…`, `ghp_…`, API-key assignments) | **Clean on all 4 branches** — pattern grep over tracked files found nothing; no `.env`/`.pem`/credentials files tracked; `.gitignore` covers `.env*` |
| `abandon` test vector | Only in tests/docs as the published BIP-39 test vector (`"abandon" ×11 + "about"`); no real mnemonic anywhere |
| Trezor fail-closed (`tools/make_wallet.py` `assert_bundle_decrypts`) | **Verified fail-closed:** missing `mnemonic` package → `SystemExit`; `m.check(text) is not True` or wrong entropy length → `SystemExit`; `SystemExit` is `BaseException`, so the inner `except Exception` cannot swallow it; plaintext bytearray is zeroed in `finally` |
| CSP in `dist` | **Verified present** in `dist/index.html`: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; … frame-ancestors 'none'` (injected by `vite.config.ts` from `src/app/security-headers.ts`) |
| `formatFeePreview` DoS | **FOUND + FIXED (see below)** |
| `formatFeePreview` sub-0.5-micro rounding to 0 at 6dp | Still present as designed on the estimate line only (existing test asserts `1 wei → '0 ETH'`); display-only, not changed |

### Fix applied: `formatFeePreview` input-length cap (adopt-proper only)
- **Problem (measured first-hand):** `Decimal.clone({ precision: valueBaseUnits.length })` makes CPU scale with input length, with no length check in `assertIntegerString`. Probe on the real function: 10 digits 0 ms, 1,000 digits 1 ms, 10,000 digits 76 ms, 100,000 digits 7,212 ms, 1,000,000 digits > 110 s (killed by timeout). The caller passes app-generated fee estimates (small), so exploitability is low — but the function is exported and takes an arbitrary string.
- **Fix (`apps/web/src/wallet/money.ts`):** `MAX_INTEGER_STRING_LENGTH = 1_000` enforced in `assertIntegerString` (covers `formatFeePreview`, `fiatMinorUnits` balance and price inputs). 1,000 digits is >12× the largest real value (a 256-bit integer is 78 digits); worst case at the cap measures ~1 ms.
- **Tests added (`apps/web/src/wallet/money.test.ts`, +3):** 1,001-digit fee/balance/price inputs throw `/at most 1000 digits/`; a 1,000-digit input formats. `money.test.ts`: 89/89 pass. Full-suite re-run after the fix: root `npm test` PASS, `test_make_wallet.py` OK, `test_decrypt_seed.py` OK, `tsc` 0, `vite build` 0, `vitest` 460/460, `npm audit` 0.
- Probe after the fix: 10,000-digit input now throws instantly.

## 6. What remains open
1. `confirmation-policy.ts` production integration decision (owner/lane decision).
2. `mnemonic-words` → `devDependencies` (requirements lane).
3. 50 outdated npm packages — no bulk bump; per-package changelog review if the owner wants bumps.
4. `boundary` chunk 2,899.89 kB (> 500 kB warning) — known open item, unchanged.
5. Cold Generate on Slow 4G ~52 s; TRX/TON balance 429s on shared egress IP — known open items, unchanged (not diagnostics scope).
6. Android test suite not runnable on this VM (no Java/Gradle) — needs a machine with the Android toolchain for a clean-checkout run.
7. Multichain-create carries the same dead code and the same ecdsa finding — fixes land on adopt-proper; the programme can cherry-pick.

## Appendix — evidence locations
- Driver logs (per-branch, per-step, with exit codes): `/home/boxd/workspace/bawa-org/diagnostics-lane/logs/` (`summary.tsv` + `<branch>__<step>.log`).
- Sol prompts/outputs + RUN-LOG: `/home/boxd/workspace/bawa-org/diagnostics-lane/` (`prompts/`, `sol-out/`, `RUN-LOG.jsonl`).
- Sol calls (gpt-6.1-sol, API 1, max reasoning, 32,000 cap; one at a time; detached; logged before waiting):
  - Call 1 — dead-code deletion review, prompt 357 words, landed in 122,847 ms, output 2,651 chars: DELETE all 36 components + ThemeToggle + 20 deps; KEEP `confirmation-policy.ts`/`long`/`typescript`/`@types/*`.
  - Call 2 — ecdsa finding analysis, prompt 309 words, landed in 88,127 ms, output 2,205 chars: (a) accept-and-document after a reachability check; no fixed release exists. The reachability check was then done first-hand (§3) and confirms the acceptance.
  - Total: 2 Sol calls, 0 failed, 0 retried, no 402/403.
