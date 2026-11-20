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
import { expect as extraExpect, it as extraIt } from "vitest";
import * as extraScure from "@scure/bip39";
import { wordlist as extraEnglish } from "@scure/bip39/wordlists/english.js";
import * as extraBitcoinjs from "bip39";
import { loadCore } from "../engine/boundary";


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
  {
    entropy: '808080808080808080808080808080808080808080808080',
    mnemonic:
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter always',
    seed:
      '107d7c02a5aa6f38c58083ff74f04c607c2d2c0ecc55501dadd72d025b751bc27fe913ffb796f841c49b1d33b610cf0e91d3aa239027f5e99fe4ce9e5088cd65',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffffffffffffffffffff',
    mnemonic:
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo when',
    seed:
      '0cd6e5d827bb62eb8fc1e262254223817fd068a74b5b449cc2f667c3f1f985a76379b43348d952e2265b4cd129090758b3e3c2c49103b5051aac2eaeb890a528',
  },
  {
    entropy: '0000000000000000000000000000000000000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    seed:
      'bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic:
      'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title',
    seed:
      'bc09fca1804f7e69da93c2f2028eb238c227f2e9dda30cd63699232578480a4021b146ad717fbb7e451ce9eb835f43620bf5c514db0f8add49f5d121449d3e87',
  },
  {
    entropy: '8080808080808080808080808080808080808080808080808080808080808080',
    mnemonic:
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless',
    seed:
      'c0c519bd0e91a2ed54357d9d1ebef6f5af218a153624cf4f2da911a0ed8f7a09e2ef61af0aca007096df430022f7a2b6fb91661a9589097069720d015e4e982f',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    mnemonic:
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
    seed:
      'dd48c104698c30cfe2b6142103248622fb7bb0ff692eebb00089b32d22484e1613912f0a5b694407be899ffd31ed3992c456cdf60f5d4564b8ba3f05a69890ad',
  },
  {
    entropy: '9e885d952ad362caeb4efe34a8e91bd2',
    mnemonic:
      'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic',
    seed:
      '274ddc525802f7c828d8ef7ddbcdc5304e87ac3535913611fbbfa986d0c9e5476c91689f9c8a54fd55bd38606aa6a8595ad213d4c9c9f9aca3fb217069a41028',
  },
  {
    entropy: '6610b25967cdcca9d59875f5cb50b0ea75433311869e930b',
    mnemonic:
      'gravity machine north sort system female filter attitude volume fold club stay feature office ecology stable narrow fog',
    seed:
      '628c3827a8823298ee685db84f55caa34b5cc195a778e52d45f59bcf75aba68e4d7590e101dc414bc1bbd5737666fbbef35d1f1903953b66624f910feef245ac',
  },
  {
    entropy: '68a79eaca2324873eacc50cb9c6eca8cc68ea5d936f98787c60c7ebc74e6ce7c',
    mnemonic:
      'hamster diagram private dutch cause delay private meat slide toddler razor book happy fancy gospel tennis maple dilemma loan word shrug inflict delay length',
    seed:
      '64c87cde7e12ecf6704ab95bb1408bef047c22db4cc7491c4271d170a1b213d20b385bc1588d9c7b38f1b39d415665b8a9030c9ec653d75e65f847d8fc1fc440',
  },
  {
    entropy: 'c0ba5a8e914111210f2bd131f3d5e08d',
    mnemonic:
      'scheme spot photo card baby mountain device kick cradle pact join borrow',
    seed:
      'ea725895aaae8d4c1cf682c1bfd2d358d52ed9f0f0591131b559e2724bb234fca05aa9c02c57407e04ee9dc3b454aa63fbff483a8b11de949624b9f1831a9612',
  },
  {
    entropy: '6d9be1ee6ebd27a258115aad99b7317b9c8d28b6d76431c3',
    mnemonic:
      'horn tenant knee talent sponsor spell gate clip pulse soap slush warm silver nephew swap uncle crack brave',
    seed:
      'fd579828af3da1d32544ce4db5c73d53fc8acc4ddb1e3b251a31179cdb71e853c56d2fcb11aed39898ce6c34b10b5382772db8796e52837b54468aeb312cfc3d',
  },
  {
    entropy: '9f6a2878b2520799a44ef18bc7df394e7061a224d2c33cd015b157d746869863',
    mnemonic:
      'panda eyebrow bullet gorilla call smoke muffin taste mesh discover soft ostrich alcohol speed nation flash devote level hobby quick inner drive ghost inside',
    seed:
      '72be8e052fc4919d2adf28d5306b5474b0069df35b02303de8c1729c9538dbb6fc2d731d5f832193cd9fb6aeecbc469594a70e3dd50811b5067f3b88b28c3e8d',
  },
  {
    entropy: '23db8160a31d3e0dca3688ed941adbf3',
    mnemonic:
      'cat swing flag economy stadium alone churn speed unique patch report train',
    seed:
      'deb5f45449e615feff5640f2e49f933ff51895de3b4381832b3139941c57b59205a42480c52175b6efcffaa58a2503887c1e8b363a707256bdd2b587b46541f5',
  },
  {
    entropy: '8197a4a47f0425faeaa69deebc05ca29c0a5b5cc76ceacc0',
    mnemonic:
      'light rule cinnamon wrap drastic word pride squirrel upgrade then income fatal apart sustain crack supply proud access',
    seed:
      '4cbdff1ca2db800fd61cae72a57475fdc6bab03e441fd63f96dabd1f183ef5b782925f00105f318309a7e9c3ea6967c7801e46c8a58082674c860a37b93eda02',
  },
  {
    entropy: '066dca1a2bb7e8a1db2832148ce9933eea0f3ac9548d793112d9a95c9407efad',
    mnemonic:
      'all hour make first leader extend hole alien behind guard gospel lava path output census museum junior mass reopen famous sing advance salt reform',
    seed:
      '26e975ec644423f4a4c4f4215ef09b4bd7ef924e85d1d17c4cf3f136c2863cf6df0a475045652c57eb5fb41513ca2a2d67722b77e954b4b3fc11f7590449191d',
  },
  {
    entropy: 'f30f8c1da665478f49b001d94c5fc452',
    mnemonic:
      'vessel ladder alter error federal sibling chat ability sun glass valve picture',
    seed:
      '2aaa9242daafcee6aa9d7269f17d4efe271e1b9a529178d7dc139cd18747090bf9d60295d0ce74309a78852a9caadf0af48aae1c6253839624076224374bc63f',
  },
  {
    entropy: 'c10ec20dc3cd9f652c7fac2f1230f7a3c828389a14392f05',
    mnemonic:
      'scissors invite lock maple supreme raw rapid void congress muscle digital elegant little brisk hair mango congress clump',
    seed:
      '7b4a10be9d98e6cba265566db7f136718e1398c71cb581e1b2f464cac1ceedf4f3e274dc270003c670ad8d02c4558b2f8e39edea2775c9e232c7cb798b069e88',
  },
  {
    entropy: 'f585c11aec520db57dd353c69554b21a89b20fb0650966fa0a9d6f74fd989d8f',
    mnemonic:
      'void come effort suffer camp survey warrior heavy shoot primary clutch crush open amazing screen patrol group space point ten exist slush involve unfold',
    seed:
      '01f5bced59dec48e362f2c45b5de68b9fd6c92c6634f44d6d40aab69056506f0e35524a518034ddc1192e1dacd32c1ed3eaa3c3b131c88ed8e7e54c49a5d0998',
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

// Provenance: https://github.com/trezor/python-mnemonic/blob/master/vectors.json
// Public vectors and synthetic patterns/mutations only; never user mnemonics.
// Wallet Core's mnemonic APIs use English and expose no wordlist argument.

function extraHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extraDecodeFixtureEntropy(hex: string): Uint8Array {
  if (
    hex.length === 0 ||
    hex.length % 2 !== 0 ||
    /[^0-9a-fA-F]/u.test(hex)
  ) {
    throw new Error("Invalid fixture entropy hex");
  }

  return Uint8Array.from({ length: hex.length / 2 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
}

extraIt("Wallet Core agrees with every public BIP-39 vector", async () => {
  extraExpect.assertions(VECTORS.length * 4);
  const core = await loadCore();

  for (const vector of VECTORS) {
    const wallet = core.HDWallet.createWithMnemonic(vector.mnemonic, "TREZOR");
    try {
      extraExpect(extraHex(wallet.seed())).toBe(vector.seed);
      extraExpect(extraHex(wallet.entropy())).toBe(vector.entropy);
      extraExpect(wallet.mnemonic()).toBe(vector.mnemonic);
      extraExpect(core.Mnemonic.isValid(vector.mnemonic)).toBe(true);
    } finally {
      wallet.delete();
    }
  }
});

extraIt("160- and 224-bit patterns agree across all three engines", async () => {
  extraExpect.assertions(64);
  const core = await loadCore();

  for (const byteLength of [20, 28]) {
    const patterns = [
      "00".repeat(byteLength),
      "7f".repeat(byteLength),
      "ff".repeat(byteLength),
      extraHex(Uint8Array.from({ length: byteLength }, (_, index) => index)),
    ];

    for (const entropyHex of patterns) {
      const entropy = extraDecodeFixtureEntropy(entropyHex);
      const scureMnemonic = extraScure.entropyToMnemonic(entropy, extraEnglish);
      const bitcoinjsMnemonic = extraBitcoinjs.entropyToMnemonic(
        entropyHex,
        extraBitcoinjs.wordlists.english,
      );

      const entropyWallet = core.HDWallet.createWithEntropy(entropy, "TREZOR");
      try {
        const coreMnemonic = entropyWallet.mnemonic();
        const mnemonicWallet = core.HDWallet.createWithMnemonic(
          coreMnemonic,
          "TREZOR",
        );
        try {
          extraExpect(bitcoinjsMnemonic).toBe(scureMnemonic);
          extraExpect(coreMnemonic).toBe(scureMnemonic);

          extraExpect(
            extraHex(extraScure.mnemonicToEntropy(scureMnemonic, extraEnglish)),
          ).toBe(entropyHex);
          extraExpect(
            extraBitcoinjs.mnemonicToEntropy(
              bitcoinjsMnemonic,
              extraBitcoinjs.wordlists.english,
            ),
          ).toBe(entropyHex);
          extraExpect(extraHex(mnemonicWallet.entropy())).toBe(entropyHex);

          extraExpect(
            extraScure.validateMnemonic(scureMnemonic, extraEnglish),
          ).toBe(true);
          extraExpect(
            extraBitcoinjs.validateMnemonic(
              bitcoinjsMnemonic,
              extraBitcoinjs.wordlists.english,
            ),
          ).toBe(true);
          extraExpect(core.Mnemonic.isValid(coreMnemonic)).toBe(true);
        } finally {
          mnemonicWallet.delete();
        }
      } finally {
        entropyWallet.delete();
      }
    }
  }
});

extraIt("agrees on invalid and valid mutations of the 12-word zero vector", async () => {
  extraExpect.assertions(14);
  const core = await loadCore();
  const vector = VECTORS.find(({ entropy }) => entropy === "00".repeat(16));
  if (!vector) {
    throw new Error("Missing 128-bit zero vector in VECTORS");
  }

  const words = vector.mnemonic.split(" ");
  extraExpect(words).toHaveLength(12);

  const mutations = [
    { index: 11, replacement: "abandon", valid: false },
    { index: 11, replacement: "zoo", valid: false },
    { index: 11, replacement: "ability", valid: false },
    { index: 4, replacement: "ahead", valid: true }, // Word 5, one-based.
  ] as const;

  let sawValidMutation = false;
  for (const mutation of mutations) {
    const mutatedWords = [...words];
    mutatedWords[mutation.index] = mutation.replacement;
    const mnemonic = mutatedWords.join(" ");

    const scureValid = extraScure.validateMnemonic(mnemonic, extraEnglish);
    const bitcoinjsValid = extraBitcoinjs.validateMnemonic(
      mnemonic,
      extraBitcoinjs.wordlists.english,
    );
    const coreValid = core.Mnemonic.isValid(mnemonic);

    extraExpect(bitcoinjsValid).toBe(scureValid);
    extraExpect(coreValid).toBe(scureValid);
    extraExpect(scureValid).toBe(mutation.valid);
    sawValidMutation = sawValidMutation || scureValid;
  }

  extraExpect(sawValidMutation).toBe(true);
});

extraIt("strictly decodes fixture entropy while accepting uppercase hex", () => {
  extraExpect.assertions(8);
  const hex = "000102030405060708090a0b0c0d0e0f";

  extraExpect(extraDecodeFixtureEntropy(hex.toUpperCase())).toEqual(
    Uint8Array.from({ length: 16 }, (_, index) => index),
  );

  const rejected = [
    "",
    hex.slice(0, -1), // Odd length.
    `${hex.slice(0, 2)}  ${hex.slice(2)}`, // Even-length embedded whitespace.
    `${hex}\n`,
    `${hex}\r\n`, // Even length: must not slip through a permissive $ anchor.
    `${hex}zz`,
    `${hex}0g`, // parseInt alone would accept the leading zero.
  ];

  for (const malformed of rejected) {
    extraExpect(() => extraDecodeFixtureEntropy(malformed)).toThrow(
      "Invalid fixture entropy hex",
    );
  }
});

extraIt("insulates explicit English oracles from bitcoinjs's default wordlist", () => {
  extraExpect.assertions(4);
  const vector = VECTORS[0];
  if (!vector) {
    throw new Error("VECTORS must contain public BIP-39 fixtures");
  }

  const entropy = extraDecodeFixtureEntropy(vector.entropy);
  const readExplicitOracle = () => ({
    scure: {
      mnemonic: extraScure.entropyToMnemonic(entropy, extraEnglish),
      entropy: extraHex(
        extraScure.mnemonicToEntropy(vector.mnemonic, extraEnglish),
      ),
      valid: extraScure.validateMnemonic(vector.mnemonic, extraEnglish),
    },
    bitcoinjs: {
      mnemonic: extraBitcoinjs.entropyToMnemonic(
        vector.entropy,
        extraBitcoinjs.wordlists.english,
      ),
      entropy: extraBitcoinjs.mnemonicToEntropy(
        vector.mnemonic,
        extraBitcoinjs.wordlists.english,
      ),
      valid: extraBitcoinjs.validateMnemonic(
        vector.mnemonic,
        extraBitcoinjs.wordlists.english,
      ),
    },
  });

  const before = readExplicitOracle();
  try {
    extraBitcoinjs.setDefaultWordlist("japanese");
    extraExpect(extraBitcoinjs.getDefaultWordlist()).toBe("japanese");

    const after = readExplicitOracle();
    extraExpect(after).toEqual(before);

    const expected = {
      mnemonic: vector.mnemonic,
      entropy: vector.entropy,
      valid: true,
    };
    extraExpect(after).toEqual({ scure: expected, bitcoinjs: expected });
  } finally {
    extraBitcoinjs.setDefaultWordlist("english");
  }

  extraExpect(extraBitcoinjs.getDefaultWordlist()).toBe("english");
});
