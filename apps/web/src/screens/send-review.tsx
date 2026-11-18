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
