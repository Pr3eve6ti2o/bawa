import { describe, expect, it } from 'vitest';
import { formatNativeAmount, formatNativeWithSymbol } from './format';

describe('formatNativeAmount', () => {
  it('formats zero', () => {
    expect(formatNativeAmount('0', 8)).toBe('0');
  });

  it('formats one satoshi', () => {
    expect(formatNativeAmount('1', 8)).toBe('0.00000001');
  });

  it('formats one whole unit', () => {
    expect(formatNativeAmount('100000000', 8)).toBe('1');
    expect(formatNativeAmount('1000000000000000000', 18)).toBe('1');
    expect(formatNativeAmount('1000000', 6)).toBe('1');
  });

  it('trims trailing zeros but keeps significant decimals', () => {
    expect(formatNativeAmount('123456789', 8)).toBe('1.23456789');
    expect(formatNativeAmount('1234567890123456789', 18)).toBe(
      '1.234567890123456789',
    );
    expect(formatNativeAmount('150000000', 8)).toBe('1.5');
  });

  it('groups thousands in the integer part', () => {
    expect(formatNativeAmount('12345678900000000', 8)).toBe('123,456,789');
    expect(formatNativeAmount('1234567000000000000000000', 18)).toBe(
      '1,234,567',
    );
  });

  it('throws on non-integer, negative or empty input', () => {
    expect(() => formatNativeAmount('1.5', 8)).toThrow(/integer/);
    expect(() => formatNativeAmount('-1', 8)).toThrow(/integer/);
    expect(() => formatNativeAmount('', 8)).toThrow(/integer/);
    expect(() => formatNativeAmount('abc', 8)).toThrow(/integer/);
  });

  it('appends the symbol', () => {
    expect(formatNativeWithSymbol('150000000', 8, 'BTC')).toBe('1.5 BTC');
  });
});
