# Operations & Testing

Use this to install, run, test, troubleshoot and release the tooling without hand-waving.

# Running Bawa from a clean machine

The README needs to be runnable, not merely descriptive.

## Prerequisites

For the current reference tree:

- a Unix-like environment is recommended for the interactive `/dev/tty` generation flow;
- Node.js matching the repository's `package.json` engine requirement;
- npm;
- Python 3.11+;
- a Python virtual environment for local tooling;
- enough disk space for dependencies and recovery backups;
- an **offline or trusted machine** for actual wallet generation.

Do not generate a real wallet on a random online shell or CI runner just because the code runs there.

## Clone

```bash
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
```

For a real installation, verify the commit/tag you intend to use before installing dependencies.

## Node dependencies

From the repository root:

```bash
npm install
```

If the root package is only an orchestration shell, install the wallet-core tooling as directed by its package boundary:

```bash
cd tools/hdwallet-gen
npm install
cd ../..
```

### Lockfiles matter

Before calling the repository production-ready, commit the lockfile generated from a clean install.

That turns:

```text
"install whatever satisfies this range"
```

into:

```text
"install the exact dependency graph that was tested"
```

The reference rewrite intentionally calls out a missing production lockfile as a release blocker rather than pretending it is already solved.

## Python environment

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

On Windows PowerShell the activation command is:

```powershell
.\.venv\Scripts\Activate.ps1
```

---

# Troubleshooting

## `npm install` fails

Check:

```bash
node --version
npm --version
```

Then inspect the exact package/version selected by the lockfile.

Do not immediately delete every dependency and install arbitrary “latest” versions.

## Bawa refuses to run because there is no TTY

That is expected for the one-time generation process.

Run generation from an actual interactive terminal on the trusted generation machine.

Do not defeat the check by piping fake input into the process.

## A derived address does not match the expected address

Check, in this order:

```text
same mnemonic?
same BIP-39 passphrase?
same curve?
same coin type?
same purpose?
same account?
same branch?
same index?
same network/address encoding?
same wallet implementation/configuration?
```

For TON add wallet contract/version and wallet-ID/subwallet configuration.

For Cardano add the exact CIP and role model.

For Solana check the exact derivation convention used by the source wallet.

## EVM address matches but the balance is zero

You may simply be connected to a different EVM chain.

Check:

```text
chain ID
RPC endpoint
network name
native currency
explorer
```

The same address can legitimately exist on multiple EVM networks.

## Tracker misses an incoming payment

Check:

```text
wrong address index?
index allocation database?
gap window?
wrong branch?
indexer lag?
RPC error?
reorg?
token contract mismatch?
wrong network?
```

This is why an address allocation table is so important.

---

# A sensible architecture for different sizes of project

## Personal wallet — $0

```text
Bawa / wallet SDK
      ↓
public addresses
      ↓
explorer / free RPC
      ↓
manual checks
```

No server needed.

## Personal automated tracker — still $0

```text
public addresses
      ↓
cron script
      ↓
free RPC / Esplora
      ↓
SQLite
      ↓
local dashboard
```

Great for learning.

## Small application

```text
wallet generation machine
        │
        └── xpubs
              │
              ▼
        application backend
              │
       ┌──────┴──────┐
       ▼             ▼
      RPC          indexer API
       │             │
       └──────┬──────┘
              ▼
          PostgreSQL
              │
              ▼
           web UI
```

Use a free hosted RPC tier initially and upgrade when the metrics justify it.

## Serious application

```text
          ┌──────────────────┐
          │ trusted generator│
          │ / offline signer │
          └────────┬─────────┘
                   │ public roots
                   ▼
        ┌─────────────────────┐
        │ application servers │
        └──────────┬──────────┘
                   │
       ┌───────────┼────────────┐
       ▼           ▼            ▼
   RPC provider  indexer API  own node(s)
       │           │            │
       └───────────┼────────────┘
                   ▼
            reconciliation DB
                   │
          ┌────────┴────────┐
          ▼                 ▼
       monitoring         signer
                              │
                              ▼
                           network
```

The signer remains separate.

## Fully self-hosted

Add chain nodes and self-hosted indexers where the privacy/independence requirement justifies the operational burden.

---

# Independent differential verification

The repository includes `test/differential_test.py`, which uses the pinned `bip_utils` package to independently reproduce the shared BTC BIP-84 and ETH BIP-44 public fixtures.

Run after installing `requirements.txt`:

~~~
python3 test/differential_test.py
~~~

This test is intentionally separate from the Trust Wallet Core runtime. Extend it only when both implementations use the same explicitly documented standard and path.

# Testing a wallet properly

A professional wallet test plan is much larger than “the code runs and generated an address”.

## 1. Standards vectors

Test:

- BIP-39 mnemonic generation;
- BIP-39 mnemonic-to-seed vectors;
- BIP-32 master/child vectors;
- hardened and non-hardened derivation;
- leading-zero edge cases;
- extended-key serialization;
- checksum failures;
- path parsing.

## 2. Chain vectors

For every chain you support:

```text
known mnemonic
    ↓
known path
    ↓
known public key / extended key
    ↓
known address
```

Store those expected outputs in tests.

## 3. Independent verification

The strongest practical test is:

```text
implementation A
        vs
implementation B
```

Do not only test:

```text
wallet-core → wallet-core
```

because the same wrong assumption can appear on both sides.

## 4. Negative testing

Try:

- private extended keys where only public keys are accepted;
- malformed checksums;
- invalid chain names;
- `__proto__` / inherited-property inputs;
- negative indexes;
- indexes ≥ 2^31;
- oversized JSON lines;
- invalid base58;
- invalid mnemonic checksum;
- wrong passphrase;
- wrong AES authentication tag;
- missing files;
- symlinked paths.

## 5. Integration testing

For a tracker test:

```text
address allocation
      ↓
known funding transaction
      ↓
indexer/RPC observation
      ↓
database record
      ↓
confirmation update
```

Then deliberately simulate a retry, duplicate event and temporary RPC outage.

A production tracker is a distributed-system problem as much as it is a blockchain problem.

---

# Professional checklist

Before calling an HD-wallet implementation “done”, check all of these.

### Wallet generation

```text
[ ] cryptographically secure entropy source
[ ] mnemonic standard documented
[ ] passphrase policy documented
[ ] exact derivation paths documented
[ ] chain-specific exceptions documented
[ ] deterministic vectors tested
[ ] independent implementation comparison performed
```

### Runtime

```text
[ ] runtime receives public material only
[ ] no private key in argv/logging
[ ] path is allowlisted
[ ] index range validated
[ ] malformed input cannot terminate the service
[ ] secrets are not echoed in errors
```

### Tracking

```text
[ ] chain/network stored explicitly
[ ] raw chain facts stored before normalization
[ ] index allocation is transactional
[ ] UTXO chains handled as UTXOs
[ ] EVM token contracts stored by address
[ ] reorg/finality state stored
[ ] RPC retry/timeout policy exists
[ ] indexer lag monitored
```

### Recovery

```text
[ ] mnemonic backup exists
[ ] passphrase policy recorded
[ ] chain paths recorded
[ ] chain-specific configuration recorded
[ ] encrypted artifact tested
[ ] separate encryption key backup exists
[ ] recovery drill completed before funding
```

### Release engineering

```text
[ ] dependency lockfile committed
[ ] version ranges reviewed
[ ] CI passes on clean machines
[ ] secret scanning enabled
[ ] dependency scanning enabled
[ ] tagged release built reproducibly
[ ] release artifacts/checksums recorded
[ ] security policy published
```

---

# How to adapt this repository to another chain

The dangerous way is:

```text
copy Bitcoin code
replace "btc" with "newchain"
change coin type
hope
```

The professional way is to answer these questions first:

1. What curve is used?
2. What mnemonic/seed specification is used?
3. What derivation algorithm is used?
4. What path is the ecosystem standard?
5. Are derivation levels hardened or public-derivable?
6. Is an account-level public node meaningful?
7. What is the address encoding?
8. What network identifier changes the address?
9. What is the transaction model?
10. What data source exposes current balance?
11. What data source exposes history?
12. What finality/reorg rules apply?
13. What test vectors exist?
14. What official wallet must you interoperate with?
15. What repository is considered canonical by the chain ecosystem?

Then write a chain-specific test fixture.

Only after that should the chain enter your generic registry.

---

## Release sequence

```
source commit/tag
locked dependency graph
clean install
standards vectors
independent/differential tests
integration tests
recovery drill
artifact/checksum
tagged release
```

---

# Trust Wallet registry and asset metadata

Before adding a chain, inspect the Wallet Core registry and record the derivation path, curve, public-key type, address prefix/HRP, network identifier and any alternate derivations explicitly.

Use Trust Wallet Assets for token/asset metadata and presentation, not as a wallet engine or payment-settlement source.

References:
- [Wallet Core registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json)
- [Registry fields](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md)
- [Trust Wallet Assets](https://github.com/trustwallet/assets)
## Clean-install CI: keep the claim narrow

```text
verified revision
+
clean environment
↓
required package installs
↓
installation evidence for that revision/environment
```

```text
install pass
≠ runtime or offline pass
≠ standards-vector pass
≠ release approval
```

| Evidence | What it does — and does not — establish |
|---|---|
| Successful clean install | Dependencies installed in the recorded environment. This is not a wallet-correctness test. |
| Committed lockfile | Records the tested dependency graph. It does not establish dependency safety or reproducible artefacts. |
| Online CI pass | Does not demonstrate offline operation or validate interactive `/dev/tty` generation. |

Use public fixtures only in CI. Never generate a real wallet there; actual wallet generation belongs on an **offline or trusted machine**.

### Baseline recipe

**1. Establish the baseline.** Use a clean environment with Bawa’s documented prerequisites: Node `>=22` and `<23`, Python `>=3.11`, npm and a Python virtual environment.

Bawa does not name an approved revision or document Python virtual-environment setup commands. Confirm the intended commit or tag with the maintainer, and follow Python’s virtual-environment documentation for your platform.

To meet Bawa’s revision-verification requirement, check the intended tag with `git verify-tag` or the intended commit with `git verify-commit` **before** installing dependencies. Use a maintainer key obtained through a separate trusted channel. Bawa does not publish a signing key in the repository; do not claim that a signed tag is verified without that key and a successful signature check.

**You should see:** the revision and prerequisite checks recorded with the installation evidence, rather than an unexplained “works on my machine”.

**2. Install at the repository root.**

```bash
npm install
```

**You should see:** installation completing without an installation error. Retain the actual log; Bawa does not document an exact installation success message or dependency count.

**3. Respect the package boundary.** Bawa’s package metadata defines two packages, each with its own `package.json`: one at the repository root and one in `tools/hdwallet-gen`. The tooling package is version `1.1.0` and depends on `@trustwallet/wallet-core` `4.8.4`.

A clean install requires `npm install` in both places. After the root install, install the tooling dependencies:

```bash
cd tools/hdwallet-gen
npm install
cd ../..
```

**You should see:** dependency installation completed in the wallet-core tooling directory, with the shell returned to the repository root. A root-only install is not evidence that the required tooling dependencies were installed.

**4. Make the lockfile part of the evidence.** Review and commit the lockfile generated by the clean install. Repeat the baseline against the intended release revision so the evidence does not describe a different tree.

**You should see:** the committed lockfile and installation evidence tied to the same tested revision.

Bawa does not document the current lockfile status, its location or a CI installation recipe that enforces it. Inspect the intended revision and confirm the CI policy with the maintainer. The `npm install` recipe alone does not prove that CI rejects dependency-graph changes.

### TESTING: keep release gates separate

Record each release gate separately in the **TESTING** documentation. Use public fixtures only for tests, and keep a separate status for:

- committed lockfile;
- **full official BIP-32/BIP-39 published-vector coverage**;
- independent differential testing;
- chain-specific fixtures;
- secret and dependency scanning;
- reproducible artefacts;
- external security review.

Bawa’s independent check is `test/differential_test.py`. It checks public vectors using `bip_utils` and prints `bip_utils reference checks: PASS` on success. Record its result as differential-testing evidence, not as a pass for every release gate.

Negative tests must cover malformed input, rejection of private-key material at the public-only boundary, refusal of symlinked paths and invalid checksums. **Before running each test, define and record its expected outcome**, then compare the actual result with that record. If the expected behaviour is not documented, confirm it with the maintainer before running the test.

**You should see:** evidence attached to each gate, or an explicit **blocked — unverified** status where evidence is missing. A green installation job must not turn the other gates green. A few passing fixtures cannot replace full published-vector coverage.

Bawa does not document the CI configuration, public fixture locations, application run/test/release recipes, offline verification procedures or repository-specific expected outputs beyond the differential-check success message above. Ask the maintainer for these details and record the procedures and expected results before using them as release evidence. Listing release requirements does not show that they have passed.
## Release gates and negative tests

A public **TESTING** record should link the revision, fixture sources, expected results backed by those sources, observed results and each gate’s status. This is a proposed evidence record, not confirmation that the gates have passed.

Use published test vectors or clearly marked placeholders only. Never use live secrets. Signing examples must be testnet-only or conceptual and must never involve real funds.

```text
clean machine
↓
verify commit/tag
↓
install
↓
committed lockfile
```

```text
public fixtures
↓
full coverage
↓
independent checks
↓
release evidence

missing evidence
↓
BLOCKED
```

### Clean-machine checklist

- [ ] Check Bawa’s prerequisites: Node `>=22` and `<23`, Python `>=3.11`, npm and a Python virtual environment. Verify the intended commit or tag **before installing dependencies**. For Bawa’s revision verification, use `git verify-tag` or `git verify-commit` with a maintainer key obtained through a separate, trusted channel. Bawa does not publish a signing key in the repository; ask the maintainer for one, and do not treat a signed tag as verified without it.

  **You should see:** recorded revision verification, including the intended revision, trusted key used and verification result.

- [ ] Repeat Bawa’s clean install at both package boundaries. The repository root and `tools/hdwallet-gen` each have their own `package.json`, so both installs are required. The generator package is version `1.1.0` and depends on `@trustwallet/wallet-core` `4.8.4`.

  At the repository root, run:

  ```bash
  npm install
  ```

  Then, in `tools/hdwallet-gen`, run:

  ```bash
  npm install
  ```

  **You should see:** the lockfile generated by the clean install. A successful install is installation evidence only, not a runtime, offline or wallet-correctness pass.

- [ ] Check that the generation environment is offline or trusted. Bawa does not document generation commands for this checklist; ask the maintainer for the supported workflow before running generation.

  **You should see:** the environment choice recorded, with public fixtures only for this checklist.

### Release evidence checklist

These checks describe evidence to inspect, not a console transcript.

Keep Bawa’s release gates separate. A green installation job must not mark any other gate as passed. Any gate without evidence stays **BLOCKED**.

| Gate | Evidence check |
| --- | --- |
| Committed lockfile | The lockfile is committed and linked to the tested revision. A generated but uncommitted lockfile is not enough. |
| Full published BIP-32/BIP-39 vector coverage | Results cover the full published BIP-32 and BIP-39 vector sets, with fixture sources, source-backed expected results and observed results. |
| Independent differential testing | Results from Bawa’s `test/differential_test.py`, which runs public-vector checks with `bip_utils` and prints `bip_utils reference checks: PASS` on success. This result does not replace evidence of full vector coverage. |
| Chain-specific fixtures | Fixture sources and expected and observed results for the chains being tested. |
| Secret scanning | Recorded secret-scanning results linked to the revision. |
| Dependency scanning | Recorded dependency-scanning results linked to the revision. |
| Reproducible artefacts | Evidence that the release artefacts can be reproduced. |
| External security review | A recorded external security review of the release. |
| Negative tests | Cover malformed input, rejection of private-key material at the public-only boundary, refusal of symlinked paths and invalid checksums. Record a defined expected outcome for each case **before running it**, then check and record the observed result against that expectation. |
|---|---|
| [ ] Committed lockfile | **You should see:** the clean-install lockfile committed with the tested tree. |
| [ ] Full published vectors | **You should see:** source-linked results covering the full official BIP-32/BIP-39 suites. Partial coverage does not clear this gate. |
| [ ] Chain-specific fixtures | **You should see:** chain-specific fixture sources and results. |
| [ ] Differential testing | **You should see:** independent comparison results. |
| [ ] Secret/dependency scanning | **You should see:** reports from both kinds of scanning. |
| [ ] Reproducible artefacts | **You should see:** evidence supporting reproducibility of the release artefacts. |
| [ ] External security review | **You should see:** an external review report. |

Bawa’s repository includes the independent test harness `test/differential_test.py`. It runs public-vector checks with `bip_utils` and prints `bip_utils reference checks: PASS` on success.

Bawa does not document the fixture inventory, scanner configuration, reproducibility procedure or review acceptance criteria, and does not provide passing reports for these gates. Ask the maintainers for these details and evidence of a pass for each gate.

A report’s existence alone is not a passing result. Keep each release gate blocked until its own evidence shows that it has passed. A green installation job proves only that installation succeeded; it does not clear the other release gates.
### Negative-test checklist

These are required cases, not ready-to-run tests. Bawa does not document the negative-test inputs or harness commands; ask the maintainers for fixtures and run instructions. Bawa requires you to define and record the expected outcome for each case before running it.

- [ ] Exercise malformed input.
  **You should see:** the service remains running.

- [ ] Exercise a public-only boundary with a published test-vector private key.
  **You should see:** private-key material rejected at the public-only boundary, as Bawa requires. Bawa does not document the exact rejection response; confirm it with the maintainers and record it before running the test.

- [ ] Exercise symlinked paths.
  **You should see:** symlinked paths refused, as required by Bawa’s negative-test rules. Confirm the fixture and exact refusal response with the maintainers, then record the expected outcome. This case remains blocked until those details are defined.

- [ ] Exercise invalid checksums.
  **You should see:** a result that matches the applicable checksum rules and your recorded expected response. Bawa does not document the fixtures or expected response; ask the maintainers for these and the applicable checksum rules. This case remains blocked until those details are defined.

### Run/test/release recipe gaps

Bawa documents installation, but not a complete generation, negative-test or release recipe. Ask the maintainers for the remaining commands, fixtures and expected outcomes before attempting an end-to-end run.

The repository’s independent check is `test/differential_test.py`. It runs public-vector checks with `bip_utils` and prints `bip_utils reference checks: PASS` on success. This check is separate from installation evidence.

A clean installation proves only that installation succeeded. It does not establish correct runtime behaviour, offline operation or wallet correctness.

Keep the release gates separate:

- A committed lockfile.
- Full published BIP-32/BIP-39 vector coverage.
- Independent differential testing.
- Chain-specific fixtures.
- Secret and dependency scanning.
- Reproducible artefacts.
- External security review.

A green installation job must not turn the other gates green.

**Do not replace missing recipes with guessed commands. Unknown gates and gates without evidence remain blocked; this checklist is not a release-ready claim.**
