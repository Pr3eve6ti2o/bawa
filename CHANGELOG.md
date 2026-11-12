# Changelog

## [Unreleased]

- Changed CI to separate `node-tests`/`python-tests` jobs and `npm ci` instead of `npm install`; pinned the runner to `ubuntu-24.04`, all actions to full commit SHAs, and Node 22.23.4/Python 3.13.18 with CI version assertions.
- Added CI coverage for previously unrun decrypt round-trip and make-wallet tests, and a regression check that live wallet generation refuses without a controlling terminal. The differential test's BTC/ETH/TRX index 0/1 coverage comes from the merged T30 extension.
- Added Dependabot for GitHub Actions, npm and pip; ignore `@trustwallet/wallet-core` major bumps pending a qualification run.
- The new workflow awaits its first GitHub Actions run; every step verified locally on Node 22.23.4 and Python 3.12.3.

- Added the Trust Wallet Core-backed wallet implementation under tools/.
- Added a pinned bip_utils independent-reference test layer.
- Added Trust Wallet registry and Trust Wallet Assets architecture guidance.
- Added implementation, testing, reference and recovery documents.
- Added CI execution for the independent public-vector verification.

## [1.1.0] — Documentation and hardening pass — date not evidenced

- Hardened secret handling, filesystem permissions and public-only derivation boundaries.
- Pinned Trust Wallet Core to an exact version.
- Added modular documentation for wallet generation, tracking, payment reconciliation, recovery, signing and operations.