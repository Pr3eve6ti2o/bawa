# Bawa capability map — lane D1 audit

> **2026-11-28 update — docs audit, Lane A (hands-on, 0 Sol calls):** figures below are the gates at token-gaps `1253bf6` (honest remains: BSC third RPC `ff63077`, dashboard 43 linked rows `3db591e`, BNB header icon `1253bf6`; live site republished, gh-pages `c0cf697`, serving `index-Brm7r34g.js`): web vitest 129 files, 3,429 passed + 5 skipped, 0 failed; build PASS; bundle total JS 4,509,662 / 6,000,000. Since the Lane C block below: history still covers 18 chains (Gnosis via keyless gnosisscan.io); the 3 open findings from the honest remains are NOT fixed here and are not claimed fixed anywhere in this file (vite-dev WASM 404, TRON USDT token path has no PublicNode fallback, mmdc needs a persistent path). Corrections applied in place below to claims that had become false as live statements: §6 adopted items (`dinero.js` removed; `decimal.js` + `mnemonic-words` are devDependencies, not dependencies) and the two "Android has no AAR" rows (Step 4 done, `f9f312b`); §9 prices (feed implemented), broadcast (devnet-only path exists under exception E1), live testnet spend (devnet TON sends ran), swaps (live quotes only, execution not implemented), generic EVM (generalised signer covers 61 EVM chains), chains beyond the four (87 wired), and live-browser balance/history (real-browser runs have since happened — dashboard 43-row counts, `docs/DECISIONS.md` §47). §7 line counts re-counted at `ceade79`. The 2026-11-20 audit body below is otherwise left as the dated record; the dated update blocks under this one are likewise left unchanged.
>
> **2026-11-28 update — Lane C (hands-on, 0 Sol calls):** figures below are the gates at token-gaps `7f24ef1`, verified first-hand on loud-stone (Node 22) by this lane: web vitest 129 files, 3,416 passed + 5 skipped, 0 failed; build PASS (tsc 0, palette audit passed); bundle total JS 4,509,097 / 6,000,000, `index-DY516Vr9.js`. Since the 2026-11-28 Lane B block below: fix programme landed (`f77b803`–`4adbd30` — change password, remove an added token, Activity switcher, wallets rename/delete, chart retry + Coinbase fallback, watch-only balances + TRON fallback, Gnosis history via keyless gnosisscan.io, so history covers 18 chains; bsc, opbnb, metis, fantom still balance-only); Add Token mobile overflow fixed (Lane A, `aea4b58`); Receive QR card + 7 templates redesigned flat (Lane B, `fec71be`); README Showcase extended with 18 fresh screenshots (`docs/preview/`). Android Step 4 DONE (`f9f312b`: TWC 4.8.4 AAR built from source + `:core` wired, `ENGINE_BINDING_AVAILABLE` now `true`). The live site still serves the `734cfef` build (`index-BxW-qfX0.js`) until `7f24ef1` is republished.
>
> **2026-11-28 update — docs-currency Lane B (hands-on, 0 Sol calls):** figures below are the publish gates at token-gaps `734cfef` (wobbly-cards + Starknet QR warning + web follow-ups, verified first-hand on loud-stone before pushing; live site root 200 serving `index-BxW-qfX0.js`, gh-pages `43fe69f`); the rest of this block is the 2026-11-26 coordinator re-check pass, unchanged. The example wallet has 87 chains (22 curated + 65 expansion, including the 3 OKX-reference chains Cardano, Kaspa, Starknet — derive-only); web vitest 129 files — PASSES on loud-stone (3,351 passed + 5 skipped, 0 failed, Node 22, at token-gaps `734cfef`, 2026-11-28); FAILS in this sandbox, timeout-dominated (104 failed / 2,841 passed on the guide-update tip, 79 failed / 2,866 passed on pristine token-gaps `7a170f4`) — environment artefacts, not code defects (see docs/index.md). Five of the six Part A items are now IMPLEMENTED, not PENDING: Bitget Agent API extra verifier (§6.6, browser leg + agent-side script), Cardano/Starknet/Kaspa (§2.5), Coinbase Onramp Buy (§12), Shamir backup shares (§13), ERC-7730 clear signing (§14). The sixth, WalletConnect (§11), is REMOVED (providers programme, 2026-11-26 — no projectId; owner decision). Bundle: total JS 4,482,622 vs the 6,000,000 budget — passes by 1,517,378 bytes (publish gates at token-gaps `734cfef`, 2026-11-28; budget re-baselined by owner order at `f5a5f19`, 2026-11-26). The `okx-cex-market` keyless second price source is an agent skill only — it does NOT go in the app. Wobbly-cards done (`67c7610`: flat + hairline everywhere, 26 of 27 `BawaIcon` glyphs redrawn geometric); Starknet QR warning done (`77e4473`: all 7 templates + PNG). Android Step 3 done (`e20cee6`: data layer, 87 chains, 169 RPCs, 4 testnets, 21 tokens, 77 unit tests); Step 4 (TWC AAR build) is RUNNING, owner-authorized 2026-11-28 — not done; the §4 'executed passing count unknown' note below is superseded for the data layer.
>
> **2026-11-25 update:** engine smoke is now 440 checks (README proof strip, verified 2026-11-24); the example wallet has 84 chains (22 enabled by default); web vitest 99 files, 2,799 passed + 5 skipped on token-gaps `7f12de4`. The 2026-11-20 block below is the historical record of that refresh.
>
> **2026-11-25 update — Lane G (usable-install programme, guide rewrite):** the single "create this" specification is now `docs/CREATE-THIS-SPEC.md` (read with `WALLET_BUILDER.md` and `AGENTS.md`). Stale guide claims fixed in place in the same lane: auto-lock "no lock exists" (implemented — `apps/web/src/wallet/auto-lock.ts`, `vault.ts`), `WALLET_BUILDER.md` "Chains: 13" (now 84), test counts (99 files / 2,799 + 5 skipped, 2026-11-24), engine smoke 217 (now 440), and `docs/02-chains` §2 calling Solana reference-only (SOL is wired; Cardano is still absent). Part A items are PENDING, not implemented: Bitget Agent API extra verifier (Lane A), Cardano/Starknet/Kaspa (Lane B), WalletConnect 2.21.0 lazy-loaded (Lane C), Coinbase Onramp Buy (Lane D), Shamir backup shares (Lane E), ERC-7730 clear signing (Lane F). The `okx-cex-market` keyless second price source is an agent skill only — it does NOT go in the app.

> **2026-11-20 update — base `e493720`:** Refreshed on `panel-rebuild/org-docs`, based on `panel-rebuild/adopt-proper`. The launcher exists. The web suite passed all 457 tests in 40 files; engine tests passed 217 smoke checks plus register-links checks (both exit 0). Desktop/phone live-browser previews have been screenshot-checked. Web-count and `docs/11`/main-pin discrepancies are resolved. Still open: seven Web registry gaps, including live-browser balance/history; Android's executed passing count and stale guide build claim; the classifier's code-pinned refusal sentence, which still says testnet-default (needs a code change); and recovery rehearsal. M-35 funding was declined on 2026-11-13; rehearsal addresses were retired.

- **Repository:** `Pr3eve6ti2o/bawa`
- **Audited base:** `e493720` on `panel-rebuild/adopt-proper`; documentation refresh on `panel-rebuild/org-docs`. The earlier working-copy pin `85b8d47` is historical.
- **Audit date:** 2026-11-20 refresh, verified first-hand; original audit dated 2026-11-14.
- **Lane:** D1 (audit + capability map), Bawa DX transformation re-dispatch.
- **Method:** first-hand inspection on the VM via boxd (repo tree, `docs/`, `tools/`, `scripts/`, `ai/`, `registry/`, `apps/`, `templates/`, `tests/`, CI workflows, all 5 branch worktrees), then 4 gpt-6.1-sol (API 2, max reasoning) drafting calls; every factual claim below was checked against the actual file on the VM by the lane before assembly. No test suite was executed in this lane, so no test is claimed passed in this run — "IMPLEMENTED_AND_VERIFIED" below rests on supplied historical/CI evidence, scoped as stated.
- **Scope note (standing rule):** a guide or blueprint is not an implementation. A passing generator test does not verify custody, recovery, signing, broadcast, transaction construction or mainnet readiness.
- **Launcher:** `tools/bawa_cli.py` exists on this branch. It provides five main options — Create an HD wallet; Create or Configure a Watch-Only Wallet; Build a Cryptocurrency Wallet Application; Build Cryptocurrency Tools; Security, Recovery and Development — plus `0. Exit`. "Direct" launcher relevance below means direct reuse through this existing launcher, not a proposed integration.

## Labels used in this map

Evidence labels follow AGENTS.md §5; this file does not define a separate status vocabulary.

**Scope.** This map covers the HD wallet engine and native-asset mainnet tooling in `Pr3eve6ti2o/bawa` on `panel-rebuild/org-docs`, based on `panel-rebuild/adopt-proper` at `e493720`. The `85b8d47` pin belongs to the historical 2026-11-14 audit. A guide or blueprint is not an implementation. Evidence now includes first-hand verification on 2026-11-20, including executed web Vitest and `tools/hdwallet-gen` `npm test` runs, alongside explicitly dated historical records. `IMPLEMENTED_AND_VERIFIED` is limited to the checks stated; it does not imply complete browser integration or establish Android's executed passing count. `tools/bawa_cli.py` exists: "direct" launcher relevance means direct reuse via that launcher.

## 1. HD wallet engine (Trust Wallet Core 4.9.3)

**CI context:** `.github/workflows/ci.yml` syntax-checks the engine JS, runs the hdwallet package’s `test/smoke.test.js` and `test/register-links.test.js`, checks TTY refusal, and runs the Python tests cited below. Supplied CI history: 51 runs; latest at `27ff384` passed on 2026-11-13—not an asserted pass at this refresh's base `e493720`.

- **Generation — IMPLEMENTED_AND_VERIFIED.** `tools/hdwallet-gen/generate.js`; dependency pinned by `tools/hdwallet-gen/package.json`: Trust Wallet Core 4.9.3 WASM, 24-word BIP-39, empty passphrase. Fixed paths: BTC `m/84'/0'/0'/0/i`, ETH `m/44'/60'/0'/0/i`, TRX `m/44'/195'/0'/0/i`, TON `m/44'/607'/0'`. Public-only stdout; live generation requires a controlling terminal.  
  **Tests/CI:** Package smoke/register-links run in CI; generator TTY refusal is explicitly asserted there. No interactive generation result was supplied for this lane.  
  Launcher relevance: Direct invocation is available, subject to the controlling-terminal requirement.

- **BTC/ETH/TRX watch-only deposit derivation — IMPLEMENTED_AND_VERIFIED.** `tools/hdwallet-gen/derive.js`: xpub-to-address derivation; no private input.  
  **Tests/CI:** `test/differential_test.py` uses independent `bip-utils` reference coverage for BTC/ETH/TRX indices 0/1; CI runs it.  
  Launcher relevance: Direct reuse with validated public xpubs.

- **BTC change derivation — UNVERIFIED.** `tools/hdwallet-gen/derive.js` also implements `btc-change`, path `m/84'/0'/0'/1/i`.  
  **Tests/CI:** CI syntax-checks the file; supplied differential-test evidence does not establish change-branch coverage.  
  Launcher relevance: Direct reuse is possible; change-branch behavioral validation remains AI-guided work.

- **TON watch-only derivation — IMPLEMENTED_AND_VERIFIED.** `tools/hdwallet-gen/derive-ton.js`: 64-hex Ed25519 public key to one Wallet V4 R2 address, workchain 0, wallet ID 698983191. No TON xpub and no index.  
  **Tests/CI:** `test/ton-watch-only-vectors.test.js` exists, but no executed result is supplied and it is not among the stated CI test runs; CI syntax-checks the implementation.  
  Launcher relevance: Direct public-key derivation after validation; must not offer indexed TON deposits.

- **Persistent derivation daemon — UNVERIFIED.** `tools/hdwallet-gen/derive-daemon.js`: public-only JSONL derivation for BTC/ETH/TRX, branches 0/1.  
  **Tests/CI:** CI syntax-checks it; no daemon-specific behavioral test file or package-suite coverage is established by the evidence.  
  Launcher relevance: Direct daemon reuse; integration and behavioral validation remain AI-guided work.

- **Address comparison — UNVERIFIED.** `tools/hdwallet-gen/compare.js`: compares addresses from env-file xpubs; rejects private, bad-checksum and bad-version inputs before WASM.  
  **Tests/CI:** CI syntax checks and package smoke/register-links exist, but compare-specific behavioral coverage is not supplied.  
  Launcher relevance: Direct reuse of the existing comparison tool, with validation still required.

- **Extended-key validation/redaction — UNVERIFIED.** `tools/hdwallet-gen/extended-key.js`: pure shared validation and redaction used by the engine tools.  
  **Tests/CI:** CI syntax checks and package tests exist; module-specific behavioral coverage is not established.  
  Launcher relevance: Direct reuse through existing engine callers; a standalone interface would need AI-guided wiring.

- **Wallet orchestration — IMPLEMENTED_AND_VERIFIED.** `tools/make_wallet.py`: starts the generator, validates public JSON, verifies the encrypted recovery artifact, and writes public xpub/address config. AAD identifier `nova-shop-seed-v1`; `seed.enc.json` mode 0600; `secrets/` mode 0700.  
  **Tests/CI:** `test/test_make_wallet.py`; CI runs it.  
  Launcher relevance: Direct orchestration entry point, preserving generator terminal requirements.

- **Seed recovery — IMPLEMENTED_AND_VERIFIED.** `tools/decrypt_seed.py`: AES-256-GCM recovery, BIP-39 validation before return, mnemonic printed to the controlling terminal—not stdout by default.  
  **Tests/CI:** `test/test_decrypt_seed.py`; CI runs it.  
  Launcher relevance: Direct interactive recovery, preserving terminal-only output by default.

## 2. Mainnet transaction tooling (unsigned, signing, guards, fees)

**No broadcast, no send, and no funded execution have ever happened from this repo.**

**Test provenance:** The 31 `tests/*.mjs` files are **not run by CI**. The named suites are `tests/mainnet-unsigned-tx.test.mjs`, `tests/mainnet-signing.test.mjs`, `tests/mainnet-guards.test.mjs` and `tests/mainnet-fees.test.mjs` (verified first-hand from the `tests/` listing); their counts are counted `test()` declarations, not executed results. The H9 baseline was 130 checks, 0 fail at `0b2aa295`; that is historical evidence, and its “no transaction construction/signing” statement predates the T33/T35 modules. The current engine suite is 440 smoke checks, 0 fail (README proof strip, verified 2026-11-24).

- **Unsigned native-asset builders — UNVERIFIED.** `tools/mainnet-tx/unsigned-tx.mjs`: offline, public-input-only BTC P2WPKH, ETH legacy/EIP-1559, TRON TransferContract and TON V4 R2 construction. No network, signing or broadcast; broadcast/send/token/contract stubs always throw.  
  **Tests/CI:** `mainnet-unsigned-tx` suite in `tests/*.mjs`—24 declarations, no CI. `test/test_unsigned_serialization.py` also exists; no executed result or stated CI run is supplied.  
  Launcher relevance: Direct module reuse for unsigned native-asset construction only; validation/integration remain AI-guided work.

- **Local signing — UNVERIFIED.** `tools/mainnet-signing/local-signing.mjs`: local signing inside T25 isolation with temporary unfunded credentials; independent signature-verification code and an 11-check, fail-closed pre-broadcast checklist. No network import/call or broadcast path.  
  **Tests/CI:** `mainnet-signing` suite in `tests/*.mjs`—24 declarations, no CI or supplied executed result.  
  Launcher relevance: AI-guided, T25-isolated, temporary-unfunded work only. Stop before broadcasting; M-35 execution is not authorised.

- **Mainnet guards — UNVERIFIED.** `tools/mainnet-guards/mainnet-guards.mjs`: output secret redaction; no-broadcast gate allowing read-only operations and restricted local signing; three-pass credential wipe plus `verifyNoCopies` sweep.  
  **Tests/CI:** `mainnet-guards` suite in `tests/*.mjs`—28 declarations, no CI or supplied executed result.  
  Launcher relevance: Direct guard-module reuse is possible; behavioral validation is still AI-guided work, not a proven safety guarantee.

- **Read-only fee quotes — UNVERIFIED.** `tools/mainnet-fees/fees.mjs`: BTC/ETH/TRON/TON quotes using BigInt atomic units and built-in fetch only. BTC requires both mempool.space and blockstream.info; disagreement fails closed.  
  **Tests/CI:** `mainnet-fees` suite in `tests/*.mjs`—28 declarations, no CI or supplied executed result.  
  Launcher relevance: Direct read-only module reuse; external endpoint availability and live quote behavior remain unverified.

- **M-35 rehearsal procedure — DOCUMENTED_NOT_TESTED.** `docs/mainnet/M35-REHEARSAL-PROCEDURE.md` is a **DRAFT for review only**, not an implemented or authorised rehearsal.  
  **Tests/CI:** No rehearsal-execution test result or CI execution is supplied.  
  Launcher relevance: Must route to AI-guided review/planning, not execution.

- **M-35 funding and authorisation — EXTERNALLY_DEPENDENT.** Supplied status for the rehearsal draft: owner declined funding on 2026-11-13; all four rehearsal addresses are retired and isolated credentials destroyed.  
  **Tests/CI:** External owner decisions are not CI-testable; no funded-execution result is supplied.  
  Launcher relevance: AI-guided coordination only; owner funding and authorisation cannot be supplied by the launcher.

- **Broadcast/send capability.** `tools/mainnet-tx/unsigned-tx.mjs` has throwing stubs; `tools/mainnet-signing/local-signing.mjs` has no broadcast/network path. No mainnet transaction has ever been broadcast from this repo.  
  **Tests/CI:** The unsigned/signing suites above are outside CI; specific stub-test coverage is not supplied.  
  Launcher relevance: Must remain unavailable as a direct action; future implementation requires AI-guided work and external authorisation.

## 3. Web starter (apps/web)

*Scope: `Pr3eve6ti2o/bawa`, working copy at `e493720` (2026-11-20 refresh; the `85b8d47` pin was the 2026-11-14 audit). Tested labels below refer to recorded, limited verification—not tests run in this lane.*

- **IMPLEMENTED_AND_VERIFIED — starter build/unit/HTTP scope only.** Source: `apps/web/`; overview: `apps/web/README.md`. Stack: React **19.2.5**, Vite **8.3.8**, TypeScript **5.9.3**, Tailwind **4.2.4**, Vitest **4.1.12**, wallet-core **4.9.3**. Vendored token-ui supplies UI components only; provenance and exclusions are in §6.
  - The documented 14-screen inventory (`docs/14`, §5.1) covers welcome, create, import, dashboard, asset list/detail, send, receive, transaction history/detail, network selection, wallet management, security settings and mnemonic backup. Screen inventory does **not** establish functional sending or transaction history.
  - **Recorded verification (2026-11-20):** The web starter's Vitest suite executed **457 tests in 40 test files**, all passed, **exit 0**. `templates/web/UPSTREAM.md`'s **2026-11-10** results remain historical: `tsc --noEmit` exit 0; `vitest run` **25/25**; `vite build` exit 0; `vite preview` served `/` and `/wallet-core.wasm` with HTTP 200. That 25/25 record is not the current executed count. Typecheck and build also passed in the 2026-11-20 quality-gates run (`web-typecheck` PASS, `web-build` PASS).

- **UNVERIFIED — browser execution of the boundary/integration.** `apps/web/src/engine/boundary.ts` implements validation before WASM, including R-01 point validation in pure BigInt. `scripts/copy-wasm.mjs` supplies WASM to `apps/web/public/` on predev/prebuild; WASM is never committed. The recorded asset-delivery checks do not establish browser engine execution or interactive wallet behavior. Live previews have been served and screenshot-checked at desktop and phone widths; that is preview/UI evidence, not complete verification of the browser boundary or network integration.

- **IMPLEMENTED_AND_VERIFIED — served-browser preview/screenshot checks only.** Live previews of the web starter have been served and screenshot-checked at desktop and phone widths. This is preview/UI evidence, not complete verification of the browser boundary or network integration.

- **UNVERIFIED — live-browser balance/history execution.** Read-only `getBalance` and `getHistory` adapters are verified in Node. No live-browser balance/history run has happened: the app's own CSP blocks their fetches in a served-browser preview.

- **Registry-listed gaps — seven missing, partial or unverified items.** As read on **2026-11-20**, `registry/profiles.json`, profile `web-wallet`, lists: broadcast; TON fee-quote (send preview reports unavailable; signing still works with a seqno); TON post-sign verification (partial only: no-error + 32-byte hash + BOC magic, no BOC re-parse); prices; live-browser balance/history run; auto-lock timer (lock screen exists; inactivity timer not built); on-device derivation (web has no on-device concept — derivation is in-browser WASM). Send, sign, balances and transaction history are **no longer registry-listed gaps**: offline signing exists in `apps/web/src/wallet/send.ts`, and read-only `getBalance`/`getHistory` adapters exist. Offline signing does not imply broadcast support; Node adapter verification does not establish a served-browser balance/history run.

- **Resolved test-count discrepancy (2026-11-20):** the first-hand Vitest run executed **457 tests in 40 test files**, all passed, exit 0. This replaces the conflicting 25 versus approximately 117 figures; the upstream 25/25 record remains historical evidence.

## 4. Android starter (apps/android)

- **IMPLEMENTED_AND_VERIFIED — watch-only starter scope only.** `apps/android` contains **14 watch-only Compose screens**, a watch-only ViewModel with **xpubs in memory only**, a lock that is **UI state only**, a pure-Kotlin extended-key validator and derivation-policy constants.
  - Stack: Kotlin **1.9.22**, JVM **17**, Gradle wrapper **8.7**, AGP **8.2.2**, Compose BOM **2024.02.00**; compile/min/target SDK **35/33/35**; ZXing **3.5.3**, **QR display only**. Package `com.bawa.wallet`, version **0.1.0**.
  - **Recorded verification:** `templates/android/UPSTREAM.md`: `./gradlew testDebugUnitTest` **17/17**; `./gradlew assembleDebug` exit 0, producing `app-debug.apk` (**52,456,212 bytes**). Emulator evidence exists in `docs/android-evidence.md`. **Not re-run here; this is not complete-wallet verification.**

- **DOCUMENTED_NOT_TESTED — Bawa’s 24-word ceremony.** The ceremony was rebuilt in documentation only; the supplied evidence does not identify its exact document path. The upstream WDK 12-word policy was **excluded**, not adopted. Policy constants likewise do not establish transaction-confirmation enforcement. WDK UI provenance and excluded engine code are detailed in §6.

- **Nine registry-listed gaps.** `registry/profiles.json`, `android-wallet`: on-device address derivation (**no AAR**); send; sign; broadcast; balances; prices; transaction history; on-device Add-button acceptance path; KVM-backed emulator verification.
  - **Add-button acceptance path stays unimplemented.** `docs/android-evidence.md` explicitly records **NOT VERIFIED**: taps were swallowed under TCG emulation. Unit-test evidence does not establish this acceptance path.
  - **EXTERNALLY_DEPENDENT — native engine artifact and KVM verification environment.** The starter has no AAR for any version; on-device address derivation remains open. No KVM-backed verification result is supplied.

- **Unresolved test-count discrepancy:** the repository records **17 tests**, but this lane counted **57 `@Test` annotations across five Kotlin test files**: `ConfirmationPolicyTest` 24, `DerivationPolicyTest` 7, `ExtendedKeyValidatorTest` 18, `WalletViewModelTest` 5, `ImportWalletAddButtonTest` 3. These are annotation counts, not confirmed executed/passing counts; **17 versus 57 remains unresolved**. Grep on **2026-11-20** re-counted the same **57 annotations** across the same five files. The executed passing count remains **unknown**: the Android SDK is installed (2026-11-27) and a Gradle debug build succeeds; the executed passing test count remains unknown because the unit tests have not been run yet. The earlier 17-test figure is not confirmed by this annotation re-count.

- **Toolchain support caveat:** AGP **8.2.2** does not officially support compileSdk **35**; that requires AGP **8.6.0+**. The recorded build proceeds via `android.suppressUnsupportedCompileSdk=35`. Kotlin **1.9.22**’s supported Gradle range tops out at **8.1.1**, while this repository uses **8.7**. A recorded successful build does not make this combination officially supported.

## 5. One-prompt builder (scripts/ + ai/ + registry/)

### Builder and verification tooling

| Item | Label | Evidence and limits |
|---|---|---|
| One-prompt workflow | **UNVERIFIED** | `scripts/build-wallet.mjs`: classify → generate through `scripts/generate-project.mjs` into gitignored `generated/<profile-id>` → verify → write JSON report. Never waits for input; ambiguous, unclassifiable or refused requests write a report and exit **2**. No end-to-end run result is supplied here. |
| Differentiated project generation | **UNVERIFIED** | `scripts/generate-project.mjs` generates per registry profile and copies `scripts/generate-templates/derive.mjs` and `scripts/generate-templates/verify.mjs`. `generated/` contains **seven profile directories from prior runs**; their presence does not prove complete or verified wallet products. |
| Pure request classifier | **IMPLEMENTED_AND_VERIFIED — reported unit-test scope** | `scripts/classify-request.mjs`; `tests/classifier.test.mjs` has **32 `test()` occurrences**. The supplied evidence calls it unit-tested but gives no execution result or confirmed passing count. This does not verify the full builder or every routing refusal. |
| Quality gates and test runner | **UNVERIFIED** | `scripts/quality-gates.mjs`: lockfile pin check first, secret scan, verdict; supports `--skip-android`. `scripts/run-test-suites.mjs` runs web Vitest and Android Gradle tests; Android requires `JAVA_HOME` and `ANDROID_HOME`, otherwise it reports `NOT-RUN`. No gate verdict or runner result is supplied. |
| Supporting scripts | **UNVERIFIED** | `scripts/setup.mjs`, `scripts/build-platforms.mjs`, `scripts/validate-registry.mjs`, `scripts/secret-scan.mjs`, `scripts/check-lockfiles.mjs`, `scripts/gate-verdict.mjs` exist. No execution evidence is supplied for these scripts. |
| Offline capability detection | **UNVERIFIED** | `ai/detect-capabilities.mjs`: read-only, offline toolchain capability check, exit **0/1**. No invocation result is supplied. |

### Registry profiles

Evidence: `registry/profiles.json`, `registry/capabilities.json`, `registry/engines.json`, `registry/ui.json`, `registry/schemas/`.

The five **DOCUMENTED_NOT_TESTED** profiles below have registry status `DOCUMENTED_NOT_TESTED`. The two **IMPLEMENTED_AND_VERIFIED** starter profiles have registry status `STARTER_IMPLEMENTED_AND_VERIFIED`, **starter scope only**. Registry declarations and generated directories do not implement the missing products.

| Profile | Map label | Registry missing list |
|---|---|---|
| `hd-wallet-cli` | **DOCUMENTED_NOT_TESTED** | **6:** built CLI wallet product; send; sign; broadcast; confirmation-policy enforcement in code; any GUI. |
| `bitcoin-wallet` | **DOCUMENTED_NOT_TESTED** | **6:** built product; send; sign; broadcast; transaction construction; 6-confirmation enforcement in code (**policy only**). |
| `evm-wallet` | **DOCUMENTED_NOT_TESTED** | **7:** built product; generic EVM beyond ETH derivation; send; sign; broadcast; transaction construction; finality enforcement. |
| `multichain-wallet` | **DOCUMENTED_NOT_TESTED** | **6:** built integrated product; send; sign; broadcast; cross-chain transaction operation; confirmation enforcement. |
| `watch-only-wallet` | **DOCUMENTED_NOT_TESTED** | **5:** built product/monitoring UI; balances; confirmation enforcement; TON (**excluded—no xpub**); any secret intake or signing (**excluded scope**, not a promise to add it). |
| `web-wallet` | **IMPLEMENTED_AND_VERIFIED — starter only** | **8:** send; sign; broadcast; balances; prices; transaction history; live-browser run; on-device derivation (no web on-device concept). See §3. |
| `android-wallet` | **IMPLEMENTED_AND_VERIFIED — starter only** | **9:** on-device address derivation/no AAR; send; sign; broadcast; balances; prices; transaction history; on-device Add-button acceptance path; KVM-backed emulator verification. See §4. |

The listed gaps are unimplemented in their stated profile scope; external prerequisites and intentional exclusions remain distinct.

### AI routing

- **DOCUMENTED_NOT_TESTED — routing/refusal blueprint.** `ai/request-routing.md` maps the eight registry profiles—CLI, Bitcoin, EVM, multichain, multichain-extended, watch-only, web and Android—to `ai/prompts/create-*.md` (**eight files**) and `ai/profiles/*.md` (**eight files**). Documentation is not evidence of fully implemented or end-to-end-tested AI routing.
- Documented refusals cover mainnet without separate approval; swaps/staking/bridges; signing/broadcast claims; TON send; unlisted profiles; TON xpub.
- **Mainnet-default conflict — resolved 2026-11-20 (Lane B):** `AGENTS.md`, `WALLET_BUILDER.md` and the `ai/request-routing.md` scope boundary are now aligned to the owner's **mainnet-first** direction (testnet secondary; mainnet use still needs separate approval and real-funds gates). The code-pinned remnant was closed 2026-11-20 (Lane B): the refusal sentence is now "I cannot support mainnet use without separate approval." in `scripts/classify-request.mjs`, the `ai/request-routing.md` table and all six `tests/classifier.test.mjs` places — the stale "default scope is testnet" clause was dropped because a refused request builds nothing (refusal report, profile null, exit 2). The Web/Android guides remain testnet-framed.

## 6. External dependencies and recommended tools

| Item | Label | Evidence, provenance and limits |
|---|---|---|
| wallet-core **4.9.3** dependency pins | **UNVERIFIED — engine-operation scope** | The **only engine dependency**, pinned in `tools/hdwallet-gen` and `apps/web`. Web starter tests/build/WASM HTTP delivery are recorded in `templates/web/UPSTREAM.md`; no tool-run or complete engine-operation verification is supplied here. Dependency presence does not establish send/sign/broadcast, and Android has the 4.8.4 AAR (Step 4 done, `f9f312b`) but still no signing/broadcast in the app. |
| token-ui UI adoption | **IMPLEMENTED_AND_VERIFIED — recorded web starter integration only** | `consenlabs/token-ui`, pin `6380d5d4dfeebf89704c0527e3c552be6ee2d231`, **MIT**; vendored into `apps/web/src/ui/`, **67 files**, import paths rewritten, no behavior changed. Recorded starter checks: `templates/web/UPSTREAM.md`; no live-browser run. Supplies **UI components only**, not engine, derivation, vault, custody, signing, RPC or indexing. |
| WDK Starter UI adoption | **IMPLEMENTED_AND_VERIFIED — recorded Android starter integration only** | `tetherto/wdk-starter-kotlin`, pin `a4fa21729ba621c095d8638bc8c50de541008214`, **Apache-2.0**; UI layer only. Recorded scope: `templates/android/UPSTREAM.md`, with acceptance limitations in `docs/android-evidence.md`. `wdk-core-kotlin`, `WdkCore` imports, 12-word policy, vault, derivation, signing and provider send/balance logic were **excluded, not adopted**. |

**DOCUMENTED_NOT_TESTED / EXTERNALLY_DEPENDENT — recommended tools and integrations.** `docs/03-tools-and-repositories/README.md` recommends:

`paulmillr/scure-bip39`, `scure-bip32`, `trustwallet/wallet-core`, `bitcoinjs/bitcoinjs-lib`, `bitcoin/bitcoin`, `Blockstream/esplora`, `spesmilo/electrumx`, `wevm/viem`, `ethers-io/ethers.js`, `anza-xyz/kit`, `ton-org/ton`, `cosmos/chain-registry`, `cosmos/cosmjs`, Cardano CIPs, `polkadot-js`, `XRPLF/xrpl.js`, Trezor, Ledger and Foundry/Anvil.

`paulmillr/scure-bip39` is now an implemented dependency via `@scure/bip39` for validation/tests/docs only, not a replacement for wallet-core, and `wevm/viem` is an `apps/web` dependency (`viem` at `2.58.0`) for signing helpers; apart from these and the existing wallet-core dependency, the remaining listed integrations are recommendations only. Adoption does not establish send/broadcast support, and Android has the 4.8.4 AAR (Step 4 done, `f9f312b`) but still no signing/broadcast in the app. The newly adopted items are `@scure/bip39` 2.4.0 in `apps/web/package.json` dependencies, `decimal.js` 10.6.0 and `mnemonic-words` 2.0.0 in its devDependencies (test oracles only — `dinero.js` was removed by the token-verify programme), `bip39` 3.1.2 (`bitcoinjs/bip39`, test oracle only) in its devDependencies, and `mnemonic==0.21` (`trezor/python-mnemonic`, used as a second check in `tools/make_wallet.py`) in `requirements.txt`; `@trustwallet/wallet-core` 4.9.3 remains the only engine dependency, pinned in `tools/hdwallet-gen` and `apps/web`, with the limited evidence scope stated above.

## 7. Documentation (docs/01–16 + specialist guides)

All documents remain guides. Implementation labels below apply only to the named procedure or subset, not the whole document. Test files alone are not treated as passing-run evidence. **—** means the line count was not supplied.

| Doc | Lines | What it covers | Label / implementing tool | Launcher relevance |
|---|---:|---|---|---|
| `docs/01-fundamentals` | 328 | HD fundamentals, entropy, BIP-39/32/44 | DOCUMENTED_NOT_TESTED | Conceptual help, not an engine. |
| `docs/02-chains` | 486 | Chain families; mainnet formats unless testnet-labelled; additional chains in prose | DOCUMENTED_NOT_TESTED | Do not turn prose coverage into supported-chain claims. |
| `docs/03-tools-and-repositories` | 220 | Tool and repository map | DOCUMENTED_NOT_TESTED | Tool-selection reference. |
| `docs/04-wallet-generation` | 391 | Generation procedure | Procedure: IMPLEMENTED_AND_VERIFIED (CI scope: `test/test_make_wallet.py`, hdwallet-gen smoke tests) — `tools/make_wallet.py` + `generate.js` | Point to existing generation tools, not the guide as an app. |
| `docs/05-watch-only` | 544 | BTC/ETH/TRX/TON watch-only derivation | BTC/ETH/TRX procedure: IMPLEMENTED_AND_VERIFIED (differential test, index 0/1 scope) — `derive.js`; TON: UNVERIFIED — `derive-ton.js` | Separate derivation from GUI import and withdrawal verification. |
| `docs/06-tracking` | 804 | Tracking from $0 using explorers/RPC | DOCUMENTED_NOT_TESTED | No tracking code; chain data requires external services. |
| `docs/07-payment-tracking` | 885 | Payment tracking and reconciliation | DOCUMENTED_NOT_TESTED | `test/payment_record_check.py` checks a record schema, not live payments. |
| `docs/08-security-recovery` | 1,311 | Security/recovery; 12 limitations stated up front | DOCUMENTED_NOT_TESTED; decryption subset IMPLEMENTED_AND_VERIFIED (CI scope: `test/test_decrypt_seed.py`) — `tools/decrypt_seed.py` | Link recovery instructions; do not claim a completed rehearsal. |
| `docs/09-signing-and-hardware` | 918 | Descriptors, PSBT and hardware signing | DOCUMENTED_NOT_TESTED | No PSBT/hardware integration; local test-only signing is separate. |
| `docs/10-operations-and-testing` | 1,530 | Operations, release gates and incident response | DOCUMENTED_NOT_TESTED; gate-check subset UNVERIFIED — `scripts/quality-gates.mjs` | Only coded checks are enforced, not the entire operational blueprint. |
| `docs/11-trust-wallet-and-independent-verification` | 612 | wallet-core reference and independent bip-utils verification | DOCUMENTED_NOT_TESTED; verifier IMPLEMENTED_AND_VERIFIED (CI scope, BTC/ETH/TRX index 0/1) — `test/differential_test.py` | Flag guide reference **4.9.2** versus repo tool pin **4.9.3**. |
| `docs/12-chain-registry-and-assets` | 605 | wallet-core registry and Trust Wallet Assets interpretation | DOCUMENTED_NOT_TESTED | Metadata is not implemented chain support. |
| `docs/13-wallet-app-architecture` | 595 | Key management, watch-only, signing and UI boundaries | DOCUMENTED_NOT_TESTED | Starters implement UI/boundaries only, not the full architecture. |
| `docs/14-wallet-app-implementation` | 442 | Modules, fixture gate, typed errors, build checklist; testnet/published vectors | DOCUMENTED_NOT_TESTED; starters are partial implementation | AI implementation checklist, not a complete wallet. |
| `docs/15-threat-model-and-theft-prevention` | 366 | Phishing, SIM swap, poisoning, malware, supply chain and incidents | DOCUMENTED_NOT_TESTED | Threat guidance, not security certification. |
| `docs/16-security-decision-guide` | 188 | Free/paid help, spending thresholds and checklist | DOCUMENTED_NOT_TESTED | Human decision support, not runtime enforcement. |
| `gui-watch-only-workflow.md`, `ton-watch-only-testing.md` | — | Watch-only import workflows; Web import validation and unit tests are present | DOCUMENTED_NOT_TESTED; Web import UNVERIFIED at live-browser scope | External GUI import remains untested; M-39 withdrawal remains OPEN. |
| `docs/web-wallet/WEB-GUIDE.md` | 1,103 | Bitcoin testnet4, Ethereum Sepolia, TRON Nile, TON testnet | DOCUMENTED_NOT_TESTED; web starter implements UI/boundaries only | Testnet-framed guide; no live-browser run established. |
| `docs/android-wallet/ANDROID-GUIDE.md` | 5,522 | Testnet-only Android guide; prose source-build pin 4.9.2 | DOCUMENTED_NOT_TESTED; Android starter implements UI/boundaries only | No on-device derivation; reconcile prose pin with repo tool pin 4.9.3. |
| `docs/RECOVERY.md` | — | Recovery instructions accompanying decryption | DOCUMENTED_NOT_TESTED; tool: `tools/decrypt_seed.py` | Recovery exists as a tool/procedure, but rehearsal was not run. |
| `docs/SECURITY.md`, `docs/TESTING.md` and other listed support/plan/review docs | — | Companion documentation; inventory alone establishes no runtime capability | DOCUMENTED_NOT_TESTED | Reference and AI implementation inputs, not execution evidence. |
| `research/ui-candidates.md` | — | token-ui selected as WEB-01; shadcn/ui alternative not selected | DOCUMENTED_NOT_TESTED | UI selection is not wallet functionality. |

**Line-count note:** this table's line counts are as of **2026-11-28** (`ceade79`), re-counted by the docs audit, Lane A; the 2026-11-14 figures they replace are in the git history. `docs/08-security-recovery/README.md` was re-counted on **2026-11-20** at **1,297 lines** (now 1,311).

## 8. Mainnet readiness gap (mainnet-first intent vs actual state)

**Existing, bounded components:** BTC/ETH/TRX/TON mainnet derivation; unsigned builders; local **test-only** mainnet signing; guards and fee components. These do **not** establish an operational, funded send path. Builder/signing coverage must not be assumed identical across all four chains.

**Read-only evidence:** `docs/mainnet/evidence/t32-probe-2026-11-12.json` and `t32-smoke-2026-11-12c.json` record live read-only probes dated **2026-11-12**. They are not funded execution or broadcast evidence.

**Documentation is not implementation:** `docs/mainnet/MAINNET-GUIDE.md` (4,511 lines) explicitly states **“Guide prose only — no app or UI code.”** Its evidence baseline is **2026-11-09**, with code pin **e3b65fb8**, not this refresh's branch base **e493720**. The signing, unsigned-transaction, vector and guard documents, plus payment-record examples/schemas, do not implement their blueprints. `M35-REHEARSAL-PROCEDURE.md` is a **494-line DRAFT**.

| Gap | Required work |
|---|---|
| No payment execution or broadcast implementation | Implement the end-to-end send/broadcast path. Independently verify construction, signing, guards and fees; do not promote the test-only signer into a production or hardware flow by assumption. |
| No funded mainnet execution; M-35 funding declined and rehearsal not executed | Finalize the draft procedure, obtain explicit authorization/funding, then execute and record the funded rehearsal after the execution path exists. |
| External live-data dependencies remain | Integrate required external RPC/indexer/data sources; do not present balances/history/prices as repo-delivered functionality. |
| `AGENTS.md`, `WALLET_BUILDER.md` and the `ai/request-routing.md` scope boundary are aligned to mainnet-first in this lane (2026-11-20); the classifier's code-pinned refusal sentence still says testnet-default (needs a code change). Web/Android guides are testnet-framed | Complete the guide entry-point alignment to mainnet-first. Reframe testnet as secondary; **do not delete testnet code in this run**. |
| Documentation pins and execution evidence need reconciliation | Reconcile e3b65fb8-based mainnet prose with e493720 and guide wallet-core 4.9.2 references with tool pin 4.9.3. Complete and record relevant browser, GUI/M-39, recovery and transaction-path checks. |

**Mainnet readiness is not established.** These are required work items, not a readiness declaration.

## 9. Not implemented or verified — the honest list

Labels are scoped to the capability named, not to the wallet as a whole.

| Capability | Label | One-line reason |
|---|---|---|
| Send / payment execution | UNVERIFIED | Offline signing exists for BTC/ETH/TRX/TON; broadcast is disabled, and no live payment has been executed. |
| Broadcast | — | No mainnet broadcast implementation anywhere in the repo. A devnet-only broadcast path exists behind gates (exception E1, `CONSTRAINTS.md`, owner order 2026-11-22, expires 2027-02-20); devnet TON test sends have run on it. |
| Funded mainnet execution / M-35 | EXTERNALLY_DEPENDENT | Funding was declined and M-35 remains unexecuted; the send signing path exists, but broadcast is disabled. |
| Balances and history | IMPLEMENTED_AND_VERIFIED | Read-only mainnet adapters implement getBalance and getHistory. The `web-wallet` profile in `registry/profiles.json` lists "read-only mainnet balances and transaction history via per-chain adapters, verified against a second source" as implemented. |
| Prices | IMPLEMENTED_AND_VERIFIED | CoinGecko price feed with CoinLore / Coinbase / DexScreener / TonAPI fallbacks (`apps/web/src/wallet/prices.ts`, `price-fallbacks.ts`); 80 of 87 chains have a second price source (see ADR-0007). |
| Swaps, staking and bridges | — | Swap shows live quotes only (LI.FI, STON.fi); swap execution is not implemented and broadcast stays disabled. Staking and bridges are not implemented. |
| WalletConnect | — | No integration code (removed by the providers programme, 2026-11-26 — no projectId). |
| Hardware signing | DOCUMENTED_NOT_TESTED | `docs/09` describes it; the local test-only signer is not a hardware flow. |
| PSBT flows | DOCUMENTED_NOT_TESTED | Descriptors/PSBT are guide material; no PSBT implementation. |
| On-device Android derivation | — | Android starter implements UI/boundaries only; Step 4 done (`f9f312b`): the 4.8.4 AAR is wired in and `ENGINE_BINDING_AVAILABLE` is `true`, but on-device derivation execution remains unverified and the Add-button acceptance path is `UNVERIFIED`. |
| Live-browser Web execution | IMPLEMENTED_AND_VERIFIED for preview/screenshot checks and for balance/history reads in a real browser (dashboard 43-row counts, `docs/DECISIONS.md` §47) | Live previews served and screenshot-checked at desktop and phone widths; read-only `getBalance`/`getHistory` adapters verified in Node and exercised in a real browser against the production build. |
| External GUI watch-only import | DOCUMENTED_NOT_TESTED | Workflow documented but untested; no desktop machine was available on the test VM. |
| GUI watch-only withdrawal | EXTERNALLY_DEPENDENT | **M-39 OPEN**; external GUI verification is outstanding, and import is not withdrawal. |
| Recovery rehearsal | UNVERIFIED | `tools/decrypt_seed.py` exists; README’s verified-on table lists the rehearsal as not run. |
| Live testnet spend | — | Devnet TON test sends have run (3 app sends, `docs/DEVNET-ISSUES.md`); BTC/ETH/TRX devnet sends stay NOT PROVEN (unfunded — faucet gap). Mainnet broadcast stays disabled. |
| Generic EVM beyond ETH | IMPLEMENTED_AND_VERIFIED (signing scope) | The generalised offline EVM signer covers all 61 EVM chains (BSC send fix, `31012a6`); broadcast stays disabled. |
| TON send | UNVERIFIED | TON offline signing is implemented; broadcast is disabled, and no live TON send has been executed. |
| TON xpub | — | No TON xpub capability is evidenced; `derive-ton.js` does not establish it. |
| Chains beyond BTC/ETH/TRX/TON in code | IMPLEMENTED_AND_VERIFIED (wiring scope) | The example wallet wires 87 chains (22 curated + 65 expansion); network operations are verified for btc, eth, trx, ton only. |

## 10. How to read this map

Evidence labels follow AGENTS.md §5; this file does not define a separate status vocabulary.

**Standing rule:** A passing generator test does **not** verify custody, recovery, signing, broadcast, transaction construction or mainnet readiness.


## Appendix A — Discrepancies (resolved and unresolved; do not treat the unresolved one as settled)

1. **RESOLVED — web executed test count.** The first-hand **2026-11-20** Vitest run covered **51 test files**: **669 tests passed** and **1 was skipped**, **exit 0**. This establishes the current executed count in place of the conflicting 25 versus approximately 117 figures. The upstream 25/25 record remains historical evidence.
2. **OPEN — Android annotation count versus executed passing count.** Grep on **2026-11-20** re-counted **57 `@Test` annotations** across the same **five Kotlin test files**: `ConfirmationPolicyTest` 24; `DerivationPolicyTest` 7; `ExtendedKeyValidatorTest` 18; `WalletViewModelTest` 5; `ImportWalletAddButtonTest` 3. These are **annotation counts, not executed passes**. The executed passing count remains **unknown**: the Android SDK is installed (2026-11-27) and a Gradle debug build succeeds; the executed passing test count remains unknown because the unit tests have not been run yet. The earlier 17-test figure is not confirmed by this annotation re-count.
3. **RESOLVED for `docs/11` — historical reference engine versus current tool pin.** `docs/11-trust-wallet-and-independent-verification/README.md` explicitly frames **4.9.2** as the historical reference engine; line 129 plainly states that the current tool pin is **4.9.3**. These are not conflicting current pins. The Android guide's **4.9.2** remains an explicitly framed testnet source-build pin. Its separate "no Gradle build, no APK" claim is stale: **an APK was built and run on an emulator**. That build/run evidence does not establish Android's executed passing test count.
4. **RESOLVED — main-branch tool pin.** Reading `origin/main:tools/hdwallet-gen/package.json` on **2026-11-20** verified that main pins wallet-core **4.9.3**. The claim that main pins **4.8.4** is stale.

## Appendix B — Audit method and Sol calls (lane D1)

- VM reachability proved first: worktree HEAD `85b8d47`, clean tree, before any model call.
- 4 Sol calls (gpt-6.1-sol, API 2, reasoning max, via `/home/boxd/workspace/bawa-dx/D1-audit/mcp-chat-sol-api2.mjs`); prompts and answers saved verbatim in this lane dir (`prompt-0*.md`, `sol-0*.md`). Call log: `RUN-LOG.jsonl`.
- Durations: call 1, 323,503 ms; call 2, 314,614 ms; call 3, 394,244 ms; call 4, 186,667 ms. Calls 1–3 landed under 500 s and call 4 well under it; per the owner rule received with the resume, fast calls are recorded as-is and were not re-run to pad time. The first launch attempt of call 1 failed outright (no process, no log file) and was relaunched successfully; see RUN-LOG.jsonl.
- Duration-rule note: a 500–600 s target with a hard 600 s kill arrived after all four calls had already landed, and was then superseded (~03:58 IST) by the owner order removing the kill entirely — no call ran under `timeout 600` and no call was killed. No further Sol calls were needed: assembly and first-hand verification were done by the lane.
- Lane reconciliation edits applied at assembly (first-hand verified): exact `tests/mainnet-*.test.mjs` filenames supplied in §2; §7 procedure labels for docs/04, 05, 08 and 11 aligned with §§1–2 (CI-tested scope), as listed in the section table. No other Sol claim was altered; where Sol hedged, the hedge is preserved.
