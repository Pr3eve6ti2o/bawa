# Changelog

## 1.2.0 — Trust Wallet reference layer

- Added the Trust Wallet Core-backed wallet implementation under tools/.
- Added a pinned bip_utils independent-reference test layer.
- Added Trust Wallet registry and Trust Wallet Assets architecture guidance.
- Added implementation, testing, reference and recovery documents.
- Added CI execution for the independent public-vector verification.

## 1.1.0 — Documentation and hardening pass

- Removed the standalone runtime dependency on the parent application's payment modules.
- Hardened secret handling, filesystem permissions and public-only derivation boundaries.
- Pinned Trust Wallet Core to an exact version.
- Added modular documentation for wallet generation, tracking, payment reconciliation, recovery, signing and operations.
