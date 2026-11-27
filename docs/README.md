# Bawa Documentation

Choose the guide for your job. You do not need to read everything. For a full path through guides 01–16, follow the [recommended reading order](#recommended-reading-order). You can also read the [preserved full README](README-FULL.md).

## Tutorials — learn through doing

- [04 — Wallet Generation](04-wallet-generation/README.md) — **Tutorial:** learn by generating a wallet. Read [Fundamentals](01-fundamentals/README.md) for the concepts.

## How-to guides — accomplish a goal

- [05 — Watch-Only Derivation](05-watch-only/README.md) — **How-to guide:** set up watch-only derivation.
- [06 — Wallet Tracking](06-tracking/README.md) — **How-to guide:** track wallet activity.
- [07 — Payment Tracking](07-payment-tracking/README.md) — **How-to guide:** track payments. For wallet-level tracking, use [Wallet Tracking](06-tracking/README.md).
- [08 — Security & Recovery](08-security-recovery/README.md) — **How-to guide:** plan wallet security and recovery. Use [Recovery](RECOVERY.md) for recovery-specific guidance.
- [10 — Operations & Testing](10-operations-and-testing/README.md) — **How-to guide:** operate and test your setup. Consult [Testing](TESTING.md) for supporting guidance.
- [11 — Trust Wallet Core & Independent Verification](11-trust-wallet-and-independent-verification/README.md) — **How-to guide:** carry out independent verification when you use Trust Wallet Core.
- [16 — Security Decision Guide](16-security-decision-guide/README.md) — **How-to guide:** make security decisions for your wallet. Read [Threat Model & Theft Prevention](15-threat-model-and-theft-prevention/README.md) for the concepts behind those decisions.
- [Recovery](RECOVERY.md) — **How-to guide:** use the supporting recovery guidance when you need to recover a wallet.
- [09 — Signing, Descriptors, PSBT & Hardware](09-signing-and-hardware/README.md) — **How-to guide:** work with signing, descriptors, PSBT and hardware.
- [13 — Wallet App Architecture](13-wallet-app-architecture/README.md) — **How-to guide:** structure a wallet app. Continue with [Wallet App Implementation](14-wallet-app-implementation/README.md) when you want to implement it.
- [14 — Wallet App Implementation](14-wallet-app-implementation/README.md) — **How-to guide:** implement a wallet app. Use [Wallet App Architecture](13-wallet-app-architecture/README.md) for design context.
- [Wallet lifecycle](wallet-lifecycle.md) — **How-to guide:** follow the unlock, sign, broadcast and refresh order for the web wallet on `panel-rebuild/token-gaps`.

### Platform guides

- [Web wallet guide](web-wallet/WEB-GUIDE.md) — **How-to guide:** work on a web wallet.
- [Android wallet guide](android-wallet/ANDROID-GUIDE.md) — **How-to guide:** work on an Android wallet.

## Reference — look up information

- [02 — Chain Guides](02-chains/README.md) — **Reference (classified by cross-chain comparison-table content):** find guidance for the chain you are working with. Worked examples use mainnet format unless labelled testnet.
- [03 — Tool & Repository Map](03-tools-and-repositories/README.md) — **Reference (classified by tool and repository lookup-table content):** find tools and repositories for your task.
- [12 — Chain Registry & Asset Metadata](12-chain-registry-and-assets/README.md) — **Reference:** look up chain registry and asset metadata.
- [Mainnet guide](mainnet/MAINNET-GUIDE.md) — **Reference:** consult the mainnet-related guidance. Its existence is **not evidence of mainnet support or readiness**.
- [Glossary](GLOSSARY.md) — **Reference:** check the meaning of an unfamiliar term.
- [FAQ](FAQ.md) — **Reference:** find answers to common questions.
- [Further reading](FURTHER-READING.md) — **Reference:** choose what to read next.
- [References](REFERENCES.md) — **Reference:** find the referenced sources.
- [ADR-0011 — E2E root-base build](adr/0011-e2e-root-base-build.md) — **Reference:** the E2E harness runs against a root-base build (ADR).

## Explanation — understand concepts and reasons

- [01 — Fundamentals](01-fundamentals/README.md) — **Explanation:** understand the fundamentals before you choose software or run it.
- [15 — Threat Model & Theft Prevention](15-threat-model-and-theft-prevention/README.md) — **Explanation:** understand threats and the reasons for theft-prevention measures before you make security decisions.
- [Security](SECURITY.md) — **Explanation:** understand the trust boundaries and security posture. For decisions, use the [Security Decision Guide](16-security-decision-guide/README.md).
- [Testing](TESTING.md) — **Explanation:** understand the layered testing strategy. For operations and testing tasks, use [Operations & Testing](10-operations-and-testing/README.md).
- [How Bawa works](HOW-IT-WORKS.md) — **Explanation:** the system map and accuracy trace; describes the wallet as built on `panel-rebuild/token-gaps`.
- [Deep Audit + Devnet E2E programme](DEEP-AUDIT-DEVNET-PROGRAMME.md) — **Explanation:** programme record for the 5-lane Deep Audit + Devnet E2E programme, merged into `panel-rebuild/token-gaps` (2026-11-23).
- [Finish Product programme](FINISH-PRODUCT-PROGRAMME.md) — **Explanation:** programme record for the Lane F merge, merged into `panel-rebuild/token-gaps` as `8191b2c` (2026-11-23).

## Recommended reading order

Fundamentals → Chains → Tool Map → Generation → Watch-Only → Tracking → Payment Tracking → Security/Recovery → Signing → Operations/Testing → Trust Wallet Verification → Chain Registry → Wallet App Architecture → Wallet App Implementation → Threat Model → Security Decision Guide.

The opening sequence is deliberate: first understand the rule, then choose software, then run it for one-time generation (04), then watch the network, then build application logic around what the network reports; later guides extend that foundation with security and recovery (08), signing (09), operations and testing (10), verification (11), the registry (12), the threat model (15), and security decisions (16).