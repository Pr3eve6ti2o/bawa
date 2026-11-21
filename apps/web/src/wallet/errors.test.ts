import { describe, expect, it } from 'vitest';
import {
  BawaError,
  ERROR_MESSAGES,
  WalletErrorCodes,
  createWalletError,
  isWalletError,
  toWalletError,
  walletErrorCodeOf,
  type WalletErrorCategory,
  type WalletErrorCode,
} from './errors';

const codes: WalletErrorCode[] = Object.values(WalletErrorCodes);

const categoryRanges: Record<WalletErrorCategory, readonly [number, number]> = {
  vault: [1000, 1100],
  provider: [2000, 2100],
  validation: [3000, 3100],
  confirmation: [4000, 4100],
};

describe('wallet errors', () => {
  it('uses unique integer codes within their category ranges', () => {
    expect(codes.length).toBeGreaterThan(0);
    expect(new Set(codes).size).toBe(codes.length);

    for (const code of codes) {
      expect(Number.isInteger(code)).toBe(true);

      const category = new BawaError(code).category;
      expect(categoryRanges).toHaveProperty(category);

      const [lowerBound, upperBound] = categoryRanges[category];
      expect(code).toBeGreaterThanOrEqual(lowerBound);
      expect(code).toBeLessThan(upperBound);
    }
  });

  it('provides a non-empty message for every code and exact vault messages', () => {
    for (const code of codes) {
      const message = ERROR_MESSAGES[code];

      expect(message).toBeTypeOf('string');
      expect(message.trim()).not.toBe('');
    }

    expect(ERROR_MESSAGES[1001]).toBe('Incorrect password.');
    expect(ERROR_MESSAGES[1002]).toBe('Vault is corrupted.');
  });

  it('constructs BawaError with the expected properties and optional docs', () => {
    for (const code of codes) {
      const error = new BawaError(code);
      const expectedCategory = Object.entries(categoryRanges).find(
        ([, [lowerBound, upperBound]]) =>
          code >= lowerBound && code < upperBound,
      )?.[0];

      expect(expectedCategory).toBeDefined();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BawaError');
      expect(error.code).toBe(code);
      expect(error.message).toBe(ERROR_MESSAGES[code]);
      expect(error.category).toBe(expectedCategory);
      expect(error.context).toEqual({});
      expect(error.docs).toBeUndefined();
    }

    const docs = '/docs/wallet/errors#1001';
    const errorWithDocs = new BawaError(1001, {}, { docs });

    expect(errorWithDocs.docs).toBe(docs);
  });

  it('creates the same error properties as the BawaError constructor', () => {
    const code: WalletErrorCode = 1001;
    const context = { operation: 'unlock' };
    const docs = '/docs/wallet/errors#1001';
    const constructed = new BawaError(code, context, { docs });
    const created = createWalletError(code, context);

    expect(created).toBeInstanceOf(BawaError);
    expect(created.name).toBe(constructed.name);
    expect(created.code).toBe(constructed.code);
    expect(created.message).toBe(constructed.message);
    expect(created.category).toBe(constructed.category);
    expect(created.context).toEqual(constructed.context);
    // createWalletError carries no docs option, so it never sets one.
    expect(created.docs).toBeUndefined();
    expect(constructed.docs).toBe(docs);
  });

  it('recognizes only wallet errors among the supplied values', () => {
    expect(isWalletError(new BawaError(1001))).toBe(true);
    expect(isWalletError(new Error('Incorrect password.'))).toBe(false);
    expect(isWalletError('Incorrect password.')).toBe(false);
    expect(isWalletError(null)).toBe(false);
  });

  it('extracts a wallet error code and returns null for a plain Error', () => {
    const code: WalletErrorCode = 1001;

    expect(walletErrorCodeOf(new BawaError(code))).toBe(code);
    expect(walletErrorCodeOf(new Error('Incorrect password.'))).toBeNull();
  });

  it('preserves wallet error identity and wraps a plain Error with its cause', () => {
    const walletError = new BawaError(1001);
    const fallbackCode: WalletErrorCode = 1002;

    expect(toWalletError(walletError, fallbackCode)).toBe(walletError);

    const original = new Error('Underlying failure.');
    const wrapped = toWalletError(original, fallbackCode);

    expect(wrapped).toBeInstanceOf(BawaError);
    expect(wrapped).not.toBe(original);
    expect(wrapped.code).toBe(fallbackCode);
    expect(wrapped.message).toBe(ERROR_MESSAGES[fallbackCode]);
    expect(wrapped.cause).toBe(original);
  });

  it('uses the message template rather than stringifying code 1001', () => {
    const code: WalletErrorCode = 1001;
    const error = new BawaError(code);

    expect(error.code).toBe(1001);
    expect(error.message).toBe('Incorrect password.');
    expect(error.message).not.toBe(String(code));
  });
});
