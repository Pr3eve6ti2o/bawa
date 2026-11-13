# UI candidates research

## 1. Purpose and method

Part A records the Web candidates and local Web draft for the Bawa AI Wallet Builder, repository `Pr3eve6ti2o/bawa`, working-copy HEAD `d7eafd5`, with Phase 4 complete.

**Evidence date: 2026-11-10.** Inspections below are marked **verified first-hand 2026-11-10**. Review pins are the inspected SHAs.

The review covered upstream commit metadata, pinned trees and licence files; token-ui source, demo structure and exclusion checks; and the local Web draft's source and test-file counts. The shadcn/ui inspection did not extend beyond tree and licence, apart from the commit metadata recorded below. Uninspected wallet-screen coverage and build compatibility remain **OPEN**. The draft's claimed screen count was not re-counted.

## 2. WEB-01 — token-ui

**Verdict: selected Web foundation.** The owner pre-approved this foundation on 2026-11-10. This phase confirms that choice by inspection; re-decision was required only if inspection surfaced a problem, and none surfaced.

**Inspection: verified first-hand 2026-11-10** — commit, licence, pinned tree, source and exclusion checks.

| Field | Record |
|---|---|
| Source | `consenlabs/token-ui` |
| Review pin | `6380d5d4dfeebf89704c0527e3c552be6ee2d231` |
| Commit existence | Confirmed; GitHub API 200 |
| Commit date | 2026-05-14 |
| Commit message | `Align design docs and demo theme preview (#4)` |
| Licence | MIT; `LICENSE`, copyright Consenlabs |
| Tree at pin | 107 files |
| Stack | pnpm 10.33.0; Node >=22.12.0; React, react-router, Vite, Tailwind CSS; TypeScript; Vitest; Biome |

### Layout and provision

- `apps/web`: demo application with a wallet dashboard, a home page and a UI-kit page.
  - The dashboard includes `wallet-dashboard.tsx` and a test.
  - `mock-data.ts` contains fake asset amounts only, with no keys.
- `packages/ui`: 62 components, including `asset-row`, `holding-card`, `bottom-sheet-modal`, `action-bar` and `checklist-card`.
- `tooling/tsconfig`: shared TypeScript configuration area.

token-ui provides the Web component foundation and demo screens. It provides **no engine, derivation, vault, custody, signing, RPC or indexing**.

### Exclusion check results

Across the inspected tree:

- **No mnemonic, private-key, seed or keystore code anywhere.**
- **No fetch, axios, RPC or WalletConnect code anywhere.**
- `localStorage` is used only for the theme preference in `theme-toggle.tsx`.

### Adoption consequences

The demo application's mock data must be replaced by the Bawa engine boundary. Nothing secret-bearing is inherited.

Selection of token-ui is selection of a UI foundation, not a vault or wallet engine.

## 3. WEB-02 — shadcn/ui

**Verdict: alternative, not selected.**

**Inspection: verified first-hand 2026-11-10** — commit existence and metadata, tree and licence only.

| Field | Record |
|---|---|
| Source | `shadcn-ui/ui` |
| Review pin | `8ab27715521cbd4f87ae6886cd989cbb678f6de7` |
| Commit existence | Confirmed |
| Commit date | 2026-11-08 |
| Commit message | `chore(deps): bump the deps group... (#12611)` |
| Licence | MIT; `LICENSE.md`, copyright 2023 shadcn |
| Tree at pin | 32 top-level entries |
| Stack and layout inspected | pnpm + Turbo monorepo with `apps/`, `packages/` and `templates/`, including `templates/start-app` |

**Provides / does not provide:** a component library only, not a wallet application. Wallet-screen coverage and build compatibility remain **OPEN**.

**Exclusion checks:** not performed beyond the stated tree-and-licence scope; token-ui's exclusion findings must not be attributed to this candidate.

**Adoption consequences:** wallet-screen coverage and build compatibility would require inspection before adoption.

**Why not selected:** token-ui is the owner-pre-approved foundation and its inspection surfaced no problem. shadcn/ui remains an alternative component library, with wallet-screen coverage and build compatibility uninspected.

## 4. WEB-03 — custom React

**Verdict: no-fetch fallback.**

- **Source:** no upstream.
- **Review pin:** none.
- **Approach:** specification-led React build from `docs/13` + `docs/14`.
- **Licence for resulting code:** **OPEN**.

There is no upstream commit, tree or licence to inspect for this fallback. It is not the selected Web foundation.

## 5. Local Web draft and adapt-versus-replace decision

### Draft inspection

**Inspection: verified first-hand 2026-11-10** — local source and test-file counts.

The `app-web` draft is local at `/home/boxd/workspace/bawa-wallet/app-web`; it is **not in the repository**.

| Field | Record |
|---|---|
| Source files | 10: connectivity, engine, main, policy, sanitize, store, tx, ui, vault, styles |
| Tests | 6 test files containing 31 `test()` blocks, matching the claimed 31/31 mocked tests |
| Screens | 14 claimed; not re-counted here |
| Build/dependency facts | Wallet-core 4.8.4; esbuild |
| Vault cryptography | PBKDF2 with 600,000 iterations + AES-256-GCM |
| Vault AAD | `VAULT_AAD = "bawa-web-vault-v1"` in `src/vault.js`, line 10 |

The draft vault is **not repo-compatible**: the repository has no vault format, and the Web guide's vault is a separate design. The test-block count records the correspondence with the mocked-test claim, not an independently reproduced test-run result.

### Working decision — REPLACE

For **plan section 6, decision 4**, the recommendation is adopted as the working decision under the standing all-phases approval. The Web foundation was pre-approved by the owner on 2026-11-10.

**Replace the draft foundation/vault with token-ui (WEB-01), selectively reusing reviewed draft screens where they match the 14-screen contract.**

- Use token-ui as the Web component foundation.
- **Do not promote the draft vault format into a repository standard.**
- token-ui supplies no vault; selecting it does not supply a replacement vault format.
- The draft remains **reference material only**.

**Rationale:** the draft vault AAD and format are draft-specific, while token-ui supplies the component foundation the draft lacks. Selective reuse is limited to reviewed screens that match the contract; it does not adopt the draft vault.

## 6. Web selection

| Candidate | Pin | Licence | Verdict |
|---|---|---|---|
| WEB-01 token-ui | `6380d5d4dfeebf89704c0527e3c552be6ee2d231` | MIT | selected |
| WEB-02 shadcn/ui | `8ab27715521cbd4f87ae6886cd989cbb678f6de7` | MIT | alternative |
| WEB-03 custom React | None — no upstream | OPEN for resulting code | fallback |

## Android candidates

### AND-01 — Tether WDK Starter Kotlin

**SELECTED Android foundation — UI LAYER ONLY.** Pre-approved by the owner on 2026-11-10; confirmed by inspection. This selects the UI foundation, not its wallet engine.

| Field | Verified record |
|---|---|
| Source | `tetherto/wdk-starter-kotlin` |
| Pin | `a4fa21729ba621c095d8638bc8c50de541008214` |
| Commit verification | Exists; GitHub API 200 |
| Commit date | 2026-09-30 |
| Commit message | `LGTM` |
| Licence | Apache-2.0, evidenced by `LICENSE` |
| Tree at pin | 20 files |

#### Critical finding: the engine module is outside the repository

**The pinned starter does not build standalone from its own tree.** Inspection found:

- `settings.gradle` includes `:wdk-core-kotlin`, with `projectDir` pointing to `../wdk-core-kotlin`.
- `app/build.gradle` declares `implementation project(':wdk-core-kotlin')`.
- `WalletViewModel.kt` imports `to.tether.wdk.core.WdkCore`.

The missing module is an external engine dependency, not part of the starter's 20-file tree. Selecting this foundation is therefore not evidence of a standalone Bawa Android build.

#### Mandatory exclusions — remove, do not reuse

The following upstream elements are **excluded from adoption**:

- WDK engine.
- 12-word phrase policy.
- Vault.
- Derivation.
- Signing.
- Send operations and balances via WDK providers.

UI-only adoption must delete the external module reference, the `wdk-core` dependency and all `WdkCore` imports, remove the excluded implementation, and rebuild Bawa's **protected 24-word ceremony**. These are adoption requirements, not optional clean-up.

#### Toolchain and prerequisites

| Area | Verified value |
|---|---|
| Gradle wrapper | 8.7 |
| Android Gradle Plugin | 8.2.2 |
| Kotlin | 1.9.22 |
| Compose BOM | 2024.02.00 |
| UI components | Material 3 |
| Android SDK configuration | `compileSdk 35`, `minSdk 33`, `targetSdk 35` |
| Java/Kotlin JVM | 17: `sourceCompatibility VERSION_17`, `jvmTarget 17` |
| QR dependency | ZXing core 3.5.3 |

The README requires JDK 17, Android SDK 35, Android Studio Hedgehog or newer, and an emulator/device on API 33+.

The README states ETH Sepolia and BTC testnet defaults, consistent with Bawa's testnet policy. It also requires `Node >=20.19` for the WDK worklet bundle. That requirement is engine-related and excluded from UI-only adoption; it is not a retained UI prerequisite.

#### Screen coverage

`Screens.kt` contains seven composables:

- Welcome
- Create
- Import
- Home
- Send
- Receive
- Sign

Against the 14-screen contract, the starter lacks asset list/detail, transaction history/details, network selection, wallet management, security & backup settings, and a mnemonic-backup screen.

**Seven starter composables are a starting point, not evidence of 14-screen coverage.** The missing contract coverage and the protected 24-word ceremony must be implemented in the Bawa starter.

### AND-02 — BDK DevKit Wallet (`app-ui-only`)

**Not selected; legacy secondary reference only.**

- **Source:** `thunderbiscuit/devkit-wallet`
- **Pin:** `36392bfcea2fab8e772a4e89d5f8e465ab3da439`
- **Commit:** exists; 2025-02-12; `Update readme with notice of public archive`
- **Licence:** Apache-2.0
- **Tree:** `app-advanced-features/`, `app-kmp/`, `app-simple-wallet/`, `app-ui-only/`, `docs/`, `images/`
- **Status:** archived

Current Gradle/Compose compatibility is **OPEN**. Inspection was limited to the tree, licence and archive status; no current toolchain compatibility is established. Its archived status and unresolved compatibility keep it a legacy reference rather than the selected foundation.

### AND-03 — Android Jetpack Compose Samples

**Not selected; generic Compose foundation.**

- **Source:** `android/compose-samples`
- **Pin:** `25631e8f544a9a1e3f01e296eaf1b4c28428196c`
- **Commit:** exists; 2026-10-23; `Hide markdown markers in the Jetchat message input (#1736)`
- **Licence:** Apache-2.0
- **Tree:** sample apps including Jetchat, JetNews, Jetcaster, Jetsnack, JetLagged and Reply

This is a generic Compose foundation, not a wallet template. Wallet-screen coverage is **OPEN**. It is not selected in place of the inspected WDK UI-only foundation.

### AND-04 — Custom Compose

**Not selected; no-fetch fallback.**

- **Upstream:** none
- **Pin:** none
- **Approach:** specification-led implementation from the Android guide and `docs/14`
- **Licence for resulting code:** **OPEN**

Retained as the no-fetch fallback, rather than the primary adoption route. AND-01 remains the selected UI foundation.

## Android draft assessment and treatment

### Local draft record

The `app-android` draft is local and **not in the repository**.

- **Structure:** `gradlew`, a Gradle 8.9 wrapper, `build.gradle.kts`, `settings.gradle.kts`, `app/`, `core/` and `jvmtests/`.
- **Pure-module tests:** `jvmtests/PureModuleTests.kt` uses a custom `check()` harness, not JUnit.
- **Claimed result:** `55/55`.
- **Static evidence:** 50 `check(` call sites, with additional per-fixture loops. The runtime count has not been re-verified here.
- **Build artefacts:** no AAR or APK has ever been produced for the draft.

The claimed pure-module result is not Android build verification. The static call-site count must not be presented as either confirmation or refutation of the claimed runtime total.

Trust Wallet Core ships **no downloadable Android AAR** (Doc 4 M-21).

### Decision: ADAPT — UI only

**Adapt the draft UI only, gated by real build verification in Phase 7.**

AND-01 supplies the new WDK UI-only shell. The draft supplies reviewed UI code where it fits that shell; this does not select the draft's engine implementation or establish its packaging.

Rationale:

- UI reuse can be assessed separately from the engine and build status.
- No AAR or APK exists to substantiate an Android build claim.
- The pure-module test claim does not close the Android build gate.
- The starter's Gradle 8.7 wrapper and the draft's Gradle 8.9 wrapper must not be treated as evidence of compatibility.

Replacing the draft or changing its shell does **not** by itself resolve engine packaging or the missing AAR. Those remain **OPEN**, including the **Phase 4 binding OPEN** status.

## Research-only references — never selectable

These entries are research references, not selectable UI foundations.

### Edge React GUI

- **Source:** `EdgeApp/edge-react-gui`
- **Pin:** `95f46b8fb856e1e15531ab800c88f55df7411e38`
- **Commit:** exists; 2026-11-09
- **Licence:** BSD-3-Clause, evidenced by `LICENSE`; copyright 2017 Airbitz Inc dba Edge
- **Application type:** React Native app
- **Tree:** `android/`, `ios/`, `src/`

**Research only; never selectable.**

### XChain Platform Wallet

Source: [`XChain-Platform/xchain-wallet`](https://github.com/XChain-Platform/xchain-wallet), a self-custodial multi-chain React wallet for web, Chrome extension, desktop and Android. Pin `3e550d05e913e29e5c3cf24527bf504f1a4fe942` was verified as `master` HEAD, with commit date **2026-11-01** and release **v0.342.1**.

The licence at this pin is **AGPL-3.0-or-later**, confirmed by `package.json`, the README SPDX line and `LICENSE.md` containing the full AGPL v3 text. Launch chains are **Bitcoin, Litecoin and Dogecoin (BTC/LTC/DOGE)**. **ETH is not supported at this pin**; searches of `packages/` and `docs/` returned zero `ethereum` hits. The registry records `chains: ["btc"]` because its enum permits only `btc`, `eth`, `trx` and `ton`; LTC/DOGE cannot be represented in that array.

The old **UNVERIFIED** finding tested the wrong repository. `xchainjs/xchainjs-lib` is a separate **MIT-licensed THORChain client library**, not this wallet. The pin does not exist there, and fetching it returns `not our ref`; that result does not invalidate the verified wallet pin.

Reviewed **2026-11-12**. Status remains **OPEN**, with operations `["ui"]`. This is a **research-only** candidate: **no copying without a licensing decision**.

### OWASP Wallet UX Security Handbook and WCAG 2.2

UX-security and accessibility references for **Phase 9**.

- Not templates.
- Research only; never selectable as UI foundations.
- Licence and pin details: **OPEN**.

## Decisions

| Area | Decision | Boundary or gate |
|---|---|---|
| Web foundation | `token-ui` starter | Replace mock data with the engine boundary and build the 14 screens in Phase 6. |
| Android foundation | **SELECTED: AND-01**, Tether WDK Starter Kotlin | **UI layer only**; remove the WDK engine dependency and excluded implementation. Real Gradle build verification is required in Phase 7. |
| Draft treatment — Web | **OPEN in this record** | No draft-specific Web retain/adapt/replace decision is established here. The verified decision is the `token-ui` starter; that does not establish the treatment of any existing Web draft. |
| Draft treatment — Android | **ADAPT, UI only** | WDK UI-only supplies the new shell; reuse reviewed draft UI where it fits. Acceptance is gated by Phase 7 build verification. Engine packaging, the missing AAR and Phase 4 binding remain **OPEN**. |
| Visual direction | **Bawa Balanced — STYLE-04** remains the default | Pre-approved. All five directions are design references only, not implementation foundations. |
| Licence posture | Retain the verified licence distinctions; research-only entries remain excluded from selection | AND-01–03: Apache-2.0. Edge: BSD-3-Clause, research only. XChain: AGPL-3.0-or-later, pin verified 2026-11-12, and no copying before an explicit licensing decision. AND-04 and OWASP/WCAG licence details remain **OPEN**. |

## Handoff to Phases 6–7

### Phase 6 — Web starter

1. Start from `token-ui`.
2. Replace mock data with the engine boundary.
3. Build the 14 screens.
4. Keep Bawa Balanced (STYLE-04) as the default visual direction; the five directions remain design references only.

No additional Web-draft disposition is inferred from the foundation choice.

### Phase 7 — Android starter

1. Start from AND-01 at the recorded pin, adopting the **UI layer only**.
2. Remove the external `:wdk-core-kotlin` module reference, its app dependency and all `WdkCore` imports.
3. Remove the excluded WDK engine, 12-word phrase policy, vault, derivation, signing, and send/balance provider implementation. Do not reuse them.
4. Rebuild the **protected 24-word ceremony**.
5. Map the seven starting composables against the 14-screen contract and add the missing seven screens, closing all coverage gaps recorded under AND-01.
6. Review and adapt local draft UI code only where it fits the new shell.
7. Verify the resulting toolchain and produce a **real Gradle build**. Record the build result and produced artefact; static inspection and the claimed pure-module test result are not substitutes.

### What stays OPEN

- **Android build verification:** not established by this research. The local draft has produced no AAR or APK.
- **Engine packaging and missing Android AAR:** remain unresolved. UI replacement or a UI build must not be treated as automatic closure.
- **Phase 4 binding:** remains **OPEN**, despite Phase 4 being done.
- **Draft test runtime count:** the claimed `55/55` has not been re-verified here.
- **Web-draft treatment:** no draft-specific disposition is established in this record.
- **AND-02:** current Gradle/Compose compatibility.
- **AND-03:** wallet-screen coverage.
- **AND-04:** licence for resulting code.
- **XChain:** pin verified 2026-11-12 in `XChain-Platform/xchain-wallet`; copying remains blocked pending an explicit licensing decision. The entry stays research-only and never selectable.
- **OWASP/WCAG:** licence and pin details; retain them as Phase 9 references, not templates.
