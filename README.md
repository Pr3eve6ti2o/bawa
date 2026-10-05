# Bawa — HD Wallets, Derivation, Recovery & Tracking

NaN

NaN

NaN

## Choose your use case

| Need | Read |
|---|---|
| Understand the cryptography | [01 — Fundamentals](docs/01-fundamentals/README.md) |
| Understand chain-specific derivation | [02 — Chain Guides](docs/02-chains/README.md) |
| Choose the right repo/library/API | [03 — Tool & Repository Map](docs/03-tools-and-repositories/README.md) |
| Generate a wallet once | [04 — Wallet Generation](docs/04-wallet-generation/README.md) |
| Derive addresses without the seed | [05 — Watch-Only](docs/05-watch-only/README.md) |
| Track balances/history from free upward | [06 — Wallet Tracking](docs/06-tracking/README.md) |
| Track actual payments/orders | [07 — Payment Tracking](docs/07-payment-tracking/README.md) |
| Protect and recover wallet material | [08 — Security & Recovery](docs/08-security-recovery/README.md) |
| Sign safely with PSBT/descriptors/hardware | [09 — Signing & Hardware](docs/09-signing-and-hardware/README.md) |
| Install, test, operate and troubleshoot | [10 — Operations & Testing](docs/10-operations-and-testing/README.md) |

## The whole stack

NaN
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
NaN

NaN

## What “perfect” means here

NaN

## Primary references

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