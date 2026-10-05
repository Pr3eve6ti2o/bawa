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
