Make two edits (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only colour tokenisation. Change NO logic, NO copy, NO structure except the fee label in EDIT 2. Spec is UI-UX-REFERENCE.md §8 (colour: `--background` page, `--card` surfaces, `--foreground` text, `--muted-foreground` supporting text, `--border` boundaries, `--ring` focus, `--primary` actions, `--warning` cautions, `--destructive` errors). Assume the step indicator, Max and fee-estimate work from the parallel edit is already in place — do NOT touch the indicator, the Max button, or the fee-estimate display.

EDIT 1 — Tokenise the remaining Tailwind palette classes in `apps/web/src/screens/send.tsx` (the screen currently mixes Tailwind slate/amber/blue/red with the dark panel — a third palette). Apply these EXACT string replacements, each exactly once except where a count is given:
1. `<p className="text-sm leading-relaxed text-slate-500">` → `<p className="text-sm leading-relaxed text-muted-foreground">` (3 occurrences: the no-wallet paragraph and both signed-result paragraphs — replace all three).
2. `className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"` → `className="rounded-xl border border-warning-border bg-warning-surface p-4 text-sm text-warning-text"`.
3. `<p className="text-sm text-slate-500">` → `<p className="text-sm text-muted-foreground">` (1 occurrence: "Sending from"); and `<p aria-live="polite" className="text-sm text-slate-500">` → `<p aria-live="polite" className="text-sm text-muted-foreground">` (1 occurrence: "Signing offline…").
4. `className="text-sm text-red-600 dark:text-red-400"` → `className="text-sm text-destructive"` (3 occurrences: recipient error, scanner error, preview failure — replace all three).
5. `<dt className="text-slate-500">To</dt>` → `<dt className="text-muted-foreground">To</dt>`; `<dt className="text-slate-500">Balance</dt>` → `<dt className="text-muted-foreground">Balance</dt>`; `<dt className="text-slate-500">Transaction</dt>` → `<dt className="text-muted-foreground">Transaction</dt>`.
6. Blue links (4 total, 3 distinct strings — replace all): `className="text-sm font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400"` → `className="text-sm font-medium text-primary underline underline-offset-4"` (2 occurrences: Create a wallet, Import a wallet); `className="inline-block font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400"` → `className="inline-block font-medium text-primary underline underline-offset-4"` (1 occurrence: "Go to the lock screen to unlock"); `className="inline-block text-sm font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400"` → `className="inline-block text-sm font-medium text-primary underline underline-offset-4"` (1 occurrence: "Back to dashboard").
7. In the review error block: `<p className="text-red-600 dark:text-red-400">` → `<p className="text-destructive">`.
8. The signed-payload `<pre>` (attributes on separate lines — exact current code):
```tsx
            <pre
              id="send-signed-payload"
              className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
```
→
```tsx
            <pre
              id="send-signed-payload"
              className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-muted p-4 text-xs"
            >
```
9. Both result-section `<p className="text-sm leading-relaxed text-slate-500">` paragraphs are covered by (1).
Do NOT change: the chain selector Buttons (already token-based), the indicator, Max, the fee lines, the Back/Review/Sign buttons, the bottom "Receive" link (it inherits the shell text colour — leave it exactly as it is).

EDIT 2 — Rewrite `apps/web/src/screens/send-review.tsx` completely (99 lines). Current file (exact):
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
        <p className="text-sm text-slate-500">
          {chainName} · {symbol}
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 p-4">
        <dl className="divide-y divide-slate-200">
          <div className="flex items-start justify-between gap-4 pb-4">
            <dt className="shrink-0 text-sm text-slate-500">Recipient</dt>
            <dd className="min-w-0 break-all text-right text-sm">
              {recipient}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 py-4">
            <dt className="shrink-0 text-sm text-slate-500">Amount</dt>
            <dd className="min-w-0 break-words text-right text-sm tabular-nums">
              {amount}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 py-4">
            <dt className="shrink-0 text-sm text-slate-500">Network fee</dt>
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

      <small className="block text-sm text-slate-500">{feeNote}</small>

      <div
        role="alert"
        className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
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
Changes: keep the header comment (update the last line to note this lane's token re-skin — or keep it verbatim; keep it verbatim), keep the props type and both buttons (min-h-11 = 44px). Replace every `text-slate-500` with `text-muted-foreground`, `border-slate-200` / `divide-slate-200` with `border-border` / `divide-border`, the amber alert with `border-warning-border bg-warning-surface text-warning-text`. Change the fee row label from "Network fee" to "Estimated fee" (spec §8: label the fee "Estimated fee", with a note that it may change — the `feeNote` below already carries the may-change note). Keep the `mx-auto w-full max-w-lg space-y-6 p-6` section geometry and all other copy word-for-word.

Acceptance: no `slate-*`, no `amber-*`, no `blue-*`, no `red-*`, no `#` hex in either file after the edits; the fee row reads exactly "Estimated fee"; "Sign offline" is still the only signing action and there is still no broadcast button or submitted-to-network state; `tsc`-clean.

Return ONLY the two edits: EDIT 1 as a numbered list of the exact old → new strings (9 items), EDIT 2 as the complete new send-review.tsx in one ```tsx fenced block. No explanation, no other changes.
