# Changelog

## [Unreleased]

- Documentation refresh (2026-11-20, `panel-rebuild/org-docs`, base `panel-rebuild/adopt-proper` at `e493720`): corrected the front-door branch name (README badge/clone now name `panel-rebuild/adopt-proper`); rewrote the AGENTS.md honesty state and routing table (offline signing exists, broadcast disabled, APK built, web 457 tests, Android 57 `@Test` annotations); aligned `WALLET_BUILDER.md`, `AGENTS.md` and `ai/request-routing.md` to mainnet-first (separate-approval gate kept); fixed the `apps/web` README watch-only contradiction; refreshed `docs/CAPABILITY-MAP.md` (launcher exists, seven current registry gaps, web count resolved); fixed `docs/08` section 1 and `docs/index.md` evidence figures; added a dated addendum to `docs/handoff.md` and dated row updates to `docs/mainnet/MAINNET-GUIDE.md` (no re-pin); added `docs/BRANCH-DOC-STATUS.md` with the findings for `main`, `main-adopt-fixes` and `panel-rebuild/multichain-create`. Verified on this tree: engine smoke 217 checks pass, web vitest 457 tests pass; quality gates `--skip-android` failed (2 gates: phase9 stale-data M-31 disposition, secret-scan) — see `docs/BRANCH-DOC-STATUS.md`.
- Reworked the repository front door and documentation from the repo-craft research (structure, README, voice, catchy, docs): new front-door README with a verified quickstart, `ARCHITECTURE.md`, ADRs in `docs/adr/`, Diátaxis-organised `docs/index.md`, and the previous 1,308-line README preserved verbatim at `docs/README-FULL.md`. Moved `IMPLEMENTATION.md` and `MULTIBRANCH-REPORT.md` from the root into `docs/`; added a docs link check (`tools/check-links.py`) run by a new `docs-checks` CI job.
- Changed CI to separate `node-tests`/`python-tests` jobs and `npm ci` instead of `npm install`; pinned the runner to `ubuntu-24.04`, all actions to full commit SHAs, and Node 22.23.4/Python 3.13.18 with CI version assertions.
- Added CI coverage for previously unrun decrypt round-trip and make-wallet tests, and a regression check that live wallet generation refuses without a controlling terminal. The differential test's BTC/ETH/TRX index 0/1 coverage comes from the merged T30 extension.
- Added Dependabot for GitHub Actions, npm and pip; ignore `@trustwallet/wallet-core` major bumps pending a qualification run.
- As of 2026-11-13, the CI workflow has 51 GitHub Actions runs, with the latest run at branch tip `27ff384` completed successfully at 2026-11-13T16:39:49Z; every step verified locally on Node 22.23.4 and Python 3.12.3.

- Added the Trust Wallet Core-backed wallet implementation under tools/.
- Added a pinned bip_utils independent-reference test layer.
- Added Trust Wallet registry and Trust Wallet Assets architecture guidance.
- Added implementation, testing, reference and recovery documents.
- Added CI execution for the independent public-vector verification.

## [1.1.0] — Documentation and hardening pass — date not evidenced

- Hardened secret handling, filesystem permissions and public-only derivation boundaries.
- Pinned Trust Wallet Core to an exact version.
- Added modular documentation for wallet generation, tracking, payment reconciliation, recovery, signing and operations.