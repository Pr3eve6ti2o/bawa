---
title: Further reading
description: Primary specifications, Wallet Core sources, vendor documentation and community research to consult alongside this guide set; every link verified live on 8 November 2026 unless noted.
last-updated: 2026-11-08
---

# Further reading

Reference. Use the specifications as the authority on requirements, not as evidence of what Bawa implements.

## Contents

- [Primary specifications](#primary-specifications)
- [Bawa and upstream Wallet Core](#bawa-and-upstream-wallet-core)
- [Vendor documentation](#vendor-documentation)
- [Community research](#community-research)

## Primary specifications

Use these specifications as the authority on requirements, not as evidence of what Bawa implements. Consult the chain-family primary sources alongside docs/02.

| Source | How to use it |
| --- | --- |
| [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) | Check the requirements for deriving a deterministic tree of wallet keys from a seed. |
| [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) | Check how entropy becomes a mnemonic phrase and how the words, with an optional passphrase, produce a seed. |
| [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) | Review the five path levels for multi-account wallets: purpose, coin type, account, change and address index. |
| [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki) | Check the requirements in the canonical BIP-49 specification. |
| [BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki) | Check the requirements in the canonical BIP-86 specification. |
| [BIP-174](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki) | Review PSBT's structure for carrying unsigned transactions, signing data and partial signatures between wallet tools. |
| [SLIP-39](https://github.com/satoshilabs/slips/blob/master/slip-0039.md) | Check the requirements for Shamir-based mnemonic shares, with 20 words for 128-bit secrets and 33 words for 256-bit secrets. |
| [Bitcoin Core descriptors](https://raw.githubusercontent.com/bitcoin/bitcoin/master/doc/descriptors.md) | Check output-script notation, including script types, ways to express keys and checksum rules. |
| [Solana](https://github.com/solana-labs/solana/blob/master/docs/src/clusters.md) | Consult this primary source alongside the Solana coverage in docs/02. |
| [Cosmos documentation](https://docs.cosmos.network/) | Consult this primary source alongside the Cosmos coverage in docs/02. |
| [Cardano CIP-0003](https://cips.cardano.org/cip/CIP-0003) | Read CIP-0003 as the primary Cardano reference alongside docs/02. |
| [Polkadot keyring documentation](https://polkadot.js.org/docs/keyring/start) | Consult this primary source alongside the Polkadot coverage in docs/02. |
| [XRP documentation](https://xrpl.org/docs/) | Consult this primary source alongside the XRP coverage in docs/02. |

## Bawa and upstream Wallet Core

Use these for integration guidance on multi-coin wallet creation and import, address derivation and signing, not as a guarantee of Bawa's behaviour. Do not expect Wallet Core itself to handle network communication.

| Source | How to use it |
| --- | --- |
| [Wallet Core repository README](https://github.com/trustwallet/wallet-core) | Read the README for the upstream, cross-platform wallet library on which Bawa's tools depend. |

## Vendor documentation

Treat these as the vendors' descriptions of their own products and claims, not as independent verification.

| Source | How to use it |
| --- | --- |
| [Coldcard MicroSD signing](https://coldcard.com/guides/using-coldcard/coldcard-microsd-signing) | Read Coldcard's guidance on moving a Sparrow PSBT by MicroSD for air-gapped signing, then returning the signed file to Sparrow. |
| [Trezor multi-share backup](https://trezor.io/guides/backups-recovery/advanced-wallets/create-a-wallet-with-multi-share-backup) | Review Trezor's guidance on creating a wallet whose backup is divided into shares on Safe devices and Model T. |
| [Trezor multisig guide](https://trezor.io/learn/a/multisig) | Read Trezor's explanation of 2-of-3 and 3-of-5 multisig signing, key rotation and the distinction between multisig and Shamir backup. |
| [Casa vaults](https://casa.io/vault) | Review Casa's description of assisted multisig vaults, key replacement and recovery without its service through open-source tools. |
| [BitBox02 multisig (BitBox support hub)](https://support.bitbox.swiss/) | Start at the support hub to re-check BitBox02 guidance on multisig risks, backing up co-signer details and registering the setup, rather than relying on the former blog URL. |

## Community research

Use this for experience and explanation, not as a specification.

| Source | How to use it |
| --- | --- |
| [MPC wallets explainer](https://www.bitcoin.com/wallet/what-is-an-mpc-wallet/) | Compare MPC threshold signing with Shamir secret sharing and multisig, and examine why custody depends on who owns and controls the shares. |

Before relying on anything here, re-check current implementation behaviour. Never put a real mnemonic, seed or private key into any example or test.
