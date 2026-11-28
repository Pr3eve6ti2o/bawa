# :core module — engine + pure policy

## What lives here

- Pure Kotlin (no Android imports, JVM-testable): `DerivationPolicy`
  (merged — see below), `Keccak`, `Validation`, `Redaction`,
  `TxStateMachine`, `TonConfig`, `Fixtures`, `EngineError`,
  `NetworkConfig`, `WalletEngine` (interface + `FrozenPayload`).
- `CoreWalletEngine`: the ONLY file importing `wallet.core.jni`,
  `wallet.core.java`, or `wallet.core.jni.proto` (Trust Wallet Core
  4.8.4). Everything else in the app talks to the `WalletEngine`
  interface.
- `EthSendComposer`: Sepolia native-ETH send composer (pure proto
  assembly, no network, no secrets, no broadcast — it returns
  `SigningInput` bytes; the engine signs, an adapter broadcasts).

## This tree (not the reference)

- No version catalog and no GitHub Packages repo. `core/build.gradle.kts`
  uses literal versions (AGP 8.2.2, Kotlin 1.9.22, matching the root
  `build.gradle.kts`), `compileSdk 35`, `minSdk 33`, Java 17.
- The 4.8.4 AAR + proto JAR come ONLY from `core/libs/` (flatDir).
  `core/libs/` is intentionally empty in this lane: Lane A is building
  the artefacts from source (see `tools/build-core-aar.md`) and the
  coordinator copies them in. Do not put anything else in `core/libs/`.
- flatDir carries no transitive metadata, so `core/build.gradle.kts`
  declares `protobuf-javalite:3.22.3` explicitly — verified first-hand
  from the 4.8.4 source (`android/wallet-core-proto/build.gradle`).
  The generated proto classes are lite-runtime; `protobuf-java` (full)
  is the wrong artefact.
- `consumer-rules.pro` is written for this tree (the reference module
  had none): keep rules for `wallet.core.jni`, `wallet.core.java`,
  `wallet.core.jni.proto`, and native methods.
- No UI call sites yet: `:app` depends on `:core`
  (`implementation(project(":core"))`) but nothing calls the engine.
  Steps 5/6 wire usage.

## DerivationPolicy merge (Step 4, Lane B)

The reference core and `:app` each defined
`com.bawa.wallet.core.DerivationPolicy` and a top-level `Chain` in the
same package — a duplicate class at APK dex time. They are merged into
one `DerivationPolicy.kt` in `:core`:

- Reference engine API, verbatim: `Chain` (BTC/ETH/TRX/TON with
  slip44, purpose, path template, account origin, export kind,
  testnet), `ExportKind`, engine constants (`ACCOUNT`,
  `RECEIVING_BRANCH`, `MAX_INDEX`, `MNEMONIC_WORDS`, `PASSPHRASE`,
  `MAX_XPUB_LENGTH`, `checkIndex`, `checkChainForWatchOnly`).
- App/UI policy, verbatim from `:app`: `{index}` path templates,
  `pathFor`, confirmation thresholds (BTC 6, ETH finalised + 12 extra
  minimum, TRX 19/27, TON 1), `TESTNETS`, `ENGINE_VERSION`,
  `ENGINE_BINDING_AVAILABLE`.
- `:app`'s `DerivationPolicy.kt` was deleted (moved here) and the bare
  `enum class Chain { BTC, ETH, TRX }` was removed from
  `ExtendedKeyValidator.kt` (it now resolves `Chain` from `:core`).
- `Chain` gaining TON required three exhaustive-`when` branches in
  `:app`, each mechanical: `ExtendedKeyValidator` (TON has no xpub, so
  no extended key is valid for it), `BawaTheme.ChainTint` (new
  `TonTint`, TON brand blue `#0098EA`, matching the file's
  brand-colour convention), `PortfolioScreens.chainName` (`"TON"`).
  UI pickers still list BTC/ETH/TRX explicitly; `Chain.values()` maps
  in `WalletViewModel` gain an (undisplayed) TON entry.
- Two values are carried over UNCHANGED and flagged in the file for
  the coordinator to resolve at integration: `ENGINE_VERSION`
  ("4.9.3", the app's recorded repo pin — Step 4 pins Core 4.8.4) and
  `ENGINE_BINDING_AVAILABLE` (false until the AAR lands and the
  fixture gate passes; the test
  `DerivationPolicyTest.engineBindingIsUnavailable` asserts both).

No other overlaps: `Validation` (reference, light xpub/address checks)
and `ExtendedKeyValidator` (app, deep extended-key checks) are
different classes and coexist; no other reference top-level name
(`EngineError`, `TonConfig`, `Redaction`, `Keccak`,
`TxStateMachine`, `Fixtures`, `WalletEngine`, `CoreWalletEngine`,
`EthSendComposer`, `NetworkConfig`) exists in `:app`.

## Compile gate (read before building)

`CoreWalletEngine.kt` and `EthSendComposer.kt` compile ONLY when the
4.8.4 AAR (`wallet-core-4.8.4.aar`) and proto JAR
(`wallet-core-proto-4.8.4.jar`) are in `core/libs/`. Until Lane A
delivers them, `:core` does NOT compile — this lane is "ready for
AAR"; the coordinator runs `./gradlew :core:assembleDebug` after
copying the artefacts in.

Verified 2026-11-02 against the 4.8.4 tag (NOT substitute versions):

- No Android AAR ships in the 4.8.4 GitHub release assets
  (kdoc, Package.swift, Swift tarball + xcframeworks only).
- GitHub Packages metadata requires auth (401 without it).
- Maven Central republish `io.github.xemniz:trustwallet-core-android`
  has only 4.6.0 — REJECTED, would break the exact 4.8.4 pin.
- JitPack for 4.8.4 returns "No access token" — unusable.
- Entry points verified from the 4.8.4 source tree (C headers,
  codegen, Android tests): HDWallet create/import, getKey,
  getAddressForCoin, getExtendedPublicKey(/Account),
  getPublicKeyFromExtended, CoinType deriveAddress/
  deriveAddressFromPublicKey/validate, AnySigner sign/plan,
  TransactionCompiler pre-image/compile, coin values BTC 0 /
  ETH 60 / TRX 195 / TON 607.

Status: entry points VERIFIED; artefact acquisition in progress
(Lane A building from source). The app is structured around the
`WalletEngine` interface, and the fixture gate blocks all wallet
actions until a real Core build passes it. Derivation is NEVER
re-implemented in Kotlin.

## Open verification items for the builder with the AAR — TO-VERIFY

1. Whether the 4.8.4 generated `HDWallet` class exposes an
   explicit `delete()`/close for prompt native disposal.
   The phantom-reference cleanup itself is CONFIRMED from the
   4.8.4 source (`jni/java/GenericPhantomReference.java`: a
   `WCFinalizingDaemon` thread runs native onDelete callbacks on
   collection) — safe, but promptness of collection-driven cleanup
   is unverified, hence the open question about an explicit call.
2. `HDWallet.create(strength, passphrase)` static name and
   `CoinType.validate(address)` instance method (both follow
   standard codegen naming from the verified C API, but have not
   been compiled against the real AAR yet).
3. TON: `getAddressForCoin(TON)` returns Core's default TON
   address. The recorded `TonConfig` (contract version, wallet_id,
   workchain) is the user's chosen wallet contract; this build
   does NOT claim Core's default equals any particular contract
   version. TON signing is unimplemented (no TON.proto at 4.8.4).

## Tests

Pure-module JVM harness (no Android, no AAR):
`app-android/jvmtests/PureModuleTests.kt`, 55 checks, all passing
2026-11-02 (kotlinc 2.1.0, JDK 21). Run from `app-android/`:

```
kotlinc $(ls core/src/main/java/com/bawa/wallet/core/*.kt | grep -v CoreWalletEngine) \
  app/src/main/java/com/bawa/wallet/storage/VaultEnvelope.kt \
  jvmtests/PureModuleTests.kt -d /tmp/pure-tests.jar
java -cp /tmp/pure-tests.jar:<kotlinc>/lib/kotlin-stdlib.jar PureModuleTestsKt
```

(`CoreWalletEngine.kt` is excluded: it needs the AAR. Use absolute
paths — a `~` after `:` in `-cp` is not tilde-expanded.)

Fixture gate (needs a device/emulator — cannot run on loud-stone):
run the app's fixture gate; it must print all Core checks passing
(coin values, purposes, Core-validates-fixtures, fresh-wallet-24-words,
probe-addresses-validate, probe-xpub-prefixes). Any failure blocks all
wallet actions by design — do not bypass it, and do not "fix" a
failure by changing a fixture.
