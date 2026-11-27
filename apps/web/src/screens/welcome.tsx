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

// P0 (plan P0-4, Lane B B-2): one headline + one line + two cards. The
// intro essay (three paragraphs), the five-bullet "What this wallet
// does" list and the developer-facing guide paragraph are gone — the
// guide promo lives in docs, not on the wallet home. The mode note is
// gone too: the header pill already says Mainnet / Devnet test mode.
// What stays: the illustration (the style lane owns it), the two cards
// with shorter copy, and the "Watch a wallet" tertiary link.
export function WelcomeScreen() {
  return (
    <section aria-labelledby="welcome-title" className="mx-auto flex w-full max-w-[480px] flex-col space-y-6 lg:grid lg:max-w-none lg:grid-cols-5 lg:gap-6 lg:items-start lg:space-y-0">
      <div className="rounded-bawa border-2 border-ink bg-paper p-7 text-ink sm:p-8 lg:col-span-3 lg:col-start-1 lg:row-start-1">
        <div aria-hidden="true" className="flex items-end gap-3 text-ink">
          <BawaIcon name="wallet" className="size-16" />
          <BawaIcon name="coins" className="size-10" />
        </div>
        <h1
          id="welcome-title"
          className="mt-3 text-title-lg font-bold tracking-tight text-ink"
        >
          Welcome to <span className="bawa-marker">Bawa</span>
        </h1>
        <p className="mt-2 max-w-xl text-base text-ink">
          One recovery phrase for 87 chains. Your keys never leave this device.
        </p>
      </div>

      <div className="grid gap-4 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:sticky lg:top-6">
        <Card radius="xl" tone="card">
          <CardHeader className="px-6 pt-6">
            <CardTitle>Create a wallet</CardTitle>
            <CardDescription>
              One phrase for 87 chains. Set a password, write down 24 words.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto px-6 pb-6">
            <Button asChild size="lg" className="w-full">
              <Link to="/create-wallet">Create a wallet</Link>
            </Button>
          </CardContent>
        </Card>
        <Card radius="xl" tone="card">
          <CardHeader className="px-6 pt-6">
            <CardTitle>Import a wallet</CardTitle>
            <CardDescription>
              Restore from a phrase, or watch any wallet from its public address.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto px-6 pb-6">
            <Button asChild variant="secondary" size="md" className="w-full">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </CardContent>
        </Card>
        {/* Lane 5: Watch-only is the tertiary entry (DESIGN-SYSTEM §6).
            It opens Import straight on the Watch-only tab, so a user
            who only wants to look never has to find the tab. */}
        <p className="px-2 text-center text-base leading-6 text-ink">
          Just want to look?{' '}
          <Link
            to="/import-wallet?mode=watch-only"
            className="font-medium underline underline-offset-4"
          >
            Watch a wallet
          </Link>{' '}
          from its public address — no wallet needed.
        </p>
      </div>
    </section>
  );
}
