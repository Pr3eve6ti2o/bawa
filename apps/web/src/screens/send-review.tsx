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
import { CopyButton } from '../ui/components/copy-button';
import { AddressIdenticon } from '../ui/components/address-identicon';
import {
  isSameAddress,
  shortenAddress,
} from '../wallet/address-detection';
import type { FeeBreakdownRow } from '../wallet/fee-display';
import {
  resolveContractCall,
  type ClearSigningInput,
} from '../wallet/clear-signing';
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
  /**
   * P2-A, M3: the fee's composition — gas limit, max fee and priority
   * fee (EVM), fee rate + planned fee (Bitcoin family), base fee +
   * rent (Solana), energy (TRON). Shown as a <details> under the
   * Estimated fee row: the total stays visible by default, the
   * breakdown opens on expand. Empty or absent when the fee is
   * unknown (TON) — no breakdown is shown, never a guessed one.
   */
  feeBreakdown?: FeeBreakdownRow[];
  /** Fiat equivalent of the amount, when the price feed has one
      ("≈ $1,000.00"). Omitted in devnet (test tokens have no value)
      and when the feed has no fresh quote — the coin amounts are the
      source of truth, never an invented dollar figure. */
  fiatAmount?: string;
  /** Token contract / mint / master, when the send is a token transfer. Shown as its own row so the signer can check it. */
  tokenContract?: string;
  /**
   * Copycat warning from the details step, when the selected token is
   * unverified but a verified token with the same name or symbol
   * exists on this chain under a different contract. Shown as its own
   * alert so the signer checks the contract before signing.
   */
  tokenWarning?: string;
  /**
   * EVM contract call this send makes, when it makes one (ERC-20
   * token sends). Shown as a human-readable clear-signing section
   * when the vendored ERC-7730 snapshot matches the call, and as the
   * raw data otherwise — a reading is never invented.
   */
  contractCall?: ClearSigningInput;
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
  feeBreakdown,
  fiatAmount,
  tokenContract,
  tokenWarning,
  contractCall,
  disabledReason,
  stage,
  onBack,
  onSign,
  devnetNetworkName,
}: SendReviewProps) {
  const { heading, helper } = approvalStageCopy[stage];
  const clearSigning =
    contractCall === undefined ? null : resolveContractCall(contractCall);
  // Lane 3 (UX-major): a send to your own address is worth one plain
  // line on the review — it is usually a mistake, and never a secret.
  const isSelfSend =
    from !== undefined && from !== '' && isSameAddress(recipient, from);

  return (
    <section
      aria-labelledby="send-review-heading"
      className="mx-auto w-full max-w-lg space-y-4 p-6"
    >
      <header className="space-y-2">
        <h1 id="send-review-heading" className="font-bold">
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
      <p className="text-center text-4xl font-semibold tabular-nums">
        {amount}
      </p>
      {fiatAmount && (
        <p className="text-center text-sm text-muted-foreground tabular-nums">
          {fiatAmount}
        </p>
      )}

      <div className="rounded-flat-lg border border-border p-4">
        <dl className="divide-y divide-border">
          <div className="flex items-start justify-between gap-4 pb-3">
            <dt className="shrink-0 text-sm text-muted-foreground">Network</dt>
            <dd className="min-w-0 break-words text-right text-base">
              {chainName} · {symbol}
            </dd>
          </div>

          {from && (
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-muted-foreground">From</dt>
              <dd className="flex min-w-0 items-center justify-end gap-2 text-right font-mono text-sm">
                <AddressIdenticon address={from} size={24} />
                <span className="min-w-0 break-all">{from}</span>
              </dd>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="shrink-0 text-sm text-muted-foreground">Recipient</dt>
            <dd className="min-w-0 text-right text-base">
              {/* Lane 3 (UX-major): shortened, full on tap — the signer
                  checks the short form at a glance and the whole
                  address, with Copy, before signing. The full value is
                  never lost: a shortened address is never the only copy.
                  Lane P2-C (M6): the identicon pairs the short form —
                  the check happens at a glance, before expanding. */}
              <details>
                <summary className="flex cursor-pointer items-center justify-end gap-2 font-mono">
                  <AddressIdenticon address={recipient} size={24} />
                  {shortenAddress(recipient)}
                </summary>
                <p className="mt-1 break-all font-mono">{recipient}</p>
                <CopyButton
                  value={recipient}
                  label="Copy recipient address"
                  className="mt-2"
                />
              </details>
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="shrink-0 text-sm text-muted-foreground">Amount</dt>
            <dd className="min-w-0 break-words text-right text-base tabular-nums">
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
            <dd className="min-w-0 break-words text-right text-base tabular-nums">
              {fee}
            </dd>
          </div>

          {/* P2-A, M3: the fee's composition — total by default,
              breakdown on expand. Fees in the native token, not
              Gwei, except the EVM max/priority fees, which are
              the gas price itself. The breakdown is its own
              full-width row, not nested in the fee value column:
              nested, the value column was ~50 px wide and a
              priority fee like "0.000000906 Gwei" broke mid-number. */}
          {feeBreakdown !== undefined && feeBreakdown.length > 0 && (
            <div className="py-3">
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Fee breakdown
                </summary>
                <dl className="mt-1 space-y-1">
                  {feeBreakdown.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-start justify-between gap-4"
                    >
                      <dt className="shrink-0 text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 break-words text-right tabular-nums">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 pt-3 font-semibold">
            <dt className="shrink-0">Total</dt>
            <dd className="min-w-0 break-words text-right tabular-nums">
              {total}
            </dd>
          </div>
        </dl>
      </div>

      {isSelfSend && (
        <p role="note" className="text-base text-ink">
          You are sending to your own address.
        </p>
      )}

      {tokenWarning !== undefined && (
        <div
          role="alert"
          className="space-y-2 rounded-flat-lg border border-warning-border bg-warning-surface p-3 text-warning-text"
        >
          <p className="font-semibold">Check the token</p>
          <p className="break-words text-base">{tokenWarning}</p>
        </div>
      )}

      {contractCall !== undefined && (
        <div className="space-y-2 rounded-flat-lg border border-border p-4">
          <h2 className="font-semibold">Contract call</h2>
          {clearSigning === null ? (
            <>
              <p className="text-sm text-muted-foreground">
                No clear-signing info — raw data below. Check carefully.
              </p>
              <p className="break-all font-mono text-xs">
                {contractCall.data}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {clearSigning.contractName ?? 'Standard ERC-20'} ·{' '}
                {clearSigning.intent} — {clearSigning.functionName}
              </p>
              <dl className="divide-y divide-border">
                {clearSigning.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-4 py-2"
                  >
                    <dt className="shrink-0 text-sm text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 break-all text-right font-mono text-sm">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                Labels from the ERC-7730 registry snapshot.
              </p>
            </>
          )}
        </div>
      )}

      <small className="block text-sm text-muted-foreground">{feeNote}</small>

      <div
        role="alert"
        className="space-y-2 rounded-flat-lg border border-warning-border bg-warning-surface p-3 text-warning-text"
      >
        {devnetNetworkName ? (
          <>
            <p className="font-semibold">Devnet test mode</p>
            <p className="break-words text-base">
              {`This send broadcasts to the ${devnetNetworkName} test network only. Test tokens have no value.`}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">Sending is off until approved. Offline signing only.</p>
            <p className="break-words text-base">{disabledReason}</p>
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
      <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-ink bg-paper px-6 py-3">
        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="secondary" size="md" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            size="md"
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

