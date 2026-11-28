# android-wallet

- Platform: android
- Status: STARTER_IMPLEMENTED_AND_VERIFIED — Starter implemented and verified within its documented scope; not a complete wallet.
- Chains: btc (m/84'/0'/0'/0/i), eth (m/44'/60'/0'/0/i), trx (m/44'/195'/0'/0/i), ton (m/44'/607'/0' generation-only)
- Engine: trust-wallet-core 4.9.3 — OPEN
- UI: wdk-starter-ui-only / and-01-wdk-starter-kotlin — IMPLEMENTED_AND_VERIFIED
- Verification: PROPOSED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- 14-screen watch-only UI with honest states
- extended-public-key import (validator 10/10, policy 7/7 in unit tests)
- R-01 point validation mirrored in pure Kotlin
- receive-QR display
- Step 3 data layer (e20cee6, 2026-11-28): 87 chains, 169 RPCs, 4 testnets, 21 tokens in apps/android; 77 unit tests; debug APK 53,712,159 bytes

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

- Trust Wallet Core 4.9.3 is the verified tool pin in tools/hdwallet-gen and the required engine version for this profile. 4.9.2 is the guides' reference engine only, never the tool pin.
- Step 4 is DONE (2026-11-28, f9f312b): the Trust Wallet Core 4.8.4 AAR was built from the cloned source and wired into :core (apps/android/core/libs/wallet-core-4.8.4.aar, 29,994,177 bytes); ENGINE_BINDING_AVAILABLE = true and CoreWalletEngine compiles against the real AAR. Pin conflict: this profile requires engine 4.9.3, but the shipped AAR is 4.8.4 — the 4.9.3 requirement is NOT met. On-device derivation has still never been exercised (the on-device fixture gate has never run; Steps 5–6). CLI generation and derivation evidence does not establish Android engine operation.
- AND-01 pre-approves Tether WDK Starter, registry foundation and-01-wdk-starter-kotlin, for the UI layer only. Phase 5 inspection is complete (2026-11-10). Tether WDK Starter UI layer only (pin a4fa2172, Apache-2.0), vendored components with SeedWordCell/SeedInputCell removed; 14 screens; ./gradlew assembleDebug exits 0 (APK 53,712,159 bytes, Step 3 e20cee6; Step 4 APK 133,308,894 bytes, f9f312b, 2026-11-28; the 52,456,212-byte figure was the 2026-11-10 record); 77 @Test annotations across 10 test files (counted first-hand 2026-11-28); the historical 2026-11-10 record was 17/17 unit tests (ExtendedKeyValidatorTest 10/10 + DerivationPolicyTest 7/7); emulator (AVD bawa-pixel, API 35) install succeeds, app launches, welcome + import screens verified visually. The engine binding is wired (Step 4, f9f312b: 4.8.4 AAR, ENGINE_BINDING_AVAILABLE true) but on-device derivation is still unverified, and this foundation must not own transaction authority or signing policy.
- The default visual direction is Bawa Balanced (STYLE-04). Update 2026-11-27 (docs/DECISIONS.md §34): the owner picked style B — polished financial — as the wallet's direction, superseding STYLE-04 and its 4-colour cap; the Android theme still carries STYLE-04 tokens pending the style pass. The 14-screen contract in docs/14-wallet-app-implementation section 5.1 is the single source of truth for screens.
- Planned generation uses BIP-39 with 24 words and an empty passphrase. Fixed derivation policy: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i. Account 0 and receiving branch 0 are fixed. Watch-only derivation is restricted to BTC, ETH and TRX; on-device derivation is not implemented (the 4.8.4 AAR exists since Step 4, f9f312b, but the on-device fixture gate has never run); verification is through CLI tools and the web boundary tests, not Android derivation.
- TON is generation-only at m/44'/607'/0': a single address, wallet V4 R2, wallet ID 698983191. TON has no xpub and no watch-only route.
- The end-to-end send/sign/broadcast/confirm flow remains DOCUMENTED_NOT_TESTED; transaction construction (plan-transfer) and local signing exist in apps/web, but broadcast is not implemented anywhere in the repository.
- Mainnet is the default (ADR-0003); testnet is for demonstration/testing only.
- M-38 confirmation policies are not enforced in code: BTC 6 confirmations as a customary recommendation; ETH finalised, retaining "12" only as an unsourced extra minimum, never as a substitute for finality; TRX 19 distinct SRs of 27 via /walletsolidity/*; TON 1 masterchain seqno after inclusion plus an outgoing-message outcome check.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- starter builds from a clean checkout
- 14-screen contract coverage checked against docs/14 section 5.1
- the Tether WDK Starter foundation completes Phase 5 inspection before adoption and remains limited to the UI layer
- an Android binding to Trust Wallet Core 4.9.3 is established and verified before Android generation or derivation is described as verified; Android AAR availability is not presumed
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
