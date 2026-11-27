import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { BawaIcon } from "../ui/components/icons";
import { deleteVault } from "../wallet/vault";
import { AutoLockSetting } from "./auto-lock-setting";

// Keep in sync with apps/web/package.json ("version"). There is a test
// that reads the package version and expects this screen to show it, so
// a bump that forgets this line fails loudly instead of going stale.
const APP_VERSION = "0.1.0";

// P1 (S3-B, item 9 — F34): Security is a flat settings list, not nine
// cards. The one real setting (auto-lock) is the first row; Mnemonic
// backup and Backup shares are link rows; WalletConnect is one greyed
// row, not a setup manual — it needs a Reown Cloud project ID that does
// not exist. The Connected-wallets and Connections link-cards are gone
// (the sidebar already links to Wallets and Networks), the version is
// one line under the list, and "What this wallet does" is folded into
// one short line: it no longer duplicates Welcome (P0 cut it there),
// so the facts stay and the essay goes. Single column at every width;
// rows are 12px vertical / 16px horizontal (plan §c).
export function SecuritySettingsScreen() {
  const { vaultState, refreshVaultAccounts, resetReceiveRotation = () => {} } = useWallet();
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    setDeleteArmed(false);
  }, [vaultState]);

  return (
    <section
      className="mx-auto w-full max-w-2xl"
      aria-labelledby="security-heading"
    >
      <h1 id="security-heading" className="font-bold">
        Security &amp; backup
      </h1>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-bawa border-2 border-ink bg-paper">
        <li>
          <AutoLockSetting />
        </li>

        <li>
          <Link
            to="/mnemonic-backup"
            className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 text-base font-medium text-ink"
          >
            Mnemonic backup
            <BawaIcon name="chevron-down" className="size-5 shrink-0 -rotate-90" />
          </Link>
        </li>

        <li>
          <Link
            to="/backup-shares"
            className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 text-base font-medium text-ink"
          >
            Backup shares
            <BawaIcon name="chevron-down" className="size-5 shrink-0 -rotate-90" />
          </Link>
        </li>

        <li
          aria-disabled="true"
          className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 text-base text-muted-foreground"
        >
          WalletConnect
          <span>Not set up</span>
        </li>

        {vaultState !== 'no-vault' && (
          <li className="flex min-h-11 flex-wrap items-center justify-between gap-4 px-4 py-3">
            <span className="text-base font-medium text-ink">Delete vault</span>
            <Button
              type="button"
              variant="secondary"
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
          </li>
        )}
      </ul>

      <p className="mt-4 text-sm text-muted-foreground">
        Bawa Web Wallet · Version {APP_VERSION}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Your phrase stays encrypted on this device. Keys never leave it.
        Sending is off until approved. Offline signing only.
      </p>
    </section>
  );
}
