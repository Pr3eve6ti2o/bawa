import type { ChainId } from '../engine/boundary';

export const CHAIN_DECIMALS: Record<ChainId, number> = {
  btc: 8,
  eth: 18,
  trx: 6,
  ton: 9,
};

/**
 * Formats a smallest-unit integer string as a decimal amount, exactly
 * (no floats, no rounding). Groups the integer part in thousands and trims
 * trailing zeros from the fraction. Throws on non-integer or negative input.
 */
export function formatNativeAmount(
  valueBaseUnits: string,
  decimals: number,
): string {
  if (!/^\d+$/.test(valueBaseUnits)) {
    throw new Error('Invalid amount: expected a non-negative integer string.');
  }
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error('Invalid amount: decimals must be a non-negative integer.');
  }
  const digits = valueBaseUnits.replace(/^0+(?=\d)/, '');
  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, padded.length - decimals) || '0';
  const fractionPart = decimals === 0 ? '' : padded.slice(padded.length - decimals);
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFraction = fractionPart.replace(/0+$/, '');
  return trimmedFraction === '' ? grouped : `${grouped}.${trimmedFraction}`;
}

export function formatNativeWithSymbol(
  valueBaseUnits: string,
  decimals: number,
  symbol: string,
): string {
  return `${formatNativeAmount(valueBaseUnits, decimals)} ${symbol}`;
}
