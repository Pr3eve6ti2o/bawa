// Tests for the fee display helper (Lane 6). The cases are the real
// adapter shapes: EVM wei, Solana lamports, TRON SUN, BTC sat/vB,
// TRON native energy rate, TON unknown fee.
import { describe, expect, it } from 'vitest';
import { buildFeeBreakdown, describeFeeEstimate } from './fee-display';

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

// P2-A, M3: the review breakdown — total by default, composition on
// expand. Every row is a live figure passed in; a missing figure
// omits its row instead of inventing one.
describe('buildFeeBreakdown', () => {
  it('shows gas limit, max fee and priority fee for a tiered EVM send', () => {
    expect(
      buildFeeBreakdown({
        chain: 'eth',
        isToken: false,
        tier: {
          id: 'standard',
          label: 'Standard',
          estimatedSeconds: 30,
          estimatedLabel: '~30 sec',
          maxFeePerGasWei: '87863038500',
          maxPriorityFeePerGasWei: '941',
          feeBaseUnits: '1845123808500000',
        },
        feeBaseUnits: '1845123808500000',
      }),
    ).toEqual([
      { label: 'Gas limit', value: '21,000' },
      { label: 'Max fee', value: '87.86 Gwei' },
      { label: 'Priority fee', value: '0.000000941 Gwei' },
    ]);
  });

  it('uses the 100,000 gas limit and omits the priority row for a legacy tier', () => {
    expect(
      buildFeeBreakdown({
        chain: 'bsc',
        isToken: true,
        tier: {
          id: 'slow',
          label: 'Slow',
          estimatedSeconds: 300,
          estimatedLabel: '~5 min',
          maxFeePerGasWei: '50000000000',
          maxPriorityFeePerGasWei: '0',
          feeBaseUnits: '5000000000000000',
        },
        feeBaseUnits: '5000000000000000',
      }),
    ).toEqual([
      { label: 'Gas limit', value: '100,000' },
      { label: 'Max fee', value: '50 Gwei' },
    ]);
  });

  it('recovers the gas price from the flat fee when no tier is picked', () => {
    expect(
      buildFeeBreakdown({
        chain: 'eth',
        isToken: false,
        tier: null,
        feeBaseUnits: '420000000000000',
      }),
    ).toEqual([
      { label: 'Gas limit', value: '21,000' },
      { label: 'Max fee', value: '20 Gwei' },
    ]);
  });

  it('shows the BTC rate and the planned fee', () => {
    expect(
      buildFeeBreakdown({
        chain: 'btc',
        isToken: false,
        tier: null,
        feeBaseUnits: '1410',
        rateBaseUnits: '10',
        rateUnit: 'sat/vB',
      }),
    ).toEqual([
      { label: 'Fee rate', value: '10 sat/vB' },
      { label: 'Planned fee', value: '0.0000141 BTC' },
    ]);
  });

  it('shows the SOL base fee and the rent when a token account is created', () => {
    expect(
      buildFeeBreakdown({
        chain: 'sol',
        isToken: true,
        tier: null,
        feeBaseUnits: '5000',
        rentBaseUnits: '1488440',
      }),
    ).toEqual([
      { label: 'Base fee', value: '5000 lamports (0.000005 SOL)' },
      { label: 'Account rent', value: '0.00148844 SOL' },
    ]);
  });

  it('shows the TRON energy rate for a native send and the upper bound for a token send', () => {
    expect(
      buildFeeBreakdown({
        chain: 'trx',
        isToken: false,
        tier: null,
        feeBaseUnits: '280',
        rateBaseUnits: '280',
        rateUnit: 'SUN per unit of energy',
      }),
    ).toEqual([
      { label: 'Energy fee', value: '280 SUN per unit of energy' },
    ]);
    expect(
      buildFeeBreakdown({
        chain: 'trx',
        isToken: true,
        tier: null,
        feeBaseUnits: '18200000',
      }),
    ).toEqual([{ label: 'Energy estimate', value: '65,000 (upper bound)' }]);
  });

  it('returns no rows when the fee is unknown (TON)', () => {
    expect(
      buildFeeBreakdown({
        chain: 'ton',
        isToken: false,
        tier: null,
        feeBaseUnits: '0',
        feeUnknown: true,
      }),
    ).toEqual([]);
  });
});
