import { useState } from 'react';
import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import type { ChainId } from '../engine/boundary';
import type { AdapterTx } from '../wallet/adapters/types';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';

type Filter = 'all' | ChainId;

interface RowTx extends AdapterTx {
  chain: ChainId;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TransactionHistoryScreen() {
  const { history, refreshHistory } = useWallet();
  const [filter, setFilter] = useState<Filter>('all');
  const chains = availableFor('history');
  const shownChains: ChainId[] = filter === 'all' ? chains : [filter];

  const rows: RowTx[] = shownChains
    .flatMap((chain) =>
      history[chain].txs.map((tx) => ({ ...tx, chain })),
    )
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const anyLoading = shownChains.some((chain) => history[chain].status === 'loading');
  const failedChains = shownChains.filter(
    (chain) =>
      history[chain].status === 'unavailable' || history[chain].status === 'error',
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-panel-text">Transactions</h1>
      <p className="text-sm text-panel-text-muted">
        <Link to="/track" className="text-panel-accent underline underline-offset-4">
          Look up a transaction by hash
        </Link>{' '}
        or check recent activity for any address.
      </p>

      {chains.length === 0 ? (
        <div className="space-y-3 rounded-[20px] border border-panel-border bg-panel-surface-raised p-6 text-panel-text">
          <h2 className="text-lg font-bold text-panel-text">No transactions yet</h2>
          <p className="text-sm leading-relaxed text-panel-text-muted">
            No transaction history is available right now.
          </p>
          <p className="text-sm leading-relaxed text-panel-text-muted">
            Import a watch-only wallet to see its derived addresses, or open
            Receive to share an address.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/receive"
              className="inline-block rounded-full bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Receive
            </Link>
            <Link
              to="/import-wallet"
              className="inline-block rounded-full border border-panel-border bg-panel-icon-tile px-4 py-2 text-sm font-semibold text-panel-text"
            >
              Import wallet
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by chain">
            <Button
              type="button"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            {chains.map((chain) => (
              <Button
                key={chain}
                type="button"
                variant={filter === chain ? 'default' : 'outline'}
                onClick={() => setFilter(chain)}
              >
                {chainConfig(chain).symbol}
              </Button>
            ))}
          </div>

          {anyLoading && rows.length === 0 ? (
            <div role="status">
              <Skeleton className="h-24 w-full" />
              <span className="sr-only">Loading transactions…</span>
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              No transactions yet
              {filter === 'all' ? '.' : ` for ${chainConfig(filter).displayName}.`}
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((tx) => (
                <li key={`${tx.chain}:${tx.hash}`} className="rounded-lg border p-3">
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
                        {' · '}
                        {chainConfig(tx.chain).symbol}
                      </span>
                      <span className="text-sm font-semibold">
                        {formatNativeWithSymbol(
                          tx.amountBaseUnits,
                          CHAIN_DECIMALS[tx.chain],
                          chainConfig(tx.chain).symbol,
                        )}
                      </span>
                    </span>
                    <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                      {tx.hash}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {tx.timestamp === null ? 'Pending' : formatDate(tx.timestamp)}
                      {tx.status === 'failed' ? ' · Failed' : tx.status === 'pending' ? ' · Pending' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {failedChains.length > 0 && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm">
                {failedChains
                  .map((chain) => chainConfig(chain).displayName)
                  .join(', ')}{' '}
                history unavailable
                {failedChains.length === 1 && failedChains[0] !== undefined && history[failedChains[0]].reason
                  ? ` (${history[failedChains[0] as ChainId].reason})`
                  : ''}
                .
              </p>
              <Button type="button" variant="outline" onClick={() => void refreshHistory()}>
                Retry
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
