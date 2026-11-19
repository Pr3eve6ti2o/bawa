# PR1 — Truth and reproducibility: evidence

Branch: `panel-rebuild/pr1-docs`, worktree `/home/boxd/workspace/bawa-panel-rebuild/pr1-docs/`,
based on `feature/ai-wallet-builder` at `0759a81`. Local commits only; nothing pushed.
Lane model: gpt-6.1-sol, API 1 only. Run log: `RUN-LOG.jsonl`.

## 1. Sources read first-hand

- Guide files on muse-vm (`/home/boxd/workspace/bawa-panel-rebuild/`): `BAWA-REPO-GUIDE.md`
  (156 lines, read in full), `README.draft.md`, `AGENTS.draft.md`,
  `wallet-build.example.json`, `wallet-build.schema.json`.
- Feature-branch files in this worktree: root `README.md` (142 lines), `AGENTS.md`
  (81 lines), `WALLET_BUILDER.md` (110 lines), `scripts/build-wallet.mjs` (310 lines),
  `scripts/classify-request.mjs` (294 lines), `registry/profiles.json` (7 profiles),
  `package.json`, `.github/workflows/ci.yml`, `tests/clean-checkout.test.mjs`,
  `scripts/secret-scan.mjs`.

## 2. Sol calls (2 total)

| Call | Prompt (words) | Output | Status |
|---|---|---|---|
| 1 | `lane/prompt1-readme.md` (272) | `lane/sol1-readme.md` (2,328 bytes) | LANDED in 98 s (`OK answer_chars=2326`) |
| 2 | `lane/prompt2-agents.md` (282) | `lane/sol2-agents.md` (9,321 bytes) | LANDED in 250 s (`OK answer_chars=9321`) |

Both prompts were measured with GNU `wc -w` before launch (≤300 words). No 402/403.
Sol drafted the docs; the lane assembled, corrected and verified every claim first-hand.
The README draft needed two corrections: the builder row's evidence cited the Android
SKIPPED setup instead of builder evidence, and the CLI-generation and watch-only
derivation rows were missing. Both were fixed from first-hand runs below. The
AGENTS.md draft needed merging with `AGENTS.draft.md` items Sol did not cover
(Sol noted it had not inspected the draft): the checked-out-branch start steps,
the per-request workflow table, the structured-builder-not-yet-existent note, the
per-claim evidence tuple, independent test-vector recovery comparison, the
untrusted-input rule, xpub privacy, demo-numbers rule, and the no-push rule. The
draft's `apps/self-custody` row was deliberately NOT carried over: that directory
does not exist on this branch (verified: `apps/` holds only `android` and `web`),
and the owner dropped that dependency on 2026-11-18 ~21:20 IST.

## 3. Quickstart verification (new README, Node 22.23.4, Python 3.12.3)

Run in this worktree; full log `/tmp/pr1-quickstart.log` on muse-vm.

| Command | Exit | Result |
|---|---|---|
| `npm --prefix tools/hdwallet-gen ci --ignore-scripts --no-audit --no-fund` | 0 | install OK |
| `npm run check` | 0 | syntax check OK |
| `npm test` | 0 | `SMOKE TESTS PASSED`; 217 `ok -` lines, 0 `not ok`; `All register-links checks passed` (28 PASS, 0 FAIL) |
| `python3 tools/bawa_cli.py --route "create an HD wallet"` | 0 | `Route: Create an HD Cryptocurrency Wallet`, `Kind: [EXISTING TOOL]`, `Details: python3 tools/make_wallet.py`; nothing executed |

Note: the VM's default Node was v24.22.2, and `npm ci` fails under it with
`EBADENGINE` (repo `.npmrc` sets `engine-strict=true`, engines `>=22 <23`).
Node 22.23.4 (npm 10.9.9, exactly the CI pin) was installed on the VM via nvm
(`nvm install 22.23.4`) and all runs above used it.

### 3b. Regression caught by the final-tree re-run

The first quickstart run (above) passed on the pre-rewrite README. Re-running
`npm test` on the finished tree failed (exit 1): `test/register-links.test.js`
reported 2 failures, `M-16 README §13 overclaim removed` and `M-16 README §13
uses the recorded passphrase policy` (28 PASS dropped to 26). The test requires
the README to contain `do not conclude the funds were never sent to that
address` and `recorded BIP-39 passphrase policy`, and to NOT contain the
overclaim sentence. The new README had shortened the passphrase section away.
Fix: the recorded passphrase-policy troubleshooting paragraph was restored
verbatim from the old README into a `Passphrase policy` section of the new
README. Re-run: exit 0, `SMOKE TESTS PASSED`, `All register-links checks
passed`, 217 `ok`, 0 `not ok`, 28 PASS, 0 FAIL (log `/tmp/pr1-final-test2.log`).

## 4. Supported-today table: evidence per row

| Row | Evidence (all run first-hand on this checkout) |
|---|---|
| Local HD generation (CLI) | `test_make_wallet.py`: 85 tests OK; `test_decrypt_seed.py`: 30 tests OK; `test_bawa_cli.py`: 25 tests OK; `python test/differential_test.py`: exit 0, `bip_utils extended reference checks: PASS` (venv `/tmp/pr1-venv`, requirements.txt pinned: cryptography 50.0.2, bip-utils 2.12.3). Log `/tmp/pr1-python.log`, `/tmp/pr1-differential.log`. |
| Watch-only derivation | `npm test`: 217 smoke assertions pass, 0 fail, against published fixtures and the `bip_utils` reference (BTC/ETH/TRX indices 0–1, single TON V4 R2 address). |
| AI wallet builder | Web-wallet success path ran here (see §6): generate/setup/build/test all VERIFIED, exit 0. `node scripts/validate-registry.mjs`: `OK: 4 files, 32 entries validated`, exit 0. |
| Web starter (`apps/web`) | `npm ci` exit 0; vitest 9 files, **144 tests passed**; `npm run build` exit 0. Log `/tmp/pr1-web.log`. Watch-only with demo balances; no browser custody, no send. |
| Android starter (`apps/android`) | **NOT RUN here.** No Java, Gradle or Android SDK on this machine (`JAVA_HOME`/`ANDROID_HOME` unset, `java: command not found`). 5 `*Test.kt` files exist, unrun. The builder reports its Android setup SKIPPED without a toolchain (by design; also seen in `tests/clean-checkout.test.mjs`, 95 ms, pass). |
| Mainnet helpers, offline only | `node --test tests/mainnet-unsigned-tx.test.mjs tests/mainnet-signing.test.mjs tests/mainnet-guards.test.mjs tests/mainnet-fees.test.mjs tests/mainnet-derivation-vectors.test.mjs`: **107 pass, 0 fail**, exit 0. Log `/tmp/pr1-suites.log`. Fixture/offline inputs only; no broadcast, no live send. |
| Route check | Quickstart §3, exit 0. |

## 5. Raw-prompt retention (P0): bug reproduced, then fixed

Baseline (before fix, canary `PR1CANARY7QZ42`, synthetic non-secret string):

```
node scripts/build-wallet.mjs "Create a web wallet PR1CANARY7QZ42 and send BTC to a friend" --out /tmp/pr1-canary-baseline/refusal.json
  -> build-wallet: REFUSED, exit 2; grep -c PR1CANARY7QZ42 refusal.json = 1
node scripts/build-wallet.mjs "What is the weather PR1CANARY7QZ42?" --out /tmp/pr1-canary-baseline/unclassifiable.json
  -> UNCLASSIFIABLE, exit 2; grep count = 1
node scripts/build-wallet.mjs "Create a web wallet and an android wallet PR1CANARY7QZ42" --out /tmp/pr1-canary-baseline/ambiguous.json
  -> AMBIGUOUS, exit 2; grep count = 1
```

Cause (first-hand): `scripts/build-wallet.mjs` wrote the raw `request` field into all
four JSON reports (refusal, unclassifiable, ambiguous, success). `classify-request.mjs`
was NOT changed (routing is PR2's scope).

Fix (this lane, hands-on):
- New pure module `scripts/request-safety.mjs` (no I/O; exported for unit testing):
  `containsSecretInput()` refuses secret-bearing input at the request boundary
  (assignment language such as "my private key is …", extended-private-key shapes,
  64-hex tokens, bare xprv/tprv/zprv/yprv/vprv words; mere mention of a concept is
  NOT a refusal), `classificationFailureCode()` maps failure reasons to fixed error
  codes (the non-ETH reason named the rejected chain, so it is now the fixed code
  `non-eth-evm-chain`; the generic `cannot classify request` is kept verbatim so
  existing report consumers hold), and the fixed `SECRET_INPUT_REFUSAL` sentence.
- `scripts/build-wallet.mjs`: secret-input guard before the F-31 refusal screen;
  the raw `request` field removed from all four reports. Routing/classification
  untouched. No other receipt writer exists: `scripts/generate-project.mjs` takes
  only a profile id and never sees the request; no docs described a report
  `request` field, so no doc schema update was needed.
- New test `tests/build-wallet-canary.test.mjs` (see §6) and a CI step running it
  plus `tests/classifier.test.mjs` in the `node-tests` job
  (`.github/workflows/ci.yml`).

## 6. Canary verification (after fix)

Canary: `PR1-CANARY-7QZ42-NON-SECRET` (synthetic, non-secret; a different string
from the baseline repro, so pre/post runs cannot be confused).

Automated test — `node --test tests/build-wallet-canary.test.mjs tests/classifier.test.mjs`,
log `/tmp/pr1-canary.log`:

```
# tests 40
# pass 40
# fail 0
CANARY-EXIT=0
```

The 8 canary tests all pass by name: refusal / unclassifiable / ambiguous /
secret-private-key / secret-mnemonic paths persist no canary input (report file,
captured stdout+stderr, report JSON, and no `request` key in the report), plus
`containsSecretInput()` boundary unit tests and `classificationFailureCode()` tests.
The other 32 are the existing classifier tests, still passing.

Manual success-path check — `node scripts/build-wallet.mjs "Create a Web wallet
PR1-CANARY-7QZ42-NON-SECRET" --out /tmp/pr1-success/report.json`, log
`/tmp/pr1-success/stdout.log`:

```
BUILD-EXIT=0
report: profile=web-wallet, hasRequestKey=false, generatedFiles=23009
steps: generate:VERIFIED, setup:VERIFIED, build:VERIFIED, test:VERIFIED
grep -c PR1-CANARY-7QZ42-NON-SECRET: report=0, stdout=0, stderr=0
grep -r --exclude-dir=node_modules --exclude-dir=dist -l <canary> generated/web-wallet/ = 0 files
```

Zero leaked-input hits across the report, process output and all generated files
(excluding `node_modules`/`dist` build artefacts). The generated copy was removed
afterwards (`generated/` is gitignored).

Regression suites (same Node 22 run):

```
node --test tests/t46-registry-gate.test.mjs tests/generate-project.test.mjs tests/registry.test.mjs tests/negative-inputs.test.mjs
# tests 84, # pass 84, # fail 0   (log /tmp/pr1-regress.log)
node --test tests/clean-checkout.test.mjs
# tests 3, # pass 3, # fail 0     (log /tmp/pr1-clean.log; web 14.4 s with warm npm cache, android SKIPPED 95 ms, unclassifiable 50 ms)
```

## 7. Open / incomplete

- **Android build not verified here** (no Java/Gradle/SDK on muse-vm; see §4).
  The table says so explicitly; the builder's SKIPPED setup is the designed
  behaviour, not a pass.
- **CI change not executed on GitHub.** The new CI step is committed locally only
  (no push, per lane rules); it has not run on a GitHub runner. It was verified
  locally by running the same command (`node --test tests/build-wallet-canary.test.mjs tests/classifier.test.mjs`, 40 pass, 0 fail).
- **Apps/web is untouched by this lane** (separate fix lane owns it). The web
  starter numbers above are read-only verification runs, not changes.
- **No push.** All work is local commits on `panel-rebuild/pr1-docs` only.

## 8. Files changed

- `README.md` — rewritten from `README.draft.md` (Sol draft + lane corrections).
- `AGENTS.md` — rewritten from `AGENTS.draft.md` (Sol draft + lane merge of draft
  items Sol did not cover; see §2).
- `scripts/build-wallet.mjs` — raw `request` removed from all reports; secret-input
  boundary guard; failure reasons mapped to fixed codes.
- `scripts/request-safety.mjs` — new pure boundary-sanitisation module.
- `tests/build-wallet-canary.test.mjs` — new canary + boundary unit tests.
- `.github/workflows/ci.yml` — new step running the canary + classifier tests.
- `PR1-EVIDENCE.md` (this file), `RUN-LOG.jsonl`, `lane/` (prompts, Sol outputs, run logs).
