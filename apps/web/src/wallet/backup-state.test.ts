// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  clearBackupDone,
  readBackupDone,
  writeBackupDone,
} from './backup-state';
import { createVault, deleteVault } from './vault';

// S3-A (P1 item 8): the backup-completion flag. It records that the
// phrase was revealed on the Backup screen or a set of backup shares
// was created — nothing about the phrase itself is stored here.
describe('backup-state', () => {
  it('is unset by default, set by write, cleared by clear', () => {
    localStorage.clear();
    expect(readBackupDone()).toBe(false);
    writeBackupDone();
    expect(readBackupDone()).toBe(true);
    clearBackupDone();
    expect(readBackupDone()).toBe(false);
    localStorage.clear();
  });

  it('deleting the vault clears the flag', async () => {
    localStorage.clear();
    deleteVault();
    await createVault(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      'correct horse battery staple',
      ['bawa-evm-bip44-v1'],
    );
    writeBackupDone();
    expect(readBackupDone()).toBe(true);
    deleteVault();
    expect(readBackupDone()).toBe(false);
    localStorage.clear();
  });
});
