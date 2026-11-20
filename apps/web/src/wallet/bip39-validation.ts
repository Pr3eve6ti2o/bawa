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
