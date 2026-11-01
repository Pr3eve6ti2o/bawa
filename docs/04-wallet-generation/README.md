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

## Installing Bawa from scratch

Fetch dependencies online if needed, but run wallet generation only on an offline or trusted machine—never on a random online shell or CI runner.

### 1. Check your runtimes first

```bash
node --version
python3 --version
```

Node must satisfy `>=22 <23`, as declared in `tools/hdwallet-gen/package.json`. Python must be 3.11 or later. **Stop if Node is outside that range.** Fix any missing or unsupported runtime before continuing.

**You should see:** Node 22 and Python 3.11 or later.

### 2. Clone and verify the revision

```bash
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
git rev-parse HEAD
```

Compare the full commit ID with the expected commit obtained through a trusted release channel. For a signed commit, also run `git verify-commit HEAD` using a maintainer key you already trust. Printing an ID is not verification: if you cannot establish the revision’s provenance, stop before installing dependencies.

**You should see:** a commit ID matching your trusted reference, with a valid signature where applicable.

### 3. Install the Node dependencies

From the repository root:

```bash
npm install
cd tools/hdwallet-gen
npm install
cd ../..
npm --prefix tools/hdwallet-gen ls @trustwallet/wallet-core
```

The required Wallet Core version is **4.8.4**. Do not accept a different version or work around an engine mismatch. For background on HD derivation, see the [Wallet Core HD wallet implementation](https://deepwiki.com/trustwallet/wallet-core/4.1-hd-wallet-implementation).

**You should see:** both installs completing successfully, with `@trustwallet/wallet-core@4.8.4` in the dependency listing. Your shell should be back at the repository root.

### 4. Set up Python separately

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip show cryptography bip-utils
```

Keep the repository’s `requirements.txt` pins: `cryptography==50.0.2` and `bip-utils==2.12.2`. Use the activated environment for the remaining Python commands.

**You should see:** `cryptography` version 50.0.2 and `bip-utils` version 2.12.2, installed under `.venv`.

### 5. Run the public reference check

Run this on your offline or trusted machine, using only the public test data—not a real wallet’s secrets.

A scratch test in a disposable directory, since deleted, passed with Node v24.22.1 and Python 3.12.3. Python met the requirement; Node did not. That pass does **not** validate a supported installation, so repeat the check with Node 22.

```bash
python test/differential_test.py
echo $?
```

**You should see:** these reference results, followed by exit status `0` from `echo`:

```text
bip_utils reference checks: PASS
BTC m/84'/0'/0'/0/0: bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd
ETH m/44'/60'/0'/0/0: 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7
0
```

### 6. Record the dependency graph

Commit the lockfile from this clean install, including the tool’s lockfile if it is separate. This records the exact dependency graph. Do not call anything production-ready before that record is committed, and keep wallet secrets out of version control.

**You should see:** the clean-install lockfile recorded in repository history, with no pending lockfile changes.

## Launch wallet generation

Run generation only on a trusted machine. If a wallet already exists, the generator refuses to replace it unless you use `--force` or `--regenerate`. Use either flag **only after verifying a backup of the existing wallet**—not as a shortcut past an unexpected refusal.

1. **Start from an interactive terminal.**

   ```sh
   python3 tools/make_wallet.py
   ```

   The first check is for a controlling terminal. The generator is intentionally interactive and must refuse to continue without one. That refusal is a security boundary, not a bug; don’t work around it.

   **You should see:** The terminal check pass, allowing the run to continue. Without a controlling terminal, it must stop here.

2. **Let the wallet-core self-checks finish.**

   The deterministic checks include `coin_tron_195`, `coin_ton_607`, and these published fixtures:

   - BTC: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
   - ETH: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`

   They also include `zpub`/`xpub` prefix and round-trip checks for BTC, ETH and TRON. The addresses above are test fixtures, not addresses for your new wallet.

   **You should see:** The self-checks pass before wallet creation begins.

3. **Allow wallet creation and mnemonic validation.**

   `generate.js` creates a 256-bit BIP-39 wallet with an empty passphrase. Mnemonic validation follows creation and must finish before public-root export. Keep the mnemonic private.

   **You should see:** Successful wallet creation followed by successful mnemonic validation.

4. **Let the public-material checks run.**

   Public roots are exported next. The generator then cross-checks the public addresses before moving on to encryption.

   **You should see:** Public-root export complete, followed by a successful public-address cross-check.

5. **Allow in-process encryption.**

   The wallet is encrypted with AES-GCM within the running process. This happens before backup confirmation; the encrypted-file write comes later.

   **You should see:** Encryption complete before the backup-confirmation stage, with the final encrypted-file write still pending.

6. **Check your backup, then confirm it.**

   Make sure your backup is securely stored and readable before confirming. Don’t confirm just to get through this stage: the next operation commits the encrypted wallet to disk.

   **You should see:** The run wait for your backup confirmation before proceeding to the encrypted-file write.

7. **Let both saves finish.**

   After your confirmation, the generator writes the encrypted wallet file atomically. It then saves the public material needed at runtime, in that order.

   **You should see:** The atomic encrypted-file write complete, followed by the save of public runtime material.

For background, see the [wallet-core HD wallet implementation](https://deepwiki.com/trustwallet/wallet-core/4.1-hd-wallet-implementation).

## Generation exports and launch refusals

Practise first on a test network with valueless coins, never with real funds. For Bitcoin testnet background, see [Wasabi’s Testnet guide](https://docs.wasabiwallet.io/using-wasabi/Testnet.html).

### 1. Check what generation exports

`make_wallet.py` writes four public values into the configured environment file:

| Network | Generator JSON field | Environment variable | Export |
|---|---|---|---|
| BTC | `btc_zpub` | `XPUB_BTC` | Public root |
| ETH | `eth_xpub` | `XPUB_ETH` | Public root |
| TRON | `trx_xpub` | `XPUB_TRX` | Public root |
| TON | `ton_address` | `TON_DEPOSIT_ADDRESS` | Configured TON address |

TON is an address export, not a fourth public root. No TON public-root export is documented.

**You should see:** After successful generation, the four assignments listed above in the environment file, with TON represented by its configured address.

### 2. Let the orchestrator’s guards do their job

The orchestrator captures only the generator’s public JSON stdout. Seed material appearing in that stream causes a refusal, as does any failed self-check.

Before writing any public material, it also verifies that the encrypted artefact exists and has mode `0600`: readable and writable only by its owner. A startup message alone does not mean these checks have passed.

**You should see:** Public material written only after every guard passes, with the encrypted artefact present at exactly `0600`. A failed guard must stop that write.

### 3. Recognise a missing-terminal refusal

Generation needs a controlling terminal for the seed phrase and data key. Redirecting stdin is not a substitute.

In a public-only scratch test, `NOVA_SECRETS_DIR`, `BAWA_ENV_FILE` and `BAWA_BACKUP_DIR` were directed into a disposable directory, and stdin came from `/dev/null`. The orchestrator printed:

```text
Generating wallet with Trust Wallet Core ...
Seed phrase + data key are displayed only on the controlling terminal.
```

It then exited with status `1` and reported:

```text
wallet-core generation failed; stderr suppressed
```

The cause was verified: stdin was not a terminal, and `/dev/tty` could not be opened. With no controlling terminal available, `generate.js` refused at its first step, exactly as intended. Those two startup lines did not mean a wallet had been created.

For another attempt, use a session with a controlling terminal; do not try to route seed output through stdout.

**You should see:** In that scratch result, no `seed.enc.json`, no `.env` and no backup directory were created. Only an empty secrets directory at mode `0700` remained. The disposable directory was subsequently deleted, and no live wallet was created.

### 4. Respect the existing-wallet refusal

Generation also refuses when it detects an existing wallet. This is protection against replacement, not a housekeeping error to bypass.

If you hit this refusal, stop and check which wallet location you selected. Do not delete or rename wallet files merely to make generation run. Keep the existing wallet and its backups intact; use a separate disposable location for a fresh test.

**You should see:** A refusal to generate over the existing wallet, rather than a replacement wallet or a successful new export.

## Record recovery data and check generated files

### 1. Make the recovery record before confirming

Before answering either confirmation, securely record:

- The mnemonic.
- The BIP-39 passphrase policy: **Bawa uses an empty passphrase**.
- The exact derivation path and policy for each chain.
- Any chain-specific wallet configuration.

Your recovery set must also include the encrypted artefact, `seed.enc.json`, and its separately stored data key. Record the intended artefact location and save the key now; retain the encrypted file once generation writes it. The file is only written after both confirmations succeed.

**You should see:** A recovery record covering the mnemonic, empty-passphrase policy and every chain’s settings, with the data key saved separately from the intended artefact location.

### 2. Complete both terminal confirmations

`generate.js` shows the mnemonic and separate data key only on `/dev/tty`.

First, type the first word of the seed phrase. Then type `SAVED` to confirm that you have stored the data key. Do not confirm storage until you have actually done it.

If either confirmation fails, `seed.enc.json` is not written. Files are written only after both confirmations succeed.

**You should see:** The first-word confirmation followed by the `SAVED` confirmation, with file writing held until both succeed.

### 3. Check the encrypted artefact and backup bundle

Here, `repo` means the repository root.

- **Secrets directory:** the path set by `NOVA_SECRETS_DIR`, or `repo/secrets` by default. Its mode is `0700`, and it holds `seed.enc.json` at mode `0600`.
- **Backup directory:** the path set by `BAWA_BACKUP_DIR`, or `repo/seed-backup` by default. Its mode is `0700`. It contains a `0600` copy of `seed.enc.json`, plus `decrypt_seed.py` and `docs/RECOVERY.md`.

Symlinked paths are refused.

The mnemonic is encrypted with AES-256-GCM. The generator never writes the plaintext mnemonic to disk, and the data key is stored separately. This is application-specific encryption at rest, not a universal backup standard.

**You should see:** Both directories at `0700`, both encrypted seed copies at `0600`, and the two recovery support files in the backup bundle.

### 4. Check the public environment file

The public environment file is written atomically to the path set by `BAWA_ENV_FILE`, or `repo/.env` by default, at mode `0600`. It contains only these four entries; placeholders are shown below:

```dotenv
XPUB_BTC=<btc-xpub>
XPUB_ETH=<eth-xpub>
XPUB_TRX=<trx-xpub>
TON_DEPOSIT_ADDRESS=<ton-deposit-address>
```

An xpub is a watch-only capability, **not a wallet backup**. Keep the full recovery set even if the public configuration looks correct.

**You should see:** The selected environment file at `0600`, containing exactly these four public entries and no mnemonic, private key or data key.

### 5. Read the completion report and keep recovery material private

Check the reported paths against the locations you recorded. Keep the data key separate from both the encrypted artefact and the backup bundle.

Never put mnemonics, private keys, data keys or recovery files in source control, issues, chat, CI logs or test fixtures.

**You should see:** `Wallet generation and public configuration update completed.` alongside the four public values, the encrypted artefact path and its `0600` mode, and the backup bundle path.

## Backup acceptance and generation failures

Don’t let a successful generation run stand in for a recovery test. Keep the evidence for acceptance, writing, copying and recovery separate.

1. **Record and compare before confirming.**

   Make your record of the backup details, then compare it directly with the terminal display. Confirm only when the records agree. If the terminal is unavailable or anything differs, stop before confirming. Never redirect secrets into logs to work round the problem.

   **You should see:** a match between your records and the terminal display. Without that comparison and match, do not confirm.

2. **Respect the generation checks.**

   Successful deterministic checks and public round trips prove that the documented generation and export checks completed—not that recovery works. If a deterministic or public check fails, hold public release and investigate with a maintainer before resuming. Bawa does not document exact diagnostics or exit codes for these failures.

   **You should see:** evidence that the documented generation and export checks completed. If a check failed, public release stays on hold.

3. **Check the write, and pause after a crash.**

   An artefact at mode `0600` establishes the documented disk-write condition; it does not demonstrate a restore. If writing fails, is interrupted, or leaves different permissions, keep completion unverified and retain recovery material offline.

   The documentation does not say what survives a crash, what gets cleaned up, or whether another attempt or an overwrite is safe. Check the implementation or ask a maintainer before retrying or overwriting. Do not infer rollback behaviour from atomic writing alone.

   **You should see:** a completed write with the artefact at `0600`. A write failure, interruption or permission mismatch leaves completion unverified; after a crash, retry or overwrite safety must be checked first.

4. **Back up the actual artefact.**

   Use the artefact that was actually created, not a guessed filename. Keep a protected offline copy and check it against the original. Store the data key separately from the encrypted backup.

   A matching copy proves copy integrity only. It does not prove that the backup can be decrypted or that the wallet can be recovered.

   **You should see:** a protected offline copy that matches the original, with the data key stored separately from the encrypted backup.

5. **Prove recovery separately.**

   Only a successful, separate restore test with `decrypt_seed.py`, using that backup copy, proves recovery from it. If recovery fails or the procedure is unavailable, keep recovery marked unverified. Neither generation checks nor a matching copy justify claiming restore success.

   **You should see:** a successful separate restore from the backup copy using `decrypt_seed.py`—or recovery still marked unverified.

## Recovery drill and pre-funding gate

A backup is unproven until a clean restore reproduces the recorded public addresses. Keep the restored wallet unfunded throughout this drill.

1. **Gather the recovery pack.**

   Have the BIP-39 mnemonic, or the generated encrypted `seed.enc.json` plus its separate 32-byte data key. You also need the exact BIP-39 passphrase policy (currently empty), chain derivation paths and address policy, network and chain configuration, and TON wallet configuration where applicable. Have the recorded original public addresses ready for comparison.

   An xpub or zpub cannot recover the wallet. It reproduces only public descendants below the exported account node.

   **You should see:** usable recovery material, the original configuration and a public-address record—not just an account public key.

2. **Recover on a clean, trusted machine.**

   For an encrypted backup, run `python3 tools/decrypt_seed.py` with the actual local path to `seed.enc.json` as its argument. The utility asks for the data key and displays the mnemonic on the controlling terminal by default. Keep screen sharing and terminal recording off.

   Use `--stdout` only for an explicit controlled pipeline, or `--output` for an atomic plaintext file with mode `0600`. Keep any plaintext file offline and outside shared folders or the development tree. If you backed up the mnemonic directly, use that offline copy instead.

   **You should see:** the mnemonic available privately on the controlling terminal, or only at the deliberately selected output destination.

3. **Restore the original settings.**

   Verify the mnemonic and passphrase against your recovery records. The current BIP-39 passphrase is empty; do not add one during the drill. Apply the recorded derivation paths, address policy, network and chain configuration.

   For TON, preserve the original wallet contract and version, derivation convention, workchain, network presentation, wallet ID and subwallet ID. These are recovery settings, not optional preferences.

   **You should see:** the original configuration reapplied, including the empty passphrase policy and every applicable TON setting.

4. **Compare public outputs.**

   Derive known public addresses from the restored wallet for each relevant chain. Compare them with the recorded originals, using the original address and network presentation.

   Investigate any mismatch rather than accepting something that looks plausible. Do not fund the restored wallet until the public outputs match.

   **You should see:** every checked public address matching its recorded original exactly. Any mismatch keeps the gate closed.

5. **Verify the retained backup and separate the key.**

   Test the backup copy you will keep by restoring from that copy and repeating the address comparison. A file merely existing is not enough.

   Store the data key separately from the encrypted backup. Keep all secret material out of online and development channels, including chats, tickets, repositories and logs.

   **You should see:** a successful restore from the retained copy, separate key storage, and no secret material in those channels.

Related reading: [BitPay’s testnet wallet guide](https://support.bitpay.com/hc/en-us/articles/360015463612-How-to-Create-a-Testnet-Wallet). Testnet practice does not replace this recovery drill.

### Pre-funding gate

Do not fund until every box is ticked:

- [ ] Restore tested.
- [ ] Public addresses match.
- [ ] Backup copy verified.
- [ ] Data key stored separately.
- [ ] No secret material in any online or development channel.
