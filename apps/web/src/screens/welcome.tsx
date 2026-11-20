import { useEffect } from "react";
import { Link } from "react-router";
import { StepCard } from "../ui/components/step-card";
import { Button } from "../ui/components/button";
import { BawaIcon } from "../ui/components/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/components/card";
import { PopularChainsStrip } from "../ui/components/chain-strip";

export function WelcomeScreen() {
  return (
    <section aria-labelledby="welcome-title" className="mx-auto w-full max-w-[480px] space-y-6 lg:max-w-none lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start lg:space-y-0">
      <div className="rounded-bawa border-2 border-ink bg-paper p-7 text-ink sm:p-8 lg:col-span-3 lg:col-start-1 lg:row-start-1">
        <div aria-hidden="true" className="flex items-end gap-3 text-ink">
          <BawaIcon name="wallet" className="size-16 -rotate-3" />
          <BawaIcon name="coins" className="size-10 rotate-3" />
        </div>
        <h1
          id="welcome-title"
          className="mt-3 text-title-lg font-bold tracking-tight text-ink"
        >
          Welcome to <span className="bawa-marker">Bawa</span> Web Wallet
        </h1>
        <p className="mt-2 max-w-xl text-body-md text-ink">
          A self-custodial multi-chain wallet. Create a wallet in the browser
          — your recovery phrase is encrypted on this device with your vault
          password — or import a watch-only wallet to track addresses without
          holding secrets.
        </p>

        <div className="mt-6 flex h-11 items-center justify-between rounded-bawa-sm border-2 border-ink bg-paper px-4">
          <p className="text-xs font-semibold text-ink">Network</p>
          <span className="flex h-6 items-center rounded-bawa-sm border-2 border-ink bg-sun px-3 text-[10px] font-bold text-ink">
            MAINNET
          </span>
        </div>

        <ol className="mt-4 space-y-3 text-body-md">
          <li>
            <StepCard icon={<span>1</span>} label="Set a vault password" state="pending" />
          </li>
          <li>
            <StepCard icon={<span>2</span>} label="Write down 24 words" state="pending" />
          </li>
          <li>
            <StepCard icon={<span>3</span>} label="Confirm 3 words" state="pending" />
          </li>
          <li>
            <StepCard icon={<span>4</span>} label="See your addresses" state="pending" />
          </li>
        </ol>
      </div>

      <div className="grid gap-4 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
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

      <aside className="space-y-2 rounded-bawa border-2 border-ink bg-paper p-4 text-sm text-ink lg:col-span-3 lg:col-start-1 lg:row-start-2">
        <p>Mainnet only — this wallet never connects to a test network.</p>
        <p>
          Your balances come from public blockchain networks. This device signs transactions offline. You can send funds only after separate approval.
        </p>
      </aside>

      <PopularChainsStrip mode="welcome" />
    </section>
  );
}
