1. Old:
```tsx
import { useState } from 'react';
```

Replacement:
```tsx
import { useEffect, useState } from 'react';
```

2. Old:
```tsx
      </header>
```

Replacement:
```tsx
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

3. Old:
```tsx
            Sending from <span className="break-all font-mono">{from}</span>
          </p>
```

Replacement:
```tsx
            Sending from <span className="break-all font-mono">{from}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Check the full address and network carefully — a transaction, if
            later broadcast, cannot be reversed.
          </p>
```

4. Old (guard prefix):
```tsx
  if (chainsWithWallet.length === 0
```

Replacement:
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

  if (chainsWithWallet.length === 0
```

Old (Amount block):
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

Replacement:
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

New-address and poisoning cautions are omitted because the app has no corresponding checks.