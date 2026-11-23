import { describe, expect, it } from 'vitest';
import { loadCore } from '../engine/boundary';
import {
  bytesToHex,
  hashMessage,
  hexToBytes,
  recoverAddress,
  sha256,
} from 'viem';
import {
  assertIntentMatchesTransaction,
  assertPartialSigner,
  createNoopSigner,
  createPartialSigner,
  createTransactionIntent,
  createWallet,
  deriveAddressAt,
  deriveAddresses,
  deriveAddressesAt,
  deriveDevnetAddressesAt,
  deriveFromXpub,
  intentFingerprint,
  isPartialSigner,
  restoreWallet,
  withSigningKey,
  type AddressOnlyAccount,
  type LocalAccount,
} from './core';
import { decodeBtcBech32 } from './devnet';
import { ripemd160 } from 'viem';

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
// BIP-39 seed of ETH_VECTOR_MNEMONIC with passphrase "TREZOR"
// (PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonicTREZOR").
const ETH_VECTOR_SEED_HEX =
  '7ae6f661157bda6492f6162701e570097fc726b6235011ea5ad09bf04986731ed4d92bc43cbdee047b60ea0dd1b1fa4274377c9bf5bd14ab1982c272d8076f29';

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

  it('deriveAddressAt agrees with deriveAddressesAt for one chain', async () => {
    // Lane C, item 8: HD rotation derives one chain at a time, so the
    // single-chain entry point must agree exactly with the all-chain
    // one at the same account/index.
    const mnemonic = await createWallet();
    const all = await deriveAddressesAt(mnemonic, '', 0, 0);
    expect(await deriveAddressAt(mnemonic, '', 'eth', 0, 0)).toBe(all.eth);
    expect(await deriveAddressAt(mnemonic, '', 'btc', 0, 0)).toBe(all.btc);
    const next = await deriveAddressesAt(mnemonic, '', 0, 1);
    expect(await deriveAddressAt(mnemonic, '', 'eth', 0, 1)).toBe(next.eth);
    expect(await deriveAddressAt(mnemonic, '', 'eth', 0, 1)).not.toBe(
      all.eth,
    );
    // TON and SOL ignore the index: one address per wallet.
    expect(await deriveAddressAt(mnemonic, '', 'ton', 0, 5)).toBe(all.ton);
    expect(await deriveAddressAt(mnemonic, '', 'sol', 0, 5)).toBe(all.sol);
  });

  it('deriveAddressAt rejects out-of-range account/index', async () => {
    const mnemonic = await createWallet();
    await expect(deriveAddressAt(mnemonic, '', 'eth', -1, 0)).rejects.toThrow(
      RangeError,
    );
    await expect(deriveAddressAt(mnemonic, '', 'eth', 0, -1)).rejects.toThrow(
      RangeError,
    );
    await expect(
      deriveAddressAt(mnemonic, '', 'eth', 0, 0x80000000),
    ).rejects.toThrow(RangeError);
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

describe('seed-to-xprv: Bitcoin BIP-44 account keys, not master keys', () => {
  const vectors = [
    {
      // Public test vector: Trezor python-mnemonic, vectors.json, English[0] (MIT).
      // https://github.com/trezor/python-mnemonic/blob/master/vectors.json
      name: 'Trezor English[0]',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedHex:
        'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
      accountXprv:
        'xprv9z3rKW6EbJfnxwVmsXBRWABiT5Zfh37GsqTXrcdaMssUntP2wumTtqKxSkZsytaxQZknwAhb3U8UR5cc3cxoMxdo4871tPPCTmeqckJyrWL',
      masterXprv:
        'xprv9s21ZrQH143K3h3fDYiay8mocZ3afhfULfb5GX8kCBdno77K4HiA15Tg23wpbeF1pLfs1c5SPmYHrEpTuuRhxMwvKDwqdKiGJS9XFKzUsAF',
    },
    {
      name: 'existing public ETH vector',
      mnemonic: ETH_VECTOR_MNEMONIC,
      seedHex: ETH_VECTOR_SEED_HEX,
      accountXprv:
        'xprv9yxpr2jZR35N6RHqgKAv2HCg1FnBvnSEgTi6ywrQSXkpVdUC2PmDLUMyK8GcEK2ca6i9ujqmnh5coVg9Mu9in194c5KYsG1KJzspxBYTmds',
      masterXprv:
        'xprv9s21ZrQH143K3Z5LVjLkoHSa1bsnRiMAGwPBwcL45YuU98ku7wcsaq72fC15FHnZRuZm1QY6r3azFttpb2CZxwJZqS3fZz5TerqqT7DvnBv',
    },
  ] as const;

  for (const vector of vectors) {
    it(
      `${vector.name}: seed matches; account xprv at m/44'/0'/0' matches and is not the master xprv`,
      async () => {
        const core = await loadCore();
        const wallet = core.HDWallet.createWithMnemonic(
          vector.mnemonic,
          'TREZOR',
        );

        try {
          expect(Buffer.from(wallet.seed()).toString('hex')).toBe(
            vector.seedHex,
          );

          // Wallet Core 4.9.3 returns the account key, not the master key.
          const accountXprv = wallet.getExtendedPrivateKey(
            core.Purpose.bip44,
            core.CoinType.bitcoin,
            core.HDVersion.xprv,
          );

          expect(accountXprv).toBe(vector.accountXprv);
          expect(accountXprv).not.toBe(vector.masterXprv);
        } finally {
          wallet.delete();
        }
      },
    );
  }
});

describe('createPartialSigner facade', () => {
  const chains = [
    { chain: 'eth', signatureLength: 65 },
    { chain: 'btc', signatureLength: 65 },
    { chain: 'trx', signatureLength: 65 },
    { chain: 'ton', signatureLength: 64 },
  ] as const;

  it('matches deriveAddresses on every chain for the ETH vector and a fresh mnemonic', async () => {
    const mnemonic = await createWallet();
    const fixtures = [
      { mnemonic: ETH_VECTOR_MNEMONIC, passphrase: 'TREZOR' },
      { mnemonic, passphrase: '' },
    ];

    for (const fixture of fixtures) {
      const addresses = await deriveAddresses(
        fixture.mnemonic,
        fixture.passphrase,
      );

      for (const { chain } of chains) {
        const signer = await createPartialSigner(
          fixture.mnemonic,
          fixture.passphrase,
          chain,
        );

        expect(signer.chain).toBe(chain);
        expect(signer.address).toBe(addresses[chain]);
      }
    }
  });

  it('rejects a 31-byte digest on every chain', async () => {
    const mnemonic = await createWallet();
    const digest = new Uint8Array(31);

    for (const { chain } of chains) {
      const signer = await createPartialSigner(mnemonic, '', chain);

      await expect(signer.signDigest(digest)).rejects.toThrow(
        /^signDigest requires exactly 32 bytes$/,
      );
    }
  });

  it('returns 65-byte ETH/BTC/TRX signatures and 64-byte TON signatures', async () => {
    const mnemonic = await createWallet();
    const digest = new Uint8Array(32).fill(0x42);

    for (const { chain, signatureLength } of chains) {
      const signer = await createPartialSigner(mnemonic, '', chain);
      const signature = await signer.signDigest(digest);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature).toHaveLength(signatureLength);
    }
  });

  it('signs the same ETH digest deterministically', async () => {
    const mnemonic = await createWallet();
    const signer = await createPartialSigner(mnemonic, '', 'eth');
    const digest = new Uint8Array(32).fill(0x42);

    const first = (await signer.signDigest(digest)).slice();
    const second = await signer.signDigest(digest);

    expect(second).toEqual(first);
  });
});

describe('wallet core message signing, signer guards, and intents', () => {
  const message = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xff]);
  const to = '0x1111111111111111111111111111111111111111';
  const otherTo = '0x2222222222222222222222222222222222222222';
  const amountBaseUnits = '1000';
  const sequence = '1';

  const signerFor = async (chain: 'eth' | 'btc' | 'trx' | 'ton') =>
    createPartialSigner(await createWallet(), '', chain);

  it('ETH signs the EIP-191 message hash and recovers its address', async () => {
    const signer = await signerFor('eth');
    const hash = hashMessage({ raw: message });
    const signature = await signer.signMessage(message);

    expect(signature).toEqual(await signer.signDigest(hexToBytes(hash)));

    const recovered = await recoverAddress({
      hash,
      signature: bytesToHex(signature),
    });

    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase());
  });

  it.each(['btc', 'trx'] as const)(
    '%s signs the SHA-256 message hash',
    async (chain) => {
      const signer = await signerFor(chain);
      const signature = await signer.signMessage(message);

      expect(signature).toEqual(
        await signer.signDigest(hexToBytes(sha256(message))),
      );
    },
  );

  it('TON returns 64 deterministic message-signature bytes', async () => {
    const signer = await signerFor('ton');
    const first = await signer.signMessage(message);
    const second = await signer.signMessage(message);

    expect(first).toBeInstanceOf(Uint8Array);
    expect(first).toHaveLength(64);
    expect(second).toHaveLength(64);
    expect(second).toEqual(first);
  });

  it('the ETH noop signer returns 65 zero bytes for digests and messages', async () => {
    const signer = createNoopSigner('eth', to);
    const zeros = new Uint8Array(65);

    expect(
      await signer.signDigest(hexToBytes(sha256(message))),
    ).toEqual(zeros);
    expect(await signer.signMessage(message)).toEqual(zeros);
  });

  it('recognizes signers but not address-only or local account wrappers', async () => {
    const signer = await signerFor('eth');

    const addressOnly: AddressOnlyAccount = {
      kind: 'address-only',
      chain: 'eth',
      address: signer.address,
    };
    const local: LocalAccount = {
      kind: 'local',
      chain: 'eth',
      address: signer.address,
      signer,
    };

    expect(isPartialSigner(signer)).toBe(true);
    expect(isPartialSigner(addressOnly)).toBe(false);
    expect(isPartialSigner(local)).toBe(false);
    expect(isPartialSigner(local.signer)).toBe(true);

    expect(() => assertPartialSigner(signer)).not.toThrow();
    expect(() => assertPartialSigner(addressOnly)).toThrow(
      new Error('Expected PartialSigner; bad kind: address-only'),
    );
  });

  it('rejects an empty recipient and a non-numeric amount', () => {
    expect(() =>
      createTransactionIntent('eth', '', amountBaseUnits, sequence),
    ).toThrow(Error);

    expect(() =>
      createTransactionIntent('eth', to, 'not-a-number', sequence),
    ).toThrow(Error);
  });

  it('produces a stable SHA-256 fingerprint sensitive to every intent field', () => {
    const intent = createTransactionIntent(
      'eth',
      to,
      amountBaseUnits,
      sequence,
    );
    const fingerprint = intentFingerprint(intent);

    expect(fingerprint).toMatch(/^0x[0-9a-f]{64}$/);
    expect(intentFingerprint(intent)).toBe(fingerprint);
    expect(
      intentFingerprint(
        createTransactionIntent('eth', to, amountBaseUnits, sequence),
      ),
    ).toBe(fingerprint);

    const changedIntents = [
      createTransactionIntent('btc', to, amountBaseUnits, sequence),
      createTransactionIntent('eth', otherTo, amountBaseUnits, sequence),
      createTransactionIntent('eth', to, '1001', sequence),
      createTransactionIntent('eth', to, amountBaseUnits, '2'),
    ];

    for (const changedIntent of changedIntents) {
      expect(intentFingerprint(changedIntent)).not.toBe(fingerprint);
    }
  });

  it('names to when only the transaction recipient differs', () => {
    const intent = createTransactionIntent(
      'eth',
      to,
      amountBaseUnits,
      sequence,
    );
    const transaction = {
      chain: "eth" as const,
      to,
      amountBaseUnits,
      sequence,
    };

    expect(() =>
      assertIntentMatchesTransaction(intent, transaction),
    ).not.toThrow();

    expect(() =>
      assertIntentMatchesTransaction(intent, {
        ...transaction,
        to: otherTo,
      }),
    ).toThrow(new Error('Signing intent mismatch: to.'));
  });
});

describe('deriveDevnetAddressesAt (temporary devnet mode)', () => {
  it('derives tb1q BTC at the testnet coin-type path with the same witness program as the key', async () => {
    const core = await loadCore();
    const wallet = core.HDWallet.createWithMnemonic(TEST_VECTOR_MNEMONIC, '');
    // Independent route to the key at m/84'/1'/0'/0/0 (coin type 1):
    // hash160 of its compressed public key must equal the tb1q program.
    const key = wallet.getKey(core.CoinType.bitcoin, "m/84'/1'/0'/0/0");
    let expectedProgram: number[];
    try {
      const pubkey = key.getPublicKeySecp256k1(true);
      try {
        const compressed = new Uint8Array(pubkey.data());
        const hash = ripemd160(sha256(compressed));
        expectedProgram = Array.from(hexToBytes(hash));
      } finally {
        pubkey.delete();
      }
    } finally {
      key.delete();
      wallet.delete();
    }

    const devnet = await deriveDevnetAddressesAt(TEST_VECTOR_MNEMONIC, '', 0, 0);
    expect(devnet.btc.startsWith('tb1q')).toBe(true);
    const decoded = decodeBtcBech32(devnet.btc);
    expect(decoded).not.toBeNull();
    expect(decoded?.hrp).toBe('tb');
    expect(decoded?.witnessVersion).toBe(0);
    expect(decoded?.program).toEqual(expectedProgram);
  });

  it('reuses the mainnet address for ETH and TRX, and re-encodes TON with the testnet flag', async () => {
    const mainnet = await deriveAddresses(TEST_VECTOR_MNEMONIC);
    const devnet = await deriveDevnetAddressesAt(TEST_VECTOR_MNEMONIC, '', 0, 0);
    expect(devnet.eth).toBe(mainnet.eth);
    expect(devnet.eth).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(devnet.trx).toBe(mainnet.trx);
    expect(devnet.trx).toBe('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
    // Same account hash as the mainnet UQ address, testnet-flagged (0Q).
    expect(devnet.ton.startsWith('0Q')).toBe(true);
    expect(devnet.ton).toBe('0QAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-akS');
    // The other nine chains stay mainnet-only.
    expect(devnet.sol).toBe(mainnet.sol);
    expect(devnet.bsc).toBe(mainnet.bsc);
    expect(devnet.ltc).toBe(mainnet.ltc);
    expect(devnet.doge).toBe(mainnet.doge);
  });

  it('changes BTC at index 1 but not TON', async () => {
    const base = await deriveDevnetAddressesAt(TEST_VECTOR_MNEMONIC, '', 0, 0);
    const next = await deriveDevnetAddressesAt(TEST_VECTOR_MNEMONIC, '', 0, 1);
    expect(next.btc).not.toBe(base.btc);
    expect(next.btc.startsWith('tb1q')).toBe(true);
    expect(next.ton).toBe(base.ton);
    expect(next.eth).not.toBe(base.eth);
  });

  it('rejects an invalid mnemonic', async () => {
    await expect(
      deriveDevnetAddressesAt('abandon abandon', '', 0, 0),
    ).rejects.toThrow('Invalid mnemonic.');
  });

  it('rejects a negative account and an out-of-range index', async () => {
    await expect(
      deriveDevnetAddressesAt(TEST_VECTOR_MNEMONIC, '', -1, 0),
    ).rejects.toThrow(RangeError);
    await expect(
      deriveDevnetAddressesAt(TEST_VECTOR_MNEMONIC, '', 0, 0x80000000),
    ).rejects.toThrow(RangeError);
  });
});
