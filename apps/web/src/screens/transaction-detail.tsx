// Transaction detail screen (Phase 4, Sol p6, assembled 2026-11-19).
// Real on-chain status: refreshes the adapter-backed history on mount and
// reports the status the network reported, with the check time. A hash that
// is not in the loaded history is reported as unknown — never as a
// simulated success. Sol corrections: uses the real CHAIN_DECIMALS and
// chainConfig (display name + symbol) instead of redefining them, maps
// direction codes to words, and shows the requested ID in the not-found
// state (the pre-existing test requires it).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { chainConfig } from '../wallet/chains';
import {
  CHAIN_DECIMALS,
  formatNativeWithSymbol,
} from '../wallet/format';

const CHAINS = ['btc', 'eth', 'trx', 'ton'] as const;

const STATUS_CLASSES = {
  pending: 'text-amber-700 dark:text-amber-300',
  confirmed: 'text-emerald-700 dark:text-emerald-300',
  failed: 'text-red-700 dark:text-red-300',
} as const;

type HistoryCheck = {
  checkedAt: Date;
  refreshFailed: boolean;
};

function formatTransactionDate(
  timestamp: number | string | null | undefined,
): string {
  if (timestamp == null) return 'Pending';

  const numericTimestamp = Number(timestamp);
  // Accept Unix seconds as well as millisecond timestamps.
  const date = Number.isFinite(numericTimestamp)
    ? new Date(
        Math.abs(numericTimestamp) < 1_000_000_000_000
          ? numericTimestamp * 1_000
          : numericTimestamp,
      )
    : new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function directionLabel(direction: 'in' | 'out' | 'self'): string {
  if (direction === 'in') return 'Received';
  if (direction === 'out') return 'Sent';
  return 'Self transfer';
}

function CheckedAt({ check }: { check: HistoryCheck | null }) {
  if (check === null) {
    return <span>Checking network history…</span>;
  }

  return (
    <span>
      Checked at{' '}
      <time dateTime={check.checkedAt.toISOString()}>
        {check.checkedAt.toLocaleTimeString('en-GB')}
      </time>
    </span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

export function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { history, refreshHistory } = useWallet();
  const [check, setCheck] = useState<HistoryCheck | null>(null);
  const checkPromiseRef = useRef<Promise<HistoryCheck> | null>(null);

  useEffect(() => {
    let active = true;

    // Reuse the mount refresh during Strict Mode effect replays and rerenders.
    if (checkPromiseRef.current === null) {
      checkPromiseRef.current = (async (): Promise<HistoryCheck> => {
        let refreshFailed = false;

        try {
          await refreshHistory();
        } catch {
          refreshFailed = true;
        }

        return {
          checkedAt: new Date(),
          refreshFailed,
        };
      })();
    }

    void checkPromiseRef.current.then((result) => {
      if (active) setCheck(result);
    });

    return () => {
      active = false;
    };
  }, [refreshHistory]);

  const found = (() => {
    if (!id) return null;
    for (const chain of CHAINS) {
      const tx = history[chain]?.txs.find((candidate) => candidate.hash === id);
      if (tx) return { tx, chain };
    }
    return null;
  })();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 text-slate-900 dark:text-slate-100">
      <header className="mb-6">
        <Link
          to="/transactions"
          className="text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-400"
        >
          ← Transactions
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Transaction details</h1>
      </header>

      {check?.refreshFailed && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          History could not be refreshed. The information below is from the
          loaded history; the check time marks the refresh attempt.
        </p>
      )}

      {found ? (
        <dl className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <DetailRow label="Chain">
            {chainConfig(found.chain).displayName} mainnet
          </DetailRow>

          <DetailRow label="Direction">
            <span className="capitalize">
              {directionLabel(found.tx.direction)}
            </span>
          </DetailRow>

          <DetailRow label="Amount">
            <span className="font-semibold">
              {formatNativeWithSymbol(
                found.tx.amountBaseUnits,
                CHAIN_DECIMALS[found.chain],
                chainConfig(found.chain).symbol,
              )}
            </span>
          </DetailRow>

          <DetailRow label="Counterparty">
            <span className="break-all font-mono">
              {found.tx.counterparty || '—'}
            </span>
          </DetailRow>

          <DetailRow label="Date">
            {formatTransactionDate(found.tx.timestamp)}
          </DetailRow>

          <DetailRow label="Status">
            <div aria-live="polite">
              <p
                className={`font-medium ${STATUS_CLASSES[found.tx.status]}`}
              >
                {found.tx.status} as reported by the network.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <CheckedAt check={check} />
              </p>
            </div>
          </DetailRow>

          <DetailRow label="Transaction hash">
            <span className="break-all font-mono">{found.tx.hash}</span>
          </DetailRow>

          {found.tx.explorerUrl && (
            <DetailRow label="Explorer">
              <a
                href={found.tx.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-400"
              >
                View on explorer
              </a>
            </DetailRow>
          )}
        </dl>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p>
            This transaction is not in the loaded history. Its status is
            unknown.
          </p>
          <dl className="mt-3 space-y-1">
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Requested ID
            </dt>
            <dd className="break-all">
              <code className="text-sm">{id ?? 'No ID supplied'}</code>
            </dd>
          </dl>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            <CheckedAt check={check} />
          </p>
          <Link
            to="/transactions"
            className="mt-5 inline-block text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-400"
          >
            Back to transactions
          </Link>
        </section>
      )}
    </main>
  );
}
