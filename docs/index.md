# Documentation index

This index is the single entry point for Bawa documentation on `main`; the root [README.md](../README.md) and [docs/README.md](README.md) each point here.

The AI Wallet Builder itself — registries, starters, scripts, and the example web wallet — lives on the active development branch (`panel-rebuild/token-gaps`); this index lists only what exists on `main`.

This index maps Bawa's wallet reference and guide: where to start, where the implementation lives, what has been checked and what remains open. It is organised by purpose, after Diátaxis: tutorials teach by doing, how-to guides solve a task, reference states facts, explanation builds understanding. Statuses reflect the evidence recorded on 10 November 2026, with re-verifications through 25 November 2026 named below. On `main` itself (verified 28 November 2026): engine smoke 136 checks, 0 failures; launcher 48 tests OK; `make_wallet` 26 tests OK; differential test PASS; no web wallet and no vitest on `main`. Passing local checks does not establish mainnet readiness.

## Start here

- [AGENTS.md](../AGENTS.md) — `DOCUMENTED_NOT_TESTED`: read first for repository instructions.
- [README](../README.md) — `DOCUMENTED_NOT_TESTED`: the front door — what Bawa is, quickstart, and where to go next.
- [Full manual (preserved README)](README-FULL.md) — `DOCUMENTED_NOT_TESTED`: the previous 1,285-line README, preserved as a frozen 2026-11-08 archive (not a verbatim copy of that commit's root README).

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
- [Wallet lifecycle](wallet-lifecycle.md) — `DOCUMENTED_NOT_TESTED`: unlock, sign, broadcast and refresh order for the web wallet on `panel-rebuild/token-gaps`.

## Reference — accurate information

- [Doc 02 — Chain Guides](02-chains/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 03 — Tool & Repository Map](03-tools-and-repositories/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 11 — Trust Wallet Core & Independent Verification](11-trust-wallet-and-independent-verification/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 12 — Chain Registry & Asset Metadata](12-chain-registry-and-assets/README.md) — `DOCUMENTED_NOT_TESTED`.
- [GLOSSARY](GLOSSARY.md) — `DOCUMENTED_NOT_TESTED`: terminology, via the reference catalogue.
- [FAQ](FAQ.md) — `DOCUMENTED_NOT_TESTED`: common questions, via the reference catalogue.
- [FURTHER-READING](FURTHER-READING.md) — `DOCUMENTED_NOT_TESTED`: supporting reading, via the reference catalogue.
- [References](REFERENCES.md) — `DOCUMENTED_NOT_TESTED`: supporting sources.
- [ADR-0011 — E2E root-base build](adr/0011-e2e-root-base-build.md) — `DOCUMENTED_NOT_TESTED`: E2E harness runs against a root-base build (ADR).

## Explanation — concepts, context, reasons

- [Doc 13 — Wallet App Architecture](13-wallet-app-architecture/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 15 — Threat Model & Theft Prevention](15-threat-model-and-theft-prevention/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 16 — Security Decision Guide](16-security-decision-guide/README.md) — `DOCUMENTED_NOT_TESTED`.
- [How Bawa works](HOW-IT-WORKS.md) — `DOCUMENTED_NOT_TESTED`: system map and accuracy trace; describes the wallet as built on `panel-rebuild/token-gaps`.
- [Mainnet](mainnet/MAINNET-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: activation is `EXTERNALLY_DEPENDENT`; §5 SHA staleness is RESOLVED (M-33, 2026-11-10; T07 re-verification note 2026-11-12).
- [Architecture](../ARCHITECTURE.md) — `DOCUMENTED_NOT_TESTED`: code map, invariants, and boundaries.
- [Decisions](DECISIONS.md) — owner-delegated decisions register (ECDSA, confirmation policy, merges).
- [UI/UX Fixes programme](UI-UX-FIXES-PROGRAMME.md) — programme record: 21 items, merged into `panel-rebuild/token-gaps` (merge commit `4eb0242`).
- [UI/UX Round 2 programme](UI-UX-ROUND2-PROGRAMME.md) — programme record: 10 items, merged into `panel-rebuild/token-gaps` (merge commit `6147b74`).
- [Reverify + Professional Polish programme](REVERIFY-PROGRAMME.md) — programme record: 5 lanes, merged into `panel-rebuild/token-gaps`.
- [Reverify checklist](REVERIFY-CHECKLIST.md) — every owner order from 2026-11-22 through 2026-11-23 ~18:14 IST, with a verdict and evidence per order.
- [Marketing Fix + Found-Bugs programme](MARKETING-FIX-PROGRAMME.md) — programme record: first-impression defects, found bugs, value proposition, README rewrite, architecture diagrams, branch cleanup, QR templates, browser-first re-verification; merged into `panel-rebuild/token-gaps` (merge commit `571f0fb`).
- [Fix-All programme](FIX-ALL-PROGRAMME.md) — programme record: 10 lanes, branches under 4, file renames, 980 px breakpoint, docs to the new state; merged into `panel-rebuild/token-gaps` (merge commit `7c98420`).
- [README Marketing programme](README-MARKETING-PROGRAMME.md) — programme record: Showcase grid, Create-your-own block, marketing gaps; 7 of 10 landed, 3 blocked items later landed via the expansion programme; merged into `panel-rebuild/token-gaps` (commit `f065128`).
- [Token Everywhere programme](TOKEN-EVERYWHERE-PROGRAMME.md) — programme record: Add Token by ticker, verified marks, token send/receive, full names, QR card; merged into `panel-rebuild/token-gaps` (commit `047232e`).
- [Expansion programme](EXPANSION-PROGRAMME.md) — programme record: diagrams redrawn, captcha merge + FuckCaptcha import onto `main`, Solana sending, 22 → 84 chains, cold-load −43%; merged into `token-gaps` (commit `6c93e66`); `main` `7f9d364`.
- [Token Verify programme](TOKEN-VERIFY-PROGRAMME.md) — programme record: token verification by contract address, new-chains bug hunt, bundle gate kept, npm audit 9 → 0, all 28 icon-less chains get real icons; merged into `token-gaps` (commit `7f12de4`).
- [Deep Audit + Devnet E2E programme](DEEP-AUDIT-DEVNET-PROGRAMME.md) — programme record: 5-lane Deep Audit + Devnet E2E programme, merged into `panel-rebuild/token-gaps` (2026-11-23), branch `panel-rebuild/deep-audit-devnet`.
- [Finish Product programme](FINISH-PRODUCT-PROGRAMME.md) — programme record: Lane F merge record, merged into `panel-rebuild/token-gaps` as `8191b2c` (2026-11-23).

## Evidence and gates

- [Testing guide](TESTING.md) — `DOCUMENTED_NOT_TESTED`: test commands and scope; use the named results rather than assuming blanket coverage.
- [Security guidance](SECURITY.md) — `DOCUMENTED_NOT_TESTED`: security documentation, not independent approval.
- [Gap analysis](GAP-ANALYSIS.md) — `DOCUMENTED_NOT_TESTED`: what the wallet still lacks, which public repositories solve each gap (stars and licences checked live 2026-11-23), and where the fix belongs in the guide (Lane E, Deep Audit + Devnet E2E programme, 2026-11-23; gaps 21+ added by the coordinator from Lane B findings).

## Open items

- [Mainnet activation](mainnet/MAINNET-GUIDE.md) — `EXTERNALLY_DEPENDENT`: activation remains gated.

Note: the registry lives on `panel-rebuild/token-gaps`, not on `main` — there is no `registry/` directory on `main`. It covers 87 chains; network operations are verified for btc, eth, trx, ton only. See [Doc 12 — Chain Registry & Asset Metadata](12-chain-registry-and-assets/README.md), which interprets the upstream Trust Wallet Core registry.
