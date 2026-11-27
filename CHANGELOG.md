# Changelog

This changelog does not claim full conformance to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): the date for [1.1.0] is not evidenced. Adherence to [Semantic Versioning](https://semver.org/) is not established by the available evidence, and there is no declared public API. Entries under [Unreleased] describe changes since the last versioned section; a versioned section is a release only once it is tagged. No release tags exist yet, so [1.1.0] below is the recorded version state, not a tagged release.

## [Unreleased]
- Re-pinned Trust Wallet Core from 4.8.4 to 4.9.3 (owner order, 2026-11-18): `tools/hdwallet-gen/package.json` and lockfile, WASM sha256 `13a18a38...77217` (10,422,325 bytes), M05 O3 qualification run passed (npm test, launcher suite 48/48, differential test PASS, fixture addresses match). The TRX 33-byte compressed-pubkey WASM abort persists on 4.9.3; the JS-first decompression in `derive.js` still applies. Some documentation pin statements were updated to Core 4.9.3, but stale 4.8.4 references remain; dated 4.8.4 verification records kept as history.

- At `main` HEAD `667527e`, `assert_bundle_decrypts` is now called in `main()` at `tools/make_wallet.py:329`, via the `BAWA_DATA_KEY_FD` data-key pipe.

- Added the Trust Wallet Core-backed wallet implementation under tools/.
- Added a pinned bip_utils independent-reference test layer.
- Added Trust Wallet registry and Trust Wallet Assets architecture guidance.
- Added implementation, testing, reference and recovery documents.
- Added CI execution for the independent public-vector verification.
- Reworked README, CONTRIBUTING, SECURITY and the docs map, and added ARCHITECTURE.md, from the repo-craft research findings: human voice, verified commands and gates, and a Diátaxis docs map.

### Changed

- Bumped `bip-utils` from 2.12.2 to 2.12.3 (differential test PASS with identical BTC/ETH addresses; 14/14 unit tests; verified 2026-11-13).

### Fixed

- Corrected Wallet Core pin wording (as recorded at [1.1.0], before the 2026-11-18 re-pin in [Unreleased]): the installed pin was 4.8.4; 4.9.2 was the demonstrated reference (D21; GitHub pre-release), not the pin; 4.9.3 was the latest stable, not yet adopted (re-pinning and re-verification remained open).
- Clarified the platform-draft pin references (as recorded at [1.1.0], before the 2026-11-18 re-pin in [Unreleased]): repository tools pinned Wallet Core 4.8.4; the Web guide specified Wallet Core 4.9.2 as its reference pin in its tool table; the Android AAR procedure checked out tag 4.9.2.
- Removed the carried-over CI workflow entry and its incorrect "smoke tests (28/28)" figure: 28 is the whole npm-test total at `e3b65fb8`, not a `smoke.test.js` count.

## [1.1.0] — Documentation and hardening pass — date not evidenced

- Hardened secret handling, filesystem permissions and public-only derivation boundaries.
- Pinned Trust Wallet Core to an exact version.
- Added modular documentation for wallet generation, tracking, payment reconciliation, recovery, signing and operations.
