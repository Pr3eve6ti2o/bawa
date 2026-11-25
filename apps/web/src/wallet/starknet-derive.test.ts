import { describe, expect, it } from 'vitest';
import { loadCore } from '../engine/boundary';
import {
  isValidStarknetAddress,
  starknetAddressFromEthKey,
  starknetAddressFromPrivateKey,
  starknetAddressFromPublicKey,
  starknetPrivateKeyFromEthKey,
  starknetPublicKeyFromPrivateKey,
} from './starknet-derive';

// Lane B (OKX js-wallet-sdk, 2026-11-25): Starknet derivation.
// Test vectors are the OKX js-wallet-sdk's own
// (coin-starknet/tests/v3.test.ts): a Stark private key derives its
// public key and its Argent proxy contract address. The abandon-
// mnemonic values below are deterministic outputs of that same
// algorithm (double-derivation + grindKey + Argent proxy); no SDK
// vector covers the mnemonic -> key step itself, so they are pinned
// as regression values, not as SDK vectors.
describe('starknet-derive (Lane B)', () => {
  it('derives the SDK vector stark key and address', () => {
    expect(
      starknetPublicKeyFromPrivateKey(
        '0x0028e2e382f4e68b24154142dece87d03b6214a34834aede41e100848826c16b',
      ),
    ).toBe(
      '0x1a78bff4c0b69619fe061f540c6fd89f8c33a0364970c77334aa558ed7fce55',
    );
    expect(
      starknetAddressFromPrivateKey(
        '49c0722d56d6bac802bdf5c480a17c870d1d18bc4355d8344aa05390eb778280',
      ),
    ).toBe(
      '0x05b0563ae63a7ba9929129f5117bcbcbe552b7cc8cf81c806d343e2de7f3d555',
    );
    expect(
      starknetAddressFromPrivateKey(
        '0x0028e2e382f4e68b24154142dece87d03b6214a34834aede41e100848826c16b',
      ),
    ).toBe(
      '0x027854ed5aa9f534c7aa0165c89b3915bc461f70e64ce9d64f4e2549037ebcf2',
    );
  });

  it('derives the pinned address from the Wallet Core ETH key (abandon mnemonic)', async () => {
    const core = await loadCore();
    const wallet = core.HDWallet.createWithMnemonic(
      'abandon '.repeat(11) + 'about',
      '',
    );
    expect(wallet).not.toBeNull();
    try {
      const key = wallet.getKey(core.CoinType.ethereum, "m/44'/60'/0'/0/0");
      try {
        const bytes = key.data();
        try {
          expect(starknetPrivateKeyFromEthKey(bytes, 0, 0)).toBe(
            '0x18a556cbd949d1e6d25ed391bf032559fb6055f321c3e02714f7a6268bff3d1',
          );
          expect(starknetAddressFromEthKey(bytes, 0, 0)).toBe(
            '0x036d5a79899430e71529a201899de2ba628fa576e7c56de933d9fda68dacfdb4',
          );
          // Index 1 is a different address on the same account.
          expect(starknetAddressFromEthKey(bytes, 0, 1)).toBe(
            '0x006bdb8b02bdb47c866bfff6462ffd3d73bab079f7d0c12fe7e5f967bf89be73',
          );
          // Account 1 is a different address again.
          const account1 = starknetAddressFromEthKey(bytes, 1, 0);
          expect(account1).not.toBe(starknetAddressFromEthKey(bytes, 0, 0));
          expect(isValidStarknetAddress(account1)).toBe(true);
        } finally {
          bytes.fill(0);
        }
      } finally {
        key.delete();
      }
    } finally {
      wallet.delete();
    }
  });

  it('validates Starknet addresses the way the SDK does', () => {
    expect(
      isValidStarknetAddress(
        '0x036d5a79899430e71529a201899de2ba628fa576e7c56de933d9fda68dacfdb4',
      ),
    ).toBe(true);
    expect(
      isValidStarknetAddress(
        '0x05b0563ae63a7ba9929129f5117bcbcbe552b7cc8cf81c806d343e2de7f3d555',
      ),
    ).toBe(true);
    // No 0x prefix, non-hex, too short, and above the address bound.
    expect(
      isValidStarknetAddress(
        '036d5a79899430e71529a201899de2ba628fa576e7c56de933d9fda68dacfdb4',
      ),
    ).toBe(false);
    expect(
      isValidStarknetAddress(
        '0x036d5a79899430e71529a201899de2ba628fa576e7c56de933d9fda68dacfdbg',
      ),
    ).toBe(false);
    expect(isValidStarknetAddress('0x1234')).toBe(false);
    expect(
      isValidStarknetAddress(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ),
    ).toBe(false);
    expect(isValidStarknetAddress('')).toBe(false);
  });

  it('builds an address from a public key the same way as from its private key', () => {
    const privateKey =
      '0x0028e2e382f4e68b24154142dece87d03b6214a34834aede41e100848826c16b';
    expect(
      starknetAddressFromPublicKey(
        starknetPublicKeyFromPrivateKey(privateKey),
      ),
    ).toBe(starknetAddressFromPrivateKey(privateKey));
  });
});
