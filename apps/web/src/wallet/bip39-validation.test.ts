// apps/web/src/wallet/bip39-validation.test.ts
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { describe, expect, it } from 'vitest';
import {
  bip39SeedHex,
  generateBip39Mnemonic,
  validateBip39Mnemonic,
} from './bip39-validation';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const INVALID_MNEMONIC = 'not a real mnemonic phrase at all';

describe('BIP39 validation helpers', () => {
  it('validates the published BIP39 test phrase', () => {
    expect(validateBip39Mnemonic(TEST_MNEMONIC)).toBe(true);
  });

  it('rejects an invalid mnemonic', () => {
    expect(validateBip39Mnemonic(INVALID_MNEMONIC)).toBe(false);
  });

  it('generates a valid 24-word English mnemonic at 256 bits', () => {
    const mnemonic = generateBip39Mnemonic(256);
    const words = mnemonic.split(' ');

    expect(words).toHaveLength(24);
    expect(words.every((word) => wordlist.includes(word))).toBe(true);
    expect(validateBip39Mnemonic(mnemonic)).toBe(true);
  });

  it('generates a valid 12-word mnemonic at 128 bits', () => {
    const mnemonic = generateBip39Mnemonic(128);

    expect(mnemonic.split(' ')).toHaveLength(12);
    expect(validateBip39Mnemonic(mnemonic)).toBe(true);
  });

  it('derives deterministic 128-character hex seeds and honors passphrases', () => {
    const seed = bip39SeedHex(TEST_MNEMONIC);

    expect(seed).toMatch(/^[0-9a-f]{128}$/);
    expect(bip39SeedHex(TEST_MNEMONIC)).toBe(seed);
    expect(bip39SeedHex(TEST_MNEMONIC, 'TREZOR')).not.toBe(seed);
  });

  it('throws on an invalid mnemonic when deriving a seed', () => {
    expect(() => bip39SeedHex(INVALID_MNEMONIC)).toThrow(
      new Error('Invalid mnemonic.'),
    );
  });
});
