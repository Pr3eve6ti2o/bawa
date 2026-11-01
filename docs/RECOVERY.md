# Recovery Procedure

This document contains operational recovery steps and no wallet secret.

## Required recovery material

For the current Bawa reference policy, preserve:

- the BIP-39 mnemonic;
- the exact BIP-39 passphrase policy (currently empty);
- chain derivation paths and address policy;
- network/chain configuration;
- TON wallet configuration where applicable;

or preserve the generated encrypted seed.enc.json plus its separate 32-byte data key.

An xpub/zpub cannot recover the wallet. It can reproduce only public descendants below the exported account node.

## Encrypted artifact

On a trusted machine:

~~~
python3 tools/decrypt_seed.py /path/to/seed.enc.json
~~~

The utility asks for the data key and displays the mnemonic on the controlling terminal by default. Use --stdout only for an explicit controlled pipeline or --output for an atomic 0600 plaintext file.

## Before funding

Recover on a clean trusted machine, verify the mnemonic/passphrase, derive known public addresses, and compare them with the recorded originals. Do not fund the restored wallet until the public outputs match.

## TON

TON is configuration-sensitive. Recovery must preserve the wallet contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID used by the original system.

## 10 Recovery — the full procedure

A wallet application accepting a mnemonic is not proof of recovery. The test is whether a clean restore, using the preserved secret material and original configuration, reproduces the public outputs recorded for the original wallet.

**Do not fund until the public outputs match.**

Run this procedure while a new wallet is still empty. Restore from the actual backup, not from memory or a wallet session that already holds the seed. Finding a transcription error before the first deposit is much better than finding it when the backup is needed.

### The recovery record

Bawa’s current reference policy allows two secret-recovery routes:

- the BIP-39 mnemonic, with its exact passphrase policy and wallet configuration;
- the generated encrypted `seed.enc.json`, together with its separate 32-byte data key.

Keep the configuration and public-output record whichever route you choose. Recovering the words does not establish which defaults a replacement application should use.

The recovery record is a set of related records, not necessarily one document. Keep secrets confidential and the data key separate from the encrypted artefact. Public addresses and configuration do not grant spending access, but they need protection against alteration and may reveal wallet activity.

| Material or record | What must be preserved, and why |
|---|---|
| **BIP-39 mnemonic** | For the mnemonic route, preserve every word in its exact order and identify the word list used. Missing, substituted or reordered words prevent reliable reconstruction. |
| **Encrypted artefact and data key** | For the encrypted route, preserve the generated `seed.enc.json` and its separate **32-byte data key**. The file without its key is not a usable recovery route; the key without the file is not one either. Anyone obtaining both can recover the mnemonic. |
| **Exact BIP-39 passphrase policy** | The current reference policy is **empty: zero characters**. Record that explicitly. A blank field in an unfinished record is ambiguous. A different passphrase produces a different seed, even when the mnemonic is unchanged. |
| **Chain derivation paths** | Record the complete paths and relevant account, branch and address indices. The same seed can generate many address sequences; an account name is not enough to select the original one. |
| **Address policy** | Preserve the address type, script policy where relevant, receiving/change conventions and public-output encoding. The right key under the wrong address policy can produce a different address. |
| **Network and chain configuration** | Preserve the exact chain/network selection and relevant parameters. A plausible address or a familiar network label is not evidence that the original configuration has been restored. |
| **TON wallet configuration** | Preserve the wallet contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID. These choices cannot safely be replaced by another tool’s defaults. |
| **Known original public outputs** | Record complete public addresses alongside the configuration and derivation selectors that produced them. Include the first receiving address before funding, and additional known indices or change addresses where applicable. These are the independent comparison targets. |
| **Implementation reference — recommended** | Record the Bawa revision, relevant tool versions and the date of the record. This helps explain changed defaults or behaviour without making the software version a substitute for explicit configuration. |

The data key used to decrypt `seed.enc.json` is **not** the BIP-39 passphrase. A local application password is not the BIP-39 passphrase either.

An `xpub` or `zpub` cannot recover the wallet or restore spending access. It can reproduce only public descendants below the exported account node. Keep one for watch-only use if needed, but do not count it as a secret-recovery backup.

### Procedure

#### 1. Establish the backup and independent comparison targets

For a pre-funding rehearsal, finish the written backup or encrypted backup first. Record public addresses from the original wallet, including the settings needed to derive each one.

For a later recovery, use those pre-existing originals. Do not fill an “expected address” field with an address produced by the restore being tested.

Identify which secret-recovery route you will exercise. A test of the written mnemonic does not test whether the encrypted file and its saved data key still work.

If no independent original public output is available, the recovery cannot yet pass the comparison check. Recover that evidence before treating the wallet as verified.

**You should see:** A complete backup route, an explicit passphrase-policy record, the original configuration and a separate list of expected public outputs with their derivation selectors.

#### 2. Prepare a clean, trusted machine

Use a clean operating system from trusted installation media and a Bawa checkout and dependencies you have checked. Restoring an old wallet directory or an entire old home directory is not a clean recovery test.

Complete software installation before introducing secret material. Where the tooling permits, perform secret recovery and public-address derivation offline.

Use a private local terminal without session recording or shell tracing. Keep recovery work out of synchronised folders, screenshots, shared logs and support tickets. Avoid clipboard history and other facilities that retain secret input.

Start with fresh wallet state. No previously loaded mnemonic, seed or extended public key should be able to supply the addresses used in the test.

**You should see:** A known software environment with fresh wallet state and no recording or synchronisation configured to capture secret input or terminal output.

#### 3. Recover the mnemonic from the preserved material

For the mnemonic route, read from the actual written backup. Do not substitute the original application’s display or a remembered copy; the purpose is to test what was preserved.

For the encrypted route, run on the trusted machine:

```sh
python3 tools/decrypt_seed.py /path/to/seed.enc.json
```

Enter the separate data key when the utility asks for it, rather than placing it in the command line.

By default, the utility displays the mnemonic on the **controlling terminal**. That terminal must be private.

Use `--stdout` only for an explicit, controlled pipeline whose destinations and logging behaviour you understand. Use `--output <plaintext-output-path>` only when an atomic `0600` plaintext file is required. Mode `0600` gives owner read/write permissions; it does not encrypt the file or make a compromised host safe.

**You should see:** A mnemonic recovered locally from the saved material. On the default encrypted route, the utility asks for the data key and displays the mnemonic on the controlling terminal, without involving a website or remote recovery service.

#### 4. Validate the mnemonic and set the exact passphrase policy

Use trusted local BIP-39 tooling to check the word list, word count, order and checksum. A checksum check can detect many transcription mistakes, but it does not establish that the mnemonic belongs to the intended wallet.

For the current Bawa reference policy, set the BIP-39 passphrase to **zero characters**. Do not enter a space, the word used to describe the empty policy, the artefact’s data key or an application password.

If the original record documents a departure from the current empty policy, reproduce that historical policy exactly. Do not silently replace it with today’s default. A non-empty passphrase must itself be recoverable; a note saying that one existed is insufficient.

A wrong BIP-39 passphrase can produce another valid wallet without a “wrong password” error. The address comparison later in this procedure is essential.

**You should see:** A locally validated mnemonic and an explicitly selected passphrase policy matching the original record. For the current reference, the passphrase contains no characters. This is a necessary check, not yet permission to fund.

#### 5. Restore the chain, derivation and address settings

Apply the recorded settings explicitly rather than accepting the restoring tool’s defaults.

For each chain and account being recovered, reproduce the full derivation path or equivalent selector, account and branch choices, address indices, address policy and network configuration. Keep receiving and change branches distinct where the original policy uses them.

Use the recovered mnemonic and passphrase as the source of derivation. Importing an `xpub` and displaying its addresses would test the public export, not the secret backup.

**You should see:** A configuration that agrees field by field with the recovery record, with public outputs ready to be derived from the recovered secret material rather than cached wallet state.

#### 6. Restore the TON configuration exactly, where applicable

TON recovery needs more than matching words. Check all five recorded fields:

- **Wallet contract/version.** Use the original contract and version, not whichever version a replacement tool currently recommends. The wallet address depends on the wallet construction as well as its key material.
- **Derivation convention.** Reproduce the original method of turning the mnemonic, passphrase or seed into TON key material, including any path or indexing convention. Another TON application accepting a mnemonic does not prove that its derivation is compatible.
- **Workchain.** Restore the exact workchain. It is part of the address identity, not an account label.
- **Network presentation.** Preserve the network setting and the address representation used by the original system, including network indicators and presentation flags where applicable. Raw and user-friendly forms need to be distinguished; presentation differences must be explained and the recorded form reproduced.
- **Wallet/subwallet ID.** Restore the original identifier. Do not replace it with an address index or assume that another library’s default is equivalent.

Some differences change the wallet address; others change how an address is displayed. Neither is a reason to waive verification. Resolve the configuration difference before continuing.

**You should see:** All five TON fields matching the original record, with no unresolved default or convention. If TON is outside this recovery’s scope, that is explicitly recorded as not applicable.

#### 7. Derive the known public addresses and compare them

Derive the public outputs identified in the recovery record using the restored mnemonic, exact passphrase policy and recorded settings.

At minimum, compare the first receiving address recorded before funding for each chain/account you intend to use. Compare additional recorded receiving indices and change addresses where available. One matching address on one chain does not verify another chain’s policy.

Compare the **whole address**, not just its beginning and end. Use the recorded representation. If a tool presents another valid encoding, reproduce the original presentation before completing the comparison; do not edit the expected original to make the test pass.

For each comparison, retain a public-only record of:

- the chain/network and derivation selector;
- the relevant address policy or TON configuration reference;
- the recorded original public output;
- the restored public output;
- whether they match.

On any mismatch, stop. Recheck transcription, passphrase policy, paths, indices, address policy, network settings and TON configuration as applicable. Do not send a small deposit as a diagnostic. A valid checksum, successful decryption or plausible balance does not replace this comparison.

**You should see:** Every tested public output matching its independent recorded original under the recorded policy. Any unexplained mismatch leaves recovery unverified and funding blocked.

#### 8. Repeat independently where practical

Where possible, repeat the recovery on a second clean installation, preferably while the wallet is still empty. Use the preserved backup and the same independent originals again.

Do not clone the first restored wallet directory. The second test should exercise the backup and configuration record, not state carried over from the first test.

This is an additional operational check, not a different derivation rule. If it cannot be done, record that limitation rather than describing the recovery as independently repeated.

**You should see:** The second clean restore reproducing the same recorded public outputs, or an explicit note that this additional check was not performed. A mismatch on either installation remains a blocking failure.

#### 9. Record the result, remove transient secrets and apply the funding gate

Keep a dated verification record containing the software reference, configuration identifiers, public comparisons and second-install status. Do not include the mnemonic, passphrase, data key or terminal capture.

Retain the durable recovery backups. Remove unnecessary temporary plaintext files and close secret-bearing terminal sessions. File deletion is not assured erasure on modern storage, snapshots or backups; avoid creating persistent plaintext copies in the first place.

Only a successful public-output comparison permits funding. For an existing wallet, the same rule applies before sending further funds to the restored wallet.

**Do not fund the restored wallet until the public outputs match.**

**You should see:** A secret-free verification record, retained recovery material under appropriate separate custody, and no unresolved comparison failures. Funding remains blocked if the required outputs have not matched.

### Sources

Community reading on mnemonic backups and recovery testing, not specifications for Bawa derivation or TON configuration:

- https://thecryptoguide.org/learn/seed-phrase-guide/
- https://bip39-phrase.com/create-a-seed-phrase/

## 10 Recovery — the encrypted-seed decryption workflow, part 1: the artifact, the key, and the output modes

Recovery exposes the wallet’s mnemonic. Use a trusted machine and decide where that plaintext may go before running `tools/decrypt_seed.py`.

### 1. Identify the encrypted backup

The seed artefact, represented here by `/path/to/seed.enc.json`, is an AES-256-GCM-encrypted backup, not a readable list of recovery words.

Three inputs matter:

- **Nonce:** the per-encryption value stored with the backup. It is not secret, but it must remain paired with its ciphertext.
- **Ciphertext:** the encrypted recovery material. GCM provides authentication as well as encryption, so decryption checks integrity rather than merely producing plaintext.
- **Associated data (AAD):** the tool uses exactly `b"nova-shop-seed-v1"`. These fixed bytes are authenticated but not encrypted. They are not the data key, and you do not enter them at the key prompt.

Recovery needs the matching key, the original nonce and ciphertext, and that exact AAD. A wrong key or altered input causes authentication to fail. Do not edit the backup to try to make it decrypt.

**You should see:** an encrypted backup containing nonce and ciphertext data, not plaintext mnemonic words. The AAD is fixed by the tool; it is not another secret to retrieve.

### 2. Supply the 32-byte data key

The tool first looks for `BAWA_DATA_KEY`:

- A **non-empty** value is used as the hexadecimal key.
- If the variable is **unset or empty**, the tool asks interactively with `Bawa data key (hex): `. The prompt does not echo the key.

Both routes strip surrounding whitespace and then decode hexadecimal. The result must be **exactly 32 bytes**: 64 hexadecimal digits, represented here by `<YOUR-32-BYTE-HEX-KEY>`. This is a data-encryption key, not a password, mnemonic or wallet private key.

Invalid hexadecimal is rejected. A decoded value of any other length raises `data key must be exactly 32 bytes`. A bad non-empty environment value does **not** trigger a retry through the prompt.

For manual recovery, prefer the prompt. For automation, inject the environment variable through a protected secret-handling mechanism; do not place the real key in a shell command that may enter history, a script or a job log.

**You should see:** the key prompt when the variable is unset or empty, and no key prompt when it has a non-empty value. Passing the length check only establishes the key’s size; authentication establishes whether it matches the backup.

Choose **one** of the following output modes. Steps 3–5 are alternatives, not a sequence to run. `--stdout` and `--output` are mutually exclusive.

### 3. Use the default for private, attended recovery

Run the tool with neither output flag when a person needs to read the mnemonic directly.

The default sends the recovered mnemonic to the **controlling terminal**, not ordinary stdout. Redirecting stdout therefore does not capture the mnemonic. The tool does not write plaintext to disk in this mode.

Use this only on a private terminal without session recording, terminal logging, screen sharing or an untrusted observer. Terminal software can still record what the tool displays.

Without a controlling terminal, the default fails with:

`no controlling terminal; use --stdout or --output explicitly`

That refusal is deliberate; there is no automatic fallback to stdout.

**You should see:** the mnemonic on the controlling terminal, not on ordinary stdout or in a plaintext file written by the tool. Without that terminal, expect the explicit error above.

### 4. Use `--stdout` only for a controlled pipeline

Select `--stdout` only when an explicit machine-readable pipeline is genuinely required.

The mnemonic now travels on ordinary stdout. You must control the receiving program, intermediate commands and logging around the whole pipeline. Confirm that they will not echo, retain or forward the plaintext unexpectedly. Avoid `tee`, diagnostic capture and general CI or job logs.

This is not merely a convenient workaround for a missing terminal. Shell redirection also does not acquire the atomic-write or `0600` guarantees of `--output`; the shell controls creation of a redirected file.

**You should see:** the intended consumer receiving the mnemonic through the pipeline, with no plaintext appearing in console transcripts, pipeline logs or unintended files.

### 5. Use `--output` only when a plaintext file is necessary

Select `--output /path/to/recovered-mnemonic.txt` when recovery deliberately requires a file.

The tool writes the mnemonic atomically with mode **`0600`**: owner read/write, no group or other permissions. Atomic publication means the destination receives a complete file rather than a partially written mnemonic.

Neither property encrypts the contents. Other processes running as the owner, and privileged accounts, can still read them. Use a private directory on controlled storage, away from source control, shared folders and automatic synchronisation or backups. Decide how long the file is needed before creating it; deletion alone is not a guarantee of erasure.

**You should see:** a complete plaintext file at the chosen path with permissions `0600` (`-rw-------`) and the expected owner. Check its metadata without printing its contents into another terminal or log.

## 10 Recovery — the encrypted-seed decryption workflow, part 2: refusals, failures, and clean-up

Treat a refusal from `tools/decrypt_seed.py` as a reason to check the paths, backup and key pairing—not to weaken the checks.

### 1. Check the encrypted artifact path

The tool checks whether the artifact path is a symbolic link before loading its JSON. A linked artifact is refused, even if its target appears valid.

Use a direct path such as `/path/to/seed.enc.json`. If an unexpected link is present, establish which file you intended to recover before trying again; do not blindly follow it.

**You should see:** `refusing symlinked encrypted artifact` for a symlinked input. That attempt returns no recovered mnemonic.

### 2. Check the output and temporary paths

With `--output`, an output path that exists and is a symlink is rejected with `refusing symlinked output path`.

The temporary output path is protected too: a symlink there is refused. The temporary file is created with `O_EXCL`, preventing an existing entry from being silently overwritten, and with permissions `0600`. Successful writing places the final file atomically and explicitly sets its permissions to `0600`: owner read and write only.

Use a destination you control, such as `/path/to/recovered-mnemonic.txt`. Investigate unexpected temporary entries rather than deleting them blindly or disabling these safeguards.

**You should see:** a refusal for an existing symlinked output or a symlinked temporary path. A successful write leaves the final file with mode `0600`.

### 3. Recognise an unsupported algorithm

The artifact’s `alg` value must be exactly `AES-256-GCM`. A different value, or a missing algorithm label, is not accepted. There is no fallback to another encryption scheme.

Do not edit the label to force acceptance: changing metadata does not convert the encrypted payload. Check that you have a compatible backup.

**You should see:** `unsupported encryption algorithm`, with no decryption attempted for that artifact.

### 4. Distinguish malformed data from authentication failure

The nonce and ciphertext fields must decode as strict Base64. After decoding, the nonce must be exactly 12 bytes, and the ciphertext must contain at least 16 bytes, allowing for the authentication tag.

Invalid JSON, missing `nonce_b64` or `ciphertext_b64` fields, and invalid Base64 can fail during loading or decoding. They need not produce the same message as the explicit length checks.

Check the backup’s provenance and transfer integrity. Do not “repair” encrypted bytes by guessing, padding or trimming them.

**You should see:** `malformed AES-GCM artifact` for an invalid nonce or ciphertext length, or a parsing, field-access or decoding error for earlier structural problems.

### 5. Treat authentication failure as a hard stop

If the structural checks pass but AES-GCM authentication fails, a correctly formed but wrong key or altered encrypted data may be responsible. A mismatch in the additional authenticated data (`AAD`) also causes authentication failure.

This failure does not tell you whether the key is wrong or the artifact has been tampered with. Recheck the intended backup/key pairing through trusted records. Do not bypass authentication or assume that retrying with the same inputs will repair anything.

**You should see:** an authentication failure rather than recovered text. No mnemonic is returned by the decryption function.

### 6. Understand the mnemonic-shape check

After successful authentication, the tool decodes the plaintext as UTF-8 and splits it on whitespace. It accepts only 12, 15, 18, 21 or 24 words.

Any other count produces the mnemonic-shape refusal. Invalid UTF-8 fails decoding instead. This is only a word-count check: it does not verify BIP-39 word-list membership or the checksum. Do not add or remove words to make rejected text pass.

**You should see:** `recovered data does not look like a BIP-39 mnemonic` for a rejected word count. Passing this check alone does not establish that the phrase is the intended wallet backup.

### 7. Decide the destination first, then clean up

Before decrypting—not after plaintext appears—choose either the default terminal display or writing with `--output /path/to/recovered-mnemonic.txt`.

Use display mode only where terminal recording and shared viewing are excluded. For write mode, choose a private location outside source control and automatic synchronisation. `0600` restricts access; it does not encrypt the recovered file.

**Never paste the recovered mnemonic into chat, source control, tickets or shell history.** That includes embedding it in a shell command.

After recovery, remove unneeded plaintext files and clear any clipboard or terminal residue. Retain only deliberately managed recovery material. Clearing a screen or deleting a file is not guaranteed erasure of recordings, snapshots or backups.

**You should see:** in display mode, `Recovered BIP-39 mnemonic (do not copy into chat or source control):` before the mnemonic; in write mode, a final file with mode `0600`. After clean-up, no unneeded plaintext copies should remain in the recovery workspace.

## 10 Recovery — what recovery cannot do

### 1. An xpub or zpub cannot recover the wallet

An account export reproduces only public descendants below the exported account node. It cannot recreate the mnemonic or private keys, recover other accounts, or sign a spend. It is public reference material, not a substitute for the secret backup.

An address match proves that public derivation agrees. It does not prove spending recovery.

**You should see:** a public-only, watch-only result. Addresses can match, but signing with the xpub or zpub alone cannot succeed.

### 2. A wrong BIP-39 passphrase does not produce an error

BIP-39 processes the mnemonic through PBKDF2 with the passphrase included in the salt. Every passphrase therefore yields a valid, different wallet. A typo, a capital letter or a trailing space opens another wallet, almost certainly an empty one. There is no “wrong passphrase” error to catch the mistake. [1, 2]

Bawa’s current policy is an **empty passphrase**: no characters at all, including spaces. Use it exactly. If you cannot verify the mnemonic and the exact passphrase policy, mark recovery **incomplete** and **do not fund**.

**You should see:** agreement with a previously recorded reference, such as `<RECORDED_WALLET_FINGERPRINT>` or `<RECORDED_RECEIVING_ADDRESS>`, using the original derivation policy. This is an identification cross-check, not spending proof. No error and a zero balance do not establish recovery. [2, 3]

### 3. The mnemonic does not contain a lost passphrase

For a passphrase-protected wallet, the mnemonic alone is insufficient. Without the exact passphrase, you cannot restore that wallet or spend its funds. Restoring the mnemonic with an empty passphrase recovers only the main, empty-passphrase wallet—not the protected wallet. [2]

Bawa does not document non-empty passphrase setup or lost-passphrase handling.

There is no check that reveals the missing passphrase from the mnemonic. Seeing the main wallet does not verify recovery of the protected wallet.

### 4. Losing the seed and its backup loses the wallet

When the seed and every usable backup are gone, the wallet is lost. There is no reset, no support desk and no procedure that recreates the secret.

A recorded address or xpub is only a comparison target. If the mnemonic is still available, it lets you test remembered passphrase candidates one by one under the same derivation policy. It cannot supply a forgotten passphrase or reconstruct a lost phrase. [2]

**You should see:** a correct candidate reproduce `<RECORDED_RECEIVING_ADDRESS>` or `<RECORDED_ACCOUNT_XPUB>` when the mnemonic and derivation policy are also correct. If the seed and backup are both gone, there is no recovery check that brings them back.

### 5. A checksum does not identify your wallet

A passing BIP-39 checksum establishes that the words are internally consistent. It does not establish that they are your words. Another valid mnemonic passes too.

The checksum does not test the passphrase, derivation path, account selection or address policy. A valid mnemonic used with the wrong policy still leads to the wrong wallet. Do not sign off recovery on a checksum result. [1, 3]

**You should see:** the expected `<RECORDED_RECEIVING_ADDRESS>` reproduced under the exact derivation policy as a separate identification check. A checksum pass alone is insufficient; an address match still does not prove signing capability.

### 6. Changing local access does not repair an exposed seed

Changing a device PIN, changing an app password or reinstalling an app does not revoke the seed. Those actions affect local access. They do not affect copies of the words held elsewhere.

With Bawa’s empty-passphrase policy, anyone holding the words can rebuild the wallet on their own device. Treat an exposed seed as compromised. Move remaining funds to a wallet with a newly generated mnemonic and verified recovery—not merely another account under the exposed seed. Retire the old wallet.

**You should see:** confirmed transfers to `<NEW_WALLET_RECEIVING_ADDRESS>`, independently verified against the new wallet. There is no check that makes the exposed seed secret again.

### 7. “Support” and “recovery services” are not a recovery route

Neither a support contact nor a paid recovery service can bypass these missing-secret limits. Anyone asking for the phrase is asking for control of the wallet, not proof of ownership.

Never type the phrase into a website or share it with anyone. Stop any interaction that requires either. If you have already disclosed it, treat the seed as exposed and follow point 6.

There is no check that makes handing over the phrase safe. Logos, testimonials and a successful address lookup do not change that.

### Sources

1. https://selfcustody.ca/guides/seed-to-key.html
2. https://coldcard.com/docs/passphrase/
3. https://help.blockstream.com/blockstream-app/troubleshooting/fix-issues-with-unexpected-wallet-balance

# 10 Recovery — testing backups, and the two playbooks

We count a recovery as successful when it reproduces a previously recorded address—not when the software says ‘restore complete’.

Every exercise below is testnet-only. Use a tiny testnet amount for transaction checks; never use real funds for a rehearsal.

## Part 1 — Backup testing routine

Complete the pre-funding check before trusting a wallet with meaningful funds. A conceptual walkthrough does not replace an actual restore and address comparison.

The recovery sequence is:

```text
fresh machine
   ↓
clean software
   ↓
recover mnemonic
   ↓
apply exact passphrase
   ↓
apply exact derivation policy
   ↓
derive expected address
   ↓
compare with previously recorded address
```

1. **Start on a fresh machine.**  
   Use a known-clean environment, independent of the original wallet installation. Have the public recovery record ready: the previously recorded address, network and derivation policy. Do not erase your only working device to create the test environment.

   **You should see:** a clean recovery environment and a reference address recorded before this drill—not an address generated during it.

2. **Install clean software.**  
   Obtain the wallet software through the project’s official distribution channel and follow its release-verification instructions. For hardware recovery, use a trusted device with verified firmware. Keep mnemonic entry on the hardware device where that is the intended recovery method.

   **You should see:** the intended software and firmware versions, with their provenance checked and no existing wallet state being mistaken for a recovery.

3. **Recover the mnemonic from the backup.**  
   Use the backup you intend to rely on after a loss. Do not substitute an export from the still-working wallet. Never enter the mnemonic into a website, support chat or remote-access session.

   **You should see:** the backup accepted by the recovery interface. This is an intermediate result, not a passed drill.

4. **Apply the exact passphrase.**  
   Match its characters, case and spacing. If the wallet was created without a passphrase, use the empty-passphrase setting explicitly. The device PIN is not the mnemonic passphrase. A different passphrase can produce a valid but different wallet without an error.

   **You should see:** the intended passphrase setting applied. Its correctness still needs to be proved by the address comparison.

5. **Apply the exact derivation policy.**  
   Match the recorded network, derivation path, account, address or script type, receive/change branch and address index, together with any wallet-specific settings. Do not assume the recovery software’s defaults match the original wallet.

   **You should see:** every setting needed to reproduce the reference address matching the recovery record.

6. **Derive the expected address.**  
   Derive the address at the recorded location using the recovered wallet. In a testnet record, this might be labelled `<derived-testnet-address>`. Do not import the reference address as a watch-only entry and mistake its appearance for successful key recovery.

   **You should see:** an address derived afresh from the recovered wallet, using the recorded policy.

7. **Compare it with the previously recorded address.**  
   Compare the complete address with `<previously-recorded-testnet-address>` and confirm the network. Checking only a few leading or trailing characters is not enough. On any mismatch, stop and investigate the backup, passphrase and policy without disclosing secrets.

   **You should see:** a complete address match on the intended network. A mismatch is a failed drill; a drill that stops at ‘restore’ without this comparison is incomplete.

8. **Check signing with a tiny testnet amount.**  
   After the address comparison passes, receive `<tiny-testnet-amount>` and make an outgoing testnet transfer using the recovered wallet. Check both transactions on the intended testnet. This tests signing as well as address derivation.

   **You should see:** confirmed testnet receipt and a confirmed outgoing transaction signed by the recovered wallet—not merely a transaction prepared by the interface.

9. **Record the result and repeat the routine.**  
   Record a dated pass/fail result, software and firmware versions, network, policy reference, compared addresses and testnet transaction references. Record failures too. Keep mnemonics, passphrases, private keys and data keys out of this log.

   Repeat the full routine quarterly, using only a tiny testnet amount. Repeat it after firmware updates, using the updated firmware, before resuming normal use.

   **You should see:** a dated recovery record with enough non-secret detail to reproduce the check, a next quarterly due date, and a fresh result after each firmware update.

## Part 2 — Compromised-seed playbook

A leaked seed cannot be made secret again. Someone with the necessary seed material can derive the wallet’s private keys and authorise spending; there is no account administrator who can reset that authority. [2]

Bawa’s rule is replacement, not repair. Follow this order.

1. **Generate a new wallet on a fresh trusted device.**  
   Never generate the replacement on a device that may carry malware. Use an independent new seed, back it up securely, and verify its receiving addresses for the relevant networks. Another account or address under the old seed is not a replacement. Neither is a PIN change.

   **You should see:** a separately backed-up wallet with an independent seed and verified destination addresses. The new seed has never entered the suspect device.

2. **Move every asset and token, then verify every receipt.**  
   Work from a clean signing environment. Inventory every account and network used by the old wallet, including tokens and NFTs that its default balance screen may omit. Prioritise the highest-value non-native assets rather than emptying convenient accounts first.

   On each network, retain enough native gas coin for the outgoing token transfers. Move the remaining spendable native gas coin last, allowing for the final transaction’s own fee—especially where a sweeper bot may be watching. Bots can take incoming funds within seconds; do not assume a fee top-up will remain available, and do not keep feeding an address that is being swept. [3]

   Verify receipt of each asset and token at the new wallet’s address on the correct network. A ‘sent’ banner or submitted transaction is not confirmation.

   **You should see:** every inventoried asset and token confirmed under the new wallet’s control, with transaction fees accounted for. Any missing receipt leaves the evacuation incomplete.

3. **Revoke old token approvals where useful and safe.**  
   After evacuation, revoke outstanding approvals where doing so has a useful purpose and does not put further funds at risk. Do not replenish a compromised address merely to tidy up permissions.

   Revocation does nothing to secure a leaked seed: its holder can sign new transactions and re-approve allowances. It is not a repair, and it must not become a reason to keep using the wallet.

   **You should see:** any useful revocations confirmed, or a recorded reason for taking no action. The old seed remains marked compromised regardless.

4. **Retire the old wallet permanently.**  
   Remove its addresses from payment instructions, saved destinations, automated deposit arrangements and routine account selection. Keep a non-secret incident record so the retirement is not forgotten.

   Never reuse the wallet—not for an empty account, not for a new account derived from the same seed, and not for a future deposit. An attacker can wait for that deposit.

   **You should see:** the replacement wallet holding every recovered asset and token, with no active arrangement directing deposits to the old wallet. The old seed is retired, not treated as repaired.

### If funds are already gone

**Trace, notify and report.** On-chain transfers cannot be reversed. For funds already taken, the only remaining steps are tracing the transactions, notifying any identifiable receiving exchange through its official channels, and reporting the theft to the relevant authorities.

Preserve transaction references, addresses and timestamps—not secrets. An exchange may be able to act on assets it still controls, but that is not an on-chain reversal or a promise of recovery. Never pay a ‘recovery service’. [3]

**You should see:** an evidence record and any exchange or reporting reference numbers available—not a claimed reversal or a supposedly repaired seed.

## Part 3 — Device-loss playbook

Device loss and seed compromise are different incidents. The deciding question is whether the seed—and the ability to derive its signing keys—remains safe.

1. **Classify the loss before restoring.**  
   If the device is lost but the seed backup remains secure, with no reason to suspect exposure or key extraction, use the restore path below. If the seed may have been seen, copied or taken, follow Part 2 instead.

   A device stolen together with a backup copy is a seed-compromise incident. Another intact backup at home does not cancel that exposure. A device PIN does not protect a stolen paper backup.

   **You should see:** a clear choice between device-only recovery and seed-compromise handling. Suspected seed exposure leads to Part 2, not a simple restore.

2. **For device-only loss, restore on a new trusted device and verify addresses before use.**  
   Restore the existing wallet from its backup, applying the exact passphrase and derivation policy. Follow Part 1’s restore-and-compare sequence for the accounts you intend to use. Do not rely on a balance display or a successful restore message.

   Compare the recovered addresses with the previously recorded addresses before receiving or spending. Stop on any mismatch. Record the dated result; any transaction exercise must use only a tiny testnet amount.

   **You should see:** the existing wallet’s recorded addresses reproduced on the replacement device. This is recovery of the same wallet, not creation of a different empty one.

3. **Keep the seed and device apart.**  
   Never store the seed backup together with the device—not in the same bag, drawer or safe. Use separate secure locations. One theft must not hand over both the device and the material needed to reconstruct its wallet without the device’s PIN. Separation also reduces the chance that one fire or accident destroys both access and recovery. [1]

   **You should see:** the device and backup secured independently, so loss of one does not automatically expose or destroy the other.

### Sources

- [1] Coin Bureau — https://coinbureau.com/education/top-mistakes-to-avoid-when-using-hardware-wallets
- [2] Bitcoin.com — https://www.bitcoin.com/wallet/what-is-a-private-key/
- [3] CryptoNakta — https://cryptonakta.com/seed-phrase-exposed/

## 10 Recovery — backup separation, disaster recovery, and inheritance

### Step 1 — Separate backups by risk

Keep **2–3 offline copies** in separate places that do not share one fire or flood risk. Two cupboards in one building are not separate disaster boundaries; nor are two sites exposed to the same flood.

Never store the seed backup with the wallet device.

For Bawa’s application-specific encrypted artefact, keep `seed.enc.json`, its separate **32-byte data key**, and the offline mnemonic in different places:

```text
<artefact storage location>
seed.enc.json
```

```text
<data-key storage location>
<32-byte data key>
```

```text
<offline recovery location>
<mnemonic backup>
```

Preserve that separation when making additional copies. Never put all three together and call the bundle an “encrypted backup”. The encrypted file and its key are complementary material, not two independent recovery copies.

**You should see:** A location plan showing 2–3 offline copies, separate disaster risks and distinct storage for the artefact, data key and mnemonic. No seed backup is kept with the device.

### Step 2 — Choose media and record access controls

Bawa does not prescribe backup media or protective storage. Choose them for the risks at each location.

- **Paper** degrades, burns and is vulnerable to water. Protective packaging helps, but does not remove those failure modes.
- **Metal** resists fire and water, but provides no secrecy. A stolen metal seed backup gives full spending access unless a separately held wallet passphrase is required.

For **every copy**, record its medium, custodian, authorised access and physical theft controls: for example, locked storage and procedures for releasing it. Keep this inventory restricted and free of recovery secrets.

**Never digitise the mnemonic:** no photos, cloud storage, email, notes apps or password managers. A photo can sync automatically. A compromised master password can expose the seed alongside everything else stored in the same vault.

**You should see:** A suitable physical backup medium and recorded access controls for each copy, with no digital copies of the mnemonic.

### Step 3 — Verify recovery over time

Inspect every copy periodically for readability and damage, without photographing it.

Test independent recovery before relying on a backup. Use a trusted recovery setup without erasing the only working wallet. Confirm that recovery produces the **expected wallet**, not merely that an import completes.

Re-test **annually and after firmware updates**, including any separately held passphrase needed by the recovery route. Record the date and outcome, not the secrets. Treat an untested backup as **unproven**.

**You should see:** A dated, non-secret record of readability checks and successful independent recovery tests, with the next annual test scheduled.

### Step 4 — Record the disaster responses

- **Fire or flood destroys one location:** the separated copy is the plan. Recovery must not depend on retrieving anything from the damaged site. Once access is secure, replace the lost backup capacity without undoing the separation.
- **One copy is stolen:** recorded physical access controls and, where used, a wallet passphrase held separately from the mnemonic are the defences. That passphrase is not Bawa’s data key. If the mnemonic and its passphrase are both taken, treat it as compromise; without a passphrase, mnemonic theft alone is enough. Theft of `seed.enc.json` together with its data key also exposes the stored secret. Following compromise, move funds to a fresh wallet with new recovery material.
- **The only copy is lost:** this is the **lost-wallet case**—there is no backup recovery route. A still-working device may let you move funds to a newly backed-up wallet. Without that access or surviving recovery material, Bawa cannot recover the funds.

**You should see:** A usable fallback after losing one site, a clear compromise response after theft, and no promise of recovery when the last usable recovery route is gone.

### Step 5 — Leave an inheritance route

**This is an outline, not legal advice.** Heirs cannot access funds without the recovery material; legal entitlement does not recreate a seed.

Leave written instructions in plain language, separate from any legal will. Explain:

- where to find each required item;
- who can authorise or provide access;
- how to use the material through the tested recovery procedure;
- where to obtain any separately held passphrase.

Do not put the seed or other recovery secrets in those instructions.

Discuss these options with an **estate professional familiar with digital assets**:

- A sealed envelope of instructions held by a trusted executor.
- A time-locked multisig arrangement in which a trusted party holds one key. This requires advance planning and testing, not just a note describing it.

Never embed the mnemonic in a legal will: the will may become public or be widely circulated.

**You should see:** Instructions an authorised heir or executor can understand and follow, with an agreed access route. Neither the instructions nor the will contains the seed.

### Sources

Community guidance, not Bawa specifications:

- [Cobo — Bitcoin security best practices](https://www.cobo.com/post/bitcoin-security-best-practices-guide)
- [Tangem — Wallet backup guidance](https://tangem.com/en/blog/post/how-to-back-up-crypto-wallet/)
- [The Crypto Guide — Seed phrase guide](https://thecryptoguide.org/learn/seed-phrase-guide/)
