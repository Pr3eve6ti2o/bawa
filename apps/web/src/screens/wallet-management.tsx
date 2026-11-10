import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";

const chains = [
  { id: "btc", name: "Bitcoin" },
  { id: "eth", name: "Ethereum" },
  { id: "trx", name: "TRON" },
] as const;

export function WalletManagementScreen() {
  const { xpubs, removeXpub } = useWallet();
  const hasWallets = chains.some(({ id }) => Boolean(xpubs[id]));

  return (
    <section className="space-y-6" aria-labelledby="wallets-heading">
      <h1 id="wallets-heading" className="text-2xl font-semibold">
        Wallets
      </h1>

      {hasWallets ? (
        <ul className="space-y-4">
          {chains.map(({ id, name }) => {
            const wallet = xpubs[id];
            if (!wallet) return null;
            const shortXpub = `${wallet.xpub.slice(0, 12)}…${wallet.xpub.slice(-8)}`;

            return (
              <li key={id}>
                <Card>
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <CardTitle>{name}</CardTitle>
                      <p className="break-words text-sm text-muted-foreground">
                        {wallet.label || "Unlabelled wallet"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeXpub(id)}
                      aria-label={`Remove ${name} wallet`}
                    >
                      Remove
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <span className="sr-only">Extended public key: </span>
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
              Import an extended public key to add a watch-only wallet.
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
        Only extended public keys are stored (in localStorage). No secrets are stored anywhere in this starter.
      </p>
    </section>
  );
}
