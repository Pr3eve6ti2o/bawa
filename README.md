# Bawa — HD Wallets, Derivation, Recovery & Tracking

Bawa is a practical, open-source reference for HD-wallet generation, public derivation, recovery, blockchain tracking, and payment reconciliation.

It is not a hosted wallet, custody service, exchange, or commercial product.

## What is in the repository

\`\`\`
standards
   ↓
chain-specific policy
   ↓
Trust Wallet Core reference implementation
   ↓
watch-only public derivation
   ↓
RPC / node / indexer
   ↓
wallet + payment tracking
   ↓
application database / reconciliation
\`\`\`

The key architectural rule is separation of responsibilities: a wallet library derives/signs; an RPC reads chain state; an indexer makes history searchable; an application decides whether an observed payment satisfies an order.

## Choose your use case

| Need | Read |
|---|---|
| Learn the cryptography | [01 — Fundamentals](docs/01-fundamentals/README.md) |
| Understand supported chain families | [02 — Chain Guides](docs/02-chains/README.md) |
| Choose the correct repository/library/API | [03 — Tool & Repository Map](docs/03-tools-and-repositories/README.md) |
| Generate wallet material safely | [04 — Wallet Generation](docs/04-wallet-generation/README.md) |
| Derive addresses without the seed | [05 — Watch-Only](docs/05-watch-only/README.md) |
| Track balances and history | [06 — Wallet Tracking](docs/06-tracking/README.md) |
| Track payments/orders | [07 — Payment Tracking](docs/07-payment-tracking/README.md) |
| Protect and recover the wallet | [08 — Security & Recovery](docs/08-security-recovery/README.md) |
| Understand signing, descriptors and PSBT | [09 — Signing & Hardware](docs/09-signing-and-hardware/README.md) |
| Install, test, operate and troubleshoot | [10 — Operations & Testing](docs/10-operations-and-testing/README.md) |
| Understand the implementation boundary | [Reference Implementation](IMPLEMENTATION.md) |
| Verify Trust Wallet Core independently | [Trust Wallet Core & Differential Verification](docs/11-trust-wallet-and-independent-verification/README.md) |
| Understand chain/asset metadata | [Chain Registry & Asset Metadata](docs/12-chain-registry-and-assets/README.md) |

## Reference implementation

The repository contains the reference implementation under tools/ rather than describing a code tree that exists elsewhere.

The current implementation uses @trustwallet/wallet-core as its wallet-crypto engine. Wallet Core's official usage guide covers wallet creation/import, address derivation, custom paths, and signing, while explicitly stating that node communication, balance retrieval and transaction broadcasting are outside Wallet Core's scope.

See the [official Wallet Core usage guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage).

The independent bip_utils implementation is used only for differential/reference testing where the same standards and paths overlap. It is not loaded by the production derivation runtime.

## Trust Wallet repositories: what each one is for

- **[Trust Wallet](https://github.com/trustwallet)** — the broader open-source ecosystem.
- **[Wallet Core](https://github.com/trustwallet/wallet-core)** — wallet keys, derivation, addresses and signing primitives; the primary reference engine used here.
- **[Trust Wallet Assets](https://github.com/trustwallet/assets)** — token/asset metadata, logos and token lists; it is not a wallet or signing library.
- **[@hdwallet/core](https://www.npmjs.com/package/@hdwallet/core)** — broad TypeScript HD-wallet project, but its current npm page states that it is still under development and not ready for production, so Bawa does not use it as the security-critical runtime engine.

## Chain registry policy

Trust Wallet Core's [registry.json](https://github.com/trustwallet/wallet-core/blob/master/registry.json) and [registry field documentation](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md) are useful compatibility references for coin IDs, derivation paths, curves, key formats, HRPs, chain IDs and related metadata.

They do not replace the protocol specification. Bawa treats network identity, derivation policy, address encoding and asset identity as separate concepts.

## Testing model

\`\`\`
official BIP/CIP/TEP vectors
           │
           ├───────────────┐
           ▼               ▼
   Trust Wallet Core    bip_utils
           │               │
           └──────┬────────┘
                  ▼
          independent comparison
                  │
                  ▼
          negative/security tests
\`\`\`

The repository does not claim that a self-check against the same implementation is sufficient evidence of production correctness.

## Primary standards and references

- [BIP-32](https://bips.dev/32/)
- [BIP-39](https://bips.dev/39/)
- [BIP-43](https://bips.dev/43/)
- [BIP-44](https://bips.dev/44/)
- [BIP-84](https://bips.dev/84/)
- [BIP-174 / PSBT](https://bips.dev/174/)
- [BIP-371](https://bips.dev/371/)
- [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md)
- [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)
- [TON TEP-3](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-guidelines-and-standards.md)
- [Cardano CIP-1852](https://cips.cardano.org/cip/CIP-1852)

## Security posture

Wallet generation belongs on a trusted interactive machine. The running application should receive public derivation material only when it does not need signing authority.

Do not put real mnemonics, private keys, data keys, or recovery files into source control, issues, chat, CI logs, or test fixtures.

Before calling the project production-ready, complete the remaining release gates described in docs/TESTING.md, including a committed dependency lockfile, full published vector coverage, independent differential testing, chain-specific fixtures, secret/dependency scanning, reproducible release artifacts, and external security review.
