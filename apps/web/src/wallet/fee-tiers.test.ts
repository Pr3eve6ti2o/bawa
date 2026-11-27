// P2-A, M2: fee-tier derivation from live base fees + Gwei formatting.
import { describe, expect, it } from 'vitest';
import { deriveFeeTiers, formatGwei } from './fee-tiers';

describe('deriveFeeTiers', () => {
  // Live-shape base: 58.575359 Gwei max fee, 0.000004709 Gwei priority
  // (ETH estimateFeesPerGas, probed 2026-11-28).
  const base = {
    maxFeePerGasWei: '58575359000',
    maxPriorityFeePerGasWei: '4709',
  };

  it('derives Slow / Standard / Fast at x1 / x1.5 / x2 with priority /10 / /5 / /2', () => {
    const tiers = deriveFeeTiers(base, 21000n);
    expect(tiers.map((tier) => tier.id)).toEqual([
      'slow',
      'standard',
      'fast',
    ]);
    expect(tiers[0]).toMatchObject({
      label: 'Slow',
      estimatedLabel: '~5 min',
      maxFeePerGasWei: '58575359000',
      maxPriorityFeePerGasWei: '470',
      feeBaseUnits: (58575359000n * 21000n).toString(),
    });
    expect(tiers[1]).toMatchObject({
      label: 'Standard',
      estimatedLabel: '~30 sec',
      maxFeePerGasWei: '87863038500',
      maxPriorityFeePerGasWei: '941',
      feeBaseUnits: (87863038500n * 21000n).toString(),
    });
    expect(tiers[2]).toMatchObject({
      label: 'Fast',
      estimatedLabel: '~15 sec',
      maxFeePerGasWei: '117150718000',
      maxPriorityFeePerGasWei: '2354',
      feeBaseUnits: (117150718000n * 21000n).toString(),
    });
  });

  it('uses the token gas limit for the fee when asked', () => {
    const tiers = deriveFeeTiers(base, 100000n);
    expect(tiers[1]?.feeBaseUnits).toBe((87863038500n * 100000n).toString());
  });

  it('keeps a zero priority fee at zero (legacy chain)', () => {
    const tiers = deriveFeeTiers(
      { maxFeePerGasWei: '50000000000', maxPriorityFeePerGasWei: '0' },
      21000n,
    );
    expect(tiers.map((tier) => tier.maxPriorityFeePerGasWei)).toEqual([
      '0',
      '0',
      '0',
    ]);
    expect(tiers[1]?.maxFeePerGasWei).toBe('75000000000');
  });
});

describe('formatGwei', () => {
  it('formats whole and fractional Gwei at 2 decimals', () => {
    expect(formatGwei('50000000000')).toBe('50');
    expect(formatGwei('58575359000')).toBe('58.58');
    expect(formatGwei('58575359')).toBe('0.06');
  });

  it('keeps tiny priority fees exact at 9 decimals', () => {
    expect(formatGwei('4709', 9)).toBe('0.000004709');
    expect(formatGwei('0', 9)).toBe('0');
  });

  it('carries over when rounding crosses a whole Gwei', () => {
    expect(formatGwei('999999999')).toBe('1');
  });
});
