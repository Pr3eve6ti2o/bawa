```ts
// apps/web/src/wallet/bip39-oracle.test.ts
/**
 * Oracle only — bitcoinjs/bip39 is a devDependency for tests.
 * wallet-core WASM (@trustwallet/wallet-core 4.9.3) owns production mnemonic handling.
 * Published test phrases only, never real mnemonics.
 */
import { describe, expect, it } from 'vitest';
import * as bip39 from 'bip39';
import { bip39SeedHex, validateBip39Mnemonic } from './bip39-validation';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const INVALID_MNEMONIC = 'not a real mnemonic phrase at all';

describe('BIP39 test-only oracle agreement', () => {
  it('agrees on valid and invalid mnemonic fixtures', () => {
    expect(bip39.validateMnemonic(TEST_MNEMONIC)).toBe(true);
    expect(validateBip39Mnemonic(TEST_MNEMONIC)).toBe(true);

    expect(bip39.validateMnemonic(INVALID_MNEMONIC)).toBe(false);
    expect(validateBip39Mnemonic(INVALID_MNEMONIC)).toBe(false);
  });

  it('agrees on seeds without a passphrase and with TREZOR', () => {
    expect(bip39.mnemonicToSeedSync(TEST_MNEMONIC).toString('hex')).toBe(
      bip39SeedHex(TEST_MNEMONIC),
    );
    expect(
      bip39.mnemonicToSeedSync(TEST_MNEMONIC, 'TREZOR').toString('hex'),
    ).toBe(bip39SeedHex(TEST_MNEMONIC, 'TREZOR'));
  });

  it('generates a 24-word mnemonic accepted by the scure wrapper', () => {
    const mnemonic = bip39.generateMnemonic(256);

    expect(mnemonic.trim().split(/\s+/)).toHaveLength(24);
    expect(validateBip39Mnemonic(mnemonic)).toBe(true);
  });
});
```