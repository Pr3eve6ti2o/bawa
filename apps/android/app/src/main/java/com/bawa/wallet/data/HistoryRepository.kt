package com.bawa.wallet.data

// Transaction history lookups. Step 3 wires the contract and the
// honest unavailable state; live history needs the Step 5 network
// stack. No transaction is ever invented: without a provider the
// only answer is Unavailable. Statuses stay distinct — pending,
// included, confirmed, failed and replaced are never merged.
data class TransactionRecord(
    val hash: String,
    val chainId: String,
    val status: TransactionStatus,
    /** Explorer URL for the hash, when the chain has a pattern. */
    val explorerUrl: String?
)

enum class TransactionStatus { Pending, Included, Confirmed, Failed, Replaced }

sealed interface HistoryResult {
    data class Available(val transactions: List<TransactionRecord>) : HistoryResult
    data class Unavailable(val reason: String) : HistoryResult
}

interface HistoryRepository {
    suspend fun history(chainId: String, address: String): HistoryResult
    suspend fun lookup(chainId: String, txHash: String): HistoryResult
}

/** Step 3 implementation: no provider is selected, so no history can be fetched. */
class NoProviderHistoryRepository : HistoryRepository {
    override suspend fun history(chainId: String, address: String): HistoryResult =
        HistoryResult.Unavailable("No provider is selected, so this app cannot fetch transactions.")

    override suspend fun lookup(chainId: String, txHash: String): HistoryResult =
        HistoryResult.Unavailable("No provider is selected, so this app cannot fetch transactions.")
}
