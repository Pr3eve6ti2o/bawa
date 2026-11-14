# Changelog

This changelog follows [Keep a Changelog](https://keepachangelog.com/). The project follows [Semantic Versioning](https://semver.org/).

No release tags exist in the repository. There is no tagged release baseline.

## [Unreleased]

This section holds forthcoming changes.

## [1.2.0] - 2026-11-13

### Added

- Added the Trust Wallet Core-backed wallet implementation under `tools/`.
- Added a pinned `bip_utils` independent-reference test layer.
- Added Trust Wallet registry and Trust Wallet Assets architecture guidance.
- Added implementation, testing, reference, and recovery documentation.
- Added CI execution for independent public-vector verification.

## [1.1.0] - 2026-10-05

### Added

- Added modular documentation for wallet generation, tracking, payment reconciliation, recovery, signing, and operations.

### Changed

- Removed the standalone runtime dependency on the parent application's payment modules.
- Pinned Trust Wallet Core to an exact version.

### Security

- Hardened secret handling, filesystem permissions, and public-only derivation boundaries.