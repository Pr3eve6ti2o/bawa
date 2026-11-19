```ts title="apps/web/src/wallet/vault.ts — encryptEnvelope"
async function encryptEnvelope(
  mnemonic: string,
  password: string,
  profileIds: string[],
): Promise<{ envelope: VaultEnvelope; key: CryptoKey }> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: VAULT_CIPHER, iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic),
  );
  return {
    envelope: {
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
    },
    key,
  };
}
```

```ts title="apps/web/src/wallet/vault.ts — createVault"
export async function createVault(
  mnemonic: string,
  password: string,
  profileIds: string[],
  passphrase = '',
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
  const { envelope, key } = await encryptEnvelope(mnemonic, password, profileIds);
  writeEnvelope(envelope);
  unlockedKey = key;
  unlockedMnemonic = mnemonic;
  unlockedPassphrase = passphrase;
}
```

```ts title="apps/web/src/wallet/vault.ts — changePassword (envelope use only)"
  const wasLocked = isLocked();
  await unlock(oldPassword);
  const mnemonic = unlockedMnemonic as string;
  const { envelope: next } = await encryptEnvelope(
    mnemonic,
    newPassword,
    envelope.profileIds,
  );
  writeEnvelope(next);
```

```ts title="apps/web/src/wallet/vault.test.ts — creates a vault and reports it"
  it('creates a vault and reports it', async () => {
    expect(hasVault()).toBe(false);
    expect(vaultProfiles()).toBeNull();
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVault()).toBe(true);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(isLocked()).toBe(false);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('leaves the vault unlocked with the session passphrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    expect(isLocked()).toBe(false);
    expect(getSessionPassphrase()).toBe('TREZOR');
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });
```

```ts title="apps/web/src/wallet/vault.test.ts — rejects a wrong password with one fixed message and stays locked"
  it('rejects a wrong password with one fixed message and stays locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    await expect(unlock('wrong password')).rejects.toThrow(
      VAULT_WRONG_PASSWORD,
    );
    expect(isLocked()).toBe(true);
    expect(() => withMnemonic((m) => m)).toThrow('Vault is locked.');
  });
```

```ts title="apps/web/src/wallet/vault.test.ts — fails closed on a tampered ciphertext"
  it('fails closed on a tampered ciphertext', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
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

```ts title="apps/web/src/wallet/vault.test.ts — withMnemonicAsync: throws when locked"
  it('throws when locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow(
      'Vault is locked.',
    );
  });
```