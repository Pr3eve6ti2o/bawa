import { Card, CardContent } from '../ui/components/card';

export function TransactionHistoryScreen() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>

      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            No transaction history — no provider is selected, so this starter
            cannot fetch transactions.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
