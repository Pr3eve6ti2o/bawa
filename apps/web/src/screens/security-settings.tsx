import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { BawaIcon } from "../ui/components/icons";
import { Input } from "../ui/components/input";
import { Label } from "../ui/components/label";
import {
  changePassword,
  deleteVault,
  verifyVaultPassword,
} from "../wallet/vault";
import { AutoLockSetting } from "./auto-lock-setting";

// Keep in sync with apps/web/package.json ("version"). There is a test
// that reads the package version and expects this screen to show it, so
// a bump that forgets this line fails loudly instead of going stale.
const APP_VERSION = "0.1.0";

// Same minimum as the create and import flows: a password that is set
// must meet the same bar everywhere. An empty password means "no
// password" — see the set/remove flows below.
const MIN_PASSWORD_LENGTH = 8;

// P1 (S3-B, item 9 — F34): Security is a flat settings list, not nine
// cards. The one real setting (auto-lock) is the first row; Mnemonic
// backup, Backup shares and Networks are link rows; WalletConnect is
// one greyed row, not a setup manual — it needs a Reown Cloud
// project ID that does not exist. The Connected-wallets and
// Connections link-cards are gone (the sidebar already links to
// Wallets and Networks on desktop; the Networks row below restores
// the mobile path — Lane T2 T2-2), the version is
// one line under the list, and "What this wallet does" is folded into
// one short line: it no longer duplicates Welcome (P0 cut it there),
// so the facts stay and the essay goes. Single column at every width;
// rows are 12px vertical / 16px horizontal (plan §c).
export function SecuritySettingsScreen() {
  const {
    vaultState,
    // Screens mocked in tests may omit this; only an explicit false
    // means "no password" — a password vault is the safe default.
    vaultHasPassword = true,
    refreshVaultAccounts,
    resetReceiveRotation = () => {},
    unlockVault,
  } = useWallet();
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [removePassword, setRemovePassword] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const hasVault = vaultState !== "no-vault";

  useEffect(() => {
    setDeleteArmed(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangeError(null);
    setChangeSuccess(null);
    setIsChanging(false);
    setRemovePassword("");
    setRemoveError(null);
    setIsRemoving(false);
    // F1: the remove-success line is hoisted outside the remove form so
    // it stays visible after removal. Removal flips vaultHasPassword to
    // false, which runs this reset — clearing the line here would erase
    // the confirmation the moment it succeeds. Only clear it when a
    // password is set again (or the vault is gone), so a stale line
    // never survives re-setting a password.
    if (vaultHasPassword || vaultState === "no-vault") {
      setRemoveSuccess(null);
    }
  }, [vaultState, vaultHasPassword]);

  // Lane E item 1e (broken): there was no change-password control
  // anywhere in the app — rotating the vault password meant deleting
  // the vault and starting over. The current password is verified by
  // trial decrypt (no state change) before anything is re-encrypted,
  // so a wrong current password fails honestly and leaves the vault
  // untouched. A locked vault is unlocked through the context first,
  // because changePassword needs the mnemonic in the closure.
  //
  // The password is optional (owner order 2026-11-28): the same form
  // sets a first password on a passwordless vault (no current password
  // to check — there is none) and changes it on a password vault.
  // Setting, changing, or removing the password re-encrypts under a new
  // key, so every existing Shamir backup-share set is cancelled —
  // create fresh shares afterwards.
  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isChanging) return;
    setChangeError(null);
    setChangeSuccess(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setChangeError(
        `Vault password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError("New passwords do not match.");
      return;
    }
    setIsChanging(true);
    try {
      if (vaultHasPassword) {
        if (!(await verifyVaultPassword(currentPassword))) {
          setChangeError("Incorrect password.");
          setCurrentPassword("");
          return;
        }
        if (vaultState === "locked") {
          await unlockVault(currentPassword);
        }
      } else if (vaultState === "locked") {
        // A passwordless vault never locks; this is defence in depth.
        await unlockVault("");
      }
      await changePassword(newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangeSuccess(
        vaultHasPassword
          ? "Password changed."
          : "Password set. Your wallet now locks — you will need this password after a reload.",
      );
      await refreshVaultAccounts();
    } catch (cause) {
      setChangeError(cause instanceof Error ? cause.message : String(cause));
      setCurrentPassword("");
    } finally {
      setIsChanging(false);
    }
  }

  // Removing the password is explicit: the user must type the current
  // password (proving they own the vault) and the copy states the
  // consequence — the wallet becomes unprotected, anyone with the device
  // can open it, and the existing backup shares are cancelled because
  // the vault is re-encrypted under a new key.
  async function handleRemovePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRemoving) return;
    setRemoveError(null);
    setRemoveSuccess(null);
    setIsRemoving(true);
    try {
      if (!(await verifyVaultPassword(removePassword))) {
        setRemoveError("Incorrect password.");
        setRemovePassword("");
        return;
      }
      if (vaultState === "locked") {
        await unlockVault(removePassword);
      }
      await changePassword("");
      setRemovePassword("");
      setRemoveSuccess(
        "Password removed. Your wallet is now unprotected — anyone with this device can open it.",
      );
      await refreshVaultAccounts();
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : String(cause));
      setRemovePassword("");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-2xl"
      aria-labelledby="security-heading"
    >
      <h1 id="security-heading" className="font-bold">
        Security &amp; backup
      </h1>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-flat-lg border border-ink bg-paper">
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

        <li>
          <Link
            to="/networks"
            className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 text-base font-medium text-ink"
          >
            Networks
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

        {hasVault && (
          <li className="px-4 py-3">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <p className="text-base font-medium text-ink">
                  {vaultHasPassword ? "Change password" : "Set a password"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {vaultHasPassword
                    ? "Re-encrypts the vault with a new password. The old password stops working. Changing the password cancels your backup shares — create fresh shares afterwards."
                    : "No password is set: anyone with this device can open the wallet. Setting one locks the vault — you will need it after a reload. Setting a password cancels your backup shares — create fresh shares afterwards."}
                </p>
              </div>

              {vaultHasPassword && (
                <div className="space-y-2">
                  <Label htmlFor="change-current-password">
                    Current password
                  </Label>
                  <Input
                    id="change-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    disabled={isChanging}
                    aria-invalid={changeError !== null}
                    aria-describedby={
                      changeError ? "change-password-error" : undefined
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="change-new-password">
                  {vaultHasPassword ? "New password" : "Password"}
                </Label>
                <Input
                  id="change-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  disabled={isChanging}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="change-confirm-password">
                  Confirm new password
                </Label>
                <Input
                  id="change-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isChanging}
                />
              </div>

              {changeError && (
                <p
                  id="change-password-error"
                  role="alert"
                  className="text-base text-destructive"
                >
                  {changeError}
                </p>
              )}

              {changeSuccess && (
                <p role="status" className="text-base leading-6">
                  {changeSuccess}
                </p>
              )}

              <Button type="submit" disabled={isChanging} flat>
                {isChanging
                  ? "Changing…"
                  : vaultHasPassword
                    ? "Change password"
                    : "Set password"}
              </Button>
            </form>
          </li>
        )}

        {hasVault && vaultHasPassword && (
          <li className="px-4 py-3">
            <form onSubmit={handleRemovePassword} className="space-y-4">
              <div>
                <p className="text-base font-medium text-ink">
                  Remove password
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Removes the password entirely. Your wallet will be
                  unprotected — anyone with this device can open it, with
                  no password prompt. Removing the password cancels your
                  backup shares — create fresh shares afterwards.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remove-current-password">
                  Current password
                </Label>
                <Input
                  id="remove-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={removePassword}
                  onChange={(event) => setRemovePassword(event.target.value)}
                  disabled={isRemoving}
                  aria-invalid={removeError !== null}
                  aria-describedby={
                    removeError ? "remove-password-error" : undefined
                  }
                />
              </div>

              {removeError && (
                <p
                  id="remove-password-error"
                  role="alert"
                  className="text-base text-destructive"
                >
                  {removeError}
                </p>
              )}

              <Button type="submit" disabled={isRemoving} flat>
                {isRemoving ? "Removing…" : "Remove password"}
              </Button>
            </form>
          </li>
        )}

        {hasVault && (
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

      {/* F1: section-level, not inside the password-gated remove form —
          that form unmounts the moment removal succeeds, taking the
          success line with it. Placed just below the list, where the
          remove form was, so it is in view right after removal. Gated
          on hasVault so a stale line never shows after the vault is
          deleted. */}
      {hasVault && removeSuccess && (
        <p role="status" className="mt-4 text-base leading-6">
          {removeSuccess}
        </p>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Bawa Web Wallet · Version {APP_VERSION}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasVault && !vaultHasPassword
          ? "No password is set: anyone with this device can open the wallet. Sending is off until approved. Offline signing only."
          : "Your phrase stays encrypted on this device. Keys never leave it. Sending is off until approved. Offline signing only."}
      </p>
    </section>
  );
}
