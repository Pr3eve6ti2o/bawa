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
          A self-custodial multi-chain wallet. Create a wallet in the browser
          — your recovery phrase is encrypted on this device with your vault
          password — or import a watch-only wallet to track addresses without
          holding secrets.
        </p>
        <div className="mt-6 flex h-11 items-center justify-between rounded-[12px] bg-[#243454] px-4">
          <p className="text-xs font-semibold text-[#c8d5f0]">Network</p>
          <span className="flex h-6 items-center rounded-[12px] bg-[#224f45] px-3 text-[10px] font-bold text-[#94e1c3]">
            MAINNET
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col rounded-[20px] border-[#d6deed]">
          <CardHeader>
            <CardTitle>Create a wallet</CardTitle>
            <CardDescription>
              Generate a recovery phrase in the browser and encrypt it on this
              device with a vault password. Only you hold the phrase.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full">
              <Link to="/create-wallet">Create a wallet</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col rounded-[20px] border-[#d6deed]">
          <CardHeader>
            <CardTitle>Import a wallet</CardTitle>
            <CardDescription>
              Restore a wallet from its recovery phrase, or paste an extended
              public key (xpub) to view its derived addresses watch-only.
              Never paste recovery words, seeds or private keys into a
              watch-only import.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="outline" className="w-full">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-2 rounded-[20px] border border-[#d6deed] bg-card p-4 text-sm text-muted-foreground">
        <p>Mainnet only — this wallet never connects to a test network.</p>
        <p>
          Balances and history come from the mainnet adapters. Sending signs
          offline; broadcast is disabled until separately authorised.
        </p>
      </aside>
    </section>
  );
}
