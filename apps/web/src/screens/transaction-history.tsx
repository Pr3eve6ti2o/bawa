import { useState } from 'react';
import { Link } from 'react-router';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import type { AdapterTx } from '../wallet/adapters/types';
import { Button } from '../ui/components/button';
import { TxRow } from './tx-row';
import { Skeleton } from '../ui/components/skeleton';

type Filter = 'all' | ChainId;

interface RowTx extends AdapterTx {
  chain: ChainId;
}

function formatLastOk(lastOkAt: number): string {
  return new Date(lastOkAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TransactionHistoryScreen() {
  const { history, refreshHistory, vaultState } = useWallet();
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
  // Lane C: "No transactions yet" is earned only by a chain that
  // actually loaded (loaded/empty) with zero transactions. A failed
  // history is not an empty history — when every shown chain
  // failed, the unavailable state below wins and the empty message
  // must not show beside it. When some chains loaded empty and
  // others failed, both statements are true (about different
  // chains) and both show.
  const anyLoaded = shownChains.some(
    (chain) =>
      history[chain].status === 'loaded' || history[chain].status === 'empty',
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
            Transaction history isn't available for this network yet.
          </p>
          <p className="text-sm leading-relaxed text-panel-text-muted">
            Import a watch-only wallet to see its derived addresses, or open
            Receive to share an address.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" size="pill" asChild>
              <Link to="/receive">Receive</Link>
            </Button>
            <Button type="button" size="pill" variant="outline" asChild>
              <Link to="/import-wallet">Import wallet</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/*
            Lane 2: one chain picker, not a wall of chips. The old
            filter was 17 symbol-only buttons — five of them labelled
            "ETH" (Ethereum, Arbitrum One, OP Mainnet, Base, Linea,
            Scroll, Aurora…), with no way to tell which was which, and
            it ate ~40% of the phone viewport before any content. A
            labelled select shows the chain's display name (unique per
            chain) and takes one row at every width. Same filter state,
            same "All" default — the control changed, the function did
            not.
          */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="history-chain-filter"
              className="shrink-0 text-sm font-medium"
            >
              Chain
            </label>
            <select
              id="history-chain-filter"
              aria-label="Filter by chain"
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-11 min-w-0 flex-1 rounded-bawa-sm border-2 border-ink bg-paper px-3 text-sm font-medium sm:max-w-64"
            >
              <option value="all">All chains</option>
              {chains.map((chain) => (
                <option key={chain} value={chain}>
                  {chainConfig(chain).displayName}
                </option>
              ))}
            </select>
          </div>

          {anyLoading && rows.length === 0 ? (
            <div role="status">
              <Skeleton className="h-24 w-full" />
              <span className="sr-only">Loading transactions…</span>
            </div>
          ) : rows.length === 0 ? (
            vaultState === 'no-vault' ? (
              // Lane 2: no vault, no addresses, no history can exist —
              // the old screen rendered nothing at all below the
              // filter here (a blank void at every viewport). Say so,
              // with the way out.
              <div className="space-y-3 rounded-[20px] border border-panel-border bg-panel-surface-raised p-6 text-panel-text">
                <h2 className="text-lg font-bold text-panel-text">No wallet yet</h2>
                <p className="text-sm leading-relaxed text-panel-text-muted">
                  There is no wallet on this device, so there is no
                  transaction history to show. Create a wallet or
                  import one to see its transactions.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="button" size="pill" asChild>
                    <Link to="/create-wallet">Create a wallet</Link>
                  </Button>
                  <Button type="button" size="pill" variant="outline" asChild>
                    <Link to="/import-wallet">Import wallet</Link>
                  </Button>
                </div>
              </div>
            ) : anyLoaded ? (
              // Lane 2: the settled empty state — a title, the honest
              // line, and the Receive action (DESIGN-SYSTEM §6). The
              // old screen showed the bare line alone.
              <div className="space-y-3 rounded-[20px] border border-panel-border bg-panel-surface-raised p-6 text-panel-text">
                <h2 className="text-lg font-bold text-panel-text">No transactions yet</h2>
                <p className="text-sm leading-relaxed text-panel-text-muted">
                  {`Your history will appear here after your first transaction${filter === 'all' ? '' : ` on ${chainConfig(filter).displayName}`}.`}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="button" size="pill" asChild>
                    <Link to="/receive">Receive</Link>
                  </Button>
                </div>
              </div>
            ) : null
          ) : (
            <ul className="space-y-3">
              {rows.map((tx) => (
                <TxRow key={`${tx.chain}:${tx.hash}`} tx={tx} chain={tx.chain} showChainSymbol />
              ))}
            </ul>
          )}

          {/* A failed history fetch is disclosed with a Retry only when
              the wallet has activity (rows loaded somewhere): a fresh
              wallet with no transactions shows "No transactions yet",
              not an error + a dead Retry for a 429 that would only 429
              again. A failed chain WITH retained transactions keeps its
              block — its rows make rows.length > 0. */}
          {rows.length > 0 && failedChains.length > 0 && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm">
                {`${failedChains
                  .map((chain) => chainConfig(chain).displayName)
                  .join(', ')} history unavailable${
                  failedChains.length === 1 && failedChains[0] !== undefined && history[failedChains[0]].reason
                    ? ` ${humanReasonMessage(history[failedChains[0] as ChainId].reason, 'history')}`
                    : '.'
                }`}
              </p>
              {failedChains.map((chain) => {
                const lastOkAt = history[chain].fetchedAtMs;
                if (history[chain].txs.length === 0 || lastOkAt === undefined) return null;
                return (
                  <p key={chain} className="text-sm text-muted-foreground">
                    Showing last known {chainConfig(chain).displayName}{' '}
                    transactions from {formatLastOk(lastOkAt)}.
                  </p>
                );
              })}
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
