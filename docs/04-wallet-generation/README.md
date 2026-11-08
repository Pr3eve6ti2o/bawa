Replacement text for sections 1–4 follows. I’ve retained your four supplied headings; “seven sections” conflicts with the stated 13-section scope.

# Wallet generation

## 1. What generation is

Generation is a one-time trusted operation. When you generate a wallet, Bawa’s `generate.js` performs ten steps:

1. Opens your controlling terminal first.
2. Initialises Trust Wallet Core.
3. Runs deterministic checks before generating a fresh wallet.
4. Creates a 256-bit BIP-39 wallet with an empty BIP-39 passphrase.
5. Exports BTC, ETH and TRON public roots, plus the configured TON address.
6. Performs public derivation and address round trips.
7. Encrypts your mnemonic with AES-256-GCM.
8. Shows your mnemonic and the separate data key only on the terminal.
9. Waits for your confirmations.
10. Writes the seed bundle with restrictive permissions.

The surrounding tools have distinct roles:

- `make_wallet.py` orchestrates filesystem and environment work and protects the public-output boundary.
- `derive.js` performs one-shot watch-only derivation. The xpub goes over stdin, deliberately **not** in argv. Chain and index are arguments; the output is one derived address.
- `derive_daemon.js` provides persistent watch-only derivation using newline-delimited JSON. It loads Wallet Core once and reuses it.
- `compare.js` gives you a diagnostic cross-check of derived addresses against the parent application’s expectations.
- `decrypt_seed.py` is your recovery utility for the application-specific seed bundle.

At `e3b65fb0`, the npm `test` script targets `test/smoke.test.js`, which is in this tree; the 28-check smoke suite passes 28/28 (verified 2026-11-08). At the former pin `082f7915` the file was absent and the suite belonged only to an unpushed local repair copy.

Keep the empty BIP-39 passphrase and the 24-word mnemonic: both are fixed policy. A non-empty passphrase or a different word count gives you a different wallet. The confirmations exist because you have no second chance to record the mnemonic.

## 2. Install pointer

Follow the root README §§5–7 as the single canonical installation procedure.

You need:

- A Unix-like environment for the `/dev/tty` flow. This is recommended for that flow; generation itself is Unix-like only. There is no PowerShell activation.
- Node matching the `engines` requirement in `package.json`, and npm.
- Python 3.11+ and a venv.
- Disk space.
- An **offline or trusted machine** for actual generation. Never generate a wallet in a random online shell or on a CI runner.

Run the following repository-specific checks from the repository root.

For a signed commit, verify its signature using a maintainer key you already trust:

```sh
git verify-commit HEAD
```

> **Expected result**
>
> The commit signature verifies using a maintainer key you already trust. Printing a key ID alone is not verification.

Check the installed Wallet Core version:

```sh
npm --prefix tools/hdwallet-gen ls @trustwallet/wallet-core
```

> **Expected result**
>
> The dependency listing shows `@trustwallet/wallet-core@4.9.2`.

**Lockfile warning**

> Before calling the repository production-ready, commit the lockfile generated from a clean install.
>
> Version pins are not a lockfile; until a lockfile generated from a clean install is committed, no install reproduces the exact dependency graph that was tested.

**Environment note:** A differential-test scratch result passed with Node v24.22.1 and Python 3.12.3. Python met the requirement; Node did not. That pass does **not** validate a supported installation. Repeat the differential check with Node 22.

## 3. Generating the wallet safely

On your offline or trusted Unix-like machine, run this from the repository root:

```sh
python3 tools/make_wallet.py
```

> **Expected result**
>
> With a controlling terminal and successful checks, you see the mnemonic and separate data key only on that terminal. You are asked to confirm your backup before the seed bundle is written atomically with restrictive permissions and public material is saved for runtime.
>
> Without a controlling terminal, generation refuses to proceed. That refusal is a security boundary, not a bug.

The flow is:

Terminal check → Wallet Core self-checks → 256-bit wallet creation → mnemonic validation → public-root export → public address cross-check → AES-GCM encryption in-process → your backup confirmation → atomic seed bundle write → public material saved for runtime.

**Record and retain all of the following:**

1. Your mnemonic.
2. The BIP-39 passphrase policy: **empty**. Do not confuse the BIP-39 passphrase with a vault unlock passphrase.
3. The exact derivation paths and policies for each chain.
4. Any chain-specific wallet configuration needed for recovery.
5. The seed bundle and its key, stored separately from each other.

An xpub is **not** a wallet backup. It is a watch-only capability.

## 4. What gets written to disk

Your encrypted file is an application-specific **seed bundle**. Its conceptual structure is:

```json
{
  "alg": "AES-256-GCM",
  "kdf": "none - random 256-bit data key",
  "nonce_b64": "...",
  "ciphertext_b64": "..."
}
```

Generation does not write your plaintext mnemonic to disk. Keep the random data-encryption key separately from the seed bundle.

This is application-specific encryption at rest, **not** a universal replacement for a proper wallet backup standard. Recovery interoperability depends on your mnemonic, BIP-39 passphrase policy, derivation paths and chain-specific wallet configuration. Pay particular attention to the wallet configuration you need for TON.
## 5. First-run checklist

- [ ] Use a trusted machine.
- [ ] Verify the source revision.
- [ ] Review the dependency graph.
- [ ] Confirm that deterministic tests pass.
- [ ] Record your mnemonic offline.
- [ ] Record your vault unlock passphrase policy.
- [ ] Record your exact chain and derivation-path policy.
- [ ] Verify addresses independently.
- [ ] Complete a recovery drill on a clean machine.
- [ ] Move only verified public/watch-only material online.

## 6. One trusted, offline session

1. **Prepare the machine.**

   Use your trusted machine offline, with an interactive `/dev/tty` available.

2. **Establish the launch procedure.**

   Follow the launch procedure defined by `make_wallet.py`. It uses Node.js to run `tools/hdwallet-gen/generate.js`.

   If a wallet already exists, the launcher refuses to proceed unless you use `--force` or `--regenerate`. Verify a backup before using either option.

3. **Start and check the ordering.**

   Start through that launch procedure and check the order:

   Open `/dev/tty` → initialise Core → run deterministic checks → generate a fresh 256-bit BIP-39 wallet with an empty BIP-39 passphrase → produce public exports → run public round trips → encrypt with AES-256-GCM → show the mnemonic plus data key on the terminal only → request your confirmations → atomically write the encrypted seed bundle at `0600`.

   No seed material appears in the generator’s stdout; `make_wallet.py` checks this. Silence is not proof that the checks passed: use the completion check in step 6.

4. **Verify what is exported.**

   Check the BTC, ETH and TRON public roots and the configured TON address. For TON, verify the address; do not expect a fourth public-root export.

   Match the four public environment entries to the generator’s exports:

   | `.env` entry | Export field |
   | --- | --- |
   | `XPUB_BTC` | `btc_zpub` |
   | `XPUB_ETH` | `eth_xpub` |
   | `XPUB_TRX` | `trx_xpub` |
   | `TON_DEPOSIT_ADDRESS` | `ton_address` |

5. **Record recovery data before confirming.**

   Record your mnemonic and the separate data key from `/dev/tty` only. Keep both offline.

   Your BIP-39 passphrase is **EMPTY**. The data key is a separate recovery key, not that passphrase.

   Check your records before answering the confirmation prompts. Type the first word of your mnemonic, then type `SAVED`. If either confirmation fails, `seed.enc.json` is not written.

6. **Confirm, then inspect the write.**

   After confirming, check these locations and conditions:

   - **Secrets directory:** the directory set by `NOVA_SECRETS_DIR`, or `secrets/` at the repository root, has mode `0700`. It contains the seed bundle, `seed.enc.json`, at `0600`. Symlinked paths are refused.
   - **Backup directory:** the directory set by `BAWA_BACKUP_DIR`, or `seed-backup/` at the repository root, has mode `0700`. It contains a `0600` copy of `seed.enc.json`, plus `decrypt_seed.py` and `docs/RECOVERY.md`.
   - **Public environment file:** the file set by `BAWA_ENV_FILE`, or the repository-root `.env`, is written atomically at `0600` and contains only the four public entries from step 4.

   For completion, check for the message below **plus** all four public values, the seed bundle’s artefact path with mode `0600` and the backup bundle path:

   > Wallet generation and public configuration update completed.

For recovery, use `tools/decrypt_seed.py` and follow `docs/RECOVERY.md`. Generation checks and backup-copy integrity do **not** prove successful decryption or recovery. Test a restore separately before funding.

> Only verified public material belongs online. Never put mnemonic, private keys, data keys or recovery files in source control, issues, chat, CI logs or test fixtures.

## 7. Backup acceptance and failed runs

**Backup acceptance stages (not commands)**

Check the stages in this order:

Open `/dev/tty` → initialise Core → deterministic checks → fresh 256-bit BIP-39 wallet with an empty BIP-39 passphrase → BTC/ETH/TRON public roots plus the configured TON address → public round trips → encrypt with AES-256-GCM → show the mnemonic plus data key on the terminal only → operator confirmations → atomic write of the encrypted seed bundle at `0600`.

TON is an address export, not a fourth public root. Round trips check generation and export; they do **not** test backup restoration.

**Backup checks**

Check the layout defined by `make_wallet.py`: the backup directory has mode `0700` and contains a `0600` copy of the seed bundle, `seed.enc.json`, plus `decrypt_seed.py` and `docs/RECOVERY.md`.

The orchestrator checks that the original seed bundle has mode `0600` and that its bytes match the backup copy.

**What verified can mean here**

| Evidence | What you can conclude |
| --- | --- |
| Deterministic checks plus public round trips | The documented generation and export checks completed. |
| Artefact at `0600` | The documented disk-write condition was met; this is not a restore result. |
| Backup matches the original | You have copy integrity, not proof of successful decryption or recovery. |
| Recovery from the saved copy | A successful, separate restore test with `decrypt_seed.py` establishes recovery from that copy. |

**Failed runs**

If a stage fails, stop before confirming. Keep recovery material offline and do not redirect secrets into logs.

| Failure | What you should do |
| --- | --- |
| Terminal unavailable or your records do not match | Stop before confirming. |
| Deterministic or public check fails | Hold public release and investigate with a maintainer. Treat exact diagnostics and exit codes as unspecified. |
| Write fails, is interrupted, or permissions differ | Keep completion unverified and retain recovery material offline. File presence alone is not recovery proof. |
| Recovery fails or the procedure is unavailable | Keep recovery marked unverified. `make_wallet.py` places `decrypt_seed.py` and `docs/RECOVERY.md` in the backup directory; test a restore separately before funding. |

**After a crash**

Make no assumptions about what remains, clean-up behaviour or the safety of retries or overwrites. Check the implementation or ask a maintainer before retrying or overwriting. Atomic writing does not specify a recovery or rollback procedure.
## 8. Launch wallet generation

1. **Use an interactive terminal.** From the repository root, run:

   ```sh
   python3 tools/make_wallet.py
   ```

   > **Expected result**
   >
   > The generator checks terminal access first. With a usable terminal, it proceeds to the self-checks; without one, it refuses. That refusal is a security boundary, not something to bypass.

2. **Let the wallet-core self-checks finish.** These include:
   - `coin_tron_195` and `coin_ton_607`;
   - the published BTC fixture `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`;
   - the published ETH fixture `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`;
   - `zpub`/`xpub` prefix checks and public round-trip checks for BTC, ETH and TRX.

   The published addresses are **test fixtures, not your new wallet’s addresses**.

3. **Let wallet creation and mnemonic validation finish.** Generation uses 256-bit BIP-39 with an empty BIP-39 passphrase. Mnemonic validation must finish before public-root export. Keep your mnemonic private.

4. **Let the public-material checks finish.** The order is public-root export, public-address cross-check, then encryption.

5. **Let in-process encryption finish.** AES-GCM encryption happens within the running process, before backup confirmation. The encrypted seed bundle is written later.

6. **Check your backup, then confirm it.** Your backup of the displayed recovery material must be securely stored and readable before you confirm. The next operation commits the seed bundle to disk.

7. **Let both saves finish.** The atomic seed bundle write comes first, followed by the public runtime material, in that order.

## 9. Generation exports and launch refusals

| Chain | Field | .env name | What it is |
| --- | --- | --- | --- |
| BTC | btc_zpub | XPUB_BTC | Public root |
| ETH | eth_xpub | XPUB_ETH | Public root |
| TRON | trx_xpub | XPUB_TRX | Public root |
| TON | ton_address | TON_DEPOSIT_ADDRESS | Configured TON address |

**Launch guards.** `make_wallet.py` captures only the generator’s public JSON stdout. Seed material in that stream causes a refusal, as does any failed self-check. Before writing public material, it checks that the seed bundle exists with mode exactly `0600`. A failed guard must stop the write. Do not treat a startup message as evidence that these checks passed.

**Missing-terminal refusal.** The disposable check directed `NOVA_SECRETS_DIR`, `BAWA_ENV_FILE` and `BAWA_BACKUP_DIR` into a disposable directory, with stdin from `/dev/null`. It printed these startup lines, quoted verbatim including the legacy wording:

```text
Generating wallet with Trust Wallet Core ...
Seed phrase + data key are displayed only on the controlling terminal.
```

The run then exited with status `1` and:

```text
wallet-core generation failed; stderr suppressed
```

The cause was confirmed: stdin was not a terminal and `/dev/tty` could not be opened. `generate.js` refused at its first step, exactly as intended. Those startup lines did not mean a wallet had been created.

No `seed.enc.json`, `.env` or backup directory was created. Only an empty secrets directory at `0700` remained. The disposable directory was then deleted. **No live wallet was created [in this scratch run].** Live wallet creation has since been performed end to end on the pushed head (2026-11-08, under a real pty; see README §18).

**Existing-wallet refusal.** This protects an existing wallet against replacement; it is not a housekeeping error. Stop and check which wallet location you selected. Do not delete or rename wallet files to make generation run. Keep the existing wallet and its backups intact, and use a separate disposable location for a fresh test.

## 10. Record recovery data and check generated files

1. **Make your recovery record before confirming.** Record:
   - your mnemonic;
   - the BIP-39 passphrase policy: **empty**;
   - the exact derivation path and policy for each chain;
   - the chain-specific wallet configuration;
   - the intended location of the `seed.enc.json` seed bundle.

   Your recovery set needs that seed bundle and its separately stored data key. Save the key now. The seed bundle is written only after both terminal confirmations.

2. **Complete both terminal confirmations.** Enter the first word of your mnemonic, then `SAVED`. Do not confirm storage until you have stored and checked your recovery material. If either confirmation fails, no write happens.

3. **Check the seed bundle and backup bundle.** Check that:
   - the secrets directory has mode `0700`;
   - `seed.enc.json` has mode `0600`;
   - the backup directory has mode `0700`;
   - the backup bundle contains a `0600` copy of the seed bundle, plus `decrypt_seed.py` and `docs/RECOVERY.md`.

   Symlinked paths are refused. The seed bundle uses AES-256-GCM, and the generator never writes the plaintext mnemonic to disk. Store the data key separately. Treat this as application-specific encryption at rest, not a universal backup standard.

4. **Check the public environment file.** The `.env` write is atomic, with mode `0600`. Check that it contains exactly these four entries, using your generated public values in place of the placeholders:

   ```dotenv
   XPUB_BTC=<btc-xpub>
   XPUB_ETH=<eth-xpub>
   XPUB_TRX=<trx-xpub>
   TON_DEPOSIT_ADDRESS=<ton-deposit-address>
   ```

   It must contain no mnemonic, private key or data key. An xpub is a watch-only capability, **not a wallet backup**.

5. **Read the completion report and keep recovery material private.** Look for `Wallet generation and public configuration update completed.` together with:
   - the four public values;
   - the seed bundle path with mode `0600`;
   - the backup bundle path.

   Compare the reported paths with your recorded locations. Keep the data key separate from both the seed bundle and the backup bundle. Never put secret recovery material in source control, issues, chat, CI logs or test fixtures.

## 11. Backup acceptance and generation failures

1. **Record and compare before confirming.** Your recovery records must agree with the terminal display. If the terminal is unavailable or anything differs, stop before confirming. Never redirect secrets into logs.

2. **Respect the generation checks.** The deterministic checks and public round trips establish that the documented checks completed, not that recovery works. If a check fails, hold public release and investigate with a maintainer. Exact diagnostics and exit codes for failed checks are not documented.

3. **Check the write, and pause after a crash.** A seed bundle at `0600` meets the disk-write condition; it is not a restore test. After a write failure, interruption or permission mismatch, treat completion as unverified and keep recovery material offline. Check crash, retry and overwrite safety before trying again.

4. **Back up the actual seed bundle.** Use the file actually created, not a guessed filename. Make a protected offline copy and check it against the original. Store the data key separately. A matching copy establishes copy integrity only.

5. **Prove recovery separately.** Only a successful, separate restore test with `decrypt_seed.py`, using the backup copy, proves recovery from that copy. If recovery fails or the procedure is unavailable, keep recovery marked **unverified**.

## 12. Recovery drill and pre-funding gate

**This drill has NEVER been executed. It remains an open item.** (V1's decrypt round trip on 2026-11-08 is not this drill.) It must also be runnable on a clean install with disposable fixtures drawn only from published test vectors, with expected addresses, a testnet signing check, pass criteria and a sanitised record.

1. **Gather your recovery pack.** You need:
   - the BIP-39 mnemonic, or the `seed.enc.json` seed bundle plus its separate 32-byte data key;
   - the exact BIP-39 passphrase policy, currently **empty**;
   - the chain derivation paths and address policy;
   - the network and chain configuration;
   - the TON wallet configuration, where applicable;
   - the recorded original public addresses for comparison.

   An xpub or zpub cannot recover the wallet.

2. **Recover on a clean, trusted machine.** Keep screen sharing and terminal recording off. From the repository root in an interactive terminal, run the following command and enter the recorded path to your seed bundle:

   ```sh
   printf 'Path to seed.enc.json: ' && IFS= read -r seed_bundle_path && python3 tools/decrypt_seed.py "$seed_bundle_path"
   ```

   > **Expected result**
   >
   > After you enter the file path, `decrypt_seed.py` asks for the data key. With a valid seed bundle and matching key, it displays the mnemonic on the controlling terminal by default.

   Use `--stdout` only for an explicit, controlled pipeline. The `--output` option writes an atomic plaintext file at `0600`; keep any such file offline, outside shared folders and the development tree. If you backed up the mnemonic directly, use that offline copy instead.

3. **Restore the original settings.** Verify the mnemonic and BIP-39 passphrase policy against your recovery records. The BIP-39 passphrase is empty: do not add one during the drill or substitute a vault unlock passphrase.

   Apply the recorded derivation paths, address policy, and network and chain configuration. For TON, preserve the original wallet contract and version, derivation convention, workchain, network presentation, wallet ID and subwallet ID.

4. **Compare public outputs.** Derive known public addresses from the restored wallet for each chain. Compare them with your recorded originals using the original address and network presentation. Investigate any mismatch. Do not fund the wallet until the public outputs match.

5. **Verify the retained backup and separate the key.** Restore from **the backup copy you will keep** and repeat the address comparison. A file merely existing is not enough. Keep the data key stored separately, and keep secret material out of online and development channels.

**Pre-funding gate — tick every box before funding:**

- [ ] Restore tested.
- [ ] Public addresses match the recorded originals.
- [ ] Retained backup copy verified by restoring from that copy.
- [ ] Data key stored separately from the seed bundle and backup bundle.
- [ ] No secret material in any online or development channel.

## 13. Sources

- [Wasabi Testnet guide](https://docs.wasabiwallet.io/using-wasabi/Testnet.html).
- [BitPay testnet wallet guide](https://support.bitpay.com/hc/en-us/articles/360015463612-How-to-Create-a-Testnet-Wallet) — returned `403` to an automated check on 8 November 2026; existence confirmed via the Zendesk public API. Keep this dated check note with the link.
- [Trust Wallet Core HDWallet API](https://github.com/trustwallet/wallet-core/blob/master/src/HDWallet.h).
