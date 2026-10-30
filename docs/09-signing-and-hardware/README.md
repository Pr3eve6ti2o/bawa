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
## Watch-only hand-off: descriptors and PSBT

**Conceptual only — testnet/signet/regtest; never real funds.**

Tracking and authorisation belong in separate trust domains. Private keys and seeds never leave the signing domain. Signing inconvenience is not a reason to load a seed onto the web server.

Bawa does not ship a device integration. This flow follows the descriptor and PSBT standards; use your chosen watch-only wallet and signer’s documentation to set it up.

### What each part carries

| Item | Role in this flow |
|---|---|
| xpub / address | Tracker input for deriving and watching addresses. |
| Descriptor | Keeps script policy, derivation origin and address ranges together. |
| PSBT (BIP-174/371) | Built unsigned by the watch-only side, signed offline or on hardware, then returned for finalisation and broadcast. |
| Private key / hardware wallet | Belongs to the signer, not the tracker. |

Descriptor handling must preserve the tracker’s xpub/address-only boundary.

BIP-380/381/382 define the descriptor rules. For native SegWit on testnet, the receiving and change patterns are:

- Receiving: `wpkh([<fingerprint>/84'/1'/0']<xpub>/0/*)`
- Change: `wpkh([<fingerprint>/84'/1'/0']<xpub>/1/*)`

In these BIP-44-style paths, coin type `1` identifies testnet. Use the fingerprint and full derivation origin recorded in the signer’s own export; do not guess them from the example.

### Trust-boundary map

The arrows show conceptual hand-offs, not commands or a device-specific integration.

```text
ONLINE — TRACKER / WEB SERVER
  xpub / address only
  address derivation
  watching
  unsigned PSBT preparation
               │
               │ unsigned PSBT: QR / file / SD card
════════════ TRUST BOUNDARY ════════════
               ▼
```

```text
OFFLINE / HARDWARE — SIGNER
  private key / hardware wallet
  device review
    address
    amount
  PSBT signing
               │
               │ signed PSBT returned
════════════ TRUST BOUNDARY ════════════
               ▼
```

```text
ONLINE — WATCH-ONLY TRACKER
  signed PSBT
       │
       ▼
  finalisation
       │
       ▼
  broadcast
       │
       │ signed transaction
───────┼──── NETWORK BOUNDARY ─────
       ▼
    NETWORK
```

### Hand-off checks

The PSBT flow follows BIP-174/371. These checks describe the stages, **not literal tool output**.

1. **Prepare on watch-only.** Build the unsigned PSBT.  
   **You should see:** an unsigned PSBT on the tracking side; signing stays in the separate signer domain.

2. **Review on the signer.** Transfer the PSBT using QR, a file or an SD card, as supported by your device. Verify the address and amount on the signing device’s own screen. Bawa does not document device-specific transfer and review steps; follow your device’s instructions.  
   **You should see:** the intended test address and amount on that screen. **Stop if the device screen does not show the intended address and amount.**

3. **Authorise separately.** Sign in the offline or hardware environment and return the signed PSBT to the watch-only side.  
   **You should see:** a signed PSBT returning across the boundary, not private-key or seed material.

4. **Finalise and broadcast online.** The watch-only side finalises the signed PSBT and broadcasts the transaction.  
   **You should see:** the signed transaction handed to the test network. Bawa does not document exact broadcast-success or confirmation output. Use the transaction ID to verify the broadcast on an explorer for that test network.

### Trezor reference ≠ onboarding recipe

[Trezor’s per-coin derivation-path notes](https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md) explain that paths differ by cryptographic curve and blockchain family. Public nodes are possible only where the derivation rules support them.

Those path notes do not replace device-specific descriptor/PSBT setup instructions. Bawa does not document such a setup procedure; follow the documentation for your own device and watch-only wallet.

| Implementation detail | What to use and check |
|---|---|
| Descriptor onboarding | Use the BIP-380/381/382 descriptor rules and the fingerprint and origin from your signer’s own export. Bawa does not document device-specific export/import syntax or address-range settings; follow your signer and watch-only wallet documentation for these. |
| PSBT tooling | Bawa does not document construction, signing or finalisation commands. Use the documentation for your watch-only wallet and signer to carry out the BIP-174/371 flow. |
| Hardware integration | Bawa does not prescribe device onboarding, test-network selection, model/firmware compatibility or supported transfer routes. Follow your own device’s guidance and confirm whether it supports QR, file or SD-card transfer. |
| Operational verification | Bawa does not document device-specific transfer validation or literal broadcast-success output. Follow your device’s validation procedure, check the address and amount on its screen, and verify the broadcast by transaction ID on a test-network explorer. |

- [Ledger developers](https://developers.ledger.com/)

---
## 09 — A test-only hardware-signing rehearsal

**Conceptual only: testnet, signet or regtest; never real funds.** These are workflow checks, not guarantees of particular device messages or tool output.

```text
ONLINE — WATCH-ONLY
xpub / addresses
│
▼
tracking
│
▼
build unsigned PSBT
│
▼
```

```text
SEPARATE TRUST DOMAIN — OFFLINE / HARDWARE
private key and seed remain on the signing side

unsigned PSBT
│
▼
device-screen review
│
▼
sign
│
▼
signed PSBT
│
▼
```

```text
ONLINE — WATCH-ONLY
signed PSBT
│
▼
finalise
│
▼
broadcast
│
▼
TEST NETWORK ONLY
```

### Walkthrough

The steps follow the **BIP-174/371 PSBT flow**.

1. **Establish the boundary.** Keep tracking public-only and signing separate. Private keys and seeds must never leave the signing domain. Bawa does not document a device-specific setup; follow your device’s onboarding, test-network selection and firmware compatibility guidance. Without a verified test-only setup, keep this as a paper exercise.  
   **You should see:** xpub/addresses on the tracking side, with the private key confined to the signing domain—not loaded into the web server.

2. **Build on the watch-only side.** Prepare an unsigned PSBT for the intended test payment. Bawa does not document construction commands or wallet-specific controls; use your watch-only wallet’s documentation.  
   **You should see:** an **unsigned PSBT**, ready for the separate signer.

3. **Transfer and review.** Pass the PSBT to the signer using a supported QR, file or SD-card route. Bawa does not document device-specific transfer support; check your wallet and signer documentation before choosing a route. Compare the address and amount on the **signing device’s screen** with the intended test payment. Stop if either differs or cannot be reviewed.  
   **You should see:** the intended address and amount on the signing device itself. The online display alone is not this check.

4. **Authorise and return.** Only after that review, authorise test-only signing and return the signed PSBT to the watch-only side. Bawa does not document exact device messages or signing controls; follow your device’s signing instructions.  
   **You should see:** a **signed PSBT** crossing back to the online side; signing remains in its separate trust domain.

5. **Finalise, then broadcast.** The watch-only side finalises and broadcasts solely to the verified test network. This is a separate stage from authorisation. Bawa does not document wallet-specific broadcast success messages or confirmation procedures; consult your wallet’s documentation.  
   **You should see:** the **signed transaction** passed to the network from the online side. Verify the broadcast by looking up its transaction id on an explorer for the chosen test network.

### Reference, not an integration promise

The [Trezor firmware path reference](https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md) documents per-coin derivation paths. Paths differ by curve and blockchain family; public nodes are possible only where the derivation rules support them.

Bawa does not ship a device integration. The Trezor reference is not a Bawa–Trezor setup guide, and Bawa does not prescribe a device-specific testnet derivation path.

### What the runbook still needs

Under **BIP-380/381/382**, a native-SegWit descriptor carries **script policy, derivation origin and address ranges**. Testnet examples are:

- **Receiving:** `wpkh([<fingerprint>/84'/1'/0']<xpub>/0/*)`
- **Change:** `wpkh([<fingerprint>/84'/1'/0']<xpub>/1/*)`

These paths use testnet coin type `1` in the BIP-44 style. Record the fingerprint and derivation origin from the signer’s own export; do not assume the example path matches your device.

The PSBT workflow comes from **BIP-174/371**, not a Bawa device integration. Bawa does not document a device-specific recipe. Use your wallet and signer documentation to confirm these details before attempting the rehearsal:

| Area | What to confirm |
|---|---|
| Onboarding | Device setup, firmware compatibility, test-network selection and verification, and test-fund setup. Use test funds only. |
| Descriptors | Wallet-specific import/export syntax, policy selection and exact address-range settings. Confirm the fingerprint and exact origin/path against the signer’s own export. |
| PSBT | Construction, validation and finalisation procedures; format compatibility and supported transfer routes. |
| Integration | Bawa does not ship a device integration, so there is no Bawa connector setup to follow. Use your wallet and signer documentation for device-specific signing controls and broadcast/status procedures. |
