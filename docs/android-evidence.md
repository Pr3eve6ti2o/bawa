# Android evidence (Phase 7)

Recorded first-hand on muse-vm, 2026-11-10. Toolchain lives OUTSIDE the
repo at /home/boxd/workspace/android-tooling/ (Temurin JDK 17.0.21+9;
Android SDK cmdline-tools 11076708; platform-tools 37.0.1;
platforms;android-35 rev 2; build-tools 35.0.0; emulator 37.2.13;
system-images;android-35;google_apis;x86_64 rev 9; licences accepted).
Builds use JAVA_HOME=<tooling>/jdk17 and ANDROID_HOME=<tooling>/sdk.

## Pins (all from the WDK Starter, pin a4fa2172, Apache-2.0)

Gradle 8.7 (wrapper), AGP 8.2.2, Kotlin 1.9.22, Compose BOM 2024.02.00,
compileSdk 35, minSdk 33, targetSdk 35, JVM 17, ZXing core 3.5.3, JUnit
4.13.2. Gradle 8.7 was chosen over the draft's 8.9 because 8.7 is the
foundation's wrapper; the draft's 8.9 is unproven and its :core assumes a
Trust Wallet Core AAR that does not exist for any version. No Trust Wallet
Core AAR exists for any version, so on-device derivation is OPEN: the
starter validates extended public keys and shows the derivation path, but
derives no address on-device.

## Build + unit tests

- `./gradlew testDebugUnitTest` — BUILD SUCCESSFUL. 17/17, 0 failures:
  ExtendedKeyValidatorTest 10/10 (valid BTC/ETH/TRX fixtures; bad
  checksum, wrong version, private-key, invalid-point, invalid-base58,
  invalid-length rejections; whitespace trimmed),
  DerivationPolicyTest 7/7 (paths, index range, M-38 confirmation
  policy, testnet-only, engine 4.8.4 + binding unavailable).
- `./gradlew assembleDebug` — BUILD SUCCESSFUL in 47 s.
  app-debug.apk, 52,456,212 bytes.

## Emulator (AVD bawa-pixel, API 35, x86_64)

- KVM: /dev/kvm exists but boxd was not in the kvm group — fixed with
  `sudo usermod -aG kvm boxd`. The first launch with KVM engaged crashed
  muse-vm within ~8 s (VM went FAILED, cold-booted; the working copy,
  APK and toolchain survived — the workspace persists, /tmp was wiped).
  The emulator was therefore run with `-accel off` (TCG software
  emulation, no KVM): very slow (first boot ~21 min to boot_completed=1;
  load average ~9 on 8 vCPUs) and system processes ANR repeatedly.
- First boot's package service never registered (install failed with
  "Broken pipe (32)"; `service check package` returned "not found").
  After `adb reboot`, the package service registered and the install
  succeeded: `adb install -r app-debug.apk` → Success;
  `pm list packages` shows `package:com.bawa.wallet`.
- Launch: `am start -n com.bawa.wallet/.MainActivity` → app process
  started (pid 2175, still alive at the end of the session). Logcat
  shows NO fatal error for com.bawa.wallet (the only FATALs are the
  emulator's Bluetooth stack, SIGABRT in droid.bluetooth — unrelated).
- Screenshots (kept in the lane evidence dir, not the repo):
  welcome5.png — the welcome screen fully rendered (Bawa Wallet,
  Testnet badge, watch-only copy, Create / Import / Networks / Manage
  wallets / Security, "Testnet by default; mainnet is out of scope");
  import2.png — the Import screen (warning copy, BTC/ETH/TRX selector,
  xpub + label fields, Add, Imported wallets); imported3.png — the xpub
  field holding typed input. Two system ANR dialogs ("Process system
  isn't responding", "System UI isn't responding") appeared and were
  dismissed with Wait; they are emulator-environment load artefacts,
  not app defects — the app rendered correctly behind them.
- On-device import (Add button): NOT VERIFIED. The xpub field accepted
  typed input (verified via uiautomator: the field held the typed text),
  chain selection worked (ETH selected), but the Add button tap did not
  register despite repeated taps with long settles — input injection is
  intermittently swallowed under TCG load. The validator itself is
  proven by the JVM unit tests above (same fixtures, same rejection
  reasons); the on-device Add path needs a real device or a KVM-backed
  emulator to verify.

## Engine-policy parity

The Kotlin validator mirrors the Node implementation
(tools/hdwallet-gen/extended-key.js) and the Web boundary
(apps/web/src/engine/boundary.ts): same base58check, checksum, private
rejection, per-chain version allow-list and R-01 point validation. The
JVM tests use the same published fixtures (BTC zpub, ETH xpub, TRX
xpub) and the same runtime-constructed negative vectors. Derivation
policy constants match Doc 4 / M-38 (BTC 6, ETH finalised + 12 extra
minimum, TRX 19 of 27, TON 1).

## Not done / open

- On-device address derivation: OPEN (no AAR for any version).
- On-device Add-button acceptance path: NOT VERIFIED (see above).
- KVM-backed emulator run: NOT attempted again after the VM crash;
  needs a host where nested KVM is known-good, or a real device.
- The M-39 desktop GUI watch-only test is a separate item and is NOT
  this emulator run.
