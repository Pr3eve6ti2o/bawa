---
title: Operations and Testing
description: Run Bawa from a clean machine, verify it independently, keep the release gates blocked until each has its own evidence, and respond to incidents by containment first.
last-updated: 2026-11-08
---

# Operations & Testing

How-to guide.

## Contents

- [Verified position](#verified-position)
- [Prerequisites](#prerequisites)
- [Version pins](#version-pins)
- [Clone and install](#clone-and-install)
- [Release blockers](#release-blockers)
- [CI workflow](#ci-workflow)
- [Release metadata](#release-metadata)
- [Troubleshoot symptoms](#troubleshoot-symptoms)
- [Test locally before using public testnets](#test-locally-before-using-public-testnets)
- [Verify public testnet endpoints](#verify-public-testnet-endpoints)
- [A sensible architecture for different sizes of project](#a-sensible-architecture-for-different-sizes-of-project)
- [Independent differential verification](#independent-differential-verification)
- [Test evidence and coverage](#test-evidence-and-coverage)
- [Professional checklist](#professional-checklist)
- [How to adapt this repository to another chain](#how-to-adapt-this-repository-to-another-chain)
- [Trust Wallet registry and asset metadata](#trust-wallet-registry-and-asset-metadata)
- [Release gates and CI](#release-gates-and-ci)
- [Reproducible builds, scanning and release gates](#reproducible-builds-scanning-and-release-gates)
- [Installing Bawa from a clean machine](#installing-bawa-from-a-clean-machine)
- [Dependency lockfile discipline](#dependency-lockfile-discipline)
- [Daily and weekly rhythm by size](#daily-and-weekly-rhythm-by-size)
- [Monitoring signals, alerts and investigating a missed payment](#monitoring-signals-alerts-and-investigating-a-missed-payment)
- [What to back up and how to rotate it](#what-to-back-up-and-how-to-rotate-it)
- [Restore drills and what changes the recovery picture](#restore-drills-and-what-changes-the-recovery-picture)
- [Secret scanning as a routine, and triaging a finding](#secret-scanning-as-a-routine-and-triaging-a-finding)
- [Dependency scanning, SBOM and the release-gate checklist](#dependency-scanning-sbom-and-the-release-gate-checklist)
- [Incident response playbook](#incident-response-playbook)

## Verified position

Treat `e3b65fb832db287fdc8d54794980dd0b3456cc12` as the reference code baseline. This guide was published at commit `754721cd`, whose changes are documentation-only; its code is identical to `e3b65fb832db287fdc8d54794980dd0b3456cc12`. Use `754721cd` to retain this guide. Checking out `e3b65fb832db287fdc8d54794980dd0b3456cc12` instead restores the pre-rewrite documentation.: the syntax check passes, and `npm test` passes 28/28. Do not present a differential-test pass alone as a CI pass.

> **Expected result:**
>
> `derive.js`, `derive_daemon.js` and `compare.js` pass `node --check` (verified 2026-11-08).
>
> At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, `npm test` targets `test/smoke.test.js`, which is in this tree; the 28-check smoke suite passes 28/28 (verified 2026-11-08). At the former pin `082f7915` the file was not in the tree and the suite belonged only to the phase-1 repair copy.

Keep the local repair result separate from checkout results: “The phase-1 repair copy produced 28 ok, 0 fail, exit 0.”

## Prerequisites

Prepare the reference environment before installing dependencies:

- Prefer a Unix-like environment for the interactive `/dev/tty` generation flow.
- Use Node.js matching the repository engine requirement, `>=22 <23`.
- Provide npm, but resolve its version pin before any npm-based release validation.
- Use Python 3.11+ and a Python virtual environment for local tooling.
- Reserve enough disk space for dependencies and recovery backups.
- Use an offline or trusted machine for actual wallet generation.

> **Warning:** Generating a real wallet on an untrusted shell or CI runner risks exposing its secrets. Use an offline or trusted machine for actual wallet generation. Confirm that the generation environment meets this requirement before proceeding.

## Version pins

Distinguish declared dependency values and compatibility ranges from the pins and validation required for a release.

| Component | Scope | Declared value | Required release-verification pin | Status |
| --- | --- | --- | --- | --- |
| Trust Wallet Core | `tools/hdwallet-gen` | `4.9.3` | `4.9.3`; reference engine: `4.9.2` (published 2026-11-06; tag commit `17e3cd4df5d53f061ade3bbdc07d196f5ed5a8e3`; npm registry returns 200) | Pinned; the live EIP-1559 proof was demonstrated on Core 4.9.2 for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open. |
| cryptography | Python | `==50.0.2` | `==50.0.2` | Pinned |
| bip-utils | Python | `==2.12.2` | `==2.12.2` | Pinned |
| Node | repo | `>=22 <23` | record the full tested version separately | Verified on Node v22.23.4 on the VM (D22, 2026-11-08; official tarball, SHA-256 verified): the full repository suite was re-run with no result changes. Separately, the operator's 2026-11-09 run on Node v24.22.2, outside the declared range, passed `npm run check`, `npm test` (28/28), differential testing and `py_compile`, all with exit 0. |
| Python | repo | `>=3.11` | Unresolved (tested 3.12.3; CI uses 3.13) | Range, not a pin |
| npm | repo | no version specified | Unresolved | Unresolved required pin; resolve before any npm-based release validation |

## Clone and install

Use these steps to prepare an inspection checkout, not to certify a release.

### Clone

Run `git clone https://github.com/Pr3eve6ti2o/bawa.git`, then enter the checkout with `cd bawa`.

Verify the intended commit or tag before installing dependencies. For this reference, select and verify commit `754721cd`; do not assume that the default cloned head matches it.

### Node dependencies

The repository root declares no dependencies, so skip root `npm install`. Running it installs nothing and creates an untracked root `package-lock.json`.

Install the wallet-core tooling at its package boundary: enter it with `cd tools/hdwallet-gen`, run `npm install`, then return to the repository root with `cd ../..`.

Engine enforcement (OI-095, verified 2026-11-12): each engines-declaring package — the repository root, `tools/`, `tools/hdwallet-gen/` and `apps/web/` — carries a `.npmrc` with `engine-strict=true`. `npm install` and `npm ci` therefore fail with `EBADENGINE` on any Node release outside `>=22 <23` (Node v24.22.2 and Node v20.19.5 fail; Node v22.23.4 passes). `npm run` does not enforce engines, so `npm run check` can still pass on another Node; that does not make the installation supported. Regression test: `node --test tests/npm-engine-strict.test.mjs`.

Treat these as unlocked dependency installs, not as evidence of a reproducible dependency graph or passing tests.

### Release blockers

1. Install boundary. `tools/hdwallet-gen/package-lock.json` was committed at `e3b65fb832db287fdc8d54794980dd0b3456cc12` (2026-11-08) and pins `@trustwallet/wallet-core` to 4.8.4. Use `npm ci` inside `tools/hdwallet-gen`; D22 verified that this succeeds on 2026-11-08. No root lockfile exists, but the root package has no dependencies. Remove the root install step rather than adding a root lockfile.

2. **Failing pinned CI.** The syntax failures and the missing smoke-test file were resolved by the phase-1 repair (main @ e3b65fb832db287fdc8d54794980dd0b3456cc12, 2026-11-08); require a passing complete workflow on the candidate revision. Do not substitute a differential-test pass or a result from the repair copy.

3. **Incomplete version verification.** Resolve the required version pins, including npm before any npm-based release validation. Obtain Node 22 validation, record the full tested version separately. The live EIP-1559 proof was demonstrated on Core 4.9.2 for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open.

## CI workflow

Use the first-hand reading of `.github/workflows/ci.yml` as the workflow record. The file defines two jobs, `node-tests` and `python-tests`, on `ubuntu-24.04` (CI repair 2026-11-12, OI-075 partial fix; first GitHub run still required).

`node-tests`:

1. Check out the repository with `actions/checkout` pinned to its full commit SHA.
2. Set up Node 22.23.4 with `actions/setup-node` pinned to its full commit SHA; assert `node --version` is `v22.23.4` and `npm --version` is `10.9.9`.
3. Run `npm ci --ignore-scripts --no-audit --no-fund` in `tools/hdwallet-gen`.
4. Run `npm run check`.
5. Run `npm test`.
6. Assert live generation refuses without a controlling terminal (`generate.js` exits non-zero with the no-controlling-terminal message). Live generation never runs in CI by design; the refusal is the security control.

`python-tests`:

1. Check out the same revision with `actions/checkout` pinned to its full commit SHA.
2. Set up Python 3.13.18 with `actions/setup-python` pinned to its full commit SHA; assert `python --version` is `Python 3.13.18`.
3. Run `python -m pip install -r requirements.txt`.
4. Run `python test/differential_test.py` (BTC/ETH/TRX index 0–1, BTC change 0, TON address + SLIP-0010 pubkey, BIP-84 abandon anchors, Hardhat account 0, BIP-32 test-vector-1 xpubs — T30 extension, merged 92b2196).
5. Run `python test/test_decrypt_seed.py` (decrypt round trip) and `python test/test_make_wallet.py`.
6. Apply `py_compile` to `tools/make_wallet.py` and `tools/decrypt_seed.py`.
7. Require non-empty output from each Python test run.

Each job records the runner image identity (`ImageOS`/`ImageVersion` and `os-release`) for the evidence record. `permissions` is `contents: read` and nothing else. Dependabot is configured for GitHub Actions, npm (`tools/hdwallet-gen`) and pip (`.github/dependabot.yml`); major bumps of `@trustwallet/wallet-core` are ignored pending a qualification run.

Record the operator correction plainly: the earlier research note claiming that CI runs only the syntax check is wrong. The file plainly includes the check, smoke tests and differential test. Remaining CI gaps after the 2026-11-12 repair: dependency scanning and secret scanning (scanner names unestablished, maintainer decision pending, OI-059/OI-077); build/reproduce/release-gate jobs (reproducible-build procedure unverified, OI-076); Python 3.13.18 was manifest-resolved but could not run on the lane VM (no 3.13 interpreter; the same tests pass on 3.12.3), so the first GitHub run is the 3.13 evidence. CI run 28 at e3b65fb832db287fdc8d54794980dd0b3456cc12 completed with success on 8 November 2026 (D09, GitHub Actions API, 11:36 UTC) on the previous single-job workflow: syntax check, smoke test 28/28, differential test, py_compile. The earlier research note that no GitHub run could be verified is superseded; the Actions API returned 504 from the research VM, but a later check confirmed run 28.

Record the genuine omissions as dependency scanning, secret scanning and reproducible-build evidence.


## Release metadata

Treat the current version metadata as inconsistent. `CHANGELOG.md` heads with `1.2.0`, while both `package.json` files say `1.1.0`. No changelog entry carries a date.

Keep both package versions at `1.1.0`. `1.2.0` was never released. The changelog's CI bullet describes the workflow's steps accurately, and a passing run exists (run 28 at e3b65fb832db287fdc8d54794980dd0b3456cc12, 8 November 2026, success; D09). The merge was pushed at 754721cd without updating `CHANGELOG.md`. Update the changelog in a follow-up commit: place the outstanding changes under `Unreleased` and record the CI correction in its `Fixed` subsection.

Semantic Versioning adherence: not established by the available evidence.

Do not claim Semantic Versioning adherence until you declare the public API (the documented derivation policies, fixture formats and tool CLIs) and adopt MAJOR/MINOR/PATCH increments.

### Tagging

As of 8 November 2026, the Bawa repository has zero tags: `git tag` is empty. A tag is the immutable record of a release.

Before tagging, document which release artefacts are built from the tag and where their checksums are recorded. Neither the artefact set nor the checksum-record location is established by the available evidence; resolve and document both rather than assuming a build output or path.

After resolving those details and clearing the release blockers, create an annotated tag in the format `vX.Y.Z`. Build the documented release artefacts from that tagged tree and record their checksums at the documented location.

## Troubleshoot symptoms

### Why does `npm install` fail?

**Cause:** Treat the cause as unconfirmed until you have checked the installed Node.js and npm versions and the exact package/version selected by the lockfile.

**Fix:** Run:

```bash
node --version
npm --version
```

Inspect the exact package/version selected by the lockfile and address the specific failure identified.

**Warning:** Replacing the dependency set before identifying the failure can change what you are diagnosing. Do not immediately delete every dependency or install arbitrary ‘latest’ versions. Check the selected package/version against the lockfile before retrying installation.

**Check:** Run `npm install` again after correcting the identified problem.

> **Expected result:** Confirm that installation completes without the reported failure.

### Why does Bawa refuse generation because there is no TTY?

**Cause:** Recognise the missing-TTY refusal as expected behaviour for the one-time generation process.

**Fix:** Run generation from an actual interactive terminal on the trusted generation machine.

**Warning:** Piping fake input defeats the TTY check rather than providing the required interactive terminal. Use the actual interactive terminal without fake piped input. Check the result when starting generation there.

> **Expected result:** Confirm that generation no longer refuses to run because there is no TTY.

### Why does a derived address differ from the expected address?

**Cause:** Look for a difference in derivation inputs, network and address encoding, or wallet implementation and configuration.

**Fix:** Match the source wallet using this derivation checklist, in order:

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

Then match the applicable chain-specific settings:

- For TON, match the wallet contract/version and wallet-ID/subwallet configuration.
- For Cardano, match the exact CIP and role model.
- For Solana, match the exact derivation convention used by the source wallet.

**Check:** Derive the address again and compare it with the expected source-wallet address using the intended network and address encoding.

> **Expected result:** Confirm an exact address match.

### Why does a restored wallet look empty?

**Cause:** Suspect a wrong derivation path or BIP-39 passphrase first, rather than lost funds. Treat a wrong passphrase as deriving a different wallet: the funds are not lost, but are unreachable from this policy.

**Fix:** Restore the source wallet’s exact path and BIP-39 passphrase rather than relying on an assumed policy.

**Check:** Work through the complete derivation checklist above in its stated order, including the applicable TON, Cardano or Solana settings. Compare a re-derived address with the expected source-wallet address, then check its balance on the intended network.

> **Expected result:** Confirm that the corrected policy reproduces the expected address. Use the ordered checklist and address comparison to distinguish a path or passphrase mismatch from an apparent loss of funds. If the address matches but the display remains empty, continue with the network and tracker checks below rather than treating the empty display as proof of lost funds.

### Why does the EVM address match while its balance is zero?

**Cause:** Consider whether you are connected to a different EVM chain. Recognise that the same address can legitimately exist on multiple EVM networks.

**Fix:** Check the chain ID, RPC endpoint, network name, native currency and explorer. Select the intended EVM network and its RPC endpoint.

**Check:** Confirm all five network details before checking the balance again.

> **Expected result:** Confirm that the balance query concerns the matched address on the intended chain, not merely the same address on another EVM network.

### Why does the tracker miss an incoming payment?

**Cause:** Look for an address-allocation problem, a chain or indexer-state problem, an RPC error, or a network or token-contract mismatch.

**Fix:** Check the following in order:

1. Address index.
2. Index allocation database.
3. Gap window.
4. Branch.
5. Indexer lag.
6. RPC errors.
7. Reorgs.
8. Token contract.
9. Network.

Use the address allocation table to check the recorded address, index and branch against the tracker configuration and index allocation database. Correct identified configuration mismatches and reconcile indexed history against the RPC before relying on the tracker.

**Check:** Compare the tracker’s result with the reconciled history for the recorded address, index, branch, network and, where applicable, token contract.

> **Expected result:** Confirm that the tracker agrees with the checked chain history for the incoming payment.

## Test locally before using public testnets

Start with a local stage where the chain supports it, then proceed to public testnet.

Use Bitcoin Core regtest for the Bitcoin local stage. Work on a private chain, create blocks on demand and generate 101 blocks in under a second. Refer to https://developer.bitcoin.org/examples/testing.html (verified live 2026-11-08) for this regtest stage.

**Warning:** Deleting the wrong directory can remove mainnet wallet data. Always back up mainnet wallets before dangerous operations such as deleting. Check that the backup is in place and that the deletion target is only the `regtest` subdirectory, then delete that subdirectory to restart regtest.

Treat local Ethereum, TRON and TON testing as excluded from this documented sequence. Do not treat the Bitcoin regtest stage as establishing local testing for those chains.

Proceed to the public-testnet stage using the endpoint checks below.

## Verify public testnet endpoints

Use these five literal endpoints as worked examples. Treat the check, not the URL, as the acceptance test. Substitute an equivalent provider only if the same checks pass.

Use the dated responses below as examples from checks on 2026-11-08. Run the verification commands yourself. For moving tip heights, block numbers and sequence numbers, expect a larger number than the dated example, not an exact match with it.

### BTC testnet4

Use https://mempool.space/testnet4/api.

Run:

```bash
curl -sS "https://mempool.space/testnet4/api/blocks/tip/height"
```

> **Expected result:** Read the current tip height. Use 159813 only as the dated example checked on 2026-11-08. Run the command and expect a larger tip height.

### ETH Sepolia RPC

Use https://ethereum-sepolia-rpc.publicnode.com.

Send a JSON-RPC POST with method `eth_chainId`:

```bash
curl -sS -X POST "https://ethereum-sepolia-rpc.publicnode.com" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

> **Expected result:** Confirm a result of `0xaa36a7` (= 11155111), matching the example checked on 2026-11-08.

Note that https://ethereum-sepolia.publicnode.com returns the same chain ID.

**Warning:** Matching chain IDs do not prove identical backends or synchronisation state, so relying on them alone can give false assurance. Apply the same acceptance checks before substituting an equivalent provider. Check the network result and reconcile indexed history against the selected RPC before accepting the substitution.

### ETH Sepolia indexer

Use https://eth-sepolia.blockscout.com/api/v2 for Sepolia indexed history.

Keep the command-based verification record incomplete for 2026-11-08: no indexer verification command or dated example output is supplied here.

**Warning:** Treating Blockscout Sepolia stats `total_blocks` as the current head can give you a stale head reference. The figure can lag the RPC head by hundreds of blocks and sit unchanged for minutes while other fields refresh. Reconcile indexed history against the RPC and never present a `total_blocks` figure as the current head. Check the indexed history against the RPC rather than treating refreshed stats fields as evidence of synchronisation.

> **Expected result:** Confirm that indexed history has been reconciled against the Sepolia RPC. Require a documented verification command and dated response before marking this endpoint’s verification record complete.

### TRON Nile

Use https://nile.trongrid.io.

POST an empty JSON body to the read-only verification endpoint:

```bash
curl -sS -X POST "https://nile.trongrid.io/wallet/getnowblock" -H "Content-Type: application/json" -d '{}'
```

> **Expected result:** Read the current block number. Use block 72528850 only as the dated example checked on 2026-11-08. Run the command and expect a larger block number. Note the separate root-endpoint response, `TronGrid v3.4.2`, recorded on the same date; do not confuse it with the block response.

**Warning:** Blind transaction resubmission can repeat a state-changing request. On a transport failure of a read-only Nile verification probe, retry once, with backoff; restrict this rule to read-only probes and never generalise it into blind transaction resubmission. Check the retry result before treating the endpoint as down.

### TON testnet

Use https://testnet.toncenter.com/api/v2.

Run:

```bash
curl -sS "https://testnet.toncenter.com/api/v2/getMasterchainInfo"
```

> **Expected result:** Confirm `ok:true` and read the current masterchain seqno. Use seqno 96561294 only as the dated example checked on 2026-11-08. Run the command and expect a larger seqno.

### Sources

- Node.js CLI: https://nodejs.org/api/cli.html
- npm lockfile reference: https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json
- Ethereum JSON-RPC: https://ethereum.org/developers/docs/apis/json-rpc/

## A sensible architecture for different sizes of project

## Personal wallet, $0

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

## Personal automated tracker, still $0

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

## Independent differential verification

Keep `test/differential_test.py` separate from the Trust Wallet Core runtime. Use it to independently reproduce the shared BTC BIP-84 and ETH BIP-44 public fixtures. Extend it only when both implementations use the same explicitly documented standard and path.

For every test layer, require the exact command, the file it runs and the expected output, or the statement: “This layer has no runnable procedure in this guide yet.”

### Reproduce the published-vector reference check

Create a fresh clone at the pin, then run the environment setup and `test/differential_test.py` from the repository root:

```
git clone https://github.com/Pr3eve6ti2o/bawa.git && cd bawa && git checkout --detach e3b65fb832db287fdc8d54794980dd0b3456cc12 ; python3 -m venv .venv && source .venv/bin/activate ; python -m pip install --upgrade pip && python -m pip install -r requirements.txt ; python3 test/differential_test.py
```

> **Expected result:**
>
> "bip_utils reference checks: PASS", exit 0.
>
> **Captured run:** the bip-utils side was captured on 2026-11-08 on muse-vm with bip-utils 2.12.2 and cryptography 50.0.2 from the documented venv procedure, output "bip_utils reference checks: PASS", BTC bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd, ETH 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7, exit 0.
>
> At 082f7915, the reported published-vector reference check passed against bip-utils==2.12.2 for BTC BIP-84 index 0 and ETH BIP-44 index 0 only; no repository test covers TRX or indices 1-2.
>
> The reported verification used Python 3.12.3 with cryptography==50.0.2 and bip-utils==2.12.2, and Node v24.22.2 on the VM or v24.22.1 locally, outside the repository's declared Node >=22 <23 range.

Version pins are not a lockfile; until a lockfile generated from a clean install is committed, no install reproduces the exact dependency graph that was tested.

### Capture the Wallet Core side

Wallet Core results were captured in V1 (2026-11-08). Generation ran under a real pty via `script -qec`, exited 0 and passed all README §8 checks. The decrypt round trip was byte-identical; derivation passed 9/9; comparison against an independent `bip_utils` re-derivation passed 9/9; the daemon BTC index-5 value matched exactly; and `npm test` passed 28/28. Generation requires a controlling terminal. No root `.env` is included in the repository; V1 built it from the published xpubs in docs/11, supplying `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX` for `compare.js`.

At the repository root, use a controlling terminal (TTY) to run the self-checks in `generate.js`:

```
node generate.js
```

> **Expected result:**
>
> Require successful self-checks on the TTY and capture their actual output. Treat this as an acceptance requirement, not an observed result; the Wallet Core self-check result was captured in V1 (2026-11-08): live generation exited 0 and all README §8 checks passed.

Build the root `.env` from the published xpubs in `docs/11`, using `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX`. Then run `node compare.js` from `tools/hdwallet-gen/` (the helper reads the `.env` from the repository root regardless of where it runs):

```
node compare.js
```

> **Expected result:**
>
> Require the published-fixture comparison to match BTC BIP-84 index 0 to bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd and ETH BIP-44 index 0 to 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7. Capture the actual comparison output; the Wallet Core comparison result was captured in V1 (2026-11-08): 9/9 against an independent `bip_utils` re-derivation.

Do not mark the fixture eligible until both sides are captured and diffed. Keep the comparison within the reported reference coverage boundary, and keep differential-fixture eligibility separate from the per-platform fixture-gate status below.

## Test evidence and coverage

Read each result with its provenance, environment and coverage limits. Do not combine counts across layers or present author-reported checks as repository-reproducible evidence.

### Smoke

> At `754721cd`, the operator's 2026-11-09 run of `npm test` on Node v24.22.2 passed 28/28 with exit 0.
>
> The reported verification used Python 3.12.3 with cryptography==50.0.2 and bip-utils==2.12.2, and Node v24.22.2 on the VM or v24.22.1 locally, outside the repository's declared Node >=22 <23 range.

Run `npm test` from the repository root; it invokes `npm --prefix tools/hdwallet-gen test`, which runs `node ../../test/smoke.test.js`. The smoke test file has been committed since `e3b65fb832db287fdc8d54794980dd0b3456cc12`.

### Web

> 31 offline unit tests pass (mocked transport; no live-network coverage), run by the author against the validation draft, not shipped in any repo.
>
> **Web:** Fixture gate enforced in-engine and covered by offline engine tests; no live-network gate run exists.
>
> The reported verification used Python 3.12.3 with cryptography==50.0.2 and bip-utils==2.12.2, and Node v24.22.2 on the VM or v24.22.1 locally, outside the repository's declared Node >=22 <23 range.

This layer has no runnable procedure in this guide yet.

### Android

> 55 pure-module checks passed in the author's kotlinc 2.1.0 harness run; the harness was not re-run for this guide and covers pure Kotlin logic only - no JNI binding, signing, UI or Gradle build.
>
> **Android:** Fixture gate defined (section I.4) and pure-logic half checked (7 checks, part of 55/55); the on-device gate has never run.
>
> The reported verification used Python 3.12.3 with cryptography==50.0.2 and bip-utils==2.12.2, and Node v24.22.2 on the VM or v24.22.1 locally, outside the repository's declared Node >=22 <23 range.

Preserve the historical command record for `jvmtests/PureModuleTests.kt`, in the order shown below. Note that the placeholders are the author's recorded form, not resolved paths, and that the harness needs kotlinc 2.1.0 and JDK 21.

```
kotlinc <core sources except CoreWalletEngine/EthSendComposer> app/.../storage/VaultEnvelope.kt jvmtests/PureModuleTests.kt
java -cp <jar>:<kotlinc>/lib/kotlin-stdlib.jar PureModuleTestsKt
```

Do not treat these placeholder commands as a runnable guide procedure.

This layer has no runnable procedure in this guide yet.

### Standards vectors

Retain the following as verification targets, not demonstrated coverage:

- BIP-39 mnemonic generation and mnemonic-to-seed vectors;
- BIP-32 master/child vectors;
- hardened and non-hardened derivation;
- leading-zero edge cases;
- extended-key serialisation;
- checksum failures;
- path parsing.

This layer has no runnable procedure in this guide yet.

### Chain vectors

For broader chain-vector coverage, record a known mnemonic, a known path, the expected public key or extended key, and the expected address for every supported chain. Store those expected outputs in tests. Keep this plan separate from the limited BTC and ETH reference result above.

This layer has no runnable procedure in this guide yet.

### Live operation limits

Retain the following limits:

> V1 (live run on 8 November 2026, pushed head 082f7915) demonstrated wallet generation under a real pty and a byte-identical decrypt round trip; the differential test returned PASS. V1 did not verify full recovery. See docs/08 §3 for the unexecuted clean-install recovery rehearsal with independent derivation and address comparison; its unexecuted gates are marked FAIL. No live testnet spend has been made from this wallet.
>
> TESTNET-only does not mean testnet-tested.

This layer has no runnable procedure in this guide yet.

## Professional checklist

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
[ ] encrypted artefact tested
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
[ ] release artefacts/checksums recorded
[ ] security policy published
```

---

## How to adapt this repository to another chain

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

## Trust Wallet registry and asset metadata

Before adding a chain, inspect the Wallet Core registry and record the derivation path, curve, public-key type, address prefix/HRP, network identifier and any alternate derivations explicitly.

Use Trust Wallet Assets for token/asset metadata and presentation, not as a wallet engine or payment-settlement source.

References:
- [Wallet Core registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json)
- [Registry fields](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md)
- [Trust Wallet Assets](https://github.com/trustwallet/assets)
## Release gates and CI

Treat this section as a specification to implement, not as an existing release process. Record the current baseline: zero tags exist, and no release process has ever run. Keep every gate without its required procedure and evidence **blocked (unverified)**.

### Establish the release sequence

Establish the following sequence, and stop wherever required procedures or evidence are missing:

1. **Source commit/tag:** verify the source commit or tag and record its resolved SHA.
2. **Locked dependency graph:** require a generated, validated and committed `package-lock.json` for that revision before installation.
3. **Clean install:** establish the clean-machine installation recipe, then install from the locked graph using the pinned toolchain.
4. **Standards vectors:** run and retain evidence for **full official BIP-32/BIP-39 published-vector coverage**.
5. **Independent/differential tests:** run the independent checks for the recorded SHA and retain their results separately from standards-vector coverage.
6. **Integration tests:** run the documented integration tests using public, chain-specific fixtures and record the expected and observed results.
7. **Recovery drill:** obtain and record the recovery-drill procedure and expected results with the maintainer before running it, then retain the observed results.
8. **Artefact/checksum:** follow the documented build recipe and the reproducible-build procedure specified in the companion section. Record the artefact, checksum and supporting build and reproduction evidence.
9. **Tagged release:** create the tagged release only after `release-gate` has confirmed every preceding job’s success and evidence, and every release gate has its own supporting evidence.

### Implement the CI extension

Extend the current workflow, which already runs the Node tests and Python differential test as steps in one job. Make the workflow file change in the repository; do not treat this prose as an implemented change. The CI workflow is `.github/workflows/ci.yml`.

Implement the following requirements:

- Define the `tests`, `dependency-scan`, `secret-scan`, `build`, `reproduce` and `release-gate` jobs. Place Node testing in `tests`, move Python differential testing into a separate test job, and record that job’s identifier.
- Add dependency-scan and secret-scan steps in their corresponding jobs. Obtain and record the names of both scanners, who runs each scanner and where each redacted report is retained. Do not treat a job name as identification of its scanner.
- Pin the runner to a fixed Ubuntu label and record the runner image identity with the run evidence.
- Pin Node to a complete, validated Node 22 version, and pin npm and Python to exact versions. Record the selected versions.
- Pin every action to a full-length commit SHA verified in that action’s own repository. Do not rely on action tags, which can be moved or deleted. Configure Dependabot for GitHub Actions updates in `.github/dependabot.yml`.
- Generate, validate and commit `package-lock.json` first. Only then switch CI installation to `npm ci --ignore-scripts --no-audit --no-fund`.
- Make both test jobs check out the same revision. Require each job to fail on empty or skipped tests. Retain a successful differential run for that exact SHA before making any claim of repaired-tree CI coverage.
- Set `permissions.contents` to `read` and all other permissions to `none`. Document and justify any exception.
- Make `release-gate` require success and retained evidence from every preceding job, including both test jobs, `dependency-scan`, `secret-scan`, `build` and `reproduce`. Keep it blocked whenever a required job or gate lacks evidence.

Status 2026-11-12 (OI-075 partial fix): the two test jobs, SHA pins, fixed runner label, lockfile-based install and Dependabot are implemented. The dependency-scan, secret-scan, build, reproduce and release-gate jobs are NOT implemented: scanner names are unestablished (maintainer decision pending, OI-059/OI-077) and the reproducible-build procedure is unverified (OI-076). The three release gates stay blocked (unverified).

### Record gate-specific evidence

Maintain a public **TESTING** record linking the revision, public fixture sources, expected results backed by those sources, observed results and each gate’s status. Treat this as a proposed evidence record, not as confirmation that any gate has passed.

For each gate, supply or link to:

- the actual workflow file path, its recorded job mapping and the relevant revision-specific job evidence;
- the scanner record naming both scanners, identifying who runs them and locating their retained redacted reports;
- the reproducible-build procedure specified in the companion section, together with the relevant `build` and `reproduce` evidence.

Obtain any missing workflow path, scanner names, runner responsibilities or report locations from the maintainer. Until the required implementation, references, procedures and evidence exist, keep the gates worded as unverified requirements and never mark them passed.

Keep separate statuses for:

- the committed lockfile;
- **full official BIP-32/BIP-39 published-vector coverage**;
- independent differential testing;
- chain-specific fixtures;
- dependency scanning;
- secret scanning;
- reproducible artefacts;
- external security review.

Retain separate integration-test and recovery-drill evidence as well. Do not infer the completion of external security review from build, test or scanning results.

Keep these three release gates **blocked (unverified)** and not passable today:

- **Full test plan green in CI:** require the documented full test plan and successful evidence for the recorded SHA, including both test jobs. Do not substitute a few passing fixtures for full published-vector coverage.
- **Dependency and secret scanning clean:** require both named scanner runs, their recorded operators and retained redacted reports. Keep the dependency-scanning and secret-scanning statuses separate.
- **Reproducible builds verified:** require evidence from `build` and `reproduce` showing execution of the companion procedure, with the artefact and checksum record.

Do not substitute a successful build or testnet send for any of these gates. Do not let a green installation job turn other gates green.

### Define tests and expected results before running them

Use public fixtures only. Use published test vectors or clearly marked placeholders, and never use live secrets. Keep signing examples testnet-only or conceptual, and never involve real funds.

Before running each test, define and record its expected outcome. Confirm undocumented expected behaviour with the maintainer before running the test, then compare the actual result with the recorded expectation.

Include negative tests covering malformed input, rejection of private-key material at the public-only boundary, refusal of symlinked paths and invalid checksums.

Run `test/differential_test.py` as Bawa’s independent check of public vectors using `bip_utils`.

> **Expected result:** Confirm `bip_utils reference checks: PASS` on a successful differential run. Retain the result with its SHA as differential-testing evidence only, not as a pass for every release gate.

Ask the maintainer for the undocumented CI configuration, public fixture locations, application run, test and release recipes, offline verification procedures and repository-specific expected outputs beyond the differential-check success message. Record the procedures and expected results before using their execution as release evidence.

> **Expected result:** Attach evidence to each gate, or retain an explicit **blocked (unverified)** status. Keep installation, test, scanning, reproduction and review statuses separate. Do not treat a list of release requirements as proof that they have passed.

## Reproducible builds, scanning and release gates

### Establish trust first

Bawa currently has no published maintainer signing key, no tags and no signed commits. The required signature-verification gate is blocked. Do not install dependencies under this gate until the maintainer provides a signed tag or commit for the intended revision, you authenticate the corresponding public signing key through a separate trusted channel and the signature check succeeds.

Do not treat a tag as verified without both trusted-key confirmation and a successful check of that tag’s signature.

### Fix and record the build inputs

Confirm the project-specific build requirements and exact commands with the maintainer. Agree which unsigned Android artefacts and web outputs to compare, then record the following before either builder starts:

- Source SHA and all applicable submodule SHAs.
- Dependency locks, dependency checksums and hashes of other build inputs.
- Toolchain and image identities, tool versions and architecture.
- Build flags and public configuration.
- Locale, timezone and timestamp policy.

Arrange for two independent builders to check out the same source SHA and recorded submodule SHAs in separate clean environments. Require each builder to verify the input hashes against the agreed record and build with the recorded inputs and settings, without sharing outputs.

### Reproduce Android release outputs

Record the wrapper properties, wrapper-JAR hash, `distributionSha256Sum`, dependency locks and fixed plug-in versions. Include the JDK identity and version, SDK platform and build-tools pins, and NDK and CMake pins.

Use only the checked-in `./gradlew` for Gradle invocations, and capture the output of `./gradlew --version`. Confirm the exact release-variant task names with the maintainer, and name them in the agreed build procedure and command record for each APK or AAB. Do not substitute assumed task names.

Compare the whole-file SHA-256 hashes of every agreed unsigned APK or AAB from the two independent builds.

> **Expected result:** Matching whole-file SHA-256 hashes from both builders for each agreed unsigned APK or AAB.

After a successful comparison, sign the artefacts in a protected step. Record the signing tool and version, certificate fingerprint, and SHA-256 hashes of both the unsigned and signed artefacts. Never record private keys.

Claim unsigned reproducibility only, unless independently produced signed outputs also match by whole-file SHA-256.

### Reproduce web outputs

For each independent web build, produce a manifest covering every output file. Record each file’s relative path and SHA-256 hash, and sort the manifest by relative path.

Compare the sorted manifests and the whole-archive SHA-256 hashes of corresponding output archives. Do not use matching file manifests as a substitute for comparing the archives.

Record signing as `none` where applicable.

> **Expected result:** Identical sorted relative-path/SHA-256 manifests and matching whole-archive SHA-256 hashes from both builders.

### Retain build and test evidence

Retain `ci-evidence.json`, logs and reports for both independent builds, and record their storage location. Keep the evidence attributable to each builder and include:

- Source SHA and workflow SHA.
- Run id and attempt, build id and runner image.
- Tool versions and input hashes.
- Artefact SHA-256 hashes and comparison results.
- Commands, exit codes and test results.
- Applicable signing records.

For each Android artefact, also record the variant, `applicationId`, `versionCode` and `versionName`.

Keep private keys out of `ci-evidence.json`, logs and reports.

### Complete the scanning checklist

Record the current scanning status explicitly: no scan has ever been recorded, and no tool is named yet. Confirm scanner configuration with the maintainer, because Bawa does not document an established configuration. Name dependency and secret scanners only after the maintainer has validated them.

Treat a lockfile as a record of the tested dependency graph, not as evidence of dependency safety.

- [ ] **Enable repository security features.** Ask a repository administrator to enable GitHub’s dependency graph, Dependabot alerts and Dependabot security updates. **Owner:** record the responsible administrator’s name. **Record:** retain the date enabled for each feature.

- [ ] **Validate and name both scanners.** Obtain maintainer validation before naming the dependency scanner and secret scanner. Confirm dependency inputs, tool setup, cadence and blocking criteria. **Owner:** record the maintainer responsible for validation. **Record:** retain the validated name and version of each scanner, together with the agreed configuration and criteria.

- [ ] **Run scans and retain reports.** Run applicable scans after dependency changes, on the agreed schedule and before release. **Owner:** agree and record a named scan owner with the maintainer. **Record:** retain tool versions, commands, exit codes and results. Retain redacted reports alongside `ci-evidence.json`, and record their storage location.

- [ ] **Review findings and updates.** Triage findings, review update pull requests rather than automatically merging them, and rerun tests. Use dependency review on pull requests where supported. **Owner:** agree and record a named review owner with the maintainer. **Record:** retain triage decisions, update reviews and test results with the scan evidence.

Record a missing scan as missing and an erroring scan as an error. Never interpret either as clean or passing. Keep the scanning gate **BLOCKED** until the required scans have retained evidence and meet the agreed blocking criteria.

### Confirm the SBOM workflow

Treat an SBOM as an inventory of components, not as certification of security. Confirm its scope, generation and publication with the maintainer, because Bawa does not document an SBOM workflow.

### Re-check external links

Re-check every external link before each release. Make requests sequentially, with delays between requests. Avoid checking five links at a time, which caused false 429 rate-limit responses in the 8 November 2026 audit.

Record the check date beside any link that blocks automated checks. Record any link section that cannot be re-checked as a finding, not as a footnote.

### Apply the release gates

Confirm missing release requirements and external-review acceptance criteria with the maintainer. Do not infer acceptance or a passing release from these instructions, because Bawa does not document external-review acceptance criteria or passing gate reports.

Keep every gate **BLOCKED** until its own evidence is recorded and its agreed criteria are met. Keep the relevant reproducibility gate **BLOCKED** if any required hash comparison is missing or differs.

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

For actual wallet generation, use an offline or trusted machine, not on an untrusted shell or CI runner. If the installation machine must remain offline, first confirm the dependency-transfer and verification process with the maintainer; Bawa does not document an offline installation procedure.

**Expected result:** Git and npm available, Node within `>=22 <23`, and Python at least `3.11` with virtual-environment support.

### 2. Clone the repository and verify the revision

```bash
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
```

Before installing dependencies, verify the exact commit or tag you intend to use. The clone command does not select a particular release, and a package version of `1.1.0` is not proof that a matching release tag exists or is trustworthy.

This check belongs **before** installation because `npm install` can execute package lifecycle scripts. You need to trust the checkout before allowing installation code to run.

Bawa does not document a revision-authentication procedure or trusted signing identity. Confirm the intended commit or tag, and how to authenticate it, with the maintainer before continuing.

**Expected result:** a checkout containing `package.json`, `requirements.txt` and `tools/hdwallet-gen/`, with its revision confirmed by the agreed verification method. A successful clone alone is not that verification.

### 3. Install the root Node dependencies

From the repository root:

```bash
npm install
```

**Expected result:** the root installation completing without an error. This is not yet evidence that the wallet tooling is ready.

### 4. Install the wallet-core tooling dependencies

Do not skip this second installation. The root `check` and `test` scripts delegate to `tools/hdwallet-gen`; success at the root does not, by itself, demonstrate that dependencies at that package boundary are installed.

The tooling package declares `@trustwallet/wallet-core` at version `4.9.3` (upgraded 2026-11-13, E02); the release pin is 4.9.3 (see Version pins above).

```bash
cd tools/hdwallet-gen
npm install
```

Only after that installation succeeds, return to the root:

```bash
cd ../..
```

**Expected result:** a successful installation in `tools/hdwallet-gen`, followed by your shell returning to the repository root. The directory change succeeding does not cancel an earlier npm failure.

#### If either npm installation fails

Stop before moving on to Python setup or repository checks.

- Confirm that Node satisfies `>=22 <23`.
- Confirm whether the failing command ran at the repository root or inside `tools/hdwallet-gen`.
- Record the failing command, package directory, OS, tool versions and sanitised error details. Use placeholders for sensitive fields and machine-specific paths; never send credentials or wallet material.
- Do not change dependency pins or force an installation merely to suppress the error.

Bawa does not document an npm failure-recovery procedure. Confirm the supported npm version, any platform prerequisites and the appropriate remedy for your selected revision with the maintainer before retrying.

**Expected result:** the previously failing installation completing successfully after its cause has been addressed. Until then, treat setup as incomplete.

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

**Expected result:** a `.venv` directory, successful activation, and `python` referring to the environment’s interpreter. Do not install the Python dependencies into the system interpreter by mistake.

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

**Expected result:** both pip commands completing without errors, with the pinned requirements installed in `.venv`.

### 7. Run the documented repository checks

From the repository root, with the virtual environment still active, run the pre-merge commands listed in `CONTRIBUTING.md`:

```bash
npm run check
npm test
python3 -m py_compile tools/make_wallet.py tools/decrypt_seed.py
python3 test/differential_test.py
```

The root npm commands forward to the tooling package. Its `check` script uses `node --check` on `generate.js`, `derive.js`, `derive_daemon.js` and `compare.js`; that is a syntax check, not a wallet-generation test. The Python compilation command likewise checks the two named scripts without establishing that recovery works.

**Expected result:** all four commands completing successfully. At the pinned commit e3b65fb832db287fdc8d54794980dd0b3456cc12 they do: `npm run check` exits 0 and `npm test` passes 28/28 (verified 2026-11-08; all nine CI steps replayed exit 0, D23). At the former pin 082f7915, `npm run check` failed on three files and `npm test` could not run. Bawa does not document a fixed success transcript; if the outcome is unclear, confirm the expected behaviour for your revision with the maintainer. Passing these checks does not certify the machine as safe for real wallet generation.

Keep recovery material out of the checkout and installation reports. `CONTRIBUTING.md` forbids committing `.env`, `secrets/`, `seed-backup/`, mnemonics, private keys, production xpubs/zpubs or real recovery material.

### Sources

- Bawa installation guidance and repository files: `package.json`, `tools/hdwallet-gen/package.json`, `requirements.txt` and `CONTRIBUTING.md`, https://github.com/Pr3eve6ti2o/bawa.git

## Dependency lockfile discipline

**The lockfile release gate is not yet met.** A search of this tree found no root `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` or `Pipfile.lock`. `tools/hdwallet-gen/package-lock.json` exists at e3b65fb832db287fdc8d54794980dd0b3456cc12 (Core 4.8.4 exact); no root lockfile and no Android-app lockfile are evidenced. A production lockfile still needs to be generated, reviewed, tested and committed.

A lockfile records the resolved dependency tree: exact package versions, including dependencies of dependencies, and integrity hashes. Version ranges in `package.json` alone can resolve differently on later installs. Without a lockfile, unchanged Bawa code can receive packages that were never part of the tested build.

CI in `.github/workflows/ci.yml` now runs `npm ci --ignore-scripts --no-audit --no-fund` in `tools/hdwallet-gen` (switched from `npm install` in the 2026-11-12 OI-075 repair); `tools/hdwallet-gen/package-lock.json` exists at e3b65fb832db287fdc8d54794980dd0b3456cc12.

### Generate, review and test

Bawa does not document a lockfile-specific validation procedure. Confirm the Node.js/npm versions and required checks with the maintainer before proceeding.

1. **Generate from a clean install.** Use a fresh checkout of the revision to be tested, with no existing `node_modules` in `tools/hdwallet-gen`. From the repository root, use CI’s current install options:

   ```sh
   cd tools/hdwallet-gen
   npm install --ignore-scripts --no-audit --no-fund
   ```

   **Expected result:** a new `tools/hdwallet-gen/package-lock.json`. If it does not appear, stop and confirm the npm configuration with the maintainer.

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

Keep Trust Wallet Core generation on a trusted interactive machine, with mnemonics and seeds retained there. Send only account-level public roots (xpub/zpub) or public addresses to online tracking services. Those services derive addresses from public roots and use RPC, node or indexer data for tracking and reconciliation. `derive.js` rejects private extended keys with exit status 2. `compare.js` has no such check and can accept a private extended key while returning incorrect output with exit status 0. Never supply private extended keys to online tools.

These checks are guidance for your own setup, not Bawa monitoring features. Bawa does not document freshness thresholds, payment-confirmation rules or recovery procedures. Confirm those with the maintainer.

### Personal, $0, no server

1. **Daily:** Manually check activity and confirmations for your wallet’s public addresses using an explorer or free RPC.  
   **Expected result:** a history you can account for, including no change when idle.

2. **Weekly:** Review the addresses you follow and cross-check a sample against a second source.  
   **Expected result:** matching history, allowing for differences in update timing.

### Personal automated tracker, $0, local

1. **Daily:** Follow the latest cron run through its free RPC or Esplora requests, SQLite records and local dashboard.  
   **Expected result:** a recent successful run and dashboard data consistent with SQLite.

2. **Weekly:** Review missed runs, endpoint limits, SQLite growth and backup status under your agreed recovery plan.  
   **Expected result:** explained gaps, sufficient disk space and verifiable backup records.

### Small application

1. **Daily:** Check public address derivation, backend RPC/indexer freshness, PostgreSQL reconciliation and the web UI together.  
   **Expected result:** consistent addresses and payment states, with delays accounted for.

2. **Weekly:** Review hosted-RPC usage, throttling and response times. Start with the free tier; let measured demand justify an upgrade.  
   **Expected result:** evidence supporting the current tier or a clear reason to change it.

### Serious application

1. **Daily:** Compare transaction states from the RPC provider, indexer API and your own nodes against the reconciliation database. Review alerts from your monitoring setup.  
   **Expected result:** agreement or discrepancies recorded for investigation.

2. **Weekly:** Review trusted-generator and signer isolation, access boundaries, recovery readiness and unresolved incidents. Keep monitoring separate from signing.  
   **Expected result:** public-only tracking services and clear responsibility for recovery and incident follow-up.

### Fully self-hosted

1. **Daily:** Check node synchronisation, self-hosted indexer lag and agreement with the tracking database.  
   **Expected result:** chain and payment data within agreed freshness tolerances, with discrepancies explained.

2. **Weekly:** Review storage growth, maintenance needs and recovery readiness against your privacy and independence goals.  
   **Expected result:** enough capacity and a continuing reason to carry the extra operational work.

### Sources

- Trust Wallet Core: https://github.com/trustwallet/wallet-core
- BIP 32, public derivation: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- Esplora API: https://github.com/Blockstream/esplora/blob/master/API.md

## Monitoring signals, alerts and investigating a missed payment

These checks belong to your monitoring setup, not Bawa monitoring features. Bawa does not document monitoring tools, thresholds or recovery commands; confirm tooling, timeout/retry limits, gap policy, finality rules and storage budgets with the maintainer.

Use Trust Wallet Core interactively on a trusted machine; keep mnemonic and seed material there. Only account-level public roots (`xpub`/`zpub`) or public addresses belong online. `derive.js` rejects private extended keys with exit status 2. `compare.js` has no such check and can accept a private extended key while returning incorrect output with exit status 0. Never supply private extended keys to online tools. `tools/hdwallet-gen/derive_daemon.js` performs repeated public derivation over JSON lines, not monitoring.

`compare.js` reads its `.env` path from `process.env.BAWA_ENV_FILE` first, with `NOVA_ENV` as a deprecated fallback. Check this setting and verify the selected `.env` file before running the tool: an inherited Nova Shop value in `NOVA_ENV` can silently redirect Bawa's env-file lookup.

Never log mnemonics, private keys, seed material, data keys, passwords or credentials. Use placeholders in diagnostic examples.

### Routine checks

1. **Feed health:** measure indexer lag against chain progress; count RPC errors, timeouts, retries and exhausted attempts.  
   **Expected result:** forward progress, recorded faults and bounded retries with back-off.

2. **Reconciliation:** store explicit chain/network identifiers and unprocessed chain records before normalising. Track reorgs, finality and duplicate or retried events. Preserve UTXO inputs and outputs; identify EVM tokens by contract address.  
   **Expected result:** traceable state changes, provisional/final status and no double crediting.

3. **Allocation:** check transactional index allocation, table consistency and coverage around the configured gap window.  
   **Expected result:** issued addresses linked to network, branch and index, within tracking coverage.

4. **Storage:** monitor free disk space for dependencies, tracking data and backups, plus backup completion.  
   **Expected result:** free space within agreed limits and completed backups.

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
   **Expected result:** the same public address.

2. **Allocation database:** inspect the saved allocation.  
   **Expected result:** a durable mapping without conflicts.

3. **Gap window:** check whether tracking reached that index.  
   **Expected result:** coverage, or an identified gap.

4. **Branch:** compare issued and tracked derivation branches.  
   **Expected result:** the issued branch being tracked.

5. **Indexer lag:** compare indexed progress with chain progress.  
   **Expected result:** catch-up or a measurable delay.

6. **RPC error:** inspect failures, timeouts and retry history.  
   **Expected result:** successful reads or a recorded fault.

7. **Reorg:** check canonical inclusion and finality.  
   **Expected result:** current status rather than stale inclusion.

8. **Token contract mismatch:** compare EVM contract addresses, not symbols.  
   **Expected result:** the expected contract.

9. **Network:** compare allocation, transaction and provider networks.  
   **Expected result:** matching chain/network identifiers.

Bawa does not document replay or gap-expansion procedures. Any recovery action needs confirmation from the maintainer before tracking is changed.

### Sources

- BIP 32, public derivation: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- BIP 44, branches and gap discovery: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki

## What to back up and how to rotate it

Back up the complete recovery set, not only the wallet’s working files. Bawa does not document backup file locations, export or encryption procedures, restore checks or retention counts. Confirm these with the maintainer before relying on your backups.

### 1. Keep a complete recovery set

Maintain all six items:

- **Mnemonic backup**, protected against unauthorised access.
- **Passphrase policy record**: whether a passphrase is required and how authorised recovery access is arranged. Record the policy, not the secret value.
- **Chain paths**, clearly labelled for their corresponding chains.
- **Chain-specific configuration**, including the settings needed for recovery.
- **Encrypted seed artefact**, which must pass a recovery test.
- **Separate encryption-key backup**, needed to read that artefact.

A policy record does not replace access to a required passphrase.

**Expected result:** An inventory covering all six items, with storage locations and access responsibilities but no secret values.

### 2. Keep secrets out of plain text and git

Do not store mnemonics, seeds, private keys, passphrases, passwords or encryption/data keys in plain-text backups. That includes secret-bearing configuration, notes, screenshots and logs.

Keep wallet recovery material out of git, including encrypted artefacts; a private repository is not a secret store. Store the encryption-key backup separately from the seed artefact, not bundled into the same backup set. Confirm the protection and storage arrangement with the maintainer.

**Expected result:** Protected recovery copies, a separately held key backup, and no recovery material in git.

### 3. Spread the copies across independent storage

Apply the 3-2-1 rule by spreading three protected copies across at least two types of storage. Three folders on one disk do not provide that separation.

Keep one copy away from the operating site. Keep it offline where possible: storage that remains connected is not an offline backup. Apply equivalent protection to the separately stored encryption-key backup.

**Expected result:** A copy register identifying the storage type, location and offline status of each copy.

### 4. Agree daily, weekly and monthly retention

Use daily generations for recent history. Retain a selected daily generation each week after ordinary daily copies expire, then preserve a selected weekly generation each month for longer retention.

Agree how many generations to keep in each tier with the maintainer and record the limits. Do not assume Bawa performs this rotation automatically.

Update affected backups whenever recovery material changes. Remove expired copies only once their replacement has been tested. Keep any encryption key still required by a retained generation, and assign responsibility for refreshing the off-site copy.

**Expected result:** A written daily, weekly and monthly schedule, with retention limits, verification records and an off-site update owner.

### 5. Prove recovery before funding

Use the maintainer-confirmed recovery procedure to test the encrypted artefact, the separate key backup and the complete recovery set. A saved file alone does not demonstrate recoverability.

Complete the recovery drill before funding the wallet. Keep its record free of secret material.

**Expected result:** A dated, successful recovery-drill record against the agreed checks.

A compromised seed requires a new wallet, not a restored backup. See **Incident response** for that case.

### Sources

- CISA, *Data Backup Options*: https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf (checked 8 November 2026; the site returns HTTP 403 to automated checks)
- NCSC, *Backing up your data*: https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security

## Restore drills and what changes the recovery picture

Keep funding on hold until the encrypted backup has passed a restore check. Repeat after every backup change and regularly between changes.

1. **Confirm the supported route.** The command syntax and output behaviour of `tools/decrypt_seed.py` are documented in docs/08 §3, including the invocation `python3 tools/decrypt_seed.py /path/to/seed.enc.json`. The full restore sequence and drill frequency remain undocumented. Confirm these with the maintainer, together with suitable public fixtures and controlled-environment requirements. If those details cannot be confirmed, stop rather than improvise.  
   **Expected result:** agreed instructions and known public reference checks.

2. **Practise without funds.** Only run `tools/decrypt_seed.py` under the agreed isolated, offline conditions. Practise with `<PUBLIC_FIXTURE>` and its public test inputs in a fresh `<SCRATCH_DIRECTORY>`, away from live wallet files and synchronised storage. Use no real funds. Keep decrypted material out of logs, screenshots and support messages.  
   **Expected result:** the fixture matches the agreed reference checks, with no live data changed.

3. **Test the backup itself.** A fixture pass does not validate your wallet backup. Under the same controlled conditions, use the confirmed recovery method to restore a copy of `<ENCRYPTED_BACKUP>` from its intended storage into a fresh scratch location. Preserve the original. Verify the restored wallet using the public identity check agreed with the maintainer; do not use a funds transfer as the test.  
   **Expected result:** the expected public identity matches; successful decryption alone is insufficient.

4. **If anything fails, stop.** A missing file, decryption error or verification mismatch means the drill has not passed. Pause new funding, preserve existing copies and keep any working wallet intact. Ask the maintainer to investigate using non-secret diagnostics only. Test another independent copy if available, then repeat the complete drill after any correction. Bawa does not document repair steps; confirm them rather than guessing.  
   **Expected result:** recovery recorded as unverified until a complete repeat passes.

5. **Close and schedule.** Record the backup revision, date and outcome without secrets. Follow the confirmed cleanup method for scratch data. Set the next drill date; repeat sooner whenever the backup, its encryption or its storage changes.  
   **Expected result:** a dated result for the current backup, completed cleanup and a scheduled retest.

### What changes the recovery picture?

- **Backup failure:** that copy offers no demonstrated recovery. An independent copy may still work, but must pass its own drill. Bawa does not document replacement from a working wallet; confirm whether and how that route is supported.
- **Media loss:** recovery now depends on an accessible, tested independent copy or another supported route. Two copies on the missing device do not help. Confirm any alternative route with the maintainer.
- **Lost passphrase:** if decryption requires the missing passphrase, extra copies do not solve the problem. Bawa does not document a bypass; confirm whether an independent recovery route exists with the maintainer. Without one, recovery may be impossible.

For suspected or confirmed seed compromise, see **Incident response**. A backup is not a substitute for a new wallet.

**Sources**
- https://www.lifetimecloud.me/blog/backup-3-2-1-strategy.html
- https://zeonedge.com/blog/backup-strategy-self-hosted-applications-2026-automated-encrypted

## Secret scanning as a routine, and triaging a finding

Secret scanning belongs in everyday development as well as release preparation.

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

- GitHub, https://docs.github.com/en/code-security/reference/security-incident-response/investigation-areas
- CI/CD security tools, https://dev.to/vulert_official/cicd-security-tools-the-complete-guide-for-engineering-teams-5283
- DevSecOps roadmap, https://0x70ssam.github.io/devsecops/cloud-native/DevSecOps-Roadmap-2026-Comprehensive-Guide-From-Foundations-to-Expert/

## Dependency scanning, SBOM and the release-gate checklist

### Verify the tag or commit signature

Bawa currently has no published maintainer signing key, no tags and no signed commits. The required signature-verification gate is blocked. Do not install dependencies under this gate until the maintainer provides a signed tag or commit for the intended revision, you authenticate the corresponding public signing key through a separate trusted channel and the signature check succeeds.

For the intended tag:

```sh
git verify-tag <INTENDED_TAG>
```

Or, for the intended commit:

```sh
git verify-commit <INTENDED_COMMIT>
```

Do not treat a tag as verified without both trusted-key confirmation and a successful check of that tag’s signature.

### Make dependency scanning routine

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
| Committed lockfile | Lockfile committed at release revision | PARTIAL: `tools/hdwallet-gen/package-lock.json` committed at e3b65fb832db287fdc8d54794980dd0b3456cc12 (2026-11-08); no root lockfile. |
| Version ranges | Recorded range review | BLOCKED, review unconfirmed. |
| Clean-machine CI | Passing logs for release revision | PASS — GitHub Actions run 28 at `e3b65fb832db287fdc8d54794980dd0b3456cc12`: completed/success, 2026-11-08 11:36 UTC (D09). |
| Official BIP-32/BIP-39 vectors | Full published-vector coverage and passing results | BLOCKED, coverage/results missing. |
| Independent differential testing | Recorded successful `test/differential_test.py` run | PASS — operator run 2026-11-09, exit 0; D23 replayed all nine CI steps with exit 0. |
| Chain-specific fixtures | Per-chain fixtures and passing results | BLOCKED, no report. |
| Secret scanning | Enabled checks, configuration and triaged report | BLOCKED, configuration/results undocumented. |
| Dependency scanning | Enabled checks, configuration and triaged report | BLOCKED, configuration/results undocumented. |
| Reproducible artefacts | Documented rebuild method and matching tagged-revision outputs | BLOCKED, method/results undocumented. |
| External security review | Accepted review against agreed criteria | BLOCKED, criteria/report undocumented. |
| Negative tests | Failure-case coverage and passing results | BLOCKED, no report. |
| Integration tests | Recorded integration run | BLOCKED, no report. |
| Recovery drill | Recorded recovery exercise | BLOCKED, no report. |
| Artefacts/checksums | Recorded release artefacts and checksum evidence | BLOCKED, checksum files absent. |
| Security policy | Confirmed publication | BLOCKED, publication unconfirmed. |

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
## Incident response playbook

OI-065 — Operational/security ownership and a vulnerability-disclosure procedure are not established by the supplied evidence. Obtain maintainer-approved responsibilities, a reporting channel, and handling/escalation instructions, and publish them here. No reporting channel or response commitment is claimed meanwhile. Owner: W2 (documentation closure).

The guides give no incident-response playbook today beyond this section. Use the playbook created here in docs/10 for the operations-side response, and cross-reference [docs/15](docs/15-threat-model-and-theft-prevention/README.md) for the holder-side playbook. Do not treat these instructions as evidence that any incident has been rehearsed or any response tested.

Follow each scenario in order: contain first, choose trusted-device recovery or fresh-seed migration, revoke approvals and sessions, then escalate and review before resuming. Preserve devices and incident records throughout.

> **Warning:** Changing the vault password cannot secure an exposed phrase. A compromised seed is not a password you can reset; only a fresh seed and migration can secure your holdings. Generate a new wallet with a fresh seed on a fresh trusted device, move every asset and token into it, and retire the old wallet permanently. Check that every asset and token has moved before treating migration as complete.

> **Warning:** Reusing suspect software or disclosing your seed during recovery can expose signing secrets. Use a separate, trusted device, not another browser profile on the suspect machine, without carrying over the suspect installation, dependencies or `.env`. Keep your seed out of recovery websites and reject anyone claiming to be support who asks for it. Authorise transfers without returning to the suspect device or following unsolicited recovery links. Check that recovery and transfers use the clean environment without disclosing signing secrets.

### Lost or stolen device

1. **Contain.** Stop signing transactions and interacting with any suspected service. Stop using the affected device if you still have access to it. Keep devices and incident records intact rather than wiping devices or deleting records.

2. **Move to a clean device.** Use a separate, trusted device for recovery and apply the clean-environment requirements above.

3. **Create a new wallet with a new seed.** Choose trusted-device recovery of the existing wallet only while there is no reason to suspect signing-secret exposure. If exposure is suspected or established, generate a replacement wallet with a fresh seed instead.

4. **Move assets.** For migration, move every asset and token to the replacement wallet, prioritising the highest-value liquid assets and continuing with other holdings as they can safely be moved. Retire the old wallet permanently.

5. **Revoke approvals.** Remove suspicious permissions from the clean environment using a trusted interface.

6. **Rotate related access.** Confirm session-revocation support with the relevant account or service issuers, revoke affected sessions where supported, and record any unsupported or unverified revocation. Replace exposed account credentials and service keys through their issuers.

7. **Preserve evidence.** Retain relevant logs and incident records separately from the clean installation. Escalate unresolved account or session exposure through the relevant issuers. Prepare a redacted record of maintainer-dependent questions under the escalation requirements below.

8. **Review before resuming.** Establish what the device loss exposed and close the original access path. Keep any wallet with exposed signing secrets permanently retired, and leave unresolved recovery or revocation checks open.

> **Expected result:** Confirm either trusted-device recovery with no reason to suspect signing-secret exposure, or complete fresh-seed migration with the old wallet permanently retired. Resolve affected account and session access before recording a recovery pass.

### Suspected vault compromise

1. **Contain.** Stop signing transactions, using the suspect device and interacting with the suspected service. For a leaked data key or `.env`, stop affected services and treat every secret in a leaked file as exposed. For a suspected malicious dependency, treat secrets accessible to that code as potentially exposed. Stop installing, building or running the affected software, isolate the device, and take the migration route if signing secrets could have been read. Keep devices and incident records intact.

2. **Move to a clean device.** Use a separate, trusted device without the suspect installation, dependencies or `.env`.

3. **Create a new wallet with a new seed.** Choose trusted-device recovery of the existing wallet only after establishing that there is no reason to suspect signing-secret exposure. Otherwise, generate a replacement wallet with a fresh seed. Apply the fresh-seed migration requirement rather than relying on a vault-password change.

4. **Move assets.** For migration, move every asset and token to the replacement wallet, prioritising the highest-value liquid assets before continuing with other holdings that can safely be moved. Retire the old wallet permanently.

5. **Revoke approvals.** Remove suspicious permissions from the clean environment using a trusted interface. Keep approval revocation separate from the migration required for signing-secret exposure.

6. **Rotate related access.** Deleting a leaked `.env` does not invalidate its contents. Confirm supported session-revocation methods with the relevant issuers, revoke affected sessions where supported, and replace exposed account credentials and service keys through their issuers. Verify the results or carry the unresolved access into escalation.

7. **Preserve evidence.** Retain relevant logs, dependency versions and lockfiles without running suspect code again. Keep incident material separate from the clean installation. Escalate affected account or service access through its issuer, and record maintainer-dependent data-key or dependency questions under the requirements below.

8. **Review before resuming.** Apply the leaked-data-key and malicious-dependency acceptance requirements below where relevant. Keep recovery open until required expectations have been agreed and met. Obtain the required dependency confirmations before running Bawa again.

> **Expected result:** Establish the scope of exposure, complete the appropriate recovery or migration route, and verify affected approval, session and credential changes. Keep any data-key recovery or dependency clean-state question unresolved until the required maintainer confirmations and acceptance checks are satisfied.

### Disclosed phrase

1. **Contain.** Stop signing transactions, interacting with the suspected service and using the affected device. Keep devices and incident records intact. Treat the wallet as requiring permanent retirement.

2. **Move to a clean device.** Use a separate, trusted device for replacement-wallet creation and migration.

3. **Create a new wallet with a new seed.** Restoring the disclosed phrase, even on a trusted device, recreates the compromised wallet rather than repairing it. Generate a replacement wallet with a fresh seed and use fresh-seed migration as the recovery route. Check that the replacement does not reuse the disclosed phrase.

4. **Move assets.** Move every asset and token into the replacement wallet. Prioritise the highest-value liquid assets, then continue with other holdings that can safely be moved. Retire the old wallet permanently.

5. **Revoke approvals.** Approval revocation restricts a spender’s permission but cannot protect a wallet whose signing key is already known. Remove suspicious permissions from the clean environment using a trusted interface, and complete fresh-seed migration as the recovery action.

6. **Rotate related access.** Confirm session-revocation support with the relevant account or service issuers, revoke affected sessions where supported, and record any unsupported or unverified revocation. Replace exposed account credentials and service keys through their issuers.

7. **Preserve evidence.** Save relevant phishing communications, transaction hashes, recipient addresses and logs. Escalate related account or service exposure through its issuer. Prepare a secret-redacted record for maintainer-dependent escalation under the requirements below.

8. **Review before resuming.** Account for every asset and token in the replacement wallet and close the original exposure path. Keep the old wallet permanently retired rather than resuming ordinary use after a password change or restoration.

> **Expected result:** Confirm that every asset and token has moved to a wallet generated from a fresh seed on a fresh trusted device. Keep the disclosed-seed wallet permanently retired and resolve affected related access.

### Suspected malicious transaction

1. **Contain.** Stop signing transactions and interacting with the suspected service. For a suspicious approval, stop using the dApp. Keep devices and incident records intact. A missing tracker entry alone establishes neither theft nor transaction failure. Withhold any repeat payment based merely on the missing entry, and independently check the transaction’s status on the intended chain.

2. **Move to a clean device.** Use a separate, trusted device to assess the incident and perform recovery or permission changes.

3. **Create a new wallet with a new seed.** Choose trusted-device recovery of the existing wallet only while there is no reason to suspect signing-secret exposure. A genuinely approval-only incident does not automatically require wallet replacement. If signing secrets were exposed, or malicious code could have read them, generate a replacement wallet with a fresh seed and take the migration route.

4. **Move assets.** For the migration route, move every asset and token to the replacement wallet, prioritising the highest-value liquid assets before continuing with other holdings that can safely be moved. Retire the old wallet permanently.

5. **Revoke approvals.** Remove suspicious permissions from the clean environment using a trusted interface. For an incident established as approval-only, make this the principal containment action once the scope is known.

6. **Rotate related access.** Confirm session-revocation support with the relevant account or service issuers, revoke affected sessions where supported, and record any unsupported or unverified revocation. Replace exposed account credentials and service keys through their issuers.

7. **Preserve evidence.** Save transaction hashes, recipient addresses, phishing communications and relevant logs. Escalate affected account or service access through its issuer. Record any maintainer-dependent transaction-reconciliation or dependency questions under the requirements below.

8. **Review before resuming.** Establish whether the incident involved suspicious permission, signing-secret exposure or a tracker fault, and close the original access path. Apply the missed-payment or malicious-dependency acceptance requirements below where relevant.

> **Expected result:** Confirm removal of suspicious permissions for an approval-only incident, or complete fresh-seed migration and permanent retirement for signing-secret exposure. For a tracker fault, confirm transaction status independently and keep recovery open until the required reconciliation expectations are agreed and met.

### Escalation and acceptance requirements

Keep maintainer-dependent escalation pending while no vulnerability-disclosure procedure, contact or channel exists. Retain the redacted incident record and track the required maintainer decisions alongside the maintainer-owned disclosure open item. Do not treat an assumed private disclosure path as available. Use the relevant issuers for affected account and service access, and confirm session-revocation support and results rather than assuming a Bawa-specific revocation procedure.

> **Warning:** Sharing incident records containing secrets can extend the exposure. Keep incident material separate from the clean installation and redact secrets from anything shared with a maintainer. Never send a seed, private key, data key or unredacted `.env`. Check each item for secrets before sharing it.

Apply these additional operational acceptance requirements where relevant:

- **Leaked data key:** Bawa does not document an exact recovery response. Require maintainer confirmation of what the key controls, whether and how replacement is supported, what happens to existing data, and which result demonstrates recovery. Keep those questions open until confirmation is available, and record no pass until the expectations are agreed and met.
- **Missed payment:** Bawa does not document an exact missed-payment recovery response. Independently check transaction status on the intended chain. Require maintainer confirmation of safe reconciliation, duplicate-prevention behaviour and the expected tracker record before treating recovery as a pass.
- **Malicious dependency:** Bawa does not document a definitive clean-state check or expected recovery output. Require maintainer confirmation of trusted dependency versions, restoration steps and acceptance checks before running Bawa again.

> **Warning:** A quiet dashboard or an error-free restart is not proof of recovery. Establish what was exposed, close the original access path and keep every wallet with exposed signing secrets permanently retired. Check the applicable expected results and agreed acceptance requirements before recording a recovery pass or resuming ordinary use.

### Sources

- https://tokentoolhub.com/wallet-safety-101/
- https://taoflow.network/blog/crypto-incident-response-playbook-first-60-minutes-after-wallet-compromise
- https://oyarr.com/safety/incident-response.html

