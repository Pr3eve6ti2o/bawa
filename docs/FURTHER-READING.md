# Further reading

## Primary specifications

Use these as the authority on requirements, not as evidence of what Bawa implements.

| Source | What it covers |
| --- | --- |
| [BIP-32](https://bips.dev/32/) | Defines how to derive a deterministic tree of wallet keys from a seed. |
| [BIP-39](https://bips.dev/39/) | Specifies how entropy becomes a mnemonic phrase and how the words, with an optional passphrase, produce a seed. |
| [BIP-44](https://bips.dev/44/) | Organises multi-account wallets into five path levels: purpose, coin type, account, change and address index. |
| [BIP-174](https://bips.dev/174/) | Defines PSBT’s structure for carrying unsigned transactions, signing data and partial signatures between wallet tools. |
| [SLIP-39](https://github.com/satoshilabs/slips/blob/master/slip-0039.md) | Specifies Shamir-based mnemonic shares with 20 words for 128-bit secrets and 33 words for 256-bit secrets. |
| [Bitcoin Core descriptors](https://raw.githubusercontent.com/bitcoin/bitcoin/master/doc/descriptors.md) | Defines notation for output scripts, covering script types, ways to express keys and checksum rules. |

## Bawa and upstream Wallet Core

These provide integration guidance, not a guarantee of Bawa’s behaviour.

| Source | What it covers |
| --- | --- |
| [Wallet Core repository](https://github.com/trustwallet/wallet-core) | Contains the upstream, cross-platform wallet library on which Bawa’s tools depend. |
| [Wallet Core usage guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage) | Shows multi-coin wallet creation and import, deriving addresses and signing; Wallet Core itself does not handle network communication. |

## Vendor documentation

These describe the vendors’ own products and claims; they are not independent verification.

| Source | What it covers |
| --- | --- |
| [Coldcard MicroSD signing](https://coldcard.com/guides/using-coldcard/coldcard-microsd-signing) | Coldcard describes moving a Sparrow PSBT by MicroSD for air-gapped signing, then returning the signed file to Sparrow. |
| [Trezor multi-share backup](https://trezor.io/guides/backups-recovery/advanced-wallets/create-a-wallet-with-multi-share-backup) | Trezor explains how to create a wallet whose backup is divided into shares on Safe devices and Model T. |
| [Trezor multisig guide](https://trezor.io/learn/supported-assets/bitcoin/multisig-wallets-how-multi-key-security-protects-your-bitcoin) | Trezor explains multisig signing with 2-of-3 and 3-of-5 setups, discusses rotating keys and contrasts multisig with Shamir backup. |
| [Casa vaults](https://casa.io/vault) | Casa outlines its assisted multisig vaults, replacing keys and recovering without its service through open-source tools. |
| [BitBox02 multisig](https://blog.bitbox.swiss/en/bitbox02-electrum-bitcoin-multisig/) | BitBox discusses what can go wrong with multisig, backing up co-signer details and registering the setup on a BitBox02. |

## Community research

Use this for experience and explanation, not as a specification.

| Source | What it covers |
| --- | --- |
| [MPC wallets explainer](https://www.bitcoin.com/wallet/what-is-an-mpc-wallet/) | Contrasts MPC threshold signing with Shamir secret sharing and multisig, explaining why custody depends on who owns and controls the shares. |

Before relying on anything here, re-check current implementation behaviour and vendor prices. Never put a real mnemonic, seed or private key into any example or test.
