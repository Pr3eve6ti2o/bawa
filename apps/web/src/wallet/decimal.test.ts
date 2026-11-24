// decimal.test.ts — differential test (Lane C, token-verify programme).
//
// decimal.ts replaces decimal.js in the bundle; this test proves the
// replacement by comparing every function against decimal.js itself
// (the reference implementation, kept in devDependencies for tests —
// the same pattern as the @solana/web3.js reference in send.test.ts).
// If any case below diverges, the replacement is wrong, however
// plausible it looks.
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  divideToString,
  multiplyByPowerOfTen,
  multiplyParts,
  parseDecimalString,
  toFixedHalfUp,
  type DecimalParts,
} from './decimal';

/** Reconstruct (neg, digits, scale, exp, isZero) from a Decimal. */
function decimalParts(d: Decimal): DecimalParts {
  const words = (d as unknown as { d: number[] | null }).d;
  if (words === null || d.isNaN() || !d.isFinite()) {
    throw new Error('not a finite decimal');
  }
  const raw = words
    .map((w, i) => (i === 0 ? String(w) : String(w).padStart(7, '0')))
    .join('')
    .replace(/^0+/, '')
    .replace(/0+$/, '');
  if (raw.length === 0 || d.isZero()) {
    return { neg: false, digits: '0', scale: 0, exp: 0, isZero: true };
  }
  return {
    neg: d.isNeg(),
    digits: raw,
    scale: raw.length - 1 - d.e,
    exp: d.e,
    isZero: false,
  };
}

const PARSE_STRINGS = [
  '0',
  '0.0',
  '0.000',
  '1',
  '1.0',
  '1.5',
  '1.005',
  '1.0049',
  '2.5',
  '2.675',
  '0.125',
  '0.375',
  '0.625',
  '0.05',
  '0.15',
  '0.45',
  '0.55',
  '0.95',
  '9.99',
  '9.999',
  '99.995',
  '100',
  '100.00',
  '123.456',
  '123.456789',
  '0.000001',
  '0.0000001',
  '0.00000000000000000001',
  '1e-7',
  '1.23e5',
  '123.456e-3',
  '.5',
  '5.',
  '.05',
  '0.5',
  '1e21',
  '1e-8',
  '1e20',
  '1e-20',
  '999999999999999999999',
  '1000000000000000000000',
  '1.00000000000000000001',
  '0.99999999999999999999',
  '9.99999999999999999999',
  '0.310229',
  '1.028',
  '1774.93',
  '62683',
  '0.310200',
  '0.073494',
  '500000000000',
  '149999999999999999999',
  '90071992547409914',
  '90071992547409915',
  '1_000',
  '1_000.5',
  '+1.5',
  '-1.5',
  '-0.00001',
  '0.00000000000000000000000001',
  '123456789.123456789',
  '1e100',
  '1e-100',
  '3.141592653589793238462643',
  '2.00000000000000000000001',
];

const TOFIXED_PLACES = [0, 1, 2, 3, 6, 8, 18];

const DIVIDE_PAIRS: Array<[string, string]> = [
  ['0.2953', '0.2953'],
  ['0.05', '0.05'],
  ['1', '3'],
  ['2', '3'],
  ['10', '3'],
  ['1', '8'],
  ['0.0767', '0.05'],
  ['1', '1'],
  ['2', '1'],
  ['1', '2'],
  ['3', '2'],
  ['100', '7'],
  ['1', '7'],
  ['22', '7'],
  ['0.1', '0.3'],
  ['0.3', '0.1'],
  ['1e-7', '1e-7'],
  ['1e21', '1e21'],
  ['123.456', '0.001'],
  ['0.001', '123.456'],
  ['999999999999999999999', '3'],
  ['1', '1000000000000000000000'],
  ['1', '0.0000001'],
  ['0.0000001', '1'],
  ['5.98', '0.2953'],
  ['1', '6'],
  ['355', '113'],
  ['1', '9'],
  ['1', '11'],
  ['1', '13'],
  ['10', '6'],
  ['0.07673', '0.05'],
  ['2.5', '0.5'],
  ['0.5', '2.5'],
  ['1.5', '0.5'],
  ['0.000000123456789', '0.0000001'],
  ['123456789.123456789', '987654321.987654321'],
  ['1e-20', '1e-20'],
  ['1e20', '1e-20'],
  ['1e-20', '1e20'],
  ['9.99999999999999999999', '1'],
  ['1', '9.99999999999999999999'],
  ['0', '5'],
  ['5', '0'],
  ['-1', '5'],
  ['5', '-1'],
  ['0', '0'],
];

describe('parseDecimalString', () => {
  it.each(PARSE_STRINGS)('parses %s exactly like Decimal', (value) => {
    expect(parseDecimalString(value)).toEqual(decimalParts(new Decimal(value)));
  });

  it.each(['', ' ', 'abc', '1.2.3', 'e5', '1e', '--1', '1a', '1__000', '_100', '1_', '1,000'])(
    'throws for %j',
    (value) => {
      expect(() => parseDecimalString(value)).toThrow();
      // Decimal rejects these too (throws, or produces NaN).
      let decimal: Decimal | null = null;
      let threw = false;
      try {
        decimal = new Decimal(value);
      } catch {
        threw = true;
      }
      expect(threw || decimal === null || decimal.isNaN()).toBe(true);
    },
  );

  // Decimal also parses hex ("0x10" -> 16); the wallet never passes a
  // hex string, so the parser deliberately does not support it.
  it('throws for hex strings, which the wallet never passes', () => {
    expect(() => parseDecimalString('0x10')).toThrow();
    expect(new Decimal('0x10').toString()).toBe('16');
  });

  it.each(['NaN', 'Infinity', '-Infinity'])(
    'throws for non-finite %s (callers treat it as invalid)',
    (value) => {
      expect(() => parseDecimalString(value)).toThrow();
      expect(new Decimal(value).isFinite()).toBe(false);
    },
  );
});

describe('toFixedHalfUp', () => {
  it.each(
    PARSE_STRINGS.flatMap((value) =>
      TOFIXED_PLACES.map((places) => [value, places] as const),
    ),
  )('toFixed(%s, %s) matches Decimal', (value, places) => {
    expect(toFixedHalfUp(parseDecimalString(value), places)).toBe(
      new Decimal(value).toFixed(places, Decimal.ROUND_HALF_UP),
    );
  });

  it('rounds the money fixtures exactly', () => {
    // formatFeePreview: 500000000000 / 1e18 at 6 places.
    expect(
      toFixedHalfUp(
        multiplyByPowerOfTen(parseDecimalString('500000000000'), -18),
        6,
      ),
    ).toBe('0.000001');
    // fiatMinorUnits: 1 / 10 * 5 at 0 places (0.5 rounds up).
    expect(
      toFixedHalfUp(
        multiplyParts(
          multiplyByPowerOfTen(parseDecimalString('1'), -1),
          parseDecimalString('5'),
        ),
        0,
      ),
    ).toBe('1');
    // 1 / 10 * 4 at 0 places (0.4 rounds down).
    expect(
      toFixedHalfUp(
        multiplyParts(
          multiplyByPowerOfTen(parseDecimalString('1'), -1),
          parseDecimalString('4'),
        ),
        0,
      ),
    ).toBe('0');
  });
});

describe('divideToString', () => {
  it.each(DIVIDE_PAIRS)('div(%s, %s) matches Decimal toString', (a, b) => {
    const ratio = new Decimal(a).div(new Decimal(b));
    const expected =
      ratio.isFinite() && ratio.gt(0) ? ratio.toString() : null;
    expect(divideToString(parseDecimalString(a), parseDecimalString(b))).toBe(
      expected,
    );
  });
});
