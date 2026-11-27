import { useState } from 'react';
import { Link } from 'react-router';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import type { AdapterTx } from '../wallet/adapters/types';
import { Button } from '../ui/components/button';
import { ChainSearchSelect } from './chain-search-select';
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
  // UX-major Lane 2: 'no-address' is not a failure — it is the initial
  // state before any fetch can run (wallet-context), so it is excluded
  // here, the same rule recent-activity uses. A chain that never tried
  // must not be named as failed in either block below.
  const failedChains = shownChains.filter(
    (chain) =>
      (history[chain].status === 'unavailable' ||
        history[chain].status === 'error') &&
      history[chain].reason !== 'no-address',
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

  // Retry only when at least one failed chain has an address to refetch:
  // a chain that failed with no-address cannot load history however often
  // it is retried, so a Retry there would be dead (same gate as the
  // balance rows and the asset detail screen).
  const retryableFailed = failedChains.filter(
    (chain) => history[chain].reason !== 'no-address',
  );

  return (
    <div className="space-y-6">
      <h1 className="font-bold tracking-tight text-panel-text">Activity</h1>
      <p className="text-sm text-panel-text-muted">
        <Link to="/track" className="text-panel-accent underline underline-offset-4">
          Look up a hash
        </Link>{' '}
        or an address.
      </p>

      {chains.length === 0 ? (
        <div className="space-y-3 rounded-bawa border-2 border-ink bg-paper p-6 text-panel-text">
          <h2 className="font-semibold text-panel-text">No transactions yet</h2>
          <p className="text-sm leading-5 text-panel-text-muted">
            No history on any chain yet.
          </p>
          <p className="text-sm leading-5 text-panel-text-muted">
            Import a watch-only wallet, or share an address from Receive.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" size="sm" asChild>
              <Link to="/receive">Receive</Link>
            </Button>
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link to="/import-wallet">Import a wallet</Link>
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
            it ate ~40% of the phone viewport before any content. P1
            (Lane S1): the filter is the shared searchable chain
            picker now — logo + name + family grouping, with an All
            chains row. Same filter state, same "All" default — the
            control changed, the function did not.
          */}
          <ChainSearchSelect
            chains={chains}
            value={filter}
            onChange={setFilter}
            id="history-chain-filter"
            allowAll
          />

          {anyLoading && rows.length === 0 ? (
            // P0-6: the bare skeleton loaded for 10–35 s with no words
            // at all. The labelled skeleton carries the line
            // ("Loading your activity…") inside the box; the header
            // and the chain filter above stay visible, so the screen
            // never looks blank. Rows stream in as chains settle
            // (this branch only shows while no row has landed yet).
            <Skeleton className="h-24 w-full" label="Loading your activity…" />
          ) : rows.length === 0 ? (
            vaultState === 'no-vault' ? (
              // Lane 2: no vault, no addresses, no history can exist —
              // the old screen rendered nothing at all below the
              // filter here (a blank void at every viewport). Say so,
              // with the way out.
              <div className="space-y-3 rounded-bawa border-2 border-ink bg-paper p-6 text-panel-text">
                <h2 className="font-semibold text-panel-text">No wallet yet</h2>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="button" size="sm" asChild>
                    <Link to="/create-wallet">Create a wallet</Link>
                  </Button>
                  <Button type="button" size="sm" variant="secondary" asChild>
                    <Link to="/import-wallet">Import wallet</Link>
                  </Button>
                </div>
              </div>
            ) : anyLoaded ? (
              // Lane 2: the settled empty state — a title, the honest
              // line, and the Receive action (DESIGN-SYSTEM §6). The
              // old screen showed the bare line alone.
              <div className="space-y-3 rounded-bawa border-2 border-ink bg-paper p-6 text-panel-text">
                <h2 className="font-semibold text-panel-text">No transactions yet</h2>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="button" size="sm" asChild>
                    <Link to="/receive">Receive</Link>
                  </Button>
                </div>
              </div>
            ) : failedChains.length > 0 &&
              chains.some((chain) => history[chain].txs.length > 0) ? (
              // UX-major Lane 2: the shown chain(s) really failed and
              // no row is shown — but the wallet HAS activity somewhere
              // (this is the filtered view: the user filtered to a
              // failed chain while another chain holds transactions).
              // The old code rendered nothing here, a blank void below
              // the filter. Lane C (merged, pinned by test) withholds
              // this block while the wallet has NO activity at all, so
              // the activity gate above keeps that rule intact. The
              // failure is named inline with the one action that can
              // help: Retry when unlocked, Unlock when locked (a Retry
              // with no address could only fail again). Chain names are
              // not repeated — the filter above already shows which
              // chain is selected.
              <div className="space-y-2 rounded-bawa border-2 border-ink bg-paper p-4">
                <p className="text-base">History unavailable.</p>
                <Button
                  type="button"
                  variant="secondary"
                  asChild={vaultState === 'locked'}
                  onClick={
                    vaultState === 'locked'
                      ? undefined
                      : () => void refreshHistory()
                  }
                >
                  {vaultState === 'locked' ? (
                    <Link to="/lock">Unlock</Link>
                  ) : (
                    'Retry'
                  )}
                </Button>
              </div>
            ) : vaultState === 'locked' ? (
              // Lane A (A-8): a locked vault clears every address, so
              // no chain loaded and none failed — the old code fell
              // through to null and the screen was blank below the
              // filter. Match recent-activity: say so, with Unlock.
              <div className="space-y-2 rounded-bawa border-2 border-ink bg-paper p-4">
                <p className="text-base">Locked. Unlock to see activity.</p>
                <Button type="button" variant="secondary" asChild>
                  <Link to="/lock">Unlock</Link>
                </Button>
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
            <div className="space-y-2 rounded-bawa border-2 border-ink bg-paper p-4">
              <p className="text-base">
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
              {retryableFailed.length > 0 && (
                <Button type="button" variant="secondary" onClick={() => void refreshHistory()}>
                  Retry
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
