# Documentation index

This index is the single entry point for Bawa documentation; the root [README.md](../README.md), [WALLET_BUILDER.md](../WALLET_BUILDER.md), and [docs/README.md](README.md) each point here.

This index maps Bawa's wallet reference and AI Wallet Builder: where to start, where the implementation lives, what has been checked and what remains open. It is organised by purpose, after Diátaxis: tutorials teach by doing, how-to guides solve a task, reference states facts, explanation builds understanding. Statuses reflect the evidence recorded on 10 November 2026, with the 20 November 2026 re-verifications and the 23 November 2026 re-verifications named below (engine smoke 217, web vitest 90 files, 1718 passed + 5 skipped, quality-gates run); passing local checks does not establish mainnet readiness.

## Start here

- [AGENTS.md](../AGENTS.md) — `DOCUMENTED_NOT_TESTED`: read first for repository instructions.
- [WALLET_BUILDER.md](../WALLET_BUILDER.md) — `DOCUMENTED_NOT_TESTED`: route a request through the builder.
- [Implementation plan](AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md) — `DOCUMENTED_NOT_TESTED`: Phases 0–10, evidence vocabulary and outstanding milestones.
- [Workflow command](../scripts/build-wallet.mjs) — `IMPLEMENTED_AND_VERIFIED` for sample request 1 (Create a Web wallet: 3/3 steps VERIFIED) and sample request 3 (Create a multi-chain wallet: 6/6 steps VERIFIED). Sample request 2 (Create an Android wallet) reports setup as SKIPPED without toolchains. Exercise dates are not stated in this index.
- [README](../README.md) — `DOCUMENTED_NOT_TESTED`: the front door — what Bawa is, quickstart, and where to go next.
- [Full manual (preserved README)](README-FULL.md) — `DOCUMENTED_NOT_TESTED`: the previous 1,308-line README, preserved verbatim.

## Tutorials — learn by doing

Numbered labels (Doc 01, Doc 02, and so on) follow the guide sequence in docs/01 to docs/16; the unnumbered entries below (Web wallet, Android wallet, Mainnet) are platform references, not steps in that sequence.
- [Doc 01 — Fundamentals](01-fundamentals/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Web wallet](web-wallet/WEB-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: specialist guide; verified starter checks are listed below.
- [Android wallet](android-wallet/ANDROID-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: specialist guide; the Android Add path remains `UNVERIFIED`.

## How-to guides — accomplish a task

- [Doc 04 — Wallet Generation](04-wallet-generation/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 05 — Watch-only Derivation](05-watch-only/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 06 — Wallet Tracking](06-tracking/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 07 — Payment Tracking](07-payment-tracking/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 08 — Security & Recovery](08-security-recovery/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 09 — Signing, Descriptors, PSBT & Hardware](09-signing-and-hardware/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 10 — Operations & Testing](10-operations-and-testing/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 14 — Wallet App Implementation](14-wallet-app-implementation/README.md) — `DOCUMENTED_NOT_TESTED`.
- [RECOVERY](RECOVERY.md) — `DOCUMENTED_NOT_TESTED`: recovery guidance, via the reference catalogue.
- [Create the example wallet](CREATE-EXAMPLE-WALLET.md) — `DOCUMENTED_NOT_TESTED`: create the pre-built example web wallet from a clean checkout.

## Reference — accurate information

- [Doc 02 — Chain Guides](02-chains/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 03 — Tool & Repository Map](03-tools-and-repositories/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 11 — Trust Wallet Core & Independent Verification](11-trust-wallet-and-independent-verification/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 12 — Chain Registry & Asset Metadata](12-chain-registry-and-assets/README.md) — `DOCUMENTED_NOT_TESTED`.
- [GLOSSARY](GLOSSARY.md) — `DOCUMENTED_NOT_TESTED`: terminology, via the reference catalogue.
- [FAQ](FAQ.md) — `DOCUMENTED_NOT_TESTED`: common questions, via the reference catalogue.
- [FURTHER-READING](FURTHER-READING.md) — `DOCUMENTED_NOT_TESTED`: supporting reading, via the reference catalogue.
- [References](REFERENCES.md) — `DOCUMENTED_NOT_TESTED`: supporting sources.
- [Engine reproducibility](engine-reproducibility.md) — `IMPLEMENTED_AND_VERIFIED`: engine smoke suite 217 checks pass (verified 2026-11-23 on this tree); the H7 92/92 figure inside that document is the older recorded baseline. This does not verify on-device Android derivation.
- [External tools](EXTERNAL-TOOLS.md) — `DOCUMENTED_NOT_TESTED`: evaluated external repositories and packages for building with Bawa.
- [UI/UX catalogue](UI-UX-CATALOGUE.md) — `DOCUMENTED_NOT_TESTED`: design reference and the route into `docs/ui-ux-assets/`.
- [UI template registry](UI-TEMPLATE-REGISTRY.yaml) — `DOCUMENTED_NOT_TESTED`: template metadata.

## Explanation — concepts, context, reasons

- [Doc 13 — Wallet App Architecture](13-wallet-app-architecture/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 15 — Threat Model & Theft Prevention](15-threat-model-and-theft-prevention/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 16 — Security Decision Guide](16-security-decision-guide/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Mainnet](mainnet/MAINNET-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: activation is `EXTERNALLY_DEPENDENT`; §5 SHA staleness is RESOLVED (M-33, 2026-11-10; T07 re-verification note 2026-11-12).
- [Capability map](CAPABILITY-MAP.md) — `DOCUMENTED_NOT_TESTED`: what is implemented, implemented-and-tested, documented-but-needs-AI, needs-external, or not implemented.
- [Mainnet gap assessment](archive/mainnet-gap-assessment.md) — `DOCUMENTED_NOT_TESTED`: honest mainnet readiness per chain; all four chains NOT ready.
- [Branch audit](archive/branch-audit.md) — `DOCUMENTED_NOT_TESTED`: what each of the five branches holds and where they differ.
- [Architecture](../ARCHITECTURE.md) — `DOCUMENTED_NOT_TESTED`: code map, invariants, and boundaries.
- [Architecture decisions](adr/README.md) — `DOCUMENTED_NOT_TESTED`: numbered decision records (ADRs).
- [How Bawa works](HOW-IT-WORKS.md) — how the repository works, how it starts, and what it can do; two Mermaid diagrams with every box traced to a real file.
- [Decisions](DECISIONS.md) — owner-delegated decisions register (ECDSA, confirmation policy, merges).
- [UI/UX Fixes programme](UI-UX-FIXES-PROGRAMME.md) — programme record: 21 items, merged into `panel-rebuild/token-gaps` (merge commit `4eb0242`).
- [UI/UX Round 2 programme](UI-UX-ROUND2-PROGRAMME.md) — programme record: 10 items, merged into `panel-rebuild/token-gaps` (merge commit `6147b74`).
- [Reverify + Professional Polish programme](REVERIFY-PROGRAMME.md) — programme record: 5 lanes, merged into `panel-rebuild/token-gaps`.
- [Reverify checklist](REVERIFY-CHECKLIST.md) — every owner order from 2026-11-22 through 2026-11-23 ~18:14 IST, with a verdict and evidence per order.

## The builder

- Registries — `IMPLEMENTED_AND_VERIFIED` for registry validation, 10/10: [profiles](../registry/profiles.json) (8 profiles), [capabilities](../registry/capabilities.json), [engines](../registry/engines.json) and [UI](../registry/ui.json).
- Price feed: CoinGecko, see ADR-0007 (`docs/adr/0007-price-feed-provider.md`).
- [Schema validation](../scripts/validate-registry.mjs) — `IMPLEMENTED_AND_VERIFIED` for registry checks: validation entry point for `registry/schemas/`.
- [AI request routing](../ai/request-routing.md) — `DOCUMENTED_NOT_TESTED`: routing guidance and the route into prompts in `ai/`.
- [Capability detection](../ai/detect-capabilities.mjs) — `IMPLEMENTED_AND_VERIFIED` for reporting: executed in Phases 3 and 8 and its output checked against the registries and starters.
- [UI candidates](../research/ui-candidates.md) — `PROPOSED`: candidate research, not implementation evidence.
- [Web template upstream](../templates/web/UPSTREAM.md) — `DOCUMENTED_NOT_TESTED`: upstream provenance.
- [Android template upstream](../templates/android/UPSTREAM.md) — `DOCUMENTED_NOT_TESTED`: upstream provenance.
- [Web starter](../apps/web/README.md) — `IMPLEMENTED_AND_VERIFIED`: `apps/web/`, web vitest 90 files, 1718 passed + 5 skipped (verified 2026-11-23 on this tree) and a successful build (Round 2 gates, 2026-11-23).
- [Android starter](../apps/android/README.md) — `IMPLEMENTED_AND_VERIFIED` for the starter build scope only: `apps/android/`, 57 `@Test` annotations counted across 5 test files (re-counted 2026-11-20); the executed passing count was NOT re-established here — no Android SDK on this machine, so Gradle tests are `NOT-RUN`. The earlier "57/57 pass by a clean Gradle run" note is unsourced in `docs/android-evidence.md`. APK build and emulator install/launch; Add remains `UNVERIFIED`.
- [Contracts](../packages/contracts/src/index.ts) — `IMPLEMENTED_AND_VERIFIED` for compilation: imported by `apps/web` and checked by the web typecheck and build. One consumer today (`apps/web`); see `ARCHITECTURE.md`.
- Scripts — `IMPLEMENTED_AND_VERIFIED` for the exercised workflow: [setup](../scripts/setup.mjs), [build](../scripts/build-platforms.mjs), [test](../scripts/run-test-suites.mjs) and [wallet build](../scripts/build-wallet.mjs) (web 3/3, multi-chain 6/6 steps VERIFIED).
- [Registry tests](../tests/registry.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 10/10.
- [Negative-input tests](../tests/negative-inputs.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 36/36.
- [Chain-fixture tests](../tests/chain-fixtures.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 8 tests, run first-hand (part of the 17 pass / 0 fail / 1 skipped Phase 9 run).
- [Failure-mode tests](../tests/failure-modes.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 10 test declarations; the suite passed in the 2026-11-20 phase9 run (157/158 pass overall; the single failure was in stale-data, not here).
- [Stale-data tests](../tests/stale-data.test.mjs) — `FAIL` on the 2026-11-20 phase9 run: 7 test declarations, 6 passed and 1 failed — Mainnet guide §21 M-31 disposition (the test still asserts OPEN; the guide correctly records CLOSED since 2026-11-13).
- [Clean-checkout tests](../tests/clean-checkout.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 3/3.

## Evidence and gates

- [Testing guide](TESTING.md) — `DOCUMENTED_NOT_TESTED`: test commands and scope; use the named results rather than assuming blanket coverage.
- [Sample requests](sample-requests.md) — `IMPLEMENTED_AND_VERIFIED` for sample request 1 (Create a Web wallet: 3/3 steps VERIFIED) and sample request 3 (Create a multi-chain wallet: 6/6 steps VERIFIED). Sample request 2 (Create an Android wallet) reports setup as SKIPPED without toolchains. Exercise dates are not stated in this index.
- [Android evidence](android-evidence.md) — `IMPLEMENTED_AND_VERIFIED` for install/launch only: 57 `@Test` annotations counted (re-counted 2026-11-20); executed passing count NOT re-established here; APK and emulator install/launch only; the Add path is `UNVERIFIED`.
- [Accessibility review](accessibility-review.md) — `DOCUMENTED_NOT_TESTED`: review material; GUI verification remains outstanding.
- [Security release gates](SECURITY-RELEASE-GATES.md) — `DOCUMENTED_NOT_TESTED`: independent review and release gates are not cleared by local test results.
- [Registry maintenance](registry-maintenance.md) — `DOCUMENTED_NOT_TESTED`: registry update guidance.
- [Security guidance](SECURITY.md) — `DOCUMENTED_NOT_TESTED`: security documentation, not independent approval.
- [Quality gates](../scripts/quality-gates.mjs) — `FAIL` on the 2026-11-20 run on this tree (`--skip-android`): 2 gates failed — `phase9-tests` (stale-data: Mainnet guide §21 M-31 disposition; the test still asserts OPEN, the guide correctly records CLOSED) and `secret-scan`; 4 skipped (android-tests, audit-pip, sast-bandit, sast-ruff). The earlier 11/11 and 13/13 figures are earlier runs, not this tree's current result; not mainnet or independent-review clearance.
- [Handoff](archive/handoff-2026-11-10.md) — `DOCUMENTED_NOT_TESTED`: handover record and unresolved work.
- [Launch checklist](launch-checklist.md) — `DOCUMENTED_NOT_TESTED`: pre-B-1 checklist.
- [Release procedure](release-procedure.md) — `DOCUMENTED_NOT_TESTED`: tagged baseline + rollback (full ceremony deferred).
- [Gap analysis](GAP-ANALYSIS.md) — `DOCUMENTED_NOT_TESTED`: what the wallet still lacks, which public repositories solve each gap (stars and licences checked live 2026-11-23), and where the fix belongs in the guide (Lane E, Deep Audit + Devnet E2E programme, 2026-11-23; gaps 21+ added by the coordinator from Lane B findings).

## Open items

- [Independent review — M-31/M-15](SECURITY-RELEASE-GATES.md) — `CLOSED`: owner accepted Sol's fresh-context re-audit (R02) on 2026-11-13 in place of the Astra audit the rows name. Closure covers the review gate only; it does not authorise funding, rehearsal, or any real-funds use.
- [M-35 execution](AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md) — `CLOSED`: owner declined funding on 2026-11-13. The four rehearsal addresses are retired and must never be funded; the isolated credentials were destroyed. The execution path is closed.
- [M-39 GUI test](AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md) — `UNVERIFIED`: GUI verification remains outstanding.
- [Mainnet activation](mainnet/MAINNET-GUIDE.md) — `EXTERNALLY_DEPENDENT`: activation remains gated.
- [On-device Android derivation](android-evidence.md) — `EXTERNALLY_DEPENDENT`: no AAR; on-device derivation remains unverified.
- [R-01 invalid-point validation](archive/handoff-2026-11-10.md) — `RESOLVED`: implemented in the shared validator (`tools/hdwallet-gen/extended-key.js`, bad-point rejection) and mirrored in `apps/web/src/engine/boundary.ts` (R-01). The earlier OPEN note in this index was stale.
- [Android Add path](android-evidence.md) — `UNVERIFIED`: APK installation and launch do not verify Add.

The registry covers 22 chains: btc, eth, trx, ton, sol, bsc, matic, arb, op, base, avax, ltc, doge, gnosis, celo, linea, mantle, scroll, opbnb, metis, aurora, fantom. Chain-level IMPLEMENTED_AND_VERIFIED means verified in at least one explicitly identified profile. Network operations are verified for btc, eth, trx, ton only. The 18 additional chains are scoped to the multichain-extended-wallet profile. The 13-chain registry in registry/capabilities.json (chainSupport) was merged into adopt-proper from panel-rebuild/multichain-create; the 9 newer EVM chains were added afterwards on panel-rebuild/token-gaps. It is not a separate branch.

## Project structure

Verified against the `panel-rebuild/token-gaps` tree at `8191b2c`
(Lane I, FIX-ALL programme, 2026-11-24). Counts are tracked
files (`git ls-files`).

```text
bawa/
  README.md, WALLET_BUILDER.md, ARCHITECTURE.md, CONSTRAINTS.md,
  AGENTS.md, NAMING-MAP.md, SECURITY.md, CHANGELOG.md, CONTRIBUTING.md,
  DEVNET-ISSUES.md, PERF.md, SECURITY-FINDINGS.md,
  NOV18-TRUTH-REPRODUCIBILITY-EVIDENCE.md,
  NOV18-WALLET-GENERATION-SDK-PICK.md, NOV18-WALLET-PANEL-RESEARCH.md
    Root docs: the front door, the builder entry point, the code map and
    invariants, the test/quality floor, repo instructions, naming
    decisions, security posture, history, contribution guide; plus the
    devnet issues log, performance and security-findings records, and
    the dated 2026-11-18 research reports.
  apps/
    web/            (304 files) The wallet web app: React 19 + TypeScript
                    + Vite + vitest. Entry `src/main.tsx`; `src/app`
                    (routing, shell), `src/screens` (56 files, one
                    screen per route), `src/state` (wallet context and
                    refresh), `src/wallet` (86 files: chains, vault,
                    adapters, send, prices, tokens), `src/engine`
                    (address codecs, boundary, destination validation,
                    confirmation policy), `src/ui` (components, styles),
                    `src/assets` (chain/token icons), `e2e/` (13
                    Playwright specs, plus helpers and manifest),
                    `scripts/` (wasm copy,
                    palette audit, chains generation).
    android/        (30 files) The Android starter (Kotlin): app, core
                    (derivation/confirmation policy, key validation),
                    ui screens and ViewModel.
  docs/             (219 files) The guide and programme records, in
                    Diátaxis order (see the sections above): numbered
                    docs 01-16, platform guides, reference, evidence,
                    archive. The single entry point is this index.
  registry/         (6 files) Machine-readable registries: 4 JSON
                    (`capabilities`, `engines`, `profiles`, `ui`) + 2
                    schemas (`profile`, `registry`).
  packages/
    contracts/      The `@bawa/contracts` package (package + index).
  scripts/          (20 files) Builder and gate scripts (`.mjs`):
                    `build-wallet`, `generate-project`, `plan-build`,
                    `classify-request`, `quality-gates`, `gate-verdict`,
                    `secret-scan`, `check-wallet-cycles`,
                    `check-lockfiles`, `check-pinned-dependencies`,
                    `validate-registry`, `check-live-prices`, `setup`,
                    `build-platforms`, `run-test-suites`, plus
                    `crypto-architecture` and `build-wallet` /
                    `plan-build` test files, and `generate-templates/`.
  tools/            (20 files) Python CLIs (`bawa_cli`, `make_wallet`,
                    `decrypt_seed`, `check-links`) and Node tools:
                    `hdwallet-gen/` (Trust Wallet Core derivation),
                    `mainnet-fees/`, `mainnet-guards/`,
                    `mainnet-signing/`, `mainnet-tx/`, `verify-sign/`.
  tests/            (31 files) Node `.mjs` suites run by
                    `scripts/quality-gates.mjs`: registry, derivation
                    vectors, mainnet guards/fees/signing, failure modes,
                    lockfiles, secret scan, gate verdicts.
  test/             (12 files) The older Python + JS smoke suite
                    (`test_*.py`, `smoke.test.js`,
                    `register-links.test.js`, `differential_test.py`,
                    `fixture-oracle.py`): run by CI `python-tests` and
                    by the root `npm test` (via `tools/hdwallet-gen`).
                    `test/` and `tests/` are different runners; merging
                    them is a runner-consolidation decision, not a
                    rename (Lane E, 2026-11-23).
  ai/               (19 files) Builder capability detection and
                    profiles for the AI Wallet Builder.
  .github/workflows/ `ci.yml` (web, node-tests, python-tests,
                    docs-checks, e2e, floor-guard) and `security-audit.yml`.
```

Naming: source files are kebab-case throughout `apps/web/src`
(`secret-handoff.ts`, not `secretHandoff.ts` — renamed Lane E,
2026-11-23). The Android tree keeps Java/Kotlin PascalCase by
convention. Deliberate near-duplicate names are recorded in
[NAMING-MAP.md](../NAMING-MAP.md) (for example the
`confirmation-policy.md` spec beside `confirmation-policy.ts`).
