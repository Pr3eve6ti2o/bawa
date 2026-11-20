// Send screen (Phase 4, assembled hands-on from Sol p1/p2/p3/p5 + probes).
// Multi-step flow: chain → recipient (+QR scanner) → amount/fees → review
// (Sol p3 SendReview) → offline sign → result. Broadcast is DISABLED until
// separately authorised: the flow signs offline and stops there. Nothing
// here broadcasts, and the UI never presents send as working — the review
// and result both state the broadcast block plainly, and the only action
// after review is "Sign offline".
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { ensureAdapters, useWallet } from '../state/wallet-context';
import { chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { formatFeePreview } from '../wallet/money';
import {
  validateRecipient,
  previewSendAmount,
  signEthOffline,
  signBtcOffline,
  signTrxOffline,
  signTonOffline,
  type SendPreview,
} from '../wallet/send';
import { getLatestBlockHeader } from '../wallet/adapters/trx';
import { getAdapter } from '../wallet/adapters';
import { getSessionPassphrase, withMnemonicAsync } from '../wallet/vault';
import { BROADCAST_DISABLED_MESSAGE } from '../wallet/adapters/types';
import { QrScanner } from '../wallet/qr-scanner';
import { SendReview } from './send-review';
import type { ChainId } from '../engine/boundary';

const CHAINS = ['btc', 'eth', 'trx', 'ton'] as const;

type Step = 'recipient' | 'amount' | 'review' | 'result';

type SignState =
  | { status: 'idle' }
  | { status: 'signing' }
  | {
      status: 'signed';
      txHash: string;
      payload: string;
      payloadLabel: string;
    }
  | { status: 'error'; reason: string };

export function SendScreen() {
  const { vaultState, vaultAddresses, balances, selectedChain } = useWallet();
  const chainsWithWallet: ChainId[] = CHAINS.filter(
    (chain) => vaultAddresses[chain].length > 0,
  );
  const [chain, setChain] = useState<ChainId>(
    chainsWithWallet.includes(selectedChain)
      ? selectedChain
      : (chainsWithWallet[0] ?? 'eth'),
  );
  const [step, setStep] = useState<Step>('recipient');
  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<SendPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [signState, setSignState] = useState<SignState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  const from = vaultAddresses[chain][0] ?? '';
  const config = chainConfig(chain);
  const balance = balances[chain];
  const balanceText =
    balance.status === 'available' || balance.status === 'zero'
      ? formatNativeWithSymbol(
          balance.value ?? '0',
          CHAIN_DECIMALS[chain],
          config.symbol,
        )
      : balance.status === 'loading'
        ? 'Loading balance…'
        : 'Balance unavailable';

  function selectChain(next: ChainId): void {
    setChain(next);
    setStep('recipient');
    setRecipient('');
    setRecipientError(null);
    setAmount('');
    setPreview(null);
    setSignState({ status: 'idle' });
  }

  async function handleRecipientNext(): Promise<void> {
    const result = await validateRecipient(chain, recipient);
    if (!result.ok) {
      setRecipientError(result.reason);
      return;
    }
    setRecipientError(null);
    setStep('amount');
  }

  async function handleScan(value: string): Promise<void> {
    setShowScanner(false);
    setRecipient(value);
    const result = await validateRecipient(chain, value);
    setRecipientError(result.ok ? null : result.reason);
    if (result.ok) setStep('amount');
  }

  async function handleAmountNext(): Promise<void> {
    setPreviewBusy(true);
    try {
      try {
        await ensureAdapters();
      } catch {
        setPreview({ ok: false, reason: "We couldn't load this network's balance. Please retry." });
        return;
      }
      const result = await previewSendAmount(chain, from, recipient, amount);
      setPreview(result);
      if (result.ok) setStep('review');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleSign(): Promise<void> {
    if (vaultState !== 'unlocked') {
      setSignState({
        status: 'error',
        reason: 'Your vault is locked. Unlock it in Security settings to sign.',
      });
      return;
    }
    if (!preview || !preview.ok) return;
    try {
      await ensureAdapters();
    } catch {
      setSignState({ status: 'error', reason: "We couldn't load this network's balance. Please retry." });
      return;
    }
    const previewOk = preview;
    setSignState({ status: 'signing' });
    try {
      const signed = await withMnemonicAsync(async (mnemonic) => {
        const adapter = getAdapter(chain);
        if (!adapter) throw new Error("Sending isn't available for this network.");
        if (chain === 'eth') {
          const inputs = await adapter.getTxInputs(from);
          if (inputs.status !== 'ok') throw new Error(inputs.reason);
          if (inputs.data.kind !== 'nonce') {
            throw new Error("We couldn't prepare your Ethereum transaction. Please retry.");
          }
          const fee = BigInt(previewOk.feeBaseUnits);
          // The ETH fee quote is gasPrice * 21000 (see adapters/eth.ts);
          // the gas price is recovered by exact division.
          if (fee % 21000n !== 0n) {
            throw new Error('Fee quote does not match a 21000-gas transfer.');
          }
          const gasPrice = (fee / 21000n).toString();
          const result = await signEthOffline(
            mnemonic,
            getSessionPassphrase(),
            recipient,
            previewOk.amountBaseUnits,
            String(inputs.data.nonce),
            gasPrice,
          );
          if (!result.ok) return result;
          return {
            ok: true as const,
            txHash: result.txHash,
            payload: result.signedTxHex,
            payloadLabel: 'Signed transaction (hex)',
          };
        }
        if (chain === 'btc') {
          const inputs = await adapter.getTxInputs(from);
          if (inputs.status !== 'ok') throw new Error(inputs.reason);
          if (inputs.data.kind !== 'utxo') {
            throw new Error("We couldn't prepare your Bitcoin transaction. Please retry.");
          }
          const fee = await adapter.estimateFee();
          if (fee.status !== 'ok') throw new Error(fee.reason);
          const result = await signBtcOffline(
            mnemonic,
            getSessionPassphrase(),
            recipient,
            previewOk.amountBaseUnits,
            inputs.data.utxos,
            fee.data.feeBaseUnits,
            from,
          );
          if (!result.ok) return result;
          return {
            ok: true as const,
            txHash: result.txHash,
            payload: result.signedTxHex,
            payloadLabel: 'Signed transaction (hex)',
          };
        }
        if (chain === 'trx') {
          const header = await getLatestBlockHeader();
          if (header.status !== 'ok') throw new Error(header.reason);
          const result = await signTrxOffline(
            mnemonic,
            getSessionPassphrase(),
            recipient,
            previewOk.amountBaseUnits,
            header.data,
          );
          if (!result.ok) return result;
          return {
            ok: true as const,
            txHash: result.txId,
            payload: result.signedTxJson,
            payloadLabel: 'Signed transaction (JSON)',
          };
        }
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok') throw new Error(inputs.reason);
        if (inputs.data.kind !== 'seqno') {
          throw new Error("We couldn't prepare your TON transaction. Please retry.");
        }
        const result = await signTonOffline(
          mnemonic,
          getSessionPassphrase(),
          recipient,
          previewOk.amountBaseUnits,
          inputs.data.seqno,
        );
        if (!result.ok) return result;
        return {
          ok: true as const,
          txHash: result.messageHash,
          payload: result.signedBocBase64,
          payloadLabel: 'Signed message (base64 BOC)',
        };
      });
      if (!signed.ok) {
        setSignState({ status: 'error', reason: signed.reason });
        return;
      }
      setSignState({
        status: 'signed',
        txHash: signed.txHash,
        payload: signed.payload,
        payloadLabel: signed.payloadLabel,
      });
      setStep('result');
    } catch (error: unknown) {
      setSignState({
        status: 'error',
        reason:
          error instanceof Error ? error.message : 'Signing failed.',
      });
    }
  }

  async function copyPayload(): Promise<void> {
    if (signState.status !== 'signed') return;
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(signState.payload);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const [feeEstimate, setFeeEstimate] = useState<
    | { ok: true; feeBaseUnits: string; note: string }
    | { ok: false; reason: string }
    | null
  >(null);

  useEffect(() => {
    if (step !== 'amount') return;
    let cancelled = false;
    setFeeEstimate(null);
    void (async () => {
      const adapter = getAdapter(chain);
      if (!adapter) {
        if (!cancelled) setFeeEstimate({ ok: false, reason: "A fee estimate isn't available for this network." });
        return;
      }
      const result = await adapter.estimateFee();
      if (cancelled) return;
      setFeeEstimate(
        result.status === 'ok'
          ? { ok: true, feeBaseUnits: result.data.feeBaseUnits, note: result.data.note }
          : { ok: false, reason: result.reason },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [step, chain]);

  // Max preserves the fee reserve. Only ETH has a flat native fee estimate
  // (gasPrice x 21000): BTC quotes a sat/vB rate, TRX quotes SUN per unit
  // of energy, and TON has no fee estimate — for those chains Max stays
  // disabled with the honest reason, per spec §8.
  const maxInfo = ((): { enabled: false; reason: string } | { enabled: true; maxBaseUnits: string } => {
    if (chain === 'ton') return { enabled: false, reason: 'Max is unavailable: no fee estimate is available for TON.' };
    if (chain === 'btc') return { enabled: false, reason: 'Max is unavailable: the Bitcoin fee is a rate, and the planned fee depends on the transaction.' };
    if (chain === 'trx') return { enabled: false, reason: 'Max is unavailable: TRON fees depend on energy use, not a flat fee.' };
    if (balance.status !== 'available' && balance.status !== 'zero') return { enabled: false, reason: 'Max is unavailable: the balance is not loaded yet.' };
    if (!feeEstimate || !feeEstimate.ok) return { enabled: false, reason: 'Max is unavailable: the fee estimate is not loaded yet.' };
    const remaining = BigInt(balance.value ?? '0') - BigInt(feeEstimate.feeBaseUnits);
    if (remaining <= 0n) return { enabled: false, reason: 'Max is unavailable: the balance does not cover the estimated fee.' };
    return { enabled: true, maxBaseUnits: remaining.toString() };
  })();

  function handleMax(): void {
    if (!maxInfo.enabled) return;
    const maxBase = BigInt(maxInfo.maxBaseUnits);
    const decimals = CHAIN_DECIMALS[chain];
    const divisor = 10n ** BigInt(decimals);
    const whole = maxBase / divisor;
    const frac = (maxBase % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
    setAmount(frac ? `${whole}.${frac}` : `${whole}`);
  }

  if (chainsWithWallet.length === 0 || !from) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No wallet yet. Create or import a wallet first — sending needs a
          vault address to send from.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/create-wallet"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Create a wallet
          </Link>
          <Link
            to="/import-wallet"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Import a wallet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p
          role="note"
          className="rounded-xl border border-warning-border bg-warning-surface p-4 text-sm text-warning-text"
        >
          Sending funds is switched off until it is separately approved. This flow signs
          offline only — nothing here sends cryptocurrency anywhere.
        </p>
      </header>

      {(() => {
        const steps = ['Chain', 'Recipient', 'Amount', 'Review', 'Sign', 'Result'] as const;
        const activeIndex =
          step === 'recipient'
            ? 1
            : step === 'amount'
              ? 2
              : step === 'review'
                ? (signState.status === 'signing' ? 4 : 3)
                : 5;
        return (
          <div className="space-y-2">
            <ol aria-label="Send progress" className="flex items-center">
              {steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={index === activeIndex ? 'step' : undefined}
                  className="flex flex-1 items-center last:flex-none"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm ${
                      index < activeIndex
                        ? 'bg-success-surface text-success-text'
                        : index === activeIndex
                          ? 'bg-primary font-bold text-primary-foreground'
                          : 'bg-surface-blue-dim text-foreground'
                    }`}
                  >
                    {index < activeIndex ? '✓' : index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <span aria-hidden="true" className="mx-1 h-0.5 flex-1 bg-progress-track" />
                  )}
                </li>
              ))}
            </ol>
            <p className="text-body-sm font-medium text-panel-text-muted">
              {`Step ${activeIndex + 1} of 6: ${steps[activeIndex]}`}
            </p>
          </div>
        );
      })()}

      <div
        role="group"
        aria-label="Chain"
        className="flex flex-wrap gap-2"
      >
        {CHAINS.map((candidate) => {
          const hasWallet = vaultAddresses[candidate].length > 0;
          return (
            <Button
              key={candidate}
              type="button"
              variant={candidate === chain ? 'default' : 'outline'}
              disabled={!hasWallet}
              aria-pressed={candidate === chain}
              title={
                hasWallet
                  ? undefined
                  : `No ${chainConfig(candidate).displayName} wallet`
              }
              onClick={() => selectChain(candidate)}
            >
              {chainConfig(candidate).displayName}
            </Button>
          );
        })}
      </div>

      {step === 'recipient' && (
        <section aria-labelledby="send-recipient-heading" className="space-y-4">
          <h2 id="send-recipient-heading" className="text-lg font-semibold">
            {`Recipient · ${config.displayName}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            Sending from{' '}<span className="break-all font-mono">{from}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Check the full address and network carefully — a transaction, once sent, cannot be reversed.
          </p>
          <div className="space-y-2">
            <Label htmlFor="send-recipient">Recipient address</Label>
            <Input
              id="send-recipient"
              type="text"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={`Enter a ${config.displayName} address`}
              autoComplete="off"
            />
            {recipientError && (
              <p role="alert" className="text-sm text-destructive">
                {recipientError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void handleRecipientNext()}>
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setScannerError(null);
                setShowScanner((current) => !current);
              }}
            >
              {showScanner ? 'Hide scanner' : 'Scan QR'}
            </Button>
          </div>
          {showScanner && (
            <QrScanner
              onScan={(value) => void handleScan(value)}
              onCancel={() => setShowScanner(false)}
              onError={(message) => {
                setScannerError(message);
                setShowScanner(false);
              }}
            />
          )}
          {scannerError && (
            <p role="alert" className="text-sm text-destructive">
              {scannerError}
            </p>
          )}
        </section>
      )}

      {step === 'amount' && (
        <section aria-labelledby="send-amount-heading" className="space-y-4">
          <h2 id="send-amount-heading" className="text-lg font-semibold">
            {`Amount · ${config.displayName}`}
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">To</dt>
              <dd className="min-w-0 break-all font-mono">{recipient}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Balance</dt>
              <dd>{balanceText}</dd>
            </div>
          </dl>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="send-amount">{`Amount (${config.symbol})`}</Label>
              <Button
                type="button"
                variant="outline"
                disabled={!maxInfo.enabled}
                title={maxInfo.enabled ? 'Use the full balance minus the estimated fee' : maxInfo.reason}
                onClick={handleMax}
              >
                Max
              </Button>
            </div>
            <Input
              id="send-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.0"
              autoComplete="off"
            />
            {feeEstimate?.ok && chain === 'eth' && (
              <p className="text-sm text-muted-foreground">
                Estimated fee:{' '}
                {/* Estimated fee is a preview: Decimal rounds display to 6 places; the review screen keeps the exact fee. */}
                {formatFeePreview(feeEstimate.feeBaseUnits, CHAIN_DECIMALS[chain], config.symbol)}
                . The fee may change before signing. Max leaves the estimated
                fee in your wallet.
              </p>
            )}
            {feeEstimate?.ok && chain !== 'eth' && chain !== 'ton' && (
              <p className="text-sm text-muted-foreground">{feeEstimate.note}</p>
            )}
            {feeEstimate && !feeEstimate.ok && (
              <p className="text-sm text-muted-foreground">
                {`Fee estimate unavailable: ${feeEstimate.reason}`}
              </p>
            )}
            {!maxInfo.enabled && (
              <p className="text-sm text-muted-foreground">{maxInfo.reason}</p>
            )}
            {preview && !preview.ok && (
              <p role="alert" className="text-sm text-destructive">
                {preview.reason}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('recipient')}
            >
              Back
            </Button>
            <Button
              type="button"
              disabled={previewBusy}
              onClick={() => void handleAmountNext()}
            >
              {previewBusy ? 'Checking…' : 'Review'}
            </Button>
          </div>
        </section>
      )}

      {step === 'review' && preview && preview.ok && (
        <div className="space-y-4">
          <SendReview
            chainName={config.displayName}
            symbol={config.symbol}
            recipient={recipient}
            amount={formatNativeWithSymbol(
              preview.amountBaseUnits,
              CHAIN_DECIMALS[chain],
              config.symbol,
            )}
            fee={formatNativeWithSymbol(
              preview.feeBaseUnits,
              CHAIN_DECIMALS[chain],
              config.symbol,
            )}
            total={formatNativeWithSymbol(
              preview.totalBaseUnits,
              CHAIN_DECIMALS[chain],
              config.symbol,
            )}
            feeNote={preview.feeNote}
            disabledReason={BROADCAST_DISABLED_MESSAGE}
            onBack={() => setStep('amount')}
            onSign={() => void handleSign()}
          />
          {signState.status === 'signing' && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Signing offline…
            </p>
          )}
          {signState.status === 'error' && (
            <div role="alert" className="space-y-2 text-sm">
              <p className="text-destructive">
                {signState.reason}
              </p>
              {vaultState !== 'unlocked' && (
                <Link
                  to="/lock"
                  className="inline-block font-medium text-primary underline underline-offset-4"
                >
                  Go to the lock screen to unlock
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'result' && signState.status === 'signed' && (
        <section aria-labelledby="send-result-heading" className="space-y-4">
          <h2 id="send-result-heading" className="text-lg font-semibold">
            Send signed — not sent
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The transaction was signed offline with your vault key. It was
            not sent anywhere: sending funds is switched off until it is separately
            approved.
          </p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Transaction</dt>
              <dd className="min-w-0 break-all font-mono">
                {signState.txHash}
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <Label htmlFor="send-signed-payload">
              {signState.payloadLabel}
            </Label>
            <pre
              id="send-signed-payload"
              className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-muted p-4 text-xs"
            >
              {signState.payload}
            </pre>
            <Button type="button" variant="outline" onClick={() => void copyPayload()}>
              {copied ? 'Copied' : 'Copy signed transaction'}
            </Button>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If it is ever unclear whether a transaction was sent, it stays unresolved —
            never resend it and never create a replacement without
            checking the network first.
          </p>
          <Link
            to="/"
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </section>
      )}

      <Link
        to="/receive"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Receive
      </Link>
    </div>
  );
}
