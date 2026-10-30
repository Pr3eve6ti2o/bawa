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
## 11 Verification — differential fixtures

Keep Wallet Core **4.8.4** as Bawa’s reference engine and `bip_utils` in the test layer. Under Bawa’s differential-verification rule, a fixture is eligible only when both implementations document the same standard, exact derivation path, chain, network and output format. A match supports that one fixture, not blanket equivalence across chains or paths.

```text
Both implementations’ documentation
|
Check standard, exact path, chain, network and output format
|
+-- Unresolved or different: blocked
|
+-- Documented match: fixture preparation
```

```text
Published test vector and shared settings
|
+-- Wallet Core
|   |
|   +-- Independently captured public outputs
|
+-- bip_utils
    |
    +-- Independently captured public outputs

Both public-output records
|
Diff and evidence
```

### Current evidence

Bawa’s `test/differential_test.py` uses `bip_utils` **2.12.2** with a published test mnemonic. It defines these derivations and their expected addresses:

- **BTC:** `Bip84`, account 0, external chain, index 0 — `m/84'/0'/0'/0/0`.
- **ETH:** `Bip44`, account 0, external chain, index 0 — `m/44'/60'/0'/0/0`.

| Chain | Published expected address | Wallet Core observed | `bip_utils` observed |
|---|---|---|---|
| BTC | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | No captured result | No captured result |
| ETH | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | No captured result | No captured result |

On success, the test prints `bip_utils reference checks: PASS`. That message confirms the `bip_utils` reference checks, not a completed comparison with Wallet Core.

The Wallet Core side is Bawa’s `tools/hdwallet-gen/compare.js`. This public-only helper reads xpubs from `.env` and derives these paths for `i = 0, 1, 2`:

- **BTC:** `m/84'/0'/0'/i`.
- **ETH:** `m/44'/60'/0'/0/i`.
- **TRX:** `m/44'/195'/0'/0/i`.

The documented BTC paths differ. The ETH paths match at `i = 0`, but a matching path alone does not make a fixture eligible.

Bawa does not document the complete shared settings or how the helper’s `.env` xpubs map to the published test vector for these comparisons. Resolve the BTC path difference, collect both implementations’ support references and confirm the shared settings and xpub-to-vector mapping before marking either fixture eligible.

The table records expectations, not a run of either implementation. **Without captured results, neither a match nor a mismatch is established.**

### Walkthrough: add one eligible chain fixture

This is a proposed checklist. Bawa does not document where to store new paired fixtures, their schema, or the API calls and common runner for adding them. Confirm these details with the maintainers before adding a runnable test.

1. **Prove overlap.** Collect references from both implementations documenting the same standard and exact derivation path. Confirm the same chain, network and output format too. Do not infer a path from an address.

   **You should see:** explicit matching evidence from both implementations. Otherwise stop and mark the candidate **blocked**.

2. **Prepare the fixture.** After the eligibility check passes and the repository location and schema are confirmed, add a record containing the shared settings, published test-vector source, exact implementation versions and expected public outputs with their sources. For the addresses above, Bawa’s `test/differential_test.py` establishes the vector-to-address expectations. Confirm that the Wallet Core helper’s xpubs come from that same vector at the documented derivation level before using them in the comparison.

   **You should see:** an auditable fixture with resolved inputs and expectations. Clearly marked placeholders keep it a draft, not a runnable test.

3. **Execute independently.** Once the API calls and runner are confirmed, run each implementation through documented APIs using the same published vector and shared settings. For the public-only Wallet Core helper, use xpubs tied to that vector; do not pass it a mnemonic or seed. Compare receiving addresses, and include other public outputs only where both implementations document a compatible representation. Do not populate one implementation’s result from the other.

   **You should see:** two separately captured public-output records and a diff. Missing output, errors or differences do not pass. Do not silently alter case or encoding to manufacture agreement.

4. **Attach evidence and submit.** Keep the actual invocation, versions, both support references, vector source, public results and diff with the fixture. Under this proposed check, mark it verified only when both results match the sourced expectation using the documented shared settings.

   **You should see:** enough evidence for another maintainer to repeat the comparison. Unresolved cases remain blocked; a skipped comparison is not a pass.

### Safety and scope

Use only published test vectors or clearly marked placeholders. Never put a real mnemonic, seed, xprv, private key or data key in CI or logs.

This checks public outputs from wallet cryptography, not signing. Node communication, balance retrieval and broadcasting are outside Wallet Core and outside this comparison. No signing or real-funds workflow is included.
