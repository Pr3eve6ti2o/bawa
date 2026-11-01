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

## PSBT hand-off: Creator, Updater and Signer

**Conceptual workflow — testnet, signet or regtest only; never real funds.**

Bawa does not include a device integration. Use your chosen watch-only wallet as coordinator and follow its and the signer’s documentation. Keep seeds and private keys in the signing domain, never on the tracker or web server.

Descriptors give the coordinator script policy, public derivation information such as `<xpub>`, and key origins such as `<fingerprint>`. The coordinator normally acts as **Creator** and **Updater**. Only the separate signer performs the **Signer** role.

A PSBT carries data, not permission to sign: anyone can assemble one. Metadata does not prove ownership or consent. Participants must preserve fields they do not understand when passing it on. If required safety checks cannot be completed, stop rather than strip fields.

```text
WATCH-ONLY COORDINATOR
  Creator: assemble transaction
  Updater: attach spending data
  unsigned PSBT
        │
════ TRUST BOUNDARY ════
        ▼
```

```text
OFFLINE / HARDWARE SIGNER
  on-device verification
  approval
  Signer: add signatures
```

### 1. Creator — build the unsigned transaction

Select inputs by `<TXID>` and output index. Set recipient amounts and output scripts using `<TESTNET_ADDRESS>`, include change where needed, and choose input sequences and locktime deliberately. The fee is the difference between total input and output values, not another output.

No keys are needed to construct this proposal from known outpoints and output scripts. In BIP-174’s PSBT v0 format, the global unsigned transaction has empty `scriptSig` fields and no witness data. Signatures belong in separate PSBT fields; the input and output metadata can still be sparse.

**You should see:** an unsigned PSBT containing the expected inputs and outputs, with no signatures and no private keys on the coordinator.

### 2. Updater — supply the spending context

The coordinator adds information that the signer needs to validate the proposal:

- **UTXOs — unspent transaction outputs:** legacy inputs need `non_witness_utxo`, the complete previous transaction. SegWit inputs can use `witness_utxo`, containing the previous output’s amount and locking script; signers may also require complete previous transactions, particularly for SegWit v0 fee checks. Previous transactions must match the input outpoints. If both UTXO forms are present, they must agree.
- **Key origins:** attach public keys, `<fingerprint>` and derivation paths from the descriptor. Include output derivations to help identify change, without treating those claims as proof.
- **Scripts:** include required redeem scripts and witness scripts. For Taproot, use BIP-371’s internal-key and derivation fields, plus leaf scripts and control blocks where needed for script-path spending.
- **Sighash:** record the intended signature-hash mode, or agree the signer’s default. Ordinary `SIGHASH_ALL` and Taproot’s `SIGHASH_DEFAULT` commit to all outputs. Other modes can leave transaction parts changeable. An explicitly requested mode must be honoured or signing refused.

Adding these fields does not approve the transaction. They give the signer evidence to check, not instructions it must trust.

**You should see:** an unsigned, populated PSBT with enough UTXO, script and key-origin information for your signer to verify the spend and calculate the fee.

### 3. Signer — verify on device, then sign

Transfer the PSBT using QR, a file or an SD card, as supported by your signer.

The signer must validate the consistency of UTXO data and scripts, derive its own matching public keys, and verify change against its expected wallet policy. A coordinator’s fingerprint or “change” label is not proof. The signer must also enforce an acceptable sighash policy.

Before approving, check on the device’s own trusted screen:

- the intended test-network setting;
- every recipient `<TESTNET_ADDRESS>` and amount, compared with an independent record of your intended payment;
- the total fee and any additional outputs, with change independently verified by the signer.

**Stop if the device cannot show the intended address and amount, an output is unexplained, or the fee cannot be verified.**

Only after these checks and on-device approval may the signer add partial signatures or BIP-371 Taproot signatures. Return the PSBT with unknown fields preserved. It may still need other signatures; finalisation and broadcast are later stages.

**You should see:** the intended test address and amount on the signer’s screen, followed by a signature-bearing PSBT; private keys remain in the signing domain.

### Sources

- BIP-174: https://bips.dev/174/
- BIP-371: https://bips.dev/371/
- Bitcoin Core PSBT documentation: https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md
- Community worked example, not a specification: https://Coldcard.com/learn/hardware-wallets/what-is-a-psbt

## Watch-only hand-off: combine, finalise, extract, broadcast

**Conceptual workflow — testnet, signet or regtest only; never real funds.**

The watch-only coordinator normally performs the Combiner, Finalizer and Extractor roles, then requests broadcast from a node. Only the signer creates spending signatures, after reviewing the destination, amount, change and fee. Private keys and seeds stay in the signing domain. These are roles, not fixed device types: a signer may also finalise.

A PSBT is a data container, not authorisation by itself. Receiving or combining it grants no spending authority; valid signatures authorise what they commit to. However, a sufficiently signed PSBT may let its holder finish and broadcast without another device approval. Handle signed PSBTs accordingly.

Every participant must preserve fields it does not understand when passing on a PSBT, including proprietary fields. Do not strip unfamiliar records to make a hand-off work.

```text
SIGNING DOMAIN — OFFLINE / HARDWARE
  review and sign
          │
          │ signed PSBT copies
══════════╪════ TRUST BOUNDARY ══════
          ▼
```

```text
WATCH-ONLY COORDINATOR
  Combiner
      │
      ▼
  Finalizer
      │
      ▼
  Extractor
      │
      │ network-format transaction
      ▼
```

```text
SEPARATE BROADCAST STEP
  chosen test-network node
  validation and possible relay
```

### Combiner — merge signed copies

Merge only PSBTs for exactly the same unsigned transaction. In multisig, different signers may return separate copies containing their partial signatures. The Combiner brings those signatures and supporting fields together without changing the transaction.

Count distinct valid signatures against each input’s spending policy, not the number of returned files. Merging the same signature twice does not help meet a threshold.

Reject mismatched transactions. If fields conflict, stop and investigate rather than silently choosing a value. Combining creates no signatures and is not a cryptographic signature-aggregation protocol.

**You should see:** one PSBT with the transaction unchanged, supporting metadata retained and returned signatures associated with the correct inputs. More signatures may still be needed.

### Finalizer — build the final input scripts

Finalisation works input by input. Using sufficient signatures and the required script data, the finaliser constructs the final `scriptSig`, witness, or both, as appropriate. Script-based multisig needs signatures arranged as its spending script requires.

For Taproot, use the BIP-371 data for the chosen spending path. A script-path witness needs the selected tapscript, control block and satisfying stack; collecting signatures alone is not enough.

Finalisation also performs the PSBT rules’ clean-up of recognised intermediate signing fields. Retain UTXO data and unknown fields, and leave global and output maps unchanged. This specified clean-up is not permission to discard unfamiliar metadata.

Finalising needs no private keys, but it cannot repair missing signatures or an unsupported spending path.

**You should see:** the required final `scriptSig` and/or witness for each completed input. Continue to extraction only when every input is finalised.

### Extractor — produce the network-format transaction

The Extractor takes the completed PSBT and assembles a serialised Bitcoin transaction, including the final input scripts and witnesses. Its output is transaction bytes, commonly displayed as hexadecimal, rather than another PSBT.

PSBT key origins and proprietary metadata are not transaction fields: they remain in the PSBT record, not the network bytes. Extraction creates no signatures and sends nothing.

Bitcoin Core’s `finalizepsbt` can perform finalisation and extraction together. That convenience does not make extraction a broadcast operation.

**You should see:** a decodable raw transaction matching the reviewed spend. Check outputs and, using the retained UTXO amounts, the fee. A calculable `<TXID>` is not evidence of network acceptance.

### Broadcast — relay, not authorise

Submit the extracted transaction, not the PSBT, to a node configured for the intended test network. The coordinator needs no private keys for this. Anyone holding the completed transaction can attempt broadcast; the signatures already carry the relevant authorisation.

Nodes still apply consensus checks and mempool policy. Extraction does not guarantee acceptance, and acceptance or relay does not mean confirmation.

Verify `<TXID>` through your node or an explorer for that same test chain. For regtest, use your local node rather than a public explorer.

**You should see:** `<TXID>` recognised in the chosen node’s mempool or a block. Check confirmations separately; do not infer them from a successful submission.

### Sources

- BIP-174: https://bips.dev/174/
- BIP-371: https://bips.dev/371/
- Bitcoin Core PSBT documentation: https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md
- Coldcard community worked example, not a specification: https://Coldcard.com/learn/hardware-wallets/what-is-a-psbt

## Output descriptors: make the watch target explicit

Keep descriptor handling within Bawa’s xpub/address-only boundary: public keys, script policy and derivation metadata, never signing secrets. Use testnet, signet or regtest only, with no real funds or real-funds wallet exports.

### What a descriptor fixes

A bare xpub lets you derive non-hardened child public keys. It does not, by itself, settle:

- **Script policy:** how those keys become spendable outputs.
- **Full derivation origin:** which master key and path produced the exported key.
- **Address family:** which branch and child sequence the tracker should follow.

A descriptor makes the output construction and derivation rule explicit. Its optional origin annotation records provenance. A wildcard defines a ranged address family, but **does not store numerical scan bounds**. Keep the import/scan range and next unused index separately; the descriptor does not say which addresses have already been used.

### Key-expression anatomy

For a ranged public-key descriptor, read the key expression as an optional bracketed origin, the exported key, a derivation suffix and a final wildcard:

`[<fingerprint>/84'/1'/0']<xpub>/0/*`

| Part | Meaning |
| --- | --- |
| `<fingerprint>` | The master key’s four-byte fingerprint, written as eight hexadecimal characters. |
| `/84'/1'/0'` inside brackets | Full origin path from the master to this account key. |
| `<xpub>` | The signer-exported account extended public key. |
| `/0` after the key | Non-hardened receiving branch. |
| `/*` | Non-hardened child index, varied across the address range. |

Here, `84'` is BIP-84’s native-SegWit purpose, `1'` is the testnet coin type, and `0'` is account zero. Mainnet uses coin type `0`, which is outside this guide.

The apostrophe marks hardened derivation. The bracketed path describes work already done by the signer; do not apply it again to the xpub. Public-only derivation after the xpub cannot cross a hardened step.

**Never guess the fingerprint or origin.** Copy both from the signer’s own export; do not assume account zero or substitute the xpub’s parent fingerprint for the master fingerprint. If unsure, re-export.

This metadata can also populate BIP-174 PSBT derivation records, helping an offline or hardware signer locate its keys without giving Bawa signing capability.

### Choose the script wrapper

BIP-380 defines the shared syntax. BIP-381 covers legacy constructions such as `pkh` and `sh`; BIP-382 covers SegWit constructions such as `wpkh`. Core also documents Taproot’s separate `tr` extension.

| Form | Output policy |
| --- | --- |
| `wpkh` | Native SegWit, P2WPKH, using one compressed public key. |
| `pkh` | Legacy P2PKH. |
| `sh(wpkh)` | P2SH-wrapped SegWit; not native SegWit. |
| `tr` | Taproot, P2TR, built from an internal key and an optional script tree. |

Changing the wrapper changes the output script and address, even with the same key. Follow the signer’s exported policy rather than choosing a wrapper by preference.

### Testnet receiving and change

For a signer exporting the BIP-84, testnet, account-zero origin shown above:

- **Receiving:** `wpkh([<fingerprint>/84'/1'/0']<xpub>/0/*)`
- **Change:** `wpkh([<fingerprint>/84'/1'/0']<xpub>/1/*)`

These use the BIP-44-style account hierarchy. `/0/*` conventionally tracks external receiving addresses; `/1/*` tracks internal change addresses. Watch both, otherwise change can disappear from the tracker’s view after a spend.

`<xpub>` is a generic placeholder, not a required prefix: Core-compatible test-network exports normally start with `tpub`. Do not relabel an extended key by hand. Select testnet, signet or regtest explicitly in the wallet and node; origin coin type `1` does not switch networks.

These templates omit checksums. After replacing placeholders with public test-wallet export values, use Core’s `getdescriptorinfo` to obtain the checksummed descriptor. Never invent a checksum. It catches many copying errors; it does not prove that the origin or selected network is correct.

### Sources

- Bitcoin Core descriptor reference, including BIP-380/381/382: https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
- BIP-174, PSBT key-origin and derivation fields: https://bips.dev/174/

## Checksums, multipath and a verified import

Use a separate test wallet on testnet, signet or regtest. Never use real funds or production keys.

### The 8-character checksum

A checksummed descriptor ends with `#` followed by eight characters. This checks the exact descriptor body, including its key text and derivation notation.

With the original checksum retained, changing one character in the body must fail validation. Changing one checksum character must fail too. Successful parsing is not enough: a tool that accepts checksum-free text has not performed this check.

Obtain the complete checksummed descriptor from the signer’s public-only export or trusted local descriptor tooling. **Never invent a checksum value.** Do not “repair” an unexplained mismatch by calculating a fresh checksum; return to the signer’s export.

A checksum detects transcription errors, not dishonesty. Someone who changes a descriptor can calculate a matching checksum. A valid checksum therefore does not authenticate the export or prove that its keys and origin are correct.

### Multipath: receiving and change together

These templates show the structure only; they are not import-ready strings and have no checksum:

| Purpose | Descriptor body template |
|---|---|
| Receiving | `wpkh([<fingerprint>/84'/1'/0']<xpub>/0/*)` |
| Change | `wpkh([<fingerprint>/84'/1'/0']<xpub>/1/*)` |
| Both branches | `wpkh([<fingerprint>/84'/1'/0']<xpub>/<0;1>/*)` |

Here, `<0;1>` is literal multipath syntax, not a placeholder. It selects branches `0` and `1`; the trailing `*` varies the address index within each branch. In this convention, those remain separate receiving and change sequences, simply written compactly.

**Never guess the fingerprint or origin.** Take both from the signer’s own export, including every hardened derivation marker. The illustrated `84'/1'/0'` path is not a replacement for that export. Coin type `1` is the testnet convention; it does not by itself select or confirm the network.

Multipath support varies between wallets. If the importer lacks it, use separate public receiving and change descriptors. Each body needs its own tool-generated checksum; the multipath checksum cannot be reused.

### Keep private keys on the signer side

Bawa’s tracker must remain on the xpub/address-only side of the boundary. A descriptor can contain an individual private key or an extended private key. A familiar script wrapper and a valid checksum do not make that safe.

Create a public-only, watch-only export on the signer side. **A descriptor containing any private key must never reach the tracker**, even temporarily for conversion into a public descriptor. Do not paste it into online checksum tools, logs or support messages either.

In a BIP-174 PSBT workflow, signing remains with the signer. Exchanging transaction information and signatures does not require handing private keys to the tracker. Follow your wallet and signer documentation for the hand-off; do not assume a Bawa device-specific integration.

### Verify the import before using it

1. **Check the export independently.** Confirm the network, script policy, account, fingerprint and complete origin against the signer’s export and settings. Validate the checksum before import. Do not infer the network from an address prefix alone.

2. **Inspect the import settings.** Confirm watch-only status, receiving/external and change/internal assignment, watched index ranges and next-address index. The wildcard does not specify how many addresses an importer will watch.

3. **Display the first receiving address on the signer.** Ask the signer to derive and show branch `0`, index `0` on its own trusted screen: `/0/0` in this example. Request the same index from the tracker. A used wallet’s “next unused” address may be further ahead.

4. **Compare the complete address.** The signer’s displayed `<TESTNET_ADDRESS>` must match the tracker’s address character for character, not merely at the beginning and end. A companion application window is not a substitute for the signer screen. If the signer cannot display that address, treat this verification as unfinished.

5. **Check change separately.** Where supported, compare the first change address at `/1/0` as well, and confirm that its branch is marked internal.

A receiving-address match checks that particular derivation and script. It does not prove the origin metadata or the entire watched range.

If anything differs, stop. Check network, policy, account, branch and index against the signer’s records, then re-export and repeat. Do not guess metadata or keep editing paths until something happens to match.

### Sources

- https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
- https://bips.dev/174/

# Hardware signing: transfer routes and screen review

**Use testnet, signet or regtest only. Never use real funds.**

Bawa ships no device integration. Keep it watch-only, using `<xpub>` or public addresses. A separate, compatible wallet must prepare transactions, exchange signing data with the device and handle test-network broadcast. Never import signing secrets into Bawa to make that hand-off easier.

```text
Bawa: public data only
    │
    ▼
Address derivation and monitoring
```

```text
External wallet: unsigned transaction
    │
    ▼
Hardware signer: review, then sign
    │
    ▼
External wallet/node: test-network broadcast
```

## What an air-gap must protect

Air-gapping is a boundary across the key’s lifetime, not simply switching networking off before signing. Keys must be generated, held and recovered within the isolated signing domain, never loaded into a networked machine. Disconnecting a computer after it has handled the seed online does not restore that boundary.

USB hardware can keep keys inside the device without being air-gapped. QR and card routes avoid a live host connection, but still bring untrusted data across the boundary. Physical separation does not make a transaction safe to approve.

## Choose a transfer route

Confirm that the particular device, firmware and external wallet support your chosen test network and transfer format. Bitcoin file and QR workflows commonly carry a partially signed Bitcoin transaction (PSBT); USB may use a device-specific signing protocol.

| Route | Convenience and trust trade-off |
|---|---|
| **USB** | Interactive exchange with little manual handling. Keys should remain inside the signer, but the host has a live communications path into its USB and signing-protocol parsers. Treat the host as potentially hostile. This is not an air-gapped route. |
| **Animated QR** | Scanned frames move signing data between screens and cameras without a cable or mounted storage. Decoders and transaction parsers still process potentially malicious input. An animation being scanned successfully says nothing about whether the payment is correct. |
| **SD/microSD file** | Asynchronous file exchange without a continuous host connection; convenient for larger requests. Trust shifts towards removable media, filesystem handling and transaction parsing. Stale or substituted files remain possible. Transfer transaction data only—never seeds or secret-key backups. |

The return transfer carries signatures or a signed transaction, not signing secrets. None of these routes replaces device-screen review.

## Make the device screen the approval gate

The transaction check that matters is on the signer’s own screen—not Bawa, the desktop preview, a QR viewer or a filename. Compare it with independently confirmed test-payment instructions, rather than merely checking that two potentially compromised host views agree.

Before approving:

- [ ] **Address:** read every recipient’s complete `<TESTNET_ADDRESS>`, paging through it if necessary. Matching only the beginning and end is insufficient.
- [ ] **Amount:** verify each recipient’s amount and the displayed unit.
- [ ] **Fee:** confirm the total transaction fee, not just a rate. Check the rate too when available.
- [ ] **Change:** inspect every change output, separately labelled as change, with its full address and amount. If there is no change, confirm that explicitly.

**Stop without signing if anything differs, an output is unexpected, or any required detail cannot be reviewed on-device.** Do not accept blind signing. A device that hides change without an on-device review option does not meet this guide’s rule.

## Verify that change belongs to the wallet

A coordinator calling an output “change” proves nothing. An attacker can apply that label to their own destination.

During watch-only setup, verify the signer’s public account export. Record `<xpub>` and `<fingerprint>` with the correct test network, account, script type and derivation scheme. A fingerprint is an identifier, not proof of ownership.

Do not assume derivation paths are interchangeable between coins or curves. An exported public node cannot cross a hardened derivation step; public-child derivation also depends on the curve and scheme.

Require the signer to derive and recognise the proposed change address using its own keys, the internal/change branch of that verified account, and the expected wallet policy. Match the full device-derived address to the separately labelled change output on its screen. For multisignature, the complete co-signer and script policy must match—not merely one key.

If that ownership check cannot be completed, stop. Do not substitute the desktop wallet’s reassurance.

## Sources

Authoritative documentation:

- Trezor — derivation paths and curve constraints: https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md
- Ledger — device applications and signing integration: https://developers.ledger.com/

Community experience and product context, not protocol specifications:

- Keycard Shell: https://keycard.tech/products/keycard-shell
- Coldcard Q: https://thebitcoinhole.com/hardware-wallets/coldcard-q

### Firmware discipline, PINs and passphrases

Keep this workflow on **testnet, signet or regtest only**, using separate test-only recovery material. Never use real funds or a real-funds wallet’s secrets.

#### References do not replace setup instructions

**Bawa ships no device integration and does not document a device-specific setup procedure.** Trezor’s derivation-path reference explains curve- and chain-dependent conventions, including limits on public-only derivation. It is not an onboarding recipe.

Use your signer’s and watch-only wallet’s current documentation for descriptor exports and imports, address ranges, PSBT tools and transfer validation. Confirm that the exact model, firmware and wallet software support your chosen test network, script type and transfer route. Do not assume QR, file or SD-card support.

#### Check firmware before test funds move

- Check current supported releases and security notices for the exact model. Obtain firmware—or a stateless signer’s boot image—through the maker or project’s official release channel.
- Confirm the running version and complete the documented signature or boot-verification checks available for that model. A version label alone is not proof, nor is a checksum fetched beside an untrusted download. Stop on unexplained mismatches or authenticity warnings.
- Before updating, understand any reset, recovery and compatibility implications. Keep test recovery material securely available offline. Record the verified release; afterwards, repeat wallet-identity and receive-address checks.

Do this before trusting exports, loading test recovery material or funding a test address. Firmware controls derivation, transaction interpretation and the screen used for verification: compromised code can falsify those checks. Test coins do not make an untrusted signer safe, and a valid release signature does not guarantee bug-free firmware.

#### Separate device access from wallet identity

- **PIN:** where supported, this restricts device access; it does not protect a copied recovery backup. Retry limits, delays and erasure behaviour vary. Read the model’s policy rather than guessing.
- **Optional wallet passphrase:** this changes the wallet derived from recovery material. A typing error can produce a different, empty wallet without an error message. Keep an exact offline record separate from the recovery backup; case and spacing matter. The recovery backup alone cannot recreate that wallet without the passphrase.
- Prefer entry on the signer where supported. If you type a passphrase into a computer, assume it can be captured there. Shield secret entry from observers. Never put recovery words or passphrases in Bawa, watch-only imports, logs or PSBT metadata.

#### Differences to check, not a buying recommendation

| Family | General considerations |
|---|---|
| Trezor | Input methods, security hardware and feature support differ by model. Check the exact model and release rather than treating the brand as one design. |
| Ledger | Device firmware, the Bitcoin application and host tooling are separate compatibility layers. Developer documentation does not imply Bawa integration. |
| Coldcard-style air-gap devices | Supported QR or removable-media transfers avoid a live host connection, but still carry untrusted data. An air gap does not validate a PSBT. |
| SeedSigner-style stateless signers | Designed not to retain the seed across power cycles. Boot-image integrity, repeated wallet-identity checks and protection of external recovery material still matter. |

#### Finish with independent checks

Use the signer’s own public export—`<xpub>`, `<fingerprint>` and key-origin information—with applicable BIP-380/381/382 descriptor rules. A fingerprint alone is not proof of wallet identity. Compare `<TESTNET_ADDRESS>` with the signer’s display before funding.

Follow your tools’ BIP-174 PSBT flow, with BIP-371 support when using Taproot. Bawa does not document construction, signing or finalisation commands. Confirm the chosen network in your tools; an address alone cannot distinguish testnet from signet. On the signer, check destinations, change, amounts and fee before signing.

After broadcast, verify `<TXID>` and its status through a node or explorer on that test network; use your local node for regtest. Submission is not confirmation.

#### Sources

**Official references and standards**

- Trezor derivation-path reference: https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md
- Ledger developer documentation: https://developers.ledger.com/
- Descriptor and PSBT standards: https://github.com/bitcoin/bips

**Community experience, not specifications**

- Coldcard Q: https://thebitcoinhole.com/hardware-wallets/coldcard-q
- SeedSigner: https://thebitcoinhole.com/hardware-wallets/seedsigner

## 09 — Practise test funding, fees and change

**This rehearsal stays on testnet, signet or regtest. Never use real funds.** We’ll fund a separate Bawa test wallet and prepare an unsigned PSBT for device review. Stop before signing: these are workflow checks, not guarantees of particular screens or tool output.

```text
ONLINE — WATCH-ONLY
receive tiny test amounts
│
▼
build and inspect an unsigned PSBT
```

```text
SEPARATE SIGNING DOMAIN — OFFLINE / HARDWARE
import the unsigned PSBT
│
▼
verify recipient, fee and change on the device
│
▼
pause before authorising
```

### 1. Fund the test wallet

Check that the wallet and node use the intended test chain and that the signer supports the chosen setup. Address prefixes alone do not distinguish every test network.

Set up watch-only tracking using public descriptors containing `<xpub>` and key-origin information such as `<fingerprint>`, with the correct derivation paths. Signing secrets stay on the signing side. Use paired descriptors: external `/0/*` for receiving and internal `/1/*` for change.

Generate `<TESTNET_ADDRESS>` from the receiving branch and verify it through the device’s supported address check. A faucet distributes small quantities of test coins; choose one serving your selected network and request only a tiny amount. It needs a receiving address, not signing secrets.

On regtest, locally generated coins are another option, but generated coinbase outputs must mature before spending. Record `<TXID>`, confirm that the expected output arrived, and wait until it is spendable.

### 2. Estimate and reconcile the fee

Build a small payment to another test address you control, leaving room for both fee and change. Inspect the selected inputs and proposed outputs, not just the wallet’s balance.

`fee = total input value − total output value`

Input values come from the previous outputs being spent. Include **every output** in the second total, including change.

There is no separate fee output. When the transaction is mined, the positive remainder becomes the miner’s fee. Removing a change output without changing anything else therefore gives its entire value to the miner. Nothing automatically sends that remainder back to your wallet.

Choose a suitable test-network fee rate in sat/vB. Estimate the eventual signed transaction’s virtual size using its input and output types, including change:

`estimated fee ≈ fee rate × estimated signed virtual size`

The PSBT file’s size is not the transaction’s virtual size. Sparse test-network history can also make automatic fee estimates unreliable; do not interpret an unavailable estimate as a recommendation to pay nothing.

Before signing, recalculate the fee from validated previous-output values and all proposed outputs. Check both the absolute fee and estimated sat/vB rate against your plan and tiny test budget. If the builder omits uneconomic change and adds that remainder to the fee, check the resulting total explicitly. Unverified input-value data is a reason to stop.

### 3. Verify change on the device

Return change to a fresh index on the **same wallet’s internal `/1/*` descriptor**, using the intended account and script policy. An arbitrary pasted address does not become safe merely because the desktop labels it ‘change’.

Keep the relevant output key-origin and derivation metadata in the PSBT. BIP-174 defines the PSBT framework; BIP-371 adds Taproot-specific fields where applicable. A `<fingerprint>` is an identifier, not proof of ownership.

The signer must validate change against its own wallet policy and derived internal script. Use its supported on-device review to verify that change belongs to the intended wallet, and check the change amount alongside the recipient and total fee. Do not assume a particular ‘change’ screen exists.

If your setup cannot support those checks, or any amount remains unexplained, stop and correct the transaction or configuration. Do not authorise a signature yet.

### Sources

- BIP-174: https://bips.dev/174/
- BIP-371: https://bips.dev/371/
- Bitcoin Core descriptors: https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
- Bitcoin Core PSBT workflow: https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md

## 09 — Finish the test-only signing rehearsal

**Stay on testnet, signet or regtest; never use real funds.** Generate disposable test keys on a dedicated signer, separate from any real-fund wallet. This checks the workflow, not a promised sequence of device messages or tool results.

### Complete the round trip

1. Match the chain across all three roles. Record `<TESTNET_ADDRESS>`, the payment amount and fee budget from an independently checked request.
2. On the signer, review recipient, amount, change ownership and fee. Require `SIGHASH_ALL`, or Taproot `SIGHASH_DEFAULT`, without `ANYONECANPAY`: signatures must commit to all inputs and outputs. Stop if essential details cannot be reviewed.
3. Return the signed PSBT to the tracker/coordinator. Compare it with the reviewed transaction, finalise each input, then extract the transaction. Finalisation does not establish network acceptance.
4. Pass only that transaction to the broadcaster. Check `<TXID>` using your chosen test node; submission and mempool acceptance are not confirmation.

```text
TRACKER — prepare PSBT
│
▼
SIGNER — review and sign
│
▼
TRACKER — finalise and extract
│
▼
BROADCASTER — submit unchanged
│
▼
CHOSEN TEST NETWORK
```

### Diagnose before retrying

For each failure, identify which role must correct it before continuing. Never approve known mismatches, guess missing data or export secrets to get past a warning.

| Symptom | Likely cause | Diagnosis |
|---|---|---|
| Device shows a different address | Wrong recipient, change mistaken for payment, or incorrect derivation/script type. | Compare with independently checked `<TESTNET_ADDRESS>`. Verify signer-derived change and descriptor paths; `<fingerprint>` alone does not prove ownership. |
| Device shows a different amount | Unit mismatch, payment/total confusion, or unexpected fee/change. | Compare every output in the same units. Recalculate the fee from verified input amounts minus all output amounts. |
| PSBT will not finalise | Missing signatures, unmet threshold, absent scripts or incompatible Taproot handling. | Check threshold, key derivations and required scripts. For Taproot, check BIP-371 support and required key-path or script-path fields, including leaf/control-block data where applicable. |
| Missing UTXO data | Spent-output information absent or inconsistent. | Verify funding `<TXID>` and output index against the test node. Legacy inputs need the full previous transaction; witness inputs need spent-output amount/script, plus any previous transaction required by signer policy. |
| Wrong network | Wallet or node uses another chain. | Check all chain settings and funding UTXOs. A PSBT is not a chain selector; test networks can share address/key prefixes. |
| Checksum failure | Descriptor/address mistyped, truncated or edited. | Re-export from the verified source and compare the whole value. Do not replace a checksum to conceal an unexplained mismatch; checksums do not authenticate ownership. |
| Broadcast rejected | Unknown/spent inputs, fee policy, invalid transaction or wrong chain. | Read the node’s rejection reason; distinguish policy refusal from invalidity. Check chain, UTXOs/mempool and whether `<TXID>` is already known. Any transaction change returns to review and signing. |

### Keep the boundary intact

Keep the roles separate even if two run on one machine. The broadcaster can withhold a transaction: signatures protect the authorised spend, not delivery.

| Role | Holds and does | Must never receive in this rehearsal |
|---|---|---|
| **Tracker** | Public wallet material only: `<xpub>`/descriptor and origin metadata. Tracks UTXOs; prepares and finalises PSBTs. | Mnemonics, private keys or data keys. |
| **Signer** | Disposable test keys. Reviews recipient, amount, change and fee before signing locally. | Any seed/private key used for real funds, or unrelated data keys. |
| **Broadcaster** | Final transaction only; no keys. Cannot alter its committed contents without invalidating signatures under the policy above. | Seeds, private/data keys, wallet-wide xpubs/descriptors or PSBT metadata. |

Sources:
- https://bips.dev/174/
- https://bips.dev/371/
- https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
- https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md
