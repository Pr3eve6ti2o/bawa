// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autoUnlock,
  changePassword,
  createVault,
  deleteVault,
  getSessionPassphrase,
  hasVault,
  PBKDF2_ITERATIONS,
  VAULT_CORRUPTED,
  VAULT_KEY_STORAGE_KEY,
  VAULT_STORAGE_KEY,
  vaultProfiles,
  withMnemonic,
  withMnemonicAsync,
} from './vault';

// Vault-lock removal (owner order 2026-11-20): isLocked/lock/unlock no
// longer exist, so every test that asserted lock behaviour was removed:
// - "unlocks with the right password..." (unlock + lock cycle)
// - "rejects a wrong password..." — there is no password check any more;
//   a wrong stored key / tampered ciphertext is covered by autoUnlock
//   returning false (see 'autoUnlock' below), not by a rejection.
// - "throws when locked" (withMnemonicAsync) — replaced by the
//   not-unlocked case below.
// The auto-lock timer tests lived in state/wallet-context.test.tsx and
// were removed with the timer itself.

function decodeB64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeB64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// Standard public BIP-39 test vector — disposable test data, never a real secret.
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_PROFILES = ['bawa-evm-bip44-v1', 'bawa-btc-bip84-v1'];

function readRawEnvelope(): Record<string, unknown> {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string) as Record<string, unknown>;
}

/**
 * A fresh vault module, as if the page had reloaded: the closure (and its
 * mnemonic) starts empty while localStorage keeps whatever the test put
 * there. This is how autoUnlock is exercised honestly — the statically
 * imported module keeps the mnemonic from createVault in its closure.
 */
async function freshVaultModule(): Promise<typeof import('./vault')> {
  vi.resetModules();
  return import('./vault');
}

beforeEach(() => {
  localStorage.clear();
  deleteVault();
});

describe('vault', () => {
  it('creates a vault and reports it', async () => {
    expect(hasVault()).toBe(false);
    expect(vaultProfiles()).toBeNull();
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVault()).toBe(true);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('keeps the session passphrase after creation', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    expect(getSessionPassphrase()).toBe('TREZOR');
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('stores only an encrypted envelope, never plaintext secrets', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const raw = localStorage.getItem(VAULT_STORAGE_KEY) as string;
    expect(raw).not.toContain('abandon');
    expect(raw).not.toContain('about');
    expect(raw).not.toContain(TEST_PASSWORD);
    expect(raw).not.toContain('correct horse');
    const envelope = readRawEnvelope();
    expect(envelope.version).toBe(1);
    expect(envelope.profileIds).toEqual(TEST_PROFILES);
    const kdf = envelope.kdf as Record<string, unknown>;
    expect(kdf.iterations).toBe(PBKDF2_ITERATIONS);
    expect(kdf.hash).toBe('SHA-256');
    expect(decodeB64(kdf.saltB64 as string).length).toBe(16);
    expect(decodeB64(envelope.ivB64 as string).length).toBe(12);
    expect(typeof envelope.ciphertextB64).toBe('string');
  });

  it('stores the derived key at creation (auto-unlock)', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const storedKey = localStorage.getItem(VAULT_KEY_STORAGE_KEY);
    expect(storedKey).not.toBeNull();
    // The stored key is the raw 32-byte AES-GCM key, base64.
    expect(decodeB64(storedKey as string).length).toBe(32);
    expect(storedKey).not.toBe(
      readRawEnvelope().ciphertextB64 as string,
    );
    // The key entry holds key bytes only — never the mnemonic or password.
    expect(storedKey).not.toContain('abandon');
    expect(storedKey).not.toContain(TEST_PASSWORD);
  });

  it('refuses to create a second vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(
      createVault(TEST_MNEMONIC, 'another password', TEST_PROFILES),
    ).rejects.toThrow('A vault already exists.');
  });

  it('refuses empty mnemonic and password', async () => {
    await expect(createVault('', TEST_PASSWORD, TEST_PROFILES)).rejects.toThrow(
      'Mnemonic must not be empty.',
    );
    await expect(createVault(TEST_MNEMONIC, '', TEST_PROFILES)).rejects.toThrow(
      'Password must not be empty.',
    );
  });

  it('changes the password, keeps the stored profiles, and stays auto-unlockable', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const keyBefore = localStorage.getItem(VAULT_KEY_STORAGE_KEY);
    const envelopeBefore = localStorage.getItem(VAULT_STORAGE_KEY);
    await changePassword('new password here');
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    // A new salt means a new derived key and a new envelope.
    expect(localStorage.getItem(VAULT_KEY_STORAGE_KEY)).not.toBe(keyBefore);
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).not.toBe(envelopeBefore);
    // The new stored key decrypts the new envelope after a reload.
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(true);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('changePassword refuses an empty new password and a missing vault', async () => {
    await expect(changePassword('')).rejects.toThrow(
      'Password must not be empty.',
    );
    await expect(changePassword('new password here')).rejects.toThrow(
      'No vault exists.',
    );
  });

  it('changePassword throws when the mnemonic is not available', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const fresh = await freshVaultModule();
    // The fresh module never auto-unlocked, so no mnemonic is in its closure.
    await expect(fresh.changePassword('new password here')).rejects.toThrow(
      'Vault is not unlocked.',
    );
  });

  it('deletes the vault and its stored key', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    deleteVault();
    expect(hasVault()).toBe(false);
    expect(vaultProfiles()).toBeNull();
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(VAULT_KEY_STORAGE_KEY)).toBeNull();
    expect(() => withMnemonic((m) => m)).toThrow('Vault is not unlocked.');
  });
});

describe('autoUnlock', () => {
  it('restores the mnemonic from the stored key after a reload', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(true);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('restores the mnemonic but not the session passphrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(true);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    // The passphrase was never persisted, so a reload loses it.
    expect(fresh.getSessionPassphrase()).toBe('');
  });

  it('returns false and does not throw when there is no vault', async () => {
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(false);
    expect(() => fresh.withMnemonic((m) => m)).toThrow(
      'Vault is not unlocked.',
    );
  });

  it('returns false when the stored key is missing (legacy vault)', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.removeItem(VAULT_KEY_STORAGE_KEY);
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(false);
    expect(() => fresh.withMnemonic((m) => m)).toThrow(
      'Vault is not unlocked.',
    );
    // The vault still exists — it just cannot auto-unlock.
    expect(fresh.hasVault()).toBe(true);
  });

  it('returns false when the stored key does not match the envelope', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const wrongKey = new Uint8Array(32);
    globalThis.crypto.getRandomValues(wrongKey);
    localStorage.setItem(VAULT_KEY_STORAGE_KEY, encodeB64(wrongKey));
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(false);
    expect(() => fresh.withMnemonic((m) => m)).toThrow(
      'Vault is not unlocked.',
    );
  });

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
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(false);
    expect(() => fresh.withMnemonic((m) => m)).toThrow(
      'Vault is not unlocked.',
    );
  });

  it('fails closed on a structurally invalid envelope', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, version: 2 }),
    );
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(false);
    expect(fresh.hasVault()).toBe(true);
  });

  it('throws VAULT_CORRUPTED only when the envelope is read directly', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, version: 2 }),
    );
    expect(() => vaultProfiles()).toThrow(VAULT_CORRUPTED);
  });
});

describe('withMnemonicAsync', () => {
  it('awaits an async callback with the mnemonic while open', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const seen = await withMnemonicAsync(async (mnemonic) => {
      await Promise.resolve();
      return mnemonic;
    });
    expect(seen).toBe(TEST_MNEMONIC);
  });

  it('throws when no mnemonic is available', async () => {
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow(
      'Vault is not unlocked.',
    );
  });
});

describe('session passphrase', () => {
  it('stores the creation passphrase for the session and clears it on delete', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    expect(getSessionPassphrase()).toBe('TREZOR');
    deleteVault();
    expect(getSessionPassphrase()).toBe('');
  });

  it('defaults to an empty session passphrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(getSessionPassphrase()).toBe('');
  });
});
