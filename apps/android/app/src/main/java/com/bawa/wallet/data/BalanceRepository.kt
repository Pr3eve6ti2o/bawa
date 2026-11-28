package com.bawa.wallet.data

// Balance lookups. Step 3 wires the contract and the honest
// unavailable state; live balances need the Step 5 network stack
// (INTERNET is declared in the manifest for it, but the app makes
// no network calls yet). No balance is ever invented: without a
// provider the only answer is Unavailable, never $0.00.
sealed interface BalanceResult {
    data class Available(
        /** Raw balance in the asset's smallest unit. */
        val rawAmount: String,
        val decimals: Int
    ) : BalanceResult

    data class Unavailable(val reason: String) : BalanceResult
}

interface BalanceRepository {
    suspend fun balance(chainId: String, address: String): BalanceResult
}

/** Step 3 implementation: no provider is selected, so every balance is unavailable. */
class NoProviderBalanceRepository : BalanceRepository {
    override suspend fun balance(chainId: String, address: String): BalanceResult =
        BalanceResult.Unavailable("No provider is selected, so no balance can be shown.")
}
