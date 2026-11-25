import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';
import { TxRow } from './tx-row';

/**
 * Recent activity — the real per-chain transaction history, extracted
 * verbatim from the dashboard Activity tab (Lane F, 2026-11-20) so the
 * dashboard can show it beside the asset list on desktop widths without
 * rendering a duplicate feed: the Tokens view shows this in the right
 * column, the Activity view shows it as the full-width tab panel, and
 * only one instance is ever visible at a time.
 */
export function RecentActivity() {
  const { history, refreshHistory, vaultState } = useWallet();
  // While the vault is locked there is no derived address in state, so
  // a history refetch can only fail again with no-address (see
  // refreshHistory in state/wallet-context) — the same dead-Retry
  // mechanism as the balance rows. The per-chain Retry is suppressed
  // while locked and one Unlock prompt replaces it. 'no-vault' keeps
  // its Retry: a watch-only xpub address can still load history.
  const isLocked = vaultState === 'locked';

  // `history` is optional-chained throughout: the dashboard tests mock a
  // wallet without history for the Tokens view, and the old dashboard
  // never read history there. A missing history reads as "no activity",
  // never a crash. The real provider always supplies it.

  return (
    <section aria-label="Activity" className="space-y-3">
      <h2 className="text-lg font-semibold text-panel-text">Recent activity</h2>

      {(() => {
        const chains = availableFor('history');

        const timestampMs = (timestamp: number | string | null | undefined) => {
          if (timestamp == null) return null;

          const value =
            typeof timestamp === 'number' && timestamp < 1_000_000_000_000
              ? timestamp * 1000
              : timestamp;
          const time = new Date(value).getTime();

          return Number.isFinite(time) ? time : null;
        };

        const rows = chains
          .flatMap((chain) =>
            (history?.[chain]?.txs ?? []).map((tx) => ({ chain, tx })),
          )
          .sort(
            (a, b) =>
              (timestampMs(b.tx.timestamp) ?? 0) -
              (timestampMs(a.tx.timestamp) ?? 0),
          );

        const loading = chains.some(
          (chain) => history?.[chain]?.status === 'loading',
        );

        const unavailableChains = chains.filter(
          (chain) =>
            history?.[chain]?.status === 'unavailable' ||
            history?.[chain]?.status === 'error',
        );

        // Merge decision (Lane C + marketing-fix, both tests kept): the
        // unavailable block renders when the wallet has activity, while
        // locked, or when any chain's history REALLY failed. 'no-address'
        // is not a failure — it is the initial state for every chain
        // (wallet-context.tsx:165: no fetch can run yet), so a fresh
        // wallet whose only failed chain is 'no-address' shows the empty
        // state only, never a dead Retry (dashboard.test.tsx). A failed
        // fetch ('down' and friends) is different: when every chain
        // failed the unavailable rows win over "No activity yet"
        // (text-spacing.test.tsx, Lane C). While locked the per-chain
        // text stays, with the Unlock prompt below it — the vault must
        // open before any history can load at all.
        const hasActivity = rows.length > 0;
        const showUnavailable =
          hasActivity ||
          isLocked ||
          unavailableChains.some(
            (chain) => history?.[chain]?.reason !== 'no-address',
          );

        // Lane C: "No activity yet" is earned only by a chain that
        // actually loaded (loaded/empty) with zero transactions. A
        // failed history is not an empty history — when every chain
        // failed, the unavailable rows below win. An absent record
        // (no history mocked/supplied at all) keeps the old "no
        // activity" reading: the real provider always supplies
        // history, so an absent record is a mock, not a failure.
        const anyLoaded = chains.some((chain) => {
          const status = history?.[chain]?.status;
          return (
            status === undefined ||
            status === 'loaded' ||
            status === 'empty'
          );
        });

        return (
          <>
            {rows.length > 0 ? (
              <ul className="divide-y divide-panel-border overflow-hidden rounded-xl border border-panel-border bg-panel-surface">
                {/*
                  Lane 2: the rows are the shared TxRow (direction tile,
                  counterparty, amount, date + status) — the old inline
                  row showed direction · symbol / amount / date with no
                  counterparty and no status word. The row's outer shape
                  is the list's own (padding, no border): the card +
                  dividers provide the container.
                */}
                {rows.map(({ chain, tx }) => (
                  <TxRow
                    key={`${chain}:${tx.hash}`}
                    tx={tx}
                    chain={chain}
                    showChainSymbol
                    className="px-4 py-3"
                  />
                ))}
              </ul>
            ) : loading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : anyLoaded ? (
              <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
                <p className="text-sm font-semibold text-panel-text">No activity yet</p>
                <p className="mt-1 text-sm text-panel-text-soft">
                  Your history will appear here after your first transaction.
                </p>
              </div>
            ) : null}

            {showUnavailable && unavailableChains.map((chain) => (
              <div
                key={`history-unavailable:${chain}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-surface px-4 py-3"
              >
                {/* One text node on purpose: the chain name used to render
                    as an expression followed by a text node, which some text
                    extraction reads back joined as "TONhistory". */}
                <p className="text-sm text-panel-text-soft">
                  {`${chainConfig(chain).displayName} history unavailable`}
                </p>
                {!isLocked && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void refreshHistory()}
                    size="tall"
                  >
                    Retry
                  </Button>
                )}
              </div>
            ))}
            {isLocked && unavailableChains.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-surface px-4 py-3">
                <p className="text-sm text-panel-text-soft">Locked. Unlock to see activity.</p>
                <Button type="button" variant="outline" asChild size="tall">
                  <Link to="/lock">Unlock</Link>
                </Button>
              </div>
            )}
          </>
        );
      })()}
    </section>
  );
}
