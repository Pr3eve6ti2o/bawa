# Signing, Descriptors, PSBT & Hardware

Use this when you need to authorize transactions. The signing environment should be a separate trust domain from the online tracker.

# Signing: keep it separate from tracking

A very useful architecture is:

```text
TRACKER / WEB SERVER

xpub / address only
      │
      └── derives and watches addresses

SIGNER

private key / hardware wallet
      │
      └── signs transaction

NETWORK

broadcast signed transaction
```

The tracking service should not need the private key.

The web server should not become the place where the seed is loaded just because signing is inconvenient.

For high-value systems, move signing into an offline or hardware-backed trust domain.

---

# Hardware wallets

Hardware wallets make the security boundary physical rather than merely architectural.

### Trezor

Trezor's firmware repository documents per-coin derivation paths and shows an important concept: paths differ by curve and blockchain family, and public nodes are only possible where the derivation semantics support them.

See:

https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md

### Ledger

Ledger's developer documentation separates device apps, signing flows and wallet integration. Its current documentation also emphasizes user review and clear transaction presentation on the signing device.

See:

https://developers.ledger.com/

For EVM hardware signing, the device is not “an RPC provider”. It is a secure signing surface.

That distinction should remain intact.

---

# Bitcoin Descriptors & PSBT

An xpub can be ambiguous for serious Bitcoin watch-only systems. Output descriptors can retain script policy, derivation origin and address ranges.

[Bitcoin Core descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md) should be read alongside [BIP-174](https://bips.dev/174/) for offline and hardware-backed transaction workflows.

```
online watch-only system
    ↓
unsigned transaction / PSBT
    ↓
offline or hardware signer
    ↓
signed transaction
    ↓
broadcast node / RPC
```

## Primary references

- [BIP-174 / PSBT](https://bips.dev/174/)
- [BIP-371](https://bips.dev/371/)
- [Bitcoin Core descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md)
- [Bitcoin Core PSBT](https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md)
- [Trezor](https://github.com/trezor/trezor-firmware)
- [Ledger developers](https://developers.ledger.com/)