import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { ChainLogo } from "./asset-rows";
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

// Token gaps, item 6 + item 8: the WATCH-ONLY list covers all 13
// registry chains. It used to be the same four as the vault section
// above, so a watch-only wallet imported for any other chain (e.g.
// SOL) was stored but invisible here. The xpub map, validation and
// derivation already cover all 13. The vault section keeps the
// original four — its address list is out of this item's scope.
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
] as const;

export function WalletManagementScreen() {
  const {
    xpubs,
    removeXpub,
    vaultAccount,
    setVaultAccount,
    vaultAddresses,
  } = useWallet();
  const hasWallets = watchChains.some(({ id }) => Boolean(xpubs[id]));

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
          <CardTitle>Vault account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your vault is the wallet made from your recovery phrase. It
              holds one account at a time. The two numbers below pick which
              account that is: each number derives a different account from
              the same recovery phrase, which is why the addresses change
              when you change a number. Changing the numbers never creates
              or deletes a wallet — it just shows a different account from
              the same phrase. Your phrase never leaves this device.
            </p>
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
                <Label htmlFor="vault-index">Address number</Label>
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
                      {vaultAddresses[id][0] ?? "—"}
                    </code>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              TON has one address per wallet, so changing the numbers above does not change the TON address.
            </p>
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
