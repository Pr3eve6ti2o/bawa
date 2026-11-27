/**
 * Backup-completion state (P1 item 8, S3-A).
 *
 * One flag, set when the phrase has been revealed on the Backup screen
 * or a set of backup shares has been created. It records that the user
 * took a backup step on this device — it is not proof the words are
 * written down, and the Backup screen still says so in words.
 *
 * This module stores the flag only, never a mnemonic, password, or key.
 * Deleting the vault clears the flag (see deleteVault in vault.ts), so
 * a fresh vault never inherits a previous wallet's "Backed up".
 */

const BACKUP_DONE_KEY = 'bawa-backup-done';

export function readBackupDone(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(BACKUP_DONE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function writeBackupDone(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BACKUP_DONE_KEY, '1');
    }
  } catch {
    // Storage may be unavailable or disabled; ignore write failures.
  }
}

export function clearBackupDone(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BACKUP_DONE_KEY);
    }
  } catch {
    // Storage may be unavailable or disabled; ignore write failures.
  }
}
