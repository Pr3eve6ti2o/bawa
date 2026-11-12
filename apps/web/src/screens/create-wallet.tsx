import { Link } from "react-router";
import { Button } from "../ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/components/card";
import { StepCard } from "../ui/components/step-card";

export function CreateWalletScreen() {
  return (
    <section
      aria-labelledby="create-wallet-title"
      className="mx-auto w-full max-w-3xl space-y-6 p-6"
    >
      <header className="space-y-3">
        <h1
          id="create-wallet-title"
          className="text-3xl font-semibold tracking-tight"
        >
          Create a wallet
        </h1>
        <p className="text-muted-foreground">
          This starter cannot create a wallet in the browser — there is no vault
          design yet, so no mnemonic is ever generated or shown here. This app
          never stores recovery words, seeds or private keys.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Guidance: create with the repo tools</CardTitle>
          <CardDescription>
            These steps happen outside the browser. Afterwards, import only your
            wallet&apos;s extended public key (xpub).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol aria-label="Wallet creation guidance" className="space-y-5">
            <li className="space-y-3">
              <StepCard
                icon={<span>1</span>}
                label="Run the repo wrapper from a fresh clone"
                detail="From the repository root of a fresh clone, run the command below. The wrapper verifies the encrypted backup independently — do not run the generator directly."
              />
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-sm">
                <code>python3 tools/make_wallet.py</code>
              </pre>
            </li>
            <li>
              <StepCard
                icon={<span>2</span>}
                label="Follow the on-screen steps"
                detail="Follow the instructions shown by the repo tool to create your wallet."
              />
            </li>
            <li>
              <StepCard
                icon={<span>3</span>}
                label="Keep the printed 24 words offline"
                detail="Keep the printed 24 words securely offline. Never paste them, a seed or a private key into this app."
              />
            </li>
          </ol>
        </CardContent>
      </Card>

      <Button asChild className="h-auto whitespace-normal py-3 text-center">
        <Link to="/import-wallet">
          I have created a wallet — import its public key
        </Link>
      </Button>
    </section>
  );
}
