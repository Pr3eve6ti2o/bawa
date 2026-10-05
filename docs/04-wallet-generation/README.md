# Wallet Generation

Use this file for the one-time trusted operation: generate the root material, record recovery data, verify the result, and only then move public material online.

# Bawa's implementation: exactly what it does

The current Bawa reference implementation is deliberately narrower than the entire guidebook.

## `tools/hdwallet-gen/generate.js`

One-time wallet generation.

It:

1. opens the controlling terminal first;
2. initializes Trust Wallet Core;
3. runs deterministic checks before generating a fresh wallet;
4. creates a 256-bit BIP-39 wallet with an empty passphrase;
5. exports BTC/ETH/TRON public roots plus the configured TON address;
6. performs public derivation/address round trips;
7. encrypts the mnemonic with AES-256-GCM;
8. shows the mnemonic and separate data key only on the terminal;9. waits for operator confirmations;
10. writes the encrypted recovery artifact with restrictive permissions.

## `tools/make_wallet.py`

Orchestration layer.

It handles the surrounding filesystem/environment work and protects the public-output boundary.

## `tools/hdwallet-gen/derive.js`

One-shot watch-only derivation.

Input:

```text
xpub over stdin
chain + index as arguments
```

Output:

```text
one derived address
```

The xpub is deliberately not supplied in argv.

## `tools/hdwallet-gen/derive_daemon.js`

Persistent watch-only derivation service using newline-delimited JSON.

It loads Wallet Core once and reuses it rather than spawning a fresh Node/WASM process for every address.

## `tools/hdwallet-gen/compare.js`

Diagnostic tool for comparing the derived addresses against the parent application's expectations.

## `tools/decrypt_seed.py`

Recovery utility for the application-specific encrypted seed artifact.

## `test/smoke.test.js`

Repository-level invariant checks. These are deliberately not presented as proof of cryptographic correctness. Full vector and cross-implementation testing is still part of professional release work.

---

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

# Generating the wallet safely

Run generation only on a trusted machine.

```bash
python3 tools/make_wallet.py
```

The generator is intentionally interactive.

The process should refuse to continue when there is no controlling terminal.

That is not a convenience bug. It is part of the security boundary.

The high-level flow is:

```text
terminal check
     ↓
wallet-core self-checks
     ↓
256-bit wallet creation
     ↓
mnemonic validation
     ↓
public-root export
     ↓
public address cross-check
     ↓
AES-GCM encryption in-process
     ↓
operator confirms backup
     ↓
atomic encrypted-file write
     ↓
public material saved for runtime
```

### What you must record

The recovery information is:

1. the mnemonic;
2. the BIP-39 passphrase policy, if one is used;
3. the exact derivation path/policy for each chain;
4. any chain-specific wallet configuration needed for recovery;
5. the encrypted artifact and its separately stored key, if you are using that recovery method.

An xpub is **not** a wallet backup.

It is a watch-only capability.

---

# What gets written to disk

The reference implementation uses a small application-specific encrypted artifact, conceptually:

```json
{
  "alg": "AES-256-GCM",
  "kdf": "none - random 256-bit data key",
  "nonce_b64": "...",
  "ciphertext_b64": "..."
}
```

The actual plaintext mnemonic is not intended to be written to disk.

The random data-encryption key is deliberately stored separately.

### Important limitation

This is **application-specific encryption at rest**, not a universal replacement for a proper wallet backup standard.

Recovery interoperability still depends on knowing:

```text
mnemonic
+ passphrase policy
+ derivation paths
+ chain-specific wallet configuration
```

For TON, that last part is especially important.

---

## First-run checklist

```
trusted machine
verified source revision
reviewed dependency graph
deterministic tests pass
mnemonic recorded offline
passphrase policy recorded
exact chain/path policy recorded
independent address verification
clean-machine recovery drill
only public/watch-only material moves online
```

Do not place real seed words, xprv/zprv material or encryption keys into logs, chat, source control, screenshots or CI.