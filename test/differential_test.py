#!/usr/bin/env python3
"""Independent public-vector checks using bip_utils (T30).

This file contains only synthetic/public test material. Never place a real
wallet mnemonic or seed in CI fixtures. Never fund any address below:
every fixture is a published test vector, the words are public, and funds
sent to these addresses can be stolen. These are regression targets only.

Coverage (all offline, all against the published expectations):
  - ripple fixture: BTC/ETH/TRX index 0 and 1, BTC change 0, TON address
    and SLIP-0010 Ed25519 public key (Wallet V4 R2, wallet id 698983191,
    workchain 0 in the Node-side check);
  - BIP-84 abandon anchors: account zpub, first/second receiving and
    first change addresses (BIP-84 specification);
  - Hardhat account 0 (ETH);
  - BIP-32 test vector 1: extended public keys at m, m/0', m/0'/1,
    m/0'/1/2', m/0'/1/2'/2 and m/0'/1/2'/2/1000000000 (xpubs only;
    the matching xprv values are intentionally not reproduced here).
The Node-side mirror is tests/mainnet-derivation-vectors.test.mjs
(Trust Wallet Core 4.8.4); the two must agree on every shared value.
"""
from __future__ import annotations

from bip_utils import (
    Bip32Slip10Ed25519,
    Bip32Slip10Secp256k1,
    Bip39SeedGenerator,
    Bip44,
    Bip44Coins,
    Bip44Changes,
    Bip84,
    Bip84Coins,
)

MNEMONIC = (
    "ripple scissors kick mammal hire column oak again sun offer wealth "
    "tomorrow wagon turn fatal"
)
EXPECTED_BTC = "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd"
EXPECTED_ETH = "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7"
EXPECTED_BTC_1 = "bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za"
EXPECTED_BTC_CHANGE_0 = "bc1qx3hncnu3lknuejrmzse4nf2yjwpaskgn6tpnve"
EXPECTED_ETH_1 = "0xD6c3112a8Db4991a7359018F15e501dfEE316d59"
EXPECTED_TRX = "TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c"
EXPECTED_TRX_1 = "TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B"
EXPECTED_TON = "UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn"
# Ed25519 public key at m/44'/607'/0'. bip_utils returns it with the 0x00
# Ed25519 prefix byte, hence the "00" prefix in the comparison.
EXPECTED_TON_PUBKEY = "c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9"

ABANDON_FIXTURE = (
    "abandon abandon abandon abandon abandon abandon abandon abandon "
    "abandon abandon abandon about"
)
EXPECTED_ABANDON_ZPUB = (
    "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs"
)
EXPECTED_ABANDON_BTC_0 = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"
EXPECTED_ABANDON_BTC_1 = "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g"
EXPECTED_ABANDON_BTC_CHANGE_0 = "bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el"

HARDHAT_FIXTURE = "test test test test test test test test test test test junk"
EXPECTED_HARDHAT_ETH_0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

TV1_SEED_HEX = "000102030405060708090a0b0c0d0e0f"
EXPECTED_TV1_XPUBS = {
    "m": "xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8",
    "m/0'": "xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw",
    "m/0'/1": "xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ",
    "m/0'/1/2'": "xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5",
    "m/0'/1/2'/2": "xpub6FHa3pjLCk84BayeJxFW2SP4XRrFd1JYnxeLeU8EqN3vDfZmbqBqaGJAyiLjTAwm6ZLRQUMv1ZACTj37sR62cfN7fe5JnJ7dh8zL4fiyLHV",
    "m/0'/1/2'/2/1000000000": "xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy",
}


def _bip44_address(seed_bytes, coin, change, index):
    return (
        Bip44.FromSeed(seed_bytes, coin)
        .Purpose()
        .Coin()
        .Account(0)
        .Change(change)
        .AddressIndex(index)
        .PublicKey()
        .ToAddress()
    )


def main() -> None:
    seed = Bip39SeedGenerator(MNEMONIC).Generate()

    btc = (
        Bip84.FromSeed(seed, Bip84Coins.BITCOIN)
        .Purpose()
        .Coin()
        .Account(0)
        .Change(Bip44Changes.CHAIN_EXT)
        .AddressIndex(0)
    )
    eth = (
        Bip44.FromSeed(seed, Bip44Coins.ETHEREUM)
        .Purpose()
        .Coin()
        .Account(0)
        .Change(Bip44Changes.CHAIN_EXT)
        .AddressIndex(0)
    )

    btc_address = btc.PublicKey().ToAddress()
    eth_address = eth.PublicKey().ToAddress()

    assert btc_address == EXPECTED_BTC, (btc_address, EXPECTED_BTC)
    assert eth_address == EXPECTED_ETH, (eth_address, EXPECTED_ETH)

    print("bip_utils reference checks: PASS")
    print(f"BTC m/84'/0'/0'/0/0: {btc_address}")
    print(f"ETH m/44'/60'/0'/0/0: {eth_address}")

    # Ripple fixture, extended coverage: index 1, change, TRX and TON.
    btc_ctx = Bip84.FromSeed(seed, Bip84Coins.BITCOIN).Purpose().Coin().Account(0)
    btc_1 = btc_ctx.Change(Bip44Changes.CHAIN_EXT).AddressIndex(1).PublicKey().ToAddress()
    btc_change_0 = btc_ctx.Change(Bip44Changes.CHAIN_INT).AddressIndex(0).PublicKey().ToAddress()
    assert btc_1 == EXPECTED_BTC_1, (btc_1, EXPECTED_BTC_1)
    assert btc_change_0 == EXPECTED_BTC_CHANGE_0, (btc_change_0, EXPECTED_BTC_CHANGE_0)
    eth_1 = _bip44_address(seed, Bip44Coins.ETHEREUM, Bip44Changes.CHAIN_EXT, 1)
    assert eth_1 == EXPECTED_ETH_1, (eth_1, EXPECTED_ETH_1)
    trx_0 = _bip44_address(seed, Bip44Coins.TRON, Bip44Changes.CHAIN_EXT, 0)
    trx_1 = _bip44_address(seed, Bip44Coins.TRON, Bip44Changes.CHAIN_EXT, 1)
    assert trx_0 == EXPECTED_TRX, (trx_0, EXPECTED_TRX)
    assert trx_1 == EXPECTED_TRX_1, (trx_1, EXPECTED_TRX_1)
    print(f"BTC m/84'/0'/0'/0/1: {btc_1}")
    print(f"BTC m/84'/0'/0'/1/0: {btc_change_0}")
    print(f"ETH m/44'/60'/0'/0/1: {eth_1}")
    print(f"TRX m/44'/195'/0'/0/0: {trx_0}")
    print(f"TRX m/44'/195'/0'/0/1: {trx_1}")

    # TON has no change/index levels: the account key itself is the address.
    ton_ctx = Bip44.FromSeed(seed, Bip44Coins.TON).Purpose().Coin().Account(0)
    ton_address = ton_ctx.PublicKey().ToAddress()
    ton_slip = Bip32Slip10Ed25519.FromSeed(seed).DerivePath("m/44'/607'/0'")
    ton_pubkey_hex = ton_slip.PublicKey().RawCompressed().ToHex()
    assert ton_address == EXPECTED_TON, (ton_address, EXPECTED_TON)
    assert ton_pubkey_hex == "00" + EXPECTED_TON_PUBKEY, (ton_pubkey_hex, EXPECTED_TON_PUBKEY)
    print(f"TON m/44'/607'/0': {ton_address}")
    print(f"TON Ed25519 pubkey: {EXPECTED_TON_PUBKEY}")

    # BIP-84 abandon anchors (BIP-84 specification).
    seed_abandon = Bip39SeedGenerator(ABANDON_FIXTURE).Generate()
    abandon_ctx = Bip84.FromSeed(seed_abandon, Bip84Coins.BITCOIN).Purpose().Coin().Account(0)
    abandon_zpub = abandon_ctx.PublicKey().ToExtended()
    abandon_btc_0 = abandon_ctx.Change(Bip44Changes.CHAIN_EXT).AddressIndex(0).PublicKey().ToAddress()
    abandon_btc_1 = abandon_ctx.Change(Bip44Changes.CHAIN_EXT).AddressIndex(1).PublicKey().ToAddress()
    abandon_change_0 = abandon_ctx.Change(Bip44Changes.CHAIN_INT).AddressIndex(0).PublicKey().ToAddress()
    assert abandon_zpub == EXPECTED_ABANDON_ZPUB, (abandon_zpub, EXPECTED_ABANDON_ZPUB)
    assert abandon_btc_0 == EXPECTED_ABANDON_BTC_0, (abandon_btc_0, EXPECTED_ABANDON_BTC_0)
    assert abandon_btc_1 == EXPECTED_ABANDON_BTC_1, (abandon_btc_1, EXPECTED_ABANDON_BTC_1)
    assert abandon_change_0 == EXPECTED_ABANDON_BTC_CHANGE_0, (abandon_change_0, EXPECTED_ABANDON_BTC_CHANGE_0)
    print(f"BIP-84 abandon zpub m/84'/0'/0': {abandon_zpub}")
    print(f"BIP-84 abandon BTC m/84'/0'/0'/0/0: {abandon_btc_0}")

    # Hardhat account 0.
    seed_hardhat = Bip39SeedGenerator(HARDHAT_FIXTURE).Generate()
    hardhat_eth_0 = _bip44_address(seed_hardhat, Bip44Coins.ETHEREUM, Bip44Changes.CHAIN_EXT, 0)
    assert hardhat_eth_0 == EXPECTED_HARDHAT_ETH_0, (hardhat_eth_0, EXPECTED_HARDHAT_ETH_0)
    print(f"Hardhat ETH m/44'/60'/0'/0/0: {hardhat_eth_0}")

    # BIP-32 test vector 1 extended public keys (xpubs only).
    tv1_seed = bytes.fromhex(TV1_SEED_HEX)
    tv1_ctx = Bip32Slip10Secp256k1.FromSeed(tv1_seed)
    for path, expected_xpub in EXPECTED_TV1_XPUBS.items():
        xpub = tv1_ctx.DerivePath(path).PublicKey().ToExtended()
        assert xpub == expected_xpub, (path, xpub, expected_xpub)
        print(f"BIP-32 TV1 {path}: {xpub}")

    print("bip_utils extended reference checks: PASS")


if __name__ == "__main__":
    main()
