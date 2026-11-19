import { describe, expect, it } from 'vitest';
import { loadCore } from '../engine/boundary';
import {
  createWallet,
  deriveAddresses,
  deriveAddressesAt,
  deriveFromXpub,
  restoreWallet,
  withSigningKey,
} from './core';

// Public fixtures already in the repo (apps/web/src/engine/boundary.test.ts).
const trxXpub =
  'xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF';
const ethXpub =
  'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc';
const btcZpub =
  'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9';

// Wallet Core 4.9.3 probe fixtures (2026-11-20, BIP-39 test-vector
// mnemonic, empty passphrase, no funds): the Ltub/dgub extended keys and
// the addresses they derive at index 0.
const TEST_VECTOR_MNEMONIC = 'abandon '.repeat(11) + 'about';
const ltcLtub =
  'Ltub2ZANw57Fi4JfMGenngwfZMqDrsccTf2m3qEjvLuk8faGXB973sSqGttAdKBvGSCLG9DXh2yxaUB9qpwQUe2zCCtrZPhjxGuMAWqL6F7Xrpd';
const dogeDgub =
  'dgub8rUhDtD3YFGZTUphBfpBbzvFxSMKQXYLzg87Me2ta78r2SdVLmypBUkkxrrn9RTnchsyiJSkHZyLWxD13ibBiXtuFWktBoDaGaZjQUBLNLs';

// Published wallet-core HDWallet.test.ts vector (public test data, test-only,
// never for funds): the TREZOR BIP-39 vector with passphrase "TREZOR".
const ETH_VECTOR_MNEMONIC =
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const ETH_VECTOR_ADDRESS = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

describe('wallet/core', () => {
  it('creates a fresh 24-word mnemonic from CSPRNG entropy', async () => {
    const mnemonic = await createWallet();
    expect(mnemonic.split(' ')).toHaveLength(24);
    const core = await loadCore();
    expect(core.Mnemonic.isValid(mnemonic)).toBe(true);
  });

  it('restores with identical derived addresses on all thirteen chains', async () => {
    const mnemonic = await createWallet();
    const first = await deriveAddresses(mnemonic);
    const restored = await restoreWallet(mnemonic);
    expect(restored).toBe(mnemonic);
    const second = await deriveAddresses(restored);
    expect(second).toEqual(first);
    expect(first.btc.startsWith('bc1q')).toBe(true);
    expect(first.eth.startsWith('0x')).toBe(true);
    expect(first.trx.startsWith('T')).toBe(true);
    expect(first.ton.startsWith('UQ')).toBe(true);
    expect(first.ton).toHaveLength(48);
    expect(first.sol).toHaveLength(44);
    expect(first.bsc.startsWith('0x')).toBe(true);
    expect(first.matic.startsWith('0x')).toBe(true);
    expect(first.arb.startsWith('0x')).toBe(true);
    expect(first.op.startsWith('0x')).toBe(true);
    expect(first.base.startsWith('0x')).toBe(true);
    expect(first.avax.startsWith('0x')).toBe(true);
    expect(first.ltc.startsWith('ltc1')).toBe(true);
    expect(first.doge.startsWith('D')).toBe(true);
  });

  it('derives the published ETH vector address', async () => {
    const addresses = await deriveAddresses(ETH_VECTOR_MNEMONIC, 'TREZOR');
    expect(addresses.eth).toBe(ETH_VECTOR_ADDRESS);
  });

  it('derives the Wallet Core probe test-vector addresses on all thirteen chains', async () => {
    const addresses = await deriveAddresses(TEST_VECTOR_MNEMONIC);
    expect(addresses.btc).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    expect(addresses.eth).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(addresses.trx).toBe('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
    expect(addresses.ton).toBe('UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY');
    expect(addresses.sol).toBe('GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL');
    expect(addresses.bsc).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(addresses.matic).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(addresses.arb).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(addresses.op).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(addresses.base).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(addresses.avax).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(addresses.ltc).toBe('ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh');
    expect(addresses.doge).toBe('DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC');
  });

  it('deriveAddressesAt(0, 0) equals deriveAddresses() exactly', async () => {
    const mnemonic = await createWallet();
    const base = await deriveAddresses(mnemonic);
    const at = await deriveAddressesAt(mnemonic, '', 0, 0);
    expect(at).toEqual(base);
  });

  it('deriveAddressesAt honours the passphrase like deriveAddresses()', async () => {
    const withPassphrase = await deriveAddressesAt(
      ETH_VECTOR_MNEMONIC,
      'TREZOR',
      0,
      0,
    );
    expect(withPassphrase.eth).toBe(ETH_VECTOR_ADDRESS);
    const without = await deriveAddressesAt(ETH_VECTOR_MNEMONIC, '', 0, 0);
    expect(without.eth).not.toBe(ETH_VECTOR_ADDRESS);
  });

  it('deriveAddressesAt changes btc/eth/trx/ltc/doge at index 1 but not TON or SOL', async () => {
    const mnemonic = await createWallet();
    const base = await deriveAddressesAt(mnemonic, '', 0, 0);
    const next = await deriveAddressesAt(mnemonic, '', 0, 1);
    expect(next.btc).not.toBe(base.btc);
    expect(next.eth).not.toBe(base.eth);
    expect(next.trx).not.toBe(base.trx);
    expect(next.ltc).not.toBe(base.ltc);
    expect(next.doge).not.toBe(base.doge);
    expect(next.btc.startsWith('bc1q')).toBe(true);
    expect(next.eth.startsWith('0x')).toBe(true);
    expect(next.trx.startsWith('T')).toBe(true);
    expect(next.ltc.startsWith('ltc1')).toBe(true);
    expect(next.doge.startsWith('D')).toBe(true);
    // TON has one address per wallet: account and index do not change it.
    expect(next.ton).toBe(base.ton);
    // SOL, like TON, has one address per wallet.
    expect(next.sol).toBe(base.sol);
    const other = await deriveAddressesAt(mnemonic, '', 2, 3);
    expect(other.ton).toBe(base.ton);
    expect(other.sol).toBe(base.sol);
  });

  it('deriveAddressesAt rejects out-of-range account/index', async () => {
    const mnemonic = await createWallet();
    await expect(deriveAddressesAt(mnemonic, '', -1, 0)).rejects.toThrow(
      RangeError,
    );
    await expect(deriveAddressesAt(mnemonic, '', 0, -1)).rejects.toThrow(
      RangeError,
    );
    await expect(
      deriveAddressesAt(mnemonic, '', 0, 0x80000000),
    ).rejects.toThrow(RangeError);
    await expect(deriveAddressesAt(mnemonic, '', 1.5, 0)).rejects.toThrow(
      RangeError,
    );
  });

  it('rejects invalid mnemonics', async () => {
    await expect(restoreWallet('abandon '.repeat(11) + 'wrong')).rejects.toThrow(
      'Invalid mnemonic.',
    );
    await expect(restoreWallet('not a mnemonic')).rejects.toThrow(
      'Invalid mnemonic.',
    );
    await expect(deriveAddresses('abandon '.repeat(11) + 'wrong')).rejects.toThrow(
      'Invalid mnemonic.',
    );
  });

  it('derives the repo TRX xpub fixtures', async () => {
    expect(await deriveFromXpub('trx', trxXpub, 0)).toBe(
      'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
    );
    expect(await deriveFromXpub('trx', trxXpub, 1)).toBe(
      'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B',
    );
  });

  it('derives the repo BTC and ETH xpub fixtures', async () => {
    expect(await deriveFromXpub('btc', btcZpub, 0)).toBe(
      'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
    );
    expect(await deriveFromXpub('eth', ethXpub, 0)).toBe(
      '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    );
  });

  it('derives the LTC and DOGE xpub fixtures', async () => {
    expect(await deriveFromXpub('ltc', ltcLtub, 0)).toBe(
      'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh',
    );
    expect(await deriveFromXpub('doge', dogeDgub, 0)).toBe(
      'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
    );
    expect(await deriveFromXpub('ltc', ltcLtub, 1)).not.toBe(
      'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh',
    );
    expect(await deriveFromXpub('doge', dogeDgub, 1)).not.toBe(
      'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
    );
  });

  it('rejects TON derivation from an xpub', async () => {
    await expect(deriveFromXpub('ton', trxXpub, 0)).rejects.toThrow();
  });

  it('rejects SOL derivation from an xpub', async () => {
    await expect(deriveFromXpub('sol', trxXpub, 0)).rejects.toThrow();
  });

  it('proves the TRX 33-byte abort and the 65-byte rule on raw WASM', async () => {
    const core = await loadCore();
    const mnemonic = await createWallet();
    const wallet = core.HDWallet.createWithMnemonic(mnemonic, '');
    try {
      const key = wallet.getKey(core.CoinType.tron, "m/44'/195'/0'/0/0");
      try {
        const pub33 = key.getPublicKeySecp256k1(true);
        try {
          expect(pub33.data()).toHaveLength(33);
          // The known 4.9.3 defect: a 33-byte compressed TRX pubkey aborts
          // the WASM runtime when passed to deriveAddressFromPublicKey.
          expect(() =>
            core.CoinTypeExt.deriveAddressFromPublicKey(
              core.CoinType.tron,
              pub33,
            ),
          ).toThrow();
          const pub65 = pub33.uncompressed();
          try {
            expect(pub65.data()).toHaveLength(65);
            const address = core.CoinTypeExt.deriveAddressFromPublicKey(
              core.CoinType.tron,
              pub65,
            );
            expect(
              core.CoinTypeExt.validate(core.CoinType.tron, address),
            ).toBe(true);
            expect(address).toBe(wallet.getAddressForCoin(core.CoinType.tron));
          } finally {
            pub65.delete();
          }
        } finally {
          pub33.delete();
        }
      } finally {
        key.delete();
      }
    } finally {
      wallet.delete();
    }
  });

  it('proves the BTC rule is the mirror image: 65-byte aborts, 33-byte works', async () => {
    const core = await loadCore();
    const mnemonic = await createWallet();
    const wallet = core.HDWallet.createWithMnemonic(mnemonic, '');
    try {
      const key = wallet.getKey(core.CoinType.bitcoin, "m/84'/0'/0'/0/0");
      try {
        const pub33 = key.getPublicKeySecp256k1(true);
        try {
          expect(pub33.data()).toHaveLength(33);
          const address = core.CoinTypeExt.deriveAddressFromPublicKey(
            core.CoinType.bitcoin,
            pub33,
          );
          expect(
            core.CoinTypeExt.validate(core.CoinType.bitcoin, address),
          ).toBe(true);
          expect(address).toBe(
            wallet.getAddressForCoin(core.CoinType.bitcoin),
          );
          const pub65 = pub33.uncompressed();
          try {
            expect(pub65.data()).toHaveLength(65);
            // Mirror image of the TRX defect: BTC derivation aborts on the
            // 65-byte uncompressed form. Never normalize unconditionally.
            expect(() =>
              core.CoinTypeExt.deriveAddressFromPublicKey(
                core.CoinType.bitcoin,
                pub65,
              ),
            ).toThrow();
          } finally {
            pub65.delete();
          }
        } finally {
          pub33.delete();
        }
      } finally {
        key.delete();
      }
    } finally {
      wallet.delete();
    }
  });

  it('hands transient signing keys to a callback and zeroes them', async () => {
    const mnemonic = await createWallet();
    const core = await loadCore();
    let captured: Uint8Array | undefined;
    const length = await withSigningKey(
      mnemonic,
      '',
      core.CoinType.ethereum,
      "m/44'/60'/0'/0/0",
      (bytes) => {
        captured = bytes;
        expect(bytes).toHaveLength(32);
        expect(bytes.some((value) => value !== 0)).toBe(true);
        return bytes.length;
      },
    );
    expect(length).toBe(32);
    expect(captured).toBeDefined();
    expect(captured!.every((value) => value === 0)).toBe(true);
  });
});
