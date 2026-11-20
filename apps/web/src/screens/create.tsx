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

type Tool = {
  name: string;
  description: string;
  icon: LucideIcon;
} & (
  | { status: 'working'; href: '/create-wallet' }
  | { status: 'brief' }
);

// User-facing copy only: the build catalogue this screen was rendered
// from (repository names, commit hashes, licences, WASM/JNI notes) was
// removed in the Lane C finalisation pass — a wallet user needs to know
// what each tool does and whether it works yet, not where it came from.
// The two working cards open the same creation flow; the copy says so
// plainly instead of hiding it.
const tools: readonly Tool[] = [
  {
    name: 'Multichain wallet',
    description:
      'Create one wallet for Bitcoin, Ethereum, TRON and TON with one recovery phrase. This opens the same wallet setup as HD wallet.',
    status: 'working',
    href: '/create-wallet',
    icon: Wallet,
  },
  {
    name: 'HD wallet',
    description:
      'One recovery phrase covers every account and address. Opens the same creation flow as Multichain wallet.',
    status: 'working',
    href: '/create-wallet',
    icon: KeyRound,
  },
  {
    name: 'Web wallet',
    description: 'A wallet that will run in your browser.',
    status: 'brief',
    icon: Globe,
  },
  {
    name: 'Android wallet',
    description: 'An Android wallet app. Your keys stay on your phone.',
    status: 'brief',
    icon: Smartphone,
  },
  {
    name: 'Smart contract creator',
    description:
      'A tool that will create a contract from a reviewed standard template.',
    status: 'brief',
    icon: FileCode2,
  },
  {
    name: 'Multi-signature wallet',
    description:
      'A shared wallet where several owners must approve each transaction.',
    status: 'brief',
    icon: Users,
  },
  {
    name: 'Connect an existing wallet',
    description:
      'Connect a wallet you already have to an app, without importing its keys.',
    status: 'brief',
    icon: Plug,
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
              {tool.status === 'working' ? 'Available' : 'Coming soon'}
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
            Coming soon. This isn't available yet.
          </p>
        ) : null}
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
      aria-label={`${tool.name} coming soon`}
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
        Choose what to create. Two options are ready today; the rest are coming
        soon.
      </p>
      <p className="text-sm text-panel-text-muted">
        Creating a wallet starts with a short risk check. Your recovery phrase
        is shown only after you confirm you understand the risks.
      </p>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <li key={tool.name} className="min-w-0">
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-panel-text-muted">
        Your wallet dashboard stays separate. Creating a wallet here does not
        replace it.
      </p>
    </section>
  );
}
