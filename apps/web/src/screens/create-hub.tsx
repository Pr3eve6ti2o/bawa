import { Link } from 'react-router';
import { BawaIcon, type BawaIconName } from '../ui/components/icons';
import { Button } from '../ui/components/button';
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';

// Finish-product Lane I: there is one wallet to create, so there is one
// button that creates it. The old screen offered two cards for the same
// wallet — first Multichain wallet and HD wallet, then Create a wallet
// and Web wallet. Both pairs opened the same creation flow (or, for the
// web wallet, the dashboard this app already is), so they are gone:
// the web wallet is not something to create, and the dashboard is
// reached from the navigation.
//
// The identity block below states the honest shape of that one wallet:
// one 24-word recovery phrase, one account, every address derived from
// that phrase — with one address shared across all sixteen
// Ethereum-style chains, and a different address on every other chain.
// There is no single address that works on every chain, and nothing
// here claims there is: Bitcoin, Ethereum, Solana and TON use different
// key types and address formats, so each chain needs its own address.
// That is how every standards-compliant wallet works.
const comingSoon: readonly {
  name: string;
  description: string;
  icon: BawaIconName;
}[] = [
  {
    name: 'Android wallet',
    description: 'An Android wallet app. Your keys stay on your phone.',
    icon: 'plus',
  },
  {
    name: 'Smart contract creator',
    description: 'Creates a contract from a reviewed standard template.',
    icon: 'wrench',
  },
  {
    name: 'Multi-signature wallet',
    description:
      'A shared wallet where several owners must approve each transaction.',
    icon: 'shield',
  },
  {
    name: 'Connect an existing wallet',
    description:
      'Connect a wallet you already have to an app, without importing its keys.',
    icon: 'import',
  },
];

export function CreateScreen() {
  return (
    <section aria-labelledby="create-title" className="space-y-6">
      <h1 id="create-title" className="text-2xl font-semibold text-ink">
        Create
      </h1>
      <p className="text-sm text-ink">
        There is one wallet to create, and one button that creates it.
      </p>

      <div className="space-y-4 rounded-bawa border-2 border-ink bg-paper p-4 sm:p-6">
        <CardHeader className="min-w-0 space-y-2 p-0">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink">
              <BawaIcon name="wallet" className="size-5" />
            </span>
            <CardTitle className="min-w-0 text-base font-semibold text-ink">
              Create a wallet
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-ink">
            One recovery phrase, one wallet — 84 chains. Creating a wallet
            makes one 24-word recovery phrase on this device. That one
            phrase is your whole wallet: every address on all 84 chains
            comes from it.
          </CardDescription>
        </CardHeader>
        <Button
          asChild
          className="h-auto w-full whitespace-normal py-3 text-center"
        >
          <Link to="/create-wallet" aria-label="Create your wallet">
            Create your wallet
          </Link>
        </Button>
        <p className="text-sm text-ink">
          Creating a wallet starts with a short risk check. Your recovery
          phrase is shown only after you confirm you understand the risks.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">
          One wallet, one identity
        </h2>
        <ul className="space-y-2 text-sm text-ink">
          <li>
            <strong>One recovery phrase.</strong> 24 words, made on this
            device and encrypted with your vault password. It is the only
            backup you need.
          </li>
          <li>
            <strong>One account.</strong> Every address comes from that one
            phrase. There is nothing else to back up.
          </li>
          <li>
            <strong>One shared address on Ethereum-style chains.</strong>{' '}
            Ethereum, BNB Smart Chain, Polygon, Arbitrum, Optimism, Base,
            Avalanche, Gnosis, Celo, Linea, Mantle, Scroll, opBNB, Metis,
            Aurora and Fantom all use the same address — they share one
            derivation path, so one key opens all of them.
          </li>
          <li>
            <strong>A different address everywhere else.</strong> Bitcoin,
            Litecoin, Dogecoin and TRON each have their own address format.
            Solana and TON each have exactly one address per wallet.
          </li>
        </ul>
        <p className="text-sm text-ink">
          There is no single address that works on every chain. Bitcoin,
          Ethereum, Solana and TON use different key types and address
          formats, so each chain needs its own address. That is how every
          standards-compliant wallet works.
        </p>
      </div>

      {/* Fix-all Lane H, item 4c: the four Coming soon cards filled a
          whole screen on Create and pushed the screen's one action out
          of balance — collapsed into a disclosure, one tap away, so
          Create ends after the wallet identity section. */}
      <details className="rounded-bawa border-2 border-ink bg-paper p-4">
        <summary id="coming-soon" className="cursor-pointer text-lg font-semibold text-ink">
          Coming soon
        </summary>
        <ul className="mt-3 space-y-3">
          {comingSoon.map((tool) => (
            <li key={tool.name} className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink">
                <BawaIcon name={tool.icon} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{tool.name}</p>
                <p className="text-sm text-ink">{tool.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
