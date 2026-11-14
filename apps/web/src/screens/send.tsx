import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { Card, CardContent } from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

export function SendScreen() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
      </header>

      <div className="rounded-[30px] border border-white/10 bg-[#243454] p-6 text-white sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Future procedure</h2>
          <span className="flex h-6 items-center rounded-full bg-white/10 px-3 text-[10px] font-bold text-[#c8d0e8]">
            NOT IMPLEMENTED
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#aab5d1]">
          frozen intent → human-readable details → validate payload against
          intent → broadcast the exact signed payload
        </p>
        <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {[
            ['Recipient', 'Not available'],
            ['Amount', 'Not available'],
            ['Network fee', 'Not available'],
            ['Total', 'Not available'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sm text-[#aab5d1]">{label}</dt>
              <dd className="text-sm font-semibold text-[#eff2fc]">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-[#aab5d1]">
          Sending is not implemented in this starter. There is no signing,
          broadcast or transaction-construction code.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[#aab5d1]">
          An unknown outcome must stay unresolved pending independent
          reconciliation and must never be treated as permission to resend
          or blindly compose a fresh replacement transfer.
        </p>
      </div>

      <Card className="rounded-[20px] border-[#d6deed]">
        <CardContent className="space-y-4 pt-6">
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
        </CardContent>
      </Card>

      <Link
        to="/receive"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Receive
      </Link>
    </div>
  );
}
