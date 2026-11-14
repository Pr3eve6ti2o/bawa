import { Link, useParams } from 'react-router';

export function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Transaction details
      </h1>

      <div className="space-y-4 rounded-[20px] border border-white/10 bg-[#243454] p-6 text-white">
        <p className="text-sm leading-relaxed text-[#aab5d1]">
          Transaction not found — no transaction data exists in this starter.
        </p>
        <dl className="space-y-1">
          <dt className="text-sm font-medium text-[#eff2fc]">Requested ID</dt>
          <dd className="break-all">
            <code className="text-sm text-[#aab5d1]">{id ?? 'No ID supplied'}</code>
          </dd>
        </dl>
      </div>

      <Link
        to="/transactions"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Back to transactions
      </Link>
    </div>
  );
}
