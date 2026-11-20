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
    <section aria-labelledby="welcome-title" className="mx-auto w-full max-w-[480px] space-y-6">
      <div className="rounded-[30px] border border-panel-border bg-panel-surface-raised p-7 text-panel-text sm:p-8">
        <p className="text-sm font-bold tracking-widest text-panel-accent">
          BAWA
        </p>
        <h1
          id="welcome-title"
          className="mt-3 text-title-lg font-bold tracking-tight text-panel-text"
        >
          Welcome to Bawa Web Wallet
        </h1>
        <p className="mt-2 max-w-xl text-body-md text-panel-text-muted">
          A self-custodial multi-chain wallet. Create a wallet in the browser
          — your recovery phrase is encrypted on this device with your vault
          password — or import a watch-only wallet to track addresses without
          holding secrets.
        </p>

        <div className="mt-6 flex h-11 items-center justify-between rounded-xl bg-panel-surface px-4">
          <p className="text-xs font-semibold text-panel-text-soft">Network</p>
          <span className="flex h-6 items-center rounded-xl bg-panel-success-pill-bg px-3 text-[10px] font-bold text-panel-success-pill-text">
            MAINNET
          </span>
        </div>

        <ol className="mt-4 space-y-2 text-body-md">
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-foreground">
              1
            </span>
            <span className="font-semibold text-panel-text">
              Set a vault password
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-foreground">
              2
            </span>
            <span className="font-semibold text-panel-text">
              Write down 24 words
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-foreground">
              3
            </span>
            <span className="font-semibold text-panel-text">
              Confirm 3 words
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-foreground">
              4
            </span>
            <span className="font-semibold text-panel-text">
              See your addresses
            </span>
          </li>
        </ol>
      </div>

      <div className="grid gap-4">
        <Card className="flex flex-col rounded-xl bg-card text-foreground">
          <CardHeader className="px-6 pt-6">
            <CardTitle>Create a wallet</CardTitle>
            <CardDescription>
              Generate a recovery phrase in the browser and encrypt it on this
              device with a vault password. Only you hold the phrase.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto px-6 pb-6">
            <Button asChild className="h-10 w-full">
              <Link to="/create-wallet">Create a wallet</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col rounded-xl bg-card text-foreground">
          <CardHeader className="px-6 pt-6">
            <CardTitle>Import a wallet</CardTitle>
            <CardDescription>
              Restore a wallet from its recovery phrase, or paste an extended
              public key (xpub) to view its derived addresses watch-only.
              Never paste recovery words, seeds or private keys into a
              watch-only import.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto px-6 pb-6">
            <Button asChild variant="outline" className="h-10 w-full">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-2 rounded-[20px] border border-border bg-card p-4 text-sm text-muted-foreground">
        <p>Mainnet only — this wallet never connects to a test network.</p>
        <p>
          Balances and history come from the mainnet adapters. Sending signs
          offline; broadcast is disabled until separately authorised.
        </p>
      </aside>
    </section>
  );
}
