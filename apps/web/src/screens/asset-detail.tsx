import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useWallet } from '../state/wallet-context';
import type { ChainId } from '../engine/boundary';
import { chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { ChainLogo } from './asset-rows';
import { ArrowLeft } from 'lucide-react';
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
  const {
    xpubs,
    addresses,
    uiState,
    errors,
    balances,
    history,
    refreshChain,
    refreshBalances,
    refreshHistory,
    setSelectedChain,
  } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');

  if (chain !== 'btc' && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Unknown chain</h1>
      </div>
    );
  }

  const config = chainConfig(chain);
  const xpub = xpubs[chain]?.xpub;
  const state = uiState[chain];
  const balance = balances[chain];
  const chainHistory = history[chain];
  const recentTxs = [...chainHistory.txs]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 5);

  async function copyAddress(address: string) {
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Unable to copy the address. Please copy it manually.');
    }
  }

  function refreshAll() {
    void refreshChain(chain as ChainId);
    void refreshBalances();
    void refreshHistory();
  }

  return (
    <div className="space-y-6">
      <Link
        to="/assets"
        aria-label="Back to assets"
        className="flex h-11 w-11 items-center justify-center rounded-full text-panel-text hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Link>

      <div className="space-y-4 rounded-2xl bg-panel-surface-raised p-4">
        <div className="flex items-center gap-3">
          <ChainLogo chain={chain} size={48} />
          <div>
            <h1 className="text-2xl font-semibold text-panel-text">{config.displayName}</h1>
            <p className="text-sm text-panel-text-muted">{config.displayName} mainnet</p>
          </div>
        </div>
        {balance.status === 'loading' ? (
          <div role="status">
            <Skeleton className="h-8 w-48" />
            <span className="sr-only">Loading balance…</span>
          </div>
        ) : balance.status === 'zero' ? (
          <>
            <p className="text-[32px] font-semibold leading-10 text-panel-text">
              0 {config.symbol}
            </p>
            <p className="text-sm text-panel-text-muted">Zero balance</p>
          </>
        ) : balance.status === 'available' ? (
          <p className="text-[32px] font-semibold leading-10 text-panel-text">
            {formatNativeWithSymbol(
              balance.value ?? '0',
              CHAIN_DECIMALS[chain as ChainId],
              config.symbol,
            )}
          </p>
        ) : (
          <>
            <p className="text-lg font-semibold text-panel-text">Balance unavailable</p>
            <p className="text-sm text-panel-text-muted">
              {balance.status === 'error'
                ? 'Could not load the balance.'
                : 'No balance adapter is available for this chain.'}
              {balance.reason ? ` (${balance.reason})` : ''}
            </p>
            <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
              Retry
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {chain !== 'ton' && (
          <Button asChild className="h-11">
            <Link to="/send" onClick={() => setSelectedChain(chain)}>
              Send
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11">
          <Link to="/receive" onClick={() => setSelectedChain(chain)}>
            Receive
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={state === 'loading'}
          onClick={refreshAll}
          className="h-11"
        >
          Refresh
        </Button>
      </div>

      <Card className="rounded-xl">
        <CardContent className="pt-6">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Balance</dt>
              <dd className="font-semibold">
                {balance.status === 'loading'
                  ? 'Loading…'
                  : balance.status === 'zero'
                    ? `0 ${config.symbol}`
                    : balance.status === 'available'
                      ? formatNativeWithSymbol(
                          balance.value ?? '0',
                          CHAIN_DECIMALS[chain as ChainId],
                          config.symbol,
                        )
                      : 'Balance unavailable'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Network</dt>
              <dd className="font-semibold">{config.displayName} mainnet</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="recent-transactions-heading" className="space-y-3">
        <h2 id="recent-transactions-heading" className="text-lg font-semibold">
          Recent transactions
        </h2>
        {chainHistory.status === 'loading' ? (
          <div role="status">
            <Skeleton className="h-24 w-full" />
            <span className="sr-only">Loading transactions…</span>
          </div>
        ) : chainHistory.status === 'loaded' ? (
          <ul className="space-y-3">
            {recentTxs.map((tx) => (
              <li key={tx.hash} className="rounded-lg border p-3">
                <Link
                  to={`/transactions/${tx.hash}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {tx.direction === 'in'
                        ? 'Received'
                        : tx.direction === 'out'
                          ? 'Sent'
                          : 'Self transfer'}
                    </span>
                    <span className="text-sm font-semibold">
                      {formatNativeWithSymbol(
                        tx.amountBaseUnits,
                        CHAIN_DECIMALS[chain as ChainId],
                        config.symbol,
                      )}
                    </span>
                  </span>
                  <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                    {tx.hash}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {tx.timestamp === null
                      ? 'Pending'
                      : new Date(tx.timestamp).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                    {tx.status === 'failed' ? ' · Failed' : tx.status === 'pending' ? ' · Pending' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : chainHistory.status === 'empty' ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No transactions yet for this chain.
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm">
              {chainHistory.status === 'error'
                ? 'Could not load transactions.'
                : 'Transaction history is unavailable for this chain.'}
              {chainHistory.reason ? ` (${chainHistory.reason})` : ''}
            </p>
            <Button type="button" variant="outline" onClick={() => void refreshHistory()}>
              Retry
            </Button>
          </div>
        )}
      </section>

      <Card className="rounded-xl">
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
