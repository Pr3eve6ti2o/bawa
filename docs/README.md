# Bawa Documentation

This docs-only branch splits the guide into 10 numbered use-case sections under `docs/`, with a separate standards reference. It contains no code, tests, CI, or releases. Read only what you need, then follow the links for details.

## Guide map

Each page has one primary Diátaxis purpose, shown below.

| Page | Primary purpose | Scope |
| --- | --- | --- |
| [01 — Fundamentals](01-fundamentals/README.md) | Explanation | First principles, standards, and terminology: BIP-32, hardened derivation, BIP-44 paths, and extended keys. |
| [02 — Chain Guides](02-chains/README.md) | Reference | Per-chain facts for Bitcoin, EVM, TRON, TON, Solana, Cosmos, Cardano, Substrate, XRPL, and Litecoin/Dogecoin. |
| [03 — Tool & Repository Map](03-tools-and-repositories/README.md) | Reference | Which repository or service to use for each specific job. |
| [04 — Wallet Generation](04-wallet-generation/README.md) | How-to | Generate a wallet, record recovery data, and verify the result during the one-time trusted operation. |
| [05 — Watch-Only Derivation](05-watch-only/README.md) | How-to | Run the watch-only derivation tools and allocate addresses. |
| [06 — Wallet Tracking](06-tracking/README.md) | How-to | Track a wallet for $0; free, low-cost, paid, and self-hosted options; RPC vs. indexer; UTXO vs. account tracking. |
| [07 — Payment Tracking](07-payment-tracking/README.md) | How-to | Follow a real payment-tracking example and reconcile payments; payment requests are not payments. |
| [08 — Security & Recovery](08-security-recovery/README.md) | Explanation | Privacy, trust boundaries, backup and recovery, and what the guide does not promise. |
| [09 — Signing & Hardware](09-signing-and-hardware/README.md) | Explanation | Signing kept separate from tracking; hardware wallets, descriptors, and PSBT. |
| [10 — Operations & Testing](10-operations-and-testing/README.md) | How-to | Install, run, test, and troubleshoot from a clean machine. |
| [Standards](standards.md) | Reference | BIP and project links. |

## Recommended reading order

Fundamentals → Chains → Tool Map → Generation → Watch-Only → Tracking → Payment Tracking → Security/Recovery → Signing → Operations/Testing.

The order is deliberate: first understand the rule, then choose software, then run it, then watch the network, then build application logic around what the network reports.