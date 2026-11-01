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

## 11. Verification and testing

### A. Require independent agreement

Do not trust a derivation merely because the wallet can reproduce its own answer. Generation and a self-check may both choose the same wrong derivation path. Their addresses will match, but neither will be the address requested. The test has repeated the mistake rather than detected it.

For the standards and paths covered by Bawa’s differential tests, Wallet Core and `bip_utils` must independently produce matching public outputs before the tested result is accepted. This is a test-suite requirement, not a second derivation service for live wallets.

#### The engine and the verifier

[Wallet Core](https://github.com/trustwallet/wallet-core) **4.8.4**, packaged as `@trustwallet/wallet-core`, is Bawa’s reference engine for wallet cryptography. Its responsibilities include wallet creation and import, receiving-address derivation, custom derivation paths and transaction signing. These operations are documented in the [Wallet Core Usage Guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage) and [HDWallet API](https://trustwallet.github.io/docc/documentation/walletcore/hdwallet/).

Wallet Core does **not** communicate with blockchain nodes, fetch balances or broadcast transactions. Those tasks belong to Bawa’s application and infrastructure code.

The independent verifier is pinned to `bip-utils==2.12.2`. It has separate implementations of HD-wallet standards and chain-specific key and address schemes; the [bip_utils documentation](https://pypi.org/project/bip-utils/) defines its coverage. Use it only for standards and paths supported by both implementations.

`bip_utils` belongs in the test layer because its job is to challenge the reference engine’s result on fixed fixtures. It is not imported by runtime wallet-generation code and must not become a production alternative or fallback. Switching engines after a disagreement would hide a failure, not resolve it. Keeping one production engine also keeps live wallet behaviour separate from the verification machinery.

#### Keep the comparison boundary public

Use this order:

1. **Choose published test material.** Suitable sources include the vectors linked by [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) and those included in [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) and [BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki). Record the fixture, chain, network and derivation path explicitly. The specifications define the standards; library agreement does not replace them.
2. **Derive and capture independently.** Give each implementation the same published fixture inputs and declared parameters. Each must perform its own derivation. Do not pass computed intermediates from one engine to the other. Capture each result separately, retaining only public outputs such as receiving addresses and public keys.
3. **Compare after both captures are complete.** Never fill either result from the other, or copy one engine’s answer into an expected-result file. Where a published vector defines an expected public value, check both implementations against it as well. Treat any disagreement as a failure to investigate.

Comparison artefacts must not contain mnemonics, seeds, private keys or data keys, even from published fixtures. Tests must never use real-wallet secrets or backups, including xprvs and hardware-wallet secrets.

Agreement is necessary, but its meaning is limited: it supports that fixture, network and path only. Two implementations can still share a mistaken configuration. A matching address does not establish correctness for every coin or path, and it does not test signing, balance retrieval or broadcasting.

Run:

```sh
python3 test/differential_test.py
```

**You should see:**
- No mismatches between independently captured public outputs for the covered fixtures.
- Only public outputs in the comparison artefacts.
- `bip_utils` confined to tests, with no runtime wallet-generation import.

### B. Differential public-output checks

This comparison checks public outputs from wallet cryptography, not signing. Node communication, balance retrieval and broadcasting are outside its scope.

Bawa currently has no captured result from either `bip_utils` or Wallet Core. Neither a match nor a mismatch has been established.

#### 1. Prove that the implementations overlap

Create a candidate record for each fixture. Before accepting it, collect versioned support references showing that **both implementations document the same**:

- derivation standard;
- exact derivation path, including the change branch and address index;
- chain;
- network;
- public-output format and encoding.

A difference or an undocumented setting blocks the candidate. Similar-looking addresses are not evidence of compatible settings.

The Wallet Core side is `tools/hdwallet-gen/compare.js`. It is a public-only helper: it reads xpubs from `.env` and documents these derivations for `i = 0, 1, 2`:

| Chain | `bip_utils` reference fixture | Documented Wallet Core helper path |
|---|---|---|
| BTC | BIP84, `m/84'/0'/0'/0/0` | `m/84'/0'/0'/i` |
| ETH | BIP44, `m/44'/60'/0'/0/0` | `m/44'/60'/0'/0/i` |
| TRX | No sourced fixture in this test | `m/44'/195'/0'/0/i` |

The BTC paths differ: at `i = 0`, the helper’s documented path has one fewer component than the reference path. Do not silently add a branch, omit a component or reinterpret `i`.

The ETH paths agree at `i = 0`, but that alone does not establish eligibility. The standard, chain, network, output format and input mapping must also agree. An Ethereum address alone does not identify a network.

Bawa does not yet document all shared settings or how the helper’s `.env` xpubs relate to the published test vector. Keep both candidates blocked until the BTC path discrepancy is resolved, both implementations’ support references are collected, and the shared settings and xpub-to-vector mapping are confirmed.

This vector supplies no TRX expectation and no expectations for indices 1 or 2.

**You should see:** BTC and ETH currently marked **blocked**, with the reasons recorded. An eligible fixture must have documented agreement across every required field, not merely a matching path.

#### 2. Prepare and freeze the fixture

Once the overlap checks are complete, write a fixture manifest before running either implementation. Record:

- **Vector source:** `test/differential_test.py`, identified by the exact Bawa repository commit. Use its published test material without substituting wallet data.
- **Shared derivation settings:** standard, complete path, account, change branch, index, chain, network and output format. Both reference fixtures use account 0, the external branch and address index 0.
- **Seed-generation settings:** the reference calls `Bip39SeedGenerator(...).Generate()` without an explicit passphrase. Record the documented behaviour of that call for the pinned version rather than assuming a setting.
- **Public-input mapping:** which test-vector xpub belongs in each helper input, its origin path and serialisation, and the relative derivation performed below it. This must establish the full path; it must not merely assert that an xpub “looks right”.
- **Exact versions:** `bip_utils` **2.12.2**, the Wallet Core version or build actually loaded by the helper, the helper’s repository revision, and the Python and JavaScript runtime versions. A dependency range is not an exact version.
- **Support references:** the documentation used to establish each implementation’s supported standard, path handling, network and output format.

The helper starts from xpubs. Its source-to-xpub mapping is therefore a prerequisite; this comparison does not independently check mnemonic-to-xpub generation on that side.

Create a capture directory:

```sh
mkdir -p verification-11b
```

Store each sourced expectation as one unchanged address on one line in the indicated file:

| Fixture | Expected-address file | Expected public address |
|---|---|---|
| BTC | `verification-11b/btc.expected.txt` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH | `verification-11b/eth.expected.txt` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |

These values come from the reference fixture, not from a new run. Do not replace them with whichever address an implementation returns.

Use only the published test inputs. Do not put a real mnemonic, seed, private key, data key or real-wallet `.env` into the fixture or evidence bundle.

**You should see:** A fixed manifest containing the vector source, exact versions, shared settings, documented xpub mapping and expected public outputs. Any unresolved item leaves the fixture blocked.

#### 3. Run independently, capture separately, then diff

Run each eligible fixture through each implementation’s documented API. Do not copy derivation code between implementations or use one implementation’s returned address as the other’s input.

For the Python reference, use the pinned environment with assertions enabled. Do not use `-O` or enable `PYTHONOPTIMIZE`.

```sh
python3 test/differential_test.py \
  > verification-11b/bip_utils.stdout \
  2> verification-11b/bip_utils.stderr
printf '%s\n' "$?" > verification-11b/bip_utils.exit
```

This file checks **`bip_utils` only**. A successful run prints:

```text
bip_utils reference checks: PASS
```

That message confirms the `bip_utils` reference checks. It does not confirm a completed comparison with Wallet Core. Running this reference check alone does not remove the comparison’s blocked status.

Run `tools/hdwallet-gen/compare.js` separately, using the documented invocation and working-directory rules for the recorded version. Use only the confirmed public test-vector xpub inputs in `.env`. Save its invocation, stdout, stderr and exit status separately from the Python run. Do not guess input names or fill the file with unrelated xpubs.

For each eligible fixture:

1. Retain the original output from each run.
2. Extract the address for the exact fixture path into its own one-address result file:
   - `btc.bip_utils.txt` and `btc.wallet-core.txt`;
   - `eth.bip_utils.txt` and `eth.wallet-core.txt`.
3. Link each result file to its fixture manifest. Do not relabel a result from another path as the target result.
4. Preserve the returned address exactly. Never lowercase it, change checksum case, remove a prefix or convert its encoding to manufacture agreement.

For an eligible BTC fixture, run these three comparisons:

```sh
diff -u verification-11b/btc.bip_utils.txt verification-11b/btc.wallet-core.txt \
  > verification-11b/btc.pair.diff
printf '%s\n' "$?" > verification-11b/btc.pair.exit

diff -u verification-11b/btc.expected.txt verification-11b/btc.bip_utils.txt \
  > verification-11b/btc.bip_utils.diff
printf '%s\n' "$?" > verification-11b/btc.bip_utils.diff.exit

diff -u verification-11b/btc.expected.txt verification-11b/btc.wallet-core.txt \
  > verification-11b/btc.wallet-core.diff
printf '%s\n' "$?" > verification-11b/btc.wallet-core.diff.exit
```

Repeat for an eligible ETH fixture by replacing `btc` with `eth`.

For `diff`, status `0` means identical files, `1` means a difference, and a value above `1` means the comparison failed to run properly. An empty diff file without a successful exit status is not a pass.

**You should see:** Two independently captured public-output records and three diffs per eligible fixture. Successful checks have empty diffs and status `0`. The Python PASS message is only the reference-side result; without a captured helper result, there is still no differential result.

#### 4. Attach the evidence and assign the result

Attach the following to the test record:

- exact invocations, working directories and exit statuses;
- exact library, helper, repository and runtime versions;
- both implementations’ support references;
- the vector source and fixed fixture manifest;
- the confirmed public xpub-to-vector mapping;
- both original run outputs and their separate public-address records;
- the sourced expectations, all three diffs and their exit statuses.

Mark a fixture **verified** only when the overlap checks passed, both independent runs succeeded, and **both returned public outputs exactly match the sourced expectation**.

Agreement between the implementations is insufficient if both disagree with that expectation. Record that as an expectation failure, not verification. Record a differential mismatch only when eligible, captured outputs differ. Missing output, setup failure or a diff error is an incomplete test, not evidence of a cryptographic mismatch.

**You should see:** A reviewable record supporting the status of each fixture. Bawa’s current record remains blocked and unverified: neither side has a captured result, and no completed Wallet Core comparison can be claimed.

### 11.C Independent verification and chain fixtures

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

3. **TON fixtures.** Each fixture must specify the mnemonic scheme, exact derivation path, wallet contract and version, workchain, mainnet or testnet presentation, wallet/subwallet ID, and both bounceable and non-bounceable address forms. Do not infer TON mnemonic compatibility from BIP-39 support. A parser accepting a TON address, or accepting its checksum, proves only a formatting property; it does not establish that the intended derivation and wallet parameters produced that account.

#### Adding one eligible chain fixture

For every supported chain, use the same sequence: begin with a known mnemonic from published test material, apply its known path, check the known public key or extended public key, then check the known address. Store the expected key and address outputs in the tests.

A fixture is eligible for independent comparison only when **both implementations document the same standard, exact path, chain, network and output format**. A matching coin name, a convenient default or two matching strings is not a substitute for that documentation.

To add a case:

1. **Choose and cite a published fixture.** Record its source URL, revision or release, and vector identifier. Use its published inputs and expected outputs without substituting locally generated values. Record any specified passphrase, including an explicitly empty passphrase.

2. **Document the overlap.** Cite the relevant documentation for both implementations. Record the standard, full path, chain, network, key representation and address format. Include all required TON parameters for a TON case. Do not use undocumented defaults to fill in configuration.

3. **Commit fixed expectations.** Keep the expected public or extended public key and address as test data. Let each implementation start independently from the fixture’s mnemonic and declared parameters. Feeding the runtime’s derived key into the verifier would test only the later stages, not the whole derivation.

4. **Assert and record the result.** Make each implementation match the stored expectations. Record implementation versions, the named case, the configuration and the assertions run. Include applicable published parsing, serialisation and checksum rejection cases, but do not count unavailable cases as passed.

If no compatible independent implementation is documented, describe any published-vector test as a published-vector test, not a two-implementation comparison. If no published vector is available, record that limitation rather than generating expected values locally and calling them published evidence. A wallet-core-only regression or an address-format check offers narrower assurance and does not close the corresponding release gate.

**You should see:**

- [ ] One named fixture with a published source and documentation establishing identical rules in both implementations.
- [ ] Both implementations independently matching the stored expected key and address from the same mnemonic, path and declared configuration.
- [ ] Named results for applicable parsing, serialisation and checksum checks, with untested behaviour recorded plainly.
- [ ] Runtime generation still free of `bip_utils` imports.
- [ ] A coverage record limited to this case, without marking the full-vector, chain-wide or TON release gates complete.

### 11.D1a — Negative and security testing

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

**You should see:** a completed expected-versus-actual record for every run, safe rejection of invalid inputs, the BIP-39 passphrase exception recorded correctly, unchanged protected files and no disclosed secrets or unauthenticated plaintext. Unrun cases remain unverified.

### D1b — Integration testing

Run the allocator, provider adapter, tracker and database together, including background workers where enabled. Use an isolated database, a controlled clock and replay at the RPC/indexer boundary, rather than replacing internal components. A production tracker is a distributed system as well as a blockchain client.

Use only published test material. Pin fixture sources, network, public account data, derivation path, expected address, funding transaction, receiving output, amount and block history. The transaction must pay the allocator’s expected address; unrelated address and transaction vectors do not test the full path. Keep allocation watch-only, with no production wallets or funds. Add a read-only test-network run through the same adapter using the known transaction: replay alone cannot establish live provider compatibility.

#### Establish the successful path

1. **Allocate an address.** Create an invoice or payment request through the normal application entry point. Check the committed account, branch, child index, address and request association. Repeating the same allocation idempotency key must return the same result. Concurrent distinct requests must not receive the same address. Index gaps are acceptable; assigning one address to different requests is not.

2. **Observe the funding transaction.** Replay the known transaction through the real indexer/RPC client, initially below the confirmation threshold. Verify the network, receiving address, transfer identity and amount in integer base units. Exercise polling and any enabled push path. Treat notifications as signals to inspect chain data, not as payment proof by themselves.

3. **Inspect the database record.** Check address ownership, request linkage, amount, transaction identity, pending state and observation metadata. Use the chain’s transfer identity for deduplication; for UTXO payments, include network, transaction ID and output index. Separate outputs must not collapse into one payment. The recovery cursor must not advance beyond work durably recorded for recovery.

4. **Update confirmations.** Replay canonical block progress. Assert the stored block hash, height and confirmation count, then the status transition at the configured threshold—not before it. If this transition triggers credit or fulfilment, inspect its durable instruction too.

Use bounded waits for recorded state rather than fixed sleeps. Inspect both database results and downstream business effects.

#### Deliberately interrupt the flow

Restore the baseline between independent cases. Redelivery is normal; duplicate credit is not.

- **Retry.** Interrupt processing after the database commit but before event acknowledgement. Redeliver the same work. It must resolve to the existing payment record without applying credit or fulfilment twice.

- **Duplicate event.** Deliver the identical event twice, then observe the same transfer through overlapping polls and another provider. Delivery IDs may differ. Require one canonical payment record per transfer, while allowing separate observation or audit records. Downstream workers must also handle redelivery safely; do not assume exactly-once message delivery.

- **Temporary RPC outage.** Inject timeouts, rate limits and unavailable responses during detection and confirmation updates. Check capped retry back-off with jitter. Preserve the last verified chain state and expose stale observation status: a failed request is not an empty transaction list. Restore the provider and reconcile missed history from the saved cursor. Failover must stay on the pinned network, and a lagging secondary is not evidence of a reorg.

- **Restart.** Stop workers before commit, after commit and after sending a downstream instruction. Restart against the same database. Recover unfinished work, reload cursors and backfill missed observations. Check that downstream retries retain their idempotency identity. Recovery must not depend on an in-memory “seen” set.

- **Reorg.** Replay published competing-branch data that removes the funding block. Reconcile using block hashes, not heights alone. Recompute confirmations and payment state against the new canonical chain, preserving the audit trail. If the transaction is included again, reconcile the same transfer without double-counting it. Exercise the documented compensation or review path for earlier fulfilment; an irreversible action cannot be undone merely by changing a database status.

- **Late payment.** Set invoice deadlines relative to fixture payment times. Test a genuinely late transfer and a timely transfer discovered only after an outage. Apply the documented expiry rule rather than confusing observation time with payment time. Continue recognising the original address association and record late funds for reconciliation. Do not silently ignore the transfer or reopen a cancelled order.

**You should see:**

- [ ] A stable allocation and one canonical payment record per transfer.
- [ ] Amounts, request linkage and confirmation transitions matching the published fixtures.
- [ ] Retries, duplicates and restarts without lost payments or duplicate business effects.
- [ ] Provider recovery catching up to the expected chain state.
- [ ] Auditable reorg handling and explicit late-payment outcomes.

## 11. Verification and testing
### D2. CI discipline, reproducible checks and build verification

#### Keep CI claims narrow

CI must use published public fixtures only. Record their origin and revision so changes to upstream test data cannot silently change a run. Never generate a real wallet in CI, even as a throwaway test. Keep private wallet material out of job inputs, environment variables, logs, caches and artefacts.

A successful installation in a fresh environment shows that the dependencies installed on the recorded operating system, architecture and toolchain. It does not establish wallet correctness. Save the source revision, interpreter and installer versions alongside the installation log.

Commit the lockfile actually used by the tests, install from it, and reject unexpected changes during installation. That file records the dependency graph exercised by the checks. It is not a security assessment of those dependencies, nor a guarantee of byte-identical build output.

A network-enabled CI run provides no evidence that the documented workflow works offline. It also does not validate interactive generation through `/dev/tty`. Keep separate records for offline operation and terminal behaviour. Where those checks have not been completed, mark them `blocked-unverified`; do not generate a real wallet in CI to fill in the terminal result.

#### Give every release gate its own record

For each candidate revision, record each gate’s result and link its evidence. Preserve failures as failures. Missing evidence means `blocked-unverified`, not an assumed pass.

| Release gate | Evidence to retain | Without that evidence |
|---|---|---|
| Committed lockfile | The tracked lockfile at the candidate revision, its digest, the locked-install log and the recorded environment. | `blocked-unverified` |
| Full BIP-32/BIP-39 vector coverage | The identified published vector suites, a vector-to-test mapping and results for every vector in both suites. A passing subset is not full coverage. | `blocked-unverified` |
| Differential testing | The independent comparison’s command, complete output, exit status, reference-library version and scope of comparisons. | `blocked-unverified` |
| Chain-specific fixtures | Published fixtures and test results for every claimed chain, network and supported derivation/address format. | `blocked-unverified` |
| Secret and dependency scanning | Separate scan reports, scanner versions, rules or vulnerability-database versions, and the handling of findings. | `blocked-unverified` |
| Reproducible artefacts | The published build procedure, recorded build inputs, independent rebuild logs and byte comparisons against the release files. | `blocked-unverified` |
| External security review | An independent report identifying the reviewed revision and scope, with the resolution of release-blocking findings. | `blocked-unverified` |

An install job may contribute an installation log. Its green status must not propagate to the other gates. Likewise, a clean scanner report describes what that scanner checked; it does not certify that every dependency is safe.

Do not describe a release as fully verified while a required gate remains failed or `blocked-unverified`.

#### Record Bawa’s differential check accurately

Bawa’s independent check is `test/differential_test.py`. Run it in the recorded test environment:

```sh
python3 test/differential_test.py
```

On success, it prints:

```text
bip_utils reference checks: PASS
```

Retain the complete log and successful exit status, together with the candidate revision and the `bip_utils` version used. Record this result as **differential-testing evidence**.

That line supports the comparisons the script actually performed. It does not, by itself, establish complete BIP-32/BIP-39 vector coverage, chain coverage, offline operation, reproducibility or security review. None of those records should change merely because the reference check passed.

#### Compare release bytes, not just test results

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

You should see:

- The intended full commit ID in the checkout record and the corresponding test and build evidence.
- A successful signature check against an independently authenticated key, or an explicit unverified status.
- `bip_utils reference checks: PASS` and a successful exit status in the differential-test log.
- A separate result with evidence, or `blocked-unverified`, for every release gate. Offline and `/dev/tty` behaviour must not inherit an online CI pass.
- Byte-identical rebuilt and published artefacts where reproduction succeeds; otherwise, an explicit unverified reproducibility status and a clear publisher-trust decision.
