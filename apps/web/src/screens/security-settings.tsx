import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { BawaIcon } from "../ui/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";
import { deleteVault } from "../wallet/vault";
import { AutoLockSetting } from "./auto-lock-setting";

// Keep in sync with apps/web/package.json ("version"). There is a test
// that reads the package version and expects this screen to show it, so
// a bump that forgets this line fails loudly instead of going stale.
const APP_VERSION = "0.1.0";

export function SecuritySettingsScreen() {
  const { vaultState, refreshVaultAccounts, resetReceiveRotation = () => {} } = useWallet();
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    setDeleteArmed(false);
  }, [vaultState]);

  // Lane 6 redesign (DESIGN-SYSTEM.md §6 Settings): sections in order —
  // vault lock, mnemonic backup, connected wallets, connections
  // (networks / devnet / prices), the WalletConnect note, about,
  // then what the wallet does.
  // Before, the reading panel came first and buried the one control
  // (auto-lock) under it; the controls now come first and the reading
  // stays, in full, below them. Desktop two-column grid, mobile single
  // 480px column (the shell's isWideAtDesktop cap), unchanged.
  return (
    <section
      className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
      aria-labelledby="security-heading"
    >
      <h1 id="security-heading" className="text-2xl font-semibold lg:col-span-2">
        Security &amp; backup
      </h1>

      <AutoLockSetting />

      <Card radius="xl">
        <CardHeader>
          <CardTitle>Connected wallets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-ink">
            Your vault accounts and any watch-only wallets live on the
            Wallets screen.
          </p>
          <Link
            to="/wallets"
            className="inline-block text-sm font-medium text-ink bawa-squiggle-underline"
          >
            Open Wallets
          </Link>
        </CardContent>
      </Card>

      <Card radius="xl" className="lg:col-span-2">
        <CardHeader>
          <CardTitle><span className="bawa-marker">Backup</span> procedure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-ink">
            Your recovery phrase is stored encrypted in this browser&apos;s vault. Write it down on paper and keep it somewhere only you can reach. Anyone with the phrase can take the funds.
          </p>
          <p className="max-w-[75ch] text-sm text-ink">
            Back up first. This wallet shows no receiving address and cannot receive funds until you have written down your recovery phrase.
          </p>
          <Link
            to="/mnemonic-backup"
            className="inline-block text-sm font-medium text-ink bawa-squiggle-underline"
          >
            View the backup procedure
          </Link>
        </CardContent>
      </Card>

      <Card radius="xl" className="lg:col-span-2">
        <CardHeader>
          <CardTitle><span className="bawa-marker">Backup</span> shares</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-ink">
            Split the vault key into shares and store each one in a
            separate place. Any 2 of 3 shares restore this vault — no
            single share can.
          </p>
          <Link
            to="/backup-shares"
            className="inline-block text-sm font-medium text-ink bawa-squiggle-underline"
          >
            Create or check backup shares
          </Link>
        </CardContent>
      </Card>

      <Card radius="xl" className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-ink">
            Which network the wallet talks to, devnet test mode, which
            backup it uses, and where prices come from live on the
            Networks screen — they are connection settings, not vault
            settings.
          </p>
          <Link
            to="/networks"
            className="inline-block text-sm font-medium text-ink bawa-squiggle-underline"
          >
            Open Networks
          </Link>
        </CardContent>
      </Card>

      <Card radius="xl" className="lg:col-span-2">
        <CardHeader>
          <CardTitle>WalletConnect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-ink">
            WalletConnect — connecting Bawa to dApps — is not available in
            this build. It needs a free Reown Cloud project ID, which has
            not been set up. No keys or funds are affected.
          </p>
          <p className="max-w-[75ch] text-sm text-ink">
            To bring it back later: create a free account at{" "}
            <a
              href="https://cloud.reown.com"
              className="font-medium text-ink bawa-squiggle-underline"
            >
              cloud.reown.com
            </a>
            , create a project, copy the project ID into{" "}
            <code>VITE_WALLETCONNECT_PROJECT_ID</code>, and restore the
            WalletConnect files from git history.
          </p>
        </CardContent>
      </Card>

      <Card radius="xl" className="lg:col-span-2">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="max-w-[75ch] text-sm text-ink">
            Bawa Web Wallet · Version {APP_VERSION}
          </p>
        </CardContent>
      </Card>

      <div className="rounded-bawa border-2 border-ink bg-paper p-6 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><BawaIcon name="shield" className="size-6" /> What this wallet does</h2>
        <ul className="mt-3 max-w-[75ch] list-disc space-y-2 pl-5 text-sm text-ink">
          <li>Your recovery phrase is created in this browser and kept encrypted in the vault on this device.</li>
          <li>Your private keys stay in memory on this device while the wallet is open. They are never saved unencrypted, written to logs or sent online.</li>
          <li>Signing happens offline on this device.</li>
          <li>Sending funds is switched off until it is separately approved. Signing alone never moves your funds.</li>
        </ul>
      </div>

      {vaultState !== 'no-vault' && (
        <Card radius="xl" borderTone="destructive">
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
                // The deleted vault's HD receive rotation goes with it.
                resetReceiveRotation();
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
