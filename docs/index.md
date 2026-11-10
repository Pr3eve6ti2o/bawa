# Documentation index

This index maps Bawa’s wallet reference and AI Wallet Builder: where to start, where the implementation lives, what has been checked and what remains open. Statuses reflect the evidence recorded on 10 November 2026 and apply only to the scope stated; passing local checks does not establish mainnet readiness.

## Start here

- [AGENTS.md](../AGENTS.md) — `DOCUMENTED_NOT_TESTED`: read first for repository instructions.
- [WALLET_BUILDER.md](../WALLET_BUILDER.md) — `DOCUMENTED_NOT_TESTED`: route a request through the builder.
- [Implementation plan](AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md) — `DOCUMENTED_NOT_TESTED`: Phases 0–10, evidence vocabulary and outstanding milestones.
- [Workflow command](../scripts/build-wallet.mjs) — `IMPLEMENTED_AND_VERIFIED` for the two exercised requests: `node scripts/build-wallet.mjs` from the repository root, web 3/3 steps and multi-chain 6/6 steps VERIFIED; other requests are not covered by that evidence.

## The wallet reference

The numbered reference volumes and appendices below route through the README catalogue. The separate Doc 2, Doc 3 and Doc 4 specialist guides link directly.

- [README](../README.md) — `DOCUMENTED_NOT_TESTED`: reference overview and catalogue.
- [Doc 01](../docs/01-fundamentals/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 02](../docs/02-chains/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 03](../docs/03-tools-and-repositories/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 04](../docs/04-wallet-generation/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 05](../docs/05-watch-only/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 06](../docs/06-tracking/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 07](../docs/07-payment-tracking/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 08](../docs/08-security-recovery/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 09](../docs/09-signing-and-hardware/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 10](../docs/10-operations-and-testing/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 11](../docs/11-trust-wallet-and-independent-verification/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 12](../docs/12-chain-registry-and-assets/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 13](../docs/13-wallet-app-architecture/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 14](../docs/14-wallet-app-implementation/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 15](../docs/15-threat-model-and-theft-prevention/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 16](../docs/16-security-decision-guide/README.md) — `DOCUMENTED_NOT_TESTED`.
- [GLOSSARY](../docs/GLOSSARY.md) — `DOCUMENTED_NOT_TESTED`: terminology, via the reference catalogue.
- [FAQ](../docs/FAQ.md) — `DOCUMENTED_NOT_TESTED`: common questions, via the reference catalogue.
- [FURTHER-READING](../docs/FURTHER-READING.md) — `DOCUMENTED_NOT_TESTED`: supporting reading, via the reference catalogue.
- [RECOVERY](../docs/RECOVERY.md) — `DOCUMENTED_NOT_TESTED`: recovery guidance, via the reference catalogue.
- [Doc 2 — web wallet](web-wallet/WEB-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: specialist guide; verified starter checks are listed below.
- [Doc 3 — Android wallet](android-wallet/ANDROID-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: specialist guide; the Android Add path remains `UNVERIFIED`.
- [Doc 4 — mainnet](mainnet/MAINNET-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: activation is `EXTERNALLY_DEPENDENT`; §5 SHA staleness is `OPEN`.

## The builder

- Registries — `IMPLEMENTED_AND_VERIFIED` for registry validation, 10/10: [profiles](../registry/profiles.json) (7 profiles), [capabilities](../registry/capabilities.json), [engines](../registry/engines.json) and [UI](../registry/ui.json).
- [Schema validation](../scripts/validate-registry.mjs) — `IMPLEMENTED_AND_VERIFIED` for registry checks: validation entry point for `registry/schemas/`.
- [AI request routing](../ai/request-routing.md) — `DOCUMENTED_NOT_TESTED`: routing guidance and the route into prompts in `ai/`.
- [Capability detection](../ai/detect-capabilities.mjs) — `IMPLEMENTED_AND_VERIFIED` for reporting: executed in Phases 3 and 8 and its output checked against the registries and starters.
- [UI candidates](../research/ui-candidates.md) — `PROPOSED`: candidate research, not implementation evidence.
- [Web template upstream](../templates/web/UPSTREAM.md) — `DOCUMENTED_NOT_TESTED`: upstream provenance.
- [Android template upstream](../templates/android/UPSTREAM.md) — `DOCUMENTED_NOT_TESTED`: upstream provenance.
- [UI/UX catalogue](UI-UX-CATALOGUE.md) — `DOCUMENTED_NOT_TESTED`: design reference and the route into `docs/ui-ux-assets/`.
- [UI template registry](UI-TEMPLATE-REGISTRY.yaml) — `DOCUMENTED_NOT_TESTED`: template metadata.
- [Web starter](../apps/web/README.md) — `IMPLEMENTED_AND_VERIFIED`: `apps/web/`, 25 tests and a successful build.
- [Android starter](../apps/android/README.md) — `IMPLEMENTED_AND_VERIFIED`: `apps/android/`, 17 tests, APK build and emulator install/launch; Add remains `UNVERIFIED`.
- [Contracts](../packages/contracts/src/index.ts) — `IMPLEMENTED_AND_VERIFIED` for compilation: imported by `apps/web` and checked by the web typecheck and build.
- Scripts — `IMPLEMENTED_AND_VERIFIED` for the exercised workflow: [setup](../scripts/setup.mjs), [build](../scripts/build.mjs), [test](../scripts/test.mjs) and [wallet build](../scripts/build-wallet.mjs) (web 3/3, multi-chain 6/6 steps VERIFIED).
- [Registry tests](../tests/registry.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 10/10.
- [Negative-input tests](../tests/negative-inputs.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 36/36.
- [Chain-fixture tests](../tests/chain-fixtures.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 8 tests, run first-hand (part of the 17 pass / 0 fail / 1 skipped Phase 9 run).
- [Failure-mode tests](../tests/failure-modes.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 6 tests, run first-hand; the R-01 test is skipped pending the auditfix2 (H8) fix.
- [Stale-data tests](../tests/stale-data.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 4 tests, run first-hand.
- [Clean-checkout tests](../tests/clean-checkout.test.mjs) — `IMPLEMENTED_AND_VERIFIED`: 3/3.

## Evidence and gates

- [Testing guide](TESTING.md) — `DOCUMENTED_NOT_TESTED`: test commands and scope; use the named results rather than assuming blanket coverage.
- [Engine reproducibility](engine-reproducibility.md) — `IMPLEMENTED_AND_VERIFIED`: engine suite 92/92; this does not verify on-device Android derivation.
- [Sample requests](sample-requests.md) — `IMPLEMENTED_AND_VERIFIED` for the two exercised requests: web 3/3 and multi-chain 6/6 steps VERIFIED; other requests are not covered by that evidence.
- [Android evidence](android-evidence.md) — `IMPLEMENTED_AND_VERIFIED`: 17 tests, APK and emulator install/launch only; the Add path is `UNVERIFIED`.
- [Accessibility review](accessibility-review.md) — `DOCUMENTED_NOT_TESTED`: review material; GUI verification remains outstanding.
- [Security release gates](security-release-gates.md) — `DOCUMENTED_NOT_TESTED`: independent review and release gates are not cleared by local test results.
- [Registry maintenance](registry-maintenance.md) — `DOCUMENTED_NOT_TESTED`: registry update guidance.
- [Security guidance](SECURITY.md) — `DOCUMENTED_NOT_TESTED`: security documentation, not independent approval.
- [References](REFERENCES.md) — `DOCUMENTED_NOT_TESTED`: supporting sources.
- [Quality gates](../scripts/quality-gates.mjs) — `IMPLEMENTED_AND_VERIFIED`: 11/11 automated gates; not mainnet or independent-review clearance.
- [Handoff](handoff.md) — `DOCUMENTED_NOT_TESTED`: handover record and unresolved work.

## Open items

- [Independent review — M-31/M-15](security-release-gates.md) — `OPEN`: independent review remains outstanding.
- [M-35 execution](AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md) — `OPEN`: execution pending; no verified completion.
- [M-39 GUI test](AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md) — `UNVERIFIED`: GUI verification remains outstanding.
- [Mainnet activation](mainnet/MAINNET-GUIDE.md) — `EXTERNALLY_DEPENDENT`: activation remains gated.
- [On-device Android derivation](android-evidence.md) — `EXTERNALLY_DEPENDENT`: no AAR; on-device derivation remains unverified.
- [Doc 4 §5 SHA staleness](mainnet/MAINNET-GUIDE.md) — `OPEN`: the stale SHA needs correction and re-verification.
- [R-01 Node fix](handoff.md) — `OPEN`: fix pending (`auditfix2`, `H8`); resolution remains `UNVERIFIED`.
- [Android Add path](android-evidence.md) — `UNVERIFIED`: APK installation and launch do not verify Add.
