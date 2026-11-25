// Send review/confirm screen (Phase 4, Sol p3, landed 2026-11-19 in 64.8s).
// Verbatim: matches the prompt exactly, no corrections needed. Shows the
// recipient, amount, network fee and total — all real, from the adapter —
// and the broadcast-disabled reason. The only action is "Sign offline";
// there is no broadcast button.
// Phase 2, Lane D: Rabby-style risk rows (catalogue STYLE-03) — the review
// now states the network and the sending account explicitly, before the
// recipient, so the three facts a signer must check are all in the list.
// Only data the caller already has is shown; no risk score is invented.
// `from` is optional so existing callers keep working unchanged.
import { Button } from '../ui/components/button';
import type { SendApprovalStage } from './send-approval';

export type SendReviewProps = {
  chainName: string;
  symbol: string;
  /** Sending account, when the caller knows it. Shown as the From row. */
  from?: string;
  recipient: string;
  amount: string;
  fee: string;
  total: string;
  feeNote: string;
  /** Fiat equivalent of the amount, when the price feed has one
      ("≈ $1,000.00"). Omitted in devnet (test tokens have no value)
      and when the feed has no fresh quote — the coin amounts are the
      source of truth, never an invented dollar figure. */
  fiatAmount?: string;
  /** Token contract / mint / master, when the send is a token transfer. Shown as its own row so the signer can check it. */
  tokenContract?: string;
  disabledReason: string;
  stage: SendApprovalStage;
  onBack: () => void;
  onSign: () => void;
  /** TEMPORARY devnet mode: the test network this send broadcasts to. */
  devnetNetworkName?: string;
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
    heading: 'Signed, not broadcast',
    helper: 'The send has been signed offline. Broadcasting is disabled.',
  },
  'broadcast-disabled': {
    heading: 'Signed, not broadcast',
    helper: 'The send is signed offline. Broadcasting remains disabled.',
  },
  'broadcast-devnet': {
    heading: 'Broadcasting to the test network…',
    helper: 'The signed transaction is being sent to the test network. Test tokens have no value.',
  },
} satisfies Record<
  SendApprovalStage,
  { heading: string; helper: string }
>;

export function SendReview({
  chainName,
  symbol,
  from,
  recipient,
  amount,
  fee,
  total,
  feeNote,
  fiatAmount,
  tokenContract,
  disabledReason,
  stage,
  onBack,
  onSign,
  devnetNetworkName,
}: SendReviewProps) {
  const { heading, helper } = approvalStageCopy[stage];

  return (
    <section
      aria-labelledby="send-review-heading"
      className="mx-auto w-full max-w-lg space-y-4 p-6"
    >
      <header className="space-y-2">
        <h1 id="send-review-heading" className="text-2xl font-semibold">
          {heading}
        </h1>
        {/* Redesign Lane 3: one helper line, not two — the old static
            "Check each row carefully" line repeated the stage helper
            underneath it. */}
        <p className="text-sm text-muted-foreground">{helper}</p>
      </header>

      {/* Redesign Lane 3: the amount is the hero — the eye lands on
          the number first, then checks the rows. It is the same amount
          string as the Amount row below, not a second figure. */}
      <p className="text-center font-display text-3xl font-semibold tabular-nums">
        {amount}
      </p>
      {fiatAmount && (
        <p className="text-center text-sm text-muted-foreground tabular-nums">
          {fiatAmount}
        </p>
      )}

      <div className="rounded-xl border border-border p-4">
        <dl className="divide-y divide-border">
          <div className="flex items-start justify-between gap-4 pb-3">
            <dt className="shrink-0 text-sm text-muted-foreground">Network</dt>
            <dd className="min-w-0 break-words text-right text-sm">
              {chainName} · {symbol}
            </dd>
          </div>

          {from && (
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-muted-foreground">From</dt>
              <dd className="min-w-0 break-all text-right font-mono text-sm">
                {from}
              </dd>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="shrink-0 text-sm text-muted-foreground">Recipient</dt>
            <dd className="min-w-0 break-all text-right text-sm">
              {recipient}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="shrink-0 text-sm text-muted-foreground">Amount</dt>
            <dd className="min-w-0 break-words text-right text-sm tabular-nums">
              {amount}
            </dd>
          </div>

          {tokenContract && (
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-muted-foreground">Token contract</dt>
              <dd className="min-w-0 break-all text-right font-mono text-sm">
                {tokenContract}
              </dd>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="shrink-0 text-sm text-muted-foreground">Estimated fee</dt>
            <dd className="min-w-0 break-words text-right text-sm tabular-nums">
              {fee}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 pt-3 font-semibold">
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
        className="space-y-2 rounded-xl border border-warning-border bg-warning-surface p-3 text-warning-text"
      >
        {devnetNetworkName ? (
          <>
            <p className="font-semibold">Devnet test mode</p>
            <p className="break-words text-sm">
              {`This send broadcasts to the ${devnetNetworkName} test network only. Test tokens have no value.`}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">Sending is switched off</p>
            <p className="break-words text-sm">{disabledReason}</p>
          </>
        )}
      </div>

      {/* Redesign Lane 3: the action row sticks to the bottom of the
          viewport while the review scrolls (DESIGN-SYSTEM §1: one
          primary action, at thumb height, sticky when the content is
          taller than the screen). At 390 px the review runs ~100 px
          past the fold even after tightening — without this, Sign
          offline sits below the fold on the step where trust is
          decided. When the content fits, the row simply sits in flow.
          It is the last thing in the section, so nothing slides under
          it. */}
      <div className="sticky bottom-0 -mx-6 -mb-6 border-t-2 border-ink bg-paper px-6 py-3">
        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onSign}
            disabled={stage !== 'review'}
          >
            Sign offline
          </Button>
        </div>
      </div>
    </section>
  );
}

