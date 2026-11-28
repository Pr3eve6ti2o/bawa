# Bawa Android data layer (Step 3)

Step 3 of the Android programme (PROGRAMME.md in the sandbox workspace):
chain registry, RPCs, token lists, prices, icons, balances, history —
wired from the Step 1 JSON export. Hands-on, 0 Sol calls.

## What was built

- `app/src/main/java/com/bawa/wallet/data/`
  - `RegistryModels.kt` — `@Serializable` models mirroring the export
    schema (`registry/schemas/*.schema.json`). Nullability was measured
    from the export, not guessed.
  - `ChainRegistry.kt` — loads `chains.json`: 87 mainnet chains, 4
    testnets, 169 live-verified RPC endpoints. Lookups by chain id,
    explorer transaction URLs from the recorded patterns.
  - `TokenRepository.kt` — loads `tokens.json`: 21 curated tokens on
    10 chains, keyed by contract address.
  - `BalanceRepository.kt` / `HistoryRepository.kt` — the contracts
    Step 5 will implement, plus the honest Step 3 implementations
    (`NoProvider*`): without a provider the only answer is
    `Unavailable`, never $0.00 and never an invented transaction.
  - `ChainIconResolver.kt` / `TokenIconResolver.kt` — chain id /
    symbol to bundled logo asset, transcribed from the web wallet's
    `CHAIN_LOGOS` / `TOKEN_LOGOS` (`apps/web/src/screens/token-logo.tsx`).
    Unmapped ids return null so the UI falls back to the letter disc.
- `app/src/main/assets/registry/` — verbatim copies of
  `registry/chains.json` + `tokens.json` (sourceCommit 7efba14,
  sourceDirty false). The app reads these at runtime.
- `app/src/main/assets/icons/chains/` (87 .webp) +
  `icons/tokens/` (8 .webp) — verbatim copies of the web's canonical
  logos (`apps/web/src/assets/chains|tokens/*.webp`). Licence: Trust
  Wallet Assets, MIT — see `apps/web/README.md` "Chain logos" /
  "Token logos" and the `token-logo.tsx` header.
- `WalletViewModel` takes the two repositories (optional — existing
  tests still construct it with no arguments) and exposes the chains
  and testnets as state. `MainActivity` builds them from the app
  assets; a failed load falls back to an empty registry, never a crash.
- `NetworkSelectionScreen` lists all 87 mainnet chains + 4 testnets
  from the registry (logo, name, symbol, RPC count). The hardcoded
  3-testnet list and the "mainnet out of scope" cards are gone —
  mainnet is the programme default (owner-approved "all", 2026-11-27).
- Asset rows and the Popular chains strip show the real logo and the
  registry network label ("Mainnet") instead of the hardcoded testnet
  names. Balances, prices and history still read "unavailable" —
  honestly, until Step 5.
- `AndroidManifest.xml` declares `INTERNET` for the Step 5 network
  stack. The app makes no network calls in Step 3.

## What is NOT done (later steps)

- Live prices, balances, history — Step 5 (network stack).
- On-device derivation (Trust Wallet Core AAR) — Step 4.
- QR scanner — Step 5. UI wiring to real data throughout — Step 6.

## Regenerating the bundled copies

Never hand-edit a file under `app/src/main/assets/`. After the web
export is regenerated (`node apps/web/scripts/generate-android-registry.mjs`,
which rewrites `registry/chains.json` + `tokens.json`):

```sh
cp registry/chains.json registry/tokens.json apps/android/app/src/main/assets/registry/
cp apps/web/src/assets/chains/*.webp apps/android/app/src/main/assets/icons/chains/
cp apps/web/src/assets/tokens/*.webp apps/android/app/src/main/assets/icons/tokens/
cd apps/android && ./gradlew testDebugUnitTest   # drift test fails if a copy drifted
```

## Gates (2026-11-28, loud-stone, Node n/a — Gradle/JDK 17)

- `./gradlew assembleDebug` BUILD SUCCESSFUL
- `./gradlew testDebugUnitTest` — new data-layer tests (counts below)
  + all pre-existing tests pass
- Registry counts verified: 87 chains, 4 testnets, 169 RPC endpoints,
  21 tokens on 10 chains, 87 chain logos, 8 token logos.

## Counts

- New Kotlin files: 7 (`data/`) + 1 composable addition
- New unit-test files: 5
- Bundled assets: 2 JSON + 95 .webp
