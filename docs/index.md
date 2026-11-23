# Documentation index

This index is the single entry point for Bawa documentation on `main`; the root [README.md](../README.md) and [docs/README.md](README.md) each point here.

The AI Wallet Builder itself — registries, starters, scripts, and the example web wallet — lives on the active development branch (`panel-rebuild/token-gaps`); this index lists only what exists on `main`.

This index maps Bawa's wallet reference and guide: where to start, where the implementation lives, what has been checked and what remains open. It is organised by purpose, after Diátaxis: tutorials teach by doing, how-to guides solve a task, reference states facts, explanation builds understanding. Statuses reflect the evidence recorded on 10 November 2026, with the 20 November 2026 re-verifications and the 23 November 2026 re-verifications named below (engine smoke 217, web vitest 90 files, 1718 passed + 5 skipped, quality-gates run); passing local checks does not establish mainnet readiness.

## Start here

- [AGENTS.md](../AGENTS.md) — `DOCUMENTED_NOT_TESTED`: read first for repository instructions.
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

## Explanation — concepts, context, reasons

- [Doc 13 — Wallet App Architecture](13-wallet-app-architecture/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 15 — Threat Model & Theft Prevention](15-threat-model-and-theft-prevention/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Doc 16 — Security Decision Guide](16-security-decision-guide/README.md) — `DOCUMENTED_NOT_TESTED`.
- [Mainnet](mainnet/MAINNET-GUIDE.md) — `DOCUMENTED_NOT_TESTED`: activation is `EXTERNALLY_DEPENDENT`; §5 SHA staleness is RESOLVED (M-33, 2026-11-10; T07 re-verification note 2026-11-12).
- [Architecture](../ARCHITECTURE.md) — `DOCUMENTED_NOT_TESTED`: code map, invariants, and boundaries.
- [Decisions](DECISIONS.md) — owner-delegated decisions register (ECDSA, confirmation policy, merges).
- [UI/UX Fixes programme](UI-UX-FIXES-PROGRAMME.md) — programme record: 21 items, merged into `panel-rebuild/token-gaps` (merge commit `4eb0242`).
- [UI/UX Round 2 programme](UI-UX-ROUND2-PROGRAMME.md) — programme record: 10 items, merged into `panel-rebuild/token-gaps` (merge commit `6147b74`).
- [Reverify + Professional Polish programme](REVERIFY-PROGRAMME.md) — programme record: 5 lanes, merged into `panel-rebuild/token-gaps`.
- [Reverify checklist](REVERIFY-CHECKLIST.md) — every owner order from 2026-11-22 through 2026-11-23 ~18:14 IST, with a verdict and evidence per order.

## Evidence and gates

- [Testing guide](TESTING.md) — `DOCUMENTED_NOT_TESTED`: test commands and scope; use the named results rather than assuming blanket coverage.
- [Security guidance](SECURITY.md) — `DOCUMENTED_NOT_TESTED`: security documentation, not independent approval.
- [Gap analysis](GAP-ANALYSIS.md) — `DOCUMENTED_NOT_TESTED`: what the wallet still lacks, which public repositories solve each gap (stars and licences checked live 2026-11-23), and where the fix belongs in the guide (Lane E, Deep Audit + Devnet E2E programme, 2026-11-23; gaps 21+ added by the coordinator from Lane B findings).

## Open items

- [Mainnet activation](mainnet/MAINNET-GUIDE.md) — `EXTERNALLY_DEPENDENT`: activation remains gated.

The registry covers 22 chains: btc, eth, trx, ton, sol, bsc, matic, arb, op, base, avax, ltc, doge, gnosis, celo, linea, mantle, scroll, opbnb, metis, aurora, fantom. Chain-level IMPLEMENTED_AND_VERIFIED means verified in at least one explicitly identified profile. Network operations are verified for btc, eth, trx, ton only. The 18 additional chains are scoped to the multichain-extended-wallet profile. The 13-chain registry in registry/capabilities.json (chainSupport) was merged into adopt-proper from panel-rebuild/multichain-create; the 9 newer EVM chains were added afterwards on panel-rebuild/token-gaps. It is not a separate branch.
