# Signing, Descriptors, PSBT & Hardware

NaN







## Recommended architecture

NaN
online tracker
   ↓
unsigned transaction / PSBT
   ↓
offline or hardware signer
   ↓
signed transaction
   ↓
broadcast node / RPC
NaN

## References

- [BIP-174 / PSBT](https://bips.dev/174/)
- [BIP-371](https://bips.dev/371/)
- [Bitcoin Core descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md)
- [Bitcoin Core PSBT](https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md)
- [Trezor](https://github.com/trezor/trezor-firmware)
- [Ledger developers](https://developers.ledger.com/)