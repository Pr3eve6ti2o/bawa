import Decimal from 'decimal.js';
import { dinero, add, toDecimal } from 'dinero.js';
import { USD } from 'dinero.js/currencies';

// Display/fiat only: never use these results as transaction or adapter inputs.
const MAX_SAFE_MINOR_UNITS = 9_007_199_254_740_991n;
const MAX_DECIMAL_PLACES = 1_000_000_000;
const MAX_DISPLAY_DECIMAL_PLACES = 100;
// Decimal precision below scales with the input length, so an unbounded
// digit string is unbounded CPU (100k digits measured at ~7s). 1,000
// digits is >12x the largest real value (a 256-bit integer, 78 digits).
const MAX_INTEGER_STRING_LENGTH = 1_000;

function assertIntegerString(value: string, label: string): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_INTEGER_STRING_LENGTH ||
    /[^0-9]/.test(value)
  ) {
    throw new Error(
      `${label} must be a non-negative integer string of at most ${MAX_INTEGER_STRING_LENGTH} digits`,
    );
  }
}

function assertDecimalPlaces(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_DECIMAL_PLACES
  ) {
    throw new Error(
      `${label} must be a safe non-negative integer at most ${MAX_DECIMAL_PLACES}`,
    );
  }
}

function assertDisplayDecimalPlaces(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_DISPLAY_DECIMAL_PLACES
  ) {
    throw new Error(
      `displayDecimals must be a safe non-negative integer at most ${MAX_DISPLAY_DECIMAL_PLACES}`,
    );
  }
}

function assertSafeMinorUnits(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a safe non-negative integer`);
  }
}

function formatUsdDecimal(amount: string): string {
  if (
    typeof amount !== 'string' ||
    /^[0-9]+\.[0-9]{2}$/.exec(amount)?.[0] !== amount
  ) {
    throw new Error(
      'USD amount must be a non-negative decimal string with two fractional digits',
    );
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
    throw new Error('symbol must be a non-empty string');
  }

  // Power-of-ten division preserves the input's significant digits.
  // A local clone avoids both default-precision loss and global changes.
  const ExactDecimal = Decimal.clone({ precision: valueBaseUnits.length });
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

  // Concatenated operand lengths bound the product's significant digits
  // without arithmetic on JS numbers or changing global Decimal precision.
  const ExactDecimal = Decimal.clone({
    precision: `${balanceBaseUnits}${priceMinorUnitsPerWhole}`.length,
  });
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
    throw new Error(
      'fiatMinorUnits result must be a safe non-negative integer',
    );
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
    throw new Error(
      'minorUnitsList must be an array of safe non-negative integers',
    );
  }

  let total = dinero({ amount: 0, currency: USD });
  let checkedTotal = 0n;

  for (const minorUnits of minorUnitsList) {
    assertSafeMinorUnits(minorUnits, 'minorUnitsList entry');

    // Guard before add() can construct an unsafe numeric Dinero result.
    checkedTotal += BigInt(minorUnits);
    if (checkedTotal > MAX_SAFE_MINOR_UNITS) {
      throw new Error('sumFiatUSD total exceeds the safe integer range');
    }

    total = add(total, dinero({ amount: minorUnits, currency: USD }));
  }

  return formatUsdDecimal(toDecimal(total));
}
