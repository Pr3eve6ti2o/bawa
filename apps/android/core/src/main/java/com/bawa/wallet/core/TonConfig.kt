package com.bawa.wallet.core

/**
 * TON wallet configuration. TON cross-wallet compatibility is NOT
 * established (audit §b, docs 02): the address depends on contract
 * version, wallet_id/subwallet, workchain, and network, and Core's TON
 * result was never compared with another TON wallet. The app MUST
 * record this full config at creation and MUST NOT promise that
 * another TON wallet importing the same phrase yields the same address.
 */
data class TonConfig(
    /** e.g. "v4r2" — the wallet contract version Core used. */
    val contractVersion: String,
    /** Wallet id / subwallet id used by the contract. */
    val walletId: Long,
    /** Workchain: 0 (basechain) or -1 (masterchain). */
    val workchain: Int,
    /** "testnet" in this app — mainnet is absent, never a flag. */
    val network: String,
    /** Path recorded from Core at generation (e.g. m/44'/607'/0'). */
    val tonPath: String,
    /** The single deposit address for this wallet. */
    val depositAddress: String,
) {
    /**
     * Creation-time check: everything except the deposit address,
     * which is unknown until Core derives it. The full [validate]
     * must still pass on the final config before it is stored.
     */
    fun validateBasics(): Result<Unit> {
        if (contractVersion.isBlank()) return Result.failure(EngineError.InvalidTonConfig("contractVersion is blank"))
        if (workchain != 0 && workchain != -1) return Result.failure(EngineError.InvalidTonConfig("workchain must be 0 or -1"))
        if (network != "testnet") return Result.failure(EngineError.InvalidTonConfig("only testnet is supported"))
        if (tonPath.isBlank()) return Result.failure(EngineError.InvalidTonConfig("tonPath is blank"))
        return Result.success(Unit)
    }

    fun validate(): Result<Unit> {
        if (contractVersion.isBlank()) return Result.failure(EngineError.InvalidTonConfig("contractVersion is blank"))
        if (workchain != 0 && workchain != -1) return Result.failure(EngineError.InvalidTonConfig("workchain must be 0 or -1"))
        if (network != "testnet") return Result.failure(EngineError.InvalidTonConfig("only testnet is supported"))
        if (tonPath.isBlank()) return Result.failure(EngineError.InvalidTonConfig("tonPath is blank"))
        if (!Validation.isValidTon(depositAddress)) {
            return Result.failure(EngineError.InvalidTonConfig("depositAddress is not a valid TON address"))
        }
        return Result.success(Unit)
    }
}
