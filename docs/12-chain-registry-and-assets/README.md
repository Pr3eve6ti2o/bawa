# Chain Registry & Asset Metadata

Bawa separates chain compatibility metadata from the cryptographic wallet engine.

## Trust Wallet Core registry

Wallet Core's `registry.json` describes supported-chain metadata such as:

- internal chain ID and display name;
- coin ID and optional SLIP-44 value;
- native symbol and decimals;
- blockchain implementation family;
- derivation paths and alternate derivations;
- extended-key formats;
- elliptic curve and public-key type;
- address prefixes and HRPs;
- EVM chain IDs and other network identifiers;
- explorer and documentation links.

References:

- [Registry fields](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md)
- [registry.json](https://github.com/trustwallet/wallet-core/blob/master/registry.json)

### Do not collapse identifiers

These are different concepts:

```
coin identity
network identity
wallet derivation policy
address encoding
asset identity
```

For example, an EVM address can be identical across networks while the chain ID, native asset, token contracts, RPC endpoint and finality rules differ.

## Trust Wallet Assets

[trustwallet/assets](https://github.com/trustwallet/assets) is an asset/token metadata registry, not a wallet or signing library.

Its documented domain includes token logos, `info.json` metadata, token lists and validation. It does not own wallet keys, derivation, signing or transaction handling.

A clean separation is:

```
Trust Wallet Core
  → keys / derivation / addresses / signing

Trust Wallet Assets
  → token metadata / logos / token lists

RPC / node / indexer
  → current chain state / history / logs / UTXOs

Application database
  → address allocation / orders / payments / reconciliation
```

## Token identity

Never identify a token only by symbol.

For ERC-20, TRC-20, SPL, TON Jettons and similar assets, persist the network plus the chain-specific contract/address and the expected decimals/metadata.

A useful normalized identity is:

```
network_id + asset_id
```

where a token's `asset_id` contains the chain-specific contract/address.

## Payment requests

A payment request should record at least:

```
network
asset
recipient address
amount in atomic units
memo/tag when required
quote timestamp / expiry where relevant
```

The watcher later proves whether an observed chain event satisfies that request.
### Field map: what belongs where

Trust Wallet Wallet Core uses `registry.json` for compatibility metadata, not as a protocol specification. Its [field reference](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md) defines the fields. Describing a curve, path or network does not implement the cryptographic engine.

| Category | Fields to check | Keep this distinction |
|---|---|---|
| Registry identity | Internal chain ID; display name | Not the EVM chain ID. |
| Coin identity | Internal Wallet Core coin ID; optional SLIP-44 coin type | These are separate fields in Wallet Core. Check the chain’s `registry.json` entry rather than assuming a mapping. |
| Network identity | EVM chain IDs; other network identifiers | Separate from coin and asset identity. |
| Native asset | Symbol; decimals | A symbol alone cannot identify a token. |
| Wallet policy and formats | Derivation paths and alternatives; extended-key formats | Not network selection or asset identity. |
| Engine compatibility | Blockchain family; curve; public-key type | A compatibility description, not implementation code. |
| Address encoding | Prefixes; HRPs | Not derivation policy. |
| References | Explorer and documentation links | Supporting references, not protocol rules. |

These categories explain how the metadata is organised; they are not literal JSON field names.

### Worked identifier example

This is a conceptual example: every value in angle brackets is a placeholder. `<NET_A>` and `<NET_B>` represent **different EVM chain IDs**, not coin IDs.

```text
Same wallet address text
  <WALLET_X>
    ├── on network <NET_A>
    └── on network <NET_B>
```

```text
Token identity =
  network
  + contract/address
  + decimals

asset A
  network: <NET_A>
  contract/address: <CONTRACT_X>
  decimals: <DECIMALS_X>

asset B
  network: <NET_B>
  contract/address: <CONTRACT_X>
  decimals: <DECIMALS_X>

asset A ≠ asset B
even if both display <SYMBOL_X>
```

The networks differ, so these are different token identities even though the contract address text, decimals and symbol match. The shared wallet address does not select a network. Do not substitute an internal chain ID, Wallet Core coin ID or SLIP-44 coin type for the EVM chain ID.

### Preparing a chain or asset addition

Use this checklist to prepare and review an addition. It is not a verified submission procedure. The checks describe what to look for during review, not output from a tool.

1. **Chain:** list the fields and values for the proposed `registry.json` entry. Check them against the [field reference](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md) and [registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json). Mark unconfirmed values as unknown rather than guessing paths, prefixes or identifiers.

   **You should see:** registry, coin and network identifiers kept distinct, with metadata for wallet policy, key formats and address encoding recorded. Nothing in this list establishes new cryptographic support.

2. **Asset:** confirm the network + contract/address + decimals identity before preparing metadata. [Trust Wallet Assets](https://github.com/trustwallet/assets) documents logos, `info.json`, token lists and validation. Follow that repository’s current contribution guide and check which files are required; do not assume every type of file is mandatory.

   **You should see:** a token identity that includes its network, not just a ticker. The addition covers asset metadata, not key ownership, derivation, signing or transaction handling.

**Before an actual addition:** Bawa does not document the exact JSON schemas, complete rules for required and optional fields, asset directory layout, validation commands and outputs, submission steps, or engine integration and testing requirements. It also does not reproduce the Assets contribution guide. Follow the current Assets contribution guide for asset requirements. For chain or engine changes, check Wallet Core’s documentation and confirm integration and testing requirements with its maintainers. Do not treat this checklist as a ready-to-apply chain or asset patch, or present a metadata-only change as cryptographic engine support.
