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
          Bawa is a self-custodial wallet that runs in your browser. One
          recovery phrase covers 84 chains — Bitcoin, Ethereum, Solana,
          TRON, TON and more. Your keys are made on this device and
          encrypted with your vault password. They never leave it.
        </p>
        <p className="mt-2 max-w-xl text-body-md text-ink">
          It shows your real balances and live prices, gives you a
          receiving address and QR code for every chain, and lets you watch
          any wallet from its public key — without holding its secrets.
          Sending is switched off until it is separately approved, so
          nothing here can move your funds. No account, no sign-up.
        </p>
        <p className="mt-2 max-w-xl text-body-md text-ink">
          Bawa is also a guide for humans and AI agents that builds wallets
          like this one from a few prompts — this web wallet is the wallet
          the guide builds.
        </p>

        <div className="mt-6 flex h-11 items-center justify-between rounded-bawa-sm border-2 border-ink bg-paper px-4">
          <p className="text-xs font-semibold text-ink">Network</p>
          <span className="flex h-6 items-center rounded-bawa-sm border-2 border-ink bg-sun px-3 text-[10px] font-bold text-ink">
            {devnetEnabled ? "DEVNET" : "MAINNET"}
          </span>
        </div>

        <h2 className="mt-6 text-body-md font-semibold text-ink">
          What this wallet does
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-body-md text-ink">
          <li>
            <strong>Receive on 84 chains</strong>. One wallet, one address
            per chain, with a QR code for each.
          </li>
          <li>
            <strong>A fresh address for every payment</strong>. The QR card
            always shows your next unused address, and you can make a new
            receiving address at any time.
          </li>
          <li>
            <strong>Real balances and prices</strong>. Balances from public
            blockchains, prices from CoinGecko — no made-up numbers.
          </li>
          <li>
            <strong>Watch any wallet</strong>. Follow balances and history
            from an extended public key, without ever holding its keys.
          </li>
          <li>
            <strong>Add tokens</strong>. Add a whole chain to your wallet,
            or a single token by its contract address.
          </li>
        </ul>
      </div>

      <div className="grid gap-4 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
        <Card radius="xl" tone="card">
          <CardHeader className="px-6 pt-6">
            <CardTitle>Create a wallet</CardTitle>
            <CardDescription>
              One recovery phrase for 84 chains. Set a vault password,
              write down 24 words, and your wallet is ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto px-6 pb-6">
            <Button asChild className="w-full">
              <Link to="/create-wallet">Create a wallet</Link>
            </Button>
          </CardContent>
        </Card>
        <Card radius="xl" tone="card">
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
            <Button asChild variant="outline" className="w-full">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-2 rounded-bawa border-2 border-ink bg-paper p-4 text-sm text-ink lg:col-span-3 lg:col-start-1 lg:row-start-2">
        <p>
          {devnetEnabled
            ? "Devnet test mode. This wallet connects to a test network with valueless test tokens."
            : "Mainnet by default. Devnet test mode is available from Networks."}
        </p>
        <p>
          Your balances come from public blockchain networks. This device signs transactions offline. You can send funds only after separate approval.
        </p>
      </aside>
    </section>
  );
}
