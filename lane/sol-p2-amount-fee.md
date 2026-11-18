```typescript
export async function previewSendAmount(
  chain: 'btc' | 'eth' | 'trx' | 'ton',
  fromAddress: string,
  amountDecimal: string
): Promise<
  | {
      ok: true;
      amountBaseUnits: string;
      feeBaseUnits: string;
      totalBaseUnits: string;
      feeNote: string;
    }
  | { ok: false; reason: string }
> {
  const { decimalToBaseUnits, CHAIN_DECIMALS } = await import('./format');

  let amount: bigint;
  try {
    const input = amountDecimal.trim();
    const fraction = input.split('.')[1] ?? '';

    if (
      !/^\d+(?:\.\d+)?$/.test(input) ||
      fraction.length > CHAIN_DECIMALS[chain]
    ) {
      return { ok: false, reason: 'Enter a valid amount.' };
    }

    const parsed = decimalToBaseUnits(amountDecimal, CHAIN_DECIMALS[chain]);
    if (parsed == null) {
      return { ok: false, reason: 'Enter a valid amount.' };
    }

    amount = BigInt(parsed);
    if (amount <= 0n) {
      return { ok: false, reason: 'Enter a valid amount.' };
    }
  } catch {
    return { ok: false, reason: 'Enter a valid amount.' };
  }

  const { getAdapter } = await import('./adapters');
  const adapter = getAdapter(chain);

  const balance = await adapter.getBalance(fromAddress);
  if (!balance.ok) {
    return { ok: false, reason: balance.reason };
  }

  if (amount > BigInt(balance.balanceBaseUnits)) {
    return { ok: false, reason: 'Amount exceeds available balance.' };
  }

  const fee = await adapter.estimateFee();
  if (!fee.ok) {
    return { ok: false, reason: fee.reason };
  }

  return {
    ok: true,
    amountBaseUnits: amount.toString(),
    feeBaseUnits: fee.feeBaseUnits,
    totalBaseUnits: (amount + BigInt(fee.feeBaseUnits)).toString(),
    feeNote: fee.note,
  };
}
```