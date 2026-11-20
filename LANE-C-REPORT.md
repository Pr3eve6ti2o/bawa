# Lane C — Requirements (dependency files) — Report

Branch: `panel-rebuild/org-requirements` (off adopt-proper `e493720`), worktree
`/home/boxd/workspace/bawa-org/requirements` on gray-pinee. LOCAL ONLY, no push.
Date: 2026-11-20. Model: gpt-6.1-sol, API 1, MAX reasoning, 32,000 max_output_tokens.

## 1. Inventory (all 4 branches, via `git ls-tree`)

| File | main 74ae078 | main-adopt-fixes df3dd25 | adopt-proper e493720 (base) | multichain-create 40d8cc5 |
|---|---|---|---|---|
| requirements.txt | yes (2 pins) | yes (3 pins) | yes (5 pins) | yes, identical to adopt-proper |
| requirements.lock | NO | NO | yes (23 pkgs, pip-compile, hashes) | yes, identical |
| package.json (root) | yes | yes | yes, identical all 4 | identical |
| captcha/package.json + lock | yes | yes | NO (not lineage) | NO |
| apps/web/package.json + lock | NO | NO | yes | yes, identical |
| apps/web/.npmrc | NO | NO | yes | identical |
| tools/hdwallet-gen/package.json + lock | yes | yes | yes | identical |
| tools/package.json | NO | NO | yes | identical |
| packages/contracts/package.json | NO | NO | yes | identical |
| .npmrc (root), tools/.npmrc, tools/hdwallet-gen/.npmrc | NO | NO | yes | identical |
| apps/android build.gradle.kts + wrapper | NO | NO | yes | identical |

No `yarn.lock`, `pnpm-lock.yaml`, `Pipfile`, `pyproject.toml`, `setup.py`,
`Gemfile`, `Cargo.toml` or `go.mod` on any branch. No `libs.versions.toml`.

## 2. Checks performed first-hand (all verified, not taken from Sol)

- **Python pins vs lock:** all 5 `requirements.txt` pins match the lock exactly.
  `pip install --require-hashes -r requirements.lock` in a fresh venv: rc=0
  (23 packages, hashes valid). `pip check`: no broken requirements.
- **Specifier consistency:** every lock version satisfies its parent's declared
  range (checked against installed METADATA Requires-Dist; `~=` means
  `>=X.Y, ==X.*`, so ecdsa 0.19.2 in `~=0.17` and pycryptodome 3.24.1 in
  `~=3.15` are valid — an earlier suspicion of contradiction was my error,
  corrected by `pip`'s vendored packaging check).
- **Direct-import check (tools/ + test/):** `bip_utils`, `cryptography` and
  `mnemonic` (`from mnemonic import Mnemonic`, tools/make_wallet.py:520) are
  directly imported. No file imports `requests` or `nacl` directly.
- **`requests` floor pin — VERIFIED JUSTIFIED, kept.** Installed metadata proves
  `pytoniq-core-fork 0.1.48` declares `requests>=2.31.0`, so `requests==2.34.2`
  is a genuine transitive floor pin (raises it off the vulnerable 2.31.0).
  `pynacl==1.6.2` is likewise required by `bip-utils (pynacl~=1.5)` and
  `pytoniq-core-fork (PyNaCl>=1.5.0)`. Sol call 1 recommended removing
  `requests` — that recommendation was REJECTED because Sol was not given the
  pytoniq-core-fork requirement in its prompt; first-hand metadata wins.
- **Licences (PyPI, checked 2026-11-20):** cryptography Apache-2.0 OR
  BSD-3-Clause; bip-utils MIT; mnemonic MIT; pynacl Apache-2.0; requests
  Apache-2.0. Only mnemonic's licence was recorded before this lane.
- **Web deps:** all 60 `apps/web` deps verified used (src/scripts/tests/config
  + CSS `@import` for `@fontsource/inter` and `@fontsource/noto-sans-sc`;
  `@tailwindcss/vite` + `@vitejs/plugin-react` via vite.config.ts;
  typescript/vite/jsdom via tooling). No unused dependency. Lock
  (v3, 334 packages) contains every package.json dep; `npm ci` rc=0.
  Registry latest checked: jsqr 1.4.0, long 5.3.2, viem 2.58.2,
  lucide-react 1.76.0. `npm audit`: 0 vulnerabilities (apps/web and
  tools/hdwallet-gen).
- **wallet-core consistency:** 4.9.3 in both apps/web and tools/hdwallet-gen,
  and in the hdwallet-gen lock; identical on all 4 branches.
- **Gradle:** AGP 8.2.2, Kotlin 1.9.22, Gradle 8.7 (sha256-pinned wrapper),
  compileSdk 35 / minSdk 33 / targetSdk 35, Java 17, Compose BOM 2024.02.00,
  Compose compiler 1.5.8, core-ktx 1.12.0, lifecycle 2.7.0, activity-compose
  1.8.2, zxing 3.5.3, junit 4.13.2, robolectric 4.14.1 — all pinned.
  `ui-test-junit4` / `ui-test-manifest` are versionless but BOM-managed
  (acceptable). No version catalog (optional, not a defect).
  FLAG (Sol call 3, not build-validated here): AGP 8.2.2 officially supports
  only through API 34 while compileSdk is 35. No Android SDK exists on
  gray-pinee, so the pairing could not be build-validated in this lane; it is
  NOT proven broken and no upgrade is recommended (no-upgrade rule).
- **`.npmrc`:** root + tools had only `engine-strict=true`; apps/web +
  tools/hdwallet-gen had `engine-strict=true` + `ignore-scripts=true`
  (T48 F-04). Inconsistent.

## 3. Fixes applied (this branch only, 5 files, no version upgrades, no lock edits)

1. `apps/web/package.json` — pinned the three caret ranges to their
   lock-resolved versions: `jsqr` ^1.4.0 → 1.4.0, `long` ^5.3.2 → 5.3.2,
   `viem` ^2.58.0 → 2.58.0 (note: a fresh install would have floated viem to
   2.58.2). Added `"license": "MIT"`. Lockfile untouched, still consistent.
2. `packages/contracts/package.json` — added `"license": "MIT"`,
   `"description"` (shared contract types: chains, derivation paths,
   extended-key validation — verified against src/index.ts), and
   `"engines": {"node": ">=22 <23"}` (repo-wide Node policy).
3. `requirements.txt` — comment-only changes, pins untouched: added licence
   lines for cryptography (Apache-2.0 OR BSD-3-Clause), bip-utils (MIT),
   pynacl (Apache-2.0), requests (Apache-2.0); corrected the floor-pin comment
   to name the true consumer chain (requests via pytoniq-core-fork
   `requests>=2.31.0`; pynacl via bip-utils `~=1.5` + pytoniq-core-fork).
4. `.npmrc` (root) + `tools/.npmrc` — added `ignore-scripts=true` with the
   T48 F-04 comment, matching apps/web and tools/hdwallet-gen. Verified no
   pre/post lifecycle hooks exist in root or tools package.json, so nothing
   is suppressed that was in use.
5. NOT changed (deliberate): `lucide-react` stays pinned at 1.14.0 (latest
   1.76.0 is not a breakage/vulnerability reason to upgrade); `requests`
   stays (justified above); no lockfile was hand-edited (per
   code-review-and-quality: the lockfile is what actually pins what ships).

## 4. Findings for the other branches (report only, no changes made there)

- **main (74ae078):** `requirements.txt` has only cryptography 50.0.2 +
  bip-utils 2.12.3 and NO `requirements.lock` — moderate reproducibility /
  supply-chain gap (direct pins do not freeze transitives). Recommend a
  branch-matched, hash-checked lock. `captcha/package.json` uses caret ranges
  (linkedom ^0.18.0, patchright ^1.64.3, tsx ^4.0.0), no license field, no
  engines — BUT a committed `captcha/package-lock.json` (v3) exists and locks
  them to 0.18.15 / 1.64.3 / 4.23.15, so the drift risk is low; still
  recommend exact pins + license/engines metadata.
- **main-adopt-fixes (df3dd25):** same as main, plus `mnemonic==0.21` in
  requirements.txt; still no lock. Same recommendations.
- **panel-rebuild/multichain-create (40d8cc5):** every dependency file is
  byte-identical to adopt-proper, so all findings and fixes here apply to it
  verbatim; nothing additional found.
- **captcha absence on panel branches** is lineage, not deletion: captcha was
  added on main in cc52574 after the panel branches forked (merge-base
  0b2aa29); the commit is contained only in main and main-adopt-fixes.
- **Root package.json** is identical on all four branches; hdwallet-gen
  wallet-core 4.9.3 is identical on all four branches.

## 5. Build + test results after the changes (final state)

- Python (fresh venv, lock install): test_make_wallet 89 OK,
  test_decrypt_seed 30 OK, test_bawa_cli 25 OK (2 skipped),
  test_unsigned_serialization 85 OK. `pip install --dry-run --require-hashes
  -r requirements.lock`: all satisfied.
- apps/web: `npm ci` rc=0, `npm run build` rc=0, vitest 40 files / 457 tests
  passed rc=0. `npm audit`: 0 vulnerabilities.
- tools/hdwallet-gen: `npm ci` rc=0, `npm test` rc=0.
- Baselines before the changes were identical (89/30/25/85; build rc=0;
  vitest 457 passed), so the changes introduced no regression.
- Android: not build-verified in this lane (no Android SDK on gray-pinee).

## 6. Sol calls (gpt-6.1-sol, API 1, max reasoning, 32,000 cap, one at a time)

| # | Prompt (words) | Duration | Answer | Verdict |
|---|---|---|---|---|
| 1 | lane-c-sol1-python.txt (323) | 59 s | 1,155 chars | Landed. Rec. 2 (remove requests) REJECTED after first-hand metadata check (see §2). Licence lines verified correct. |
| 2 | lane-c-sol2-web.txt (357) | 55 s | 1,164 chars | Landed. All 5 answers agreed with first-hand checks; pinning + MIT fixes approved. |
| 3 | lane-c-sol3-gradle.txt (412) | 151 s | 1,806 chars | Landed. AGP/API-34 flag + .npmrc fix approved; captcha-lock hedge resolved first-hand (lock exists). |

Total: 3 calls, 0 failed, 0 retries, no 402/403. Prompts + outputs in this
worktree (`lane-c-sol*.txt`, `lane-c-sol*.out.md`); full log in `RUN-LOG.jsonl`.

## 7. Skills used (searched the 1,400 installed skills first-hand)

- **code-review-and-quality** (`~/workspace/custom-skills/code-review-and-quality/SKILL.md`,
  read first-hand): its dependency rules — "review the lockfile diff, not just
  package.json", "keep the lockfile honest: commit it, review its diff, never
  hand-edit it", "mind the transitive graph" — shaped the work. What it
  changed: no lockfile was hand-edited (pins changed in package.json only,
  validated by `npm ci` against the untouched lock); the transitive-graph rule
  drove the metadata check that saved the `requests` pin from Sol's removal
  recommendation.
- **security-and-hardening** (read first-hand): "run the native audit against
  the committed lockfile before every release; triage by reachability; never
  apply forced remediation automatically". What it changed: `npm audit` run on
  both lockfiles (0 vulnerabilities, no remediation applied) and the
  root/tools `.npmrc` `ignore-scripts=true` consistency fix.
- **ci-cd-and-automation** (relevant section read): `npm audit` as a CI quality
  gate. Supported the audit step; no change beyond §7's audit runs.
- **npm-automation** (read first-hand): a Rube MCP / Composio wrapper requiring
  a connected Composio account, which is not connected — checked, NOT usable,
  not applied. Recorded so the gap is explicit.
- No dedicated pip-compile / pinning / SBOM skill exists in the installed
  1,400: `muse.skill_search` for dependency pinning, pip-compile lockfiles and
  SBOM/licence audit returned no relevant skill (closest hits were unrelated:
  npm-automation, git-workflow-and-versioning, depmap). Stated plainly rather
  than claiming a skill was used.

## 8. Notes / caveats

- Egress note: the VM's `127.0.0.1:3129` forwarder is DOWN (connection
  refused) and `10.122.0.254:9460` also fails; direct egress (no proxy) works
  and was used for all registry checks (`registry.npmjs.org`, `pypi.org`).
- The `.lane-venv/` directory used for verification was deleted before
  committing (regenerable from `requirements.lock`); `lane-c-scan-deps.py`
  (usage scanner) is kept out of the commit — a copy exists in the
  coordinator's local workspace.
- AVOID-list: no dependency was added, so nothing on the 14-item list was
  touched. No branches deleted, no merges, no push, no real crypto, no
  broadcast.
