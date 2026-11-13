# Bawa Android starter (watch-only)

This is a watch-only Android wallet built on the UI layer of the Tether WDK Starter Kotlin foundation
(Apache-2.0, pinned at `a4fa2172`; see [upstream notes](../../templates/android/UPSTREAM.md)).
It validates extended public keys; it never generates, stores or displays a mnemonic, seed, private key,
private extended key, vault key or data key. It derives no address on-device.

## Build / test / run

- Gradle 8.7 (wrapper), AGP 8.2.2, Kotlin 1.9.22, JVM 17.
- Compose BOM 2024.02.00, Material 3, ZXing core 3.5.3 (QR display only).
- `compileSdk 35`, `minSdk 33`, `targetSdk 35`.

Google's official minimum-AGP table requires at least AGP 8.6.0 for API level 35, so this repo's AGP 8.2.2 with `compileSdk 35` is not officially supported. The build proceeds only because `apps/android/gradle.properties` sets `android.suppressUnsupportedCompileSdk=35`; the recorded `./gradlew assembleDebug` exited 0, so this suppressed-unsupported combination works in practice, rather than being a build failure. AGP 8.2.2's Gradle and JDK requirements are met: Gradle 8.2 minimum (repo: 8.7) and JDK 17 (repo: 17). The supported path is to upgrade AGP to 8.6.0 or newer, accounting for that version's Gradle/JDK requirements.

The Kotlin docs' fully-supported range for KGP 1.9.20–1.9.25 (including this repo's Kotlin 1.9.22) is Gradle 6.8.3–8.1.1 and AGP 4.2.2–8.1.0. The repo's Gradle 8.7 and AGP 8.2.2 exceed those maxima; the docs say newer versions "usually work" but may print deprecation warnings or leave new features unavailable. The recorded build passed, so this is a support-range caveat, not a failure.

- Package and `applicationId`: `com.bawa.wallet`; version: `0.1.0.

Use JDK 17 and an Android SDK with platform 35, build-tools 35.0.0, platform-tools, the emulator and
the `system-images;android-35;google_apis;x86_64` system image. The VM toolchain is installed outside
the repo; [docs/android-evidence.md](../../docs/android-evidence.md) records the exact paths.
`JAVA_HOME` must point at a JDK 17 and `ANDROID_HOME` at the SDK.

We use Gradle 8.7 because it is the foundation's wrapper. The local draft's 8.9 is unproven,
and its `:core` assumes a non-existent AAR.

From the repository root, substitute your toolchain paths:

~~~sh
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/android-sdk
cd apps/android
./gradlew assembleDebug
./gradlew testDebugUnitTest
~~~

Start an API 35 emulator using the image above, then install from `apps/android`:

~~~sh
./gradlew installDebug
~~~

Open the installed app from the emulator's launcher.

## What works

- Import one extended public key (xpub) per supported chain: BTC, ETH and TRX. Keys are validated before being stored in memory.
- Pure-Kotlin validation covers Base58Check decoding and checksum verification, private extended-key rejection, a per-chain version allow-list and secp256k1 point validation.
- The 14 welcome, portfolio and management screens show explicit mock or unavailable states where functionality is missing.
- Receive shows the imported xpub and derivation path, with instructions to derive addresses using the repository tools. It does not derive an address itself.
- QR display support exists in the vendored components for future use; it is not a working receive-address QR flow or a scanner.

## What is mock or unavailable

- **On-device address derivation:** open. No Trust Wallet Core AAR is available to this starter for any version. The app validates extended public keys and displays paths only.
- **Balances, prices and transaction history:** mock or unavailable. No provider has been selected.
- **Sending, signing and broadcast:** not implemented. There is no signing code.
- **Wallet creation on-device:** unavailable. Use [tools/make_wallet.py](../../tools/make_wallet.py) or [tools/hdwallet-gen/generate.js](../../tools/hdwallet-gen/generate.js) outside the app, then import only an extended public key.
- **TON:** generation-only in repository policy; unsupported by the Android starter.

The WDK starter's `wdk-core-kotlin` engine lives outside the starter repo, and the starter does not
build with it. We did not adopt that engine. The local draft's vault, signing, broadcast and adapter
code was not adopted either.

`core/DerivationPolicy.kt` records the following policy metadata. These are not implemented
on-device derivations or live confirmation checks.

| Chain | Declared derivation path | Confirmation policy |
| --- | --- | --- |
| BTC | `m/84'/0'/0'/0/i` | 6 |
| ETH | `m/44'/60'/0'/0/i` | Finalised + at least 12 extra |
| TRX | `m/44'/195'/0'/0/i` | 19 of 27 |
| TON | Generation-only; unsupported | 1 |

## Security notes

- The validator receives public extended-key input only, never secrets. Keep all secret material outside the app.
- Imported xpubs live in memory only in `ui/WalletViewModel.kt`; they are not persisted. Treat them as privacy-sensitive public data.
- Lock is a UI state only, not a security boundary.
- No secrets reach telemetry or any provider: there is no telemetry and no provider.
- The app requests no `INTERNET` permission.
- Backups disabled (T47): `android:allowBackup="false"` — wallet data must never
  leave the device in a cloud or adb backup.
- Screenshots blocked (T47): `MainActivity` sets `FLAG_SECURE`, so receive QR codes
  and xpubs do not appear in screenshots, screen recordings or recent-apps
  thumbnails. UI hardening only — the starter holds no secrets.
- Network posture explicit (T47): `res/xml/network_security_config.xml` forbids
  cleartext traffic. The app makes no network calls; the file exists so a future
  network addition cannot silently re-enable cleartext.
- Testnet only by policy; mainnet is out of scope.

## File map

Paths below are relative to `app/src/main/java/com/bawa/wallet/`.

- `ui/` — vendored WDK UI components.
- `ui/screens/` — 14 screens in `WelcomeScreens.kt`, `PortfolioScreens.kt` and `ManagementScreens.kt`.
- `ui/WalletViewModel.kt` — in-memory xpub state and UI-only locking.
- `core/` — pure-Kotlin validation in `ExtendedKeyValidator.kt`; derivation and confirmation policy in `DerivationPolicy.kt`.
- `MainActivity.kt` — Android entry point.

## Evidence

The validator tests run on the JVM with `./gradlew testDebugUnitTest`. Build and emulator evidence
live in [docs/android-evidence.md](../../docs/android-evidence.md); they do not establish on-device
address derivation support.
