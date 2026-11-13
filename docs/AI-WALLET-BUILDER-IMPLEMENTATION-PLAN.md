# AI Wallet Builder — Implementation Plan

Status: Phase 0 (reconnaissance) and Phase 1 (planning) complete, 10 November 2026.
This plan turns Bawa into a one-prompt wallet-building system: a user gives one
plain-language request and an AI coding agent uses this repository to produce a
real, buildable wallet project with engine, chain profile, UI foundation,
implementation instructions and verification.

Baseline: inspected first-hand at HEAD aab79dab (H6), clean tree, 50 files.
During this phase main advanced to b438d3a7 (H7); the H6-to-H7 diff is two files
only (derive_daemon.js and test/smoke.test.js — the daemon fix), and the suite
was re-run at H7: 92 checks, 0 fail. See the post-draft updates below.

Standing approval (owner, 2026-11-10 about 03:49 IST): proceed through ALL
phases (0–10) without stopping for approval between phases. The plan is a
starting point, not a gate. Lanes commit locally only and never push; Orion
verifies first-hand and pushes verified phase work to a feature branch. Main
stays protected.

Sections 1–6 are reproduced verbatim from the six section drafts in out/
(a01–a06). Assembler notes are confined to this front matter and the
Authorship section at the end. Evidence log: RUN-LOG.jsonl (6 calls).

## How to read this plan

- IMPLEMENTED_AND_VERIFIED — demonstrated by inspected files or a recorded
  test/build run, within the stated scope only. It never extends a repository
  observation into proof of network operation.
- DOCUMENTED_NOT_TESTED — written in a guide or draft, with no execution
  evidence behind it.
- PROPOSED — a plan recommendation, not a decision or a completion.
- OPEN — unresolved; a decision or evidence is still needed.
- EXTERNALLY_DEPENDENT — needs someone or something outside this lane
  (maintainer word, reviewer, desktop machine, upstream availability).
- UNVERIFIED — a claim not established by the evidence supplied.

## Contents

1. Baseline and verified state
2. Architecture, dependency map and repository structure
3. Phased implementation sequence
4. Template and engine research findings
5. Security, compatibility, reproducibility and testing gates
6. Open decisions, risks, acceptance criteria and completion evidence

## Post-draft updates (assembler notes, 2026-11-10)

These correct points that changed between the section drafts and this plan.
They supersede the corresponding statements in sections 1–6 where noted.

1. Phase gating superseded. Section 3 stop conditions and section 6.1/6.6
   ("STOP before Phase 2", "blocked pending explicit maintainer approval")
   were written under the Phase 0+1-only restriction. That restriction was
   LIFTED by the owner on 2026-11-10 about 03:49 IST: proceed through all
   phases without stopping for approval between phases; fix failures with
   best engineering judgment and document significant decisions.
2. Daemon fix landed (H7, b438d3a7, pushed 2026-11-10). Section 1.3, section
   5.1 and the Phase 4 "do not touch derive_daemon.js" instruction are now
   stale: derive_daemon.js validates extended keys through the shared
   extended-key.js module before any WASM call; the inline helpers are
   removed; the JSONL protocol and per-request catch are unchanged. Suite
   80 to 92 checks, 0 fail — verified first-hand in a fresh H7 clone
   (npm run check exit 0; npm test 92 ok, exit 0; daemon derives after bad
   requests with no WASM abort or allocation attempt). The "do not touch"
   restriction no longer applies. Known limit unchanged: BTC/ETH/TRX xpubs
   share version 0488b21e, so cross-chain misuse among those three is still
   undetectable from serialisation alone.
3. Testing keys corrected (owner, 2026-11-10 about 03:51 IST). Fresh test
   seed phrases and private keys MAY be generated for testing (real,
   functional ones, not placeholders) wherever tests need them. Guardrails:
   test-only material only, never funded with real mainnet funds, never
   production or existing keys; do not expose secrets or weaken security
   controls to make tests pass; all real-funds gates remain mandatory.
   Section 5.5 already states this corrected rule.
4. Foundations pre-approved (owner, 2026-11-10 about 03:32 IST). Web:
   token-ui (WEB-01). Android: Tether WDK Starter Kotlin, UI layer only
   (AND-01). Default visual direction: Bawa Balanced (STYLE-04). Phase 5
   confirms these by inspection (exact pins, licences, buildability) and
   re-decides only if inspection surfaces a problem.
5. API credit failover (owner, 2026-11-10 about 04:03 IST). If API 2 credit
   goes below $1, switch to API 1 on the VM. The VM keys file currently
   holds KEY_2 only; executing the switch means copying KEY_1 from the
   local keys file and re-pinning the lane clients to API 1.
6. Section 6.5 addendum — master plan section 11.2 fields. The section
   draft could not quote the authoritative final-status-report table; the
   assembler retrieved it from the master plan. The final handoff report
   must include these areas:

   | Area | Required report |
   |---|---|
   | Repository identity | Branch, commit SHA and clean/dirty working-tree status. |
   | AI entry | Which file an AI agent reads first and how it routes requests. |
   | Profiles | Which wallet/platform profiles exist and which are verified. |
   | Engines | Exact engine versions, bindings and verified operations. |
   | Templates | Project, exact commit, licence and what was reused. |
   | Web | Build command, build result, tests and unverified operations. |
   | Android | Gradle/JDK/SDK pins, build result, emulator/device evidence and unverified operations. |
   | Chains | Per-network capability matrix, including unsupported operations. |
   | Security | Checks run, limitations and external review still required. |
   | Reproducibility | Lockfiles, tool versions and clean-install evidence. |
   | Decisions | Open maintainer questions and recommended answers. |
   | Remaining work | Concrete blockers only, with owners or required approvals. |

   Never mark a feature VERIFIED just because its guide says how to
   implement it. Never mark a Web or Android application complete if it
   only contains screens and mock data.
7. Hands-on wallet test (Orion, 2026-11-10). Two fresh test wallets were
   created with the repository tools in fresh clones at H6: generate.js
   20/20 internal checks; make_wallet.py 10/10 artifact checks; derive.js
   6/6 exact; compare.js exit 0 matching derive.js; recovery decrypt and
   re-derive 9/9 pass; TON cross-checked with the ton library (exact
   address match); npm test 80/80; differential test (bip_utils) pass. The
   one live defect found was the daemon wrong-chain issue, now fixed at H7.
   Not tested: send/sign/broadcast, Web draft UI, Android. Report:
   WALLET-TEST-REPORT.md in the bawa-wallet-test working area. This is
   additional engine evidence for sections 1.2 and 4.1.
8. M-31/M-15 reviewer: DESIGNATED (owner, 2026-11-10 ~14:30 IST) — Astra,
   max reasoning. It runs AFTER the acceptance coordinator finishes, so it
   reviews the final state. The Opus independent audit was dropped by
   owner decision 2026-11-10 ~14:28 IST ("Stop it — Astra only"); the
   Opus audit lane had already ended BLOCKED (8 consecutive HTTP 503
   "no available channel under current group probation", 2026-11-10).
   MODEL RESTRICTION (owner, 2026-11-10): Astra is the only authorised
   AI model for this project, for every remaining phase. Opus is out
   completely — no Opus re-run, no other Claude model, no fallback, and
   no Opus mention as a future reviewer. The Phase 9 audit is an Astra
   second-pass review, labelled as such — never presented as an
   independent audit. The M-31/M-15 review is likewise a second-pass
   review by the same model that authored the implementation, and its
   report must state that plainly — not a fully independent audit.
   Independent verification in this programme means Orion's first-hand
   verification (probes, test runs, fresh-clone read-backs), not a
   second model. (Front-matter item 8 updated 2026-11-10 in the
   acceptance programme; section 6.1/6.5 now carry the same record.)


## 1. Baseline and verified state

This baseline records the supplied first-hand inspection of `muse-vm` on **10 November 2026**. It is not a release-readiness statement. Evidence labels apply only to their stated scope: **IMPLEMENTED_AND_VERIFIED** does not extend a repository observation or local test result into proof of network operation. **OPEN** denotes unresolved work; **UNVERIFIED** identifies claims not established by the supplied evidence.

## 1.1 Frozen baseline

**IMPLEMENTED_AND_VERIFIED — repository state**

- **Repository:** `Pr3eve6ti2o/bawa`
- **Branch:** `main`
- **HEAD, H6:** `aab79dab2ffa15aac9f749e0a986e6eb69cc0f90`
- **Commit message:** `docs: resolve M-38, record M-39/M-35 decisions, refresh §5 proof SHA to d2f0960c`
- **Working tree:** clean.
- **Change from H5, `d2f0960c`:** only `docs/mainnet/MAINNET-GUIDE.md` changed, with **20 insertions and 20 deletions**. H6 is therefore a documentation-only successor to H5.

The tree contains **50 files**, including **27 under `docs/`**. Recorded top-level items include `CHANGELOG.md`, `CONTRIBUTING.md`, `IMPLEMENTATION.md`, `LICENSE` (MIT), `README.md`, `SECURITY.md`, `docs/`, `package.json`, `requirements.txt`, `test/` and `tools/`. Earlier figures of approximately 72–74 counted Git tree entries, including directories, rather than files.

The root `package.json` declares **Node `>=22 <23`** and **Python `>=3.11`**. Its `check` and `test` scripts delegate to `tools/hdwallet-gen`. There is **no root `package-lock.json`**; the only lockfile is `tools/hdwallet-gen/package-lock.json`.

**IMPLEMENTED_AND_VERIFIED — CI definition, not a successful CI run**

The sole workflow is `.github/workflows/ci.yml`. It specifies Node 22, `npm install` in `tools/hdwallet-gen`, `npm run check` and `npm test`; then Python 3.13, installation from `requirements.txt`, `python test/differential_test.py` and `py_compile`. A successful execution of that workflow is **UNVERIFIED** in the supplied evidence.

**IMPLEMENTED_AND_VERIFIED — observed local validation**

The first-hand H6 commands used **Node v24.22.2**, which is **outside the declared Node range**, and **Python 3.12.3**. The Python differential test ran in a virtual environment containing `cryptography==50.0.2` and `bip-utils==2.12.2`; these are observed environment versions, not an assertion about requirement pins.

| Command | Recorded result | Numerical exit code |
|---|---|---|
| `npm ci` | Installed 14 packages | **UNVERIFIED** — not explicitly supplied |
| `npm run check` | Completed | **0** |
| `npm test` | `80 checks ok`, `0 FAIL`, `SMOKE TESTS PASSED` | **UNVERIFIED** — not explicitly supplied |
| `python test/differential_test.py` | `PASS` | **0** |

No numerical exit code is inferred from output alone. These results establish the recorded local outcomes, but do not establish a passing run under CI’s Node 22/Python 3.13 combination.

## 1.2 What exists and works

**IMPLEMENTED_AND_VERIFIED — repository assets and bounded test evidence**

The repository tool pins **`@trustwallet/wallet-core` 4.9.3**. Its `npm ci` installation and repository tool commands exercise **4.9.3**, not the older 4.9.2 reference engine named in the guides.

The inspected tool inventory comprises:

- `tools/make_wallet.py` and `tools/decrypt_seed.py`;
- `tools/hdwallet-gen/generate.js`;
- `tools/hdwallet-gen/derive.js` and `derive_daemon.js`;
- `tools/hdwallet-gen/compare.js`;
- `tools/hdwallet-gen/extended-key.js`, introduced in H5.

The H5 **OI-096** fix made `compare.js` and `derive.js` reject **private keys, bad-checksum keys and wrong-chain keys before WASM**. This statement is specific to those two entry points; it must not be generalised to the daemon.

The verified test evidence is the reported JavaScript check/test output and Python differential-test pass above. Broader coverage, application compatibility and network behaviour are **UNVERIFIED** unless separately evidenced.

The documentation set includes **16 numbered guides, `docs/01–16`**, plus FAQ, FURTHER-READING, GLOSSARY, RECOVERY, REFERENCES, SECURITY, TESTING and `docs/README.md`. The additional implementation guides are:

- **Doc 2:** `docs/web-wallet/WEB-GUIDE.md`;
- **Doc 3:** `docs/android-wallet/ANDROID-GUIDE.md`;
- **Doc 4:** `docs/mainnet/MAINNET-GUIDE.md`, containing **22 sections** and a **46-row §21 register**.

Their presence and inspected wording are verified. Procedures without corresponding execution evidence remain **DOCUMENTED_NOT_TESTED**.

## 1.3 Known gaps and contradictions

### Engine version and input-validation boundaries

**OPEN — version alignment.** Guides 11 and 09 use **Wallet Core 4.9.2** as their reference engine: tag `17e3cd4`, published **6 November 2026**. They record signing demonstration **D21** and re-confirmation **D31** on 4.9.2. Guide 11 explicitly documents that `npm ci` instead installs 4.8.4.

These are distinct evidence bases. The 4.9.2 demonstration records must not be presented as results from the H6 repository tools, nor as network-spend evidence.

**OPEN — daemon validation defects.** `derive_daemon.js` still shares all three reported defects concerning private, bad-checksum and wrong-chain keys. They are **reported, not fixed at this baseline**. A separate fix lane is running in parallel; its completion is **UNVERIFIED** and must not be assumed to be part of H6.

### Lockfile and automation limits

The tool lockfile exists, but a root lockfile does not. CI uses `npm install`, rather than the locally reported `npm ci`. These facts must remain explicit in reproducibility claims.

The workflow contains **no registry validation**, **no Android/Gradle job**, and **no lint beyond `node --check`**. The local Node 24 pass does not close the evidence gap for the declared Node 22 range. Additional pipeline coverage or supported-runtime results are **UNVERIFIED**.

### Local drafts are not repository deliverables

**DOCUMENTED_NOT_TESTED — as integrated repository applications.** Neither local validation draft is in the repository.

- **`app-web`:** Wallet Core 4.8.4 and esbuild; **14 screens claimed** and **31/31 mocked tests claimed**. These counts are **UNVERIFIED claims**, not additional verified H6 checks. Its vault uses **PBKDF2-600k + AES-256-GCM**, with its own AAD, `bawa-web-vault-v1`, and is **not repository-compatible**.
- **`app-android`:** `gradlew` and `build.gradle.kts` are present; **55/55 pure-module tests are claimed**, hence **UNVERIFIED** as test results. **No AAR or APK has ever been produced.** Trust Wallet Core ships no downloadable Android AAR. Build-file presence must not be represented as an application-build result.

### Operations and security process

**OPEN — operational verification.** Send/sign/broadcast has **never been exercised on any network**. There has been **no live testnet spend and no mainnet use**. Local checks, differential testing and documented demonstrations do not remove this boundary.

**OPEN — maintainer security action.** Root `SECURITY.md` contains neither a vulnerability-disclosure procedure nor a private reporting contact. This is separate from the independent-review dependency recorded below.

## 1.4 Register state

**IMPLEMENTED_AND_VERIFIED — register wording only.** The following reproduces Doc 4 §21 at H6. Its **RESOLVED** markers record register decisions; they do not establish execution of network procedures.

| Resolved item | Recorded H6 position |
|---|---|
| **M-13** | TON: **1 masterchain seqno** |
| **M-24** | TON: **generation-only** |
| **M-33** | Pin is repair commit `e3b65fb832db287fdc8d54794980dd0b3456cc12` |
| **M-34** | F4 worktree fix |
| **M-38** | BTC **6**; ETH **`finalized`**; TRX **19 SR confirmed** |
| **Carried-forward row 10** | Resolution retained |

For **M-38**, ETH **“12”** remains in the document as an **unsourced extra minimum**; its sourcing is **UNVERIFIED**. The resolved wording must not be simplified into a claim that this extra minimum has been independently established. The confirmation procedures remain **DOCUMENTED_NOT_TESTED** as network operations.

The important open positions are:

- **M-35 — OPEN / PROPOSED.** Rehearsal amounts were approved **FOR REVIEW ONLY on 10 November 2026**: **BTC 0.0002**, **ETH 0.001**, **TRX 1**, and **TON 0.05, receive-only**. **Execution is NOT authorised.** The **OI-097 QR-scan step has not been drafted** and remains OPEN. Review-only approval is not permission to transfer funds.
- **M-39 — OPEN / EXTERNALLY_DEPENDENT.** The findings were accepted: **no GUI wallet is confirmed for TON withdrawal**. `@ton/ton` is the **documented expert-assisted route**, not a verified GUI withdrawal capability. The next step is a **PROPOSED GUI watch-only test on a desktop machine**. Its outcome is UNVERIFIED; a watch-only test must not be described as withdrawal execution.
- **M-31/M-15 — OPEN / EXTERNALLY_DEPENDENT.** The independent security reviewer has **not been designated**. No reviewer identity, review result or completion date is established.

Approximately 40 other rows remain OPEN in the supplied register summary. The register is therefore not a closed mainnet checklist.

## 1.5 Stale-claim corrections

The following corrections govern this section. Updating stale plan and README descriptions is **PROPOSED / OPEN**; recording a correction here does not assert that those source artefacts have already been edited.

1. **Master plan §2:** its baseline names `56396a20`, which is **four commits stale**. This section’s frozen baseline is H6, `aab79dab2ffa15aac9f749e0a986e6eb69cc0f90`.
2. **Master plan §8:** its listing of **M-13, M-24 and M-33 as open is stale**. All three are **resolved and pushed**. They must not be carried forward as outstanding decisions.
3. **README verification table:** it still names repair commit **`e3b65fb8`** and **8 November 2026**, rather than the H6 state. This is stale as a current-head verification record. It is distinct from **M-33’s resolved choice of the repair commit as its pin**.
4. **Doc 4 §5 proof SHA:** H6 now names **`d2f0960c` (H5)** while `main` is at H6. This is the known **one-commit proof lag**, not a matching-HEAD proof reference. The §5 step-1 **`MAIN_HEAD` capture is the reader’s baseline check**; no reader-specific capture is assumed here.
5. **Counts and UI/UX review scope:** the earlier approximately **72–74** figures were tree-entry counts including directories, not file counts. The UI/UX catalogue was reviewed against **`b3814e0b`**, with **74 tree entries**. That is not an H6 review; equivalence to the current baseline is **UNVERIFIED**.

**Baseline confidence.** Proven are the clean H6 repository state, inspected manifests and documentation, the 4.8.4 tool pin, and the recorded local check/test outcomes in the stated environment. Supported-Node execution, repository-tool execution on 4.9.2, application deliverables and end-to-end network operation are not proven. Daemon defects and independent review remain OPEN. No live testnet spend or mainnet use has occurred, and M-35 does not authorise rehearsal execution.
## 2. Architecture, dependency map and repository structure

Baseline: HEAD `aab79dab`, H6, inspected **10 November 2026**. Filesystem labels (`exists`, `to-create`) are separate from delivery status. The target architecture is **PROPOSED**; **IMPLEMENTED_AND_VERIFIED** applies only to evidenced functionality. **DOCUMENTED_NOT_TESTED** distinguishes guide or draft evidence from product verification. Unresolved decisions are **OPEN**; unsupported capability claims are **UNVERIFIED**.

### 2.1 Target architecture

The AI Wallet Builder operates at build time; it is not another runtime wallet engine. The following diagram describes the **PROPOSED** separation, not applications already present in the repository.

```text
BUILD TIME
AI Wallet Builder
    → profiles / registries / canonical guides
    → template selection and inspection
    → application scaffolding, implementation, checks and report

RUNTIME TARGET
Wallet UI ↔ Application orchestration ↔ Wallet engine
                         ↕
             public data / signed payloads only
                         ↕
                   Chain adapters ↔ providers [selection OPEN]
```

| Layer | Proposed responsibilities | Hard boundary |
|---|---|---|
| AI Wallet Builder | Route requests, select profiles and sources, run checks and report evidence. | Must not implement cryptography in prompt text. |
| Wallet engine | Generation/import, derivation, key-custody interfaces, recovery and signing primitives, exposed through narrow typed interfaces. | Must not become a blockchain indexer or payment service. These responsibilities do not imply that every capability exists today. |
| Chain adapters | Endpoint/provider configuration, network identity, public balances, fees, broadcast of signed payloads and confirmation tracking. | Must never receive secrets or secret-bearing objects; see §2.5. |
| Wallet UI | Layout, navigation, accessibility, presentation and display of typed states. | Must not redefine derivation, key storage, transaction authority or signing policy. |
| Application orchestration | Coordinate sessions, adapter requests, transaction intent, approval and status. | No screen calls providers or constructs unsigned transactions outside the defined contract. |

The runtime contracts, transaction-construction ownership and concrete provider selections remain **OPEN**. The ownership table assigns future responsibilities; §2.3 defines the much narrower implemented baseline. In particular, assigning signing primitives to the engine does not imply that signing code exists.

### 2.2 Repository structure

The tree uses `bawa/` as the proposed root label, not evidence of a checkout rename. Every directory is marked with its current filesystem state; all additions are **PROPOSED**.

```text
bawa/                                             [exists: current repository root]
├── README.md                                     [exists]
├── AGENTS.md                                     [to-create]
├── WALLET_BUILDER.md                              [to-create]
├── docs/                                         [exists: 27 files; canonical]
│   └── AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md    [to-create]
├── tools/                                        [exists]
│   ├── make_wallet.py                            [exists]
│   ├── decrypt_seed.py                           [exists]
│   └── hdwallet-gen/                              [exists]
├── test/                                         [exists]
├── .github/                                      [exists]
│   └── workflows/                                [exists]
│       └── ci.yml                                [exists]
├── ai/                                           [to-create]
│   ├── profiles/                                 [to-create]
│   ├── prompts/                                  [to-create]
│   ├── workflows/                                [to-create]
│   └── agent-adapters/                            [to-create]
├── registry/                                     [to-create]
│   ├── engines.yaml                              [to-create]
│   ├── templates.yaml                            [to-create]
│   ├── chains.yaml                               [to-create]
│   └── schemas/                                  [to-create]
├── templates/                                    [to-create]
│   ├── web/                                      [to-create]
│   ├── android/                                  [to-create]
│   └── shared/                                   [to-create]
├── apps/                                         [to-create]
│   ├── web/                                      [to-create]
│   └── android/                                  [to-create]
├── packages/                                     [to-create]
│   ├── wallet-engine/                            [to-create]
│   ├── chain-adapters/                           [to-create]
│   └── shared-contracts/                         [to-create]
├── chains/                                       [to-create]
│   ├── bitcoin/                                  [to-create]
│   ├── ethereum/                                 [to-create]
│   ├── tron/                                     [to-create]
│   └── ton/                                      [to-create]
├── research/                                     [to-create; scope OPEN]
└── scripts/                                      [to-create]
```

**PROPOSED migration: additive first, without mechanical moves.** Keep the existing guides, tools, tests and CI at their current paths. The five JS tools—`generate.js`, `derive.js`, `derive_daemon.js`, `compare.js` and `extended-key.js`—remain under `tools/hdwallet-gen/`.

Existing root files also stay: `package.json`, `requirements.txt`, `CHANGELOG.md`, `CONTRIBUTING.md`, `IMPLEMENTATION.md`, `SECURITY.md` and the MIT `LICENSE`.

`packages/wallet-engine/` names a future architectural boundary, not an instruction to relocate working code. Extraction, wrapping, imports and compatibility arrangements are **OPEN**. Likewise, adopting an external draft into `templates/` or `apps/` requires inspection rather than a directory copy presented as completed integration.

The existing documentation remains canonical wherever it already covers a subject. Consolidation is justified only where duplication or contradiction makes execution unreliable. Planned `scripts/` purposes are `validate-registries`, `verify-template`, `build` and `test`; filenames, implementations and invocation details remain **OPEN**.

### 2.3 Dependency map

The map below distinguishes existing dependency evidence from proposed architectural relationships. It is **not** an installed package-import graph; future package wiring is **OPEN**.

| Consumer → source | Status and dependency boundary |
|---|---|
| Existing engine tooling → Trust Wallet Core | **IMPLEMENTED_AND_VERIFIED**: version **4.9.3** is pinned in `tools/hdwallet-gen/`. |
| Proposed wallet-engine package → inspected tooling | **PROPOSED** reuse boundary. The extraction or integration mechanism is **OPEN**. |
| Implementation decisions → canonical guides | Guide prose supplies requirements; product behaviour remains **DOCUMENTED_NOT_TESTED** unless separately evidenced. |
| Builder selection → registries | **PROPOSED** engine, template and chain selection catalogues. Entries, schema fields and compatibility validation are **OPEN**. |
| Scaffolding → templates; applications → runtime contracts | **PROPOSED**. Exact template/package dependencies, including shared-code arrangements, are **OPEN**. |
| Template/application adoption → external drafts | Drafts are **DOCUMENTED_NOT_TESTED** as products and are not in the repository. Adoption is **OPEN**, not an existing dependency. |

**Current declarations.** The repository declares Node `>=22 <23` and Python `>=3.11`; `requirements.txt` pins `cryptography==50.0.2` and `bip-utils==2.12.2`. These facts do not establish future web or Android runtime bindings.

**Verified engine scope.** Generation uses 24-word BIP-39 with an empty passphrase. Watch-only derivation is verified for:

- BTC: `m/84'/0'/0'/0/i`;
- ETH: `m/44'/60'/0'/0/i`;
- TRX: `m/44'/195'/0'/0/i`.

TON is generation-only at `m/44'/607'/0'`, producing a single address. Its published fixture uses wallet V4 R2 and wallet ID `698983191`. Published fixtures are differential-tested. There is **no signing, broadcast or transaction-construction code** in the repository.

**Guide dependencies.** Doc 1 comprises `README.md` and the 16 numbered guides, `docs/01–16`; Doc 2 covers Web, Doc 3 Android and Doc 4 mainnet. The canonical **14-screen wallet contract** is in `docs/14 §5.1`; templates and applications must not replace it with draft-specific behaviour. Doc 4’s completed done-gate concerns prose, with a 46-row register in §21—not tested mainnet product readiness.

**Draft evidence must remain separate:**

- `app-web`: wallet-core 4.8.4, 14 screens and **31/31 mocked tests**. Its vault uses PBKDF2-600k plus AES-256-GCM with AAD `bawa-web-vault-v1`; it is **not repository-compatible**. Vault reconciliation is **OPEN**.
- `app-android`: `gradlew` is present and **55/55 pure-module tests** are recorded, but no AAR or APK has ever been produced. Platform integration and installable-product claims remain **UNVERIFIED**.

The repository’s own evidence includes `test/smoke.test.js` with 80 checks and `test/differential_test.py`. Neither those files nor the existing CI configuration prove web, Android or transaction functionality.

### 2.4 Entry points and routing

**`AGENTS.md` — PROPOSED, to-create.** This is the first instruction entry point for AI agents. It must direct agents to canonical sources, preserve execution constraints and route them through `WALLET_BUILDER.md`. It must not imply that target directories or capabilities already exist.

**`WALLET_BUILDER.md` — PROPOSED, to-create.** This is the single routing guide: identify the request, select the profile and authoritative sources, then follow the build workflow. It should route to existing guides rather than rewrite their requirements.

All seven profile records are **PROPOSED**. Each must state **platform, engine and exact version, UI route, security boundaries and verification requirements**. Profile file formats and unsupported field values are **OPEN**. The verified tooling pin must not be treated as verification of an Android binding or complete application.

| Profile ID | Thin prompt entry point |
|---|---|
| `hd-wallet-cli` | `ai/prompts/create-hd-wallet.md` |
| `bitcoin-wallet` | `ai/prompts/create-bitcoin-wallet.md` |
| `evm-wallet` | `ai/prompts/create-evm-wallet.md` |
| `multichain-wallet` — BTC/ETH/TRX/TON | `ai/prompts/create-multichain-wallet.md` |
| `web-wallet` | `ai/prompts/create-web-wallet.md` |
| `android-wallet` | `ai/prompts/create-android-wallet.md` |
| `watch-only-wallet` | `ai/prompts/create-watch-only-wallet.md` |

Each prompt is only a pointer to `AGENTS.md`, `WALLET_BUILDER.md` and its profile. Security policy must not be duplicated across seven prompts.

The **PROPOSED 12-step workflow** is:

```text
1 parse → 2 plan → 3 profile → 4 engine → 5 chains → 6 template
→ 7 inspect → 8 scaffold → 9 implement → 10 verify
→ 11 audit claims → 12 report
```

Inspection precedes scaffolding. Verification and claim auditing must distinguish inspected code, canonical prose, mocked tests and missing platform artefacts; the report must preserve those distinctions.

The requested feature branch is **PROPOSED**. Branch creation and any push are **EXTERNALLY_DEPENDENT** on the maintainer’s word. Neither action is authorised or assumed by this plan.

### 2.5 What the architecture deliberately does NOT do

- **No second engine in prose.** Prompts route requests and checks; they do not implement cryptography or redefine the engine’s derivation and security policy.
- **No secrets in adapters.** Adapters must never receive mnemonics, seeds, private keys, private extended keys, vault keys or secret-bearing objects. Orchestration must not become a route around that boundary.
- **No UI-owned transaction authority.** Screens display typed states and participate through the defined contract; they do not independently call providers, redefine signing policy or construct unsigned transactions outside that contract.
- **No mainnet by default.** Require testnet defaults everywhere; mainnet is out of scope by default despite the completed guide prose. Testnet network/path handling is **OPEN**. The fixed account-0, receiving-branch-0 derivation policy cannot be silently changed; any change requires a recorded maintainer approval.
- **No capability inflation.** Profile names, screen counts and test totals do not certify products. ETH derivation does not establish generic EVM-wallet operation; TON remains generation-only. Signing, broadcast and transaction construction must not be reported as implemented.
## 3. Phased implementation sequence

Phase 0 (reconnaissance) and Phase 1 (this plan) remain in progress. **IMPLEMENTED_AND_VERIFIED — baseline only:** inspection at HEAD `aab79dab`, H6, 2026-11-10 found a clean tree and 50 files. `npm ci` installed 14 packages; `npm run check` exited 0; `npm test` reported 80 ok; the differential test reported PASS, exit 0. Environment: Node v24.22.2, Python 3.12.3, cryptography 50.0.2 and bip-utils 2.12.2.

The repository contains 27 documentation files, `tools/` with wallet-core 4.9.3, smoke/differential tests and one CI workflow using Node 22/Python 3.13. CI has no registry validation or Android job. `AGENTS.md`, `WALLET_BUILDER.md`, `ai/`, `registry/`, `templates/`, `apps/`, `packages/`, `chains/`, `research/`, general `scripts/` and a root lockfile are absent.

**DOCUMENTED_NOT_TESTED:** this implementation sequence. All future work below is **PROPOSED**, and future acceptance results are **UNVERIFIED**. Apart from the two specified entry filenames, paths below are **OPEN proposed allocations** for the mandated deliverables—not existing files, approved layouts or additional scope. Foundation-dependent layouts must be settled before implementation. Maintainer and external gates are **EXTERNALLY_DEPENDENT**.

| Phase | Status | Principal sequencing constraint |
|---|---|---|
| 2 — Entry and routing | PROPOSED | After plan approval; may overlap Phase 3 |
| 3 — Profiles and registries | PROPOSED | Validated references required before starters |
| 4 — Engine and reproducibility | PROPOSED | Engine decision precedes binding adoption |
| 5 — UI research and adoption | PROPOSED | Maintainer selects both foundations |
| 6 — Web starter | PROPOSED | Requires registries, engine and Web foundation |
| 7 — Android starter | PROPOSED | Requires registries, engine and Android foundation |
| 8 — One-prompt workflow | PROPOSED | End-to-end testing requires a built starter |
| 9 — Security and release gates | PROPOSED | Evidence must support the declared release scope |
| 10 — Handoff and maintenance | PROPOSED | Documentation must reflect gate outcomes |

### Phase 2 — AI entry and routing layer

- **Objective:** establish the AI-facing entry contract, request classification, prompt entry points and tool-capability detection.
- **Files:** `AGENTS.md`, `WALLET_BUILDER.md`; OPEN allocations: `ai/request-routing.md`, `ai/prompts/build-wallet.md` and `ai/detect-capabilities.mjs`.
- **Dependencies:** maintainer approval of Phase 1. Phase 3 may proceed alongside this phase.
- **Exit gate:** entry instructions and detection logic exist; routing distinguishes available capabilities from unresolved requests. No entry point promises a profile before that profile passes Phase 3 validation. Phase 3 is the permitted parallel exception to a sequential exit gate; dependent integration waits for both phases.
- **Not included:** building starters, asserting unsupported profiles, or implementing unresolved engine or foundation choices.

### Phase 3 — Profiles, capability matrix and registries

- **Objective:** establish schemas, wallet profiles, a per-chain/per-network/per-operation capability matrix, and engine/UI registries.
- **Files:** OPEN allocations: `registry/schemas/profile.schema.json`, `registry/schemas/registry.schema.json`, `registry/profiles.json`, `registry/capabilities.json`, `registry/engines.json`, `registry/ui.json`, `scripts/validate-registry.mjs` and `tests/registry.test.mjs`.
- **Dependencies:** approved plan and coordination with Phase 2’s routing contract. Engine and foundation choices not yet settled remain OPEN rather than invented registry values.
- **Exit gate:** schema validation and registry tests pass; every referenced profile validates; unresolved capability cells are explicitly OPEN. A structurally valid entry is not runtime proof: **DOCUMENTED_NOT_TESTED** capabilities must not be relabelled **IMPLEMENTED_AND_VERIFIED**. These contracts must exist before Phases 6–7 reference them.
- **Not included:** starter applications, engine upgrades, UI selection or unverified chain-support claims.

### Phase 4 — Engine and reproducibility

- **Objective:** reconcile the engine version, establish reproducible tooling and expand negative-input coverage while preserving derivation policy.
- **Files:** OPEN allocations: `docs/engine-reproducibility.md`, `tools/package.json` and `tests/negative-inputs.test.mjs`. Lockfile paths remain OPEN until the lockfile strategy is settled; no root lockfile is assumed.
- **Dependencies:** Phase 3 contracts; the wallet-core decision is maintainer-owned.
- **Exit gate:** resolve 4.8.4 versus 4.9.2 explicitly against Doc 4 M-21: 4.9.1 is the upgrade candidate, 4.9.2 is a prerelease, and neither carries an Android AAR. The Android binding question must be settled before Phase 5 pins a binding or starters integrate it. Node, Python, npm, Gradle and JDK pins, plus lockfile strategy, must be recorded. Negative tests must cover private-key, malformed, wrong-chain and wrong-network inputs; derivation policy must remain preserved.
- **Not included:** derivation, mnemonic-format, vault-format or signing-policy changes without separate maintainer approval. Do not touch `derive_daemon.js`: the parallel fix lane owns it, it shares all three OI-096 defects, and its fix is not assumed complete.

### Phase 5 — UI template research and adoption

- **Objective:** revisit every candidate, inspect its exact tree and licence, pin immutable SHAs, and select one Web and one Android foundation.
- **Files:** OPEN allocations: `research/ui-candidates.md`, `templates/web/UPSTREAM.md`, `templates/android/UPSTREAM.md` and updates to `registry/ui.json`. Candidate identities, SHAs and local-draft paths remain OPEN.
- **Dependencies:** Phase 3’s UI registry and Phase 4’s settled engine decision before adoption pins an engine binding.
- **Exit gate:** exact-tree and licence inspection is recorded for every candidate; the maintainer approves both foundation choices and adapt-versus-replace for each local draft. Reciprocal-licence obligations require the maintainer’s word. AGPL sources remain research-only.
- **Not included:** importing engine, signing or secret-storage code through UI reuse. Research findings alone do not authorise adoption, licence acceptance or a runnable starter claim.

### Phase 6 — Build the Web starter

- **Objective:** produce a real committed Web application with typed contracts and an explicit engine boundary.
- **Files:** OPEN allocations: `apps/web/package.json`, `apps/web/src/main.ts`, `apps/web/src/engine-boundary.ts` and `packages/contracts/src/index.ts`. Entry filenames and supporting assets remain subject to the approved foundation.
- **Dependencies:** validated Phase 3 references, Phase 4’s engine and reproducibility decisions, and the maintainer-approved Web foundation from Phase 5.
- **Exit gate:** the committed application builds using the settled inputs; contract and engine-boundary checks demonstrate the intended separation. Secrets must not reach telemetry or providers. Mock features must be labelled, not presented as implemented capabilities. A successful starter build supplies Phase 8’s minimum end-to-end prerequisite.
- **Not included:** Android delivery, mainnet activation, or interpreting mocked behaviour as verified wallet functionality.

### Phase 7 — Build the Android starter

- **Objective:** produce the Compose-based Android starter with a Gradle wrapper, JDK/SDK pins and the same engine policy.
- **Files:** OPEN allocations include `apps/android/gradlew`, `apps/android/gradle/wrapper/gradle-wrapper.properties`, `apps/android/app/build.gradle.kts`, `apps/android/app/src/main/kotlin/MainActivity.kt` and `docs/android-evidence.md`. The complete wrapper assets and foundation-specific layout must be settled before implementation.
- **Dependencies:** Phase 3 registries, Phase 4’s resolved engine/Android binding decision and the approved Android foundation from Phase 5.
- **Exit gate:** wrapper-based building works with recorded pins; engine-policy parity is checked; emulator/device evidence is recorded. Execution route and device availability remain OPEN until established. Android cannot be included in Phase 8 success claims without its own evidence.
- **Not included:** assuming an Android AAR exists, changing signing policy, or substituting emulator evidence for the separate M-39 desktop GUI route.

### Phase 8 — Complete the one-prompt build workflow

- **Objective:** connect request parsing through routing, registries, starter generation, setup, build and test to the final report.
- **Files:** OPEN allocations: `scripts/build-wallet.mjs`, `scripts/setup.mjs`, `scripts/build.mjs`, `scripts/test.mjs`, `docs/sample-requests.md` and `tests/clean-checkout.test.mjs`.
- **Dependencies:** the entry, registry, engine and adoption contracts must be settled. End-to-end execution can only begin after at least one Phase 6–7 starter builds.
- **Exit gate:** clean-checkout tests exercise at least two materially different wallet requests through the complete workflow. Sample identities remain OPEN until supported by validated profiles. Reports must distinguish verified outcomes, mocks and unresolved limitations. Success on one platform must not imply success on another.
- **Not included:** unsupported profile promises, mainnet activation, independent security approval or execution of the separate rehearsal programme.

### Phase 9 — Security, quality and release gates

- **Objective:** run full tests; dependency, secret, licence and static scans; per-chain fixture validation; failure-mode and stale-data tests; and accessibility review.
- **Files:** OPEN allocations: `scripts/quality-gates.mjs`, `tests/chain-fixtures.test.mjs`, `tests/failure-modes.test.mjs`, `tests/stale-data.test.mjs`, `docs/accessibility-review.md` and `docs/security-release-gates.md`. The existing CI workflow’s exact filename is OPEN; extending it must not imply registry or Android coverage already exists.
- **Dependencies:** Phase 6–8 evidence for the platforms and capabilities claimed.
- **Exit gate:** internal checks must pass for the declared handoff scope, with results recorded rather than inferred from the baseline. Real-value use requires independent external review; the maintainer must designate the M-31/M-15 reviewer, currently OPEN. Mainnet activation requires separate approval.
  
  M-35 rehearsal execution also requires separate approval: amounts are approved for review only, and OI-097’s QR-scan step is undrafted. M-39 remains OPEN; its GUI watch-only route needs the maintainer’s word and a desktop machine. Uncompleted external gates remain release/use blockers in any handoff.
- **Not included:** reopening the otherwise-complete gates programme or treating its evidence as starter verification. OI-096 was pushed at `d2f0960c`; M-38 is resolved. Neither fact closes M-39, authorises M-35 execution or completes the daemon-fix lane.

### Phase 10 — Documentation, handoff and maintenance

- **Objective:** rewrite the README around one-prompt use, provide a documentation map, define registry maintenance and complete handoff.
- **Files:** OPEN allocations: `README.md`, `docs/index.md`, `docs/registry-maintenance.md` and `docs/handoff.md`.
- **Dependencies:** Phase 9 outcomes and an explicit account of outstanding external restrictions.
- **Exit gate:** instructions match the verified workflow and available starters; the documentation map resolves to delivered material; registry maintenance describes how entries and evidence are kept current. Maintenance ownership and cadence remain OPEN until agreed. Handoff distinguishes verified coverage, untested documentation and external blockers.
- **Not included:** retrospective claims that planned checks passed, invented maintenance dates, or release authorisation through documentation alone.

**Sequencing diagram**

```text
0/1 now -> maintainer approval -> (2 || 3) -> 4 -> 5 -> 6 -> 7
6 or 7 builds -> 8 end-to-end -> 9 -> 10
```

**Stop conditions:** the plan phase stops here and waits for maintainer approval before Phase 2; the parallel Phase 3 route is not authority to bypass that stop. Creating a feature branch and any push each require explicit maintainer approval. OPEN path allocations and decisions must be resolved before their dependent implementation begins. No phase may start implementation work on a decision that is still open.
## 4. Template and engine research findings

Evidence baseline: fresh inspection at HEAD `aab79dab`, H6, **2026-11-10**. Upstream descriptions below are **DOCUMENTED_NOT_TESTED**: their commits are **REVIEW PINs dated 2026-11-10**, reviewed then but **not re-verified in this phase**. Re-verification belongs to Phase 5. All upstream sources have availability `fetch_required` (**EXTERNALLY_DEPENDENT**); none is vendored.

### 4.1 Engine

**IMPLEMENTED_AND_VERIFIED:** `tools/hdwallet-gen` pins Trust Wallet Core **4.9.3**. `npm ci` installs 4.9.3; the tools smoke run reported **217 ok** (E02 re-verification, 2026-11-13). The independent Python verification layer is **bip-utils 2.12.2 + cryptography 50.0.2**, with differential test **PASS**.

**DOCUMENTED_NOT_TESTED — adoption of the guide baseline:** `docs/11` and `docs/09` treat **4.9.2**, tag `17e3cd4` dated **2026-11-06**, as the reference engine. They record signing demo **D21** and re-confirmation **D31** on 4.9.2. These must not be presented as browser execution evidence: **in-browser send/sign/broadcast was not exercised**.

`docs/11` explicitly documents the **4.8.4/4.9.2 mismatch**. Separately, Doc 4 M-21 identifies **4.9.1** as the upgrade candidate and **4.9.2** as a prerelease; neither carries an Android AAR.

**OPEN version decision; PROPOSED resolution:** Phase 5 must reconcile these records, select and document the engine version, align dependency pins and guides, and repeat installation, engine and differential checks against that selection. Browser execution and Android build/packaging require explicit evidence before either is claimed. A recorded version decision supported by reproducible target evidence settles the mismatch—not the higher version number alone. E02 resolved the version decision (owner-approved 2026-11-13): 4.9.3 is the verified tooling baseline, not proof of complete wallet readiness.

### 4.2 Web foundations

Recommendations are **PROPOSED**, conditional on Phase 5 acceptance.

- **WEB-01 — imToken Wallet UI Starter Kit: recommended Web foundation.**  
  Source: `consenlabs/token-ui`. **REVIEW PIN (2026-11-10):** `6380d5d4dfeebf89704c0527e3c552be6ee2d231`. **Licence:** MIT. **Stack:** React + Vite + pnpm workspace.  
  **Provides:** wallet-style dashboard, reusable components, design tokens, light/dark themes, `DESIGN.md`, `AGENTS.md` and mock wallet data.  
  **Does not provide:** engine, derivation, vault, custody, signing, RPC or indexing. No screenshot assets were in its inspected tree. Recommend it as a UI foundation, not as a wallet implementation.

- **WEB-02 — shadcn/ui: component-foundation alternative.**  
  Source: `shadcn-ui/ui`. **REVIEW PIN (2026-11-10):** `8ab27715521cbd4f87ae6886cd989cbb678f6de7`. **Licence:** MIT.  
  **Provides:** a component library only. **Does not provide:** a wallet application. Recommend it where component-led construction is preferable; wallet-screen coverage and build compatibility remain **OPEN**.

- **WEB-03 — Custom React UI, Bawa specification: no-fetch fallback.**  
  **Upstream/pin:** none. **Licence for resulting code:** **OPEN**.  
  **Provides:** a specification-led route built from `docs/13` + `docs/14`. **Does not provide:** an upstream application to fetch. Recommend this route when no external source should be fetched; implemented capability remains **UNVERIFIED** until built and tested.

### 4.3 Android foundations

Recommendations are **PROPOSED**. “Provides” describes the reviewed foundation; exclusion boundaries do not imply that unwanted behaviour is absent from upstream code.

- **AND-01 — Tether WDK Starter Kotlin: recommended Android foundation, UI LAYER ONLY.**  
  Source: `tetherto/wdk-starter-kotlin`. **REVIEW PIN (2026-11-10):** `a4fa21729ba621c095d8638bc8c50de541008214`. **Licence:** Apache-2.0. **Stack:** Kotlin + Jetpack Compose + Material 3.  
  **Provides:** welcome/create/import/home/send/receive/sign screens, components and a dark theme. No screenshot files were in its inspected tree.  
  **Excluded from adoption:** its WDK engine, 12-word phrase policy, vault, derivation and signing. Replace these with Bawa ports and rebuild the **protected 24-word ceremony**. Bawa engine or security compatibility is not established by the UI review.

- **AND-02 — BDK DevKit Wallet app-ui-only: legacy secondary reference.**  
  Source: `thunderbiscuit/devkit-wallet`. **REVIEW PIN (2026-11-10):** `36392bfcea2fab8e772a4e89d5f8e465ab3da439`. **Licence:** Apache-2.0.  
  **Provides:** a legacy app-UI reference. It is **archived**, with last push **2025-02-12**. **Does not establish:** current Gradle/Compose compatibility; that remains **OPEN**. Recommend secondary-reference use only, with compatibility checked before adoption.

- **AND-03 — Android Jetpack Compose Samples: generic foundation.**  
  Source: `android/compose-samples`. **REVIEW PIN (2026-11-10):** `25631e8f544a9a1e3f01e296eaf1b4c28428196c`. **Licence:** Apache-2.0.  
  **Provides:** a generic Compose foundation. **Does not provide:** a wallet template. Recommend consideration as a generic foundation, subject to wallet-screen and state-coverage review.

- **AND-04 — Custom Jetpack Compose UI, Bawa specification: custom route.**  
  **Upstream/pin:** none. **Licence for resulting code:** **OPEN**.  
  **Provides:** a specification-led build from the Android guide + `docs/14`. **Does not provide:** upstream wallet code. Recommend consideration where a custom implementation is selected; completed coverage remains **UNVERIFIED**.

### 4.4 Visual directions

The five catalogue directions are **design references only, never source code**:

| ID | Direction | Reference |
|---|---|---|
| STYLE-01 | Minimal dark | Phantom-inspired |
| STYLE-02 | Portfolio-first | Exodus-inspired |
| STYLE-03 | Security-forward | Rabby-inspired |
| STYLE-04 | **Bawa Balanced** | Original combination; **recommended default** |
| STYLE-05 | Calm token-centric | imToken Design System |

**PROPOSED:** use **STYLE-04 Bawa Balanced** as the default visual direction.

Do not copy logos, trademarks, brand assets or exact screen designs. The **four preview boards are original schematics**, not screenshots of Phantom, Exodus, Rabby or a shipped Bawa app. Five visual directions must not be misreported as five preview boards, nor should these boards be treated as evidence of implemented UI.

### 4.5 The 14-screen contract and required states

**DOCUMENTED_NOT_TESTED — required contract, not template conformance:** `docs/14 §5.1` is the single source of truth. Selecting a template never changes this list:

1. Welcome
2. Create wallet
3. Import wallet
4. Mnemonic backup
5. Portfolio dashboard
6. Asset list
7. Asset detail
8. Receive
9. Send
10. Transaction history
11. Transaction details
12. Network selection
13. Wallet management
14. Security & backup settings

**Review is a state of Send**, not a fifteenth screen. **Lock is an app state**.

Every relevant screen must account for **loading, empty, stale, locked, gate-failed and error** states. **PROPOSED:** assess each candidate against both the canonical screens and these states. A dashboard, an upstream screen list or a draft’s screen count is not sufficient evidence of contract conformance.

### 4.6 Drafts: adapt or replace

The decision remains **OPEN** for each platform; both alternatives below are **PROPOSED**. Recorded draft test results establish only their stated scope, not integrated wallet readiness.

**Web draft — available evidence.** `app-web` uses wallet-core **4.8.4** and esbuild, has **14 screens**, and records **31/31 mocked tests**. Its vault uses **PBKDF2-600k + AES-256-GCM**, with its own AAD, `bawa-web-vault-v1`. It is **not repo-compatible**: the repository has no vault format, and the Web guide’s vault is a separate design.

- **Adapt:** audit and retain useful draft screens and build structure; make an explicit vault-design decision and rework the draft accordingly. Do not promote its vault format into a repository standard by assumption.
- **Replace:** rebuild from the selected WEB-01/02/03 foundation against `docs/14`, using the draft only as reference material where appropriate.

**Android draft — available evidence.** `app-android` contains `gradlew` and `build.gradle.kts`, with **55/55 pure-module tests**. **No AAR or APK was ever produced.** Gradle was blocked by sandbox loopback interception in the draft’s environment. Trust Wallet Core ships **no downloadable Android AAR**.

- **Adapt:** retain audited draft code while establishing and testing an Android engine/build path.
- **Replace:** create a new application shell from the selected AND foundation, preserving AND-01’s UI-only boundary if that source is chosen.

Android engine packaging and build feasibility remain **OPEN / EXTERNALLY_DEPENDENT** under either option. Replacing the draft does not itself resolve them.

### 4.7 What Phase 5 must re-verify

**PROPOSED — pre-vendoring acceptance gate.** Re-verify the exact review pins, licences and obligations, maintenance status, and framework/build compatibility. Select by **platform and screen coverage, not popularity**. Assess layout/component/screen coverage, accessibility, design-system quality, state architecture, test coverage and build reproducibility.

Inspect engine, secret-storage, network and analytics behaviour for exclusion. Never reuse a template’s secret storage, mnemonic handling, derivation, network providers or signing flows because its UI looks good. If no candidate passes, use a clean maintained component foundation and record why.

The following remain **research-only, never selectable menu entries**:

- **Edge React GUI** — BSD-3-Clause; **REVIEW PIN (2026-11-10):** `95f46b8fb856e1e15531ab800c88f55df7411e38`.
- **XChain Platform Wallet** — AGPL-3.0; **REVIEW PIN (2026-11-10):** `3e550d05e913e29e5c3cf24527bf504f1a4fe942`. This is a reciprocal licence: **do not copy without an explicit licensing decision**.
- **OWASP Wallet UX Security Handbook** and **WCAG 2.2**. Unspecified licence or source-pin details remain **OPEN**.

**IMPLEMENTED_AND_VERIFIED — catalogue package validation only:** first-hand checks confirmed that YAML parses, all **15 files** are present with **0 empty**, and Markdown/YAML counts agree on **7 template choices, 5 visual directions and 14 screens**. The package is **not installed in the repository**.

**PROPOSED installation:**

- `docs/UI-UX-CATALOGUE.md`
- `docs/UI-TEMPLATE-REGISTRY.yaml`
- `docs/ui-ux-assets/` — four design-direction boards plus the selection-flow diagram, in SVG and PNG
- Links from the root README and the future `AGENTS.md` / `WALLET_BUILDER.md`

Catalogue installation is documentation work, not source vendoring. **No source may be marked vendored until its code is physically present and built/tested.**
## 5. Security, compatibility, reproducibility and testing gates

**Evidence baseline:** supplied inspection at HEAD `aab79dab`, H6, 10 November 2026. Status applies only to the stated scope. **OPEN** and **UNVERIFIED** identify missing decisions or evidence; proposed gates are not completed controls.

### 5.1 Secret-handling gates

**DOCUMENTED_NOT_TESTED — baseline policy; enforcement varies.** `SECURITY.md`, `docs/SECURITY.md`, `docs/08`, `docs/15` and `docs/16` document the security baseline. Their existence must not be presented as proof of comprehensive implementation.

The engine/adapter/UI boundary must enforce the following:

- **Trusted key/vault boundary:** retain mnemonics, seeds, private keys, private extended keys, recovery data keys, vault keys, vault contents and native wallet handles within this boundary. Chain adapters must receive none of them.
- **UI and transport:** UI state, URLs, logs, telemetry and network requests must never carry secrets.
- **Publication and persistence:** never publish mnemonics, private keys, `xprv`/`zprv`, recovery data keys, production `.env` files, backup artefacts or credentials. Never persist plaintext recovery material.
- **Integration:** do not invent cryptographic constructions to simplify integration. Do not reuse template secret-storage, mnemonic-handling, derivation, provider or signing code.

The derivation policy is fixed: BIP-39, 256-bit entropy, 24 words and an empty passphrase; account 0 and receiving branch 0 only:

| Chain | Derivation |
|---|---|
| BTC | `m/84'/0'/0'/0/i` |
| ETH | `m/44'/60'/0'/0/i` |
| TRX | `m/44'/195'/0'/0/i` |
| TON | `m/44'/607'/0'`, generation-only |

**IMPLEMENTED_AND_VERIFIED — narrowly scoped:** OI-096 at H5 made `compare.js` and `derive.js` reject private, bad-checksum and wrong-chain extended keys before WASM, with 80/80 tests. `derive_daemon.js` retains all three defects; its separate fix lane is running in parallel, with completion **OPEN**.

BTC, ETH and TRX xpubs share version `0488b21e`. Cross-chain misuse among those three is therefore undetectable from serialisation alone. Neither the fix nor future tests may be described as removing that documented limitation.

### 5.2 Transaction review and signing gates

**PROPOSED — master plan §7.3; not implemented in the repository.** The required flow is:

1. Bind chain/network, sender, recipient, asset, amount, contract data and fee limits into a **frozen intent**.
2. Show human-readable transaction details before approval.
3. Validate the signing payload against that intent before signing. Signing must be an explicit user action and respect the trusted key/vault boundary.
4. Broadcast only the exact signed payload.

Track `signed`, `submitted`, `seen_by_node`, `included`, `confirmed` and `finalized` separately. A submitted transaction must not be represented as confirmed; “seen by a node” is a distinct observation, not completion.

**DOCUMENTED_NOT_TESTED — master plan §7.4 boundary rules:** default to testnet everywhere and display the selected network throughout receive, send, history and review. Validate network identity at the adapter boundary and fail closed on mismatch. Never silently fall back to mainnet, another testnet, an SDK default or an arbitrary endpoint. Mainnet is out of scope by default.

The repository has **no signing or broadcast code**. The Web draft’s send path is mocked, and no send has ever been exercised on any network. End-to-end transaction safety and network execution remain **UNVERIFIED**; the existing engine tests cannot establish either.

### 5.3 Confirmation and finality policy

**DOCUMENTED_NOT_TESTED — wallet enforcement.** The policies below were confirmed on 10 November 2026, with M-38 resolved and TON’s M-13 resolved. Source attribution is to the supplied confirmed policy record; primary-source citation details not supplied here remain **OPEN**.

| Chain | Required policy and qualification | Supplied source record |
|---|---|---|
| BTC | **6 confirmations**, qualified as a customary recommendation, not a protocol requirement. | M-38 |
| ETH | `finalized` through supermajority. Retain “12” only as an extra minimum **without primary-source support**; never describe it as a sourced finality threshold. | M-38, including the explicit qualification on “12” |
| TRX | **19 distinct SRs of 27**, with solidified state obtained through `/walletsolidity/*`. | M-38 |
| TON | **1 masterchain seqno after inclusion**, plus an outgoing-message outcome check. The seqno condition alone is insufficient under this policy. | M-38 and M-13 |

These are chain-specific rules, not interchangeable counters. Do not invent a universal confirmation count. Operational enforcement in a working send flow remains **UNVERIFIED**.

### 5.4 Compatibility gates

The supplied inspection establishes the following compatibility and reproducibility evidence:

| Component | Evidence and outstanding gap |
|---|---|
| Node | Declared range `>=22 <23`; VM runs `v24.22.2`, outside that range, although current tests pass. CI uses Node 22. |
| Python | Declared minimum `>=3.11`; inspection used `3.12.3`; CI uses Python 3.13. |
| Wallet engine/WASM | Exact version inventory, pins and compatibility matrix: **OPEN**; no version details were supplied. |
| Android | `gradlew` and `build.gradle.kts` exist, but Gradle/JDK/SDK pins do not. No successful build is recorded. |
| Web draft | Uses `esbuild 0.25.5`; broader reproducibility evidence remains **UNVERIFIED**. |
| Lockfiles | Only `tools/hdwallet-gen` has a lockfile. |

**PROPOSED / OPEN — reproducibility policy:** select and record exact supported Node/Python versions, engine versions and Android Gradle/JDK/SDK pins. Extend lockfile coverage to each applicable package-managed deliverable and use locked dependency installation. Exact pin choices and the expanded lockfile strategy remain **OPEN**.

A passing run on Node 24 must not be treated as satisfying the declared Node range or justifying its expansion.

**PROPOSED / OPEN — build blockers:** unsupported runtimes, missing required pins or lockfiles, manifest/lock drift, invalid registry/schema data and failed mandatory checks must fail acceptance. Any Android build claim requires a successful recorded build using the selected toolchain. These are proposed enforcement rules, not descriptions of current CI coverage.

### 5.5 Testing strategy

**IMPLEMENTED_AND_VERIFIED — H6 results:**

- `npm run check`: exit 0.
- `npm test`: 80 tests OK.
- `python test/differential_test.py`: PASS, exit 0.

CI runs the same commands on Node 22 and Python 3.13. It does **not** cover registry/schema validation, Android/Gradle builds, lint beyond `node --check`, or dependency, secret and licence scans. Those gaps must not be presented as passing checks.

**PROPOSED / OPEN — Phase 4 and Phase 9 additions.** The following allocation, harnesses, acceptance artefacts and results remain open; no new test outcome is claimed.

**Phase 4: boundary, negative-test and fixture gates**

- **Negative tests:** exercise private, bad-checksum and wrong-chain extended keys at each relevant entry point, including the daemon. Preserve the documented BTC/ETH/TRX shared-version limitation rather than asserting impossible serialisation-only detection.
- **Security boundaries:** add tests for attempted secret transfer across engine/adapter/UI boundaries, network mismatch and forbidden fallback. Add frozen-intent/payload mismatch tests; executable signing coverage remains blocked by the absence of signing code.
- **Registry validation:** validate registry/schema data before accepting generated outputs. The validation contract, valid/invalid fixtures and gate command are **OPEN**.
- **Fixtures:** fresh, real, functional test seed phrases and private keys may be generated wherever tests require them; placeholders are not mandatory. Use test-only material, never production or existing keys, and never fund it with real mainnet funds. Do not expose secrets, persist plaintext recovery material or weaken controls to make tests pass. Fixture expectations and evidence remain **OPEN**.

**Phase 9: clean-checkout acceptance and user-facing failure gates**

- **One-prompt acceptance:** start each trial from a separate clean checkout. Require at least two materially different requests, not cosmetic rewordings, with outputs checked without manual repair. Candidate requests, both **OPEN**, are a BTC testnet Web receive/history interface and a TON generation-only Android draft. These differ in platform, chain and workflow; neither is a verified supported output. Exact prompts, generation commands, expected artefacts and successful runs remain **OPEN**. Android acceptance requires a recorded build; a mocked send cannot pass functional-send acceptance.
- **Failure and stale-data tests:** cover loading, empty, stale, locked, gate-failed and error states. A failed request must show **Not refreshed** or **Unavailable**, never zero. Check network visibility and the distinction between signed, submitted, seen by a node and confirmed.
- **Accessibility and UX security:** use WCAG 2.2 as the proposed accessibility baseline and the OWASP Wallet UX Security Handbook as the UX-security reference. Never communicate state by colour alone. Check these requirements in the required screen states; compliance and completed review evidence remain **UNVERIFIED**.

### 5.6 Release gates

**PROPOSED / OPEN — release checklist:** before any release claim, identify the artefact, commit, supported platforms, network scope and exact toolchain. Retain sanitised evidence for every applicable mandatory gate, resolve in-scope defects and document exclusions explicitly. Uncovered builds, scans or acceptance tests cannot be counted as passes.

The current 80-test result, documentation, mocked send path and Android wrapper do not establish production readiness. No mainnet, production, readiness or audit claim may be made without supporting evidence. Mainnet remains out of scope by default.

**EXTERNALLY_DEPENDENT — mandatory real-value gates:**

- **M-35:** amounts are approved for review only; execution is **not authorised**. OI-097’s QR-scan step remains undrafted.
- **M-31/M-15:** independent security review is required before real-value use. The reviewer is not designated; review evidence remains **OPEN**.
- **M-39:** no GUI withdrawal route is confirmed. `@ton/ton` is the identified expert-assisted route; the GUI watch-only test requires a desktop machine. These dependencies do not establish a working repository send path.

**OPEN — maintainer action:** no vulnerability-disclosure procedure or private reporting contact exists. Establish both as part of the proposed release checklist; do not imply that a reporting channel is already available.

Permission to generate functional test keys relaxes none of the secret-handling, independent-review or real-funds gates.
## 6. Open decisions, risks, acceptance criteria and completion evidence

**Evidence baseline:** HEAD `aab79dab`, H6, inspected 10 November 2026. Recommendations, risk assessments and future evidence requirements below are **PROPOSED / OPEN**, not approvals. **IMPLEMENTED_AND_VERIFIED** must describe only demonstrated scope; documentation does not establish runtime behaviour.

### 6.1 Decided

The instruction of 10 November 2026, approximately **03:32 IST**, authorises **Phase 0 + Phase 1 only**: one plan agent, working copy only, no branch creation, commits, pushes or implementation. **STOP before Phase 2 and await explicit approval.**

The approved direction comprises real, committed Web and Android starters; registries; profiles and prompt routing; `AGENTS.md` and `WALLET_BUILDER.md` entry points; catalogue, registry and assets; token-ui recommended for Web; Tether WDK Starter UI-only recommended for Android; and **Bawa Balanced as default**. These are approved targets, not completion evidence.

- **M-38: RESOLVED.**
- **M-39: ACCEPTED, remains OPEN.** GUI withdrawal is **UNVERIFIED**. Next is a desktop GUI watch-only test; `@ton/ton` is the documented expert-assisted route.
- **M-35:** BTC 0.0002, ETH 0.001, TRX 1, TON 0.05 receive-only are **approved for review only**. Execution is not authorised.
- **Daemon fix:** approved as a separate lane, not permission to implement the builder.
- **M-31/M-15 reviewer: DESIGNATED** (owner, 2026-11-10 ~14:30 IST) — Astra, max reasoning. It runs AFTER the acceptance coordinator finishes, so it reviews the final state. The Opus independent audit was dropped by owner decision 2026-11-10 ~14:28 IST; the Opus audit lane had already ended BLOCKED (8 consecutive HTTP 503 "no available channel under current group probation", 2026-11-10). Astra authored the implementation, so the review is a second-pass review by the same model — its report must state that plainly, not present itself as a fully independent audit. The review itself is still pending; designation alone does not clear the M-31/M-15 gate.

**Stale-plan correction:** master plan §8 incorrectly carries M-13, M-24 and M-33 as unresolved. All three were resolved on 10 November 2026 and pushed at `45d75a2a`; M-34 was pushed at `464399e`. Do not carry those three forward.

### 6.2 Open decisions

These maintainer gates remain **OPEN**. Recommendations refine, rather than reopen, the approved direction.

1. **Feature branch.** Options: one programme-wide feature branch; one branch per phase; or main with review-only merges. Recommend **one programme feature branch**, retaining explicit phase gates. Creation still requires the maintainer’s word.

2. **Web foundation.** Options: token-ui, shadcn/ui components or custom React. Recommend **token-ui**. Review pins dated 10 November 2026, **not re-verified**: token-ui `6380d5d`, MIT; shadcn/ui `8ab2771`, MIT. Current fetchability and buildability remain **UNVERIFIED**.

3. **Android foundation.** Options: Tether WDK Starter UI-only; BDK app-ui-only, archived 12 February 2025; compose-samples; or custom Compose. Recommend **WDK UI-only**. Recorded pins: `wdk-starter-kotlin a4fa217`, `devkit 36392bf`, `compose-samples 25631e8`, all Apache-2.0. These references do not establish a Bawa build.

4. **Drafts: adapt or replace, per platform.** Web has 14 screens, 31/31 mocked tests and a PBKDF2-600k vault with AAD `bawa-web-vault-v1`, **not repo-compatible**. Android has `gradlew` and 55/55 pure-module tests, but no AAR/APK ever. Recommend **replace the Web foundation/vault, selectively reusing reviewed screens; adapt Android UI only**, gated by real build verification.

5. **Wallet-core version.** Options: 4.8.4, **IMPLEMENTED_AND_VERIFIED** as the working tool pin; or 4.9.2, the guides’ reference engine at `17e3cd4`, with D21/D31 evidence but in-browser send/sign unexercised (**DOCUMENTED_NOT_TESTED**). Recommend **4.8.4 provisionally**; starter compatibility remains **UNVERIFIED**. Reconcile Doc 4 M-21 before implementation: 4.9.1 is its upgrade candidate, 4.9.2 a prerelease, and neither carries an Android AAR.

6. **Lockfiles.** Options: per-app lockfiles, a root lockfile or a documented no-lockfile policy. No root `package-lock.json` exists; only `tools/hdwallet-gen` has one. Recommend **per-app lockfiles**, preserving the tool lock and documenting reproducible installation.

7. **Licence.** Options: retain XChain as research-only, or seek an explicit AGPL-3.0 copying/licensing decision. Recommend **research-only, with no code copying** absent that decision. Preserve the licence and notice for every vendored component.

8. **Doc 4 §5 proof cadence.** Options: refresh on every re-issue, the current practice; or change the proof form. It names H5 `d2f0960c` while main is H6; the one-commit lag recurs. Recommend **change the form** to identify the inspected snapshot explicitly, without implying live-HEAD coverage.

9. **M-35 execution and OI-097.** Options: defer rehearsal; or draft and review the missing QR-scan step, then seek separate execution approval. Recommend **the latter sequence**, without execution now. The QR-scan step remains undrafted; amounts approval is review-only.

10. **M-39 GUI route.** Options: obtain a desktop machine with a browser, or defer. Recommend **desktop watch-only testing**; access is **EXTERNALLY_DEPENDENT**. No VM route exists. Neither `@ton/ton` documentation nor watch-only success establishes GUI withdrawal verification.

### 6.3 Risks

Likelihood judgements are **UNVERIFIED assessments**, not measured probabilities. The mitigations are proposed plan requirements.

| Risk | Likelihood / impact | Prescribed mitigation |
|---|---|---|
| Upstream template drift or disappearance | Possible / loss of reproducibility | Re-check recorded pins; retain permitted sources with licences and notices. |
| AGPL obligations | Possible if copying occurs / serious licensing exposure | Keep XChain research-only; require an explicit licensing decision before copying. |
| UI-only boundary slips | Possible / severe secret exposure | Exclude template-owned secret handling; review and test the engine boundary. |
| Core version drift | Existing split / serious integration risk | Resolve decision 5, align engine declarations and verify each platform separately. |
| Android toolchain | Uncertain / potentially build-blocking | No JDK/SDK pins, AAR or successful build exist. Pin the toolchain, agree an AAR route and produce build evidence. |
| Testnet endpoint churn | Possible / disrupted verification | Record and check endpoints before runs; never silently substitute mainnet. |
| Mainnet, swaps, staking or bridges scope creep | Possible / safety and delivery harm | Enforce capability and release gates; require explicit scope approval. |
| §5 proof lag | Recurring / misleading assurance | Apply decision 8 once approved; distinguish inspected SHA from current HEAD. |
| 40+ Doc 4 §21 rows misclassified | Possible / false blockers or false completion | Classify by affected claim and dependency, not aggregate row count. |

Most §21 rows concern **guide completeness**: they block the corresponding guide-completeness claims, not automatically builder work. Missing build, engine-boundary, security or in-scope verification evidence blocks the affected **builder acceptance gate**. Exact row-to-phase classification remains **OPEN**; unrelated guide gaps must not become blanket builder blockers.

### 6.4 Acceptance criteria

The following records the master plan §1.3/§13 requirements. Evidence specifications are **PROPOSED / OPEN**; this section does not certify builder delivery.

| Criterion | Evidence that would satisfy it |
|---|---|
| A new agent discovers the starting instructions without reading every document | Fresh-agent trace reaching `AGENTS.md` and `WALLET_BUILDER.md` through the intended entry route. |
| Builder guide routes requests to profiles | Request-to-profile scenario records, including verification of the Bawa Balanced default. |
| Profiles are complete | Checks covering operations, chains, platform, engine, UI route, security boundaries and verification. |
| Registries are machine-readable and schema-validated | Schema revisions, validation commands and passing outputs. |
| Template records identify exact revision and licence | Revision records, licence metadata and preserved vendored notices. |
| At least one real, buildable Web and Android starter exists | Successful clean-build commands, logs and artefacts for each; mocked or pure-module tests alone are insufficient. |
| Starters connect to the engine boundary without template-owned secret storage | Boundary tests and source review demonstrating both connection and the storage restriction. |
| CLI/HD workflow remains available | Reproducible installation/test instructions and successful command logs. |
| One-prompt scenarios are tested from clean checkouts | Checkout references, original prompts, build/test logs and explicit pass/fail/not-run outcomes. |
| Unsupported operations are obvious | Capability matrix checked against profiles and observed behaviour. |
| Security/release gates block premature mainnet or production claims | Negative-test evidence demonstrating those gates. |
| Documentation and implementation agree | Traceability checks across docs, registries, scripts and implementation. |

**Final §13 test:** from a clean checkout and one ordinary request, a capable AI agent produces a plan, selects the engine and UI foundation, implements a buildable project, runs honest verification and reports what works. Preserve the complete transcript and artefacts. A documented route alone remains **DOCUMENTED_NOT_TESTED**.

### 6.5 Completion evidence

The final handoff must use the master plan **§11.2 report table**. Its exact fields are **UNVERIFIED** because they were not supplied. **OPEN:** retrieve the authoritative table and map the following proposed evidence checklist into it; this checklist does not replace its schema.

| Evidence bundle | Required handoff content |
|---|---|
| Scope and changes | Authorised phase, inspected/delivered revisions, changed-file inventory, decision record and outstanding approvals. |
| Delivered artefacts | Entry points, builder guide, profiles, registries/schemas, catalogue/assets, starters, scripts, pins and licences. |
| Verification | Criterion-by-criterion commands, environment/toolchain and lockfile details, logs, build artefacts, scenario transcripts and pass/fail/not-run distinctions. |
| Independent review | M-31/M-15 reviewer designated: Astra, max reasoning (owner, 2026-11-10 ~14:30 IST), runs after acceptance work; Opus audit dropped by owner decision 2026-11-10 ~14:28 IST. Report must state plainly it is a second-pass review by the same model, not a fully independent audit. Record findings and unresolved objections when the review lands. |
| Residual work | Release-gate results, open risks, external dependencies, affected acceptance claims and next actions. |

Assign each reported item **IMPLEMENTED_AND_VERIFIED**, **DOCUMENTED_NOT_TESTED**, **PROPOSED** or **EXTERNALLY_DEPENDENT**, supported by evidence. Do not infer a reviewer, approval, completion date or successful test.

### 6.6 Proceed vs blocked

**Now:** Phase 0/1 planning may proceed with one agent and working-copy edits only. The separately approved daemon lane does not expand this assignment.

**Phase 2 and all later builder work:** blocked pending explicit maintainer approval. Branch creation additionally requires decision 1.

Later phase names, numbers and allocations are **OPEN** in the supplied facts. Before authorising each actual phase, record its applicable gates explicitly:

- **Web adoption:** foundation, draft treatment and licence — decisions 2, 4 and 7.
- **Android adoption:** foundation, draft treatment and licence — decisions 3, 4 and 7.
- **Engine integration:** decision 5; Android toolchain/AAR resolution and build evidence.
- **Dependency reproducibility:** decision 6.
- **Rehearsal and GUI verification:** decisions 9 and 10, respectively; separate execution permission and desktop access.
- **Proof, review and handoff:** decision 8, reviewer designation and authoritative §11.2 table mapping.

These are task-specific gates, not permission to start or invented phase assignments.

**Exact next step:** submit this Phase 0/1 plan for maintainer review, then **STOP and wait for explicit Phase 2 approval**. Do not create a branch, commit, push or implement while waiting.

## Authorship

Sections 1–6 were authored by gpt-6-astra via AgentRouter (6 calls, API 2,
max reasoning, 32,000-token output cap, prompts under 1,000 words).
Assembled, reviewed and verified by the plan agent (Muse). The baseline
inspection, H7 verification and the post-draft updates in the front matter
are the assembler's own work.
