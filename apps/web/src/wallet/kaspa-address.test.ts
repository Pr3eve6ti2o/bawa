import { describe, expect, it } from 'vitest';
import { loadCore } from '../engine/boundary';
import {
  isValidKaspaAddress,
  kaspaAddressFromCompressedPubkey,
  kaspaAddressFromXOnlyPubkey,
} from './kaspa-address';

// Lane B (OKX js-wallet-sdk, 2026-11-25): Kaspa CashAddr encoding.
// Test vectors are the OKX js-wallet-sdk's own
// (coin-kaspa/tests/kaspa.test.ts): mnemonic 'reopen vivid parent
// want raw main filter rotate earth true fossil dream', private key
// d636a23d4f49fe4e0d59fcf7a6c2ab3846ff2d3a54007b3817a11dff770d06ff
// at m/44'/111111'/0'/0/0, address
// kaspa:qqpet37fwqlql7q4jczr7zj7qp5ylps2r2c0ynz6jjf368sdjnztufeghvc9x.
// The X-only public key below is that key's X coordinate (verified
// first-hand: the compressed pubkey is 02 + this 32-byte X).
const X_ONLY_PUBKEY_HEX =
  '0395c7c9703e0ff81596043f0a5e00684f860a1ab0f24c5a94931d1e0d94c4be';
const SDK_ADDRESS =
  'kaspa:qqpet37fwqlql7q4jczr7zj7qp5ylps2r2c0ynz6jjf368sdjnztufeghvc9x';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('kaspa-address (Lane B)', () => {
  it('encodes the SDK vector address from the X-only pubkey', () => {
    expect(kaspaAddressFromXOnlyPubkey(hexToBytes(X_ONLY_PUBKEY_HEX))).toBe(
      SDK_ADDRESS,
    );
  });

  it('encodes the SDK vector address from the Wallet Core compressed pubkey', async () => {
    const core = await loadCore();
    const wallet = core.HDWallet.createWithMnemonic(
      'reopen vivid parent want raw main filter rotate earth true fossil dream',
      '',
    );
    expect(wallet).not.toBeNull();
    try {
      const key = wallet.getKey(
        core.CoinType.ethereum,
        "m/44'/111111'/0'/0/0",
      );
      try {
        const compressed = key.getPublicKeySecp256k1(true);
        try {
          const bytes = compressed.data();
          try {
            expect(kaspaAddressFromCompressedPubkey(bytes)).toBe(SDK_ADDRESS);
          } finally {
            bytes.fill(0);
          }
        } finally {
          compressed.delete();
        }
      } finally {
        key.delete();
      }
    } finally {
      wallet.delete();
    }
  });

  it('validates Kaspa addresses by checksum, not shape alone', () => {
    expect(isValidKaspaAddress(SDK_ADDRESS)).toBe(true);
    // One payload character changed: the checksum must fail.
    expect(
      isValidKaspaAddress(
        'kaspa:qqpet37fwqlql7q4jczr7zj7qp5ylps2r2c0ynz6jjf368sdjnztufeghvc9y',
      ),
    ).toBe(false);
    expect(isValidKaspaAddress('kaspa:invalid')).toBe(false);
    expect(isValidKaspaAddress('')).toBe(false);
    // A mainnet address without the kaspa: prefix is not accepted.
    expect(
      isValidKaspaAddress(
        'qqpet37fwqlql7q4jczr7zj7qp5ylps2r2c0ynz6jjf368sdjnztufeghvc9x',
      ),
    ).toBe(false);
  });
});
