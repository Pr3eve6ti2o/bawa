# Bawa HD Wallet Generator

A security-conscious, offline-first HD wallet generation and watch-only derivation toolkit for applications that need deterministic deposit addresses without exposing private keys to the runtime service.

The current implementation uses **Trust Wallet Core WebAssembly** for wallet/derivation primitives and makes the repository's derivation policy explicit rather than hiding it behind generic “HD wallet” language.

> **Security boundary:** this repository generates and recovers wallet secrets, but its runtime address-derivation tools are designed to work from extended public keys only. The runtime path is not a signer and cannot spend funds.

## Current support profile

| Network | Derivation policy | Public material | Runtime address generation |
|---|---|---|---|
| Bitcoin mainnet | BIP-84 | account `zpub` | Yes |
| Ethereum mainnet | BIP-44 coin type 60 | account `xpub` | Yes |
| Tron mainnet | BIP-44 coin type 195 | account `xpub` | Yes |
| TON | Trust Wallet Core default TON configuration | address only | Address exported at generation |

This is intentionally a **small, explicit support matrix**. A professional wallet implementation should never imply that every blockchain uses identical BIP-32/BIP-44 rules.

## What this project actually does

The generator performs the following pipeline:

```text
cryptographically secure entropy
          │
          ▼
     BIP-39 mnemonic
          │
          ▼
     deterministic seed
          │
          ├────────────────┐
          ▼                ▼
   chain-specific HD    encrypted
      derivation        recovery file
          │
          ▼
  account-level public roots
          │
          ▼
 watch-only address derivation
```

The project separates **key generation**, **public derivation**, and **application address allocation**:

- `generate.js` belongs on a trusted generation machine.
- `derive.js` / `derive_daemon.js` belong in the public/watch-only runtime.
- The parent application is responsible for allocating and persisting address indexes.

## Repository layout

```text
bawa-hd-wallet/
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md
│   ├── AUDIT.md
│   ├── RECOVERY.md
│   ├── REFERENCES.md
│   ├── SECURITY.md
│   ├── STANDARDS.md
│   └── TESTING.md
├── tools/
│   ├── make_wallet.py
│   ├── decrypt_seed.py
│   └── hdwallet-gen/
│       ├── package.json
│       ├── generate.js
│       ├── derive.js
│       ├── derive_daemon.js
│       └── compare.js
├── test/
│   └── smoke.test.js
└── .github/workflows/ci.yml
```

Runtime-created directories are deliberately absent from Git:

```text
secrets/       encrypted recovery artifact
seed-backup/   recovery bundle
.env           public watch-only configuration
```

The `.gitignore` is mandatory protection, not housekeeping.

---

# 1. Cryptographic model

An HD wallet is a deterministic key tree, not merely a 24-word phrase.

This repository combines several standards:

- **BIP-39** — mnemonic creation and mnemonic-to-seed conversion.
- **BIP-32** — hierarchical deterministic key derivation for secp256k1.
- **BIP-43** — purpose field for organizing derivation schemes.
- **BIP-44** — multi-account hierarchy.
- **BIP-84** — native SegWit/P2WPKH account derivation for Bitcoin.
- **SLIP-0044** — registered coin types used under BIP-44.
- **SLIP-0010** — generalized HD derivation for curves including Ed25519.
- **SLIP-0132** — extended-key version bytes such as `zpub`.

These standards are layered. No single BIP explains the complete behavior of every chain supported here.

## 1.1 BIP-39: entropy → mnemonic → seed

The current generator calls Trust Wallet Core with **256 bits of entropy** and an **empty BIP-39 passphrase**. A 256-bit entropy value produces a 24-word mnemonic after adding the BIP-39 checksum.

Conceptually:

```text
ENT = 256 bits
CS  = first ENT/32 bits of SHA256(ENT)
MS  = ENT || CS
words = split MS into 11-bit indices
```

For 256-bit entropy:

- entropy = 256 bits
- checksum = 8 bits
- mnemonic = 264 bits
- words = 24

BIP-39 converts the mnemonic into a 512-bit seed using PBKDF2-HMAC-SHA512:

```text
password   = normalized mnemonic
salt       = "mnemonic" + normalized passphrase
iterations = 2048
output     = 64 bytes
```

This repository currently uses:

```text
passphrase = ""
```

That is a project policy. It is **not** a property of BIP-39 itself.

Anyone who obtains the 24 words can reconstruct the same wallet under the same passphrase/path policy.

## 1.2 BIP-32: seed → deterministic key tree

For a secp256k1 BIP-32 wallet, the 512-bit BIP-39 seed becomes master key material using HMAC-SHA512 with the key label `Bitcoin seed`.

The digest is divided into:

```text
IL = master private key material
IR = master chain code
```

A BIP-32 extended node contains more than an EC key:

```text
version
depth
parent fingerprint
child number
chain code
key data
checksum
```

This is why `xpub`, `zpub`, `xprv`, etc. should be understood as **serialized extended nodes**, not simply public/private keys.

## 1.3 Hardened vs non-hardened derivation

Hardened indexes use the high bit:

```text
normal:   0 .. 2^31-1
hardened: 2^31 .. 2^32-1
```

Watch-only derivation depends on the exported account node being above the non-hardened public branch.

Example:

```text
m/84'/0'/0'      hardened account boundary
       │
       └─ /0/i    external public derivation
```

The runtime can derive `/0/i` from an account-level public key, but cannot recreate the hardened private ancestor from that public root.

The daemon therefore accepts an explicit child index rather than an arbitrary derivation path. It constructs the approved path internally.

---

# 2. Chain derivation policy

## Bitcoin — BIP-84 / P2WPKH

```text
account root:   m/84'/0'/0'
deposit path:   m/84'/0'/0'/0/i
extended key:   zpub
address:        native SegWit / Bech32 (bc1q...)
```

The public path conceptually is:

```text
account zpub
   ↓
/0/i
   ↓
compressed secp256k1 public key
   ↓
HASH160(pubkey)
   ↓
20-byte witness program
   ↓
version-0 SegWit Bech32 address
```

The `zpub` serialization is intentional: its version bytes are associated with the native-SegWit account convention in SLIP-0132.

## Ethereum — BIP-44

```text
account root:  m/44'/60'/0'
deposit path:   m/44'/60'/0'/0/i
extended key:   xpub
address:        Ethereum account address
```

BIP-44 defines the hierarchy. The final Ethereum address encoding is chain-specific and must not be inferred from BIP-44 alone.

For EVM-compatible networks, do not silently substitute another coin/network policy just because the final hexadecimal account encoding looks similar.

## Tron — BIP-44

```text
account root:  m/44'/195'/0'
deposit path:   m/44'/195'/0'/0/i
extended key:   xpub
address:        TRON Base58 address (T...)
```

`195` is the registered TRON coin type from SLIP-0044.

## TON

TON is deliberately not described as a generic “mnemonic → address” chain.

Trust Wallet Core reports TON as coin type `607` and exposes the wallet's configured TON derivation path/address. TON address identity can also depend on wallet contract/version, workchain, network presentation, and wallet/subwallet configuration.

Therefore:

- the generated TON address is the authoritative public result of the configured implementation;
- this repository does **not** export a TON xpub;
- the exact TON wallet configuration must be preserved for interoperability/recovery;
- adding a TON address-index daemon requires a separate, explicit specification and test vectors.

---

# 3. The watch-only security boundary

The strongest architectural property of this project is that the long-running runtime does not need the mnemonic.

```text
                         TRUSTED / OFFLINE SIDE
┌───────────────────────────────────────────────────────────────┐
│ mnemonic → seed → HD derivation → account xpub/zpub          │
│                         │                                     │
│                         └──────── public material ────────────┤
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         RUNTIME SIDE
┌───────────────────────────────────────────────────────────────┐
│ xpub/zpub → child public key → deposit address                │
│                                                               │
│ NO mnemonic                                                   │
│ NO seed bytes                                                  │
│ NO xprv/zprv                                                   │
│ NO transaction signing                                         │
└───────────────────────────────────────────────────────────────┘
```

A compromised address server may gain privacy-sensitive knowledge about the wallet's address graph, but an account xpub alone is not a spending key.

Do not “complete” the daemon by accepting xprv/private-key input. Signing should live in a separate trust domain, preferably an offline signer or hardware-backed signer.

---

# 4. Address-index allocation

The HD derivation code does **not** allocate customer/order indexes.

It solves:

```text
(account public root, branch, index) → deterministic address
```

The parent shop/bot must solve:

```text
(order/customer) → unique persistent index
```

At minimum the application should persist:

| Field | Purpose |
|---|---|
| `chain` | BTC / ETH / TRX |
| `network` | mainnet/testnet |
| `derivation_root_id` | selected account/watch-only root |
| `derivation_path` | exact path template |
| `branch` | normally external `0` |
| `index` | child address index |
| `address` | generated address |
| `order_id` | owning order |
| `status` | allocated / awaiting / confirmed / expired / swept |
| `created_at` | allocation timestamp |

**Concurrency matters.** Never implement “read highest index + 1” without a transaction or uniqueness constraint. Two simultaneous orders can otherwise receive the same address.

Index 0 may be reserved by the parent application. That is **application policy**, not a BIP-44 requirement.

---

# 5. Generator lifecycle

Run:

```bash
python3 tools/make_wallet.py
```

The intended lifecycle is:

1. Open the controlling terminal.
2. Verify the wallet-core installation against deterministic vectors.
3. Create a fresh wallet with 256 bits of entropy and an empty BIP-39 passphrase.
4. Validate the 24-word mnemonic.
5. Export BTC `zpub`, ETH `xpub`, TRX `xpub`, and the configured TON address.
6. Derive representative child addresses from the public roots.
7. Encrypt the mnemonic with AES-256-GCM.
8. Show the mnemonic and separate data key only on the controlling terminal.
9. Ask the operator to confirm the first seed word and confirm the data key was saved.
10. Write the encrypted artifact atomically with restrictive permissions.
11. Update `.env` with public watch-only material.
12. Prepare a recovery bundle without the data key.

Generation must be treated as a **trusted-machine operation**.

Do not run wallet generation through CI logs, shell scripts that capture stdout, screen-sharing sessions, browser terminals, or remote automation unless the security implications are fully accepted.

---

# 6. Encryption at rest

The current recovery artifact is an application-specific AES-256-GCM format.

Conceptually:

```text
random 256-bit data key
        +
random 96-bit nonce
        +
AES-256-GCM
        ↓
ciphertext + 16-byte authentication tag
```

The current JSON shape is:

```json
{
  "alg": "AES-256-GCM",
  "kdf": "none - random 256-bit data key (shown once at creation)",
  "nonce_b64": "...",
  "ciphertext_b64": "..."
}
```

The encryption key is intentionally not stored next to the ciphertext.

The current authenticated-data label is:

```text
nova-shop-seed-v1
```

That identifier is retained for compatibility with existing encrypted artifacts. Changing it would require a versioned migration design.

The encrypted file is **not a standard wallet backup format**. The canonical recovery material remains the original mnemonic plus the exact derivation configuration.

---

# 7. Recovery

There are two valid recovery sets.

### Recovery A — mnemonic

The 24-word BIP-39 mnemonic is the canonical wallet recovery material.

The same words can produce different visible addresses if a wallet uses:

- a different BIP-39 passphrase;
- a different derivation path;
- a different account;
- a different address branch;
- a chain-specific wallet implementation;
- a different TON wallet configuration.

### Recovery B — encrypted artifact

The encrypted artifact requires the separately stored 32-byte data key.

```bash
python3 tools/decrypt_seed.py /path/to/seed.enc.json
```

The recovery tool authenticates the ciphertext before returning the plaintext.

Never put the data key inside Git, the same recovery bundle, a ticket, chat message, or shell history.

Perform a recovery drill **before funding a new wallet**.

---

# 8. Extended-key serialization

An extended public key is identified by:

```text
version | depth | parent fingerprint | child number | chain code | key data | checksum
```

This repository uses:

- BTC account `zpub` for BIP-84;
- ETH account `xpub`;
- TRX account `xpub`.

SLIP-0132 defines alternate version bytes such as `ypub` and `zpub`.

Therefore a string beginning with `xpub` and a string beginning with `zpub` are not interchangeable labels for the same address family.

The runtime checks the serialized version bytes so private extended-key variants are refused before wallet-core receives them.

---

# 9. Runtime protocol

The persistent daemon uses newline-delimited JSON over stdin/stdout.

Startup:

```json
{"ready":true}
```

Request:

```json
{"chain":"btc","xpub":"zpub...","index":5}
```

Success:

```json
{"ok":true,"address":"bc1q..."}
```

Failure:

```json
{"ok":false,"error":"bad request"}
```

Constraints:

- supported chains are allowlisted;
- xpub input is capped in length;
- index must be an integer;
- index must be in `0..2147483647`;
- the caller cannot supply an arbitrary derivation path;
- private extended-key versions are rejected;
- errors must not echo raw key material;
- a malformed request must not terminate the daemon.

For one-shot operation:

```bash
echo "$XPUB_BTC" | node tools/hdwallet-gen/derive.js btc 5
```

For persistent operation:

```bash
cd tools/hdwallet-gen
node derive_daemon.js
```

---

# 10. Why the index limit is 2³¹−1

BIP-32 reserves the high bit of the 32-bit child index for hardened derivation.

Therefore:

```text
2^31 - 1 = 2147483647
```

is the highest non-hardened child index.

At:

```text
2^31 = 2147483648
```

the hardened bit would be set.

A watch-only xpub cannot derive that hardened child. Accepting such an index without rejection can create an address that cannot be reproduced from the public root used by the runtime.

---

# 11. What wallet-core does vs what this repository specifies

Trust Wallet Core supplies low-level wallet functionality and chain-specific address logic.

This repository specifies:

- which entropy size is requested;
- the BIP-39 passphrase policy;
- which account/path policy is used for each supported chain;
- which extended-key serialization is exported;
- which public inputs the runtime accepts;
- how index bounds are enforced;
- how secrets are isolated;
- how recovery artifacts are encrypted;
- how application address allocation should be separated.

The repository intentionally does **not** reimplement elliptic-curve cryptography or every address serializer itself.

That reduces custom crypto surface area, but means Trust Wallet Core remains a critical dependency and should be updated only through deliberate, tested changes.

---

# 12. Verification strategy

The current generator runs deterministic checks before generating a fresh wallet.

These include:

- TRON coin ID = 195;
- TON coin ID = 607;
- BTC and Ethereum deterministic address vectors;
- BTC `zpub` prefix;
- ETH/TRX `xpub` prefixes;
- public-root → address round trips;
- valid 24-word mnemonic;
- generated address validation.

These are important integration checks, but they are **not a complete independent standards certification**.

A production release should additionally run:

- full BIP-32 official vectors;
- BIP-39 mnemonic-to-seed vectors;
- hardened and non-hardened edge cases;
- leading-zero cases;
- extended-key checksum/version tests;
- invalid-child tests;
- independent reference-implementation comparisons;
- TON configuration-specific fixtures;
- testnet/network separation tests.

The key principle is:

> A library agreeing with itself is not the same as independent verification.

---

# 13. Security threat model

### In scope

- mnemonic leakage through stdout/stderr;
- accidental source-control commits;
- private-key input to watch-only runtime;
- malformed extended keys;
- out-of-range child indexes;
- path traversal in generated artifact locations;
- symlink redirection;
- torn/partial writes;
- dependency drift;
- error messages echoing sensitive key material;
- application confusion between public and private extended keys.

### Partially mitigated

- memory forensics;
- swap/hibernation;
- crash dumps;
- malicious package registry content;
- compromised operating system.

### Out of scope

- root/kernel compromise;
- physical attacks;
- hardware-wallet compromise;
- blockchain consensus failure;
- a lost mnemonic/passphrase;
- an operator voluntarily revealing the recovery data.

---

# 14. Important security limitations

The repository must not claim stronger guarantees than the operating system can provide.

### Plaintext exists during generation

The mnemonic and data key exist in the Node process before encryption. A compromised host, debugger, core dump, swap subsystem, or memory-forensics tool may capture them.

### JavaScript memory is not secure memory

Calling `delete()` on a wallet-core object and zeroing a Buffer is useful, but JavaScript string lifetime and WebAssembly allocation behavior do not provide the same guarantees as a dedicated native secure-memory abstraction.

### xpub is not secret, but is sensitive

An xpub does not provide spending authority, but it can allow the holder to reconstruct the address tree below that node and correlate financial activity.

### Encryption does not replace backup

AES-GCM protects the stored artifact. It does not recover a lost mnemonic or a lost data key.

---

# 15. Operational checklist

Before generation:

```text
[ ] trusted machine
[ ] expected Node/Python versions
[ ] dependency versions reviewed
[ ] no screen recording / clipboard sync / remote access
[ ] .gitignore present
[ ] recovery storage prepared
```

During generation:

```text
[ ] controlling terminal confirmed
[ ] 24 words recorded offline
[ ] data key stored separately
[ ] first-word confirmation passed
[ ] data-key confirmation passed
```

After generation:

```text
[ ] encrypted artifact exists with restrictive permissions
[ ] .env contains public material only
[ ] recovery bundle exists
[ ] mnemonic recovery has been tested independently
[ ] at least one public address per supported chain verified
[ ] parent application records exact path + index
```

---

# 16. Adding another blockchain

Do not clone an existing chain block and merely replace the symbol.

Before adding a chain, document and test:

1. coin type registry value;
2. network identifiers;
3. curve;
4. mnemonic/seed scheme;
5. purpose;
6. complete derivation path;
7. account semantics;
8. change semantics;
9. public-key format;
10. extended-key serialization;
11. address encoding;
12. checksum;
13. testnet differences;
14. independent reference vectors;
15. runtime input/output contract;
16. application address-allocation semantics.

Only then add the chain to the runtime allowlist.

---

# 17. What this project deliberately does not do

This repository is not currently:

- a transaction signer;
- a hot-wallet signing service;
- a hardware-wallet manager;
- a blockchain indexer;
- a balance scanner;
- an address allocator/database;
- a token accounting engine;
- an order-management system;
- a web UI;
- a complete custody policy.

Keeping these boundaries explicit is a security feature.

---

# 18. Production-readiness checklist

Before real-money production use, this repository should have:

- a committed dependency lockfile generated from a clean environment;
- complete official BIP-32/BIP-39 vector coverage;
- independent differential testing;
- formal TON wallet configuration fixtures;
- explicit mainnet/testnet policies;
- versioned encrypted-backup schema;
- secret scanning and dependency scanning in CI;
- reproducible release artifacts/checksums;
- documented signing architecture outside the runtime derivation server;
- concurrency-safe application index allocation;
- an external security review.

Until then, classify this repository as a **security-conscious prototype/toolkit**, not independently audited custody infrastructure.

---

# 19. Canonical standards

Primary references:

- BIP-32 — Hierarchical Deterministic Wallets
- BIP-39 — Mnemonic code for generating deterministic keys
- BIP-43 — Purpose Field for Deterministic Wallets
- BIP-44 — Multi-Account Hierarchy for Deterministic Wallets
- BIP-84 — Derivation scheme for P2WPKH based accounts
- SLIP-0010 — Universal private key derivation
- SLIP-0044 — Registered coin types
- SLIP-0132 — Registered HD version bytes
- Trust Wallet Core — wallet-core implementation
- TON TEP-3 — TON wallet guidelines

See `docs/STANDARDS.md` for the repository-specific interpretation and `docs/REFERENCES.md` for canonical links.

## License

MIT
