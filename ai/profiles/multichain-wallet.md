# multichain-wallet

- Platform: cli
- Status: DOCUMENTED_NOT_TESTED — Documented but not tested.
- Chains: btc (m/84'/0'/0'/0/i), eth (m/44'/60'/0'/0/i), trx (m/44'/195'/0'/0/i), ton (m/44'/607'/0' generation-only)
- Engine: trust-wallet-core 4.8.4 — IMPLEMENTED_AND_VERIFIED
- UI: none / none — DOCUMENTED_NOT_TESTED
- Verification: DOCUMENTED_NOT_TESTED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- generation for BTC/ETH/TRX/TON and watch-only derivation for BTC/ETH/TRX via the repo tools, fixtures exact
- TON single-address generation-only (V4 R2, wallet ID 698983191)

## Missing

- a built integrated multichain wallet product
- send
- sign
- broadcast
- cross-chain transaction operation
- confirmation-policy enforcement in code
- TON watch-only derivation

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- Trust Wallet Core 4.8.4 is the verified tool pin in tools/hdwallet-gen. 4.9.2 is the guides' reference engine only, never the tool pin.
- Generation for BTC, ETH, TRX and TON and watch-only derivation for BTC, ETH and TRX are IMPLEMENTED_AND_VERIFIED through the repository tools. This engine status does not establish an integrated multichain wallet or verification of every security boundary.
- Generation uses BIP-39 with 24 words and an empty passphrase. Fixed derivation policy: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i. Account 0 and receiving branch 0 are fixed.
- TON is generation-only at m/44'/607'/0': a single address, wallet V4 R2, wallet ID 698983191. TON has no xpub and is excluded from watch-only derivation.
- Send, sign and broadcast are DOCUMENTED_NOT_TESTED. No transaction-construction, signing or broadcast code exists in the repository.
- Testnet is the default; mainnet is out of scope by default.
- M-38 confirmation policies are not enforced in code: BTC 6 confirmations as a customary recommendation; ETH finalised, retaining "12" only as an unsourced extra minimum, never as a substitute for finality; TRX 19 distinct SRs of 27 via /walletsolidity/*; TON 1 masterchain seqno after inclusion plus an outgoing-message outcome check.
- No graphical UI foundation applies to this CLI profile. Shared derivation evidence does not establish cross-chain transaction operation.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- generation preserves the 24-word BIP-39 policy, empty passphrase and fixed chain-specific paths
- watch-only derivation remains restricted to BTC, ETH and TRX; TON remains single-address generation-only with wallet V4 R2 and wallet ID 698983191
- any future transaction construction, send, sign, broadcast or confirmation-policy enforcement has separate implementation and verification evidence for each chain on testnet

## Sources

- tools/hdwallet-gen
- docs/11-trust-wallet-and-independent-verification
- docs/14-wallet-app-implementation
- docs/mainnet/MAINNET-GUIDE.md
- M-38
