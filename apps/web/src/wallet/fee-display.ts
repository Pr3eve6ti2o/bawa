import type { ChainId } from '../engine/boundary';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from './chain-amount-format';
import { chainConfig } from './chains';
import { formatGwei, type FeeTier } from './fee-tiers';
import { isEvmTxChain } from './watch-only-families';

type FeeDisplay =
  | { kind: 'amount'; feeBaseUnits: string }
  | { kind: 'rate'; rateText: string }
  | { kind: 'unknown' };

export function describeFeeEstimate(input: {
  unit: string;
  feeBaseUnits: string;
  feeUnknown?: boolean;
}): FeeDisplay {
  if (input.feeUnknown === true) return { kind: 'unknown' };
  if (
    input.unit === 'sat/vB' ||
    input.unit.toLowerCase().includes('energy')
  ) {
    return { kind: 'rate', rateText: `${input.feeBaseUnits} ${input.unit}` };
  }
  return { kind: 'amount', feeBaseUnits: input.feeBaseUnits };
}

/**
 * Fee breakdown for the Send review screen (P2-A, M3): the total
 * stays visible by default and the composition opens on expand
 * (<details> in send-review.tsx). Fees are shown in the native token,
 * not Gwei — except the EVM max/priority fees, which the mined
 * pattern quotes in Gwei and which are the gas price itself, not the
 * total. Every row comes from a live figure the caller passes in:
 * the picked tier, the preview fee, or the details-step estimate.
 * Nothing is invented: a row with no live figure is omitted, and a
 * chain with no known fee (TON) gets no breakdown at all.
 */
export type FeeBreakdownRow = { label: string; value: string };

export function buildFeeBreakdown(input: {
  chain: ChainId;
  isToken: boolean;
  /** The picked fee tier, when the chain is EVM and tiers loaded. */
  tier: FeeTier | null;
  /** The preview's fee, in the chain's base units. */
  feeBaseUnits: string;
  /** TON only: the fee is unknown at preview time. */
  feeUnknown?: boolean;
  /** SOL token sends: the rent for the recipient token account ('0' when none). */
  rentBaseUnits?: string;
  /**
   * The details-step estimate's rate, when the fee is a rate rather
   * than an amount: the sat/vB rate (BTC/LTC/DOGE) or the SUN-per-
   * unit energy fee (TRON native). Omitted for token sends, whose
   * estimate is already a total.
   */
  rateBaseUnits?: string;
  rateUnit?: string;
}): FeeBreakdownRow[] {
  if (input.feeUnknown === true) return [];
  const symbol = chainConfig(input.chain).symbol;
  const decimals = CHAIN_DECIMALS[input.chain];

  // EVM: gas limit, max fee and (when the tier reports one) priority
  // fee. Without a tier the max fee is the gas price recovered from
  // the preview fee by the same exact division the signer uses; a
  // fee that does not divide exactly omits the row rather than
  // showing a rounded gas price as fact.
  if (isEvmTxChain(input.chain)) {
    const gasLimit = input.isToken ? 100000n : 21000n;
    const rows: FeeBreakdownRow[] = [
      {
        label: 'Gas limit',
        value: input.isToken ? '100,000' : '21,000',
      },
    ];
    if (input.tier !== null) {
      rows.push({
        label: 'Max fee',
        value: `${formatGwei(input.tier.maxFeePerGasWei)} Gwei`,
      });
      if (BigInt(input.tier.maxPriorityFeePerGasWei) > 0n) {
        rows.push({
          label: 'Priority fee',
          value: `${formatGwei(input.tier.maxPriorityFeePerGasWei, 9)} Gwei`,
        });
      }
    } else {
      const fee = BigInt(input.feeBaseUnits);
      if (fee % gasLimit === 0n) {
        rows.push({
          label: 'Max fee',
          value: `${formatGwei(fee / gasLimit)} Gwei`,
        });
      }
    }
    return rows;
  }

  // Bitcoin family: the rate the plan used, plus the planned fee.
  if (
    (input.chain === 'btc' ||
      input.chain === 'ltc' ||
      input.chain === 'doge') &&
    input.rateBaseUnits !== undefined &&
    input.rateUnit !== undefined
  ) {
    return [
      { label: 'Fee rate', value: `${input.rateBaseUnits} ${input.rateUnit}` },
      {
        label: 'Planned fee',
        value: formatNativeWithSymbol(
          input.feeBaseUnits,
          decimals,
          symbol,
        ),
      },
    ];
  }

  // Solana: the 5,000-lamport base fee, plus the rent when a token
  // send creates the recipient's token account.
  if (input.chain === 'sol') {
    const rows: FeeBreakdownRow[] = [
      {
        label: 'Base fee',
        value: `${input.feeBaseUnits} lamports (${formatNativeWithSymbol(input.feeBaseUnits, decimals, symbol)})`,
      },
    ];
    if (
      input.rentBaseUnits !== undefined &&
      BigInt(input.rentBaseUnits) > 0n
    ) {
      rows.push({
        label: 'Account rent',
        value: formatNativeWithSymbol(
          input.rentBaseUnits,
          decimals,
          symbol,
        ),
      });
    }
    return rows;
  }

  // TRON native: the fee is an energy rate, not an amount — show the
  // rate. A TRON token send quotes a 65,000-energy upper bound; the
  // network charges only the energy actually used.
  if (input.chain === 'trx') {
    if (input.isToken) {
      return [{ label: 'Energy estimate', value: '65,000 (upper bound)' }];
    }
    if (
      input.rateBaseUnits !== undefined &&
      input.rateUnit !== undefined
    ) {
      return [
        {
          label: 'Energy fee',
          value: `${input.rateBaseUnits} ${input.rateUnit}`,
        },
      ];
    }
    return [];
  }

  // TON and every other chain: no breakdown — the fee is unknown
  // (TON) or the total already says everything there is.
  return [];
}

