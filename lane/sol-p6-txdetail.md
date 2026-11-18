```typescript
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useWallet } from "../state/wallet-context";
import { formatNativeWithSymbol } from "../wallet/format";

const CHAINS = ["btc", "eth", "trx", "ton"] as const;

const CHAIN_DECIMALS = {
  btc: 8,
  eth: 18,
  trx: 6,
  ton: 9,
} as const;

const STATUS_CLASSES = {
  pending: "text-amber-700 dark:text-amber-300",
  confirmed: "text-emerald-700 dark:text-emerald-300",
  failed: "text-red-700 dark:text-red-300",
} as const;

type HistoryCheck = {
  checkedAt: Date;
  refreshFailed: boolean;
};

function formatTransactionDate(
  timestamp: number | string | null | undefined,
): string {
  if (timestamp == null) return "Pending";

  const numericTimestamp = Number(timestamp);
  // Accept Unix seconds as well as millisecond timestamps.
  const date = Number.isFinite(numericTimestamp)
    ? new Date(
        Math.abs(numericTimestamp) < 1_000_000_000_000
          ? numericTimestamp * 1_000
          : numericTimestamp,
      )
    : new Date(timestamp);

  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function CheckedAt({ check }: { check: HistoryCheck | null }) {
  if (check === null) {
    return <span>Checking network history…</span>;
  }

  return (
    <span>
      Checked at{" "}
      <time dateTime={check.checkedAt.toISOString()}>
        {check.checkedAt.toLocaleTimeString()}
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

  const transaction = CHAINS.flatMap(
    (chain) => history[chain]?.txs ?? [],
  ).find((tx) => id !== undefined && tx.hash === id);

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

      {transaction ? (
        <dl className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <DetailRow label="Chain">
            {transaction.chain.toUpperCase()}
          </DetailRow>

          <DetailRow label="Direction">
            <span className="capitalize">{transaction.direction}</span>
          </DetailRow>

          <DetailRow label="Amount">
            <span className="font-semibold">
              {formatNativeWithSymbol(
                transaction.amountBaseUnits,
                CHAIN_DECIMALS[transaction.chain],
                transaction.chain.toUpperCase(),
              )}
            </span>
          </DetailRow>

          <DetailRow label="Counterparty">
            <span className="break-all font-mono">
              {transaction.counterparty || "—"}
            </span>
          </DetailRow>

          <DetailRow label="Date">
            {formatTransactionDate(transaction.timestamp)}
          </DetailRow>

          <DetailRow label="Status">
            <div aria-live="polite">
              <p
                className={`font-medium ${STATUS_CLASSES[transaction.status]}`}
              >
                {transaction.status} as reported by the network.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <CheckedAt check={check} />
              </p>
            </div>
          </DetailRow>

          <DetailRow label="Transaction hash">
            <span className="break-all font-mono">{transaction.hash}</span>
          </DetailRow>

          {transaction.explorerUrl && (
            <DetailRow label="Explorer">
              <a
                href={transaction.explorerUrl}
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
            This transaction is not in the loaded history. Its status is unknown.
          </p>
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

export { TransactionDetailScreen as TransactionDetail };
export default TransactionDetailScreen;
```