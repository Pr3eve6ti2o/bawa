import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { Label } from '../ui/components/label';
import { Switch } from '../ui/components/switch';
import { AUTO_LOCK_OPTIONS, AUTO_LOCK_LABELS } from '../wallet/auto-lock';
import { useWallet } from '../state/wallet-context';

export function AutoLockSetting() {
  const {
    vaultState,
    // Screens mocked in tests may omit this; only an explicit false
    // means "no password" — a password vault is the safe default.
    vaultHasPassword = true,
    autoLockEnabled,
    autoLockMinutes,
    setAutoLockMinutes,
    setAutoLockEnabled,
    lockVault,
  } = useWallet();

  const [isToggling, setIsToggling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isLocked = vaultState === 'locked';
  const hasVault = vaultState !== 'no-vault';
  // With no password there is nothing to lock: the setting is inert and
  // the switch is disabled until the user sets a password (Security
  // settings). The vault opens at boot with no prompt either way.
  const hasPassword = hasVault && vaultHasPassword;
  const controlsDisabled = !hasVault || !hasPassword || isToggling;

  async function handleToggle(enabled: boolean) {
    if (controlsDisabled) return;

    setActionError(null);
    setIsToggling(true);

    // Toggling is a preference flip only. No key is stored or deleted
    // anywhere: the removed auto-unlock mechanism used to persist the
    // derived key while auto-lock was off, and that is gone (owner order
    // 2026-11-28). Disabling while locked needs no password step.
    try {
      await setAutoLockEnabled(enabled);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsToggling(false);
    }
  }

  // P1 (S3-B, item 9 — F34): no card of its own — Security is a flat
  // list, so this is the first row in it (row padding 12px vertical /
  // 16px horizontal, plan §c). The row label is the Auto-lock switch
  // label below; the old CardTitle said the same word twice.
  return (
    <div className="px-4 py-3">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-lock-enabled">Auto-lock</Label>
          <Switch
            id="auto-lock-enabled"
            checked={autoLockEnabled}
            onCheckedChange={(enabled) => {
              void handleToggle(enabled);
            }}
            disabled={controlsDisabled}
            aria-label="Auto-lock"
          />
        </div>

        {!hasVault && (
          <p className="text-base text-ink">
            No vault yet.
          </p>
        )}

        {hasVault && !vaultHasPassword && (
          <p className="text-base text-ink">
            No password is set, so there is nothing to lock — anyone with
            this device can open the wallet. Set a password below to lock
            it.
          </p>
        )}

        {hasPassword && !autoLockEnabled && (
          <p className="text-base text-ink">
            Off — your wallet stays unlocked until you lock it or reload
            this page. After a reload you will need your vault password
            to unlock it.
          </p>
        )}

        {hasPassword && autoLockEnabled && (
          <div className="space-y-2">
            <Label htmlFor="auto-lock">Lock after inactivity</Label>
            <select
              id="auto-lock"
              aria-label="Lock after inactivity"
              className="h-12 w-full rounded-flat-sm border border-ink bg-paper px-4 text-base text-ink"
              value={autoLockMinutes}
              disabled={controlsDisabled}
              onChange={(event) => {
                void setAutoLockMinutes(Number(event.target.value));
              }}
            >
              {AUTO_LOCK_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {AUTO_LOCK_LABELS[minutes]}
                </option>
              ))}
            </select>

            {hasVault && (
              <p className="text-base text-ink">
                {autoLockMinutes > 0
                  ? `Auto-lock is on. Your wallet locks after ${AUTO_LOCK_LABELS[autoLockMinutes]} without activity. You will need your vault password to unlock it.`
                  : 'Auto-lock is on. Your wallet locks immediately when you leave this page. You will need your vault password to unlock it.'}
              </p>
            )}
          </div>
        )}

        {vaultState === 'unlocked' && hasPassword && (
          <div className="space-y-2">
            <p className="text-base text-ink">
              Lock now.
            </p>
            <Button type="button" variant="secondary" onClick={() => lockVault()}>
              Lock now
            </Button>
          </div>
        )}

        {isLocked && (
          <p className="text-base text-ink">
            Vault locked.{' '}
            <Link
              to="/lock"
              className="text-ink underline underline-offset-4"
              aria-disabled={isToggling}
              tabIndex={isToggling ? -1 : undefined}
              onClick={(event) => {
                if (isToggling) event.preventDefault();
              }}
            >
              Unlock
            </Link>
          </p>
        )}

        {actionError && (
          <p role="alert" className="text-base text-ink">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
}
