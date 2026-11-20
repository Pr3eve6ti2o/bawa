/**
 * Two-engine known-answer oracle over the first six entries of the published
 * TREZOR BIP-39 English corpus, in corpus order:
 * https://github.com/trezor/python-mnemonic/blob/master/vectors.json
 * Also published at:
 * https://github.com/bitcoinjs/bip39/blob/master/test/vectors.json
 *
 * Triples pin entropy hex, mnemonic, and seed hex for passphrase "TREZOR".
 * The xprv field is covered in core.test.ts, not here.
 * Public test vectors only; never real wallet mnemonics.
 * Wordlists are explicit wherever accepted; seed APIs have no wordlist argument.
 */

import * as scure from '@scure/bip39';
import { wordlist as scureEnglish } from '@scure/bip39/wordlists/english.js';
import * as bitcoinjs from 'bip39';
import { describe, expect, it } from 'vitest';

const bitcoinjsEnglish = bitcoinjs.wordlists.english;

const VECTORS = [
  {
    entropy: '00000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    seed:
      'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic:
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    seed:
      '2e8905819b8723fe2c1d161860e5ee1830318dbf49a83bd451cfb8440c28bd6fa457fe1296106559a3c80937a1c1069be3a3a5bd381ee6260e8d9739fce1f607',
  },
  {
    entropy: '80808080808080808080808080808080',
    mnemonic:
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    seed:
      'd71de856f81a8acc65e6fc851a38d4d7ec216fd0796d0a6827a3ad6ed5511a30fa280f12eb2e47ed2ac03b5c462a0358d18d69fe4f985ec81778c1b370b652a8',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffff',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    seed:
      'ac27495480225222079d7be181583751e86f571027b0497b5b5d11218e0a8a13332572917f0f8e5a589620c6f15b11c61dee327651a14c34e18231052e48c069',
  },
  {
    entropy: '000000000000000000000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon agent',
    seed:
      '035895f2f481b1b0f01fcf8c289c794660b289981a78f8106447707fdd9666ca06da5a9a565181599b79f53b844d8a71dd9f439c52a3d7b3e8a79c906ac845fa',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic:
      'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal will',
    seed:
      'f2b94508732bcbacbcc020faefecfc89feafa6649a5491b8c952cede496c214a0c7b3c392d168748f2d4a612bada0753b52a1c7ac53c1e93abd5c6320b9e95dd',
  },
] as const;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('BIP-39 two-engine known-answer oracle', () => {
  it.each(VECTORS)(
    'matches the published vector for entropy $entropy',
    ({ entropy, mnemonic, seed }) => {
      expect.assertions(9);

      const scureMnemonic = scure.entropyToMnemonic(
        hexToBytes(entropy),
        scureEnglish,
      );
      const bitcoinjsMnemonic = bitcoinjs.entropyToMnemonic(
        entropy,
        bitcoinjsEnglish,
      );

      expect(scureMnemonic).toBe(mnemonic);
      expect(bitcoinjsMnemonic).toBe(mnemonic);
      expect(scureMnemonic).toBe(bitcoinjsMnemonic);

      const scureEntropy = bytesToHex(
        scure.mnemonicToEntropy(mnemonic, scureEnglish),
      );
      const bitcoinjsEntropy = bitcoinjs.mnemonicToEntropy(
        mnemonic,
        bitcoinjsEnglish,
      );

      expect(scureEntropy).toBe(entropy);
      expect(bitcoinjsEntropy).toBe(entropy);
      expect(scureEntropy).toBe(bitcoinjsEntropy);

      const scureSeed = bytesToHex(
        scure.mnemonicToSeedSync(mnemonic, 'TREZOR'),
      );
      const bitcoinjsSeed = bytesToHex(
        bitcoinjs.mnemonicToSeedSync(mnemonic, 'TREZOR'),
      );

      expect(scureSeed).toBe(seed);
      expect(bitcoinjsSeed).toBe(seed);
      expect(scureSeed).toBe(bitcoinjsSeed);
    },
  );

  it('agrees between sync and async seed APIs on the first TREZOR vector', async () => {
    expect.assertions(5);

    const { mnemonic, seed } = VECTORS[0];

    const scureSync = bytesToHex(
      scure.mnemonicToSeedSync(mnemonic, 'TREZOR'),
    );
    const scureAsync = bytesToHex(
      await scure.mnemonicToSeed(mnemonic, 'TREZOR'),
    );
    const bitcoinjsSync = bytesToHex(
      bitcoinjs.mnemonicToSeedSync(mnemonic, 'TREZOR'),
    );
    const bitcoinjsAsync = bytesToHex(
      await bitcoinjs.mnemonicToSeed(mnemonic, 'TREZOR'),
    );

    expect(scureSync).toBe(seed);
    expect(scureAsync).toBe(scureSync);
    expect(bitcoinjsSync).toBe(seed);
    expect(bitcoinjsAsync).toBe(bitcoinjsSync);
    expect(scureAsync).toBe(bitcoinjsAsync);
  });

  it.each(['NFC', 'NFD', 'NFKC'] as const)(
    'uses NFKD for a %s café passphrase in both engines',
    (form) => {
      expect.assertions(3);

      const mnemonic = VECTORS[0].mnemonic;
      const passphrase = 'caf\u00e9'.normalize(form);
      const expectedSeed =
        'af8bbd2566df7b69d926f2b09dfdbd75db6c994a3399b2cc65f928d63e3fd4e61218ee0d15f8c810be4d45e66d47b43c15a5cc753976b1666912377ff7ae9818';

      const scureSeed = bytesToHex(
        scure.mnemonicToSeedSync(mnemonic, passphrase),
      );
      const bitcoinjsSeed = bytesToHex(
        bitcoinjs.mnemonicToSeedSync(mnemonic, passphrase),
      );

      expect(scureSeed).toBe(expectedSeed);
      expect(bitcoinjsSeed).toBe(expectedSeed);
      expect(scureSeed).toBe(bitcoinjsSeed);
    },
  );
});
