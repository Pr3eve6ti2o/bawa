// apps/web/src/wallet/bip39-validation.ts
/**
 * Validation / test-vector / docs use ONLY — NOT the production mnemonic engine.
 * Trust Wallet Core WASM (@trustwallet/wallet-core 4.9.3) owns production
 * mnemonic handling. Never log a mnemonic or seed.
 */
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

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

export function generateBip39Mnemonic(strength: 128 | 256 = 256): string {
  return generateMnemonic(wordlist, strength);
}
