# Bawa AI Wallet Builder — final handoff

This is the final report for the Bawa AI Wallet Builder programme, Phases 0–10. All work was carried out by GPT-6-Astra (API 2, max reasoning), with first-hand verification by Orion. All 9 builder commits remain local; none has been pushed. The delivery is builder infrastructure and Web/Android starters, not complete wallet applications. The checks below establish evidence within a stated scope; they do not remove the implementation gaps, outstanding review requirements or separate approval gates.

## Master plan §11.2 report

| Area | Final report |
| --- | --- |
| Repository identity | Repository: `Pr3eve6ti2o/bawa`. Working copy: `/home/boxd/workspace/bawa-builder/bawa`.<br>Base: `main` at **H7 `b438d3a7`** (daemon fix). **9 local builder commits on top; nothing pushed.**<br>`0986c4c` — plan, **881 lines**.<br>`9455024` — Phase 2, AI entry + routing.<br>`51c7e39` — Phase 3, registries.<br>`d7eafd5` — Phase 4, engine + negative tests.<br>`05c76b4` — Phase 5, UI research + catalogue.<br>`703bf86` — Phase 6, Web starter, **101 files**.<br>`e4b3e2f` — Phase 7, Android starter, **25 files**.<br>`6258464` — Phase 8, one-prompt workflow.<br>`661a7a5` — Phase 9, quality gates. |
| AI entry | Read `AGENTS.md` first, then `WALLET_BUILDER.md`. Routing is through `ai/request-routing.md` + `ai/detect-capabilities.mjs`. The one-prompt workflow is `scripts/build-wallet.mjs`. |
| Profiles | **7 profiles:** `hd-wallet-cli`; `bitcoin-wallet`; `evm-wallet`; `multichain-wallet`; `web-wallet` (**IMPLEMENTED_AND_VERIFIED**); `android-wallet` (**IMPLEMENTED_AND_VERIFIED**); `watch-only-wallet`.<br>The Web/Android status labels describe the starter scope and checks below, not complete wallet applications. No additional profile verification status is asserted here. |
| Engines | `@trustwallet/wallet-core` **4.8.4 — IMPLEMENTED_AND_VERIFIED**. Version **4.9.1** exists but is **untested**, an upgrade candidate only. **No AAR for any version.** |
| Templates | **token-ui** — pin `6380d5d4`, MIT; Web foundation, vendored into `apps/web/src/ui/`.<br>**Tether WDK Starter** — pin `a4fa2172`, Apache-2.0; Android UI layer only; its `wdk-core` module is external.<br>**shadcn/ui** — pin `8ab27715`, MIT; alternative, not selected.<br>**devkit-wallet** — pin `36392bfc`, Apache-2.0, archived; legacy reference.<br>**compose-samples** — pin `25631e8f`, Apache-2.0; generic foundation.<br>**Edge React GUI** — pin `95f46b8f`, BSD-3-Clause; research-only.<br>**XChain** — pin `3e550d05`, AGPL-3.0; research-only; pin **UNVERIFIED — does not resolve**. |
| Web | `apps/web`: React **19** + Vite **8** + Tailwind **4**, npm.<br>`npm run build` **exit 0**; **25 tests pass**. Wallet-core WASM is served from `public/`; the **4.8.4** build rejects `locateFile`/`wasmBinary`. Preview serves index + WASM with **HTTP 200**.<br>**Unverified: no live browser run. Balances, send, prices and history are not implemented.** This is a starter, not a complete Web wallet. |
| Android | `apps/android`: Gradle **8.7**, AGP **8.2.2**, Kotlin **1.9.22**, Compose BOM **2024.02.00**; `compileSdk 35`, `minSdk 33`, `targetSdk 35`; JVM **17** (Temurin **17.0.21**); Android SDK platform **35** + build-tools **35.0.0**.<br>`./gradlew assembleDebug` **exit 0**; `app-debug.apk` **52,456,212 bytes**; **17 unit tests pass**.<br>Emulator: AVD `bawa-pixel`, API **35**, TCG `-accel off`; install **Success**; app launched, pid **2175**; welcome + import screens verified visually.<br>**Unverified:** on-device Add-button acceptance (taps swallowed under TCG load); KVM-backed run (a KVM-engaged launch crashed `muse-vm` in **~8 s**); on-device derivation (**no AAR**). This is a starter, not a complete Android wallet. |
| Chains | BTC/ETH/TRX watch-only derivation **VERIFIED**: fixtures at indices **0 and 1** match exactly. TON is **generation-only**: UQ fixture, **V4 R2**, wallet ID **698983191**.<br>Confirmation policy: **BTC 6; ETH finalised + 12 extra minimum; TRX 19 of 27; TON 1**. These are policy values, not evidence of exercised transaction behaviour.<br>**Send/sign/broadcast never exercised. No provider selected; no balances/history.** |
| Security | Quality gates: **11/11 PASS**, covering registry, negative inputs, engine suite, phase9 tests, Web typecheck/tests/build, Android tests, secret scan with a value allowlist for the **4 published BIP-32 vectors**, and lockfiles.<br>**R-01** point validation is mirrored in both starters. The **H7 Node validator does NOT yet reject invalid points**; fix pending in the `auditfix2` lane, **H8**.<br>Astra’s Phase 9 second-pass review returned **BLOCKED**: no file access, no findings, verdicts withheld. Orion reviewed the same **five areas** first-hand instead. That does not satisfy the independent external review requirement.<br>Independent external review **NOT designated (M-31/M-15)**. `SECURITY.md` has **no disclosure procedure**. |
| Reproducibility | Lockfiles: `apps/web/package-lock.json` (**npm 10.9.9**, **Node 22**) and `tools/hdwallet-gen/package-lock.json`.<br>Supported Node range: `>=22 <23`; **v22.23.4** was used. The VM default **v24** is out of range and `setup.mjs` correctly fails on it. **JDK 17 and the Android SDK are outside the repo.**<br>Clean-checkout tests: **3/3 in 31.3 s**. Multi-chain request: **6/6 steps VERIFIED**. |
| Decisions | Owner-approved: **Astra-only permanent**; **all-phases approval**; Web **REPLACE with token-ui**; Android **ADAPT UI only**; **Bawa Balanced** default; engine stays **4.8.4**; **per-app lockfiles**; **XChain research-only**; **QR receive + scanning both kept**.<br>These decisions do not replace the separate approvals below. Retaining a feature in scope is not verification of that feature. |
| Remaining work | Concrete blockers only:<br>**M-31/M-15 independent review** — needs a reviewer designation.<br>**M-35 rehearsal execution** — needs separate approval.<br>**M-39 GUI watch-only test** — needs a desktop machine.<br>**Mainnet activation** — needs separate approval + gates.<br>**H8 push of the `auditfix2` fix** — needs the user’s push approval.<br>**On-device Android Add verification** — needs a real device or a KVM-good host.<br>**Doc 4 §5 step-4 SHA refresh** — next Doc 4 re-issue.<br>**D06 F8 `BAWA_*` rename** — needs a guarded migration decision.<br>**`SECURITY.md` disclosure procedure** — maintainer action. |

## Verified, documented-not-tested, and open

### Verified

Verification covers the recorded quality gates, exact BTC/ETH/TRX watch-only fixtures, Web build/tests and preview serving, Android build/unit tests, emulator installation/launch and visual welcome/import checks, clean-checkout tests and the multi-chain workflow. The counts and environments are in the table. None establishes a complete Web or Android wallet.

### Documented-not-tested

The confirmation counts are recorded policy, not live transaction evidence. Send/sign/broadcast has never been exercised. Wallet-core 4.9.1 remains an untested upgrade candidate. Guides, catalogue entries and owner-approved scope do not make a feature **VERIFIED** merely by explaining how to implement it.

### Open

The Remaining work row is the concrete blocker list. Web live-browser behaviour, Android Add-button acceptance, a successful KVM-backed run and on-device derivation remain unverified. Missing Web features and provider-backed balances/history remain absent. Starter point validation does not close the H7 Node defect, and the blocked Astra review supplied neither findings nor a verdict. Independent external review remains outstanding.

## What this repo is not

- It is not a hosted wallet, custody service or exchange.
- It is not a complete Web or Android wallet application, and is **not production-ready, secure or audited**. Passing internal checks does not establish those properties.
- It is **not safe for real funds**. Do not use these starters to hold or move real funds.
