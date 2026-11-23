import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ensureAdapters, useWallet } from "../state/wallet-context";
import { accountPathFor, chainConfig, type ChainId } from "../wallet/chains";
import {
  CHAIN_DECIMALS,
  formatNativeWithSymbol,
} from "../wallet/chain-amount-format";
import { accountName, MAX_CREATE_AT_ONCE } from "../wallet/vault";
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
// stored but invisible here. The xpub map, validation and derivation
// already cover all 22. The vault section keeps the original four —
// its address list is out of this item's scope.
const watchChains = [
  { id: "btc", name: "Bitcoin" },
  { id: "eth", name: "Ethereum" },
  { id: "trx", name: "TRON" },
  { id: "ton", name: "TON" },
  { id: "sol", name: "Solana" },
  { id: "bsc", name: "BNB Smart Chain" },
  { id: "matic", name: "Polygon" },
  { id: "arb", name: "Arbitrum One" },
  { id: "op", name: "OP Mainnet" },
  { id: "base", name: "Base" },
  { id: "avax", name: "Avalanche C-Chain" },
  { id: "ltc", name: "Litecoin" },
  { id: "doge", name: "Dogecoin" },
  { id: "gnosis", name: "Gnosis" },
  { id: "celo", name: "Celo" },
  { id: "linea", name: "Linea" },
  { id: "mantle", name: "Mantle" },
  { id: "scroll", name: "Scroll" },
  { id: "opbnb", name: "opBNB" },
  { id: "metis", name: "Metis" },
  { id: "aurora", name: "Aurora" },
  { id: "fantom", name: "Fantom" },
] as const;

// Lane C (bot use case): every chain the vault can export an extended
// public key for, plus TON and SOL, which have no extended public key
// (fully hardened paths) — the address itself is what the bot uses.
const exportChains: ReadonlyArray<{ id: ChainId; name: string }> = [
  { id: "btc", name: "Bitcoin" },
  { id: "eth", name: "Ethereum" },
  { id: "trx", name: "TRON" },
  { id: "ton", name: "TON" },
  { id: "sol", name: "Solana" },
  { id: "bsc", name: "BNB Smart Chain" },
  { id: "matic", name: "Polygon" },
  { id: "arb", name: "Arbitrum One" },
  { id: "op", name: "OP Mainnet" },
  { id: "base", name: "Base" },
  { id: "avax", name: "Avalanche C-Chain" },
  { id: "ltc", name: "Litecoin" },
  { id: "doge", name: "Dogecoin" },
  { id: "gnosis", name: "Gnosis" },
  { id: "celo", name: "Celo" },
  { id: "linea", name: "Linea" },
  { id: "mantle", name: "Mantle" },
  { id: "scroll", name: "Scroll" },
  { id: "opbnb", name: "opBNB" },
  { id: "metis", name: "Metis" },
  { id: "aurora", name: "Aurora" },
  { id: "fantom", name: "Fantom" },
];

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
          variant="outline"
          size="sm"
          onClick={() => setAttempt((count) => count + 1)}
        >
          Retry balance
        </Button>
      </p>
    );
  }
  return (
    <p className="text-sm font-medium">
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
    vaultPassphraseNeeded: vaultPassphraseNeededRaw,
    createVaultAccounts,
    selectVaultAccount,
    exportAccountExtendedPublicKey,
  } = useWallet();
  // Older mocked contexts may not provide the new fields; default them
  // so the screen still renders.
  const addresses = addressesRaw ?? {};
  const hasWallets = watchChains.some(({ id }) => Boolean(xpubs[id]));
  // Older mocked contexts may not provide the new fields; default them
  // so the screen still renders.
  const vaultAccounts = vaultAccountsRaw ?? [];
  const vaultPassphraseNeeded = vaultPassphraseNeededRaw ?? false;
  const hasVault = vaultAccounts.length > 0;

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
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copiedChain, setCopiedChain] = useState<string | null>(null);

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

  return (
    <section className="space-y-6" aria-labelledby="wallets-heading">
      <h1 id="wallets-heading" className="text-2xl font-semibold">
        Wallets
      </h1>
      <p className="text-sm text-muted-foreground">
        Wallets is where you manage the wallets this app knows about. Your
        vault — the wallet made from your recovery phrase — is at the top.
        Below it are any watch-only wallets you imported: the app can show
        their balances and history, but it can never spend from them,
        because no private key is stored here.
      </p>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Your accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
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

          {hasVault ? (
            <>
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">Create wallet</h2>
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
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Create 10 accounts"
                      onClick={() => void createAccounts(10)}
                      disabled={isCreating || !createVaultAccounts}
                    >
                      10
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
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
                  <p role="alert" className="text-sm text-destructive">
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
                <h2 className="text-sm font-semibold">Your accounts</h2>
                <ul className="space-y-2">
                  {vaultAccounts.map((account) => {
                    const isCurrent = vaultAccount.account === account;
                    return (
                      <li
                        key={account}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {accountName(account)}
                          {isCurrent && <Badge>Current</Badge>}
                        </span>
                        {!isCurrent && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void switchToAccount(account)}
                            disabled={
                              switchingAccount !== null || !selectVaultAccount
                            }
                          >
                            {switchingAccount === account
                              ? "Switching…"
                              : `Switch to ${accountName(account)}`}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {switchError && (
                  <p role="alert" className="text-sm text-destructive">
                    {switchError}
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
                    className="w-28"
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
                    className="w-28"
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
                <p role="alert" className="text-sm text-destructive">
                  {accountError}
                </p>
              )}
              <h2 className="text-sm font-semibold">Addresses for this account</h2>
              <dl className="space-y-3">
                {chains.map(({ id, name }) => (
                  <div key={id} className="space-y-1">
                    <dt className="text-sm font-semibold">{name}</dt>
                    <dd>
                      <code className="block break-all rounded-md bg-muted p-3 text-sm">
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

              <div className="space-y-3">
                <h2 className="text-sm font-semibold">
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
                <ul className="space-y-2">
                  {exportChains.map(({ id, name }) => {
                    const isSingleAddress = id === "ton" || id === "sol";
                    const shown = shownKeys[id];
                    return (
                      <li
                        key={id}
                        className="space-y-2 rounded-md border px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <ChainLogo chain={id} />
                            {name}
                          </span>
                          {!isSingleAddress && !shown && (
                            <Button
                              type="button"
                              variant="outline"
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
                              variant="outline"
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
                          <code className="block break-all rounded-md bg-muted p-3 text-sm">
                            {vaultAddresses[id]?.[0] ?? "—"}
                          </code>
                        ) : shown ? (
                          <code className="block break-all rounded-md bg-muted p-3 text-sm">
                            {shown}
                          </code>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {exportError && (
                  <p role="alert" className="text-sm text-destructive">
                    {exportError}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You don&apos;t have a wallet yet. Create one from a new
                recovery phrase, or import the phrase of a wallet you
                already have.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" asChild>
                  <Link to="/create-wallet">Create a wallet</Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/import-wallet">Import a wallet</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasWallets ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Watch-only wallets</h2>
          <p className="text-sm text-muted-foreground">
            These wallets were imported by public key or address. The app
            can show their balances and history, but it cannot sign or send
            from them. To stop watching one, choose “Forget stored key”.
          </p>
          <ul className="space-y-4">
          {watchChains.map(({ id, name }) => {
            const wallet = xpubs[id];
            if (!wallet) return null;
            const shortXpub = `${wallet.xpub.slice(0, 12)}…${wallet.xpub.slice(-8)}`;
            // The watched address is the first derived address for the
            // entry (for an address entry that IS the address; for an
            // xpub entry its first derived address) — the same address
            // the refresh path reads. Older mocked contexts may not
            // provide addresses; fall back to the stored value.
            const watchedAddress =
              addresses[id]?.[0]?.address ?? wallet.xpub;

            return (
              <li key={id}>
                <Card className="rounded-xl">
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <ChainLogo chain={id} />
                      <div className="min-w-0 space-y-1">
                        <CardTitle>{name}</CardTitle>
                        <p className="break-words text-sm text-muted-foreground">
                          {wallet.label || "Unlabelled wallet"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeXpub(id)}
                      aria-label={`Forget stored ${name} key`}
                    >
                      Forget stored key
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <span className="sr-only">{id === "ton" ? "TON public address: " : "Extended public key: "}</span>
                    <code className="break-all text-sm">{shortXpub}</code>
                    <div className="mt-2">
                      <WatchOnlyBalance chain={id} address={watchedAddress} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
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
            <Link
              to="/import-wallet"
              className="inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              Import wallet
            </Link>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        What is stored here: only extended public keys and TON public
        addresses, kept in this browser. No recovery phrase or private key
        is stored anywhere in this wallet. An extended public key lets
        anyone who has it see this account&apos;s addresses, balances and
        transaction history — that is all it can do. Forgetting a key
        removes it from this browser, but it cannot take back a copy
        someone already made.
      </p>

      {hasWallets && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            for (const { id } of watchChains) removeXpub(id);
          }}
        >
          Forget all stored keys
        </Button>
      )}
    </section>
  );
}
