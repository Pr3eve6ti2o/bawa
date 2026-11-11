import { Link, useParams } from 'react-router';
import { Card, CardContent } from '../ui/components/card';

export function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Transaction details
      </h1>

      <Card>
        <CardContent className="space-y-4 p-6">
          <p>
            Transaction not found — no transaction data exists in this starter.
          </p>
          <dl className="space-y-1">
            <dt className="text-sm font-medium">Requested ID</dt>
            <dd className="break-all">
              <code className="text-sm">{id ?? 'No ID supplied'}</code>
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Link
        to="/transactions"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Back to transactions
      </Link>
    </main>
  );
}
