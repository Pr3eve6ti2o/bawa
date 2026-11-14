import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { DEMO_ASSETS } from '../state/demo-fixtures';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';
import { Card, CardContent } from '../ui/components/card';
import { Skeleton } from '../ui/components/skeleton';

const DERIVATION_PATHS = {
  btc: "m/84'/0'/0'/0/i",
  eth: "m/44'/60'/0'/0/i",
  trx: "m/44'/195'/0'/0/i",
} as const;

export function AssetDetailScreen() {
  const { chain } = useParams<{ chain: string }>();
  const { xpubs, addresses, uiState, errors, refreshChain, setSelectedChain } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');

  if (chain !== 'btc' && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Unknown chain</h1>
      </div>
    );
  }

  const xpub = xpubs[chain]?.xpub;
  const state = uiState[chain];
  const demo = DEMO_ASSETS.find((asset) => asset.id === chain);

  async function copyAddress(address: string) {
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Unable to copy the address. Please copy it manually.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <span
            className="flex size-10 items-center justify-center rounded-full text-base font-bold text-[#19223a]"
            style={{ backgroundColor: demo?.chip ?? '#9daeff' }}
          >
            {(demo?.name ?? chain).slice(0, 1)}
          </span>
          {demo?.name ?? chain.toUpperCase()}
        </h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={state === 'loading'}
            onClick={() => void refreshChain(chain)}
          >
            Refresh
          </Button>
          <Button asChild>
            <Link to="/receive" onClick={() => setSelectedChain(chain)}>
              Receive
            </Link>
          </Button>
        </div>
      </header>

      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#243454] px-5 py-4 text-white">
          <div>
            <p className="text-xs text-[#aab5d1]">Demo balance · {demo.network}</p>
            <p className="text-2xl font-bold">{demo.value}</p>
          </div>
          <p className="text-sm font-semibold text-[#eff2fc]">{demo.amount}</p>
        </div>
      )}

      <Card className="rounded-[20px] border-[#d6deed]">
        <CardContent className="pt-6">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">{chain === 'ton' ? 'Imported TON address' : 'Imported xpub'}</dt>
              <dd className="break-all font-mono text-sm">
                {xpub ? `${xpub.slice(0, 12)}…${xpub.slice(-8)}` : 'Not imported'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Derivation</dt>
              <dd className="break-all text-sm">
                {chain === 'ton' ? (
                  'No derivation — single imported address (TON path m/44\'/607\'/0\' is fully hardened).'
                ) : (
                  <code>{DERIVATION_PATHS[chain]}</code>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="derived-addresses-heading" className="space-y-3">
        <h2 id="derived-addresses-heading" className="text-lg font-semibold">
          {chain === 'ton' ? 'Imported address' : 'Derived addresses'}
        </h2>
        {state === 'loading' ? (
          <div role="status">
            <Skeleton className="h-24 w-full" />
            <span className="sr-only">Loading derived addresses…</span>
          </div>
        ) : state === 'empty' ? (
          <div className="space-y-2 rounded-lg border p-4">
            <p>No wallet imported for this chain</p>
            <Link to="/import-wallet" className="font-medium underline underline-offset-4">
              Import wallet
            </Link>
          </div>
        ) : state === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>
              {errors[chain] ?? 'Unable to load derived addresses.'}
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-3">
            {addresses[chain].map(({ index, address }) => (
              <li key={`${index}:${address}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">Index {index}</span>
                <code className="min-w-0 flex-1 break-all text-sm">{address}</code>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Copy address at index ${index}`}
                  onClick={() => void copyAddress(address)}
                >
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p role="status" className="text-sm text-muted-foreground">{copyStatus}</p>
      </section>
    </div>
  );
}
