## EDIT 1

1. `<p className="text-sm leading-relaxed text-slate-500">` → `<p className="text-sm leading-relaxed text-muted-foreground">` (3 occurrences).

2. `className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"` → `className="rounded-xl border border-warning-border bg-warning-surface p-4 text-sm text-warning-text"`.

3. 
   - `<p className="text-sm text-slate-500">` → `<p className="text-sm text-muted-foreground">` (1 occurrence).
   - `<p aria-live="polite" className="text-sm text-slate-500">` → `<p aria-live="polite" className="text-sm text-muted-foreground">` (1 occurrence).

4. `className="text-sm text-red-600 dark:text-red-400"` → `className="text-sm text-destructive"` (3 occurrences).

5. 
   - `<dt className="text-slate-500">To</dt>` → `<dt className="text-muted-foreground">To</dt>`.
   - `<dt className="text-slate-500">Balance</dt>` → `<dt className="text-muted-foreground">Balance</dt>`.
   - `<dt className="text-slate-500">Transaction</dt>` → `<dt className="text-muted-foreground">Transaction</dt>`.

6. 
   - `className="text-sm font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400"` → `className="text-sm font-medium text-primary underline underline-offset-4"` (2 occurrences).
   - `className="inline-block font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400"` → `className="inline-block font-medium text-primary underline underline-offset-4"` (1 occurrence).
   - `className="inline-block text-sm font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400"` → `className="inline-block text-sm font-medium text-primary underline underline-offset-4"` (1 occurrence).

7. `<p className="text-red-600 dark:text-red-400">` → `<p className="text-destructive">`.

8. 
   ```
               <pre
                 id="send-signed-payload"
                 className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900"
               >
   ```
   →
   ```
               <pre
                 id="send-signed-payload"
                 className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-muted p-4 text-xs"
               >
   ```

9. `<p className="text-sm leading-relaxed text-slate-500">` → `<p className="text-sm leading-relaxed text-muted-foreground">` (both signed-result paragraphs; already included in item 1).

## EDIT 2

```tsx
// Send review/confirm screen (Phase 4, Sol p3, landed 2026-11-19 in 64.8s).
// Verbatim: matches the prompt exactly, no corrections needed. Shows the
// recipient, amount, network fee and total — all real, from the adapter —
// and the broadcast-disabled reason. The only action is "Sign offline";
// there is no broadcast button.
import { Button } from '../ui/components/button';

export type SendReviewProps = {
  chainName: string;
  symbol: string;
  recipient: string;
  amount: string;
  fee: string;
  total: string;
  feeNote: string;
  disabledReason: string;
  onBack: () => void;
  onSign: () => void;
};

export function SendReview({
  chainName,
  symbol,
  recipient,
  amount,
  fee,
  total,
  feeNote,
  disabledReason,
  onBack,
  onSign,
}: SendReviewProps) {
  return (
    <section
      aria-labelledby="send-review-heading"
      className="mx-auto w-full max-w-lg space-y-6 p-6"
    >
      <header className="space-y-2">
        <h1 id="send-review-heading" className="text-2xl font-semibold">
          Review send
        </h1>
        <p className="text-sm text-muted-foreground">
          {chainName} · {symbol}
        </p>
      </header>

      <div className="rounded-xl border border-border p-4">
        <dl className="divide-y divide-border">
          <div className="flex items-start justify-between gap-4 pb-4">
            <dt className="shrink-0 text-sm text-muted-foreground">Recipient</dt>
            <dd className="min-w-0 break-all text-right text-sm">
              {recipient}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 py-4">
            <dt className="shrink-0 text-sm text-muted-foreground">Amount</dt>
            <dd className="min-w-0 break-words text-right text-sm tabular-nums">
              {amount}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 py-4">
            <dt className="shrink-0 text-sm text-muted-foreground">Estimated fee</dt>
            <dd className="min-w-0 break-words text-right text-sm tabular-nums">
              {fee}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 pt-4 font-semibold">
            <dt className="shrink-0">Total</dt>
            <dd className="min-w-0 break-words text-right tabular-nums">
              {total}
            </dd>
          </div>
        </dl>
      </div>

      <small className="block text-sm text-muted-foreground">{feeNote}</small>

      <div
        role="alert"
        className="space-y-2 rounded-xl border border-warning-border bg-warning-surface p-4 text-warning-text"
      >
        <p className="font-semibold">Broadcast is disabled</p>
        <p className="break-words text-sm">{disabledReason}</p>
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" onClick={onBack} className="min-h-11">
          Back
        </Button>
        <Button type="button" onClick={onSign} className="min-h-11">
          Sign offline
        </Button>
      </div>
    </section>
  );
}
```