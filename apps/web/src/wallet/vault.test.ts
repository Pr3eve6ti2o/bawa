// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeAutoLockEnabled } from './auto-lock';
import {
  accountName,
  changePassword,
  clearVaultAccountNames,
  clearVaultAccounts,
  createVault,
  deleteVault,
  deleteVaultBackup,
  displayAccountName,
  getSessionPassphrase,
  hasVault,
  hasVaultBackup,
  isLocked,
  isTestVault,
  lock,
  migrateEnvelope,
  nextVaultAccounts,
  openVaultIfPasswordless,
  PBKDF2_ITERATIONS,
  readVaultAccountNames,
  readVaultAccounts,
  removeAccountName,
  removeLegacyStoredKey,
  renameAccountName,
  restoreVaultFromBackup,
  TEST_PROVENANCE,
  unlock,
  VAULT_ACCOUNT_NAMES_KEY,
  VAULT_ACCOUNTS_KEY,
  VAULT_BACKUP_STORAGE_KEY,
  VAULT_CORRUPTED,
  VAULT_STORAGE_KEY,
  VAULT_WRONG_PASSWORD,
  vaultHasPassword,
  vaultProfiles,
  vaultProvenance,
  verifyVaultPassword,
  withMnemonic,
  withMnemonicAsync,
  writeVaultAccountNames,
  writeVaultAccounts,
  writeVaultBackup,
} from './vault';
import { BTC_PROFILE_ID, EVM_PROFILE_ID } from '../state/test-helpers';
import { BawaError, ERROR_MESSAGES, WalletErrorCodes } from './errors';

// Merge 2 (layout-rebuild into adopt-proper) - Lane A2: the optional
// auto-lock vault (owner order 2026-11-20 ~23:11 IST) is merged onto the
// Merge 1 vault (provenance, backup/restore, migration,
// verifyVaultPassword). BOTH suites are kept:
// - HEAD (Merge 1): 'vault backup', 'vault migration', 'vault errors',
//   'vault provenance', 'verifyVaultPassword' - plus the shared
//   'vault', 'openVaultIfPasswordless', 'withMnemonicAsync' and 'session
//   passphrase' describes, whose HEAD versions are the superset (backup
//   assertions in the delete test; migration-aware open cases).
// - layout-rebuild: 'vault locking' and 'password-only: no key is ever
//   stored' (which replaces the deleted 'auto-lock stored-key invariant').
// Dropped, with reason: layout's two version-2 autoUnlock tests
// ('fails closed on a structurally invalid envelope' and 'throws
// VAULT_CORRUPTED only when the envelope is read directly') asserted a
// version-2 envelope throws VAULT_CORRUPTED - false under the merged
// migration (migrateEnvelope throws VAULT_UNKNOWN_VERSION for version 2).
// The same cases are covered by HEAD's three tests ('fails closed on a
// structurally invalid envelope' with a non-number version, 'fails
// closed on an unknown-version envelope' with version 2, and 'throws
// VAULT_CORRUPTED only when the envelope is read directly' with a
// missing KDF block). No coverage is lost.
// The auto-lock timer tests live in state/wallet-context.test.tsx.
// Password-only vault (owner order 2026-11-28, reversing the 14:05 IST
// autoUnlock KEEP): the whole 'autoUnlock' describe and the 'auto-lock
// stored-key invariant' describe are deleted — the mechanism is gone, no
// derived key is ever stored, and the password is optional. They are
// replaced by 'openVaultIfPasswordless', 'vaultHasPassword',
// 'removeLegacyStoredKey' and 'password-only: no key is ever stored'
// below, which pin the new behaviour instead. The 'stores the derived
// key at creation' test becomes 'stores no key at creation'; the
// change-password tests become 'changes the password and stays locked
// after reload' and 'removes the password with an empty new password'.

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
const TEST_PROFILES = [EVM_PROFILE_ID, BTC_PROFILE_ID];

function readRawEnvelope(): Record<string, unknown> {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string) as Record<string, unknown>;
}

/**
 * A fresh vault module, as if the page had reloaded: the closure (and its
 * mnemonic) starts empty while localStorage keeps whatever the test put
 * there. This is how reload behaviour is exercised honestly — the statically
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

  it('stores no key at creation (password-only)', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    // No derived key is ever written to storage: the removed auto-unlock
    // mechanism was the only writer. localStorage holds the envelope
    // only — no 'bawa-vault-key' entry exists after creation.
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
    expect(localStorage.length).toBe(3);
  });

  it('refuses to create a second vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(
      createVault(TEST_MNEMONIC, 'another password', TEST_PROFILES),
    ).rejects.toThrow('A vault already exists.');
  });

  it('refuses an empty mnemonic', async () => {
    await expect(createVault('', TEST_PASSWORD, TEST_PROFILES)).rejects.toThrow(
      'Mnemonic must not be empty.',
    );
  });

  it('accepts an empty password: a passwordless vault', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES);
    expect(hasVault()).toBe(true);
    expect(vaultHasPassword()).toBe(false);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    // The envelope still never holds plaintext.
    const raw = localStorage.getItem(VAULT_STORAGE_KEY) as string;
    expect(raw).not.toContain('abandon');
    expect(readRawEnvelope().hasPassword).toBe(false);
    // And it opens after a reload with no password prompt.
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(true);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    expect(await fresh.verifyVaultPassword('')).toBe(true);
  });

  it('changes the password, keeps the stored profiles, and stays locked after reload', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelopeBefore = localStorage.getItem(VAULT_STORAGE_KEY);
    await changePassword('new password here');
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    // A new salt means a new derived key and a new envelope.
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).not.toBe(envelopeBefore);
    // No key is stored by the change, so a reload leaves the vault
    // locked; the new password is the only way back in.
    const fresh = await freshVaultModule();
    expect(fresh.isLocked()).toBe(true);
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    await fresh.unlock('new password here');
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
  });

  it('removes the password with an empty new password, and refuses a missing vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(vaultHasPassword()).toBe(true);
    await changePassword('');
    expect(vaultHasPassword()).toBe(false);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    // A reload opens it with no password prompt.
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(true);
    expect(await fresh.verifyVaultPassword('')).toBe(true);
    expect(await fresh.verifyVaultPassword(TEST_PASSWORD)).toBe(false);
    deleteVault();
    await expect(changePassword('new password here')).rejects.toThrow(
      'No vault exists.',
    );
  });

  it('changePassword throws when the mnemonic is not available', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const fresh = await freshVaultModule();
    // The fresh module never unlocked, so no mnemonic is in its closure.
    await expect(fresh.changePassword('new password here')).rejects.toThrow(
      'Vault is not unlocked.',
    );
  });

  it('deletes the vault and its backup', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVaultBackup()).toBe(true);
    deleteVault();
    expect(hasVault()).toBe(false);
    expect(vaultProfiles()).toBeNull();
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
    expect(hasVaultBackup()).toBe(false);
    expect(localStorage.getItem(VAULT_BACKUP_STORAGE_KEY)).toBeNull();
    expect(() => withMnemonic((m) => m)).toThrow('Vault is not unlocked.');
  });
});

describe('openVaultIfPasswordless', () => {
  it('opens a passwordless vault after a reload', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES);
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(true);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('opens a passwordless vault but not the session passphrase', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES, 'TREZOR');
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(true);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    // The passphrase was never persisted, so a reload loses it.
    expect(fresh.getSessionPassphrase()).toBe('');
  });

  it('returns true at once when already open and keeps the session passphrase', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES, 'TREZOR');
    expect(await openVaultIfPasswordless()).toBe(true);
    expect(getSessionPassphrase()).toBe('TREZOR');
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('returns false and does not throw when there is no vault', async () => {
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    expect(() => fresh.withMnemonic((m) => m)).toThrow(
      'Vault is not unlocked.',
    );
  });

  it('returns false for a password vault, which stays locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    expect(fresh.isLocked()).toBe(true);
    expect(() => fresh.withMnemonic((m) => m)).toThrow(
      'Vault is not unlocked.',
    );
    // The vault still exists — it just needs its password.
    expect(fresh.hasVault()).toBe(true);
    await fresh.unlock(TEST_PASSWORD);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('fails closed on a tampered ciphertext', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES);
    const envelope = readRawEnvelope();
    const ciphertext = envelope.ciphertextB64 as string;
    const flipped =
      (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, ciphertextB64: flipped }),
    );
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    expect(() => fresh.withMnemonic((m) => m)).toThrow(
      'Vault is not unlocked.',
    );
  });

  it('fails closed on a structurally invalid envelope', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, version: 'not-a-number' }),
    );
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    expect(fresh.hasVault()).toBe(true);
    expect(() => fresh.vaultProfiles()).toThrow(VAULT_CORRUPTED);
  });

  it('fails closed on an unknown-version envelope', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, version: 2 }),
    );
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    expect(fresh.hasVault()).toBe(true);
  });

  it('throws VAULT_CORRUPTED only when the envelope is read directly', async () => {
    await createVault(TEST_MNEMONIC, '', TEST_PROFILES);
    const envelope = readRawEnvelope();
    // A structurally malformed envelope (no KDF block) is corruption —
    // unlike an unknown version number, which fails UNKNOWN_VERSION.
    delete (envelope as Record<string, unknown>).kdf;
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
    expect(() => vaultProfiles()).toThrow(VAULT_CORRUPTED);
  });
});

describe('vaultHasPassword', () => {
  it('is true for a password vault and false for a passwordless one', async () => {
    expect(vaultHasPassword()).toBe(false);
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(vaultHasPassword()).toBe(true);
    expect(readRawEnvelope().hasPassword).toBe(true);
  });

  it('reads a legacy envelope without the flag as having a password', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    delete (envelope as Record<string, unknown>).hasPassword;
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
    expect(vaultHasPassword()).toBe(true);
    // And it still opens with the password, not without one.
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    await fresh.unlock(TEST_PASSWORD);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('rejects a malformed hasPassword flag as corruption', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ ...envelope, hasPassword: 'yes' }),
    );
    expect(() => vaultProfiles()).toThrow(VAULT_CORRUPTED);
    // A corrupt envelope reads as having a password: nothing ever
    // opens it without one.
    expect(vaultHasPassword()).toBe(true);
  });

  it('is false with no vault', () => {
    expect(vaultHasPassword()).toBe(false);
  });
});

describe('removeLegacyStoredKey', () => {
  it('deletes a leftover bawa-vault-key entry and is a no-op without one', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    // A pre-change install left the raw key behind; the upgrade
    // cleanup deletes it and nothing else.
    localStorage.setItem('bawa-vault-key', encodeB64(new Uint8Array(32)));
    const envelopeBefore = localStorage.getItem(VAULT_STORAGE_KEY);
    removeLegacyStoredKey();
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBe(envelopeBefore);
    expect(hasVault()).toBe(true);
    removeLegacyStoredKey();
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
  });

  it('never reads the leftover key: the vault still needs its password', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.setItem('bawa-vault-key', encodeB64(new Uint8Array(32)));
    const fresh = await freshVaultModule();
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    expect(fresh.isLocked()).toBe(true);
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
    localStorage.removeItem(VAULT_STORAGE_KEY);
    expect(hasVault()).toBe(false);
    await restoreVaultFromBackup(TEST_PASSWORD);
    expect(hasVault()).toBe(true);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    // The restored vault is open in memory, but no key is stored — a
    // reload leaves it locked, and the password opens it again.
    const fresh = await freshVaultModule();
    expect(fresh.isLocked()).toBe(true);
    expect(await fresh.openVaultIfPasswordless()).toBe(false);
    await fresh.unlock(TEST_PASSWORD);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('restores from backup after the primary is damaged', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.setItem(VAULT_STORAGE_KEY, '{"version":1,"kdf":}');
    expect(() => vaultProfiles()).toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
    );
    await restoreVaultFromBackup(TEST_PASSWORD);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    const fresh = await freshVaultModule();
    expect(fresh.isLocked()).toBe(true);
    await fresh.unlock(TEST_PASSWORD);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('refuses a restore with the wrong password and leaves the primary untouched', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.removeItem(VAULT_STORAGE_KEY);
    await expect(restoreVaultFromBackup('wrong password')).rejects.toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_WRONG_PASSWORD],
    );
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
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
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.setItem(VAULT_BACKUP_STORAGE_KEY, 'not json at all');
    await expect(restoreVaultFromBackup(TEST_PASSWORD)).rejects.toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
    );
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
  });

  it('refreshes the backup on password change so the new password restores', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await changePassword('new password here');
    localStorage.removeItem(VAULT_STORAGE_KEY);
    await expect(restoreVaultFromBackup(TEST_PASSWORD)).rejects.toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_WRONG_PASSWORD],
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
        vaultProfiles();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(BawaError);
      expect((caught as BawaError).code).toBe(
        WalletErrorCodes.VAULT_UNKNOWN_VERSION,
      );
      expect((caught as Error).message).toBe('Vault version is not supported.');
    }
  });

  it('rejects a non-object envelope as corrupted', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.setItem(VAULT_STORAGE_KEY, '"just a string"');
    expect(() => vaultProfiles()).toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
    );
    localStorage.setItem(VAULT_STORAGE_KEY, 'null');
    expect(() => vaultProfiles()).toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
    );
  });

  it('migrates a version-1 envelope without provenance to unknown provenance', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    delete (envelope as Record<string, unknown>).provenance;
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
    expect(vaultProvenance()).toEqual({ source: 'unknown', isTesting: false });
    expect(isTestVault()).toBe(false);
  });

  it('migrateEnvelope validates a version-1 envelope and rejects unknown versions directly', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const migrated = migrateEnvelope(readRawEnvelope());
    expect(migrated.version).toBe(1);
    expect(migrated.profileIds).toEqual(TEST_PROFILES);
    let caught: unknown;
    try {
      migrateEnvelope({ version: 2 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BawaError);
    expect((caught as BawaError).code).toBe(
      WalletErrorCodes.VAULT_UNKNOWN_VERSION,
    );
    expect(() => migrateEnvelope('just a string')).toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
    );
  });
});

describe('vault errors', () => {
  it('rejects a wrong password with a BawaError carrying code 1001', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.removeItem(VAULT_STORAGE_KEY);
    let caught: unknown;
    try {
      await restoreVaultFromBackup('wrong password');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BawaError);
    expect((caught as BawaError).code).toBe(
      WalletErrorCodes.VAULT_WRONG_PASSWORD,
    );
    expect((caught as Error).message).toBe(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_WRONG_PASSWORD],
    );
  });

  it('throws a plain Error, not a BawaError, when no mnemonic is available', async () => {
    // No vault at all: withMnemonic has nothing to run with. The throw is
    // deliberately a plain Error ('Vault is not unlocked.'), not the
    // catalogue's VAULT_LOCKED ('Vault is locked.'): the same throw covers
    // the locked case too, and VAULT_LOCKED would be the wrong message
    // when there is no vault at all. No caller switches on the code for
    // this path. See vault.ts.
    let caught: unknown;
    try {
      withMnemonic((m) => m);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(BawaError);
    expect((caught as Error).message).toBe('Vault is not unlocked.');
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow(
      'Vault is not unlocked.',
    );
  });
});

// Lock tests were deleted with lock removal (owner order 2026-11-20);
// they are now restored by the optional-auto-lock order.
describe('vault locking', () => {
  beforeEach(() => {
    writeAutoLockEnabled(true);
  });

  it('is locked before creation', () => {
    expect(isLocked()).toBe(true);
  });

  it('is locked after lock()', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(isLocked()).toBe(false);

    lock();

    expect(isLocked()).toBe(true);
  });

  it('restores the mnemonic when unlocked with the correct password', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();

    await unlock(TEST_PASSWORD);

    expect(isLocked()).toBe(false);
    expect(withMnemonic((mnemonic) => mnemonic)).toBe(TEST_MNEMONIC);
    await expect(
      withMnemonicAsync(async (mnemonic) => mnemonic),
    ).resolves.toBe(TEST_MNEMONIC);
  });

  it('throws Incorrect password. for a wrong password and remains locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();

    expect(VAULT_WRONG_PASSWORD).toBe('Incorrect password.');
    await expect(unlock(`${TEST_PASSWORD}-wrong`)).rejects.toThrow(
      VAULT_WRONG_PASSWORD,
    );

    expect(isLocked()).toBe(true);
  });

  it('rejects synchronous and asynchronous mnemonic access while locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();

    expect(() => withMnemonic((mnemonic) => mnemonic)).toThrow(
      'Vault is not unlocked.',
    );
    await expect(
      Promise.resolve().then(() =>
        withMnemonicAsync(async (mnemonic) => mnemonic),
      ),
    ).rejects.toThrow('Vault is not unlocked.');
  });

  it('drops the mnemonic again when locked after unlocking', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    await unlock(TEST_PASSWORD);

    expect(withMnemonic((mnemonic) => mnemonic)).toBe(TEST_MNEMONIC);

    lock();

    expect(isLocked()).toBe(true);
    expect(() => withMnemonic((mnemonic) => mnemonic)).toThrow(
      'Vault is not unlocked.',
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
    await changePassword('new password here');
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
    expect(() => vaultProvenance()).toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
    );
  });
});

describe('verifyVaultPassword', () => {
  it('returns true for the right password without changing state', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(await verifyVaultPassword(TEST_PASSWORD)).toBe(true);
    // State is untouched: the mnemonic is still available afterwards.
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
    expect(getSessionPassphrase()).toBe('');
  });

  it('returns false for a wrong password', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(await verifyVaultPassword('wrong password')).toBe(false);
    // State is untouched: the mnemonic is still available afterwards.
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('returns false with no vault', async () => {
    expect(await verifyVaultPassword(TEST_PASSWORD)).toBe(false);
  });
});

describe('password-only: no key is ever stored', () => {
  it('creates no stored key with auto-lock ON or OFF', async () => {
    writeAutoLockEnabled(true);
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
    expect(isLocked()).toBe(false);
    deleteVault();

    writeAutoLockEnabled(false);
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
    expect(isLocked()).toBe(false);
  });

  it('stores no key when unlocking, with auto-lock ON or OFF', async () => {
    writeAutoLockEnabled(true);
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    await unlock(TEST_PASSWORD);
    expect(isLocked()).toBe(false);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();

    writeAutoLockEnabled(false);
    lock();
    await unlock(TEST_PASSWORD);
    expect(isLocked()).toBe(false);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
  });

  it('stores no key when changing the password, with auto-lock ON or OFF', async () => {
    writeAutoLockEnabled(false);
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await changePassword(`${TEST_PASSWORD}-changed`);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();

    writeAutoLockEnabled(true);
    await changePassword(`${TEST_PASSWORD}-changed-again`);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();

    // The new password still opens the vault after a reload.
    const fresh = await freshVaultModule();
    expect(fresh.isLocked()).toBe(true);
    await fresh.unlock(`${TEST_PASSWORD}-changed-again`);
    expect(fresh.withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('leaves a planted legacy key untouched until the upgrade cleanup runs', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.setItem('bawa-vault-key', encodeB64(new Uint8Array(32)));
    lock();
    await unlock(TEST_PASSWORD);
    await changePassword(`${TEST_PASSWORD}-changed`);
    // Vault operations never read or delete the leftover entry — only
    // the boot-time removeLegacyStoredKey() removes it.
    expect(localStorage.getItem('bawa-vault-key')).not.toBeNull();
    removeLegacyStoredKey();
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
    expect(hasVault()).toBe(true);
  });

  it('deletes a planted legacy key with the vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    localStorage.setItem('bawa-vault-key', encodeB64(new Uint8Array(32)));
    deleteVault();
    expect(hasVault()).toBe(false);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
  });
});

describe('vault KDF iterations (A-10)', () => {
  function tamperIterations(value: number): void {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY) as string;
    const envelope = JSON.parse(raw) as Record<string, unknown>;
    (envelope.kdf as Record<string, unknown>).iterations = value;
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
  }

  it.each([0, -1, 0.5, 1e12])(
    'rejects a tampered iterations value %s as VAULT_CORRUPTED, never a raw error or a hang',
    async (value) => {
      await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
      tamperIterations(value);
      await expect(unlock(TEST_PASSWORD)).rejects.toThrow(
        ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
      );
    },
  );

  it('rejects an out-of-range iterations value at the migration boundary', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();
    (envelope.kdf as Record<string, unknown>).iterations = 0;
    expect(() => migrateEnvelope(envelope)).toThrow(
      ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED],
    );
  });
});

describe('vault accounts', () => {
  // Lane C, items 6/7/17: one recovery phrase holds many named accounts.
  // Account index 0 is "Account 1", index 1 is "Account 2", and so on.
  // Only public index numbers are persisted — never a phrase or key.
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reads an empty list when nothing is stored', () => {
    expect(readVaultAccounts()).toEqual([]);
  });

  it('writes and reads the stored list, sorted and de-duplicated', () => {
    writeVaultAccounts([2, 0, 1, 1]);
    expect(readVaultAccounts()).toEqual([0, 1, 2]);
  });

  it('treats corrupt storage as empty instead of throwing', () => {
    localStorage.setItem(VAULT_ACCOUNTS_KEY, 'not-json{');
    expect(readVaultAccounts()).toEqual([]);
    localStorage.setItem(
      VAULT_ACCOUNTS_KEY,
      JSON.stringify({ version: 1, accounts: ['a', -1, 1.5] }),
    );
    expect(readVaultAccounts()).toEqual([]);
  });

  it('names accounts from 1: index 0 is Account 1', () => {
    expect(accountName(0)).toBe('Account 1');
    expect(accountName(1)).toBe('Account 2');
    expect(accountName(49)).toBe('Account 50');
    expect(() => accountName(-1)).toThrow(/non-negative/);
  });

  it('adds new accounts after the highest existing one', () => {
    expect(nextVaultAccounts([0], 3)).toEqual([0, 1, 2, 3]);
    expect(nextVaultAccounts([0, 1, 2], 2)).toEqual([0, 1, 2, 3, 4]);
    expect(nextVaultAccounts([], 1)).toEqual([0]);
  });

  it('rejects counts outside 1–50', () => {
    expect(() => nextVaultAccounts([0], 0)).toThrow(/between 1 and 50/);
    expect(() => nextVaultAccounts([0], 51)).toThrow(/between 1 and 50/);
  });

  it('caps the total number of accounts', () => {
    const many = Array.from({ length: 199 }, (_, i) => i);
    expect(() => nextVaultAccounts(many, 2)).toThrow(/too many accounts/);
  });

  it('clears the stored list', () => {
    writeVaultAccounts([0, 1]);
    clearVaultAccounts();
    expect(readVaultAccounts()).toEqual([]);
    expect(localStorage.getItem(VAULT_ACCOUNTS_KEY)).toBeNull();
  });
});

describe('vault account names', () => {
  // Lane E, item 4a: a custom display name per account ("Savings").
  // Names are public labels only — they never touch the phrase, the
  // keys, or any other account — and they die with the vault.
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reads no names when nothing is stored', () => {
    expect(readVaultAccountNames()).toEqual({});
  });

  it('writes and reads the stored names, trimmed', () => {
    writeVaultAccountNames({ 0: '  Savings  ', 1: 'Trading' });
    expect(readVaultAccountNames()).toEqual({ 0: 'Savings', 1: 'Trading' });
  });

  it('drops blank names on write and rejects over-long ones', () => {
    writeVaultAccountNames({ 0: '   ', 1: 'Trading' });
    expect(readVaultAccountNames()).toEqual({ 1: 'Trading' });
    expect(() =>
      writeVaultAccountNames({ 0: 'x'.repeat(41) }),
    ).toThrow(/at most 40/);
  });

  it('treats corrupt storage as empty instead of throwing', () => {
    localStorage.setItem(VAULT_ACCOUNT_NAMES_KEY, 'not-json{');
    expect(readVaultAccountNames()).toEqual({});
    localStorage.setItem(
      VAULT_ACCOUNT_NAMES_KEY,
      JSON.stringify({ version: 1, names: { 0: 42, 1: 'Trading', x: 'Nope' } }),
    );
    expect(readVaultAccountNames()).toEqual({ 1: 'Trading' });
  });

  it('shows the custom name, falling back to the default', () => {
    expect(displayAccountName(0, {})).toBe('Account 1');
    expect(displayAccountName(1, { 1: 'Trading' })).toBe('Trading');
    expect(displayAccountName(1, { 0: 'Savings' })).toBe('Account 2');
  });

  it('renames one account and leaves the others alone', () => {
    expect(renameAccountName({ 0: 'Savings' }, 1, '  Trading ')).toEqual({
      0: 'Savings',
      1: 'Trading',
    });
  });

  it('clearing a name — blank or equal to the default — removes it', () => {
    expect(renameAccountName({ 1: 'Trading' }, 1, '   ')).toEqual({});
    expect(renameAccountName({ 1: 'Trading' }, 1, 'Account 2')).toEqual({});
  });

  it('rejects an over-long rename and an invalid account', () => {
    expect(() => renameAccountName({}, 0, 'x'.repeat(41))).toThrow(
      /at most 40/,
    );
    expect(() => renameAccountName({}, -1, 'Savings')).toThrow(
      /non-negative/,
    );
  });

  it('removing an account drops only its name', () => {
    expect(removeAccountName({ 0: 'Savings', 1: 'Trading' }, 1)).toEqual({
      0: 'Savings',
    });
  });

  it('clears the stored names', () => {
    writeVaultAccountNames({ 0: 'Savings' });
    clearVaultAccountNames();
    expect(readVaultAccountNames()).toEqual({});
    expect(localStorage.getItem(VAULT_ACCOUNT_NAMES_KEY)).toBeNull();
  });

  it('deleting the vault clears the names with it', () => {
    writeVaultAccountNames({ 0: 'Savings' });
    deleteVault();
    expect(readVaultAccountNames()).toEqual({});
    expect(localStorage.getItem(VAULT_ACCOUNT_NAMES_KEY)).toBeNull();
  });
});
