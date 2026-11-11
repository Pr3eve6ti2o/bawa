import { Link } from "react-router";
import { Button } from "../ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/components/card";

export function WelcomeScreen() {
  return (
    <section
      aria-labelledby="welcome-title"
      className="mx-auto w-full max-w-4xl space-y-6 p-6"
    >
      <header className="space-y-3">
        <h1 id="welcome-title" className="text-3xl font-semibold tracking-tight">
          Welcome to Bawa Web Wallet
        </h1>
        <p className="text-muted-foreground">
          This is a watch-only wallet — it shows addresses derived from extended
          public keys and never holds secrets.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Create a wallet</CardTitle>
            <CardDescription>
              Creation happens outside the browser with the repo tools. Follow
              the guidance, then import your wallet&apos;s extended public key.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full">
              <Link to="/create-wallet">View creation guidance</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Import a watch-only wallet</CardTitle>
            <CardDescription>
              Paste an extended public key (xpub) to view its derived addresses.
              Never paste recovery words, seeds or private keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="outline" className="w-full">
              <Link to="/import-wallet">Import a watch-only wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <p>Testnet by default; mainnet is out of scope.</p>
        <p>
          Balances are unavailable because no provider is selected. Sending is
          not implemented.
        </p>
      </aside>
    </section>
  );
}
