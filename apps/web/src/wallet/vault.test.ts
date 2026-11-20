// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  changePassword,
  createVault,
  deleteVault,
  deleteVaultBackup,
  getSessionPassphrase,
  hasVault,
  hasVaultBackup,
  isLocked,
  isTestVault,
  lock,
  PBKDF2_ITERATIONS,
  restoreVaultFromBackup,
  TEST_PROVENANCE,
  unlock,
  VAULT_BACKUP_STORAGE_KEY,
  VAULT_CORRUPTED,
  VAULT_ERROR_CODES,
  VAULT_STORAGE_KEY,
  VAULT_WRONG_PASSWORD,
  VaultError,
  vaultProfiles,
  vaultProvenance,
  verifyVaultPassword,
  withMnemonic,
  withMnemonicAsync,
  writeVaultBackup,
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
    expect(isLocked()).toBe(false);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('leaves the vault unlocked with the session passphrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    expect(isLocked()).toBe(false);
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
    lock();
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

  it('fails closed on a structurally invalid envelope', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, version: 'not-a-number' }),
    );
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_CORRUPTED);
    expect(hasVault()).toBe(true);
  });

  it('fails loudly with the unknown-version code for a newer envelope', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, version: 2 }),
    );
    let caught: unknown;
    try {
      await unlock(TEST_PASSWORD);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VaultError);
    expect((caught as VaultError).code).toBe(
      VAULT_ERROR_CODES.UNKNOWN_VERSION,
    );
    expect((caught as Error).message).toBe('Vault version is not supported.');
    expect(isLocked()).toBe(true);
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
    lock();
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

describe('vault backup', () => {
  it('writes a backup equal to the primary envelope, with no plaintext', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVaultBackup()).toBe(true);
    const primary = localStorage.getItem(VAULT_STORAGE_KEY) as string;
    const backup = localStorage.getItem(VAULT_BACKUP_STORAGE_KEY) as string;
    expect(backup).toBe(primary);
    expect(backup).not.toContain('abandon');
    expect(backup).not.toContain('about');
    expect(backup).not.toContain(TEST_PASSWORD);
  });

  it('restores the vault from backup after the primary is lost', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    localStorage.removeItem(VAULT_STORAGE_KEY);
    expect(hasVault()).toBe(false);
    await restoreVaultFromBackup(TEST_PASSWORD);
    expect(hasVault()).toBe(true);
    expect(isLocked()).toBe(false);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
  });

  it('restores from backup after the primary is damaged', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    localStorage.setItem(VAULT_STORAGE_KEY, '{"version":1,"kdf":}');
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_CORRUPTED);
    await restoreVaultFromBackup(TEST_PASSWORD);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('refuses a restore with the wrong password and leaves the primary untouched', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    localStorage.removeItem(VAULT_STORAGE_KEY);
    await expect(restoreVaultFromBackup('wrong password')).rejects.toThrow(
      VAULT_WRONG_PASSWORD,
    );
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
    expect(isLocked()).toBe(true);
    // The right password still restores afterwards.
    await restoreVaultFromBackup(TEST_PASSWORD);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('throws when there is no backup to restore from', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    deleteVaultBackup();
    localStorage.removeItem(VAULT_STORAGE_KEY);
    await expect(restoreVaultFromBackup(TEST_PASSWORD)).rejects.toThrow(
      'No vault backup exists.',
    );
  });

  it('throws when the backup itself is corrupt', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.setItem(VAULT_BACKUP_STORAGE_KEY, 'not json at all');
    await expect(restoreVaultFromBackup(TEST_PASSWORD)).rejects.toThrow(
      VAULT_CORRUPTED,
    );
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
  });

  it('refreshes the backup on password change so the new password restores', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await changePassword(TEST_PASSWORD, 'new password here');
    localStorage.removeItem(VAULT_STORAGE_KEY);
    await expect(restoreVaultFromBackup(TEST_PASSWORD)).rejects.toThrow(
      VAULT_WRONG_PASSWORD,
    );
    await restoreVaultFromBackup('new password here');
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('deletes the backup when the vault is deleted', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVaultBackup()).toBe(true);
    deleteVault();
    expect(hasVaultBackup()).toBe(false);
    expect(localStorage.getItem(VAULT_BACKUP_STORAGE_KEY)).toBeNull();
  });

  it('writeVaultBackup throws with no vault', () => {
    expect(() => writeVaultBackup()).toThrow('No vault exists.');
  });
});

describe('vault migration', () => {
  it('rejects versions 0 and 99 with the unknown-version code', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    for (const version of [0, 99]) {
      const envelope = readRawEnvelope();
      localStorage.setItem(
        VAULT_STORAGE_KEY,
        JSON.stringify({ ...envelope, version }),
      );
      let caught: unknown;
      try {
        await unlock(TEST_PASSWORD);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(VaultError);
      expect((caught as VaultError).code).toBe(
        VAULT_ERROR_CODES.UNKNOWN_VERSION,
      );
    }
  });

  it('rejects a non-object envelope as corrupted', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.setItem(VAULT_STORAGE_KEY, '"just a string"');
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_CORRUPTED);
    localStorage.setItem(VAULT_STORAGE_KEY, 'null');
    await expect(unlock(TEST_PASSWORD)).rejects.toThrow(VAULT_CORRUPTED);
  });

  it('migrates a version-1 envelope without provenance to unknown provenance', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    delete (envelope as Record<string, unknown>).provenance;
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
    expect(vaultProvenance()).toEqual({ source: 'unknown', isTesting: false });
    expect(isTestVault()).toBe(false);
  });
});

describe('vault errors', () => {
  it('rejects a wrong password with a VaultError carrying code 1001', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    let caught: unknown;
    try {
      await unlock('wrong password');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VaultError);
    expect((caught as VaultError).code).toBe(
      VAULT_ERROR_CODES.WRONG_PASSWORD,
    );
    expect((caught as Error).message).toBe(VAULT_WRONG_PASSWORD);
  });

  it('throws a VaultError with code 1004 when locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    let caught: unknown;
    try {
      withMnemonic((m) => m);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VaultError);
    expect((caught as VaultError).code).toBe(VAULT_ERROR_CODES.LOCKED);
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow(
      'Vault is locked.',
    );
  });
});

describe('vault provenance', () => {
  it('defaults to created, not testing', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(vaultProvenance()).toEqual({ source: 'created', isTesting: false });
    expect(isTestVault()).toBe(false);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
  });

  it('records test provenance and reports a test vault', async () => {
    await createVault(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      TEST_PROFILES,
      '',
      TEST_PROVENANCE,
    );
    expect(vaultProvenance()).toEqual({ source: 'test', isTesting: true });
    expect(isTestVault()).toBe(true);
    const envelope = readRawEnvelope();
    expect(envelope.provenance).toEqual({ source: 'test', isTesting: true });
  });

  it('preserves test provenance across a password change', async () => {
    await createVault(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      TEST_PROFILES,
      '',
      TEST_PROVENANCE,
    );
    await changePassword(TEST_PASSWORD, 'new password here');
    expect(vaultProvenance()).toEqual({ source: 'test', isTesting: true });
    expect(isTestVault()).toBe(true);
  });

  it('reports null provenance with no vault', () => {
    expect(vaultProvenance()).toBeNull();
    expect(isTestVault()).toBe(false);
  });

  it('rejects a malformed stored provenance as corrupted', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({
        ...envelope,
        provenance: { source: 'hardware', isTesting: 'yes' },
      }),
    );
    expect(() => vaultProvenance()).toThrow(VAULT_CORRUPTED);
  });
});

describe('verifyVaultPassword', () => {
  it('returns true for the right password without unlocking', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    expect(await verifyVaultPassword(TEST_PASSWORD)).toBe(true);
    expect(isLocked()).toBe(true);
  });

  it('returns false for a wrong password and stays locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    expect(await verifyVaultPassword('wrong password')).toBe(false);
    expect(isLocked()).toBe(true);
    expect(() => withMnemonic((m) => m)).toThrow('Vault is locked.');
  });

  it('returns false with no vault', async () => {
    expect(await verifyVaultPassword(TEST_PASSWORD)).toBe(false);
  });
});
