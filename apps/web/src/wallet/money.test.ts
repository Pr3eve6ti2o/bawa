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

  it('rejects over-long base-unit strings (DoS cap: 1,000 digits)', () => {
    // Decimal precision scales with input length: 100k digits measured
    // at ~7s before this cap, 1M digits past 110s. The cap keeps the
    // worst case near 1ms while allowing >12x the largest real value
    // (a 256-bit integer is 78 digits).
    expect(() => formatFeePreview('9'.repeat(1001), 18, 'ETH')).toThrow(
      /valueBaseUnits.*at most 1000 digits/,
    );
  });

  it('accepts a 1,000-digit base-unit string at the cap', () => {
    expect(formatFeePreview('9'.repeat(1000), 18, 'ETH')).toMatch(
      / ETH$/,
    );
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

  it('rejects over-long balance and price strings (DoS cap)', () => {
    expect(() => fiatMinorUnits('9'.repeat(1001), 8, '100')).toThrow(
      /balanceBaseUnits.*at most 1000 digits/,
    );
    expect(() => fiatMinorUnits('1', 8, '9'.repeat(1001))).toThrow(
      /priceMinorUnitsPerWhole.*at most 1000 digits/,
    );
  });

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

describe('money rounding boundaries and Decimal config isolation', () => {
  // Synthetic test data only; expected values are hand-rounded.
  it('keeps fee and fiat results unchanged after global Decimal config mutation', () => {
    expect.assertions(6);

    const originalConfig = {
      rounding: Decimal.rounding,
      precision: Decimal.precision,
    };

    try {
      // 123456789 / 10^8 = 1.23456789 -> 1.235 at three places.
      // (25 / 10) * 5 = 12.5 -> 13 integer minor units.
      const feeBefore = formatFeePreview('123456789', 8, 'TOK', 3);
      const fiatBefore = fiatMinorUnits('25', 1, '5');

      expect(feeBefore).toBe('1.235 TOK');
      expect(fiatBefore).toBe(13);

      Decimal.set({ rounding: Decimal.ROUND_DOWN, precision: 1 });

      const feeAfter = formatFeePreview('123456789', 8, 'TOK', 3);
      const fiatAfter = fiatMinorUnits('25', 1, '5');

      expect(feeAfter).toBe(feeBefore);
      expect(fiatAfter).toBe(fiatBefore);

      // Isolation must not overwrite the caller's global settings.
      expect(Decimal.rounding).toBe(Decimal.ROUND_DOWN);
      expect(Decimal.precision).toBe(1);
    } finally {
      Decimal.set(originalConfig);
    }
  });

  // Dividing by 10^30 gives 1.2345675 - 10^-30, the tie itself,
  // and 1.2345675 + 10^-30. Six-place half-up gives 1.234567
  // below the tie and 1.234568 at or above it.
  it.each([
    {
      position: 'just below',
      valueBaseUnits: '1234567499999999999999999999999',
      expected: '1.234567 TOK',
    },
    {
      position: 'at',
      valueBaseUnits: '1234567500000000000000000000000',
      expected: '1.234568 TOK',
    },
    {
      position: 'just above',
      valueBaseUnits: '1234567500000000000000000000001',
      expected: '1.234568 TOK',
    },
  ])(
    'rounds an exact long fee decimal $position a six-place tie',
    ({ valueBaseUnits, expected }) => {
      expect(formatFeePreview(valueBaseUnits, 30, 'TOK', 6)).toBe(
        expected,
      );
    },
  );

  // Dividing by 10^30 and multiplying by 5 gives 12.5 - 5 * 10^-30,
  // 12.5, and 12.5 + 5 * 10^-30. Integer half-up gives 12 below
  // the tie and 13 at or above it.
  it.each([
    {
      position: 'just below',
      balanceBaseUnits: '2499999999999999999999999999999',
      expected: 12,
    },
    {
      position: 'at',
      balanceBaseUnits: '2500000000000000000000000000000',
      expected: 13,
    },
    {
      position: 'just above',
      balanceBaseUnits: '2500000000000000000000000000001',
      expected: 13,
    },
  ])(
    'rounds exact long fiat arithmetic $position an integer tie',
    ({ balanceBaseUnits, expected }) => {
      expect(fiatMinorUnits(balanceBaseUnits, 30, '5')).toBe(expected);
    },
  );

  it('preserves a fee rounding carry across the safe-integer boundary', () => {
    // 90071992547409919999995 / 10^7 = 9007199254740991.9999995.
    // Six-place half-up carries to 9007199254740992.000000.
    // A fee preview remains an exact string beyond MAX_SAFE_INTEGER.
    expect(
      formatFeePreview('90071992547409919999995', 7, 'TOK'),
    ).toBe('9007199254740992 TOK');
  });

  // 123456789 / 10^8 = 1.23456789: hand rounding gives 1.235
  // at three places and 1.2346 at four; all eight places are exact.
  // Currency symbols here are display labels for synthetic amounts.
  it.each([
    {
      symbol: 'KWD',
      displayDecimals: 3,
      expected: '1.235 KWD',
    },
    {
      symbol: 'CLF',
      displayDecimals: 4,
      expected: '1.2346 CLF',
    },
    {
      symbol: 'BTC',
      displayDecimals: 8,
      expected: '1.23456789 BTC',
    },
  ])(
    'supports the $displayDecimals-decimal currency display scale for $symbol',
    ({ symbol, displayDecimals, expected }) => {
      expect(
        formatFeePreview('123456789', 8, symbol, displayDecimals),
      ).toBe(expected);
    },
  );
});

describe('money seeded BigInt oracle (synthetic inputs only)', () => {
  // No wallet state or real balances: all inputs are synthetic decimal strings.
  // Expected values use only decimal-string parsing and exact BigInt arithmetic.
  const seed = 0xba7a2025;
  const caseCount = 256;
  const maxSafeMinorUnits = BigInt(Number.MAX_SAFE_INTEGER);
  const chainScales = [
    0, 1, 2, 3, 4, 6, 8, 9, 12, 18, 20, 30, 36, 100,
  ] as const;
  const displayScales = [
    0, 1, 2, 3, 4, 6, 8, 12, 18, 30, 100,
  ] as const;

  type Random = () => number;

  function mulberry32(initialSeed: number): Random {
    let state = initialSeed >>> 0;

    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
  }

  function randomDigits(random: Random, length: number): string {
    let result = '';
    for (let index = 0; index < length; index += 1) {
      result += Math.floor(random() * 10).toString();
    }
    return result;
  }

  function randomDecimalString(random: Random, maxDigits: number): string {
    return randomDigits(random, 1 + Math.floor(random() * maxDigits));
  }

  function unsignedInteger(value: string): bigint {
    if (!/^[0-9]+$/.test(value)) {
      throw new Error(`Invalid oracle integer input: ${JSON.stringify(value)}`);
    }
    return BigInt(value);
  }

  function tenTo(decimals: number): bigint {
    return 10n ** BigInt(decimals);
  }

  function roundHalfAwayFromZero(
    numerator: bigint,
    denominator: bigint,
  ): bigint {
    // All generated amounts are non-negative, so ties away from zero round up.
    if (numerator < 0n || denominator <= 0n) {
      throw new Error(`Invalid oracle rounding input: ${numerator}/${denominator}`);
    }

    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    return quotient + (remainder * 2n >= denominator ? 1n : 0n);
  }

  function formatAtScale(units: bigint, decimals: number): string {
    if (decimals === 0) {
      return units.toString();
    }

    const digits = units.toString().padStart(decimals + 1, '0');
    const whole = digits.slice(0, -decimals);
    const fraction = digits.slice(-decimals).replace(/0+$/, '');
    return fraction === '' ? whole : `${whole}.${fraction}`;
  }

  function parseAtScale(value: string, decimals: number): bigint {
    const match = /^([0-9]+)(?:\.([0-9]+))?$/.exec(value);
    const fraction = match?.[2] ?? '';

    if (!match || fraction.length > decimals) {
      throw new Error(
        `Invalid oracle decimal input: ${JSON.stringify({ value, decimals })}`,
      );
    }

    return unsignedInteger(`${match[1]}${fraction.padEnd(decimals, '0')}`);
  }

  function fiatReference(
    balanceBaseUnits: string,
    chainDecimals: number,
    priceMinorUnitsPerWhole: string,
  ): bigint {
    return roundHalfAwayFromZero(
      unsignedInteger(balanceBaseUnits) *
        unsignedInteger(priceMinorUnitsPerWhole),
      tenTo(chainDecimals),
    );
  }

  function feeReference(
    valueBaseUnits: string,
    chainDecimals: number,
    symbol: string,
    displayDecimals: number,
  ): string {
    const rounded = roundHalfAwayFromZero(
      unsignedInteger(valueBaseUnits) * tenTo(displayDecimals),
      tenTo(chainDecimals),
    );
    return `${formatAtScale(rounded, displayDecimals)} ${symbol}`;
  }

  function usdReference(minorUnits: bigint): string {
    const dollars = (minorUnits / 100n)
      .toString()
      .replace(/\B(?=([0-9]{3})+(?![0-9]))/g, ',');
    const cents = (minorUnits % 100n).toString().padStart(2, '0');
    return `$${dollars}.${cents}`;
  }

  function sumReference(values: readonly number[]): bigint {
    return values.reduce(
      (total, value) => total + unsignedInteger(value.toString()),
      0n,
    );
  }

  function parseUSD(value: string): bigint {
    return parseAtScale(value.replace(/^\$/, '').replace(/,/g, ''), 2);
  }

  function generateCase(random: Random, index: number) {
    // Cycling guarantees coverage of every selected chain/display scale pair.
    // Powers of ten and input lengths remain bounded, including display 100.
    const chainDecimals = chainScales[index % chainScales.length]!;
    const displayDecimals =
      displayScales[
        Math.floor(index / chainScales.length) % displayScales.length
      ]!;
    const scale = tenTo(chainDecimals);
    const mode = index % 5;

    let feeValue =
      index % 17 === 0 ? '0' : randomDecimalString(random, 128);

    // Exercise long values immediately below, at, and above display ties.
    if (
      index % 17 !== 0 &&
      chainDecimals > displayDecimals &&
      mode < 3
    ) {
      const discardedScale = tenTo(chainDecimals - displayDecimals);
      const half = discardedScale / 2n;
      const remainder =
        mode === 0 ? half - 1n : mode === 1 ? half : half + 1n;
      feeValue = (
        unsignedInteger(randomDecimalString(random, 24)) * discardedScale +
        remainder
      ).toString();
    }

    const whole = unsignedInteger(randomDecimalString(random, 9));
    let fraction =
      chainDecimals === 0
        ? 0n
        : unsignedInteger(randomDigits(random, chainDecimals));
    let price =
      index % 19 === 0
        ? 0n
        : unsignedInteger(randomDecimalString(random, 6));

    // An odd price times a half-whole fractional balance gives an exact tie.
    if (chainDecimals > 0 && mode < 3 && price !== 0n) {
      const half = scale / 2n;
      fraction = mode === 0 ? half - 1n : mode === 1 ? half : half + 1n;
      if (price % 2n === 0n) {
        price += 1n;
      }
    }

    // Nine whole digits and six price digits keep these fiat results and
    // their larger neighbours safe, despite potentially long base-unit strings.
    const balance = index % 23 === 0 ? 0n : whole * scale + fraction;
    const balanceIncrement =
      1n +
      (chainDecimals === 0
        ? 0n
        : unsignedInteger(randomDigits(random, chainDecimals)));
    const incrementMinorUnits =
      Number(unsignedInteger(randomDecimalString(random, 9))) + 1;

    // At most five fifteen-digit entries, plus the increment, stay safely
    // below MAX_SAFE_INTEGER. Empty and singleton lists are generated too.
    const minorUnitsList = Array.from({ length: index % 6 }, () =>
      Number(unsignedInteger(randomDecimalString(random, 15))),
    );

    return {
      chainDecimals,
      displayDecimals,
      symbol: 'TOK',
      valueBaseUnits: '0'.repeat(index % 3) + feeValue,
      largerValueBaseUnits: (
        unsignedInteger(feeValue) +
        unsignedInteger(randomDecimalString(random, 24)) +
        1n
      ).toString(),
      balanceBaseUnits: '0'.repeat(index % 3) + balance.toString(),
      largerBalanceBaseUnits: (balance + balanceIncrement).toString(),
      priceMinorUnitsPerWhole: '0'.repeat(index % 2) + price.toString(),
      largerPriceMinorUnitsPerWhole: (price + 1n).toString(),
      incrementMinorUnits,
      minorUnitsList,
    };
  }

  it('agrees exactly with the seeded oracle and is idempotent and monotone', () => {
    // Four fee, six fiat, four USD, and four sum assertions per case.
    expect.assertions(caseCount * 18);

    const random = mulberry32(seed);

    for (let index = 0; index < caseCount; index += 1) {
      const input = generateCase(random, index);
      const { chainDecimals, displayDecimals, symbol } = input;
      const context =
        `seed=0x${seed.toString(16)}; case=${index}; ` +
        `input=${JSON.stringify(input)}`;
      const suffix = ` ${symbol}`;

      const fee = formatFeePreview(
        input.valueBaseUnits,
        chainDecimals,
        symbol,
        displayDecimals,
      );
      expect(fee, `${context}; fee oracle agreement`).toBe(
        feeReference(
          input.valueBaseUnits,
          chainDecimals,
          symbol,
          displayDecimals,
        ),
      );

      const largerFee = formatFeePreview(
        input.largerValueBaseUnits,
        chainDecimals,
        symbol,
        displayDecimals,
      );
      expect(largerFee, `${context}; larger fee oracle agreement`).toBe(
        feeReference(
          input.largerValueBaseUnits,
          chainDecimals,
          symbol,
          displayDecimals,
        ),
      );

      const roundedFee = parseAtScale(
        fee.slice(0, -suffix.length),
        displayDecimals,
      );
      expect(
        formatFeePreview(
          roundedFee.toString(),
          displayDecimals,
          symbol,
          displayDecimals,
        ),
        `${context}; fee idempotence input: valueBaseUnits=${roundedFee}, ` +
          `decimals=${displayDecimals}, displayDecimals=${displayDecimals}`,
      ).toBe(fee);

      expect(
        parseAtScale(largerFee.slice(0, -suffix.length), displayDecimals),
        `${context}; fee monotonicity`,
      ).toBeGreaterThanOrEqual(roundedFee);

      const expectedFiat = fiatReference(
        input.balanceBaseUnits,
        chainDecimals,
        input.priceMinorUnitsPerWhole,
      );
      const fiat = fiatMinorUnits(
        input.balanceBaseUnits,
        chainDecimals,
        input.priceMinorUnitsPerWhole,
      );
      expect(fiat, `${context}; fiat oracle agreement`).toBe(
        Number(expectedFiat),
      );

      const expectedLargerBalance = fiatReference(
        input.largerBalanceBaseUnits,
        chainDecimals,
        input.priceMinorUnitsPerWhole,
      );
      const largerBalanceFiat = fiatMinorUnits(
        input.largerBalanceBaseUnits,
        chainDecimals,
        input.priceMinorUnitsPerWhole,
      );
      expect(
        largerBalanceFiat,
        `${context}; larger balance fiat oracle agreement`,
      ).toBe(Number(expectedLargerBalance));

      const expectedLargerPrice = fiatReference(
        input.balanceBaseUnits,
        chainDecimals,
        input.largerPriceMinorUnitsPerWhole,
      );
      const largerPriceFiat = fiatMinorUnits(
        input.balanceBaseUnits,
        chainDecimals,
        input.largerPriceMinorUnitsPerWhole,
      );
      expect(
        largerPriceFiat,
        `${context}; larger price fiat oracle agreement`,
      ).toBe(Number(expectedLargerPrice));

      // Re-embed the rounded integer at the original chain scale with price 1.
      // This repeats integer rounding, rather than converting currency twice.
      const roundedBalanceBaseUnits = (
        unsignedInteger(fiat.toString()) * tenTo(chainDecimals)
      ).toString();
      expect(
        fiatMinorUnits(roundedBalanceBaseUnits, chainDecimals, '1'),
        `${context}; fiat idempotence input: ` +
          `balanceBaseUnits=${roundedBalanceBaseUnits}, ` +
          `chainDecimals=${chainDecimals}, priceMinorUnitsPerWhole=1`,
      ).toBe(fiat);

      expect(
        largerBalanceFiat,
        `${context}; fiat balance monotonicity`,
      ).toBeGreaterThanOrEqual(fiat);
      expect(
        largerPriceFiat,
        `${context}; fiat price monotonicity`,
      ).toBeGreaterThanOrEqual(fiat);

      // USD inputs come from the independent oracle, not the helper's output.
      const minorUnits = Number(expectedFiat);
      const largerMinorUnits = minorUnits + input.incrementMinorUnits;
      const usdContext =
        `${context}; USD input: minorUnits=${minorUnits}, ` +
        `largerMinorUnits=${largerMinorUnits}`;
      const usd = formatFiatUSD(minorUnits);
      const largerUSD = formatFiatUSD(largerMinorUnits);

      expect(usd, `${usdContext}; USD oracle agreement`).toBe(
        usdReference(expectedFiat),
      );
      expect(largerUSD, `${usdContext}; larger USD oracle agreement`).toBe(
        usdReference(
          expectedFiat + unsignedInteger(input.incrementMinorUnits.toString()),
        ),
      );

      const roundedUSD = parseUSD(usd);
      expect(
        formatFiatUSD(Number(roundedUSD)),
        `${usdContext}; USD idempotence input: minorUnits=${roundedUSD}`,
      ).toBe(usd);
      expect(
        parseUSD(largerUSD),
        `${usdContext}; USD monotonicity`,
      ).toBeGreaterThanOrEqual(roundedUSD);

      const values = [...input.minorUnitsList];
      const largerValues = [...values, input.incrementMinorUnits];
      const expectedSum = sumReference(values);
      const expectedLargerSum = sumReference(largerValues);
      const sumContext =
        `${context}; sum input=${JSON.stringify({ values, largerValues })}`;
      const sum = sumFiatUSD(values);
      const largerSum = sumFiatUSD(largerValues);

      expect(sum, `${sumContext}; sum oracle agreement`).toBe(
        usdReference(expectedSum),
      );
      expect(largerSum, `${sumContext}; larger sum oracle agreement`).toBe(
        usdReference(expectedLargerSum),
      );

      const roundedSum = parseUSD(sum);
      expect(
        sumFiatUSD([Number(roundedSum)]),
        `${sumContext}; sum idempotence input: minorUnitsList=[${roundedSum}]`,
      ).toBe(sum);
      expect(
        parseUSD(largerSum),
        `${sumContext}; sum monotonicity`,
      ).toBeGreaterThanOrEqual(roundedSum);
    }
  });

  it('matches safe-boundary rounding and rejects fiat overflow across scales', () => {
    const boundaryCases: Array<{
      balanceBaseUnits: string;
      chainDecimals: number;
      priceMinorUnitsPerWhole: string;
    }> = [];

    for (const chainDecimals of chainScales) {
      const scale = tenTo(chainDecimals);

      // Exactly one minor unit below, at, and above the safe boundary.
      // Exercise the large operand as both the balance and the price.
      for (const target of [
        maxSafeMinorUnits - 1n,
        maxSafeMinorUnits,
        maxSafeMinorUnits + 1n,
      ]) {
        boundaryCases.push({
          balanceBaseUnits: (target * scale).toString(),
          chainDecimals,
          priceMinorUnitsPerWhole: '1',
        });
        boundaryCases.push({
          balanceBaseUnits: scale.toString(),
          chainDecimals,
          priceMinorUnitsPerWhole: target.toString(),
        });
      }

      if (chainDecimals > 0) {
        // The rounding-overflow threshold is MAX_SAFE_INTEGER + 0.5.
        // These differ by one base unit, even at the longest selected scale.
        const tie = maxSafeMinorUnits * scale + scale / 2n;
        for (const balance of [tie - 1n, tie, tie + 1n]) {
          boundaryCases.push({
            balanceBaseUnits: balance.toString(),
            chainDecimals,
            priceMinorUnitsPerWhole: '1',
          });
        }
      }
    }

    // The deterministic table has two assertions per entry, in either branch.
    expect.assertions(boundaryCases.length * 2);

    for (const input of boundaryCases) {
      const expected = fiatReference(
        input.balanceBaseUnits,
        input.chainDecimals,
        input.priceMinorUnitsPerWhole,
      );
      const context =
        `targeted safe-boundary input=${JSON.stringify(input)}; ` +
        `referenceMinorUnits=${expected}`;

      if (expected <= maxSafeMinorUnits) {
        expect(
          fiatMinorUnits(
            input.balanceBaseUnits,
            input.chainDecimals,
            input.priceMinorUnitsPerWhole,
          ),
          `${context}; safe fiat oracle agreement`,
        ).toBe(Number(expected));
      } else {
        expect(
          () =>
            fiatMinorUnits(
              input.balanceBaseUnits,
              input.chainDecimals,
              input.priceMinorUnitsPerWhole,
            ),
          `${context}; fiat overflow rejection`,
        ).toThrow(/safe.*integer/);
      }

      // The same rational amount remains an exact fee display string:
      // fee previews must not inherit the numeric fiat safe-integer limit.
      const feeBaseUnits = (
        unsignedInteger(input.balanceBaseUnits) *
        unsignedInteger(input.priceMinorUnitsPerWhole)
      ).toString();
      expect(
        formatFeePreview(feeBaseUnits, input.chainDecimals, 'TOK', 0),
        `${context}; fee input: valueBaseUnits=${feeBaseUnits}, ` +
          `decimals=${input.chainDecimals}, symbol=TOK, displayDecimals=0`,
      ).toBe(feeReference(feeBaseUnits, input.chainDecimals, 'TOK', 0));
    }
  });

  it('matches USD and sum boundary references and rejects unsafe minor units', () => {
    const targets = [
      maxSafeMinorUnits - 1n,
      maxSafeMinorUnits,
      maxSafeMinorUnits + 1n,
    ];

    expect.assertions(targets.length * 2);

    for (const target of targets) {
      // MAX_SAFE_INTEGER + 1 is exactly representable, but is not safe.
      const minorUnits = Number(target);
      // Every entry is individually safe, including the overflowing total.
      const values = [
        Number(maxSafeMinorUnits - 1n),
        Number(target - (maxSafeMinorUnits - 1n)),
      ];
      const expectedSum = sumReference(values);
      const context =
        `targeted USD/sum input=${JSON.stringify({
          minorUnitsString: target.toString(),
          minorUnits,
          minorUnitsList: values,
        })}`;

      if (target <= maxSafeMinorUnits) {
        expect(
          formatFiatUSD(minorUnits),
          `${context}; USD boundary oracle agreement`,
        ).toBe(usdReference(target));
        expect(
          sumFiatUSD(values),
          `${context}; sum boundary oracle agreement`,
        ).toBe(usdReference(expectedSum));
      } else {
        expect(
          () => formatFiatUSD(minorUnits),
          `${context}; USD overflow rejection`,
        ).toThrow(/safe.*integer/);
        expect(
          () => sumFiatUSD(values),
          `${context}; sum overflow rejection with individually safe entries`,
        ).toThrow(/safe.*integer/);
      }
    }
  });
});
