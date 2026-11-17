---
title: Signing, Descriptors, PSBT and Hardware
description: Keep signing in a separate trust domain from tracking; use output descriptors and PSBT to hand unsigned transactions to a hardware signer, and verify the signed result before broadcast.
last-updated: 2026-11-09
---

# Signing, Descriptors, PSBT & Hardware

Verified against commit `754721cd` (documentation-only rewrite; code identical to `e3b65fb832db287fdc8d54794980dd0b3456cc12`). Verification work was done on 8 November 2026.

How-to guide.

## Contents

- [Signing: keep it separate from tracking](#signing-keep-it-separate-from-tracking)
- [The fixed derivation policy](#the-fixed-derivation-policy)
- [Hardware wallets](#hardware-wallets)
- [Bitcoin Descriptors & PSBT](#bitcoin-descriptors--psbt)
- [Primary references](#primary-references)
- [Watch-only hand-off: descriptors and PSBT](#watch-only-hand-off-descriptors-and-psbt)
- [A test-only hardware-signing rehearsal](#a-test-only-hardware-signing-rehearsal)
- [PSBT hand-off: Creator, Updater and Signer](#psbt-hand-off-creator-updater-and-signer)
- [Watch-only hand-off: combine, finalise, extract, broadcast](#watch-only-hand-off-combine-finalise-extract-broadcast)
- [Output descriptors: make the watch target explicit](#output-descriptors-make-the-watch-target-explicit)
- [Checksums, multipath and a verified import](#checksums-multipath-and-a-verified-import)
- [Hardware signing: transfer routes and screen review](#hardware-signing-transfer-routes-and-screen-review)
- [What an air-gap must protect](#what-an-air-gap-must-protect)
- [Choose a transfer route](#choose-a-transfer-route)
- [Make the device screen the approval gate](#make-the-device-screen-the-approval-gate)
- [Verify that change belongs to the wallet](#verify-that-change-belongs-to-the-wallet)
- [Sources](#sources)
- [Practise test funding, fees and change](#practise-test-funding-fees-and-change)
- [Finish the test-only signing rehearsal](#finish-the-test-only-signing-rehearsal)

Use this when you need to authorise transactions. The signing environment should be a separate trust domain from the online tracker.

**Definitions (in this guide):** separate trust domain — a signing environment separate from the online tracker; high-value — systems for which the guide recommends offline or hardware-backed signing; D21 — the 8 November 2026 demonstration run (docs/14:92); published fixture sender — `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` (docs/14:65); original derivation inputs — the values used in the original derivation; seed-guessing resistance — the difficulty of guessing the seed.

## Signing: keep it separate from tracking

A very useful architecture is:

```text
TRACKER / WEB SERVER

xpub / address only
      │
      ├── derives and watches addresses
      ├── constructs unsigned transaction from xpub and payment details
      └── verifies signed result before broadcast

SIGNER

private key / hardware wallet
      │
      ├── signer (or its operator) checks transaction before signing
      └── signs transaction

NETWORK

broadcast signed transaction
```

The tracking service should not need the private key (see [watch-only derivation](../../tools/hdwallet-gen/derive.js)).

The web server should not become the place where the seed is loaded just because signing is inconvenient (see [wallet generation](../../tools/hdwallet-gen/generate.js)).

For systems handling any amount whose loss would be material to the holder, move signing into an offline or hardware-backed trust domain (see [watch-only derivation](../../tools/hdwallet-gen/derive.js) and [wallet generation](../../tools/hdwallet-gen/generate.js)).

---

The dedicated EIP-1559 construction/signing demonstration was verified on [Core 4.9.2](../../CHANGELOG.md) ([D21, line 92](../14-wallet-app-implementation/README.md), 2026-11-08; [4.8.4 pin; 4.9.2 demonstrated reference, line 23](../../CHANGELOG.md)), with `txMode: 1` producing a `0x02` envelope ([enum/wire-byte distinction, line 1718](../android-wallet/ANDROID-GUIDE.md)) and Python independently recovering the [published fixture sender, line 65](../14-wallet-app-implementation/README.md). Verification was limited to Node v24; browser send/sign was not exercised and nothing was broadcast.

## The fixed derivation policy

Identify this policy as `bawa-derivation-policy-v1` (see [fixed generation paths](../../tools/hdwallet-gen/generate.js)); detecting future changes requires version discipline or an implemented check, not the label alone. At `3019b02`, no tool emits or checks the policy name (0 occurrences in `tools/`, `test/` or `apps/`), so detection relies on version discipline: compare derived addresses against the versioned table (see [RECOVERY.md, line 50](../RECOVERY.md)). Read the paths below in [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) notation.

| Asset or setting | Fixed policy |
|---|---|
| BTC | native SegWit (bech32), [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki), `m/84'/0'/0'/0/i` (mainnet; [testnet4 deviation](#derivation-policy-versus-the-standards)), account `0`, receiving branch `0` |
| ETH | [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), `m/44'/60'/0'/0/i` |
| TRX | [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), `m/44'/195'/0'/0/i`, coin type `195` ([SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)) |
| TON | Generation-only from `m/44'/607'/0'`, single deposit address, no xpub |
| BIP-39 mnemonic | [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), 256-bit entropy, 24 words |
| [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) passphrase ("From mnemonic to seed" section) | Empty, zero characters (Bawa's policy choice; changing it creates a different wallet) |

Changing these values can produce different addresses. Do not add alternative paths, and never change this policy in a wallet built from this guide. Check every derivation setting and compare the wallet's derived addresses and descriptor fields against this versioned table, including for an already-generated wallet (derive the addresses with `tools/hdwallet-gen/derive.js` and compare).

### Why each choice, and what breaks if you change it

Different paths, a changed mnemonic or a non-empty BIP-39 passphrase produce different addresses. The wallet can look empty: the funds are not lost, but are unreachable from this policy. Keep the policy fixed and check the original derivation inputs when investigating a mismatch.

**BTC.** A different BTC path changes the receiving addresses. Use `m/84'/0'/0'/0/i` to keep native SegWit receiving addresses on the fixed BIP-84 account and branch. Derive with `tools/hdwallet-gen/derive.js` and compare account `0`, receiving branch `0`, coin type `0` and the complete path against the table.

**ETH.** A different ETH path changes the addresses. Use `m/44'/60'/0'/0/i` so generation and recovery select the same BIP-44 ETH account. Derive with `tools/hdwallet-gen/derive.js` and compare account `0`, receiving branch `0`, coin type `60` and the complete path against the table.

**TRX.** A different TRX path changes the addresses. Use `m/44'/195'/0'/0/i` so generation and recovery select the same BIP-44 TRX account. Derive with `tools/hdwallet-gen/derive.js` and compare account `0`, receiving branch `0`, coin type `195` and the complete path against the table.

**TON.** A different TON path changes the deposit address. Use `m/44'/607'/0'` to reproduce the generated key and deposit address. TON is [generation-only](../02-chains/README.md) because Bawa supports it for generation and deposit only, with no xpub watch-only flow. Derive with `tools/hdwallet-gen/derive.js` and compare account `0`, coin type `607` and the complete generation path against the table; confirm that only one deposit address is generated.

**BIP-39 mnemonic.** Changing the word count changes the seed and addresses. Use a 24-word mnemonic to encode the required 256 random bits plus 8 checksum bits. The checksum adds no independent randomness. Check the 256-bit entropy requirement and the 24-word count.

**BIP-39 passphrase.** A non-empty BIP-39 passphrase changes the seed and addresses, creating a different wallet. Use the fixed empty BIP-39 passphrase (Bawa's policy choice), which contributes no additional secret, to keep the seed determined by the mnemonic alone. The empty-passphrase requirement is Bawa policy, not a BIP-39 determinism requirement. Before generation or recovery, inspect the passphrase field in the wallet's derivation settings and check that it contains zero characters.

NFKD-normalise the BIP-39 mnemonic and BIP-39 passphrase. Following [BIP-39 ‘From mnemonic to seed’](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki#from-mnemonic-to-seed), derive the 64-byte seed from the normalised mnemonic using PBKDF2-HMAC-SHA512 with 2,048 iterations and a salt of `"mnemonic"` plus the normalised BIP-39 passphrase. Assess seed-guessing resistance separately from randomness quality, implementation security and device compromise. Set a target maximum probability of recovering the 64-byte seed and state the mnemonic/passphrase assumptions and an offline guessing attacker’s strategy and budget in guesses. Evaluate candidate mnemonic/passphrase guesses using the recipe above with 2,048 iterations; report the estimated seed-recovery probability within that budget and accept only if it does not exceed the stated target. This result is conditional on those assumptions, that offline threat model and the stated iteration count, not an absolute guarantee.

### Derivation policy versus the standards

Distinguish Bawa's fixed policy from the testnet standards (see the [documented deviation](#output-descriptors-make-the-watch-target-explicit)). Bawa gives Bitcoin testnet4 the mainnet derivation `m/84'/0'/0'/0/i`. [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) registers coin type `1` for testnet, and [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) gives testnet native SegWit the `vpub` prefix `0x045f1cf6` with derivation prefix `m/84'/1'`.

Importing a Bawa mnemonic into a standard testnet wallet derives a different derivation subtree/account key (the account index remains 0, but the coin-type branch differs) (see [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) and [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)). Keep the [Bawa policy](#the-fixed-derivation-policy) unchanged and treat this as a [documented deviation](#output-descriptors-make-the-watch-target-explicit), not an alternative path to adopt. Check that Bawa derivation still uses `m/84'/0'/0'/0/i`: from the repository root, derive with `tools/hdwallet-gen/derive.js` and compare the result against the versioned table; pass only if the path, prefix and origin match the table exactly.

Bawa's own tools emit `zpub` for the BTC testnet4 account because [`tools/hdwallet-gen/generate.js:90`](https://github.com/Pr3eve6ti2o/bawa/blob/a5bc56e7a51b44e03f51d7395bd32901c16c3d4f/tools/hdwallet-gen/generate.js#L90) pins `HDVersion.zpub`. Emission is also evidenced by the Core 4.8.4 WASM check [recorded in docs/11](../11-trust-wallet-and-independent-verification/README.md). Separately, the repaired `derive.js` run (`node tools/hdwallet-gen/derive.js`, run from the repository root) consumed the [published ripple-fixture zpub, line 153](../11-trust-wallet-and-independent-verification/README.md) and derived `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` (mainnet-format `bc1q`, not `tb1q`).

The resulting export differs from a standard testnet BIP-84 export, which would be `vpub`. Do not relabel an extended key by hand. Check the prefix against this documented behaviour by deriving with `tools/hdwallet-gen/derive.js` from the repository root and comparing the result against the versioned table; pass only if the path, prefix and origin match the table exactly:

> **Expected result:** A prefix-checking tool sees `zpub` for Bawa's BTC testnet4 account.

Using the [published 15-word ripple fixture mnemonic](../11-trust-wallet-and-independent-verification/README.md#ripple-fixture-and-shared-settings) for wallet creation violates the 24-word policy. Use it only as a published test vector, not a creation example, and never mix a 15-word test mnemonic into a 24-word wallet flow. Check that non-fixture testnet wallets created by this guide use 24 words by counting the words in the mnemonic produced by `tools/hdwallet-gen/generate.js` or recorded in the wallet's creation record (counting words does not verify entropy or checksum); derive with `tools/hdwallet-gen/derive.js` from the repository root and compare the result against the versioned table; pass only if the mnemonic has 24 words and the path, prefix and origin match the table exactly.

### The descriptor convention is different

Read the descriptor examples in [Output descriptors](#output-descriptors-make-the-watch-target-explicit) and [Testnet receiving and change](#testnet-receiving-and-change) as descriptions of an external hardware signer's export. They use `m/84'/1'/0'` because coin type `1` is the testnet convention. This is **not a Bawa-generated wallet**.

Using the external signer's testnet origin to derive a Bawa wallet selects a different account. Never mix origins (see the [origin definition](#output-descriptors-make-the-watch-target-explicit)): a Bawa-generated wallet uses the purpose/coin-type prefix `m/84'/0'`, while an external signer export uses the signer's own origin. Record the fingerprint and origin from the signer's own export, and check that the descriptor preserves both; from the repository root, derive with `tools/hdwallet-gen/derive.js` and compare the result against the versioned table; pass only if the path, prefix and origin match the table exactly and the descriptor's fingerprint and origin match those in the signer's export exactly. See [Output descriptors](#output-descriptors-make-the-watch-target-explicit) for the signer export and a descriptor example.

## Hardware wallets

Hardware wallets isolate key custody and signing within the device.

### Trezor

Trezor's firmware repository documents per-coin derivation paths and shows an important concept: paths differ by curve and blockchain family, and blank entries in the tables' public-node column may suggest limits on public-node support, but do not establish that public nodes are impossible.

See:

https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md

### Ledger

Ledger's developer documentation separates device apps, signing flows and wallet integration. Its current documentation also emphasises user review and clear transaction presentation on the signing device.

See:

https://developers.ledger.com/

For EVM hardware signing, the device is not “an RPC provider”. It is a secure signing surface: it signs but never serves RPC calls. Verify that it exposes no RPC endpoint and that signing requires confirmation on the device.

That distinction should remain intact.

---

## Bitcoin Descriptors & PSBT

The same xpub is ambiguous because it can be used for P2PKH, P2WPKH or nested-SegWit in Bitcoin watch-only systems. Output descriptors can retain script policy, derivation origin and ranged derivation patterns (/0/*).

[Bitcoin Core descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md) should be read alongside [BIP-174](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki) for offline and hardware-backed transaction workflows.

```
online watch-only system
    ↓
unsigned transaction / PSBT
    ↓
offline or hardware signer
    ↓
signed PSBT
    ↓
watch-only coordinator — finalises and extracts
    ↓
signed transaction
    ↓
broadcast node / RPC (watch-only side)
```

## Primary references

- [BIP-174 / PSBT](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)
- [BIP-371](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki) (Taproot-only; not used in this SegWit v0 flow)
- [BIP-380](https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki)
- [BIP-381](https://github.com/bitcoin/bips/blob/master/bip-0381.mediawiki)
- [BIP-382](https://github.com/bitcoin/bips/blob/master/bip-0382.mediawiki)
- [Bitcoin Core descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md)
- [Bitcoin Core PSBT](https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md)
- [Trezor](https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md)
## Watch-only hand-off: descriptors and PSBT

**Conceptual workflow, testnet, signet or regtest only; never real funds.**

Tracking and authorisation belong in separate trust domains. The signing domain includes private keys, seeds, the signer device and its screen, and the offline seed backup; recovery happens inside it. The tracker, the web server and the network are outside it. Private keys and seeds never leave the signing domain. Under this guide's threat model, the signing domain is offline/hardware-isolated. A browser vault does not meet that definition and is in tension with this rule; browser signing is not an intended signing domain and must not be treated as meeting the rule. Signing inconvenience is not a reason to load a seed onto the web server.

Bawa does not ship a device integration. This flow follows the descriptor and PSBT standards; use your chosen watch-only wallet and signer’s documentation to set it up.

### What each part carries

| Item | Role in this flow |
|---|---|
| xpub / address | Tracker input for deriving and watching addresses. |
| Descriptor | Keeps script policy, derivation origin and ranged derivation patterns (/0/*) together. |
| PSBT (BIP-174/371) | Built unsigned by the watch-only side, signed offline or on hardware, then returned to the watch-only coordinator for finalisation and extraction; the watch-only side broadcasts the final transaction. |
| Private key / hardware wallet | Belongs to the signer, not the tracker. |

Descriptor handling must preserve the tracker’s xpub/address-only boundary.

[BIP-380](https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki)/[BIP-381](https://github.com/bitcoin/bips/blob/master/bip-0381.mediawiki)/[BIP-382](https://github.com/bitcoin/bips/blob/master/bip-0382.mediawiki) define the descriptor rules for this SegWit v0 flow. [BIP-386](https://github.com/bitcoin/bips/blob/master/bip-0386.mediawiki) covers Taproot descriptors and is out of scope for this flow. For native SegWit on testnet, the receiving and change patterns are:

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

This section is a conceptual checklist, not a procedure. The PSBT flow follows BIP-174/371. These checks describe the stages, **not literal tool output**.

1. **Prepare on watch-only.** Build the unsigned PSBT. 
  **Expected result:** an unsigned PSBT on the tracking side; signing stays in the separate signer domain.

2. **Review on the signer.** Transfer the PSBT using QR, a file or an SD card, as supported by your device. Verify the address and amount on the signing device’s own screen. Bawa does not document device-specific transfer and review steps; follow your device’s instructions. 
  **Expected result:** the intended test address and amount on that screen. **Stop if the device screen does not show the intended address and amount.**

3. **Authorise separately.** Sign in the offline or hardware environment and return the signed PSBT to the watch-only side. 
  **Expected result:** a signed PSBT returning across the boundary, not private-key or seed material.

4. **Finalise and broadcast online.** The watch-only side finalises the signed PSBT and broadcasts the transaction. 
  **Expected result:** the signed transaction handed to the testnet. Bawa does not document exact broadcast-success or confirmation output. Use the transaction ID to verify the broadcast on an explorer for that testnet.

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
## A test-only hardware-signing rehearsal

**Conceptual workflow, testnet, signet or regtest only; never real funds.** These are workflow checks, not guarantees of particular device messages or tool output.

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
TESTNET / SIGNET / REGTEST ONLY
```

### Walkthrough

The steps follow the **BIP-174 PSBT flow**. BIP-371 covers Taproot PSBTs.

1. **Establish the boundary.** Keep tracking public-only and signing separate. Private keys and seeds must never leave the signing domain. Bawa does not document a device-specific setup; follow your device’s onboarding, test-network selection and firmware compatibility guidance. Without a verified test-only setup, keep this as a paper exercise: a written walkthrough record of the intended addresses, amounts, transfer routes and checks to perform, with no funds moved. The test-fund funding procedure remains an open item; the guide does not provide one. 
  **Expected result:** xpub/addresses on the tracking side, with the private key confined to the signing domain, not loaded into the web server.

2. **Build on the watch-only side.** Prepare an unsigned PSBT for the intended test payment. Bawa does not document construction commands or wallet-specific controls; use your watch-only wallet’s documentation. 
  **Expected result:** an **unsigned PSBT** (see the full [Hand-off checks](#hand-off-checks) checklist), ready for the Updater to complete, then for the separate signer.

3. **Transfer and review.** Pass the PSBT to the signer using a supported QR, file or SD-card route. Bawa does not document device-specific transfer support; check your wallet and signer documentation before choosing a route. For this walkthrough, the user must compare the address and amount on the **signing device’s screen** with the intended test payment and stop if either differs or cannot be reviewed. 
  **Expected result:** the intended address and amount on the signing device itself. The online display alone is not this check.

4. **Authorise and return.** Only after that review, authorise test-only signing and return the signed PSBT to the watch-only side. Bawa does not document exact device messages or signing controls; follow your device’s signing instructions. 
  **Expected result:** a **signed PSBT** crossing back to the online side; signing remains in its separate trust domain.

5. **Finalise, then broadcast.** The watch-only side finalises and broadcasts solely to the verified testnet. This is a separate stage from authorisation. Bawa does not document wallet-specific broadcast success messages or confirmation procedures; consult your wallet’s documentation. 
  **Expected result:** the **signed transaction** passed to the network from the online side. Verify the broadcast by looking up its transaction id on an explorer for [testnet4](#derivation-policy-versus-the-standards); use your local node for regtest.

### Reference, not an integration promise

The [Trezor firmware path reference](https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md) documents per-coin derivation paths. Paths differ by curve and blockchain family; public nodes are possible only where the derivation rules support them.

Bawa ships no device integration and does not document a device-specific setup procedure. The Trezor reference is not a Bawa-Trezor setup guide, and Bawa does not prescribe a device-specific testnet derivation path. A PSBT whose origin is Bawa cannot be imported from an external signer (see [the descriptor convention](#the-descriptor-convention-is-different) and [the documented deviation](#output-descriptors-make-the-watch-target-explicit)).

### What the runbook still needs

Under **[BIP-380](https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki)/[BIP-382](https://github.com/bitcoin/bips/blob/master/bip-0382.mediawiki)**, a native-SegWit descriptor carries **script policy, derivation origin and ranged derivation patterns (/0/*)**. ‘Script policy’ is the guide’s term for ‘how those keys become spendable outputs’ (see [the definition](#output-descriptors-make-the-watch-target-explicit)), not a BIP-380 term. See also [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) and [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).

- **Receiving and change:** See the canonical receive/change descriptor pair in [Watch-only hand-off: descriptors and PSBT](#watch-only-hand-off-descriptors-and-psbt).

These are BIP-84-style paths using the BIP-44 hierarchy, with testnet coin type `1`. Record the fingerprint and derivation origin from the signer’s own export; do not assume the example path matches your device.

The PSBT workflow comes from **BIP-174/371**, not a Bawa device integration. Bawa does not document a device-specific recipe. Use your wallet and signer documentation to confirm these details before attempting the rehearsal:

| Area | What to confirm |
|---|---|
| Onboarding | Device setup, firmware compatibility, test-network selection and verification, and test-fund setup. Use test funds only. |
| Descriptors | Wallet-specific import/export syntax, policy selection (not a standardised BIP-380 field) and exact address-range settings. Confirm the fingerprint and exact origin/path against the signer’s own export. |
| Fee policy | Which fee policy to apply. |
| Sighash policy | Which sighash policy to apply. |
| Recipient/change verification | How to verify recipients and change. |
| Signing/extraction ownership | Who is responsible for signing and extraction. |
| PSBT | Construction, validation and finalisation procedures; format compatibility and supported transfer routes. |
| Integration | Bawa does not ship a device integration, so there is no Bawa connector setup to follow. Use your wallet and signer documentation for device-specific signing controls and broadcast/status procedures. |

## PSBT hand-off: Creator, Updater and Signer

**Conceptual workflow, testnet, signet or regtest only; never real funds.**

Bawa does not include a device integration. In this guide, “coordinator” is a non-BIP term for the PSBT-orchestrating watch-only wallet; role assignment differs by wallet. Use your chosen watch-only wallet as coordinator and follow its and the signer’s documentation. Keep seeds and private keys in the signing domain, never on the tracker or web server.

Descriptors give the coordinator script policy, public derivation information such as `<xpub>`, and key origins such as `<fingerprint>`. The coordinator normally acts as **Creator** and **Updater**. In this guide’s workflow, only the separate signer may perform the **Signer** role.

A PSBT carries data, not permission to sign: anyone can assemble one. Metadata does not prove ownership or consent. In this guide’s workflow, participants must preserve all fields, regardless of role, when passing it on. If required safety checks cannot be completed, stop rather than strip fields.

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

### 1. Creator, build the unsigned transaction

Select inputs by `<TXID>` and output index. Set recipient amounts and output scripts using `<TESTNET_ADDRESS>`, include change where needed, and choose input sequences and locktime deliberately. The fee is the difference between total input and output values, not another output.

No keys are needed to construct this proposal from known outpoints and output scripts. In BIP-174’s PSBT v0 format, the global unsigned transaction has empty `scriptSig` fields and no witness data. Signatures belong in separate PSBT fields; the Creator must initially create empty input and output fields.

**Expected result:** an unsigned PSBT containing the expected inputs and outputs, with no signatures and no private keys or seeds on the coordinator.

### 2. Updater, supply the spending context

The coordinator adds information that the signer needs to validate the proposal:

- **UTXOs, unspent transaction outputs:** legacy inputs should include `non_witness_utxo`, the complete previous transaction. SegWit inputs can use `witness_utxo`, containing the previous output’s amount and locking script; signers may also require complete previous transactions, particularly for SegWit v0 fee checks. Previous transactions must match the input outpoints. If both UTXO forms are present, they should agree (guidance derived from BIP-174).
- **Key origins:** attach public keys, `<fingerprint>` (eight hex characters; BIP-380) and derivation paths from the descriptor, if known/present. Include output derivations, if known/present, to help identify change, without treating those claims as proof.
- **Scripts:** include required redeem scripts and witness scripts. For Taproot, use [BIP-371](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki)’s internal-key, Merkle-root (`PSBT_IN_TAP_MERKLE_ROOT = 0x18`) and derivation fields, plus leaf scripts and control blocks where needed for script-path spending.
- **Sighash:** record the intended signature-hash mode, or agree the signer’s default. Ordinary `SIGHASH_ALL` and Taproot’s `SIGHASH_DEFAULT` ([BIP-341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)) commit to all outputs. Other modes can leave transaction parts changeable. An explicitly requested mode must be honoured or signing refused.

Adding these fields does not approve the transaction. They give the signer evidence to check, not instructions it must trust.

**Expected result:** an unsigned, populated PSBT with enough UTXO, script and key-origin information for your signer to verify the spend and calculate the fee.

### 3. Signer, verify on device, then sign

Transfer the PSBT using QR, a file or an SD card, provided both the transfer route and the PSBT representation are compatible end to end with your signer (see the [device-screen check](#hand-off-checks)).

The signer must validate the consistency of UTXO data and scripts, independently verify its own matching public keys, and verify change against its expected wallet policy (see [Shared definitions note](#shared-definitions-note)). A coordinator’s fingerprint or “change” label is not proof. The signer must also enforce an acceptable sighash policy (see [Shared definitions note](#shared-definitions-note)). Under BIP-174, an Input Finalizer may finalise only if a sighash type is provided.

#### Shared definitions note

“Wallet policy” is this guide’s term for the signer’s rules for which spends it will authorise. It is related to, but is not the same as, script policy. “Sighash policy” specifies which sighash modes the signer will accept; “acceptable” means the signer accepts only the modes that policy names.

Verify the addresses are test-network addresses. Do not approve or sign unless all the following checks pass on the device’s own trusted screen (this guide’s stricter policy):

- the intended test-network setting (testnet4): the device must show the testnet4 network name or indicator;
- every recipient `<TESTNET_ADDRESS>` and amount, compared with an independent record of your intended payment;
- the total fee and any additional outputs, with change independently verified by the signer.

**Stop if the device cannot show the intended address and amount, an output is unexplained, or the fee cannot be verified.**

Only after these checks and on-device approval may the signer add partial signatures or [BIP-371](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki) Taproot signatures (Taproot’s `SIGHASH_DEFAULT` is defined by [BIP-341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)). For combining and finalising, see [Combiner, merge signed copies](#combiner-merge-signed-copies) and [Finalizer, build the final input scripts](#finalizer-build-the-final-input-scripts) below. Return the PSBT with unknown fields preserved. It may still need other signatures; finalisation and broadcast are later stages.

**Expected result:** the intended test addresses and amounts for all recipients as defined by this guide’s policy, shown on the signer’s screen, followed by a signature-bearing PSBT; private keys remain in the signing domain (they never cross to the tracker). The online display alone is not this check.

### Sources

Sources for the PSBT hand-off section above.

- BIP-174: https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
- BIP-341: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
- BIP-371: https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki
- BIP-380: https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki
- Bitcoin Core PSBT documentation: https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md
- Vendor worked example (Coldcard/Coinkite), not a specification: https://Coldcard.com/learn/hardware-wallets/what-is-a-psbt

## Watch-only hand-off: combine, finalise, extract, broadcast

**Conceptual workflow, testnet, signet or regtest only; never real funds.**

The watch-only coordinator performs the Combiner role only when separate copies exist; it performs the Finalizer and Extractor roles, then requests broadcast from a node. Only the signer creates spending signatures, after reviewing the destination, amount, change and fee. Private keys and seeds stay in the signing domain. These are roles, not fixed device types: a signer may also finalise.

A PSBT is a data container, not authorisation by itself. Receiving or combining it grants no spending authority; valid signatures authorise what they commit to. However, a sufficiently signed PSBT (one in which every input carries the signatures its spending policy requires, as counted by the Combiner) may let its holder finish and broadcast without another device approval. Treat a spend-ready signed PSBT like a signed transaction: store it as securely as a signed transaction, never share it casually, and assume its holder can finish and broadcast it.

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

### Combiner, merge signed copies

For the signing checks, see [PSBT hand-off: Creator, Updater and Signer](#psbt-hand-off-creator-updater-and-signer) above. Combining follows [BIP-174](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki).

Merge only PSBTs for exactly the same unsigned transaction. In multisig, different signers may return separate copies containing their partial signatures. The Combiner brings those signatures and supporting fields together without changing the transaction.

In this guide, the Combiner verifies each partial signature’s validity when merging. Spending policy means the rule stating which signatures authorise a spend; satisfying stack means the witness data that satisfies the spending script; script policy means how keys become spendable outputs. Count distinct valid signatures against each input’s spending policy, not the number of returned files. Merging the same signature twice does not help meet a threshold.

Reject mismatched transactions. If fields conflict, this guide’s stricter Combiner policy is to stop and investigate rather than silently choosing a value. BIP-174 permits arbitrary choice of conflicting fields. Combining creates no signatures and is not a cryptographic signature-aggregation protocol.

**Expected result:** one PSBT with the transaction unchanged, supporting metadata retained and returned signatures associated with the correct inputs. More signatures may still be needed.

### Finalizer, build the final input scripts

Finalisation follows [BIP-174](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki).

Finalisation works input by input. If `PSBT_IN_SIGHASH_TYPE` is present and any signature’s sighash differs from that value, the Input Finaliser MUST fail that input. Using sufficient signatures and the required script data, the finaliser constructs the final `scriptSig`, witness, or both, as appropriate. Script-based multisig needs signatures arranged as its spending script requires.

For Taproot, use the BIP-371 data for the chosen spending path. A script-path witness needs the selected tapscript, control block and satisfying stack; collecting signatures alone is not enough.

Finalisation also performs the PSBT rules’ clean-up of recognised intermediate signing fields. Retain UTXO data and unknown fields, and leave global and output maps unchanged. This specified clean-up is not permission to discard unfamiliar metadata.

Finalising needs no private keys, but it cannot repair missing signatures or an unsupported spending path.

**Expected result:** the required final `scriptSig` and/or witness for each completed input. Continue to extraction only when every input is finalised.

### Extractor, produce the network-format transaction

The Extractor takes the completed PSBT and assembles a serialised Bitcoin transaction, including the final input scripts and witnesses. Its output is transaction bytes, commonly displayed as hexadecimal, rather than another PSBT.

PSBT key origins and proprietary metadata are not transaction fields: they remain in the PSBT record, not the network bytes. Extraction creates no signatures and sends nothing.

Bitcoin Core’s `finalizepsbt` can perform finalisation and extraction together. That convenience does not make extraction a broadcast operation.

**Expected result:** a decodable raw transaction matching the reviewed spend: Bitcoin Core's transaction decoder must parse it as a fully valid Bitcoin transaction under BIP-174, not merely decode it as bytes. Check outputs and, using the retained UTXO amounts, the fee. A calculable `<TXID>` is not evidence of network acceptance.

### Broadcast, relay, not authorise

Submit the extracted transaction, not the PSBT, to a node configured for the intended testnet. The coordinator needs no private keys for this. Anyone holding the completed transaction can attempt broadcast; the signatures already carry the relevant authorisation.

Nodes still apply consensus checks and mempool policy. Extraction does not guarantee acceptance, and acceptance or relay does not mean confirmation.

Verify `<TXID>` through your node or an explorer for that same test chain. For regtest, use your local node rather than a public explorer.

**Expected result:** `<TXID>` recognised in the chosen node’s mempool or a block. Check confirmations separately; do not infer them from a successful submission.

### Sources

For PSBT sources, see the [Sources](#sources) list in [PSBT hand-off: Creator, Updater and Signer](#psbt-hand-off-creator-updater-and-signer).

## Output descriptors: make the watch target explicit

See also the [PSBT hand-off: Creator, Updater and Signer](#psbt-hand-off-creator-updater-and-signer) and [Watch-only hand-off: combine, finalise, extract, broadcast](#watch-only-hand-off-combine-finalise-extract-broadcast) sections.

Keep descriptor handling within Bawa’s xpub/address-only boundary: public keys, script policy and derivation metadata, never signing secrets. Use testnet, signet or regtest only, with no real funds or real-funds wallet exports (including exports from previously funded zero-balance wallets, wallets intended for real funds and shared-seed wallets).

### What a descriptor fixes

A bare xpub lets you derive non-hardened child public keys. It does not, by itself, settle:

- **Script policy:** how those keys become spendable outputs.
- **Full derivation origin:** which master key and path produced the exported key.
- **Address family:** which branch and child sequence the tracker should follow.

A descriptor makes the output construction and derivation rule explicit. Its optional origin annotation records provenance. A wildcard defines a ranged address family, but **does not store numerical scan bounds**. Keep the import/scan range and next unused index separately; the descriptor does not say which addresses have already been used.

### Key-expression anatomy

Read a ranged public-key descriptor as an optional bracketed origin, the exported account extended public key, a derivation suffix and a final wildcard:

`[<fingerprint>/84'/1'/0']<xpub>/0/*` (schematic, not import-ready; see [the 8-character checksum](#the-8-character-checksum))

| Part | Meaning |
| --- | --- |
| `<fingerprint>` | The master key's four-byte fingerprint, written as eight hexadecimal characters. |
| `/84'/1'/0'` inside brackets | Full origin path from the master to this account key. |
| `<xpub>` | The signer-exported account extended public key. |
| `/0` after the key | Non-hardened receiving branch. |
| `/*` | Non-hardened child index, varied across the address range. |

Read `84'` as [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)'s native SegWit purpose and the final `0'` as account zero. Treat the apostrophe as a hardened-derivation marker.

Mixing origins misrepresents the wallet's derivation policy: these external hardware-signer templates use `m/84'/1'/0'`, with testnet coin type `1` under [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md), whereas Bawa's fixed `bawa-derivation-policy-v1` uses `m/84'/0'` for Bitcoin on testnet4, a documented deviation from the standards. **Never mix origins:** use `m/84'/0'` for a Bawa-generated wallet and the signer's own origin for an external export. Always take the fingerprint and origin from the signer's own export; if unsure, re-export. Changing an extended-key prefix re-encodes the same node; it does not move it onto another derivation path. For the extended-key prefix list, see docs/05.

Public-only derivation after the extended public key cannot cross a hardened step. Treat the bracketed path as work already done by the signer; do not apply it again to the extended public key. Check the origin against the signer's export.

Incorrect origin metadata can misdirect a signer. **Never guess the fingerprint or origin.** Do not assume account zero or substitute the extended public key's parent fingerprint for the master fingerprint. If unsure, re-export.

Use this metadata to populate BIP-174 PSBT derivation records, helping an offline or hardware signer locate its keys without giving Bawa signing capability.

### Choose the script wrapper

Use BIP-380's shared syntax. Refer to BIP-381 for legacy constructions such as `pkh` and `sh`, and to BIP-382 for SegWit constructions such as `wpkh`. Consult [Bitcoin Core's descriptor documentation](https://github.com/bitcoin/bitcoin/blob/e211dd0186e9646167d063a16f0da88e5f72e05f/doc/descriptors.md) (pinned as at 17 November 2026) for Taproot's separate `tr` extension ([BIP-386](https://github.com/bitcoin/bips/blob/master/bip-0386.mediawiki)).

| Form | Output policy |
| --- | --- |
| `wpkh` | Native SegWit, P2WPKH, using one compressed public key. |
| `pkh` | Legacy P2PKH. |
| `sh(wpkh)` | P2SH-wrapped SegWit; not native SegWit. |
| `tr` | Taproot, P2TR, built from an internal key and an optional script tree. |

Changing the wrapper changes the output script and address, even with the same key. Follow the signer's exported policy rather than choosing a wrapper by preference, then check the wrapper against that export.

### Testnet receiving and change

For an external hardware signer exporting the BIP-84 testnet account-zero origin shown above, use the canonical receive/change descriptor pair in [Watch-only hand-off: descriptors and PSBT](#watch-only-hand-off-descriptors-and-psbt).

Read these as the BIP-44-style account hierarchy: `/0/*` conventionally tracks external receiving addresses, and `/1/*` tracks internal change addresses (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) and [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)). The fingerprint placeholder must be replaced with exactly 8 hex digits, and the key must be account-level.

Change can disappear from the tracker's view after a spend if you omit the change branch. **Watch both branches, receiving `/0/*` and change `/1/*`.** Check that the tracker includes both.

Treat `<xpub>` as a generic placeholder, not a required prefix. A generic test-network export may carry `tpub`, but a [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) testnet account export uses `vpub` (`0x045f1cf6`), assigned by [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) to testnet native SegWit under `m/84'/1'`. Bitcoin Core expects network-appropriate `xpub`/`tpub` in descriptors, not verbatim `zpub`/`vpub`.

Expect Bawa's own tools to emit `zpub` for the Bitcoin testnet4 account because the code pins `HDVersion.zpub`. Note the verified result from running the repaired `derive.js` with the published ripple-fixture `zpub`:

> **Expected result:**
>
> Derived address: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` (mainnet-format `bc1q`, not `tb1q`).

Hand-edited prefixes no longer match the signer's export. **Do not relabel an extended public key by hand.** Check the extended public key against the signer's own export; if unsure, re-export.

Origin coin type `1` does not switch networks. Select testnet, signet or regtest explicitly in the wallet and node, then confirm that both use the intended network.

These templates omit checksums. A checksum catches many copying errors, but even a valid checksum does not authenticate the export or prove that the origin or selected network is correct. **Never invent a checksum.** After replacing placeholders with public test-wallet export values, use Core's `getdescriptorinfo` to obtain the checksummed descriptor. Check the extended public key, fingerprint and origin against the signer's own export and confirm the selected network.

### Sources

- Bitcoin Core descriptor reference, including BIP-380/381/382: https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
- BIP-174, PSBT key-origin and derivation fields: https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki

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
| Receiving and change | See the canonical receive/change descriptor pair in [Watch-only hand-off: descriptors and PSBT](#watch-only-hand-off-descriptors-and-psbt). |
| Both branches | `wpkh([<fingerprint>/84'/1'/0']<xpub>/<0;1>/*)` |

Here, `<0;1>` is literal multipath syntax ([BIP-389](https://github.com/bitcoin/bips/blob/master/bip-0389.mediawiki)), not a placeholder. It selects branches `0` and `1`; the trailing `*` varies the address index within each branch. Multipath requires software that supports it. In this convention, those remain separate receiving and change sequences, simply written compactly.

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
- https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki

## Hardware signing: transfer routes and screen review

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

Confirm that the particular device, firmware and external wallet support your chosen testnet and transfer format. Bitcoin file and QR workflows commonly carry a partially signed Bitcoin transaction (PSBT); USB may use a device-specific signing protocol.

| Route | Convenience and trust trade-off |
|---|---|
| **USB** | Interactive exchange with little manual handling. Keys should remain inside the signer, but the host has a live communications path into its USB and signing-protocol parsers. Treat the host as potentially hostile. This is not an air-gapped route. |
| **Animated QR** | Scanned frames move signing data between screens and cameras without a cable or mounted storage. Decoders and transaction parsers still process potentially malicious input. An animation being scanned successfully says nothing about whether the payment is correct. |
| **SD/microSD file** | Asynchronous file exchange without a continuous host connection; convenient for larger requests. Trust shifts towards removable media, filesystem handling and transaction parsing. Stale or substituted files remain possible. Transfer transaction data only, never seeds or secret-key backups. |

The return transfer carries signatures or a signed transaction, not signing secrets. None of these routes replaces device-screen review.

## Make the device screen the approval gate

The transaction check that matters is on the signer’s own screen, not Bawa, the desktop preview, a QR viewer or a filename. Compare it with independently confirmed test-payment instructions, rather than merely checking that two potentially compromised host views agree.

Before approving:

- [ ] **Address:** read every recipient’s complete `<TESTNET_ADDRESS>`, paging through it if necessary. Matching only the beginning and end is insufficient.
- [ ] **Amount:** verify each recipient’s amount and the displayed unit.
- [ ] **Fee:** confirm the total transaction fee as well as a rate. Check the rate too when available.
- [ ] **Change:** inspect every change output, separately labelled as change, with its full address and amount. If there is no change, confirm that explicitly.

**Stop without signing if anything differs, an output is unexpected, or any required detail cannot be reviewed on-device.** Do not accept blind signing. A device that hides change without an on-device review option does not meet this guide’s rule.

## Verify that change belongs to the wallet

A coordinator calling an output “change” proves nothing. An attacker can apply that label to their own destination.

During watch-only setup, verify the signer’s public account export. Record `<xpub>` and `<fingerprint>` with the correct testnet, account, script type and derivation scheme. A fingerprint is an identifier, not proof of ownership.

Do not assume derivation paths are interchangeable between coins or curves. An exported public node cannot cross a hardened derivation step; public-child derivation also depends on the curve and scheme.

Require the signer to derive and recognise the proposed change address using its own keys, the internal/change branch of that verified account, and the expected wallet policy. Match the full device-derived address to the separately labelled change output on its screen. For multisignature, the complete co-signer and script policy must match, not merely one key.

If that ownership check cannot be completed, stop. Do not substitute the desktop wallet’s reassurance.

## Sources

Authoritative documentation:

- Trezor: derivation paths and curve constraints: https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md
- Ledger: device applications and signing integration: https://developers.ledger.com/

Community experience and product context, not protocol specifications:

- Keycard Shell: https://keycard.tech/products/keycard-shell (checked 8 November 2026; the site returns HTTP 429 to automated checks)
- Coldcard Q: https://thebitcoinhole.com/hardware-wallets/coldcard-q

### Firmware discipline, PINs and passphrases

Keep this workflow on **testnet, signet or regtest only**, using separate test-only recovery material. Never use real funds or a real-funds wallet’s secrets.

#### References do not replace setup instructions

**Bawa ships no device integration and does not document a device-specific setup procedure.** Trezor’s derivation-path reference explains curve- and chain-dependent conventions, including limits on public-only derivation. It is not an onboarding recipe.

Use your signer’s and watch-only wallet’s current documentation for descriptor exports and imports, address ranges, PSBT tools and transfer validation. Confirm that the exact model, firmware and wallet software support your chosen testnet, script type and transfer route. Do not assume QR, file or SD-card support.

#### Check firmware before test funds move

- Check current supported releases and security notices for the exact model. Obtain firmware, or a stateless signer’s boot image, through the maker or project’s official release channel.
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

Use the signer’s own public export, `<xpub>`, `<fingerprint>` and key-origin information, with applicable BIP-380/381/382 descriptor rules. A fingerprint alone is not proof of wallet identity. Compare `<TESTNET_ADDRESS>` with the signer’s display before funding.

Follow your tools’ BIP-174 PSBT flow, with BIP-371 support when using Taproot. Bawa does not document construction, signing or finalisation commands. Confirm the chosen network in your tools; an address alone cannot distinguish testnet from signet. On the signer, check destinations, change, amounts and fee before signing.

After broadcast, verify `<TXID>` and its status through a node or explorer on that testnet; use your local node for regtest. Submission is not confirmation.

#### Sources

**Official references and standards**

- Trezor derivation-path reference: https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md
- Ledger developer documentation: https://developers.ledger.com/
- Descriptor and PSBT standards: https://github.com/bitcoin/bips

**Community experience, not specifications**

- Coldcard Q: https://thebitcoinhole.com/hardware-wallets/coldcard-q
- SeedSigner: https://thebitcoinhole.com/hardware-wallets/seedsigner

## Practise test funding, fees and change

**This rehearsal stays on testnet, signet or regtest. Never use real funds.**

This is a device-review outline, not a runnable end-to-end rehearsal. Funding a separate Bawa test wallet and preparing an unsigned PSBT are external prerequisites; use your chosen watch-only wallet's documentation for those steps and your signer's documentation for device review. This guide provides no funding or PSBT-construction procedure. Stop before signing.

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

Check that the wallet and node use the intended test chain and that the signer supports the chosen setup. Address prefixes alone do not distinguish every testnet.

Set up watch-only tracking using public descriptors containing `<xpub>` and key-origin information such as `<fingerprint>`, with the correct derivation paths. Signing secrets stay on the signing side. Use paired descriptors: external `/0/*` for receiving and internal `/1/*` for change.

Generate `<TESTNET_ADDRESS>` from the receiving branch and verify it through the device’s supported address check. A faucet distributes small quantities of test coins; choose one serving your selected network and request only a tiny amount. It needs a receiving address, not signing secrets.

On regtest, locally generated coins are another option, but generated coinbase outputs must mature before spending. Record `<TXID>`, confirm that the expected output arrived, and wait until it is spendable.

### 2. Estimate and reconcile the fee

Build a small payment to another test address you control, leaving room for both fee and change. Inspect the selected inputs and proposed outputs as well as the wallet’s balance.

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

- BIP-174: https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
- BIP-371: https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki
- Bitcoin Core descriptors: https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
- Bitcoin Core PSBT workflow: https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md

## Finish the test-only signing rehearsal

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
CHOSEN TESTNET
```

### Diagnose before retrying

For each failure, identify which role must correct it before continuing. Never approve known mismatches, guess missing data or export secrets to get past a warning.

| Symptom | Likely cause | Diagnosis |
|---|---|---|
| Device shows a different address | Wrong recipient, change mistaken for payment, or incorrect derivation/script type. | Compare with independently checked `<TESTNET_ADDRESS>`. Verify signer-derived change and descriptor paths; `<fingerprint>` alone does not prove ownership. |
| Device shows a different amount | Unit mismatch, payment/total confusion, or unexpected fee/change. | Compare every output in the same units. Recalculate the fee from verified input amounts minus all output amounts. |
| PSBT will not finalise | Missing signatures, unmet threshold, absent scripts or incompatible Taproot handling. | Check threshold, key derivations and required scripts. For Taproot, check BIP-371 support and required key-path or script-path fields, including leaf/control-block data where applicable. |
| Missing UTXO data | Spent-output information absent or inconsistent. | Verify funding `<TXID>` and output index against the test node. Legacy inputs need the full previous transaction; witness inputs need spent-output amount/script, plus any previous transaction required by signer policy. |
| Wrong network | Wallet or node uses another chain. | Check all chain settings and funding UTXOs. A PSBT is not a chain selector; testnets can share address/key prefixes. |
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
- https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
- https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki
- https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
- https://github.com/bitcoin/bitcoin/blob/master/doc/psbt.md
