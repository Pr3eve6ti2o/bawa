# hd-wallet-cli

- Platform: cli
- Status: DOCUMENTED_NOT_TESTED — Documented but not tested.
- Chains: btc (m/84'/0'/0'/0/i), eth (m/44'/60'/0'/0/i), trx (m/44'/195'/0'/0/i), ton (m/44'/607'/0', single-address generation + public-key-only watch-only)
- Engine: trust-wallet-core 4.8.4 — IMPLEMENTED_AND_VERIFIED
- UI: none / none — DOCUMENTED_NOT_TESTED
- Verification: DOCUMENTED_NOT_TESTED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- CLI generation of fresh test wallets via tools/hdwallet-gen/generate.js (24-word BIP-39, empty passphrase, AES-256-GCM seed bundle with bundle_verified check) and tools/make_wallet.py
- CLI watch-only derivation for BTC/ETH/TRX via derive.js/compare.js reproducing the published fixtures exactly
- TON watch-only derivation from a 32-byte Ed25519 public key via tools/hdwallet-gen/derive-ton.js reproducing the published fixture exactly (single V4 R2 address, no index)
- recovery via tools/decrypt_seed.py + re-derivation
- TON single-address generation (V4 R2, wallet ID 698983191)

## Missing

- a built CLI wallet product integrating these tools
- send
- sign
- broadcast
- confirmation-policy enforcement in code
- any graphical UI

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- Trust Wallet Core 4.8.4 is the verified tool pin in tools/hdwallet-gen. 4.9.2 is the guides' reference engine only, never the tool pin.
- Generation for BTC, ETH, TRX and TON and watch-only derivation for BTC, ETH, TRX and TON are IMPLEMENTED_AND_VERIFIED through the repository tools. The engine status covers these primitives only, not a complete wallet or verification of every security boundary.
- Generation uses BIP-39 with 24 words and an empty passphrase. Fixed derivation policy: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i. Account 0 and receiving branch 0 are fixed; i is the receiving address index.
- TON uses m/44'/607'/0': a single address, wallet V4 R2, wallet ID 698983191. TON has no xpub; TON watch-only derivation from a 32-byte Ed25519 public key via tools/hdwallet-gen/derive-ton.js is IMPLEMENTED_AND_VERIFIED against the published fixture (single address, no index).
- Send, sign and broadcast are DOCUMENTED_NOT_TESTED. No transaction-construction, signing or broadcast code exists in the repository.
- Testnet is the default; mainnet is out of scope by default.
- M-38 confirmation policies are not enforced in code: BTC 6 confirmations as a customary recommendation; ETH finalised, retaining "12" only as an unsourced extra minimum, never as a substitute for finality; TRX 19 distinct SRs of 27 via /walletsolidity/*; TON 1 masterchain seqno after inclusion plus an outgoing-message outcome check.
- No graphical UI foundation applies to this CLI profile. Full wallet verification remains DOCUMENTED_NOT_TESTED despite the verified generation and derivation primitives.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- generation uses 24 BIP-39 words with an empty passphrase and preserves the fixed chain-specific derivation policy
- watch-only derivation uses extended public keys for BTC, ETH and TRX, and a 32-byte Ed25519 public key for TON (single address, wallet V4 R2, wallet ID 698983191, no index)
- any future transaction construction, send, sign, broadcast or confirmation-policy enforcement has separate implementation and verification evidence on testnet

## Sources

- tools/hdwallet-gen
- docs/11-trust-wallet-and-independent-verification
- docs/14-wallet-app-implementation
- docs/mainnet/MAINNET-GUIDE.md
- M-38
