# Custody

How Bawa holds the user's keys, what the app guarantees, and what it
does not. This is the home for custody facts; the vault is
`apps/web/src/wallet/vault.ts`, its design is `docs/vault-design.md`,
and the signing boundary is `apps/web/src/wallet/core.ts` /
`apps/web/src/wallet/send.ts`.

## What custody means here

Bawa is a genuine self-custodial wallet: the 24-word recovery phrase
is generated in the browser, encrypted under the user's password, and
stored only in this browser's `localStorage`. No server, no account,
and no other party holds a copy. Losing both the password and the
words means losing the wallet — there is no recovery path the app can
offer, and anyone who learns the words can spend from the wallet.

## What the app guarantees

- **Encrypted at rest.** The mnemonic is stored only as an
  AES-GCM-256 ciphertext inside the versioned vault envelope
  (`docs/vault-design.md`). The envelope never contains a mnemonic,
  seed, key, or password in plaintext.
- **Transient plaintext.** The decrypted mnemonic lives only in the
  vault module's closure while unlocked, and `lock()` drops every
  reference. It is never held in React state, component refs,
  `localStorage`, or logs. JavaScript strings cannot be overwritten,
  so "dropped" is the guarantee — not byte-level erasure.
- **Single-use handoff.** Secrets passed between screens use
  `apps/web/src/wallet/secret-handoff.ts`: in-memory only, under
  incrementing numeric IDs, consumed on retrieval, never persisted,
  never put in navigation state, never logged. IDs are routing
  handles, not authorisation tokens, and deletion is not guaranteed
  memory erasure.
- **Gated reveal.** The recovery phrase is shown only on the mnemonic
  backup screen, and only after a password re-prompt (password-only reveal — the safety quiz was removed, S3-A; `apps/web/src/screens/backup.tsx`). The
  password is verified first without changing lock state; only a
  correct password unlocks the vault, which the reveal needs — so
  revealing does leave the vault unlocked, and the screen offers
  "Hide recovery phrase and lock vault" to lock it again. The phrase
  is cleared from screen state when hidden or when the screen
  unmounts.
- **Test identities are marked, not enforced, here.** A vault created
  with test provenance carries `isTesting: true` in its envelope, and
  `isTestVault()` reports it. The flag alone does not block anything:
  the send boundary must refuse to broadcast from a test-marked
  account, and that enforcement lives in the send path, not in the
  vault. A test that only checks the flag proves marking, not safety.

## What the app does not guarantee

- **No protection while unlocked against page code.** Any script
  running in the page (including a compromised dependency or
  extension with page access) can read the mnemonic while the vault
  is unlocked. Keep the vault locked when not signing, and keep the
  unlock lifetime short (auto-lock is configured in Security
  settings).
- **No hardware custody.** There is no Ledger, Trezor, or other
  hardware-signer support. The signing key is derived in the page by
  the Wallet Core WASM engine.
- **No backup against whole-profile loss.** The vault backup is a
  second copy of the same encrypted envelope in the same browser. It
  recovers a damaged primary envelope; it does not survive losing the
  browser profile, the device, or the password. The 24 words on paper,
  stored offline in two places, are the only whole-loss backup.
- **No broadcast safety from the vault alone.** The vault knows
  nothing about transactions. Simulation, confirmation, and the
  test-account broadcast block are send-path responsibilities.

## Unlock behaviour

- Unlocking requires the vault password (and the BIP-39 passphrase,
  if one was used at creation). A wrong password and a tampered
  ciphertext produce the same single fixed message by design.
- Locking is explicit (lock action, auto-lock timer) and drops the
  mnemonic. It also hides derived addresses and clears balances and
  history from app state until the vault is unlocked again.
- The password re-prompt on the backup screen verifies the password
  before unlocking: a wrong password never unlocks anything. A correct
  password unlocks the vault for the reveal, and hiding the phrase
  locks it again.

## Test-only identities

Test wallets in this codebase are disposable by construction: public
BIP-39 test vectors (for example the abandon-vector phrase) and
freshly generated test mnemonics, never funded with real mainnet
funds, never production keys. A vault created with `TEST_PROVENANCE`
is marked `{ source: 'test', isTesting: true }`. Test fixtures live
beside the code they exercise (`vault.test.ts`), and no test data is
production data.
