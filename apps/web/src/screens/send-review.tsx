// Send review/confirm screen (Phase 4, Sol p3, landed 2026-11-19 in 64.8s).
// Verbatim: matches the prompt exactly, no corrections needed. Shows the
// recipient, amount, network fee and total — all real, from the adapter —
// and the broadcast-disabled reason. The only action is "Sign offline";
// there is no broadcast button.
import { Button } from '../ui/components/button';
import type { SendApprovalStage } from './send-approval';

export type SendReviewProps = {
  chainName: string;
  symbol: string;
  recipient: string;
  amount: string;
  fee: string;
  total: string;
  feeNote: string;
  disabledReason: string;
  stage: SendApprovalStage;
  onBack: () => void;
  onSign: () => void;
};

const approvalStageCopy = {
  review: {
    heading: 'Review your send',
    helper: 'Review the recipient, amount and fee before signing offline.',
  },
  simulating: {
    heading: 'Checking the send can go ahead…',
    helper: 'Simulating the send to check it can go ahead before signing.',
  },
  signing: {
    heading: 'Signing offline…',
    helper: 'Signing the send offline. Nothing will be broadcast.',
  },
  signed: {
    heading: 'Signed — broadcast disabled',
    helper: 'The send has been signed offline. Broadcasting is disabled.',
  },
  'broadcast-disabled': {
    heading: 'Signed — broadcast disabled',
    helper: 'The send is signed offline. Broadcasting remains disabled.',
  },
} satisfies Record<
  SendApprovalStage,
  { heading: string; helper: string }
>;

export function SendReview({
  chainName,
  symbol,
  recipient,
  amount,
  fee,
  total,
  feeNote,
  disabledReason,
  stage,
  onBack,
  onSign,
}: SendReviewProps) {
  const { heading, helper } = approvalStageCopy[stage];

  return (
    <section
      aria-labelledby="send-review-heading"
      className="mx-auto w-full max-w-lg space-y-6 p-6"
    >
      <header className="space-y-2">
        <h1 id="send-review-heading" className="text-2xl font-semibold">
          {heading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {chainName} · {symbol}
        </p>
        <p className="text-sm text-muted-foreground">{helper}</p>
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
        <Button
          type="button"
          onClick={onSign}
          disabled={stage !== 'review'}
          className="min-h-11"
        >
          Sign offline
        </Button>
      </div>
    </section>
  );
}

