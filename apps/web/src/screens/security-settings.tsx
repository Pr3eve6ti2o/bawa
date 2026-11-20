import { Link } from "react-router";
import { AUTO_LOCK_OPTIONS, useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";

const AUTO_LOCK_LABELS: Record<number, string> = {
  0: 'Immediately',
  1: '1 minute',
  5: '5 minutes',
  15: '15 minutes',
  60: '1 hour',
  1440: '1 day',
};

export function SecuritySettingsScreen() {
  const { vaultState, lockVault, autoLockMinutes, setAutoLockMinutes } = useWallet();

  return (
    <section className="space-y-6" aria-labelledby="security-heading">
      <h1 id="security-heading" className="text-2xl font-semibold">
        Security &amp; backup
      </h1>

      <div className="rounded-[20px] border border-panel-border bg-panel-surface-raised p-6">
        <h2 className="text-lg font-bold text-panel-text">What this wallet does</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-panel-text-muted">
          <li>Your recovery phrase is created in this browser and kept encrypted in the vault on this device.</li>
          <li>Your private keys stay in temporary memory on this device only while the vault is unlocked. The wallet never saves them unencrypted, never writes them to logs, and never sends them online.</li>
          <li>Signing happens offline on this device.</li>
          <li>Sending funds is switched off until it is separately approved — signing alone never moves your funds.</li>
        </ul>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Vault lock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {vaultState === 'locked' ? (
            <div className="space-y-3">
              <p role="status">Vault locked — the recovery phrase and signing keys are not in memory.</p>
              <Button type="button" asChild>
                <Link to="/lock">Unlock</Link>
              </Button>
            </div>
          ) : vaultState === 'unlocked' ? (
            <Button type="button" onClick={() => lockVault()}>
              Lock vault
            </Button>
          ) : (
            <p role="status">No vault yet — create or import a wallet first.</p>
          )}
          <p className="text-sm text-muted-foreground">
            Locking clears the decrypted recovery phrase and signing keys from memory. The vault stays encrypted on this device until you unlock it again.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Lock after inactivity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            id="auto-lock"
            aria-label="Lock after inactivity"
            value={String(autoLockMinutes)}
            onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
            className="h-12 w-full rounded-md border border-border bg-input-background px-4 text-body-md text-foreground"
          >
            {AUTO_LOCK_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {AUTO_LOCK_LABELS[minutes]}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">
            The vault locks after this long without activity. Any activity resets the timer. Watch-only stays usable while the vault is locked.
          </p>
          {vaultState === 'unlocked' && (
            <Button type="button" onClick={() => lockVault()}>
              Lock now
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Backup procedure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your recovery phrase is stored encrypted in this browser&apos;s vault. Write it down on paper and keep it somewhere only you can reach — anyone with the phrase can take the funds.
          </p>
          <Link
            to="/mnemonic-backup"
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            View the real backup procedure
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
