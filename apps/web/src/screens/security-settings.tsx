import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";

export function SecuritySettingsScreen() {
  const { vaultState } = useWallet();

  // Desktop layout (Bawa Balanced, following Sol's reviewed arrangement):
  // the heading and the reading panels span both columns, while the
  // backup section gets its own distinct section below. Below lg the
  // page stays a single 480px column (the shell's isWideAtLg cap),
  // unchanged.
  return (
    <section
      className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
      aria-labelledby="security-heading"
    >
      <h1 id="security-heading" className="text-2xl font-semibold lg:col-span-2">
        Security &amp; backup
      </h1>

      <div className="rounded-[20px] border border-panel-border bg-panel-surface-raised p-6 lg:col-span-2">
        <h2 className="text-lg font-bold text-panel-text">What this wallet does</h2>
        <ul className="mt-3 max-w-[75ch] list-disc space-y-2 pl-5 text-sm text-panel-text-muted">
          <li>Your recovery phrase is created in this browser and kept encrypted in the vault on this device.</li>
          <li>Your private keys stay in memory on this device while the wallet is open. The wallet never saves them unencrypted, never writes them to logs, and never sends them online.</li>
          <li>Signing happens offline on this device.</li>
          <li>Sending funds is switched off until it is separately approved — signing alone never moves your funds.</li>
        </ul>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Vault stays unlocked</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {vaultState === 'no-vault' ? (
            <p role="status">No vault yet — create or import a wallet first.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your wallet stays unlocked on this device. Anyone with access to this device can open it.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl lg:col-span-2">
        <CardHeader>
          <CardTitle>Backup procedure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-muted-foreground">
            Your recovery phrase is stored encrypted in this browser&apos;s vault. Write it down on paper and keep it somewhere only you can reach — anyone with the phrase can take the funds.
          </p>
          <p className="max-w-[75ch] text-sm text-muted-foreground">
            Back up first: this wallet shows no receiving address — and cannot receive funds — until you have written down your recovery phrase.
          </p>
          <Link
            to="/mnemonic-backup"
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            View the backup procedure
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
