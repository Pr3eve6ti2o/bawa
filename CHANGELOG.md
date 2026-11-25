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

- Expansion programme (2026-11-24, merged into `panel-rebuild/token-gaps` at `6c93e66`; record: `docs/EXPANSION-PROGRAMME.md`): 22 → 84 chains wired into the app (adapters, prices, icons, explorers), 124 RPCs verified live, Solana sending via @solana/web3.js (native SOL + SPL USDC sign and verify offline, broadcast still disabled), diagrams redrawn purpose-first, cold load −43%. The tree has since grown to 87 chains (130 RPCs) on token-gaps.
- Token-verify programme (2026-11-24/25; record: `docs/TOKEN-VERIFY-PROGRAMME.md`): tokens verified by contract address, not name or symbol — CoinGecko contract endpoint first, then Jupiter Strict, 1inch, Uniswap Default and PancakeSwap Extended — so a real token shows a verified mark with its real logo and live price while a fake copycat shows Unverified and never gets the real logo; Add Token works for any token on any chain by contract address (including a fix for the base defect that no SPL token could ever be added by contract); 5 bugs fixed in the new-chains bug hunt; `npm audit` 0 vulnerabilities; all 28 icon-less chains gained a real icon.
- Usable-install programme (2026-11-26; record: `docs/index.md`): the example wallet installs and builds cleanly on Node 22 — typecheck 0 errors, `npm run build` exit 0, eslint 0, engine smoke 440 checks pass (412 smoke + 28 register-links). Web vitest: the 2,945-passed + 5-skipped figure is Lane C's loud-stone run and did NOT reproduce in this sandbox on Node 22 (104 failed / 2,841 passed + 5 skipped on the guide-update tip; 79 failed / 2,866 passed + 5 skipped on pristine token-gaps `7a170f4`; timeout-dominated, varies run to run) — see `docs/index.md`.
- Bundle budget re-baselines (owner orders): 4,177,711 → 4,215,000 (commit `4a12409`, 2026-11-25) → **4,650,000** (commit `7a170f4`, 2026-11-25; `docs/DECISIONS.md` §27). The merged tree measures 4,648,952 total JS and passes the 4,650,000 budget by 1,048 bytes (0.02% margin); the CI gate enforces 4,650,000 (`ci.yml:193`).

## [1.1.0] — Documentation and hardening pass — date not evidenced

- Hardened secret handling, filesystem permissions and public-only derivation boundaries.
- Pinned Trust Wallet Core to an exact version.
- Added modular documentation for wallet generation, tracking, payment reconciliation, recovery, signing and operations.