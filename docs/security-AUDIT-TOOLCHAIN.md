# Bawa audit toolchain (pinned)

AI-led separate-context security review — W4 research lane T38, snapshot
`981d0ba`, 2026-11-12. This is the prerequisite toolchain for the audit
lanes (T40–T49). It is NOT an independent human audit or external
certification.

## How pins were verified

Every version below was verified first-hand on 2026-11-12 against a
registry (npm / PyPI / Maven Central) or an upstream changelog, from
the VM. Where verification was partial, the pin says so. Re-verify
every pin before the second audit pass — Semgrep, Ruff and Hypothesis
release weekly or near-weekly. Never install a tool with `@latest`
or an unpinned version in an audit run.

Repo facts the toolchain is sized for (snapshot `981d0ba`):

- JS: Node `>=22 <23` (VM: Node v22.23.4), plain JS in
  `tools/hdwallet-gen` (one dependency, `@trustwallet/wallet-core`
  4.9.1, WASM), React 19 + Vite 8 + TypeScript 5.9 + Vitest 4.1.3 in
  `apps/web`. Lockfiles in both projects. No lint or SAST config.
- Python: `>=3.11` (VM: 3.12.3), `requirements.txt` pins
  `cryptography==50.0.2`, `bip-utils==2.12.2`. No pyproject.
  `requirements.lock` (R02, 2026-11-12) freezes the full transitive
  graph with hashes (pip-compile --generate-hashes, 23 packages);
  install it with `pip install --require-hashes -r requirements.lock`.
  Code: `tools/make_wallet.py`, `tools/decrypt_seed.py`, `test/*.py`.
- Android: AGP 8.2.2, Kotlin 1.9.22, Compose BOM 2024.02.00,
  compileSdk 35, minSdk 33, JDK 17, ZXing core 3.5.3. Watch-only
  testnet app: no signing, no broadcast, no Trust Wallet Core AAR.
- CI today (`.github/workflows/ci.yml`) runs only `node --check`,
  smoke tests, the `bip_utils` differential test and `py_compile`.
  No dependency scan, no SAST, no fuzzer.

## 1. Dependency-vulnerability scanning (run first — minutes, no new deps)

| Tool | Pin (verified 2026-11-12) | Licence | Install / run (repo root unless noted) |
|---|---|---|---|
| `npm audit` | Bundled with Node 22 toolchain | — | `cd tools/hdwallet-gen && npm audit --omit=dev`; `cd apps/web && npm audit` |
| OSV-Scanner | **v2.7.1** (upstream CHANGELOG, top entry; GitHub API was rate-limited for the shared egress IP so the tag was not API-verified) | Apache-2.0 | `go install github.com/google/osv-scanner/v2/cmd/osv-scanner@v2.7.1` (needs Go >= 1.27; VM Go is 1.22.2 — use the release binary or a newer Go) or the release binary; `osv-scanner --lockfile tools/hdwallet-gen/package-lock.json --lockfile apps/web/package-lock.json --lockfile requirements.txt` (requirements.txt is a supported lockfile input) |
| `pip-audit` | **2.10.1** (PyPI) | Apache-2.0 | `pip install pip-audit==2.10.1`; `pip-audit -r requirements.txt` |
| OWASP Dependency-Check (Gradle) | **13.0.0** (Repology newest 2026-08-11 + independent Sept 2026 skill; confirm on the Gradle Plugin Portal at first use) | Apache-2.0 | Plugin `org.owasp.dependencycheck` version `13.0.0`; `./gradlew dependencyCheckAnalyze --no-configuration-cache` (config-cache-incompatible). Needs an NVD API key for sane DB sync times. |

Optional (account required, not the baseline):

| Tool | Pin | Licence | Notes |
|---|---|---|---|
| Socket CLI (`@socketsecurity/cli`) | **1.14.1** (npm) | — | Free tier: 1 seat, 1,000 scans/month. Catches malicious packages (install scripts, network, obfuscation) that CVE scanners miss. Needs account + API token. |
| Snyk CLI (`snyk`) | **1.1308.4** (npm) | — | Free tier: 200 Open Source tests / 100 Code tests. Needs account. |

Cross-checks (do not make either the baseline): Trivy **0.76.1**,
Grype **0.121.0** (both from a 5 Nov 2026 head-to-head: OSV-Scanner
found 109/109 vulns, Trivy 105, Grype 104). Trivy WARNING: v0.69.4
was malicious in the Feb–Mar 2026 supply-chain incident
(`setup-trivy` / `trivy-action` compromised concurrently). Pin
Trivy >= 0.70.0 only and verify release SHAs.

Safety **3.8.1** (PyPI) was evaluated and NOT adopted: `pip-audit`
covers the same ground without an account; Safety 3.x auth
requirements were not confirmed for this repo.

## 2. Static analysis (SAST)

| Tool | Pin (verified 2026-11-12) | Licence | Run |
|---|---|---|---|
| Semgrep | **1.185.0** (PyPI) | Engine LGPL-2.1; rules under Semgrep Rules Licence | `pip install semgrep==1.185.0`; `semgrep scan --config p/javascript --config p/typescript --config p/python --config p/kotlin --config p/security-audit --config p/secrets`. Weekly releases — re-pin at each run. Default is local-only; code is not uploaded. |
| ESLint | **10.14.0** (npm) | MIT | New flat config `eslint.config.mjs` needed (repo has none). Node 22 supported. |
| `eslint-plugin-security` | **4.2.1** (npm) | MIT | Cheap tripwire only. Benchmarked recall 11/40 (27.5%) at 4.0.1, 0/6 SQL injection, ~1:1 true:false positives at 2.1.1. Never present it as the audit. |
| CodeQL | `github/codeql-action` **v4.39.1** (bundles CLI **2.27.3**; versions checked 31 Oct 2026) | GitHub | GitHub Actions code scanning. Strongest for taint tracking. Verify GitHub Advanced Security availability for this repo first; private repos need GHAS. CLI fallback: download the CLI release and run `codeql database create` + `codeql database analyze` locally. |
| Bandit (Python) | **1.9.4** (PyPI) | Apache-2.0 | `pip install bandit==1.9.4`; `bandit -r tools test` |
| Ruff (Python) | **0.17.4** (PyPI) | MIT | `pip install ruff==0.17.4`; `ruff check --select S tools test`. Default `ruff check` does NOT enable the security rules — `--select S` (flake8-bandit) is mandatory for audit use. Ruff-S is a subset of Bandit; Bandit is the authority, Ruff-S the fast CI gate. |
| Android Lint | Ships with AGP **8.2.2** (no separate pin) | Apache-2.0 | `./gradlew :app:lint` |
| MobSF (Android) | **4.6.4** (PyPI, 31 Oct 2026) | GPL-3.0 | `pip install mobsf==4.6.4` or Docker `opensecurity/mobile-security-framework-mobsf:4.6.4`. Scans the built APK (static). Dynamic analysis needs a rooted emulator (docs: up to API 30) or a physical device (v4.6.2+); our target is API 33–35, so treat dynamic analysis as LIMITED and static as the usable part. MobSF itself had CVEs at <= 4.4.6 — pin >= 4.6.4. |
| detekt (Kotlin) | **1.23.8** (stable line) | Apache-2.0 | Code smells / complexity ONLY — not a security scanner, do not present it as one. Optional. Do NOT use 2.0.0-alpha.6: it needs Kotlin 2.4 / Gradle 9 / AGP 9 / JDK 25 and is incompatible with this repo (Kotlin 1.9.22 / AGP 8.2.2 / JDK 17). |

## 3. Property-based, fuzzing and differential testing

| Tool | Pin (verified 2026-11-12) | Licence | Use |
|---|---|---|---|
| fast-check | **4.10.2** (npm) | MIT | Property tests in Vitest (`apps/web`) and `node:test` (`tools/hdwallet-gen`). Properties: derivation determinism, invalid-input rejection (malformed mnemonics, bad extended keys, bad paths), round-trips. The JS workhorse. |
| Hypothesis (Python) | **6.170.15** (PyPI) | MPL-2.0 | Property tests for `tools/*.py`; differential oracle against the JS side. |
| Jazzer.js (`@jazzer.js/core`) | **4.0.0** (npm, 15 Apr 2026) | Apache-2.0 | Coverage-guided JS fuzzing (libFuzzer). `npm install --save-dev @jazzer.js/core`; `npx jazzer FuzzTarget`. ESM needs Node >= 20.6 (repo Node 22 OK); Linux x86_64 supported. Fuzz the JS wrapper inputs (mnemonic strings, xkey strings, derivation paths) — NOT the wallet-core WASM internals (no source, no harness). Caveat: the Node 22 native-addon build has not been verified on this VM — the implementation lane must run one smoke fuzz target first. |
| Differential testing | No new tool | — | Extend `test/differential_test.py` (today: 2 vectors, BTC + ETH) with all 24 official BIP-39 vectors, BIP-32 vectors and an invalid-input matrix; wallet-core (JS) vs `bip-utils` (Python). Pass criteria: byte-identical addresses for every valid vector; both sides reject the same invalid inputs, or the divergence is documented. |

Rejected: **jsfuzz** — DO NOT USE. Last release 1.0.15, Jan 2021;
last commit Apr 2021; unmaintained. (Evaluated and rejected on
maintenance grounds, not popularity.)

## 4. Run order for the audit lanes (T40+)

1. Dependency scans (Section 1): minutes, no new repo dependencies.
   Record the baseline before any fix.
2. Semgrep + Bandit + Ruff `--select S` + Android Lint: minutes,
   source-only, no build needed (except Android Lint, which needs a
   Gradle build).
3. ESLint + security plugin (new config first) + MobSF (needs a
   built APK) + Dependency-Check (needs NVD key; first DB sync is
   slow) + CodeQL (needs GHAS or a local CLI run).
4. Property tests (fast-check / Hypothesis), differential expansion,
   Jazzer.js targets: days of implementation work, not a scan.

## 5. Applicability limits (read before claiming coverage)

- No tool here verifies cryptographic CORRECTNESS. Only known
  test vectors + differential testing do that. SAST finds patterns,
  not logic bugs in derivation.
- No tool sees inside `@trustwallet/wallet-core` 4.9.1 WASM. It is
  an npm artifact; auditing wallet-core itself is out of scope for
  T38. Audit lanes may cite the upstream Trust Wallet Core audit,
  but must not claim this repo's review covers it.
- Scanners need network (OSV.dev, PyPI, NVD, GitHub Advisory DB).
  Offline CI must use `--offline` plus pre-downloaded databases.
- Semgrep releases weekly: rule behaviour moves between pins.
  Re-pin and re-baseline at each audit pass.
- `npm audit` / `pip-audit` / OSV-Scanner report KNOWN
  vulnerabilities only. A clean result is not proof of safety; a
  finding needs a reachability judgement (is the vulnerable code
  path reachable in Bawa?) before it becomes a severity.
- Dependency-Check CPE matching is noisy for Android/Compose
  artifacts — expect false positives; OSV-Scanner is the
  cross-check. The repo has no Gradle lockfile, so OSV-Scanner
  cannot resolve Gradle versions from a lockfile; Dependency-Check
  (or Gradle dependency locking, a T40+ decision) covers Android.
- MobSF dynamic analysis is effectively unavailable for our
  API 33–35 target on an emulator; do not claim dynamic coverage.
- Jazzer.js cannot fuzz the WASM boundary. Fuzzing wallet-core
  internals would need a native harness against Trust Wallet Core
  source — out of scope.
- Adding these tools as repo devDependencies would change
  lockfiles and widen the supply-chain surface (cf. the July 2025
  `eslint-config-prettier` compromise). Run them from pinned CI
  installs, not from the repo's dependency tree. The exceptions are
  fast-check and Hypothesis, which ARE test dependencies and must
  be added by the implementation lanes with exact pins.

## 6. Baseline scan results (evidence, 2026-11-12, snapshot 981d0ba)

Full outputs: `T38/evidence/` in the fan-out lane dir
(`npm-audit-*.txt`, `pip-audit.txt` + `.json`, `bandit.txt`,
`ruff-check.txt`, `ruff-select-S.txt`, `tool-versions.txt`).

- `npm audit` on `tools/hdwallet-gen`: **0 vulnerabilities**.
- `npm audit` on `apps/web`: **4 vulnerabilities (2 moderate,
  2 high)** — `@vitest/mocker` (GHSA-82fw-gwwq-j7x9,
  GHSA-qxg6-89mg-rqv8); `react-router` 7.14.0 (9 advisories incl.
  GHSA-49rj-9fvp-4h2h, GHSA-8x6r-g9mw-2r78); `vite` 8.0.7
  (7 advisories incl. GHSA-9jrq-w75r-8gcw). Fixes need bumps
  (vitest 4.1.12, react-router 7.18.5, vite 8.3.8) — for the
  implementation lanes, not T38. Scope note: the vite /
  react-router advisories are dev-server / SSR scoped; the shipped
  web starter is a static Vite build. Reachability must be
  adjudicated by T40+, not assumed.
- `pip-audit -r requirements.txt`: **1 distinct advisory, 2
  entries** — `ecdsa` 0.19.2, PYSEC-2026-1325 (CVE-2024-23342,
  GHSA-wj6h-64fc-37mp), Minerva timing attack on P-256
  (`sign_digest()` leaks the nonce; private-key discovery).
  `fix_versions` is EMPTY: upstream considers side channels out
  of scope and there is no planned fix. `ecdsa` is a transitive
  dependency via `bip-utils` 2.12.2. Reachability in Bawa is TBD:
  `bip-utils` uses `ecdsa` for secp256k1, the advisory is
  P-256-specific. T40+ must adjudicate; do not present this as a
  confirmed exploitable finding in Bawa.
- Bandit (`bandit -r tools test`, 1,123 lines): **18 issues — 6
  Low, 12 Medium, 0 High**. All Medium are B108 hardcoded `/tmp`
  strings in test fixtures; Low are B101 asserts in tests and
  B404/B603 subprocess use in tests and in
  `tools/make_wallet.py:19,361`. No High.
- Ruff default: **18 errors** (style: EXE001, I001, SIM117,
  TRY004, SIM115, BLE001 incl. `make_wallet.py:282` blind
  `except Exception` around decrypt verification). Ruff
  `--select S`: **16 errors**, same classes as Bandit.
- OSV-Scanner v2.7.1 (built via `go install`, toolchain
  auto-switched to go1.27.4; system Go is 1.22.2): **7 packages,
  22 vulnerabilities (1 Critical, 6 High, 13 Medium, 2 Low), 21
  fixable** across the three lockfiles. npm matches `npm audit`
  exactly (19 advisories: react-router 9, vite 7,
  @vitest/mocker 2, vitest 1). Python adds 3: `certifi`
  2026.7.22 PYSEC-2026-4320 (CVSS 9.1, fixed 2026.10.18),
  `ecdsa` 0.19.2 PYSEC-2026-1325 (CVSS 7.4, no fix — the
  unfixable one), `idna` 3.9.0 PYSEC-2026-215 (CVSS 6.9, fixed
  3.15). RESOLVER WARNING: `pip-audit` against the actually
  installed tree found ONLY `ecdsa` — a fresh
  `pip install -r requirements.txt` today installs certifi
  2026.10.23 and idna 3.20 (both clean), while OSV-Scanner's
  manifest resolution picked older transitive versions
  (2026.7.22 / 3.9.0). The certifi 9.1 and idna 6.9 are therefore
  resolution-dependent, not installed-tree facts. T40+ must pin
  the actual installed tree (`pip freeze`) before adjudicating,
  and the repo should gain a Python lockfile (PEP 751
  `pylock.toml` or `pip-compile`) so scans are deterministic.
  This is the single most important toolchain gap after the
  missing configs: `requirements.txt` without a lockfile makes
  Python results resolver-dependent.

## 7. Reproducible commands (copy-paste, repo root)

```sh
# Node 22 on the VM:
export PATH=/home/boxd/workspace/android-tooling/node22/bin:$PATH
# JS deps
npm --prefix tools/hdwallet-gen audit --omit=dev
npm --prefix apps/web audit
# Python deps + SAST (in a venv)
python3 -m venv /tmp/audit-venv && /tmp/audit-venv/bin/pip install \
  pip-audit==2.10.1 bandit==1.9.4 ruff==0.17.4 semgrep==1.185.0
/tmp/audit-venv/bin/pip-audit -r requirements.txt
/tmp/audit-venv/bin/bandit -r tools test
/tmp/audit-venv/bin/ruff check --select S tools test
/tmp/audit-venv/bin/semgrep scan --config p/javascript \
  --config p/typescript --config p/python --config p/kotlin \
  --config p/security-audit --config p/secrets
# Android (needs JDK 17 + Android SDK at
# /home/boxd/workspace/android-tooling/)
./gradlew :app:lint
# MobSF (needs a built APK): pip install mobsf==4.6.4
```
