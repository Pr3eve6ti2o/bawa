# Bawa Reference Implementation

Bawa contains a small, security-conscious reference implementation for one-time wallet creation and watch-only public derivation. It is deliberately narrower than a commercial wallet product.

## Runtime boundary

```
Trusted / interactive machine
  Trust Wallet Core
      ↓
  mnemonic + seed
      ↓
  account-level public roots

Online application
  xpub / zpub / public address only
      ↓
  address derivation
      ↓
  RPC / node / indexer
      ↓
  tracking / payment reconciliation
```

The generator does not need an online chain connection to create wallet material. The watch-only tools do not accept a private extended key.

## Current implementation

- `tools/make_wallet.py` — orchestration, environment/bootstrap checks and backup handling.
- `tools/hdwallet-gen/generate.js` — Trust Wallet Core generation and public-root export.
- `tools/hdwallet-gen/derive.js` — one-shot public derivation.
- `tools/hdwallet-gen/derive_daemon.js` — JSON-line daemon for repeated public derivation.
- `tools/hdwallet-gen/compare.js` — public-only comparison helper.
- `tools/decrypt_seed.py` — controlled recovery of the encrypted seed artifact.

## Current reference policy

- Bitcoin BIP-84 account: `m/84'/0'/0'` → `zpub`.
- Ethereum BIP-44 account: `m/44'/60'/0'` → `xpub`.
- TRON BIP-44 account: `m/44'/195'/0'` → `xpub`.
- TON: address plus the exact Wallet Core-derived path metadata; it is not flattened into a generic xpub flow.

TON is intentionally treated as chain-specific because wallet contract/version and wallet-ID/subwallet semantics matter.

## Verification layers

1. Trust Wallet Core deterministic self-checks.
2. Official BIP/CIP/TEP vectors where available.
3. Independent `bip_utils` comparisons for overlapping derivation policies.
4. Negative/security tests.
5. Application integration and reconciliation tests outside the wallet package.

See [Testing](docs/TESTING.md).

## Dependency rule

`@trustwallet/wallet-core` is the wallet-crypto engine. `bip-utils` is a pinned reference-test dependency only. `@hdwallet/core` is not used by the runtime.

## Production status

This is reference/security-conscious code, not a security audit and not a hosted custody solution. Before real-money deployment, complete clean dependency installation and lockfile generation, full independent differential coverage, chain-specific fixtures, secret/dependency scanning, reproducible release checksums/provenance and an external security review.
