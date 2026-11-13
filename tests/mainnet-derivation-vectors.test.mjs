// Mainnet derivation vectors — regression test (T30).
//
// NEVER fund any address in this file. Every fixture below is published
// test data (BIP-32 / BIP-84 / Hardhat / Trust Wallet Core test vectors):
// the words are public, anyone can derive the same keys, and funds sent
// to these addresses can be stolen. These are regression targets only.
// Nothing here touches the network; all derivation is offline.
//
// Two implementations must agree, per docs/11 and docs/mainnet:
//   - this file: Trust Wallet Core 4.9.3 (WASM) via HDWallet;
//   - test/differential_test.py: Python bip_utils 2.12.2 (independent).
// TON is additionally cross-checked with @ton/ton 15.4.0 in the T30 lane
// evidence (WalletContractV4, walletId 698983191, workchain 0).
//
// Known Core limitation (verified first-hand on 4.8.4, 2026-11-12;
// re-verified on 4.9.3, 2026-11-13):
// CoinTypeExt.deriveAddressFromPublicKey(tron, pubkey) ABORTS the WASM
// runtime when the public key comes from getKey().getPublicKeySecp256k1().
// The supported TRON routes are getAddressForCoin (index 0) and
// derive.js from an extended public key (used for TRX index 1 below).
// Do not add a direct TRON getKey-then-derive assertion here: the abort
// kills the whole test runner instead of failing one test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const toolsDir = join(repoRoot, 'tools', 'hdwallet-gen');
const require = createRequire(join(toolsDir, 'package.json'));
const { initWasm } = require(join(toolsDir, 'node_modules', '@trustwallet', 'wallet-core'));

// Published fixtures. The words below are the published test vectors
// already recorded in docs/11 and docs/mainnet; they are not credentials.
const RIPPLE_FIXTURE = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const ABANDON_FIXTURE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const HARDHAT_FIXTURE = 'test test test test test test test test test test test junk';

const EXPECTED = {
  ripple: {
    btc0: 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
    btc1: 'bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za',
    btcChange0: 'bc1qx3hncnu3lknuejrmzse4nf2yjwpaskgn6tpnve',
    eth0: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    eth1: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    trx0: 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
    trx1: 'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B',
    ton: 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
    tonPubkey: 'c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9',
    btcZpub: 'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9',
    ethXpub: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
    trxXpub: 'xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF',
  },
  abandon: {
    zpub: 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
    btc0: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
    btc1: 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g',
    btcChange0: 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el',
  },
  hardhat: {
    eth0: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
};

const core = await initWasm();

function addressAt(wallet, coin, path) {
  const priv = wallet.getKey(coin, path);
  try {
    const pub = coin === core.CoinType.ton
      ? priv.getPublicKeyEd25519()
      : priv.getPublicKeySecp256k1(true);
    try {
      return core.CoinTypeExt.deriveAddressFromPublicKey(coin, pub);
    } finally {
      pub.delete();
    }
  } finally {
    priv.delete();
  }
}

function deriveViaXpub(chain, index, xpub) {
  const result = spawnSync(
    process.execPath,
    ['tools/hdwallet-gen/derive.js', chain, String(index)],
    { cwd: repoRoot, input: `${xpub}\n`, encoding: 'utf8' },
  );
  assert.equal(
    result.status,
    0,
    `${chain} index ${index} via derive.js failed: ${result.error?.message || result.stderr}`,
  );
  return result.stdout.trim();
}

describe('mainnet derivation vectors (T30)', () => {
  test('ripple: index-0 addresses match on all four chains', () => {
    const wallet = core.HDWallet.createWithMnemonic(RIPPLE_FIXTURE, '');
    try {
      assert.equal(wallet.getAddressForCoin(core.CoinType.bitcoin), EXPECTED.ripple.btc0);
      assert.equal(wallet.getAddressForCoin(core.CoinType.ethereum), EXPECTED.ripple.eth0);
      assert.equal(wallet.getAddressForCoin(core.CoinType.tron), EXPECTED.ripple.trx0);
      assert.equal(wallet.getAddressForCoin(core.CoinType.ton), EXPECTED.ripple.ton);
    } finally {
      wallet.delete();
    }
  });

  test('ripple: BTC/ETH index 1 and BTC change match the independent reference', () => {
    const wallet = core.HDWallet.createWithMnemonic(RIPPLE_FIXTURE, '');
    try {
      assert.equal(addressAt(wallet, core.CoinType.bitcoin, "m/84'/0'/0'/0/1"), EXPECTED.ripple.btc1);
      assert.equal(addressAt(wallet, core.CoinType.bitcoin, "m/84'/0'/0'/1/0"), EXPECTED.ripple.btcChange0);
      assert.equal(addressAt(wallet, core.CoinType.ethereum, "m/44'/60'/0'/0/1"), EXPECTED.ripple.eth1);
    } finally {
      wallet.delete();
    }
  });

  test('ripple: TRX index 1 matches via the watch-only path', () => {
    const wallet = core.HDWallet.createWithMnemonic(RIPPLE_FIXTURE, '');
    let trxXpub;
    try {
      trxXpub = wallet.getExtendedPublicKeyAccount(
        core.Purpose.bip44, core.CoinType.tron, core.Derivation.default, core.HDVersion.xpub, 0,
      );
    } finally {
      wallet.delete();
    }
    assert.equal(trxXpub, EXPECTED.ripple.trxXpub);
    assert.equal(deriveViaXpub('trx', 0, trxXpub), EXPECTED.ripple.trx0);
    assert.equal(deriveViaXpub('trx', 1, trxXpub), EXPECTED.ripple.trx1);
  });

  test('ripple: account extended public keys match the published nodes', () => {
    const wallet = core.HDWallet.createWithMnemonic(RIPPLE_FIXTURE, '');
    try {
      assert.equal(
        wallet.getExtendedPublicKeyAccount(
          core.Purpose.bip84, core.CoinType.bitcoin, core.Derivation.bitcoinSegwit, core.HDVersion.zpub, 0,
        ),
        EXPECTED.ripple.btcZpub,
      );
      assert.equal(
        wallet.getExtendedPublicKeyAccount(
          core.Purpose.bip44, core.CoinType.ethereum, core.Derivation.default, core.HDVersion.xpub, 0,
        ),
        EXPECTED.ripple.ethXpub,
      );
      assert.equal(
        wallet.getExtendedPublicKeyAccount(
          core.Purpose.bip44, core.CoinType.tron, core.Derivation.default, core.HDVersion.xpub, 0,
        ),
        EXPECTED.ripple.trxXpub,
      );
    } finally {
      wallet.delete();
    }
  });

  test('ripple: TON public key and contract identity match', () => {
    const wallet = core.HDWallet.createWithMnemonic(RIPPLE_FIXTURE, '');
    try {
      const priv = wallet.getKey(core.CoinType.ton, "m/44'/607'/0'");
      try {
        const pub = priv.getPublicKeyEd25519();
        try {
          assert.equal(Buffer.from(pub.data()).toString('hex'), EXPECTED.ripple.tonPubkey);
        } finally {
          pub.delete();
        }
      } finally {
        priv.delete();
      }
      assert.equal(addressAt(wallet, core.CoinType.ton, "m/44'/607'/0'"), EXPECTED.ripple.ton);
    } finally {
      wallet.delete();
    }
  });

  test('BIP-84 abandon anchors match the specification', () => {
    const wallet = core.HDWallet.createWithMnemonic(ABANDON_FIXTURE, '');
    try {
      assert.equal(
        wallet.getExtendedPublicKeyAccount(
          core.Purpose.bip84, core.CoinType.bitcoin, core.Derivation.bitcoinSegwit, core.HDVersion.zpub, 0,
        ),
        EXPECTED.abandon.zpub,
      );
      assert.equal(addressAt(wallet, core.CoinType.bitcoin, "m/84'/0'/0'/0/0"), EXPECTED.abandon.btc0);
      assert.equal(addressAt(wallet, core.CoinType.bitcoin, "m/84'/0'/0'/0/1"), EXPECTED.abandon.btc1);
      assert.equal(addressAt(wallet, core.CoinType.bitcoin, "m/84'/0'/0'/1/0"), EXPECTED.abandon.btcChange0);
    } finally {
      wallet.delete();
    }
  });

  test('Hardhat account 0 matches', () => {
    const wallet = core.HDWallet.createWithMnemonic(HARDHAT_FIXTURE, '');
    try {
      assert.equal(addressAt(wallet, core.CoinType.ethereum, "m/44'/60'/0'/0/0"), EXPECTED.hardhat.eth0);
    } finally {
      wallet.delete();
    }
  });
});
