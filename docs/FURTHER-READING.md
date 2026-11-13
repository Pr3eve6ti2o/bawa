---
title: Further reading
description: Primary specifications, Wallet Core sources, vendor documentation and community research to consult alongside this guide set; Link availability was checked on 9 November 2026. Known exceptions and verified alternatives are noted alongside the affected links. Availability is not evidence of what Bawa implements.
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
| [SLIP-39](https://github.com/satoshilabs/slips/blob/master/slip-0039.md) | Check the requirements for Shamir-based mnemonic shares, with 20 words for 128-bit secrets and 33 words for 256-bit secrets. Note (9 November 2026): the GitHub blob link returned HTTP 429 (rate-limiting, not dead); the same file via https://raw.githubusercontent.com/satoshilabs/slips/master/slip-0039.md returned HTTP 200. |
| [Bitcoin Core descriptors](https://raw.githubusercontent.com/bitcoin/bitcoin/master/doc/descriptors.md) | Check output-script notation, including script types, ways to express keys and checksum rules. |
| [Solana](https://docs.solana.com/clusters) | Consult this primary source alongside the Solana coverage in docs/02. Note (9 November 2026): the former destination returned HTTP 404; this replacement was verified HTTP 200. |
| [Cosmos documentation](https://docs.cosmos.network/) | Consult this primary source alongside the Cosmos coverage in docs/02. |
| [Cardano CIP-0003](https://cips.cardano.org/cip/CIP-0003) | Read CIP-0003 as the primary Cardano reference alongside docs/02. |
| [Polkadot keyring documentation](https://polkadot.js.org/docs/keyring/start) | Consult this primary source alongside the Polkadot coverage in docs/02. |
| [XRP documentation](https://xrpl.org/docs/) | Consult this primary source alongside the XRP coverage in docs/02. |

## Bawa and upstream Wallet Core

Use these for integration guidance on multi-coin wallet creation and import, address derivation and signing, not as a guarantee of Bawa's behaviour. Do not expect Wallet Core itself to handle network communication.

| Source | How to use it |
| --- | --- |
| [Wallet Core repository README](https://github.com/trustwallet/wallet-core) | Read the README for the upstream, cross-platform wallet library on which Bawa's tools depend. |
| [Wallet Core releases](https://github.com/trustwallet/wallet-core/releases) | Check release notes and tags: the repository tools' installed pin is `4.8.4`; the latest stable is `4.9.3` (not yet adopted). |
| [Wallet Core 4.9.2 release](https://github.com/trustwallet/wallet-core/releases/tag/4.9.2) | The demonstrated reference version (D21 construction/signing only, 2026-11-08; GitHub pre-release, tag `4.9.2`, commit `17e3cd4df5d53f061ade3bbdc07d196f5ed5a8e3`); re-pin and re-verify whenever the Core pin moves. |
| [Wallet Core registry (4.9.2)](https://raw.githubusercontent.com/trustwallet/wallet-core/4.9.2/registry.json) | The upstream registry data interpreted by docs/12; pinned at tag 4.9.2. |
| [Wallet Core BC footguns (4.9.2)](https://github.com/trustwallet/wallet-core/blob/4.9.2/docs/bc-footguns.md) | Known backward-compatibility constraints for Wallet Core, recorded from real incidents; added upstream with 4.8.7. |

## Vendor documentation

Treat these as the vendors' descriptions of their own products and claims, not as independent verification.

| Source | How to use it |
| --- | --- |
| [Coldcard MicroSD signing](https://coldcard.com/guides/using-coldcard/coldcard-microsd-signing) | Read Coldcard's guidance on moving a Sparrow PSBT by MicroSD for air-gapped signing, then returning the signed file to Sparrow. |
| [Trezor multi-share backup](https://trezor.io/guides/backups-recovery/advanced-wallets/create-a-wallet-with-multi-share-backup) | Review Trezor's guidance on creating a wallet whose backup is divided into shares on Safe devices and Model T. |
| [Trezor multisig guide](https://trezor.io/learn/supported-assets/bitcoin/multisig-wallets-how-multi-key-security-protects-your-bitcoin) | Read Trezor's explanation of 2-of-3 and 3-of-5 multisig signing, key rotation and the distinction between multisig and Shamir backup. Note (9 November 2026): the former destination returned HTTP 404; this replacement was verified HTTP 200. |
| [Casa vaults](https://casa.io/vault) | Review Casa's description of assisted multisig vaults, key replacement and recovery without its service through open-source tools. |
| [BitBox02 multisig (BitBox support hub)](https://support.bitbox.swiss/) | Start at the support hub to re-check BitBox02 guidance on multisig risks, backing up co-signer details and registering the setup, rather than relying on the former blog URL. |

## Community research

Use this for experience and explanation, not as a specification.

| Source | How to use it |
| --- | --- |
| [MPC wallets explainer](https://www.bitcoin.com/wallet/what-is-an-mpc-wallet/) | Compare MPC threshold signing with Shamir secret sharing and multisig, and examine why custody depends on who owns and controls the shares. |

Before relying on anything here, re-check current implementation behaviour. Never put a real mnemonic, seed or private key into any example or test.
