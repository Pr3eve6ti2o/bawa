import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { BawaIcon } from "../ui/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";
import { deleteVault } from "../wallet/vault";
import { AutoLockSetting } from "./auto-lock-setting";

export function SecuritySettingsScreen() {
  const { vaultState, refreshVaultAccounts } = useWallet();
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    setDeleteArmed(false);
  }, [vaultState]);

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

      <div className="rounded-bawa border-2 border-ink bg-paper p-6 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><BawaIcon name="shield" className="size-6" /> What this wallet does</h2>
        <ul className="mt-3 max-w-[75ch] list-disc space-y-2 pl-5 text-sm text-ink">
          <li>Your recovery phrase is created in this browser and kept encrypted in the vault on this device.</li>
          <li>Your private keys stay in memory on this device while the wallet is open. The wallet never saves them unencrypted, never writes them to logs, and never sends them online.</li>
          <li>Signing happens offline on this device.</li>
          <li>Sending funds is switched off until it is separately approved — signing alone never moves your funds.</li>
        </ul>
      </div>

      <AutoLockSetting />

      <Card className="rounded-xl lg:col-span-2">
        <CardHeader>
          <CardTitle><span className="bawa-marker">Backup</span> procedure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-ink">
            Your recovery phrase is stored encrypted in this browser&apos;s vault. Write it down on paper and keep it somewhere only you can reach — anyone with the phrase can take the funds.
          </p>
          <p className="max-w-[75ch] text-sm text-ink">
            Back up first: this wallet shows no receiving address — and cannot receive funds — until you have written down your recovery phrase.
          </p>
          <Link
            to="/mnemonic-backup"
            className="inline-block text-sm font-medium text-ink bawa-squiggle-underline"
          >
            View the backup procedure
          </Link>
        </CardContent>
      </Card>

      {vaultState !== 'no-vault' && (
        <Card className="rounded-xl border-destructive/40">
          <CardHeader>
            <CardTitle>Delete vault</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deleting the vault removes the encrypted recovery phrase from this device. This cannot
              be undone — make sure you have written down your recovery phrase first.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!deleteArmed) {
                  setDeleteArmed(true);
                  return;
                }

                await deleteVault();
                await refreshVaultAccounts();
              }}
            >
              {deleteArmed ? 'Tap again to confirm delete' : 'Delete vault'}
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
