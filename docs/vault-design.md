# Vault design

Bawa's web wallet keeps one password-protected encrypted vault in the
browser. This document states the envelope format, the threat boundary,
the plaintext lifetime, the backup and migration rules, the KDF
evaluation, and the error codes. It is the home for vault facts; the
code is `apps/web/src/wallet/vault.ts` and its tests are
`apps/web/src/wallet/vault.test.ts`.

## Envelope

The vault is one JSON envelope in `localStorage` under the key
`bawa-vault`:

```json
{
  "version": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "saltB64": "..." },
  "ivB64": "...",
  "ciphertextB64": "...",
  "profileIds": ["bawa-evm-bip44-v1", "bawa-btc-bip84-v1"],
  "provenance": { "source": "created", "isTesting": false }
}
```

- Encryption is AES-GCM-256 with a random 12-byte IV per envelope.
  AES-GCM authenticates the ciphertext: a wrong password and a tampered
  ciphertext are indistinguishable by design, and both fail with one
  fixed message. There is no oracle that tells an attacker which one
  happened.
- The KDF is PBKDF2-SHA-256 with 600,000 iterations and a random
  16-byte salt per envelope. The iteration count is stored in the
  envelope so an unlock honours the count the vault was created with.
- The envelope holds only version, KDF parameters, salt, IV,
  ciphertext, recovery `profileIds`, and provenance metadata — never a
  mnemonic, seed, key, or password.
- `provenance` records where the vault's key came from. `source` is
  `'created'` (generated in this app), `'imported'` (restored from
  words), `'test'` (a test-only identity), or `'unknown'` (an envelope
  written before provenance existed). `isTesting` marks a test-only
  identity. The flag alone is **not** enforcement: nothing in the
  vault blocks a test-marked account from signing. The send boundary
  enforces that; see `docs/custody.md`.

## Threat boundary

- The vault protects the mnemonic at rest in this browser against
  anyone who can read `localStorage` but does not know the password.
  It does not protect against code running in the page (a compromised
  script or extension with page access can read the mnemonic while the
  vault is unlocked), against a compromised device, or against the user
  giving the password or the words away.
- The password is the only secret that unlocks the vault. There is no
  password recovery: a forgotten password means the vault can only be
  replaced by restoring from the 24 words.
- The backup (below) is a second copy of the same encrypted envelope
  in the same browser's `localStorage`. It protects against a damaged
  primary envelope, not against whole-profile loss, device loss, or
  theft of the browser profile.

## Plaintext lifetime

The decrypted mnemonic lives only transiently in the vault module's
closure while the vault is unlocked. It is never held in React state,
component refs, `localStorage`, or logs. `lock()` drops every
reference to the key and the mnemonic. JavaScript strings are
immutable, so "zeroing" means dropping every reference, not overwriting
bytes; no copy is retained anywhere after `lock()`. (An earlier draft
of this document cited a single-use secret-handoff module at
`apps/web/src/wallet/secret-handoff.ts`; no such file exists at
token-gaps `ceade79` — the module is gone, so the sentence about it
was removed 2026-11-28.)

## Backup and restore

- The backup key is `bawa-vault-backup` and holds a verbatim copy of
  the primary envelope string — the same encrypted envelope, never
  plaintext.
- `createVault` and `changePassword` refresh the backup after the
  primary write succeeds, so the backup always matches the current
  primary.
- `restoreVaultFromBackup(password)` first proves the backup decrypts
  with the given password without touching the primary or changing
  locked state. Only on success does it overwrite the primary envelope
  with the backup and unlock. A wrong password, a missing backup, or a
  corrupt backup leaves the primary exactly as it was.
- Restoring from backup does not change the password: the backup was
  encrypted under the same password as the primary it copies.

## Migration

`VAULT_VERSION` is 1. `migrateEnvelope` is the dispatcher every read
goes through:

- Version 1 passes through after the existing shape checks.
- Any other version number fails loudly with error code 1006
  (`UNKNOWN_VERSION`, "Vault version is not supported."). It is never
  silently treated as version 1, and never coerced.
- A malformed envelope fails with code 1002 (`CORRUPTED`).
- A future version adds one migrator function to `VAULT_MIGRATORS`,
  keyed by version number. Version 1 needs no migrator.

## Errors

Vault failures are `VaultError` (an `Error` with a numeric `code`).
Message text is kept separate from codes; the messages below are the
current text, not part of the code contract.

| Code | Name | Meaning |
| --- | --- | --- |
| 1001 | `WRONG_PASSWORD` | Incorrect password. (Also the message for a tampered ciphertext — see above.) |
| 1002 | `CORRUPTED` | Vault is corrupted. |
| 1003 | `NOT_FOUND` | No vault exists. |
| 1004 | `LOCKED` | Vault is locked. |
| 1005 | `EXISTS` | A vault already exists. |
| 1006 | `UNKNOWN_VERSION` | Vault version is not supported. |
| 1007 | `BACKUP_MISSING` | No vault backup exists. |
| 1008 | `BACKUP_CORRUPTED` | Vault backup is corrupted. |

These codes are the vault's contract, defined in the shared error
catalogue (`apps/web/src/wallet/errors.ts`): codes 1001–1005 match the
catalogue exactly as P1 defined it, and 1006–1008 — proposed additions
when this document was written — have since been adopted by the
catalogue, so the vault imports all eight codes from it instead of
defining them locally. The empty-mnemonic and empty-password failures
keep their existing plain `Error` messages (`'Mnemonic must not be
empty.'`, `'Password must not be empty.'`): the catalogue has no
distinct code for them, and changing their messages would break
existing callers for no diagnostic gain.

## KDF evaluation (item 14)

Measured 2026-11-20 on gray-pinee, Node v22.23.4, server CPU, one
process per case, peak memory by `/usr/bin/time -v`. These are
server-CPU numbers: a phone browser will be several times slower for
every case, so treat the ratios as the finding, not the absolute
milliseconds.

| KDF | Time | Peak RSS | Note |
| --- | --- | --- | --- |
| PBKDF2-SHA-256, 600,000 iters (WebCrypto — the current vault) | 82–96 ms | ~47 MB (baseline) | CPU-hard, not memory-hard |
| scrypt Weak, N=2^14, r=8, p=1 (wallet-core `StoredKey` Default) | 57–61 ms | ~62 MB | **Faster than PBKDF2-600k — weaker overall, not stronger** |
| scrypt N=2^15, r=8, p=1 | 89–111 ms | ~79 MB | Same CPU cost as PBKDF2-600k, +32 MB memory |
| scrypt Standard, N=2^18, r=8, p=1 (~256 MB) | 736–818 ms | ~308 MB | ~9x the CPU cost, +261 MB memory |

Decision: **keep PBKDF2-600,000 / AES-GCM-256; do not switch.**

- The `StoredKey` Default preset maps to Weak scrypt, which measured
  faster than the current PBKDF2 — adopting it would weaken the vault.
- Standard scrypt is genuinely stronger (~9x CPU, memory-hard), but
  at +261 MB per unlock it risks tab out-of-memory failures and
  multi-second unlocks on low-memory phones, and it was measured in
  Node, not in a real browser tab. Adoption would require in-browser
  benchmarking on representative phones first.
- N=2^15 is a wash on CPU for a small memory-hardness gain; not worth
  a format migration on its own.
- Argon2 was not measured: no argon2 implementation is available in
  the app without a new dependency, which would need its own audit.
  It is not adopted by this evaluation.

The `StoredKey` format is not adopted either: Bawa's authenticated
AES-GCM envelope is the better cipher choice, and the vault keeps its
own format. Revisit the KDF only with in-browser measurements on real
devices, or if a reviewed argon2/scrypt implementation lands in the
app's dependencies.
