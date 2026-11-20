import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  entropyToMnemonic,
  mnemonicToEntropy,
  mnemonicToSeedSync,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { deriveAddresses } from './core';
import type { WalletAddresses } from './core';
import {
  signBtcOffline,
  signEthOffline,
  signTonOffline,
  signTrxOffline,
  verifyEthSignedTx,
} from './send';

/**
 * Trezor BIP-39 vectors, data-driven (Phase 3, Lane H).
 * Source: trezor/python-mnemonic vectors.json ("english"), passphrase
 * "TREZOR" for the seeds. Values are generated into this file from that
 * corpus — never typed by hand. Only published test vectors are used;
 * no real seed phrase or private key appears here.
 *
 * What each assertion proves:
 * - seed hex: @scure/bip39 reproduces the published vector seed
 *   (an independent check — the seed never comes from Bawa).
 * - entropy round-trip: mnemonic -> entropy -> mnemonic (the trezor /
 *   @scure/bip39 pattern: one vector, every API surface).
 * - 13-chain addresses: Bawa's deriveAddresses with the "TREZOR"
 *   passphrase. At generation time these were cross-checked against
 *   independent implementations (@scure/bip32 + viem + @noble/curves,
 *   plus hand-rolled bech32/base58check validated against the
 *   already-pinned vector-0 empty-passphrase values in core.test.ts)
 *   for ETH/EVM, BTC, LTC, DOGE, TRX and SOL. TON addresses are
 *   regression goldens from Bawa's own derivation — no independent TON
 *   address encoder was available; vector 0's empty-passphrase TON
 *   address matches the pinned core.test.ts value.
 * - re-sign determinism: signing the same input twice yields the same
 *   output on every chain (the wallet-core SignerTests pattern).
 */
type TrezorVector = {
  index: number;
  entropyHex: string;
  mnemonic: string;
  seedHex: string;
  addresses: WalletAddresses;
};

const VECTORS: TrezorVector[] = [
  {
    index: 0,
    entropyHex: '00000000000000000000000000000000',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    seedHex: 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
    addresses: {
      btc: 'bc1qv5rmq0kt9yz3pm36wvzct7p3x6mtgehjul0feu',
      eth: '0x9c32F71D4DB8Fb9e1A58B0a80dF79935e7256FA6',
      trx: 'TAyDUYP5rcf56xFwrg8cU1qQwvnWpkeapM',
      ton: 'UQC8Yak9NGmaRtppVSD6FAU8ZKvTRIVBLJ18UP9mc2vwdLUS',
      sol: '9md2ZNCYw622wTzgHn71kh9T6mFSoB4USnA4QdvY8oM4',
      bsc: '0x9c32F71D4DB8Fb9e1A58B0a80dF79935e7256FA6',
      matic: '0x9c32F71D4DB8Fb9e1A58B0a80dF79935e7256FA6',
      arb: '0x9c32F71D4DB8Fb9e1A58B0a80dF79935e7256FA6',
      op: '0x9c32F71D4DB8Fb9e1A58B0a80dF79935e7256FA6',
      base: '0x9c32F71D4DB8Fb9e1A58B0a80dF79935e7256FA6',
      avax: '0x9c32F71D4DB8Fb9e1A58B0a80dF79935e7256FA6',
      ltc: 'ltc1qmnmdtk82gfvv4khc3w9lrugre34cj65kamf9tz',
      doge: 'DMn7J63QSZUR9XNxsUJtvsttZVzV9Am4qM',
    },
  },
  {
    index: 1,
    entropyHex: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic: 'legal winner thank year wave sausage worth useful legal winner thank yellow',
    seedHex: '2e8905819b8723fe2c1d161860e5ee1830318dbf49a83bd451cfb8440c28bd6fa457fe1296106559a3c80937a1c1069be3a3a5bd381ee6260e8d9739fce1f607',
    addresses: {
      btc: 'bc1qcgphwddfcv5pax0agdw697rd8ewde8r02nwrex',
      eth: '0x6006ef1944FB519A746d00cDAf715Cbd27a5a008',
      trx: 'TLKvhyqakrxrN5SYXFpLETSyHvy4QMS84L',
      ton: 'UQAkB93bS4xRylFAlR6Y59M5DZRvnh-IMmmrvA9rYQjNYgQs',
      sol: 'DPaQFaSTXE1KpXwbbGE7aHLe1DwDCvG9tVo2Z16Lp6Fc',
      bsc: '0x6006ef1944FB519A746d00cDAf715Cbd27a5a008',
      matic: '0x6006ef1944FB519A746d00cDAf715Cbd27a5a008',
      arb: '0x6006ef1944FB519A746d00cDAf715Cbd27a5a008',
      op: '0x6006ef1944FB519A746d00cDAf715Cbd27a5a008',
      base: '0x6006ef1944FB519A746d00cDAf715Cbd27a5a008',
      avax: '0x6006ef1944FB519A746d00cDAf715Cbd27a5a008',
      ltc: 'ltc1qk3q3duphgzguedys8p53q4mmaqxdl7xcf5d8hm',
      doge: 'D5sFjYRh5dNYGGiAdQtJdr8E9UP7naVhUK',
    },
  },
  {
    index: 2,
    entropyHex: '80808080808080808080808080808080',
    mnemonic: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    seedHex: 'd71de856f81a8acc65e6fc851a38d4d7ec216fd0796d0a6827a3ad6ed5511a30fa280f12eb2e47ed2ac03b5c462a0358d18d69fe4f985ec81778c1b370b652a8',
    addresses: {
      btc: 'bc1qdffdngy2zzfdjgdnczh7vzs4e4wc208n7qufv8',
      eth: '0x97aa6F4c3e3120E25Ad2Ad3b88E6C13EF21ACE4a',
      trx: 'TPGHUwerX55Wbjz5DasnqGHUZBXjD1jmfN',
      ton: 'UQBuig6uz4b_B7IYnyapJ6v54ZkGPk4OjZ2OIC-lt08hLiPF',
      sol: '9ez51tuyNXYwRPNvnzM9tPT2fVHxX4DKdgdY1nj7XG3v',
      bsc: '0x97aa6F4c3e3120E25Ad2Ad3b88E6C13EF21ACE4a',
      matic: '0x97aa6F4c3e3120E25Ad2Ad3b88E6C13EF21ACE4a',
      arb: '0x97aa6F4c3e3120E25Ad2Ad3b88E6C13EF21ACE4a',
      op: '0x97aa6F4c3e3120E25Ad2Ad3b88E6C13EF21ACE4a',
      base: '0x97aa6F4c3e3120E25Ad2Ad3b88E6C13EF21ACE4a',
      avax: '0x97aa6F4c3e3120E25Ad2Ad3b88E6C13EF21ACE4a',
      ltc: 'ltc1q5d2l50c5jrx7vnqz60xr29p0txm5mmscaptxdt',
      doge: 'DU6fgcikgcBNqDRYcyr4h3Fa2wqmv2bGX4',
    },
  },
  {
    index: 3,
    entropyHex: 'ffffffffffffffffffffffffffffffff',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    seedHex: 'ac27495480225222079d7be181583751e86f571027b0497b5b5d11218e0a8a13332572917f0f8e5a589620c6f15b11c61dee327651a14c34e18231052e48c069',
    addresses: {
      btc: 'bc1qeruu9tjx0ux75w98mhwsz867w5hp5259630tt4',
      eth: '0x31a2E8fD7fC06AED00565458566993511c3F2d37',
      trx: 'TH8iQevWUUfewzrJ1XH6khH1Gudzx3rP4D',
      ton: 'UQDRSxFDqXC-lRRmgTdTamJXlS_O-r3o1zTYz8XKFdl3Mq1u',
      sol: '7N4VEwcXg2kdXGsJnAULVJedofqHyd1GicSgk6USDgjx',
      bsc: '0x31a2E8fD7fC06AED00565458566993511c3F2d37',
      matic: '0x31a2E8fD7fC06AED00565458566993511c3F2d37',
      arb: '0x31a2E8fD7fC06AED00565458566993511c3F2d37',
      op: '0x31a2E8fD7fC06AED00565458566993511c3F2d37',
      base: '0x31a2E8fD7fC06AED00565458566993511c3F2d37',
      avax: '0x31a2E8fD7fC06AED00565458566993511c3F2d37',
      ltc: 'ltc1qgpd90u028jwgm2lr5x02zr500qvgspyvmd3n0a',
      doge: 'DGHTmgzGHQhH9XBbWxX4KPPfzHg6WaA4Q6',
    },
  },
  {
    index: 8,
    entropyHex: '0000000000000000000000000000000000000000000000000000000000000000',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    seedHex: 'bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8',
    addresses: {
      btc: 'bc1q8ee9jp2ga509lae7xdcu88j0elzlyv0khhryaq',
      eth: '0x2b5D7A0E9d3EC34D629D07c6bDE5c41fb613c655',
      trx: 'TUxz2kwj8gAZocscfj8cxseDdv4M2apZZz',
      ton: 'UQDVZk5doJeezMVGnDCy0seTVH7vSdRcD3RWSnlDFcNUFBXh',
      sol: 'GekBmHMPw4ybVRNwnMEz1c7zy9TrrwdyH8qgNpcvAeja',
      bsc: '0x2b5D7A0E9d3EC34D629D07c6bDE5c41fb613c655',
      matic: '0x2b5D7A0E9d3EC34D629D07c6bDE5c41fb613c655',
      arb: '0x2b5D7A0E9d3EC34D629D07c6bDE5c41fb613c655',
      op: '0x2b5D7A0E9d3EC34D629D07c6bDE5c41fb613c655',
      base: '0x2b5D7A0E9d3EC34D629D07c6bDE5c41fb613c655',
      avax: '0x2b5D7A0E9d3EC34D629D07c6bDE5c41fb613c655',
      ltc: 'ltc1q7wzm56mem60pzkvjpnlhvsp83qexh6eqp4gtd4',
      doge: 'DMNcWQ2bWmW7tXFhx3R22jYRcPS6T9ZDW3',
    },
  },
  {
    index: 11,
    entropyHex: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
    seedHex: 'dd48c104698c30cfe2b6142103248622fb7bb0ff692eebb00089b32d22484e1613912f0a5b694407be899ffd31ed3992c456cdf60f5d4564b8ba3f05a69890ad',
    addresses: {
      btc: 'bc1qg492rlrh3cnkg4nauvc0gjw2l4l4a598cyv7n0',
      eth: '0x7e478Dc47D5A21C3dbd52c142EF0d255E7EB562F',
      trx: 'THE46BagHFma1m4ZhVnAyc2jqdszHYGpAF',
      ton: 'UQCC0X3L4oth5zUOEyaAOj5P1Mp0eh8tryyY-av9LiFzUTCe',
      sol: '8WG35TbFk3hkGKrdH5WyZskcEgrWgbHX9hCxXqbCF2U5',
      bsc: '0x7e478Dc47D5A21C3dbd52c142EF0d255E7EB562F',
      matic: '0x7e478Dc47D5A21C3dbd52c142EF0d255E7EB562F',
      arb: '0x7e478Dc47D5A21C3dbd52c142EF0d255E7EB562F',
      op: '0x7e478Dc47D5A21C3dbd52c142EF0d255E7EB562F',
      base: '0x7e478Dc47D5A21C3dbd52c142EF0d255E7EB562F',
      avax: '0x7e478Dc47D5A21C3dbd52c142EF0d255E7EB562F',
      ltc: 'ltc1qu4wur836syq3mf3l4036hq4lv4ex79trtvgqqn',
      doge: 'DCnTMfHiK1nPMSivAkeewrcbKkj8e8ppk8',
    },
  },
  {
    index: 12,
    entropyHex: '9e885d952ad362caeb4efe34a8e91bd2',
    mnemonic: 'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic',
    seedHex: '274ddc525802f7c828d8ef7ddbcdc5304e87ac3535913611fbbfa986d0c9e5476c91689f9c8a54fd55bd38606aa6a8595ad213d4c9c9f9aca3fb217069a41028',
    addresses: {
      btc: 'bc1qvdc8cajeeqqe6uv38epwfyg0dfglknt922j6e8',
      eth: '0xB592a90B5d4DF30b4156D5ED87AeA533cBf360d7',
      trx: 'TTKtei54S1cqezr4ZFrdsPfCMQ1M2AMujE',
      ton: 'UQDIQ1Hv0IPP3FaLOx9PKec4Yxc7NI1PA3ftP1ThpSTXCdsm',
      sol: 'BkL7vkT61TK5nsQn6FyhGg6AHPNYv9NWWqRRVakAVar8',
      bsc: '0xB592a90B5d4DF30b4156D5ED87AeA533cBf360d7',
      matic: '0xB592a90B5d4DF30b4156D5ED87AeA533cBf360d7',
      arb: '0xB592a90B5d4DF30b4156D5ED87AeA533cBf360d7',
      op: '0xB592a90B5d4DF30b4156D5ED87AeA533cBf360d7',
      base: '0xB592a90B5d4DF30b4156D5ED87AeA533cBf360d7',
      avax: '0xB592a90B5d4DF30b4156D5ED87AeA533cBf360d7',
      ltc: 'ltc1qr7adj05vl6454zv7tvv5ux9uls2gskkcpk06pf',
      doge: 'D9KkCN61fdgqaBADsmPtsNGwk985dUKeqK',
    },
  },
  {
    index: 20,
    entropyHex: '066dca1a2bb7e8a1db2832148ce9933eea0f3ac9548d793112d9a95c9407efad',
    mnemonic: 'all hour make first leader extend hole alien behind guard gospel lava path output census museum junior mass reopen famous sing advance salt reform',
    seedHex: '26e975ec644423f4a4c4f4215ef09b4bd7ef924e85d1d17c4cf3f136c2863cf6df0a475045652c57eb5fb41513ca2a2d67722b77e954b4b3fc11f7590449191d',
    addresses: {
      btc: 'bc1q023pp6m4evzpqj8wvx5g8fwu9yjg7p3lj2dzml',
      eth: '0x9E58287915bAbb1bC6344EfCB8382117Ff700EAb',
      trx: 'TH8H1ZNo2XJwreCSLFAdrnUS2nn7r6UJ3W',
      ton: 'UQARJBs4eIgNmbuIJzXpdJOXRCd1QiXdTvE26j7otzqKzKKf',
      sol: '4SgW7bAUEqL9UyVB3yZTDwYhUfRBnXMifzDFgJCL6UiU',
      bsc: '0x9E58287915bAbb1bC6344EfCB8382117Ff700EAb',
      matic: '0x9E58287915bAbb1bC6344EfCB8382117Ff700EAb',
      arb: '0x9E58287915bAbb1bC6344EfCB8382117Ff700EAb',
      op: '0x9E58287915bAbb1bC6344EfCB8382117Ff700EAb',
      base: '0x9E58287915bAbb1bC6344EfCB8382117Ff700EAb',
      avax: '0x9E58287915bAbb1bC6344EfCB8382117Ff700EAb',
      ltc: 'ltc1qy26ueg63xdcqsh6vd2jmzq4efqnngd86r0mg7n',
      doge: 'DDT87uKHT42ThNbQiaAjBh5T1xT1TPXLMH',
    },
  },
];

describe('trezor BIP-39 vectors (data-driven)', () => {
  for (const vector of VECTORS) {
    it(`vector ${vector.index} (${vector.mnemonic.split(' ').length} words): seed, entropy round-trip and 13-chain addresses`, async () => {
      // Seed hex: the published vector seed, passphrase "TREZOR".
      const seed = mnemonicToSeedSync(vector.mnemonic, 'TREZOR');
      expect(Buffer.from(seed).toString('hex')).toBe(vector.seedHex);

      // Entropy round-trip, both directions (the @scure/bip39 battery).
      const entropy = mnemonicToEntropy(vector.mnemonic, wordlist);
      expect(Buffer.from(entropy).toString('hex')).toBe(vector.entropyHex);
      expect(entropyToMnemonic(entropy, wordlist)).toBe(vector.mnemonic);
      expect(
        entropyToMnemonic(
          Uint8Array.from(Buffer.from(vector.entropyHex, 'hex')),
          wordlist,
        ),
      ).toBe(vector.mnemonic);

      // 13-chain addresses from the same seed Bawa derives from.
      const addresses = await deriveAddresses(vector.mnemonic, 'TREZOR');
      expect(addresses).toEqual(vector.addresses);
    });
  }
});

describe('re-sign determinism (sign the same input twice)', () => {
  // Published test-vector mnemonic only, empty passphrase, no funds.
  const MNEMONIC = 'abandon '.repeat(11) + 'about';
  const ETH_TO = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

  it('ETH: identical signed tx and hash, and the verifier accepts it', async () => {
    const first = await signEthOffline(
      MNEMONIC,
      '',
      ETH_TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    const second = await signEthOffline(
      MNEMONIC,
      '',
      ETH_TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.signedTxHex).toBe(first.signedTxHex);
    expect(second.txHash).toBe(first.txHash);
    // The in-module verifier accepts the signed tx against its intent.
    await expect(
      verifyEthSignedTx(first.signedTxHex, {
        from: first.from,
        to: ETH_TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 1,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('ETH verifier rejects a mismatched intent', async () => {
    const signed = await signEthOffline(
      MNEMONIC,
      '',
      ETH_TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    const intent = {
      from: signed.from,
      to: ETH_TO,
      amountBaseUnits: '10000000000000000',
      nonce: '0',
      chainId: 1,
    };
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        ...intent,
        to: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction destination does not match the signing intent.',
    });
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        ...intent,
        amountBaseUnits: '20000000000000000',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction value does not match the signing intent.',
    });
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        ...intent,
        nonce: '1',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction nonce does not match the signing intent.',
    });
    await expect(
      verifyEthSignedTx(signed.signedTxHex, { ...intent, chainId: 56 }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction chain id does not match the signing intent.',
    });
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        ...intent,
        // The TREZOR-vector ETH address: a real published address, but
        // not this wallet's sender (this wallet's from is the
        // abandon...about address 0x9858EfFD...).
        from: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction sender does not match the signing intent.',
    });
  });

  it('BTC: identical signed tx, hash and fee', async () => {
    const from = (await deriveAddresses(MNEMONIC, '')).btc;
    const dest = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';
    const fakeTxid = createHash('sha256')
      .update('lane-h-btc-determinism-utxo')
      .digest('hex');
    const utxo = { txid: fakeTxid, vout: 0, valueBaseUnits: '100000' };
    const first = await signBtcOffline(MNEMONIC, '', dest, '50000', [utxo], '10', from);
    const second = await signBtcOffline(MNEMONIC, '', dest, '50000', [utxo], '10', from);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.signedTxHex).toBe(first.signedTxHex);
    expect(second.txHash).toBe(first.txHash);
    expect(second.feeBaseUnits).toBe(first.feeBaseUnits);
  });

  it('TRX: identical signed JSON and txid at a fixed time', async () => {
    const from = (await deriveAddresses(MNEMONIC, '')).trx;
    const dest = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';
    const header = {
      timestamp: 1780000000000,
      number: 1,
      txTrieRoot: '00'.repeat(32),
      parentHash: '00'.repeat(32),
      witnessAddress: from,
    };
    // TRX signing stamps Date.now() into the transaction, so the
    // clock must be fixed for the two signatures to agree.
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1780000000000);
    try {
      const first = await signTrxOffline(MNEMONIC, '', dest, '1000000', header);
      const second = await signTrxOffline(MNEMONIC, '', dest, '1000000', header);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(second.signedTxJson).toBe(first.signedTxJson);
      expect(second.txId).toBe(first.txId);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('TON: identical BOC and message hash at a fixed time', async () => {
    // TON signing stamps Date.now() into expireAt, so the clock
    // must be fixed for the two signatures to agree.
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1780000000000);
    try {
      const first = await signTonOffline(
        MNEMONIC,
        '',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        '1000000000',
        0,
      );
      const second = await signTonOffline(
        MNEMONIC,
        '',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        '1000000000',
        0,
      );
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(second.signedBocBase64).toBe(first.signedBocBase64);
      expect(second.messageHash).toBe(first.messageHash);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
