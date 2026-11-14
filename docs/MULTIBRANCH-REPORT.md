# Bawa consolidated multi-branch audit report

Owner order 2026-11-14 ~00:33 IST: create the consolidated audit report from the
completed Bawa multi-branch audit, independently verify the dependency files on
every branch, verify all five branch commits, run a final consistency check, and
record the outstanding issues and the exact commands needed to bring the five
commits into their respective remote branches safely.

Repository: `https://github.com/Pr3eve6ti2o/bawa`.
Model for the whole run: **gpt-6.1-sol ONLY, API 2, maximum reasoning effort.**
No Astra, Opus, or DeepSeek. No model fallbacks. Audit lanes M1–M5 ran
2026-11-13; verification lanes C1–C3 and assembly lane C4 ran 2026-11-13/14.

**Push and release status, in one line: nothing has been pushed. All five lane
commits are local only, and this report itself is committed locally only.**

## Status vocabulary used in this report

- **Completed and verified** — the work was done and independently checked
  first-hand on muse-vm (by the lane that did it and, where stated, by a
  verification lane).
- **Completed but not independently reverified** — the lane's own verification
  claims (typically test runs) were recorded but not re-executed by C1–C3.
- **Not performed** — the step was in scope and was not done; the reason is stated.
- **Still outstanding** — an open item carried forward; it is listed, not closed.

## Executive summary

Five branches were audited and updated, not six: a fresh bare-mirror fetch
found exactly five branches in the repository. Each branch was audited in its
own detached-HEAD worktree on muse-vm and now carries exactly one new local
commit (57 files changed in total across the five branches). All five commits
were verified by lane C2 (existence, parent, diff stat, key-fix spot-checks,
worktree cleanliness, remote heads unchanged) — **PASS on all five**. Lane C1
verified the dependency files on every branch — checks 1, 2, 4, 6, 8 PASS;
check 3 PASS on installs with a strict-determinism FAIL as a policy gap;
check 5 PASS (bounded); check 7 PASS with coverage notes. Lane C3 ran the
final consistency check — commit integrity PASS on all five; markdown PASS
qualified; strict link gate FAIL on main and feature (8 broken links at 4
pre-existing locations, none lane-introduced); no-lane-introduced-broken-links
gate PASS on all five; dependency spot-check PASS; documentation accuracy PASS
with 4 residuals; crypto-contract check PASS (narrow).

All five F4 items are CLOSED on the feature branch. No dependency was
downgraded; no undocumented dependency change was found; the crcmod removal
was confirmed safe. No protected cryptographic contract was modified
(AAD, derivation paths, and permission modes are byte-identical base vs lane
on every branch, per C3's targeted check).

Two incidents shaped the run: lane M4's reported completion was rejected as
unverifiable (nothing it claimed exists on the VM) and the hd-wallet work was
re-done from scratch as M4b; and four lanes began in stale local sandboxes
before a location correction forced all work onto muse-vm via boxd.

Nine items remain outstanding (see §8 — none silently closed), including the
wallet-core 4.8.4 → 4.9.3 re-pin on main, main's §18 readiness gates still
FAIL, no release tags, and no pushes.

**New finding from lane C4 (push planning): the feature branch has diverged
from its remote head.** The local feature line (`42e765a`) and the remote head
(`27ff384`) share merge-base `0b2aa29` (main's base): the remote has 11 commits
the local line does not have, and the local line has 89 commits the remote
does not have. A plain push of the feature lane commit (plus this report) to
`origin feature/ai-wallet-builder` would be rejected as non-fast-forward.
The other four lane commits ARE fast-forward descendants of their remote heads
and can be pushed with plain (non-force) pushes — subject to branch protection
on main. No force-push command is given anywhere in this report; the safe
feature path is a merge of `origin/feature/ai-wallet-builder` into the local
feature branch, which needs the owner's direction. See §10.

## 1. Branch discovery

Verified first-hand by fresh bare-mirror clone and fresh fetch. **5 branches
total, not the 6 the owner counted.** No sixth branch exists.

| Branch | Base commit | Base head message | Lane worktree |
|---|---|---|---|
| `main` | `0b2aa29` | docs: refresh recorded state to H8 | `/home/boxd/workspace/bawa-multibranch/main/` |
| `docs-usecase-split` | `d265204` | docs: complete docs/10-operations-and-testing/README.md | `/home/boxd/workspace/bawa-multibranch/docs-usecase-split/` |
| `feat/trust-wallet-reference-implementation` | `c95e0f3` | docs: add differential verification and registry operations | `/home/boxd/workspace/bawa-multibranch/feat-trust-wallet-reference-implementation/` |
| `hd-wallet-professional` | `7631d00` | docs: add complete Nova Shop setup and payment runbook | `/home/boxd/workspace/bawa-multibranch/hd-wallet-professional/` |
| `feature/ai-wallet-builder` | `27ff384` (remote head; local working copy at `4a072fc`, unpushed, before this run) | docs: fix source-audit findings G1, P5-C7, TRON heading | `/home/boxd/workspace/bawa-multibranch/feature-ai-wallet-builder/` |

Bare mirror: `/home/boxd/workspace/bawa-multibranch/repo.git`.
Feature-branch working copy: `/home/boxd/workspace/bawa-builder/bawa`.
Remote heads re-verified by fresh `git ls-remote` during consolidation (lane C4):
main `0b2aa29`, docs-usecase-split `d265204`, feat `c95e0f3`,
hd-wallet-professional `7631d00`, feature `27ff384` — all unchanged from their
bases. **Nothing was pushed anywhere in this run.**

## 2. Branch-by-branch findings

### 2.1 `main` — lane M1 — commit `16c074e` — 14 files, +51/−38 — Completed and verified

Outdated items found:

- False 1.2.0 claim (×3: README, docs/10, Android guide — CHANGELOG heads
  `[Unreleased]` then `[1.1.0]`).
- wallet-core 4.9.2 presented as "the release pin" / "pinned reference" next
  to installed 4.8.4.
- docs/13+14 claimed "both platform drafts pin 4.8.4" (false — Web pins 4.9.2,
  Android AAR tag 4.9.2).
- Broken link docs/10:1383 (78/79).
- bip-utils 2.12.2 one patch behind.
- MAINNET-GUIDE:3008 "4.9.1, the latest stable" stale.

Files updated (14): README.md, CHANGELOG.md (14→27 lines, new Changed+Fixed
under [Unreleased]), requirements.txt (bip-utils==2.12.3), IMPLEMENTATION.md,
docs/03, docs/10, docs/11, docs/13, docs/14, FURTHER-READING.md,
docs/TESTING.md, ANDROID-GUIDE.md, MAINNET-GUIDE.md, WEB-GUIDE.md.

Verification run by the lane (completed, not independently reverified by C1–C3
except where noted): differential test PASS on 2.12.2 and 2.12.3 (identical
addresses); 14/14 unit tests; fresh venv from committed requirements.txt PASS;
`py_compile` OK; Node 22 `npm run check` exit 0, `npm test` exit 0; internal
links 79/79 resolve (see C3 §5.3 for the wider full-tree link result);
README still 1275 lines (§4 assertion PASS); latest stable checked hands-on
(wallet-core 4.9.3, cryptography 50.0.2, bip-utils 2.12.3).

C2 spot-checks (completed and verified): requirements.txt:2
`bip-utils==2.12.3`; the only `1.2.0` hits in README/docs/10/ANDROID-GUIDE are
corrective ("`1.2.0` was never released", "Do not treat 1.2.0 as a reconciled
release version"); CHANGELOG heads `[Unreleased]` then `[1.1.0]`, with Fixed
entries matching the report (bip-utils bump, 1.2.0 reconciliation, docs/10 link
fix to `../15-threat-model-and-theft-prevention/README.md`, 4.9.2/4.9.3
wording); MAINNET-GUIDE.md: 0 occurrences of "4.9.1, the latest stable";
4.9.3 recorded as latest stable (:3006).

C3 spot-checks (completed and verified): CHANGELOG heads `[Unreleased]` then
`[1.1.0]`; remaining 1.2.0 mentions say only "1.2.0 was never released";
4.9.2 mentions remain but qualified as the demonstrated reference (D21),
installed pin stated as 4.8.4; 4.9.3 recorded as latest stable (README,
FURTHER-READING, MAINNET-GUIDE:3006 with "Do not use 4.9.2: GitHub
prerelease"); MAINNET-GUIDE "4.9.1 latest stable" line gone (4.9.1 now only as
a baseline SHA reference).

Still outstanding on main: wallet-core re-pin 4.8.4 → 4.9.3 NOT done (needs a
full re-verification run against the new WASM build); §18 readiness gates
unchanged (recovery rehearsal, full vector coverage, scanning, reproducible
releases, external review still FAIL).

### 2.2 `docs-usecase-split` — lane M2 — commit `c0be1eb` — 10 files, +71/−63 — Completed and verified

Docs-only branch (12 Markdown files; no tools/test/package/requirements/
lockfiles/workflows/CI).

Outdated items found:

- Wrong link/identifier: `@ton/core` → `ton-org/ton` (correct
  `ton-org/ton-core`); tool-map `xrpl/xrpl.js` → `XRPLF/xrpl.js`.
- Stale "current implementation" wording + root `npm install` (docs 04/10).
- False release-gate claim "missing production lockfile as a release blocker"
  (lockfile IS committed on main, pins 4.8.4).
- Provider pricing drift: Alchemy PAYG $0.525 → $0.52 (only drift;
  Infura/Helius/Moralis/Chainstack/Ankr confirmed live).
- Technical wording: BIP-39 256-bit + NFKD, "spendable" → "unspent", viem
  internals, Solana registry/web3.js, descriptor wording, passphrase
  recovery, "$0" headings, BIP-321, duplicate-delivery, SLIP-0010.

Files updated (10): docs/01, 02, 03, 04, 05, 06, 07, 08, 09, 10 (3339→3347
lines). Root README.md and docs/README.md unchanged, no findings.

Verification run by the lane (completed, not independently reverified): all
claims re-verified against VM files (grep + link check + diff); provider
pricing live-checked 2026-11-13 (Alchemy/Helius/Moralis/Infura/Chainstack/
Ankr); doc 07 Telegram-bot example checked live against `nova-shop-assets`
main (60s loop, SWEEP_INTERVAL=60, idempotency, price feeds); doc 03 "130+
blockchains" and "npm beta" verified live; no runnable test suite exists on
this branch (docs-only), so no npm/vitest/Python checks were run here.

C2 spot-checks (completed and verified): file list matches exactly (docs/01–10
only); docs/02:256 — `@ton/core` now points at `ton-org/ton-core`;
docs/02:386,422 + docs/03:129 — `XRPLF/xrpl.js`; docs/03:168 — Alchemy PAYG
`$0.52` per 1M CUs, live rate re-checked 2026-11-13, `$0.525` noted as the
October 5 snapshot value.

Observation (C2 observation A / C3 residual F-C3-2 — still outstanding):
docs/03:124 still reads `` `ton-org/ton` `` for a "TON low-level SDK" row —
byte-identical in base and lane commit, never touched by the lane diff.
Pre-existing; the lane fixed the same wrong identifier in docs/02:256 only.
The docs/02:257 mapping (`@ton/ton` → `ton-org/ton`) is correct, so
docs/03:124 now conflicts with docs/02. Flagged as a follow-up wording item,
not a verification failure.

### 2.3 `feat/trust-wallet-reference-implementation` — lane M3 — commit `44ea253` — 17 files, +257/−48 — Completed and verified

Outdated items found:

- `tools/make_wallet.py` referenced in 5 places but never existed on this
  branch (CI could not pass).
- `test/smoke.test.js` referenced but never existed (`npm test` failed).
- CHANGELOG `1.2.0` vs both package.json `1.1.0`.
- wallet-core pinned 4.8.4 (npm latest 4.9.3); bip-utils 2.12.2 (PyPI latest
  2.12.3).
- docs/README omitted guides 11+12.
- `.env.example` documented unused vars, omitted used ones (`NOVA_ENV`,
  `BAWA_DATA_KEY`).
- **Committed syntax breakage since 2ff0021**: derive.js, derive_daemon.js,
  compare.js contained escaped backticks in template literals
  (`node --check` failed on all three).
- docs/04+10 told users to run root `npm install` (installs nothing);
  docs/04+10 claimed the lockfile was missing (it exists).

Files updated (17): IMPLEMENTATION.md, CONTRIBUTING.md,
`.github/workflows/ci.yml`, `.env.example`, docs/04, docs/10, docs/README,
docs/TESTING.md, package.json, tools/hdwallet-gen/package.json +
package-lock.json (fresh, Node 22.23.4), requirements.txt,
test/smoke.test.js (NEW), derive.js, derive_daemon.js, compare.js
(byte-level un-escaping, 10 literals only).

Verification run by the lane (completed, not independently reverified by C1–C3
except where noted): root `npm run check` + `npm test` PASS ("smoke checks:
PASS"); `npm ci` proof PASS in a temp copy; differential test PASS (fresh venv
from bumped requirements.txt); `py_compile decrypt_seed.py` OK;
`node --check` 4/4 pass; final sweep: no `make_wallet`/`2.12.2` refs, `1.1.0`
only in CHANGELOG history + transitive lockfile deps, `4.8.4` only in the
intentional docs/08 anti-pattern example.

C2 spot-checks (completed and verified): file list matches exactly, incl. NEW
`test/smoke.test.js` (86 lines) and fresh `tools/hdwallet-gen/package-lock.json`
(5,388 bytes); `tools/hdwallet-gen/package.json` —
`@trustwallet/wallet-core: 4.9.3`; `requirements.txt:2` — `bip-utils==2.12.3`;
zero `2.12.2` refs in tracked files at the commit; zero `make_wallet` refs in
tracked files; escaped backticks: fixed-string search returns **0** in
derive.js, derive_daemon.js, compare.js; real template literals remain:
6 + 6 + 8 backticks = 10 literals, matching "10 literals only";
`node --check` (Node v22.23.4) passes on all 4 js files in tools/hdwallet-gen
(compare, derive, derive_daemon, generate); version reconciliation: both
package.json files bumped 1.1.0 → 1.2.0 to match CHANGELOG `## 1.2.0`;
`1.1.0` now occurs only in CHANGELOG history (`## 1.1.0 — Documentation and
hardening pass`) and transitive lockfile deps.

C3 re-ran `node --check` hands-on for feat: PASS on derive.js,
derive_daemon.js, compare.js (Node 22). Caveat (C3): `node --check` proves
syntax only, and a smoke-test file's existence is not a passing smoke test —
the lane's test-run claims were not re-executed by C3.

Note (C3 residual F-C3-4, cross-branch): feat records package version 1.2.0;
main records 1.1.0 ("1.2.0 was never released"). Each branch is internally
consistent (feat bumped package.json up; main corrected CHANGELOG down). A
package version + CHANGELOG heading do not establish that 1.2.0 was released,
so a release-history contradiction is unproven; versions are reported
branch-by-branch.

### 2.4 `hd-wallet-professional` — lane M4b — commit `680c721` — 1 file, +10/−4 — Completed and verified

Docs-only branch (exactly ONE file: README.md, 2,828 lines; no docs/, tools/,
test/, package.json, requirements.txt, .env.example, workflows, CHANGELOG,
IMPLEMENTATION, CONTRIBUTING, SECURITY).

Outdated items found:

- No branch-scope disclosure — guide presented tools/`npm install`/`npm run
  check/test`/`python3 tools/make_wallet.py` as runnable here (none exists on
  this branch).
- Broken external link: `trustwallet/developer/tree/master/wallet-core` →
  HTTP 404 (verified).
- Stale version context: `^4.8.4` caret example read as current.
- Typo: generation steps 8 and 9 run together on one line.

Files updated (1): README.md only, +10/−4.

Verification run by the lane (completed, not independently reverified): all 47
TOC anchors resolve (re-checked after edits); pricing snapshot (Oct 5, 2026)
spot-checked still current (Helius/Chainstack); Node 22.x / Python 3.11+ still
match main's engines; `git diff --check` clean; no runnable test suite exists
on this branch (absence is itself finding #1), so no npm/vitest/tsc/Python
checks could be run here.

C2 spot-checks (completed and verified): single file changed, README.md,
+10/−4; full diff read back: branch scope notice added at top; steps 8 and 9
split onto separate lines; Node engine note now references main's
`package.json` (`>=22 <23`); version snapshot added (:2151); the 404 link
`trustwallet/developer/tree/master/wallet-core` removed (0 occurrences
remaining); remaining Trust Wallet links point at `trustwallet/wallet-core`.

Observation (C2 observation B / C3 residual F-C3-3 — still outstanding):
the new version snapshot says "Main uses Wallet Core `4.8.4`,
`cryptography==50.0.2`, and `bip-utils==2.12.2`" — main's own lane commit in
the same run bumped main to bip-utils 2.12.3. The snapshot line is
lane-introduced and false against post-lane main (though it may describe
pre-lane or remote main, which was not advanced — the date alone does not
resolve the ambiguity). Record as a documentation caveat: the snapshot should
name the revision it describes, or be corrected to 2.12.3. It does not
invalidate the hd commit or its listed changes, and it does not support an
unqualified claim of post-run cross-branch version consistency.

C3 spot-checks (completed and verified): README 2,834 lines (2,828 + 10 − 4,
arithmetic holds); steps 8/9 split onto separate lines (verified in the lane
diff); broken `trustwallet/developer/tree/master/wallet-core` link removed
(replaced by repo-root links); branch-scope notice present at line 3, citing
audited commit `7631d00`; all 47 TOC anchors resolve (link check §5.3: 47
checked, 0 broken).

### 2.5 `feature/ai-wallet-builder` — lane M5 — commit `42e765a` — 15 files, +47/−39 — Completed and verified

Outdated items found:

- WEB-GUIDE pin table presented 4.9.2 as the declared Core pin (added 4.9.3
  qualifier).
- handoff.md said M-31/M-15 OPEN in 3 places (stale after `18ce692` closed
  them).
- CHANGELOG "awaits its first GitHub Actions run" (stale — CI has 51 runs,
  latest at `27ff384` success 2026-11-13, API-verified).
- security-audit.yml used floating `@v4`/`@v5` tags.
- 6 broken relative links (5 `.png` catalogue links pointing at existing
  `.svg` files, 1 root-relative `docs/10` → `docs/15`).
- bip-utils 2.12.2 → 2.12.3 (PyPI latest).

Files updated (15): `.github/workflows/security-audit.yml`, CHANGELOG.md,
IMPLEMENTATION.md, README.md, WALLET_BUILDER.md, apps/android/README.md,
docs/03, docs/10, docs/UI-UX-CATALOGUE.md,
docs/android-wallet/ANDROID-GUIDE.md, docs/handoff.md,
docs/web-wallet/WEB-GUIDE.md, requirements.txt, requirements.lock (PyPI
hashes; `crcmod` removed), test/fixture-oracle.py.

Verification run by the lane (completed, not independently reverified by C1–C3
except where noted): tools: `npm ci` + `npm run check` + `npm test` → smoke
**217 ok**, register-links all pass; web: `npm ci` + typecheck exit 0 +
vitest **144/144 (9 files)** + build exit 0; Python venv from the new lock
(hash-checked): bip-utils 2.12.3, crcmod absent; differential **PASS**,
decrypt 30 OK, make-wallet 85 OK; link check: **189 links, 0 missing**;
Android Gradle build / live-browser Web run NOT re-run (no code/config under
`apps/android` changed; recorded `assembleDebug` exit 0 cited).

C2 spot-checks (completed and verified): file list matches exactly (15 files,
incl. requirements.txt + requirements.lock, security-audit.yml,
apps/android/README.md, docs/handoff.md, test/fixture-oracle.py, WEB-GUIDE.md,
ANDROID-GUIDE.md); F4-1: 0 occurrences of `10.9.9` in docs/handoff.md; F4-2/3:
apps/android/README.md carries the AGP 8.2.2 + SDK 35 note
(`android.suppressUnsupportedCompileSdk=35`, recorded `assembleDebug` exit 0,
upgrade path to AGP ≥ 8.6.0) and the Kotlin 1.9.22 caveat (KGP 1.9.20–1.9.25
fully-supported range vs repo's Gradle 8.7 / AGP 8.2.2); F4-5:
ANDROID-GUIDE:1609 — "...which gives a different seed and, by BIP-39's
construction, different addresses; Bawa uses the empty BIP-39 passphrase.";
security-audit.yml: all four `uses:` lines pin full SHAs (checkout, setup-node,
setup-python, setup-go); `@v4`/`@v5` appear only in trailing `# ...@v4`
comments; `requirements.txt` — `bip-utils==2.12.3`; `requirements.lock` — 0
`crcmod`; WEB-GUIDE:99 — 4.9.3 qualifier present; UI-UX-CATALOGUE: remaining
`.png` refs are all external URLs (exodus.com, rabby.io,
raw.githubusercontent); no relative catalogue `.png` links remain; CHANGELOG:8
— CI note records 51 runs, latest at `27ff384` success 2026-11-13T16:39:49Z.

C3 spot-checks (completed and verified): F4 all verified (handoff.md 0 ×
"10.9.9"; AGP 8.2.2 + SDK 35 note and Kotlin 1.9.22 caveat in
apps/android/README.md:14,16; ANDROID-GUIDE:1609 "by BIP-39's construction";
scope note at ANDROID-GUIDE:756; security-audit.yml 4 × `uses:` pinned to
full SHAs, no floating @v4/@v5; WEB-GUIDE 4.9.3 qualifier (:99); CHANGELOG now
records 51 CI runs, latest at `27ff384` (2026-11-13T16:39:49Z)). Caveat (C3):
grep establishes the claims appear in the files; it does not independently
validate "latest stable" status, live pricing, or the 51-run CI record.

Note (C3 residual F-C3-5): feature handoff M-31/M-15 OPEN statements (3
places) resolved by an added header note (line 3) framing them as 2026-11-10
time-of-writing state, not by editing them. The framing is accurate and
verified present; it resolves the temporal framing, not M-31/M-15 itself, and
a skim reader can still misread the rows as current.

## 3. Dependency and lockfile verification (lane C1)

Lane C1, brief §2. All work first-hand on muse-vm. All 5 branch worktrees
verified at their expected lane HEADs, trees clean. **No dependency file was
changed by this lane. No push was made.** Files inspected on every branch
where present: `package.json`, `package-lock.json`,
`tools/hdwallet-gen/package.json`, `tools/hdwallet-gen/package-lock.json`,
`requirements.txt`, `requirements.lock`, plus CI configs
(`.github/workflows/ci.yml`, `.github/workflows/security-audit.yml`) and, on
the feature branch only, the extra manifests `apps/web/package.json` +
`package-lock.json`, `tools/package.json`, `packages/contracts/package.json`.

### 3.1 Dependency consistency table

Declared = manifest pin; Locked = lockfile pin. Verdicts cross-checked by
Sol P1 and the lane's hands-on parse.

| Branch | File | Declared | Lockfile | Verdict |
|---|---|---|---|---|
| main | package.json | no deps (pkg v1.1.0) | root lock ABSENT | PASS — no root dep graph to lock |
| main | package-lock.json | — | ABSENT | PASS — absence is not a defect |
| main | tools/hdwallet-gen/package.json | @trustwallet/wallet-core 4.8.4 | — | PASS |
| main | tools/hdwallet-gen/package-lock.json | wallet-core 4.8.4 | wallet-core 4.8.4, protobufjs 7.6.6, 14 entries, 0 missing integrity | PASS |
| main | requirements.txt | cryptography 50.0.2, bip-utils 2.12.3 | — | PASS (pins; no lock to compare) |
| main | requirements.lock | — | ABSENT | NOTE — reproducibility gap, see check 3 |
| docs-usecase-split | package.json | ABSENT | — | N/A — docs-only branch |
| docs-usecase-split | package-lock.json | — | ABSENT | N/A |
| docs-usecase-split | tools/hdwallet-gen/package.json | ABSENT | — | N/A |
| docs-usecase-split | tools/hdwallet-gen/package-lock.json | — | ABSENT | N/A |
| docs-usecase-split | requirements.txt | ABSENT | — | N/A |
| docs-usecase-split | requirements.lock | — | ABSENT | N/A |
| feat/trust-wallet-reference-implementation | package.json | no deps (pkg v1.2.0) | root lock ABSENT | PASS — no root dep graph to lock |
| feat/trust-wallet-reference-implementation | package-lock.json | — | ABSENT | PASS — absence is not a defect |
| feat/trust-wallet-reference-implementation | tools/hdwallet-gen/package.json | wallet-core 4.9.3 | — | PASS |
| feat/trust-wallet-reference-implementation | tools/hdwallet-gen/package-lock.json | wallet-core 4.9.3 | wallet-core 4.9.3, protobufjs 7.6.6, 14 entries, 0 missing integrity | PASS — lockfile NEW in lane commit, consistent |
| feat/trust-wallet-reference-implementation | requirements.txt | cryptography 50.0.2, bip-utils 2.12.3 | — | PASS (pins; no lock to compare) |
| feat/trust-wallet-reference-implementation | requirements.lock | — | ABSENT | NOTE — reproducibility gap, see check 3 |
| hd-wallet-professional | package.json | ABSENT | — | N/A — single README.md only |
| hd-wallet-professional | package-lock.json | — | ABSENT | N/A |
| hd-wallet-professional | tools/hdwallet-gen/package.json | ABSENT | — | N/A |
| hd-wallet-professional | tools/hdwallet-gen/package-lock.json | — | ABSENT | N/A |
| hd-wallet-professional | requirements.txt | ABSENT | — | N/A |
| hd-wallet-professional | requirements.lock | — | ABSENT | N/A |
| feature/ai-wallet-builder | package.json | no deps (pkg v1.1.0) | root lock ABSENT | PASS — no root dep graph to lock |
| feature/ai-wallet-builder | package-lock.json | — | ABSENT | PASS — absence is not a defect |
| feature/ai-wallet-builder | tools/hdwallet-gen/package.json | wallet-core 4.9.3 | — | PASS |
| feature/ai-wallet-builder | tools/hdwallet-gen/package-lock.json | wallet-core 4.9.3 | wallet-core 4.9.3, protobufjs 7.6.6, 14 entries, 0 missing integrity | PASS |
| feature/ai-wallet-builder | requirements.txt | cryptography 50.0.2, bip-utils 2.12.3, pynacl 1.6.2, requests 2.34.2 | — | PASS |
| feature/ai-wallet-builder | requirements.lock | all 4 txt pins | all 4 MATCH (22 entries, all hash-covered, 0 dupes, crcmod absent) | PASS |

Extra manifests (feature branch only, outside the brief's 6-file list):
`apps/web/package.json` deps == `apps/web/package-lock.json` root deps exactly
(wallet-core locked 4.9.3, react 19.2.5, vite 8.3.8; 314 entries, 0 missing
integrity). `tools/package.json` (bawa-tools) and
`packages/contracts/package.json` (@bawa/contracts 0.1.0) declare no
dependencies.

### 3.2 Check-by-check verdicts (brief §2, checks 1–8)

**1. Declared versions match lockfiles — PASS (where a lockfile exists).**
All three tools manifest/lock pairs agree (main 4.8.4; feat + feature 4.9.3);
feature's four Python pins all match its lock. Main/feat have no Python lock,
so no declared-vs-locked Python comparison is possible there — that is the
check-3 gap, not a mismatch. Docs + hd branches have no files to compare (N/A).

**2. No undocumented dependency changes — PASS (reconciled hands-on).**
Every lane-commit dependency change is accounted for in the multi-branch audit
report (§2 above):

| Lane | Dep change | In report? |
|---|---|---|
| main | requirements.txt bip-utils 2.12.2 → 2.12.3 | Yes (§2.1) |
| docs-usecase-split | none | Yes (docs-only, no findings on dep files) |
| feat | tools wallet-core 4.8.4 → 4.9.3; tools lockfile NEW (+129 lines); requirements.txt bip-utils → 2.12.3; root + tools package version 1.1.0 → 1.2.0; ci.yml py_compile drops make_wallet.py | Yes (§2.3) |
| hd-wallet-professional | none | Yes (1-file README-only lane) |
| feature | requirements.txt bip-utils 2.12.2 → 2.12.3; requirements.lock hashes updated, crcmod==1.7 removed; security-audit.yml actions pinned to SHAs | Yes (§2.5) |

Clarifications from the close-out: feature's wallet-core 4.9.3 and the
pynacl/requests floor pins were already present at base `4a072fc` — they are
NOT lane additions. Feature's base lock already pinned bip-utils 2.12.2
(hashes `385ecd94…`/`638856b9…`); the lane moved it to 2.12.3 (hashes
`3b821882…`/`5413e9a6…`). Feat's base `c95e0f3` had NO tools lockfile — the lane
created it. No undocumented change was found on any branch.

**3. Python dependencies reproducibly installable — PASS on installs; FAIL
(strict determinism) as a policy gap.** Fresh-venv installs on the VM
(Python 3.12.3) all exited 0: main + feat from `requirements.txt` (installed
bip-utils 2.12.3, cryptography 50.0.2; transitives resolved to PyNaCl 1.6.2,
requests 2.34.2 — exactly feature's floor pins); feature from
`requirements.lock` with `--require-hashes` (exit 0, `pip check`: "No broken
requirements found", installed set of 22 packages matches the lock's 22
entries exactly modulo `_`/`-` normalisation). Strict-determinism gap: main/
feat have no requirements.lock and CI installs from `requirements.txt`, so
transitive versions are not frozen; feature HAS a hashed lock but its ci.yml
still installs from `requirements.txt` instead of the lock. No install failure
was observed; this is reproducibility hardening, not a break. No version change
is warranted on this evidence. NOT VERIFIED: installs on CI Python 3.13/3.13.18
— no Python 3.13 exists on the VM, so this could not be tested here.

**4. Node dependencies install using committed lockfiles — PASS.**
`npm ci` in temp copies exited 0 on all three branches (14 packages each;
installed wallet-core matches declared: main 4.8.4, feat + feature 4.9.3).
`npm run check` exited 0 on all three. `npm test`: main PASS (14 smoke
checks), feat PASS ("smoke checks: PASS"), feature PASS in a full-layout temp
copy ("All register-links checks passed", exit 0). Two earlier feature runs in
partial temp copies failed with ENOENT on docs files (MAINNET-GUIDE.md, then
GLOSSARY.md, then README.md) — harness artefacts of the incomplete copy, not
repo defects; the full copy passes.

**5. No accidental duplication or unnecessary packages — PASS (bounded).**
No duplicate names in feature's requirements.txt or requirements.lock.
Feature's pynacl/requests floor pins add no packages beyond what main/feat
already resolve transitively at the same versions. No unnecessary package was
introduced by any lane. Bounded: whole-graph necessity (every transitive
package used) was not proven — that would need a usage/import audit, which was
not in evidence. No removal is justified on current evidence. Wallet-core
appearing in both `tools/hdwallet-gen` and `apps/web` is two separate projects
pinning the same version (4.9.3), not accidental duplication.

**6. No security-sensitive downgrades — PASS.** No dependency version went
down in any lane delta: bip-utils 2.12.2 → 2.12.3 (all three branches),
wallet-core 4.8.4 → 4.9.3 (feat). Main retaining wallet-core 4.8.4 is not a
downgrade (re-pin to 4.9.3 remains a known open item, pending full WASM
verification — not a C1 change). Removing crcmod is a removal, not a
downgrade. Action tag → SHA pins in security-audit.yml change reference form,
not versions. This finding does not certify absence of vulnerabilities.

**7. Runtime/engine requirements match CI configs — PASS (with coverage
notes).** Engines everywhere: node `>=22 <23`, python `>=3.11`. Main/feat
ci.yml: setup-node@v4 node 22, setup-python@v5 python 3.13 — inside the
ranges. Feature ci.yml: node 22.23.4 exact + npm 10.9.9 assertion, python
3.13.18 exact + assertion — inside the ranges; VM node v22.23.4 / npm 10.9.9
match the assertions. Feature security-audit.yml: node 22, python 3.13, Go
1.27.3 (no declared Go requirement exists in the repo to compare against —
not verifiable). Notes: (a) main/feat CI uses `npm install`, not `npm ci` —
weaker lock enforcement than feature's `npm ci`; the successful local `npm ci`
runs prove the locks installable, not that main/feat's CI command was executed.
(b) Feature ci.yml has NO apps/web or apps/android job; apps/web is covered
only by security-audit.yml (`npm audit` in apps/web + OSV-Scanner over both
lockfiles) — and that workflow has never run on GitHub. (c) Actual GitHub
Actions runs at these HEADs were not verified (no runs exist to inspect).

**8. No conflicting/incompatible pins — PASS.** Feature's four pins match its
lock; the floor pins (pynacl 1.6.2, requests 2.34.2) match what fresh main/feat
installs resolve transitively; the hash-checked lock install succeeded and
`pip check` is clean. No conflict observed in the tested (Python 3.12.3)
environment. Note: the lock was generated with Python 3.12 while feature CI
targets 3.13.18 — lock compatibility with 3.13 was not tested here (no Python
3.13 on the VM); bip-utils 2.12.3 metadata requires coincurve ≥21.0.0 on
Python ≥3.13 and the lock pins coincurve 21.0.0, which satisfies it.

### 3.3 Current stable releases (checked live 2026-11-13, npm view / pip index)

| Package | Pinned (branches) | Current stable | Action |
|---|---|---|---|
| @trustwallet/wallet-core | 4.8.4 (main), 4.9.3 (feat, feature) | 4.9.3 | None — main's 4.8.4 is the known open re-pin, needs its own verification; not a C1 change |
| bip-utils | 2.12.3 (all) | 2.12.3 | None |
| cryptography | 50.0.2 (all) | 50.0.2 | None |
| pynacl | 1.6.2 (feature) | 1.6.2 | None |
| requests | 2.34.2 (feature) | 2.34.2 | None |
| protobufjs (transitive) | 7.6.6 (all tools locks) | 8.8.1 | None — 8.x is a major outside wallet-core's `^7.6.3` range; do not force |

No upgrade is warranted on freshness grounds for any package (brief rule: do
not upgrade simply because newer versions exist).

### 3.4 crcmod removal — confirmed safe

- bip-utils 2.12.3 package metadata (`Requires-Dist`) contains NO crcmod
  requirement (deps: cbor2, coincurve, ecdsa, ed25519-blake2b-fork,
  pycryptodome, pynacl, py-sr25519-bindings, pytoniq-core-fork,
  typing_extensions + dev extras).
- Zero `crcmod` references anywhere in the feature worktree (grep, excluding
  .git/node_modules).
- Fresh hash-checked lock install succeeds without crcmod; `pip check` clean.
No re-addition warranted.

### 3.5 Dependency gaps and items NOT verified (do not close silently)

1. Python installs/tests on CI Python 3.13 / 3.13.18 (feature lock generated
   on Python 3.12; VM has no Python 3.13). Close with fresh-venv logs on 3.13.
2. Actual GitHub Actions runs of ci.yml at these HEADs (main/feat/feature)
   and of security-audit.yml (never run). Close with Actions logs.
3. `apps/web` `npm ci` + build/test and apps/android build — no web/Android
   job in ci.yml; web install was not run by this lane (lock consistency only,
   statically verified). M5's manual web results (vitest 144/144) were cited,
   not re-run here.
4. Whole-graph necessity audit (check 5, full scope) — would need a
   usage/import audit.
5. Strict Python reproducibility hardening (recommendation, not a break):
   add/maintain requirements.lock for main/feat, make feature CI consume its
   existing hashed lock, switch main/feat CI to `npm ci`. None of these is a
   dependency change and none was applied — they need owner/coordinator
   direction, since the lanes were verification-only.

**C1 summary:** dependency consistency holds on all five branches: every
declared-vs-locked pair that exists agrees (tools wallet-core 4.8.4 on main,
4.9.3 on feat and feature; feature's four Python pins match its hashed lock);
docs-usecase-split and hd-wallet-professional have no dependency files at all.
All lane dependency changes are accounted for in the audit report — none
undocumented, none a downgrade. Node installs (`npm ci`), checks, and smoke
tests pass on all three executable branches; Python installs pass from
requirements.txt (main/feat) and the hash-checked lock (feature), with
`pip check` clean and crcmod's removal confirmed safe by package metadata and
a worktree-wide grep. All pinned packages are at current stable except main's
wallet-core 4.8.4 (known open re-pin) and transitive protobufjs 7.6.6 (8.x is
outside wallet-core's declared range) — neither warrants a change here.
Remaining gaps are reproducibility hardening, not breaks.

## 4. Branch-by-branch commit verification (lane C2)

Lane C2, brief §3. Verified first-hand on muse-vm, 2026-11-13 19:07–19:09 UTC.
All git evidence is in the C2 lane dir (`evidence/` scripts + raw outputs).
No pushes, merges, checkouts, or edits were made by this lane.

### 4.1 Commit verification table

| Branch | Expected commit | Exists | Parent matches | Diff stat matches report | Key fixes spot-checked | Worktree clean | Remote head unchanged | Verdict |
|---|---|---|---|---|---|---|---|---|
| main | `16c074e68c27a501902b8c05b5999e27e0dcd305` | YES | YES (`0b2aa295079ec10eaf397b6202e470a9fe6e547e`) | YES — 14 files, +51/−38 | YES (§2.1) | YES, detached HEAD at `16c074e` | YES — `0b2aa29` (live ls-remote) | **PASS** |
| docs-usecase-split | `c0be1eb66e2827a97a5c914dba0a86352b0cccce` | YES | YES (`d2652045c2d105e64bc38963f0ce1dd88ad4b562`) | YES — 10 files, +71/−63 | YES (§2.2) | YES, detached HEAD at `c0be1eb` | YES — `d265204` (live ls-remote) | **PASS** |
| feat/trust-wallet-reference-implementation | `44ea253bf49de1416e000c50b23d4c232b0cbb58` | YES | YES (`c95e0f30f1224945450fb530c135ec7512ca5a13`) | YES — 17 files, +257/−48 | YES (§2.3) | YES, detached HEAD at `44ea253` | YES — `c95e0f3` (live ls-remote) | **PASS** |
| hd-wallet-professional | `680c72186163c73aaab7f56613a376c1087c9fa5` | YES | YES (`7631d00923e0436d17bf60bb1b36e84c56fafb67`) | YES — 1 file, +10/−4 | YES (§2.4) | YES, detached HEAD at `680c721` | YES — `7631d00` (live ls-remote) | **PASS** (with observation B, §4.2) |
| feature/ai-wallet-builder | `42e765a0768b99815196f62e113df1a2fc6e7ef8` | YES | YES (`4a072fcfe5a1d7fb87ba9987c1641fa605be94df`) | YES — 15 files, +47/−39 | YES (§2.5) | YES, detached HEAD at `42e765a` | YES — `27ff384` (live ls-remote) | **PASS** |

Additional checks, all confirmed on the VM:

- **One-commit advance:** each range base..lane-commit contains exactly one
  commit (`git log --oneline` per range — 1 line each).
- **No branch overwritten (local refs):** bare-repo `refs/heads/*` still point
  at the bases: main `0b2aa29`, docs-usecase-split `d265204`, feat `c95e0f3`,
  hd-wallet-professional `7631d00`, feature `27ff384`. No lane commit is on any
  branch ref; all five sit as detached-HEAD commits reachable only from the
  worktrees. (Re-confirmed by lane C4: bare refs unchanged at consolidation
  time.)
- **Rejected M4 commit absent:** `ea03893`
  (`ea038930ecf5c8c9577476332216c14c0ccf78bd`) is NOT in the VM bare repo
  (`git cat-file -t` fails). The rejection stands.
- **Lane dirs present on VM:** all five `*-lane/` dirs exist with `REPORT.md`
  + `RUN-LOG.jsonl` (main 8,416/1,753 bytes; docs 18,714/1,760; feat 8,515/2,498;
  hd 11,021/672; feature 12,264/1,582).
- **Feature working copy:** already fast-forwarded to `42e765a`, clean, when
  C2 checked (coordinator's fast-forward; see §4.3).

### 4.2 C2 observations (do not change any PASS verdict)

- **A — docs/03:124 `ton-org/ton` row.** Pre-existing base content, untouched
  by the lane commit, outside the report's claimed docs/02 fix. Flagged as a
  possible follow-up wording item, not a verification failure. (See §2.2 and
  residual F-C3-2.)
- **B — hd README snapshot vs main's bump.** The snapshot line ("Main uses ...
  bip-utils==2.12.2") disagrees with post-lane main (2.12.3) but may describe
  pre-lane or remote main, which was not advanced — the date alone does not
  resolve the ambiguity. Record as a documentation caveat: the snapshot should
  name the revision it describes, or be corrected. It does not invalidate the
  hd commit or its listed changes, and it does not support an unqualified claim
  of post-run cross-branch version consistency. (See §2.4 and residual F-C3-3.)

### 4.3 Feature working copy fast-forward (brief §3 item f)

Checked by C2 2026-11-13 19:07 UTC at `/home/boxd/workspace/bawa-builder/bawa`
on the VM: HEAD was **already `42e765a`**, tree clean
(`git status --porcelain` empty). `4a072fc` is the parent of `42e765a` and an
ancestor of the working-copy HEAD; `git log --oneline 4a072fc..HEAD` is exactly
that one commit. The coordinator had already performed the planned
fast-forward before this check. The brief's "still at `4a072fc`" state no
longer held at check time — this is the expected post-fast-forward state, a
clean advance, not an overwrite. "Preserved" is therefore satisfied as:
original working copy intact, advanced by exactly the lane commit, no other
changes. Lane C4 re-verified the same state before writing this report (HEAD
`42e765a`, tree clean).

Note on the working copy's local branch name (lane C4, first-hand): the working
copy's only local branch is named `main` (tracking `origin/main`, ahead 89),
while its content is the feature-branch line. This report was therefore
committed on a newly created local branch `feature/ai-wallet-builder` at
`42e765a` in that working copy; the local `main` branch was left untouched at
`42e765a`. See §10.5.

### 4.4 What C2 did NOT re-run

The only check C2 did NOT re-run is execution of the test suites
(npm/vitest/Python) — those are the lanes' own verification claims, already
recorded in §2, and re-running them is outside commit-verification scope.
Every other brief §3 item was verified first-hand on the VM: existence,
parent, intended changes via diff stat + file lists + grep/read-back
spot-checks, worktree cleanliness, remote heads unchanged via live
`git ls-remote origin` plus bare-repo refs, working-copy state. No check was
skipped, and no result was inferred from the local sandbox mirror.

## 5. Final consistency check (lane C3)

Lane C3, brief §5. Read-only lane: nothing edited, committed, pushed, merged,
or deleted anywhere. Mainnet/production readiness is NOT marked PASS anywhere.
All C3 checks ran on muse-vm via boxd. Mechanical checks (git, grep, Python
link/dependency checkers, markdownlint) were run hands-on as scripts, not as
model calls.

### 5.1 Verdicts at a glance

| Check | Verdict |
|---|---|
| Commit integrity (HEAD = lane commit, parent = base, clean tree) | **PASS, all 5 branches** |
| Markdown formatting (structure + markdownlint base-vs-lane) | **PASS, qualified** (no new rule class; deltas are long lines) |
| Internal documentation links, strict gate (every checked link resolves) | **main FAIL, feature FAIL; docs / feat / hd PASS** |
| Internal links, no-lane-introduced-broken-links gate | **PASS, all 5** |
| Dependency / lockfile spot-check (spec vs lock where lockfiles exist) | **PASS (spot-check)**; confirms C1 inventory; lock completeness not established |
| Branch-specific documentation accuracy (spot-checks) | **PASS with 4 residual items** (F-C3-2 to F-C3-5) |
| Crypto identifiers / derivation paths / permissions / security contracts | **PASS, narrow** (checked literals + file modes unchanged; see §5.6 for the scope limit) |

Commit integrity detail (evidence: C3 `evidence/c3-git.txt`):

| Branch | HEAD (lane commit) | Parent (base) | `status --porcelain` | Diff (base..lane) | `diff --check` |
|---|---|---|---|---|---|
| main | `16c074e68c27a501902b8c05b5999e27e0dcd305` | `0b2aa295079ec10eaf397b6202e470a9fe6e547e` | empty | 14 files, +51/−38 | clean |
| docs-usecase-split | `c0be1eb66e2827a97a5c914dba0a86352b0cccce` | `d2652045c2d105e64bc38963f0ce1dd88ad4b562` | empty | 10 files, +71/−63 | clean |
| feat/trust-wallet-reference-implementation | `44ea253bf49de1416e000c50b23d4c232b0cbb58` | `c95e0f30f1224945450fb530c135ec7512ca5a13` | empty | 17 files, +257/−48 | clean |
| hd-wallet-professional | `680c72186163c73aaab7f56613a376c1087c9fa5` | `7631d00923e0436d17bf60bb1b36e84c56fafb67` | empty | 1 file, +10/−4 | clean |
| feature/ai-wallet-builder | `42e765a0768b99815196f62e113df1a2fc6e7ef8` | `4a072fcfe5a1d7fb87ba9987c1641fa605be94df` | empty | 15 files, +47/−39 | clean |

Every lane commit exists in the worktree repo AND in bare `repo.git`. Every
diff stat and file list matches §2. Feature working copy
`/home/boxd/workspace/bawa-builder/bawa` is at `42e765a`, tree clean
(coordinator's fast-forward, verified first-hand). Remote heads (best-effort
`git ls-remote`, C2 owns this check): main `0b2aa29`, docs-usecase-split
`d265204`, feat `c95e0f3`, hd-wallet-professional `7631d00`, feature `27ff384`
— all unchanged from their bases. No branch overwritten; nothing pushed by C3.

### 5.2 Markdown formatting — PASS, qualified

Tool: markdownlint-cli 0.44.0, default config, Node 22 (npx on the VM).
Structural: **0 files with unbalanced fenced code blocks** on every branch.
Trailing-whitespace lines: main 105, docs 0, feat 0, hd 0, feature 124
(pre-existing style; not treated as failure).

Base-vs-lane violations on lane-changed .md files only:

| Branch | Changed .md files | Base | Lane | Delta |
|---|---|---|---|---|
| main | 13 | 5,273 | 5,280 | +7, all MD013 line-length |
| docs-usecase-split | 10 | 329 | 342 | +13, all MD013 |
| feat-trust-wallet-reference-implementation | 7 | 122 | 121 | −1 MD013 |
| hd-wallet-professional | 1 | 289 | 292 | +4 MD013, −1 MD029 (class removed) |
| feature-ai-wallet-builder | 11 | 3,704 | 3,709 | +5, all MD013 |

**No new markdownlint rule class was introduced by any lane** (proven by full
per-rule set comparison, base vs lane; hd's only class change is the removal
of MD029). Full-tree default-config counts are 292–9,297 per branch (main
7,803; docs 351; feat 445; hd 292; feature 9,297), dominated by pre-existing
MD013 (80-column) long lines, MD033 inline HTML in tables, and MD025/MD036
house style. The repo has no markdownlint config, so a raw
default-config count is not a pass/fail gate; the C3 verdict rests on the
base-vs-lane delta, which shows no new breakage class. Scope limit: fence
balance is not an exhaustive structural check; no other structural breakage was
evidenced.

### 5.3 Internal documentation links — main FAIL, feature FAIL (strict gate); all PASS (no-lane-introduced gate)

Checker: Python, all .md files per worktree excluding `.git` and
`node_modules`; inline links + reference definitions; anchors checked with the
GitHub slug algorithm (lowercase, drop punctuation except word chars/spaces/
hyphens, replace EACH space with one hyphen, duplicate headings get `-1`);
footnote definitions excluded. External http/https links counted but NOT
live-checked.

| Branch | .md files | Internal links checked | Broken | External (not live-checked) |
|---|---|---|---|---|
| main | 32 | 229 | 4 | 471 |
| docs-usecase-split | 12 | 20 | 0 | 118 |
| feat-trust-wallet-reference-implementation | 22 | 28 | 0 | 138 |
| hd-wallet-professional | 1 | 47 | 0 | 118 |
| feature-ai-wallet-builder | 76 | 339 | 4 | 518 |
| **Total** | **143** | **663** | **8** | **1,363** |

The 8 broken are **4 shared source locations, 3 distinct missing anchors,
identical on main and feature**:

1. `docs/web-wallet/WEB-GUIDE.md:43,49` — `#b-prerequisites-and-project-setup`
   (×2). The heading is `## B. Prerequisites and toolchain` (line 74), slug
   `b-prerequisites-and-toolchain`. GitHub keeps no alias for the old heading
   title.
2. `docs/12-chain-registry-and-assets/README.md:39` —
   `../GLOSSARY.md#trust-wallet-core-registry`. GLOSSARY.md has exactly one
   heading (`# Glossary`) and no HTML anchors or ids.
3. `docs/12-chain-registry-and-assets/README.md:56` —
   `../GLOSSARY.md#hrp`. Same cause.

**All four are pre-existing**: verified present with identical text in the
base revisions (main `0b2aa29`, feature `4a072fc`); neither lane's diff changed
those lines (docs/12 is in neither lane diff; the WEB-GUIDE lines are
untouched). **All file targets (non-anchor part) resolve on every branch.**
Independent corroboration: markdownlint's own MD051/link-fragments rule flags
2 on main and 2 on feature at BOTH base and lane — pre-existing.

Correction to C3's own first count: an early checker version reported 383
broken. That was checker error (vendored `node_modules` READMEs counted,
footnote definitions counted as links, heading-slug space runs collapsed to
one hyphen). All three bugs were fixed and each fix confirmed by direct
grep/read-back; the v2 numbers above are the checked result. `node_modules`
READMEs are third-party dependency docs, not repo documentation, and are
excluded from the counts.

Scope limits: external links not live-checked; HTML `<a href>` links not
covered; reference-style `[text][ref]` usages with missing definitions not
covered. The lanes' narrower claims (main "79/79", feature "189 links,
0 missing") are not contradicted within their own scopes, which C3 could not
reconstruct; on C3's full-tree scope the 4 stale anchors above survive at both
lane HEADs.

### 5.4 Dependency and lockfile consistency (spot-check) — PASS

Spot-check only; it does NOT redo lane C1's full audit (see §3). C1's report
was not yet written when C3 ran, so no C1 conclusions were compared — C3
confirms C1's inventory facts (file presence + lane diffs) and adds spec-vs-lock
checks.

| Branch | Root package.json | Root lockfile | tools/hdwallet-gen spec vs lock | requirements.txt vs requirements.lock |
|---|---|---|---|---|
| main | 1.1.0, no deps declared | absent | wallet-core 4.8.4 = locked 4.8.4 OK | txt: cryptography 50.0.2, bip-utils 2.12.3; lock absent |
| docs-usecase-split | absent | absent | n/a (no files) | n/a |
| feat-trust-wallet-reference-implementation | 1.2.0, no deps declared | absent | wallet-core 4.9.3 = locked 4.9.3 OK | txt: 50.0.2 / 2.12.3; lock absent |
| hd-wallet-professional | absent | absent | n/a (no files) | n/a |
| feature-ai-wallet-builder | 1.1.0, no deps declared | absent | wallet-core 4.9.3 = locked 4.9.3 OK | txt 4 pins all match lock (22 package entries, 944 lines, 885 hash lines); crcmod absent from lock |

No spec/lock mismatch found anywhere a lockfile exists. No security downgrade
observed in the spot-check (wallet-core 4.8.4 on main is the outstanding re-pin
item, recorded as open, not a lane regression; feat and feature are on 4.9.3).
Limitations: a dependency-free root package lacking a root lockfile is not
itself inconsistent; missing `requirements.lock` on main/feat is a
reproducibility limitation, not a demonstrated pin mismatch; feature's four
matching pins do not establish completeness of its 22-entry lock; `crcmod`
absence is a finding only if it is required — C1 established that it is not
required (see §3.4: crcmod removal confirmed safe). (Correction: C3's §4
table said "907 entries" for this lock; a first-hand count by lane C4 is 22
package entries in 944 lines with 885 hash lines — the 907 figure is not
used in this report.)

### 5.5 Branch-specific documentation accuracy — PASS with residuals

Spot-checks (2–3+ claimed fixes per branch, by grep/read-back; `node --check`
re-run hands-on for feat). Detail per branch is in §2.1–§2.5; residuals are
F-C3-2 to F-C3-5 in §5.7.

### 5.6 Cryptographic identifiers, derivation paths, permissions — PASS, narrow

Whole-tree `git grep` counts at base vs lane, plus the lane diff, for AAD
`nova-shop-seed-v1`, derivation paths `m/84'/0'/0'/0/i`, `m/44'/60'/0'/0/i`,
`m/44'/195'/0'/0/i`, `m/44'/607'/0'`, and modes `0700` / `0600`.

| Branch | nova-shop-seed-v1 | m/84'/0'/0'/0/i | m/44'/60'/0'/0/i | m/44'/195'/0'/0/i | m/44'/607'/0' | 0700 | 0600 |
|---|---|---|---|---|---|---|---|
| main | 22 / 22 | 29 / 29 | 22 / 22 | 20 / 20 | 40 / 40 | 21 / 21 | 61 / 61 |
| docs-usecase-split | 0 / 0 | 1 / 1 | 3 / 3 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| feat | 3 / 3 | 1 / 1 | 3 / 3 | 1 / 1 | 0 / 0 | 0 / 0 | 4 / 4 |
| hd | 0 / 0 | 1 / 1 | 2 / 2 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| feature | 32 / 32 | 67 / 67 | 60 / 60 | 53 / 53 | 84 / 84 | 35 / 35 | 88 / 88 |

(Counts are base / lane; identical on every branch.)

Every diff hit was read back and is a **context line only**, not a change: the
`m/44'/195'/0'/0/i` hunk-header line on docs-usecase-split (the changed line
below it is prose); the "Filesystem rules: secrets/ 0700; seed.enc.json 0600;
..." context line on main and feature; the TON fixture context line on feature.
No Git file-mode changes on any branch except feat's two new files created at
normal mode 100644 (`test/smoke.test.js`,
`tools/hdwallet-gen/package-lock.json`) — not changes to existing secret-file
permissions.

**Scope limit (adopted):** "No changes were observed to the checked
crypto-contract literals or existing Git file modes. This targeted check does
not establish complete security-behavior equivalence." Unchanged counts alone
would not prove invariance, and hunk inspection does not rule out semantic
changes elsewhere (e.g. authentication handling or runtime permission
enforcement). C3 does not claim a blanket security-contract pass.

### 5.7 C3 findings (residual items)

- **F-C3-1 (minor, pre-existing) — 4 stale anchors survive at main +
  feature lane HEADs** (§5.3: WEB-GUIDE `#b-prerequisites-and-project-setup`
  ×2; docs/12 → GLOSSARY.md `#trust-wallet-core-registry`, `#hrp`).
  Strict link gate fails main and feature on these; no-lane-introduced gate
  passes everywhere. List; do not hold the report.
- **F-C3-2 (minor, lane missed an instance) — docs-usecase-split
  docs/03:124 still maps "TON low-level SDK" to `ton-org/ton`.** The lane
  fixed the same wrong identifier in docs/02:256 only
  (`→ ton-org/ton-core`). Line identical at base and lane; no TON lines in
  the docs/03 lane diff. The docs/02:257 mapping (`@ton/ton` →
  `ton-org/ton`) is correct, so docs/03:124 now conflicts with docs/02.
  List; do not hold.
- **F-C3-3 (minor, lane-introduced) — hd README:2151 version snapshot,
  added by the lane, says "Main uses ... bip-utils==2.12.2".** False after
  the main lane bumped main to 2.12.3 the same day; the same sentence
  correctly lists latest stable 2.12.3. Correct it or anchor it to a
  historical main SHA. List if unresolved; not a report blocker when
  disclosed.
- **F-C3-4 (note, cross-branch) — feat records package version 1.2.0;
  main records 1.1.0 ("1.2.0 was never released").** Each branch is
  internally consistent (feat bumped package.json up; main corrected
  CHANGELOG down). A package version + CHANGELOG heading do not establish
  that 1.2.0 was released, so a release-history contradiction is unproven;
  report the versions branch-by-branch. List; do not hold.
- **F-C3-5 (note) — feature handoff M-31/M-15 OPEN statements (3 places)
  resolved by an added header note (line 3)** framing them as 2026-11-10
  time-of-writing state, not by editing them. The framing is accurate and
  verified present; it resolves the temporal framing, not M-31/M-15
  itself, and a skim reader can still misread the rows as current. List;
  do not hold; do not claim the issues are closed from the header alone.

None of F-C3-1 – F-C3-5 is a demonstrated blocker to publishing a
**qualified** consolidated report. F-C3-2 and F-C3-3 do prevent an
unqualified claim that all relevant documentation errors were eliminated.

### 5.8 What C3 did NOT check (explicit)

- External (http/https) links live: 1,363 counted, none fetched.
- Live-browser verification (e.g. TronScan Approval tab) and test re-runs:
  out of C3 scope. Lane test claims (smoke 217 ok, vitest 144/144, 14/14
  unit tests, differential PASS) were NOT re-executed, except feat
  `node --check` 3/3 PASS hands-on.
- "Latest stable" version claims, live provider pricing, and the 51-run CI
  record were verified only as text present in the files, not against live
  sources.
- C1's dependency conclusions: C1's report was not yet written when C3 ran —
  C4 compared the completed C1 report (§3) with C3's spot-check (§5.4): they
  agree (no spec/lock mismatch; crcmod non-requirement established by C1 §3.4;
  main/feat missing Python lock is a reproducibility limitation in both).
- Remote-head verification is C2's; C3's `ls-remote` result is best-effort
  corroboration only.
- The rejected M4 commit `ea03893` (present only in the stale local sandbox,
  not on the VM) was not used for anything.

## 6. F4 items — all 5 CLOSED (feature branch, lane M5)

1. **S04 row 28** — handoff.md:18 "npm 10.9.9" dropped (lockfiles do not
   record it; no source in the handoff). Verified: 0 occurrences.
2. **S04 row 29** — AGP 8.2.2 + SDK 35 note added to `apps/android/README.md`:
   AGP 8.2.2 below Google's 8.6.0 minimum for API 35; builds only via
   `android.suppressUnsupportedCompileSdk=35`; recorded `assembleDebug` exit
   0; other AGP requirements met; upgrade path stated.
3. **S04 row 30** — Kotlin 1.9.22 caveat in the same note (KGP 1.9.20–1.9.25
   fully-supported Gradle ≤8.1.1 / AGP ≤8.1.0; repo exceeds both; "usually
   work").
4. **S04 row 31** — scope note before ANDROID-GUIDE:756 (B.1 pins are the
   upstream Core build, not the `apps/android` starter); :1037 left unchanged
   (already says "upstream").
5. **S02 E5** — ANDROID-GUIDE:1607 (now :1609): prescribed ", by BIP-39's
   construction," substitution. The other three occurrences were already
   fixed in `4a072fc` (verified present).

Verified by C2 (§2.5) and C3 (§2.5): F4-1 0 occurrences of `10.9.9` in
docs/handoff.md; F4-2/3 AGP + Kotlin notes in apps/android/README.md:14,16;
F4-5 ANDROID-GUIDE:1609 wording present; scope note at ANDROID-GUIDE:756.

## 7. Incidents and their resolutions

1. **M4 completion rejected (unverifiable).** Lane M4 (hd-wallet-professional)
   reported completion with commit `ea03893`, 6 Sol calls, report + RUN-LOG —
   none of it exists on the VM (commit not in the bare repo, worktree still
   clean at `7631d00`, no lane dir, no REPORT.md/RUN-LOG.jsonl). It apparently
   worked in its own sandbox, not on muse-vm. Result rejected; M4's SHA and
   findings were NOT reused. Re-dispatched as M4b from scratch (2 Sol calls,
   2 landed), which produced the verified `680c721` commit. C2 re-confirmed
   `ea03893` is absent from the VM bare repo (`git cat-file -t` fails).
2. **Location correction (root cause of #1).** The lane briefs gave VM paths
   but never said to reach the VM via boxd. M1, M2, M3, and M5 all began in
   their local sandboxes (stale mirrors). The correction was sent mid-run: all
   work via `boxd machine exec muse-vm` / `boxd machine cp`; verify worktree
   HEAD on the VM first; no local substitutes; commits must be visible in the
   bare repo on the VM. Every lane re-verified its findings and re-applied its
   fixes on the VM; nothing in any commit rests on local-only files. M4b was
   clean from the start. Lanes C1–C4 all worked on the VM first-hand; C2/C3
   explicitly record their local sandboxes as stale and unused.
3. **Coordinator's own finding — P1-C5 (not a report item, carried from the
   audit-fixes run).** WEB-GUIDE:254 and ANDROID-GUIDE:1708 misattribute
   program `01c252d7…` to Bawa's address (it encodes to `tb1qq8p994…`, not
   `tb1qpsp72…`); the correct program is `0c03e507…`. A qualification clause
   was applied in the audit-fixes run (commit `4a072fc`); the feature lane
   verified it present and did not re-do it.
4. **Gateway rate limit (M1).** One Sol call failed with gateway
   `rate_limit_exceeded` (concurrent sibling lanes); retried and landed.
   No other gateway failures in the run.
5. **C3 checker error (corrected in-lane).** C3's first link checker reported
   383 broken links — checker error (vendored `node_modules` READMEs counted,
   footnote definitions counted as links, heading-slug space runs collapsed
   to one hyphen). All three bugs were fixed and each fix confirmed by direct
   grep/read-back; the corrected v2 count is 8 broken at 4 locations (§5.3).

## 8. Outstanding items checklist

The nine brief §4 items — **none silently closed; all still open**:

| # | Item | Status | Detail |
|---|---|---|---|
| 1 | Mainnet wallet-core 4.8.4 → 4.9.3 re-pin (main) | **Still outstanding** | Needs a full re-verification run against the new WASM build; 4.9.3 recorded as latest stable, re-pin still open. The feat branch DID re-pin to 4.9.3 with fresh lockfile + vector checks (13/13) — main's re-pin is a separate step. |
| 2 | Main's §18 readiness gates | **Still outstanding** | Recovery rehearsal, full vector coverage, scanning, reproducible releases, external review still FAIL. Unchanged by this run. |
| 3 | No GitHub release tags or release dates | **Still outstanding** | Zero tags / no release dates (R16 F4) still open. No release was created. |
| 4 | GetBlock pricing | **Still outstanding** | GetBlock "$49/mo paid entry" could not be confirmed or refuted from the live pricing page; left as snapshot wording with the unverified "Starter" name removed. |
| 5 | TronScan Approval tab browser verification | **Still outstanding** | Live-browser re-check remains unmet (carried from the source audit). |
| 6 | Security-audit workflow has not run on GitHub | **Still outstanding** | The workflow has never run on GitHub. Feature ci.yml has no apps/web or apps/android job; apps/web is covered only by security-audit.yml, which has never run. |
| 7 | Six binary files missing from `feature/ai-wallet-builder` | **Still outstanding** | Snapshot route is text-only. Separate, unordered item. |
| 8 | No branches merged or consolidated | **Still outstanding (by owner order)** | Owner order 2026-11-11 stands: the 5 branches stay as they are; no merge into main, no archive folders, no branch deletions. |
| 9 | No commits pushed | **Still outstanding** | All 5 lane commits are local only (plus this report, committed locally only). Pushing needs the owner's word. Exact commands are in §10. |

Additional residuals carried forward (from C2/C3, also open):

| ID | Item | Status |
|---|---|---|
| F-C3-1 | 4 stale anchors survive at main + feature lane HEADs (WEB-GUIDE `#b-prerequisites-and-project-setup` ×2; docs/12 → GLOSSARY.md `#trust-wallet-core-registry`, `#hrp`) | Still outstanding (pre-existing) |
| F-C3-2 / C2-A | docs-usecase-split docs/03:124 still maps "TON low-level SDK" to `ton-org/ton`, conflicting with docs/02 | Still outstanding (lane missed an instance) |
| F-C3-3 / C2-B | hd README:2151 version snapshot says main uses bip-utils 2.12.2 (false after main's bump to 2.12.3) | Still outstanding (lane-introduced; correct it or anchor it to a historical main SHA) |
| F-C3-4 | feat records package version 1.2.0; main records 1.1.0 ("1.2.0 was never released") | Note — each branch internally consistent; report branch-by-branch |
| F-C3-5 | Feature handoff M-31/M-15 OPEN statements framed by a header note, not edited; a skim reader can still misread the rows as current | Note — framing verified present |
| C1-3 | Strict Python determinism gap: main/feat have no requirements.lock; feature CI does not consume its lock; main/feat CI uses `npm install` not `npm ci` | Still outstanding (reproducibility hardening, not a break) |
| C1-1/2/3 | Python 3.13 installs, actual GitHub Actions runs at these HEADs, apps/web `npm ci`/build/test and Android build | Not verified — see §9 |
| C4-NEW | Feature branch diverged from remote head (merge-base `0b2aa29`; remote +11 / local +89 commits) — plain push would be rejected | Still outstanding — merge path in §10.4 needs owner direction |

## 9. What was NOT done / not verified (consolidated)

- **No pushes.** All 5 lane commits are local only; this report is committed
  locally only. Pushing needs the owner's word (main is protected; the
  feature commit needs a merge with the diverged remote head first — §10).
- **No merges, no branch deletions, no consolidation** (owner order
  2026-11-11 stands).
- **No mainnet or production readiness marked PASS anywhere.** Main's §18
  gates remain FAIL; no release tags exist.
- **Test re-runs not done by the verification lanes:** C2 did not re-execute
  any test suite (npm/vitest/Python); C3 did not re-execute lane test claims
  (smoke 217 ok, vitest 144/144, 14/14 unit tests, differential PASS), except
  feat `node --check` 3/3 PASS hands-on. Those results are the lanes' own
  claims, recorded in §2 as "completed but not independently reverified".
- **External links not live-checked:** 1,363 external links counted by C3,
  none fetched. Live-browser verification (TronScan Approval tab) not done.
- **CI not verified:** actual GitHub Actions runs at these HEADs not
  inspected; security-audit.yml never run on GitHub; Python installs on CI
  Python 3.13/3.13.18 not tested (no Python 3.13 on the VM); feature lock
  generated on Python 3.12 while feature CI targets 3.13.18.
- **apps/web and apps/android builds not re-run by C1/C3:** web install not
  run by C1 (lock consistency only, statically verified); M5's manual web
  results (vitest 144/144) cited, not re-run; Android Gradle build / live-
  browser Web run NOT re-run by M5 (no code/config under `apps/android`
  changed; recorded `assembleDebug` exit 0 cited).
- **Whole-graph necessity audit** (every transitive package used) not done —
  would need a usage/import audit.
- **"Latest stable" version claims, live provider pricing, and the 51-run CI
  record** were verified by C3 only as text present in the files, not against
  live sources (C1 did live-check current stable releases, §3.3).
- **Crypto check scope:** C3's check is narrow (checked literals + file
  modes unchanged); it does not establish complete security-behavior
  equivalence.
- **No dependency changes were made by C1/C2/C3/C4.** No lockfile was
  regenerated; no version was upgraded for freshness.

## 10. Push and release status — exact commands (commands only, DO NOT execute)

**Status: nothing has been pushed. No release exists. No tags exist.**
All five lane commits are local only; this report is committed locally only,
on local branch `feature/ai-wallet-builder` in the feature working copy
(§10.5). Branch protection: `main` is protected — a direct push to `main`
is expected to be rejected by branch protection and would then need a pull
request route; that is the owner's call, not this run's.

**Authentication note:** pushes to `https://github.com/Pr3eve6ti2o/bawa.git`
need valid credentials at push time. The Muse GitHub App lacks the
`workflows` permission: a push that creates or updates files under
`.github/workflows/` is refused with 403. The feat lane commit modifies
`.github/workflows/ci.yml`, so its push needs a credential with workflow-write
scope (the saved GitHub PAT, stored at `~/workspace/.github-pat`, chmod 600,
per the owner's order), used as the git credential for the push itself — not
the App. The feature push may also touch workflow files through the merge
(§10.4): check with `git diff` before pushing, and use the PAT there too if
it does. The Contents API cannot reproduce these exact commit objects and
history, so it is not a substitute for pushing them. No credential value is
printed in this report.

**Fast-forward status, verified first-hand by lane C4** (`merge-base
--is-ancestor <remote-head> <lane-commit>`; remote heads from fresh
`git ls-remote`, §1):

| Branch | Lane commit | Remote head | Fast-forward push? |
|---|---|---|---|
| main | `16c074e` | `0b2aa29` (its parent) | YES (subject to branch protection) |
| docs-usecase-split | `c0be1eb` | `d265204` (its parent) | YES |
| feat/trust-wallet-reference-implementation | `44ea253` | `c95e0f3` (its parent) | YES |
| hd-wallet-professional | `680c721` | `7631d00` (its parent) | YES |
| feature/ai-wallet-builder | `42e765a` (+ this report) | `27ff384` | **NO — diverged** (see §10.4) |

### 10.1 Pre-flight (run first, read-only; abort if any line differs)

```bash
git -C /home/boxd/workspace/bawa-multibranch/repo.git ls-remote origin
git -C /home/boxd/workspace/bawa-multibranch/repo.git for-each-ref refs/heads/
git -C /home/boxd/workspace/bawa-multibranch/repo.git cat-file -t 16c074e68c27a501902b8c05b5999e27e0dcd305
git -C /home/boxd/workspace/bawa-multibranch/repo.git cat-file -t c0be1eb66e2827a97a5c914dba0a86352b0cccce
git -C /home/boxd/workspace/bawa-multibranch/repo.git cat-file -t 44ea253bf49de1416e000c50b23d4c232b0cbb58
git -C /home/boxd/workspace/bawa-multibranch/repo.git cat-file -t 680c72186163c73aaab7f56613a376c1087c9fa5
git -C /home/boxd/workspace/bawa-builder/bawa log --format='%H %P' -1 feature/ai-wallet-builder
```

Expected: remote heads main `0b2aa29`, docs-usecase-split `d265204`, feat
`c95e0f3`, hd-wallet-professional `7631d00`, feature `27ff384`; bare refs at
the same values (the lane bases); all four `cat-file -t` calls print
`commit`; the feature working-copy branch tip is this report's commit whose
parent is `42e765a`. If any remote head has moved, any object is missing, or
the report commit's parent is not `42e765a`, STOP and re-verify before
pushing that branch.

### 10.2 Fast-forward pushes (four branches) — plain pushes, NO force flags

Run one branch at a time and verify with `ls-remote` after each. Push from
the bare repo, which holds all four lane commits:

```bash
git -C /home/boxd/workspace/bawa-multibranch/repo.git push origin 16c074e68c27a501902b8c05b5999e27e0dcd305:refs/heads/main
git -C /home/boxd/workspace/bawa-multibranch/repo.git push origin c0be1eb66e2827a97a5c914dba0a86352b0cccce:refs/heads/docs-usecase-split
git -C /home/boxd/workspace/bawa-multibranch/repo.git push origin 44ea253bf49de1416e000c50b23d4c232b0cbb58:refs/heads/feat/trust-wallet-reference-implementation
git -C /home/boxd/workspace/bawa-multibranch/repo.git push origin 680c72186163c73aaab7f56613a376c1087c9fa5:refs/heads/hd-wallet-professional
```

Each command pushes exactly one commit on top of its current remote head (the
remote head is that commit's parent, verified §10 table). No `--force`,
`--force-with-lease`, or `+` refspec is used anywhere. If a push is rejected
for any reason other than branch protection on main, STOP — do not retry with
force; report the rejection. (Note: branch protection does not guarantee
rejection for every credential — a credential with bypass permission could
still land a direct push. If bypass must be excluded, use the §10.3 PR route
directly instead of attempting the direct push.)

### 10.3 `main` branch protection

If the `main` push in §10.2 is rejected by branch protection, do NOT bypass
it. The protected route is a pull request carrying commit `16c074e`. First
verify the PR-branch name is unused on the remote, then push the commit to
that branch and open the PR in one `&&`-chained command, so a failed push
cannot produce a wrong-head PR. `gh` must be authenticated:

```bash
git -C /home/boxd/workspace/bawa-multibranch/repo.git ls-remote origin refs/heads/docs-audit-main-16c074e
git -C /home/boxd/workspace/bawa-multibranch/repo.git push origin 16c074e68c27a501902b8c05b5999e27e0dcd305:refs/heads/docs-audit-main-16c074e && gh pr create --repo Pr3eve6ti2o/bawa --base main --head docs-audit-main-16c074e --title "docs: audit and sync documentation and dependency pins (main)" --body "One-commit audit and sync of main (lane M1, Sol API 2). See MULTIBRANCH-REPORT.md on feature/ai-wallet-builder for the consolidated audit, verification tables, and outstanding items."
```

The `ls-remote` line must print nothing (the branch name is free) before the
push runs. No PR is created by this run; creating one needs the owner's word.

### 10.4 `feature/ai-wallet-builder` — diverged; NO plain push works

Verified first-hand by lane C4: merge-base(remote `27ff384`, local `42e765a`)
= `0b2aa29` (main's base). The remote has 11 commits the local line does not
have (`27ff384` G1 fix, `18ce692` M-31/M-15 close, `7614b39` version sweep,
`a3983c1` security-audit workflow, `be0c98c` CI update, `093496b` execution
programme, `58264e8` / `622ff77` / `ac1ccd3` / `92b1733` probes,
`18cb575` AI Wallet Builder work); the local line has 89 commits the remote
does not have. The local line also holds parallel same-message commits
(`49121c6` M-31/M-15 close, `8bc8d76` G1 fix) with different SHAs from the
remote's (`18ce692`, `27ff384`), so a merge will need duplicate-content
conflict review. **A plain push of `42e765a` (+ this report) would be rejected
as non-fast-forward. Do NOT force-push.**

Safe path (commands only — owner direction required before running). The
steps are fail-stop: block 1 is one `&&`-chained command, so a dirty tree, a
failed checkout/fetch, or a conflicted merge stops everything; the manual
resolution step is separate; block 2 is one `&&`-chained command, so the push
cannot run unless every check passes. The checks are scoped to the
subprojects that have lockfiles and test scripts (the repo root has no
dependencies and no root lockfile, so a root `npm ci` would fail), and each
subproject check runs in a subshell so a failure cannot leave the shell in
the wrong directory.

Block 1 — start clean and merge:

```bash
cd /home/boxd/workspace/bawa-builder/bawa && test -z "$(git status --porcelain)" && git checkout feature/ai-wallet-builder && git fetch origin && git merge origin/feature/ai-wallet-builder
```

If block 1 stops on the merge (conflicts), resolve them by hand (expect
duplicate-content conflicts around the M-31/M-15 close and the G1 fix); do
NOT accept a wholesale ours/theirs without reading the diff. Then stage
only the files you resolved, review the staged diff, and check it for
whitespace errors — do NOT use `git add -A` (it can stage unrelated files
or deletions):

```bash
git status --porcelain
git add <each resolved file, by path>
git diff --cached
git diff --cached --check
```

If the merge was clean, git already created the merge commit — skip the
staging block and the `git commit` in block 2 (remove `git commit --no-edit
&& ` from the chain). Block 2 — checks, commit, push:

```bash
git diff --check && (cd tools/hdwallet-gen && npm ci && npm run check && npm test) && (cd apps/web && npm ci && npm run typecheck && npm run test && npm run build) && git commit --no-edit && git show --check HEAD && git push origin feature/ai-wallet-builder:refs/heads/feature/ai-wallet-builder
```

Before the push, also verify whether the merge changed any file under
`.github/workflows/` (`git diff origin/feature/ai-wallet-builder...HEAD --
.github/workflows/`): if it did, the push needs the PAT (workflow-write
scope), not the App — see the authentication note above.

No `--force`, `--force-with-lease`, or `+` refspec is included. If the merge
cannot be resolved cleanly, STOP and report — the branches stay diverged and
local-only.

### 10.5 This report's commit (already done, locally only)

This report was written at the repo root of the feature working copy and
committed on a newly created local branch `feature/ai-wallet-builder` at
`42e765a` (the working copy's only local branch was named `main` while
holding feature-branch content; the local `main` branch was left untouched
at `42e765a`). Commit: `docs: consolidated multi-branch audit report (Sol,
2026-11-14)` — SHA recorded in §12 and in the C4 lane report. No push was
made. The report commit travels with the feature branch through the §10.4
merge path.

## 11. Verification commands and actual results

Key commands run across the lanes (all on muse-vm; Node 22 via
`PATH=/home/boxd/workspace/android-tooling/node22/bin`):

| Command / check | Result |
|---|---|
| Fresh bare-mirror clone + `git branch -a` | 5 branches, not 6 |
| `git cat-file -t` / `git log --oneline base..lane` per lane commit | All 5 exist; exactly 1 commit per range |
| `git diff --stat base..lane` per branch | main 14 files +51/−38; docs 10 +71/−63; feat 17 +257/−48; hd 1 +10/−4; feature 15 +47/−39 |
| `git status --porcelain` in all 5 worktrees + working copy | Empty (clean) everywhere |
| `git ls-remote origin` (C2, C3, C4 — three separate fresh runs) | Remote heads unchanged every time: main `0b2aa29`, docs `d265204`, feat `c95e0f3`, hd `7631d00`, feature `27ff384` |
| `git cat-file -t ea03893` (rejected M4 commit) | Fails — absent from the bare repo |
| `merge-base --is-ancestor` remote-head → lane commit (C4) | Exit 0 for main/docs/feat/hd; exit 1 for feature (diverged) |
| `merge-base 27ff384 42e765a` (C4) | `0b2aa29`; `27ff384..42e765a` = 89 commits, `42e765a..27ff384` = 11 commits |
| `npm ci` in temp copies (C1) | Exit 0 on main/feat/feature (14 packages each); wallet-core matches declared |
| `npm run check` (C1, lanes) | Exit 0 on all three executable branches |
| `npm test` (C1 first-hand, temp copies) | main 14 smoke checks PASS; feat "smoke checks: PASS"; feature "All register-links checks passed" (full-layout temp copy) |
| `node --check` on feat js files (C2: 4/4; C3: 3/3) | PASS |
| Fresh-venv pip installs (C1, Python 3.12.3) | main + feat from requirements.txt exit 0; feature from requirements.lock with `--require-hashes` exit 0; `pip check` clean; installed set matches lock's 22 entries |
| `npm view` / pip index live checks (C1, 2026-11-13) | All pins current except main wallet-core 4.8.4 (open re-pin) and transitive protobufjs 7.6.6 (8.x outside `^7.6.3`) |
| markdownlint-cli 0.44.0 base-vs-lane (C3) | No new rule class on any branch; deltas are MD013 long lines only (hd: +4 MD013, −1 MD029) |
| Python link checker, full tree (C3) | 143 .md files, 663 internal links, 8 broken at 4 pre-existing locations; 1,363 external links counted, none live-checked |
| Whole-tree `git grep` crypto literals + modes (C3) | Counts identical base vs lane on all 5 branches (§5.6) |
| `git diff --check` per lane commit (C3) | Clean on all 5 |
| `git ls-remote` + `for-each-ref` (C4, consolidation) | Bare refs at bases; remote heads unchanged; pull refs observed: pull/1/head `5ce2146`, pull/2/head `d265204`, pull/3/head `c95e0f3` |

## 12. Model accounting and report commit

**gpt-6.1-sol ONLY, API 2, max reasoning, 32,000-token cap. No Astra, Opus,
or DeepSeek. No fallbacks.**

| Lane | Calls | Landed | Failed | 402s | Notes |
|---|---|---|---|---|---|
| M1 main | 4 | 3 | 1 | 0 | Gateway `rate_limit_exceeded` (concurrent sibling lanes); retry landed |
| M2 docs-usecase-split | 3 | 3 | 0 | 0 | |
| M3 feat/trust-wallet-reference-implementation | 3 | 3 | 0 | 0 | |
| M4b hd-wallet-professional | 2 | 2 | 0 | 0 | Re-dispatch; M4 rejected (see §7.1) |
| M5 feature/ai-wallet-builder | 4 | 4 | 0 | 0 | |
| C1 dependency verification | 2 | 2 | 0 | 0 | P1 consistency, P2 reproducibility/CI |
| C2 commit verification | 1 | 1 | 0 | 0 | Second read only; git checks hands-on |
| C3 final consistency check | 2 | 2 | 0 | 0 | P1 links+markdown, P2 deps+crypto+claims |
| C4 report assembly | 2 | 2 | 0 | 0 | P1 draft completeness check, P2 push-command safety review (see C4 RUN-LOG.jsonl) |
| **Total (accepted lanes)** | **23** | **22** | **1** | **0** | |

Scope note: the totals count accepted lanes only. The rejected M4 lane
claimed 6 Sol calls; those are excluded as unverifiable (§7.1) — no M4 call
was confirmed on the VM, so no M4 figure enters the total.

### This report's commit (lane C4, locally only — NOT pushed)

- File: `MULTIBRANCH-REPORT.md` at the repo root of
  `/home/boxd/workspace/bawa-builder/bawa`.
- Branch: local `feature/ai-wallet-builder` (created at `42e765a` in that
  working copy; the working copy's pre-existing local branch `main` was left
  untouched at `42e765a`).
- Message: `docs: consolidated multi-branch audit report (Sol, 2026-11-14)`.
- Commit SHA: recorded in the C4 lane report
  (`bawa-consolidate/C4/C4-REPORT.md`) after first-hand verification with
  `git log --oneline -1` and `git status` clean. (The SHA cannot be printed
  inside the committed file itself: it is a hash of the file's contents.)
- A copy of this report also lives in the consolidation lane dir:
  `/home/boxd/workspace/bawa-consolidate/MULTIBRANCH-REPORT.md`.

## Appendix — evidence index

- Handoff report: `/home/boxd/workspace/bawa-multibranch/MULTIBRANCH-REPORT.md`
  (the complete multi-branch audit results; superseded by this consolidated
  report, which incorporates and extends it).
- Lane reports (audit): `bawa-multibranch/main-lane/REPORT.md`,
  `docs-usecase-split-lane/REPORT.md`,
  `feat-trust-wallet-reference-implementation-lane/REPORT.md`,
  `hd-wallet-professional-lane/REPORT.md`,
  `feature-ai-wallet-builder-lane/REPORT.md` (each with RUN-LOG.jsonl).
- Lane reports (verification): `bawa-consolidate/C1/C1-REPORT.md` (+
  `evidence/`, `prompts/`, `answers/`, `RUN-LOG.jsonl`),
  `bawa-consolidate/C2/C2-REPORT.md` (+ `evidence/`, `prompts/`, `answers/`,
  `RUN-LOG.jsonl`), `bawa-consolidate/C3/C3-REPORT.md` (+ `evidence/`,
  `prompts/`, `answers/`, `RUN-LOG.jsonl`).
- Lane C4 (assembly): `bawa-consolidate/C4/C4-REPORT.md`,
  `bawa-consolidate/C4/NOTES.md`, `bawa-consolidate/C4/RUN-LOG.jsonl`,
  `bawa-consolidate/C4/prompts/`, `bawa-consolidate/C4/answers/`,
  `bawa-consolidate/C4/runner-c4.mjs`.
- Coordinator notes: `bawa-consolidate/NOTES.md`.
- Brief: `bawa-consolidate-brief.md`.
- Bare repo: `bawa-multibranch/repo.git`. Worktrees:
  `bawa-multibranch/<branch>/` (main, docs-usecase-split,
  feat-trust-wallet-reference-implementation, hd-wallet-professional,
  feature-ai-wallet-builder).
