package com.bawa.wallet.core

/**
 * Published test vectors ONLY. Never a real wallet, never funded.
 * These are the repo's published fixtures (docs 14 §1, W1 verification):
 * Core + bip_utils agree on all 8 BTC/ETH/TRX addresses at indices 0/1.
 * The BTC vector is mainnet-formatted; testnet integration needs
 * separate configuration. The TON address below was derived by Core
 * from the same published vector (W1) — it is NOT a cross-wallet
 * promise (see TonConfig).
 */
object Fixtures {
    const val BTC_ADDRESS_0 = "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd"
    const val ETH_ADDRESS_0 = "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7"
    const val TRX_ADDRESS_0 = "TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c"
    const val TRX_ADDRESS_1 = "TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B"
    const val TON_ADDRESS_FROM_VECTOR = "UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn"

    const val TRON_COIN_VALUE = 195
    const val TON_COIN_VALUE = 607

    /** The fixture gate (design §1): runs offline before any wallet op. */
    data class FixtureCheck(val name: String, val passed: Boolean, val detail: String)

    /**
     * Pure-logic portion of the gate (no Core needed): coin values and
     * address-format validation of every published fixture. The Core
     * portion (derivation equality) lives in CoreWalletEngine and must
     * also pass; either half failing blocks all wallet actions with
     * "Wallet self-check failed. Wallet operations are disabled."
     */
    fun pureChecks(): List<FixtureCheck> = listOf(
        FixtureCheck(
            "tron-coin-value", Chain.TRX.slip44 == TRON_COIN_VALUE,
            "TRON slip44=${Chain.TRX.slip44}",
        ),
        FixtureCheck(
            "ton-coin-value", Chain.TON.slip44 == TON_COIN_VALUE,
            "TON slip44=${Chain.TON.slip44}",
        ),
        FixtureCheck(
            "btc-fixture-valid", Validation.isValidBtcSegwit(BTC_ADDRESS_0),
            "BTC fixture validates",
        ),
        FixtureCheck(
            "eth-fixture-valid", Validation.isValidEth(ETH_ADDRESS_0),
            "ETH fixture validates (EIP-55)",
        ),
        FixtureCheck(
            "trx-fixture-0-valid", Validation.isValidTrx(TRX_ADDRESS_0),
            "TRX fixture 0 validates (Base58Check)",
        ),
        FixtureCheck(
            "trx-fixture-1-valid", Validation.isValidTrx(TRX_ADDRESS_1),
            "TRX fixture 1 validates (Base58Check)",
        ),
        FixtureCheck(
            "ton-fixture-valid", Validation.isValidTon(TON_ADDRESS_FROM_VECTOR),
            "TON fixture validates (friendly CRC16)",
        ),
    )

    fun pureGatePasses(): Boolean = pureChecks().all { it.passed }
}
