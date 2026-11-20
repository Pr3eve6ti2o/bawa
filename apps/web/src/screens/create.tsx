import { FileCode2, Globe, KeyRound, Plug, Smartphone, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';

type SdkReference = {
  name: string;
  commit: string;
  url: string;
  note: string;
};

type Tool = {
  name: string;
  description: string;
  icon: LucideIcon;
  sdkRefs: readonly SdkReference[];
} & (
  | { status: 'working'; href: '/create-wallet' }
  | { status: 'brief' }
);

const walletCoreReference = {
  name: 'Wallet Core',
  commit: '7a21615f',
  url: 'https://github.com/trustwallet/wallet-core/tree/7a21615fad32edd8dc0b040d845de3973cde2c5a',
};

const tools: readonly Tool[] = [
  {
    name: 'Multichain wallet',
    description:
      'Create one wallet covering Bitcoin, Ethereum, TRON and TON from a single recovery phrase.',
    status: 'working',
    href: '/create-wallet',
    icon: Wallet,
    sdkRefs: [
      {
        ...walletCoreReference,
        note: 'Read-only catalogue input; signing is a separate gated step.',
      },
      {
        name: 'Ethereum Lists',
        commit: '428cd0b7',
        url: 'https://github.com/ethereum-lists/chains/tree/428cd0b77764cb1cb930d790888590afa6b28e4b',
        note: 'Read-only chain catalogue.',
      },
    ],
  },
  {
    name: 'HD wallet',
    description:
      'Create an HD wallet: one recovery phrase derives every account and address. Opens the same creation flow as Multichain wallet.',
    status: 'working',
    href: '/create-wallet',
    icon: KeyRound,
    sdkRefs: [
      {
        ...walletCoreReference,
        note: 'HD derivation reference; the app uses its pinned WASM build.',
      },
    ],
  },
  {
    name: 'Web wallet',
    description: 'A web wallet that runs in the browser.',
    status: 'brief',
    icon: Globe,
    sdkRefs: [
      {
        name: 'Rabby Wallet',
        commit: '99db3534',
        url: 'https://github.com/RabbyHub/Rabby/tree/99db3534192f6d70c23409bc2b5e13244336e470',
        note: 'MIT extension reference: network and account controls, approval and provider isolation. Not a reusable browser vault.',
      },
      {
        name: 'RabbyDesktop',
        commit: '39b04238',
        url: 'https://github.com/RabbyHub/RabbyDesktop/tree/39b04238052ba559ccae1c962cbafcfb3286ca4c',
        note: 'MIT Electron isolation and release reference, not a web dependency.',
      },
    ],
  },
  {
    name: 'Android wallet',
    description: 'An Android wallet app with device-backed storage.',
    status: 'brief',
    icon: Smartphone,
    sdkRefs: [
      {
        name: 'Rabby Mobile',
        commit: 'c0d64c6e',
        url: 'https://github.com/RabbyHub/rabby-mobile/tree/c0d64c6e09e6d0df91f01539a5837037441091ae',
        note: 'React Native bridge, lifecycle and account UX reference.',
      },
      {
        ...walletCoreReference,
        note: 'Wallet Core JNI is a candidate for the Android engine; qualify the exact version and ABIs first.',
      },
    ],
  },
  {
    name: 'Smart contract creator',
    description:
      'Create a smart contract from a reviewed standard template.',
    status: 'brief',
    icon: FileCode2,
    sdkRefs: [
      {
        name: 'OpenZeppelin Contracts',
        commit: 'd98b8f43',
        url: 'https://github.com/OpenZeppelin/openzeppelin-contracts/tree/d98b8f438d6c2b9d368d1220448b8519f733d371',
        note: 'MIT standards reference. Choose a verified stable package and compatible compiler, not the inspected development HEAD.',
      },
    ],
  },
  {
    name: 'Multi-Sig Wallet v2',
    description:
      'A multi-signature wallet where several owners must approve.',
    status: 'brief',
    icon: Users,
    sdkRefs: [
      {
        name: 'BitGo eth-multisig-v2',
        commit: '7d14d8b2',
        url: 'https://github.com/BitGo/eth-multisig-v2/blob/7d14d8b22aca70b2869207824715aefc65e396c5/contracts/WalletSimple.sol',
        note: 'Legacy 2-of-3 and forwarder compatibility only. Solidity 0.4-era contract; not a new default.',
      },
      {
        name: 'Safe Core SDK',
        commit: 'dc6bf6d3',
        url: 'https://github.com/safe-global/safe-core-sdk/blob/dc6bf6d35d74459175445933420e7ffedb65e87a/packages/protocol-kit/src/Safe.ts',
        note: 'MIT Protocol Kit, the preferred new EVM Safe path.',
      },
      {
        name: 'Safe Transaction Service',
        commit: '76965891',
        url: 'https://github.com/safe-global/safe-transaction-service/blob/76965891f16b1988a53a281e10f9766f68a7116a/LICENSE',
        note: 'Historic MIT through Feb 16, 2026; later source uses FSL-1.1-MIT. Check the exact code before use.',
      },
      {
        name: 'safe-eth-py',
        commit: '5c07bb9b',
        url: 'https://github.com/safe-global/safe-eth-py/blob/5c07bb9b8775a42da645f7c7dcfa30bb57c1004d/safe_eth/safe/addresses.py',
        note: 'MIT candidate for independent validation. It is not permission to submit transactions.',
      },
      {
        name: 'Safe CLI',
        commit: 'd57d1a53',
        url: 'https://github.com/safe-global/safe-cli/blob/d57d1a53bfe31a09fbbc852bab9acfee8656fb4e/pyproject.toml',
        note: 'MIT operator tooling; reference only.',
      },
    ],
  },
  {
    name: 'Web3 Wallet Kit',
    description:
      'Connect an existing wallet to a dApp without importing its keys.',
    status: 'brief',
    icon: Plug,
    sdkRefs: [
      {
        name: 'Via web3-wallets',
        commit: '44e90aa2',
        url: 'https://github.com/viaprotocol/web3-wallets/tree/44e90aa26487bf7625da771a2f2eaf3e4a05eb98',
        note: 'MIT connector and typed provider interface reference, not local custody.',
      },
      {
        name: 'Via tokenlists',
        commit: '3ff5b3a1',
        url: 'https://github.com/viaprotocol/tokenlists/blob/3ff5b3a102a9d7a2b74d62e08d0f334ca453eb0f/tokenlists/ethereum.json',
        note: 'MIT aggregation code; verify chain, contract and decimals independently.',
      },
      {
        name: 'RabbyKit',
        commit: '653b79ae',
        url: 'https://github.com/RabbyHub/rabbykit/blob/653b79ae5bbf0dc765e373ec855b057c446180e6/packages/rabbykit/package.json',
        note: 'Candidate isolated EVM dApp connector UI.',
      },
      {
        name: 'Safe Apps SDK',
        commit: '529a3d48',
        url: 'https://github.com/safe-global/safe-apps-sdk/tree/529a3d48f9c1db69a2a3b0525c5f5eb4919bc36e',
        note: 'MIT Safe-hosted dApp message integration, not vault, recovery or deployer.',
      },
      {
        name: 'Rabby Security Engine',
        commit: '645c0103',
        url: 'https://github.com/RabbyHub/rabby-security-engine/tree/645c01031e85df5e0cff42a76400455af73887af',
        note: 'Warning and risk interface reference. Licence unresolved: reference only, no copying.',
      },
      {
        name: 'Safe Wallet monorepo',
        commit: 'a475eb1e',
        url: 'https://github.com/safe-global/safe-wallet-monorepo/tree/a475eb1ed7cd45ddecfbe86dac6dd0f2692f5236',
        note: 'Review and owner UX reference only. GPLv3: no copying into this MIT app.',
      },
    ],
  },
];

function ToolContents({ tool }: { tool: Tool }) {
  const Icon = tool.icon;

  return (
    <div className="min-w-0 space-y-4">
      <CardHeader className="min-w-0 space-y-2 p-0">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-panel-icon-tile text-panel-accent">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
            <CardTitle className="min-w-0 text-base font-semibold text-panel-text">
              {tool.name}
            </CardTitle>
            <Badge
              variant={tool.status === 'working' ? 'success' : 'secondary'}
              className="shrink-0"
            >
              {tool.status === 'working' ? 'Available' : 'Build brief'}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-sm text-panel-text-muted">
          {tool.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4 p-0">
        {tool.status === 'brief' ? (
          <p className="text-sm text-panel-text-muted">
            Not implemented yet. This is a build brief, not a working feature.
          </p>
        ) : null}
        <div className="min-w-0 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-panel-text-muted">
            References
          </h3>
          <ul className="space-y-2">
            {tool.sdkRefs.map((reference) => (
              <li key={reference.url} className="min-w-0 space-y-1">
                <a
                  href={reference.url}
                  className="break-all text-sm text-panel-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
                >
                  {`${reference.name} (${reference.commit})`}
                </a>
                <p className="text-sm text-panel-text-muted">
                  {reference.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </div>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  if (tool.status === 'working') {
    return (
      <div className="flex h-full min-w-0 flex-col space-y-4 rounded-xl border border-panel-border bg-panel-surface-raised p-4">
        <ToolContents tool={tool} />
        <Button asChild className="mt-auto h-auto w-full whitespace-normal py-3 text-center">
          <Link to={tool.href} aria-label={`Open ${tool.name} creation`}>
            {`Open ${tool.name} creation`}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <article
      aria-label={`${tool.name} build brief`}
      className="h-full min-w-0 rounded-xl border border-panel-border bg-panel-surface-raised p-4"
    >
      <ToolContents tool={tool} />
    </article>
  );
}

export function CreateScreen() {
  return (
    <section aria-labelledby="create-title" className="space-y-4">
      <h1
        id="create-title"
        className="text-2xl font-semibold text-panel-text"
      >
        Create
      </h1>
      <p className="text-sm text-panel-text-muted">
        Choose what to create. Two tools work today; the rest are build briefs,
        not working features.
      </p>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <li key={tool.name} className="min-w-0">
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-panel-text-muted">
        The wallet dashboard stays a separate workspace. Creating a wallet here
        does not replace it.
      </p>
    </section>
  );
}
