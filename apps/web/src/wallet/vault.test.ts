// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  changePassword,
  createVault,
  deleteVault,
  getSessionPassphrase,
  hasVault,
  isLocked,
  lock,
  PBKDF2_ITERATIONS,
  unlock,
  VAULT_CORRUPTED,
  VAULT_STORAGE_KEY,
  VAULT_WRONG_PASSWORD,
  vaultProfiles,
  withMnemonic,
  withMnemonicAsync,
} from './vault';

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

function decodeB64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

beforeEach(() => {
  localStorage.clear();
  lock();
});

describe('vault', () => {
  it('creates a vault and reports it', async () => {
    expect(hasVault()).toBe(false);
    expect(vaultProfiles()).toBeNull();
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVault()).toBe(true);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(isLocked()).toBe(true);
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

  it('unlocks with the right password and exposes the mnemonic only while unlocked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await unlock(TEST_PASSWORD);
    expect(isLocked()).toBe(false);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    lock();
    expect(isLocked()).toBe(true);
    expect(() => withMnemonic((m) => m)).toThrow('Vault is locked.');
  });

  it('rejects a wrong password with one fixed message and stays locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(unlock('wrong password')).rejects.toThrow(
      VAULT_WRONG_PASSWORD,
    );
    expect(isLocked()).toBe(true);
    expect(() => withMnemonic((m) => m)).toThrow('Vault is locked.');
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

  it('changes the password and keeps the stored profiles', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await changePassword(TEST_PASSWORD, 'new password here');
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_WRONG_PASSWORD);
    await unlock('new password here');
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
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
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_WRONG_PASSWORD);
    expect(isLocked()).toBe(true);
  });

  it('fails closed on a structurally invalid envelope', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, version: 2 }),
    );
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_CORRUPTED);
    expect(hasVault()).toBe(true);
  });

  it('deletes the vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    deleteVault();
    expect(hasVault()).toBe(false);
    expect(vaultProfiles()).toBeNull();
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow('No vault exists.');
  });
});

describe('withMnemonicAsync', () => {
  it('awaits an async callback with the mnemonic while unlocked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await unlock(TEST_PASSWORD);
    const seen = await withMnemonicAsync(async (mnemonic) => {
      await Promise.resolve();
      return mnemonic;
    });
    expect(seen).toBe(TEST_MNEMONIC);
  });

  it('throws when locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow(
      'Vault is locked.',
    );
  });
});

describe('session passphrase', () => {
  it('stores the unlock passphrase for the session and clears it on lock', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(getSessionPassphrase()).toBe('');
    await unlock(TEST_PASSWORD, 'TREZOR');
    expect(getSessionPassphrase()).toBe('TREZOR');
    lock();
    expect(getSessionPassphrase()).toBe('');
  });

  it('defaults to an empty session passphrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await unlock(TEST_PASSWORD);
    expect(getSessionPassphrase()).toBe('');
  });
});
