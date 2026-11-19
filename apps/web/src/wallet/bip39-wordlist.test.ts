// apps/web/src/wallet/bip39-wordlist.test.ts
/**
 * Data only — mnemonic-words is the BIP39 English wordlist as JSON, for
 * tests/tooling where a lightweight wordlist is needed without pulling in wallet-core.
 * wallet-core WASM (@trustwallet/wallet-core 4.9.3) owns production mnemonic handling.
 */
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import mnemonicWords from 'mnemonic-words';
import { describe, expect, it } from 'vitest';

import { validateBip39Mnemonic } from './bip39-validation';

describe('mnemonic-words BIP39 English wordlist', () => {
  it('matches the canonical wordlist and expected entries', () => {
    expect(mnemonicWords).toHaveLength(2048);
    expect(mnemonicWords).toEqual(wordlist);
    expect(mnemonicWords[0]).toBe('abandon');

    for (const word of ['about', 'zoo', 'abandon'] as const) {
      expect(mnemonicWords.filter((entry) => entry === word)).toHaveLength(1);
    }
  });

  it('works as a data-only wordlist for @scure generation', () => {
    const mnemonic: string = generateMnemonic([...mnemonicWords], 256);

    expect(mnemonic.split(' ')).toHaveLength(24);
    expect(validateBip39Mnemonic(mnemonic)).toBe(true);
  });
});
