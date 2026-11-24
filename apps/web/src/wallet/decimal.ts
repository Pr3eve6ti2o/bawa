/**
 * decimal.ts — exact decimal-string arithmetic on BigInt (Lane C,
 * token-verify programme).
 *
 * Replaces decimal.js (32,351 bytes) and dinero.js (~4 KB) in the
 * bundle. The wallet's money math only ever needs a small, exact
 * surface — parse a decimal string, multiply/divide by a power of ten,
 * multiply two integer strings, round half-up to a fixed number of
 * fractional digits, and divide two prices to a short string — and
 * every one of those is exact on BigInt, with no precision setting to
 * get wrong. Decimal.js was configured with cloned precisions
 * (ExactDecimal 2,000 digits in money.ts, PriceDecimal 40+ digits in
 * prices.ts) precisely to keep those operations exact; the BigInt
 * versions below are exact by construction, so the results are
 * identical.
 *
 * Semantics replicated from the installed decimal.js 10.x source
 * (node_modules/decimal.js/decimal.mjs), read first-hand:
 * - String grammar: optional sign, then `digits[.digits]` or
 *   `.digits`, optional `e[+-]digits`; underscores between digits are
 *   stripped; "Infinity"/"NaN" are non-finite (callers treat them as
 *   invalid). No whitespace is accepted.
 * - ROUND_HALF_UP: round up when the first dropped digit is >= 5
 *   (ties away from zero).
 * - toFixed(dp): exactly `dp` fractional digits, plain notation.
 * - Division: 20 significant digits (the default precision),
 *   half-up at the 21st digit.
 * - toString: exponential notation when the exponent of the most
 *   significant digit is <= -7 or >= 21, otherwise plain; trailing
 *   zeros trimmed.
 *
 * Guard: src/wallet/decimal.test.ts compares every function here
 * against decimal.js itself across a corpus (the reference
 * implementation stays in devDependencies for tests, like the
 * @solana/web3.js reference in send.test.ts). All values the wallet
 * handles are non-negative; the parser still records the sign so the
 * callers' finite/positive checks keep working.
 */

export type DecimalParts = {
  /** True when the value has a leading minus sign (and is non-zero). */
  neg: boolean;
  /** Significant digits, no leading or trailing zeros; "0" when zero. */
  digits: string;
  /**
   * value = BigInt(digits) * 10^-scale. May be negative (a positive
   * exponent, e.g. "1e3" has scale -3); never materialises zeros.
   */
  scale: number;
  /** Base-10 exponent of the most significant digit; 0 when zero. */
  exp: number;
  isZero: boolean;
};

const DECIMAL_GRAMMAR = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

/** Parse a decimal string the way `new Decimal(value)` does. Throws on anything Decimal would reject. */
export function parseDecimalString(value: string): DecimalParts {
  if (typeof value !== 'string') {
    throw new Error(`Invalid decimal string: ${String(value)}`);
  }
  let s = value;
  let neg = false;
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  // Non-finite values are not decimal strings for the wallet's
  // purposes; every caller treats them as invalid input.
  if (s === 'Infinity' || s === 'NaN') {
    throw new Error(`Invalid decimal string: ${value}`);
  }
  if (s.includes('_')) {
    s = s.replace(/(\d)_(?=\d)/g, '$1');
  }
  if (!DECIMAL_GRAMMAR.test(s)) {
    throw new Error(`Invalid decimal string: ${value}`);
  }

  const eIndex = s.search(/e/i);
  const exp10 = eIndex >= 0 ? Number(s.slice(eIndex + 1)) : 0;
  const mantissa = eIndex >= 0 ? s.slice(0, eIndex) : s;
  const dotIndex = mantissa.indexOf('.');
  const intPart = dotIndex >= 0 ? mantissa.slice(0, dotIndex) : mantissa;
  const fracPart = dotIndex >= 0 ? mantissa.slice(dotIndex + 1) : '';
  const combined = intPart + fracPart;
  // The decimal point sits `pointPos` digits into `combined`.
  const pointPos = intPart.length + exp10;

  let leadingZeros = 0;
  while (
    leadingZeros < combined.length &&
    combined.charCodeAt(leadingZeros) === 48
  ) {
    leadingZeros++;
  }
  let end = combined.length;
  while (end > leadingZeros && combined.charCodeAt(end - 1) === 48) {
    end--;
  }
  const digits = combined.slice(leadingZeros, end);
  if (digits.length === 0) {
    return { neg: false, digits: '0', scale: 0, exp: 0, isZero: true };
  }
  // value = BigInt(digits) * 10^E, where E = pointPos - leadingZeros
  // - digits.length (leading zeros shift the point left, trailing
  // zeros were already removed from the length).
  const exponent = pointPos - leadingZeros - digits.length;
  return {
    neg,
    digits,
    // -0 would fail a strict equality check against 0; normalise it.
    scale: -exponent || 0,
    exp: exponent + digits.length - 1,
    isZero: false,
  };
}

/** Multiply by 10^n (n may be negative); only the scale moves. */
export function multiplyByPowerOfTen(
  parts: DecimalParts,
  n: number,
): DecimalParts {
  if (parts.isZero) return parts;
  return { ...parts, scale: parts.scale - n || 0, exp: parts.exp + n };
}

/** Exact product of two parsed values. */
export function multiplyParts(a: DecimalParts, b: DecimalParts): DecimalParts {
  if (a.isZero || b.isZero) {
    return { neg: false, digits: '0', scale: 0, exp: 0, isZero: true };
  }
  const digits = (BigInt(a.digits) * BigInt(b.digits)).toString();
  return {
    neg: a.neg !== b.neg,
    digits,
    scale: a.scale + b.scale || 0,
    exp: a.exp + b.exp,
    isZero: false,
  };
}

function digitCount(value: bigint): number {
  return value.toString().length;
}

/**
 * Decimal's `toFixed(places, ROUND_HALF_UP)`: exactly `places`
 * fractional digits, plain notation, ties away from zero. `places`
 * must be a safe non-negative integer.
 */
export function toFixedHalfUp(parts: DecimalParts, places: number): string {
  if (!Number.isSafeInteger(places) || places < 0) {
    throw new Error(`Invalid decimal places: ${String(places)}`);
  }
  if (parts.isZero) {
    return places === 0 ? '0' : `0.${'0'.repeat(places)}`;
  }
  const digits = BigInt(parts.digits);
  const shift = parts.scale - places;
  let scaled: bigint;
  if (shift <= 0) {
    // Exact: the value already has at most `places` fractional digits.
    // Bound the materialised size: a larger shift would mean the
    // result itself has more than 100,000 digits (no real price does;
    // Decimal would build the same gigantic string and run out of
    // memory instead of failing fast).
    if (-shift > 100_000) {
      throw new Error('Decimal result exceeds the supported digit limit');
    }
    scaled = digits * 10n ** BigInt(-shift);
  } else if (shift > digitCount(digits)) {
    // The whole value is below half of the last kept unit.
    scaled = 0n;
  } else {
    const divisor = 10n ** BigInt(shift);
    const quotient = digits / divisor;
    const remainder = digits % divisor;
    scaled = remainder * 2n >= divisor ? quotient + 1n : quotient;
  }
  let text = scaled.toString();
  if (places > 0) {
    text = text.padStart(places + 1, '0');
    text = `${text.slice(0, text.length - places)}.${text.slice(text.length - places)}`;
  }
  return parts.neg ? `-${text}` : text;
}

/**
 * Decimal's `new Decimal(a).div(new Decimal(b)).toString()` at the
 * default precision of 20 significant digits, half-up. Returns null
 * when the result is not a finite positive number (division by zero,
 * zero or negative inputs) — the caller's `isFinite() && gt(0)`
 * check, as a value instead of a Decimal.
 */
export function divideToString(a: DecimalParts, b: DecimalParts): string | null {
  if (a.isZero || b.isZero || a.neg || b.neg) return null;
  const aDigits = BigInt(a.digits);
  const bDigits = BigInt(b.digits);
  const aLen = a.digits.length;
  const bLen = b.digits.length;

  // Exponent of the first significant digit of aDigits / bDigits.
  // R >= 10^(aLen - bLen) exactly when the digit strings, aligned to
  // the same length, compare that way.
  let exp: number;
  if (aLen >= bLen) {
    exp =
      aDigits >= bDigits * 10n ** BigInt(aLen - bLen) ? aLen - bLen : aLen - bLen - 1;
  } else {
    exp =
      aDigits * 10n ** BigInt(bLen - aLen) >= bDigits
        ? aLen - bLen
        : aLen - bLen - 1;
  }

  // First 21 significant digits of the quotient (20 kept + 1 rounding
  // digit). Q = floor(aDigits * 10^k / bDigits) with k = 20 - exp, so
  // Q lies in [10^20, 10^21) and has exactly 21 digits.
  const k = 20 - exp;
  let quotient21: bigint;
  if (k >= 0) {
    quotient21 = (aDigits * 10n ** BigInt(k)) / bDigits;
  } else {
    quotient21 = aDigits / (bDigits * 10n ** BigInt(-k));
  }
  const qText = quotient21.toString();
  if (qText.length !== 21) {
    // Cannot happen for non-zero inputs (see the range above); guard
    // rather than silently emitting a wrong digit count.
    throw new Error('Decimal division produced an unexpected digit count');
  }
  // Round half-up at the 21st digit (Decimal ROUND_HALF_UP rounds up
  // whenever that digit is >= 5, regardless of what follows it).
  let kept = BigInt(qText.slice(0, 20));
  if (qText.charCodeAt(20) >= 53) kept += 1n;
  let keptText = kept.toString();
  // The quotient is (aDigits / bDigits) * 10^(scaleB - scaleA).
  let finalExp = exp + b.scale - a.scale;
  if (keptText.length === 21) {
    // 999...9 rounded up to 100...0: one significant digit, exponent +1.
    keptText = '1';
    finalExp += 1;
  } else {
    keptText = keptText.replace(/0+$/, '');
  }
  if (keptText.length === 0) keptText = '0';

  // Decimal's toString: exponential when the exponent is <= -7 or
  // >= 21, otherwise plain; trailing zeros already trimmed.
  if (finalExp <= -7 || finalExp >= 21) {
    const mantissa =
      keptText.length > 1
        ? `${keptText.charAt(0)}.${keptText.slice(1)}`
        : keptText;
    return `${mantissa}e${finalExp < 0 ? '' : '+'}${finalExp}`;
  }
  if (finalExp < 0) {
    return `0.${'0'.repeat(-finalExp - 1)}${keptText}`;
  }
  if (finalExp >= keptText.length) {
    return keptText + '0'.repeat(finalExp + 1 - keptText.length);
  }
  if (finalExp + 1 === keptText.length) return keptText;
  return `${keptText.slice(0, finalExp + 1)}.${keptText.slice(finalExp + 1)}`;
}
