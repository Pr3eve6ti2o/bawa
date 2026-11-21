/**
 * ROUND_HALF_UP means nearest, ties away from zero (1.005 goes to 1.01);
 * precision is significant digits, currency scale is fractional digits —
 * they are different settings.
 */

import Decimal from 'decimal.js';
import { dinero, add, toDecimal } from 'dinero.js';
import { USD } from 'dinero.js/currencies';

// Display/fiat only: never use these results as transaction or adapter inputs.
const MAX_SAFE_MINOR_UNITS = 9_007_199_254_740_991n;
const MAX_DECIMAL_PLACES = 1_000_000_000;
const MAX_DISPLAY_DECIMAL_PLACES = 100;
// Bound the digit strings used in Decimal arithmetic: an unbounded
// digit string is unbounded CPU (100k digits measured at ~7s). 1,000
// digits is >12x the largest real value (a 256-bit integer, 78 digits).
const MAX_INTEGER_STRING_LENGTH = 1_000;

const MONEY_ERROR_MESSAGES = {
  integerString: (label: string): string =>
    `${label} must be a non-negative integer string of at most ${MAX_INTEGER_STRING_LENGTH} digits`,
  decimalPlaces: (label: string): string =>
    `${label} must be a safe non-negative integer at most ${MAX_DECIMAL_PLACES}`,
  displayDecimalPlaces:
    `displayDecimals must be a safe non-negative integer at most ${MAX_DISPLAY_DECIMAL_PLACES}`,
  safeMinorUnits: (label: string): string =>
    `${label} must be a safe non-negative integer`,
  usdAmount:
    'USD amount must be a non-negative decimal string with two fractional digits',
  symbol: 'symbol must be a non-empty string',
  fiatMinorUnitsResult:
    'fiatMinorUnits result must be a safe non-negative integer',
  minorUnitsList:
    'minorUnitsList must be an array of safe non-negative integers',
  sumFiatUSDTotal: 'sumFiatUSD total exceeds the safe integer range',
} as const;

// Two bounded operands need at most 2,000 significant digits for an exact
// product; this also covers the 1,000-digit fee input. Pin arithmetic and
// exponent settings so global Decimal configuration cannot affect helpers.
const ExactDecimal = Decimal.clone({
  precision: MAX_INTEGER_STRING_LENGTH * 2,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
  minE: -9_000_000_000_000_000,
  maxE: 9_000_000_000_000_000,
});

function assertIntegerString(value: string, label: string): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_INTEGER_STRING_LENGTH ||
    /[^0-9]/.test(value)
  ) {
    throw new Error(MONEY_ERROR_MESSAGES.integerString(label));
  }
}

function assertDecimalPlaces(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_DECIMAL_PLACES
  ) {
    throw new Error(MONEY_ERROR_MESSAGES.decimalPlaces(label));
  }
}

function assertDisplayDecimalPlaces(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_DISPLAY_DECIMAL_PLACES
  ) {
    throw new Error(MONEY_ERROR_MESSAGES.displayDecimalPlaces);
  }
}

function assertSafeMinorUnits(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(MONEY_ERROR_MESSAGES.safeMinorUnits(label));
  }
}

function formatUsdDecimal(amount: string): string {
  if (
    typeof amount !== 'string' ||
    /^[0-9]+\.[0-9]{2}$/.exec(amount)?.[0] !== amount
  ) {
    throw new Error(MONEY_ERROR_MESSAGES.usdAmount);
  }

  const grouped = amount.replace(/^[0-9]+/, (integerPart) =>
    integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  );
  return `$${grouped}`;
}

export function formatFeePreview(
  valueBaseUnits: string,
  decimals: number,
  symbol: string,
  displayDecimals = 6,
): string {
  assertIntegerString(valueBaseUnits, 'valueBaseUnits');
  assertDecimalPlaces(decimals, 'decimals');
  assertDisplayDecimalPlaces(displayDecimals);

  if (typeof symbol !== 'string' || symbol.trim().length === 0) {
    throw new Error(MONEY_ERROR_MESSAGES.symbol);
  }

  // Power-of-ten division preserves the input's significant digits.
  const fixed = new ExactDecimal(valueBaseUnits)
    .dividedBy(`1e${decimals}`)
    .toFixed(displayDecimals, Decimal.ROUND_HALF_UP);

  const amount = fixed.includes('.')
    ? fixed.replace(/0+$/, '').replace(/\.$/, '')
    : fixed;

  return `${amount} ${symbol}`;
}

export function fiatMinorUnits(
  balanceBaseUnits: string,
  chainDecimals: number,
  priceMinorUnitsPerWhole: string,
): number {
  assertIntegerString(balanceBaseUnits, 'balanceBaseUnits');
  assertDecimalPlaces(chainDecimals, 'chainDecimals');
  assertIntegerString(priceMinorUnitsPerWhole, 'priceMinorUnitsPerWhole');

  // Shared precision covers the sum of both operand lengths, keeping the
  // product exact without arithmetic on JS numbers or global config changes.
  const wholeUnits = new ExactDecimal(balanceBaseUnits).dividedBy(
    `1e${chainDecimals}`,
  );
  const roundedMinorUnits = wholeUnits
    .times(priceMinorUnitsPerWhole)
    .toFixed(0, Decimal.ROUND_HALF_UP);

  const integerMinorUnits = BigInt(roundedMinorUnits);
  if (
    integerMinorUnits < 0n ||
    integerMinorUnits > MAX_SAFE_MINOR_UNITS
  ) {
    throw new Error(MONEY_ERROR_MESSAGES.fiatMinorUnitsResult);
  }

  // Dinero's default calculator requires JS-number minor units. This is the
  // sole string-to-number conversion, after an exact BigInt safety proof.
  return Number(roundedMinorUnits);
}

export function formatFiatUSD(minorUnits: number): string {
  assertSafeMinorUnits(minorUnits, 'minorUnits');
  return formatUsdDecimal(
    toDecimal(dinero({ amount: minorUnits, currency: USD })),
  );
}

export function sumFiatUSD(minorUnitsList: readonly number[]): string {
  if (!Array.isArray(minorUnitsList)) {
    throw new Error(MONEY_ERROR_MESSAGES.minorUnitsList);
  }

  let total = dinero({ amount: 0, currency: USD });
  let checkedTotal = 0n;

  for (const minorUnits of minorUnitsList) {
    assertSafeMinorUnits(minorUnits, 'minorUnitsList entry');

    // Guard before add() can construct an unsafe numeric Dinero result.
    checkedTotal += BigInt(minorUnits);
    if (checkedTotal > MAX_SAFE_MINOR_UNITS) {
      throw new Error(MONEY_ERROR_MESSAGES.sumFiatUSDTotal);
    }

    total = add(total, dinero({ amount: minorUnits, currency: USD }));
  }

  return formatUsdDecimal(toDecimal(total));
}
