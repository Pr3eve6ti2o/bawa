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

## 04 Generation — one trusted, offline session

Do not place real seed words, xprv/zprv material or encryption keys into logs, chat, source control, screenshots or CI.

---

Use this as a generation checklist, not a complete setup guide. Confirm the machine setup before starting.

### 1. Prepare the machine

Use a trusted, offline machine with an interactive `/dev/tty`.

Bawa does not document the repository URL or revision, prerequisite versions, Node dependency and lockfile procedure, or Python setup. Confirm these with the maintainers before running generation; do not guess.

**You should see:** an offline session with a usable controlling terminal. Bawa does not document readiness commands or their expected output; ask the maintainers how to verify the setup.

### 2. Establish the launch procedure

`tools/make_wallet.py` defines the launch procedure, handles filesystem and environment work, and checks that the generator keeps seed material out of standard output. It runs `node tools/hdwallet-gen/generate.js`, which performs generation.

From the repository root, run:

```sh
python3 tools/make_wallet.py
```

Generation refuses to continue if a wallet already exists unless you use `--force` or `--regenerate`. Use either flag only after verifying a backup of the existing wallet.

**You should see:** generation proceed for a new wallet, or a refusal if a wallet already exists and neither replacement flag was used. The successful completion check is in step 6.

### 3. Start and check the ordering

Once the machine is ready, the generator follows this sequence:

```text
open controlling terminal
↓
initialise Trust Wallet Core
↓
deterministic checks
↓
fresh 256-bit BIP-39 wallet; empty passphrase
```

```text
public exports
↓
public derivation/address round trips
↓
AES-256-GCM encryption
↓
terminal-only mnemonic + separate data key
↓
operator confirmations
↓
atomic encrypted recovery write (0600)
```

**You should see:** no seed material in the generator's standard output. `tools/make_wallet.py` checks this and verifies that the generator's self-checks pass. Bawa does not document exact start-up or check-success messages. Use the completion check in step 6; silence is not proof that the checks passed.

### 4. Verify what is exported

| Chain | Documented public export |
|---|---|
| BTC / ETH / TRON | Public roots |
| TON | Configured address |

A TON public-root export is not documented. Public derivation/address round trips follow the exports.

`tools/make_wallet.py` writes the generator's four public values to the environment file using these names:

- `XPUB_BTC`: `btc_zpub`
- `XPUB_ETH`: `eth_xpub`
- `XPUB_TRX`: `trx_xpub`
- `TON_DEPOSIT_ADDRESS`: `ton_address`

**You should see:** BTC, ETH and TRON public roots, plus the TON configured address, in the launcher's completion report and the public environment file. Bawa does not document the full display and serialisation formats, derivation paths or individual round-trip success diagnostics. Ask the maintainers before relying on those details.

### 5. Record recovery data before confirming

The mnemonic is encrypted with **AES-256-GCM**. Record the mnemonic and **separate data key** privately from the controlling terminal. The BIP-39 passphrase is **empty**; the data key is a separate recovery key, not that passphrase.

`tools/hdwallet-gen/generate.js` shows the mnemonic and data key only on `/dev/tty` and requires two confirmations:

1. Type the first word of the seed phrase.
2. Type `SAVED` to confirm that you have stored the data key.

If either confirmation fails, `seed.enc.json` is not written.

**You should see:** the mnemonic and data key only on the controlling terminal, with the two confirmations above. Neither belongs in standard output or logs.

### 6. Confirm, then inspect the write

Files are written only after the confirmations succeed. The generator writes the encrypted recovery artefact, `seed.enc.json`, atomically with mode **`0600`**. `tools/make_wallet.py` verifies the artefact.

The filesystem and environment rules in `tools/make_wallet.py` define these locations. In the default paths below, `repo` means the repository root.

- **Secrets directory:** `NOVA_SECRETS_DIR`, or `repo/secrets` by default, with mode **`0700`**. Symlinked paths are refused. This directory holds `seed.enc.json`.
- **Backup directory:** `BAWA_BACKUP_DIR`, or `repo/seed-backup` by default, with mode **`0700`**. It contains a **`0600`** copy of `seed.enc.json`, plus `decrypt_seed.py` and `docs/RECOVERY.md`.
- **Public environment file:** `BAWA_ENV_FILE`, or `repo/.env` by default. It is written atomically with mode **`0600`** and contains only `XPUB_BTC`, `XPUB_ETH`, `XPUB_TRX` and `TON_DEPOSIT_ADDRESS`.

**You should see:** `Wallet generation and public configuration update completed.`, together with the four public values, the encrypted artefact path and its `0600` mode, and the backup bundle path. Check that the files, contents and permissions match the rules above.

Bawa does not document the artefact schema or file-inspection commands. Ask the maintainers for inspection guidance rather than guessing.

For recovery, use `tools/decrypt_seed.py` as described in the recovery document, `docs/RECOVERY.md`. Generation checks and backup-copy integrity do not prove successful decryption or recovery. Test a restore separately before funding.

> Only verified public material belongs online. Never put mnemonic, private keys, data keys or recovery files in source control, issues, chat, CI logs or test fixtures.

---
## Backup acceptance and failed runs

Documented flow on the trusted, offline machine — these are stages, not commands:

```text
Open controlling /dev/tty
  → initialise Wallet Core
  → deterministic checks
  → fresh 256-bit BIP-39 wallet; empty passphrase
  → BTC/ETH/TRON public roots + configured TON address
  → public derivation/address round trips
```

```text
Encrypt mnemonic with AES-256-GCM
  → show mnemonic + separate data key on terminal only
  → operator confirmations
  → encrypted recovery artefact: atomic write, mode 0600
```

TON is an address export here, not a fourth public root. The public round trips check generation and export; they do not test backup restoration.

If a stage fails, stop before confirming. Keep recovery material offline and do not redirect secrets into logs.

### Backup checks

`tools/make_wallet.py` defines the backup layout. The backup directory is set by `BAWA_BACKUP_DIR`, or defaults to `repo/seed-backup`. It has mode `0700` and contains a copy of `seed.enc.json` with mode `0600`, plus `decrypt_seed.py` and `docs/RECOVERY.md`. The orchestrator checks that the encrypted artefact has mode `0600` and that its bytes match the backup copy.

Bawa does not document the encrypted file schema or a launch command; consult the generator and orchestrator code before relying on those details. The manual recording and storage steps below are operator recommendations, not additional Bawa features.

1. **Record and compare before confirming.** Record the terminal-displayed mnemonic and separate data key, and note that the BIP-39 passphrase is empty. The data key is not that passphrase.

   **You should see:** your records agree with the controlling-terminal display. If they do not match, stop before confirming. Bawa does not document the exact confirmation wording, so read the terminal instructions before responding.

2. **Back up the actual artefact, not a guessed filename.** Confirm the original location of `seed.enc.json` from the generator and orchestrator code. Once the write has completed, keep a protected offline copy and check it against the original. Storing the data key separately from the encrypted backup is an operator storage recommendation.

   **You should see:** the original has mode `0600`, and the backup’s bytes match it. Confirmation alone does not prove that the later write succeeded. Bawa does not document manual copy, permission-check or comparison commands; consult your operating system’s documentation if you perform these operations yourself.

3. **Keep recovery material out of online and development channels.** This includes mnemonics, private keys, data keys and recovery files: no source control, issues, chat, CI logs or test fixtures.

   **You should see:** none of that material in those destinations. Terminal-only display is not permission to paste it elsewhere.

### What “verified” can mean here

| Evidence | What it establishes |
|---|---|
| Deterministic checks and public round trips | The documented generation/export checks completed. |
| Encrypted artefact written with `0600` | The documented disk-write condition was met; not a restore result. |
| Backup matches the original | Copy integrity, not successful decryption or recovery. |
| Recovery from the saved copy | A successful, separate restore test with `decrypt_seed.py` establishes recovery from that copy. |

The backup requirements for `tools/make_wallet.py` require a separate restore test with `decrypt_seed.py` before funding. Generation, permission and copy checks alone do not prove recovery.

Bawa does not document an exact decryption invocation, a step-by-step restore test or its acceptance output. Read `docs/RECOVERY.md` and `tools/decrypt_seed.py` to establish how to run the test and check its result on the trusted, offline machine. Do not guess a command or report restore success from generation or copy checks alone.
### If a stage fails

Stop before confirming, keep recovery material offline and do not redirect secrets into logs. The actions below are maintainer guidance; they do not imply that Bawa automatically aborts or rolls back a failed stage.

| Failure | Response and resumption check |
|---|---|
| Terminal unavailable or records do not match | Stop before confirming; do not redirect secrets into logs. **You should see:** the mnemonic and data key on the controlling terminal, with matching records, before proceeding. |
| Deterministic or public check fails | Hold public release. **You should see:** those checks complete before proceeding. Bawa does not document exact diagnostics or exit codes; investigate the failed check with a maintainer before resuming. |
| Write fails, is interrupted, or permissions differ | Keep completion unverified and retain recovery material offline. **You should see:** the identified encrypted artefact at `0600` before further verification; file presence alone is not recovery proof. |
| Recovery fails or its procedure is unavailable | Keep recovery marked unverified. Bawa’s `tools/make_wallet.py` places `decrypt_seed.py` and `docs/RECOVERY.md` in the backup directory. Use them to test a restore separately before funding; if you cannot access them, ask a maintainer before proceeding. **You should see:** no claimed restore success based only on generation or copy checks. |

**Crash handling, clean-up and retry safety:** Bawa does not document what remains after a crash, clean-up behaviour, or whether retries and overwrites are safe. Check the implementation or ask a maintainer before retrying or overwriting existing files. Atomic writing does not specify a recovery or rollback procedure.
