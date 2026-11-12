import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

export function SendScreen() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p className="text-muted-foreground">
          Sending is not implemented in this starter. There is no signing,
          broadcast or transaction-construction code.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Future procedure — not implemented</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            frozen intent → human-readable details → validate payload against
            intent → broadcast the exact signed payload
          </p>
          <p>
            An unknown outcome must stay unresolved pending independent
            reconciliation and must never be treated as permission to resend
            or blindly compose a fresh replacement transfer.
          </p>
        </CardContent>
      </Card>

      <form
        aria-label="Send form — not implemented"
        aria-describedby="send-disabled-reason"
        onSubmit={(event) => event.preventDefault()}
      >
        <p
          id="send-disabled-reason"
          className="mb-4 text-sm text-muted-foreground"
        >
          Sending is not implemented
        </p>
        <fieldset disabled className="space-y-4">
          <legend className="sr-only">Unavailable send form</legend>
          <div className="space-y-2">
            <Label htmlFor="send-recipient">Recipient</Label>
            <Input
              id="send-recipient"
              type="text"
              disabled
              aria-describedby="send-disabled-reason"
              title="Sending is not implemented"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-amount">Amount</Label>
            <Input
              id="send-amount"
              type="text"
              inputMode="decimal"
              disabled
              aria-describedby="send-disabled-reason"
              title="Sending is not implemented"
            />
          </div>
          <Button
            type="button"
            disabled
            aria-describedby="send-disabled-reason"
            title="Sending is not implemented"
          >
            Review
          </Button>
        </fieldset>
      </form>

      <Link
        to="/receive"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Receive
      </Link>
    </main>
  );
}
