Make four targeted edits to apps/web/src/screens/send.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only additions on top of the existing flow. Change NO validation, NO preview/sign logic, NO existing copy except the new helper/fee lines given below. Broadcast stays disabled; the flow still ends at offline signing. Spec is UI-UX-REFERENCE.md §8 (Rabby SendToken chain-first + MetaMask poisoning alerts as patterns only).
NOTE: new-address and poisoning cautions are OMITTED deliberately — the spec says to show them only from actual checks, and this app has no new-address or poisoning check; never invent a "safe" verdict. State that omission in one line at the end of your reply (outside the code blocks) so the applier can record it.

Context (exact current code you need):
- Imports start: `import { useState } from 'react';` — `getAdapter` is already imported from `'../wallet/adapters'`; `formatNativeWithSymbol`, `CHAIN_DECIMALS` already imported from `'../wallet/format'`; `Button`, `Input`, `Label` already imported.
- Step type: `type Step = 'recipient' | 'amount' | 'review' | 'result';` State: `chain`, `step`, `recipient`, `recipientError`, `showScanner`, `scannerError`, `amount`, `preview`, `previewBusy`, `signState`, `copied`. `balance` is `balances[chain]`; `balanceText` is derived above the return. `from` is `vaultAddresses[chain][0] ?? ''`.
- The return starts:
```tsx
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p
          role="note"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          Broadcast is disabled until separately authorised. This flow signs
          offline only — nothing here sends cryptocurrency anywhere.
        </p>
      </header>

      <div
        role="group"
        aria-label="Chain"
        className="flex flex-wrap gap-2"
      >
```
- The recipient section starts `{step === 'recipient' && (` with `<p className="text-sm text-slate-500">Sending from ...` and the recipient input block.
- The amount section starts `{step === 'amount' && (` and contains the `<dl>` with To/Balance rows, the Amount input block, and Back/Review buttons.

EDIT 1 — Add `useEffect` to the React import: `import { useEffect, useState } from 'react';`.

EDIT 2 — Six-step progress indicator, non-clickable, current step labelled in text, never colour alone. Insert after the `</header>` closing tag and before the Chain group `<div role="group" aria-label="Chain"`. Use this exact JSX (the step names and mapping are fixed):
```tsx
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
                        ? 'bg-success text-success-foreground'
                        : index === activeIndex
                          ? 'bg-primary font-bold text-primary-foreground'
                          : 'bg-surface-blue-dim text-primary'
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
            <p className="text-body-sm font-medium text-foreground">
              Step {activeIndex + 1} of 6: {steps[activeIndex]}
            </p>
          </div>
        );
      })()}
```
(The chain selector below is step 1's control; a chain is always selected, so Chain is done from the Recipient step on. Sign is current only while signing; Result is current on the result step.)

EDIT 3 — Recipient step: add an irreversibility helper under the "Sending from" line. Exact anchor:
```tsx
          <p className="text-sm text-slate-500">
            Sending from <span className="break-all font-mono">{from}</span>
          </p>
```
Append directly after it:
```tsx
          <p className="text-sm text-muted-foreground">
            Check the full address and network carefully — a transaction, if
            later broadcast, cannot be reversed.
          </p>
```

EDIT 4 — Amount step: fee estimate, Max (fee-reserve preserving), and estimated-fee display. Add BEFORE the `return (` of the component (after `copyPayload`, before `if (chainsWithWallet.length === 0 ...)`):
```tsx
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
        if (!cancelled) setFeeEstimate({ ok: false, reason: 'No adapter available for this chain.' });
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
```
Then, in the amount section, replace the Amount label/input block. Exact current code:
```tsx
          <div className="space-y-2">
            <Label htmlFor="send-amount">Amount ({config.symbol})</Label>
            <Input
              id="send-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.0"
              autoComplete="off"
            />
            {preview && !preview.ok && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {preview.reason}
              </p>
            )}
          </div>
```
Replace with:
```tsx
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="send-amount">Amount ({config.symbol})</Label>
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
                {formatNativeWithSymbol(feeEstimate.feeBaseUnits, CHAIN_DECIMALS[chain], config.symbol)}
                . The fee may change before signing. Max leaves the estimated
                fee in your wallet.
              </p>
            )}
            {feeEstimate?.ok && chain !== 'eth' && chain !== 'ton' && (
              <p className="text-sm text-muted-foreground">{feeEstimate.note}</p>
            )}
            {feeEstimate && !feeEstimate.ok && (
              <p className="text-sm text-muted-foreground">
                Fee estimate unavailable: {feeEstimate.reason}
              </p>
            )}
            {!maxInfo.enabled && (
              <p className="text-sm text-muted-foreground">{maxInfo.reason}</p>
            )}
            {preview && !preview.ok && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {preview.reason}
              </p>
            )}
          </div>
```
Notes: `feeEstimate.note` for BTC/TRX is the adapter's own honest note (rate / energy wording) — never present a rate as a flat fee. The Max-disabled reason line is muted helper text, not an error. The preview-failure alert stays exactly as it is. Do NOT change the amount Back/Review buttons, the Review button's `disabled={previewBusy}` or its "Checking…" label.

Acceptance: no `#` hex, no `slate-*`, no `amber-*`, no `blue-*` in the returned blocks (token classes only — `bg-success`, `bg-primary`, `bg-surface-blue-dim`, `bg-progress-track`, `text-muted-foreground`); the indicator names the current step in text; Max is enabled only for ETH with a flat fee; `tsc`-clean (all imports used; `useEffect` now imported; `formatNativeWithSymbol` already imported).

Return ONLY the four edits, numbered 1-4, each with the exact old text quoted and the replacement in its own ```tsx fenced block, plus the one-line omission note at the end (outside the code blocks). No other explanation, no other changes.
