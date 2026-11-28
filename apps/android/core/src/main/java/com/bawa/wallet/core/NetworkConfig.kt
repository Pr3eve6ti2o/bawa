package com.bawa.wallet.core

/**
 * Testnet connectivity configuration + adapter contracts (design §6).
 * The engine never calls the network; the network never sees keys.
 * A failed request is "not refreshed", never "zero balance".
 *
 * NO API KEYS IN CODE. Where a provider needs a key (TON testnet via
 * Toncenter), the key comes from local.properties / env at build time
 * and is documented in env.example as a placeholder only. Public
 * no-key endpoints are the default.
 */
data class ChainEndpoint(
    val chain: Chain,
    val networkName: String,
    val chainId: Long?,
    val rpcUrl: String,
    val historyUrl: String,
    val explorerTxUrl: String,
    val requiresApiKey: Boolean,
    val apiKeyEnvName: String?,
)

object NetworkConfig {
    // Testnet endpoints (public, no key unless noted). Exact paths are
    // confirmed against each provider's current testnet docs at build
    // time; these are adapter configuration, not engine changes.
    val endpoints: Map<Chain, ChainEndpoint> = mapOf(
        Chain.BTC to ChainEndpoint(
            chain = Chain.BTC,
            networkName = "Bitcoin testnet (testnet4)",
            chainId = null,
            // Esplora-compatible testnet API. NOTE: confirm testnet4 vs
            // testnet3 path against the provider at build time; the
            // adapter treats a wrong-network response as an error.
            rpcUrl = "https://blockstream.info/testnet/api/",
            historyUrl = "https://blockstream.info/testnet/api/",
            explorerTxUrl = "https://blockstream.info/testnet/tx/",
            requiresApiKey = false,
            apiKeyEnvName = null,
        ),
        Chain.ETH to ChainEndpoint(
            chain = Chain.ETH,
            networkName = "Sepolia",
            chainId = 11155111L,
            rpcUrl = "https://rpc.sepolia.org",
            // Blockscout public Sepolia API (no key) for history.
            historyUrl = "https://eth-sepolia.blockscout.com/api",
            explorerTxUrl = "https://sepolia.etherscan.io/tx/",
            requiresApiKey = false,
            apiKeyEnvName = null,
        ),
        Chain.TRX to ChainEndpoint(
            chain = Chain.TRX,
            networkName = "Nile",
            chainId = null,
            rpcUrl = "https://nile.trongrid.io",
            historyUrl = "https://nile.trongrid.io",
            explorerTxUrl = "https://nile.tronscan.org/#/transaction/",
            requiresApiKey = false,
            apiKeyEnvName = null,
        ),
        Chain.TON to ChainEndpoint(
            chain = Chain.TON,
            networkName = "TON testnet",
            chainId = null,
            // Toncenter testnet; an API key improves rate limits but
            // must be supplied by the builder (env TONCENTER_API_KEY).
            rpcUrl = "https://testnet.toncenter.com/api/v2/",
            historyUrl = "https://testnet.toncenter.com/api/v2/",
            explorerTxUrl = "https://testnet.tonscan.org/tx/",
            requiresApiKey = false, // key optional; adapter works degraded without it
            apiKeyEnvName = "TONCENTER_API_KEY",
        ),
    )

    /** Confirmation thresholds per chain policy (design §6). */
    val confirmationsRequired: Map<Chain, Int> = mapOf(
        Chain.BTC to 6,
        Chain.ETH to 12,
        Chain.TRX to 19, // DPoS supermajority threshold, expressed as confirmations
        Chain.TON to 1, // masterchain-anchored; track seqno, not wall-clock
    )
}

data class Balance(
    val chain: Chain,
    val address: String,
    val nativeBalance: String, // smallest unit, decimal string
    val tokenBalances: List<TokenBalance>,
    val fresh: Boolean, // false = stale/failed refresh, never zero-by-default
    val observedAtMillis: Long,
)

data class TokenBalance(
    val network: String,
    val contractAddress: String, // identity = network + contract + decimals
    val decimals: Int,
    val symbolDisplay: String, // UNTRUSTED metadata — display only, never identity
    val balance: String,
)

data class TxRecord(
    val txId: String, // locally derived where the chain allows
    val chain: Chain,
    val sender: String,
    val recipient: String,
    val amount: String,
    val assetId: String,
    val fee: String,
    val blockHeight: Long?,
    val state: TxState,
    val observedAtMillis: Long,
)

/**
 * One adapter per chain. Implementations use only public addresses and
 * signed bytes. Every method treats responses as untrusted: schemas,
 * numeric bounds, network identifiers, and txids are validated.
 */
interface ChainAdapter {
    val chain: Chain
    fun getBalance(address: String): Result<Balance>
    fun getTokenBalances(address: String): Result<List<TokenBalance>>
    fun getHistory(address: String): Result<List<TxRecord>>
    fun estimateFee(): Result<String>
    fun broadcastSigned(signedBytes: ByteArray, expectedTxId: String): Result<String>
    fun trackConfirmation(txId: String): Result<TxRecord>
}
