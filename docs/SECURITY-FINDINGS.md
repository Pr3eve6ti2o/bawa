# Security / dependency / deleted-component findings register

Lane D — Bawa finalisation programme (owner order 2026-11-20).
Branch: `panel-rebuild/org-security-docs` (off `panel-rebuild/adopt-proper`
e493720). Every claim below was verified first-hand on gray-pinee on
2026-11-20 unless it says otherwise; where the evidence lives on another
branch, the branch and commit are named and the item is **not** presented
as true of this branch.

## Status vocabulary

- **Fixed (this branch)** — the fix is in this branch and was verified here.
- **Fixed on branch X, not merged** — the fix exists on the named branch
  only. It is **not** fixed on adopt-proper until the coordinator merges it.
- **Accepted residual risk, documented** — no fix exists; the risk is
  recorded with its evidence and its re-review trigger.
- **Documented, still open** — recorded with evidence and what remains; the
  work is **not** done.
- **Decision needed** — an owner/lane decision is required before any action.

## 1. ecdsa 0.19.2 — PYSEC-2026-1325 / CVE-2024-23342

**Status: accepted residual risk, documented.** There is no fix version.

- Advisory: Minerva timing attack on P-256 — `sign_digest()` leaks the
  nonce, enabling private-key discovery. `fix_versions` is empty;
  upstream considers side channels out of scope.
- Re-verified first-hand 2026-11-20: `pip-audit -r requirements.txt`
  returns 2 records of PYSEC-2026-1325 in `ecdsa` 0.19.2, no fix
  versions. Those 2 records are one advisory in one package, not two
  findings (the OSV-Scanner record lists the same PYSEC-2026-1325 once).
  `requirements.lock` pins `ecdsa==0.19.2` (via `bip-utils`)
  and `coincurve==21.0.0`, with hashes.
- Reachability, re-verified first-hand 2026-11-20 in a fresh venv
  (`bip-utils` 2.12.3, `coincurve` 21.0.0, `ecdsa` 0.19.2):
  `bip_utils.ecc.conf.EccConf.USE_COINCURVE` is `True`, and
  `bip_utils/ecc/secp256k1/secp256k1_const.py` selects
  `Secp256k1PrivateKeyCoincurve` when it is true, so the secp256k1 path
  executes coincurve, not ecdsa. The ecdsa-backend wrapper class
  (`secp256k1_keys_ecdsa.py`, 17 methods) exposes no `Sign` /
  `sign_digest` method — it wraps an `ecdsa.SigningKey` reachable only
  via `UnderlyingObject()`, which nothing in the repo calls.
- Our tools never sign: `tools/make_wallet.py` and
  `tools/decrypt_seed.py` import only `Bip39SeedGenerator` /
  `Bip39MnemonicValidator` from `bip_utils` (plus AES-GCM); no file in
  `tools/` imports `ecdsa` or `nist256p1`. Public derivation
  (`assert_bundle_matches_public_roots`) is scalar multiplication, not
  signing. Our curves are secp256k1 (BTC/ETH/TRX) and Ed25519 (TON);
  P-256 (`nist256p1`) classes exist in `bip_utils` but no code path in
  our tools reaches them. A Minerva timing attack needs timed signatures;
  we produce none. The advisory as recorded is P-256-specific, so the
  curve mismatch is the exposure boundary — not a proof that no ecdsa
  code anywhere in the tree could ever execute.
- Scope limit (Sol review 2026-11-20): this adjudication covers our
  tools' direct call paths. It does not audit every transitive import
  inside `bip_utils`, and it is a residual-risk acceptance, not a proof
  of unreachability. Fallback: if `coincurve` were uninstalled,
  `bip_utils` would select the ecdsa backend — but the lockfile pins
  `coincurve` 21.0.0, so a lockfile install always has it. A
  non-lockfile install without `coincurve` would change the backend.
- Risk acceptance: a lane verdict (diagnostics 2026-11-19, re-verified
  by Lane D 2026-11-20). No owner acceptance order is on record; the
  acceptance is a documented lane verdict, not an owner decision.
- Correction to the earlier record: `docs/security-AUDIT-TOOLCHAIN.md`
  §6 said reachability was "TBD" and "T40+ must adjudicate", and named
  `bip-utils` 2.12.2 (the pinned version is 2.12.3). The adjudication
  has now been done twice — diagnostics lane 2026-11-19
  (`panel-rebuild/org-diagnostics`, DIAGNOSTICS.md §3) and this lane
  2026-11-20 — and the AUDIT-TOOLCHAIN note is updated to point here.
  The same doc's OSV paragraph said the repo "should gain a Python
  lockfile"; `requirements.lock` now exists (pip-compile style, hashed).
- Full audit record: `docs/security-AUDIT-TOOLCHAIN.md` §6. Canonical
  summary: `docs/SECURITY.md` ("Dependency and supply chain").
- **Re-review if** crypto usage or dependencies change (new signing
  path, `coincurve` dropped, `ecdsa` bumped). The scan stays
  report-only in `scripts/quality-gates.mjs` (R02-F10) until the
  pre-existing findings are addressed; promoting it to a hard gate is a
  separate decision.

## 2. formatFeePreview DoS — display-decimals cap (100)

**Status: fixed (this branch).**

- `apps/web/src/wallet/money.ts`: `MAX_DISPLAY_DECIMAL_PLACES = 100`,
  enforced in `assertDisplayDecimalPlaces` (commit 64aeadf, "cap
  formatFeePreview displayDecimals at 100 to stop toFixed allocation
  DoS"). This is the earlier cap.
- Verified 2026-11-20: cap present in the code at e493720;
  `apps/web/src/wallet/money.test.ts` **86/86 pass** (vitest, after a
  clean `npm ci`).
- **Remains:** none within this finding's scope.

## 3. formatFeePreview DoS — 1,000-digit input cap

**Status: fixed on `panel-rebuild/org-diagnostics` (82970d2), NOT merged
— documented, still open.**

- Problem (measured first-hand by the diagnostics lane):
  `Decimal.clone({ precision: valueBaseUnits.length })` makes CPU scale
  with input length and `assertIntegerString` had no length check:
  10 digits 0 ms, 1,000 digits 1 ms, 10,000 digits 76 ms, 100,000
  digits 7,212 ms, 1,000,000 digits > 110 s (killed). The caller passes
  app-generated fee estimates (small), so exploitability is low, but the
  function is exported and takes an arbitrary string.
- Fix (diagnostics branch only): `MAX_INTEGER_STRING_LENGTH = 1_000`
  enforced in `assertIntegerString`, covering `formatFeePreview`,
  `fiatMinorUnits` balance and price inputs; +3 tests in
  `money.test.ts` (1,001-digit inputs throw `/at most 1000 digits/`; a
  1,000-digit input formats). There: `money.test.ts` 89/89, full suite
  460/460, `tsc` 0, build 0, `npm audit` 0.
- Verified 2026-11-20: at adopt-proper e493720 `assertIntegerString`
  has **no** length check and `money.test.ts` is 86/86 — the cap is
  **not** in this branch. Do not present it as fixed on adopt-proper.
- **Remains:** coordinator Phase 2 merge decision for
  `panel-rebuild/org-diagnostics`.

## 4. Deleted components — 36 UI components + ThemeToggle + 20 deps

**Status: deleted on `panel-rebuild/org-diagnostics` (82970d2), NOT
merged — documented, still open.**

- Deletion (diagnostics branch, verified by that lane):
  42 files changed, +166/−5,047. 37 files deleted: 36 of 62
  `apps/web/src/ui/components/*.tsx` with zero imports repo-wide, plus
  `apps/web/src/app/theme-toggle.tsx` (ThemeToggle — its `.dark` theme
  never applies). Deleted components: accordion, action-bar,
  alert-dialog, aspect-ratio, bottom-sheet-modal, breadcrumb, calendar,
  carousel, chart, chat-bubble, chip, collapsible, command,
  context-menu, drawer, dropdown-menu, feature-item, holding-card,
  hover-card, icon-box, icon-button, input-otp, menubar, nav-item,
  navigation-menu, pagination, resizable, scroll-area, section-panel,
  sidebar, slider, stat-cell, task-card, textarea, toggle-group,
  tooltip. 20 dead dependencies removed with `npm uninstall`
  (lockfile updated by npm, never hand-edited): `@radix-ui/react-accordion`,
  `react-alert-dialog`, `react-aspect-ratio`, `react-collapsible`,
  `react-context-menu`, `react-dropdown-menu`, `react-hover-card`,
  `react-menubar`, `react-navigation-menu`, `react-scroll-area`,
  `react-slider`, `react-toggle-group`, `react-tooltip`,
  `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`,
  `recharts`, `input-otp`, `vaul`, `cmdk`. Built CSS 563 → 414
  selectors, 0 gained (the 149 removed selectors were dead-only).
  Re-verified there after each batch: `tsc` 0, `vite build` 0, vitest
  460/460, `npm audit` 0.
- Verified 2026-11-20: at adopt-proper e493720 all 62 components and
  `theme-toggle.tsx` are **still present**. The deletion is not in this
  branch. Full report: `DIAGNOSTICS.md` on
  `panel-rebuild/org-diagnostics` (not on adopt-proper).
- Recovery: everything is in git history on the diagnostics branch's
  parent — e.g. `git show 82970d2^:apps/web/src/ui/components/<name>.tsx`.
  Nothing was force-pushed or garbage-collected.
- Desktop-layout check (this lane, 2026-11-20): `git grep` over
  `panel-rebuild/desktop-layout` finds **zero imports** of any deleted
  component name in `apps/web/src`, and ThemeToggle is defined but
  imported nowhere there. The desktop-layout lane wants **none** of
  these primitives back. If that changes, restore from the history
  above, not by re-adding a dependency.
- **Remains:** coordinator Phase 2 merge decision for
  `panel-rebuild/org-diagnostics`.

## 5. Secret-scan gate

**Status: gate PASS on this branch; the report-only promotion of the
other scans is still open.**

- Verified 2026-11-20: `node scripts/secret-scan.mjs` exits 0 with no
  output on this branch. The gate is a hard `check` in
  `scripts/quality-gates.mjs`. Exit 0 means this gate passed, not "no
  secrets": it is a pattern gate over the files it scans (tracked files;
  dependency and build trees are not walked), and its allowlist is
  exact-line, so a reworded secret line still fails.
- The flagged-then-allowlisted lines are exact-line entries in
  `scripts/secret-scan.mjs` (`secretAllowlist`, `knownTestVectors`) —
  any other line text still fails the gate. Entries cover:
  `test/test_make_wallet.py` (the `"abandon" × 23 + "art"` line, all
  three occurrences), `test/fixture-oracle.py` and
  `test/differential_test.py` (the published 15-word fixture vector),
  `tools/decrypt_seed.py` (`mnemonic = decrypt(args.path, key)`),
  `tools/mainnet-signing/local-signing.mjs` and
  `tests/mainnet-signing.test.mjs` (`privateKey:` runtime-variable
  assignments), the R03 test entries in
  `tests/mainnet-guards.test.mjs` / `tests/mainnet-unsigned-tx.test.mjs`,
  and the published BIP-32 test vectors (`xprv…`/`zprv…`/`Yprv…`/`Zprv…`).
  All are published test vectors or runtime variables, never real secrets.
- Checked 2026-11-20: no allowlist entry names an `apps/web` wallet
  file, and no `abandon` string occurs in
  `apps/web/src/wallet/core.ts`, `send.ts` or `vault.ts`. The published
  abandon fixture does occur in the derivation-vectors test
  (`tests/mainnet-derivation-vectors.test.mjs:40`, `ABANDON_FIXTURE`)
  and is covered by the scan's test-vector handling.
- The other scans are **report-only** in `scripts/quality-gates.mjs`
  (R02-F10: report-only until the pre-existing findings are addressed —
  R03's secret-scan findings, ecdsa PYSEC-2026-1325, bandit's
  test-file issues). Promoting any step to a hard gate is a separate
  decision. `docs/SECURITY.md` already records that `ci.yml` has no
  dependency- or secret-scanning steps and the evidence is
  `blocked-unverified`.
- **Remains:** the hard-gate promotion decision; keep the allowlist
  exact-line (never broaden it to whole files).

## 6. confirmation-policy.ts — no production importer

**Status: documented, still open — decision pending. Not deleted.**

- `apps/web/src/engine/confirmation-policy.ts`: a pure,
  provider-independent settlement evaluator (BTC 6, ETH finalised + 12
  extra, TRX 19-of-27 solidified, TON 1 masterchain seqno + delivered
  out-message). Spec: `apps/web/src/engine/confirmation-policy.md`.
  The module performs no network access, holds no secrets, and never
  sends, signs or broadcasts.
- Verified 2026-11-20: **zero production importers** (only its own
  `.test.ts`/`.md`, docs references, and the Android Kotlin counterpart
  `ConfirmationPolicy.kt` + test). Its vitest file passes **54/54**
  — the "29 tests" figure in the finalisation brief does not match the
  file; 54 is the first-hand count. Passing tests without production
  importers do not establish deployed protection: nothing in the
  shipped app calls this evaluator today.
- Per the dead-code skill, test-only use is alive use, and the module
  is a shared spec awaiting integration — the future live
  provider/transaction-observation path must use it as its enforcement
  point, and until a caller supplies real observations no payment may
  be treated as confirmed (module header).
- **Decision needed (owner/lane):** integrate it as the enforcement
  point for a future live provider path, or keep it spec-only. Do not
  silently delete it.

## 7. mnemonic-words in dependencies

**Status: fixed (this branch, this lane).**

- `mnemonic-words` 2.0.0 was in `apps/web/package.json`
  `dependencies` but is used only by
  `apps/web/src/wallet/bip39-wordlist.test.ts` (data-only: the BIP-39
  English wordlist as JSON, for wordlist tests).
- Fix: moved to `devDependencies` (same pinned version 2.0.0);
  `package-lock.json` updated by npm (one-line change: `"dev": true`).
- Verified 2026-11-20 after the move: `npm install` clean,
  `npm run build` exit 0 (includes `tsc --noEmit`), `vite build`
  exit 0, vitest **457/457** (40 files) — identical to the pre-move run.
- **Remains:** none within this finding's scope.

## 8. npm outdated — 53 packages

**Status: documented, still open. No bulk bump.**

- Verified 2026-11-20: `npm outdated --json` in `apps/web` reports
  **53** outdated packages (diagnostics reported 50 on 2026-11-19; the
  drift is registry movement, not a code change). Mostly minor/patch
  bumps (fontsource 5.2.x → 5.3.x, Radix 1.x → 1.x+1, etc.).
  Outdated is a maintenance finding, not automatically a vulnerability:
  vulnerability status is a separate `npm audit` question (0 on the
  diagnostics branch run; not re-run in this lane).
- 17 of the 53 are dependencies the diagnostics deletion removes
  (Radix accordion/alert-dialog/aspect-ratio/collapsible/context-menu/
  dropdown-menu/hover-card/menubar/navigation-menu/scroll-area/slider/
  toggle-group/tooltip, `input-otp`, `react-day-picker`,
  `react-resizable-panels`, `recharts`).
- **Remains:** per-package bumps only, one dependency per change with
  changelog review. No bulk bump was attempted in this lane.

## 9. AGP 8.2.2 vs compileSdk 35

**Status: documented, still open. Flagged, not build-validated here.**

- `apps/android/build.gradle.kts`: AGP 8.2.2. `apps/android/app/build.gradle.kts`:
  `compileSdk = 35`, `minSdk 33`, `targetSdk 35`.
- Google's minimum AGP for API level 35 is **8.6.0**
  (developer.android.com; AGP 8.5's maximum API level is 34). AGP 8.2.2
  is below the supported minimum for `compileSdk 35` and is expected to
  warn ("tested up to compileSdk 34").
- Counter-evidence: the build **did succeed** with this combination —
  `docs/android-evidence.md` (muse-vm, 2026-11-10):
  `./gradlew testDebugUnitTest` BUILD SUCCESSFUL, `./gradlew
  assembleDebug` BUILD SUCCESSFUL in 47 s. So this is an unsupported
  combination that happens to build, not a build failure. Historical
  build success does not establish toolchain support or current
  validation — it only shows it built once, on that machine, on that
  date.
- Not build-validated on gray-pinee: no Android SDK here
  (`/home/boxd/workspace/android-tooling/` does not exist on this VM;
  no Java/Gradle installed).
- **Remains:** bump AGP to ≥ 8.6.0 (Gradle ≥ 8.7) and re-run
  `./gradlew testDebugUnitTest` + `assembleDebug` on a machine with the
  Android toolchain.

## 10. Android pass count — 17 executed vs 57 in the tree

**Status: documented, still open. Unresolved.**

- Executed: **17/17, 0 failures** per `docs/android-evidence.md`
  (muse-vm, 2026-11-10): `ExtendedKeyValidatorTest` 10/10,
  `DerivationPolicyTest` 7/7. That run covered 2 of 5 test classes.
- In the tree (verified first-hand 2026-11-20): **57 `@Test`
  methods** in `apps/android/app/src/test` across 5 classes
  (`DerivationPolicyTest`, `ExtendedKeyValidatorTest`,
  `ConfirmationPolicyTest`, `WalletViewModelTest`,
  `ImportWalletAddButtonTest`).
- The two counts are from different revisions: the 17/17 run is dated
  2026-11-10 and the 57 count is at e493720. Subtracting 17 from 57
  does **not** establish that exactly 40 methods were unexecuted — the
  test classes may have changed between the run and this revision. The
  gap is a cross-revision comparison that needs reconciliation, not a
  measured fact.
- **Remains:** a clean-checkout `./gradlew testDebugUnitTest` on a
  machine with the Android toolchain, reporting the per-class counts
  at the same revision.

## 11. MAINNET-GUIDE header pin e3b65fb8

**Status: documented, still open. Untouched.**

- `docs/mainnet/MAINNET-GUIDE.md:5`: "The code pin is the repair
  commit `e3b65fb832db287fdc8d54794980dd0b3456cc12` (short `e3b65fb8`),
  decided 2026-11-10 — see §5 and M-33." Evidence baseline 2026-11-09
  (research slices M01–M36).
- Verified 2026-11-20: the pin commit exists (2026-11-08, "Repair: fix
  backslash-escaped template literals …") and is **190 commits behind**
  adopt-proper e493720. The guide's evidence baseline is still that
  commit.
- **Remains:** updating the pin is a re-verification exercise (re-run
  the guide's checks at a new commit), not a text edit. Do not bump the
  hash without re-verifying.

## 12. boundary chunk 2.9 MB

**Status: documented, still open.**

- Re-verified first-hand 2026-11-20 (`npm run build` on this branch):
  `dist/assets/boundary-*.js` **2,899.89 kB (gzip 289.58 kB)** — the
  wallet-core WASM glue chunk. Vite warns "Some chunks are larger than
  500 kB after minification". Identical figure to the diagnostics
  measurement; unchanged by the `mnemonic-words` move (§7).
- **Remains:** code-splitting the boundary chunk (dynamic `import()`)
  is a separate decision; the warning is pre-existing, not a regression.

## 13. Slow-4G Generate ~52 s; TRX/TON balance 429s

**Status: documented, still open. No primary measurement artefact found.**

- Reported in the diagnostics report §6 as known open items: cold
  Generate on Slow 4G ~52 s; TRX/TON balance 429s on the shared egress
  IP (rate limiting). Neither was re-measured in this lane, and no log
  or measurement file for either figure was found in the repo or in the
  lane logs on this VM.
- **Remains:** a fresh measurement of both (cold Generate on throttled
  network; TRX/TON balance calls with response codes) to confirm, fix,
  or close. Do not present the figures as current without re-measuring.

## 14. CSS build-2 anomaly (478.77 kB vs 426.24 kB)

**Status: documented, still open. Unexplained 52 kB step; no build-2
artefact survives.**

- Reported in the finalisation brief: built CSS stepped from 426.24 kB
  to 478.77 kB between builds 2 and 3, with builds 3–6 byte-stable.
  No build-2 or build-3 artefact (CSS file or hash) survives in the
  repo, so the step cannot be attributed from the tree.
- Fresh measurement 2026-11-20 on this branch: `dist/assets/*.css`
  **475,498 bytes** (475.5 kB decimal / 464.4 KiB) — near the 478.77 kB
  figure, consistent with builds 3–6 being the current size, but not an
  explanation of the step. The brief's figures state no units, so any
  comparison with them is approximate; historical reports and fresh
  measurements must not be mixed without consistent units and build
  conditions.
- Context: built-CSS selector counts are 563 on adopt-proper vs 414 on
  the diagnostics branch (§4) — the deletion removes 149 selectors, so
  a post-merge CSS size will drop; the anomaly predates that.
- **Remains:** recover the build-2/build-3 artefacts or rebuild both
  commits and diff the CSS; until then the step is unexplained, not
  resolved.

## What this lane deliberately did NOT do

- Did **not** merge `panel-rebuild/org-diagnostics` (coordinator Phase 2
  decision) and did **not** present its fixes as fixed on adopt-proper.
- Did **not** bulk-bump npm packages (§8) or bump AGP (§9) — the latter
  cannot be build-validated on this VM.
- Did **not** delete `confirmation-policy.ts` (§6) — a decision is
  needed first.
- Did **not** create a second home for the ecdsa finding: the full audit
  record stays in `docs/security-AUDIT-TOOLCHAIN.md` §6, the canonical
  summary in `docs/SECURITY.md`, and this register points at both.
- Did **not** touch `main`, push any branch, or delete any branch.

## Verification log (this lane, gray-pinee, 2026-11-20)

- `pip-audit -r requirements.txt`: 2 records, PYSEC-2026-1325, no fix
  versions. Fresh venv: `bip-utils` 2.12.3, `coincurve` 21.0.0,
  `ecdsa` 0.19.2; `USE_COINCURVE: True`.
- `node scripts/secret-scan.mjs`: exit 0, no output.
- `npm outdated --json` (`apps/web`): 53 packages.
- `git merge-base --is-ancestor 82970d2 e493720`: no — diagnostics
  branch is a sibling commit on e493720, not merged.
- `apps/web`: `npm ci` exit 0; vitest 40 files **457/457** (pre- and
  post-`mnemonic-words` move); `npm run build` exit 0 (includes
  `tsc --noEmit`); boundary chunk 2,899.89 kB; built CSS 475,498 bytes.
- `money.test.ts` 86/86; `confirmation-policy.test.ts` 54/54.
- Android `@Test` count: 57 (`grep -rn "@Test"`).
- AGP minimum for API 35 (8.6.0): developer.android.com minimum-versions
  table, checked 2026-11-20.
- Sol calls: 1 (review of this register — see lane RUN-LOG).
  Call 1: prompt 543 words, landed in 142,013 ms, answer 2,319 chars,
  output 2,357 bytes. Sol found no overclaim; its corrections were
  applied (ecdsa scope limit + fallback path, risk-acceptance
  attribution, §5 gate-PASS wording, §6 deployed-protection caveat,
  §10 cross-revision caveat, §14 units).
