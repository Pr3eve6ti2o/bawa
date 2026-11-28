/**
 * Optional auto-lock preferences. Auto-lock is OFF by default, so the vault
 * stays unlocked in the session unless the user enables it.
 *
 * Auto-lock locks a PASSWORD vault only: it drops the in-memory key after
 * the chosen inactivity period (or immediately on leaving the page, when
 * the duration is 0), and unlocking needs the password again. It never
 * stores a key anywhere — the removed auto-unlock mechanism used to persist
 * the derived key while auto-lock was off, and that is gone (owner order
 * 2026-11-28). With auto-lock OFF the vault still locks on reload: the
 * password is asked at boot. A vault with NO password has nothing to lock,
 * so the setting is inert for it and the UI says so.
 *
 * This module stores preferences only, never a mnemonic, password, or key.
 */

export const AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 60, 1440] as const;

export const AUTO_LOCK_LABELS: Record<number, string> = {
  0: 'Immediately',
  1: '1 minute',
  5: '5 minutes',
  15: '15 minutes',
  60: '1 hour',
  1440: '1 day',
};

const AUTO_LOCK_DEFAULT_MINUTES = 5;

const AUTO_LOCK_ENABLED_KEY = 'bawa-auto-lock-enabled';
export const AUTO_LOCK_MINUTES_KEY = 'bawa-auto-lock-minutes';

export function readAutoLockEnabled(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(AUTO_LOCK_ENABLED_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function readAutoLockMinutes(): number {
  try {
    if (typeof localStorage === 'undefined') {
      return AUTO_LOCK_DEFAULT_MINUTES;
    }

    const stored = localStorage.getItem(AUTO_LOCK_MINUTES_KEY);

    return (
      AUTO_LOCK_OPTIONS.find((minutes) => String(minutes) === stored) ??
      AUTO_LOCK_DEFAULT_MINUTES
    );
  } catch {
    return AUTO_LOCK_DEFAULT_MINUTES;
  }
}

export function writeAutoLockEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTO_LOCK_ENABLED_KEY, enabled ? '1' : '0');
    }
  } catch {
    // Storage may be unavailable or disabled; ignore write failures.
  }
}

export function writeAutoLockMinutes(minutes: number): void {
  if (!AUTO_LOCK_OPTIONS.some((option) => option === minutes)) {
    return;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTO_LOCK_MINUTES_KEY, String(minutes));
    }
  } catch {
    // Storage may be unavailable or disabled; ignore write failures.
  }
}

/**
 * The sole minutes-to-milliseconds conversion. Inactivity timers must use this
 * function so the selected duration is applied consistently.
 */
export function autoLockDurationMs(minutes: number): number {
  return minutes * 60_000;
}
