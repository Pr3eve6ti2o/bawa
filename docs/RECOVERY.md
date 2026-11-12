---
title: Recovery Procedure
description: Recover a Bawa wallet from the mnemonic or the encrypted seed bundle, test the recovery before funding, and handle compromised seeds, device loss, backup separation, disaster and inheritance; testnet only, with disposable test fixtures.
last-updated: 2026-11-08
---

# Recovery procedure

How-to guide.

## Contents

- [Part 1: Recovery, the full procedure](#part-1-recovery-the-full-procedure)
- [Part 2: The encrypted-seed decryption workflow, part 1](#part-2-the-encrypted-seed-decryption-workflow-part-1-the-artefact-the-key-and-the-output-modes)
- [Part 2: The encrypted-seed decryption workflow, part 2](#part-2-the-encrypted-seed-decryption-workflow-part-2-refusals-failures-and-clean-up)
- [Part 3: What recovery cannot do](#part-3-what-recovery-cannot-do)
- [Part 4: Backup testing, playbooks, separation, disaster and inheritance](#part-4-backup-testing-playbooks-separation-disaster-and-inheritance)
- [Sources](#sources)

## Part 1: Recovery, the full procedure

Follow this guide in four parts:

1. Full recovery procedure (this part).
2. Encrypted-seed decryption workflow.
3. What recovery cannot do.
4. Backup testing, playbooks, separation, disaster and inheritance.

Use recovery to restore access from the mnemonic and its exact BIP-39 passphrase. Recovery cannot recover a lost mnemonic, a lost passphrase or funds already moved.

Live wallet creation and recovery were verified end to end against a live run on 8 November 2026 (V1, pushed head 082f7915): generation under a real pty, decrypt round trip byte-identical, differential test PASS. V1 records verification at 082f7915. That run does not establish verification of the later symlink-guard changes or of the decryption code at pinned head e3b65fb832db287fdc8d54794980dd0b3456cc12 or current head 754721cd. That verifies the procedure, not your backup: do not claim your recovery is tested until you have executed a rehearsal on a clean install and recorded it.

### Required recovery material

Preserve the BIP-39 mnemonic, or preserve the generated encrypted seed bundle, seed.enc.json, and keep its 32-byte data key separate from the bundle. Never paste a real mnemonic or data key anywhere.

In either case, preserve:

- the exact BIP-39 passphrase policy (currently empty);
- the chain derivation paths and address policy;
- the network/chain configuration;
- the TON wallet configuration, where applicable.

For TON, preserve the wallet contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID used by the original system.

Do not rely on an xpub or zpub to recover the wallet. It can reproduce only public descendants below the exported account node.

### Derivation policy and seed construction

Use derivation policy bawa-derivation-policy-v1, with BIP-39 256-bit entropy, a 24-word mnemonic and an empty BIP-39 passphrase. Preserve these fixed paths:

- BTC: m/84'/0'/0'/0/i
- ETH: m/44'/60'/0'/0/i
- TRX: m/44'/195'/0'/0/i
- TON: generation-only from m/44'/607'/0'

NFKD-normalise the mnemonic and the BIP-39 passphrase, then derive the 64-byte seed with PBKDF2-HMAC-SHA512, using 2,048 iterations and the salt "mnemonic" plus the normalised passphrase.

### Access the encrypted backup

On a trusted machine, invoke the decryption utility through Python. The file has mode 644 and is not executable.

```
python3 tools/decrypt_seed.py
```

> **Expected result:**
> The utility asks for the data key and displays the mnemonic on the controlling terminal by default.

Use --stdout only for an explicit, controlled pipeline, or --output for an atomic 0600 plaintext file.

### Rehearse before funding

Run this procedure while a new wallet is still empty. Restore from the actual backup on a clean install on a trusted machine, not from memory or a wallet session that already holds the seed.

Do not treat a wallet application accepting the mnemonic as proof of recovery. Verify the mnemonic and passphrase, derive known public addresses using the preserved derivation policy and original configuration, and compare them with the recorded originals.

> **Expected result:**
> The clean restore reproduces the public outputs recorded for the original wallet.

**Do not fund the restored wallet until the public outputs match.**

### The recovery record

Record the rehearsal and the result of comparing the restored public outputs with the recorded originals. Keep the record free of wallet secrets, and do not mark recovery as tested without an executed and recorded clean-install rehearsal.

### Procedure

### 1. Establish the backup and independent comparison targets

For a pre-funding rehearsal, complete the written or encrypted backup first. Record public addresses from the original wallet, together with the configuration and derivation selectors needed to reproduce each address.

For a later recovery, use those pre-existing originals. Do not populate an expected-address field with an address produced by the restore being tested.

Identify the secret-recovery route to test. Do not treat a successful recovery from the written mnemonic as a test of the encrypted file and its saved data key.

If no independent original public output is available, recover that evidence before treating the wallet as verified. Do not pass the comparison check without it.

> **Expected result:** A complete backup route, an explicit passphrase-policy record, the original configuration and a separate list of expected public outputs with their derivation selectors.

### 2. Prepare a clean, trusted machine

Use a clean operating system from trusted installation media, together with a Bawa checkout and dependencies you have checked. Do not treat restoration of an old wallet directory or an entire old home directory as a clean recovery test.

Complete software installation before introducing secret material. Where the tooling permits, perform secret recovery and public-address derivation offline.

Use a private local terminal without session recording or shell tracing. Keep recovery work out of synchronised folders, screenshots, shared logs and support tickets. Avoid clipboard history and other facilities that retain secret input. Never paste a real mnemonic or data key anywhere.

Start with fresh wallet state. Ensure that no previously loaded mnemonic, seed or extended public key can supply the addresses used in the test.

> **Expected result:** A known software environment with fresh wallet state and no recording or synchronisation configured to capture secret input or terminal output.

### 3. Recover the mnemonic from the preserved material

For the mnemonic route, read from the actual written backup. Do not substitute the original application's display or a remembered copy; test the material that was preserved.

For the encrypted route, run the following command on the trusted machine. Invoke the utility through Python because the file has mode 644 and is not executable.

```sh
python3 tools/decrypt_seed.py
```

Type the separate data key when the utility asks for it. Do not place it in the command line.

Keep the controlling terminal private: by default, the utility displays the mnemonic there.

Use the --stdout option only for an explicit, controlled pipeline whose destinations and logging behaviour you understand. Use the --output option with a plaintext output path only when an atomic plaintext file with mode 0600 is required. Treat mode 0600 as owner read/write permissions, not as encryption or protection against a compromised host.

> **Expected result:** A mnemonic recovered locally from the preserved material. On the default encrypted route, the utility requests the data key and displays the mnemonic on the controlling terminal, without involving a website or remote recovery service.

### 4. Validate the mnemonic and set the exact passphrase policy

Use trusted local BIP-39 tooling to check the word list, word count, order and checksum. Treat the checksum as a way to detect many transcription mistakes, not as proof that the mnemonic belongs to the intended wallet.

Use **bawa-derivation-policy-v1** as the current Bawa reference policy: BIP-39 with 256-bit entropy, 24 words and an empty passphrase. Retain its fixed paths:

- BTC: m/84'/0'/0'/0/i
- ETH: m/44'/60'/0'/0/i
- TRX: m/44'/195'/0'/0/i
- TON: generation-only from m/44'/607'/0'

For this reference policy, set the BIP-39 passphrase to **zero characters**. Do not enter a space, a word describing the empty policy, the artefact's data key or an application password.

If the original record documents a departure from the current empty policy, reproduce that historical passphrase policy exactly. Do not silently replace it with today's default. Ensure that any non-empty passphrase is itself recoverable; do not rely on a note saying only that one existed.

NFKD-normalise the mnemonic and the BIP-39 passphrase. Then derive the **64-byte seed** with **PBKDF2-HMAC-SHA512**, using **2,048 iterations**, the normalised mnemonic as the password, and the literal string **"mnemonic"** concatenated with the normalised passphrase as the salt.

Do not rely on a "wrong password" error to detect an incorrect BIP-39 passphrase: a wrong passphrase can produce another valid wallet. Use the independent address comparison to establish whether the intended wallet has been recovered.

> **Expected result:** A locally validated mnemonic and an explicitly selected passphrase policy matching the original record. For the current reference policy, the passphrase contains no characters. Treat this as a necessary check, not yet permission to fund.

### 5. Restore the chain, derivation and address settings

Apply the recorded settings explicitly rather than accepting the restoring tool's defaults.

Treat the following entries as **recovery guidance for your own backup**, not as reported test results for your assets. Do not identify any asset as **tested** from this section alone: the live verification (V1, 8 November 2026) exercised the recovery procedure end to end on a generated test wallet (decrypt round trip byte-identical), not your backup. Obtain each expected account-0 address form from the independent original record, because no asset-specific address forms are specified here.

Use this per-asset checklist for **bawa-derivation-policy-v1**:

- **BTC (theoretical)**
  - **Derivation path:** Apply m/84'/0'/0'/0/i with the recorded address index i.
  - **Expected account-0 address form:** Retain the form recorded for the independent original BTC address at that index.
  - **Verification method:** Derive the public address from the recovered material using the selected passphrase and recorded settings, then compare it with the pre-existing original.

- **ETH (theoretical)**
  - **Derivation path:** Apply m/44'/60'/0'/0/i with the recorded address index i.
  - **Expected account-0 address form:** Retain the form recorded for the independent original ETH address at that index.
  - **Verification method:** Derive the public address from the recovered material using the selected passphrase and recorded settings, then compare it with the pre-existing original.

- **TRX (theoretical)**
  - **Derivation path:** Apply m/44'/195'/0'/0/i with the recorded address index i.
  - **Expected account-0 address form:** Retain the form recorded for the independent original TRX address at that index.
  - **Verification method:** Derive the public address from the recovered material using the selected passphrase and recorded settings, then compare it with the pre-existing original.

- **TON (theoretical recovery, generation-only policy)**
  - **Derivation path:** Restrict the policy claim to generation from m/44'/607'/0'.
  - **Expected account-0 address form:** Retain the form recorded for the independent original TON output.
  - **Verification method:** Compare the generated public output with the pre-existing original using its recorded configuration. Do not describe this generation comparison as evidence of a tested TON recovery procedure.

> **Expected result:** Explicit chain, derivation and address settings tied to independent original account-0 outputs, with verification claims limited to recorded evidence. Keep missing address-form information or an incomplete comparison unresolved; do not treat either as a successful recovery.

This procedure was demonstrated end to end on a generated test wallet (V1, 8 November 2026, pushed head 082f7915); it is not a test of your backup. V1 records verification at 082f7915. That run does not establish verification of any later change — including the symlink-guard changes, the decryption-code changes at pinned head e3b65fb832db287fdc8d54794980dd0b3456cc12, and the T41 confirmation and key-handoff changes — so re-demonstrate the procedure end to end at the current head before relying on it. Never paste a real mnemonic or data key anywhere.

### 6. Restore the TON configuration exactly, where applicable

Where TON is in scope, do not rely on matching mnemonic words alone. Check all five recorded fields:

- **Wallet contract/version.** Use the original contract and version, not whichever version a replacement tool currently recommends, because the wallet address depends on wallet construction as well as key material.
- **Derivation convention.** Reproduce the original method of turning the mnemonic, passphrase or seed into TON key material, including any path or indexing convention. Do not treat another TON application accepting a mnemonic as proof of compatible derivation.
- **Workchain.** Restore the exact workchain. Treat it as part of the address identity, not an account label.
- **Network presentation.** Preserve the original network setting and address representation, including network indicators and presentation flags where applicable. Distinguish raw and user-friendly forms, explain any presentation differences and reproduce the recorded form.
- **Wallet/subwallet ID.** Restore the original identifier. Do not substitute an address index or assume that another library's default is equivalent.

Resolve every configuration difference before continuing. Do not waive verification because a difference changes only the address presentation rather than the address itself. If TON is outside this recovery's scope, explicitly record it as not applicable.

> **Expected result:** A configuration that agrees field by field with the recovery record, with public outputs ready to be derived from recovered secret material rather than cached wallet state. All five TON fields match the original record, with no unresolved default or convention, or TON is explicitly recorded as not applicable.

### 7. Derive the known public addresses and compare them

Derive the public outputs identified in the recovery record using the restored mnemonic, exact passphrase policy and recorded settings. Use recovered secret material, not cached wallet state.

Compare the derived account-0 addresses with their independent comparison targets. At minimum, compare the first receiving address recorded before funding for each chain/account you intend to use. Compare additional recorded receiving indices and change addresses where available. Do not treat one matching address on one chain as verification of another chain's policy.

Compare the **whole address**, not only its beginning and end. Use the recorded representation. If a tool presents another valid encoding, reproduce the original presentation before completing the comparison. Do not edit the expected original to make the test pass.

For each comparison, retain a public-only record of:

- the chain/network and derivation selector;
- the relevant address policy or TON configuration reference;
- the recorded original public output;
- the restored public output;
- whether they match.

Treat any mismatch as a **hard stop**, not a warning to work around. Stop and recheck transcription, passphrase policy, paths, indices, address policy, network settings and TON configuration as applicable. Do not send a small deposit as a diagnostic. Do not substitute a valid checksum, successful decryption or plausible balance for the public-output comparison.

> **Expected result:** Every tested public output matches its independent recorded original under the recorded policy. Any unexplained mismatch leaves recovery unverified and funding blocked.

### 8. Repeat independently where practical

Where possible, repeat the recovery on a second clean installation, preferably while the wallet is still empty. Use the preserved backup and the same independent recorded originals again.

Do not clone the first restored wallet directory. Test the backup and configuration record, not state carried over from the first restore.

Treat this repetition as an additional operational check, not a different derivation rule. If you cannot perform it, record that limitation rather than describing the recovery as independently repeated.

> **Expected result:** The second clean restore reproduces the same recorded public outputs, or the record explicitly states that this additional check was not performed. A mismatch on either installation remains a blocking failure.

### 9. Record the result, remove transient secrets and apply the funding gate

Keep a dated, sanitised verification record containing the software reference, configuration identifiers, public comparisons and second-install status. Do not include any mnemonic, passphrase, data key or terminal capture.

Retain the durable recovery backups under appropriate separate custody. After the procedure, remove transient secrets from the machine. Remove unnecessary temporary plaintext files and close secret-bearing terminal sessions. Do not treat file deletion as assured erasure on modern storage, snapshots or backups. Avoid creating persistent plaintext copies in the first place.

**Do not fund a restored wallet until the derived account-0 addresses match the independent comparison targets.** Permit funding only after the required public-output comparisons succeed, with no unresolved mismatches. For an existing wallet, apply the same rule before sending further funds to the restored wallet.

> **Expected result:** A secret-free verification record, retained recovery material under appropriate separate custody, transient secrets removed from the machine and no unresolved comparison failures. Funding remains blocked if any required output has not matched.

## Part 2: The encrypted-seed decryption workflow, part 1: the artefact, the key and the output modes

Use a trusted machine and decide where the plaintext may go before starting recovery, because decryption exposes the wallet's mnemonic. Never paste a real mnemonic or data key anywhere.

### 1. Identify the encrypted backup

Identify the seed artefact, represented here by `/path/to/seed.enc.json`, as an AES-256-GCM-encrypted backup, not a readable list of recovery words.

Keep these three inputs distinct:

- **Nonce:** Keep this per-encryption value, stored with the backup, paired with its ciphertext. It is not secret.
- **Ciphertext:** Treat this as the encrypted recovery material. GCM provides authentication as well as encryption, so decryption checks integrity rather than merely producing plaintext.
- **Associated data (AAD):** Recognise `b"nova-shop-seed-v1"` as the exact AAD used by the tool. These fixed bytes are authenticated but not encrypted. Do not treat them as the data key or enter them at the key prompt.

Use the matching key with the original nonce and ciphertext and that exact AAD. Expect authentication to fail with a wrong key or altered input. Do not edit the backup to try to make it decrypt.

> **Expected result:**
>
> Expect an encrypted backup containing nonce and ciphertext data, not plaintext mnemonic words. Treat the AAD as fixed by the tool, not as another secret to retrieve.

### 2. Supply the 32-byte data key

Expect the tool to look for `BAWA_DATA_KEY` first:

- A **non-empty** value is used as the hexadecimal key.
- If the variable is **unset or empty**, the tool asks interactively with `Bawa data key (hex): `. The prompt does not echo the key.

For either route, supply 64 hexadecimal digits, represented here by `<YOUR-32-BYTE-HEX-KEY>`. Both routes strip surrounding whitespace and then decode hexadecimal. The decoded result must be **exactly 32 bytes**. Supply a data-encryption key, not a password, mnemonic or wallet private key.

Expect invalid hexadecimal to be rejected. A decoded value of any other length raises `data key must be exactly 32 bytes`. Do not expect a bad non-empty environment value to trigger a retry through the prompt.

For manual recovery, prefer the prompt. For automation, inject the environment variable through a protected secret-handling mechanism. Do not place the real key in a shell command that may enter history, in a script or in a job log.

> **Expected result:**
>
> Expect the key prompt when the variable is unset or empty, and no key prompt when it has a non-empty value. Treat a successful length check as confirmation of the key's size only; authentication establishes whether it matches the backup.

Choose **one** of the following output modes. Treat steps 3, 4 and 5 as alternatives, not a sequence to run. `--stdout` and `--output` are mutually exclusive.

### 3. Use the default for private, attended recovery

Run `python3 tools/decrypt_seed.py` with neither output flag when you need to read the mnemonic directly. Invoke the script through Python, because `tools/decrypt_seed.py` has file mode `644` and is not executable.

The default writes the decrypted mnemonic to the **controlling terminal** for attended use, not to ordinary stdout. Redirecting stdout therefore does not capture the mnemonic. The tool does not write plaintext to disk in this mode.

Use this mode only on a private terminal without session recording, terminal logging, screen sharing or an untrusted observer. Remember that terminal software can still record what the tool displays.

Without a controlling terminal, expect the tool to fail with:

`no controlling terminal; use --stdout or --output explicitly`

Treat this refusal as deliberate. Do not expect an automatic fallback to stdout.

> **Expected result:**
>
> Expect the mnemonic on the controlling terminal, not on ordinary stdout or in a plaintext file written by the tool. Without a controlling terminal, expect the explicit error above.

### 4. Use `--stdout` only for a controlled pipeline

Select `--stdout` only when an explicit, machine-readable pipeline is genuinely required. Use this mode to pipe the decrypted mnemonic to another command through ordinary stdout.

Control the receiving program, intermediate commands and logging around the whole pipeline. Confirm that they will not echo, retain or forward the plaintext unexpectedly. Avoid `tee`, diagnostic capture and general CI or job logs.

Do not select this mode merely as a workaround for a missing terminal. Do not rely on shell redirection for the atomic-write or `0600` guarantees of `--output`; the shell controls creation of a redirected file.

> **Expected result:**
>
> Expect the intended consumer to receive the mnemonic through the pipeline, with no plaintext appearing in console transcripts, pipeline logs or unintended files.

### 5. Use `--output` only when a plaintext file is necessary

Select `--output` only when a recovery step requires a plaintext file. This mode writes the decrypted mnemonic to a file with atomic-write and `0600` guarantees.

Treat the plaintext file as a **live secret**. Delete it as soon as the recovery step that needed it is done, and record the deletion.

> **Expected result:**
>
> Expect the decrypted mnemonic in the required plaintext file. After completing the recovery step that needed it, confirm that you have deleted the file and recorded the deletion.

## Part 2: The encrypted-seed decryption workflow, part 2: refusals, failures and clean-up

Treat a refusal from `tools/decrypt_seed.py` as a reason to check the paths, the backup and its data-key pairing, not to weaken the checks. Never paste a real mnemonic or data key anywhere.

### 1. Check the encrypted artefact path

Use a direct path to the encrypted artefact, such as `/path/to/seed.enc.json`. Pass the artefact path as the positional argument:

```sh
python3 tools/decrypt_seed.py /path/to/seed.enc.json
```

If the positional path is omitted, the tool uses `secrets/seed.enc.json`.

The tool checks whether the path is a symbolic link before loading its JSON and refuses a linked artefact even if its target appears valid.

If you find an unexpected link, establish which file you intended to recover before trying again. Do not blindly follow the link.

> **Expected result:** a Python traceback ending with `ValueError: refusing symlinked encrypted artifact`, with exit status `1`, for a symlinked input.

The refusals `data key must be exactly 32 bytes` and `malformed encrypted artifact` are also raised as uncaught `ValueError`s, producing Python tracebacks and exit status `1`. By contrast, a symlinked `--output` path, including a dangling symlink, is rejected with `refusing symlinked output path` and exit status `1` without a traceback. Without a controlling terminal and with neither `--stdout` nor `--output`, the tool reports `no controlling terminal; use --stdout or --output explicitly` and exits with status `1` without a traceback.

### 2. Check the output and temporary paths

With `--output`, choose a destination you control, such as `/path/to/recovered-mnemonic.txt`. An output path that is a symlink is rejected with `refusing symlinked output path`, including a dangling symlink whose target does not exist.

Expect the temporary output path to be protected too. A symlink there is refused. The temporary file is created with `O_EXCL` and permissions `0600`. If creation raises FileExistsError, the tool refuses a symlink at the temporary path; otherwise it unlinks that path and retries creation. A pre-existing non-symlink temporary file can therefore be silently removed and recreated. Successful writing places the final file atomically and explicitly sets its permissions to `0600`, owner read and write only.

Investigate unexpected temporary entries rather than deleting them blindly or disabling these safeguards.

> **Expected result:** A refusal for an existing symlinked output path or a symlinked temporary path. A successful write leaves the final file with mode `0600`.

### 3. Recognise an unsupported algorithm

Check that the artefact's `alg` value is exactly `AES-256-GCM`. A different value or a missing algorithm label is not accepted. There is no fallback to another encryption scheme.

Do not edit the label to force acceptance. Changing metadata does not convert the encrypted payload. Check that you have a compatible backup.

> **Expected result:** `unsupported encryption algorithm`, with no decryption attempted for that artefact.

### 4. Distinguish malformed data from authentication failure

Expect strict Base64 decoding for the nonce and ciphertext fields. After decoding, the nonce must be exactly 12 bytes, and the ciphertext must contain at least 16 bytes, allowing for the authentication tag.

Distinguish these length checks from earlier structural failures. Invalid JSON, missing `nonce_b64` or `ciphertext_b64` fields, and invalid Base64 can fail during loading or decoding. They need not produce the same message as the explicit length checks.

Check the backup's provenance and transfer integrity. Do not "repair" encrypted bytes by guessing, padding or trimming them.

> **Expected result:** `malformed AES-GCM artifact` for an invalid nonce or ciphertext length, or a parsing, field-access or decoding error for earlier structural problems.

### 5. Treat authentication failure as a hard stop

Stop if the structural checks pass but AES-GCM authentication fails. Authentication failure means the data key is wrong or the artefact is damaged. A correctly formed but wrong key, altered encrypted data or a mismatch in the additional authenticated data (`AAD`) can cause this failure.

Do not infer from this failure whether the key is wrong or the artefact has been tampered with. Recheck the intended backup/key pairing through trusted records.

Do not guess further keys, and do not retry with a different tool. Do not bypass authentication or assume that retrying with the same inputs will repair anything.

> **Expected result:** An authentication failure rather than recovered text. The decryption function returns no mnemonic.

### 6. Understand the mnemonic-shape check

After successful authentication, expect the tool to decode the plaintext as UTF-8 and split it on whitespace. It accepts only 12, 15, 18, 21 or 24 words. Any other count produces the mnemonic-shape refusal. Invalid UTF-8 fails decoding instead.

Treat this as a word-count check only. It does not verify BIP-39 word-list membership or the checksum. Do not add or remove words to make rejected text pass.

> **Expected result:** `recovered data does not look like a BIP-39 mnemonic` for a rejected word count. Passing this check alone does not establish that the phrase is the intended wallet backup.

Distinguish a BIP-39 passphrase mistake from data-key authentication failure. A wrong BIP-39 passphrase does not produce an error; it derives a different wallet, so a passphrase mistake looks like an empty wallet.

### 7. Decide the destination first, then clean up

Before decrypting, not after plaintext appears, choose either the default terminal display or file output with `--output /path/to/recovered-mnemonic.txt`.

Invoke the tool with `python3 tools/decrypt_seed.py`. The file has mode `644`, so it is not executable.

When cleaning up afterwards, investigate unexpected temporary entries rather than deleting them blindly, and keep the safeguards in place.

## Part 3: What recovery cannot do

### 1. An xpub or zpub cannot recover the wallet

Treat an xpub or zpub as public material, not as a substitute for the secret backup. An account export reproduces only public descendants below the exported account node. It cannot spend or recover the wallet, recreate the mnemonic or private keys, or recover other accounts.

Use an address match only to confirm agreement in public derivation. Do not treat it as proof of spending recovery.

> **Expected result:** A public-only, watch-only result. Addresses can match, but signing with the xpub or zpub alone cannot succeed.

### 2. A wrong BIP-39 passphrase does not produce an error

Do not expect a "wrong passphrase" error. BIP-39 processes the mnemonic through PBKDF2 with the passphrase included in the salt, so every passphrase yields a valid, different wallet. A wrong passphrase, whether caused by a typo, a capital letter or a trailing space, derives a different, apparently empty wallet.

Use Bawa's current **empty-passphrase** policy exactly: no characters at all, including spaces. If you cannot verify the mnemonic and the exact passphrase policy, mark recovery **incomplete** and **do not fund** the wallet.

> **Expected result:** Agreement with a previously recorded reference, such as `<RECORDED_WALLET_FINGERPRINT>` or `<RECORDED_RECEIVING_ADDRESS>`, using the original derivation policy. Treat this as an identification cross-check, not proof of spending capability. Do not accept the absence of an error or a zero balance as evidence of recovery.

### 3. The mnemonic does not contain a lost passphrase

Do not rely on the mnemonic to supply a lost BIP-39 passphrase. For a passphrase-protected wallet, the mnemonic alone is insufficient. Without the exact passphrase, you cannot restore that wallet or spend its funds.

Bawa does not document non-empty passphrase setup or lost-passphrase handling. No check reveals the missing passphrase from the mnemonic.

> **Expected result:** Restoring the mnemonic with an empty passphrase recovers only the main, empty-passphrase wallet, not the protected wallet. Do not treat access to the main wallet as verification of the protected wallet's recovery.

### 4. Losing the seed and its backup loses the wallet

Do not expect recovery when the seed and every usable backup are gone. The wallet is lost. No reset, support desk or procedure can recreate the secret.

Use a recorded address or xpub only as a comparison target. If you still have the mnemonic, use that reference to test remembered passphrase candidates one by one under the same derivation policy. The reference cannot supply a forgotten passphrase or reconstruct a lost mnemonic.

> **Expected result:** A correct candidate reproduces `<RECORDED_RECEIVING_ADDRESS>` or `<RECORDED_ACCOUNT_XPUB>` when the mnemonic and derivation policy are also correct. If the seed and every usable backup are gone, no recovery check can bring them back.

### 5. A checksum does not identify your wallet

Treat a passing BIP-39 checksum as a check of internal consistency only, not proof that the words are yours. Another valid mnemonic passes too.

The checksum does not test the passphrase, derivation path, account selection or address policy. A valid mnemonic used with the wrong policy still leads to the wrong wallet. Do not sign off recovery on a checksum result.

> **Expected result:** Reproduction of `<RECORDED_RECEIVING_ADDRESS>` under the exact derivation policy as a separate identification check. A checksum pass alone is insufficient, and an address match still does not prove signing capability.

### 6. Changing local access does not repair an exposed seed

Do not treat changes to a device PIN or app password, or an app reinstall, as a remedy for an exposed seed. Changing the vault unlock passphrase cannot secure an exposed mnemonic. These actions affect local access only; they do not revoke the seed or affect copies of the words held elsewhere.

With Bawa's empty-passphrase policy, anyone holding the words can rebuild the wallet on their own device. Treat an exposed seed as compromised. Move remaining funds to a wallet with a newly generated mnemonic and verified recovery, not merely another account under the exposed seed. Retire the old wallet.

> **Expected result:** Confirmed transfers to `<NEW_WALLET_RECEIVING_ADDRESS>`, with that address independently verified against the new wallet. No check can make the exposed seed secret again.

### 7. "Support" and "recovery services" are not a recovery route

Reject any offer to recover a lost mnemonic or passphrase for a fee. Such an offer is a scam. Neither a support contact nor a paid recovery service can bypass these missing-secret limits.

Treat anyone asking for the phrase as asking for control of the wallet, not proof of ownership. Never type the phrase into a website or share it with anyone. Stop any interaction that requires either. If you have already disclosed it, treat the seed as exposed and follow point 6.

> **Expected result:** No check makes handing over the phrase safe. Do not treat logos, testimonials or a successful address lookup as changing that.

## Part 4: Backup testing, playbooks, separation, disaster and inheritance

### Part 1: Backup-testing routine

Complete the pre-funding check before using a wallet with meaningful funds. Require an actual restore, a comparison with previously recorded addresses and a successful testnet signing check. Do not count a conceptual walkthrough or a 'restore complete' message as a passed recovery.

Keep every exercise below testnet-only. Use disposable test fixtures only, with a tiny testnet amount for transaction checks. Never use real funds for a rehearsal. Never paste a real mnemonic or data key anywhere.

Note that the rehearsal procedure was demonstrated end to end on a generated test wallet (V1, 8 November 2026, pushed head 082f7915); it is still not a test of your backup, so rehearse your own backup and record it. V1 records verification at 082f7915. That run does not establish verification of the later symlink-guard changes or of the decryption code at pinned head e3b65fb832db287fdc8d54794980dd0b3456cc12 or current head 754721cd.

1. **Start on a fresh machine.**

   Use a known-clean environment independent of the original wallet installation. Have the public recovery record ready, with the expected accounts and addresses, network and derivation policy written down before the drill. Do not erase your only working device to create the test environment.

   > **Expected result:** A clean recovery environment and reference values recorded before the drill, not generated during it.

2. **Name and prepare a clean wallet recovery setup.**

   Bawa's tools generate and decrypt seed material; they do not import a mnemonic into a wallet. Name the external wallet software or hardware recovery setup you will use and record its software and firmware versions, as applicable. Independently verify testnet compatibility for that setup and those versions. Obtain and install clean software using that wallet provider's own acquisition and release-verification instructions. For hardware recovery, use a trusted device with verified firmware. Keep mnemonic entry on the hardware device where that is the intended recovery method.

   > **Expected result:** A named external wallet recovery setup with the intended software and firmware versions recorded as applicable, provenance checked and testnet compatibility independently verified, with no existing wallet state mistaken for a recovery.

3. **Recover the test wallet from its mnemonic backup.**

   Use the backup intended for recovery of the disposable test wallet after a loss. Do not substitute an export from the still-working wallet. Enter the mnemonic recovered from that backup into the named wallet's recovery interface. Never enter a mnemonic into a website, support chat or remote-access session.

   > **Expected result:** Acceptance of the recovered mnemonic by the named wallet's recovery interface. Treat this as an intermediate result, not a passed drill.

4. **Apply the exact passphrase.**

   Match its characters, case and spacing. If the test wallet was created without a passphrase, use the empty-passphrase setting explicitly. Do not confuse the device PIN with the mnemonic passphrase. Do not rely on an error to identify a different passphrase, because it can produce a valid but different wallet without an error.

   > **Expected result:** The intended passphrase setting applied, with its correctness still to be proved by address comparison.

5. **Apply the exact derivation policy.**

   Match the recorded network, derivation path, account, address or script type, receive/change branch and address index, together with any wallet-specific settings. Do not assume that the recovery software's defaults match the original wallet.

   > **Expected result:** Every setting needed to reproduce the expected addresses matches the recovery record.

6. **Derive the expected addresses.**

   Derive each address at its recorded account and location using the recovered wallet. Do not import a reference address as a watch-only entry and mistake its appearance for successful key recovery.

   > **Expected result:** Addresses derived afresh from the recovered wallet using the recorded policy.

7. **Compare the derived addresses with the previously recorded values.**

   Compare every complete address and confirm the network. Do not check only a few leading or trailing characters. On any mismatch, stop and investigate the backup, passphrase and policy without disclosing secrets. Mark a mismatch or an omitted comparison as **FAIL**.

   > **Expected result:** Complete matches for all expected addresses on the intended network. Do not pass a drill that stops at 'restore' without these comparisons.

8. **Check signing with a tiny testnet amount.**

   After the address comparisons pass, receive a tiny testnet amount and make an outgoing testnet transfer using the recovered wallet. Check both transactions on the intended testnet to test signing as well as address derivation.

   > **Expected result:** A confirmed testnet receipt and a confirmed outgoing transaction signed by the recovered wallet, not merely a transaction prepared by the interface.

9. **Record the result and repeat the routine.**

   Keep a sanitised record containing the date, procedure version, **PASS** or **FAIL**, software and firmware versions, network, policy reference, compared addresses and testnet transaction references. Record failures too. Show **FAIL** for any unexecuted gate. Keep mnemonics, passphrases, private keys and data keys out of the record.

   Repeat the full routine quarterly, using only a tiny testnet amount. Repeat it after firmware updates, using the updated firmware, before resuming normal use.

   > **Expected result:** A dated recovery record with enough non-secret detail to reproduce the check, a next quarterly due date and a fresh result after each firmware update.

#### Procedure: clean-install recovery rehearsal

1. **Prepare disposable test fixtures and reference values.**

   Use disposable test fixtures only. Write down the expected accounts and complete addresses, together with the network and derivation policy, before beginning the restore. Do not replace these expectations with addresses generated during the rehearsal.

2. **Restore on a clean install.**

   Complete steps 1 through 7 of the backup-testing routine in order, using an environment independent of the original wallet installation. Recover the test mnemonic from its backup, apply the exact passphrase and derivation policy, and derive the addresses for the expected accounts. Compare every complete derived address with its pre-recorded expected value and confirm the network.

3. **Run the testnet signing check after the restore.**

   After the address comparisons pass, complete step 8 with a tiny testnet amount. Confirm both the receipt and the outgoing transaction on the intended testnet. Require the outgoing transaction to be signed by the recovered wallet, not merely prepared by the interface.

4. **Apply the pass criteria and record the result.**

   Mark **PASS** only when the disposable test fixtures have been restored on a clean install, the expected accounts and addresses were written down before the restore, every derived address matches its expected value on the intended network, and the testnet signing check succeeds.

   Mark **FAIL** for any mismatch, unsuccessful check or unexecuted gate. Do not pass an incomplete or unexecuted rehearsal.

   Record the date, procedure version and **PASS** or **FAIL** in a sanitised record, together with the non-secret details required by step 9. Exclude mnemonics, passphrases, private keys and data keys.

   > **Expected result:** **PASS** only after all pass criteria are met and the result is recorded. Show **FAIL** for an unexecuted gate.

### Part 2: Compromised-seed playbook

Put containment first. Revoke sessions and escalate the incident to the maintainers before starting recovery or migration. Never paste a real mnemonic or data key anywhere.

Treat a leaked seed (mnemonic) as permanently compromised. Anyone with the necessary seed material can derive the wallet's private keys and authorise spending; no account administrator can reset that authority. [2]

Follow Bawa's rule of replacement, not repair. Distinguish recovery on a trusted device from migration to a fresh seed. Do not rely on changing the vault unlock passphrase: it cannot secure an exposed mnemonic. Move the funds to a fresh wallet with an independent seed, not the old wallet with a new password.

1. **Generate a new wallet on a fresh trusted device.**

   Never generate the replacement on a device that may carry malware. Use an independent new seed, back it up, protect the backup and verify its receiving addresses for the relevant networks. Keep the new seed off the suspect device.

   Do not treat another account or address under the old seed as a replacement. Do not treat a PIN change as a replacement either.

   > **Expected result:** A separately backed-up wallet with an independent seed and verified destination addresses. The new seed has never entered the suspect device.

2. **Move every asset and token, then verify every receipt.**

   Work from a clean signing environment. Inventory every account and network used by the old wallet, including tokens and NFTs that its default balance screen may omit. Prioritise the highest-value non-native assets rather than emptying convenient accounts first.

   On each network, retain enough native gas coin for outgoing token transfers. Move the remaining spendable native gas coin last, allowing for the final transaction's own fee, especially where a sweeper bot may be watching.

   Do not assume a fee top-up will remain available. Bots can take incoming funds within seconds, so do not keep feeding an address that is being swept. [3]

   Verify receipt of each asset and token at the new wallet's address on the correct network. Do not treat a 'sent' banner or a submitted transaction as confirmation.

   > **Expected result:** Every inventoried asset and token confirmed under the new wallet's control, with transaction fees accounted for. Treat any missing receipt as an incomplete evacuation.

3. **Revoke old token approvals where useful and without risking further funds.**

   After evacuation, revoke outstanding approvals only where doing so serves a useful purpose and does not put further funds at risk. Do not replenish a compromised address merely to tidy up permissions.

   Do not mistake revocation for a repair. A holder of the leaked seed can sign new transactions and re-approve allowances. Never use revocation as a reason to keep using the wallet.

   Confirm any useful revocations, or record the reason for taking no action. Keep the old seed marked as compromised regardless.

   > **Expected result:** Any useful revocations confirmed, or a recorded reason for taking no action. The old seed remains marked as compromised.

4. **Retire the old wallet permanently.**

   Remove its addresses from payment instructions, saved destinations, automated deposit arrangements and routine account selection. Keep a non-secret incident record so the retirement is not forgotten.

   Never reuse the wallet, whether for an empty account, a new account derived from the same seed or a future deposit. An attacker can wait for that deposit.

   > **Expected result:** The replacement wallet holds every recovered asset and token, with no active arrangement directing deposits to the old wallet. The old seed is retired, not treated as repaired.

#### If funds are already gone

**Trace, notify and report.** Treat on-chain transfers as irreversible. For funds already taken, follow the only remaining steps: trace the transactions, notify any identifiable receiving exchange through its official channels and report the theft to the relevant authorities.

Preserve transaction references, addresses and timestamps, not secrets. An exchange may be able to act on assets it still controls, but do not mistake that possibility for an on-chain reversal or a promise of recovery. Never pay a 'recovery service'. [3]

> **Expected result:** An evidence record and any available exchange or reporting reference numbers, not a claimed reversal or a supposedly repaired seed.

### Part 3: Device-loss playbook

Treat device loss and seed compromise as different incidents. Remember that a lost device is not a lost wallet if the mnemonic and passphrase survive. Assess possible seed exposure or signing-key extraction before restoring.

1. **Classify the loss before restoring.**

   Use the restore path below only if the mnemonic backup and passphrase remain available and you have no reason to suspect seed exposure or signing-key extraction. If the seed may have been seen, copied or taken, or its signing keys may have been extracted, follow Part 2 instead.

   Treat a device stolen together with a backup copy as a seed-compromise incident. Do not treat another intact backup at home as cancelling that exposure. Do not rely on a device PIN to protect a stolen paper backup.

   Revoke sessions associated with the lost device where the service allows it.

   > **Expected result:** A clear choice between device-only recovery and seed-compromise handling. Suspected seed exposure or signing-key extraction leads to Part 2, not a simple restore.

2. **For device-only loss, restore on a clean, trusted replacement machine and verify addresses before use.**

   Restore the existing wallet from the preserved mnemonic backup, applying the exact passphrase and derivation policy. Follow Part 1's restore-and-compare sequence for account 0 and any other accounts you intend to use.

   Verify the derived account-0 addresses against the independent comparison targets (the previously recorded addresses). Compare the recovered addresses for any other intended accounts with their previously recorded addresses as well. Complete these checks before funding, receiving or spending. Do not rely on a balance display or a successful restore message. Stop on any mismatch.

   Record the dated result. Use only a tiny testnet amount for any transaction exercise.

   > **Expected result:** The existing wallet's recorded addresses are reproduced on the replacement machine. This is recovery of the same wallet, not creation of a different empty one.

3. **Keep the seed and device apart.**

   Never store the seed backup together with the device, whether in the same bag, drawer or safe. Use separate, independently protected locations.

   Arrange storage so that one theft does not hand over both the device and the material needed to reconstruct its wallet without the device's PIN. Use this separation to reduce the chance that one fire or accident destroys both access and recovery.

   > **Expected result:** The device and backup are stored and protected independently, so loss of one does not automatically expose or destroy the other.

### Backup separation, disaster recovery and inheritance

#### Step 1, separate backups by risk

Keep **2 to 3 offline copies** in places that do not share a fire or flood risk. Do not count two cupboards in one building, or two sites exposed to the same flood, as separate disaster boundaries.

Never store the seed backup with the wallet device.

For Bawa's application-specific encrypted artefact, keep `seed.enc.json`, its separate **32-byte data key** and the offline mnemonic in different places.

Keep the mnemonic, the **BIP-39 passphrase** and the data key in separate places, so no single loss or theft exposes the wallet. If you do not use a passphrase, treat mnemonic theft alone as compromise.

Preserve this separation when making additional copies. Never put the artefact, data key and mnemonic together and call the bundle an "encrypted backup". Treat the encrypted file and its key as complementary material, not two independent recovery copies.

> **Expected result:** A location plan showing 2 to 3 offline copies across separate disaster risks, with distinct storage for the artefact, data key and mnemonic. Any BIP-39 passphrase is separate from the mnemonic and data key. No seed backup is kept with the device.

#### Step 2, choose media and record access controls

Choose backup media and protective storage for the risks at each location. Bawa does not prescribe either.

- **Paper:** Allow for degradation, fire and water damage. Use protective packaging with the understanding that it helps but does not remove these failure modes.
- **Metal:** Do not mistake resistance to fire and water for secrecy. Treat a stolen metal seed backup as giving full spending access unless a separately held BIP-39 passphrase is required.

For **every copy**, record its medium, custodian, authorised access and physical theft controls, such as locked storage and procedures for releasing it. Keep this inventory restricted and free of recovery secrets.

**Never digitise the mnemonic.** Do not photograph it or put it in cloud storage, email, notes apps or password managers. Remember that a photo can sync automatically, and that a compromised master password can expose the seed alongside everything else in the same vault.

> **Expected result:** A physical backup medium chosen for each location's risks, recorded access controls for every copy and no digital copies of the mnemonic.

#### Step 3, verify recovery over time

Inspect every copy periodically for readability and damage, without photographing it.

Test independent recovery before relying on a backup. Use a trusted recovery setup without erasing the only working wallet. Confirm that recovery produces the **expected wallet**, not merely that an import completes.

Re-test **annually and after firmware updates**, including any separately held BIP-39 passphrase required by the recovery route. Record the date and outcome, not the secrets. Schedule the next annual test, and treat an untested backup as **unproven**.

> **Expected result:** A dated, non-secret record of readability checks and successful independent recovery tests, with the next annual test scheduled.

#### Step 4, record the disaster responses

Write down how to respond to each event:

- **Fire or flood destroys one location:** Recover using a separated copy. Do not make recovery depend on retrieving anything from the damaged site. Once you have restored access, replace the lost backup capacity without undoing the separation.
- **One copy is stolen:** Use the recorded physical access controls and, where used, a BIP-39 passphrase held separately from the mnemonic as defences. Do not confuse that passphrase with Bawa's data key. Treat theft of both the mnemonic and its passphrase as compromise. Without a passphrase, treat mnemonic theft alone as compromise. Treat theft of `seed.enc.json` together with its data key as exposure of the stored secret. Following compromise, move funds to a fresh wallet with new recovery material.
- **The only copy is lost:** Treat this as the **lost-wallet case**, with no backup recovery route. Check whether a still-working device lets you move funds to a newly backed-up wallet. Without that access or surviving recovery material, Bawa cannot recover the funds.

> **Expected result:** A usable fallback after losing one site, a clear compromise response after theft and no promise of recovery when the last usable recovery route is gone.

#### Step 5, leave an inheritance route

Treat this as **an outline, not legal advice**. Do not assume legal entitlement recreates a seed. Heirs cannot access funds without the recovery material.

Leave written instructions in plain language, separate from any legal will. Name a trusted person and record the recovery material's locations, never the material itself. Explain:

- where to find each required item;
- who can authorise or provide access;
- how to use the material through the tested recovery procedure;
- where to obtain any separately held BIP-39 passphrase.

Do not include the mnemonic, passphrase, data key or other recovery secrets in these instructions.

Discuss these options with an **estate professional familiar with digital assets**:

- A sealed envelope of instructions held by a trusted executor.
- A time-locked multisig arrangement in which a trusted party holds one key. Plan and test this in advance, rather than relying on a note describing it.

Never embed the mnemonic in a legal will, as the will may become public or be widely circulated.

> **Expected result:** Instructions an authorised heir or executor can understand and follow, naming a trusted person and the material's locations, with an agreed access route. The instructions contain no recovery secrets, and the will contains no mnemonic.

## Sources

Community reading on mnemonic backups and recovery testing, not specifications for Bawa derivation or TON configuration. Numbered [1]-[3] are cited in the compromised-seed playbook.

1. [Coin Bureau, Top mistakes to avoid when using hardware wallets](https://coinbureau.com/education/top-mistakes-to-avoid-when-using-hardware-wallets)
2. [Bitcoin.com, What is a private key?](https://www.bitcoin.com/wallet/what-is-a-private-key/)
3. [CryptoNakta, Mnemonic exposed](https://cryptonakta.com/seed-phrase-exposed/)
4. [Self Custody, Seed to key](https://selfcustody.ca/guides/seed-to-key.html)
5. [Coldcard, Passphrase](https://coldcard.com/docs/passphrase/)
6. [Blockstream, Fix issues with unexpected wallet balance](https://help.blockstream.com/blockstream-app/troubleshooting/fix-issues-with-unexpected-wallet-balance)
7. [The Crypto Guide, Mnemonic guide](https://thecryptoguide.org/learn/seed-phrase-guide/)
8. [BIP39 Phrase, Create a mnemonic](https://bip39-phrase.com/create-a-seed-phrase/)
9. [Cobo, Bitcoin security best practices](https://www.cobo.com/post/bitcoin-security-best-practices-guide)
10. [Tangem, How to back up a crypto wallet](https://tangem.com/en/blog/post/how-to-back-up-crypto-wallet/)

