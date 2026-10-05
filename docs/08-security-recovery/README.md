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
