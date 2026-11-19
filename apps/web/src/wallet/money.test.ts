import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  fiatMinorUnits,
  formatFeePreview,
  formatFiatUSD,
  sumFiatUSD,
} from './money';

const invalidIntegerStrings = [
  '',
  '-1',
  '1.5',
  '1e3',
  '+1',
  ' 1',
  '1 ',
  '1\n',
];

// Fractional rejection fixtures remain strings; casts exercise runtime guards.
const invalidNumericInputs = [
  -1,
  NaN,
  Infinity,
  9_007_199_254_740_992,
  '1.5' as unknown as number,
  '100' as unknown as number,
];

const invalidDecimalCounts = [
  ...invalidNumericInputs,
  1_000_000_001,
];

describe('formatFeePreview', () => {
  it('rounds a half-micro ETH fee up at the default six decimal places', () => {
    expect(formatFeePreview('500000000000', 18, 'ETH')).toBe(
      '0.000001 ETH',
    );
  });

  it('rounds one wei to zero', () => {
    expect(formatFeePreview('1', 18, 'ETH')).toBe('0 ETH');
  });

  it('handles zero, leading zeros, and zero chain decimals', () => {
    expect(formatFeePreview('0', 18, 'ETH')).toBe('0 ETH');
    expect(formatFeePreview('000150000000', 8, 'BTC')).toBe('1.5 BTC');
    expect(formatFeePreview('42', 0, 'TOK')).toBe('42 TOK');
  });

  it('supports custom precision without trimming integer zeros', () => {
    expect(formatFeePreview('123456789', 8, 'BTC', 3)).toBe('1.235 BTC');
    expect(formatFeePreview('1000000000', 8, 'BTC', 0)).toBe('10 BTC');
  });

  it('combines decimal display strings exactly with Decimal', () => {
    const first = formatFeePreview('100000000000000000', 18, 'ETH');
    const second = formatFeePreview('200000000000000000', 18, 'ETH');

    expect(first).toBe('0.1 ETH');
    expect(second).toBe('0.2 ETH');

    const combined = new Decimal(first.replace(/ ETH$/, '')).plus(
      second.replace(/ ETH$/, ''),
    );
    expect(combined.toFixed(1, Decimal.ROUND_HALF_UP)).toBe('0.3');
  });

  it('does not double-round inputs beyond the default Decimal precision', () => {
    expect(
      formatFeePreview('149999999999999999999', 20, 'ETH', 0),
    ).toBe('1 ETH');
  });

  it.each(invalidIntegerStrings)(
    'rejects invalid base-unit strings (%j)',
    (value) => {
      expect(() => formatFeePreview(value, 18, 'ETH')).toThrow(
        /valueBaseUnits/,
      );
    },
  );

  it.each(invalidDecimalCounts)(
    'rejects invalid chain decimal counts (%s)',
    (decimals) => {
      expect(() => formatFeePreview('1', decimals, 'ETH')).toThrow(
        /decimals/,
      );
    },
  );

  it.each(invalidDecimalCounts)(
    'rejects invalid display decimal counts (%s)',
    (displayDecimals) => {
      expect(() =>
        formatFeePreview('1', 18, 'ETH', displayDecimals),
      ).toThrow(/displayDecimals/);
    },
  );

  it.each(['', ' ', '\n'])('rejects blank symbols (%j)', (symbol) => {
    expect(() => formatFeePreview('1', 18, symbol)).toThrow(/symbol/);
  });

  it('rejects non-string amounts and symbols', () => {
    expect(() =>
      formatFeePreview(1 as unknown as string, 18, 'ETH'),
    ).toThrow(/valueBaseUnits/);
    expect(() =>
      formatFeePreview('1', 18, 1 as unknown as string),
    ).toThrow(/symbol/);
  });
});

describe('fiatMinorUnits', () => {
  it('converts a BTC balance to integer fiat minor units', () => {
    expect(fiatMinorUnits('150000000', 8, '10000000')).toBe(15000000);
  });

  it('rounds fractional minor units half up', () => {
    expect(fiatMinorUnits('1', 1, '5')).toBe(1);
    expect(fiatMinorUnits('1', 1, '4')).toBe(0);
  });

  it('handles zero balances, zero prices, and large base-unit strings', () => {
    expect(fiatMinorUnits('0', 18, '10000000')).toBe(0);
    expect(fiatMinorUnits('150000000', 8, '0')).toBe(0);
    expect(fiatMinorUnits('1000000000000000000', 18, '100')).toBe(100);
  });

  it('retains all significant digits before final rounding', () => {
    expect(fiatMinorUnits('149999999999999999999', 20, '1')).toBe(1);
  });

  it('accepts results at the safe integer boundary after rounding', () => {
    expect(fiatMinorUnits('9007199254740991', 0, '1')).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(fiatMinorUnits('90071992547409914', 1, '1')).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('rejects unsafe results, including overflow caused by rounding', () => {
    expect(() => fiatMinorUnits('9007199254740992', 0, '1')).toThrow(
      /safe.*integer/,
    );
    expect(() => fiatMinorUnits('1', 0, '9007199254740992')).toThrow(
      /safe.*integer/,
    );
    expect(() => fiatMinorUnits('90071992547409915', 1, '1')).toThrow(
      /safe.*integer/,
    );
  });

  it.each(invalidIntegerStrings)(
    'rejects invalid balance strings (%j)',
    (balance) => {
      expect(() => fiatMinorUnits(balance, 8, '100')).toThrow(
        /balanceBaseUnits/,
      );
    },
  );

  it.each(invalidIntegerStrings)(
    'rejects invalid price strings (%j)',
    (price) => {
      expect(() => fiatMinorUnits('1', 8, price)).toThrow(
        /priceMinorUnitsPerWhole/,
      );
    },
  );

  it.each(invalidDecimalCounts)(
    'rejects invalid chain decimal counts (%s)',
    (decimals) => {
      expect(() => fiatMinorUnits('1', decimals, '100')).toThrow(
        /chainDecimals/,
      );
    },
  );

  it('rejects non-string balances and prices', () => {
    expect(() =>
      fiatMinorUnits(1 as unknown as string, 0, '100'),
    ).toThrow(/balanceBaseUnits/);
    expect(() =>
      fiatMinorUnits('1', 0, 100 as unknown as string),
    ).toThrow(/priceMinorUnitsPerWhole/);
  });
});

describe('formatFiatUSD', () => {
  it('formats USD with grouped thousands and two fractional digits', () => {
    expect(formatFiatUSD(15000000)).toBe('$150,000.00');
  });

  it('preserves cent padding and zero', () => {
    expect(formatFiatUSD(0)).toBe('$0.00');
    expect(formatFiatUSD(1)).toBe('$0.01');
    expect(formatFiatUSD(100)).toBe('$1.00');
  });

  it('formats the largest safe integer amount exactly', () => {
    expect(formatFiatUSD(Number.MAX_SAFE_INTEGER)).toBe(
      '$90,071,992,547,409.91',
    );
  });

  it.each(invalidNumericInputs)(
    'rejects invalid minor units (%s)',
    (minorUnits) => {
      expect(() => formatFiatUSD(minorUnits)).toThrow(/safe.*integer/);
    },
  );
});

describe('sumFiatUSD', () => {
  it('sums integer minor units with Dinero', () => {
    expect(sumFiatUSD([100, 250])).toBe('$3.50');
  });

  it('formats an empty sum as zero', () => {
    expect(sumFiatUSD([])).toBe('$0.00');
  });

  it('accepts readonly inputs without mutating them', () => {
    const values = Object.freeze([100, 250]);
    expect(sumFiatUSD(values)).toBe('$3.50');
    expect(values).toEqual([100, 250]);
  });

  it('accepts a total at the safe integer boundary', () => {
    expect(sumFiatUSD([9_007_199_254_740_990, 1])).toBe(
      '$90,071,992,547,409.91',
    );
  });

  it('rejects overflow even when every entry is individually safe', () => {
    expect(() => sumFiatUSD([Number.MAX_SAFE_INTEGER, 1])).toThrow(
      /safe integer/,
    );
  });

  it.each(invalidNumericInputs)(
    'rejects invalid list entries (%s)',
    (minorUnits) => {
      expect(() => sumFiatUSD([100, minorUnits])).toThrow(
        /safe.*integer/,
      );
    },
  );

  it('rejects non-array inputs', () => {
    expect(() =>
      sumFiatUSD(null as unknown as readonly number[]),
    ).toThrow(/minorUnitsList.*array/);
    expect(() =>
      sumFiatUSD('100' as unknown as readonly number[]),
    ).toThrow(/minorUnitsList.*array/);
  });
});

describe('formatFeePreview display-decimal bound', () => {
  it('preserves 0/3/6, default precision, and half-up rounding', () => {
    const valueBaseUnits = '1234566500000000000';

    expect(formatFeePreview(valueBaseUnits, 18, 'ETH', 0)).toBe('1 ETH');
    expect(formatFeePreview(valueBaseUnits, 18, 'ETH', 3)).toBe('1.235 ETH');
    expect(formatFeePreview(valueBaseUnits, 18, 'ETH', 6)).toBe('1.234567 ETH');
    expect(formatFeePreview(valueBaseUnits, 18, 'ETH')).toBe('1.234567 ETH');
  });

  it('accepts the display-decimal bound', () => {
    expect(formatFeePreview('1', 0, 'ETH', 100)).toBe('1 ETH');
  });

  it('rejects excessive display precision', () => {
    const message =
      'displayDecimals must be a safe non-negative integer at most 100';

    // Check the boundary first so unpatched code fails before the large case.
    expect(() => formatFeePreview('1', 18, 'ETH', 101)).toThrow(message);
    expect(() => formatFeePreview('1', 18, 'ETH', 20_000_000)).toThrow(message);
  });
});
