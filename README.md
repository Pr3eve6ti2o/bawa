# Bawa HD-Wallet Guide

Use the full guide in [`docs/README-FULL.md`](docs/README-FULL.md) (2,834 lines) to understand HD wallets, derivation, recovery, and tracking if you build, review, or operate wallets. Trace secure randomness through mnemonics, deterministic keys, and chain-specific addresses; choose open-source repositories, create a wallet on a trusted machine, keep your runtime watch-only, allocate addresses safely, and track balances and history from $0. To try the runnable implementation, check out `main` and follow its `README.md`.

## Branch scope

On `hd-wallet-professional`, you have only this guide: no code, tests, `LICENSE`, or CI. The full guide lives in [`docs/README-FULL.md`](docs/README-FULL.md). Run setup and test commands in a checkout of `main`, which contains the runnable implementation, tests, `LICENSE`, `CONTRIBUTING`, `SECURITY`, and `CHANGELOG`.

## Why this guide exists — and when not to use it

Use this guide to understand and verify an HD-wallet implementation before you build or fund one. Check derivation, recovery, address allocation, and tracking behavior; decide when an RPC is enough and when you need an indexer.

Treat Bawa as a name, not a company, service, hosted wallet, custody provider, or commercial product. Do not use this guide as a shortcut to skip testing, or as a promise that any one library solves every chain.

## What this guide covers

The guide is one document, kept whole in [`docs/README-FULL.md`](docs/README-FULL.md). Use this map to find the part you need.

| Part | Sections |
|---|---|
| Start here | [Start here](docs/README-FULL.md#start-here) — the two questions people call "building a wallet": generating keys, and knowing what is happening on-chain |
| Foundations | [What this repository is for](docs/README-FULL.md#what-this-repository-is-for) · [The five layers you should not mix together](docs/README-FULL.md#the-five-layers-you-should-not-mix-together) · [HD wallets from first principles](docs/README-FULL.md#hd-wallets-from-first-principles) · [Mnemonic vs seed vs private key vs xpub](docs/README-FULL.md#mnemonic-vs-seed-vs-private-key-vs-xpub) · [BIP-32, hardened derivation and watch-only wallets](docs/README-FULL.md#bip-32-hardened-derivation-and-watch-only-wallets) · [BIP-44 paths, accounts, change and indexes](docs/README-FULL.md#bip-44-paths-accounts-change-and-indexes) · [Extended keys and version bytes](docs/README-FULL.md#extended-keys-and-version-bytes) |
| Chain families | [Chain families: what changes and what does not](docs/README-FULL.md#chain-families-what-changes-and-what-does-not) · [Bitcoin](docs/README-FULL.md#bitcoin) · [EVM chains](docs/README-FULL.md#evm-chains) · [TRON](docs/README-FULL.md#tron) · [TON](docs/README-FULL.md#ton) · [Solana](docs/README-FULL.md#solana) · [Cosmos / IBC](docs/README-FULL.md#cosmos--ibc) · [Cardano](docs/README-FULL.md#cardano) · [Polkadot / Substrate](docs/README-FULL.md#polkadot--substrate) · [XRP Ledger](docs/README-FULL.md#xrp-ledger) · [Litecoin, Dogecoin and Bitcoin-like networks](docs/README-FULL.md#litecoin-dogecoin-and-bitcoin-like-networks) · [So which repository should I use?](docs/README-FULL.md#so-which-repository-should-i-use) |
| Tools and implementation | [Repository and tool map](docs/README-FULL.md#repository-and-tool-map) · [Bawa's implementation: exactly what it does](docs/README-FULL.md#bawas-implementation-exactly-what-it-does) |
| Running it | [Running Bawa from a clean machine](docs/README-FULL.md#running-bawa-from-a-clean-machine) · [Generating the wallet safely](docs/README-FULL.md#generating-the-wallet-safely) · [What gets written to disk](docs/README-FULL.md#what-gets-written-to-disk) · [Running the watch-only derivation tools](docs/README-FULL.md#running-the-watch-only-derivation-tools) |
| Allocation and tracking | [Address allocation: the part Bawa cannot solve for you](docs/README-FULL.md#address-allocation-the-part-bawa-cannot-solve-for-you) · [Tracking a wallet for $0](docs/README-FULL.md#tracking-a-wallet-for-0) · [Free → low-cost → paid → self-hosted tracking](docs/README-FULL.md#free--low-cost--paid--self-hosted-tracking) · [RPC is not an indexer](docs/README-FULL.md#rpc-is-not-an-indexer) · [UTXO tracking vs account tracking](docs/README-FULL.md#utxo-tracking-vs-account-tracking) · [EVM token and NFT tracking](docs/README-FULL.md#evm-token-and-nft-tracking) · [Reorganizations, finality and confirmations](docs/README-FULL.md#reorganizations-finality-and-confirmations) · [Gap limits and discovering an HD wallet](docs/README-FULL.md#gap-limits-and-discovering-an-hd-wallet) · [Privacy: xpubs are not spending keys, but they are sensitive](docs/README-FULL.md#privacy-xpubs-are-not-spending-keys-but-they-are-sensitive) |
| Safety | [Backup and recovery](docs/README-FULL.md#backup-and-recovery) · [Signing: keep it separate from tracking](docs/README-FULL.md#signing-keep-it-separate-from-tracking) · [Hardware wallets](docs/README-FULL.md#hardware-wallets) |
| Verification | [Testing a wallet properly](docs/README-FULL.md#testing-a-wallet-properly) · [Dependency and supply-chain discipline](docs/README-FULL.md#dependency-and-supply-chain-discipline) |
| When things go wrong, and building on it | [Common mistakes](docs/README-FULL.md#common-mistakes) · [Troubleshooting](docs/README-FULL.md#troubleshooting) · [A sensible architecture for different sizes of project](docs/README-FULL.md#a-sensible-architecture-for-different-sizes-of-project) · [How to adapt this repository to another chain](docs/README-FULL.md#how-to-adapt-this-repository-to-another-chain) |
| Closing | [What this guide does not promise](docs/README-FULL.md#what-this-guide-does-not-promise) · [Professional checklist](docs/README-FULL.md#professional-checklist) · [Primary references](docs/README-FULL.md#primary-references) · [Final thought](docs/README-FULL.md#final-thought) · [Using Bawa with Nova Shop](docs/README-FULL.md#using-bawa-with-nova-shop) |

## Quickstart

### Requires

- Use a Unix-like environment, recommended for the interactive `/dev/tty` generation flow.
- Install Node.js `>=22 <23`, npm, and Python 3.11+.
- Use a Python virtual environment, created below, and ensure you have enough disk space.
- Use an offline or trusted machine for actual wallet generation. Do not generate a real wallet on a random online shell or CI runner.

### Start in

Use a checkout of `main`. The `hd-wallet-professional` branch contains only the guide, with no code or tests. Run these commands on `main`, not on the guide-only branch.

```bash
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
git switch main

npm install
```

If the root package is only an orchestration shell, install the wallet-core tooling as directed by its package boundary:

```bash
cd tools/hdwallet-gen
npm install
cd ../..
```

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Run main's documented root check; it delegates to tools/hdwallet-gen.
npm test
```

### Expected result

Expect a clean install with no errors and `npm test` passing on `main`.

### Next

Read the [full guide](docs/README-FULL.md). Consult the guide's "Running Bawa from a clean machine" section for the full detail.

## What this guide does not promise

You will not find code or tests on this guide-only branch. No wallet implementation is universally perfect. Treat this guide as a reference, not as a hosted wallet, custody provider, or commercial product.

## Contributing, help, and license

Before contributing, read [`CONTRIBUTING.md`](https://github.com/Pr3eve6ti2o/bawa/blob/main/CONTRIBUTING.md) on `main`. If you find a problem with this guide, open an issue on the [repository](https://github.com/Pr3eve6ti2o/bawa).

For security reporting instructions, read [`SECURITY.md`](https://github.com/Pr3eve6ti2o/bawa/blob/main/SECURITY.md) on `main`.

Check [`CHANGELOG.md`](https://github.com/Pr3eve6ti2o/bawa/blob/main/CHANGELOG.md) on `main` for recorded changes.

Read [`LICENSE`](https://github.com/Pr3eve6ti2o/bawa/blob/main/LICENSE) on `main` for licensing information. This branch does not include a license file.

## Further reading

Read the guide's [Primary references](docs/README-FULL.md#primary-references) in the verbatim full guide for BIP-32, BIP-39, BIP-44, and the other cited standards. Browse [`docs/` on `main`](https://github.com/Pr3eve6ti2o/bawa/tree/main/docs) for guides 01–16, the FAQ, the glossary, and further reading.
