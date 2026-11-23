// apps/web/src/wallet/bip39-validation.ts
/**
 * Validation / test-vector / docs use ONLY — NOT the production mnemonic engine.
 * Trust Wallet Core WASM (@trustwallet/wallet-core 4.9.3) owns production
 * mnemonic handling. Never log a mnemonic or seed.
 */
import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// BIP-39 compatibility requires 2048 PBKDF2 rounds; this is not a setting.
// @scure/bip39 applies this fixed iteration count internally.
export const BIP39_PBKDF2_ROUNDS = 2048;

export function validateBip39Mnemonic(mnemonic: string): boolean {
  try {
    return validateMnemonic(mnemonic, wordlist);
  } catch {
    return false;
  }
}

export function bip39SeedHex(mnemonic: string, passphrase = ''): string {
  if (!validateBip39Mnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic.');
  }

  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  return Array.from(seed, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateBip39Mnemonic(
  strength: 128 | 256 = 256,
  entropy?: Uint8Array,
): string {
  if (entropy !== undefined) {
    const expectedLength = strength / 8;
    if (entropy.length !== expectedLength) {
      throw new Error(
        `Expected ${expectedLength} bytes of entropy for ${strength}-bit strength.`,
      );
    }
    return entropyToMnemonic(entropy, wordlist);
  }

  return generateMnemonic(wordlist, strength);
}

// Lane C, item 5: one import field takes every recovery-phrase form.
// A 12/15/18/21/24-word phrase is read as-is; anything longer splits at
// the longest valid BIP-39 mnemonic, and the rest is the passphrase —
// so a 25-word paste (24 words + an extra word) works in the same field
// as a 24-word paste, with no second section.
//
// Splitting rule, chosen so a mistyped phrase can never silently restore
// a DIFFERENT wallet: when the total word count is itself a valid
// BIP-39 count (12/15/18/21/24), the whole input must validate as that
// mnemonic — shorter prefixes are never tried. Only a total that is not
// a valid count splits at the longest valid prefix (a 12-word prefix
// passes its 4-bit checksum one time in sixteen, so trying it inside an
// exact-count input could restore the wrong wallet).
export interface SplitMnemonic {
  mnemonic: string;
  passphrase: string;
}

const MNEMONIC_WORD_COUNTS = [24, 21, 18, 15, 12] as const;

export const IMPORT_PHRASE_HINT =
  'Enter a 12-, 15-, 18-, 21- or 24-word recovery phrase, with an extra word if your wallet uses one.';

export function splitMnemonicAndPassphrase(input: string): SplitMnemonic {
  const words = input.trim().split(/\s+/u).filter((word) => word.length > 0);

  if (words.length < 12) {
    throw new Error(
      'Enter a 12-, 15-, 18-, 21- or 24-word recovery phrase.',
    );
  }

  // An exact-count input is a plain mnemonic: it must validate whole.
  if (
    (MNEMONIC_WORD_COUNTS as readonly number[]).includes(words.length)
  ) {
    const candidate = words.join(' ');
    if (validateBip39Mnemonic(candidate)) {
      return { mnemonic: candidate, passphrase: '' };
    }
    throw new Error(
      'That is not a valid recovery phrase. Check every word and try again.',
    );
  }

  // A longer input is a mnemonic plus a passphrase: longest valid
  // mnemonic first, the rest is the passphrase (one word or several).
  for (const count of MNEMONIC_WORD_COUNTS) {
    if (words.length < count) continue;
    const candidate = words.slice(0, count).join(' ');
    if (validateBip39Mnemonic(candidate)) {
      return {
        mnemonic: candidate,
        passphrase: words.slice(count).join(' '),
      };
    }
  }

  throw new Error(
    'That is not a valid recovery phrase. Check every word and try again.',
  );
}
