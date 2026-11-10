# Android foundation adoption record

## 1. Source, pin and licence

- **Foundation:** Tether WDK Starter Kotlin (**AND-01**).
- **Decision:** **SELECTED Android foundation — UI LAYER ONLY**. Pre-approved by the owner on 2026-11-10 and confirmed by first-hand inspection on 2026-11-10.
- **Source:** [tetherto/wdk-starter-kotlin](https://github.com/tetherto/wdk-starter-kotlin).
- **Pinned commit:** `a4fa21729ba621c095d8638bc8c50de541008214`.
- **Licence:** Apache-2.0, recorded in upstream `LICENSE`. The **full licence text must be preserved with any vendored code**, and a **`NOTICE` must credit Tether**.
- **Bawa context:** `Pr3eve6ti2o/bawa`, HEAD `d7eafd5`; Phase 4 complete.

**Vendoring status: NOT vendored yet.** No WDK code is in this repository at Phase 5. Phase 7 performs the adoption; this record fixes its source, pin, licence obligations and scope.

## 2. What was inspected

### Commit and tree

The pinned commit exists: the GitHub API returned **200**. Its date is **2026-09-30**, its message is **“LGTM”**, and its tree contains **20 files**.

### Upstream toolchain and requirements

These are the inspected upstream values, not a selection of Bawa’s final Gradle version.

| Item | Value at the pin |
| --- | --- |
| Gradle wrapper | 8.7 |
| Android Gradle Plugin (AGP) | 8.2.2 |
| Kotlin | 1.9.22 |
| Compose BOM | 2024.02.00 |
| UI components | Material 3 |
| `compileSdk` | 35 |
| `minSdk` | 33 |
| `targetSdk` | 35 |
| Java/Kotlin JVM target | 17 |
| QR dependency | ZXing core 3.5.3 |

The README requires **JDK 17**, **Android SDK 35**, **Android Studio Hedgehog or newer**, and an emulator or device at **API 33+**.

### Screens and contract gaps

`Screens.kt` contains **7 composables**:

- `Welcome`
- `Create`
- `Import`
- `Home`
- `Send`
- `Receive`
- `Sign`

This does not meet the **14-screen contract** in `docs/14`, section 5.1. Missing coverage comprises asset list/detail, transaction history/details, network selection, wallet management, security & backup settings, and a mnemonic-backup screen.

### Missing-module finding

The inspected engine wiring is:

- `settings.gradle` includes `':wdk-core-kotlin'`, with `projectDir` pointing to `../wdk-core-kotlin`.
- `app/build.gradle` declares `implementation project(':wdk-core-kotlin')`.
- `WalletViewModel.kt` imports `to.tether.wdk.core.WdkCore`.

The engine module is **outside the starter repository**. Consequently, the pinned starter **does not build standalone from its own tree**. Its Gradle project shape is a starting point, not evidence of a standalone Bawa build.

## 3. What is adopted and what is EXCLUDED

### Planned adoption in Phase 7

The following form the starting point for `apps/android`:

- The Compose UI for `Welcome`, `Create`, `Import`, `Home`, `Send`, `Receive` and `Sign`.
- `Components.kt`.
- The Material 3 dark theme.
- The Gradle project shape, subject to removal of the engine dependency and resolution of the Gradle version.

This is UI-layer adoption only. Retaining a screen does not authorise reuse of its wallet or engine behaviour.

### EXCLUDED — remove from the imported starter, do not reuse

The engine, vault, derivation, signing and WDK-provider exclusions share the verified integration evidence in section 2: the external `wdk-core-kotlin` module, the application dependency and the `WdkCore` import.

- **WDK engine / `wdk-core-kotlin`:** excluded in full. The external module declaration, dependency and import demonstrate the coupling that must be removed.
- **12-word phrase policy and ceremony:** inspection identified the starter’s 12-word policy. It is not adopted; Phase 7 must rebuild this as Bawa’s **protected 24-word ceremony**.
- **Vault:** the WDK vault is excluded engine behaviour, not adopted UI; the shared WDK integration evidence above applies.
- **Derivation:** WDK derivation is excluded engine behaviour; the shared WDK integration evidence above applies.
- **Signing:** signing logic is excluded under the same verified engine coupling. Only the `Sign` composable’s UI is in scope.
- **Sending and balances via WDK providers:** provider-backed send and balance logic is excluded under the same verified engine coupling. Retaining `Send` or `Home` does not retain that logic.

**No signing, send or balance logic is adopted.**

## 4. Compatibility notes

- **JDK 17 is confirmed by the starter.** Its Java/Kotlin JVM target and README requirement confirm the Phase 4 JDK 17 proposal; it is no longer merely proposed.
- **Gradle remains undecided.** The WDK starter uses **8.7**; Bawa’s Android draft uses **8.9**. These differ. Phase 7 must pick one Gradle version for the starter and record why. This record selects neither.
- **Node >=20.19 is not inherited.** The upstream README requires it for the WDK worklet bundle. That requirement belongs to the excluded engine, not the UI-only adoption.
- **Upstream defaults are testnet.** The README states ETH Sepolia and BTC testnet, consistent with Bawa policy. This does not authorise adoption of WDK providers or their behaviour.

## 5. What Phase 7 must do

1. Adopt only the permitted UI and Gradle project shape from the recorded pin into `apps/android`. Preserve the full upstream licence text and include a `NOTICE` crediting Tether.
2. Remove `wdk-core-kotlin`, its external project reference, its application dependency and the `WdkCore` import. Remove all excluded vault, derivation, signing and WDK-provider send/balance logic rather than reusing it.
3. Rebuild the phrase ceremony as Bawa’s **protected 24-word ceremony**. Do not retain the 12-word policy.
4. Add the **7 missing screens** required to complete the 14-screen contract in `docs/14`, section 5.1, covering all gaps recorded in section 2.
5. Resolve the **Gradle 8.7 versus draft 8.9** difference, select one version and record the rationale.
6. Produce and record a **real Gradle build** using the confirmed JDK 17 requirement, without depending on `../wdk-core-kotlin`.
7. Verify and record the engine boundary: no excluded WDK dependency, import, phrase policy, vault, derivation, signing or provider logic may remain in the adopted starter. Confirm that the excluded worklet’s Node requirement has not been inherited.

## 6. What would invalidate this selection

Stop adoption and reassess the selection if:

- An upstream licence change affects the code to be adopted, or the full-licence preservation and Tether `NOTICE` obligations cannot be met.
- The pinned commit disappears or can no longer be retrieved and verified.
- Adoption reveals an exclusion violation, including retained WDK engine code, the 12-word policy, or excluded vault, derivation, signing or provider logic.
- The adopted UI cannot be made to build without retaining the external WDK engine or other excluded behaviour.

Selection of the foundation does not waive its UI-only boundary or establish that a Bawa Gradle build already exists.
