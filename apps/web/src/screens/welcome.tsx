import { Link } from "react-router";
import { Button } from "../ui/components/button";
import { BawaIcon } from "../ui/components/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/components/card";
import { PopularChainsStrip } from "./chain-strip";
import { useWallet } from "../state/wallet-context";

export function WelcomeScreen() {
  const { devnetEnabled } = useWallet();
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
          Welcome to <span className="bawa-marker">Bawa</span>
        </h1>
        <p className="mt-2 max-w-xl text-body-md text-ink">
          Bawa is a guide made for humans and AI agents to create crypto
          wallets, web wallets, Android wallets, HD wallets and smart
          contracts easily — with just a few prompts, explained in the
          guide.
        </p>
        <p className="mt-2 max-w-xl text-body-md text-ink">
          This web wallet is the wallet the guide builds: a self-custodial
          multi-chain wallet that runs in your browser. Your recovery
          phrase is encrypted on this device with your vault password —
          only you hold it.
        </p>

        <div className="mt-6 flex h-11 items-center justify-between rounded-bawa-sm border-2 border-ink bg-paper px-4">
          <p className="text-xs font-semibold text-ink">Network</p>
          <span className="flex h-6 items-center rounded-bawa-sm border-2 border-ink bg-sun px-3 text-[10px] font-bold text-ink">
            {devnetEnabled ? "DEVNET" : "MAINNET"}
          </span>
        </div>

        <h2 className="mt-6 text-body-md font-semibold text-ink">
          What you can do with Bawa
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-body-md text-ink">
          <li>
            <strong>Create a crypto wallet</strong> — a self-custodial
            multi-chain wallet, with one address per chain.
          </li>
          <li>
            <strong>Create a web wallet</strong> — this one. It runs in
            your browser, with nothing to install.
          </li>
          <li>
            <strong>Create an Android wallet</strong> — the same wallet on
            your phone.
          </li>
          <li>
            <strong>Create an HD wallet</strong> — a fresh receiving
            address for every payment.
          </li>
          <li>
            <strong>Create a smart contract</strong> — guided, step by
            step, from a prompt.
          </li>
        </ul>
      </div>

      <div className="grid gap-4 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
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
        <p>
          {devnetEnabled
            ? "Devnet — test mode. This wallet connects to a test network with valueless test tokens."
            : "Mainnet only — this wallet never connects to a test network."}
        </p>
        <p>
          Your balances come from public blockchain networks. This device signs transactions offline. You can send funds only after separate approval.
        </p>
      </aside>

      <PopularChainsStrip mode="welcome" />
    </section>
  );
}
