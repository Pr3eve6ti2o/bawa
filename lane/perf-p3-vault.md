# Lane A perf, prompt 3: createVault leaves the vault unlocked (self-contained)

You have no filesystem or shell access. Return ONLY replacement code blocks
in markdown code fences, labelled with the block they replace, nothing else.
Do not explain, do not invent other files.

## Context

`apps/web/src/wallet/vault.ts` — password-protected encrypted local vault.
`PBKDF2_ITERATIONS = 600_000`, cipher AES-GCM-256. Both stay exactly as
they are: this change must NOT weaken any security parameter.

Today `createVault` ends with `lock()`, so every caller pays a SECOND
PBKDF2 derivation via `unlockVault` immediately after creating, before the
wallet can show. Measured: PBKDF2 is 77–99 ms per derivation on this
machine's Chromium and several times slower on a phone CPU — and it is
pure waste, because the key is already derived and in memory during
creation. Goal: creation leaves the vault unlocked, exactly as `unlock()`
holds it, so callers never re-derive.

## Security argument (the change must satisfy this)

- The derived key and the mnemonic are already in memory inside
  `encryptEnvelope`/`createVault` during creation. Retaining them is the
  SAME in-memory state `unlock()` produces — no new exposure, no new
  storage: the envelope written to localStorage is byte-identical.
- `lock()` still drops every reference. A failed creation sets nothing.
- The BIP-39 session passphrase must be retained correctly: `createVault`
  gains an optional 4th parameter `passphrase = ''` and stores it as the
  session passphrase, mirroring `unlock(password, passphrase)`. Callers
  pass the passphrase they already hold; nothing is stored on disk.

## Task

1. `encryptEnvelope`: return the derived key alongside the envelope:
   `Promise<{ envelope: VaultEnvelope; key: CryptoKey }>`.
2. `createVault(mnemonic, password, profileIds, passphrase = '')`:
   destructure the result, `writeEnvelope(envelope)`, then set the
   in-memory unlocked state (`unlockedKey`, `unlockedMnemonic`,
   `unlockedPassphrase = passphrase`) instead of calling `lock()`.
   All existing validation and errors stay identical.
3. `changePassword`: adapt to the new `encryptEnvelope` return shape
   (it only needs the envelope); all other behaviour identical.
4. Update the 4 affected tests in `apps/web/src/wallet/vault.test.ts`
   (current blocks below) and ADD one new test after `creates a vault
   and reports it`:
   - `creates a vault and reports it`: vault is UNLOCKED after create
     (`isLocked()` false) and `withMnemonic` returns the mnemonic.
   - `rejects a wrong password...`: `lock()` after `createVault`, so the
     wrong-password unlock is attempted from a locked vault (as before).
   - `fails closed on a tampered ciphertext`: `lock()` after
     `createVault`, so the failed unlock leaves the vault locked.
   - `throws when locked` (withMnemonicAsync describe): `lock()` after
     `createVault`, so the callback still throws 'Vault is locked.'.
   - NEW test `leaves the vault unlocked with the session passphrase`:
     `createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR')`,
     then `isLocked()` false, `getSessionPassphrase()` is `'TREZOR'`,
     `withMnemonic((m) => m)` is `TEST_MNEMONIC`.
   No other test changes. Do NOT change `PBKDF2_ITERATIONS`,
   `PBKDF2_HASH`, `VAULT_CIPHER`, `VAULT_KEY_BITS`, `SALT_BYTES`,
   `IV_BYTES`, or the envelope format.

## Acceptance

`tsc --noEmit` clean and the vault test file passes with the rest of the
project unchanged; `createVault` performs exactly ONE PBKDF2 derivation;
a vault created with a passphrase derives with that passphrase.

## Current code

`encryptEnvelope`:

```ts
async function encryptEnvelope(
  mnemonic: string,
  password: string,
  profileIds: string[],
): Promise<VaultEnvelope> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: VAULT_CIPHER, iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic),
  );
  return {
    version: VAULT_VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      iterations: PBKDF2_ITERATIONS,
      saltB64: toBase64(salt),
    },
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(ciphertext)),
    profileIds: [...profileIds],
  };
}
```

`createVault`:

```ts
export async function createVault(
  mnemonic: string,
  password: string,
  profileIds: string[],
): Promise<void> {
  if (mnemonic.length === 0) {
    throw new Error('Mnemonic must not be empty.');
  }
  if (password.length === 0) {
    throw new Error('Password must not be empty.');
  }
  if (hasVault()) {
    throw new Error('A vault already exists.');
  }
  const envelope = await encryptEnvelope(mnemonic, password, profileIds);
  writeEnvelope(envelope);
  lock();
}
```

`changePassword` (envelope use only):

```ts
  const wasLocked = isLocked();
  await unlock(oldPassword);
  const mnemonic = unlockedMnemonic as string;
  const next = await encryptEnvelope(mnemonic, newPassword, envelope.profileIds);
  writeEnvelope(next);
```

Tests:

```ts
  it('creates a vault and reports it', async () => {
    expect(hasVault()).toBe(false);
    expect(vaultProfiles()).toBeNull();
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVault()).toBe(true);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(isLocked()).toBe(true);
  });
```

```ts
  it('rejects a wrong password with one fixed message and stays locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(unlock('wrong password')).rejects.toThrow(
      VAULT_WRONG_PASSWORD,
    );
    expect(isLocked()).toBe(true);
    expect(() => withMnemonic((m) => m)).toThrow('Vault is locked.');
  });
```

```ts
  it('fails closed on a tampered ciphertext', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    const ciphertext = envelope.ciphertextB64 as string;
    const flipped =
      (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, ciphertextB64: flipped }),
    );
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_WRONG_PASSWORD);
    expect(isLocked()).toBe(true);
  });
```

```ts
  it('throws when locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow(
      'Vault is locked.',
    );
  });
```
