# Trust Wallet Core & Independent Verification

This guide defines how Bawa uses Trust Wallet Core, how the Trust Wallet repositories fit together, and why an independent implementation such as `bip_utils` belongs in the verification layer.

## Trust Wallet Core

Bawa uses `@trustwallet/wallet-core` as its reference wallet-crypto engine.

The official Wallet Core usage guide covers:

- creating/importing multi-coin wallets;
- receiving-address derivation;
- custom derivation paths;
- transaction signing.

It explicitly states that blockchain-node communication, balance retrieval and transaction broadcasting are outside Wallet Core. Those are separate application/infrastructure responsibilities.

References:

- [Wallet Core](https://github.com/trustwallet/wallet-core)
- [Usage Guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage)
- [HDWallet API](https://trustwallet.github.io/docc/documentation/walletcore/hdwallet/)

## Why Bawa uses an independent verifier

`bip_utils` independently implements BIP-32, BIP-39, BIP-44, BIP-49, BIP-84, BIP-86, SLIP-0010, CIP-1852 and many chain-specific key/address systems.

That makes it useful for differential testing:

```
known public test material
          │
   ┌──────┴──────┐
   ▼             ▼
Wallet Core   bip_utils
   │             │
   └──────┬──────┘
          ▼
   compare public outputs
```

This is intentionally a test boundary, not a second production wallet engine.

## What should be compared

Use public deterministic fixtures:

- BIP-39 mnemonic-to-seed vectors;
- BIP-32 master/child vectors;
- BIP-84 Bitcoin addresses;
- BIP-44 Ethereum addresses;
- any additional chain where both implementations explicitly document the same rule.

Never place a real production mnemonic, seed, xprv, hardware seed, or wallet backup in CI.

## Trust Wallet registry

Wallet Core publishes [`registry.json`](https://github.com/trustwallet/wallet-core/blob/master/registry.json) and [registry-field documentation](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md).

The registry is useful for implementation metadata such as:

- coin IDs and optional SLIP-44 values;
- derivation paths and alternate derivations;
- xpub/xprv serialization variants;
- curves and public-key types;
- address prefixes and HRPs;
- chain IDs;
- explorer/documentation metadata.

Use the registry to understand implementation compatibility. Do not treat it as a replacement for the protocol specification.

## `@hdwallet/core`

The npm package is a broad TypeScript HD-wallet project, but its current published page states that it is still under development and not ready for production use. Bawa therefore does not use it in the security-critical runtime.

## Release rule

A release should be supported by:

```
official vectors
      +
Wallet Core output
      +
bip_utils output where applicable
      +
negative/security tests
      +
clean-install CI
```

Where no independent implementation or published vector exists, document the limitation instead of implying equivalent assurance.
