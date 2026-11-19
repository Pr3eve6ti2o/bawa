# Bawa capability map — lane D1 audit

- **Repository:** `Pr3eve6ti2o/bawa`
- **Audited commit:** feature-branch working copy at `85b8d47` (merge of `9750a91` + `27ff384`), tree clean — verified first-hand on the VM before any model call.
- **Audit date:** 2026-11-14
- **Lane:** D1 (audit + capability map), Bawa DX transformation re-dispatch.
- **Method:** first-hand inspection on the VM via boxd (repo tree, `docs/`, `tools/`, `scripts/`, `ai/`, `registry/`, `apps/`, `templates/`, `tests/`, CI workflows, all 5 branch worktrees), then 4 gpt-6.1-sol (API 2, max reasoning) drafting calls; every factual claim below was checked against the actual file on the VM by the lane before assembly. No test suite was executed in this lane, so no test is claimed passed in this run — "IMPLEMENTED_AND_TESTED" below rests on supplied historical/CI evidence, scoped as stated.
- **Scope note (standing rule):** a guide or blueprint is not an implementation. A passing generator test does not verify custody, recovery, signing, broadcast, transaction construction or mainnet readiness.
- **Launcher:** `tools/bawa_cli.py` does not exist on any branch (verified by directory listing). "Direct" launcher relevance below means future reuse of existing code, not an implemented integration.

## Labels used in this map

- **IMPLEMENTED_AND_TESTED** — code exists and an evidenced test verifies the stated behaviour, only within that test's scope.
- **IMPLEMENTED_UNTESTED** — code exists, but relevant execution or verification is not established by the supplied evidence.
- **DOCUMENTED_ONLY (needs AI implementation)** — a guide or blueprint exists; documentation is not runtime implementation.
- **NEEDS_EXTERNAL** — delivery or verification requires resources outside the repo (RPC/indexers, funding, a desktop/device, owner approval).
- **NOT_IMPLEMENTED** — no repo implementation exists for the stated capability.

**Scope.** This map covers the HD wallet engine and native-asset mainnet tooling in `Pr3eve6ti2o/bawa`, at audited feature working-copy commit `85b8d47`, using only supplied evidence. A guide or blueprint is not an implementation. IMPLEMENTED_AND_TESTED below relies on supplied historical test evidence, not a new run or full verification of this commit; no suite was run in this lane. `tools/bawa_cli.py` does not exist: “direct” launcher relevance means future reuse of existing code, not an implemented launcher integration.

## 1. HD wallet engine (Trust Wallet Core 4.9.3)

**CI context:** `.github/workflows/ci.yml` syntax-checks the engine JS, runs the hdwallet package’s `test/smoke.test.js` and `test/register-links.test.js`, checks TTY refusal, and runs the Python tests cited below. Supplied CI history: 51 runs; latest at `27ff384` passed on 2026-11-13—not an asserted pass at `85b8d47`.

- **Generation — IMPLEMENTED_AND_TESTED.** `tools/hdwallet-gen/generate.js`; dependency pinned by `tools/hdwallet-gen/package.json`: Trust Wallet Core 4.9.3 WASM, 24-word BIP-39, empty passphrase. Fixed paths: BTC `m/84'/0'/0'/0/i`, ETH `m/44'/60'/0'/0/i`, TRX `m/44'/195'/0'/0/i`, TON `m/44'/607'/0'`. Public-only stdout; live generation requires a controlling terminal.  
  **Tests/CI:** Package smoke/register-links run in CI; generator TTY refusal is explicitly asserted there. No interactive generation result was supplied for this lane.  
  Launcher relevance: Direct invocation is available, subject to the controlling-terminal requirement.

- **BTC/ETH/TRX watch-only deposit derivation — IMPLEMENTED_AND_TESTED.** `tools/hdwallet-gen/derive.js`: xpub-to-address derivation; no private input.  
  **Tests/CI:** `test/differential_test.py` uses independent `bip-utils` reference coverage for BTC/ETH/TRX indices 0/1; CI runs it.  
  Launcher relevance: Direct reuse with validated public xpubs.

- **BTC change derivation — IMPLEMENTED_UNTESTED.** `tools/hdwallet-gen/derive.js` also implements `btc-change`, path `m/84'/0'/0'/1/i`.  
  **Tests/CI:** CI syntax-checks the file; supplied differential-test evidence does not establish change-branch coverage.  
  Launcher relevance: Direct reuse is possible; change-branch behavioral validation remains AI-guided work.

- **TON watch-only derivation — IMPLEMENTED_UNTESTED.** `tools/hdwallet-gen/derive-ton.js`: 64-hex Ed25519 public key to one Wallet V4 R2 address, workchain 0, wallet ID 698983191. No TON xpub and no index.  
  **Tests/CI:** `test/ton-watch-only-vectors.test.js` exists, but no executed result is supplied and it is not among the stated CI test runs; CI syntax-checks the implementation.  
  Launcher relevance: Direct public-key derivation after validation; must not offer indexed TON deposits.

- **Persistent derivation daemon — IMPLEMENTED_UNTESTED.** `tools/hdwallet-gen/derive_daemon.js`: public-only JSONL derivation for BTC/ETH/TRX, branches 0/1.  
  **Tests/CI:** CI syntax-checks it; no daemon-specific behavioral test file or package-suite coverage is established by the evidence.  
  Launcher relevance: Direct daemon reuse; integration and behavioral validation remain AI-guided work.

- **Address comparison — IMPLEMENTED_UNTESTED.** `tools/hdwallet-gen/compare.js`: compares addresses from env-file xpubs; rejects private, bad-checksum and bad-version inputs before WASM.  
  **Tests/CI:** CI syntax checks and package smoke/register-links exist, but compare-specific behavioral coverage is not supplied.  
  Launcher relevance: Direct reuse of the existing comparison tool, with validation still required.

- **Extended-key validation/redaction — IMPLEMENTED_UNTESTED.** `tools/hdwallet-gen/extended-key.js`: pure shared validation and redaction used by the engine tools.  
  **Tests/CI:** CI syntax checks and package tests exist; module-specific behavioral coverage is not established.  
  Launcher relevance: Direct reuse through existing engine callers; a standalone interface would need AI-guided wiring.

- **Wallet orchestration — IMPLEMENTED_AND_TESTED.** `tools/make_wallet.py`: starts the generator, validates public JSON, verifies the encrypted recovery artifact, and writes public xpub/address config. AAD identifier `nova-shop-seed-v1`; `seed.enc.json` mode 0600; `secrets/` mode 0700.  
  **Tests/CI:** `test/test_make_wallet.py`; CI runs it.  
  Launcher relevance: Direct orchestration entry point, preserving generator terminal requirements.

- **Seed recovery — IMPLEMENTED_AND_TESTED.** `tools/decrypt_seed.py`: AES-256-GCM recovery, BIP-39 validation before return, mnemonic printed to the controlling terminal—not stdout by default.  
  **Tests/CI:** `test/test_decrypt_seed.py`; CI runs it.  
  Launcher relevance: Direct interactive recovery, preserving terminal-only output by default.

## 2. Mainnet transaction tooling (unsigned, signing, guards, fees)

**No broadcast, no send, and no funded execution have ever happened from this repo.**

**Test provenance:** The 31 `tests/*.mjs` files are **not run by CI**. The named suites are `tests/mainnet-unsigned-tx.test.mjs`, `tests/mainnet-signing.test.mjs`, `tests/mainnet-guards.test.mjs` and `tests/mainnet-fees.test.mjs` (verified first-hand from the `tests/` listing); their counts are counted `test()` declarations, not executed results. `AGENTS.md` records an H9 baseline of 130 checks, 0 fail at `0b2aa295`; that is historical evidence, and its “no transaction construction/signing” statement predates the T33/T35 modules.

- **Unsigned native-asset builders — IMPLEMENTED_UNTESTED.** `tools/mainnet-tx/unsigned-tx.mjs`: offline, public-input-only BTC P2WPKH, ETH legacy/EIP-1559, TRON TransferContract and TON V4 R2 construction. No network, signing or broadcast; broadcast/send/token/contract stubs always throw.  
  **Tests/CI:** `mainnet-unsigned-tx` suite in `tests/*.mjs`—24 declarations, no CI. `test/test_unsigned_serialization.py` also exists; no executed result or stated CI run is supplied.  
  Launcher relevance: Direct module reuse for unsigned native-asset construction only; validation/integration remain AI-guided work.

- **Local signing — IMPLEMENTED_UNTESTED.** `tools/mainnet-signing/local-signing.mjs`: local signing inside T25 isolation with temporary unfunded credentials; independent signature-verification code and an 11-check, fail-closed pre-broadcast checklist. No network import/call or broadcast path.  
  **Tests/CI:** `mainnet-signing` suite in `tests/*.mjs`—24 declarations, no CI or supplied executed result.  
  Launcher relevance: AI-guided, T25-isolated, temporary-unfunded work only. Stop before broadcasting; M-35 execution is not authorised.

- **Mainnet guards — IMPLEMENTED_UNTESTED.** `tools/mainnet-guards/mainnet-guards.mjs`: output secret redaction; no-broadcast gate allowing read-only operations and restricted local signing; three-pass credential wipe plus `verifyNoCopies` sweep.  
  **Tests/CI:** `mainnet-guards` suite in `tests/*.mjs`—28 declarations, no CI or supplied executed result.  
  Launcher relevance: Direct guard-module reuse is possible; behavioral validation is still AI-guided work, not a proven safety guarantee.

- **Read-only fee quotes — IMPLEMENTED_UNTESTED.** `tools/mainnet-fees/fees.mjs`: BTC/ETH/TRON/TON quotes using BigInt atomic units and built-in fetch only. BTC requires both mempool.space and blockstream.info; disagreement fails closed.  
  **Tests/CI:** `mainnet-fees` suite in `tests/*.mjs`—28 declarations, no CI or supplied executed result.  
  Launcher relevance: Direct read-only module reuse; external endpoint availability and live quote behavior remain unverified.

- **M-35 rehearsal procedure — DOCUMENTED_ONLY (needs AI implementation).** `docs/mainnet/M35-REHEARSAL-PROCEDURE.md` is a **DRAFT for review only**, not an implemented or authorised rehearsal.  
  **Tests/CI:** No rehearsal-execution test result or CI execution is supplied.  
  Launcher relevance: Must route to AI-guided review/planning, not execution.

- **M-35 funding and authorisation — NEEDS_EXTERNAL.** Supplied status for the rehearsal draft: owner declined funding on 2026-11-13; all four rehearsal addresses are retired and isolated credentials destroyed.  
  **Tests/CI:** External owner decisions are not CI-testable; no funded-execution result is supplied.  
  Launcher relevance: AI-guided coordination only; owner funding and authorisation cannot be supplied by the launcher.

- **Broadcast/send capability — NOT_IMPLEMENTED.** `tools/mainnet-tx/unsigned-tx.mjs` has throwing stubs; `tools/mainnet-signing/local-signing.mjs` has no broadcast/network path. No mainnet transaction has ever been broadcast from this repo.  
  **Tests/CI:** The unsigned/signing suites above are outside CI; specific stub-test coverage is not supplied.  
  Launcher relevance: Must remain unavailable as a direct action; future implementation requires AI-guided work and external authorisation.

## 3. Web starter (apps/web)

*Scope: `Pr3eve6ti2o/bawa`, working copy at `85b8d47`. Tested labels below refer to recorded, limited verification—not tests run in this lane.*

- **IMPLEMENTED_AND_TESTED — starter build/unit/HTTP scope only.** Source: `apps/web/`; overview: `apps/web/README.md`. Stack: React **19.2.5**, Vite **8.3.8**, TypeScript **5.9.3**, Tailwind **4.2.4**, Vitest **4.1.12**, wallet-core **4.9.3**. Vendored token-ui supplies UI components only; provenance and exclusions are in §6.
  - The documented 14-screen inventory (`docs/14`, §5.1) covers welcome, create, import, dashboard, asset list/detail, send, receive, transaction history/detail, network selection, wallet management, security settings and mnemonic backup. Screen inventory does **not** establish functional sending or transaction history.
  - **Recorded verification:** `templates/web/UPSTREAM.md`, first-hand record dated **2026-11-10**: `tsc --noEmit` exit 0; `vitest run` **25/25**; `vite build` exit 0; `vite preview` served `/` and `/wallet-core.wasm` with HTTP 200. **Not re-run here.**

- **IMPLEMENTED_UNTESTED — browser execution of the boundary/integration.** `apps/web/src/engine/boundary.ts` implements validation before WASM, including R-01 point validation in pure BigInt. `scripts/copy-wasm.mjs` supplies WASM to `apps/web/public/` on predev/prebuild; WASM is never committed. The recorded asset-delivery checks do not establish browser engine execution or interactive wallet behavior. **No live-browser run has ever been performed.**

- **NOT_IMPLEMENTED — eight registry-listed gaps.** `registry/profiles.json`, `web-wallet`: send; sign; broadcast; balances; prices; transaction history; live-browser verification (only preview HTTP checks and unit tests are recorded); on-device derivation (**no on-device concept in web**).

- **Unresolved test-count discrepancy:** the repository records **25 tests**, while this lane counted **9 Vitest test files** under `apps/web/src` and roughly **117** `it(`-matching lines. That grep count is unreliable: it includes substrings such as `split()`/`visit()`. Neither number is reconciled; the true executed count needs a Vitest run.

## 4. Android starter (apps/android)

- **IMPLEMENTED_AND_TESTED — watch-only starter scope only.** `apps/android` contains **14 watch-only Compose screens**, a watch-only ViewModel with **xpubs in memory only**, a lock that is **UI state only**, a pure-Kotlin extended-key validator and derivation-policy constants.
  - Stack: Kotlin **1.9.22**, JVM **17**, Gradle wrapper **8.7**, AGP **8.2.2**, Compose BOM **2024.02.00**; compile/min/target SDK **35/33/35**; ZXing **3.5.3**, **QR display only**. Package `com.bawa.wallet`, version **0.1.0**.
  - **Recorded verification:** `templates/android/UPSTREAM.md`: `./gradlew testDebugUnitTest` **17/17**; `./gradlew assembleDebug` exit 0, producing `app-debug.apk` (**52,456,212 bytes**). Emulator evidence exists in `docs/android-evidence.md`. **Not re-run here; this is not complete-wallet verification.**

- **DOCUMENTED_ONLY (needs AI implementation) — Bawa’s 24-word ceremony.** The ceremony was rebuilt in documentation only; the supplied evidence does not identify its exact document path. The upstream WDK 12-word policy was **excluded**, not adopted. Policy constants likewise do not establish transaction-confirmation enforcement. WDK UI provenance and excluded engine code are detailed in §6.

- **NOT_IMPLEMENTED — nine registry-listed gaps.** `registry/profiles.json`, `android-wallet`: on-device address derivation (**no AAR**); send; sign; broadcast; balances; prices; transaction history; on-device Add-button acceptance path; KVM-backed emulator verification.
  - **Add-button acceptance path stays NOT_IMPLEMENTED.** `docs/android-evidence.md` explicitly records **NOT VERIFIED**: taps were swallowed under TCG emulation. Unit-test evidence does not establish this acceptance path.
  - **NEEDS_EXTERNAL — native engine artifact and KVM verification environment.** The starter has no AAR for any version; on-device address derivation remains open. No KVM-backed verification result is supplied.

- **Unresolved test-count discrepancy:** the repository records **17 tests**, but this lane counted **57 `@Test` annotations across five Kotlin test files**: `ConfirmationPolicyTest` 24, `DerivationPolicyTest` 7, `ExtendedKeyValidatorTest` 18, `WalletViewModelTest` 5, `ImportWalletAddButtonTest` 3. These are annotation counts, not confirmed executed/passing counts; **17 versus 57 remains unresolved**.

- **Toolchain support caveat:** AGP **8.2.2** does not officially support compileSdk **35**; that requires AGP **8.6.0+**. The recorded build proceeds via `android.suppressUnsupportedCompileSdk=35`. Kotlin **1.9.22**’s supported Gradle range tops out at **8.1.1**, while this repository uses **8.7**. A recorded successful build does not make this combination officially supported.

## 5. One-prompt builder (scripts/ + ai/ + registry/)

### Builder and verification tooling

| Item | Label | Evidence and limits |
|---|---|---|
| One-prompt workflow | **IMPLEMENTED_UNTESTED** | `scripts/build-wallet.mjs`: classify → generate through `scripts/generate-project.mjs` into gitignored `generated/<profile-id>` → verify → write JSON report. Never waits for input; ambiguous, unclassifiable or refused requests write a report and exit **2**. No end-to-end run result is supplied here. |
| Differentiated project generation | **IMPLEMENTED_UNTESTED** | `scripts/generate-project.mjs` generates per registry profile and copies `scripts/generate-templates/derive.mjs` and `scripts/generate-templates/verify.mjs`. `generated/` contains **seven profile directories from prior runs**; their presence does not prove complete or verified wallet products. |
| Pure request classifier | **IMPLEMENTED_AND_TESTED — reported unit-test scope** | `scripts/classify-request.mjs`; `tests/classifier.test.mjs` has **32 `test()` occurrences**. The supplied evidence calls it unit-tested but gives no execution result or confirmed passing count. This does not verify the full builder or every routing refusal. |
| Quality gates and test runner | **IMPLEMENTED_UNTESTED** | `scripts/quality-gates.mjs`: lockfile pin check first, secret scan, verdict; supports `--skip-android`. `scripts/test.mjs` runs web Vitest and Android Gradle tests; Android requires `JAVA_HOME` and `ANDROID_HOME`, otherwise it reports `NOT-RUN`. No gate verdict or runner result is supplied. |
| Supporting scripts | **IMPLEMENTED_UNTESTED** | `scripts/setup.mjs`, `scripts/build.mjs`, `scripts/validate-registry.mjs`, `scripts/secret-scan.mjs`, `scripts/check-lockfiles.mjs`, `scripts/gate-verdict.mjs` exist. No execution evidence is supplied for these scripts. |
| Offline capability detection | **IMPLEMENTED_UNTESTED** | `ai/detect-capabilities.mjs`: read-only, offline toolchain capability check, exit **0/1**. No invocation result is supplied. |

### Registry profiles

Evidence: `registry/profiles.json`, `registry/capabilities.json`, `registry/engines.json`, `registry/ui.json`, `registry/schemas/`.

The five **DOCUMENTED_ONLY (needs AI implementation)** profiles below have registry status `DOCUMENTED_NOT_TESTED`. The two **IMPLEMENTED_AND_TESTED** starter profiles have registry status `STARTER_IMPLEMENTED_AND_VERIFIED`, **starter scope only**. Registry declarations and generated directories do not implement the missing products.

| Profile | Map label | Registry missing list |
|---|---|---|
| `hd-wallet-cli` | **DOCUMENTED_ONLY** | **6:** built CLI wallet product; send; sign; broadcast; confirmation-policy enforcement in code; any GUI. |
| `bitcoin-wallet` | **DOCUMENTED_ONLY** | **6:** built product; send; sign; broadcast; transaction construction; 6-confirmation enforcement in code (**policy only**). |
| `evm-wallet` | **DOCUMENTED_ONLY** | **7:** built product; generic EVM beyond ETH derivation; send; sign; broadcast; transaction construction; finality enforcement. |
| `multichain-wallet` | **DOCUMENTED_ONLY** | **6:** built integrated product; send; sign; broadcast; cross-chain transaction operation; confirmation enforcement. |
| `watch-only-wallet` | **DOCUMENTED_ONLY** | **5:** built product/monitoring UI; balances; confirmation enforcement; TON (**excluded—no xpub**); any secret intake or signing (**excluded scope**, not a promise to add it). |
| `web-wallet` | **IMPLEMENTED_AND_TESTED — starter only** | **8:** send; sign; broadcast; balances; prices; transaction history; live-browser run; on-device derivation (no web on-device concept). See §3. |
| `android-wallet` | **IMPLEMENTED_AND_TESTED — starter only** | **9:** on-device address derivation/no AAR; send; sign; broadcast; balances; prices; transaction history; on-device Add-button acceptance path; KVM-backed emulator verification. See §4. |

The listed gaps are **NOT_IMPLEMENTED** in their stated profile scope; external prerequisites and intentional exclusions remain distinct.

### AI routing

- **DOCUMENTED_ONLY (needs AI implementation) — routing/refusal blueprint.** `ai/request-routing.md` maps the seven registry profiles—CLI, Bitcoin, EVM, multichain, watch-only, web and Android—to `ai/prompts/create-*.md` (**eight files**) and `ai/profiles/*.md` (**seven files**). Documentation is not evidence of fully implemented or end-to-end-tested AI routing.
- Documented refusals cover mainnet without separate approval; swaps/staking/bridges; signing/broadcast claims; TON send; unlisted profiles; TON xpub.
- **Unresolved mainnet-default conflict:** routing documentation defaults to **testnet** and requires refusal of **mainnet without separate approval**. This conflicts with the owner’s **mainnet-first direction for the DX run**. No resolution or routing change is established by the supplied evidence.

## 6. External dependencies and recommended tools

| Item | Label | Evidence, provenance and limits |
|---|---|---|
| wallet-core **4.9.3** dependency pins | **IMPLEMENTED_UNTESTED — engine-operation scope** | The **only engine dependency**, pinned in `tools/hdwallet-gen` and `apps/web`. Web starter tests/build/WASM HTTP delivery are recorded in `templates/web/UPSTREAM.md`; no tool-run or complete engine-operation verification is supplied here. Dependency presence does not establish send/sign/broadcast, and Android has no AAR. |
| token-ui UI adoption | **IMPLEMENTED_AND_TESTED — recorded web starter integration only** | `consenlabs/token-ui`, pin `6380d5d4dfeebf89704c0527e3c552be6ee2d231`, **MIT**; vendored into `apps/web/src/ui/`, **67 files**, import paths rewritten, no behavior changed. Recorded starter checks: `templates/web/UPSTREAM.md`; no live-browser run. Supplies **UI components only**, not engine, derivation, vault, custody, signing, RPC or indexing. |
| WDK Starter UI adoption | **IMPLEMENTED_AND_TESTED — recorded Android starter integration only** | `tetherto/wdk-starter-kotlin`, pin `a4fa21729ba621c095d8638bc8c50de541008214`, **Apache-2.0**; UI layer only. Recorded scope: `templates/android/UPSTREAM.md`, with acceptance limitations in `docs/android-evidence.md`. `wdk-core-kotlin`, `WdkCore` imports, 12-word policy, vault, derivation, signing and provider send/balance logic were **excluded, not adopted**. |

**DOCUMENTED_ONLY (needs AI implementation) / NEEDS_EXTERNAL — recommended tools and integrations.** `docs/03-tools-and-repositories/README.md` recommends:

`paulmillr/scure-bip39`, `scure-bip32`, `trustwallet/wallet-core`, `bitcoinjs/bitcoinjs-lib`, `bitcoin/bitcoin`, `Blockstream/esplora`, `spesmilo/electrumx`, `wevm/viem`, `ethers-io/ethers.js`, `anza-xyz/kit`, `ton-org/ton`, `cosmos/chain-registry`, `cosmos/cosmjs`, Cardano CIPs, `polkadot-js`, `XRPLF/xrpl.js`, Trezor, Ledger and Foundry/Anvil.

`paulmillr/scure-bip39` is now an implemented dependency via `@scure/bip39` for validation/tests/docs only, not a replacement for wallet-core, and `wevm/viem` is an `apps/web` dependency (`viem` at `^2.58.0`) for signing helpers; apart from these and the existing wallet-core dependency, the remaining listed integrations are recommendations only. Adoption does not establish send/broadcast support, and Android has no AAR. The six newly adopted items are `@scure/bip39` 2.4.0, `decimal.js` 10.6.0, `dinero.js` 2.0.2 and `mnemonic-words` 2.0.0 in `apps/web/package.json` dependencies, `bip39` 3.1.2 (`bitcoinjs/bip39`, test oracle only) in its devDependencies, and `mnemonic==0.21` (`trezor/python-mnemonic`, used as a second check in `tools/make_wallet.py`) in `requirements.txt`; `@trustwallet/wallet-core` 4.9.3 remains the only engine dependency, pinned in `tools/hdwallet-gen` and `apps/web`, with the limited evidence scope stated above.

## 7. Documentation (docs/01–16 + specialist guides)

All documents remain guides. Implementation labels below apply only to the named procedure or subset, not the whole document. Test files alone are not treated as passing-run evidence. **—** means the line count was not supplied.

| Doc | Lines | What it covers | Label / implementing tool | Launcher relevance |
|---|---:|---|---|---|
| `docs/01-fundamentals` | 328 | HD fundamentals, entropy, BIP-39/32/44 | DOCUMENTED_ONLY | Conceptual help, not an engine. |
| `docs/02-chains` | 472 | Chain families; mainnet formats unless testnet-labelled; additional chains in prose | DOCUMENTED_ONLY | Do not turn prose coverage into supported-chain claims. |
| `docs/03-tools-and-repositories` | 168 | Tool and repository map | DOCUMENTED_ONLY | Tool-selection reference. |
| `docs/04-wallet-generation` | 390 | Generation procedure | Procedure: IMPLEMENTED_AND_TESTED (CI scope: `test/test_make_wallet.py`, hdwallet-gen smoke tests) — `tools/make_wallet.py` + `generate.js` | Point to existing generation tools, not the guide as an app. |
| `docs/05-watch-only` | 536 | BTC/ETH/TRX/TON watch-only derivation | BTC/ETH/TRX procedure: IMPLEMENTED_AND_TESTED (differential test, index 0/1 scope) — `derive.js`; TON: IMPLEMENTED_UNTESTED — `derive-ton.js` | Separate derivation from GUI import and withdrawal verification. |
| `docs/06-tracking` | 739 | Tracking from $0 using explorers/RPC | DOCUMENTED_ONLY | No tracking code; chain data requires external services. |
| `docs/07-payment-tracking` | 885 | Payment tracking and reconciliation | DOCUMENTED_ONLY | `test/payment_record_check.py` checks a record schema, not live payments. |
| `docs/08-security-recovery` | 1,252 | Security/recovery; 12 limitations stated up front | DOCUMENTED_ONLY; decryption subset IMPLEMENTED_AND_TESTED (CI scope: `test/test_decrypt_seed.py`) — `tools/decrypt_seed.py` | Link recovery instructions; do not claim a completed rehearsal. |
| `docs/09-signing-and-hardware` | 918 | Descriptors, PSBT and hardware signing | DOCUMENTED_ONLY | No PSBT/hardware integration; local test-only signing is separate. |
| `docs/10-operations-and-testing` | 1,502 | Operations, release gates and incident response | DOCUMENTED_ONLY; gate-check subset IMPLEMENTED_UNTESTED — `scripts/quality-gates.mjs` | Only coded checks are enforced, not the entire operational blueprint. |
| `docs/11-trust-wallet-and-independent-verification` | 577 | wallet-core reference and independent bip-utils verification | DOCUMENTED_ONLY; verifier IMPLEMENTED_AND_TESTED (CI scope, BTC/ETH/TRX index 0/1) — `test/differential_test.py` | Flag guide reference **4.9.2** versus repo tool pin **4.9.3**. |
| `docs/12-chain-registry-and-assets` | 409 | wallet-core registry and Trust Wallet Assets interpretation | DOCUMENTED_ONLY | Metadata is not implemented chain support. |
| `docs/13-wallet-app-architecture` | 400 | Key management, watch-only, signing and UI boundaries | DOCUMENTED_ONLY | Starters implement UI/boundaries only, not the full architecture. |
| `docs/14-wallet-app-implementation` | 440 | Modules, fixture gate, typed errors, build checklist; testnet/published vectors | DOCUMENTED_ONLY; starters are partial implementation | AI implementation checklist, not a complete wallet. |
| `docs/15-threat-model-and-theft-prevention` | 366 | Phishing, SIM swap, poisoning, malware, supply chain and incidents | DOCUMENTED_ONLY | Threat guidance, not security certification. |
| `docs/16-security-decision-guide` | 188 | Free/paid help, spending thresholds and checklist | DOCUMENTED_ONLY | Human decision support, not runtime enforcement. |
| `GUI-WATCH-ONLY-WORKFLOW.md`, `TON-WATCH-ONLY-TESTING.md` | — | Watch-only import workflows; Web import validation and unit tests are present | DOCUMENTED_ONLY; Web import IMPLEMENTED_UNTESTED at live-browser scope | External GUI import remains untested; M-39 withdrawal remains OPEN. |
| `docs/web-wallet/WEB-GUIDE.md` | 1,101 | Bitcoin testnet4, Ethereum Sepolia, TRON Nile, TON testnet | DOCUMENTED_ONLY; web starter implements UI/boundaries only | Testnet-framed guide; no live-browser run established. |
| `docs/android-wallet/ANDROID-GUIDE.md` | 5,516 | Testnet-only Android guide; prose source-build pin 4.9.2 | DOCUMENTED_ONLY; Android starter implements UI/boundaries only | No on-device derivation; reconcile prose pin with repo tool pin 4.9.3. |
| `docs/RECOVERY.md` | — | Recovery instructions accompanying decryption | DOCUMENTED_ONLY; tool: `tools/decrypt_seed.py` | Recovery exists as a tool/procedure, but rehearsal was not run. |
| `docs/SECURITY.md`, `docs/TESTING.md` and other listed support/plan/review docs | — | Companion documentation; inventory alone establishes no runtime capability | DOCUMENTED_ONLY | Reference and AI implementation inputs, not execution evidence. |
| `research/ui-candidates.md` | — | token-ui selected as WEB-01; shadcn/ui alternative not selected | DOCUMENTED_ONLY | UI selection is not wallet functionality. |

## 8. Mainnet readiness gap (mainnet-first intent vs actual state)

**Existing, bounded components:** BTC/ETH/TRX/TON mainnet derivation; unsigned builders; local **test-only** mainnet signing; guards and fee components. These do **not** establish an operational, funded send path. Builder/signing coverage must not be assumed identical across all four chains.

**Read-only evidence:** `docs/mainnet/evidence/t32-probe-2026-11-12.json` and `t32-smoke-2026-11-12c.json` record live read-only probes dated **2026-11-12**. They are not funded execution or broadcast evidence.

**Documentation is not implementation:** `docs/mainnet/MAINNET-GUIDE.md` (4,503 lines) explicitly states **“Guide prose only — no app or UI code.”** Its evidence baseline is **2026-11-09**, with code pin **e3b65fb8**, not the working-copy pin **85b8d47**. The signing, unsigned-transaction, vector and guard documents, plus payment-record examples/schemas, do not implement their blueprints. `M35-REHEARSAL-PROCEDURE.md` is a **492-line DRAFT**.

| Gap | Required work |
|---|---|
| No payment execution or broadcast implementation | Implement the end-to-end send/broadcast path. Independently verify construction, signing, guards and fees; do not promote the test-only signer into a production or hardware flow by assumption. |
| No funded mainnet execution; M-35 funding declined and rehearsal not executed | Finalize the draft procedure, obtain explicit authorization/funding, then execute and record the funded rehearsal after the execution path exists. |
| External live-data dependencies remain | Integrate required external RPC/indexer/data sources; do not present balances/history/prices as repo-delivered functionality. |
| `AGENTS.md` and `ai/request-routing.md` still default to testnet and require separate mainnet approval; Web/Android guides are testnet-framed | Align routing and guide entry points with mainnet-first intent. Reframe testnet as secondary; **do not delete testnet code in this run**. |
| Documentation pins and execution evidence need reconciliation | Reconcile e3b65fb8-based mainnet prose with 85b8d47 and guide wallet-core 4.9.2 references with tool pin 4.9.3. Complete and record relevant browser, GUI/M-39, recovery and transaction-path checks. |

**Mainnet readiness is not established.** These are required work items, not a readiness declaration.

## 9. Not implemented or verified — the honest list

Labels are scoped to the capability named, not to the wallet as a whole.

| Capability | Label | One-line reason |
|---|---|---|
| Send / payment execution | IMPLEMENTED_UNTESTED | Offline signing exists for BTC/ETH/TRX/TON; broadcast is disabled, and no live payment has been executed. |
| Broadcast | NOT_IMPLEMENTED | No broadcast implementation anywhere in the repo. |
| Funded mainnet execution / M-35 | NEEDS_EXTERNAL | Funding was declined and M-35 remains unexecuted; the send signing path exists, but broadcast is disabled. |
| Balances and history | IMPLEMENTED_UNTESTED | Read-only mainnet adapters implement getBalance and getHistory. |
| Prices | NEEDS_EXTERNAL | No price feed is implemented; external price data integration is required. |
| Swaps, staking and bridges | NOT_IMPLEMENTED | None is implemented in the repo. |
| WalletConnect | NOT_IMPLEMENTED | No integration code. |
| Hardware signing | DOCUMENTED_ONLY | `docs/09` describes it; the local test-only signer is not a hardware flow. |
| PSBT flows | DOCUMENTED_ONLY | Descriptors/PSBT are guide material; no PSBT implementation. |
| On-device Android derivation | NOT_IMPLEMENTED | Android starter implements UI/boundaries only. |
| Live-browser Web execution | IMPLEMENTED_UNTESTED | Starter/import code exists, but no live-browser run was done. |
| External GUI watch-only import | DOCUMENTED_ONLY | Workflow documented but untested; no desktop machine was available on the test VM. |
| GUI watch-only withdrawal | NEEDS_EXTERNAL | **M-39 OPEN**; external GUI verification is outstanding, and import is not withdrawal. |
| Recovery rehearsal | IMPLEMENTED_UNTESTED | `tools/decrypt_seed.py` exists; README’s verified-on table lists the rehearsal as not run. |
| Live testnet spend | NOT_IMPLEMENTED | Signing exists, but broadcast is disabled and no live testnet spend was executed. |
| Generic EVM beyond ETH | NOT_IMPLEMENTED | No beyond-ETH EVM implementation is evidenced. |
| TON send | IMPLEMENTED_UNTESTED | TON offline signing is implemented; broadcast is disabled, and no live TON send has been executed. |
| TON xpub | NOT_IMPLEMENTED | No TON xpub capability is evidenced; `derive-ton.js` does not establish it. |
| Chains beyond BTC/ETH/TRX/TON in code | NOT_IMPLEMENTED | Solana/Cosmos/Cardano/Substrate/XRPL appear only in `docs/02` prose; no implementation. |

## 10. How to read this map

- **IMPLEMENTED_AND_TESTED** — Code exists and an evidenced test verifies the stated behavior, only within that test’s scope.
- **IMPLEMENTED_UNTESTED** — Code exists, but relevant execution or verification is not established by the supplied evidence.
- **DOCUMENTED_ONLY (needs AI implementation)** — A guide or blueprint exists; documentation is not runtime implementation.
- **NEEDS_EXTERNAL** — Delivery or verification requires resources outside the repo, such as RPC/indexers, funding or a desktop/device.
- **NOT_IMPLEMENTED** — No repo implementation exists for the stated capability.

**Standing rule:** A passing generator test does **not** verify custody, recovery, signing, broadcast, transaction construction or mainnet readiness.


## Appendix A — Unresolved discrepancies (do not treat as settled)

1. **Web starter test count — 25 vs ~117.** The repo records `vitest run` 25/25 (`templates/web/UPSTREAM.md`, 2026-11-10). This lane counted 9 Vitest test files in `apps/web/src` and roughly 117 `it(`-matching lines. The grep count is unreliable (it matches substrings such as `split()`/`visit()`). Neither number is reconciled; the true executed count needs a Vitest run.
2. **Android starter test count — 17 vs 57.** The repo records `./gradlew testDebugUnitTest` 17/17 (`templates/android/UPSTREAM.md`). This lane counted 57 `@Test` annotations across the 5 Kotlin test files (ConfirmationPolicyTest 24, DerivationPolicyTest 7, ExtendedKeyValidatorTest 18, WalletViewModelTest 5, ImportWalletAddButtonTest 3). Annotation counts are not confirmed executed/passing counts; 17 vs 57 remains unresolved and needs a Gradle test run.
3. **Guide wallet-core pins — 4.9.2 vs 4.9.3.** `docs/11` and the Android guide cite 4.9.2 as the reference engine; the repo tool pin is 4.9.3 (`tools/hdwallet-gen/package.json`, `apps/web/package.json`). The guides' 4.9.2 is a reference only, never the tool pin — but the drift should be reconciled in the docs.
4. **Main-branch wallet-core pin — 4.8.4 vs 4.9.3.** Main pins 4.8.4; the feature branch pins 4.9.3 (see BRANCH-AUDIT.md).

## Appendix B — Audit method and Sol calls (lane D1)

- VM reachability proved first: worktree HEAD `85b8d47`, clean tree, before any model call.
- 4 Sol calls (gpt-6.1-sol, API 2, reasoning max, via `/home/boxd/workspace/bawa-dx/D1-audit/mcp-chat-sol-api2.mjs`); prompts and answers saved verbatim in this lane dir (`prompt-0*.md`, `sol-0*.md`). Call log: `RUN-LOG.jsonl`.
- Durations: call 1, 323,503 ms; call 2, 314,614 ms; call 3, 394,244 ms; call 4, 186,667 ms. Calls 1–3 landed under 500 s and call 4 well under it; per the owner rule received with the resume, fast calls are recorded as-is and were not re-run to pad time. The first launch attempt of call 1 failed outright (no process, no log file) and was relaunched successfully; see RUN-LOG.jsonl.
- Duration-rule note: a 500–600 s target with a hard 600 s kill arrived after all four calls had already landed, and was then superseded (~03:58 IST) by the owner order removing the kill entirely — no call ran under `timeout 600` and no call was killed. No further Sol calls were needed: assembly and first-hand verification were done by the lane.
- Lane reconciliation edits applied at assembly (first-hand verified): exact `tests/mainnet-*.test.mjs` filenames supplied in §2; §7 procedure labels for docs/04, 05, 08 and 11 aligned with §§1–2 (CI-tested scope), as listed in the section table. No other Sol claim was altered; where Sol hedged, the hedge is preserved.
