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
