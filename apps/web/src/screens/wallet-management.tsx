import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { WatchOnlyWallet } from "@bawa/contracts";
import { ensureAdapters, useWallet } from "../state/wallet-context";
import { accountPathFor, chainConfig, filterChains, SUPPORTED_CHAINS, type ChainId } from "../wallet/chains";
import {
  CHAIN_DECIMALS,
  formatNativeWithSymbol,
} from "../wallet/chain-amount-format";
import {
  accountName,
  displayAccountName,
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_CREATE_AT_ONCE,
} from "../wallet/vault";
import { readBackupDone } from "../wallet/backup-state";
import { watchOnlyValueKind } from "../wallet/watch-only-families";
import { AddressIdenticon } from "../ui/components/address-identicon";
import { ChainLogo } from "./token-logo";
import { Badge } from "../ui/components/badge";
import { Button } from "../ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";
import { Input } from "../ui/components/input";
import { Label } from "../ui/components/label";

const chains = [
  { id: "btc", name: "Bitcoin" },
  { id: "eth", name: "Ethereum" },
  { id: "trx", name: "TRON" },
  { id: "ton", name: "TON" },
] as const;

// Token gaps, item 6 + item 8, extended by Lane C to all 22 registry
// chains: the WATCH-ONLY list used to cover 13 chains, so a watch-only
// wallet imported for any of the nine newer chains (e.g. Gnosis) was
// stored but invisible here. Fix-all Lane H, item 12 (jscpd family W):
// the watch-only and export lists were the same 22-chain literal
// twice — both now derive from SUPPORTED_CHAINS (same order, same
// display names, verified against chains.ts), so a new registry chain
// appears in both automatically. The vault section keeps the original
// four — its address list is out of this item's scope.
const watchChains = SUPPORTED_CHAINS.map((id) => ({ id, name: chainConfig(id).displayName }));

// Lane C (bot use case): every chain the vault can export an extended
// public key for, plus TON and SOL, which have no extended public key
// (fully hardened paths) — the address itself is what the bot uses.
// Same 22 as watchChains above — one list, not a second literal.
const exportChains: ReadonlyArray<{ id: ChainId; name: string }> = watchChains;

// Lane B (Finish the Product, 2026-11-23): the balance of a watched
// address, on its own row. balances[chain] is vault-shadowed —
// refreshBalances reads the vault address first — so a watch-only
// balance never reaches the asset rows while a vault exists. This row
// fetches the watched address directly (same adapter, same retry shape
// as the refresh path) so the screen's "can show their balances"
// sentence is true. Fetch-on-mount only: revisiting the screen
// re-fetches, matching the app's refresh-on-demand model.
function WatchOnlyBalance({
  chain,
  address,
}: {
  chain: ChainId;
  address: string;
}) {
  const [balance, setBalance] = useState<
    'loading' | { value: string } | 'error' | 'unavailable'
  >('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setBalance('loading');
    void (async () => {
      try {
        const adapters = await ensureAdapters();
        const adapter = adapters.getAdapter(chain);
        if (!adapter) {
          if (!cancelled) setBalance('unavailable');
          return;
        }
        const result = await adapter.getBalance(address);
        if (cancelled) return;
        setBalance(
          result.status === 'ok'
            ? { value: result.data.valueBaseUnits }
            : 'error',
        );
      } catch {
        if (!cancelled) setBalance('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, address, attempt]);
  if (balance === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading balance…</p>;
  }
  if (balance === 'unavailable') {
    return (
      <p className="text-sm text-muted-foreground">
        Balance unavailable for this chain.
      </p>
    );
  }
  if (balance === 'error') {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Could not load balance.</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setAttempt((count) => count + 1)}
        >
          Retry balance
        </Button>
      </p>
    );
  }
  return (
    <p className="text-base font-medium">
      Balance:{' '}
      {formatNativeWithSymbol(
        balance.value,
        CHAIN_DECIMALS[chain],
        chainConfig(chain).symbol,
      )}
    </p>
  );
}

export function WalletManagementScreen() {
  const {
    xpubs,
    addresses: addressesRaw,
    removeXpub,
    vaultAccount,
    setVaultAccount,
    vaultAddresses,
    vaultAccounts: vaultAccountsRaw,
    vaultAccountNames: vaultAccountNamesRaw,
    vaultPassphraseNeeded: vaultPassphraseNeededRaw,
    createVaultAccounts,
    selectVaultAccount,
    renameVaultAccount,
    deleteVaultAccount,
    exportAccountExtendedPublicKey,
  } = useWallet();
  // Older mocked contexts may not provide the new fields; default them
  // so the screen still renders.
  const addresses = addressesRaw ?? {};
  const hasWallets = watchChains.some(({ id }) => Boolean(xpubs[id]));
  // Older mocked contexts may not provide the new fields; default them
  // so the screen still renders.
  const vaultAccounts = vaultAccountsRaw ?? [];
  const vaultAccountNames = vaultAccountNamesRaw ?? {};
  const vaultPassphraseNeeded = vaultPassphraseNeededRaw ?? false;
  const hasVault = vaultAccounts.length > 0;
  // S3-A (P1 item 8, F28): the backup-completion state — set when the
  // phrase is revealed on the Backup screen or a set of backup shares
  // is created. Read on mount; navigating back here re-reads it.
  const [backedUp] = useState(() => readBackupDone());

  // Vault account selection (Fix Lane 3 p14b). Inputs track the context
  // selection; Apply clamps invalid input to 0 and re-derives.
  const [accountInput, setAccountInput] = useState(() =>
    String(vaultAccount.account),
  );
  const [indexInput, setIndexInput] = useState(() =>
    String(vaultAccount.index),
  );
  const [isDeriving, setIsDeriving] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Lane C, item 8: bulk account creation and switching.
  const [countInput, setCountInput] = useState("1");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState<number | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Lane C (bot use case): extended public keys are shown only on
  // demand, one chain at a time, and only while the vault is unlocked.
  // They are public data, but they reveal every address, balance and
  // transaction — so they are never rendered unprompted and never stored.
  const [shownKeys, setShownKeys] = useState<Record<string, string>>({});
  // Lane 6 redesign: the export list below covers all 87 chains, so it
  // gets the same name/symbol/id search the Networks list uses.
  // Merge (Lane 5 + Lane 6): the search lives inside Lane 5's
  // disclosure below, so the 87-row list stays collapsed until asked
  // for and searchable once opened.
  const [exportQuery, setExportQuery] = useState("");
  const exportNeedle = exportQuery.trim();
  const exportVisible = (
    exportNeedle === ""
      ? exportChains.map(({ id }) => id)
      : filterChains(
          exportChains.map(({ id }) => id),
          exportNeedle,
        )
  ).map((id) => ({ id, name: chainConfig(id).displayName }));
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copiedChain, setCopiedChain] = useState<string | null>(null);
  // Lane 5: forgetting every stored key at once is destructive, so
  // it takes two taps like Delete vault (DESIGN-SYSTEM §6).
  const [forgetAllArmed, setForgetAllArmed] = useState(false);

  async function showExtendedKey(chain: ChainId) {
    if (loadingKey !== null || !exportAccountExtendedPublicKey) return;
    setExportError(null);
    setCopiedChain(null);
    setLoadingKey(chain);
    try {
      const key = await exportAccountExtendedPublicKey(chain);
      if (key === null) {
        setExportError(
          "Unlock your vault first — see security settings.",
        );
      } else {
        setShownKeys((previous) => ({ ...previous, [chain]: key }));
      }
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingKey(null);
    }
  }

  async function copyExtendedKey(chain: ChainId) {
    const key = shownKeys[chain];
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopiedChain(chain);
    } catch {
      setExportError("Unable to copy. Please copy it manually.");
    }
  }

  useEffect(() => {
    setAccountInput(String(vaultAccount.account));
    setIndexInput(String(vaultAccount.index));
  }, [vaultAccount.account, vaultAccount.index]);

  async function applyVaultAccount() {
    if (isDeriving) return;
    const clamp = (value: string) => {
      if (value.trim() === "") return 0;
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
    };
    const account = clamp(accountInput);
    const index = clamp(indexInput);
    setAccountInput(String(account));
    setIndexInput(String(index));
    setAccountError(null);
    setIsDeriving(true);
    try {
      await setVaultAccount(account, index);
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsDeriving(false);
    }
  }

  async function createAccounts(count: number) {
    if (isCreating || !createVaultAccounts) return;
    if (!Number.isInteger(count) || count < 1 || count > MAX_CREATE_AT_ONCE) {
      setCreateSuccess(null);
      setCreateError(
        `Enter a number between 1 and ${MAX_CREATE_AT_ONCE}.`,
      );
      return;
    }
    setCreateError(null);
    setCreateSuccess(null);
    setIsCreating(true);
    try {
      const created = await createVaultAccounts(count);
      if (created.length === 0) {
        setCreateSuccess("No new accounts were created.");
      } else if (created.length === 1) {
        setCreateSuccess(`${accountName(created[0] as number)} created.`);
      } else {
        setCreateSuccess(
          `${accountName(created[0] as number)} to ${accountName(created[created.length - 1] as number)} created.`,
        );
      }
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsCreating(false);
    }
  }

  async function switchToAccount(account: number) {
    if (switchingAccount !== null || !selectVaultAccount) return;
    setSwitchError(null);
    setSwitchingAccount(account);
    try {
      await selectVaultAccount(account);
    } catch (cause) {
      setSwitchError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSwitchingAccount(null);
    }
  }

  // Lane E, item 4a: rename and per-account delete. Rename is an inline
  // edit on the account row; a blank save clears the custom name back
  // to the default. Delete takes two taps like Delete vault and the
  // address book's Remove (DESIGN-SYSTEM §6): the first tap arms it,
  // the second deletes. Deleting the Current account moves Current to
  // the first remaining account; the only account has no Delete button
  // at all (removing it is what Delete vault is for).
  const [renamingAccount, setRenamingAccount] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [armedDeleteAccount, setArmedDeleteAccount] = useState<number | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<number | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startRename(account: number) {
    setRenameError(null);
    setRenameInput(displayAccountName(account, vaultAccountNames));
    setRenamingAccount(account);
  }

  function saveRename() {
    if (renamingAccount === null || !renameVaultAccount) return;
    const account = renamingAccount;
    const trimmed = renameInput.trim();
    if (trimmed.length > MAX_ACCOUNT_NAME_LENGTH) {
      setRenameError(
        `Keep the name to ${MAX_ACCOUNT_NAME_LENGTH} characters or fewer.`,
      );
      return;
    }
    try {
      renameVaultAccount(account, trimmed);
    } catch (cause) {
      setRenameError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    setRenamingAccount(null);
    setRenameError(null);
  }

  async function deleteAccount(account: number) {
    if (deletingAccount !== null || !deleteVaultAccount) return;
    if (armedDeleteAccount !== account) {
      setDeleteStatus(null);
      setDeleteError(null);
      setArmedDeleteAccount(account);
      return;
    }
    const wasCurrent = vaultAccount.account === account;
    const removedName = displayAccountName(account, vaultAccountNames);
    setArmedDeleteAccount(null);
    setDeleteError(null);
    setDeleteStatus(null);
    setDeletingAccount(account);
    try {
      const result = await deleteVaultAccount(account);
      if (!result.ok) {
        // Unreachable from this screen (the only account has no Delete
        // button), but the store refuses it — say so plainly.
        setDeleteError(
          "This is your only account. To remove it, delete the vault in Security settings.",
        );
        return;
      }
      setDeleteStatus(
        wasCurrent
          ? `${removedName} deleted. Current account is now ${displayAccountName(result.current, vaultAccountNames)}.`
          : `${removedName} deleted.`,
      );
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDeletingAccount(null);
    }
  }

  return (
    // Follow-up (P9): the vault card sat full-width above the imported
    // list, which left the "No wallets imported" card mostly empty and
    // the vault card with dead space bottom-right. The screen is now
    // two columns at lg — vault card left, imported list (or the empty
    // card), note and Forget-all button in a right rail. Below lg the
    // same blocks stack in one column in the same order (space-y-6,
    // no bare grid class), so the mobile layout is untouched.
    // P0 (plan P0-7, Lane B B-3): the disclosure and the two columns
    // carry explicit placement — the disclosure spans both columns, the
    // vault card is row 3 column 1 and the rail is row 3 column 2 — so
    // grid auto-placement can no longer push the vault card into the
    // narrow rail (the "About Wallets" disclosure used to take column 1
    // and the vault card flowed into column 2).
    <section className="space-y-6 lg:grid lg:grid-cols-[7fr_5fr] lg:gap-6 lg:items-start lg:space-y-0" aria-labelledby="wallets-heading">
      <h1 id="wallets-heading" className="font-bold lg:col-span-2">
        Wallets
      </h1>
      {/* Lane B (Finish the Product, G10): the opening essay used to
          render in full and make the page 7,622 px tall on a phone.
          It collapses into a disclosure now — same words, same
          "How accounts work" details/summary shape below — so the
          actions come first and the essay is one tap away. */}
      <details className="lg:col-span-2">
        <summary className="cursor-pointer text-sm font-semibold">
          About Wallets
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Wallets is where you manage the wallets this app knows about. Your
          vault — the wallet made from your recovery phrase — is at the top.
          Below it are any watch-only wallets you imported: the app can show
          their balances and history, but it can never spend from them,
          because no private key is stored here.
        </p>
      </details>

      <Card radius="flat" className="lg:col-start-1 lg:row-start-3">
        <CardHeader>
          <CardTitle>Your accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* S3-A (P1 item 8, F28): the backup-completion state on
              Wallets. Backed up shows a badge; otherwise the nudge
              links to the Backup screen. */}
          {hasVault && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {backedUp ? (
                <Badge variant="success">Backed up</Badge>
              ) : (
                <Link
                  to="/mnemonic-backup"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Back up your recovery phrase
                </Link>
              )}
            </p>
          )}
          {/* Lane 5: with no vault the actions come first — the
              explainer below is about a phrase the user does not have
              yet, and it used to push Create/Import under the bottom
              nav's edge on a phone. With a vault the explainer stays
              exactly where it was. */}
          {!hasVault && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You don&apos;t have a wallet yet. Create one from a new
                recovery phrase, or import the phrase of a wallet you
                already have.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" size="lg" asChild>
                  <Link to="/create-wallet">Create a wallet</Link>
                </Button>
                <Button type="button" variant="secondary" size="md" asChild>
                  <Link to="/import-wallet">Import a wallet</Link>
                </Button>
              </div>
            </div>
          )}
          {hasVault && (
          // Merge (Lane 5 + Lane 6): Lane 5 puts the actions first when
          // there is no vault; with a vault the explainer keeps Lane 6's
          // one-tap disclosure, so the words are unchanged and the
          // controls still come first.
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              How accounts work
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Your recovery phrase holds all your accounts. Each account is
              one wallet made from the same phrase, and each has its own
              addresses on every chain.
              That is the multichain wallet: one address per chain, all
              chains, for the account you are using. The HD wallet is
              different: for a payment you can ask for a fresh receiving
              address, derived from the next unused number, on the Receive
              screen. Creating another account never deletes or changes the
              ones you already have, and your phrase never leaves this
              device. A different recovery phrase is a different wallet — to
              use one, delete this vault first in{" "}
              <Link
                to="/security"
                className="font-medium text-primary underline underline-offset-4"
              >
                security settings
              </Link>
              .
            </p>
          </details>
          )}

          {vaultPassphraseNeeded && hasVault && (
            <p className="text-sm text-muted-foreground">
              This wallet uses a recovery passphrase. To switch accounts,
              unlock it with your passphrase first —{" "}
              <Link
                to="/lock"
                className="font-medium text-primary underline underline-offset-4"
              >
                Unlock
              </Link>
              .
            </p>
          )}

          {hasVault && (
            <>
              <div className="space-y-3">
                <h2 className="font-semibold">Create more accounts</h2>
                <div className="space-y-2">
                  <Label htmlFor="create-accounts-count">
                    How many new accounts would you like to create?
                  </Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      id="create-accounts-count"
                      type="number"
                      min={1}
                      max={MAX_CREATE_AT_ONCE}
                      step={1}
                      value={countInput}
                      onChange={(event) => setCountInput(event.target.value)}
                      disabled={isCreating}
                      width="sm"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label="Create 10 accounts"
                      onClick={() => void createAccounts(10)}
                      disabled={isCreating || !createVaultAccounts}
                    >
                      10
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label="Create 50 accounts"
                      onClick={() => void createAccounts(50)}
                      disabled={isCreating || !createVaultAccounts}
                    >
                      50
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void createAccounts(Number(countInput))}
                      disabled={isCreating || !createVaultAccounts}
                    >
                      {isCreating ? "Creating…" : "Create accounts"}
                    </Button>
                  </div>
                </div>
                {createError && (
                  <p role="alert" className="text-base text-destructive">
                    {createError}
                  </p>
                )}
                {createSuccess && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {createSuccess}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold">Your accounts</h2>
                <ul className="space-y-2">
                  {vaultAccounts.map((account) => {
                    const isCurrent = vaultAccount.account === account;
                    const displayName = displayAccountName(
                      account,
                      vaultAccountNames,
                    );
                    const defaultName = accountName(account);
                    const isRenamed = displayName !== defaultName;
                    const isRenaming = renamingAccount === account;
                    const isDeleteArmed = armedDeleteAccount === account;
                    return (
                      <li
                        key={account}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-flat border px-3 py-2"
                      >
                        {isRenaming ? (
                          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <Label htmlFor={`rename-account-${account}`} className="sr-only">
                              {`Rename ${defaultName}`}
                            </Label>
                            <Input
                              id={`rename-account-${account}`}
                              value={renameInput}
                              maxLength={MAX_ACCOUNT_NAME_LENGTH}
                              onChange={(event) =>
                                setRenameInput(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") saveRename();
                                if (event.key === "Escape") {
                                  setRenamingAccount(null);
                                  setRenameError(null);
                                }
                              }}
                              autoFocus
                            />
                            <Button type="button" onClick={saveRename}>
                              Save name
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                setRenamingAccount(null);
                                setRenameError(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-2 text-base font-medium">
                              {displayName}
                              {isRenamed && (
                                <span className="text-sm font-normal text-muted-foreground">
                                  {defaultName}
                                </span>
                              )}
                              {isCurrent && <Badge>Current</Badge>}
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              {!isCurrent && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => void switchToAccount(account)}
                                  disabled={
                                    switchingAccount !== null ||
                                    !selectVaultAccount
                                  }
                                >
                                  {switchingAccount === account
                                    ? "Switching…"
                                    : `Switch to ${displayName}`}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => startRename(account)}
                                disabled={
                                  renamingAccount !== null ||
                                  !renameVaultAccount
                                }
                              >
                                Rename
                              </Button>
                              {vaultAccounts.length > 1 && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => void deleteAccount(account)}
                                  disabled={
                                    deletingAccount !== null ||
                                    !deleteVaultAccount
                                  }
                                >
                                  {deletingAccount === account
                                    ? "Deleting…"
                                    : isDeleteArmed
                                      ? "Tap again to delete"
                                      : "Delete"}
                                </Button>
                              )}
                            </span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {vaultAccounts.length === 1 && (
                  <p className="text-sm text-muted-foreground">
                    This is your only account. To remove it, delete the
                    vault in{" "}
                    <Link
                      to="/security"
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Security settings
                    </Link>
                    .
                  </p>
                )}
                {switchError && (
                  <p role="alert" className="text-base text-destructive">
                    {switchError}
                  </p>
                )}
                {renameError && (
                  <p role="alert" className="text-base text-destructive">
                    {renameError}
                  </p>
                )}
                {deleteStatus && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {deleteStatus}
                  </p>
                )}
                {deleteError && (
                  <p role="alert" className="text-base text-destructive">
                    {deleteError}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="vault-account">Account number</Label>
                  <Input
                    id="vault-account"
                    type="number"
                    min={0}
                    step={1}
                    value={accountInput}
                    onChange={(event) => setAccountInput(event.target.value)}
                    disabled={isDeriving}
                    width="sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vault-index">
                    Receiving address number (HD)
                  </Label>
                  <Input
                    id="vault-index"
                    type="number"
                    min={0}
                    step={1}
                    value={indexInput}
                    onChange={(event) => setIndexInput(event.target.value)}
                    disabled={isDeriving}
                    width="sm"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => void applyVaultAccount()}
                  disabled={isDeriving}
                >
                  {isDeriving ? "Loading…" : "Apply"}
                </Button>
              </div>
              {accountError && (
                <p role="alert" className="text-base text-destructive">
                  {accountError}
                </p>
              )}
              <h2 className="font-semibold">Addresses for this account</h2>
              {/* Desktop layout (desktop-layout-v2): the four chain
                  address blocks lay out in two columns at lg. Below lg
                  they stay a single-column stack (space-y-3, no bare
                  grid class). */}
              <dl className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                {chains.map(({ id, name }) => (
                  <div key={id} className="space-y-1">
                    <dt className="text-sm font-semibold">{name}</dt>
                    <dd>
                      <code className="block break-all rounded-flat bg-muted p-3 text-sm">
                        {vaultAddresses[id]?.[0] ?? "—"}
                      </code>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted-foreground">
                Solana and TON addresses change with the account as well;
                account 0 keeps its original address.
              </p>
              <p className="text-sm text-muted-foreground">
                These are the four original chains. Your address on any
                other chain is on that chain&apos;s asset page — see{' '}
                <Link
                  to="/assets"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  all assets
                </Link>
                .
              </p>
              {/* Bug-hunt v2 (V2): the address book had no entry point
                  on mobile — only the desktop sidebar linked it. This
                  is the one-tap path: header "Account 1 ›" → Wallets →
                  Address book. */}
              <p className="text-sm text-muted-foreground">
                Saved recipient addresses live in your{' '}
                <Link
                  to="/address-book"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  address book
                </Link>
                .
              </p>

              <div className="space-y-3">
                <h2 className="font-semibold">
                  Account public keys for your bot
                </h2>
                <p className="text-sm text-muted-foreground">
                  An extended public key lets your bot work out many
                  receiving addresses for this account without your
                  recovery phrase. It can see addresses, balances and
                  history, but it can never spend — no private key is in
                  it. Keep it to systems you trust. Solana and TON have
                  no extended public key — their paths are fully hardened
                  — so use the address itself.
                </p>
                {/* Lane 5: the 87-row key list used to render in full
                    and make this page ~18,000 px tall on a phone,
                    burying the watch-only section below it. The keys
                    are a bot power feature; they collapse into a
                    disclosure. Everything inside is unchanged. */}
                <details className="rounded-flat-lg border border-ink bg-paper p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">
                    Show the extended public keys
                  </summary>
                  {/* Merge (Lane 5 + Lane 6): Lane 6's search lives
                      inside Lane 5's disclosure, so the 87-row list is
                      collapsed until asked for and searchable once open. */}
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="export-chain-search">
                      Search chains
                    </Label>
                    <Input
                      id="export-chain-search"
                      type="search"
                      placeholder="Search by name, symbol or chain ID"
                      value={exportQuery}
                      onChange={(event) => setExportQuery(event.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {exportVisible.length} of {exportChains.length} chains.
                  </p>
                  {exportVisible.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No chains match &ldquo;{exportNeedle}&rdquo;. Try a name,
                      symbol or chain ID.
                    </p>
                  ) : (
                  <ul className="mt-3 space-y-2">
                  {exportVisible.map(({ id, name }) => {
                    const isSingleAddress = id === "ton" || id === "sol";
                    const shown = shownKeys[id];
                    // TON/SOL have no xpub: the vault address itself
                    // is what the bot uses (and what gets the
                    // identicon, Lane P2-C M6).
                    const singleAddress = vaultAddresses[id]?.[0];
                    return (
                      <li
                        key={id}
                        className="space-y-2 rounded-flat border px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-base font-medium">
                            <ChainLogo chain={id} />
                            {name}
                          </span>
                          {!isSingleAddress && !shown && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void showExtendedKey(id)}
                              disabled={
                                loadingKey !== null ||
                                !exportAccountExtendedPublicKey
                              }
                            >
                              {loadingKey === id
                                ? "Showing…"
                                : "Show extended public key"}
                            </Button>
                          )}
                          {!isSingleAddress && shown && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void copyExtendedKey(id)}
                            >
                              {copiedChain === id ? "Copied" : "Copy"}
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <code>
                            {accountPathFor(id, vaultAccount.account)}
                          </code>
                          {isSingleAddress
                            ? " — no extended public key (fully hardened path). Use the address itself."
                            : " — your bot derives receiving addresses as this path plus /0/0, /0/1, /0/2…"}
                        </p>
                        {isSingleAddress ? (
                          singleAddress !== undefined ? (
                            <span className="flex items-center gap-2 rounded-flat bg-muted p-3">
                              {/* Lane P2-C (M6): TON/SOL have no xpub —
                                  the address itself is what the bot
                                  uses, so it gets its identicon. */}
                              <AddressIdenticon
                                address={singleAddress}
                                size={24}
                              />
                              <code className="min-w-0 flex-1 break-all text-sm">
                                {singleAddress}
                              </code>
                            </span>
                          ) : (
                            <code className="block break-all rounded-flat bg-muted p-3 text-sm">
                              —
                            </code>
                          )
                        ) : shown ? (
                          <code className="block break-all rounded-flat bg-muted p-3 text-sm">
                            {shown}
                          </code>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                )}
                {exportError && (
                  <p role="alert" className="mt-3 text-base text-destructive">
                    {exportError}
                  </p>
                )}
                </details>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Right rail at lg: imported list (or the empty card), the note
          and the Forget-all button. A plain div below lg, so the
          mobile order and spacing are unchanged. Explicit placement
          (P0-7): row 3, column 2 — beside the vault card, never below
          it or in the wide column. */}
      <div className="space-y-6 lg:col-start-2 lg:row-start-3">
      {hasWallets ? (
        <div className="space-y-4">
          <h2 className="font-semibold">Watch-only wallets</h2>
          <p className="text-sm text-muted-foreground">
            These wallets were imported by public key or address. The app
            can show their balances and history, but it cannot sign or send
            from them. To stop watching one, choose “Forget stored key”.
          </p>
          {/* Follow-up: the imported-wallet cards stack in one column
              inside the right rail at lg — two columns there would be
              ~260px each and crush the card headers. Below lg they stay
              a single-column stack (space-y-4, no bare grid class). */}
          <ul className="space-y-4 lg:grid lg:grid-cols-1 lg:gap-4 lg:space-y-0">
          {(() => {
            // Lane 5: one import is one card. A plain 0x address fans
            // out to 59 chains, and the old code rendered a full Card
            // per chain — one watched address was 59 cards tall, and
            // the section sat at y=17,628 on a 390 px phone. The group
            // keeps the same per-chain balance (same component, same
            // fetch) as one compact row each, with the same per-chain
            // "Forget stored key" control and the same truncated value.
            const groups: Record<
              string,
              { id: ChainId; name: string; wallet: WatchOnlyWallet }[]
            > = {};
            for (const { id, name } of watchChains) {
              const wallet = xpubs[id];
              if (!wallet) continue;
              (groups[wallet.xpub] ??= []).push({ id, name, wallet });
            }
            return Object.entries(groups).map(([value, entries]) => {
              const first = entries[0];
              if (first === undefined) return null;
              const shortXpub = `${value.slice(0, 12)}…${value.slice(-8)}`;
              return (
                <li key={value}>
                  <Card radius="flat">
                    <CardHeader>
                      {/* Merge (Lane 5 + Lane 6): Lane 5's grouped card,
                          with Lane 6's Watch-only badge on the group, so
                          the label is visible without scrolling to the
                          section heading. */}
                      <span className="flex items-center gap-2">
                        <CardTitle>
                          {first.wallet.label || 'Unlabelled wallet'}
                        </CardTitle>
                        <Badge>Watch-only</Badge>
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <span className="sr-only">
                        Stored public key or address:{' '}
                      </span>
                      {/* Lane P2-C (M6): the identicon pairs the stored
                          value — but only when it IS an address (a
                          plain-address import, or TON/SOL, whose
                          stored value is always the address). An
                          extended public key is not an address and
                          gets no identicon. */}
                      {watchOnlyValueKind(first.id, value) === 'address' ? (
                        <span className="flex items-start gap-2">
                          <AddressIdenticon address={value} size={24} />
                          <code className="min-w-0 flex-1 break-all text-sm">
                            {shortXpub}
                          </code>
                        </span>
                      ) : (
                        <code className="block break-all text-sm">
                          {shortXpub}
                        </code>
                      )}
                      <ul className="divide-y rounded-flat-sm border border-ink bg-paper">
                        {entries.map(({ id, name, wallet }) => {
                          // The watched address is the first derived
                          // address for the entry (for an address entry
                          // that IS the address; for an xpub entry its
                          // first derived address) — the same address
                          // the refresh path reads. Older mocked
                          // contexts may not provide addresses; fall
                          // back to the stored value.
                          const watchedAddress =
                            addresses[id]?.[0]?.address ?? wallet.xpub;
                          return (
                            <li
                              key={id}
                              className="px-3 py-2"
                            >
                              {/* Lane 5: the balance gets the full row
                                  width below the header line. Squeezed
                                  into the same flex row as the Forget
                                  button it wrapped to three lines
                                  ("Balance:" / number / ticker) at 390
                                  px — the balance is the point of the
                                  row, so it reads on one line now. */}
                              <div className="flex items-start gap-3">
                                <ChainLogo chain={id} size={32} />
                                <p className="min-w-0 flex-1 text-base font-semibold">
                                  {name}
                                </p>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => removeXpub(id)}
                                  aria-label={`Forget stored ${name} key`}
                                >
                                  Forget stored key
                                </Button>
                              </div>
                              <div className="mt-1">
                                <WatchOnlyBalance
                                  chain={id}
                                  address={watchedAddress}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </li>
              );
            });
          })()}
          </ul>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No wallets imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Import a watch-only wallet to watch its balances and history
              here. Watching only shows what is already public on the
              network — it cannot send.
            </p>
            <Button asChild variant="secondary" size="md">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        What is stored here: only extended public keys and TON public addresses, kept in this browser. No recovery phrase or private key is stored anywhere in this wallet. An extended public key lets its holder track this account&apos;s addresses, balances and transaction history — that is all it can do. Forgetting a key removes it from this browser, but it cannot revoke a copy someone already took.
      </p>

      {hasWallets && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!forgetAllArmed) {
              setForgetAllArmed(true);
              return;
            }
            for (const { id } of watchChains) removeXpub(id);
            setForgetAllArmed(false);
          }}
        >
          {forgetAllArmed
            ? 'Tap again to forget all stored keys'
            : 'Forget all stored keys'}
        </Button>
      )}
      </div>
    </section>
  );
}
