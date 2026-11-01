# Security & Recovery

Use this when the concern is protecting recovery capability and making the wallet reproducible after failure.

# Privacy: xpubs are not spending keys, but they are sensitive

An xpub does not normally let an attacker spend from the wallet.

It may still allow them to derive many receiving/change addresses below that public node.

For a merchant or personal wallet this can reveal:

- account structure;
- address reuse patterns;
- payment history;
- balances;
- customer relationships when payments are observable.

Treat xpubs as **watch-only secrets** rather than as ordinary public configuration.

Do not paste them into:

- public issue trackers;
- analytics dashboards you do not trust;
- random “xpub checkers”;
- browser extensions you have not reviewed;
- chat messages that are not necessary.

For a multi-account application, consider whether each subsystem really needs the account-level xpub or whether a narrower public node is sufficient.

---

# Backup and recovery

A real backup is the ability to recreate the same wallet independently.

For a conventional BIP-39/BIP-32 wallet, that generally means preserving:

```text
mnemonic
+ BIP-39 passphrase policy
+ chain derivation policy
+ account selection
+ network
```

For special chains add whatever the chain requires.

TON is the clearest example: wallet contract/version and wallet-ID/subwallet configuration can matter.

### Test recovery before funding

A recovery drill should look like:

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
compare to previously recorded address
```

Do this before trusting the wallet with meaningful funds.

### Separate backups

For the application-specific encrypted Bawa artifact:

```text
seed.enc.json   → one location

data key       → another location

mnemonic       → offline recovery location
```

Do not store all three in the same place and then congratulate yourself for having “encrypted backups”.

---

# Dependency and supply-chain discipline

Wallet code is sensitive to dependency drift.

A professional repository should have:

```text
exactly documented runtime versions
committed lockfiles
verified release tags
CI tests
secret scanning
dependency review
release checksums / provenance where appropriate
```

### Do not do this

```json
"dependency": "^4.8.4"
```

and assume that means “the code I tested”.

A caret range means future compatible versions may be selected.

For security-sensitive primitives, pin the tested release in the actual application lockfile and review upgrades deliberately.

Trust Wallet Core itself recommends checking the current release/version rather than blindly using an old example. See the official [Wallet Core repository](https://github.com/trustwallet/wallet-core).

### Reproducibility

For serious release engineering:

```text
source tag
    ↓
lockfile
    ↓
clean build
    ↓
tests
    ↓
artifact hash
    ↓
release
```

That is far more useful than writing “secure” in the README.

---

# What this guide does not promise

This guide does not promise:

- that Trust Wallet Core is correct for every possible chain use case;
- that one derivation path is compatible with every wallet application;
- that free public RPC is suitable for production;
- that an xpub is harmless to expose;
- that JavaScript can guarantee perfect memory zeroization;
- that a hardware wallet eliminates every operational risk;
- that a hosted indexer gives you complete historical truth forever;
- that TON can be flattened into a Bitcoin-like path table;
- that Solana, Cardano or Substrate are interchangeable with secp256k1 BIP-32 chains;
- that “open source” means audited;
- that “audited” means immune to implementation mistakes;
- that a wallet is recoverable without preserving its derivation policy.

Those limitations are not weaknesses of the guide. They are part of being honest about the engineering problem.

---

# Common mistakes

## Mistake 1: “BIP-39 is the wallet.”

No. BIP-39 gives you a mnemonic and a seed derivation procedure. The downstream HD/key/address policy is another layer.

## Mistake 2: “Every chain uses m/44'.”

No.

Bitcoin BIP-84 is a concrete example of a different purpose.

Cardano uses its own CIP purpose.

TON has wallet-contract semantics.

Substrate uses a different URI/crypto model.

## Mistake 3: “The same EVM address means the same network.”

No.

The address may be the same while the chain ID, RPC, balances and token contracts are different.

## Mistake 4: “RPC gives transaction history.”

Sometimes you can build history with RPC calls, but a raw RPC node is not a pre-built wallet index.

## Mistake 5: “The xpub is public so it belongs in `.env.example` with everything else.”

It can be public in cryptographic terms while still being privacy-sensitive operational data.

## Mistake 6: “If `getBalance` works, the tracker works.”

No.

You still need token events, retries, reorg handling, historical queries, persistence and reconciliation.

## Mistake 7: “Encrypting the seed means memory is safe.”

No.

During generation, plaintext secret material exists in process memory before encryption.

JavaScript strings and WebAssembly allocations do not provide a perfect secure-memory primitive.

## Mistake 8: “Self-hosted means free.”

Software can be free while the infrastructure is not.

A full node may require substantial disk, bandwidth, CPU, RAM, backups and maintenance.

## Mistake 9: “A random GitHub fork is an official implementation.”

Never assume this.

Start from:

- the blockchain's official documentation;
- the project's canonical repository;
- standards;
- maintainers with a visible history.

---

## Recovery record

mnemonic + BIP-39 passphrase policy + exact chain/path policy + account/branch + network + chain-specific configuration.

Encryption at rest protects a stored artifact; it does not make plaintext secrets immune to OS compromise, debuggers, core dumps or memory forensics.

# Independent verification and supply-chain discipline

The production wallet path uses the pinned Trust Wallet Core runtime. Independent verification uses bip_utils where the standards and derivation policy overlap.

~~~
production
  Trust Wallet Core

verification
  bip_utils + official vectors
~~~

The two paths should not share the same Bawa adapter logic.

Before a real-money release, commit the dependency lockfile from a clean install and add secret scanning, dependency scanning, reproducible release metadata and an external security review.
## 08 Security/recovery — trust and survival

### SECURITY · trust map

```text
RECOVERY BOUNDARY
BIP-39 mnemonic
+ exact BIP-39 passphrase policy
+ chain derivation paths
+ address policy
+ account
+ network/chain configuration
+ TON wallet configuration where applicable
↓
independent recreation of the same wallet
```

```text
WATCH-ONLY BOUNDARY
xpub
↓
many receiving addresses below its node
many change addresses below its node
↓
observable payments
balances
relationships

Excluded destinations:
public issues
untrusted analytics
random checkers
unreviewed extensions
unnecessary chats
```

An xpub does **not normally allow spending**. It can expose account structure and address-reuse patterns. Bawa’s `docs/RECOVERY.md` states that an xpub or zpub **cannot recover the wallet**: it reproduces only public descendants below the exported account node.

Bawa does not document an xpub-only import workflow. Check your chosen watch-only tool’s documentation for import steps.

For backup storage, follow the separation and access-control rules in `docs/RECOVERY.md`:

| Threat | Backup boundary |
|---|---|
| Fire/flood | Keep 2–3 offline copies in separate places that do not share one fire or flood risk. Bawa does not prescribe backup media or protective storage; choose these for the risks at each location. |
| Theft | Choose and record physical access controls for each copy, including how its storage protects against theft. |
| Loss | Separated copies provide alternatives; test independent recovery before relying on them. |

### RECOVERY · material checklist

- [ ] Write the recovery record offline and keep **2–3 separated copies**. Never digitise the mnemonic or share it with “support”. Bawa’s `docs/RECOVERY.md` requires you to preserve:
  - The BIP-39 mnemonic, or an existing `seed.enc.json` plus its separate **32-byte data key**.
  - The exact BIP-39 passphrase policy: **currently an empty passphrase**.
  - Chain derivation paths and address policy, account, and network/chain configuration.
  - For TON: wallet contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID.

  Keep the recorded configuration whichever recovery route you use.

  **You should see:** all listed fields and 2–3 offline copies in separate places.

- [ ] Keep xpubs out of the excluded destinations. Check whether each subsystem can use a narrower public node.  
  **You should see:** no xpub in those destinations, with each subsystem’s public-node scope reviewed.

### Decryption-handling checklist · unresolved gaps

Follow Bawa’s `docs/RECOVERY.md` for encrypted-seed recovery. These checks cover recovery handling, not how to create encrypted backups.

| Required detail | Recovery rule and next step |
|---|---|
| BIP-39 passphrase custody and re-entry | Preserve the exact policy: Bawa currently uses an empty BIP-39 passphrase. Use the same policy when restoring and verify it with the mnemonic before funding. |
| Encrypted xpub/backup format and tooling | Bawa documents recovery from `seed.enc.json` using `tools/decrypt_seed.py`. It does not document an encrypted-xpub format or associated tooling; consult your chosen watch-only tool’s documentation before using one. |
| Decryption-key custody and recovery | Preserve `seed.enc.json` and its separate 32-byte data key. Check that you can access both when testing recovery. |
| Plaintext, memory and clean-up handling | Choose how the mnemonic will be displayed or written before decrypting. Bawa does not document memory clearing or a full clean-up procedure; review your trusted machine and recovery tool’s plaintext handling before use. |

On a trusted machine, run the command documented in `docs/RECOVERY.md`:

```sh
python3 tools/decrypt_seed.py /path/to/seed.enc.json
```

It asks for the data key and displays the mnemonic on the controlling terminal by default. Use `--stdout` only for an explicit, controlled pipeline. Use `--output` for an atomic `0600` plaintext file.

This encrypted-seed recovery route is for an existing backup, not permission to digitise your offline mnemonic. Separated copies alone do not provide encryption or guarantee survival of a fire or flood.

### Restore gate · conceptual/testnet only

1. Before funding, test independent recovery on a clean trusted machine, as required by Bawa’s `docs/RECOVERY.md`. Verify the mnemonic and exact passphrase policy, derive known public addresses and compare them with the recorded originals. **Do not fund until the public outputs match.** Repeat the drill quarterly with a tiny testnet amount.  
   **You should see:** the same wallet independently recreated from the recorded recovery information, with known public addresses matching the originals.

2. **Proposed first-address check:** compare the restored first receiving address with `[RECORDED_TESTNET_FIRST_ADDRESS]`, using the recorded chain, derivation paths, address policy, account and network.  
   **You should see:** an exact match with your locally recorded reference address.

Bawa’s drill stops at `fresh`. Seed decryption is documented, but Bawa does not document a complete restore tool/UI workflow or a first-address selection procedure for this drill. Follow your recovery tool’s documentation to reproduce the recorded settings. Use a reference address recorded from your original testnet wallet before the restore.

The first-address comparison is a check, not a standalone restore procedure or a fixed address output. It does not make xpub-only recovery possible.

### Compromise rehearsal · testnet only

A compromised seed cannot be changed. Bawa’s `docs/RECOVERY.md` requires you to generate a new wallet on a fresh trusted device, move every asset/token to it and retire the old wallet permanently. For this testnet rehearsal, apply that rule to every test asset/token.

**You should see:** a new wallet holding every test asset/token and the old wallet retired—not the old seed treated as repaired.

---
## 08 Security/recovery — passphrase and drills

```text
SECURITY — trust map
Offline recovery set --> wallet recreation
Sensitive xpub -------> watch-only visibility
Both --X--> public issues / untrusted services
```

```text
RECOVERY
Offline record --> documented restore --> first-address comparison
Missing procedure or mismatch ---------> incomplete drill
```

An xpub is a **watch-only secret**: it normally cannot spend, but may expose addresses and observable payments. Bawa’s `docs/RECOVERY.md` makes the limit clear: an xpub or zpub cannot recover the wallet. It reproduces only public descendants below the exported account node. An address match is not proof of spending recovery.

### Passphrase and backup checklist

1. Record the recovery set offline, including the exact BIP-39 passphrase policy. Preserve the following details, as required by Bawa’s `docs/RECOVERY.md`.
   **You should see:** every applicable row accounted for, or an incomplete record.

| Material | Recovery context |
|---|---|
| Mnemonic | Offline recovery copy of the BIP-39 mnemonic |
| Passphrase | Exact BIP-39 passphrase policy; Bawa’s current policy is empty |
| Wallet selection | Chain derivation paths and address policy, account, network/chain configuration |
| TON, if applicable | Wallet contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID |

Use the recorded passphrase policy exactly during recovery; under the current policy, leave the BIP-39 passphrase empty. Verify the mnemonic/passphrase before funding. Bawa does not document non-empty passphrase setup or lost-passphrase handling. If you cannot verify the mnemonic and exact passphrase policy, mark recovery incomplete and do not fund.

2. Keep 2–3 separated offline copies, in places that do not share one fire or flood risk. Choose and record physical access controls. Never digitise the mnemonic or share it with “support”.
   **You should see:** 2–3 separated copies, with no digital seed copy created.

3. Before using an existing encrypted backup, complete its decryption-handling checklist.
   **You should see:** format, tool, credential custody and plaintext/memory handling documented—or recovery blocked.

   Bawa’s `docs/RECOVERY.md` documents an alternative to the mnemonic backup: encrypted `seed.enc.json` plus its separate 32-byte data key. Keep the exact passphrase policy and applicable wallet/chain configuration too. On a trusted machine, run:

   ```sh
   python3 tools/decrypt_seed.py /path/to/seed.enc.json
   ```

   The tool asks for the data key and displays the mnemonic on the controlling terminal by default. Use `--stdout` only for an explicit controlled pipeline; use `--output` for an atomic `0600` plaintext file.

   Bawa does not document memory handling or encrypted-xpub backup handling. Obtain a verified procedure for any applicable handling requirements before decrypting. If those requirements remain unresolved, recovery is blocked. An encrypted xpub still cannot replace the wallet recovery set.

### Restore drill — before funding, then quarterly

Bawa’s `docs/RECOVERY.md` requires recovery on a clean trusted machine before funding. Verify the mnemonic/passphrase, derive known public addresses and compare them with the recorded originals. Do not fund until the public outputs match.

1. Record the unfunded testnet wallet’s first-address reference and network/account/derivation context, including its address policy and any applicable TON settings.
   **You should see:** a reference to compare against.

   Use a recorded public address from your own wallet, not an example address. Bawa does not document a first-address generation procedure. Check the relevant wallet and chain documentation for that procedure before relying on the reference.

2. Restore on a clean trusted machine using the complete recovery set and a documented restore procedure for your wallet. Verify the mnemonic and exact passphrase policy, then derive the first address in the recorded context and compare it with the reference. Compare any other recorded known public addresses as well.
   **You should see:** an exact match in the same context, otherwise an incomplete drill.

   Bawa does not document chain-specific restore steps. Obtain a verified procedure for the recorded wallet and chain before continuing, and use the derivation paths, address policy and network configuration in your recovery record. Without a verified procedure, the drill is incomplete. Do not fund until the public outputs match.

3. Repeat quarterly with a tiny testnet amount only, or keep the drill conceptual.
   **You should see:** a dated result, or spending verification marked untested.

   Bawa does not document a signing procedure. Use verified signing instructions for the relevant testnet to check spending recovery; otherwise mark it untested. No real funds are used in this drill. A conceptual drill does not replace the required pre-funding recovery check.

### Compromised seed — conceptual only

A seed cannot be “changed”. Bawa’s `docs/RECOVERY.md` requires the following response to compromise.

1. Generate a **new wallet on a fresh trusted device**.
   **You should see:** a replacement wallet, not reuse of the compromised seed.

   Bawa does not document device-trust checks or wallet-generation procedures. Use a verified device-setup process and the wallet’s documented generation procedure before proceeding.

2. Move **every asset/token** to the replacement wallet.
   **You should see:** every asset/token accounted for as received.

   Bawa does not document asset discovery, transfer or confirmation procedures. Use the relevant wallet and chain documentation to identify every holding, transfer it and verify receipt before retiring the old wallet.

3. Retire the old wallet **permanently**.
   **You should see:** the old wallet recorded as retired and no longer used.

## Air-gapped signing with PSBTs (free coordinator)

A PSBT — Partially Signed Bitcoin Transaction — lets an online wallet prepare a payment without holding the keys needed to authorise it. In Bawa, give that watch-only coordinator the account’s public derivation root so it can discover coins through RPC or an indexer. Keep the mnemonic, seed and private keys on the trusted offline signer.

```text
Online watch-only coordinator: prepare payment
    ↓ unsigned PSBT by QR code or removable media
Offline signer: verify details, then sign
    ↓ signed PSBT by QR code or removable media
Online coordinator: finalise and broadcast
```

### Follow the payment across the gap

1. **Build online.** Choose the coins to spend, enter the destination and amount, set the fee, and export an unsigned PSBT. The coordinator does not need a seed to do this. Stop if it asks you to import one.

2. **Carry the unsigned PSBT to the signer.** Use a QR format supported by both applications, or transfer the file on removable media. Keep the signer disconnected from networks. Treat the PSBT and its carrier as untrusted input, not as proof that the payment is correct.

3. **Check on the signer’s own screen.** Compare the full destination address and amount with payment details obtained independently of the coordinator. Check the fee as well. For every change output, require the signer to verify that the address belongs to your wallet using its own derivation data. A coordinator’s “change” label is not evidence of ownership. If these checks are unavailable or anything differs, do not sign.

4. **Sign offline.** Approve only the transaction you have checked, then export the signed PSBT. No mnemonic, seed or private-key file should accompany it.

5. **Carry it back and broadcast.** Return the signed PSBT by QR code or removable media. Import it into the coordinator, finalise it into a transaction, and broadcast that transaction. Record its transaction ID so you can check its status without creating another payment.

### What this protects — and what it does not

Keeping signing keys offline protects them from direct theft by malware on the connected machine. A monitored or compromised coordinator has no local seed or private keys to extract.

The air gap does **not** stop a compromised coordinator swapping the destination before signing. It also does not protect you when a signer shows a doctored transaction and you approve it without checking, or against physical seizure of the signer. A dishonest signer can lie about what it signs; screen checks cannot turn compromised signing hardware or software into something trustworthy.

### Cost and failure modes

The coordinator software is free. A dedicated signer costs money; preparing and maintaining a spare offline machine costs time, and may involve hardware costs too. Bitcoin network fees still apply.

- **Lost unsigned PSBT:** harmless to funds — it cannot authorise a spend without signatures. Rebuild it if needed. It is not necessarily harmless to privacy: someone finding it may learn addresses, amounts and wallet activity.
- **Signed PSBT submitted twice:** rebroadcasting the same finalised transaction does not pay twice or charge another transaction fee. An “already known” response may be normal. Check the original transaction ID rather than making a fresh payment.
- **Wrong change address:** the recipient can be correct while the remaining coins go somewhere you do not control. Reject unverified change before signing. If the transaction confirms with change sent elsewhere, the air gap cannot recover those coins.

**You should see:** one pending or confirmed payment with a transaction ID, the approved destination and amount, and any change returning to your wallet.

## Open-firmware signers, free software

Open firmware makes the signer’s firmware source available for independent audit; some makers also publish hardware designs for review. A free-software licence permits study, modification and sharing under its terms. Availability is not evidence of an audit. Look for a report naming the reviewed version, scope and unresolved findings; even an audit can miss faults.

The software is free; the physical device costs money. Check the maker’s own site for current costs, including delivery and taxes.

**Verify every release before installation.** Follow the maker’s verification instructions for the exact firmware file. Use a trusted release-signing key, confirming its fingerprint through a separate trusted channel. Check the intended device model and firmware version too. Stop if verification fails or the key is unexpected.

Public source does not authenticate a download. Signature verification catches altered files and unauthorised substitutes; it does not prove that the binary matches the published source or that the code is safe. A malicious official build, firmware signed with a stolen release key, or an older vulnerable release can still pass verification.

Other failure modes include tampered hardware, interrupted updates and lost or exposed recovery backups. A compromised computer can propose the wrong payment: read the recipient, amount and fees on the signer’s display before approving. The device cannot correct a harmful transaction you authorise. An exposed recovery backup may let someone spend without the device.

**You should see:**
- A valid signature from the trusted release-signing key.
- The intended firmware version displayed on the signer after installation.

## Do-it-yourself stateless signers, free software

SeedSigner- and Krux-class projects show the pattern: a commodity board, screen, controls and camera. These names describe an approach, not current device recommendations. Check public advisories for the exact hardware and firmware before choosing a build. An unresolved public seed-generation advisory rules it out.

For this setup, use hardware with **no Wi-Fi and no Bluetooth**, rather than merely disabling radios. Run with **no persistent key storage**: no saved seed files, even encrypted ones. Enter the seed afresh each session, keep it only in RAM and remove power afterwards. Communication with a compatible wallet is **QR-only**; use a power-only connection, not a data cable.

```text
Online watch-only wallet
    ↓ unsigned transaction QR
Offline stateless signer
    ↓ signed transaction QR
Online wallet broadcasts
```

Depending on the firmware, seed-generation options include dice rolls or camera-derived entropy. Follow a documented, reviewed procedure and meet its collection requirements. Too few rolls, predictable input or faulty entropy processing can produce guessable seeds. Camera entropy is not a reason to photograph your mnemonic. Keep a protected offline recovery backup, such as paper or metal.

**What it helps against:** during signing, the networked wallet need not hold the seed or private keys, reducing direct key theft by malware on that computer. Removing radios removes those wireless entry points. Not saving keys reduces what a thief can extract from a powered-off device’s storage.

**What it does not cover:** malicious firmware, tampered components, memory extraction, QR-parser vulnerabilities, stolen backups or approving a substituted transaction. Check the destination, amount and fee on the signer itself. Power interruptions, failed storage media and unreadable QR codes can stop a session; losing the only recovery backup can mean losing access altogether.

Nor does this repair an earlier leak. Bawa’s controlling-terminal route keeps the mnemonic and data key out of ordinary subprocess stdout/stderr capture; it does not isolate them from the host. A hostile OS or terminal, debuggers, crash dumps, swap and memory snapshots can still expose them. Loading an exposed seed into another device does not make it secret again.

The software is free to use, inspect and modify; parts and replacements cost money. Assembly, firmware verification and recovery testing take time. Choose this route over a paid option if you are comfortable taking on that maintenance. A maintained, supported paid signer may suit you better if you want less assembly and troubleshooting; payment alone is no security guarantee.

**You should see:** transaction details before approval, and no loaded seed after a full power cycle—signing requires fresh seed entry.

## Free Bitcoin multisig: keep the keys and the policy

Sparrow and Electrum are free, open-source Bitcoin coordinators. A 2-of-3 wallet requires signatures from any two of three independent keys. The coordinator can remain watch-only: it prepares transactions without holding seeds.

```text
Three independent signers
↓
Shared, registered 2-of-3 policy
↓
Any two signers authorise a spend
```

### What this buys you

One compromised key cannot spend alone. Losing access to one key need not strand funds if two usable keys and the full policy remain. With proper separation, one fire or theft need not remove the entire recovery route.

It does not survive permanent loss of two keys, compromise of two keys, or two signers approving a fraudulent payment. Registered policy lets a signer recognise its own change; it does not prove an external recipient’s identity. Check destination and amount on trusted signer displays against independently obtained payment details.

### Set it up and prove it

1. **Check compatibility first.** Obtain verified releases from the projects’ official distribution channels. Choose a coordinator and signers supporting your exact policy, full policy registration and change validation. Bitcoin native SegWit multisig, P2WSH, is a common choice. Check firmware support; do not assume every device qualifies.

2. **Generate separate keys.** Initialise three signers independently; cloning one seed does not create independent keys. Make offline seed backups. Record seed format and passphrase requirements, including whether the BIP-39 passphrase is empty; keep any required passphrase independently recoverable. Electrum-native seeds are not BIP-39. Keep seeds out of the everyday coordinator.

3. **Assemble the wallet.** Select 2-of-3 and the intended Bitcoin network. Import each signer’s account public-key export. Compare the full public keys and their origins against trusted signer exports; names and short fingerprints alone are insufficient.

4. **Register the same full policy on every signer.** Confirm the threshold, all cosigner keys, paths and script type through each signer’s supported verification flow. Test receive-address verification and change recognition before substantial funding. Do not use blind signing. After a reset or replacement, seed restoration is not enough: register the policy again.

5. **Back up the public policy.** Keep a watch-only wallet export and, where supported, checksummed descriptors for both receive and change branches. Record: 2-of-3; all three cosigner xpubs and master fingerprints; exact origin, account and branch paths; script type; key ordering or sorting; and Bitcoin network. Two seeds still need the third cosigner’s public information. An individual xpub/zpub is not a multisig recovery package. Test exports: Sparrow and Electrum formats are not automatically interchangeable.

6. **Separate the backups.** Arrange signers and seed backups so one incident cannot expose two distinct keys. Three software signers on one infected computer do not provide that separation. Keep multiple offline policy copies in separate locations. A public policy file cannot spend by itself, but it can reveal addresses and transaction history. Protect its privacy. The watch-only file is not a seed backup.

7. **Run a recovery rehearsal.** Rebuild the watch-only wallet in a clean compatible installation from the policy backup, and compare receive and change addresses. Check every seed backup using the signer’s recovery-check feature or a spare trusted signer. Confirm that the backed-up passphrase, if used, reproduces the recorded account public-key export. Use a small balance to test each signing pair, including change, with the third signer absent. Leave repeatable instructions for your future self or executor.

### Failure modes worth planning for

Wrong passphrases, paths, script types, key ordering or networks can produce a different, empty wallet. Missing policy information can block recovery despite two surviving seeds.

After suspected key theft, replace that key in a newly verified policy and move funds using two trusted signers. Editing coordinator settings does not change existing coins’ spending conditions.

### Cost and when to choose it

The software has no licence or subscription fee. Budget for three compatible hardware signers if you use hardware, backup materials and any paid storage. Software signers still need genuinely isolated systems. Miner fees apply, including rehearsals; multisig spends generally cost more than comparable single-key spends. Maintenance and testing also cost time.

Choose this over paid assisted multisig if you can manage separation, policy records and regular recovery tests. Paid help may be worth its fee for setup checks, replacement support or inheritance planning. If a provider holds a key, insist on the full exportable policy and test that your own two keys can recover without that provider.

## Free multisig backups: EVM smart-contract wallets

With Safe-class tools, the account is a contract on a specific EVM network. Its owner list and signature threshold live on-chain. A recovery phrase restores one owner’s key, not the whole account: control still requires whatever the contract currently authorises.

This redundancy covers assets controlled by the contract, not balances left in a separate seed-controlled account.

### What it protects against

A straightforward 2-of-3 Safe can tolerate one unavailable signer; one stolen owner key cannot spend alone. This helps with device loss, theft or a damaged backup when owners and their recovery materials are genuinely independent.

Three addresses derived from one mnemonic do not provide that independence. Do not store enough owner backups to satisfy the threshold in one location.

### Queuing and approval

Owners usually exchange proposals and signatures off-chain, approving the same transaction at different times.

```text
Independent owner signers
    ↓
Approvals collected for one transaction
    ↓
Executor submits and pays gas
    ↓
Safe checks policy and executes
```

A hosted queue is a convenience, not a timelock or the wallet itself. Once nonce and policy checks pass, anyone holding enough valid signatures can execute. Earlier Safe nonces can block later ones.

Deleting a queued item does not revoke signatures. Normal cancellation means executing an authorised replacement at that nonce, which can race the original.

### Setup

1. **Prepare independent owners.** For example, initialise three separate hardware-wallet signers. Keep each owner’s mnemonic backup offline and apart from the others. Record BIP-39 passphrase requirements, exact derivation path and account/branch; preserve any required passphrase securely too. Restore each owner separately on trusted spare hardware and compare its address. Erase temporary restored copies afterwards. Never enter these secrets into a multisig website.

2. **Deploy deliberately.** Use the project’s verified release or official interface on `[network/chain ID]`. Select the three checked owner addresses and threshold two. After confirmation, check the contract implementation against official deployment records and inspect its owners and threshold through a separate explorer or RPC. Leave optional modules and guards off initially.

3. **Write the recovery inventory.** Preserve `[chain ID]`, `[Safe address]`, deployment transaction, owner addresses, threshold, implementation/version, enabled modules, guards, fallback handler and any recovery or upgrade arrangements. Keep dated offline copies and verify them against current on-chain state before recovery. This record is not a signing secret, but it is privacy-sensitive.

4. **Test with little money.** Send a small test amount to the deployed Safe, then propose a transfer out. Collect approvals separately. Each signer checks the chain, Safe address, nonce, destination, asset, amount and decoded calldata, including every batched call and token approval. Execute and check the receipt and balances. Test that your intended apps support contract accounts.

5. **Practise without a dependency.** Reconnect to the existing address through another compatible client; if proposals are missing, recreate them and obtain fresh signatures. Simulate one owner being unavailable and spend with the remaining quorum. Replace a lost or suspect owner promptly while quorum remains, then update the inventory. Creating another Safe does not recover assets in this one.

### Where it fails

Multisig cannot rescue a compromised quorum or several owners approving the same harmful transaction. Enabled modules may execute outside the usual owner threshold; treat them as separate spending authority. A broken guard can block execution.

Contract bugs and chain failures remain risks. An approved token spender may take tokens without a new Safe vote. Without enough usable owners or a functioning recovery route authorised in advance, access may be permanently lost.

### Cost and when to choose it

For basic self-managed use, deployment gas and transaction gas are the only chain costs. No software subscription is required. Off-chain proposals and signatures cost no gas; on-chain approvals, execution, owner changes and cancellations do. Fees vary with the network and congestion.

Keep the network’s gas coin available to the submitting account, or test a sponsorship arrangement. Money inside the Safe does not automatically pay the submitting account’s fee. Hardware, hosted services and relayer charges are separate possible expenses.

Choose this over a paid service if you can maintain independent owner backups, review calls and rehearse recovery yourself. Payment can buy coordination, monitoring or assistance; payment alone cannot replace missing signing authority. Before paying, establish whether the provider can spend or block recovery, and whether an independent quorum still works if it disappears.

## Free multisig and descriptor backups — part 2 of 2

### Keep the map as well as the keys

Bitcoin output descriptors (BIP 380 family) describe the scripts and keys used to construct outputs. For recovery, export them with key-origin fingerprints, complete derivation paths and both receive and change branches. Multisig descriptors also record the signing threshold and key ordering or sorting rule. A compatible wallet can then reproduce the addresses rather than guess your configuration.

Seed words, restored with the correct BIP-39 passphrase, recreate a key tree. They do not identify the chosen wallet policy or the other cosigners. A public descriptor, the matching seed/passphrase and the network/account record make single-sig recovery reproducible. Multisig needs the complete public policy and enough signing secrets to meet its threshold. Even two seeds for an independent 2-of-3 arrangement cannot recreate the third cosigner’s public key.

### What this protects against — and what it does not

A descriptor backup protects against lost wallet configuration, a broken coordinator and a vendor disappearing, provided another implementation supports the descriptor. It cannot authorise spending, replace missing signing secrets or stop an attacker who holds a signing quorum. A 2-of-3 arrangement tolerates one unavailable signer, not two.

Public-key material is still privacy-sensitive. Like an xpub, a descriptor can reveal linked addresses, balances and future activity. Keep it out of public repositories and support tickets. Descriptor syntax can also carry private keys: deliberately select the **public/watch-only export**, not a private export.

### Set up and rehearse

1. **Check compatibility first.** Choose a free coordinator and compatible signers. Confirm that an independent wallet can import the exact descriptor features you use; “supports multisig” is not enough. Practise with published test fixtures on a test network. Their keys are public and must never receive valuable funds.

2. **Verify the policy.** For a 2-of-3 wallet, enrol three independently generated signers. Confirm the threshold and fingerprints on trusted signer displays. Arrange devices and secret backups so one incident cannot expose or destroy two signing secrets.

3. **Export both branches.** Save complete public receive and change descriptors, whether exported separately or together, including their checksums. Do not reconstruct them by hand. Compare several derived addresses with the original wallet and trusted signer displays. A checksum detects copying errors, not malicious substitution: an attacker’s replacement can have a valid checksum and redirect new deposits.

4. **Make independent copies and import one.** Put the public export and recovery metadata on two independent offline media. In a clean installation of another compatible wallet, import the descriptors as watch-only. Check several recorded receive and change addresses. This check should not require any seed.

5. **Test discovery and signing separately.** Rescan from before first use, covering every issued address index on both branches. With the published fixtures, restore enough test signers and complete a test-network spend without the original coordinator. Check live signing backups through trusted on-device workflows, never by entering seeds into an online coordinator.

An empty restored view is not proof that funds have disappeared. Check the network, paths, missing change branch, scan start and address range. Changing the key-ordering rule can change addresses. A mistaken BIP-39 passphrase produces different valid keys rather than a “wrong password” error.

### Cost and when to choose it

The free route has no software licence or subscription charge. Hardware signers, durable backup media and separate storage can cost money; setup and periodic recovery rehearsals cost time.

Choose it over a paid managed service when you can maintain the records, separate the signing secrets and repeat the recovery test yourself. Paid help can be worthwhile for supported setup or succession planning. Payment does not replace missing keys or an incomplete policy. If a provider co-signs, check how you recover during an outage and how you leave the service.

### Multisig backup list

- **Complete public descriptors:** receive and change, checksums, script type, threshold, ordering rule, every cosigner’s extended public key, origin fingerprint and full paths.
- **Bawa recovery settings:** explicit network, account and branch selections, plus any chain-specific configuration. Bitcoin descriptors do not replace other chains’ recovery records.
- **Independent secret backups:** each signer’s offline mnemonic backup; whether its BIP-39 passphrase is empty or used; and a separately protected way to recover the exact passphrase when used.
- **Discovery records:** earliest-use date or block height, issued ranges or next indexes for both branches, and trusted reference addresses.
- **Recovery instructions:** tested importer and version, backup locations and steps an authorised successor can follow. Export labels and notes separately if you need them; descriptors do not preserve those.

**You should see:** matching receive and change addresses, every cosigner and the intended threshold, plus a completed test-network recovery spend without the original coordinator.

### Shamir sharing with SLIP-39

SLIP-39 divides a compatible wallet’s backup secret into word-based shares. With a single **2-of-3** group, any two distinct shares reconstruct it; one reveals nothing about the shared secret. That guarantee depends on correct implementation and sound randomness. Format metadata, such as thresholds, is not confidential.

These shares use SLIP-39, not BIP-39. An individual share cannot be converted into a BIP-39 mnemonic or restored through a BIP-39-only import screen. Cutting an existing mnemonic into sections is not Shamir sharing.

#### What it protects

Sharing limits the damage from theft of fewer than the required shares, while redundancy allows recovery after some shares are lost or destroyed. A missing envelope need not mean a missing wallet.

It does **not** protect against compromised generation or recovery software, exposure of the complete seed, or attackers assembling a qualifying set. Any SLIP-39 passphrase remains a separate requirement. This is not multisignature: after recovery, one wallet can sign transactions without consulting the share holders.

#### Set-up and recovery drill

1. **Check compatibility first.** Confirm that your chosen wallet and Bawa’s recovery path support the required SLIP-39 features, including grouped shares and passphrases. Accepting “recovery words” does not establish compatibility. If support is absent, choose another backup method rather than improvising a conversion. Use maintained software from verified releases; practise with published SLIP-39 test fixtures, whose wallets must never hold funds.

2. **Choose and record the thresholds.** One 2-of-3 group is easier to manage than a hierarchy and tolerates one unavailable share. Grouped sharing has two levels: the **group threshold** specifies how many groups must qualify; each group’s **member threshold** specifies how many distinct shares qualify that group. For example, require 2 of 3 groups, each needing 2 of 3 shares. Two shares from A and two from B work. Three from A and one from B do not: the total count alone is insufficient.

3. **Generate and verify offline.** Use a trusted device and its supported SLIP-39 backup workflow. Enter the recorded thresholds and let the implementation generate the shares; do not invent share words or randomness. Transcribe each share onto paper or durable media, then complete its verification checks. Label the backup set, group and member. Do not mix shares from different sets, photograph them, upload them or enter them into a website.

4. **Handle the passphrase deliberately.** If enabled, preserve its exact text in a separate offline recovery location. Shares cannot recover a forgotten passphrase. The wrong one can produce a different, valid-looking wallet rather than an error. A weak passphrase may be guessed after a threshold is stolen. Record that a passphrase is required, document the exact derivation policy—network, path, account and address type—and record an expected address for comparison.

5. **Separate access as well as storage.** For the simple 2-of-3 arrangement, use three offline locations that do not share a fire or flood risk. Record physical access controls and who can reach each share. Do not leave a qualifying set at one site or with one backup custodian. Duplicate copies of one share still count as only one share; protect their locations too. Continue keeping `seed.enc.json`, its data key and any complete mnemonic in separate locations, with the mnemonic offline. An intact full-secret backup bypasses the sharing layer.

6. **Test before funding.** On a fresh trusted recovery device with clean, verified software, recover without using the original wallet. Use exactly a qualifying threshold, apply the exact passphrase and derivation policy, derive the expected address and compare it with your earlier record. For 2-of-3, test all three pairs; for grouped sharing, test the recovery routes you intend to rely on. Passing share checksums is not proof of wallet recovery. Reset the test device afterwards and retain no secret-bearing logs.

#### Cost and when to choose it

Free implementations mean no software licence fee or required recovery subscription. Paper costs little; hardware, durable media, secure off-site storage and travel may cost money. The continuing expense is your time: maintaining records, checking access and repeating recovery drills.

Choose DIY sharing over a paid option when you have genuinely independent locations, can maintain compatible recovery tools, and can arrange recovery if you are unavailable. Paying may be worthwhile for supported hardware, storage or recovery assistance. Check whether the provider could assemble a threshold, what help its fee actually buys, and what happens if it closes.

Unreadable words, unavailable holders, mixed backup sets and losses beyond the configured tolerance can make recovery impossible. Review arrangements when people move, relationships change or software support ends.

Once the complete seed has leaked, new shares cannot make it secret again. Set up a new wallet on a fresh, trusted device, transfer every asset and token, and retire the previous wallet for good.

### BIP-39 passphrase: a second recovery secret

A BIP-39 passphrase is an extra string used with the mnemonic to derive an entirely different wallet from the same words. It is not an extra mnemonic word, a wallet PIN or the data key for `seed.enc.json`.

```text
Mnemonic + exact BIP-39 passphrase
    ↓
BIP-39 seed
    ↓
Keys derived under the chosen derivation policy
    ↓
Wallet addresses
```

**BIP-39 has no “wrong passphrase” error.** A typo, changed capitalisation or extra space can produce a valid, usually empty wallet without warning. An empty balance is not a recovery check: compare the derived address against your previously recorded reference.

The mnemonic cannot reconstruct a forgotten passphrase, and support cannot reset it. Treat the passphrase as recovery material with its own backup plan, not something you intend to remember indefinitely.

#### What it protects—and what it does not

A strong passphrase, stored separately, protects against someone obtaining a mnemonic backup alone. That person can still test passphrase guesses offline, without a retry limit. Quotations, personal facts and small variations on familiar passwords are poor choices.

It does not protect against theft of both secrets, malware capturing them during use, malicious transactions you approve, or exposure of the already-derived seed or private keys. Check what wallet exports contain: an export containing spend-capable key material does not acquire another protective layer merely because you originally used a passphrase.

#### Set it up and prove recovery

1. **Check compatibility first.** Confirm that your everyday wallet and your intended recovery tools explicitly support BIP-39 passphrases. An application password field is not evidence of support. Check length and character limits; plain ASCII reduces keyboard and Unicode surprises. Never accept silent truncation.

2. **Generate the passphrase offline.** Use strong randomness rather than inventing a memorable sentence. One practical method is a published 7,776-entry dice-word list: roll a fair die five times, look up that five-digit result, and repeat for at least six independently selected words. Fix the separator, such as one ordinary space, and record the result exactly. Check that the complete string fits every intended recovery tool.

3. **Back up the secrets separately.** Keep 2–3 offline copies of the mnemonic and 2–3 of the passphrase, without storing the two together. Choose sites that would not all be affected by the same fire or flood. For each copy, choose and record physical controls: the locked container, authorised key-holders and retrieval arrangements. Preserve separate locations for Bawa’s `seed.enc.json`, its data key and the offline mnemonic. The passphrase does not replace that separation.

4. **Record a recovery reference.** Use the wallet’s explicit BIP-39 passphrase facility. Record an expected receiving address and the exact derivation policy: coin and network, derivation path, account, receive branch, address index and script/address type where applicable. Keep this metadata available offline. The words and passphrase do not tell every recovery tool which account layout to search.

5. **Rehearse independently before substantial funding.** Use a fresh, trusted machine with clean, verified software; keep secret entry and address derivation offline. Retrieve a mnemonic backup, enter the exact backed-up passphrase and reproduce the recorded derivation settings. Derive the reference address and compare it with the earlier record. Do not depend on the original device, cached secrets or an existing wallet file. Test each intended recovery route independently, including whether it still works when one storage site is unavailable.

If a drill produces an unexpected address, stop. Check the passphrase and derivation settings rather than assuming the wallet is empty. If you have lost the passphrase but a working device can still sign, migrate to a new, tested wallet before that access disappears.

#### Adding it later is a migration

Enabling a passphrase does not alter existing addresses or protect funds already held there. Addresses originally derived with an empty passphrase remain accessible using the mnemonic alone.

Verify the new wallet’s recovery, complete a small receive-and-spend test, then transfer all intended assets to its new addresses. Changing an existing passphrase also creates another wallet; it is not an in-place password change.

For a known mnemonic or seed compromise, do not try to repair the exposed wallet by adding a passphrase. Generate new words on a newly prepared, trusted device, transfer every coin, token and other asset, and permanently stop using the compromised wallet.

#### Cost and when to choose it

Compatible software may provide this feature for £0, with no subscription. The practical costs are offline materials, separate storage, recovery drills and another irreplaceable secret. Moving existing funds also incurs network fees.

Choose it over a paid backup service when your main concern is theft of a mnemonic copy, you want no service dependency, and you can maintain and test separate records yourself. Paid durability or recovery assistance may still be worthwhile; those solve different problems. Check what the fee buys and who can access the secrets. Payment does not make a missing BIP-39 passphrase resettable.

## Free tools: encrypted offline backups

Use encrypted files as a secondary recovery route, not the main backup. Keep the mnemonic offline on paper or metal. Paper costs little but is vulnerable to fire and water; suitable metal withstands more physical damage, but neither conceals the words from someone who finds it. Maintain two or three offline copies across locations that would not be lost in the same fire or flood.

**What encryption protects against:** someone finding or stealing a backup drive without obtaining its strong decryption passphrase.

**What it does not protect against:** malware watching creation or recovery, an attacker acquiring both file and passphrase, destroyed media, or forgotten credentials. A weak passphrase can be guessed offline without an account lockout slowing the attacker down.

### Set it up

The following workflow uses age. A maintained GPG release using symmetric encryption is another option; choose one format and document it rather than adding layers you cannot reliably recover.

1. **Plan storage first.** Keep Bawa’s `seed.enc.json`, its data key and the offline mnemonic in separate locations. An age-encrypted recovery file does not replace Bawa’s data key or change its file format. Record the physical access arrangements for every copy: its safe or locked cabinet, who controls access and how an authorised person retrieves it. Two drives in one drawer share one disaster risk.

2. **Prepare a clean offline session.** Obtain and verify the encryption software before disconnecting. Use trusted equipment, keep networking disconnected and work away from cameras. Prepare a RAM-backed workspace with swap, hibernation and editor autosave disabled. Ordinary deletion, particularly on an SSD or USB drive, is not dependable removal of plaintext.

3. **Create the recovery record.** In that workspace, make `recovery.txt` containing the mnemonic and the information needed to interpret it: mnemonic scheme, network and complete derivation settings. Do not include the wallet derivation passphrase or Bawa data key. Keep non-secret recovery instructions with the primary copies too. Independently record a known wallet address for the later comparison.

4. **Generate a separate file-encryption passphrase.** Use substantial randomness, not a memorable quotation: for example, seven words independently selected with dice from a 7,776-entry word list. Record the result accurately on paper and store it offline, apart from every ciphertext copy. Do not reuse a wallet derivation passphrase or Bawa data key. Record any wallet derivation passphrase separately from the mnemonic backups.

5. **Encrypt locally.** With the working directory on the RAM-backed volume, run:

   ```sh
   age -p -o recovery.age recovery.txt
   ```

   Enter the file-encryption passphrase at the interactive prompt. Never put it in a command argument, script or shell history. The filenames are illustrative; no secret values belong in the instructions.

6. **Move only ciphertext to removable storage.** Copy `recovery.age` to your separated offline drives. Label each with a non-secret identifier and creation date; retain the tool name, version and restore instructions. Disconnect the drives and shut down the temporary environment when finished. Encryption is not permission to place seed material in cloud storage, a note app, a password manager or a photo library.

### Cost and when to choose it

The software costs £0. Removable drives are a modest one-off expense, but replacements, secure storage, travel between locations and recovery practice still cost money or time.

Choose this over a paid encryption product when you can manage offline file handling, maintain separated storage and perform the recovery yourself. Paying for durable offline media or competent support may be worthwhile if it reduces handling mistakes. A subscription or expensive package cannot compensate for missing recovery information.

### Failure modes worth planning for

Flash storage can fail silently; keep independent copies and test them periodically. Encryption may detect damage, but it cannot reconstruct missing bytes. Lost passphrases, truncated files, obsolete software and undocumented derivation settings can all leave intact-looking backups unusable. Rehearse again after changing the recovery procedure.

Re-encrypting a leaked mnemonic does not make that wallet safe again. Create an entirely new wallet on a fresh, trusted device, transfer every asset and token, and stop using the old wallet permanently.

### Recovery drill

Before depositing a meaningful amount, use a fresh, trusted machine running clean, verified software, offline. Retrieve one encrypted copy and its separately stored file passphrase. In a RAM-backed workspace, decrypt it:

```sh
age -d -o recovered.txt recovery.age
```

Recover the mnemonic, apply the exact wallet derivation passphrase—or the recorded absence of one—and reproduce the precise derivation policy: network, address type, path, account and address index. Derive the address and compare every character with the independently recorded address. Successful decryption alone proves too little: a wrong derivation passphrase can produce a valid-looking, unrelated wallet.

Repeat independently for every copy, including the primary paper or metal route, without relying on the working wallet.

**You should see:** the previously recorded address reproduced exactly, without needing the original device.

## Free everyday defences: token approval hygiene

An EVM token approval is a standing permission, not a website session. For ERC-20 tokens, an approved spender can move tokens up to the remaining allowance without another signature from you. An NFT operator approval can cover an entire collection. Disconnecting a site leaves those on-chain permissions in place.

### What this protects against

Removing unnecessary permissions reduces exposure to forgotten, malicious or later-compromised spenders. Check empty addresses too: an allowance may still cover tokens you receive later.

Revocation cannot undo a drain, repair a compromised key or prevent you granting another harmful permission. This is not a general audit of native-coin transfers or smart-wallet permissions.

A hardware signer can protect the key while correctly signing the malicious approval you confirm. It is not a substitute for understanding the permission.

### Free-security checklist

```text
Read permissions
↓
Verify spender and scope
↓
Submit revocations
↓
Check confirmed on-chain state
```

1. **Start with a free, read-only checker.** Reach it through established wallet documentation or the checker’s canonical repository, and verify the domain independently. Avoid adverts and unsolicited “urgent revocation” links. Paste your public address. Obtaining the initial list should require neither a wallet connection nor a signature. Never enter a recovery phrase into a checker.

2. **Check every address and network you have used.** The same EVM address can have entirely different approvals on different chains. Sort newest first, then work through the whole list. Inspect current permissions, not just historical approval events. Check the tool’s network and token-standard coverage; a working balance display or an empty result is not proof that every approval has been examined.

3. **Identify the spender, not merely its label.** Compare the full spender address with the project’s official deployment records for that network. Familiar names and token symbols are not authentication. Revoke unlimited allowances, unrecognised spenders and permissions for services you no longer use. For a recognised ERC-20 service you still need, grant only the amount required for your next action rather than restoring an unlimited allowance.

4. **Connect only when ready to make the changes.** Have enough of the chain’s fee token available. Check the network, token, spender and decoded operation before signing. An ERC-20 revocation normally targets the token contract and sets the selected spender’s allowance to zero. For NFTs, clear the relevant individual approval or collection-wide operator permission. Reject unexpected transfers, fresh allowances or unrelated signatures. Do not blind-sign a transaction merely because the website labels it “Revoke”.

5. **Verify the result after confirmation.** Refresh the current allowance or operator state, using an independent explorer or read-only view where practical. Old approval events remain in history after revocation; their continued presence does not mean the permission remains active. Check that you changed the intended token, spender and chain.

6. **Set a quarterly reminder now.** Repeat across all your addresses and networks, including those without current holdings. Review sooner after unfamiliar applications, suspicious signing requests or a reported spender compromise.

### Failure modes that deserve extra attention

**A checker can miss permissions.** Indexing may be delayed or incomplete, and support for individual NFT approvals, operator permissions and permit systems varies. A balance query is not an approval-history service. Cross-check important holdings rather than treating one dashboard as authoritative.

**Permit2 and signed permits need separate attention.** Permit2 has permissions beneath the token’s allowance to Permit2; inspect both layers. An off-chain permit may remain invisible until somebody submits it. Some unused signatures can establish an allowance again after you clear it. If you signed a suspicious permit, follow the token or permit system’s documented cancellation or nonce-invalidation procedure where supported. A blank scan is not proof that the signature is harmless.

**Submitting is not the same as revoking.** Until the change takes effect, the existing permission remains usable. A spender may transfer first. A failed transaction can consume gas without changing the allowance. Do not wait for the quarterly review when you suspect active misuse.

### Cost, and when to choose free tools

Read-only inspection needs no gas payment. Revoking costs gas in the relevant network’s fee token, and busy networks can make several revocations expensive. Check the fee estimate before signing. Budget time for identifying spenders and checking results. Queries also disclose your public address—and often your IP address—to the service operator.

Choose free checkers and scheduled manual reviews over a paid approval dashboard when you can reliably cover your addresses and chains yourself. Paid monitoring may be worthwhile for demonstrably better coverage, alerts or support when account volume makes manual review unreliable. Check those features rather than trusting the price badge: alerts can arrive after a transfer, and payment cannot recover stolen tokens or make an authorised malicious approval safe.

## Free everyday defences: address poisoning and phishing

An attacker can add a zero-value transfer from a look-alike address to your activity. That entry alone does not give them spending permission; the aim is to influence your next payment.

```text
Look-alike address appears in transaction history
    ↓
It is mistaken for a previous recipient
    ↓
A later payment goes to the attacker
```

Phishing targets trust more directly: sponsored search results lead to cloned sites, and fake recovery services offer help before asking for secrets, money or signatures.

### 1. Prepare recipients outside transaction history

1. Get the current receiving address from the recipient over an independently verified channel, or from a service’s verified receiving page.
2. Save the full address and network in your wallet’s address book, if available. Check the entry before saving.
3. For each payment, copy from that original source or verified entry. Do not reuse addresses from activity lists.
4. After pasting, compare every character against the trusted source. Expand shortened displays and check again at confirmation. The first and last few characters are not enough. Confirm the network too. If you cannot inspect the whole destination before approving, stop.

**Protects against:** poisoned history and look-alike destinations.

**Does not protect against:** a fraudulent source you mistakenly trusted. An incorrectly saved or outdated entry repeats the error. Setup takes a few minutes; checking each payment costs attention, not money.

### 2. Bookmark a verified site, not a search result

Use the project’s canonical repository and established maintainer channels to cross-check the official domain. A similarly named fork is not proof. Inspect the actual hostname: a familiar name buried inside a longer domain does not make it official. Then save the bookmark.

Return through that bookmark, including when looking for support; skip sponsored results and links in unsolicited messages.

**Protects against:** search-ad clones and phishing links.

**Does not protect against:** a compromised official site. Saving a bookmark from a clone preserves the mistake, and HTTPS is not proof of project ownership. Initial verification takes minutes; bookmarks are free.

### 3. Refuse the recovery sales pitch

Close unsolicited recovery conversations. Open verified support through your bookmark instead of using the sender’s link or phone number. Never give an agent a recovery phrase, private key or key file, submit them to a recovery website, or install remote-control software at their request.

Do not pay to “validate” a wallet, or sign messages or transactions sent by a stranger promising recovery.

**Protects against:** a supposed rescue becoming another loss.

**Does not protect against:** earlier losses. Contacting support cannot, by itself, reverse a confirmed transfer. Keep transaction hashes for reporting through verified channels, but keep secrets out of reports. Fees, testimonials and polished branding establish no authority. Rejecting the offer costs nothing; paying does not guarantee recovery.

### 4. Review simulation before signing, where available

Where your wallet offers free transaction simulation, enable it or run it before signing. A static recipient-and-fee summary is not necessarily a simulation. Use the wallet’s own route, not a “checker” linked by a stranger.

Check the network, destination, predicted asset movements and any approval’s spender and allowance. Stop if anything differs from your intention or remains unexplained. For unfamiliar actions, an unavailable or empty preview is a reason to pause, not sign blind.

**Protects against:** unexpected transfers or permissions that the simulation exposes.

**Does not protect against:** every malicious signature, future use of an approval, or changes after the simulated state. Coverage depends on the wallet and simulation provider. “Successful” means the simulated execution completed, not that the recipient is genuine. Disconnecting a site does not cancel existing approvals.

An off-chain simulation uses no network gas; broadcasting the real transaction can still incur network fees. Some providers charge for extras—use included free checks.

### Free versus paid

For routine payments, choose these habits before buying a security subscription: a paid product cannot decide whom you meant to pay. Paid phishing alerts or broader simulation may help with frequent, complex signing, but check their documented coverage. Pay only for an identifiable extra capability you need.

These tools add warnings, not permission to skip address and source checks. A recovery service’s price is not evidence that it can recover anything.

### Free-security checklist

- [ ] Address copied from a verified original source or checked address-book entry, never transaction history.
- [ ] Full destination and network checked after pasting and at confirmation.
- [ ] Site opened through a verified bookmark, not an advert.
- [ ] Available simulation reviewed; no unexplained transfers, approvals or signature requests accepted.
- [ ] No secrets, payments or remote access given to an unsolicited recovery helper.

## Free audit tools, before release

Public source can be inspected; that does not mean it has been audited. An audit has a scope and date, and mistakes can survive it.

Install pinned scanners from verified releases; check available checksums or provenance. Document exact runtimes, commit lockfiles and pin rule revisions. In CI, fetch full Git history and refs, then run these checks on pull requests and release commits without signing or deployment secrets. Require tests and dependency review too. Block findings and tool errors; exceptions need a reason, owner and expiry. Keep these gates even when paying for an audit.

### Secret scanning

Run `gitleaks git --redact --log-opts="--all" .`, then `gitleaks dir --redact .`. Gitleaks flags recognised credential patterns in history and working files, including files later deleted. It can miss mnemonics, xpubs and custom key formats; it cannot undo exposure. Extend default detectors in `.gitleaks.toml`, testing with published non-live fixtures in a throwaway branch. Restrict access to reports.

The CLI has no licence fee; full-history scans cost runner time and triage. Choose free for repository gates; paid coverage can help with organisation-wide integrations and staffed response.

### Package-manager dependency audits

For npm, run `npm ci --ignore-scripts` then `npm audit --audit-level=low`; use your manager’s native equivalent elsewhere. Review required build scripts before permitting them in a separate build/test job. Audit matches versions to published advisories; it cannot rule out unknown flaws or malicious releases, nor establish exploitability. Registry failure is not a clean result. Update deliberately, commit the new lockfile and rerun tests rather than forcing upgrades blindly.

The command has no licence fee, but needs network access and maintenance; registry requests can disclose dependency metadata. Choose free for advisory checks; paid services can help prioritisation and continuous monitoring.

### Pattern scanners with free rules

Commit reviewed, freely licensed rules under `.semgrep/`; run `semgrep scan --config .semgrep/ --error --strict .` with Semgrep Community Edition. Covered patterns can flag unsafe evaluation or weak randomness, not prove derivation, transaction intent or cryptographic correctness. Check supported languages, skipped files and broad suppressions; test coverage with published fixtures.

There is no licence fee, but rule upkeep and false positives cost time. Choose free for a supported stack you can maintain. For wallet-specific logic, commission specialist review rather than expecting another scanner to certify it.

## Free-security checklist for Bawa

These need no subscription, but paper, secure storage and an offline device may cost money. If you lack trustworthy spare hardware, consider a reputable hardware signer.

- [ ] **Generate offline.** Use a verified build from the canonical repository on a clean dedicated device. Disable networking and radios, then generate using the wallet’s secure randomness. Keep it offline. Isolation limits remote theft, not malicious software or physical access; encryption does not protect secrets while decrypted in memory.

- [ ] **Separate watching from signing.** Keep spending secrets off the tracker. Import only public descriptors or account addresses; keep exports private, never in example files. Label networks explicitly. Verify receive addresses and each transaction’s network, destination, amount, fees and contract actions on the trusted signer: an online tracker can lie.

- [ ] **Make 2–3 separated backups.** Keep legible offline seed copies in access-controlled places with independent fire, flood and theft risks. Check them periodically; each copy adds a theft target. Back up required passphrases separately; keep cosigner secrets apart. Do not treat photos, cloud notes or password managers as safe seed storage.

- [ ] **Practise recovery before funding.** Restore a backup on a clean offline signer using only recorded instructions. Compare receiving and change addresses, where applicable, for every intended account/network. Confirm signing with an offline, non-spending test where supported. A “restored” screen is insufficient. Keep any device that handled the seed offline afterwards.

- [ ] **Back up descriptors or policy.** Export public receive/change descriptors with checksums, fingerprints, paths and multisig threshold/key ordering, or the supported policy equivalent. Record chain IDs, script types and recovery roles as applicable. Protect this privacy-sensitive metadata; it does not replace signing keys.

- [ ] **Audit approvals.** On every used chain, inspect token allowances, NFT operators and delegated permissions using explorers linked from official chain documentation. Verify spenders and revoke unnecessary access. Reviewing is free; revocation may require gas. Disconnecting a site does not revoke permissions; on-chain checks miss unused signed permits.

- [ ] **Prepare for compromise.** If signing secrets may have leaked, stop using that wallet. Generate an independent seed on a clean signer and migrate assets and signing roles across affected networks. Revocation cannot repair key theft. Sweeper bots may steal gas top-ups; use documented incident-support routes. Revoke exposed service credentials too.

**You should see:** passing CI, a seed-free tracker, matching restored addresses, separated backups, saved policy, reviewed approvals and a written response plan.

## Paid security — qualified custody (part 1 of 2)

Qualified custody is one way to pay for professional safekeeping rather than manage every signing and recovery task yourself. It replaces some key-management risks with reliance on an institution.

Bawa is a wallet reference project, not a custodian. We do not hold users’ keys. Any custody agreement is with an external provider, not with Bawa.

### What “qualified” means

In the United States, this term usually covers institutions such as banks, trust companies and registered broker-dealers that undergo examination by state or federal regulators. Some registered funds, ETF issuers and fiduciaries may have a legal obligation to appoint a qualified custodian. The applicable rules, assets and contracting entity all matter; have legal advisers confirm the arrangement rather than relying on the label.

Examples include Anchorage Digital Bank, which received its OCC national trust bank charter in January 2021, and the state-chartered trust custody businesses of BitGo and Coinbase Custody, also described as qualified custodians. These are examples, not Bawa recommendations. Check the precise legal entity and its regulatory permissions before signing: a familiar group name is not enough.

### What it protects against

A well-run custody service can reduce dependence on a single device, a household backup or one employee’s knowledge. Protected signing systems, separate approvers, restricted withdrawal destinations and tested recovery procedures can help prevent lost keys and unauthorised transfers.

Those are features to investigate, not guarantees attached to qualified status. Ask what an independent audit actually covered and which controls apply to your account.

In a conventional custody arrangement, the provider operates the signing system. You retain contractual rights and give instructions, but you cannot necessarily move assets without its cooperation. That differs from non-custody, where you retain the key authority needed to transact.

### What remains your risk

Custody does not make the asset itself safer. Price falls, token-issuer problems, blockchain faults and smart-contract failures remain possible. A transfer to the wrong destination may still be irreversible.

There are also custody-specific failure modes:

- **Compromised access or approvals.** A stolen operator account, colluding approvers or an incorrectly configured policy can produce a withdrawal that appears authorised.
- **Loss of availability.** Maintenance, staff-access problems, withdrawal queues, compliance reviews and legal orders can delay or prevent transfers.
- **Provider compromise.** Signing infrastructure and staff can still be attacked. Professional operation reduces some risks; it does not remove them.
- **Financial failure.** The provider may become insolvent or enter a lengthy resolution process. Regulation does not guarantee immediate return of assets.

This is counterparty risk: your ability to recover or move assets depends partly on another organisation remaining solvent, capable and willing to honour its obligations. Review whether holdings are legally separated from the provider’s own property, whether they may be lent or pledged, and what happens if the business fails.

### Who it suits

Qualified custody is most relevant to funds, fiduciaries and businesses with regulatory, audit or governance requirements. A treasury may also value continuity when staff leave and a formal separation between requesting and approving payments.

An individual with substantial holdings may prefer outsourced key recovery, but eligibility thresholds and administrative overhead can make institutional custody unsuitable for an ordinary personal wallet. A retail exchange account is not automatically the same service, even where the same corporate group offers qualified custody.

### Costs and cover — indicative ranges dated 30 October 2026

These figures are a dated guide, not current quotations. **Recheck all pricing, minimums and insurance terms before relying on them.**

Institutional fees are normally negotiated per client, commonly as an annual percentage of assets under custody. Indicative asset-entry thresholds ranged from roughly **US$500,000 to US$10 million-plus**, depending on the provider. That is a balance requirement, not an annual fee estimate.

Obtain a written quote showing the annual rate, any minimum charge, and possible onboarding, transaction, network and exit charges. Ask how asset values are measured for billing. Do not infer an annual bill from the entry threshold.

Across the examples above, headline insurance programme totals were broadly **US$250 million to US$350 million-plus** at that date. These are programme-level claims to check against policy wording, not a promised insured balance for your account:

- Limits are usually shared across clients; other claims may reduce the available cover.
- Cover commonly concerns specified cold-storage theft, external compromise and employee dishonesty.
- Market losses and protocol failures are generally outside that cover.
- Exclusions, deductibles, the insured legal entity and who receives a payout matter.

Crypto holdings in these arrangements are generally outside FDIC and SIPC protection. Any protection available for eligible fiat balances is separate and depends on how that cash is held.

### Onboarding and an exit you can use

Keep the initial process deliberate:

1. **Check the service and contract.** Confirm the contracting entity, supported assets and networks, reporting, liability terms, asset treatment and withdrawal rights.
2. **Complete identity checks securely.** Expect identity, beneficial-ownership, authorised-signatory and source-of-funds checks.
3. **Set operating controls.** Establish strong authentication, separate approval roles, permitted destinations and a recovery process for lost operator access.
4. **Test before the main transfer.** Agree a small deposit and withdrawal test. An ordinary deposit should move assets to a confirmed address, not require handing over your existing Bawa recovery words.

Plan departure before funding. Check notice periods, withdrawal limits, approval delays, termination charges and how statements can be exported. Make sure every asset can leave on a network supported by your intended destination.

Exit will normally mean an on-chain transfer to a fresh self-custody wallet or another custodian, not receiving the provider’s private keys. Test that route while the service is operating normally. Once assets sit at provider-controlled addresses, an old Bawa backup cannot bypass the provider’s withdrawal process.

### Keep recovery material private

Using a custodian does not make Bawa recovery work less sensitive. Keep seed words, private signing keys and their extended forms out of public commits, issues, screenshots and support logs. The same applies to keys used to decrypt recovery data, `.env` files used in production, wallet-backup artefacts and account or service credentials. Use placeholders in examples and redact diagnostic material.

Send vulnerability reports to the repository maintainers through a private reporting route. Keep exploit-enabling details out of public issues.

The following shows a typical shift in signing control, not a safety ranking. Qualified status is a legal designation and does not prescribe a single key architecture.

```text
Self-custody: holder controls signing
    ↓
Collaborative custody: holder and provider share signing authority
    ↓
Qualified custody: provider controls signing; holder requests transfers
```

## Paid security — HSM-based signing (part 2 of 2)

An HSM can make signing keys harder to steal. It cannot make a compromised application trustworthy or turn a mistaken payment into a safe one.

Bawa is reference software, not a custody service. The project does not take possession of users’ keys. HSM signing is one possible security architecture to assess, not an assurance that a deployment is ready to hold production funds.

### Keep the offline/watch-only boundary

Bawa’s trusted, offline side creates the mnemonic, seed, private material and account-level public roots. The online RPC and indexer receive only the public information needed to watch accounts. Treat that online environment as something an attacker might inspect, collect logs from, repeatedly restart or take over. It must not receive seed material, whether or not an HSM is involved.

The generator sends the recovery phrase and data-encryption key to its controlling terminal rather than ordinary subprocess stdout/stderr. That reduces incidental logging; it does not defeat a hostile operating system or terminal, a debugger, crash dumps, swap or memory snapshots. JavaScript and WebAssembly cannot promise that every secret copy has been securely erased. Encrypting saved material also leaves plaintext exposed while a mnemonic is created or recovered.

Importing an existing key into an HSM does not undo those earlier exposures.

### What the hardware buys

A hardware security module is a tamper-resistant device that can create, retain and use cryptographic keys within its own protected boundary. With non-exportable signing keys, the application receives signatures rather than readable key material. Any supported backup or migration mechanism should preserve that protection through encrypted, access-controlled handling.

This reduces opportunities to extract keys from application memory, server disks or stolen equipment. It protects key storage and cryptographic operations inside the device; it is not a claim of invulnerability.

FIPS 140-3 Level 3 is a commonly requested validation level. Check the exact module, firmware and operating configuration covered by a validation. A validated component does not certify the complete wallet, approval service or custody arrangement.

The limits matter:

- **A malicious request can still get signed.** Compromised software may submit a validly formed transaction that benefits an attacker.
- **The device cannot infer the holder’s intended recipient.** Destination, network, asset, amount and fees need independent checking before approval.
- **Wallet functions remain elsewhere.** Account tracking, HD derivation, transaction construction, policy enforcement and broadcasting still need software and operational controls.
- **Hardware-backed does not necessarily mean offline.** An HSM can be network-connected; cold storage is a separate operating choice.

### Who controls the signer?

There are two different arrangements to distinguish.

**Full HSM custody:** a provider operates the key infrastructure and releases transactions under its custody agreement. You depend on its authorisation, recovery and withdrawal processes. Holding an account with that provider is not the same as directly controlling a wallet key.

**Self-custody with HSM signing:** the holder retains control of key material, signing authority and recovery, while an HSM performs the cryptographic work. The device may be owned outright or hosted. Check who can change policy, recover backups, cause a signature or block access; the product label alone does not settle custody.

Anchorage describes its custody service as combining HSMs, biometric checks and multi-person approval, with keys retained in hardware. Its Porto offering is described as institutional self-custody, with clients retaining their own key material. Those are different control models, not interchangeable names for the same service.

Coinbase Custody-style offerings are described around HSM-backed cold storage, geographically separated vaults, biometric controls and recurring SOC 1 and SOC 2 audits. Require advertised controls to be substantiated for the particular service and contract. Audit reports have a defined scope and are not a promise that every withdrawal will be safe or available. Bawa endorses neither provider, and naming them does not imply Bawa compatibility.

This usually fits a business treasury or institutional operator with several accountable staff, audit requirements and a recovery budget. For most individuals, the fees and administration are difficult to justify. An individual can still choose institutional custody, but doing so accepts a custodian as a counterparty rather than merely purchasing stronger hardware.

### Setup and onboarding, in outline

1. **Choose the control model first.** Establish the custody relationship, jurisdiction, identity and company checks, withdrawal timetable and recovery terms. Verify support for the required chains, signing algorithms, HD derivation and account-public-root output. Do not assume an HSM service plugs directly into Bawa.

2. **Hold a documented key ceremony.** This is a witnessed process for establishing the signer: checking equipment and firmware, assigning responsibilities, creating keys inside hardware where supported, recording public identifiers and setting up protected backups. Rehearse recovery. If keys are imported, account for their exposure before import.

3. **Set the quorum.** Define the minimum number of independent people who must approve a payment. Separate transaction requests from approval, and establish distinct rules for policy changes and recovery. Check where those rules are enforced and whether administrators can bypass them. An approval quorum does not necessarily mean on-chain multisignature or cryptographically divided keys.

4. **Test the whole route.** Use an isolated signing-request interface without giving the watch-only runtime secrets. Test independent transaction verification, available allow-lists and spending limits, small-value transfers, unavailable approvers and recovery. Avoid an emergency shortcut that lets one support action remove the quorum.

### Costs and counterparty exposure

Custody is normally negotiated per client, not sold at a standard retail price.

**Illustrative planning ranges in GBP, dated 30 October 2026 — not vendor quotations or live prices:**

| Item | Broad budgeting allowance |
|---|---:|
| Institutional custody onboarding | £0–£50,000 |
| Annual custody service minimum | £10,000–£100,000 |
| Asset-based custody fee, where applicable | 0.05%–0.50% of assets per year |
| A dedicated enterprise network HSM appliance | £10,000–£50,000 per device |

These bands are not market limits. Ask whether an annual minimum offsets asset-based charges or is additional. Redundant equipment, hosted HSM rental, backups, integration, support, staff, external review, withdrawal charges and network fees may be separate.

**Recheck every price before committing**, including taxes, minimum balances and exit fees. Do not use these dated allowances as an offer from any provider.

Full custody adds exposure to provider compromise, withdrawal freezes, insolvency and legal restrictions. Review asset ownership, segregation, insurance exclusions and the treatment of assets if the provider fails. Self-custody avoids handing that same role to a custodian, but hosted infrastructure, firmware suppliers and recovery services can still become dependencies.

### Failure modes to plan for

- **A quorum member is lost or unavailable.** If the remaining members can still satisfy the policy, replace the missing member through the approved administration process. Otherwise, use the pre-agreed recovery procedure. Without a viable recovery route, signing may remain blocked; disabling approvals is not a sound recovery plan.

- **Vendor firmware is faulty or vulnerable.** Signing may stop, or confidence in key isolation may be lost. Have staged update procedures, tested compatible recovery capacity and a supported remediation route. Pause signing when integrity is uncertain rather than exporting plaintext keys into an application as a workaround.

- **A request is approved by mistake.** Enough people can approve the wrong destination, and the HSM can correctly sign it. Independent checks and limits reduce this risk; they do not remove it. Once a transaction has been broadcast and settled, the device provides no reversal mechanism.

### Agree the exit before depositing funds

Get withdrawal conditions, fees, timescales and data-export arrangements in writing. Do not assume a non-exportable key can become a mnemonic, or that an encrypted HSM backup will work with another vendor.

Plan to **re-key when leaving**: establish fresh keys under the new security boundary, verify the receiving addresses independently and transfer balances while the old provider and quorum are still available. Update deposit addresses and watch-only public roots, retain transaction and approval records, then revoke obsolete service access.

Supported wrapped-key migration may be useful, but reusing a key can preserve dependence on anyone holding an old recovery copy. Fresh keys and an on-chain transfer provide a clearer separation.

An external security review of the complete design is required before treating a Bawa-based deployment as production custody infrastructure. Buying certified hardware does not replace that review.

```text
Signing request
      ↓
Quorum approval
      ↓
HSM signature
      ↓
Broadcast
```

## Paid security — institutional MPC platforms (part 1 of 2)

Institutional MPC platforms suit teams that need shared control over funds, approval records and spending rules. They can make sense for business treasuries, funds and exchanges. For an individual, the expense and operational work are often difficult to justify against a well-managed hardware wallet and tested backups.

Bawa provides no custody service and keeps none of your keys. The providers mentioned here illustrate this category; they are not Bawa recommendations.

### What MPC buys you

Multi-party computation (MPC) lets several participants produce a signature using separate secret shares. A threshold determines how many must cooperate: a two-of-three arrangement, for example, requires two participants.

During routine signing, the complete private key is not reconstructed on a device or server. The resulting signature looks like a conventional single-key signature to the blockchain. There is no on-chain multisig structure to identify, and MPC itself adds no multisig fee overhead. Network fees and platform charges still apply.

A typical managed signing path looks like this:

```text
Signing request
        ↓
Policy check
        ↓
Joint threshold signature
        ↓
Broadcast
```

The main benefit is resistance to a single compromised device or dishonest operator — **provided that they cannot obtain enough shares to sign**. Separate shares offer little independence if one administrator, cloud account or recovery credential controls them all.

Policy checks are another layer, not part of the blockchain’s rules. They can restrict destinations and amounts or require additional approvals. They cannot make an approved malicious transfer safe.

### What it does not solve

MPC does not remove the risk of:

- enough share holders colluding or being compromised;
- approvers accepting a fraudulent payment or harmful contract interaction;
- an administrator weakening policies or replacing participants;
- defective signing software, poor randomness during share creation, or a compromised update;
- lost shares, unreadable backups or unavailable recovery participants;
- smart-contract faults, chain failures or provider outages.

The share-generation ceremony and recovery process deserve as much scrutiny as everyday signing. Some recovery designs rebuild a complete private key: that creates a single-key exposure which the normal MPC workflow avoids.

### Platforms, custody and actual control

Fireblocks advertises MPC signing alongside approval workflows, spending controls, approved-destination lists and transaction simulation. Check which controls are available and enforced for your chosen networks and contract.

Fireblocks is principally an infrastructure offering. Buying that infrastructure does not, by itself, mean appointing a qualified custodian. Regulated custody may be supplied through a related entity or an integrated provider; establish exactly which legal entity is responsible.

Copper markets MPC custody together with off-exchange settlement. Keeping trading collateral away from an exchange may reduce one exposure, but it introduces dependence on the custody and settlement arrangements. It does not eliminate counterparty risk.

For any platform, obtain a written **share-and-control map**:

- Who holds each share, including backups and shares held by subcontractors?
- How many usable shares are required, and who can restore or replace them?
- Can the provider reach that threshold without your participation?
- Can you reach it without the provider’s servers, login system or support team?

If the provider controls a signing quorum, it can authorise movement without your shares. If it controls less than a quorum, it may still be essential to availability. Neither “MPC” nor “non-custodial” proves that you have an independent exit.

Legal custody is a separate question. Check ownership of the assets, segregation of client holdings, withdrawal restrictions and your rights in insolvency.

### Setup and onboarding

Expect business identity checks, contractual due diligence and a technical review before funding. In outline:

1. Confirm supported networks, assets, signing operations and any required HD derivation behaviour.
2. Agree the share layout, independent administrative roles and recovery responsibilities.
3. Complete share generation on approved devices and arrange protected, separately controlled backups.
4. Configure payment policies and test both permitted and rejected requests.
5. Exercise recovery with a small balance before increasing exposure.

A platform’s share backup is not necessarily a BIP-39 recovery phrase or something Bawa can import. Establish compatibility rather than assuming that all wallet backups are interchangeable.

### Cost model

**Indicative ranges dated 30 October 2026 — not current quotations. Recheck every price and term before purchasing.**

For Fireblocks, a broad budgeting envelope was approximately **US$1,000–US$5,000+ per month equivalent**, spanning entry pricing, annual-plan equivalents and enterprise estimates. These were not like-for-like packages:

- The low end reflected an Essentials offer lasting no more than six months, not an indefinite running cost.
- Custom pricing was expressed annually; do not assume monthly cancellation.
- Enterprise estimates were open-ended, so the upper figure was not a ceiling.

Indicative asset-linked estimates ranged from **3–30 basis points (0.03–0.30%)** of assets under custody. Treat that as a possible charging model, not a confirmed universal Fireblocks fee. Establish the billing period, valuation basis and whether it is additional to the subscription.

Ask which onboarding, support, recovery, extra-user and exit charges are included. Network fees remain separate unless the contract explicitly covers them.

### Counterparty failure and a provable exit

A provider can fail financially, suspend an account or lose a critical service without anyone stealing a share. Insurance is not a substitute for recovery: verify the insured entity, covered events, exclusions, deductibles and whether a limit is shared across customers. A headline amount does not establish cover for your balance.

Before committing substantial funds, require an exit plan that works under an abrupt shutdown:

- **Have the recovery materials already.** Identify the necessary shares or independent recovery participants, decryption access, software, documentation and licences. A promise to supply them after a shutdown is weak protection.
- **Test without the provider.** Using a small test balance and the documented fallback, produce a valid transaction while the provider’s signing and authentication services are unavailable. Broadcast through independent chain access. Record the result without recording secrets.
- **Know the migration route.** Confirm whether supported export preserves existing addresses or whether funds must be transferred to a fresh wallet. Check every relevant asset and network, including gas requirements and restrictions on staked or contract-controlled positions.
- **Repeat the drill after material changes.** Share replacement, software upgrades and staff departures can invalidate an earlier test.

Do not count “we have backup files” as proof that you can still sign. Without a demonstrated independent quorum and usable recovery tooling, a shutdown may leave you dependent on a recovery agent, an insolvency process — or unable to spend at all.

## Paid security — multisig-as-a-service (part 2 of 2, first half)

You pay a provider to run signing infrastructure, approval checks and support. This can remove a single point of failure—or move it into someone else’s organisation.

An M-of-N multisig wallet needs signatures from at least M of its N independent keys: a signing quorum. The chain’s script or account logic checks that rule. Each signer holds its own complete private key, unlike an MPC participant’s share. The multisig rule is visible on chain, sometimes only when funds are spent. Supported chains and transaction costs differ.

```text
On-chain multisig
[Separate complete private keys]
    ↓
[M individual signatures]
    ↓
[Chain enforces M-of-N; policy visible]

MPC
[Key shares across participants]
    ↓
[Threshold policy enforced off chain]
    ↓
[One ordinary signature on chain]
```

### Protection and limits

With a threshold above one and genuinely separate signers, one stolen key, compromised device or dishonest employee cannot spend alone. Losing a key need not strand funds if enough other keys remain. Provider checks may offer another chance to catch a bad payment.

A valid quorum can still authorise theft, a mistaken address or a harmful contract interaction. Multisig does not fix chain bugs or investment losses. Different HD paths under one seed are not independent protection: whoever steals that seed can derive all those keys.

For an individual, the holdings and threat model need to justify the fees and recovery work. Self-managed multisig avoids the service dependency but leaves that work with you. Businesses may value separated staff roles, spending limits and audit records. Neither should assume “managed” means maintenance-free.

### Custody: count the keys

Consider two illustrative 2-of-3 arrangements:

- **Non-custodial:** you control one working key and a separate offline recovery key; the provider controls one key. It cannot spend alone. Your two keys can spend without it.
- **Custodial:** the provider controls two keys and you control one. It can spend without you; you cannot spend without it.

Do not infer this allocation from a product name. Check affiliates, subcontractors and retained backup copies too. Other arrangements can leave a provider unable to spend alone but essential to every usable quorum: it cannot take funds unilaterally, yet it can block access.

Two employee approvals in a portal do not necessarily represent two independently controlled signing keys.

### Onboarding and counterparty checks

Before funding, confirm the exact chain, asset, threshold and key holders. Expect identity checks and, where required, business and authorised-signatory checks. Agree signing delays, transaction limits, recovery responsibilities and exit terms.

Generate user-controlled keys independently, keep recovery secrets offline and out of this repository, and start with a small test balance. Each signer should verify the payment independently rather than merely approve a notification.

Provider outages, compliance freezes, insolvency and changed terms can interrupt service. With custody, contractual withdrawal rights are not equivalent to possessing a signing quorum.

### Cost snapshot — 30 October 2026

BitGo is a commercial example, not a Bawa recommendation. It markets multisig and MPC wallets, qualified-custody services, and products for settlement and staking. Check the agreement for the particular service; these are not interchangeable arrangements.

Indicative BitGo custody pricing for this dated snapshot was approximately **0.05–0.15% a year of assets under custody**, with client-specific negotiations and minimum thresholds. This was a budgeting range, not a quote for every wallet product. **Recheck prices and minimums before committing.** Ask whether the quotation includes subscriptions, setup, recovery and exit charges, and allow separately for chain fees.

An insurance headline of **up to US$250m** for BitGo is a claim to verify, not a promise to reimburse every wallet. Check who is insured, which losses qualify, exclusions and whether limits are shared.

### Make the exit real

Retain the wallet descriptor or equivalent configuration, including the threshold, all co-signers’ public keys or extended public keys, derivation paths, script or account settings, and network. Protect this metadata: it can reveal addresses and balances. It does not replace secret-key backups.

For a provider-independent arrangement, rehearse recovery before depositing substantial funds. Using independent tooling and your own quorum, restore access and broadcast a small spend without the provider’s interface, API or signature. Seeing a balance or exporting a file is not proof that you can sign. Repeat the check after signer changes.

If the provider shuts down, an independent quorum can move funds to a replacement wallet or authorise a supported policy change. Budget for the relevant network fees. Custodial users should test withdrawals while the service is operating; without an independent quorum, shutdown may leave funds inaccessible or tied up in insolvency proceedings.

Watch for lost recovery keys, stale configurations, incompatible recovery software, shared cloud backups and departing staff. A recovery promise is not a substitute for a rehearsal.

### Paid security — consumer MPC wallets (2/2)

Consumer MPC can make everyday use and recovery less awkward, but it adds a service dependency. Signing power is split into shares. During normal signing, the parties jointly create one ordinary on-chain signature without putting the whole private key together. This is a different product from institutional MPC and its business approval arrangements.

#### Check control, not the label

Start with who holds each share and how many are needed:

- **2-of-2:** one share on your device and one on the provider’s server; both must participate. Assuming recovery preserves that separation, the provider cannot spend alone — but neither can you.
- **2-of-3:** any two of three distinct shares suffice. Two genuinely user-controlled shares may permit independent recovery; two provider-controlled shares permit provider-only spending. Find out who controls the third share rather than assuming it is yours.

A backup copy of a share is not an extra vote.

Inspect recovery too. Can a provider-controlled reset replace your share or give the provider enough authority to spend? If it can move funds without you, treat that as custodial control. If it cannot, it may still refuse to co-sign or make recovery conditional. “Non-custodial” does not mean independent of a company.

#### What the split protects

A stolen share alone should be insufficient to spend. That reduces exposure from a single secret leak, provided the shares and recovery credentials are properly separated.

MPC itself does not check whether a payment is sensible. Phishing, malicious token approvals, fake apps, compromised transaction displays and contract bugs still matter. A compromised phone may request a valid server co-signature through an active session; the attacker need not steal both shares.

Nor does MPC make transactions reversible or hide account information and activity already visible to the provider. Protocol and implementation faults remain possible.

#### Who it suits, and getting started

These wallets can suit individuals who value guided recovery and accept provider availability, privacy and policy risks. Paying for a tier does not itself strengthen the signing threshold.

For a business, server participation is not a second staff approval. Require demonstrable approval rules, separation of duties, audit records and succession arrangements. Do not assume a consumer plan supplies institutional controls.

In outline: verify the app, check supported networks and recovery conditions, create a fresh wallet, secure the account with phishing-resistant authentication where available, and save the required recovery material. Avoid keeping every recovery route dependent on the same phone or login. Rehearse recovery with a small balance before committing more.

#### Cost checkpoint

**Illustrative planning ranges dated 30 October 2026, not current pricing:** £0–£25/month or £0–£300/year for access and optional consumer features. These are budgeting allowances, not quoted tariffs or a market-wide ceiling.

Access may be free, subscription-funded or subsidised through transaction charges. Allow separately for network fees, swap spreads, fiat-purchase fees and any recovery or export charges.

**Recheck before paying:** confirm the actual plan price, taxes, transaction charges, recovery terms and cancellation conditions directly. A subscription is not insurance against loss or closure.

#### Prove the way out

Before depositing a substantial amount, establish what survives a shutdown. In strict 2-of-2, losing the provider’s share or a required recovery service can strand the wallet indefinitely. Never having assembled the complete key does not solve that dependency.

An independent exit needs enough usable shares without the provider, or a key export you can decrypt locally, together with software that works independently. An export button requiring provider approval is only an exit while the service cooperates.

Test the shutdown case on a fresh, low-value wallet:

1. Save the necessary recovery material, instructions and independently runnable software.
2. On a clean, trusted spare device, block provider connections and recover using that saved material, without provider login or approval.
3. Confirm the expected address, sign a newly created small transfer and broadcast through an independent node or service.

A successful provider-assisted restore is not this test. Check the account types and networks you intend to use; success on one does not establish support for all.

An MPC recovery bundle is not automatically compatible with an HD-wallet seed import. Where formats are incompatible, migrate by transferring assets to a new, independently controlled wallet while signing still works. Inventory tokens, NFTs and contract positions: moving the main coin alone is not a complete migration.

Recovering a complete private key changes the security model. Protect it accordingly and consider moving to fresh keys.

#### Failure modes to plan for

Lost phones combined with inaccessible backups, stolen recovery accounts, forgotten backup passwords and unsupported software can cause loss or lockout. Provider outages, account suspensions, insolvency and changes to regional or network support can interrupt access or force an early exit.

Keep independent recovery usable, not merely stored. Repeat the small-value exit test after recovery changes. If no independent route exists, continued provider operation is a condition of holding funds there — include that dependency in the buying decision.

## Paid security, part 3 — Casa-style collaborative custody

Casa is an example of this model, not a Bawa-endorsed provider. You are paying for help managing keys, not a guarantee against loss.

### What the arrangement changes

In the usual **2-of-3** arrangement, **you hold two independent keys; the provider holds one**. Spending requires two signatures. The provider cannot move funds alone. Your own pair can authorise spending without it, provided you have the vault configuration and compatible recovery tools.

A full custodian instead controls enough keys to spend without you. Collaborative custody preserves non-custodial spending control, but that does not remove every dependency on the service.

One missing or failed signing device need not mean lost funds: your remaining key and the provider’s key can sign together. Paid assistance commonly adds onboarding, key checks and recovery guidance. Two copies of one seed are not independent keys; separation must withstand theft or fire.

Two compromised keys defeat the threshold—including one of yours plus the provider’s. The arrangement cannot make an approved scam payment or harmful contract permission safe, or prevent coercion.

### Who should consider it?

Individuals need holdings that justify an ongoing bill and a willingness to practise recovery. Families need capable heirs, not just extra hardware. Businesses need assigned signers, approval rules and staff-exit procedures; a personal vault does not replace company controls.

### Setup, before funding

- Check assets, networks and compatibility. Casa advertises vault support for BTC, ETH, USDT and USDC; do not assume every token deployment or Bawa-based wallet will work.
- During guided onboarding, map keys, devices and backup locations. For larger vaults, establish who holds every key and whether your own keys meet the signing threshold without the provider.
- **Test recovery on an empty vault before funding it**, including a route that does not require a reachable provider. Afterwards, try a small receive-and-spend cycle before transferring the main balance.
- Write each recovery record offline and keep **two or three physically separated copies**. Never gather enough seed backups to meet the spending threshold in one place. Never digitise a mnemonic or share it with ‘support’.

A compromised seed cannot be reset. Generate a new wallet on a fresh, trusted device, move **every asset and token**, then retire the old wallet permanently.

### Budget and inheritance

These **USD/year ranges, dated 30 October 2026**, are rounded budgeting bands for Casa’s advertised plans, **not current quotations**.

| Plan | Annual budgeting range | Advertised offering |
|---|---:|---|
| Standard | $200–$300 | Three keys, two signatures; email help and an emergency lockdown option |
| Premium | $2,000–$2,500 | Five keys, three signatures; hardware supplied and individual onboarding |
| Private Client | $7,000–$8,000 | Up to six keys; an assigned adviser |
| Business | $2,500–$3,000 entry band | Starting-price band only; obtain a quotation for the required scope |

**Recheck prices and terms before paying.** Confirm hardware coverage, replacement costs, tax and transaction fees. Advertised features are not guarantees from Bawa; ask what a lockdown actually blocks.

Casa described inheritance across all plans: the named recipient’s key starts inactive. A claim begins a six-month period of checking for holder inactivity, with notifications sent to the holder. An heir who cannot operate the hardware needs teaching and a rehearsal; nomination alone is not a recovery plan or a substitute for estate planning.

### Provider failure and exit

A lapsed subscription may interrupt support or provider signing. Get written terms for app access, recovery and inheritance; do not assume unpaid service continues.

Closure may leave the provider’s key unreachable. Acquisition may change who holds it, service terms or data handling. Neither makes that single key sufficient to spend. But in a 2-of-3 vault, losing access to one of your keys as well leaves you below the threshold.

Before committing, obtain the recovery configuration needed alongside your keys: relevant public keys and derivation paths, wallet descriptors, or contract and network details. A seed alone may not rebuild the vault. Verify provider-independent recovery rather than relying on a promise of future access.

Your keys should already be under your control; leaving must not require their release by the provider. For 2-of-3, use your own pair through verified compatible tools to transfer all holdings to a new wallet you control. Check receipt, update backups and inheritance instructions, then cancel.

# Paid security, part 3 — Unchained-style collaborative custody with financial services

Collaborative custody buys help with key management and recovery, not a guarantee against loss. Unchained is an example to evaluate, not a Bawa recommendation.

## Who holds the keys?

In the usual **2-of-3 Bitcoin vault**, there are three keys: **you hold two; the provider holds one**. A spend requires signatures from two of them. The provider cannot spend alone; you can normally use your own pair without it.

Unlike full custody, this does not give the provider enough keys to spend without you. “Non-custodial” does not mean free of counterparty risk.

Paid support can include guided onboarding, key-health checks and recovery assistance; confirm what is included. If you lose one key, your remaining key plus the provider’s can move funds to a replacement wallet. They cannot recreate the missing secret.

A thief with one key cannot spend alone. But the arrangement does not protect against two compromised keys, backups destroyed together, or authorising a fraudulent payment with two signatures. A co-signature is not proof that a payment is legitimate. Keep keys and backups genuinely separate. There is no protection against Bitcoin’s price falling.

## Who is it for?

- **Individuals:** a fit for holders who can maintain two keys but want guided checks and recovery. Small holdings may not justify recurring fees.
- **Families:** potentially helpful for inheritance, provided heirs can actually use the recovery route. An heir who cannot operate hardware needs a rehearsed, legally workable handover and trusted assistance; a folder of instructions is not enough. The provider’s one key cannot compensate for losing access to both family keys.
- **Businesses:** assess signing authority, staff succession and audit requirements. One employee holding both holder keys can spend alone; multisig does not automatically enforce two-person approval.

## Setup: prove recovery before funding

Agree eligibility, identity checks, signing procedures and renewal terms first. Generate the holder keys privately on suitable hardware, with separate backups. Guided onboarding should not require handing either seed backup to the provider.

Save an independent copy of the wallet configuration: all three extended public keys, derivation paths and script details, ideally as a complete, supported wallet descriptor. Your two keys are not a substitute for this record. Treat it as privacy-sensitive.

**Before funding**, test key restoration on trusted hardware and rebuild the empty vault from your saved configuration in compatible independent software. Rehearse the one-key-loss recovery process with the provider. Then make a small test deposit and prove a spend using only your two keys, without the provider, before adding substantial funds.

## Fees and financial products

**Indicative budgeting ranges dated 30 October 2026:** basic vault service roughly **US$200–US$400 per vault per year**; fuller inheritance planning roughly **US$2,000–US$4,000 per year**. These are not current quotations. Recheck prices, inclusions and renewal terms. Ask separately about hardware, recovery and network charges, plus loan interest and account administration.

Unchained advertises inheritance arrangements alongside its collaborative Bitcoin vaults, plus loans and retirement-account products for US users. Its offering is US-focused and involves identity checks. Do not assume every product uses the same custody arrangement. Check who controls loan collateral, liquidation rights, and any retirement-account custodian or withdrawal restrictions separately.

## Failure, counterparty risk and exit

A provider closing, being acquired or becoming unreachable can remove support and access to its signature. An acquisition can also change fees and data handling. With both holder keys and the saved configuration, you should still be able to spend using compatible independent tools. If one holder key is already lost and the provider’s key becomes unreachable, the remaining key cannot spend.

A **lapsed vault subscription** does not alter the existing on-chain signing threshold, but assistance or co-signing may stop. Get grace periods and key-retention policies in writing; do not assume a dormant account guarantees recovery.

To leave, retain your two keys and configuration. Load the vault’s public configuration into compatible independent software, verify a destination in a new wallet without the old provider, and sign the transfer with your own hardware. You need the provider’s public-key information, not its private key. Confirm receipt before cancelling. Moving funds removes the old provider’s role; ending a subscription does not change the old vault’s keys.

## Paid security, part 3 — assisted multisig with inheritance

With assisted multisig, you pay for help with a wallet that needs several keys to spend. An inheritance option usually adds a procedure for recognising beneficiaries and assisting their recovery. It is not a will, an automatic death detector or a payout guarantee.

### Who controls the money?

Consider this illustrative **Bitcoin 2-of-3** arrangement:

- **You control A and B:** two independent signing keys, stored separately.
- **The provider controls C:** one signing key.
- **Heirs initially control no key.** Your estate arrangements give an authorised successor access to B. The provider may then co-sign with C after checking their claim.

Any two keys authorise spending. You can use A+B without permission; the provider cannot spend with C alone. For inheritance without the provider, the estate needs a route to recover **both A and B**.

This is non-custodial in the practical sense only if the service cannot also recover A or B and independent spending actually works. In a different 2-of-3 arrangement where you hold one key and the provider holds two, the provider can spend alone: that is custody-level control. Backup copies confer access to existing keys, not additional votes.

### Protection, not magic

Separating keys can contain one lost device or stolen seed. A rehearsed handover helps prevent heirs receiving secrets without knowing which wallets or accounts they belong to.

It cannot repair the permanent loss of two keys or stop two key holders colluding. Whoever controls B can spend with C while you are alive: estate paperwork is not an on-chain restriction. Nor is this insurance against scams, coercion, signing mistakes or inheritance disputes.

The service may learn identities, balances and beneficiary details. Check supported networks and account types; inheritance cover need not include every asset.

### Who it suits

Individuals may value help without surrendering independent spending. Families need an agreed handover and a capable successor or trusted helper. Businesses need defined signing roles, replacements and approval controls; an owner’s personal inheritance package is not a corporate continuity plan.

DIY coordination through software such as Sparrow or Specter avoids service subscriptions, but supplies neither a staff-held key nor a concierge or ready-made succession scheme. Hardware, transaction fees and the work of arranging inheritance remain yours.

### Set up, then rehearse

1. Confirm the threshold, every key holder, supported hardware and networks, claim evidence, waiting periods and charges. Decide who inherits and how access is released.
2. Create A and B from independent seeds on your signing devices. Separate their backups. Save the wallet descriptor or configuration, including co-signers’ extended public keys, address type and derivation paths, alongside an inventory of chains and accounts. Seeds alone may not reconstruct multisig. Keep secrets out of documents that could become public.
3. **Before funding**, rehearse restoring backups on suitable signing hardware and rebuilding the wallet in an independent coordinator. Check addresses on-device. Practise holder-only signing using a separate test wallet and test coins. Never send seeds or passphrases to staff.
4. Rehearse the heir’s tasks, document contacts and review after family or signer changes. Share only what each person needs.

### Costs

**Illustrative budgeting ranges dated 30 October 2026—not current offers:** allow roughly **US$200–3,000 per year** for personal/family subscriptions and **US$3,000–10,000 per year** for higher-touch arrangements. Bespoke business work may exceed these bands.

Devices, onboarding, claim handling and network fees may be additional. Recheck written prices, renewal and cancellation terms, and whether the quoted tier actually includes inheritance rather than multisig alone.

### Failure and exit

A missed renewal may end co-signing or inheritance handling, or trigger key deletion under the contract. It does not change the signing threshold. Check grace and retention periods.

An heir unable to operate hardware needs a rehearsed route involving a capable helper or executor—not instructions to surrender every secret to support.

If C becomes unreachable, A+B still spend. An heir with only B is stuck until A is recovered or C returns. Closure or acquisition can disrupt records or change fees, claim procedures and data handling. Keep the recovery pack outside the service.

To leave, use that configuration in a compatible independent coordinator and sign with A+B; you do not need C. Deleting your service account cannot remove C from existing coins. Test a small transfer to a fresh wallet with new keys, verify that you can spend from it, then move the remainder. Update succession records before cancelling.

## Paid security, part 3 — estate wrappers and the inheritance-plan checklist

A trust puts a trustee in charge of assets for beneficiaries. A company wrapper, such as a limited-liability company (LLC) where recognised, holds assets under corporate ownership and succession rules. Lawyer-drafted documents set out who may act after death or incapacity. Properly established and funded, these arrangements can reduce disputes and sometimes probate delays, subject to local law.

**Legal authority is not signing power.** Without enough working keys to meet the spending threshold, the documents cannot move funds. They cannot recover lost passphrases or prevent stolen keys being used. An heir with a seed but no chain/account map, or one multisig key, may still be stranded. Tax savings and creditor protection are not guaranteed.

### Who they suit

Individuals with straightforward estates may need clear instructions and a solicitor rather than a wrapper. Families may need trustees, provisions for minors or staged distributions. Businesses need continuity of authorised signers and separation of company and personal assets. Confirm that ownership and signing arrangements match the legal paperwork.

### Count the keys

For a chain supporting **2-of-3 multisig** — two distinct keys must sign — compare:

- **Non-custodial example:** holder two keys; independent executor one; provider zero.
- **Shared control:** holder one; independent executor one; provider one. Holder and executor can spend without the provider; provider and executor could also collude.
- **Custodial example:** provider two; holder one; executor zero. Provider can spend alone; holder cannot.

Count independent signing keys, not seed copies. Get the actual key map in writing; count provider-controlled affiliates as part of the provider. Legal appointment does not automatically give an executor access to the holder’s keys. Require recoverable keys and portable wallet data, not just an account login.

### Onboard, then rehearse

Agree beneficiaries, jurisdiction, death/incapacity evidence, responsibilities and fees; expect identity checks and legal onboarding. Match each chain’s wallet policy to supported hardware. Keep private, provider-independent records of chains/networks, accounts, derivation paths, scripts/descriptors and any passphrase requirement. Public keys and descriptors can expose holdings.

Keep a **seed-free letter of instruction separate from the potentially public will**. It should locate the vault and recovery instructions and explain authorised access, without containing seeds or passphrases.

**Before funding**, have the intended successor rehearse restoration and spending on a test network with disposable keys. Verify actual backups and addresses locally on trusted devices; then test a small live amount before committing the balance.

### Budget beyond setup

Illustrative planning assumptions dated **30 October 2026**, not quotations: legal setup £1,000–£10,000; support £100–£2,000 a year; professional trustee/company administration £1,000–£10,000 a year. For asset-based custody or trustee fees, model 0.25%–2% annually pending a quote. These are not guaranteed limits; charges may stack. Recheck written quotes, minimums, taxes, hardware, transaction costs and exit charges before paying.

### Failure and departure

A lapsed subscription may suspend signing, support or inheritance administration without changing the on-chain policy. Get cancellation terms in writing. Closure may leave the provider’s key unreachable; acquisition can change fees, access procedures and data handling. Recovery must not depend solely on its portal.

If an heir cannot operate hardware, arrange a competent helper without giving that helper unilateral control. Where independent spending is possible, rehearse provider-free recovery using an alternative compatible wallet.

With non-custodial/shared control, retain keys and wallet data, assemble the non-provider quorum and transfer to a verified wallet with fresh keys. Exporting keys alone neither moves funds nor revokes old copies. With custody, exit normally requires an authorised withdrawal, not delivery of the provider’s keys. Test withdrawal while available; legal claims cannot manufacture missing signatures.

### Test your plan privately

Answer without sharing seeds, passphrases or recovery files:

- Can the executor find instructions and obtain lawful access?
- Can a quorum survive my death and an unreachable provider?
- Are required passphrases recoverable through an authorised route?
- Can the successor identify every chain/account and operate recovery tools?
- Have recovery and exit actually been rehearsed?
- What stops working if payments lapse?
- Who reviews the plan after family, legal or service changes?

## Paid security, part 4 — insurance-backed custody (first half)

An insurance badge is not a promise to replace your balance. Keep three questions separate: who can sign, which losses qualify, and who receives any payout. These service models are not Bawa recommendations. Opening an insured account does not automatically protect a Bawa wallet you retain yourself.

### 1. Custodian-held crime/specie cover

The custodian controls signing and usually holds the insurance policy. Commercial crime insurance addresses specified criminal losses; specie insurance concerns valuable property. Placement may involve Lloyd’s syndicates, but establish which insurers actually bear the risk.

Depending on the wording, protection may include theft involving designated offline signing systems, physical destruction of insured key equipment, and dishonest employees. It mainly suits business treasuries, funds and larger individual holdings that meet the provider’s minimums—not ordinary self-custody.

Onboarding generally involves identity or business checks, evidence of funds’ origin, supported-asset checks, withdrawal permissions and a small test deposit. Obtain the insurance terms before moving the main balance. You should transfer assets, not hand over your existing Bawa seed.

Advertised programme limits run from tens to hundreds of millions of US dollars; recheck the policy schedule. These figures usually describe a pot shared across customers, not an allowance reserved for each account.

### 2. Coincover-style protected wallet and key recovery

This is a narrower model combining transaction-risk screening, stored backup-key material and insurance-backed protection. Recovery may restore access after a key is lost; it cannot reverse a completed payment. Passing the screening checks is not, by itself, a promise of reimbursement.

Individuals need a supported wallet and an eligible protection plan. Businesses may integrate these services into their own wallet offering. The compensation promise may come from the provider, backed by its insurance, rather than from a policy held in your name.

Setup means confirming supported assets and transaction routes, completing any identity checks, enrolling the relevant wallets, selecting limits and testing the documented recovery process. Ask whether bypassing screening, ignoring warnings or using an unsupported route removes protection.

Backup storage does not necessarily make a service custodial. Ask who holds each key or share, whether anyone can reconstruct signing authority alone, and whether recovery depends on the provider remaining available. A custodial wallet partner adds withdrawal-freeze and insolvency risks.

### Covered or not?

“Possible” below means expressly included in the applicable terms—not guaranteed.

| Scenario | Custodian policy | Protected wallet/recovery |
|---|---|---|
| Theft involving enrolled offline keys | Possible within the insured systems | Only if that theft meets the plan’s definition |
| Custodian’s key hardware destroyed | Possible for a defined insured loss | Recovery service is not automatically cash compensation |
| Account-holder phishing, wrong address or an authorised scam payment | Usually excluded | Usually excluded; screening is no guarantee |
| Falling prices, contract exploits or protocol failures | Usually excluded | Usually excluded |
| Loss from an unenrolled personal wallet or a seed you disclosed | Outside the custody programme | No automatic protection |

Insider dishonesty may qualify under a custodian’s crime cover, but do not assume every employee action or business failure is insured.

### Questions before paying—both models

Request the relevant policy wording, schedule and customer protection contract. Ask:

- Whose legal name is on the policy? Are you a named insured, a beneficiary, or merely relying on the provider’s contractual promise?
- What event and evidence trigger a claim? Who submits it, and who receives payment?
- What are the per-occurrence limit, shared aggregate limit and excess? Are particular assets or storage systems subject to smaller limits?
- How is the loss valued, and what notification deadlines apply?
- Is the advertised protection actually in force for your account?

Identify the insurer, broker, custodian and recovery provider where applicable. An insurer can dispute liability or become insolvent. A broker can misdescribe protection or fail to arrange the promised cover; its sales assurance is not a substitute for binding terms. A custodian can suspend withdrawals or collapse, potentially leaving insurance proceeds caught in its insolvency process. A backup provider can lose material, become unavailable or release it to an impostor.

Two failures deserve particular attention: an authorised scam payment can produce a denied claim because an exclusion applies; another client’s major loss can consume a shared aggregate before your claim is settled. Ask how competing claims are allocated and whether limits are reinstated. Neither model is a general insolvency guarantee.

### Cost models — budget illustrations dated 30 October 2026

Insurance may be bundled or separately quoted. **These are hypothetical budgeting ranges, not market price estimates or vendor tariffs. Recheck written quotes before paying.**

- **Custody:** charges commonly depend on assets held, with possible minimums, onboarding and withdrawal fees. Assuming an annual custody charge of **0.1–0.5%**, **£1 million** would cost **£1,000–£5,000 yearly** before extras. That is not a stand-alone insurance premium.
- **Protected wallets:** expect subscriptions, protection-limit tiers or bespoke business pricing, potentially including integration and usage charges. An assumed **£5–£50 monthly** subscription means **£60–£600 yearly**. Actual quotes can fall outside this illustration; check what protection the fee buys.

### Exit deliberately

**From custody:** test a withdrawal to a freshly generated wallet or replacement custodian before moving everything. The old custodian’s signing keys and backups generally remain with it; obtain its retention and deletion terms. Insurance does not follow withdrawn coins automatically.

**From a protected wallet:** establish independent signing or a replacement recovery route before cancellation. Ask whether backup material can be returned or exported, what is deleted, and what remains in archives. If retained copies are a concern, move funds to fresh keys; a deletion promise cannot prove every copy has vanished.

**For both:** obtain written confirmation of when protection ends and whether a loss occurring before cancellation remains claimable if discovered afterwards. Account closure, discovery periods and reporting deadlines can matter separately. Keep policy copies and claim evidence, and arrange replacement protection where available before cancelling.

## Paid security, part 4 — retail theft cover and on-chain mutual cover (continued)

For a Bawa wallet, keep compensation separate from key recovery. An “insured” platform may have protection for its own hot wallets or cash deposits, without giving you a direct claim for your crypto. A custodian’s policy cannot recreate your seed, repair a failed chain or make good a token’s falling price.

### Retail theft-cover subscriptions

**What you are buying.** These products mainly suit individuals seeking compensation after a defined theft from an eligible wallet. Some partner offers advertise ceilings of US$1 million per wallet. That is a conditional maximum, not a guaranteed payment. Ask how “wallet” is defined: several accounts or receiving addresses derived from one seed do not necessarily earn separate allowances.

This is not a recovery service. Losing your seed does not become recoverable because you paid a subscription. Scams you authorised, disclosed recovery material, unsupported assets or unapproved wallet types may fall outside the terms. Ordinary retail cyber policies often exclude cryptocurrency altogether; read the exclusion schedule before considering the headline benefits.

Businesses must establish whether company-owned assets, employee access and their signing arrangements qualify. A personal subscription is not automatically suitable for a treasury.

**Before paying.** Obtain the policy wording and schedule, confirm eligibility, complete the required identity and wallet-ownership checks, then retain your cover confirmation somewhere accessible without that wallet. Do not disclose seed words to obtain a quote or submit a claim.

Ask:

- Who is insured, who receives compensation, and who actually underwrites it?
- Which wallets, assets and theft events qualify?
- Are there waiting periods, an excess, valuation rules or reporting deadlines?
- Is a police report sufficient, or is further law-enforcement verification required?
- Are limits allocated to you, or shared across customers?

**Cost worksheet — dated 30 October 2026.** Charges may be monthly or annual subscriptions, sometimes varying with wallet count or the selected limit. Obtain a written **[LOW]–[HIGH] annual total** for the same limit, excess and wallet count, including fees and taxes. These are quote fields, not an assumed market tariff; recheck prices and renewal terms before paying.

Brokered institutional cover is a separate business option. An indicative **2–5% of insured value per year** is a budgeting range for some programmes, not a retail subscription rate. Institutional terms are negotiated and vary widely; that range also requires rechecking.

**Custody and failure.** Buying cover need not give anyone control of your funds. Establish whether any bundled service can sign, co-sign or retain backup keys or shares. A broker can fail to arrange or renew the promised policy; an insurer can become unable to pay; a custodian can freeze withdrawals or fail in circumstances the policy excludes.

A genuine theft can still produce a refused claim because an exclusion applies. Even an otherwise eligible loss may encounter a shared aggregate limit already consumed by another customer’s loss.

**Cancellation and migration.** Get written confirmation of whether earlier incidents remain claimable after cancellation, and of every notification deadline. Do not assume cancellation either preserves or extinguishes those rights. Protection for later incidents normally ends with the cover period.

Obtain approval before moving to another wallet. If the provider holds recovery material, test independent recovery before ending access, then establish what can be exported, what will be deleted and what must be retained. Cancellation does not revoke copied keys. Where retained material could permit signing, move funds to a freshly seeded wallet under your control.

### On-chain mutual cover

**What you are buying.** A member-funded pool can compensate defined losses involving named protocols, such as specified smart-contract failures. This can suit individuals already using DeFi and businesses with identifiable protocol exposure.

It does not insure everyday wallet theft or replace a holder’s lost seed. Nor should protocol cover be read as protection against every dependency failure, chain outage or token-price fall. Eligibility follows the stated protocol, chain, contract scope, event and cover period. Capacity and payment limits depend on the pool’s rules and governance.

**Before paying.** Check membership and jurisdiction requirements, complete any required identity checks, obtain a quote and purchase through a verified interface. Connecting a wallet does not require surrendering its seed.

Ask which protocol versions and assets qualify, when cover begins, what proves a loss, who decides claims, how decisions can be challenged and which aggregate limits apply. Keep the purchase record and terms independently accessible.

**Cost worksheet — dated 30 October 2026.** Record comparable quotes as **[LOW]–[HIGH]% of the covered amount for [TERM]**, with membership charges and network fees recorded separately. Duration, protocol risk and available capacity can change the quote. Compare equivalent periods rather than confusing a short-term charge with an annual rate. Recheck both price and capacity before purchase; the institutional range above is not a mutual-cover tariff.

**Custody and failure.** Your protocol position can remain under your keys while compensation depends on a pool, contracts and governance. Do not assume a conventional insurer guarantees payment. Contract defects, inadequate capital or a rejected claim can leave you uncompensated.

An excluded contract version can defeat a claim after a real exploit. Another member’s loss, or several correlated losses, may exhaust shared limits. If a broker or custodian arranges access, their mistakes, insolvency or withdrawal restrictions add separate risks; establish who owes you payment.

**Exit and migration.** Stopping renewal, cancelling early and transferring cover are different actions. Check refund rules and whether claims for earlier events survive expiry. Moving assets to another protocol or chain does not automatically move protection. Retain any membership, cover token or evidence required for outstanding claims.

Non-custodial membership should not involve handing over backup keys. If a bundled service holds them, verify independent recovery and its export, deletion and retention arrangements before leaving. Use a fresh seed where retained signing material remains a risk.

**Paying for cover does not get rid of seed risk or counterparty risk.**

## Paid security, part 5 — cloud KMS and dedicated cloud HSM (first quarter)

Do not use paid key storage to compensate for an unpredictable build. Document exact runtime versions, commit lockfiles, authenticate release tags, test in CI, scan for secrets and review dependency changes. Publish release checksums and provenance where appropriate. A caret permits newer compatible resolutions; it does not identify our tested build. Record exact tested cryptographic releases in the application’s lockfile, enforce that lock in CI and review each upgrade.

An HSM keeps key creation, storage and cryptographic operations within tamper-resistant hardware, without releasing plaintext secret material. Check advertised FIPS 140-3 Level 3 validation against the particular module and configuration.

Neither option supplies a complete wallet. Key protection stops at the service boundary; compromised code with signing permission can still spend. Verify blockchain algorithms, signature formats and HD derivation support. KMS-encrypting a seed does not protect it while application software decrypts it. Protecting imported child keys also leaves any seed capable of regenerating them as a critical secret.

**All price ranges below are budgeting estimates dated 30 October 2026, not current quotations. Recheck pricing before purchasing.**

### Cloud KMS

**Protection and fit.** With an HSM-backed, non-exportable signing key, stolen application disks, database copies and backups need not expose that key. This does not stop misuse of authorised signing access. KMS can suit a small business once unattended signing, several operators and central auditing become requirements. For most individuals, integration work and account dependency outweigh the modest storage bill.

Product tiers matter. AWS advertises KMS keys as HSM-backed by default; Azure distinguishes software-protected Key Vault Standard from shared-HSM Premium; Google separates software, HSM and external protection levels. Confirm the particular deployment rather than assuming equivalent capabilities. Bawa does not endorse these vendors.

**Onboarding and custody.** Start with a separate account or project and disposable keys. Require administrator MFA, separate administration from signing, restrict workload permissions, and enable protected audit logs and deletion alerts.

For provider-held keys, the provider houses the protected material; authorised identities request signatures. Administrators may also be able to grant that authority. Custody follows these powers, not the product label. An operator able to spend customers’ funds unilaterally is a custodian. A non-custodial hosted design must prevent unilateral operator signing and recovery; an approval screen alone is insufficient.

**Cost.** Where monthly key storage is charged, indicative bands are US$0.05–$0.10 for software, US$0.50–$2 for HSM-backed and US$2–$4 for external protection, per key or active version. These are different protection models, not necessarily equivalent signing services. Add request charges, logging and any external service fees. Recheck billing units, region and supported operations.

**Risks, failures and exit.** Quotas, permission mistakes, regional outages, disabled or deleted keys and billing suspension can stop signing. Provider compromise, legal restrictions and service retirement remain counterparty risks.

Assume provider-generated signing keys cannot be exported unless the service explicitly supports it. Check import, export and restoration rules before funding addresses. Migration commonly requires replacement keys, new addresses and asset transfers. Provider-bound backups are not portability, and address-bound contracts or permissions may complicate a simple sweep.

### Dedicated cloud HSM

**Protection and fit.** An allocated, single-tenant HSM or pool reduces co-tenancy exposure and can provide greater control over cryptographic roles. AWS CloudHSM and Azure’s Managed HSM and Cloud HSM offerings illustrate this category, but their administration and recovery models differ.

This is normally a business purchase justified by isolation requirements, audits and staff capable of operating recovery procedures—not merely a large wallet balance. It is disproportionate for most individuals. It becomes worthwhile when those requirements justify both substantial recurring capacity charges and operational ownership.

**Onboarding and custody.** Plan private networking, supported clients and resilient capacity. Separate security officers from application users, establish recovery or quorum arrangements where supported, and rehearse failover before introducing valuable keys.

The provider houses the hardware; enrolled cryptographic users authorise operations. Confirm who can reset access, change roles and restore backups. Dedicated tenancy does not stop malicious authorised signing, vulnerable client software or exposure of seeds outside the module. If the business controls signing alone, customer funds remain custodial. Non-custody requires independently enforced user authority, not exclusive hardware tenancy.

**Cost.** Capacity is billed by HSM, cluster or pool hours, including idle time. A broad planning band is US$1,000–$20,000 per month across differing capacity and redundancy choices, before networking and operational staff; larger deployments can exceed it. Recheck minimum topology, standby capacity, backup and recovery-region charges.

**Risks, failures and exit.** Single tenancy does not remove dependence on the provider’s availability, control plane, continued service or legal jurisdiction. Lost recovery credentials, expired client certificates, network partitions, failed cluster synchronisation and unusable backups can interrupt signing or make recovery impossible.

Establish export policy before generating funded keys. Some configurations permit wrapped export to compatible hardware; others offer only restricted, provider-bound restoration. Prove the intended migration with test keys rather than treating a backup checkbox as an exit plan. Where portability is unavailable, plan replacement addresses and on-chain transfers while the old signer remains usable.

### First-quarter acceptance gate

Pilot one narrowly scoped signing flow with test funds. Exercise denied access, throttling, outage handling, signing suspension, restoration and migration. Record which spending rules the key service cannot enforce. Have another maintainer follow the runbooks, and back up wallet metadata separately. Do not retire old keys until funds and remaining signing obligations have been accounted for.

## Paid security, part 5 — on-premises HSM and HSM-backed secrets managers (second quarter)

We would fund these alongside tested recovery and spending controls, not instead of them. Stronger key storage cannot repair an unsafe signing decision. Neither an HSM nor a secrets manager supplies Bawa’s wallet logic automatically.

**Budget basis:** all ranges below are planning allowances dated **30 October 2026**, not current quotations. Figures are in GBP, excluding VAT and internal staff time. Recheck written prices, supported integrations, licence tiers, maintenance and renewal terms before committing.

### On-premises HSM

**What it protects.** An HSM performs key operations within a tamper-resistant hardware boundary. Generate and retain wallet keys there, with plaintext export disabled, to reduce exposure from stolen disks, host-memory inspection and physical interference. Protection applies while keys are stored and used inside that boundary.

**What it does not protect.** A compromised application with signing permission can still request harmful signatures without stealing a key. The appliance does not establish that a destination or payment amount is legitimate, nor prevent application outages. If FIPS 140-3 Level 3 is advertised, verify the validation for the exact model, firmware and operating mode; it does not certify the wallet integration.

**Who it suits.** Usually a business running a shared, continuously available signing service, or needing formal separation of duties. It becomes worth considering when funds at risk and operational requirements justify a five-figure deployment budget plus trained operators. One individual’s wallet rarely warrants that overhead.

**Setup outline.** Prototype the required signing curves and HD derivation before purchase. Curve support alone does not establish that the device can perform the wallet’s derivation scheme. Exporting seeds or derived private keys to make an adapter work defeats hardware-only isolation. Establish separate administration and signing roles, restricted physical and network access, approval rules, audit logs, protected backups and tested failover before funding wallets.

**Cost model.** Allow roughly **£5,000–£50,000 per production appliance**, or **£15,000–£150,000** for redundant hardware and integration. Annual support may require **£1,000–£10,000 per appliance**. Secure premises, replacement stock and operational cover add to ownership costs.

**Custody and counterparty risk.** The device holds the key; authorised clients request signatures. Exclusive control of signing and recovery for your own wallet means self-custody. A business retaining signing authority for customers remains custodial. Count administrators who can grant permissions when assessing control. Buying hardware need not give its manufacturer signing access, but trusted firmware, servicing and replacement availability remain supplier dependencies.

**Failure and exit.** Power loss, hardware faults, tamper-triggered key deletion or missing recovery operators can stop signing. Losing every recoverable copy can strand funds permanently. Fail closed rather than falling back to plaintext keys.

Test restoration to a spare. Encrypted key backups may work only with compatible devices; they do not establish cross-vendor portability. Confirm protected transfer options before purchase. Where migration is impossible, create a fresh wallet at the destination, move funds and replace receiving addresses. Keep the old signer secured for late deposits during a managed retirement.

### Secrets manager backed by an HSM

**What it protects.** A secrets manager centralises credentials, access policy, rotation and audit records, reducing scattered copies and uncontrolled sharing. An HSM can protect the encryption key used to open its stored data.

**What it does not protect.** That arrangement is not necessarily hardware-backed signing. Once the store is opened, wallet secrets may enter the manager’s memory or be returned to an application. Their protection then depends on those systems too. Genuine hardware-only signing requires both the wallet key and its signing operation to remain inside the HSM. Neither design makes a malicious but authorised request safe.

**Who it suits.** Mainly businesses with several services, environments or operators, especially where a secrets platform and HSM already exist. The expense becomes easier to justify when manual secret distribution, staff departures and access reviews create recurring risks. It is usually excessive for an individual.

**Setup outline.** Decide explicitly whether you need encrypted secret storage or hardware-only signing. Check the software edition, HSM connector and wallet compatibility. Give each service its own identity; apply narrow permissions, separate administration, retain useful audit logs and document recovery. Rehearse restarts, credential renewal and loss of HSM connectivity.

**Cost model.** For HSM-capable enterprise software and support, reserve **£10,000–£100,000 annually**, plus the hardware budget above, hosting and operations. Charging may follow a subscription, secret count or capacity allowance. HSM integration may require a higher tier; an existing contract can substantially change the incremental cost.

**Custody and counterparty risk.** In hardware-only mode, the HSM retains the key, while manager identities and administrators govern access to signing. With retrievable secrets, authorised readers can acquire signing material themselves. Self-hosting alone does not make customer wallets non-custodial: who can obtain keys, cause signatures or take over recovery matters. For hosted operation, examine the provider’s administrative powers as well. Both suppliers introduce update, licensing, connector and continuity risks.

**Failure and exit.** Expired credentials, mistaken policies or an unavailable HSM can block service; excessive permissions can expose secrets or signing authority. Back up encrypted data, configuration and recovery material, then test a complete restoration.

For migration, move identity mappings, policies and permitted secrets. Test changing the store’s encryption protection while the old HSM remains available. Non-exportable signing keys need the protected-transfer or new-wallet route described above. Never treat wallet-seed replacement like routine password rotation: existing addresses still depend on their original keys.

## Paid security, part 5 — paid audits and audit contests (third quarter)

For Q3, budget for review, repairs and another check of those repairs. The useful outcome is a better-tested release candidate, not a badge in the README. Named providers below are examples, not Bawa recommendations.

All financial ranges below are planning figures dated **30 October 2026**; dollar amounts are USD. They are not live quotations. **Recheck prices, scope, availability and contractual terms before committing.**

### Paid audit

**What it helps with, and who it suits.** A specialist team examines an agreed version for weaknesses in areas such as seed handling, derivation paths, transaction signing, recovery and dependencies. This can catch implementation errors and unsafe design assumptions before release.

It usually makes sense for businesses or maintainers protecting many downstream users, particularly when plausible losses dwarf the review budget. It is rarely economical for someone using a single personal wallet. Leave enough money and engineering time to fix what the reviewers find.

**Limits.** Conclusions concern the named components at a particular revision. They do not extend to excluded code, subsequent changes, operational keys or front-end phishing. Review can miss vulnerabilities; it does not prove that the software is safe.

**Set-up.** Freeze a candidate commit, prepare a threat model and test harness, and agree exclusions, named reviewers, confidential disclosure, report ownership and publication rights. Include a follow-up review of fixes in the agreement. Supply synthetic test material, never production secrets.

**Cost model.** Scope, engineer-weeks and follow-up work drive the fee. Dated planning bands include:

- Simple-token reviews: **$8,000–$20,000**.
- Enterprise audits: **$80,000–$200,000**.
- Mid-sized DeFi primitives, including re-audit: **$200,000–$300,000**.
- Complex bridge or cross-chain work: **$100,000–$300,000+**.

These are market context, not estimates for Bawa’s HD-wallet code. Ask for a wallet-specific quotation. Formal verification generally costs more than manual review.

**Keys and counterparties.** An audit should not transfer custody. In non-custodial use, the user retains the keys and signing control; in custodial use, the existing custodian retains that authority. Reviewers need neither production seeds nor permission to sign live transactions.

The organisation being assessed also pays the bill, creating an inherent independence conflict. Check who actually performs the work, subcontracting arrangements, confidentiality, liability limits and whether publication can be suppressed.

**Failure modes and exit.** Thin scope, unsuitable reviewers, missed cryptographic faults, ignored findings and unchecked repairs can defeat the exercise. An impressive report cannot compensate for an unresolved signing vulnerability.

When changing reviewers or migrating the wallet, retain the report, exact commits, findings and fix checks. The old report remains evidence about the old scope; do not relabel it as approval of migrated code. Review changed trust boundaries. If a bounty runs alongside the audit, publish eligibility and dates for old and new versions, and preserve outstanding reward obligations.

### Audit contests

**What they help with, and who they suit.** Contests pay independent researchers to inspect the same codebase, with findings judged before rewards are allocated. Code4rena and Sherlock illustrate this model. Different approaches can expose edge cases that one team misses.

This suits businesses and widely used projects able to fund awards, triage submissions and repair findings. Ordinary individual wallet use seldom justifies that overhead. Before choosing a platform, check that its researchers can assess HD-wallet cryptography and the repository’s languages, rather than assuming smart-contract expertise transfers automatically.

**Limits.** More participants do not ensure that every component receives meaningful attention. The exclusions for out-of-scope code, later changes, operational keys and phishing still apply. Some arrangements offer financial cover, but that is conditional contractual protection—not evidence that the code is sound.

**Set-up.** Confirm that wallet code is eligible, freeze the scope and provide reproducible tests without live secrets. Agree severity definitions, reward rules, judging, disclosure timing and publication rights. Fund the reward pool and assign maintainers to triage and independently check fixes.

**Cost model and cover.** Budget separately for the reward pool, platform and judging fees, remediation and retesting; obtain a scoped total.

The dated illustrative Sherlock premium band was roughly **2.0%–2.25%** across public and private formats, with private formats towards the upper end. Depending on availability and eligibility, protection could range from **no cover to an advertised ceiling around $10 million**. Treat these as claims to verify, not product specifications. Ask what the percentage applies to, for what period, and which losses, limits and exclusions govern payment. The premium is not the whole contest price.

**Keys and counterparties.** Researchers, judges and cover providers should receive no production key material or signing rights. Keys and signing remain with the user in non-custodial use, or the existing custodian in custodial use.

Examine reward-funding arrangements, platform payment reliability, judging conflicts and the cover provider’s capacity to pay. An exclusion, disputed claim or insolvent counterparty can leave losses with the project or users.

**Failure modes and exit.** Rewards can favour easily scored bugs over difficult design work. Duplicate submissions, severity disputes and premature disclosure can consume maintainer time or help attackers.

Retain reports, judging decisions and fix checks. On migration, explicitly amend or close contest and ongoing bounty scope, publish eligible versions and cut-over dates, and settle pending submissions under the agreed rules. Reports remain tied to their original commits. Neither scope nor cover automatically follows a new repository or release.

### Checks for either route

Request **SOC 1 and SOC 2 Type II reports, ISO 27001 certification and penetration-test summaries**, establishing which are available and relevant. Check the assessed entity, dates, scope and exceptions.

These record a time-bounded assessment of provider controls. They neither certify Bawa’s wallet code nor guarantee that funds cannot be lost.

## Paid security, part 5 — bug bounty programmes

A bug bounty pays researchers for eligible security flaws reported through an agreed channel. For wallet software, that can surface weak randomness, incorrect derivation, seed leakage or signing checks that approve the wrong transaction. An HD-wallet defect may affect every account derived from a seed, not just one address.

An open, funded programme keeps an incentive to investigate after release, whereas an audit examines a particular snapshot. Neither guarantees complete scrutiny.

### Limits and suitability

Rewards buy reports, not prevention or compensation. They cannot restore lost seeds, reverse theft or make phishing and compromised devices harmless. Keep secure development, audits, monitoring and an incident plan. A criminal may value the exploit more than your advertised reward.

For someone managing only a personal wallet, this is rarely the right purchase: prioritise safe signing and tested backups. A solo maintainer distributing wallet code can offer a narrowly scoped, funded scheme. Businesses with widely used software or substantial funds exposed are stronger candidates, provided they can afford meaningful rewards **and** assess reports and ship fixes promptly. There is no universal balance threshold; non-custodial software can expose substantial user funds too.

### Budget before announcing

**Planning ranges dated 30 October 2026, not live prices:** an often-used starting point was a top critical reward of around 5–10% of realistically exposed funds, backed by a pot worth 2–3 times that award to handle several valid reports. Advertised critical ceilings ranged from thousands of US dollars to above US$10 million. A published ceiling is not proof that money is reserved.

The rough platform-fee allowance was another tenth of rewards paid, with contractual terms varying. Budget separately for report assessment, fixes, legal advice and administration. Recheck reward bands, fees, minimum commitments, funding arrangements and payment currency before signing or publishing terms. Estimate exposure using plausible user losses, not just your own treasury.

### Set-up and key control

In outline:

- Identify the maintained releases, repositories, chains and deployments covered. For reference code, state whether downstream forks, integrations and dependencies are included.
- Define eligible impacts, reward bands, exclusions, permitted testing, duplicate handling, response and payment deadlines, and disclosure rules.
- Reserve the money, arrange confidential reporting, name an accountable responder and establish a route to release fixes.

Get legal advice on researcher permissions and protections. You cannot authorise testing against somebody else’s service. Prefer isolated test environments; never require customer secrets or actual theft as proof.

In a non-custodial design, users hold their private keys and control transaction signing. Your software can still leak those keys or misrepresent a transaction. In a custodial service, the operator holds keys or controls sufficient signing authority to move assets; include that infrastructure where appropriate. Do not give researchers or the bounty provider production seeds, private keys or customer-transaction signing rights.

Depositing reward funds with a platform is a separate custody decision. Check who controls that pot, who authorises payouts, withdrawal conditions and what happens if the provider fails.

### Counterparties and common failures

A platform may leak confidential reports, mishandle a dispute or become unavailable just when you need it. Retain your own secure report records and an alternative reporting contact. Outsourced assessment does not transfer your responsibility to fix faults or pay agreed awards.

Common failures are vague scope, stale deployment lists, unaffordable headline rewards, slow responses and arguing about severity until the researcher walks away. Unsafe testing or premature disclosure can turn a report into an incident. Treat submitted proof-of-concept code as untrusted and run it in isolation.

### Leaving or migrating

Before moving provider, securely export policies, reports, payment history and open cases, respecting confidentiality terms. Agree who will handle and fund unfinished reports, and how unused reserves are returned. Honour the terms applicable when reports arrived. Changing bounty host should not require moving wallet keys.

Publish a cut-over date and reporting contact. Scope does not follow a platform, chain or contract migration automatically: list the new versions and deployments explicitly, and say which old ones remain eligible and for how long. Keep overlapping coverage while users still depend on old deployments, or explain the remaining risk without a bounty and the retirement plan. Do not quietly exclude a vulnerable legacy version or invalidate an existing report by changing scope.

## Paid security, part 5 — transaction monitoring, simulation and what to buy first

Monitoring helps you notice trouble; simulation helps you question a transaction before signing. Buy them as extra checks, not as a promise that money can be recovered.

### What they protect

- **Monitoring** watches selected addresses and contracts for unexpected outflows, new spending permissions or changes to administrator rights. It can spot suspicious activity and mistakes, often after execution. An alert still needs a responder.
- **Simulation** rehearses a proposed transaction using recent blockchain state, estimating balance and permission changes. Address screening adds warnings about reported threats. Together, these checks help expose misleading approvals, phishing and some wallet-draining attempts.
- **Blocking** needs enforcement: a read-only monitor cannot stop a transfer. An integrated signing policy can refuse a request; authorised automation may pause a supported contract. Nothing here can undo a signed transaction after on-chain confirmation.

A clean check is not proof of safety. New scams, unsupported chains or signature types, and changes in chain state or transaction ordering leave gaps. These tools cannot repair a leaked seed, replace lost backups or prove an investment is sound. A stolen key can still be used through an unprotected signing route.

### Who should pay, and how to start

For one person signing occasionally, start with available wallet previews and simple alerts. Frequent high-value signing, multiple operators or unattended business flows can justify paid integration. There is no magic balance threshold: weigh plausible losses against fees, engineering and response staffing. A dashboard nobody watches offers little protection.

Onboard in read-only or advisory mode: verify chains, signature types and token permits; register relevant addresses, including newly derived ones; connect simulation before signing; set alert thresholds and name responders. Test harmless transactions and outages before granting narrowly scoped response powers. Require a demonstration in your workflow, not just a coverage claim.

Plan for false alarms, missed detections, stale threat labels, delayed alerts and unavailable services. Decide whether an outage stops signing or permits unchecked transactions. Stopping can halt operations; continuing removes protection. Restrict and rehearse emergency overrides rather than leaving a convenient bypass.

### Keys and supplier risk

Read-only monitoring and non-custodial simulation use addresses or unsigned transaction data; you keep the key and signing authority. Never provide your recovery phrase or private key for these checks.

An automated responder may hold a separate key with delegated powers. A custodian may sign for you. Where signing uses key shares, establish which parties must cooperate, who can change policies and who can block access. The “non-custodial” label is not a permission map.

Even without custody, a supplier can fail, be compromised or expose transaction intentions. An extended public key can reveal linked derived addresses: share only what is needed. Custody adds withdrawal restrictions and insolvency exposure. Keep recovery of a non-custodial Bawa-based wallet independent of a supplier login.

### Plan the exit before entry

Require usable exports of rules, address lists and logs. Trial a replacement in advisory mode alongside existing checks, then switch connections and alert routing and revoke old credentials and delegated permissions. Expect some rules to need rewriting.

If the provider controlled a funds-holding key, plan a transfer to fresh keys. Agree custodial withdrawals or signing-share migration beforehand; do not assume key export will be available.

### Cost

**Illustrative budget ranges dated 30 October 2026, not supplier tariffs:** **£0–£50 per month** for personal extras; **£500–£10,000 per month** as an initial business procurement allowance. Enterprise services were generally priced on request, and quotations may fall outside these bands. These allowances are not verified market prices.

Billing may depend on addresses, chains, API requests, simulation volume, seats or response cover. Add onboarding, engineering, on-call staffing and any on-chain response fees. Recheck prices, quotas, coverage, minimum commitments, overage charges and renewal terms before buying.

### Buy in this order

1. **First:** suitable hardware signing and durable offline backups; enable useful wallet previews. Shared treasuries should prioritise independent approvals too.
2. **Next:** actionable alerts and pre-signing checks where activity and risk justify the integration and response costs.
3. **Can wait:** bespoke feeds, automated response and enterprise support without a clear operational need.
4. **Never a substitute:** no device, subscription, simulation result or custody promise replaces a tested recovery drill.

## Paid security, part 6 — free-vs-paid decision tables (first half)

Start with the failure you need to prevent, not a subscription tier. Offline generation, separated offline backups and watch-only derivation form the free baseline. Hardware wallets you already own and self-managed multisig with open coordinator software can add protection. Pin dependencies, keep lockfiles, scan for secrets and practise recovery.

These controls cost time and discipline. Paid help should fill a specific gap, not replace those habits.

### Choose by threat

| Threat | Free answer | Paid answer | What neither answer fixes |
|---|---|---|---|
| Single device stolen | Device locks, offline keys and backups kept elsewhere. | Managed multisig or MPC with separate approvals. | Reversing confirmed transfers; threats to personal safety. |
| Seed phrase lost | Separated offline copies and a tested recovery drill. | Collaborative recovery, where the key arrangement supports it. | Loss of every valid recovery route. |
| Seed phrase disclosed | Move funds to a fresh seed using a clean device. | Managed multisig, if independent keys are already required. | Making the exposed seed secret again; reversing theft. |
| Insider or employee fraud | Self-managed multisig with separate signers and duties. | MPC approval rules, HSM-held keys and approval logs. | Enough authorised people colluding. |
| Provider failure or acquisition | Hold your keys; test recovery using independent software. | Qualified custody with asset separation and exit terms. | Frozen tokens or halted chains. |
| Smart-contract bug | Avoid unnecessary contracts; limit funds exposed. | Independent audits, contests, bounties and monitoring. | Undiscovered bugs; guaranteed recovery after an exploit. |
| Phishing of the holder | Verify the destination and action on a trusted screen. | Approved-address lists, spending limits and independent approval. | A convincing scam that passes every approval. |
| Death or incapacity of the holder | Inheritance plan and securely stored, usable recovery instructions. | Collaborative custody with inheritance procedures. | Family disputes or missing legal authority. |
| Chain or protocol failure | Follow protocol notices; limit exposure to one chain. | Incident monitoring and custody response staff. | Restoring consensus or guaranteeing a chain restart. |
| Market loss | Limit exposure; keep essential savings out. | None of these services; theft cover is not price cover. | Falling prices. |

A paid recovery service cannot reconstruct an arbitrary lost seed. Its recovery arrangement must already exist and retain enough surviving keys or other valid access routes.

Insurance-backed custody and separate theft cover also need careful reading. Check covered events, exclusions, limits and who can claim. A policy protecting the custodian does not necessarily compensate each customer directly.

### Choose by budget and technical skill

| Budget and skill | Sensible first step | Trap to avoid |
|---|---|---|
| No budget and low skill | Keep the setup simple: separated backups, watch-only use and a small-value recovery drill. | Complex multisig or homemade encryption you cannot recover. |
| No budget and high skill | Assess self-managed multisig; separate signers and rehearse recovery without the usual coordinator. | Keeping every key and backup on one machine. |
| Modest annual budget — hundreds per year | Fix recovery gaps first; consider entry-tier collaborative custody if it fits. | Assuming a subscription includes inheritance, insurance and independent recovery. |
| Large annual budget — tens of thousands per year and up | Define approval rules; compare MPC, enterprise key management and scoped audits. | Expensive key storage controlled by one all-powerful administrator. |
| Regulated business | Establish legal duties; assess chartered custodians, HSM cold storage and independent assurance. | Treating a charter, HSM or insurance policy as automatic compliance. |

Technical skill does not remove the need for independent people, devices or locations. Equally, a low-skill holder should not buy a complicated signing arrangement without understanding recovery and exit.

### Cost scale for those choices

The following are rough planning ranges **dated 30 October 2026**, in US dollars—not current quotes. Recheck scope, minimums, renewal terms and additional charges before committing.

- **Collaborative custody:** approximately **$250–$7,500 annually**, depending on the tier and support included.
- **Institutional MPC:** entry pricing around **$999 a month**, extending to **$36,000+ annually** for enterprise packages; larger deployments can cost substantially more.
- **Qualified custody:** generally a negotiated annual percentage of assets held, subject to minimum charges or asset thresholds. Obtain a quote for the actual account size.
- **Audits:** roughly **$8,000–$300,000+**, driven by scope and complexity. **Bounty award caps** ranged from thousands to **$10M+**; an award ceiling is not the total programme budget.
- **Cloud KMS:** budgets start around **$1 per key per month** and rise with usage and associated services. **Dedicated HSMs:** calculate costs from cluster- or pool-hour billing, including the redundancy required.

A cheap key-storage unit does not buy a staffed custody operation. Include integration, policy administration, incident response and recovery exercises in the budget.

Before paying, establish who can sign, who can change the approval rules, how recovery works and how you leave. Service categories are comparison points, not endorsements of any supplier by Bawa.

## Paid security, part 6 — exit checks and remaining risk

Plan how to leave while the service is still working. Apply these checks to every paid arrangement, not just custody. They are not an endorsement of any provider.

Use testnet, test-only credentials and test assets for practical rehearsals. Keep live-wallet secrets out of them. If an item genuinely does not apply, record why; an unavailable test is not a passed test.

### Before signing: exit and migration checklist

- [ ] **Map who controls what.** Record who holds each signing key, backup key or share, including your own holdings and any subcontractors. Write down the signing threshold and which combinations can spend or recover without the provider. Keep this record descriptive: do not put secret material in the checklist.

- [ ] **Prove independent recovery.** On a clean, trusted machine, restore the test wallet without relying on the provider’s account, servers or staff. Verify the mnemonic and exact passphrase policy: an empty passphrase must remain empty; a chosen passphrase must be reproduced exactly. Using the recorded network and derivation paths, derive known public addresses and compare them with the recorded originals. Hold off funding until the public outputs agree. Repeat this drill quarterly with a tiny testnet amount. A custodian’s account-reset procedure is not independent wallet recovery; sole-provider spending control cannot pass this gate.

- [ ] **Write down the exit terms.** Record the contract term, renewal rules, notice period and required method of giving notice. Establish what data will be returned, in which formats and by when. Include retention or deletion obligations and any exit charges. Do not rely on a salesperson’s assurance that exporting is straightforward.

- [ ] **Test a withdrawal.** Send a small testnet amount through the intended exit route to an address whose spending keys you control. Verify receipt independently rather than trusting the service’s success message. Note approvals, limits, delays and any remaining provider dependency. If there is no safe test route, leave the check unresolved.

- [ ] **Record what cancellation changes.** For backup keys and shares, establish who returns, retains or deletes them, and whether your remaining material still supports recovery. A deletion promise is not proof that every copy has disappeared. Record when insurance cover ends and how cancellation affects claims. Identify the systems and dates covered by any audit, its exclusions, and whether cancellation changes the audit scope or your access to reports. An old report is not continuing supervision.

- [ ] **Rehearse the provider shutting down.** Run this before committing, then once a year. Assume the provider’s website, support and signing service are unavailable. Recover and move test assets using only independent tools, records and available signers. Document anything that stops the exit, then fix it and repeat the test.

- [ ] **Rehearse a seed compromise.** Apply the migration rule in `docs/RECOVERY.md` to the test wallet. Generate a different wallet with a new seed on a fresh, trusted device. Transfer every test asset and token, then permanently retire the original test wallet. Moving only the native coin does not complete the exercise.

### Paying does not remove risk

Paying removes neither seed risk nor counterparty risk. A custodian might collapse, suffer a hack, be compelled by a legal order to halt withdrawals, or refuse a claim because an exclusion applies. A paid multisig partner might disappear just when their signature is needed. A successful insurance claim provides financial compensation after the event; it does not bring back access to the chain.

A compromised seed cannot be edited into a safe replacement for the same wallet. No subscription, policy or fee changes that. The remedy remains a newly generated wallet on a fresh, trusted device, transfer of every asset and token to it, and permanent retirement of the compromised wallet. Cancelling a service, replacing hardware or changing an account password is not that migration.

### You should see:

Before funding any wallet that uses a paid service, check for:

- [ ] A complete record of key/share holders, signing authority and provider-independent recovery requirements.
- [ ] A successful clean-machine test restore, with the mnemonic and exact passphrase policy checked and derived public addresses matching the recorded originals.
- [ ] A confirmed testnet withdrawal to an address you control.
- [ ] Written contract, notice and data-return terms, plus cancellation consequences for backup keys, insurance cover and audit scope.
- [ ] A completed compromise rehearsal covering every test asset and token, with the old test wallet retired.
- [ ] A completed provider-shutdown rehearsal, its next annual date, and quarterly recovery drills scheduled with a tiny testnet amount.
- [ ] No unresolved recovery failures or public-output mismatches. Missing evidence still blocks funding; paying the bill does not waive the checks.
