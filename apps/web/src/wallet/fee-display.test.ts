// Tests for the fee display helper (Lane 6). The cases are the real
// adapter shapes: EVM wei, Solana lamports, TRON SUN, BTC sat/vB,
// TRON native energy rate, TON unknown fee.
import { describe, expect, it } from 'vitest';
import { describeFeeEstimate } from './fee-display';

describe('describeFeeEstimate', () => {
  it('treats EVM wei and Solana lamports as flat amounts', () => {
    expect(
      describeFeeEstimate({ unit: 'wei', feeBaseUnits: '420000000000000' }),
    ).toEqual({ kind: 'amount', feeBaseUnits: '420000000000000' });
    expect(
      describeFeeEstimate({ unit: 'lamports', feeBaseUnits: '5000' }),
    ).toEqual({ kind: 'amount', feeBaseUnits: '5000' });
    expect(
      describeFeeEstimate({ unit: 'sun', feeBaseUnits: '18200000' }),
    ).toEqual({ kind: 'amount', feeBaseUnits: '18200000' });
  });

  it('treats a sat/vB quote as a rate, never an amount', () => {
    expect(describeFeeEstimate({ unit: 'sat/vB', feeBaseUnits: '12' })).toEqual({
      kind: 'rate',
      rateText: '12 sat/vB',
    });
  });

  it('treats the TRON energy fee as a rate, never an amount', () => {
    expect(
      describeFeeEstimate({
        unit: 'SUN per unit of energy',
        feeBaseUnits: '280',
      }),
    ).toEqual({ kind: 'rate', rateText: '280 SUN per unit of energy' });
  });

  it('reports an unknown fee (TON token sends) as unknown', () => {
    expect(
      describeFeeEstimate({
        unit: 'wei',
        feeBaseUnits: '0',
        feeUnknown: true,
      }),
    ).toEqual({ kind: 'unknown' });
  });
});
