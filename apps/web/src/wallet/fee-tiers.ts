// EVM fee tiers (P2-A, M2): Slow / Standard / Fast with time
// estimates, derived from live fee data — never invented.
//
// The source is viem's estimateFeesPerGas on the chain's own RPC
// (via the EVM adapter's estimateFeeTiers): maxFeePerGas and
// maxPriorityFeePerGas as the network reports them right now. The
// mined pattern's derivation is applied exactly:
//   Slow     = maxFeePerGas x1,   priority fee /10, ~5 min
//   Standard = maxFeePerGas x1.5, priority fee /5,  ~30 sec
//   Fast     = maxFeePerGas x2,   priority fee /2,  ~15 sec
// A legacy chain reports no priority fee (its estimateFeeTiers
// returns '0'): the tier still varies the max fee, and the priority
// row is omitted from the breakdown rather than shown as a fake 0.
//
// All arithmetic is BigInt: x1.5 is (base * 3) / 2, priority
// divisions floor. The fee for a tier is maxFeePerGas x gasLimit
// (21,000 native, 100,000 ERC-20) — the same gas limits the send
// path already quotes at.
export type FeeTierId = 'slow' | 'standard' | 'fast';

export interface FeeTier {
  id: FeeTierId;
  label: string;
  /** Estimated inclusion time, seconds (pattern estimate, not measured). */
  estimatedSeconds: number;
  /** Display label for the estimate, e.g. "~30 sec". */
  estimatedLabel: string;
  maxFeePerGasWei: string;
  maxPriorityFeePerGasWei: string;
  /** Total fee for the tier at the tier's gas limit, in wei. */
  feeBaseUnits: string;
}

/** The selection the send preview signs with (no display fields). */
export type FeeTierSelection = Pick<
  FeeTier,
  'id' | 'label' | 'maxFeePerGasWei' | 'maxPriorityFeePerGasWei'
>;

export const FEE_TIER_ORDER: readonly FeeTierId[] = [
  'slow',
  'standard',
  'fast',
] as const;

const TIER_DEFS: Record<
  FeeTierId,
  {
    label: string;
    estimatedSeconds: number;
    estimatedLabel: string;
    /** Numerator / denominator of the max-fee multiplier. */
    maxFeeNumerator: bigint;
    maxFeeDenominator: bigint;
    /** Priority-fee divisor. */
    priorityDivisor: bigint;
  }
> = {
  slow: {
    label: 'Slow',
    estimatedSeconds: 300,
    estimatedLabel: '~5 min',
    maxFeeNumerator: 1n,
    maxFeeDenominator: 1n,
    priorityDivisor: 10n,
  },
  standard: {
    label: 'Standard',
    estimatedSeconds: 30,
    estimatedLabel: '~30 sec',
    maxFeeNumerator: 3n,
    maxFeeDenominator: 2n,
    priorityDivisor: 5n,
  },
  fast: {
    label: 'Fast',
    estimatedSeconds: 15,
    estimatedLabel: '~15 sec',
    maxFeeNumerator: 2n,
    maxFeeDenominator: 1n,
    priorityDivisor: 2n,
  },
};

/** Live base fee data, as the adapter reports it (wei strings). */
export type FeeTierBase = {
  maxFeePerGasWei: string;
  maxPriorityFeePerGasWei: string;
};

export function deriveFeeTiers(
  base: FeeTierBase,
  gasLimit: bigint,
): FeeTier[] {
  const maxFee = BigInt(base.maxFeePerGasWei);
  const priority = BigInt(base.maxPriorityFeePerGasWei);
  return FEE_TIER_ORDER.map((id) => {
    const def = TIER_DEFS[id];
    const tierMaxFee =
      (maxFee * def.maxFeeNumerator) / def.maxFeeDenominator;
    const tierPriority = priority / def.priorityDivisor;
    return {
      id,
      label: def.label,
      estimatedSeconds: def.estimatedSeconds,
      estimatedLabel: def.estimatedLabel,
      maxFeePerGasWei: tierMaxFee.toString(),
      maxPriorityFeePerGasWei: tierPriority.toString(),
      feeBaseUnits: (tierMaxFee * gasLimit).toString(),
    };
  });
}

/**
 * Format wei as Gwei with at most `maxDecimals` decimals, trailing
 * zeros trimmed ("58575359" -> "58.58" at 2 decimals). Rounds half
 * up. A priority fee of a few thousand wei is 0.000004709 Gwei — it
 * needs maxDecimals 9 to survive; the default 2 is for max-fee
 * display, where sub-0.01 Gwei precision is noise.
 */
export function formatGwei(wei: string | bigint, maxDecimals = 2): string {
  const value = typeof wei === 'string' ? BigInt(wei) : wei;
  const whole = value / 1_000_000_000n;
  const remainder = value % 1_000_000_000n;
  if (maxDecimals <= 0 || remainder === 0n) return whole.toString();
  const scale = 10n ** BigInt(maxDecimals);
  // Round half up: add half a unit of the last kept place first.
  const scaled =
    (remainder * scale * 2n + 1_000_000_000n) / (2n * 1_000_000_000n);
  if (scaled >= scale) return (whole + 1n).toString();
  const frac = scaled.toString().padStart(maxDecimals, '0').replace(/0+$/, '');
  return frac === '' ? whole.toString() : `${whole}.${frac}`;
}
