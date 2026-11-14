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
      className="space-y-6"
    >
      <div className="rounded-[30px] border border-white/10 bg-[#243454] p-7 text-white sm:p-8">
        <p className="text-sm font-bold tracking-widest text-[#b4aaff]">BAWA</p>
        <h1
          id="welcome-title"
          className="mt-3 text-3xl font-bold tracking-tight text-white"
        >
          Welcome to Bawa Web Wallet
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#aab5d1]">
          This is a watch-only wallet — it shows addresses derived from extended
          public keys and never holds secrets.
        </p>
        <div className="mt-6 flex h-11 items-center justify-between rounded-[12px] bg-[#243454] px-4">
          <p className="text-xs font-semibold text-[#c8d5f0]">Testnet status</p>
          <span className="flex h-6 items-center rounded-[12px] bg-[#224f45] px-3 text-[10px] font-bold text-[#94e1c3]">
            ACTIVE
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col rounded-[20px] border-[#d6deed]">
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

        <Card className="flex flex-col rounded-[20px] border-[#d6deed]">
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

      <aside className="space-y-2 rounded-[20px] border border-[#d6deed] bg-white p-4 text-sm text-muted-foreground">
        <p>Testnet by default; mainnet is out of scope.</p>
        <p>
          Balances are unavailable because no provider is selected. Sending is
          not implemented.
        </p>
      </aside>
    </section>
  );
}
