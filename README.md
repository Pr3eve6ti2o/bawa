# Bawa

Use Bawa, a practical open-source reference for developers building wallet tooling and learning HD-wallet standards (BIP-32/39/44/84), to generate HD wallets, derive addresses from public keys, recover wallets, track blockchain activity, and reconcile payments. [Try it in the Quickstart](#quickstart).

Version: `1.2.0`. License: MIT. Wallet-crypto engine: `@trustwallet/wallet-core` `4.9.3`. You are using a reference, not a hosted wallet, custody service, or exchange.

## Quickstart

Use Node `>=22 <23` and Python `>=3.11`. Run the commands below, which the maintainer ran and verified on Node `22.23.4`.

Install dependencies and run the smoke checks:

```sh
npm --prefix tools/hdwallet-gen install
npm test
```

Expected output from `npm test`:

```text
smoke checks: PASS
```

Derive a deposit address from the public test fixture. Its mnemonic is public, and the fixture has never been funded.

```sh
echo "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9" | node tools/hdwallet-gen/derive.js btc 0
```

Expected output:

```text
bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd
```

## Usage

Use the public test fixtures below to compare your results with the expected outputs, verified by the maintainer on Node 22.23.4. Supply public extended keys only; the tools accept only those keys and refuse private keys.

### Ethereum

Derive an Ethereum address at index `0` from its account xpub:

```sh
echo "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc" | node tools/hdwallet-gen/derive.js eth 0
```

Expected output:

```text
0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7
```

### TRON

Derive a TRON address at index `0` from its account xpub:

```sh
echo "xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF" | node tools/hdwallet-gen/derive.js trx 0
```

Expected output:

```text
TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c
```

Use these derivation paths, where `i` is the address index:

| Chain | Derivation path |
| --- | --- |
| BTC | `m/84'/0'/0'/0/i` |
| ETH | `m/44'/60'/0'/0/i` |
| TRX | `m/44'/195'/0'/0/i` |

Read the full guides in [`docs/04-wallet-generation/README.md`](docs/04-wallet-generation/README.md) for wallet generation and [`docs/05-watch-only/README.md`](docs/05-watch-only/README.md) for watch-only derivation.

## Documentation

Choose your use case:

| Need | Read |
| --- | --- |
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
| Understand the implementation boundary | [Architecture](ARCHITECTURE.md) |
| Verify Trust Wallet Core independently | [Trust Wallet Core & Differential Verification](docs/11-trust-wallet-and-independent-verification/README.md) |
| Understand chain/asset metadata | [Chain Registry & Asset Metadata](docs/12-chain-registry-and-assets/README.md) |
| Standards and upstream references | [Canonical References](docs/REFERENCES.md) |

The previous version of this README is preserved in full at [docs/README-FULL.md](docs/README-FULL.md).

## Reference implementation

The implementation lives under `tools/`. It uses `@trustwallet/wallet-core` 4.9.3 as its wallet-crypto engine. Wallet Core's official usage guide covers wallet creation and import, address derivation, custom paths, and signing; node communication, balance retrieval, and transaction broadcasting are outside Wallet Core's scope. See the [Wallet Core developer documentation](https://developer.trustwallet.com/wallet-core).

`bip_utils` is a pinned reference-test dependency only. It is not loaded by the production derivation runtime.

Trust Wallet Assets supplies token and asset metadata; it is not a wallet or signing library. `@hdwallet/core` is not used by the runtime.

Trust Wallet Core's [registry.json](https://github.com/trustwallet/wallet-core/blob/master/registry.json) and [registry field documentation](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md) are compatibility references for coin IDs, derivation paths, curves, key formats, HRPs, and chain IDs. They do not replace the protocol specification. Bawa treats network identity, derivation policy, address encoding, and asset identity as separate concepts.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the runtime boundary, the reference policy, and the verification layers.

## Why this exists — and when not to use it

Use Bawa as a reference for building wallet tooling correctly: put standards (BIP-32/39/44/84) first, keep public derivation separate from signing, and use a wallet library to derive and sign while an RPC reads chain state. Do not use it as a hosted wallet, custody service, or exchange. Do not use it for real-money deployment before completing the release gates in [`docs/TESTING.md`](docs/TESTING.md).

## Contributing

Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) when you contribute changes.

## Help

Open an issue in this repository to report problems to the repository maintainers. Follow [`SECURITY.md`](SECURITY.md) for security reports.

## License

Read [`LICENSE`](LICENSE) for the MIT license terms.
