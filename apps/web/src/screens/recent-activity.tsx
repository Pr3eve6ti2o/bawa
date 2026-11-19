import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';

/**
 * Recent activity — the real per-chain transaction history, extracted
 * verbatim from the dashboard Activity tab (Lane F, 2026-11-20) so the
 * dashboard can show it beside the asset list on desktop widths without
 * rendering a duplicate feed: the Tokens view shows this in the right
 * column, the Activity view shows it as the full-width tab panel, and
 * only one instance is ever visible at a time.
 */
export function RecentActivity() {
  const { history, refreshHistory } = useWallet();

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

        return (
          <>
            {rows.length > 0 ? (
              <ul className="divide-y divide-panel-border overflow-hidden rounded-xl border border-panel-border bg-panel-surface">
                {rows.map(({ chain, tx }) => {
                  const config = chainConfig(chain);
                  const time = timestampMs(tx.timestamp);
                  const direction =
                    tx.direction === 'in'
                      ? 'Received'
                      : tx.direction === 'out'
                        ? 'Sent'
                        : 'Self transfer';

                  return (
                    <li key={`${chain}:${tx.hash}`}>
                      <Link
                        to={`/transactions/${tx.hash}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-panel-accent"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-panel-text">
                            {direction}
                            <span className="font-normal text-panel-text-soft">
                              {' · '}{config.symbol}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs text-panel-text-muted">
                            {time == null
                              ? 'Pending'
                              : new Date(time).toLocaleDateString('en-GB', {
                                  dateStyle: 'short',
                                })}
                            {tx.status === 'failed'
                              ? ' · Failed'
                              : tx.status === 'pending'
                                ? ' · Pending'
                                : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm font-semibold text-panel-text">
                          {formatNativeWithSymbol(
                            tx.amountBaseUnits,
                            CHAIN_DECIMALS[chain],
                            config.symbol,
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : loading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : (
              <p className="rounded-xl border border-panel-border bg-panel-surface p-4 text-sm text-panel-text-soft">No activity yet</p>
            )}

            {unavailableChains.map((chain) => (
              <div
                key={`history-unavailable:${chain}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-surface px-4 py-3"
              >
                <p className="text-sm text-panel-text-soft">
                  {chainConfig(chain).displayName} history unavailable
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshHistory()}
                  className="h-11 shrink-0"
                >
                  Retry
                </Button>
              </div>
            ))}
          </>
        );
      })()}
    </section>
  );
}
