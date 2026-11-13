# bitcoin-wallet

- Platform: cli
- Status: DOCUMENTED_NOT_TESTED — Documented but not tested.
- Chains: btc (m/84'/0'/0'/0/i)
- Engine: trust-wallet-core 4.9.3 — IMPLEMENTED_AND_VERIFIED
- UI: none / none — DOCUMENTED_NOT_TESTED
- Verification: DOCUMENTED_NOT_TESTED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- BTC watch-only derivation from extended public keys via the repo tools, fixtures exact at indices 0 and 1
- BTC generation via the CLI tools

## Missing

- a built Bitcoin wallet product
- send
- sign
- broadcast
- transaction construction
- 6-confirmation enforcement in code (policy only, documented not enforced)

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- Trust Wallet Core 4.9.3 is the verified tool pin in tools/hdwallet-gen. 4.9.2 is the guides' reference engine only, never the tool pin.
- BTC watch-only derivation from extended public keys is IMPLEMENTED_AND_VERIFIED through the repository tools. The engine status records derivation evidence, not verification of a complete Bitcoin wallet or every security boundary.
- Key generation policy is BIP-39 with 24 words and an empty passphrase. BTC uses m/84'/0'/0'/0/i, with account 0 and receiving branch 0 fixed.
- Send, sign and broadcast are DOCUMENTED_NOT_TESTED. No transaction-construction, signing or broadcast code exists in the repository.
- Testnet is the default; mainnet is out of scope by default.
- M-38 confirmation policy: BTC 6 confirmations, a customary recommendation. This is a documented policy, not enforced code.
- No graphical UI foundation applies to this CLI profile. Derivation evidence does not establish transaction operation.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- BTC watch-only derivation uses extended public keys only and preserves m/84'/0'/0'/0/i with account 0 and receiving branch 0
- any future transaction construction, send, sign, broadcast or BTC confirmation-policy enforcement has separate implementation and verification evidence on testnet

## Sources

- tools/hdwallet-gen
- docs/11-trust-wallet-and-independent-verification
- docs/14-wallet-app-implementation
- docs/mainnet/MAINNET-GUIDE.md
- M-38
