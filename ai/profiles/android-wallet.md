# android-wallet

- Platform: android
- Status: STARTER_IMPLEMENTED_AND_VERIFIED — Starter implemented and verified within its documented scope; not a complete wallet.
- Chains: btc (m/84'/0'/0'/0/i), eth (m/44'/60'/0'/0/i), trx (m/44'/195'/0'/0/i), ton (m/44'/607'/0' generation-only)
- Engine: trust-wallet-core 4.8.4 — OPEN
- UI: wdk-starter-ui-only / and-01-wdk-starter-kotlin — IMPLEMENTED_AND_VERIFIED
- Verification: PROPOSED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- 14-screen watch-only UI with honest states
- extended-public-key import (validator 10/10, policy 7/7 in unit tests)
- R-01 point validation mirrored in pure Kotlin
- receive-QR display

## Missing

- on-device address derivation (no AAR)
- send
- sign
- broadcast
- balances
- prices
- transaction history
- on-device Add-button acceptance path (taps swallowed under TCG emulation — NOT VERIFIED)
- KVM-backed emulator run (a KVM-engaged launch crashed the host VM in ~8 s — NOT VERIFIED)

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- Trust Wallet Core 4.8.4 is the verified tool pin in tools/hdwallet-gen and the required engine version for this profile. 4.9.2 is the guides' reference engine only, never the tool pin.
- No Android AAR exists for any version and no Android engine binding is verified. The Android engine binding remains OPEN. CLI generation and derivation evidence does not establish Android engine operation.
- AND-01 pre-approves Tether WDK Starter, registry foundation and-01-wdk-starter-kotlin, for the UI layer only. Phase 5 inspection is complete (2026-11-10). Tether WDK Starter UI layer only (pin a4fa2172, Apache-2.0), vendored components with SeedWordCell/SeedInputCell removed; 14 screens; ./gradlew assembleDebug exits 0 (APK 52,456,212 bytes); 17 unit tests pass; emulator (AVD bawa-pixel, API 35) install succeeds, app launches, welcome + import screens verified visually. This foundation does not provide a verified Android engine binding and must not own transaction authority or signing policy.
- The default visual direction is Bawa Balanced (STYLE-04). The 14-screen contract in docs/14-wallet-app-implementation section 5.1 is the single source of truth for screens.
- Planned generation uses BIP-39 with 24 words and an empty passphrase. Fixed derivation policy: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i. Account 0 and receiving branch 0 are fixed. Watch-only derivation is restricted to BTC, ETH and TRX; on-device derivation is not implemented (no AAR); verification is through CLI tools and the web boundary tests, not Android derivation.
- TON is generation-only at m/44'/607'/0': a single address, wallet V4 R2, wallet ID 698983191. TON has no xpub and no watch-only route.
- Send, sign and broadcast are DOCUMENTED_NOT_TESTED. No transaction-construction, signing or broadcast code exists in the repository.
- Testnet is the default; mainnet is out of scope by default.
- M-38 confirmation policies are not enforced in code: BTC 6 confirmations as a customary recommendation; ETH finalised, retaining "12" only as an unsourced extra minimum, never as a substitute for finality; TRX 19 distinct SRs of 27 via /walletsolidity/*; TON 1 masterchain seqno after inclusion plus an outgoing-message outcome check.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- starter builds from a clean checkout
- 14-screen contract coverage checked against docs/14 section 5.1
- the Tether WDK Starter foundation completes Phase 5 inspection before adoption and remains limited to the UI layer
- an Android binding to Trust Wallet Core 4.8.4 is established and verified before Android generation or derivation is described as verified; Android AAR availability is not presumed
- the fixed derivation policy is preserved, including BTC/ETH/TRX-only watch-only derivation and TON single-address generation-only
- any future transaction construction, send, sign, broadcast or confirmation-policy enforcement has separate implementation and verification evidence on testnet

## Sources

- tools/hdwallet-gen
- docs/11-trust-wallet-and-independent-verification
- docs/14-wallet-app-implementation
- docs/mainnet/MAINNET-GUIDE.md
- and-01-wdk-starter-kotlin
- AND-01
- STYLE-04
- M-38
