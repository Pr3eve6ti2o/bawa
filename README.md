# Bawa — HD Wallets, Derivation, Recovery & Tracking

Bawa is just a name.

This repository is a one-time, open-source field guide. It explains how HD wallets work, which repository or library is appropriate for each job, how to create wallet material safely, how to keep an online system watch-only, and how to track wallets and payments from $0 upward.

It is not a company, service, hosted wallet, custody provider, or commercial product.

## Choose your use case

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

## The whole stack

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

## What “perfect” means

“Perfect HD wallet” is not a protocol term. The useful target is explicit derivation rules, chain-specific correctness, a clean trust boundary, reproducible recovery, independent testing, disciplined dependencies, and an operational architecture that matches the blockchain being watched.

## Primary standards and projects

- [BIP-32](https://bips.dev/32/)
- [BIP-39](https://bips.dev/39/)
- [BIP-44](https://bips.dev/44/)
- [BIP-84](https://bips.dev/84/)
- [BIP-174 / PSBT](https://bips.dev/174/)
- [Trust Wallet Core](https://github.com/trustwallet/wallet-core)
- [Bitcoin Core](https://github.com/bitcoin/bitcoin)
- [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)
- [Solana RPC](https://solana.com/docs/rpc)
- [TON TEP-3](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md)
- [Cardano CIP-1852](https://cips.cardano.org/cip/CIP-1852)
- [Cosmos Chain Registry](https://github.com/cosmos/chain-registry)