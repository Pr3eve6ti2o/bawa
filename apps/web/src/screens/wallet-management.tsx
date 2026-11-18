import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { chainConfig } from "../wallet/chains";
import { CHAIN_CHIP_COLORS } from "./asset-rows";
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

export function WalletManagementScreen() {
  const {
    xpubs,
    removeXpub,
    vaultState,
    vaultAccount,
    setVaultAccount,
    vaultAddresses,
  } = useWallet();
  const hasWallets = chains.some(({ id }) => Boolean(xpubs[id]));

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

  useEffect(() => {
    if (vaultState !== "unlocked") return;
    setAccountInput(String(vaultAccount.account));
    setIndexInput(String(vaultAccount.index));
  }, [vaultState, vaultAccount.account, vaultAccount.index]);

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

  return (
    <section className="space-y-6" aria-labelledby="wallets-heading">
      <h1 id="wallets-heading" className="text-2xl font-semibold">
        Wallets
      </h1>

      {vaultState === "unlocked" && (
        <Card className="rounded-[20px] border-[#d6deed]">
          <CardHeader>
            <CardTitle>Vault account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="vault-account">Account</Label>
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
                <Label htmlFor="vault-index">Index</Label>
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
            <dl className="space-y-3">
              {chains.map(({ id, name }) => (
                <div key={id} className="space-y-1">
                  <dt className="text-sm font-semibold">{name}</dt>
                  <dd>
                    <code className="block break-all rounded-md bg-muted p-3 text-sm">
                      {vaultAddresses[id][0] ?? "—"}
                    </code>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              TON has one address per wallet — account and index do not change it.
            </p>
          </CardContent>
        </Card>
      )}

      {hasWallets ? (
        <ul className="space-y-4">
          {chains.map(({ id, name }) => {
            const wallet = xpubs[id];
            if (!wallet) return null;
            const shortXpub = `${wallet.xpub.slice(0, 12)}…${wallet.xpub.slice(-8)}`;
            const chip = CHAIN_CHIP_COLORS[id] ?? '#9daeff';

            return (
              <li key={id}>
                <Card className="rounded-[20px] border-[#d6deed]">
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#19223a]"
                        style={{ backgroundColor: chip }}
                      >
                        {chainConfig(id).symbol}
                      </span>
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
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No wallets imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Import a watch-only wallet to add it here.
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
        Only extended public keys and TON public addresses are stored (in localStorage). No secrets are stored anywhere in this wallet.
        An extended public key lets its holder track this account&apos;s derivable addresses, balances and
        transaction history. Stored keys stay stored when the wallet is locked; forgetting a key removes it
        from this browser, but cannot revoke a copy someone already took.
      </p>

      {hasWallets && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            for (const { id } of chains) removeXpub(id);
          }}
        >
          Forget all stored keys
        </Button>
      )}
    </section>
  );
}
