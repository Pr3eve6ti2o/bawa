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
