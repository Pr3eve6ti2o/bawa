# Security and recovery

## 1. What this guide does not promise

Twelve honest limitations. This guide does not promise:

1. that Trust Wallet Core is correct for every possible chain use case;
2. that one derivation path is compatible with every wallet application;
3. that free public RPC is suitable for production;
4. that an xpub is harmless to expose;
5. that JavaScript can guarantee perfect memory zeroisation;
6. that a hardware wallet eliminates every operational risk;
7. that a hosted indexer gives you complete historical truth forever;
8. that TON can be flattened into a Bitcoin-like path table;
9. that Solana, Cardano or Substrate are interchangeable with secp256k1 BIP-32 chains;
10. that "open source" means audited;
11. that "audited" means immune to implementation mistakes;
12. that a wallet is recoverable without preserving its derivation policy.

These limitations are not weaknesses of the guide — they are part of being honest about the engineering problem.

Read "audited" as "reviewed against the ownership contract, with the scope, reviewer and date stated". For schemas, read "verified" as "source-verified against the Trust Wallet Core 4.9.2 tag".

Bawa contains no transaction construction or signing implementation. Signing exists only in the built apps, via Trust Wallet Core 4.9.2.

**Open item:** the live EIP-1559 proof was demonstrated on Core 4.8.4 and must be re-run against 4.9.2.

## 2. Privacy: xpubs are sensitive public material

An xpub does not normally let an attacker spend, but its holder can derive many receiving and change addresses below that public node, revealing account structure, address reuse patterns, payment history, balances and customer relationships when payments are observable.

- Treat xpubs as sensitive public material. Treat zpubs the same way.
- Do not paste them into public issue trackers, untrusted analytics dashboards, random "xpub checkers", unreviewed browser extensions or unnecessary chat messages.
- For a multi-account application, consider whether each subsystem really needs the account-level xpub or a narrower public node suffices.
- An xpub or zpub CANNOT recover the wallet: it reproduces only public descendants below the exported account node ([docs/RECOVERY.md](RECOVERY.md)).
- Bawa does not document an xpub-only import workflow — check your chosen watch-only tool's documentation.
## 3. Backup and recovery

A real backup is the ability to recreate the same wallet independently. For a conventional BIP-39/BIP-32 wallet, preserve the mnemonic, BIP-39 passphrase policy, chain derivation policy, account selection and network. For special chains, add whatever the chain requires. For TON, wallet contract/version and wallet-ID/subwallet configuration can matter.

Recovery record = mnemonic + BIP-39 passphrase policy + exact chain/path policy + account/branch + network + chain-specific configuration.

Encryption at rest protects a stored artefact; it does not make plaintext secrets immune to OS compromise, debuggers, core dumps or memory forensics.

### Recovery drill (before funding)

Follow the recovery procedure in [docs/RECOVERY.md](RECOVERY.md). Check that, on a fresh machine using clean software, you can recover the mnemonic, apply the exact passphrase, apply the exact derivation policy, derive the expected address and compare it with a previously recorded address.

Do this before trusting the wallet with meaningful funds.

### Separate backups

Keep each backup component in a separate location:

- `seed.enc.json` in one location.
- The data key in another location.
- The mnemonic in an offline recovery location.

Do not store all three in the same place.

Use the offline recovery set for wallet recreation and a sensitive xpub for watch-only visibility. Treat xpubs and zpubs as **sensitive public material**. Do NOT send either the offline recovery set or this sensitive public material to public issues or untrusted services.

Plan for each backup boundary:

- **Fire/flood:** keep 2–3 offline copies in separate places that do not share one fire or flood risk. Bawa does not prescribe backup media or protective storage; choose these for the risks at each location.
- **Theft:** choose and record physical access controls for each copy, including how its storage protects against theft.
- **Loss:** use separated copies to provide alternatives. Test independent recovery before relying on them.

### Material checklist

- Write the recovery record offline and keep 2–3 separated copies.
- Never digitise the mnemonic or share it with "support".
- Preserve the BIP-39 mnemonic, or an existing `seed.enc.json` plus its separate 32-byte data key.
- Preserve the exact BIP-39 passphrase policy: currently an empty passphrase.
- Preserve the chain derivation paths and address policy, account and network/chain configuration.
- For TON, preserve the wallet contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID.
- Keep the recorded configuration whichever recovery route you use.
- Keep xpubs out of the excluded destinations: public issues and untrusted services. Check whether each subsystem can use a narrower public node.

### Decryption-handling checklist (unresolved gaps)

- **BIP-39 passphrase custody and re-entry:** preserve the exact policy: currently empty. Use the same policy when restoring and verify it with the mnemonic before funding.
- **Encrypted xpub/backup format and tooling:** Bawa documents recovery from `seed.enc.json` using `tools/decrypt_seed.py`. It does not document an encrypted-xpub format or associated tooling. Consult your chosen watch-only tool's documentation.
- **Decryption-key custody and recovery:** preserve `seed.enc.json` and its separate 32-byte data key. Check that you can access both when testing recovery.
- **Plaintext, memory and clean-up handling:** choose how the mnemonic will be displayed/written before decrypting. Bawa does not document memory clearing or a full clean-up procedure. Review your trusted machine and recovery tool's plaintext handling before use.

On a trusted machine, run:

    python3 tools/decrypt_seed.py /path/to/seed.enc.json

The script is mode 644, not executable. It asks for the data key and displays the mnemonic on the controlling terminal by default. Use `--stdout` only for an explicit, controlled pipeline; use `--output` for an atomic 0600 plaintext file.

This encrypted-seed recovery route is for an existing backup, not permission to digitise your offline mnemonic. Separated copies alone do not provide encryption or guarantee survival of a fire or flood.

### Restore gate (conceptual/testnet only)

1. Before funding, test independent recovery on a clean trusted machine, as required by [docs/RECOVERY.md](RECOVERY.md). Verify the mnemonic and exact passphrase policy, derive known public addresses and compare them with the recorded originals. Do NOT fund until the public outputs match. Repeat the drill quarterly with a tiny testnet amount.

2. **Proposed first-address check:** compare the restored first receiving address with `[RECORDED_TESTNET_FIRST_ADDRESS]`, using the recorded chain, derivation paths, address policy, account and network.

   Bawa's drill stops at `fresh`: seed decryption is documented, but Bawa does not document a complete restore tool/UI workflow or a first-address selection procedure for this drill. Follow your recovery tool's documentation to reproduce the recorded settings. Use a reference address recorded from your original testnet wallet before the restore.

   The first-address comparison is a check, not a standalone restore procedure or a fixed address output; it does not make xpub-only recovery possible.

### Compromise rehearsal (testnet only)

A compromised seed cannot be changed. As required by [docs/RECOVERY.md](RECOVERY.md), generate a new wallet on a fresh trusted device, move every asset/token to it and retire the old wallet permanently. For this testnet rehearsal, apply that rule to every test asset/token.

### Passphrase and backup checklist

Record the recovery set offline, including the exact BIP-39 passphrase policy.

| Item | What to record offline |
|---|---|
| Mnemonic | Record the complete mnemonic in its exact word order. |
| Passphrase | Record the exact BIP-39 passphrase policy. Under the current policy, leave the BIP-39 passphrase empty and record that it is empty. |
| Wallet selection | Record the wallet, chain, network, account, derivation paths and address policy. |
| TON if applicable | Record any applicable TON wallet and chain settings needed to reproduce the same addresses. |

Use the recorded passphrase policy exactly during recovery. Verify the mnemonic/passphrase before funding. Bawa does not document non-empty passphrase setup or lost-passphrase handling. If you cannot verify the mnemonic and exact passphrase policy, mark recovery incomplete and **do not fund**.

Keep **2–3 separated offline copies** in places that do not share one fire or flood risk. Choose and record physical access controls. Never digitise the mnemonic or share it with "support".

Before using an existing encrypted backup, complete its decryption-handling checklist:

- Document the format.
- Document the tool.
- Document credential custody.
- Document plaintext/memory handling.

If any of these remain undocumented, recovery is blocked.

Bawa's [docs/RECOVERY.md](RECOVERY.md) documents an alternative to the mnemonic backup: encrypted `seed.enc.json` plus its separate **32-byte data key**. Keep the exact passphrase policy and applicable wallet/chain configuration too. Follow the recovery procedure in that document; do not substitute this checklist for it.

Bawa does not document memory handling or encrypted-xpub backup handling. Obtain a verified procedure for any applicable handling requirements before decrypting. If those requirements remain unresolved, recovery is blocked.

Treat xpubs and zpubs as **sensitive public material**. An encrypted xpub still cannot replace the wallet recovery set.

### Restore drill (before funding, then quarterly)

Complete recovery on a clean trusted machine before funding, as required by [docs/RECOVERY.md](RECOVERY.md). Verify the mnemonic/passphrase, derive known public addresses and compare them with the recorded originals. Do not fund until the public outputs match.

1. **Record the first-address reference.** Record the unfunded testnet wallet's first-address reference and network/account/derivation context, including address policy and any applicable TON settings. Use a recorded public address from your own wallet, not an example address. Bawa does not document a first-address generation procedure — check the relevant wallet and chain documentation for that procedure before relying on the reference.

2. **Restore and compare.** Bawa does not document chain-specific restore steps — obtain a verified, documented restore procedure for the recorded wallet and chain before continuing. Without a verified procedure, the drill is incomplete.

   Restore on a clean trusted machine using the complete recovery set and the documented restore procedure for your wallet. Use the derivation paths, address policy and network configuration in your recovery record. Verify the mnemonic and exact passphrase policy, then derive the first address in the recorded context and compare it with the reference. Compare any other recorded known public addresses as well. Do not fund until the public outputs match.

3. **Repeat quarterly.** Use a tiny testnet amount only, or keep the drill conceptual. Bawa does not document a signing procedure — use verified signing instructions for the relevant testnet to check spending recovery; otherwise mark spending recovery **untested**. Use no real funds in this drill. A conceptual drill does not replace the required pre-funding recovery check.

### Compromised seed (conceptual only)

A seed cannot be "changed". [docs/RECOVERY.md](RECOVERY.md) requires:

1. **Generate a NEW wallet on a fresh trusted device.** Bawa does not document device-trust checks or wallet-generation procedures — use a verified device-setup process and the wallet's documented generation procedure.
2. **Move EVERY asset/token to the replacement wallet.** Bawa does not document asset discovery, transfer or confirmation procedures — use the relevant wallet and chain documentation to identify every holding, transfer it and verify receipt before retiring the old wallet.
3. **Retire the old wallet PERMANENTLY.**

### Recovery rehearsal procedure

Follow the recovery procedure in [docs/RECOVERY.md](RECOVERY.md). Use the checks below for the rehearsal gate. They define the gate's procedure, **not a claim that it has run**.

**The rehearsal has never been executed.** Show every unexecuted gate as **FAIL**.

| Check | Pass criteria | Status |
|---|---|---|
| Clean-install restore | Complete a clean-install restore on a clean trusted machine with disposable test fixtures, using the linked recovery procedure and verified wallet/chain instructions. | **FAIL — unexecuted** |
| Expected addresses | Match the derived public addresses against the fixtures' recorded expected addresses, using the recorded network/account/derivation context, address policy and applicable TON settings. | **FAIL — unexecuted** |
| Testnet signing check | Verify spending recovery with a successful testnet signing check. Use verified instructions for the relevant testnet and a tiny testnet amount only; use no real funds. | **FAIL — unexecuted** |
| Sanitised record | Keep a sanitised record of the fixture context, address comparisons, signing result and check results. Exclude mnemonics, passphrases, data keys and other credentials. | **FAIL — unexecuted** |

Require every check to pass before marking the rehearsal complete.
## 4. Dependency and supply-chain discipline

Wallet code is sensitive to dependency drift. Document runtime versions exactly; commit lockfiles; verify release tags; run CI tests; add secret scanning and dependency review; publish release checksums/provenance where appropriate.

Do not write `"dependency": "^4.8.4"` and assume that means "the code I tested" — a caret range means future compatible versions may be selected. For security-sensitive primitives, pin the tested release in the actual application lockfile and review upgrades deliberately. Trust Wallet Core itself recommends checking the current release/version rather than blindly using an old example ([official Wallet Core repository](https://github.com/trustwallet/wallet-core)).

Keep the reproducibility chain intact: source tag → lockfile → clean build → tests → artefact hash → release. That is far more useful than writing "secure" in the README.

### Independent verification and supply-chain discipline

Use the pinned Trust Wallet Core runtime for the production wallet path. Use `bip_utils` for independent verification where the standards and derivation policy overlap.

**Production = Trust Wallet Core; verification = bip_utils + official vectors.**

Do not share the same Bawa adapter logic between the two paths. Before a real-money release, commit the dependency lockfile from a clean install and add secret scanning, dependency scanning, reproducible release metadata and an external security review.

### Release blocker

1. **Lockfile — PARTIALLY RESOLVED at `e3b65fb0`.** `tools/hdwallet-gen/package-lock.json` is committed (Core 4.8.4 exact, verified 2026-11-08); `npm ci` runs inside `tools/hdwallet-gen`. No root lockfile exists, so `npm ci` is not runnable against the repository root and no install reproduces the exact dependency graph for the root. At the former pin `082f7915` no lockfile existed anywhere in the repository.

   `npm ci` requires a lockfile, exits with an error on mismatch, deletes `node_modules` first, and never writes to `package.json` or the lockfile.

   **NOTE:** At the former pinned commit `082f7915`, no lockfile existed anywhere in the repository. The phase-1 repair adding `tools/hdwallet-gen/package-lock.json` was pushed to `main` as `e3b65fb0` on 2026-11-08, and this guide set re-pinned to `e3b65fb0` on 2026-11-09 (user decision, recorded in `REPIN-NOTES.md`). The remaining lockfile gap is the root lockfile only.

### TARGET — CI design, not existing CI

- Run jobs for Node tests, Python differential, dependency scan and secret scan on push and PR.
- Pin the runner to a fixed Ubuntu label and record the runner image identity.
- Pin Node to a complete validated Node 22 version, and pin npm and Python to exact versions.
- Pin every action to a full-length commit SHA.
- Commit the lockfile first, then install with `npm ci --ignore-scripts --no-audit --no-fund`.
- Make both test jobs check out the same revision and fail on empty/skipped tests. Retain a successful differential run for that SHA.
- Configure Dependabot for Actions in `.github/dependabot.yml`.
- Set `permissions.contents: read`; grant no other permissions.

### Current CI

`.github/workflows/ci.yml` runs **ONE job**, `static-checks`: checkout, setup Node 22, `npm install`, then `npm run check` (syntax only). It never runs `npm test` or the differential test, and there is no Python job. It uses floating `ubuntu-latest`, `actions/checkout@v4` and `actions/setup-node@v4`.

When this CI description was written, the repairs were unpushed. CI triggers only on push/PR, so it never ran on the repaired tree. Keep that historical state separate from the later repair pushed to `main`.

## 5. Common mistakes

1. **"BIP-39 is the wallet"** — No. BIP-39 gives you a mnemonic and a seed derivation procedure; the downstream HD/key/address policy is another layer.

2. **"Every chain uses m/44'."** — No. Bitcoin BIP-84 is a different purpose; Cardano uses its own CIP purpose; TON has wallet-contract semantics; Substrate uses a different URI/crypto model.

3. **"The same EVM address means the same network."** — No. The address may be the same while the chain ID, RPC, balances and token contracts are different.

4. **"RPC gives transaction history."** — Sometimes you can build history with RPC calls, but a raw RPC node is not a pre-built wallet index.

5. **"The xpub is public so it belongs in .env.example with everything else."** — It can be public in cryptographic terms while still being privacy-sensitive operational data. Treat xpubs as **sensitive public material**.

6. **"If getBalance works, the tracker works."** — No. You still need token events, retries, reorg handling, historical queries, persistence and reconciliation.

7. **"Encrypting the seed means memory is safe."** — No. During generation, plaintext secret material exists in process memory before encryption; JavaScript strings and WebAssembly allocations do not provide a perfect secure-memory primitive.

8. **"Self-hosted means free."** — Software can be free while the infrastructure is not; a full node may require substantial disk, bandwidth, CPU, RAM, backups and maintenance.

9. **"A random GitHub fork is an official implementation."** — Never assume this. Start from the blockchain's official documentation, the project's canonical repository, standards and maintainers with a visible history.
## 6. Incident response: what to do when something is compromised

Apply this rule in every scenario: **changing the vault password cannot secure an exposed phrase — only a fresh seed and migration can.** A compromised seed cannot be changed.

Complete the migration: generate a new wallet on a fresh trusted device, move every asset and token to it, and retire the old wallet permanently.

### Lost or stolen device

1. Stop using that wallet.
2. Generate a new wallet on a fresh trusted device, using an independent seed generated on a clean signer.
3. Move every asset and token to the new wallet, and migrate signing roles across affected networks. Retire the old wallet permanently.
4. Do not rely on a vault-password change to secure an exposed phrase. Only a fresh seed and migration can. Revocation cannot repair key theft.
5. Use documented incident-support routes when handling gas top-ups: sweeper bots may steal them.
6. Revoke exposed service credentials too.

### Compromised vault

1. Treat the phrase as exposed if the vault was opened on a compromised machine.
2. Change the vault password **and** migrate to a fresh seed on a fresh trusted device. Generate a new wallet, move every asset and token to it, and retire the old wallet permanently.
3. Do not treat the password change as a remedy for phrase exposure. The password change alone does not secure the phrase; only a fresh seed and migration can.

### Disclosed phrase

1. Treat the phrase as burned. A compromised seed cannot be changed.
2. Generate a new wallet with a fresh seed on a fresh trusted device. Move every asset and token to it, and retire the old wallet permanently.
3. Do not try to repair the exposed wallet by adding a passphrase or changing a password. Changing the vault password cannot secure an exposed phrase — only a fresh seed and migration can. Revocation cannot repair key theft.

## 7. Disclosure: no channel exists

**OPEN ITEM — owned by the maintainers.** No vulnerability-disclosure procedure exists, and neither `SECURITY.md` supplies a contact or channel.

**Existing line — OPEN ITEM:**

> Send vulnerability reports to the repository maintainers through a private reporting route. Keep exploit-enabling details out of public issues.

No private reporting route is documented, so this line does not identify an available channel. Establish and document one; that is the maintainers’ open item.

### Open items and required work

Carry these as open work and requirements, not claims that controls are implemented:

- **OPEN ITEM — phrase clipboard policy.** Define a clipboard policy for the phrase in the Web guide. The Web guide currently has none.
- **OPEN ITEM — script injection.** Give “defend against script injection” an executable control. It currently has none: no CSP/SRI/inline-script rule.
- **PBKDF2 600,000 iterations — basis.** Use the [OWASP Password Storage Cheat Sheet 2023](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) as the basis for this value: checked live 8 November 2026; contains “600,000”.
- **OPEN ITEMS — vault passphrase and unlock time.** Define the vault-passphrase strength policy and unlock-time target. Keep both marked as open items, not stated policy.
- **Required — network-identity verification.** Verify network identity for BTC, TRON and TON adapters too, not only ETH (`chainId 11155111`).
- **Builder duty — genuine-app verification.** Make the genuine app verifiable through its official origin, publisher identity, release signing and key continuity.

### External security review gate — FAIL

Define the scope and execute the review:

- Cover seed handling, derivation paths, transaction signing, recovery and dependencies.
- Name the components in scope at a particular revision.
- State the exclusions.
- Include follow-up review of fixes.

Keep the gate marked **FAIL** until the scope is defined and the review executed.
## 8. Air-gapped signing with PSBTs

A PSBT lets an online wallet prepare a payment without holding the keys needed to authorise it. In Bawa, give the watch-only coordinator the account's public derivation root so it can discover coins through RPC or an indexer. Treat xpubs as **sensitive public material**. Keep the mnemonic, seed and private keys on the trusted offline signer.

**Flow:** online watch-only coordinator prepares payment → unsigned PSBT by QR code or removable media → offline signer verifies details, then signs → signed PSBT by QR code or removable media → online coordinator finalises and broadcasts.

1. **Build online.** Choose coins to spend, enter the destination and amount, set the fee and export an unsigned PSBT. The coordinator does not need a seed; stop if it asks you to import one.

2. **Carry the unsigned PSBT to the signer.** Use a QR format supported by both applications, or removable media. Keep the signer disconnected. Treat the PSBT and its carrier as untrusted input, not proof that the payment is correct.

3. **Check on the signer's own screen.** Compare the full destination address and amount with payment details obtained independently of the coordinator. Check the fee. For every change output, require the signer to verify that the address belongs to your wallet using its own derivation data. A coordinator's “change” label is not evidence of ownership. If these checks are unavailable or anything differs, do not sign.

4. **Sign offline.** Approve only the transaction you have checked, then export the signed PSBT. Do not include a mnemonic, seed or private-key file with it.

5. **Carry it back and broadcast.** Return the signed PSBT by QR code or removable media. Import it into the coordinator, finalise it into a transaction and broadcast it. Record its transaction ID so you can check its status without creating another payment.

### What it protects (and does not)

Keeping signing keys offline protects them from direct theft by malware on the connected machine. A monitored or compromised coordinator has no local seed or private keys to extract.

The air gap does **not** stop a compromised coordinator swapping the destination before signing. It does not protect you when a signer shows a doctored transaction and you approve it without checking, or against physical seizure of the signer. A dishonest signer can lie about what it signs; screen checks cannot turn compromised signing hardware or software into something trustworthy.

### Cost and failure modes

The coordinator software is free; a dedicated signer costs money. Preparing and maintaining a spare offline machine costs time and may involve hardware costs. Bitcoin network fees still apply.

- **Lost unsigned PSBT:** Losing an unsigned PSBT is harmless to funds: it cannot authorise a spend without signatures. Rebuild it if needed. It is not necessarily harmless to privacy: someone finding it may learn addresses, amounts and wallet activity.
- **Signed PSBT submitted twice:** Rebroadcasting the same finalised transaction does not pay twice or charge another fee. An “already known” response may be normal. Check the original transaction ID rather than making a fresh payment.
- **Wrong change address:** The recipient can be correct while the remaining coins go somewhere you do not control. Reject unverified change before signing. If the transaction confirms with change sent elsewhere, the air gap cannot recover those coins.

## 9. Open-firmware signers, free software

Open firmware makes the signer's firmware source available for independent audit; some makers also publish hardware designs for review. A free-software licence permits study, modification and sharing under its terms.

Do not treat availability as evidence of an audit. Look for a report naming the reviewed version, scope and unresolved findings; even an audit can miss faults.

The software is free; the physical device costs money. Check the maker's own site for current costs, including delivery and taxes.

### Verify every release before installation

- Follow the maker's verification instructions for the exact firmware file.
- Use a trusted release-signing key, confirming its fingerprint through a separate trusted channel.
- Check the intended device model and firmware version too.
- Stop if verification fails or the key is unexpected.

Public source does not authenticate a download. Signature verification catches altered files and unauthorised substitutes; it does not prove the binary matches the published source or that the code is safe. A malicious official build, firmware signed with a stolen release key, or an older vulnerable release can still pass verification.

### Other failure modes

Other failure modes include tampered hardware, interrupted updates and lost or exposed recovery backups.

A compromised computer can propose the wrong payment. Read the recipient, amount and fees on the signer's display before approving. The device cannot correct a harmful transaction you authorise.

An exposed recovery backup may let someone spend without the device.
## 10. Do-it-yourself stateless signers, free software

SeedSigner- and Krux-class projects show the pattern — a commodity board, screen, controls and camera. These names describe an approach, not current device recommendations. Check public advisories for the exact hardware and firmware before choosing a build. An unresolved public seed-generation advisory rules it out. Use hardware with NO Wi-Fi and NO Bluetooth, rather than merely disabling radios. Run with NO persistent key storage: no saved seed files, even encrypted ones. Enter the seed afresh each session, keep it only in RAM, remove power afterwards. Communication with a compatible wallet is QR-only; use a power-only connection, not a data cable. Flow: online watch-only wallet, into unsigned transaction QR, into offline stateless signer, into signed transaction QR, into online wallet broadcasts. Depending on firmware, seed-generation options include dice rolls or camera-derived entropy; follow a documented, reviewed procedure and meet its collection requirements; too few rolls, predictable input or faulty entropy processing can produce guessable seeds; camera entropy is not a reason to photograph your mnemonic. Keep a protected offline recovery backup, such as paper or metal.

What it helps against: during signing, the networked wallet need not hold the seed or private keys, reducing direct key theft by malware on that computer; removing radios removes those wireless entry points; not saving keys reduces what a thief can extract from a powered-off device's storage. What it does not cover: malicious firmware, tampered components, memory extraction, QR-parser vulnerabilities, stolen backups, or approving a substituted transaction — check destination, amount and fee on the signer itself; power interruptions, failed storage media, unreadable QR codes can stop a session; losing the only recovery backup can mean losing access altogether. Nor does this repair an earlier leak: Bawa's controlling-terminal route keeps the mnemonic and data key out of ordinary subprocess stdout/stderr capture; it does not isolate them from the host; a hostile OS or terminal, debuggers, crash dumps, swap and memory snapshots can still expose them; loading an exposed seed into another device does not make it secret again.

The software is free to use, inspect and modify; parts and replacements cost money; assembly, firmware verification and recovery testing take time. Choose this route over a paid option if you are comfortable taking on that maintenance. A maintained, supported paid signer may suit you better if you want less assembly and troubleshooting; payment alone is no security guarantee.
## 11. Free Bitcoin multisig: keep the keys and the policy

Sparrow and Electrum are free open-source coordinators. A 2-of-3 wallet requires signatures from any two of three independent keys; the coordinator can remain watch-only (prepares transactions without holding seeds).

What it buys: one compromised key cannot spend alone; losing access to one key need not strand funds if two usable keys and the full policy remain; with proper separation, one fire or theft need not remove the entire recovery route. It does not survive permanent loss of two keys, compromise of two keys, or two signers approving a fraudulent payment.

Registered policy lets a signer recognise its own change; it does not prove an external recipient's identity. Check destination and amount on trusted signer displays against independently obtained payment details.

### Set up and prove it (7 steps)

1. **Check compatibility first** — obtain verified releases from the projects' official distribution channels; choose a coordinator and signers supporting your exact policy, full policy registration and change validation; Bitcoin native SegWit multisig, P2WSH, is a common choice; check firmware support; do not assume every device qualifies.

2. **Generate separate keys** — initialise three signers independently; cloning one seed does not create independent keys; make offline seed backups; record seed format and passphrase requirements, including whether the BIP-39 passphrase is empty; keep any required passphrase independently recoverable; Electrum-native seeds are not BIP-39; keep seeds out of the everyday coordinator.

3. **Assemble the wallet** — select 2-of-3 and the intended Bitcoin network; import each signer's account public-key export; compare the full public keys and their origins against trusted signer exports; names and short fingerprints alone are insufficient.

4. **Register the same full policy on every signer** — confirm the threshold, all cosigner keys, paths and script type through each signer's supported verification flow; test receive-address verification and change recognition before substantial funding; do not use blind signing; after a reset or replacement, seed restoration is not enough — register the policy again.

5. **Back up the public policy** — keep a watch-only wallet export and, where supported, checksummed descriptors for both receive and change branches; record:
   - 2-of-3;
   - all three cosigner xpubs and master fingerprints;
   - exact origin, account and branch paths;
   - script type;
   - key ordering or sorting;
   - Bitcoin network.

   Two seeds still need the third cosigner's public information. An individual xpub/zpub is not a multisig recovery package. Test exports: Sparrow and Electrum formats are not automatically interchangeable.

6. **Separate the backups** — arrange signers and seed backups so one incident cannot expose two distinct keys; three software signers on one infected computer do not provide that separation; keep multiple offline policy copies in separate locations; a public policy file cannot spend by itself, but it can reveal addresses and transaction history — protect its privacy; the watch-only file is not a seed backup.

7. **Run a recovery rehearsal** — rebuild the watch-only wallet in a clean compatible installation from the policy backup, and compare receive and change addresses; check every seed backup using the signer's recovery-check feature or a spare trusted signer; confirm that the backed-up passphrase, if used, reproduces the recorded account public-key export; use a small balance to test each signing pair, including change, with the third signer absent; leave repeatable instructions for your future self or executor.

### Failure modes

Wrong passphrases, paths, script types, key ordering or networks can produce a different, empty wallet; missing policy information can block recovery despite two surviving seeds.

After suspected key theft, replace that key in a newly verified policy and move funds using two trusted signers; editing coordinator settings does not change existing coins' spending conditions.

### Cost and when to choose it

The software has no licence or subscription fee; budget for three compatible hardware signers if you use hardware, backup materials and any paid storage; software signers still need genuinely isolated systems; miner fees apply, including rehearsals; multisig spends generally cost more than comparable single-key spends; maintenance and testing also cost time.

Choose this over paid assisted multisig if you can manage separation, policy records and regular recovery tests. Paid help may be worth its fee for setup checks, replacement support or inheritance planning. If a provider holds a key, insist on the full exportable policy and test that your own two keys can recover without that provider.
## 12. EVM smart-contract wallets

With Safe-class tools, your account is a contract on a specific EVM network; its owner list and signature threshold live on-chain. A mnemonic restores one owner's key, not the whole account: control still requires whatever the contract currently authorises. This redundancy covers assets controlled by the contract, not balances left in a separate seed-controlled account.

### What it protects against

A straightforward 2-of-3 Safe can tolerate one unavailable signer; one stolen owner key cannot spend alone. This helps with device loss, theft or a damaged backup when owners and their recovery materials are genuinely independent.

Three addresses derived from one mnemonic do NOT provide that independence. Do not store enough owner backups to satisfy the threshold in one location.

### Queuing and approval

Owners usually exchange proposals and signatures off-chain, approving the same transaction at different times:

Independent owner signers → approvals collected for one transaction → executor submits and pays gas → Safe checks policy and executes.

Treat a hosted queue as a convenience, not a timelock or the wallet itself. Once nonce and policy checks pass, anyone holding enough valid signatures can execute. Earlier Safe nonces can block later ones.

Deleting a queued item does not revoke signatures. For normal cancellation, execute an authorised replacement at that nonce; it can race the original.

### Setup (5 steps)

1. **Prepare independent owners.** For example, initialise three separate hardware-wallet signers. Keep each owner's mnemonic backup offline and apart. Record BIP-39 passphrase requirements, the exact derivation path and account/branch. Preserve any required passphrase securely too. Restore each owner separately on trusted spare hardware and compare its address. Erase temporary restored copies afterwards. Never enter these secrets into a multisig website.

2. **Deploy deliberately.** Use the project's verified release or official interface on [network/chain ID]. Select the three checked owner addresses and threshold two. After confirmation, check the contract implementation against official deployment records and inspect its owners and threshold through a separate explorer or RPC. Leave optional modules and guards off initially.

3. **Write the recovery inventory.** Preserve [chain ID], [Safe address], deployment transaction, owner addresses, threshold, implementation/version, enabled modules, guards, fallback handler and any recovery or upgrade arrangements. Keep dated offline copies and verify them against current on-chain state before recovery. This record is not a signing secret, but it is privacy-sensitive.

4. **Test with little money.** Send a small test amount to the deployed Safe, then propose a transfer out. Collect approvals separately. Have each signer check the chain, Safe address, nonce, destination, asset, amount and decoded calldata, including every batched call and token approval. Execute and check the receipt and balances. Test that your intended apps support contract accounts.

5. **Practise without a dependency.** Reconnect to the existing address through another compatible client. If proposals are missing, recreate them and obtain fresh signatures. Simulate one owner being unavailable and spend with the remaining quorum. Replace a lost or suspect owner promptly while quorum remains, then update the inventory. Creating another Safe does not recover assets in this one.

### Where it fails

Multisig cannot rescue a compromised quorum or several owners approving the same harmful transaction. Treat enabled modules as separate spending authority: they may execute outside the usual owner threshold. A broken guard can block execution.

Contract bugs and chain failures remain risks. An approved token spender may take tokens without a new Safe vote. Without enough usable owners or a functioning recovery route authorised in advance, access may be permanently lost.

### Cost and when to choose it

For basic self-managed use, deployment gas and transaction gas are the only chain costs; no software subscription is required. Off-chain proposals and signatures cost no gas; on-chain approvals, execution, owner changes and cancellations do. Fees vary with the network and congestion.

Keep the network's gas coin available to the submitting account, or test a sponsorship arrangement. Money inside the Safe does not automatically pay the submitting account's fee. Hardware, hosted services and relayer charges are separate possible expenses.

Choose this over a paid service if you can maintain independent owner backups, review calls and rehearse recovery yourself. Payment can buy coordination, monitoring or assistance; payment alone cannot replace missing signing authority. Before paying, establish whether the provider can spend or block recovery, and whether an independent quorum still works if it disappears.
## 13. Free multisig and descriptor backups

Keep the map as well as the keys — Bitcoin output descriptors (BIP 380 family) describe the scripts and keys used to construct outputs; for recovery, export them with key-origin fingerprints, complete derivation paths and both receive and change branches; multisig descriptors also record the signing threshold and key ordering or sorting rule; a compatible wallet can then reproduce the addresses rather than guess your configuration. Seed words, restored with the correct BIP-39 passphrase, recreate a key tree; they do not identify the chosen wallet policy or the other cosigners. A public descriptor, the matching seed/passphrase and the network/account record make single-sig recovery reproducible. Multisig needs the complete public policy and enough signing secrets to meet its threshold. Even two seeds for an independent 2-of-3 arrangement cannot recreate the third cosigner's public key.

What this protects against (and does not): a descriptor backup protects against lost wallet configuration, a broken coordinator and a vendor disappearing, provided another implementation supports the descriptor; it cannot authorise spending, replace missing signing secrets, or stop an attacker who holds a signing quorum; a 2-of-3 arrangement tolerates one unavailable signer, not two. Public-key material is still privacy-sensitive: like an xpub, a descriptor can reveal linked addresses, balances and future activity — keep it out of public repositories and support tickets; descriptor syntax can also carry private keys: deliberately select the PUBLIC/watch-only export, not a private export.

Set up and rehearse (5 steps): (1) check compatibility first — choose a free coordinator and compatible signers; confirm that an independent wallet can import the exact descriptor features you use ("supports multisig" is not enough); practise with published test fixtures on a test network (their keys are public and must never receive valuable funds). (2) verify the policy — for a 2-of-3 wallet, enrol three independently generated signers; confirm the threshold and fingerprints on trusted signer displays; arrange devices and secret backups so one incident cannot expose or destroy two signing secrets. (3) export both branches — save complete public receive and change descriptors, whether exported separately or together, including their checksums; do not reconstruct them by hand; compare several derived addresses with the original wallet and trusted signer displays; a checksum detects copying errors, not malicious substitution — an attacker's replacement can have a valid checksum and redirect new deposits. (4) make independent copies and import one — put the public export and recovery metadata on two independent offline media; in a clean installation of another compatible wallet, import the descriptors as watch-only; check several recorded receive and change addresses; this check should not require any seed. (5) test discovery and signing separately — rescan from before first use, covering every issued address index on both branches; with the published fixtures, restore enough test signers and complete a test-network spend without the original coordinator; check live signing backups through trusted on-device workflows, never by entering seeds into an online coordinator. An empty restored view is not proof that funds have disappeared: check the network, paths, missing change branch, scan start and address range; changing the key-ordering rule can change addresses; a mistaken BIP-39 passphrase produces different valid keys rather than a "wrong password" error.

Cost and when to choose it: the free route has no software licence or subscription charge; hardware signers, durable backup media and separate storage can cost money; setup and periodic recovery rehearsals cost time. Choose it over a paid managed service when you can maintain the records, separate the signing secrets and repeat the recovery test yourself. Paid help can be worthwhile for supported setup or succession planning. Payment does not replace missing keys or an incomplete policy. If a provider co-signs, check how you recover during an outage and how you leave the service.

Multisig backup list: complete public descriptors (receive and change, checksums, script type, threshold, ordering rule, every cosigner's extended public key, origin fingerprint, full paths); Bawa recovery settings (explicit network, account and branch selections, plus any chain-specific configuration; Bitcoin descriptors do not replace other chains' recovery records); independent secret backups (each signer's offline mnemonic backup; whether its BIP-39 passphrase is empty or used; a separately protected way to recover the exact passphrase when used); discovery records (earliest-use date or block height, issued ranges or next indexes for both branches, trusted reference addresses); recovery instructions (tested importer and version, backup locations, steps an authorised successor can follow; export labels and notes separately if you need them — descriptors do not preserve those).
### Shamir sharing with SLIP-39

Shamir sharing with SLIP-39: SLIP-39 divides a compatible wallet's backup secret into word-based shares; with a single 2-of-3 group, any two distinct shares reconstruct it; one reveals nothing about the shared secret (that guarantee depends on correct implementation and sound randomness; format metadata, such as thresholds, is not confidential). These shares use SLIP-39, not BIP-39: an individual share cannot be converted into a BIP-39 mnemonic or restored through a BIP-39-only import screen; cutting an existing mnemonic into sections is NOT Shamir sharing. What it protects: sharing limits the damage from theft of fewer than the required shares, while redundancy allows recovery after some shares are lost or destroyed; a missing envelope need not mean a missing wallet. It does NOT protect against compromised generation or recovery software, exposure of the complete seed, or attackers assembling a qualifying set; any SLIP-39 passphrase remains a separate requirement; this is not multisignature — after recovery, one wallet can sign transactions without consulting the share holders.

Set-up and recovery drill (6 steps): (1) check compatibility first — confirm that your chosen wallet and Bawa's recovery path support the required SLIP-39 features, including grouped shares and passphrases; accepting "recovery words" does not establish compatibility; if support is absent, choose another backup method rather than improvising a conversion; use maintained software from verified releases; practise with published SLIP-39 test fixtures, whose wallets must never hold funds. (2) choose and record the thresholds — one 2-of-3 group is easier to manage than a hierarchy and tolerates one unavailable share; grouped sharing has two levels: the GROUP threshold specifies how many groups must qualify; each group's MEMBER threshold specifies how many distinct shares qualify that group; for example require 2 of 3 groups, each needing 2 of 3 shares (two shares from A and two from B work; three from A and one from B do not — the total count alone is insufficient). (3) generate and verify offline — use a trusted device and its supported SLIP-39 backup workflow; enter the recorded thresholds and let the implementation generate the shares; do not invent share words or randomness; transcribe each share onto paper or durable media, then complete its verification checks; label the backup set, group and member; do not mix shares from different sets, photograph them, upload them or enter them into a website. (4) handle the passphrase deliberately — if enabled, preserve its exact text in a separate offline recovery location; shares cannot recover a forgotten passphrase; the wrong one can produce a different, valid-looking wallet rather than an error; a weak passphrase may be guessed after a threshold is stolen; record that a passphrase is required, document the exact derivation policy (network, path, account, address type) and record an expected address for comparison. (5) separate access as well as storage — for the simple 2-of-3 arrangement, use three offline locations that do not share a fire or flood risk; record physical access controls and who can reach each share; do not leave a qualifying set at one site or with one backup custodian; duplicate copies of one share still count as only one share — protect their locations too; continue keeping seed.enc.json, its data key and any complete mnemonic in separate locations, with the mnemonic offline; an intact full-secret backup bypasses the sharing layer. (6) test before funding — on a fresh trusted recovery device with clean, verified software, recover without using the original wallet; use exactly a qualifying threshold, apply the exact passphrase and derivation policy, derive the expected address and compare it with your earlier record; for 2-of-3, test all three pairs; for grouped sharing, test the recovery routes you intend to rely on; passing share checksums is not proof of wallet recovery; reset the test device afterwards and retain no secret-bearing logs.

Cost and when to choose it: free implementations mean no software licence fee or required recovery subscription; paper costs little; hardware, durable media, secure off-site storage and travel may cost money; the continuing expense is your time (maintaining records, checking access, repeating recovery drills). Choose DIY sharing over a paid option when you have genuinely independent locations, can maintain compatible recovery tools, and can arrange recovery if you are unavailable. Paying may be worthwhile for supported hardware, storage or recovery assistance; check whether the provider could assemble a threshold, what help its fee actually buys, and what happens if it closes. Unreadable words, unavailable holders, mixed backup sets and losses beyond the configured tolerance can make recovery impossible. Review arrangements when people move, relationships change or software support ends. Once the complete seed has leaked, new shares cannot make it secret again: set up a new wallet on a fresh, trusted device, transfer every asset and token, and retire the previous wallet for good.
### BIP-39 passphrase, a second recovery secret

A BIP-39 passphrase is an extra string used with the mnemonic to derive an entirely different wallet from the same words. It is NOT an extra mnemonic word, a wallet PIN or the data key for `seed.enc.json`.

Follow the derivation chain:

Mnemonic and exact BIP-39 passphrase → BIP-39 seed → keys derived under the chosen derivation policy → wallet addresses.

BIP-39 has NO "wrong passphrase" error: a typo, changed capitalisation or extra space can produce a valid, usually empty wallet without warning. An empty balance is not a recovery check — compare the derived address against your previously recorded reference.

The mnemonic cannot reconstruct a forgotten passphrase, and support cannot reset it. Treat the passphrase as recovery material with its own backup plan, not something you intend to remember indefinitely.

### What it protects (and does not)

A strong passphrase, stored separately, protects against someone obtaining a mnemonic backup alone. That person can still test passphrase guesses offline, without a retry limit. Quotations, personal facts and small variations on familiar passwords are poor choices.

It does not protect against theft of both secrets, malware capturing them during use, malicious transactions you approve, or exposure of the already-derived seed or private keys. Check what wallet exports contain — an export containing spend-capable key material does not acquire another protective layer merely because you originally used a passphrase.

### Set it up and prove recovery (5 steps)

1. **Check compatibility first.** Confirm that your everyday wallet and your intended recovery tools explicitly support BIP-39 passphrases. An application password field is not evidence of support. Check length and character limits. Plain ASCII reduces keyboard and Unicode surprises. Never accept silent truncation.

2. **Generate the passphrase offline.** Use strong randomness rather than inventing a memorable sentence. One practical method is a published 7,776-entry dice-word list: roll a fair die five times, look up that five-digit result, and repeat for at least six independently selected words. Fix the separator, such as one ordinary space, and record the result exactly. Check that the complete string fits every intended recovery tool.

3. **Back up the secrets separately.** Keep 2–3 offline copies of the mnemonic and 2–3 of the passphrase, without storing the two together. Choose sites that would not all be affected by the same fire or flood. For each copy, choose and record physical controls: the locked container, authorised key-holders and retrieval arrangements.

   Preserve separate locations for Bawa's `seed.enc.json`, its data key and the offline mnemonic. The passphrase does not replace that separation.

4. **Record a recovery reference.** Use the wallet's explicit BIP-39 passphrase facility. Record an expected receiving address and the exact derivation policy: coin and network, derivation path, account, receive branch, address index, and script/address type where applicable. Keep this metadata available offline. The words and passphrase do not tell every recovery tool which account layout to search.

5. **Rehearse independently before substantial funding.** Use a fresh, trusted machine with clean, verified software. Keep secret entry and address derivation offline. Retrieve a mnemonic backup, enter the exact backed-up passphrase and reproduce the recorded derivation settings. Derive the reference address and compare it with the earlier record.

   Do not depend on the original device, cached secrets or an existing wallet file. Test each intended recovery route independently, including whether it still works when one storage site is unavailable.

If a drill produces an unexpected address, stop: check the passphrase and derivation settings rather than assuming the wallet is empty. If you have lost the passphrase but a working device can still sign, migrate to a new, tested wallet before that access disappears.

### Adding it later is a migration

Enabling a passphrase does not alter existing addresses or protect funds already held there. Addresses originally derived with an empty passphrase remain accessible using the mnemonic alone.

Verify the new wallet's recovery, complete a small receive-and-spend test, then transfer all intended assets to its new addresses. Changing an existing passphrase also creates another wallet — it is not an in-place password change.

For a known mnemonic or seed compromise, do not try to repair the exposed wallet by adding a passphrase: generate new words on a newly prepared, trusted device, transfer every coin, token and other asset, and permanently stop using the compromised wallet.

### Cost and when to choose it

Compatible software may provide this feature for £0, with no subscription. The practical costs are offline materials, separate storage, recovery drills and another irreplaceable secret. Moving existing funds also incurs network fees.

Choose it over a paid backup service when your main concern is theft of a mnemonic copy, you want no service dependency, and you can maintain and test separate records yourself.

Paid durability or recovery assistance may still be worthwhile — those solve different problems. Check what the fee buys and who can access the secrets. Payment does not make a missing BIP-39 passphrase resettable.
## 14. Free tools: encrypted offline backups

Use encrypted files as a SECONDARY recovery route, not the main backup. Keep the mnemonic offline on paper or metal. Paper costs little but is vulnerable to fire and water; suitable metal withstands more physical damage, but neither conceals the words from someone who finds it. Maintain two or three offline copies across locations that would not be lost in the same fire or flood.

**What encryption protects against:** someone finding or stealing a backup drive without obtaining its strong decryption passphrase.

**What it does NOT protect against:** malware watching creation or recovery, an attacker acquiring both file and passphrase, destroyed media, or forgotten credentials. A weak passphrase can be guessed offline without an account lockout slowing the attacker down.

### Set it up (age workflow)

1. **Plan storage first.** Keep Bawa's `seed.enc.json`, its data key and the offline mnemonic in separate locations. An age-encrypted recovery file does not replace Bawa's data key or change its file format. Record the physical access arrangements for every copy: its safe or locked cabinet, who controls access, and how an authorised person retrieves it. Two drives in one drawer share one disaster risk.

2. **Prepare a clean offline session.** Obtain and verify the encryption software before disconnecting. Use trusted equipment, keep networking disconnected and work away from cameras. Prepare a RAM-backed workspace with swap, hibernation and editor autosave disabled. Ordinary deletion, particularly on an SSD or USB drive, is not dependable removal of plaintext.

3. **Create the recovery record.** In that workspace, make `recovery.txt` containing the mnemonic and the information needed to interpret it: mnemonic scheme, network and complete derivation settings. Do not include the wallet derivation passphrase or Bawa data key. Keep non-secret recovery instructions with the primary copies too. Independently record a known wallet address for the later comparison.

4. **Generate a separate file-encryption passphrase.** Use substantial randomness, not a memorable quotation—for example, seven words independently selected with dice from a 7,776-entry word list. Record the result accurately on paper and store it offline, apart from every ciphertext copy. Do not reuse a wallet derivation passphrase or Bawa data key. Record any wallet derivation passphrase separately from the mnemonic backups.

5. **Encrypt locally.** With the working directory on the RAM-backed volume, run:

   ```sh
   age -p -o recovery.age recovery.txt
   ```

   Enter the file-encryption passphrase at the interactive prompt. Never put it in a command argument, script or shell history. The filenames are illustrative; no secret values belong in the instructions.

6. **Move only ciphertext to removable storage.** Copy `recovery.age` to your separated offline drives. Label each with a non-secret identifier and creation date. Retain the tool name, version and restore instructions. Disconnect the drives and shut down the temporary environment when finished. Encryption is not permission to place seed material in cloud storage, a note app, a password manager or a photo library.

A maintained GPG release using symmetric encryption is another option. Choose one format and document it rather than adding layers you cannot reliably recover.

### Cost and when to choose it

The software costs £0. Removable drives are a modest one-off expense, but replacements, secure storage, travel between locations and recovery practice still cost money or time.

Choose this over a paid encryption product when you can manage offline file handling, maintain separated storage and perform the recovery yourself. Paying for durable offline media or competent support may be worthwhile if it reduces handling mistakes; a subscription or expensive package cannot compensate for missing recovery information.

### Failure modes

Flash storage can fail silently—keep independent copies and test them periodically. Encryption may detect damage, but it cannot reconstruct missing bytes. Lost passphrases, truncated files, obsolete software and undocumented derivation settings can all leave intact-looking backups unusable. Rehearse again after changing the recovery procedure.

Re-encrypting a leaked mnemonic does not make that wallet safe again: create an entirely new wallet on a fresh, trusted device, transfer every asset and token, and stop using the old wallet permanently.

### Recovery drill

Before depositing a meaningful amount, run this drill offline on a fresh, trusted machine running clean, verified software.

1. Retrieve one encrypted copy and its separately stored file passphrase.

2. In a RAM-backed workspace, decrypt it:

   ```sh
   age -d -o recovered.txt recovery.age
   ```

3. Recover the mnemonic, apply the exact wallet derivation passphrase (or the recorded absence of one) and reproduce the precise derivation policy: network, address type, path, account, address index.

4. Derive the address and compare every character with the independently recorded address.

Successful decryption alone proves too little—a wrong derivation passphrase can produce a valid-looking, unrelated wallet.

Repeat independently for every copy, including the primary paper or metal route, without relying on the working wallet.
## 15. Free everyday defences: token approval hygiene

Treat an EVM token approval as a standing permission, not a website session. For ERC-20 tokens, an approved spender can move tokens up to the remaining allowance without another signature from you. An NFT operator approval can cover an entire collection. Disconnecting a site leaves those on-chain permissions in place.

**What this protects against:** Remove unnecessary permissions to reduce exposure to forgotten, malicious or later-compromised spenders. Check empty addresses too — an allowance may still cover tokens you receive later.

Revocation cannot undo a drain, repair a compromised key or prevent you granting another harmful permission. This is not a general audit of native-coin transfers or smart-wallet permissions. A hardware signer can protect the key while correctly signing the malicious approval you confirm — it is not a substitute for understanding the permission.

### Free-security checklist

Read permissions → verify spender and scope → submit revocations → check confirmed on-chain state.

1. **Start with a free, read-only checker.** Reach it through established wallet documentation or the checker's canonical repository, and verify the domain independently. Avoid adverts and unsolicited "urgent revocation" links. Paste your public address; obtaining the initial list should require neither a wallet connection nor a signature. Never enter a mnemonic into a checker.

2. **Check every address and network you have used.** The same EVM address can have entirely different approvals on different chains. Sort newest first, then work through the whole list. Inspect current permissions as well as historical approval events. Check the tool's network and token-standard coverage. A working balance display or an empty result is not proof that every approval has been examined.

3. **Identify the spender, not merely its label.** Compare the full spender address with the project's official deployment records for that network. Familiar names and token symbols are not authentication. Revoke unlimited allowances, unrecognised spenders and permissions for services you no longer use. For a recognised ERC-20 service you still need, grant only the amount required for your next action rather than restoring an unlimited allowance.

4. **Connect only when ready to make the changes.** Have enough of the chain's fee token available. Check the network, token, spender and decoded operation before signing. An ERC-20 revocation normally targets the token contract and sets the selected spender's allowance to zero. For NFTs, clear the relevant individual approval or collection-wide operator permission. Reject unexpected transfers, fresh allowances or unrelated signatures. Do not blind-sign a transaction merely because the website labels it "Revoke".

5. **Verify the result after confirmation.** Refresh the current allowance or operator state, using an independent explorer or read-only view where practical. Old approval events remain in history after revocation; their continued presence does not mean the permission remains active. Check that you changed the intended token, spender and chain.

6. **Set a quarterly reminder now.** Repeat across all your addresses and networks, including those without current holdings. Review sooner after unfamiliar applications, suspicious signing requests or a reported spender compromise.

### Failure modes

- **A checker can miss permissions.** Indexing may be delayed or incomplete. Support for individual NFT approvals, operator permissions and permit systems varies. A balance query is not an approval-history service. Cross-check important holdings rather than treating one dashboard as authoritative.

- **Give Permit2 and signed permits separate attention.** Permit2 has permissions beneath the token's allowance to Permit2 — inspect both layers. An off-chain permit may remain invisible until somebody submits it. Some unused signatures can establish an allowance again after you clear it. If you signed a suspicious permit, follow the token or permit system's documented cancellation or nonce-invalidation procedure where supported. A blank scan is not proof that the signature is harmless.

- **Do not confuse submitting with revoking.** Until the change takes effect, the existing permission remains usable; a spender may transfer first. A failed transaction can consume gas without changing the allowance. Do not wait for the quarterly review when you suspect active misuse.

### Cost and when to choose free tools

Read-only inspection needs no gas payment. Revoking costs gas in the relevant network's fee token, and busy networks can make several revocations expensive. Check the fee estimate before signing. Budget time for identifying spenders and checking results. Queries also disclose your public address (and often your IP address) to the service operator.

Choose free checkers and scheduled manual reviews over a paid approval dashboard when you can reliably cover your addresses and chains yourself.

Paid monitoring may be worthwhile for demonstrably better coverage, alerts or support when account volume makes manual review unreliable. Check those features rather than trusting the price badge — alerts can arrive after a transfer, and payment cannot recover stolen tokens or make an authorised malicious approval safe.
### Address poisoning and phishing

An attacker can add a zero-value transfer from a look-alike address to your activity; that entry alone does not give them spending permission — the aim is to influence your next payment. If you mistake the look-alike address in your transaction history for a previous recipient and reuse it, the later payment goes to the attacker. Phishing targets trust more directly: sponsored search results lead to cloned sites, and fake recovery services offer help before asking for secrets, money or signatures.

(1) **Prepare recipients outside transaction history** — get the current receiving address from the recipient over an independently verified channel, or from a service's verified receiving page. Save the full address and network in your wallet's address book, if available; check the entry before saving. For each payment, copy from that original source or verified entry. Do not reuse addresses from activity lists. After pasting, compare every character against the trusted source. Expand shortened displays and check again at confirmation. The first and last few characters are not enough. Confirm the network too. If you cannot inspect the whole destination before approving, stop.

These checks protect against poisoned history and look-alike destinations, but not a fraudulent source you mistakenly trusted. An incorrectly saved or outdated entry repeats the error. Setup takes a few minutes; checking each payment costs attention, not money.

(2) **Bookmark a verified site, not a search result** — use the project's canonical repository and established maintainer channels to cross-check the official domain. A similarly named fork is not proof. Inspect the actual hostname: a familiar name buried inside a longer domain does not make it official. Then save the bookmark. Return through that bookmark, including when looking for support. Skip sponsored results and links in unsolicited messages.

A verified bookmark protects against search-ad clones and phishing links, but not a compromised official site. Saving a bookmark from a clone preserves the mistake. HTTPS is not proof of project ownership. Initial verification takes minutes; bookmarks are free.

(3) **Refuse the recovery sales pitch** — close unsolicited recovery conversations. Open verified support through your bookmark instead of using the sender's link or phone number. Never give an agent a mnemonic, private key or key file, or submit any of them to a recovery website. Do not install remote-control software at an agent's request. Do not pay to "validate" a wallet, or sign messages or transactions sent by a stranger promising recovery.

Refusing the pitch protects against a supposed rescue becoming another loss; it does not protect against earlier losses. Contacting support cannot, by itself, reverse a confirmed transfer. Keep transaction hashes for reporting through verified channels, but keep secrets out of reports. Fees, testimonials and polished branding establish no authority. Rejecting the offer costs nothing; paying does not guarantee recovery.

(4) **Review simulation before signing, where available** — where your wallet offers free transaction simulation, enable it or run it before signing. A static recipient-and-fee summary is not necessarily a simulation. Use the wallet's own route, not a "checker" linked by a stranger. Check the network, destination, predicted asset movements and any approval's spender and allowance. Stop if anything differs from your intention or remains unexplained. For unfamiliar actions, treat an unavailable or empty preview as a reason to pause, not sign blind.

Simulation protects against unexpected transfers or permissions that it exposes. It does not protect against every malicious signature, future use of an approval, or changes after the simulated state. Coverage depends on the wallet and simulation provider. A "successful" result means the simulated execution completed, not that the recipient is genuine. Disconnecting a site does not cancel existing approvals.

An off-chain simulation uses no network gas. Broadcasting the real transaction can still incur network fees. Some providers charge for extras — use included free checks.

**Free versus paid:** for routine payments, choose these habits before buying a security subscription. A paid product cannot decide whom you meant to pay. Paid phishing alerts or broader simulation may help with frequent, complex signing, but check their documented coverage. Pay only for an identifiable extra capability you need. These tools add warnings, not permission to skip address and source checks. A recovery service's price is not evidence that it can recover anything.

**Free-security checklist:**

- Copy the address from a verified original source or checked address-book entry, never from transaction history.
- Check the full destination and network after pasting and again at confirmation.
- Open the site through a verified bookmark, not an advert.
- Review available simulation.
- Accept no unexplained transfers, approvals or signature requests.
- Give no secrets, payments or remote access to an unsolicited recovery helper.
## 16. Free audit tools, before release + free-security checklist for Bawa

Public source can be inspected; that does not mean it has been audited. An audit has a scope and date, and mistakes can survive it. Install pinned scanners from verified releases; check available checksums or provenance; document exact runtimes, commit lockfiles and pin rule revisions. In CI, fetch full Git history and refs, then run these checks on pull requests and release commits without signing or deployment secrets. Require tests and dependency review too. Block findings and tool errors; exceptions need a reason, owner and expiry. Keep these gates even when paying for an audit.

**Secret scanning:** run `gitleaks git --redact --log-opts="--all" .`, then `gitleaks dir --redact .`; Gitleaks flags recognised credential patterns in history and working files, including files later deleted; it can miss mnemonics, xpubs and custom key formats; it cannot undo exposure; extend default detectors in `.gitleaks.toml`, testing with published non-live fixtures in a throwaway branch; restrict access to reports. The CLI has no licence fee; full-history scans cost runner time and triage. Choose free for repository gates; paid coverage can help with organisation-wide integrations and staffed response.

**Package-manager dependency audits:** for npm, run `npm ci --ignore-scripts` then `npm audit --audit-level=low`; use your manager's native equivalent elsewhere; review required build scripts before permitting them in a separate build/test job; audit matches versions to published advisories; it cannot rule out unknown flaws or malicious releases, nor establish exploitability; registry failure is not a clean result; update deliberately, commit the new lockfile and rerun tests rather than forcing upgrades blindly. The command has no licence fee, but needs network access and maintenance; registry requests can disclose dependency metadata. Choose free for advisory checks; paid services can help prioritisation and continuous monitoring.

**Pattern scanners with free rules:** commit reviewed, freely licensed rules under `.semgrep/`; run `semgrep scan --config .semgrep/ --error --strict .` with Semgrep Community Edition; covered patterns can flag unsafe evaluation or weak randomness, not prove derivation, transaction intent or cryptographic correctness; check supported languages, skipped files and broad suppressions; test coverage with published fixtures. There is no licence fee, but rule upkeep and false positives cost time. Choose free for a supported stack you can maintain. For wallet-specific logic, commission specialist review rather than expecting another scanner to certify it.

**Free-security checklist for Bawa** (needs no subscription, but paper, secure storage and an offline device may cost money; if you lack trustworthy spare hardware, consider a reputable hardware signer).

- **Generate offline** (use a verified build from the canonical repository on a clean dedicated device; disable networking and radios, then generate using the wallet's secure randomness; keep it offline; isolation limits remote theft, not malicious software or physical access; encryption does not protect secrets while decrypted in memory).
- **Separate watching from signing** (keep spending secrets off the tracker; import only public descriptors or account addresses; keep exports private, never in example files; label networks explicitly; verify receive addresses and each transaction's network, destination, amount, fees and contract actions on the trusted signer — an online tracker can lie).
- **Make 2–3 separated backups** (keep legible offline seed copies in access-controlled places with independent fire, flood and theft risks; check them periodically; each copy adds a theft target; back up required passphrases separately; keep cosigner secrets apart; do not treat photos, cloud notes or password managers as safe seed storage).
- **Practise recovery before funding** (restore a backup on a clean offline signer using only recorded instructions; compare receiving and change addresses, where applicable, for every intended account/network; confirm signing with an offline, non-spending test where supported; a "restored" screen is insufficient; keep any device that handled the seed offline afterwards).
- **Back up descriptors or policy** (export public receive/change descriptors with checksums, fingerprints, paths and multisig threshold/key ordering, or the supported policy equivalent; record chain IDs, script types and recovery roles as applicable; protect this privacy-sensitive metadata; it does not replace signing keys).
- **Audit approvals** (on every used chain, inspect token allowances, NFT operators and delegated permissions using explorers linked from official chain documentation; verify spenders and revoke unnecessary access; reviewing is free; revocation may require gas; disconnecting a site does not revoke permissions; on-chain checks miss unused signed permits).
- **Prepare for compromise** (if signing secrets may have leaked, stop using that wallet; generate an independent seed on a clean signer and migrate assets and signing roles across affected networks; revocation cannot repair key theft; sweeper bots may steal gas top-ups — use documented incident-support routes; revoke exposed service credentials too).
## 17. Paid security: qualified custody

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED**

Use section 17 as the single costs reference for the whole Bawa professional guide set.

Bawa is a wallet reference project, not a custodian. Bawa holds no users' keys. Make any custody agreement with an external provider, not Bawa. Treat all providers named here as examples, not Bawa recommendations.

### Confirm what “qualified” means

"Qualified" usually covers institutions such as banks, trust companies and registered broker-dealers that undergo examination by state or federal regulators (US). Some registered funds, ETF issuers and fiduciaries may have a legal obligation to appoint a qualified custodian. Have legal advisers confirm the arrangement rather than relying on the label: applicable rules, assets and the contracting entity all matter.

Examples include Anchorage Digital Bank (OCC national trust bank charter, January 2021), and the BitGo and Coinbase Custody state-chartered trust custody businesses (also described as qualified custodians). These are examples, not recommendations. Check the precise legal entity and its regulatory permissions before signing; a familiar group name is not enough.

### What it protects against

A well-run custody service can reduce dependence on a single device, a household backup or one employee's knowledge. Look for protected signing systems, separate approvers, restricted withdrawal destinations and tested recovery procedures: these can help prevent lost keys and unauthorised transfers.

Investigate those features rather than treating them as guarantees attached to qualified status. Ask what an independent audit actually covered and which controls apply to your account.

In a conventional custody arrangement, the provider operates the signing system. You retain contractual rights and give instructions, but you cannot necessarily move assets without its cooperation. Distinguish this from non-custody, where you retain the key authority needed to transact.

### What remains your risk

Custody does not make the asset itself safer. Price falls, token-issuer problems, blockchain faults and smart-contract failures remain possible; a transfer to the wrong destination may still be irreversible.

Plan for custody-specific failure modes:

- **Compromised access/approvals:** a stolen operator account, colluding approvers or an incorrectly configured policy can produce a withdrawal that appears authorised.
- **Loss of availability:** maintenance, staff-access problems, withdrawal queues, compliance reviews and legal orders can delay or prevent transfers.
- **Provider compromise:** signing infrastructure and staff can still be attacked. Professional operation reduces some risks; it does not remove them.
- **Financial failure:** the provider may become insolvent or enter a lengthy resolution process. Regulation does not guarantee immediate return of assets.

This is counterparty risk: your ability to recover or move assets depends partly on another organisation remaining solvent, capable and willing to honour its obligations. Review whether holdings are legally separated from the provider's own property, whether they may be lent or pledged, and what happens if the business fails.

### Who it suits

Qualified custody is most relevant to funds, fiduciaries and businesses with regulatory, audit or governance requirements. If you manage a treasury, weigh the value of continuity when staff leave and a formal separation between requesting and approving payments.

If you are an individual with substantial holdings, you may prefer outsourced key recovery. Check eligibility thresholds and administrative overhead: these can make institutional custody unsuitable for an ordinary personal wallet.

Do not assume a retail exchange account is the same service, even where the same corporate group offers qualified custody.

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

Use this section as the single costs reference for the whole guide set. Treat any providers named as examples, NOT Bawa recommendations.

Bawa is a wallet reference project, not a custodian. Bawa holds no users' keys. Any custody agreement is with an external provider, not Bawa.

### Figures

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

| Item | Dated position |
|---|---|
| Institutional fees | Institutional fees are normally negotiated per client, commonly as an annual percentage of assets under custody. |
| Asset-entry thresholds | No verified generic entry threshold is published. Check each provider's own eligibility and minimum-balance terms; do not rely on a third-party-reported range. |
| Headline insurance programme totals | BitGo Bank & Trust says it maintains up to US$250 million in digital asset insurance for specified losses involving assets for which it holds all keys, subject to policy terms and exclusions (checked 8 November 2026, UTC). See [BitGo](https://www.bitgo.com/) for its primary insurance disclosure. Headline programme cover is shared across customers and is not guaranteed cover for each account; check the policy wording for the insured entity, covered events, exclusions and deductibles. |

Obtain a written quote showing the annual rate, any minimum charge and possible onboarding, transaction, network and exit charges. Ask how asset values are measured for billing. Do not infer an annual bill from the entry threshold.

Check the insurance terms as well as the headline total:

- Limits are usually shared across clients; other claims may reduce the available cover.
- Cover commonly concerns specified cold-storage theft, external compromise and employee dishonesty.
- Market losses and protocol failures are generally outside that cover.
- Check exclusions, deductibles, the insured legal entity and who receives a payout: each matters.

Crypto holdings in these arrangements are generally outside FDIC and SIPC protection. Any protection available for eligible fiat balances is separate and depends on how that cash is held.

### Onboarding and exit

Keep the initial process deliberate:

1. **Check the service and contract.** Confirm the contracting entity, supported assets and networks, reporting, liability terms, asset treatment and withdrawal rights.
2. **Complete identity checks securely.** Expect identity, beneficial-ownership, authorised-signatory and source-of-funds checks.
3. **Set operating controls.** Set up strong authentication, separate approval roles, permitted destinations and a recovery process for lost operator access.
4. **Test before the main transfer.** Agree a small deposit and withdrawal test. An ordinary deposit should move assets to a confirmed address, not require handing over your existing Bawa recovery words.

Plan departure before funding. Check notice periods, withdrawal limits, approval delays, termination charges and how statements can be exported. Make sure every asset can leave on a network supported by your intended destination.

Exit will normally mean an on-chain transfer to a fresh self-custody wallet or another custodian, not receiving the provider's private keys. Test that route while the service is operating normally. Once assets sit at provider-controlled addresses, an old Bawa backup cannot bypass the provider's withdrawal process.

### Keep recovery material private

Using a custodian does not make Bawa recovery work less sensitive. Keep seed words, private signing keys and their extended forms out of public commits, issues, screenshots and support logs. Apply the same rule to keys used to decrypt recovery data, `.env` files used in production, wallet-backup artefacts and account/service credentials.

Use placeholders in examples and redact diagnostic material. Send vulnerability reports to the repository maintainers through a private reporting route (OPEN ITEM — no route is documented; see §7). Keep exploit-enabling details out of public issues.

**Shift in signing control (not a safety ranking):** self-custody — holder controls signing; into collaborative custody — holder and provider share signing authority; into qualified custody — provider controls signing; holder requests transfers.
## 18. Paid security: HSM-based signing

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

An HSM can make signing keys harder to steal; it cannot make a compromised application trustworthy or turn a mistaken payment into a safe one. Bawa is reference software, not a custody service; the project does not take possession of users' keys. Treat HSM signing as one possible security architecture to assess, not as assurance that a deployment is ready to hold production funds.

### Keep the offline/watch-only boundary

Bawa's trusted, offline side creates the mnemonic, seed, private material and account-level public roots. The online RPC and indexer receive only the public information needed to watch accounts. Treat that online environment as something an attacker might inspect, collect logs from, repeatedly restart or take over. It must not receive seed material, whether or not an HSM is involved.

The generator sends the mnemonic and data-encryption key to its controlling terminal rather than ordinary subprocess stdout/stderr. This reduces incidental logging; it does not defeat a hostile OS or terminal, a debugger, crash dumps, swap or memory snapshots. JavaScript and WebAssembly cannot promise that every secret copy has been securely erased. Encrypting saved material also leaves plaintext exposed while a mnemonic is created or recovered.

Importing an existing key into an HSM does not undo those earlier exposures.

### Understand what the hardware buys

A hardware security module is a tamper-resistant device that can create, retain and use cryptographic keys within its own protected boundary. With non-exportable signing keys, the application receives signatures rather than readable key material. Any supported backup or migration mechanism should preserve that protection through encrypted, access-controlled handling.

This reduces opportunities to extract keys from application memory, server disks or stolen equipment. It protects key storage and cryptographic operations inside the device — it is not a claim of invulnerability.

FIPS 140-3 Level 3 is a commonly requested validation level. Check the exact module, firmware and operating configuration covered by a validation. A validated component does not certify the complete wallet, approval service or custody arrangement.

### Keep the limits in view

- **A malicious request can still get signed.** Compromised software may submit a validly formed transaction that benefits an attacker.
- **The device cannot infer the holder's intended recipient.** Check the destination, network, asset, amount and fees independently before approval.
- **Wallet functions remain elsewhere.** Account tracking, HD derivation, transaction construction, policy enforcement and broadcasting still need software and operational controls.
- **Hardware-backed does not necessarily mean offline.** An HSM can be network-connected; cold storage is a separate operating choice.

### Establish who controls the signer

Distinguish these two control models:

- **Full HSM custody:** a provider operates the key infrastructure and releases transactions under its custody agreement. You depend on its authorisation, recovery and withdrawal processes. Holding an account with that provider is not the same as directly controlling a wallet key.
- **Self-custody with HSM signing:** the holder retains control of key material, signing authority and recovery, while an HSM performs the cryptographic work. The device may be owned outright or hosted. Check who can change policy, recover backups, cause a signature or block access — the product label alone does not settle custody.

Anchorage describes its custody service as combining HSMs, biometric checks and multi-person approval, with keys retained in hardware. Its Porto offering is described as institutional self-custody, with clients retaining their own key material. Treat these as different control models, not interchangeable names for the same service.

Coinbase Custody-style offerings are described around HSM-backed cold storage, geographically separated vaults, biometric controls and recurring SOC 1 and SOC 2 audits. Require advertised controls to be substantiated for the particular service and contract. Audit reports have a defined scope and are not a promise that every withdrawal will be safe or available.

Treat the named providers as examples, not Bawa recommendations. Bawa endorses neither provider, and naming them does not imply Bawa compatibility.

### Decide whether the overhead fits

This usually fits a business treasury or institutional operator with several accountable staff, audit requirements and a recovery budget. For most individuals, the fees and administration are difficult to justify.

You can still choose institutional custody as an individual, but recognise that doing so accepts a custodian as a counterparty rather than merely purchasing stronger hardware.

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

This section is part of THE SINGLE COSTS REFERENCE for the whole guide set. Providers named are examples, NOT Bawa recommendations.

### Setup and onboarding, in outline

1. **Choose the control model first** — establish the custody relationship, jurisdiction, identity and company checks, withdrawal timetable and recovery terms. Verify support for the required chains, signing algorithms, HD derivation and account-public-root output. Do not assume an HSM service plugs directly into Bawa.

2. **Hold a documented key ceremony** — a witnessed process for establishing the signer: checking equipment and firmware, assigning responsibilities, creating keys inside hardware where supported, recording public identifiers, setting up protected backups. Rehearse recovery. If keys are imported, account for their exposure before import.

3. **Set the quorum** — define the minimum number of independent people who must approve a payment. Separate transaction requests from approval, and establish distinct rules for policy changes and recovery. Check where those rules are enforced and whether administrators can bypass them. An approval quorum does not necessarily mean on-chain multisignature or cryptographically divided keys.

4. **Test the whole route** — use an isolated signing-request interface without giving the watch-only runtime secrets. Test independent transaction verification, available allow-lists and spending limits, small-value transfers, unavailable approvers and recovery. Avoid an emergency shortcut that lets one support action remove the quorum.

### Figures

No vendor publishes these figures as a tariff: institutional custody onboarding, annual custody service minimum, asset-based custody fee and dedicated enterprise network HSM appliance costs are quoted per client. Obtain written quotations from the custody provider or HSM manufacturer for each item; no public price was found for them at this check, and no 30 October 2026 date is carried forward as a check date for them.

These bands are not market limits. Ask whether an annual minimum offsets asset-based charges or is additional. Redundant equipment, hosted HSM rental, backups, integration, support, staff, external review, withdrawal charges and network fees may be separate.

Recheck every price before committing, including taxes, minimum balances and exit fees; do not use these dated allowances as an offer from any provider.

### Custody exposure

Full custody adds exposure to provider compromise, withdrawal freezes, insolvency and legal restrictions. Review asset ownership, segregation, insurance exclusions and the treatment of assets if the provider fails. Self-custody avoids handing that same role to a custodian, but hosted infrastructure, firmware suppliers and recovery services can still become dependencies.

### Failure modes

- **A quorum member is lost or unavailable.** If the remaining members can still satisfy the policy, replace the missing member through the approved administration process; otherwise, use the pre-agreed recovery procedure. Without a viable recovery route, signing may remain blocked. Disabling approvals is not a sound recovery plan.

- **Vendor firmware is faulty or vulnerable.** Signing may stop, or confidence in key isolation may be lost. Have staged update procedures, tested compatible recovery capacity and a supported remediation route. Pause signing when integrity is uncertain rather than exporting plaintext keys into an application as a workaround.

- **A request is approved by mistake.** Enough people can approve the wrong destination, and the HSM can correctly sign it. Independent checks and limits reduce this risk; they do not remove it. Once a transaction has been broadcast and settled, the device provides no reversal mechanism.

### Agree the exit before depositing funds

Get withdrawal conditions, fees, timescales and data-export arrangements in writing. Do not assume a non-exportable key can become a mnemonic, or that an encrypted HSM backup will work with another vendor.

Plan to **RE-KEY** when leaving:

1. Establish fresh keys under the new security boundary.
2. Verify the receiving addresses independently and transfer balances while the old provider and quorum are still available.
3. Update deposit addresses and watch-only public roots, retain transaction and approval records, then revoke obsolete service access.

Supported wrapped-key migration may be useful, but reusing a key can preserve dependence on anyone holding an old recovery copy. Fresh keys and an on-chain transfer provide a clearer separation.

### Required security review and signing flow

An external security review of the complete design is required before treating a Bawa-based deployment as production custody infrastructure; buying certified hardware does not replace that review.

Flow: signing request, into quorum approval, into HSM signature, into broadcast.
## 19. Paid security: institutional MPC platforms

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

Providers named are examples, NOT Bawa recommendations. Bawa provides no custody service and keeps none of your keys.

Institutional MPC platforms suit teams that need shared control over funds, approval records and spending rules; they can make sense for business treasuries, funds and exchanges; for an individual, the expense and operational work are often difficult to justify against a well-managed hardware wallet and tested backups.

**What MPC buys:** multi-party computation lets several participants produce a signature using separate secret shares; a threshold determines how many must cooperate (a two-of-three arrangement, for example, requires two participants); during routine signing, the complete private key is not reconstructed on a device or server; the resulting signature looks like a conventional single-key signature to the blockchain; there is no on-chain multisig structure to identify, and MPC itself adds no multisig fee overhead; network fees and platform charges still apply. Typical path: signing request, policy check, joint threshold signature, broadcast.

The main benefit is resistance to a single compromised device or dishonest operator — PROVIDED they cannot obtain enough shares to sign; separate shares offer little independence if one administrator, cloud account or recovery credential controls them all. Policy checks are another layer, not part of the blockchain's rules; they can restrict destinations and amounts or require additional approvals; they cannot make an approved malicious transfer safe.

**What it does not solve:** enough share holders colluding or being compromised; approvers accepting a fraudulent payment or harmful contract interaction; an administrator weakening policies or replacing participants; defective signing software, poor randomness during share creation, or a compromised update; lost shares, unreadable backups or unavailable recovery participants; smart-contract faults, chain failures or provider outages.

The share-generation ceremony and recovery process deserve as much scrutiny as everyday signing; some recovery designs rebuild a complete private key — that creates a single-key exposure which the normal MPC workflow avoids.

**Platforms, custody and actual control:** Fireblocks advertises MPC signing alongside approval workflows, spending controls, approved-destination lists and transaction simulation — check which controls are available and enforced for your chosen networks and contract. Fireblocks is principally an infrastructure offering; buying that infrastructure does not, by itself, mean appointing a qualified custodian; regulated custody may be supplied through a related entity or an integrated provider — establish exactly which legal entity is responsible.

Copper markets MPC custody together with off-exchange settlement; keeping trading collateral away from an exchange may reduce one exposure, but it introduces dependence on the custody and settlement arrangements; it does not eliminate counterparty risk.

For any platform, obtain a written share-and-control map: who holds each share, including backups and subcontractor-held shares? How many usable shares are required, and who can restore or replace them? Can the provider reach that threshold without your participation? Can you reach it without the provider's servers, login system or support team?

If the provider controls a signing quorum, it can authorise movement without your shares; if it controls less than a quorum, it may still be essential to availability; neither "MPC" nor "non-custodial" proves an independent exit. Legal custody is separate: check asset ownership, segregation, withdrawal restrictions and your insolvency rights.

This section is part of **THE SINGLE COSTS REFERENCE** for the whole guide set. Treat named providers as examples, **NOT Bawa recommendations**. Bawa provides no custody service and keeps none of your keys.

### Setup and onboarding

Expect business identity checks, contractual due diligence and a technical review before funding. In outline:

1. Confirm supported networks, assets, signing operations and any required HD derivation behaviour.
2. Agree the share layout, independent administrative roles and recovery responsibilities.
3. Complete share generation on approved devices and arrange protected, separately controlled backups.
4. Configure payment policies and test both permitted and rejected requests.
5. Exercise recovery with a small balance before increasing exposure.

A platform's share backup is not necessarily a BIP-39 mnemonic or something Bawa can import — establish compatibility rather than assuming that all wallet backups are interchangeable.

### Figures

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

These are not current quotations; recheck every price and term before purchasing.

| Example provider | Indicative figures | Scope and limits |
|---|---|---|
| Fireblocks | Fireblocks lists Essentials at US$999 per month for up to six months. Custom pricing for Pro, Enterprise or Enterprise+ plans starts at US$36,000 per year (checked 8 November 2026, UTC). See [Fireblocks pricing](https://www.fireblocks.com/pricing). | The Essentials offer lasts no more than six months, not an indefinite running cost; custom pricing is expressed annually — do not assume monthly cancellation. |
| Fireblocks | Tokenisation add-on: "From 3-30bps on AUC" (0.03–0.30% of assets under custody). | A product-specific listing for the tokenisation add-on, not a universal Fireblocks fee; establish the billing period, valuation basis and whether it is additional to the subscription. |

Ask which onboarding, support, recovery, extra-user and exit charges are included; network fees remain separate unless the contract explicitly covers them.

### Counterparty failure and a provable exit

A provider can fail financially, suspend an account or lose a critical service without anyone stealing a share. Insurance is not a substitute for recovery — verify the insured entity, covered events, exclusions, deductibles and whether a limit is shared across customers; a headline amount does not establish cover for your balance.

Before committing substantial funds, require an exit plan that works under an abrupt shutdown:

- **Have the recovery materials already:** necessary shares or independent recovery participants, decryption access, software, documentation, licences. A promise to supply them after a shutdown is weak protection.
- **Test without the provider:** use a small test balance and a documented fallback. Produce a valid transaction while the provider's signing and authentication services are unavailable; broadcast through independent chain access; record the result without recording secrets.
- **Know the migration route:** does supported export preserve existing addresses, or must funds move to a fresh wallet? Check every relevant asset and network, including gas requirements and restrictions on staked or contract-controlled positions.
- **Repeat the drill after material changes:** share replacement, software upgrades, staff departures can invalidate an earlier test.

Do not count "we have backup files" as proof that you can still sign; without a demonstrated independent quorum and usable recovery tooling, a shutdown may leave you dependent on a recovery agent, an insolvency process — or unable to spend at all.
### Multisig-as-a-service

You pay a provider to run signing infrastructure, approval checks and support; this can remove a single point of failure — or move it into someone else's organisation.

An M-of-N multisig wallet needs signatures from at least M of its N independent keys: a signing quorum. The chain's script or account logic checks that rule. Each signer holds its own complete private key, unlike an MPC participant's share. The multisig rule is visible on chain, sometimes only when funds are spent; supported chains and transaction costs differ.

```text
on-chain multisig [separate complete private keys]
  → [M individual signatures]
  → [chain enforces M-of-N; policy visible]

MPC [key shares across participants]
  → [threshold policy enforced off chain]
  → [one ordinary signature on chain]
```

### Check the protection and its limits

With a threshold above one and genuinely separate signers, one stolen key, compromised device or dishonest employee cannot spend alone. Losing a key need not strand funds if enough other keys remain. Provider checks may offer another chance to catch a bad payment.

A valid quorum can still authorise theft, a mistaken address or a harmful contract interaction. Multisig does not fix chain bugs or investment losses. Different HD paths under one seed are not independent protection — whoever steals that seed can derive all those keys.

If you are an individual, check that your holdings and threat model justify the fees and recovery work. Self-managed multisig avoids the service dependency but leaves that work with you. If you run a business, you may value separated staff roles, spending limits and audit records. Either way, do not assume "managed" means maintenance-free.

### Establish custody: count the keys

- **Non-custodial 2-of-3:** you control one working key and a separate offline recovery key; the provider controls one key. It cannot spend alone; your two keys can spend without it.
- **Custodial 2-of-3:** the provider controls two keys and you control one. It can spend without you; you cannot spend without it.

Do not infer this allocation from a product name. Check affiliates, subcontractors and retained backup copies too. Other arrangements can leave a provider unable to spend alone but essential to every usable quorum — it cannot take funds unilaterally, yet it can block access.

Two employee approvals in a portal do not necessarily represent two independently controlled signing keys.

### Check onboarding and the counterparty

Before funding:

- Confirm the exact chain, asset, threshold and key holders.
- Expect identity checks and, where required, business and authorised-signatory checks.
- Agree signing delays, transaction limits, recovery responsibilities and exit terms.
- Generate user-controlled keys independently, keep recovery secrets offline and out of this repository, and start with a small test balance.

Have each signer verify the payment independently rather than merely approve a notification.

Provider outages, compliance freezes, insolvency and changed terms can interrupt service. With custody, contractual withdrawal rights are not equivalent to possessing a signing quorum.

### Check the figures for the particular service

**BitGo is a commercial example, not a Bawa recommendation.** It markets multisig and MPC wallets, qualified-custody services, and products for settlement and staking. Check the agreement for the particular service — these are not interchangeable arrangements.

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED**

| Item | Indicative figure and checks |
|---|---|
| BitGo custody pricing | BitGo currently offers qualified custody with no custody fees to eligible individual investors. No published institutional annual custody rate was verified at this check (checked 8 November 2026, UTC). Recheck prices and minimums before committing; ask whether the quotation includes subscriptions, setup, recovery and exit charges, and allow separately for chain fees. |
| BitGo insurance headline | BitGo Bank & Trust says it maintains up to US$250 million in digital asset insurance for specified losses involving assets for which it holds all keys, subject to policy terms and exclusions (checked 8 November 2026, UTC). Check who is insured, which losses qualify, exclusions and whether limits are shared. |

### Make the exit real

Retain the wallet descriptor or equivalent configuration, including the threshold, all co-signers' public keys or extended public keys, derivation paths, script or account settings, and network. Protect this metadata: it can reveal addresses and balances. It does not replace secret-key backups.

For a provider-independent arrangement, rehearse recovery before depositing substantial funds: using independent tooling and your own quorum, restore access and broadcast a small spend without the provider's interface, API or signature. Seeing a balance or exporting a file is not proof that you can sign; repeat the check after signer changes.

If the provider shuts down, an independent quorum can move funds to a replacement wallet or authorise a supported policy change. Budget for the relevant network fees. If you use a custodial service, test withdrawals while the service is operating — without an independent quorum, shutdown may leave funds inaccessible or tied up in insolvency proceedings.

Watch for lost recovery keys, stale configurations, incompatible recovery software, shared cloud backups and departing staff. A recovery promise is not a substitute for a rehearsal.
## 20. Paid security: consumer multisig with inheritance

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

Household holdings and inheritance planning sit beyond Bawa's own scope: Bawa covers generation, derivation, comparison and recovery for a reference wallet; it does not provide inheritance, estate administration or managed multisig services. This section describes paid options and the questions to ask before buying them; the named providers are examples, not Bawa recommendations.

### Why consider them

- With a single-signature wallet, one lost or stolen seed can cost the funds or lock them away permanently.
- A managed 2-of-3 arrangement lets you retain signing ability if one key is lost while still making a single stolen key insufficient on its own.
- Inheritance features address a different risk from everyday theft — what happens if the holder dies, loses capacity or becomes unreachable.
- A trusted family member or adviser should be able to recover funds, not merely learn that a wallet existed.

### Casa-style service

A typical arrangement uses a 2-of-3 multisig wallet plus a separate inheritance key held by a designated recipient. In normal use, you hold two keys — for example, a mobile key and a hardware key — and the provider holds one. The recipient's key remains inactive during your lifetime.

A service may describe its arrangement as "self-custody". Check what the service can and cannot do for you: if you control a working quorum independently, you retain spending ability; if the provider holds a necessary key or controls the software workflow, your independence is limited.

Providers also offer account monitoring, inheritance handling and succession planning, including an inheritance check that confirms the recipient can still access their key. Casa markets its service for families and businesses seeking security and inheritance, with support for Bitcoin and Ethereum, including selected ERC-20 tokens. Check the supported assets for your own holdings.

Use these figures from the [Casa vault FAQ](https://casa.io/pricing), re-checked live on **8 November 2026 (UTC)**:

| Casa plan | Annual price |
|---|---:|
| Standard 3-key vault, 2-of-3 | $250 per year |
| Premium 5-key vault, 3-of-5 | $2,100 per year |
| Private Client 6-key vault | $7,500 per year |
| Business plans | $2,750 per year |

These are entry bands only. Ask what features, limits and support are included at each level and whether additional keys, users or assisted recovery cost extra.

#### Inheritance

A nominated recipient can request access once the holder has died, usually through a supported procedure, not simply by possessing a key. At that point, the inactive recipient key becomes usable.

The process may include a six-month inactivity check, a waiting period and confirmation that the holder is actually deceased. The recipient is expected to have enough identity and location information to be reachable.

A recipient who has lost their key or cannot be found is a recognised failure mode. Test the handover while the holder is alive — use a small balance on a separate wallet to rehearse the full route.

### Unchained-style service

A typical arrangement uses a 2-of-3 multisig vault with optional inheritance. You control two keys and the provider holds one, and the provider can help arrange signing when a key is unavailable. The provider's key is intended to be inaccessible to staff alone. Inheritance may be offered as a paid extension.

Use these figures from [Unchained pricing](https://unchained.com/pricing), re-checked live on **8 November 2026 (UTC)**:

| Service | Cost |
|---|---:|
| Personal Vaults | US$250 per vault per year |
| Inheritance Boot Camp | US$4,000 per client, renewing at US$4,500 a year |
| Signature | US$6,000 for the first year, renewing at US$4,500 a year |

Pricing and availability are US-focused: check whether the service supports your residence, local regulations and time zones before relying on it.

### Assisted multisig with inheritance

In this arrangement, a named provider operates a signing service, helps set up a multisig wallet, offers supported hardware options and manages an inheritance process. It may include an inheritance key or a time-locked mechanism, with defined steps for the successor.

No generic assisted-multisig band is published. For named plans, see [Casa pricing](https://casa.io/pricing) (Standard $250/yr, Premium $2,100/yr, Private Client $7,500/yr, Business $2,750/yr) and [Unchained pricing](https://unchained.com/pricing) (Signature $6,000 for the first year, renewing at $4,500 a year; Inheritance Boot Camp $4,000 per client, renewing at $4,500 a year), all checked 8 November 2026 (UTC). Confirm inheritance inclusion per plan and distinguish first-year charges from renewals.

Higher-touch packages may include trustee arrangements and estate-planning support.

Before choosing, work out which questions you need answered in writing:

- Who holds each key, and where?
- Who can sign?
- How does the recipient activate their key?
- What happens if the provider ceases trading?
- What happens if the recipient loses their key?

### Estate wrappers

A legal estate wrapper uses a trust, company or will structure to hold or direct wallet assets. It may use one or more of a letter of instruction, a will, a trust deed or a company record, and typically involves a named trustee, executor or attorney.

No generic estate-wrapper figures are published. Obtain jurisdiction-specific written quotations before budgeting, covering: legal setup; recurring support; trustee or company administration; and asset-based charges. Confirm the jurisdiction, the scope of each charge, and whether government filing fees, legal advice for specific jurisdictions, or dispute-resolution costs are included.

Asset-based charges are quoted individually and subject to negotiation. These bands do not include government filing fees, legal advice for specific jurisdictions, or the cost of resolving disputes.

### Before you sign

- Count independent signing keys, not seed copies — a single seed used to derive several keys does not give the same protection as independent seeds.
- Check the service's signing threshold, recovery process and fees.
- Test a withdrawal to a fresh wallet before moving substantial funds.
- Make sure the designated recipient can reach their key.
- Test the inheritance handover while the holder is alive.
- Write down what happens if the provider ceases trading.
- Remember that paying for a service does not remove the risk of seed compromise — the remedy remains the same: a new wallet, move everything, retire the old wallet.
### The seven private test questions

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

Providers named are examples, NOT Bawa recommendations.

Before you buy or trust a paid service, answer these seven questions privately — do not post the answers in a public issue, forum or support thread. Each question is a test of the service; a service that cannot answer it in writing is not ready for your funds.

1. Who holds each key, and can you prove it? List every signing key, its holder, its storage location and its backup. A service that cannot name the holders and locations of all keys in the quorum has not given you enough to verify.

2. Can you spend without the provider? Using only your own keys and independent tooling, restore access and broadcast a small spend without the provider's interface, API or signature. Seeing a balance or exporting a file is not proof that you can sign. Repeat the check after any signer change.

3. Can the recipient actually recover the funds? Rehearse the inheritance route with a small balance on a separate wallet while the holder is alive: the recipient must be able to reach their key, complete the provider's procedure, and move funds to a fresh wallet. A recipient who has lost their key or cannot be found is a recognised failure mode.

4. What happens if the provider ceases trading? Get the exit terms in writing: notice periods, withdrawal limits, approval delays, termination charges, data export. Know whether funds must move on-chain to a fresh wallet, and test that route while the service is operating normally.

5. What does the insurance actually cover? Check the insured entity, covered events, exclusions, deductibles and whether a limit is shared across customers. A headline amount does not establish cover for your balance. Market losses and protocol failures are generally outside that cover.

6. What are the total costs, including exit? Get a written quote showing the annual rate, any minimum charge, onboarding, transaction, network and exit charges. Ask how asset values are measured for billing. Do not infer an annual bill from an entry threshold.

7. What happens if your seed is compromised? Paying for a service does not remove the risk of seed compromise. The remedy remains the same: a new wallet, move everything, retire the old wallet. If the service cannot explain how that remedy works under its arrangement, do not fund it.

Seed-free letter of instruction: keep the letter of instruction separate from the will — the will is a public document in many jurisdictions once probate begins, and it must never contain seed words, private keys, vault unlock passphrases or data keys. The letter should name the wallet, the location of the recovery material, the person who can use it, and the steps to reach the funds, without recording the secrets themselves.
## 21. Paid security: insurance-backed custody

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

Providers named are examples, NOT Bawa recommendations.

Insurance does not make a wallet safe; it may pay for some losses after the fact, under defined terms. Read the policy before funding, not after a loss. Bawa is a wallet reference project; it holds no users' keys and sells no insurance.

What insurance can cover: crime and specie cover (theft of physical assets, including precious metals and, in some policies, digital assets held in specified custody); a policy may cover losses from external compromise of a specified cold-storage system, employee dishonesty, and physical theft during transit or storage. Coincover-style offerings are described as protecting against specified theft and loss events for wallets and exchanges, with recovery services attached — check the policy wording for the particular product, not the marketing summary.

What it does not cover: market losses; protocol failures and smart-contract faults; losses from your own mistake (wrong address, approved malicious transaction, lost seed with no recovery route); losses outside the insured entity, insured location or insured system; losses above the policy limit; losses after the policy has lapsed. A headline amount does not establish cover for your balance: limits are usually shared across clients; other claims may reduce the available cover; exclusions, deductibles, the insured legal entity and who receives a payout matter.

Covered-or-not table (illustrative — check the actual policy wording):

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

| Event | Typically covered? | Check |
|---|---|---|
| Theft of cold-storage keys by an external attacker | Possibly, if the policy names that event and system | Insured entity, system, limit, deductible |
| Employee dishonesty | Possibly, under a crime policy | Who counts as an employee; sub-limits |
| Physical theft in transit or storage | Possibly, under specie cover | Transit routes, storage locations, limits |
| Market price fall | No | — |
| Smart-contract or protocol failure | Generally no | Some policies offer separate cover — check |
| Wrong address or approved malicious transaction | No | — |
| Lost seed with no recovery route | No | — |
| Loss above the policy limit | No, beyond the limit | Shared limits across clients |

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

No published custody-insurance or protected-wallet price was verified at this check. Coincover publishes no prices — B2B only, "get in touch" — so obtain pricing and the applicable protection/insurance terms in writing via [Coincover](https://www.coincover.com/) for the specific assets, systems and limits. These are budgeting ranges, not quotes; obtain a written quotation for the specific assets, systems and limits.

Cost worksheet: [LOW]–[HIGH] annual total — add custody fees, insurance premiums, onboarding, transaction and exit charges, and network fees; do not count an insurance limit as an asset; a policy limit is a maximum payout, not money held for you.

On-chain mutual cover: some mutual or decentralised cover products let members pool funds to pay claims for specified events (for example a smart-contract failure); pricing is quoted as [LOW]–[HIGH]% of the covered amount for [TERM] — fill in the actual figures from the product's current terms before relying on them; check what events are covered, how claims are decided, how long payouts take, and whether cover can be withdrawn or repriced. Mutual cover is not a substitute for a tested recovery drill, independent signing keys, or a provable exit.

Before you buy: get the policy wording, not a summary; confirm the insured entity is the entity holding your assets; confirm the covered systems are the systems actually used; check exclusions for insider action, social engineering, and software faults; check the claims process and its timescales; check whether the limit is shared; and remember that paying for cover does not remove the risk of seed compromise — the remedy remains the same (a new wallet, move everything, retire the old wallet).
## 22. Paid security: cloud KMS and HSM services

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

Providers named are examples, NOT Bawa recommendations.

A cloud key management service can hold and use keys without exposing them to your application servers; it cannot make a compromised application trustworthy or turn a mistaken payment into a safe one. Bawa is reference software, not a custody service; the project does not take possession of users' keys.

**What a cloud KMS buys:** keys are created and used inside the provider's managed hardware boundary; the application receives signatures or decrypted data, not readable key material; access policies can restrict which identities and services may use a key, and when; usage is logged, which helps audit and incident response. Check the exact module, firmware and operating configuration covered by any validation claim; a validated component does not certify the complete wallet, approval service or custody arrangement.

**Limits:** a malicious request can still get signed (compromised software may submit a validly formed transaction that benefits an attacker); the service cannot infer the holder's intended recipient (destination, network, asset, amount and fees need independent checking before approval); the provider is a dependency — outages, account suspension, legal orders or insolvency can interrupt signing; keys managed by a cloud provider are not the same as keys you hold yourself; check who can change policy, recover backups, cause a signature or block access.

**Who controls the key:** with a cloud KMS, the provider operates the key infrastructure; you retain contractual rights and give instructions, but you cannot necessarily sign without its cooperation. That differs from self-custody with your own HSM, where you retain control of key material, signing authority and recovery. Check whether keys are exportable, how backups are protected, and whether an encrypted backup will work with another vendor — do not assume a cloud KMS key can become a mnemonic or move to a different provider.

**FIGURES (indicative snapshot dated 30 October 2026 — not vendor quotations or live prices):**

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED**

| Service or item | Indicative charges |
|---|---|
| Cloud KMS key charges | US$0.05–$0.10 per key or active version per month for software-backed keys; $0.50–$2 per month for HSM-backed keys; $2–$4 per month for keys under external protection. |
| Dedicated cloud HSM | US$1,000–$20,000 per month depending on the service, region and configuration. |
| On-premises HSM | £5,000–£50,000 per appliance; redundant deployment plus integration £15,000–£150,000; support £1,000–£10,000 per appliance per year. |
| HSM-backed secrets managers | £10,000–£100,000 per year. |

These bands are not market limits; ask whether charges are per key, per version, per operation or per device; redundant equipment, hosted rental, backups, integration, support, staff, external review, withdrawal charges and network fees may be separate. Recheck every price before committing, including taxes, minimums and exit fees.

**First-quarter acceptance gate:** before relying on a cloud KMS or HSM service for production signing, complete a first-quarter acceptance gate — (1) a small-value signing test through the full approval path; (2) a recovery test using only the documented backup route, without the provider's support team; (3) a test of the exit route (fresh keys under a new boundary, verified receiving addresses, on-chain transfer); (4) a review of the policy wording, access controls and audit logs. If any step fails, do not increase exposure until it passes.

**On-premises HSM:** buying an appliance keeps the hardware under your control, but you take on firmware updates, physical security, backups, redundancy and staff access. A single appliance is a single point of failure; budget for a redundant pair and for tested recovery. An appliance does not remove the need for an external security review of the complete design before treating a Bawa-based deployment as production custody infrastructure.

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

Providers named are examples, NOT Bawa recommendations.

### Paid audits

An external security review of the complete design is required before treating a Bawa-based deployment as production custody infrastructure; buying certified hardware does not replace that review. A paid audit examines the code, configuration and procedures in scope at a stated revision; it is not a promise that the system is safe.

Define the scope before commissioning: seed handling, derivation paths, signing, recovery, dependencies; name the components and the revision reviewed; record exclusions; and commission a follow-up review of the fixes — an audit report that lists findings without verified fixes is unfinished work.

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

| Paid audit scope | Budgeting range |
|---|---:|
| Simple token | $8,000–$20,000 |
| Enterprise | $80,000–$200,000 |
| Mid-sized DeFi including re-audit | $200,000–$300,000 |
| Complex bridge or cross-chain | $100,000–$300,000+ |

These are budgeting ranges, not quotes; scope, duration and the firm's rates decide the actual price.

### Audit contests

A contest pays many independent researchers to find vulnerabilities in a fixed window; the sponsor sets the prize pool and the rules.

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

| Example provider | Premium | Advertised cover |
|---|---|---|
| Sherlock | 2.0%–2.25% of the covered amount | Up to approximately $10 million |

Check what the premium buys, what events are covered, how claims are decided, and whether cover can be withdrawn or repriced.

### Bug bounties

A bounty programme pays researchers who report vulnerabilities responsibly through a defined channel.

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

| Bounty item | Dated figure |
|---|---|
| Top critical awards | Were roughly 5–10% of realistically exposed funds |
| Bounty pot | Was typically 2–3 times that award |
| Ceilings | Ranged from thousands to more than US$10 million |
| Platform fee | Was roughly another tenth of the rewards paid |

Set the scope, the severity scale, the payout rules and the response times before launch; a bounty without a working disclosure route is not a programme (see §7 — no reporting route is documented; that is an open item owned by the maintainers).

### Transaction monitoring and simulation

Monitoring watches on-chain activity and alerts on unusual transfers, new approvals or unexpected destinations; simulation previews a transaction's effects before signing. Neither can make an approved malicious transaction safe — they give you a chance to catch it before you approve.

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED.**

| Monitoring service | Budgeting range |
|---|---|
| Personal monitoring | £0–£50 per month |
| Business monitoring | £500–£10,000 per month for an initial allowance |

Check what is actually monitored (which chains, which events), how alerts are delivered, and what happens when the monitoring service is down.

Buy in this order: hardware signing and offline backups first; then alerts and pre-signing checks; then bespoke feeds and automated response. Monitoring is never a substitute for a tested recovery drill, independent signing keys, or a provable exit — and paying for any of these services does not remove the risk of seed compromise: the remedy remains the same (a new wallet, move everything, retire the old wallet).
## 23. Paid security: choosing by threat, by budget, and the exit checks

These figures are a dated guide, not current quotations. Recheck all pricing, minimums and insurance terms before relying on them.

Providers named are examples, NOT Bawa recommendations.

Choose by threat — match the control to the risk, not to the price tag:

| Threat | Free controls that help | Paid option worth considering |
|---|---|---|
| Lost seed or device | Offline backups, tested recovery drill | Managed multisig with inheritance |
| Single stolen key | Hardware signing, separate approval roles | Multisig or MPC with independent signers |
| Mistaken or malicious payment | Independent transaction verification, allow-lists, spending limits | Approval workflows, transaction simulation |
| Provider failure or freeze | Independent quorum, provable exit, tested recovery | Only if the exit is genuinely independent |
| Insider or colluding approvers | Separate signers, audit records, quorum above one | Independent signers, external review |
| Smart-contract or protocol failure | Keep exposure small, check contract risk separately | Insurance may cover some events — check wording |
| Inheritance or incapacity | Letter of instruction, named recipient, tested handover | Assisted multisig with inheritance, estate wrapper |
| Regulatory or audit requirements | Documented procedures, audit records | Qualified custody, external review |

Choose by budget and skill — indicative scale (snapshot dated 30 October 2026, recheck-required):

**INDICATIVE SNAPSHOT DATED 30 OCTOBER 2026, RECHECK-REQUIRED**

| Approach | Indicative annual cost | Who it suits |
|---|---|---|
| Free controls only (hardware wallet, offline backups, tested drill) | £0 plus hardware | Most individuals |
| Collaborative custody (Casa-style, Unchained-style) | $250–$7,500 per year | Families, higher-value individuals |
| Institutional MPC entry | Approximately $999 per month to $36,000+ per year enterprise | Business treasuries, funds |
| Qualified custody | Negotiated percentage of assets | Funds, fiduciaries, regulated businesses |
| External security audits | $8,000–$300,000+ per engagement | Any production deployment |
| Bug bounty ceilings | Thousands to $10 million+ | Projects with public exposure |
| Cloud KMS | From approximately $1 per key per month | Teams needing managed signing |
| Dedicated HSMs | From cluster or pool-hour billing | Institutions with strict key-control needs |

Exit checks — complete these seven checks BEFORE signing with any paid provider:

1. Map control: who holds each key or share, including backups and subcontractor-held material? Can the provider reach a signing quorum without you? Can you reach one without the provider?
2. Prove independent recovery: using only your own keys and independent tooling, restore access and broadcast a small spend without the provider's interface, API or signature. Seeing a balance or exporting a file is not proof.
3. Write down exit terms: notice periods, withdrawal limits, approval delays, termination charges, data export. Get them in writing before funding.
4. Test a withdrawal: move a small amount out while the service is operating normally, to a fresh wallet you control. Record the time it took and the fees charged.
5. Record what cancellation changes: does cancelling stop signing, monitoring, recovery support, or all three? What happens to backups and records?
6. Rehearse provider shutdown: with the provider's signing and authentication services unavailable, produce a valid transaction using the documented fallback and broadcast through independent chain access.
7. Rehearse seed compromise: a new wallet, move everything, retire the old wallet. If the service cannot explain how that remedy works under its arrangement, do not fund it.

Paying does not remove risk: a paid service can reduce dependence on a single device, a household backup or one employee's knowledge; it cannot remove market risk, protocol risk, or the risk of a mistaken approval. A compromised seed still means a new wallet, moving everything, and retiring the old wallet — whatever you paid for.
## 24. Sources

- BIP-39 — https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- BIP-32 — https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- BIP-44 — https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
- BIP-49 — https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki
- BIP-84 — https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki
- BIP-86 — https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki
- BIP-174 (PSBT) — https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
- BIP-371 (Taproot PSBT) — https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki
- BIP-380 (descriptors) — https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki
- SLIP-39 — https://github.com/satoshilabs/slips/blob/master/slip-0039.md
- SLIP-0044 — https://github.com/satoshilabs/slips/blob/master/slip-0044.md
- SLIP-0010 — https://github.com/satoshilabs/slips/blob/master/slip-0010.md
- OWASP Password Storage Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (checked 8 November 2026; contains the 600,000-iteration PBKDF2-HMAC-SHA-256 basis cited in §3)
- age encryption tool — https://github.com/FiloSottile/age
- Gitleaks — https://github.com/gitleaks/gitleaks
- Semgrep — https://semgrep.dev/ (checked 8 November 2026; 403 to automated check, existence confirmed — keep with this dated note)
- Keycard Shell — https://github.com/keycard-tech/keycard-shell (checked 8 November 2026)
- Keycard (status-keycard) — https://github.com/keycard-tech/status-keycard (checked 8 November 2026)
- Keycard product page (rate-limited to automated checks on 8 November 2026; linked from the live homepage)
- Trust Wallet developer documentation home — https://developer.trustwallet.com/
- Trust Wallet Core repository — https://github.com/trustwallet/wallet-core
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/ (checked 8 November 2026; w3.org blocks automated checks — keep with this dated note)
- SIM-swapping protection — https://www.ownyouronline.govt.nz/personal/get-protected/guides/protect-yourself-against-sim-swapping/ (government guidance)
- BitBox multisig — https://support.bitbox.swiss/en_US/blog-content/how-nearly-all-personal-hardware-wallet-multisig-setups-are-insecure (checked 8 November 2026)
- NCSC small organisations guide — https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security
- Incident response guidance — https://oyarr.com/safety/incident-response.html
- RFC 6585 (HTTP 429) — https://www.rfc-editor.org/info/rfc6585/ (section 4, ‘429 Too Many Requests’)
