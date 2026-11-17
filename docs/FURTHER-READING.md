---
title: Further reading
description: Primary specifications, Wallet Core sources, vendor documentation and community research to consult alongside this guide set; Link availability was checked on 9 November 2026. Known exceptions and verified alternatives are noted alongside the affected links. Availability is not evidence of what Bawa implements.
last-updated: 2026-11-17
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
| [BIP-371](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki) | Review Taproot PSBT fields for the internal key, derivation information, leaf scripts and control blocks. |
| [BIP-380](https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki) / [BIP-381](https://github.com/bitcoin/bips/blob/master/bip-0381.mediawiki) / [BIP-382](https://github.com/bitcoin/bips/blob/master/bip-0382.mediawiki) | Review output descriptors for expressing script policy, derivation origin and address ranges. |
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
| [Wallet Core releases](https://github.com/trustwallet/wallet-core/releases) | Check release notes and tags: the repository tools' installed pin is `4.8.4`; the latest stable is `4.9.3`, per the [npm registry](https://registry.npmjs.org/@trustwallet%2Fwallet-core) `latest` dist-tag for `@trustwallet/wallet-core`. [GitHub 4.9.3](https://github.com/trustwallet/wallet-core/releases/tag/4.9.3) is a full release, not flagged pre-release (unlike `4.9.2`, recorded as a GitHub pre-release in `docs/10`). Its [4.9.0...4.9.3 changelog](https://github.com/trustwallet/wallet-core/compare/4.9.0...4.9.3) contains two changes: support for Solana Metaplex Core asset transfers (#4938; Solana is reference-only in `docs/02`, with no Bawa Solana transfers), and serialized, atomic `#[tw_ffi]` binding-manifest writes (#4936; build/codegen internals with no wallet-behaviour effect). Neither changes Bawa guide coverage; the re-pin to `4.9.3` remains open pending full WASM verification. |
| [Wallet Core 4.9.2 release](https://github.com/trustwallet/wallet-core/releases/tag/4.9.2) | The demonstrated reference version (D21 construction/signing only, 2026-11-08; GitHub pre-release, tag `4.9.2`, commit `17e3cd4df5d53f061ade3bbdc07d196f5ed5a8e3`); re-pin and re-verify whenever the Core pin moves. |
| [Wallet Core registry (4.9.2)](https://raw.githubusercontent.com/trustwallet/wallet-core/4.9.2/registry.json) | The upstream registry data interpreted by docs/12; pinned at tag 4.9.2. |
| [Wallet Core BC footguns (4.9.2)](https://github.com/trustwallet/wallet-core/blob/4.9.2/docs/bc-footguns.md) | Known backward-compatibility constraints for Wallet Core, recorded from real incidents; present upstream from 4.8.5 (first appearance between 4.8.4 and 4.8.5). Covers `TWStoredKeyFixEncryption` changing its return type from `bool` to `struct TWResultVoid*` (PR #4787, 2026-06; old binaries reading it as `bool` always see `true`, so a wrong-password no-op silently appears successful); scrypt requiring `dklen == 32` at load (PR #4897, 2026-09; third-party files declaring `dklen > 32` previously decrypted but are now rejected); and nlohmann integer storage-type differences (PR #4897, 2026-09; use `parseUnsigned`/`parseU32`, which accept both signed and unsigned forms). |

## Vendor documentation

Treat these as the vendors' descriptions of their own products and claims, not as independent verification.

| Source | How to use it |
| --- | --- |
| [Coldcard MicroSD signing](https://coldcard.com/guides/using-coldcard/coldcard-microsd-signing) | In Sparrow, build and finalise the transaction, then save the unsigned PSBT to the root of a FAT32/FAT12 MicroSD card (512 MB or larger). Move the card to the Coldcard and select **Ready To Sign** to load it. Review the recipient, amount and fee character by character on the device screen, then approve. Coldcard writes `[original]-signed.psbt` back to the card, plus a ready-to-broadcast `.txn` on Mk4 v5.4.2 and later or Q v1.3.2Q and later. Return the card to the computer and load the signed PSBT in Sparrow. For multisig, repeat the card round trip for each cosigner; broadcast from Sparrow once signing is complete. |
| [Trezor multi-share backup](https://trezor.io/guides/backups-recovery/advanced-wallets/create-a-wallet-with-multi-share-backup) | On Trezor Safe devices and Model T, choose **Create new wallet** → **Multi-share Backup** → **Create wallet** in Trezor Suite, then set the number of shares and threshold on the device. The device displays several 20-word recovery shares only on its screen. For each share, write it down offline—never digitise it or enter it elsewhere—then hold to confirm and confirm the share on the device by entering the specific words it requests. |
| [Trezor multisig guide](https://trezor.io/learn/supported-assets/bitcoin/multisig-wallets-how-multi-key-security-protects-your-bitcoin) | Read Trezor's explanation of 2-of-3 and 3-of-5 multisig signing, key rotation and the distinction between multisig and Shamir backup. Note (9 November 2026): the former destination `https://trezor.io/learn/a/multisig` returned HTTP 404; this replacement was verified HTTP 200. |
| [Casa vaults](https://casa.io/vault) | Review Casa's description of assisted multisig vaults, key replacement and recovery without its service through open-source tools. |
| [BitBox02 multisig (BitBox support hub)](https://support.bitbox.swiss/) | Start at the support hub to re-check BitBox02 guidance on multisig risks, backing up co-signer details and registering the setup. Note: this support-hub link replaces the former blog URL, `https://blog.bitbox.swiss/en/bitbox02-electrum-bitcoin-multisig/`. |

## Community research

Use this for experience and explanation, not as a specification.

| Source | How to use it |
| --- | --- |
| [MPC wallets explainer](https://www.bitcoin.com/wallet/what-is-an-mpc-wallet/) | Compare MPC threshold signing with Shamir secret sharing and multisig, and examine why custody depends on who owns and controls the shares. |

Before relying on anything here, re-check current implementation behaviour. Never put a real mnemonic, seed or private key into any example or test.
