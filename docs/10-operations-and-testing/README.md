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

## Installing Bawa from a clean machine

Work through these steps in order, stopping at the first failed command. Installation is not wallet generation: do not introduce wallet secrets or recovery material while setting up the tools.

### 1. Prepare the machine

Both the root package and `tools/hdwallet-gen` declare version `1.1.0`. Their installation prerequisites are:

- **Git**, to clone the repository.
- **Node.js 22.x**, matching the root engine requirement `>=22 <23`.
- **npm**. Bawa does not specify an npm version.
- **Python 3.11 or newer**, matching `>=3.11`, with virtual-environment support.
- Enough free storage for dependencies and later recovery backups.
- Preferably a Unix-like environment: the interactive generation flow uses `/dev/tty`.

Bawa does not document OS-specific prerequisite installation commands or a disk-space figure. Confirm the supported toolchain, tested npm version and storage requirements with the maintainer rather than guessing a bootstrap recipe.

For actual wallet generation, use an offline or trusted machine—not an arbitrary online shell or CI runner. If the installation machine must remain offline, first confirm the dependency-transfer and verification process with the maintainer; Bawa does not document an offline installation procedure.

**You should see:** Git and npm available, Node within `>=22 <23`, and Python at least `3.11` with virtual-environment support.

### 2. Clone the repository and verify the revision

```bash
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
```

Before installing dependencies, verify the exact commit or tag you intend to use. The clone command does not select a particular release, and a package version of `1.1.0` is not proof that a matching release tag exists or is trustworthy.

This check belongs **before** installation because `npm install` can execute package lifecycle scripts. You need to trust the checkout before allowing installation code to run.

Bawa does not document a revision-authentication procedure or trusted signing identity. Confirm the intended commit or tag, and how to authenticate it, with the maintainer before continuing.

**You should see:** a checkout containing `package.json`, `requirements.txt` and `tools/hdwallet-gen/`, with its revision confirmed by the agreed verification method. A successful clone alone is not that verification.

### 3. Install the root Node dependencies

From the repository root:

```bash
npm install
```

**You should see:** the root installation completing without an error. This is not yet evidence that the wallet tooling is ready.

### 4. Install the wallet-core tooling dependencies

Do not skip this second installation. The root `check` and `test` scripts delegate to `tools/hdwallet-gen`; success at the root does not, by itself, demonstrate that dependencies at that package boundary are installed.

The tooling package declares `@trustwallet/wallet-core` at version `4.8.4`.

```bash
cd tools/hdwallet-gen
npm install
```

Only after that installation succeeds, return to the root:

```bash
cd ../..
```

**You should see:** a successful installation in `tools/hdwallet-gen`, followed by your shell returning to the repository root. The directory change succeeding does not cancel an earlier npm failure.

#### If either npm installation fails

Stop before moving on to Python setup or repository checks.

- Confirm that Node satisfies `>=22 <23`.
- Confirm whether the failing command ran at the repository root or inside `tools/hdwallet-gen`.
- Record the failing command, package directory, OS, tool versions and sanitised error details. Use placeholders for sensitive fields and machine-specific paths; never send credentials or wallet material.
- Do not change dependency pins or force an installation merely to suppress the error.

Bawa does not document an npm failure-recovery procedure. Confirm the supported npm version, any platform prerequisites and the appropriate remedy for your selected revision with the maintainer before retrying.

**You should see:** the previously failing installation completing successfully after its cause has been addressed. Until then, treat setup as incomplete.

### 5. Create and activate the Python environment

Back at the repository root, create a local environment and activate it:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

For Windows PowerShell, the documented activation command replaces the `source` line:

```powershell
.\.venv\Scripts\Activate.ps1
```

That activation command does not establish a complete Windows setup for the `/dev/tty` generation flow. Bawa does not document that workflow on Windows; confirm platform support and any additional setup with the maintainer.

**You should see:** a `.venv` directory, successful activation, and `python` referring to the environment’s interpreter. Do not install the Python dependencies into the system interpreter by mistake.

### 6. Install the Python requirements

Keep the virtual environment active and run:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

`requirements.txt` pins:

- `cryptography==50.0.2`
- `bip-utils==2.12.2`

Keep those pins. Bawa does not document substitute versions for installation failures; confirm a supported remedy with the maintainer rather than editing the requirements to make installation proceed.

**You should see:** both pip commands completing without errors, with the pinned requirements installed in `.venv`.

### 7. Run the documented repository checks

From the repository root, with the virtual environment still active, run the pre-merge commands listed in `CONTRIBUTING.md`:

```bash
npm run check
npm test
python3 -m py_compile tools/make_wallet.py tools/decrypt_seed.py
python3 test/differential_test.py
```

The root npm commands forward to the tooling package. Its `check` script uses `node --check` on `generate.js`, `derive.js`, `derive_daemon.js` and `compare.js`; that is a syntax check, not a wallet-generation test. The Python compilation command likewise checks the two named scripts without establishing that recovery works.

**You should see:** all four commands completing successfully. Bawa does not document a fixed success transcript; if the outcome is unclear, confirm the expected behaviour for your revision with the maintainer. Passing these checks does not certify the machine as safe for real wallet generation.

Keep recovery material out of the checkout and installation reports. `CONTRIBUTING.md` forbids committing `.env`, `secrets/`, `seed-backup/`, mnemonics, private keys, production xpubs/zpubs or real recovery material.

### Sources

- Bawa installation guidance and repository files: `package.json`, `tools/hdwallet-gen/package.json`, `requirements.txt` and `CONTRIBUTING.md` — https://github.com/Pr3eve6ti2o/bawa.git

## Dependency lockfile discipline

**The lockfile release gate is not yet met.** A search of this tree found no `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` or `Pipfile.lock`. A production lockfile still needs to be generated, reviewed, tested and committed.

A lockfile records the resolved dependency tree: exact package versions, including dependencies of dependencies, and integrity hashes. Version ranges in `package.json` alone can resolve differently on later installs. Without a lockfile, unchanged Bawa code can receive packages that were never part of the tested build.

CI in `.github/workflows/ci.yml` currently runs `npm install --ignore-scripts --no-audit --no-fund` in `tools/hdwallet-gen`, not `npm ci`, because there is no lockfile to install from.

### Generate, review and test

Bawa does not document a lockfile-specific validation procedure. Confirm the Node.js/npm versions and required checks with the maintainer before proceeding.

1. **Generate from a clean install.** Use a fresh checkout of the revision to be tested, with no existing `node_modules` in `tools/hdwallet-gen`. From the repository root, use CI’s current install options:

   ```sh
   cd tools/hdwallet-gen
   npm install --ignore-scripts --no-audit --no-fund
   ```

   **You should see:** a new `tools/hdwallet-gen/package-lock.json`. If it does not appear, stop and confirm the npm configuration with the maintainer.

2. **Review the changes.** Stay in that directory. A new, untracked file will not appear in an ordinary Git diff, so stage it for review:

   ```sh
   git diff -- package.json
   git add -- package-lock.json
   git diff --cached -- package-lock.json
   ```

   Check direct and transitive versions, download locations and integrity entries. Investigate unexpected packages or sources, and any unexplained `package.json` changes. Keep unrelated dependency upgrades out of this change.

3. **Verify the locked install.**

   ```sh
   npm ci --ignore-scripts --no-audit --no-fund
   ```

   `npm ci` uses the lockfile without rewriting it and fails if it disagrees with `package.json`. By contrast, `npm install` may update the lockfile.

Run the maintainer-confirmed checks after that install. Once they pass, commit the lockfile with the tested code, any intentional manifest changes and the CI change to `npm ci`, retaining the existing flags and working directory. This ties the reviewed dependency graph to the revision that was actually tested.

### Sources

- npm lockfile behaviour: https://backpack.ns.nl/guides/tooling/working-with-npm.html

## Daily and weekly rhythm by size

Keep Trust Wallet Core generation on a trusted interactive machine, with mnemonics and seeds retained there. Send only account-level public roots (xpub/zpub) or public addresses to online tracking services. Those services derive addresses from public roots and use RPC, node or indexer data for tracking and reconciliation. Watch-only tools reject private extended keys.

These checks are guidance for your own setup, not Bawa monitoring features. Bawa does not document freshness thresholds, payment-confirmation rules or recovery procedures. Confirm those with the maintainer.

### Personal — $0, no server

1. **Daily:** Manually check activity and confirmations for your wallet’s public addresses using an explorer or free RPC.  
   **You should see:** a history you can account for, including no change when idle.

2. **Weekly:** Review the addresses you follow and cross-check a sample against a second source.  
   **You should see:** matching history, allowing for differences in update timing.

### Personal automated tracker — $0, local

1. **Daily:** Follow the latest cron run through its free RPC or Esplora requests, SQLite records and local dashboard.  
   **You should see:** a recent successful run and dashboard data consistent with SQLite.

2. **Weekly:** Review missed runs, endpoint limits, SQLite growth and backup status under your agreed recovery plan.  
   **You should see:** explained gaps, sufficient disk space and verifiable backup records.

### Small application

1. **Daily:** Check public address derivation, backend RPC/indexer freshness, PostgreSQL reconciliation and the web UI together.  
   **You should see:** consistent addresses and payment states, with delays accounted for.

2. **Weekly:** Review hosted-RPC usage, throttling and response times. Start with the free tier; let measured demand justify an upgrade.  
   **You should see:** evidence supporting the current tier or a clear reason to change it.

### Serious application

1. **Daily:** Compare transaction states from the RPC provider, indexer API and your own nodes against the reconciliation database. Review alerts from your monitoring setup.  
   **You should see:** agreement or discrepancies recorded for investigation.

2. **Weekly:** Review trusted-generator and signer isolation, access boundaries, recovery readiness and unresolved incidents. Keep monitoring separate from signing.  
   **You should see:** public-only tracking services and clear responsibility for recovery and incident follow-up.

### Fully self-hosted

1. **Daily:** Check node synchronisation, self-hosted indexer lag and agreement with the tracking database.  
   **You should see:** chain and payment data within agreed freshness tolerances, with discrepancies explained.

2. **Weekly:** Review storage growth, maintenance needs and recovery readiness against your privacy and independence goals.  
   **You should see:** enough capacity and a continuing reason to carry the extra operational work.

### Sources

- Trust Wallet Core: https://github.com/trustwallet/wallet-core
- BIP 32 — public derivation: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- Esplora API: https://github.com/Blockstream/esplora/blob/master/API.md

## Monitoring signals, alerts and investigating a missed payment

These checks belong to your monitoring setup, not Bawa monitoring features. Bawa does not document monitoring tools, thresholds or recovery commands; confirm tooling, timeout/retry limits, gap policy, finality rules and storage budgets with the maintainer.

Use Trust Wallet Core interactively on a trusted machine; keep mnemonic and seed material there. Only account-level public roots (`xpub`/`zpub`) or public addresses belong online. Watch-only tools reject private extended keys. `tools/hdwallet-gen/derive_daemon.js` performs repeated public derivation over JSON lines, not monitoring.

Never log mnemonics, private keys, seed material, data keys, passwords or credentials. Use placeholders in diagnostic examples.

### Routine checks

1. **Feed health:** measure indexer lag against chain progress; count RPC errors, timeouts, retries and exhausted attempts.  
   **You should see:** forward progress, recorded faults and bounded retries with back-off.

2. **Reconciliation:** store explicit chain/network identifiers and unprocessed chain records before normalising. Track reorgs, finality and duplicate or retried events. Preserve UTXO inputs and outputs; identify EVM tokens by contract address.  
   **You should see:** traceable state changes, provisional/final status and no double crediting.

3. **Allocation:** check transactional index allocation, table consistency and coverage around the configured gap window.  
   **You should see:** issued addresses linked to network, branch and index, within tracking coverage.

4. **Storage:** monitor free disk space for dependencies, tracking data and backups, plus backup completion.  
   **You should see:** free space within agreed limits and completed backups.

**Warning:** recoverable faults or shrinking disk/gap headroom within agreed limits, while coverage remains intact.

**Alert:** lag breaches escalation limits, retries are exhausted, allocations conflict, credits repeat, finality changes unexpectedly, or storage/backup failures threaten reconciliation or recovery. Routine reorgs and harmless event retries are not automatically alerts.

```text
Signal
↓
Classify warning or alert
↓
Alert: check index, table, gap, branch
↓
Check indexer lag, then RPC failures
↓
Check reorg, token contract, network
↓
Verify reconciliation or escalate
```

### When a payment is missing

Use the allocation table as your reference; keep this order.

1. **Address index:** compare the recipient with the address for its allocated index.  
   **You should see:** the same public address.

2. **Allocation database:** inspect the saved allocation.  
   **You should see:** a durable mapping without conflicts.

3. **Gap window:** check whether tracking reached that index.  
   **You should see:** coverage, or an identified gap.

4. **Branch:** compare issued and tracked derivation branches.  
   **You should see:** the issued branch being tracked.

5. **Indexer lag:** compare indexed progress with chain progress.  
   **You should see:** catch-up or a measurable delay.

6. **RPC error:** inspect failures, timeouts and retry history.  
   **You should see:** successful reads or a recorded fault.

7. **Reorg:** check canonical inclusion and finality.  
   **You should see:** current status rather than stale inclusion.

8. **Token contract mismatch:** compare EVM contract addresses, not symbols.  
   **You should see:** the expected contract.

9. **Network:** compare allocation, transaction and provider networks.  
   **You should see:** matching chain/network identifiers.

Bawa does not document replay or gap-expansion procedures. Any recovery action needs confirmation from the maintainer before tracking is changed.

### Sources

- BIP 32 — public derivation: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- BIP 44 — branches and gap discovery: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki

## What to back up and how to rotate it

Back up the complete recovery set, not just the wallet’s working files. Bawa does not document backup file locations, export or encryption procedures, restore checks or retention counts. Confirm these with the maintainer before relying on your backups.

### 1. Keep a complete recovery set

Maintain all six items:

- **Mnemonic backup**, protected against unauthorised access.
- **Passphrase policy record**: whether a passphrase is required and how authorised recovery access is arranged. Record the policy, not the secret value.
- **Chain paths**, clearly labelled for their corresponding chains.
- **Chain-specific configuration**, including the settings needed for recovery.
- **Encrypted seed artefact**, which must pass a recovery test.
- **Separate encryption-key backup**, needed to read that artefact.

A policy record does not replace access to a required passphrase.

**You should see:** An inventory covering all six items, with storage locations and access responsibilities but no secret values.

### 2. Keep secrets out of plain text and git

Do not store mnemonics, seeds, private keys, passphrases, passwords or encryption/data keys in plain-text backups. That includes secret-bearing configuration, notes, screenshots and logs.

Keep wallet recovery material out of git, including encrypted artefacts; a private repository is not a secret store. Store the encryption-key backup separately from the seed artefact, not bundled into the same backup set. Confirm the protection and storage arrangement with the maintainer.

**You should see:** Protected recovery copies, a separately held key backup, and no recovery material in git.

### 3. Spread the copies across independent storage

Apply the 3-2-1 rule by spreading three protected copies across at least two types of storage. Three folders on one disk do not provide that separation.

Keep one copy away from the operating site. Keep it offline where possible: storage that remains connected is not an offline backup. Apply equivalent protection to the separately stored encryption-key backup.

**You should see:** A copy register identifying the storage type, location and offline status of each copy.

### 4. Agree daily, weekly and monthly retention

Use daily generations for recent history. Retain a selected daily generation each week after ordinary daily copies expire, then preserve a selected weekly generation each month for longer retention.

Agree how many generations to keep in each tier with the maintainer and record the limits. Do not assume Bawa performs this rotation automatically.

Update affected backups whenever recovery material changes. Remove expired copies only once their replacement has been tested. Keep any encryption key still required by a retained generation, and assign responsibility for refreshing the off-site copy.

**You should see:** A written daily, weekly and monthly schedule, with retention limits, verification records and an off-site update owner.

### 5. Prove recovery before funding

Use the maintainer-confirmed recovery procedure to test the encrypted artefact, the separate key backup and the complete recovery set. A saved file alone does not demonstrate recoverability.

Complete the recovery drill before funding the wallet. Keep its record free of secret material.

**You should see:** A dated, successful recovery-drill record against the agreed checks.

A compromised seed requires a new wallet, not a restored backup. See **Incident response** for that case.

### Sources

- CISA, *Data Backup Options*: https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf
- NCSC, *Backing up your data*: https://www.ncsc.gov.uk/collection/small-business-guide/backing-your-data

## Restore drills and what changes the recovery picture

Keep funding on hold until the encrypted backup has passed a restore check. Repeat after every backup change and regularly between changes.

1. **Confirm the supported route.** Bawa does not document the full restore sequence, `tools/decrypt_seed.py` command syntax, verification checks, cleanup or drill frequency. Confirm these with the maintainer, together with suitable public fixtures and controlled-environment requirements. If those details cannot be confirmed, stop rather than improvise.  
   **You should see:** agreed instructions and known public reference checks.

2. **Practise without funds.** Only run `tools/decrypt_seed.py` under the agreed isolated, offline conditions. Practise with `<PUBLIC_FIXTURE>` and its public test inputs in a fresh `<SCRATCH_DIRECTORY>`, away from live wallet files and synchronised storage. Use no real funds. Keep decrypted material out of logs, screenshots and support messages.  
   **You should see:** the fixture matches the agreed reference checks, with no live data changed.

3. **Test the backup itself.** A fixture pass does not validate your wallet backup. Under the same controlled conditions, use the confirmed recovery method to restore a copy of `<ENCRYPTED_BACKUP>` from its intended storage into a fresh scratch location. Preserve the original. Verify the restored wallet using the public identity check agreed with the maintainer; do not use a funds transfer as the test.  
   **You should see:** the expected public identity matches; successful decryption alone is insufficient.

4. **If anything fails, stop.** A missing file, decryption error or verification mismatch means the drill has not passed. Pause new funding, preserve existing copies and keep any working wallet intact. Ask the maintainer to investigate using non-secret diagnostics only. Test another independent copy if available, then repeat the complete drill after any correction. Bawa does not document repair steps; confirm them rather than guessing.  
   **You should see:** recovery recorded as unverified until a complete repeat passes.

5. **Close and schedule.** Record the backup revision, date and outcome without secrets. Follow the confirmed cleanup method for scratch data. Set the next drill date; repeat sooner whenever the backup, its encryption or its storage changes.  
   **You should see:** a dated result for the current backup, completed cleanup and a scheduled retest.

### What changes the recovery picture?

- **Backup failure:** that copy offers no demonstrated recovery. An independent copy may still work, but must pass its own drill. Bawa does not document replacement from a working wallet; confirm whether and how that route is supported.
- **Media loss:** recovery now depends on an accessible, tested independent copy or another supported route. Two copies on the missing device do not help. Confirm any alternative route with the maintainer.
- **Lost passphrase:** if decryption requires the missing passphrase, extra copies do not solve the problem. Bawa does not document a bypass; confirm whether an independent recovery route exists with the maintainer. Without one, recovery may be impossible.

For suspected or confirmed seed compromise, see **Incident response**. A backup is not a substitute for a new wallet.

**Sources**
- https://www.lifetimecloud.me/blog/backup-3-2-1-strategy.html
- https://zeonedge.com/blog/backup-strategy-self-hosted-applications-2026-automated-encrypted

## Incident response playbook — part 1

### 1. Contain

Stop signing transactions or interacting with the suspected service. Do not wipe devices or delete incident records.

- **Seed or private key exposed:** retire the wallet permanently. Removing the app or cancelling permissions cannot take back a leaked signing key. Stop using the affected device.
- **Suspicious approval only:** stop using the dApp. Keep this separate from key theft only while there is no reason to suspect signing-secret exposure.
- **Leaked data key or `.env`:** stop affected services. Treat every secret in a leaked file as exposed. If signing secrets were included, follow the exposed-key route too.
- **Tracker missed a payment:** do not send another payment merely because an entry is missing. A tracker fault alone does not establish theft or transaction failure.
- **Suspected malicious dependency:** stop installing, building or running the affected software. Isolate the device and treat secrets accessible to that code as potentially exposed.

### 2. Move to a clean device

Use a separate, trusted device for recovery—not just another browser profile on the suspect machine. Do not carry over the suspect installation, dependencies or `.env`.

Keep your seed out of recovery websites. Reject anyone claiming to be support who asks for it.

### 3. Create a new wallet with a new seed

Where signing secrets have leaked, or malicious code could have read them, generate a replacement wallet with a fresh seed on the clean device. Restoring the old seed recreates the compromised wallet; it does not repair it.

A genuinely approval-only incident does not automatically require wallet replacement.

### 4. Move assets

For the exposed-key route, transfer holdings to the replacement wallet, prioritising the highest-value liquid assets. Continue with other assets that can safely be moved.

Do not return to the suspect device to authorise transfers or use links from unsolicited recovery messages.

### 5. Revoke approvals

From the clean environment, remove suspicious permissions using a trusted interface. For an approval-only incident, this is the principal containment action once the scope is established.

Revocation restricts a spender’s permission; it does not protect a wallet whose signing key is already known to someone else.

### 6. Rotate related access

Secure affected accounts and replace exposed account credentials and service keys through their issuers. Merely deleting `.env` does not invalidate its contents.

Bawa does not document an exact recovery response for a leaked data key. Confirm with the maintainer what the key controls, whether and how replacement is supported, what happens to existing data, and which result demonstrates recovery. Do not record a pass until those expectations are agreed and met.

### 7. Preserve evidence

Save phishing communications, transaction hashes and recipient addresses. Retain relevant logs, dependency versions and lockfiles without running suspect code again.

Keep incident material separate from the clean installation. Redact secrets from anything shared with the maintainer; never send a seed, private key, data key or unredacted `.env`.

### 8. Review before resuming

- **Missed payment:** independently check the transaction’s status on the intended chain. Bawa does not document an exact missed-payment recovery response. Confirm safe reconciliation, duplicate-prevention behaviour and the expected tracker record with the maintainer before treating recovery as a pass.
- **Malicious dependency:** Bawa does not document a definitive clean-state check or expected recovery output. Confirm trusted dependency versions, restoration steps and acceptance checks with the maintainer before running Bawa again.

For every incident, establish what was exposed and close the original access path. A quiet dashboard or an error-free restart is not proof of recovery. Never resume ordinary use of a wallet with exposed signing secrets.

### Sources

- https://tokentoolhub.com/wallet-safety-101/
- https://taoflow.network/blog/crypto-incident-response-playbook-first-60-minutes-after-wallet-compromise
- https://www.houseplantnotes.com/safety/incident-response.html

## Troubleshooting by symptom

### npm installation fails

Check Node/npm compatibility first, then the dependency selected by the lockfile.

```sh
node --version
```

```sh
npm --version
```

Read npm’s error and locate the failing dependency in the project’s lockfile, such as `package-lock.json`. Inspect the exact package and resolved version. Don’t wipe every dependency or replace locked versions with arbitrary latest releases.

**Expected:** supported Node/npm versions, the intended dependency versions and an installation that completes without errors. Bawa does not document exact pass output; confirm the supported versions, dependency selection and acceptance criteria with the maintainer before marking this passed.

### Generation refuses to run without a TTY

A non-interactive session triggers this deliberate restriction for one-time generation. Confirm the generation command with the maintainer, then launch it directly from an interactive terminal on the trusted generation machine. Never feed fabricated input through a pipe to bypass the check.

**Expected:** generation is no longer rejected for lacking a TTY. That alone does not establish successful completion. Bawa does not document the exact completion response; confirm it with the maintainer before accepting generation as successful.

### A derived address differs

Compare the following locally, in this order, keeping secret values out of messages and diagnostic reports:

1. Mnemonic.
2. BIP-39 passphrase.
3. Curve.
4. Coin type.
5. Purpose.
6. Account.
7. Branch.
8. Index.
9. Network and address encoding.
10. Wallet implementation and configuration.

For TON, also match the wallet contract/version and wallet-ID/subwallet configuration. For Cardano, establish the exact CIP and role model. For Solana, check the source wallet’s precise derivation convention.

Repeat derivation using a maintainer-confirmed command once the settings agree.

**Expected:** the address equals the trusted reference address for that configuration—not merely an address that looks valid. Bawa does not document an exact comparison command or pass response. Confirm the command, public reference address and non-secret settings with the maintainer before accepting the match.

### The EVM address matches, but its balance is zero

Suspect a different chain first. One address can legitimately appear on several EVM networks.

Check these in order: the chain ID returned by `eth_chainId` through the configured RPC connection; RPC endpoint; network name; native currency; explorer.

**Expected:** all five identify the intended network. Correct network selection does not itself establish that the address holds funds. Bawa does not document an exact RPC-client command or expected response. Confirm the invocation, intended network values and pass response with the maintainer before treating the connection as correct.

### The tracker misses an incoming payment

Compare the payment details with the address allocation table and tracker diagnostics. Investigate these causes in order:

1. Incorrect receiving-address index.
2. Missing or inconsistent records in the index-allocation database.
3. A gap window that excludes the address.
4. The wrong branch being watched.
5. Indexer delay.
6. RPC failures.
7. A chain reorganisation.
8. A token-contract mismatch.
9. The wrong network.

Keep an address allocation table: it lets you establish which addresses the tracker should cover.

**Expected:** once synchronised, the tracker records a canonical-chain payment to the allocated, watched address under the agreed confirmation rules for the intended asset and network. Bawa does not document diagnostic commands, acceptable lag, reorganisation handling or exact healthy output. Confirm these, the allocation rules and confirmation criteria with the maintainer before marking this passed.

### Sources

- Node.js CLI: https://nodejs.org/api/cli.html
- npm lockfile reference: https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json
- Ethereum JSON-RPC: https://ethereum.org/en/developers/docs/apis/json-rpc/

## Secret scanning as a routine, and triaging a finding

Secret scanning belongs in everyday development, not just release preparation.

Bawa does not document a scanner configuration, a reproducibility procedure, review acceptance criteria or passing reports for its release gates. It also does not publish a signing key in the repository. **Keep every gate without its own evidence marked BLOCKED.** Installation success or the differential test alone must never pass a gate.

Confirm the missing procedures, criteria and gate-specific evidence with the maintainer, including where public verification material can be obtained and authenticated. Never request private signing material.

### Make scanning routine

Gitleaks and TruffleHog are free local scanning options that can examine Git history. For public GitHub repositories, use GitHub secret scanning and push protection as another layer.

Agree the following routine with the maintainer. Confirm the chosen scanner, version, rules, documented invocations and failure handling rather than guessing Bawa-specific commands.

- **Pre-commit:** use the scanner’s documented integration to check staged changes before accepting a commit. Stop on unresolved findings. Confirm that the integration actually examines staged content; do not assume a working-tree scan covers it.
- **CI:** repeat scanning on pull requests, pushes and release candidates. Include both proposed changes and Git history. The checkout must contain the history for the agreed branches and tags; a shallow checkout cannot support a full-history claim. Findings, scanner errors and incomplete scans must block the check.
- **History baseline:** scan existing history before relying on checks for new changes. Agree a repeat schedule and re-scan after repository imports or history changes.
- **Coverage and reporting:** confirm whether the rules recognise relevant wallet-secret formats. Never use real wallet material to test detection. Ensure secret values are redacted before findings reach build logs, tickets or reports.

Local hooks are useful, but they can be bypassed. Keep the independent CI check.

### Triage: verify, fix, re-scan, record

1. **Verify the finding.** Identify the scanner rule, file, commit and responsible owner without reproducing the value. Use only a placeholder such as `<SECRET_PLACEHOLDER>` in discussion. Establish whether the match represents an exposed secret or a false positive; do not test it by signing in or submitting it to another service. Ask the maintainer what evidence is required before accepting a narrow exception.

2. **Fix the exposure.** For a confirmed leaked credential, have its owner revoke it and rotate its replacement through an authorised process. Remove it from current files and keep replacement secrets outside the repository. Deletion alone is not remediation. Wallet keys and mnemonics may not have a revocation mechanism: confirm safe replacement and asset-migration steps with the maintainer rather than assuming rotation invalidates the old wallet.

3. **Re-scan.** Repeat the affected-file scan and the agreed history scan after remediation. Check that the scanner completed and covered the intended refs. Any remaining match needs investigation; do not hide it with a broad exclusion.

4. **Record.** Keep a redacted record of locations, rules, scanner version and configuration, scan scope, owner, containment actions, review decision and supporting reports. Closing a finding does not approve a release or clear unrelated gates.

### When the secret is in history

Treat historical exposure as exposure, even when the current file is clean. Git retains earlier content.

Revocation and rotation come first where supported. Review relevant access and audit logs, and wallet activity, from the earliest plausible exposure for signs of misuse.

Coordinate a history purge where possible, using a method confirmed with the maintainer. Agree affected refs and collaborator recovery before rewriting shared history. Address reachable copies under your control, but assume clones, forks or caches may retain the secret. Purging cannot make an exposed secret trustworthy again. Re-scan the rewritten history and record the remaining limits.

### Sources

- GitHub — https://docs.github.com/en/code-security/reference/security-incident-response/investigation-areas
- CI/CD security tools — https://dev.to/vulert_official/cicd-security-tools-the-complete-guide-for-engineering-teams-5283
- DevSecOps roadmap — https://0x70ssam.github.io/devsecops/cloud-native/DevSecOps-Roadmap-2026-Comprehensive-Guide-From-Foundations-to-Expert/

## Dependency scanning, SBOM and the release-gate checklist

### Establish trust first

Bawa publishes no signing key in the repository, so verification cannot be completed from this tree alone. Before installing dependencies, confirm the maintainer’s public signing key through a separate trusted channel and require a successful signature check.

For the intended tag:

```sh
git verify-tag <INTENDED_TAG>
```

Or, for the intended commit:

```sh
git verify-commit <INTENDED_COMMIT>
```

Do not treat a tag as verified without both trusted-key confirmation and a successful check of that tag’s signature.

### Make scanning routine

Bawa does not document scanner configuration. Confirm dependency inputs, tool setup, cadence and blocking criteria with the maintainer.

These are generic checks, not an established Bawa configuration. For applicable Node dependencies, run the audit in their package directory with the agreed lockfile:

```sh
npm audit
```

The Python command audits installed packages, so use a clean environment matching the agreed locked dependency set:

```sh
pip-audit
```

Run applicable scans after dependency changes, on an agreed schedule and before release. Record tool versions and reports, triage findings, review updates and rerun tests.

Ask a repository administrator to enable GitHub’s dependency graph, Dependabot alerts and Dependabot security updates. Review update pull requests rather than automatically merging them. Use dependency review on pull requests where supported.

An SBOM inventories components; it does not certify security. Syft can generate CycloneDX SBOMs for component tracking. Bawa does not document an SBOM workflow: confirm its scope, generation and publication with the maintainer.

### Release checklist

Bawa does not document a reproducibility procedure, external-review acceptance criteria or passing gate reports. Confirm missing requirements with the maintainer. Keep every gate **BLOCKED** until its own evidence is recorded.

| Gate | Evidence required | Status |
| --- | --- | --- |
| Committed lockfile | Lockfile committed at release revision | BLOCKED — commit evidence missing. |
| Version ranges | Recorded range review | BLOCKED — review unconfirmed. |
| Clean-machine CI | Passing logs for release revision | BLOCKED — no report. |
| Official BIP-32/BIP-39 vectors | Full published-vector coverage and passing results | BLOCKED — coverage/results missing. |
| Independent differential testing | Recorded successful `test/differential_test.py` run | BLOCKED — no report. |
| Chain-specific fixtures | Per-chain fixtures and passing results | BLOCKED — no report. |
| Secret scanning | Enabled checks, configuration and triaged report | BLOCKED — configuration/results undocumented. |
| Dependency scanning | Enabled checks, configuration and triaged report | BLOCKED — configuration/results undocumented. |
| Reproducible artefacts | Documented rebuild method and matching tagged-revision outputs | BLOCKED — method/results undocumented. |
| External security review | Accepted review against agreed criteria | BLOCKED — criteria/report undocumented. |
| Negative tests | Failure-case coverage and passing results | BLOCKED — no report. |
| Integration tests | Recorded integration run | BLOCKED — no report. |
| Recovery drill | Recorded recovery exercise | BLOCKED — no report. |
| Artefacts/checksums | Recorded release artefacts and checksum evidence | BLOCKED — checksum files absent. |
| Security policy | Confirmed publication | BLOCKED — publication unconfirmed. |

On success, `test/differential_test.py` prints “bip_utils reference checks: PASS”. This is differential-testing evidence only. Neither it nor a green installation job clears other gates.

Checksum files, signed checksums and build provenance, such as SLSA-style attestations, are future options, not present in this tree. Confirm any future publication and verification scheme with the maintainer.

Intended release order:

```text
Source commit/tag
↓
Locked dependency graph
↓
Clean install
↓
Standards vectors
↓
Independent/differential tests
↓
Integration tests
↓
Recovery drill
↓
Artefact/checksum
↓
Tagged release
```

### Sources

- https://docs.github.com/en/code-security/reference/security-incident-response/investigation-areas
- https://dev.to/vulert_official/cicd-security-tools-the-complete-guide-for-engineering-teams-5283
- https://0x70ssam.github.io/devsecops/cloud-native/DevSecOps-Roadmap-2026-Comprehensive-Guide-From-Foundations-to-Expert/
