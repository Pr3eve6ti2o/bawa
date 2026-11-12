---
title: Trust Wallet Core and Independent Verification
description: Use Trust Wallet Core 4.9.2 as the reference engine and bip-utils as the independent verifier; publish fixtures, compare public outputs, and keep every release gate blocked until it has its own evidence.
last-updated: 2026-11-09
---

# Trust Wallet Core & Independent Verification

How-to guide.

> **Verified on:** 2026-11-08  
> **Verification status:** Partially verified  
> **Scope:** repo guide docs/11 against the pinned repo at 754721cd, with previously recorded live link checks retained as historical evidence
> **Repository commit:** 754721cd
> **Tool versions:** bip-utils 2.12.2, cryptography 50.0.2, Python 3.12.3, Node v24.22.2 (VM), outside the repo's declared >=22 <23 range  
> **Actually run:** `python3 test/differential_test.py` (PASS, exit 0); the Core 4.9.2 tag and registry checks; live wallet creation under a real pty plus decrypt round trip byte-identical (V1, PASS, pushed head 082f7915); TRX address confirmed by Core 4.8.4 (V3) and re-confirmed on Core 4.9.2 (D31, 2026-11-08)  
> **Not run:** no live testnet spend.
> **Completed:** The Wallet Core side of the differential comparison for the xpub mapping was captured (D31, 2026-11-08).

Mark the checks listed as not run above `blocked-unverified`.

## Contents

- [Trust Wallet Core](#trust-wallet-core)
- [Why Bawa uses an independent verifier](#why-bawa-uses-an-independent-verifier)
- [What should be compared](#what-should-be-compared)
- [Trust Wallet registry](#trust-wallet-registry)
- [`@hdwallet/core`](#hdwalletcore)
- [Release rule](#release-rule)
- [Verification, differential fixtures](#verification-differential-fixtures)
- [Published anchors and negative fixtures](#published-anchors-and-negative-fixtures)
- [Verification and testing](#verification-and-testing)
- [Independent verification and chain fixtures](#independent-verification-and-chain-fixtures)
- [Negative and security testing](#negative-and-security-testing)
- [Integration testing](#integration-testing)
- [CI discipline, reproducible checks and build verification](#ci-discipline-reproducible-checks-and-build-verification)
- [Compare release bytes as well as test results](#compare-release-bytes-as-well-as-test-results)
- [Reader checklist](#reader-checklist)

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
- xpub/xprv serialisation variants;
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
## Verification, differential fixtures

Use Trust Wallet Core **4.9.2** as Bawa’s reference engine (tag commit `17e3cd4df5d53f061ade3bbdc07d196f5ed5a8e3`, published **2026-11-06**, npm registry returns **200**). At repository commit `754721cd`, `tools/hdwallet-gen/package.json` and `tools/hdwallet-gen/package-lock.json` still pin **4.8.4**. Running `npm ci` in `tools/hdwallet-gen` installs **4.8.4**, so the repository's tool commands exercise **4.8.4**, not **4.9.2**. Keep bip-utils in the test layer and identify the Core version for each verification run.

The live EIP-1559 signing proof was demonstrated on Core 4.9.2 for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open.

Apply Bawa’s differential-verification rule: document both implementations’ support for the same standard, exact derivation path, chain, network and output format. Keep a fixture blocked if any setting is unresolved or differs. Capture both implementations’ public outputs and diff them before marking the fixture eligible. Treat a match as evidence for that fixture only, not blanket equivalence across chains or paths.

### Ripple fixture and shared settings

Use this 15-word fixture mnemonic from Trust Wallet Core’s own published HDWallet test example, `swift/Tests/HDWalletTests.swift` in the `wallet-core` repository:

`ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal`

Use an **empty BIP-39 passphrase** and record the entropy as `ba5821e8c356c05ba5f025d9532fe0f21f65d594`.

Do not copy the passphrase `TREZOR` from Core’s own test table. It gives a different seed and different addresses; Bawa uses the empty passphrase.

Keep this word-count rule explicit: the fixture phrase is 15 words because it is a published test vector; real wallets created by this guide are 24 words. The word count changes the seed; never mix a 15-word test phrase into a 24-word wallet flow.

### Provisional public nodes and TRX anchor

Use these ripple-fixture account-0 public nodes, derived with **bip-utils 2.12.2**, as the provisional xpub-to-vector mapping for the helper’s `.env`.

| Chain and format | Account path | Public node | Status |
|---|---|---|---|
| BTC zpub | `m/84'/0'/0'` | `zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9` | Core-confirmed (D31, 2026-11-08) |
| ETH xpub | `m/44'/60'/0'` | `xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc` | Core-confirmed (D31, 2026-11-08) |
| TRX xpub | `m/44'/195'/0'` | `xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF` | Core-confirmed (D31, 2026-11-08) |

Treat this derivation as confirmation of reproducibility, not independence: bip-utils is the same library used by `test/differential_test.py`. Every public node was confirmed against Core’s `getExtendedPublicKeyAccount` in a recorded **4.9.2** run using the ripple mnemonic and empty passphrase (D31, 2026-11-08); treat them as canonical.

Use the ripple TRX address **`TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`** at `m/44'/195'/0'/0/0` as the TRX anchor. It was derived with bip-utils **2.12.2** and confirmed by Trust Wallet Core 4.8.4 (V3 live verification, 8 November 2026: `getAddressForCoin(tron)` returns this address) and re-confirmed on Core 4.9.2 (D31, 2026-11-08).

Do not count this separate derivation as repository-test coverage.

Do not feed BTC testnet `vpub` or `tpub` keys to this `derive.js` workflow: with the tested Core WASM builds these inputs produce no address, only an opaque WASM-abort error. Changing only the derivation path does not fix this; a `zpub` with a testnet-looking path can instead produce a mainnet address. The path's first three levels are the caller's responsibility: Core derives from the key at the trailing change/index levels only.

### Agreed comparison paths

Use the paths verified first-hand in the actual `tools/hdwallet-gen/compare.js` file. Use this public-only helper with the extended public nodes in `.env` to derive indices `i = 0, 1, 2`:

- **BTC:** `m/84'/0'/0'/0/i`.
- **ETH:** `m/44'/60'/0'/0/i`.
- **TRX:** `m/44'/195'/0'/0/i`.

Remove the stale path-difference blocker: the BTC and ETH paths agree with the repository reference checks at `i = 0`.

The xpub-to-vector mapping is supplied by the values above and is Core-confirmed (D31, 2026-11-08: recorded `getExtendedPublicKeyAccount` run). The TRX address anchor is separately Core-confirmed (see above). Continue to require both implementations’ support references and confirmed shared settings.

### Captured evidence and pending Core run

Preserve the captured reference run with the following record:

| Run detail | Captured evidence |
|---|---|
| Command | `python3 test/differential_test.py` |
| Environment procedure | Documented venv procedure |
| Dependencies | bip-utils **2.12.2**, cryptography **50.0.2** |
| Date | **2026-11-08** |
| Host | `muse-vm` |
| Reported output | `bip_utils reference checks: PASS` |
| Exit code | **0** |

Retain the captured addresses against their published expectations. The Wallet Core column is now recorded (D31, 2026-11-08).

| Chain and reference path | Published expected address | Wallet Core 4.9.2 observed | bip-utils 2.12.2 observed |
|---|---|---|---|
| BTC BIP-84, `m/84'/0'/0'/0/0` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` (Core-confirmed, D31, 2026-11-08) | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH BIP-44, `m/44'/60'/0'/0/0` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` (Core-confirmed, D31, 2026-11-08) | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |

Keep the captured pass together with its coverage boundary:

> **Expected result:**
>
> `bip_utils reference checks: PASS`
>
> At 082f7915, the reported published-vector reference check passed against bip-utils==2.12.2 for BTC BIP-84 index 0 and ETH BIP-44 index 0 only. At 754721cd, `test/smoke.test.js` asserts fixture-address matches for BTC, ETH and TRX at indices 0 and 1. No repository test covers index 2; `compare.js` derives indices 0-2 as a helper, not as a test.

Do not interpret this pass as a completed comparison with Wallet Core.

To capture the Core side, run `node generate.js` from `tools/hdwallet-gen` on a TTY and record its self-checks. Build the helper’s `.env` from the three ripple-fixture account-0 public nodes above, then run `node compare.js` from the same directory and capture its public outputs. Include the recorded `getExtendedPublicKeyAccount` confirmations and the `getAddressForCoin(tron)` anchor confirmation in the Core evidence.

Keep the fixtures **ineligible** until both sides are captured and diffed under the documented shared settings. Do not claim either a match or a mismatch with Wallet Core while its results remain uncaptured.

## Published anchors and negative fixtures

Use these published fixtures only as test vectors, never for funds. Keep each mnemonic, passphrase, path, address (or extended key) and source together. Never pair one fixture's words with another fixture's address.

Treat the three fixture mnemonics as deliberate anchors for different published standards (BIP-84, Hardhat and Core), not as three phrases used by the wallet. For the Core anchor, retain the complete mnemonic, passphrase, path and address recorded in the preceding ripple-fixture section, with the repo's own fixture and Trust Wallet Core's published test vector as its source.

Prefer unifying repo fixtures on the ripple mnemonic as the single canonical set of words, because it is both the repo's own fixture and Trust Wallet Core's published test vector. Treat this as a recommendation, not a requirement. Preserve the original inputs and outputs of the independently published BIP-84 and Hardhat anchors below.

### BIP-84 anchors

Use the mnemonic `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about` with an empty passphrase for all four anchors below. Use the [BIP-84 specification](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) as their published source.

- Derive the first BTC receiving address at `m/84'/0'/0'/0/0`.

  > Expected result: `bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu`, identical to the first receiving address in the BIP-84 specification test vector.

- Derive the account-0 public extended key at `m/84'/0'/0'` from the same abandon mnemonic and empty passphrase.

  > Expected result: `zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs`, byte-identical to the account-0 zpub in the BIP-84 specification.

- Derive the second BTC receiving address at `m/84'/0'/0'/0/1`.

  > Expected result: `bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g`.

- Derive the first BTC change address at `m/84'/0'/0'/1/0`.

  > Expected result: `bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el`.

### Hardhat anchor

Use the mnemonic `test test test test test test test test test test test junk`, an empty passphrase and the path `m/44'/60'/0'/0/0`. Use Hardhat account #0 as the published source.

> Expected result: ETH `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`.

### Published negative test vectors

Use the BIP-84 account-0 zprv vector, BIP-32 test-vector-1 root xprv, BIP-32 test-vector-5 bad-checksum xprv and BIP-32 test-vector-5 version-mismatch xpub. At the repository's Trust Wallet Core 4.8.4 pin, use `derive.js` to verify explicit private extended-key rejection; `compare.js` does not reject the first two vectors. Neither tool's output distinguishes bad-checksum from wrong-version rejection.

- **BIP-84 account-0 zprv (test vector, never for funds).** Use the abandon mnemonic above, an empty passphrase and the account path `m/84'/0'/0'`. Exercise rejection of private extended-key input with `zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE`.

  > Expected result with `derive.js` at the repository's Trust Wallet Core 4.8.4 pin: reject with exit 2 and `usage: extended public key required (private extended keys are rejected)`. This expectation is not met by `compare.js`, which prints the same BTC address for indices 0, 1 and 2 and exits 0 without an error or warning.

- **BIP-32 test vector 1 root xprv (test vector, never for funds).** Retain its seed-based provenance: seed `000102030405060708090a0b0c0d0e0f`, root path `m`. Exercise rejection of private extended-key input with `xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi`.

  > Expected result with `derive.js` at the repository's Trust Wallet Core 4.8.4 pin: reject with exit 2 and `usage: extended public key required (private extended keys are rejected)`. This expectation is not met by `compare.js`, which prints the same BTC address for indices 0, 1 and 2 and exits 0 without an error or warning.

- **BIP-32 test vector 5 invalid-checksum xprv (test vector, never for funds).** Exercise the bad-checksum defect with `xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHL`.

  > Expected result with `derive.js` at Trust Wallet Core 4.8.4: no address, exit 1 and an opaque WASM abort. `compare.js` also exits 1 with the same abort. The published BIP-32 test-vector-5 bad-checksum xprv identifies the checksum defect; the tool output does not distinguish it from a wrong-version failure.

- **BIP-32 test vector 5 version-mismatch xpub (test vector, never for funds).** Exercise the wrong-version defect with `xpub661MyMwAqRbcEYS8w7XLSVeEsBXy79zSzH1J8vCdxAZningWLdN3zgtU6LBpB85b3D2yc8sfvZU521AAwdZafEz7mnzBBsz4wKY5fTtTQBm`.

  > Expected result with `derive.js` at Trust Wallet Core 4.8.4: no address, exit 1 and an opaque WASM abort. `compare.js` also exits 1 with the same abort. The published BIP-32 test-vector-5 version-mismatch xpub identifies the version defect; the tool output does not distinguish it from a bad-checksum failure.

### Fixture and parity gaps

#### TON fixture (V3, 2026-11-08)

Demand reproduction of the TON fixture in every applicable check (Android D.7 check 6 is now executable with it): derive at the recorded `ton_path`, build Wallet V4 R2 with the recorded wallet ID, compare the address and run `validate`.

- mnemonic: `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` (15-word published test vector; production creation is 24 words, do not mix them)
- BIP-39 passphrase: empty
- `ton_path`: `m/44'/607'/0'`
- coin: CoinType.ton = 607
- ed25519 public key (at `m/44'/607'/0'`): `c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9`
- contract: Wallet V4 R2
- wallet ID / subwallet: `698983191` (0x29A9A317; the @ton/ton V4 default)
- workchain: `0`
- seqno at derivation: `0`
- address (raw): `0:bb819bc655d0b16613c06b3663e376da80171261f36fc1066899e8de98ce700f`
- address (non-bounceable, mainnet): `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` (what Core returns)
- address (bounceable, mainnet): `EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi`
- address (bounceable, testnet): `kQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD5qo`
- address (non-bounceable, testnet): `0QC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD8dt`

Verified two independent ways (V3, 8 November 2026): Trust Wallet Core 4.8.4 (`getAddressForCoin(ton)`) and an independent derivation (pure-stdlib SLIP-0010 plus PyNaCl for the key; @ton/ton for the contract and address). Wallet V4 R2 with wallet ID 0 gives a different address (`0:7bd45095...`); the wallet ID was the missing configuration parameter. Core returns mainnet presentation with no TON testnet selector; the testnet forms are encodings of the same account. The address is a derived, not-yet-deployed account.

The upstream WASM parity corpus exists (`wasm/tests/` at tag 4.9.2, 22 files). Node parity was 6/6 MATCH on Core 4.9.2 and 4.8.4 (D30, 2026-11-08); the in-browser run on 4.9.2 remains open.

Do not require a separate Sepolia address fixture, because ETH addresses are network-agnostic. The BTC testnet fixture is the re-encoded Bawa address `tb1qpsp72plnsqe6e2dvtsetxtww2cz36ztmrqny67` (witness program `0c03e507f38033aca9ac5c32b32dce56051d097b`, from `m/84'/0'` index 0); the standards `m/84'/1'` witness program `01c252d7b62c638895aa976479d608a14eb9daf3` encodes to `tb1qq8p994ak933c39d2jaj8n4sg598tnkhnyk5sg5` (D31, 2026-11-08). With the same BIP-39 passphrase, a testnet wallet restricted to discovery under `m/84'/1'/…` derives a different account subtree and will not find Bawa's existing addresses or their spending keys there; those remain recoverable from the same seed using Bawa's `m/84'/0'/0'/…` path and testnet address encoding.

## Verification and testing

Bawa contains no transaction construction or signing implementation. Signing exists only in the built apps, via Trust Wallet Core 4.9.2.

Use this file as verification guidance for public outputs, not as a signing capability.

### Require independent agreement

Do not trust a derivation merely because the wallet can reproduce its own answer. Generation and a self-check can choose the same wrong derivation path, producing matching addresses that are not the address requested. The test then repeats the mistake rather than detecting it.

For the standards and paths covered by Bawa’s differential tests, require Wallet Core and bip-utils to independently produce matching public outputs before accepting the tested result. Treat this as a test-suite requirement, not a second derivation service for live wallets.

### Use the reference engine and independent verifier

Use Trust Wallet Core 4.9.2, packaged as @trustwallet/wallet-core, as Bawa’s reference engine for wallet cryptography, including wallet creation and import, receiving-address derivation and custom derivation paths. This reference-engine role records the version the guides’ verification evidence was produced against; it does not make `4.9.2` the pin. `4.9.2` is a GitHub prerelease; the repository pin remains `4.8.4` and the upgrade candidate is `4.9.1` (Doc 4 section 21 M-21). Consult the [Wallet Core repository](https://github.com/trustwallet/wallet-core) and the [HDWallet API](https://trustwallet.github.io/docc/documentation/walletcore/hdwallet/) (link checked live on 8 November 2026). The developer.trustwallet.com deep links redirect to the marketing homepage; the docs home returns HTTP 302 when redirects are not followed and redirects to the Trust Wallet marketing homepage, not documentation (checked live 2026-11-09). Link it only as the vendor's home page, not as documentation.

Report source checks as “source-verified against the Trust Wallet Core 4.9.2 tag” only when the check was made against that tag. Reserve “device-proven” for results supported by a device run.

Do not expect Wallet Core to communicate with blockchain nodes, fetch balances or broadcast transactions. Keep those tasks in Bawa’s application and infrastructure code.

Keep the independent verifier pinned to [bip-utils](https://pypi.org/project/bip-utils/) 2.12.2. Consult its documentation for coverage of its separate implementations of HD-wallet standards and chain-specific key and address schemes. Use it only for standards and paths supported by both implementations.

Keep bip-utils in the test layer to challenge the reference engine on fixed fixtures. Do not import it into runtime wallet-generation code or make it a production alternative or fallback. Treat a disagreement as a failure to investigate, not a reason to switch engines. Retain one production engine to keep live wallet behaviour separate from the verification machinery.

### Keep the comparison boundary public

Use this order:

1. **Choose published test material.** Use the vectors linked by [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) or those included in [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) and [BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki). Record the fixture, chain, network and derivation path explicitly. Follow the specifications that define the standards; do not substitute library agreement for them.
2. **Derive and capture independently.** Give each implementation the same published fixture inputs and declared parameters. Require each to perform its own derivation. Do not pass computed intermediates from one engine to the other. Capture each result separately, retaining only public outputs such as receiving addresses and public keys.
3. **Compare only after both captures are complete.** Never fill either result from the other, or copy one engine’s answer into an expected-result file. Where a published vector defines an expected public value, check both implementations against it as well. Treat any disagreement as a failure to investigate.

Exclude mnemonics, seeds, private keys and data keys from comparison artefacts, even when they come from published fixtures. Never use real-wallet secrets or backups in tests, including xprvs and hardware-wallet secrets.

Treat agreement as necessary, but limit its support to that fixture, network and path only. Account for the possibility that both implementations share a mistaken configuration. Do not treat a matching address as evidence of correctness for every coin or path, or as a test of signing, balance retrieval or broadcasting.

Do not require a “checked-in reference corpus” for WASM parity. That corpus does not exist, and WASM parity has no reference corpus yet. Do not make any check depend on it.

Run the differential tests:

```sh
python3 test/differential_test.py
```

**Expected result:**

- No mismatches between independently captured public outputs for the covered fixtures.
- Only public outputs in the comparison artefacts.
- bip-utils confined to tests, with no import by runtime wallet-generation code.

### Independent verification and chain fixtures

`bip_utils` is pinned to **2.12.2** for verification tests. It provides a separate implementation against which to check the Trust Wallet Core generator. The runtime generation code does **not** import it.

The [bip_utils documentation](https://pypi.org/project/bip-utils/) lists implementations of BIP-39, BIP-32, BIP-44, BIP-49 and BIP-84, together with P2PKH, P2SH and P2WPKH address generation and Base58/Bech32 encoding. The BIP specifications define the standards; library documentation establishes which combinations an implementation supports. Neither a feature list nor a library version proves that a particular repository test has run.

Compare both implementations with published expected results, not only with each other. Running wallet-core on both sides can repeat the same error. Two independent implementations can also share a wrong assumption, so retain the published expectations as a third point of comparison.

Use only published test material. Keep operational mnemonics, seeds, private keys, data keys, hardware-wallet recovery material and wallet backups out of fixtures, CI inputs and failure logs.

#### Required standards coverage

The current Trust Wallet Core generator contains public regression fixtures. Report results for the cases actually exercised; their presence does not establish complete standards coverage.

The verification suite needs the following checks:

- **BIP-39 mnemonic validation and mnemonic-to-seed conversion.** Use the published vectors referenced by [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), with each case’s specified language, passphrase and Unicode NFKD normalisation. Exercise word-count, word-list membership and checksum validation using published validation cases. A seed routine accepting text is not evidence that the mnemonic was validated.

- **BIP-32 master and child derivation.** Compare the master node and each specified child node with the [official BIP-32 vectors](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki). Cover hardened and non-hardened derivation, including the published leading-zero cases. Check keys and chain codes at the stated paths rather than relying only on a final address.

- **BIP-84 Bitcoin native-SegWit outputs.** Use the [BIP-84 vectors](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) to check expected public or extended keys and SegWit-v0 P2WPKH addresses. Assert the network’s Bech32 prefix and the specified extended-key format. A wrapped-SegWit address is not an equivalent result.

- **BIP-44 Ethereum outputs.** Use a published Ethereum fixture that fixes the complete BIP-44 path, expected public key and expected address. BIP-44 defines the hierarchy, not Ethereum address presentation. Record whether the expected address is lower-case or EIP-55 checksummed, and compare that form exactly rather than hiding differences by lower-casing both results.

- **Extended-key serialisation and checksums.** Assert complete published serialisations, including version bytes, depth, parent fingerprint, child number, chain code and key payload. Check Base58Check behaviour against published rejection cases. A valid checksum does not establish that the version, network or metadata is correct, and a round trip through one serialiser is not an independent check.

- **Path parsing.** Pass the published path strings through each implementation’s parser. Check the root, component indices and hardening markers without silently repairing or substituting a path. Use published rejection cases for malformed syntax and invalid indices; identify any parser behaviour without such coverage as untested.

#### Open release gates

These gates remain open:

1. **Full official BIP-32 and BIP-39 published-vector coverage.** Maintain an inventory of the complete vector sets and the assertions exercised for each case. Selected regression fixtures do not close this gate.

2. **Chain-specific fixtures.** Every supported chain needs published expectations for its claimed configurations, with documented overlap between the generator and an independent verifier. Generic BIP support does not establish chain coverage.

3. **TON fixtures.** Each fixture must specify the mnemonic scheme, exact derivation path, wallet contract and version, workchain, mainnet or testnet presentation, wallet/subwallet ID, and both bounceable and non-bounceable address forms. Do not infer TON mnemonic compatibility from BIP-39 support. A parser accepting a TON address, or accepting its checksum, proves only a formatting property; it does not establish that the intended derivation and wallet parameters produced that account. The TON fixture in "Fixture and parity gaps" records all of these fields.

#### Adding one eligible chain fixture

For every supported chain, use the same sequence: begin with a known mnemonic from published test material, apply its known path, check the known public key or extended public key, then check the known address. Store the expected key and address outputs in the tests.

A fixture is eligible for independent comparison only when **both implementations document the same standard, exact path, chain, network and output format**. A matching coin name, a convenient default or two matching strings is not a substitute for that documentation.

To add a case:

1. **Choose and cite a published fixture.** Record its source URL, revision or release, and vector identifier. Use its published inputs and expected outputs without substituting locally generated values. Record any specified passphrase, including an explicitly empty passphrase.

2. **Document the overlap.** Cite the relevant documentation for both implementations. Record the standard, full path, chain, network, key representation and address format. Include all required TON parameters for a TON case. Do not use undocumented defaults to fill in configuration.

3. **Commit fixed expectations.** Keep the expected public or extended public key and address as test data. Let each implementation start independently from the fixture’s mnemonic and declared parameters. Feeding the runtime’s derived key into the verifier would test only the later stages, not the whole derivation.

4. **Assert and record the result.** Make each implementation match the stored expectations. Record implementation versions, the named case, the configuration and the assertions run. Include applicable published parsing, serialisation and checksum rejection cases, but do not count unavailable cases as passed.

If no compatible independent implementation is documented, describe any published-vector test as a published-vector test, not a two-implementation comparison. If no published vector is available, record that limitation rather than generating expected values locally and calling them published evidence. A wallet-core-only regression or an address-format check offers narrower assurance and does not close the corresponding release gate.

**Expected result:**

- [ ] One named fixture with a published source and documentation establishing identical rules in both implementations.
- [ ] Both implementations independently matching the stored expected key and address from the same mnemonic, path and declared configuration.
- [ ] Named results for applicable parsing, serialisation and checksum checks, with untested behaviour recorded plainly.
- [ ] Runtime generation still free of `bip_utils` imports.
- [ ] A coverage record limited to this case, without marking the full-vector, chain-wide or TON release gates complete.

### Negative and security testing

Work in a disposable directory, away from live wallets. Use published [BIP-32 vectors](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#test-vectors), [BIP-39 reference tests](https://github.com/trezor/python-mnemonic/tree/master/tests) and [NIST AES-GCM vectors](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/cavp-testing-block-cipher-modes#GCMVS), plus published recovery fixtures in the supported format. Use published invalid vectors where available; otherwise corrupt disposable copies without generating new secrets. Obtain replacement credentials only from published vectors. Never print secret fields.

Cipher vectors alone do not verify recovery-file handling. Mark cases without compatible published fixtures **not run**.

Before **each** run, record the fixture identifier and version, change, expected error and status, permitted output, filesystem effects and applicable resource limits. Snapshot protected paths. Afterwards, record the actual status, sanitised diagnostics, file changes and measurements; compare them with that original record and mark pass or fail. Do not change an expectation to excuse unsafe behaviour.

Unless noted below, rejection means a non-zero CLI exit or explicit library error, no usable wallet result, no secret-bearing diagnostics and no created, overwritten or partial wallet or recovery output. Inspect diagnostics for leaks before sanitising the report.

- **Private extended keys in public-only inputs:** Submit a valid published private extended-key vector to each public-only entry point. Expect type or version rejection, not automatic conversion to a public key.

- **Malformed checksums:** Test otherwise well-formed encodings with invalid checksums, separately for each supported checksummed format. Expect checksum rejection before derivation or recovery.

- **Invalid chain names:** Use names outside the documented accepted set. Expect an unsupported-chain error, never selection of a default chain.

- **Inherited-property inputs:** Try `constructor`, `toString` and `__proto__` as lookup names. At object-taking APIs, supply required fields only through a prototype. Expect rejection, no inherited configuration values and unchanged prototypes.

- **Negative indexes:** Submit `-1` to each index input. Expect a range error before derivation, without unsigned conversion or clamping.

- **Indexes at or above 2³¹:** Test `2147483648` and larger integers wherever public or unhardened child indexes are required. Expect range rejection, not wrapping or silent hardened derivation.

- **Oversized JSON lines:** Record the enforced byte limit first. Test just above it and substantially larger, with and without a final newline. Expect bounded-memory rejection within the recorded timeout, without processing the offending record. No enforced limit means this check fails.

- **Invalid Base58:** Put a forbidden character, such as `0`, into a copied public-key encoding. Expect decoding failure, not character stripping or fallback interpretation.

- **Invalid mnemonic checksum:** Use a published checksum-invalid fixture with an otherwise valid word count and vocabulary. Expect rejection before seed derivation. Do not substitute a spelling-error test.

- **Wrong passphrase:** BIP-39 does not identify an unintended passphrase: it derives another valid wallet. Record that expectation and compare public output with the intended wallet’s reference output; they should differ. For passphrase-protected authenticated recovery, expect authentication failure and no plaintext.

- **Wrong AES authentication tag:** Change only the tag, keeping its length valid. Expect authentication failure. No plaintext may reach stdout, callers or files.

- **Missing files:** Remove each required input independently. Expect a file-not-found error, without creating a replacement input, empty wallet or recovery output.

- **Symlinked paths:** Test input files, output destinations and parent directories linked to disposable protected targets. Expect refusal before following links; links and targets must remain unchanged. Static checks do not prove protection against path-swap races.

- **Malformed JSON:** Test incomplete objects, invalid quoting and trailing non-whitespace data. Expect a parse error, with no partial record processing or interpretation as another format.

- **Corrupted AES-GCM ciphertext:** Flip a ciphertext bit while retaining the original nonce and tag. Expect authentication failure and no released plaintext.

- **Wrong data keys:** Supply a different published key of the required length. Expect authentication failure, not fallback to another key or acceptance of unauthenticated bytes.

- **Truncated recovery artefacts:** Test empty artefacts and cuts within headers, nonces, payloads and tags, where present. Expect structural or authentication errors, never best-effort or partial recovery.

- **Unexpected existing outputs:** Place existing files and directories at output locations. With overwrite disabled, expect refusal before modification. Existing contents and directory entries must remain unchanged, without truncation, merging or replacement.

- **Missing `.env`:** For a command requiring environment configuration, remove `.env` and unset its required variables in the child process. Expect a clear configuration error, not default credentials. When supported environment variables already provide the configuration, absence of `.env` alone need not fail.

**Expected result:** a completed expected-versus-actual record for every run, safe rejection of invalid inputs, the BIP-39 passphrase exception recorded correctly, unchanged protected files and no disclosed secrets or unauthenticated plaintext. Unrun cases remain unverified.

### Integration testing

Run the allocator, provider adapter, tracker and database together, including background workers where enabled. Use an isolated database, a controlled clock and replay at the RPC/indexer boundary, rather than replacing internal components. A production tracker is a distributed system as well as a blockchain client.

Use only published test material. Pin fixture sources, network, public account data, derivation path, expected address, funding transaction, receiving output, amount and block history. The transaction must pay the allocator’s expected address; unrelated address and transaction vectors do not test the full path. Keep allocation watch-only, with no production wallets or funds. Add a read-only test-network run through the same adapter using the known transaction: replay alone cannot establish live provider compatibility.

#### Establish the successful path

1. **Allocate an address.** Create an invoice or payment request through the normal application entry point. Check the committed account, branch, child index, address and request association. Repeating the same allocation idempotency key must return the same result. Concurrent distinct requests must not receive the same address. Index gaps are acceptable; assigning one address to different requests is not.

2. **Observe the funding transaction.** Replay the known transaction through the real indexer/RPC client, initially below the confirmation threshold. Verify the network, receiving address, transfer identity and amount in integer base units. Exercise polling and any enabled push path. Treat notifications as signals to inspect chain data, not as payment proof by themselves.

3. **Inspect the database record.** Check address ownership, request linkage, amount, transaction identity, pending state and observation metadata. Use the chain’s transfer identity for deduplication; for UTXO payments, include network, transaction ID and output index. Separate outputs must not collapse into one payment. The recovery cursor must not advance beyond work durably recorded for recovery.

4. **Update confirmations.** Replay canonical block progress. Assert the stored block hash, height and confirmation count, then the status transition at the configured threshold, not before it. If this transition triggers credit or fulfilment, inspect its durable instruction too.

Use bounded waits for recorded state rather than fixed sleeps. Inspect both database results and downstream business effects.

#### Deliberately interrupt the flow

Restore the baseline between independent cases. Redelivery is normal; duplicate credit is not.

- **Retry.** Interrupt processing after the database commit but before event acknowledgement. Redeliver the same work. It must resolve to the existing payment record without applying credit or fulfilment twice.

- **Duplicate event.** Deliver the identical event twice, then observe the same transfer through overlapping polls and another provider. Delivery IDs may differ. Require one canonical payment record per transfer, while allowing separate observation or audit records. Downstream workers must also handle redelivery safely; do not assume exactly-once message delivery.

- **Temporary RPC outage.** Inject timeouts, rate limits and unavailable responses during detection and confirmation updates. Check capped retry back-off with jitter. Preserve the last verified chain state and expose stale observation status: a failed request is not an empty transaction list. Restore the provider and reconcile missed history from the saved cursor. Failover must stay on the pinned network, and a lagging secondary is not evidence of a reorg.

- **Restart.** Stop workers before commit, after commit and after sending a downstream instruction. Restart against the same database. Recover unfinished work, reload cursors and backfill missed observations. Check that downstream retries retain their idempotency identity. Recovery must not depend on an in-memory “seen” set.

- **Reorg.** Replay published competing-branch data that removes the funding block. Reconcile using block hashes, not heights alone. Recompute confirmations and payment state against the new canonical chain, preserving the audit trail. If the transaction is included again, reconcile the same transfer without double-counting it. Exercise the documented compensation or review path for earlier fulfilment; an irreversible action cannot be undone merely by changing a database status.

- **Late payment.** Set invoice deadlines relative to fixture payment times. Test a genuinely late transfer and a timely transfer discovered only after an outage. Apply the documented expiry rule rather than confusing observation time with payment time. Continue recognising the original address association and record late funds for reconciliation. Do not silently ignore the transfer or reopen a cancelled order.

**Expected result:**

- [ ] A stable allocation and one canonical payment record per transfer.
- [ ] Amounts, request linkage and confirmation transitions matching the published fixtures.
- [ ] Retries, duplicates and restarts without lost payments or duplicate business effects.
- [ ] Provider recovery catching up to the expected chain state.
- [ ] Auditable reorg handling and explicit late-payment outcomes.

### CI discipline, reproducible checks and build verification

Use the repository pin, Trust Wallet Core **4.8.4**, in CI. Trust Wallet Core **4.9.2** (tag commit `17e3cd4df5d53f061ade3bbdc07d196f5ed5a8e3`, published 2026-11-06, npm registry response 200) is the version the D21 EIP-1559 demonstration ran on; it is a GitHub prerelease, not the pin, and it does not supersede `4.8.4`. The upgrade candidate is `4.9.1`, pending its qualification run (Doc 4 section 21 M-21).

The live EIP-1559 signing proof was demonstrated on Core 4.9.2 for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open. Do not carry that demonstration forward as proof of the in-browser flow.

Use only published public fixtures in CI. Record their origin and revision so changes to upstream test data cannot silently change a run. Never generate a real wallet in CI, even as a throwaway test. Keep private wallet material out of job inputs, environment variables, logs, caches and artefacts.

Treat a successful installation in a fresh environment only as evidence that the dependencies installed on the recorded operating system, architecture and toolchain, not as evidence of wallet correctness. Save the source revision, interpreter and installer versions alongside the installation log.

Commit the lockfile actually used by the tests, install from it, and reject unexpected changes during installation. Treat that file as a record of the dependency graph exercised by the checks, not as a security assessment of those dependencies or a guarantee of byte-identical build output.

Treat a network-enabled CI run as providing no evidence of offline operation and no validation of interactive generation through `/dev/tty`. Keep separate records for offline operation and terminal behaviour. Where those checks have not been completed, mark them `blocked-unverified`; do not generate a real wallet in CI to fill in the terminal result.

### Give every release gate its own record

For each candidate revision, record each gate’s result and link its evidence. Preserve failures as failures. Mark missing evidence `blocked-unverified`, not as an assumed pass.

| Release gate | Evidence to retain | Without that evidence |
|---|---|---|
| Committed lockfile | Retain the tracked lockfile at the candidate revision, its digest, the locked-install log and the recorded environment. | `blocked-unverified` |
| Full BIP-32/BIP-39 vector coverage | Identify the published vector suites and retain a vector-to-test mapping and results for every vector in both suites. Do not count a passing subset as full coverage. | `blocked-unverified` |
| Differential testing | Retain the independent comparison’s command, complete output, exit status, reference-library version and scope of comparisons. | `blocked-unverified` |
| Chain-specific fixtures | Retain published fixtures and test results for every claimed chain, network and supported derivation/address format. | `blocked-unverified` |
| Secret and dependency scanning | Retain separate scan reports, scanner versions, rules or vulnerability-database versions, and records of the handling of findings. | `blocked-unverified` |
| Reproducible artefacts | Retain the published build procedure, recorded build inputs, independent rebuild logs and byte comparisons against the release files. | `blocked-unverified` |
| External security review | Retain an independent report identifying the reviewed revision and scope, with the resolution of release-blocking findings. | `blocked-unverified` |

Retain an install job’s installation log as evidence of installation. Do not let its green status propagate to the other gates. Treat a clean scanner report only as a record of what that scanner checked, not as certification that every dependency is safe.

Do not describe a release as fully verified while a required gate remains failed or `blocked-unverified`.

### Record Bawa’s differential check accurately

Run Bawa’s independent check, `test/differential_test.py`, in the recorded test environment:

```sh
python3 test/differential_test.py
```

> **Expected result:** On success, the check prints "bip_utils reference checks: PASS".

Retain the complete log and successful exit status, together with the candidate revision and the `bip_utils` version used. Record this result as **differential-testing evidence**. Do not substitute it for the Wallet Core side of the comparison (now captured, D31, 2026-11-08).

Limit the claim supported by that line to the comparisons the script actually performed. Do not treat it, by itself, as establishing complete BIP-32/BIP-39 vector coverage, chain coverage, offline operation, reproducibility or security review. Do not change any of those records merely because the reference check passed.

#### Compare release bytes as well as test results

In community build practice, reproducibility means that independent builders following the same instructions from the same source obtain byte-identical output. Anyone should be able to rebuild the release and compare it with the published artefact. This is release-engineering practice, not a guarantee provided by BIP-32 or BIP-39.

The instructions need to identify the relevant build inputs, including the toolchain, target environment and dependencies, and control variable metadata such as timestamps. Passing the same tests twice is not a substitute for matching artefact bytes. Matching bytes establish agreement with the release; they do not establish that the source is free of security faults.

Where a project publishes a signed checksum file:

1. Authenticate the developer’s key through a separate trusted channel.
2. Verify the checksum file’s signature with that key.
3. Only then trust its sums when checking the downloaded artefact.

An unsigned checksum can detect an accidental transfer error, but it cannot authenticate a release. Someone who replaces the binary can replace the unsigned checksum file as well.

When comparing projects, explicitly record **“no documented reproducible-build procedure”** where that is the case. A source repository, installation guide or lockfile is not a substitute for a documented rebuild-and-compare process.

#### Reader checklist

- [ ] **Confirm the exact revision before installing.** Compare `git rev-parse HEAD` with the intended full commit ID and record the match. A branch name or release label alone is not an exact revision.
- [ ] **Authenticate any signed tag or commit.** Obtain the maintainer’s key through a separate trusted channel before checking the signature. Bawa publishes no signing key in the repository. Do not claim that a signed tag or commit is verified unless you have authenticated that key and successfully checked the exact object.
- [ ] **Rebuild and compare.** Use the same source revision and published build instructions in a clean environment containing no private wallet material. Compare the rebuilt artefacts byte for byte with the published release, and retain the logs and comparison results. Verify any signed checksum manifest before relying on it.
- [ ] **Read the individual gate records.** Check their revisions and scope rather than relying on a green installation badge.
- [ ] **Name the remaining trust honestly.** If a binary cannot be reproduced from its published source, using it means trusting its publisher. Treat it as publisher-trusted code, not verified code.

Expected result:

- The intended full commit ID in the checkout record and the corresponding test and build evidence.
- A successful signature check against an independently authenticated key, or an explicit unverified status.
- `bip_utils reference checks: PASS` and a successful exit status in the differential-test log.
- A separate result with evidence, or `blocked-unverified`, for every release gate. Offline and `/dev/tty` behaviour must not inherit an online CI pass.
- Byte-identical rebuilt and published artefacts where reproduction succeeds; otherwise, an explicit unverified reproducibility status and a clear publisher-trust decision.
