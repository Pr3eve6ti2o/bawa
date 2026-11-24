/**
 * ROUND_HALF_UP means nearest, ties away from zero (1.005 goes to 1.01);
 * precision is significant digits, currency scale is fractional digits —
 * they are different settings.
 */

import {
  multiplyByPowerOfTen,
  multiplyParts,
  parseDecimalString,
  toFixedHalfUp,
} from './decimal';

// Display/fiat only: never use these results as transaction or adapter inputs.
const MAX_SAFE_MINOR_UNITS = 9_007_199_254_740_991n;
const MAX_DECIMAL_PLACES = 1_000_000_000;
const MAX_DISPLAY_DECIMAL_PLACES = 100;
// Bound the digit strings used in BigInt decimal arithmetic: an
// unbounded digit string is unbounded CPU (100k digits measured at
// ~7s). 1,000 digits is >12x the largest real value (a 256-bit
// integer, 78 digits).
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

// The arithmetic in ./decimal is exact BigInt, so no precision
// setting is needed: the 2,000-digit Decimal clone this replaced
// existed only to keep the same operations exact.

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
  const fixed = toFixedHalfUp(
    multiplyByPowerOfTen(parseDecimalString(valueBaseUnits), -decimals),
    displayDecimals,
  );

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

  // Exact BigInt arithmetic (no precision setting, no JS numbers):
  // balance / 10^chainDecimals * price, rounded half-up to an integer.
  const roundedMinorUnits = toFixedHalfUp(
    multiplyParts(
      multiplyByPowerOfTen(
        parseDecimalString(balanceBaseUnits),
        -chainDecimals,
      ),
      parseDecimalString(priceMinorUnitsPerWhole),
    ),
    0,
  );

  const integerMinorUnits = BigInt(roundedMinorUnits);
  if (
    integerMinorUnits < 0n ||
    integerMinorUnits > MAX_SAFE_MINOR_UNITS
  ) {
    throw new Error(MONEY_ERROR_MESSAGES.fiatMinorUnitsResult);
  }

  // The string-to-number conversion, after an exact BigInt safety proof.
  return Number(roundedMinorUnits);
}

// Integer minor units (cents) as a dollars string with two fractional
// digits, e.g. 12345n -> "123.45". Replaces dinero's toDecimal(); the
// value is already an exact integer, so no library is needed.
function minorUnitsToUsdDecimal(minorUnits: bigint): string {
  const dollars = minorUnits / 100n;
  const cents = minorUnits % 100n;
  return `${dollars.toString()}.${cents.toString().padStart(2, '0')}`;
}

export function formatFiatUSD(minorUnits: number): string {
  assertSafeMinorUnits(minorUnits, 'minorUnits');
  return formatUsdDecimal(minorUnitsToUsdDecimal(BigInt(minorUnits)));
}

export function sumFiatUSD(minorUnitsList: readonly number[]): string {
  if (!Array.isArray(minorUnitsList)) {
    throw new Error(MONEY_ERROR_MESSAGES.minorUnitsList);
  }

  let checkedTotal = 0n;

  for (const minorUnits of minorUnitsList) {
    assertSafeMinorUnits(minorUnits, 'minorUnitsList entry');

    checkedTotal += BigInt(minorUnits);
    if (checkedTotal > MAX_SAFE_MINOR_UNITS) {
      throw new Error(MONEY_ERROR_MESSAGES.sumFiatUSDTotal);
    }
  }

  return formatUsdDecimal(minorUnitsToUsdDecimal(checkedTotal));
}
