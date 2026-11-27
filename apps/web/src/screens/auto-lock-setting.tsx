import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { Switch } from '../ui/components/switch';
import { AUTO_LOCK_OPTIONS, AUTO_LOCK_LABELS } from '../wallet/auto-lock';
import { useWallet } from '../state/wallet-context';

export function AutoLockSetting() {
  const {
    vaultState,
    autoLockEnabled,
    autoLockMinutes,
    setAutoLockMinutes,
    setAutoLockEnabled,
    lockVault,
    unlockVault,
  } = useWallet();

  const [isToggling, setIsToggling] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const isLocked = vaultState === 'locked';
  const hasVault = vaultState !== 'no-vault';
  const controlsDisabled = !hasVault || isToggling;
  const errorMessage = actionError;

  useEffect(() => {
    if (vaultState !== 'locked') {
      setShowPasswordForm(false);
      setPassword('');
      setActionError(null);
    }
  }, [vaultState]);

  async function handleToggle(enabled: boolean) {
    if (controlsDisabled) return;

    setActionError(null);

    if (!enabled && isLocked) {
      setShowPasswordForm(true);
      return;
    }

    setShowPasswordForm(false);
    setPassword('');
    setIsToggling(true);

    try {
      await setAutoLockEnabled(enabled);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDisableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controlsDisabled || !showPasswordForm || !isLocked) return;

    setActionError(null);
    setIsToggling(true);

    try {
      await setAutoLockEnabled(false);
      await unlockVault(password);
      // Keep the form open while locked so vault errors remain visible.
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setPassword('');
      setIsToggling(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-lock</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
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

        {hasVault && !autoLockEnabled && (
          <p className="text-base text-ink">
            Off — anyone with this device can open it.
          </p>
        )}

        {autoLockEnabled && (
          <div className="space-y-2">
            <Label htmlFor="auto-lock">Lock after inactivity</Label>
            <select
              id="auto-lock"
              aria-label="Lock after inactivity"
              className="h-12 w-full rounded-bawa-sm border-2 border-ink bg-paper px-4 text-base text-ink"
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

        {vaultState === 'unlocked' && (
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

        {showPasswordForm && isLocked && (
          <form
            className="space-y-3"
            aria-busy={isToggling}
            onSubmit={(event) => {
              void handleDisableSubmit(event);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="auto-lock-password">Password</Label>
              <Input
                id="auto-lock-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={controlsDisabled}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={controlsDisabled || password.length === 0}
            >
              Disable auto-lock
            </Button>
          </form>
        )}

        {errorMessage && (
          <p role="alert" className="text-base text-ink">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
