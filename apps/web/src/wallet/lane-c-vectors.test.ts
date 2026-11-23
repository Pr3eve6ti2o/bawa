// Lane C regression vectors: every chain, every index, from two
// INDEPENDENT oracles that agree (bip_utils 2.12.2 in Python and Trust
// Wallet Core 4.9.3 in Node — see test/differential_test.py and
// tests/mainnet-derivation-vectors.test.mjs for the same method on the
// first four chains). Generated mechanically from the oracle outputs for
// the PUBLISHED ripple fixture below; never hand-edited. The words are
// public test data, never for funds: anyone can derive the same keys.
//
// Fixture: 'ripple scissors kick mammal hire column oak again sun offer
// wealth tomorrow wagon turn fatal' (BIP-39 test vector, empty
// passphrase). Indexes 0, 1, 2, 5; account 1 index 0. TON/SOL follow
// the Lane A Ed25519 scheme: account 0 index 0 keeps the legacy
// address; new accounts and rotations derive distinct addresses on
// hardened paths (SOL m/44'/501'/<account>'/0'/<index>', TON
// m/44'/607'/<account>'/<index>').
import { describe, expect, it } from 'vitest';
import {
  deriveAddresses,
  deriveAddressesAt,
  deriveFromXpub,
  getAccountExtendedPublicKey,
} from './core';
import type { ChainId } from '../engine/boundary';

const RIPPLE_MNEMONIC =
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';

const EXPECTED: Record<string, Record<string, string>> = {
  '0': {
    arb: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    aurora: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    avax: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    base: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    bsc: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    btc: 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
    celo: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    doge: 'DTkd5ZVxsernAkEVuvyp7bAW3oMYz9nH5H',
    eth: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    fantom: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    gnosis: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    linea: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    ltc: 'ltc1qrw5czevuyhhgzrz2ca6hd8ulncqwnl8dp6gtca',
    mantle: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    matic: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    metis: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    op: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    opbnb: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    scroll: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
    sol: 'DrKpwo8t8SihRstTGNeeEHu1PAcu6QThyvegqDMXiroF',
    ton: 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
    trx: 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
  },
  '1': {
    arb: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    aurora: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    avax: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    base: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    bsc: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    btc: 'bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za',
    celo: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    doge: 'DTZz4xP4sUGxfRrzkRapvXjN335EtPKsED',
    eth: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    fantom: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    gnosis: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    linea: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    ltc: 'ltc1qnrg9a67uxcsw446sy2l9twevck0s4t06fdkvx8',
    mantle: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    matic: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    metis: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    op: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    opbnb: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    scroll: '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    sol: 'AU4y4CsLpaVSVSN5q7yxRFVmhyq7aVZYRCJ4FjyVtx6e',
    ton: 'UQCxyaBqitW8KZHU6Q3buXaThb5q_dLacLHFeSx2Id-gJ-qR',
    trx: 'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B',
  },
  '2': {
    arb: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    aurora: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    avax: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    base: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    bsc: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    btc: 'bc1q7zddsunzaftf4zlsg9exhzlkvc5374a6v32jf6',
    celo: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    doge: 'DBXk4L37TaAShU2YfVWc8su9LK8my7DC4u',
    eth: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    fantom: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    gnosis: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    linea: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    ltc: 'ltc1qwwclgsz60espa05htre7c9ehaxsezcth2tqd9h',
    mantle: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    matic: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    metis: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    op: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    opbnb: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    scroll: '0x86E2Caa79Ed5bF6DB3Edd320bB1570506FaeFc4e',
    sol: 'FtnuwnUeWYR2YsmXpc278TM4RP1SPBuzvi62F7nxup82',
    ton: 'UQBZCscMtjcU4EEQ0qpo5i52bbIyNmAxSJkCPqNAFWpTL8B6',
    trx: 'TRjqesRhNSRch2KTzjAAnYZ2pMTWnRzgnv',
  },
  '5': {
    arb: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    aurora: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    avax: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    base: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    bsc: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    btc: 'bc1qz5tgrjxzfzh6mq9w5lf96ufk0xum8cahgfxwk0',
    celo: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    doge: 'D8BWwAq2v8bAqzV6t1CGLe4o6NC4rxAY1j',
    eth: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    fantom: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    gnosis: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    linea: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    ltc: 'ltc1q0fla96ja4fmzcsd4xp8t8sxnshkemd46wjku4c',
    mantle: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    matic: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    metis: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    op: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    opbnb: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    scroll: '0xAb119efEbeB7D26E78F041b15AB01CfFf873a5B6',
    sol: '6cAMZZRPiC6nWrci1ogUuFDMfP2MTt1uAeSUt5Z8Hb4v',
    ton: 'UQBK12yq57L4vc3gW3s5b-g1AktxvSM_teNX9Q_I4a9PpnpI',
    trx: 'TYRyHLdXNdsKxLZyJqMVxvCXE1tLSDEHQt',
  },
};

const ACCOUNT_XPUBS: Record<string, string> = {
  btc: 'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9',
  eth: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  trx: 'xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF',
  bsc: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  matic: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  arb: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  op: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  base: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  avax: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  ltc: 'Ltub2YwB7k9sjn5JgCMHzxRYAWdTwJcaxjLSoaCpYjJZ2xN1bh9BdB1y3BXBiSobcrSnHj4WnopzaoK8J5L5nJzeqmJhkeDVCb52cb2WM3UaH4h',
  doge: 'dpubZG2yVAE9cxzbb951cYM2av1gxG46wXAdAKDDJEcTLC7cSFUvHbVo8mMYqZDAe2dPyigxSve76Kvi537CVzxjyhZnNPCRBCm6HJKTqYSjKSn',
  gnosis: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  celo: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  linea: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  mantle: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  scroll: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  opbnb: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  metis: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  aurora: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
  fantom: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
};

const ACCOUNT1_INDEX0: Record<string, string> = {
  btc: 'bc1qn5edktucrclgejfrs9wffyy50uqfuad2ylshtd',
  doge: 'DPn7x7zqf9cVbSrdXUDua9JUy7dZwmPF4E',
  eth: '0x68eF4e5660620976a5968c7d7925753D3Cc40809',
  ltc: 'ltc1qs37jsrxd2ehfv3yehn2qk67w239nk0tr4cn2t7',
  sol: 'BZbH77EFbwUfzYhz89qvnQdrx8y1tXxofJNbj7YsjqUj',
  ton: 'UQBE_LQuVmQ1Ya6f419kJ57KSmyNuQ5SAtWj73uPei7P-mff',
  trx: 'TTb87dRxjSTruAk7dMsfVhdEYENjpdWmvn',
};

// Strict indexed access: a missing vector is a test bug, so fail loudly
// instead of comparing against undefined.
function expected(index: number, chain: ChainId): string {
  const row = EXPECTED[String(index)];
  if (!row) throw new Error(`missing vector row ${index}`);
  const value = row[chain];
  if (value === undefined) throw new Error(`missing vector ${chain} ${index}`);
  return value;
}

function accountXpub(chain: ChainId): string {
  const value = ACCOUNT_XPUBS[chain];
  if (value === undefined) throw new Error(`missing xpub vector ${chain}`);
  return value;
}

function account1Address(chain: ChainId): string {
  const value = ACCOUNT1_INDEX0[chain];
  if (value === undefined) throw new Error(`missing account-1 vector ${chain}`);
  return value;
}

const CHAINS: ChainId[] = [
  'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base',
  'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll',
  'opbnb', 'metis', 'aurora', 'fantom',
];

const XPUB_CHAINS: ChainId[] = [
  'btc', 'eth', 'trx', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc',
  'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis',
  'aurora', 'fantom',
];

describe('lane-c vectors (ripple fixture, all 22 chains)', () => {
  it('deriveAddressesAt matches both oracles at indexes 0, 1, 2, 5', async () => {
    for (const index of [0, 1, 2, 5]) {
      const got = await deriveAddressesAt(RIPPLE_MNEMONIC, '', 0, index);
      for (const chain of CHAINS) {
        expect(got[chain], `${chain} index ${index}`).toBe(
          expected(index, chain),
        );
      }
    }
  });

  it('deriveAddresses (index 0) matches the vectors', async () => {
    const got = await deriveAddresses(RIPPLE_MNEMONIC, '');
    for (const chain of CHAINS) {
      expect(got[chain], `${chain} index 0`).toBe(expected(0, chain));
    }
  });

  it('the exported account keys round-trip to the same addresses', async () => {
    for (const chain of XPUB_CHAINS) {
      const exported = await getAccountExtendedPublicKey(
        RIPPLE_MNEMONIC, '', chain, 0,
      );
      expect(exported, `${chain} export`).toBe(accountXpub(chain));
      for (const index of [0, 1, 2, 5]) {
        expect(await deriveFromXpub(chain, exported, index)).toBe(
          expected(index, chain),
        );
      }
    }
  });

  it('account 1 differs from account 0 on every chain (Lane A: SOL/TON too)', async () => {
    const acc1 = await deriveAddressesAt(RIPPLE_MNEMONIC, '', 1, 0);
    for (const chain of ['btc', 'eth', 'trx', 'ltc', 'doge', 'sol', 'ton'] as ChainId[]) {
      expect(acc1[chain], `${chain} account 1`).toBe(account1Address(chain));
      expect(acc1[chain]).not.toBe(expected(0, chain));
    }
  });
});
