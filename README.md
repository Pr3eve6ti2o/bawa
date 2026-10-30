# Bawa — How to run it

## 1. Scope and non-goals — what Bawa is

- **A practical, open-source reference for HD-wallet workflows** — the implementation under `tools/` uses `@trustwallet/wallet-core` as its wallet-crypto engine, giving maintainers code to work from.
- **One-time wallet creation** — `tools/make_wallet.py` and `tools/hdwallet-gen/generate.js` establish a wallet for subsequent derivation and recovery.
- **Watch-only public derivation** — `derive.js`, `derive_daemon.js` and `compare.js` support working from public material, so derivation can stay watch-only.
- **Controlled recovery** — `decrypt_seed.py` provides a defined path for recovering an existing wallet.
- **Independent verification** — `test/differential_test.py` is there to check the reference implementation independently.
- **A basis for blockchain tracking and payment reconciliation** — Bawa exports public material for applications to build those functions on. Tracking and reconciliation remain application responsibilities.

### What Bawa is not for

- **A hosted wallet or custody service.** Bawa is reference code, not a hosted custody solution.
- **An exchange or commercial product.** Bawa is provided as reference code, not a commercial offering.
- **Node communication, balance retrieval or transaction broadcasting.** These are outside Wallet Core’s scope.
- **A security audit.** Security-conscious code does not replace an external security review.

If you need a hosted wallet, custody service, exchange or commercial product, stop here and read the documentation for the service or product you intend to use. For node communication, balance retrieval or transaction broadcasting, read the relevant node or chain-tooling documentation instead.

**Production warning:** Do not treat “security-conscious” as “ready for real money”. Before any real-money deployment, all of the following must be complete:

- Clean dependency installation and lockfile generation.
- Full independent differential coverage.
- Chain-specific fixtures.
- Secret and dependency scanning.
- Reproducible release checksums and provenance.
- An external security review.

## 2. Architecture and responsibilities

```text
Standards
↓
Chain-specific policy
↓
Trust Wallet Core reference implementation
↓
Watch-only public derivation
↓
RPC / node / indexer
↓
Wallet + payment tracking
↓
Application database / reconciliation
```

```text
Trusted / interactive machine (offline generation)
↓
Trust Wallet Core
↓
Mnemonic, seed and private material
↓
Account-level public roots
↓
Trust boundary: only public material crosses
↓
Online application (watch-only)
↓
xpub / zpub / public address only
↓
Address derivation
↓
RPC / node / indexer
↓
Tracking / payment reconciliation
```

| Component | Owns | Does NOT own |
| --- | --- | --- |
| Standards | The base rules on which chain-specific policy rests. | Chain-state access or order reconciliation. |
| Chain-specific policy | The chain-specific rules used by the reference implementation. | Reading chain state or deciding whether a payment satisfies an order. |
| Trust Wallet Core | The reference wallet implementation: derivation and signing. | Reading chain state, making history searchable or deciding whether an order is paid. |
| Trusted generator | Creating wallet material and account-level public roots on the trusted machine. No online chain connection is needed. | Online payment tracking or reconciliation. |
| Watch-only public derivation | Address derivation from xpub/zpub, or use of a public address. | Signing or handling seed and private material. The tools do not accept a private extended key. |
| RPC / node | Reading chain state. | Wallet derivation, signing or order-payment decisions. |
| Indexer | Making chain history searchable. | Wallet derivation, signing or order-payment decisions. |
| Wallet + payment tracking | Tracking wallets and observed payments. | Wallet generation or signing. |
| Application database / reconciliation | Recording tracked payments and deciding whether an observed payment satisfies an order. | Wallet derivation, signing or providing chain state. |

The online application may be monitored, logged, restarted or compromised, so mnemonic, seed and private material must never reach the watch-only runtime. Everything later in this guide depends on that separation: trusted generation keeps private material out of the online application, while chain observation supplies the evidence the application uses to reconcile payments.

## 3. Choose your task

If this is your first run, start at [section 4: Prerequisites](#4-prerequisites).

| You want to… | Start here | You need first |
| --- | --- | --- |
| Install and run Bawa for the first time | [4. Prerequisites](#4-prerequisites) | No prior Bawa setup required; check the prerequisites before installing. |
| Generate a wallet | [8. One-time generation on the trusted machine — running it](#8-one-time-generation-on-the-trusted-machine-running-it) | A trusted, interactive machine and sections 4–7 completed. |
| Derive an address without the seed | [9. Watch-only derivation without the seed — one address at a time](#9-watch-only-derivation-without-the-seed-one-address-at-a-time) | Public xpub material only — never the seed. |
| Check public outputs | [10. Compare and verify public outputs](#10-compare-and-verify-public-outputs) | Public outputs from generation or watch-only derivation to compare and verify. |
| Run the independent differential test | [11. Differential test against bip_utils](#11-differential-test-against-bip_utils) | Sections 4–7 completed, including the Python venv and requirements. |
| Recover a wallet | [12. Recovery with decrypt_seed](#12-recovery-with-decrypt_seed) | The encrypted seed and the decryption inputs specified in section 12. |
| Fix a failed step | [13. Troubleshooting by symptom — install, generation and derivation](#13-troubleshooting-by-symptom-install-generation-and-derivation) | The failed step and its error message or symptom. |
| Check whether Bawa is ready for real money | [18. Readiness gates](#18-readiness-gates) | A review of the [security posture](#17-security-posture) and evidence to assess the readiness gates. |

## 4. Prerequisites

The generation machine handles wallet secrets, so use an offline or trusted machine for that work. The watch-only machine is for monitoring without those secrets; it has a different role from the machine used to create the wallet.

| Item | Required | Check |
|---|---|---|
| Environment | Unix-like recommended for the interactive `/dev/tty` generation flow | Check that `/dev/tty` is available if using that flow. |
| Node.js | v22.x (`>=22 <23`), as required by both the root `package.json` and `Tools/hdwallet-gen` engines | `node --version` |
| npm | Required; no version requirement is specified | `npm --version` |
| Python | 3.11 or newer (`>=3.11` in the root `package.json`) | `python3 --version` |
| Python virtual environment | Required for local tooling | Confirm that local tooling uses a virtual environment. |
| Git | Required to clone the repository. This is a practical requirement, not listed in the operations doc. | `git --version` |
| Python dependencies | `cryptography==50.0.2` and `bip-utils==2.12.2` | Check these exact pins in the requirements. |
| Wallet-core dependency | `@trustwallet/wallet-core` at `4.8.4` | Check the dependency declaration for this exact version. |
| Disk space | Enough for dependencies and recovery backups | Check available space before installing dependencies or generating a wallet. |

### Check your machine

Run each version check below.

```sh
node --version
```

You should see: `v22.x` — Node.js 22, below 23.

```sh
npm --version
```

You should see: a version number. No npm version requirement is specified.

```sh
python3 --version
```

You should see: Python 3.11 or newer.

```sh
git --version
```

You should see: a version number.

Use an offline or trusted machine for actual wallet generation. Do not generate a real wallet on a random online shell or CI runner just because the code runs there.

## 5. Clone and verify the commit

For a real installation, the docs require you to verify the commit/tag you intend to use before installing dependencies. They do not supply a signed-release verification procedure. Recording the commit you install from is the minimum check this guide can honestly give you; it is not proof of authenticity.

1. **Clone the repository.**

   ```sh
   git clone https://github.com/Pr3eve6ti2o/bawa.git
   cd bawa
   ```

   You should see: clone progress completing without errors; `cd bawa` normally prints nothing.

2. **Show and record the current commit.**

   ```sh
   git log --oneline -1
   git status --short
   ```

   Record the displayed commit ID and subject in your installation notes, outside the checkout.

   You should see: one line identifying the current commit, followed by no output from `git status --short` if the working tree is clean.

3. **Confirm the working tree is clean before installing anything.**

   Run the status check again before installing dependencies:

   ```sh
   git status --short
   ```

   If it lists changes or untracked files, stop and check them. Only proceed with installation when the output is empty.

   You should see: no output from `git status --short`.

## 6. Node install

Use Node `>=22 <23`, as required by both packages. The root package also declares Python `>=3.11`.

### Step 1 — Root install

From the repository root:

```sh
npm install
```

You should see: npm finish normally and return to the shell prompt without reporting an installation error or failure. There is no exact npm summary line to match.

### Step 2 — Tools install

The root package is only an orchestration shell. Its install does not replace the separate install at the `tools/hdwallet-gen` package boundary, where `@trustwallet/wallet-core` is declared at version `4.8.4`.

From the repository root:

```sh
cd tools/hdwallet-gen
npm install
cd ../..
```

You should see: the tools install finish without reporting an installation error or failure, then control return to your shell at the repository root after `cd ../..`.

### Step 3 — Syntax check

Run the root `check` script:

```sh
npm run check
```

This delegates to the tools package and checks the JavaScript syntax of `generate.js`, `derive.js`, `derive_daemon.js` and `compare.js`. It is a syntax check only, not a test run.

You should see: the check finish successfully, with no syntax errors reported, and control return to the shell prompt.

### Step 4 — Lockfile status

Neither `package-lock.json` nor `npm-shrinkwrap.json` is present in this tree as supplied. The missing production lockfile is a **release blocker**.

Before calling the repository production-ready, commit the lockfile generated from a clean install. Successful installs and syntax checks do not, by themselves, clear this blocker. A version range is not a tested dependency graph.

## 7. Python venv and requirements

Work in the directory containing `requirements.txt`. Do not install the requirements into the system Python. Do not run generation or verification outside the venv.

`bip_utils` is pinned and used only for independent verification; runtime wallet-generation code does not import it. Installing `requirements.txt` is a prerequisite for the differential test in section 11.

### Step 1: Create the venv

```sh
python3 -m venv .venv
```

You should see: a `.venv` directory created in the current directory. The command normally prints nothing.

### Step 2: Activate the venv

On Unix-like systems:

```sh
source .venv/bin/activate
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

You should see: `(.venv)` in your shell prompt, unless your prompt configuration hides it.

### Step 3: Upgrade pip and install the requirements

With the venv active, run:

```sh
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

You should see: both commands complete without errors, with packages installed or reported as already satisfied.

### Step 4: Confirm the pinned packages are installed

Check the installed versions with pip:

```sh
python -m pip show cryptography bip-utils
```

You should see: `cryptography` with `Version: 50.0.2` and `bip-utils` with `Version: 2.12.2`. Both must match these pins exactly.

## 8. One-time generation on the trusted machine — running it

> [!WARNING]
> Run this only on a trusted, offline machine in a real interactive terminal—not a random online shell or a CI runner. Do not generate a real wallet anywhere you would not trust with the seed phrase. Never defeat the controlling-terminal check by piping fake input.

### Step 1 — Be on the trusted machine

Complete sections 4–7 before continuing. On the trusted, offline machine, use a real interactive terminal and work from the repository root.

**You should see:** Your interactive shell on the trusted machine, ready in the repository root.

### Step 2 — Run the orchestrator

Use the orchestrator, not `generate.js` directly. The `.env.example` header names this command for generating the public values.

From the repository root, run:

```sh
python3 tools/make_wallet.py
```

The generator opens `/dev/tty`. Without a controlling terminal, it reports `FATAL: no controlling terminal — refusing to run; generate the wallet interactively` and exits with status 1.

**You should see:** `Generating wallet with Trust Wallet Core ...` and `Seed phrase + data key are displayed only on the controlling terminal.`

### Step 3 — Make the two offline records

Before any file is written, the generator creates the fresh wallet and runs its self-checks, including the published test-vector checks. The BIP-39 passphrase is empty by policy; changing that policy creates a different wallet.

The seed phrase has 24 words. The data key is shown in hex. Both appear only on `/dev/tty`, never on stdout or stderr, under these headings:

- `SEED PHRASE (24 words) — write down OFFLINE, never share`  
  Write down the seed phrase in your offline record. Never share the seed phrase.
- `DATA KEY (hex) — save separately; never store it with the ciphertext`  
  Write down the data key in a separate offline record. Keep it separate from the seed phrase, and never store the data key with the ciphertext.

Finish both offline records before answering the confirmations.

**You should see:** The two headings above, with the seed phrase and the data key displayed only on the controlling terminal.

### Step 4 — Answer the confirmations in order

Answer at the controlling terminal:

1. Type the first word of the seed phrase to confirm you wrote it down. If this confirmation fails, the generator reports `Seed phrase confirmation failed — not writing seed.enc.json`.
2. Type `SAVED` to confirm you stored the data key in its separate offline record. If this confirmation fails, the generator reports `Data key confirmation failed — not writing seed.enc.json`.

**You should see:** The first-word confirmation request, then the request to type `SAVED` if the first confirmation succeeds. Nothing is written until both confirmations succeed.

### Step 5 — Check the files and permissions

After both TTY confirmations, `generate.js` writes `seed.enc.json` inside the secrets directory. The write is atomic: a temporary file at `0600`, fsync, then rename.

The bundle contains `alg` set to `AES-256-GCM`, `nonce_b64`, `ciphertext_b64`, `aad` set to `nova-shop-seed-v1`, and the note `Decrypt with tools/decrypt_seed.py and the data key.`

`make_wallet` checks that the bundle is inside the secrets directory, exists and has mode **exactly `0600`**. Otherwise, it stops. It copies the bundle into the backup directory at `0600`, along with `decrypt_seed.py` and `docs/RECOVERY.md` if present.

It also writes `.env` atomically: a temporary file at `0600`, fsync, replace, then a final permission change to `0600`. If `.env` is missing, it starts from `.env.example`. The update sets only:

- `XPUB_BTC` from `btc_zpub`
- `XPUB_ETH` from `eth_xpub`
- `XPUB_TRX` from `trx_xpub`
- `TON_DEPOSIT_ADDRESS` from `ton_address`

`.env` must never contain mnemonics, passphrases, seed bytes, xprv/zprv or the AES recovery data key.

In the trusted machine’s file-properties permissions view, check every entry below. These defaults are relative to the repository root.

| What to check | Default path | Required mode |
|---|---|---|
| Secrets directory | `secrets/` | `0700` |
| Encrypted bundle | `secrets/seed.enc.json` | `0600` |
| Backup directory | `seed-backup/` | `0700` |
| Backup copy | `seed-backup/seed.enc.json` | `0600` |
| Public configuration | `.env` | `0600` |

If set, use `NOVA_SECRETS_DIR`, `BAWA_BACKUP_DIR` and `BAWA_ENV_FILE` instead of the corresponding defaults.

Check the full mode, including special bits. `0700` means owner read, write and execute only; `0600` means owner read and write only. There must be no group or other access, and no special bits. Stop if anything differs.

You should see: both directories at `0700`, both encrypted bundle files and `.env` at exactly `0600`, at the configured paths.

### Step 6 — Check the completion output

The final `make_wallet` output must include:

- `Wallet generation and public configuration update completed.`
- The four public values: BTC zpub, ETH xpub, TRX xpub and TON address.
- `Encrypted recovery artifact: <path> (0600)`
- `Backup bundle: <dir>`

Check that the reported paths match Step 5 and that the four public values match their `.env` entries.

The generator’s stdout JSON is public material only: `btc_zpub`, `eth_xpub`, `trx_xpub`, `ton_address`, `ton_path`, `ton_note`, `samples`, `checks`, `seed_encrypted_to` and `wallet_core_version`. The TON note is `single address per wallet; no xpub exported`. Do not expect a TON xpub.

You should see: the completion message, all four public values and both path messages, with no seed material or recovery data key.

### Step 7 — Regenerate only after a verified backup

Leave a working wallet alone. If `seed.enc.json` already exists, running without `--force`/`--regenerate` stops with the existing-wallet message in the table below.

Before an intentional regeneration, verify recovery from the existing backup using `tools/decrypt_seed.py` and your offline data key. Follow `docs/RECOVERY.md` where available. Keep this work on the trusted machine and do not leave a decrypted copy. If you cannot verify recovery, do not regenerate.

Only then rerun `make_wallet` with `--force`. Before replacement, it backs up the old bundle as `seed.enc.json.bak.<timestamp>` at `0600`. That automatic copy is not a substitute for the verified backup you needed beforehand. Never use `--force` casually.

After regeneration, check the saved old bundle’s mode and repeat Steps 5 and 6 for the replacement.

You should see: the old bundle retained as `seed.enc.json.bak.<timestamp>` at `0600`, and the replacement meeting the file and completion-output checks above.

### If it stops

| Symptom | What it means | What to do |
|---|---|---|
| `existing wallet found; rerun with --force/--regenerate only after making a verified backup` | An encrypted bundle already exists. | Keep it unless replacement is intentional. Follow Step 7 before using either override. |
| `wallet-core generation failed; stderr suppressed` from `make_wallet`, or `FATAL: wallet generation failed — details redacted` from `generate.js` | Generation failed with exit status 1; diagnostic details are suppressed or redacted. | Do not treat the run as complete. Investigate on the trusted machine before retrying; keep diagnostics redacted. |
| `H4 violation: seed material present in generator stdout` | Secret material reached stdout; `make_wallet` stopped. | Treat that stdout as secret. Do not share it or put it in `.env`. Investigate before another run. |
| `wallet-core self-checks failed: <names>` | The named self-checks failed. | Do not use the generated public values until the failures are resolved. |
| Seed-bundle validation stops the run | The bundle is missing, outside the secrets directory or not exactly `0600`. | Check the configured location and permissions. Correct the cause; do not bypass the check. |
| Secrets directory, `.env` or backup directory refused as a symlink | A protected path is symlinked. | Use non-symlinked paths, then retry. |

the seed phrase and data key now exist in exactly three places — your offline record, the encrypted artifact, and the backup — and nowhere else.

## 9. Watch-only derivation without the seed — one address at a time

After section 6, run the commands below from `tools/hdwallet-gen`.

This is watch-only: you need only the account public key, never the seed, mnemonic, passphrase or private key. If a tool asks for seed material here, you're in the wrong place.

### Step 1 — Get the right public key from `.env`

Find the account public key for your chain:

- **BTC:** use the **zpub** value stored as `XPUB_BTC`.
- **ETH and TRX:** use their respective **xpub** values.

Use that value in place of `<xpub>` below. Never paste a private key, including a private extended key.

You should see: a zpub value for BTC, or an xpub value for ETH or TRX.

### Step 2 — Derive one address

The command shape is:

```text
echo "<xpub>" | node derive.js <chain> <index>
```

The chain must be `btc`, `eth` or `trx`. The index must be an integer from `0` to `2147483647`.

The public key is read from stdin and trimmed. The trimmed value must be no more than 200 characters.

Choose the command for your chain. Each example below uses index `0`; `<xpub>` is a placeholder, including for BTC's zpub value.

**BTC** — path `m/84'/0'/0'/0/<index>`:

```sh
echo "<xpub>" | node derive.js btc 0
```

**ETH** — path `m/44'/60'/0'/0/<index>`:

```sh
echo "<xpub>" | node derive.js eth 0
```

**TRX** — path `m/44'/195'/0'/0/<index>`:

```sh
echo "<xpub>" | node derive.js trx 0
```

You should see: exactly one address on stdout for the command you ran.

### Step 3 — Check the output

Check that stdout contains exactly one address.

Derivation uses Trust Wallet Core's `getPublicKeyFromExtended`, then `deriveAddressFromPublicKey`. Error messages from both calls are redacted. Either call failing, or a failed final validation, exits `1`.

| Failure | What to expect |
|---|---|
| Bad chain, empty public key, non-integer index, or index outside `0..2147483647` | The usage line; exit `2`. |
| Private extended key supplied | `usage: extended public key required (private extended keys are rejected)`; exit `2`. |
| Trimmed public key exceeds 200 characters | `xpub too long`. |
| Either Trust Wallet Core derivation call fails | A redacted error message; exit `1`. |
| Final validation fails | Exit `1`. |

You should see: exactly one address on stdout on success.

### Running the persistent public-only derivation daemon (`derive_daemon.js`)

Use the daemon instead of the one-shot tool when you need repeated derivations from an extended public key. It is persistent, public-only and uses Trust Wallet Core.

The chains and paths are the same as for the one-shot tool:

| `chain` | Path |
|---|---|
| `btc` | `m/84'/0'/0'/0/<index>` |
| `eth` | `m/44'/60'/0'/0/<index>` |
| `trx` | `m/44'/195'/0'/0/<index>` |

**Start and check readiness**

The docs do not give an exact launch invocation. This guide shows the protocol, not a service manager; the daemon stays in the foreground attached to your terminal.

From `tools/hdwallet-gen`, start `derive_daemon.js` with `node`. Wait for the ready line before sending any requests.

You should see: `{"ready":true}`.

**Send a JSONL request**

Send one JSON object per line. This example requests BTC index `5`, at `m/84'/0'/0'/0/5`. Replace `<xpub>` with the extended public key before sending; `<address>` below represents the returned address, not literal output.

```json
{"chain":"btc","xpub":"<xpub>","index":5}
```

You should see: `{"ok":true,"address":"<address>"}`.

**Input limits and errors**

The `xpub` field is limited to 200 characters, and each input line to 4096 characters. The `index` must be an integer from `0` to `2147483647`, inclusive.

Bad-input responses use these JSONL forms:

```json
{"ok":false,"error":"request too large"}
{"ok":false,"error":"bad json"}
{"ok":false,"error":"bad request"}
```

A private extended key is rejected with:

```json
{"ok":false,"error":"extended public key required"}
```

Errors are redacted as in `derive.js`. For other fatal errors, the daemon writes `FATAL: ...` to stderr and exits with code `1`.

**Stop the daemon**

Close stdin or send `SIGTERM`.

You should see: the daemon exit with code `0`.

**Watch-only rule:** the daemon never receives seed or private material.

## 10. Compare and verify public outputs

`compare.js` is a quick, public-only cross-check that the roots in `.env` derive the addresses you expect. It prints public addresses only. It is not a tracker and does not check balances, transactions or a live chain.

### Step 1 — Check the public roots

Make sure `.env` holds the public roots from section 8 under `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX`. Check that it contains no seed material.

The default file is the repository-root `.env`, at `tools/hdwallet-gen/../../.env`. If `NOVA_ENV` is set, check the file it selects instead. The helper parses lines matching `^([A-Z_]+)=(.*)$`, so use plain `KEY=VALUE` assignments for those three entries.

You should see: all three public-root entries from section 8 in the selected file, with no seed material.

### Step 2 — Run `compare.js`

From `tools/hdwallet-gen`, run:

```sh
node compare.js
```

Any failure writes `FATAL: ...` to stderr and exits with status `1`. In particular:

```text
FATAL: missing <chain> xpub in <envPath>
```

This means the helper has not found an xpub for that chain in the indicated file. Check the relevant `XPUB_BTC`, `XPUB_ETH` or `XPUB_TRX` entry and confirm that the helper is reading the intended file.

You should see: three lines, one each for `BTC`, `ETH` and `TRX`, with each chain name followed by its addresses at indexes `0`, `1` and `2`, in that order.

### Step 3 — Compare indexes 0–2

Read the three lines and compare each address with the address you derived for the same chain and index in section 9. The helper uses these paths:

| Chain | Derivation path |
|---|---|
| BTC | `m/84'/0'/0'/0/<index>` |
| ETH | `m/44'/60'/0'/0/<index>` |
| TRX | `m/44'/195'/0'/0/<index>` |

You should see: matching addresses between this output and section 9 for every chain at indexes `0`, `1` and `2`.

## 11. Differential test against bip_utils

This test uses `bip_utils` as an independent reference for overlapping standards and derivation paths. The point is implementation A against implementation B, not wallet-core checking itself: the same wrong assumption can appear on both sides of a self-check.

`bip_utils` is pinned as `bip-utils==2.12.2` and is not imported by runtime wallet-generation code. The test uses `Bip39SeedGenerator`, `Bip44` and `Bip84` to derive BTC and ETH addresses from the published test vector and assert the expected addresses shown below.

Never place a real wallet mnemonic or seed in CI fixtures.

### Step 1 — Confirm the section 7 setup

Before continuing, make sure the venv from section 7 is active and `requirements.txt` has been installed in it.

You should see: the section 7 venv active, with the requirements installed.

### Step 2 — Run the test

From the repository root, inside that venv, run:

```sh
python3 test/differential_test.py
```

You should see: the three success lines shown in Step 3.

### Step 3 — Check the success output

```text
bip_utils reference checks: PASS
BTC m/84'/0'/0'/0/0: bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd
ETH m/44'/60'/0'/0/0: 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7
```

You should see: all three lines exactly as shown, including the paths and addresses.

### If there is a mismatch

A mismatch means the independent reference check has not matched the expected result. Stop. Do not fund the wallet, and do not assume the test is wrong.

Check the published test vector first, then the derivation path, then the installed `bip_utils` version against the pin, `bip-utils==2.12.2`.

The docs give no further mismatch procedure.

## 12. Recovery with decrypt_seed

Never paste the recovered mnemonic into chat, source control, issues or CI logs.

### Step 1 — Gather the recovery material

Preserve either:

- The BIP-39 mnemonic; the exact BIP-39 passphrase policy (currently empty); chain derivation paths and address policy; network/chain configuration; and TON configuration where applicable.
- The generated `seed.enc.json` plus its separate 32-byte data key.

For recovery with `decrypt_seed.py`, you need the encrypted artefact and its data key.

The artefact is JSON with `alg` set to `AES-256-GCM`. `nonce_b64` must decode to 12 bytes and `ciphertext_b64` to at least 16 bytes. The AAD is `nova-shop-seed-v1`.

An xpub/zpub cannot recover the wallet. It can reproduce only public descendants below the exported account node.

### Step 2 — Recover to the terminal on a trusted machine

Recover on a clean, trusted machine with a controlling terminal. Run without output flags:

```sh
tools/decrypt_seed.py
```

The optional final `path` argument defaults to `secrets/seed.enc.json`. Pass a different artefact path as the final argument if needed. Symlinked artefacts are refused.

The data key comes from `BAWA_DATA_KEY`, encoded as hex representing exactly 32 bytes, or from the interactive prompt `Bawa data key (hex): `.

By default, the tool sends the recovered mnemonic to `/dev/tty` only. It never writes plaintext to disk. Without a controlling terminal, it reports `no controlling terminal; use --stdout or --output explicitly`. Choose an alternative from Step 3 deliberately.

You should see: `Recovered BIP-39 mnemonic (do not copy into chat or source control):` followed by the recovered mnemonic on `/dev/tty` only.

### Step 3 — Use an explicit output alternative only when justified

`--stdout` and `--output` are mutually exclusive.

#### Controlled pipeline: `--stdout`

Use this only for an explicit, controlled pipeline. The mnemonic must not end up in CI logs. The invocation for that pipeline is:

```sh
tools/decrypt_seed.py --stdout
```

You should see: the recovered mnemonic on stdout.

#### Deliberate plaintext file: `--output`

Use this only when recovery explicitly requires a plaintext file. Replace `OUTPUT` with the intended destination:

```sh
tools/decrypt_seed.py --output OUTPUT
```

The tool writes the file atomically with mode `0600`. Symlinked output paths are refused.

You should see: `recovered mnemonic written to <path> (0600)`, with `<path>` replaced by your chosen output path.

### Step 4 — Verify before funding

Verify the recovered mnemonic and the exact BIP-39 passphrase policy, currently an empty passphrase. The recovered text must contain 12, 15, 18, 21 or 24 words.

Using sections 9–10, derive known public addresses with the recorded chain derivation paths, address policy and network/chain configuration, including TON configuration where applicable. Compare those addresses with the recorded originals.

Do not fund the restored wallet until the public outputs match.

You should see: derived public addresses that match the recorded originals.

## 13. Troubleshooting by symptom — install, generation and derivation

First isolate the failure: is this a build problem, a stdio/TTY problem, or an upstream/derivation problem?

| Symptom | Cause to check first | Fix / next check |
|---|---|---|
| `npm install` fails | Node/npm versions, then the exact package/version selected by the lockfile. | Run `node --version` and `npm --version`, then inspect the lockfile’s selected package/version. Do not immediately delete every dependency and install arbitrary “latest” versions. The operations docs give no supported version values, expected outputs, lockfile-inspection command or pass/fail criterion. Section 4 supplies the only version range to compare against: Node `>=22 <23`. **You should see:** a reported Node version within that range. No npm range or install-success output is supplied. |
| No TTY: `generate.js` reports `FATAL: no controlling terminal — refusing to run; generate the wallet interactively`, exit `1`. | No controlling terminal. This refusal is expected for one-time generation without a TTY. | Run generation from an actual interactive terminal on the trusted generation machine. Do not defeat the check by piping fake input into the process. **You should see:** generation no longer stopping with this specific no-TTY refusal. The cited docs give no generation command or successful-generation output. |
| Derived address does not match | A different mnemonic first, then the remaining derivation and wallet settings below. | Work through the ordered comparison below. **You should see:** the re-derived address matching the address being compared against after correcting the differing item. The docs give no commands, reference values or re-test procedure. |

### Address mismatch: compare in this order

Compare the inputs and settings, rather than treating this as a command sequence:

1. Same mnemonic?
2. Same BIP-39 passphrase?
3. Same curve?
4. Same coin type?
5. Same purpose?
6. Same account?
7. Same branch?
8. Same index?
9. Same network/address encoding?
10. Same wallet implementation/configuration?
    - **TON:** also compare the wallet contract/version and wallet-ID/subwallet configuration.
    - **Cardano:** also compare the exact CIP and role model.
    - **Solana:** check the exact derivation convention used by the source wallet.

Re-derive with the corrected item and compare again. Do not fund a mismatched address.

### Balances and tracking

The docs give no commands for the EVM or tracker checks below. For the tracker, they also give no database queries, expected records or pass/fail criteria. Treat this as an ordered investigation, not a command sequence.

| Symptom | Check in order | What it rules out |
|---|---|---|
| EVM address matches, but balance is zero | 1. Chain ID.<br>2. RPC endpoint.<br>3. Network name.<br>4. Native currency.<br>5. Explorer. | A connection to a different EVM chain. The same address can legitimately exist on multiple EVM networks. |
| Tracker misses an incoming payment | 1. Wrong address index.<br>2. Index allocation database.<br>3. Gap window.<br>4. Wrong branch.<br>5. Indexer lag.<br>6. RPC error.<br>7. Reorg.<br>8. Token contract mismatch.<br>9. Wrong network. | Wrong index or branch, allocation or gap-window issues, indexer lag, RPC errors, reorgs, a token contract mismatch or the wrong network. |

This is why an address allocation table is so important.

### Negative and security cases

The docs give no commands for these negative/security cases. These are inputs and conditions to test, not a tracker command list.

| Bad input | Expected tool behaviour |
|---|---|
| Malformed JSON; invalid chain names; malformed Base58/checksums | Listed for testing; no specific tool behaviour is given. |
| Oversized JSON lines or xpubs | The daemon caps lines at 4096 characters. `derive.js` and the daemon cap xpubs at 200 characters. |
| Negative indexes; indexes `>= 2^31` | `derive.js` and the daemon reject out-of-range indexes. |
| Private extended keys where public keys are required | `derive.js` and the daemon reject private extended keys. Both redact extended-key material from errors. |
| Corrupted AES-GCM ciphertext; wrong data keys; truncated recovery artefacts | Listed for testing; no specific tool behaviour is given. |
| Symlinked secret or artefact paths | `decrypt_seed` refuses symlinked artefacts. `make_wallet` refuses symlinked secrets, `.env` and backup paths. |
| Unexpected existing outputs | `make_wallet` refuses an existing `seed.enc.json` without `--force`. Behaviour for other existing outputs is not specified. |
| Missing `.env` | Listed for testing; no specific tool behaviour is given. |

## 14. Short FAQ

**Is Bawa a wallet I can use to hold money?**

No: Bawa is reference code, not a hosted wallet, custody service, exchange or commercial product. It is not production-ready on its own.

**Can I generate a wallet on my normal laptop or in CI?**

Generate only on a trusted, offline, interactive machine, not on a random online shell or a CI runner. Refusal when no TTY is available is expected.

**Why does generation ask me to type the first word and SAVED?**

Generation requires those confirmations on `/dev/tty` before writing `seed.enc.json`. If confirmation fails, nothing is written.

**Can I recover a wallet from an xpub?**

No: an xpub reproduces only public descendants below the exported account node. Recovery needs the mnemonic plus the passphrase policy, or `seed.enc.json` plus its separate data key.

**Does a passing differential test mean Bawa is production-ready?**

No: it is one independent check on BTC BIP-84 and ETH BIP-44 public fixtures. Full vector coverage, a lockfile, scanning and external review remain release gates.

**Does a quiet terminal or a refused run mean something broke?**

A stdio/daemon tool waiting quietly for input is normal. Generation refusing to run without a TTY is expected, not a failure.

**Can I use DeepSeek, Opus or @hdwallet/core with Bawa?**

`@hdwallet/core` is research-only, is not production-ready and is not used by the runtime. DeepSeek and Opus are not Bawa tools; this guide does not cover them.

**What if my derived address does not match?**

Use the ordered checklist in section 13. Do not fund a mismatched address.

## 15. Updating and rebuilding

The docs give no update, migration or rollback procedure. The steps below cover the required reinstalls and checks after pulling changes.

Do not casually overwrite an existing `seed.enc.json` or `.env`. Generation refuses an existing `seed.enc.json` without `--force` or `--regenerate`. Use `--force` only after verifying a backup; it backs up the old file to `seed.enc.json.bak.<timestamp>` with mode `0600`.

**Warning:** Regeneration creates a different wallet unless the same mnemonic and passphrase policy are used. That includes the empty-passphrase policy noted in section 8: the same mnemonic with a different passphrase does not preserve the wallet.

### Step 1 — Pull and record the new commit

Keep the check outputs you recorded before the update. Pull the changes and record the new commit as described in section 5.

You should see: the updated checkout, with its new commit recorded and your pre-update check outputs retained.

### Step 2 — Reinstall Node and Python dependencies

After pulling changes, rebuild/reinstall the Node tools with both installs from section 6. Complete these and the syntax check in Step 3 before using the tools.

At the repository root:

```sh
npm install
```

Then, in `tools/hdwallet-gen`:

```sh
npm install
```

If `requirements.txt` changed, reinstall the Python requirements as in section 7. Run this from the repository root, inside the venv:

```sh
python -m pip install -r requirements.txt
```

You should see: both Node installs complete successfully and, if required, the Python requirements reinstalled successfully inside the venv.

### Step 3 — Re-run the checks and compare

From the repository root, run the syntax check from section 6:

```sh
npm --prefix tools/hdwallet-gen run check
```

Then re-run:

- `compare.js` and check its public outputs as described in section 10.
- The differential test from section 11.

Compare the outputs of all three checks with the outputs you recorded before the update.

The tools package’s `test` script targets `test/smoke.test.js`, which is absent from this tree. Do not use that script as an update check.

You should see: a passing syntax check, public outputs matching your pre-update records and a passing differential test consistent with the recorded results.

### Step 4 — Stop if a check now fails

If a check now fails or shows a mismatch, stop and use section 13 to troubleshoot. Do not fund the wallet. Do not regenerate `seed.enc.json` to “fix” a mismatch.

You should see: troubleshooting under section 13, with no funding and no regeneration.

## 16. Primary references

These are the primary specifications and upstream projects Bawa relies on. Re-check current implementation behaviour before production releases.

### Standards

- [BIP-32](https://bips.dev/32/), [BIP-39](https://bips.dev/39/), [BIP-43](https://bips.dev/43/), [BIP-44](https://bips.dev/44/) and [BIP-84](https://bips.dev/84/) — primary BIP specifications.
- [BIP-174](https://bips.dev/174/) — PSBT.
- [BIP-371](https://bips.dev/371/) — Taproot PSBT.
- [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md), [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) and [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) — primary SLIP specifications.
- [TON TEP-3](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-guidelines-and-standards.md) — TON standard.
- [Cardano CIP-1852](https://cips.cardano.org/cip/CIP-1852) — Cardano standard.

### Trust Wallet ecosystem

- [Trust Wallet organisation](https://github.com/trustwallet) — upstream organisation.
- [Wallet Core](https://github.com/trustwallet/wallet-core) — upstream Wallet Core project.
- [Wallet Core Usage Guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage) — Wallet Core usage documentation.
- [Wallet Core HDWallet API](https://trustwallet.github.io/docc/documentation/walletcore/hdwallet/) — HDWallet API reference.
- [Wallet Core registry fields](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md) and [Wallet Core registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json) — registry field documentation and `registry.json`, used as compatibility references.
- [Trust Wallet Assets](https://github.com/trustwallet/assets) and [Assets repository overview](https://github.com/trustwallet/assets/blob/master/knowledge/architecture/repo-overview.md) — assets repository and its overview.

### Independent verification

- [bip_utils](https://github.com/ebellocchia/bip_utils) — independent verification reference.
- [PyPI bip-utils](https://pypi.org/project/bip-utils/) — the `bip-utils` package listing on PyPI.
- [@hdwallet/core](https://www.npmjs.com/package/@hdwallet/core) — reference/research material only; its current npm page states that it is not ready for production use, and it is **not used by the runtime**.

Trust Wallet Core's `registry.json` and registry field documentation are useful compatibility references for coin IDs, derivation paths, curves, key formats, HRPs, chain IDs and related metadata. They do not replace the protocol specification. Bawa treats network identity, derivation policy, address encoding and asset identity as separate concepts.

## 17. Security posture

```text
Trusted/offline generation (mnemonic/seed/private material; account public roots)
    ↓ public material only
Online watch-only (xpub/zpub/public addresses only)
    ↓
RPC/indexer
```

Bawa assumes the online application may be monitored, logged, restarted or compromised. Seed material must never reach the watch-only runtime.

### Assets

| Sensitivity | Assets |
| --- | --- |
| Highest | BIP-39 mnemonic and passphrase; private keys and private extended keys; recovery data key; encrypted recovery artefacts before controlled backup. |
| Privacy-sensitive | Account xpub/zpub; derived address inventories; payment/order associations. |

### Filesystem rules

- Keep secrets under a dedicated directory with restrictive permissions.
- Encrypted artefacts are written atomically with mode `0600`. Symlinked secret paths are rejected.
- `.env` is not a secret store for mnemonics or private keys. It may contain public xpub/zpub values, but those still have privacy implications.

### Dependency rules

- Pin Trust Wallet Core to an exact tested version.
- Keep `bip_utils` pinned and use it for verification only.
- Do not treat a version range as a tested dependency graph. Commit a lockfile from a clean install before production.
- Run dependency and secret scanning in CI and for releases.
- Prefer signed/tagged upstream releases and record checksums and provenance where practical.

### Limitations

- The generator displays the mnemonic and data key through the controlling terminal, keeping them out of normal subprocess stdout/stderr. This reduces accidental logging but does **not** guarantee protection from a compromised operating system, debugger, core dump, swap, memory capture or malicious terminal.
- JavaScript/WebAssembly memory cannot provide a cryptographic guarantee of perfect zeroisation.
- Encryption at rest protects stored ciphertext but does not eliminate plaintext exposure while a mnemonic is being generated or recovered.
- An external security review is required before treating Bawa as production custody infrastructure.

### Never publish

- Mnemonics.
- Private keys.
- `xprv`/`zprv` or other private extended keys.
- Recovery data keys.
- Production `.env` files.
- Wallet backup artefacts.
- Credentials or API secrets.

### Vulnerability disclosure

Use a private disclosure path with the repository maintainers rather than posting exploit details publicly. Neither `docs/SECURITY.md` nor `SECURITY.md` supplies a contact or disclosure channel.

## 18. Readiness gates

Mark each gate **PASS** or **FAIL**. Treat any unmet or unverified check as **FAIL**. The workflow passes below do not satisfy the separate, outstanding release gates.

Bawa is security-conscious reference code, not a hosted custody solution. These checks are not a security audit.

| gate | check (section) | pass looks like | not proved by passing |
|---|---|---|---|
| Prerequisites — **PASS** | Prerequisites (section 4) | All section 4 prerequisites are met. | That later workflow checks or release gates have passed. |
| Node setup — **PASS** | Node install and syntax check (section 6) | Node install and the syntax check pass. | That the wallet is safe to fund. |
| Python setup — **PASS** | Python requirements (section 7) | Python requirements are installed. | A passing differential test or completed dependency scanning. |
| Generation — **PASS** | Generation, backup copy and environment (section 8) | Generation completes; `seed.enc.json` has permissions `0600`; a backup copy is made; `.env` holds only public roots. | That the backup works. Only verified recovery proves that. |
| Public derivations — **PASS** | `compare.js` comparison (section 10, against section 9) | Public outputs match the section 9 derivations. | A live chain, balance or payment. |
| Differential test — **PASS** | Reference comparison (section 11) | The test prints `bip_utils reference checks: PASS`. | Production readiness or full official BIP-32/BIP-39 vector coverage. |
| Recovery — **PASS** | Recovery verification (section 12) | Recovery is verified on a clean, trusted machine, with public outputs matching the recorded originals before any funding. | That the outstanding release gates have passed. |
| Dependency lockfile — **FAIL — unmet** | Release gate; no lockfile is present in this tree | A dependency lockfile from a clean install is committed. | Secret/dependency scanning, reproducible release artefacts or external security review. |
| Full published vector coverage — **FAIL — unmet** | Release gate; the generator contains public regression fixtures, but full official coverage remains outstanding | Full published vector coverage, including full official BIP-32 and BIP-39 coverage. | Chain-specific fixture coverage or production readiness. |
| Chain-specific fixtures — **FAIL — unmet** | Release gate; outstanding | Chain-specific fixtures are provided, including TON-specific fixtures. | A live chain, balance or payment. |
| Secret/dependency scanning — **FAIL — unmet** | Release gate; outstanding | Secret and dependency scanning is completed. | External security review or production readiness. |
| Reproducible releases — **FAIL — unmet** | Release gate; outstanding | Reproducible release artefacts are available, with checksums and provenance. | External security review or that the wallet is safe to fund. |
| External security review — **FAIL — unmet** | Release gate; outstanding | An external security review is completed. | That the other release gates have passed, or that Bawa is a hosted custody solution. |

### What passing does NOT prove

- A passing differential test does not prove production readiness.
- A successful generation does not prove the backup works. Only a verified recovery does.
- A successful derivation does not prove a live chain, balance or payment.
- A passing syntax check does not prove the wallet is safe to fund.

The setup is ready for the reference workflow when every grounded gate passes, and it is NOT ready for real-money deployment while any outstanding gate above remains unmet.

## 19. About this guide
This guide was written with GPT-6-Astra. The repo files and the checks in sections 10 and 11 remain the authority if anything here disagrees with them.

---

## Learn from scratch

Start with the wallet model, then learn the chain rules before choosing tools. Read these five guides in order, using each check to confirm your understanding before moving on.

| Guide | Entry gate | You should see: |
|---|---|---|
| [01 — Fundamentals](docs/01-fundamentals/README.md) | No earlier Bawa guide required—start here. | You can distinguish entropy, a BIP39 mnemonic and the seed; explain BIP32 master and child keys; and describe extended keys and the hardened boundary. |
| [02 — Chain Guides](docs/02-chains/README.md) | You understand the mnemonic-to-seed relationship and BIP32 key derivation. | You can recognise the derivation paths and address formats for a chain, and explain how chain families differ in curves and address models. |
| [03 — Tool & Repository Map](docs/03-tools-and-repositories/README.md) | You understand the chain family, paths and address model relevant to your work. | You can choose a repository or tool for each job and explain both its purpose and what it does not do. |
| [04 — Wallet Generation](docs/04-wallet-generation/README.md) | You know which repository or tool handles generation and understand its limits. | You can explain the one-time trusted generation operation, including recording recovery data, verifying the result and then moving public material online. |
| [05 — Watch-Only Derivation](docs/05-watch-only/README.md) | You understand the generation and verification sequence, and can distinguish public material from the seed. | You can explain how receiving addresses are derived from public material only, without the seed. |

### Learn from scratch — continued

- **[06 — Wallet Tracking](docs/06-tracking/README.md)**
  - **Entry gate:** You understand watch-only derivation and the role of public addresses.
  - **You should see:** You can explain how public-address tracking combines free RPC or an explorer with a local database, scheduled polling and a dashboard.

- **[07 — Payment Tracking](docs/07-payment-tracking/README.md)**
  - **Entry gate:** You understand how wallet tracking observes network activity.
  - **You should see:** You can distinguish allocation, observation, confirmation and reconciliation, and explain how they establish whether an observed event satisfies a payment request.

- **[08 — Security & Recovery](docs/08-security-recovery/README.md)**
  - **Entry gate:** You understand wallet generation and the public-only scope of watch-only derivation.
  - **You should see:** You understand how to protect recovery capability and xpub privacy, and how backups and a passphrase relate to reproducing the wallet after failure.

- **[09 — Signing & Hardware](docs/09-signing-and-hardware/README.md)**
  - **Entry gate:** You understand recovery protection and the tracker’s public-only role.
  - **You should see:** You can explain the roles of PSBT, descriptors and hardware wallets in authorising transactions, and why the signer stays separate from the tracker.

- **[10 — Operations & Testing](docs/10-operations-and-testing/README.md)**
  - **Entry gate:** You know the tool and repository map and understand the generation, tracking and signing workflows.
  - **You should see:** You can describe how to install, run, test, troubleshoot and release the tooling.

- **[11 — Trust Wallet and Independent Verification](docs/11-trust-wallet-and-independent-verification/README.md)**
  - **Entry gate:** You understand Bawa’s tool map and the testing guidance in 10.
  - **You should see:** You can explain how Bawa uses Trust Wallet Core and why `bip_utils` belongs in the verification layer.

- **[12 — Chain Registry and Assets](docs/12-chain-registry-and-assets/README.md)**
  - **Entry gate:** You understand the roles of Trust Wallet Core and `bip_utils` in Bawa.
  - **You should see:** You can distinguish chain compatibility metadata from asset metadata and explain why both are kept separate from the cryptographic engine.

Wallet Core does not handle node communication, balance retrieval or transaction broadcasting. Keep signing exercises testnet-only or conceptual—never use real funds.
