# ai/prompts/create-android-wallet.md

Request: Create an Android wallet UI following the 14-screen contract.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `registry/profiles.json` entry `android-wallet` (validated in Phase 3; run `node scripts/validate-registry.mjs` to re-check).

- Proposed UI contract: 14 screens, referenced by `docs/14`, section 5.1.
- Foundation: Tether WDK Starter Kotlin, UI layer only (owner-approved).
- Build baseline: Android debug APKs are produced by `./gradlew assembleDebug` (Step 3 APK 53,712,159 bytes, e20cee6; Step 4 APK 133,308,894 bytes, f9f312b, 2026-11-28); the Trust Wallet Core 4.8.4 AAR exists (Step 4 done 2026-11-28, f9f312b; apps/android/core/libs/wallet-core-4.8.4.aar).
- Chain and derivation coverage: OPEN.
- Verification required: a Phase 3 profile pass before promising this profile; 14-screen contract verification and Phase 5 foundation confirmation by inspection; exact procedures and passing evidence, including Android build evidence: OPEN.

Out of scope: claiming on-device derivation, signing or broadcast support (the AAR exists since Step 4, f9f312b; on-device derivation has never been exercised).
