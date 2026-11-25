// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_SHARE_PREFIX,
  BackupSharesError,
  checkBackupShares,
  createBackupShares,
  decodeShare,
  encodeShare,
  reconstructKeyBytes,
} from './backup-shares';
import {
  createVault,
  deleteVault,
  exportUnlockedKeyBytes,
  isLocked,
  lock,
  verifyReconstructedKey,
} from './vault';
import { BTC_PROFILE_ID, EVM_PROFILE_ID } from '../state/test-helpers';

// Standard public BIP-39 test vector — disposable test data, never a real
// secret. Shares created in these tests are generated fresh per run and
// never written to a file or logged.
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';
const TEST_PASSWORD = 'backup-shares-test-password';
const TEST_PROFILES = [EVM_PROFILE_ID, BTC_PROFILE_ID];

async function setupVault(mnemonic = TEST_MNEMONIC): Promise<void> {
  await createVault(mnemonic, TEST_PASSWORD, TEST_PROFILES);
}

async function freshVaultModule(): Promise<typeof import('./vault')> {
  vi.resetModules();
  return import('./vault');
}

function corruptShare(shareText: string): string {
  const bytes = decodeShare(shareText);
  const corrupted = new Uint8Array(bytes);
  corrupted[5] = (corrupted[5] as number) ^ 0xff;
  return encodeShare(corrupted);
}

beforeEach(() => {
  localStorage.clear();
  deleteVault();
});

describe('backup shares', () => {
  it('creates 2-of-3 shares that rebuild the vault key from any two', async () => {
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    expect(key).not.toBeNull();
    expect(key?.length).toBe(32);

    const shares = await createBackupShares(key as Uint8Array, 3, 2);
    expect(shares).toHaveLength(3);
    for (const share of shares) {
      expect(share.startsWith(BACKUP_SHARE_PREFIX)).toBe(true);
    }
    expect(new Set(shares).size).toBe(3);

    // Every pair rebuilds the same key, and the rebuilt key decrypts.
    for (const pair of [
      [shares[0], shares[1]],
      [shares[1], shares[2]],
      [shares[0], shares[2]],
    ]) {
      const rebuilt = await reconstructKeyBytes(pair as string[]);
      expect(rebuilt).toEqual(key);
      expect(await verifyReconstructedKey(rebuilt)).toBe(true);
    }
    expect(
      await checkBackupShares(
        [shares[0] as string, shares[2] as string],
        2,
      ),
    ).toEqual({ ok: true });
  });

  it('3-of-5: two shares fail the trial decryption, three succeed', async () => {
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    const shares = await createBackupShares(key as Uint8Array, 5, 3);

    // combine() with too few shares still returns 32 bytes — the wrong
    // ones. Only the trial decryption catches it.
    const tooFew = await reconstructKeyBytes([
      shares[0] as string,
      shares[1] as string,
    ]);
    expect(tooFew.length).toBe(32);
    expect(tooFew).not.toEqual(key);
    expect(await verifyReconstructedKey(tooFew)).toBe(false);

    expect(
      await checkBackupShares(
        [shares[0] as string, shares[1] as string],
        3,
      ),
    ).toEqual({
      ok: false,
      reason:
        'Enter at least 3 shares — this set needs 3 to restore the vault.',
    });
    expect(
      await checkBackupShares(
        [shares[0] as string, shares[2] as string, shares[4] as string],
        3,
      ),
    ).toEqual({ ok: true });
  });

  it('rejects malformed shares with clear messages', async () => {
    expect(() => decodeShare('hello')).toThrow(BackupSharesError);
    expect(() => decodeShare('hello')).toThrow(
      'That is not a Bawa backup share.',
    );
    expect(() =>
      decodeShare(`${BACKUP_SHARE_PREFIX}!!!not-base64!!!`),
    ).toThrow('not valid base64');
    // Valid base64, wrong length (5 bytes, not 33).
    expect(() =>
      decodeShare(`${BACKUP_SHARE_PREFIX}${btoa('12345')}`),
    ).toThrow('wrong length');

    await expect(reconstructKeyBytes(['only-one'])).rejects.toThrow(
      'Enter at least two shares.',
    );
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    const shares = await createBackupShares(key as Uint8Array, 3, 2);
    await expect(
      reconstructKeyBytes([shares[0] as string, 'not a share']),
    ).rejects.toThrow('That is not a Bawa backup share.');
  });

  it('rejects a duplicated share', async () => {
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    const shares = await createBackupShares(key as Uint8Array, 3, 2);
    await expect(
      reconstructKeyBytes([shares[0] as string, shares[0] as string]),
    ).rejects.toThrow('Two of the shares are the same share.');
    await expect(
      checkBackupShares([shares[0] as string, shares[0] as string], 2),
    ).resolves.toEqual({
      ok: false,
      reason: 'Two of the shares are the same share. Enter a different share in each box.',
    });
  });

  it('a corrupted share fails the trial decryption, clearly', async () => {
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    const shares = await createBackupShares(key as Uint8Array, 3, 2);
    const corrupted = corruptShare(shares[0] as string);
    expect(corrupted).not.toBe(shares[0]);

    const rebuilt = await reconstructKeyBytes([
      corrupted,
      shares[1] as string,
    ]);
    expect(rebuilt.length).toBe(32);
    expect(await verifyReconstructedKey(rebuilt)).toBe(false);
    expect(
      await checkBackupShares([corrupted, shares[1] as string], 2),
    ).toEqual({
      ok: false,
      reason:
        'These shares did not restore this vault. Check that every share is copied in full, that no share is entered twice, and that all shares come from the same set.',
    });
  });

  it('shares from another vault do not restore this vault', async () => {
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    const shares = await createBackupShares(key as Uint8Array, 3, 2);

    deleteVault();
    await setupVault(OTHER_MNEMONIC);
    expect(
      await checkBackupShares(
        [shares[0] as string, shares[1] as string],
        2,
      ),
    ).toEqual({
      ok: false,
      reason:
        'These shares did not restore this vault. Check that every share is copied in full, that no share is entered twice, and that all shares come from the same set.',
    });
  });

  it('shares mixed across two sets of the same vault do not restore it', async () => {
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    const firstSet = await createBackupShares(key as Uint8Array, 3, 2);
    const secondSet = await createBackupShares(key as Uint8Array, 3, 2);
    // Each set alone restores; a mix of the two does not.
    expect(
      await checkBackupShares(
        [firstSet[0] as string, firstSet[1] as string],
        2,
      ),
    ).toEqual({ ok: true });
    expect(
      await checkBackupShares(
        [firstSet[0] as string, secondSet[1] as string],
        2,
      ),
    ).toEqual({
      ok: false,
      reason:
        'These shares did not restore this vault. Check that every share is copied in full, that no share is entered twice, and that all shares come from the same set.',
    });
  });

  it('validates the scheme and the key', async () => {
    await setupVault();
    const key = await exportUnlockedKeyBytes();
    await expect(
      createBackupShares(key as Uint8Array, 3, 4),
    ).rejects.toThrow('no more than the total number of shares');
    await expect(
      createBackupShares(key as Uint8Array, 3, 1),
    ).rejects.toThrow('at least 2');
    await expect(
      createBackupShares(key as Uint8Array, 1, 1),
    ).rejects.toThrow('between 2 and 255');
    await expect(
      createBackupShares(new Uint8Array(16), 3, 2),
    ).rejects.toThrow('wrong length');
  });

  it('exportUnlockedKeyBytes is null when the vault is locked', async () => {
    await setupVault();
    expect(await exportUnlockedKeyBytes()).not.toBeNull();
    lock();
    expect(isLocked()).toBe(true);
    expect(await exportUnlockedKeyBytes()).toBeNull();
  });

  it('an auto-unlocked vault can export its key for shares', async () => {
    await setupVault();
    const keyBefore = await exportUnlockedKeyBytes();
    expect(keyBefore).not.toBeNull();

    // Fresh module, as if the page had reloaded: the closure starts empty
    // while localStorage keeps the vault and (auto-lock off) the key.
    const fresh = await freshVaultModule();
    expect(await fresh.autoUnlock()).toBe(true);
    const keyAfter = await fresh.exportUnlockedKeyBytes();
    expect(keyAfter).not.toBeNull();
    expect(keyAfter).toEqual(keyBefore);
    expect(await fresh.verifyReconstructedKey(keyAfter as Uint8Array)).toBe(
      true,
    );
  });
});
