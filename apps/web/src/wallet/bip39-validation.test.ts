import { describe, expect, it } from 'vitest';
import {
  BIP39_PBKDF2_ROUNDS,
  bip39SeedHex,
  generateBip39Mnemonic,
  splitMnemonicAndPassphrase,
  validateBip39Mnemonic,
} from './bip39-validation';

// Public TREZOR zero-entropy vectors (12/18/24 words), plus deterministic
// zero-entropy supplements (15/21) verified by scure/bitcoinjs agreement.
// These are test fixtures only, never real wallet mnemonics.
const VALID_MNEMONICS = [
  { wordCount: 12, mnemonic: `${'abandon '.repeat(11)}about` },
  { wordCount: 15, mnemonic: `${'abandon '.repeat(14)}address` },
  { wordCount: 18, mnemonic: `${'abandon '.repeat(17)}agent` },
  { wordCount: 21, mnemonic: `${'abandon '.repeat(20)}admit` },
  { wordCount: 24, mnemonic: `${'abandon '.repeat(23)}art` },
] as const;

const MNEMONIC_12 = VALID_MNEMONICS[0].mnemonic;
const MNEMONIC_24 = VALID_MNEMONICS[4].mnemonic;
const BAD_CHECKSUM_MNEMONIC = `${'abandon '.repeat(11)}abandon`;

// Each fixture isolates one failure: checksum, dictionary membership, or count.
const INVALID_MNEMONICS = [
  {
    reason: 'a bad checksum with 12 known words',
    wordCount: 12,
    mnemonic: BAD_CHECKSUM_MNEMONIC,
  },
  {
    reason: 'a single unknown word at a valid word count',
    wordCount: 12,
    mnemonic: MNEMONIC_12.replace('about', 'notaword'),
  },
  {
    reason: '13 words, all in the wordlist',
    wordCount: 13,
    mnemonic: `${MNEMONIC_12} abandon`,
  },
] as const;

const LONE_SURROGATES = [
  { label: 'U+D800', value: '\uD800' },
  { label: 'U+DC00', value: '\uDC00' },
] as const;

const TREZOR_SEED_HEX =
  'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04';

const CAFE_SEED_HEX =
  'af8bbd2566df7b69d926f2b09dfdbd75db6c994a3399b2cc65f928d63e3fd4e61218ee0d15f8c810be4d45e66d47b43c15a5cc753976b1666912377ff7ae9818';

describe('validateBip39Mnemonic', () => {
  it.each(VALID_MNEMONICS)(
    'accepts the $wordCount-word vector',
    ({ wordCount, mnemonic }) => {
      expect.assertions(2);
      expect(mnemonic.split(' ')).toHaveLength(wordCount);
      expect(validateBip39Mnemonic(mnemonic)).toBe(true);
    },
  );

  it.each(INVALID_MNEMONICS)(
    'rejects $reason',
    ({ wordCount, mnemonic }) => {
      expect.assertions(2);
      expect(mnemonic.split(' ')).toHaveLength(wordCount);
      expect(validateBip39Mnemonic(mnemonic)).toBe(false);
    },
  );

  it.each(LONE_SURROGATES)(
    'returns false for a mnemonic containing $label',
    ({ value }) => {
      expect.assertions(1);
      const mnemonic = MNEMONIC_12.replace('about', `abo${value}ut`);
      expect(validateBip39Mnemonic(mnemonic)).toBe(false);
    },
  );
});

describe('bip39SeedHex', () => {
  it('exports the fixed BIP-39 compatibility iteration count', () => {
    expect.assertions(1);
    expect(BIP39_PBKDF2_ROUNDS).toBe(2048);
  });

  it('matches the public TREZOR seed vector deterministically', () => {
    expect.assertions(2);
    const seedHex = bip39SeedHex(MNEMONIC_12, 'TREZOR');
    expect(seedHex).toBe(TREZOR_SEED_HEX);
    expect(bip39SeedHex(MNEMONIC_12, 'TREZOR')).toBe(seedHex);
  });

  it('returns 128 hex characters and defaults to an empty passphrase', () => {
    expect.assertions(3);
    const seedHex = bip39SeedHex(MNEMONIC_12);
    expect(seedHex).toMatch(/^[0-9a-f]{128}$/);
    expect(seedHex).toBe(bip39SeedHex(MNEMONIC_12, ''));
    expect(seedHex).not.toBe(TREZOR_SEED_HEX);
  });

  it.each([
    { form: 'NFC', passphrase: 'caf\u00E9' },
    { form: 'NFD', passphrase: 'cafe\u0301' },
    { form: 'NFKC', passphrase: 'caf\u00E9'.normalize('NFKC') },
  ] as const)(
    'derives the same NFKD seed from the $form café passphrase',
    ({ passphrase }) => {
      expect.assertions(1);
      expect(bip39SeedHex(MNEMONIC_12, passphrase)).toBe(CAFE_SEED_HEX);
    },
  );

  it.each(INVALID_MNEMONICS)(
    'throws an Error with the wrapper message for $reason',
    ({ mnemonic }) => {
      expect.assertions(2);
      try {
        bip39SeedHex(mnemonic);
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
          expect(error.message).toBe('Invalid mnemonic.');
        }
      }
    },
  );

  it.each(LONE_SURROGATES)(
    'throws TypeError for a lone-surrogate $label passphrase',
    ({ value }) => {
      expect.assertions(2);
      try {
        bip39SeedHex(MNEMONIC_12, value);
      } catch (error) {
        expect(error instanceof TypeError).toBe(true);
        if (error instanceof Error) {
          expect(error.message).toBe('expected well-formed Unicode string');
        }
      }
    },
  );

  it.each(LONE_SURROGATES)(
    'validates before derivation with a $label passphrase',
    ({ value }) => {
      expect.assertions(3);
      // This passphrase would throw TypeError if mnemonicToSeedSync were reached.
      // The invalid-mnemonic Error must take precedence.
      try {
        bip39SeedHex(BAD_CHECKSUM_MNEMONIC, value);
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect(error instanceof TypeError).toBe(false);
        if (error instanceof Error) {
          expect(error.message).toBe('Invalid mnemonic.');
        }
      }
    },
  );
});

describe('generateBip39Mnemonic', () => {
  // Random output is ephemeral test data, never used for a wallet.
  it.each([
    { name: 'default', strength: undefined, wordCount: 24 },
    { name: '128-bit', strength: 128, wordCount: 12 },
    { name: '256-bit', strength: 256, wordCount: 24 },
  ] as const)(
    'generates a valid phrase without supplied entropy at $name strength',
    ({ strength, wordCount }) => {
      expect.assertions(2);
      const mnemonic =
        strength === undefined
          ? generateBip39Mnemonic()
          : generateBip39Mnemonic(strength);
      expect(mnemonic.split(' ')).toHaveLength(wordCount);
      expect(validateBip39Mnemonic(mnemonic)).toBe(true);
    },
  );

  it.each([
    {
      name: '128-bit',
      strength: 128,
      byteLength: 16,
      expectedMnemonic: MNEMONIC_12,
    },
    {
      name: '256-bit',
      strength: 256,
      byteLength: 32,
      expectedMnemonic: MNEMONIC_24,
    },
    {
      name: 'default',
      strength: undefined,
      byteLength: 32,
      expectedMnemonic: MNEMONIC_24,
    },
  ] as const)(
    'reproduces the zero-entropy vector at $name strength',
    ({ strength, byteLength, expectedMnemonic }) => {
      expect.assertions(2);
      const mnemonic = generateBip39Mnemonic(
        strength,
        new Uint8Array(byteLength),
      );
      expect(mnemonic).toBe(expectedMnemonic);
      expect(validateBip39Mnemonic(mnemonic)).toBe(true);
    },
  );

  it.each([
    { name: '128-bit with 32 bytes', strength: 128, byteLength: 32 },
    { name: '256-bit with 16 bytes', strength: 256, byteLength: 16 },
    { name: 'default with 16 bytes', strength: undefined, byteLength: 16 },
  ] as const)(
    'throws Error for mismatched entropy: $name',
    ({ strength, byteLength }) => {
      expect.assertions(1);
      expect(() =>
        generateBip39Mnemonic(strength, new Uint8Array(byteLength)),
      ).toThrow(Error);
    },
  );
});

describe('splitMnemonicAndPassphrase', () => {
  // Lane C, item 5: one import field takes a 12/15/18/21/24-word phrase,
  // and the 25-word form (24 words + an extra word as the passphrase) in
  // the same flow — no second section. Anything past 24 words is the
  // passphrase; the longest valid BIP-39 mnemonic wins.
  const FIFTEEN =
    'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
  // Deterministic 24-word vector (fixed entropy, never a real secret).
  const TWENTY_FOUR = generateBip39Mnemonic(
    256,
    Uint8Array.from([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
      20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ]),
  );

  it('accepts a 12-word phrase with no passphrase', () => {
    expect(splitMnemonicAndPassphrase(MNEMONIC_12)).toEqual({
      mnemonic: MNEMONIC_12,
      passphrase: '',
    });
  });

  it('accepts a 15-word phrase with no passphrase', () => {
    expect(splitMnemonicAndPassphrase(FIFTEEN)).toEqual({
      mnemonic: FIFTEEN,
      passphrase: '',
    });
  });

  it('accepts a 24-word phrase with no passphrase', () => {
    expect(splitMnemonicAndPassphrase(TWENTY_FOUR)).toEqual({
      mnemonic: TWENTY_FOUR,
      passphrase: '',
    });
  });

  it('treats the 25th word as the passphrase', () => {
    expect(splitMnemonicAndPassphrase(`${TWENTY_FOUR} TREZOR`)).toEqual({
      mnemonic: TWENTY_FOUR,
      passphrase: 'TREZOR',
    });
  });

  it('treats words past a 12-word mnemonic as the passphrase', () => {
    expect(splitMnemonicAndPassphrase(`${MNEMONIC_12} extra`)).toEqual({
      mnemonic: MNEMONIC_12,
      passphrase: 'extra',
    });
  });

  it('keeps a multi-word passphrase together', () => {
    expect(
      splitMnemonicAndPassphrase(`${TWENTY_FOUR} first second`),
    ).toEqual({
      mnemonic: TWENTY_FOUR,
      passphrase: 'first second',
    });
  });

  it('normalises extra whitespace and newlines', () => {
    expect(
      splitMnemonicAndPassphrase(`  ${MNEMONIC_12.split(' ').join('  \n')}  TREZOR  `),
    ).toEqual({ mnemonic: MNEMONIC_12, passphrase: 'TREZOR' });
  });

  it('rejects too few words', () => {
    expect(() => splitMnemonicAndPassphrase('hello world')).toThrow(
      /12-, 15-, 18-, 21- or 24-word/,
    );
  });

  it('rejects 24 words with a bad checksum', () => {
    expect(() => splitMnemonicAndPassphrase('abandon '.repeat(24).trim())).toThrow(
      /not a valid recovery phrase/,
    );
  });

  it('rejects words that are not in the BIP-39 list', () => {
    expect(() =>
      splitMnemonicAndPassphrase(
        'hello world this is not a valid phrase at all really truly',
      ),
    ).toThrow(/not a valid recovery phrase/);
  });
});
