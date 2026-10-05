#!/usr/bin/env python3
"""Independent public-vector checks using bip_utils.

This file contains only synthetic/public test material. Never place a real
wallet mnemonic or seed in CI fixtures.
"""
from __future__ import annotations

from bip_utils import (
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


if __name__ == "__main__":
    main()
