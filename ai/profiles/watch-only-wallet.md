# watch-only-wallet

- Platform: cli
- Status: DOCUMENTED_NOT_TESTED — Documented but not tested.
- Chains: btc (m/84'/0'/0'/0/i), eth (m/44'/60'/0'/0/i), trx (m/44'/195'/0'/0/i)
- Engine: trust-wallet-core 4.9.3 — IMPLEMENTED_AND_VERIFIED
- UI: none / none — DOCUMENTED_NOT_TESTED
- Verification: DOCUMENTED_NOT_TESTED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- BTC/ETH/TRX watch-only derivation from extended public keys only via the repo tools, fixtures exact
- private-key inputs rejected pre-WASM
- invalid-point keys rejected (R-01)

## Missing

- a built watch-only wallet product or monitoring interface
- balances
- confirmation-policy enforcement
- TON (excluded: no xpub)
- any secret intake or signing

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- This profile holds no secrets and derives addresses from extended public keys only. It neither accepts nor creates mnemonics, seeds, private keys, private extended keys, vault keys or secret-bearing wallet handles.
- Any upstream mnemonic-based generation occurs outside this profile, inside the trusted key/vault boundary, and follows BIP-39 with 24 words and an empty passphrase.
- Trust Wallet Core 4.9.3 is the verified tool pin in tools/hdwallet-gen. 4.9.2 is the guides' reference engine only, never the tool pin.
- BTC, ETH and TRX watch-only derivation through the repository tools is IMPLEMENTED_AND_VERIFIED. The engine status covers those derivation primitives only. The watch-only wallet product has not been built and remains DOCUMENTED_NOT_TESTED.
- Fixed derivation policy: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i. Account 0 and receiving branch 0 are fixed. Address derivation uses the corresponding extended public keys, not private key material.
- TON is excluded because it has no xpub; its generation-only route is not part of this watch-only profile.
- Send, sign and broadcast are outside this profile and remain DOCUMENTED_NOT_TESTED. No transaction-construction, signing or broadcast code exists in the repository.
- Testnet is the default; mainnet is out of scope by default.
- M-38 confirmation policies are not enforced in code: BTC 6 confirmations as a customary recommendation; ETH finalised, retaining "12" only as an unsourced extra minimum, never as a substitute for finality; TRX 19 distinct SRs of 27 via /walletsolidity/*.
- No graphical UI foundation applies to this CLI profile. Verified derivation does not establish a built monitoring interface or enforced confirmation policies.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- only extended public keys are accepted for derivation and secret-bearing inputs are rejected
- BTC, ETH and TRX preserve the fixed account 0 and receiving branch 0 policy; TON remains excluded
- the watch-only wallet product is built and its public-key-only boundary is tested independently of the already verified derivation primitives
- any future confirmation-policy enforcement has separate implementation and verification evidence on testnet without introducing signing authority

## Sources

- tools/hdwallet-gen
- docs/11-trust-wallet-and-independent-verification
- docs/14-wallet-app-implementation
- docs/mainnet/MAINNET-GUIDE.md
- M-38
