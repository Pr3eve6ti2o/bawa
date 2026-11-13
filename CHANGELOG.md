# Changelog

## [Unreleased]

- Added the Trust Wallet Core-backed wallet implementation under tools/.
- Added a pinned bip_utils independent-reference test layer.
- Added Trust Wallet registry and Trust Wallet Assets architecture guidance.
- Added implementation, testing, reference and recovery documents.
- Added CI execution for the independent public-vector verification.

### Changed

- Bumped `bip-utils` from 2.12.2 to 2.12.3 (differential test PASS with identical BTC/ETH addresses; 14/14 unit tests; verified 2026-11-13).

### Fixed

- Reconciled version metadata: `CHANGELOG.md` now lists `[Unreleased]` then `[1.1.0]`, matching both `package.json` files at 1.1.0; 1.2.0 was never released (R16 F2 resolved; R16 F4 remains open: zero tags).
- Corrected claims that `CHANGELOG.md` said 1.2.0 in the README changelog rules, docs/10 release metadata and the Android guide release-metadata item.
- Recorded the CI workflow correction: the workflow runs the syntax check, smoke tests (28/28) and the differential test; GitHub Actions run 28 at e3b65fb832db287fdc8d54794980dd0b3456cc12 completed successfully on 8 November 2026 (D09).
- Corrected Wallet Core pin wording: the installed pin is 4.8.4; 4.9.2 is the demonstrated reference (D21; GitHub pre-release), not the pin; 4.9.3 is the latest stable, not yet adopted (re-pinning and re-verification remain open).
- Corrected the platform-draft pin claim: only the repository tools pin Wallet Core 4.8.4; the Web draft pins 4.9.2 and the Android AAR procedure checks out tag 4.9.2.
- Fixed the broken docs/15 cross-reference in docs/10 to use `../15-threat-model-and-theft-prevention/README.md`.

## [1.1.0] — Documentation and hardening pass — date not evidenced

- Hardened secret handling, filesystem permissions and public-only derivation boundaries.
- Pinned Trust Wallet Core to an exact version.
- Added modular documentation for wallet generation, tracking, payment reconciliation, recovery, signing and operations.