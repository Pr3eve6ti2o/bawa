# Trust Wallet Core 4.8.4 AAR — Android Step 4 (2026-11-28)

Built from the official source, pinned to the 4.8.4 tag. Hands-on, 0 Sol calls.
No substitute version, library, or route was used.

## Source

- Clone: `/home/boxd/workspace/wallet-core` (outside the Bawa repo, read-only)
- Commit: `d40d24a63d92619167903369308bf0e2f7eb3a59` (tag 4.8.4, verified)
- Tree clean before and after the build; no patches, no edits to the clone.
  Two build-environment files were added OUTSIDE the clone, not in it:
  the Boost header symlink (below) and the generated `build/local`
  dependencies, which live in the clone's own build directory.

## Artefacts

- `core/libs/wallet-core-4.8.4.aar` — 29,994,177 bytes
  SHA-256 `0a231bfe938c63d79cefe9e65e82819f5f04e785c7ecec7c9044d2f307ee055b`
- `core/libs/wallet-core-proto-4.8.4.jar` — 3,408,348 bytes
  SHA-256 `0c3c00d142885cfeae216d5b6b7002e1c564c982c73093e3b083c8095e0c7df3`
- Copies staged at `/home/boxd/workspace/twc-4.8.4-out/` (build logs there too).

## ABIs (all four, each with libTrustWalletCore.so)

| ABI | .so bytes |
| --- | --- |
| arm64-v8a | 17,687,464 |
| armeabi-v7a | 12,608,068 |
| x86 | 20,410,828 |
| x86_64 | 19,160,672 |

JNI surface verified: `classes.jar` carries 88 `wallet/core/*` classes
(`wallet.core.jni.HDWallet`, `CoinType`, `Purpose`, `HDVersion`,
`wallet.core.java.AnySigner`); the arm64 `.so` exports 439
`Java_wallet_core_*` symbols, including `AnySigner_nativeSign` and
`HDWallet_getAddressForCoin`. The proto JAR carries 1,975 classes,
including `wallet.core.jni.proto.Bitcoin`, `Ethereum`, `Tron`.

## Build chain (all on loud-stone)

1. Gradle 8.10.2 (wrapper download), AGP 8.8.0, Kotlin 2.1.0 — direct
   egress, no proxy needed.
2. Host prerequisites installed via apt (standard toolchain, not Core):
   `libboost-dev` 1.83, `cmake` 3.28.3, `ruby` 3.2.3.
3. Rust: rustup + nightly-2025-12-11 + `rust-src` + the four Android
   targets + cbindgen 0.29.4 (the toolchain `tools/install-rust-dependencies`
   pins, Apple targets omitted — Linux Android build only).
4. `tools/install-dependencies` — protobuf 3.20.3 into `build/local`.
5. `tools/generate-files android` — coins, `rust-bindgen` (Rust lib for
   all four Android targets), codegen, protoc. All four
   `libwallet_core_rs.a` built (16.9–21.0 MB each).
6. `./gradlew :wallet-core:assembleRelease :wallet-core-proto:assemble`
   — BUILD SUCCESSFUL in 3m 43s, 0 errors.

## Two environment gotchas (no source changes)

- **Boost at configure time:** `find_host_package(Boost REQUIRED)` passed,
  but the Android cross-compile could not see `/usr/include/boost` — CMake
  omits `/usr/include` from the compile flags (compiler-implicit on the
  host, invisible to the NDK clang). Fix: symlink
  `build/local/include/boost -> /usr/include/boost`. That directory is
  already on the NDK include path, so only the Boost headers become
  visible; system headers still come from the Android sysroot. The
  wallet-core source was not touched.
- **Kotlin nested comments:** `CoreWalletEngine.kt`'s header KDoc contained
  the globs `/*.h` and `/*.proto`; Kotlin nests block comments, so those
  opened nested comments and the KDoc never closed. Reworded to plain
  text (no `/*` sequences inside comments).

## Integration fixes (in this commit)

All were latent defects in the Step 4 port that only surfaced once the
real AAR was on the classpath — verified against the built AAR with javap:

- `core/build.gradle.kts`: flatDir dependency used Groovy notation
  (`implementation(name = ..., ext = ...)`), which Kotlin DSL rejects.
  Now `implementation(group = "", name = ..., version = "", ext = ...)`.
- `core/build.gradle.kts` declared its own `repositories { flatDir }`,
  rejected because `settings.gradle.kts` sets
  `RepositoriesMode.FAIL_ON_PROJECT_REPOS`. flatDir moved to settings
  (`dirs("core/libs")`); the :core block is now a comment.
- `HDWallet.create(256, "")` does not exist in the 4.8.4 binding — the
  AAR exposes constructors (`HDWallet(int, String)`). Both call sites
  (fixture gate, createWallet) now use the constructor; the header note
  corrected.
- `DerivationPolicy.ENGINE_VERSION` 4.9.3 → 4.8.4 (the bound AAR);
  `ENGINE_BINDING_AVAILABLE` false → true; `DerivationPolicyTest`
  updated (`engineBindingIsAvailable`, asserts 4.8.4 + true). The web
  WASM pin stays 4.9.3 — separate engine.

## Gates (verified first-hand)

- `./gradlew assembleDebug` — BUILD SUCCESSFUL in 13s.
  APK 133,308,894 bytes (was 53,712,159 at Step 3 — the 4-ABI native libs).
- `./gradlew testDebugUnitTest` — BUILD SUCCESSFUL in 11s.
  77 tests passed, 0 failed, 0 skipped (57 pre-existing + 20 data-layer).
- `CoreWalletEngine` / `EthSendComposer` compile against the real AAR.
  The on-device fixture gate (fresh-wallet derivation + address
  validation) is NOT exercised by JVM unit tests — it needs a device or
  emulator, which is Step 5/6 territory.
