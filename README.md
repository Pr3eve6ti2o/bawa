# Bawa — HD Wallets, Derivation, Recovery & Tracking
Bawa is an open-source field guide for developers and operators working with HD wallets. It explains derivation, recovery, and tracking; start with [01 — Fundamentals](docs/01-fundamentals/README.md).

The `docs-usecase-split` branch is documentation-only. The guide is split into 10 numbered use-case sections under [`docs/`](docs/). This branch contains no code, tests, CI, releases, or runnable commands.

## What the guide covers

Use the guide to:

- Learn how HD wallets work and how derivation rules differ across chains.
- Choose a repository, library, or API for your task.
- Learn to create wallet material safely and keep your online system watch-only.
- Learn to track wallets and payments from $0 upward.
- Plan recovery, signing, operations, and testing for your own setup.

## Why this exists — and when not to use it

HD-wallet knowledge is scattered across standards and repositories. This guide groups it by use case so you can find the references relevant to your task.

Bawa is not a company, service, hosted wallet, custody provider, or commercial product. Do not use it as a hosted wallet, a custody service, or a substitute for auditing your own setup.

## Quickstart: 30-second reading path

There is no installation step on this branch. Choose one path:

- Read [01 — Fundamentals](docs/01-fundamentals/README.md) first to learn the HD-wallet basics.
- Jump straight to [your use case](#choose-your-use-case) if you have a specific task.

## Usage

Choose the section that matches your task. Installation and testing topics refer to wallet setups, not software shipped on this branch.

### Choose your use case

| Need | Read |
|---|---|
| Learn the cryptography | [01 — Fundamentals](docs/01-fundamentals/README.md) |
| Understand Bitcoin/EVM/TRON/TON/Solana/Cosmos/Cardano/Substrate/XRPL | [02 — Chain Guides](docs/02-chains/README.md) |
| Choose the correct repo/library/API | [03 — Tool & Repository Map](docs/03-tools-and-repositories/README.md) |
| Generate the wallet once | [04 — Wallet Generation](docs/04-wallet-generation/README.md) |
| Derive addresses without the seed | [05 — Watch-Only](docs/05-watch-only/README.md) |
| Track balances and history | [06 — Wallet Tracking](docs/06-tracking/README.md) |
| Track actual payments/orders | [07 — Payment Tracking](docs/07-payment-tracking/README.md) |
| Protect and recover it | [08 — Security & Recovery](docs/08-security-recovery/README.md) |
| Understand descriptors, PSBT and hardware signing | [09 — Signing & Hardware](docs/09-signing-and-hardware/README.md) |
| Install, test, operate and troubleshoot | [10 — Operations & Testing](docs/10-operations-and-testing/README.md) |

### The whole stack

```
secure entropy → mnemonic → seed → HD derivation
                                      │
                                      ├── private/signing side
                                      │
                                      └── public/watch-only side
                                                │
                                                ▼
                                      RPC / node / indexer
                                                │
                                                ▼
                                      tracking / reconciliation
                                                │
                                                ▼
                                      application database/UI
```

The central lesson is separation of responsibilities. A wallet library is not automatically an indexer. An RPC endpoint is not automatically a payment reconciler. A payment watcher is not a signer.

### What “perfect” means

“Perfect HD wallet” is not a protocol term. The useful target for your setup is:

- Explicit derivation rules.
- Chain-specific correctness.
- A clean trust boundary.
- Reproducible recovery.
- Independent testing.
- Disciplined dependencies.
- An operational architecture that matches the blockchain you watch.

These are criteria for your own setup, not claims about tests or software on this branch.

## Documentation and support

- [All use-case sections](docs/)
- [Primary standards and projects](docs/standards.md)
- [Security and recovery guidance](docs/08-security-recovery/README.md)
- [Security policy](SECURITY.md)
- [Operations, testing, and troubleshooting](docs/10-operations-and-testing/README.md)

For documentation questions, cite the relevant filename and passage. Do not share seed phrases, private keys, or other wallet secrets.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Propose documentation corrections or additions for `docs-usecase-split`. Include the affected filename, the reason for the change, and primary sources for technical claims. Keep changes documentation-only.

## Maintainers

This README does not list maintainer names or contact details.

## License

Licensed under the [MIT License](LICENSE).