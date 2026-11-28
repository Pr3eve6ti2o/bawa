package com.bawa.wallet.data

import java.io.InputStream
import kotlinx.serialization.json.Json

// Chain registry: the 87 mainnet chains + 4 testnets from the
// generated export (registry/chains.json, bundled under
// app/src/main/assets/registry/). Pure Kotlin — no Android types —
// so the parsing and lookups are unit-testable on the JVM.
//
// Prices here are metadata only (CoinGecko id + fallback sources);
// live price fetching needs the Step 5 network stack. Balances and
// history are likewise contracts only (see BalanceRepository and
// HistoryRepository); nothing here invents a balance or a price.
class ChainRegistry private constructor(private val file: RegistryFile) {

    val version: Int get() = file.version
    val sourceCommit: String get() = file.sourceCommit
    val sourceDirty: Boolean get() = file.sourceDirty

    /** All 87 mainnet chains, in export order. */
    val allChains: List<ChainRecord> get() = file.chains

    /** The 4 testnets (btc, eth, trx, ton). */
    val testnets: List<TestnetRecord> get() = file.testnets

    private val byId: Map<String, ChainRecord> =
        file.chains.associateBy { it.id }

    fun chainById(chainId: String): ChainRecord? = byId[chainId]

    fun testnetById(chainId: String): TestnetRecord? =
        file.testnets.firstOrNull { it.id == chainId }

    /** Live-verified RPC endpoints for a chain, in export order. */
    fun rpcEndpoints(chainId: String): List<String> =
        byId[chainId]?.rpcEndpoints.orEmpty()

    /**
     * Explorer URL for a transaction hash, or null when the chain has
     * no explorer transaction-URL pattern (22 chains). Patterns use a
     * single placeholder — {hash} on most chains, {messageCid} on
     * Filecoin — which is replaced with the hash.
     */
    fun explorerTxUrl(chainId: String, txHash: String): String? {
        val pattern = byId[chainId]?.explorerTxUrlPattern ?: return null
        val placeholder = Regex("\\{[^}]+\\}").find(pattern) ?: return null
        return pattern.replace(placeholder.value, txHash)
    }

    /** Derivation template, e.g. m/84'/0'/{account}'/0/{index}; null for sol and ton. */
    fun derivationTemplate(chainId: String): String? =
        byId[chainId]?.derivationTemplate

    /** CoinGecko id for the chain's native asset. */
    fun coingeckoId(chainId: String): String? = byId[chainId]?.coingeckoId

    /** Price sources in priority order (CoinGecko first, then fallbacks). */
    fun priceSources(chainId: String): List<String> =
        byId[chainId]?.priceSources.orEmpty()

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun load(stream: InputStream): ChainRegistry =
            ChainRegistry(json.decodeFromString(stream.readBytes().decodeToString()))

        fun load(text: String): ChainRegistry =
            ChainRegistry(json.decodeFromString(text))
    }
}
