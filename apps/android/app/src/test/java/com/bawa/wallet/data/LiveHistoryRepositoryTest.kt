package com.bawa.wallet.data

import com.bawa.wallet.data.network.HttpResult
import com.bawa.wallet.data.network.HttpTransport
import java.io.IOException
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Live history against a fake transport (Step 5, Lane B). No network
 * is touched. Statuses stay distinct: the fixtures pin Confirmed vs
 * Failed (EVM receipt flags), Pending vs Included vs Confirmed (Solana
 * confirmationStatus) and Pending vs Confirmed (Esplora).
 */
class LiveHistoryRepositoryTest {

    private class Rule(
        val matches: (method: String, url: String, body: String?) -> Boolean,
        val answer: (method: String, url: String, body: String?) -> String,
        val once: Boolean
    )

    private class FakeTransport : HttpTransport {
        private val rules = mutableListOf<Rule>()
        val calls = mutableListOf<Triple<String, String, String?>>()

        fun onGet(urlPrefix: String, response: String) {
            rules += Rule(
                { method, url, _ -> method == "GET" && url.startsWith(urlPrefix) },
                { _, _, _ -> response },
                once = false
            )
        }

        fun onGetOnce(urlPrefix: String, response: String) {
            rules += Rule(
                { method, url, _ -> method == "GET" && url.startsWith(urlPrefix) },
                { _, _, _ -> response },
                once = true
            )
        }

        fun failGetOnce(urlPrefix: String) {
            rules += Rule(
                { method, url, _ -> method == "GET" && url.startsWith(urlPrefix) },
                { _, _, _ -> throw IOException("fake GET failure for $urlPrefix") },
                once = true
            )
        }

        fun onRpc(urlPrefix: String, rpcMethod: String, response: String) {
            rules += Rule(
                { method, url, body ->
                    method == "POST" && url.startsWith(urlPrefix) &&
                        rpcMethodOf(body) == rpcMethod
                },
                { _, _, _ -> response },
                once = false
            )
        }

        private fun rpcMethodOf(body: String?): String? {
            if (body == null) return null
            return try {
                Json.parseToJsonElement(body).jsonObject["method"]?.jsonPrimitive?.content
            } catch (e: Exception) {
                null
            }
        }

        private fun dispatch(method: String, url: String, body: String?): String {
            calls += Triple(method, url, body)
            val iterator = rules.iterator()
            while (iterator.hasNext()) {
                val rule = iterator.next()
                if (rule.matches(method, url, body)) {
                    if (rule.once) iterator.remove()
                    return rule.answer(method, url, body)
                }
            }
            throw IOException("No fake rule for $method $url")
        }

        override suspend fun get(url: String): HttpResult = try {
            HttpResult.Response(200, dispatch("GET", url, null))
        } catch (e: IOException) {
            HttpResult.Failure(e.message ?: "fake failure")
        }

        override suspend fun postJson(url: String, body: String): HttpResult = try {
            HttpResult.Response(200, dispatch("POST", url, body))
        } catch (e: IOException) {
            HttpResult.Failure(e.message ?: "fake failure")
        }
    }

    private fun chainJson(
        id: String,
        evmChainId: Int?,
        decimals: Int,
        rpcEndpoints: List<String>
    ): String {
        val rpcs = rpcEndpoints.joinToString(",") { "\"$it\"" }
        val evm = evmChainId?.toString() ?: "null"
        return """
            {"id":"$id","name":"$id","symbol":"TST","network":"mainnet","coinType":60,
            "assetSlip44":60,"coinTypeName":"test","trustWalletCoinType":60,
            "evmChainId":$evm,"networkId":"test:$id","assetId":"test:$id",
            "profileId":"test-$id","derivationPath":"m/44'/60'/0'/0/0",
            "decimals":$decimals,"rpcEndpoints":[$rpcs],"coingeckoId":"test",
            "priceSources":["coingecko"],"priceFallbackIds":{}}
        """.trimIndent()
    }

    private fun registryWith(vararg chains: String): ChainRegistry {
        val json = """
            {"version":1,"sourceCommit":"test","sourceDirty":false,
            "chainCount":${chains.size},"chains":[${chains.joinToString(",")}],
            "testnets":[]}
        """.trimIndent()
        return ChainRegistry.load(json)
    }

    private fun emptyTokens(): TokenRepository = TokenRepository.load(
        """{"version":1,"sourceCommit":"test","sourceDirty":false,"tokenCount":0,"tokens":[]}"""
    )

    private val address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

    private fun rpcResult(resultJson: String): String =
        """{"jsonrpc":"2.0","id":1,"result":$resultJson}"""

    private fun ethRegistry(): ChainRegistry = registryWith(
        chainJson("eth", 1, 18, listOf("https://rpc1.example", "https://rpc2.example")),
        chainJson("bsc", 56, 18, listOf("https://bsc-rpc.example")),
        chainJson("linea", 59144, 18, listOf("https://linea-rpc.example")),
        chainJson("sol", null, 9, listOf("https://solana-rpc.example")),
        chainJson("btc", null, 8, listOf("https://mempool.space/api", "https://blockstream.info/api"))
    )

    // --- EVM txlist ----------------------------------------------------------

    @Test
    fun evmHistoryParsingKeepsStatusesDistinct() = runBlocking {
        val transport = FakeTransport()
        transport.onGet(
            "https://eth.blockscout.com/api",
            """{"status":"1","message":"OK","result":[
                {"hash":"0xaaa","from":"$address","to":"0x0000000000000000000000000000000000000001",
                 "value":"1000","timeStamp":"1700000000","txreceipt_status":"1","isError":"0"},
                {"hash":"0xbbb","from":"$address","to":"0x0000000000000000000000000000000000000001",
                 "value":"2000","timeStamp":"1700000001","txreceipt_status":"0","isError":"0"},
                {"hash":"0xccc","from":"0x0000000000000000000000000000000000000001","to":"$address",
                 "value":"3000","timeStamp":"1700000002","txreceipt_status":"1","isError":"1"}
            ]}"""
        )
        val repo = LiveHistoryRepository(registryWith(
            chainJson("eth", 1, 18, listOf("https://rpc1.example"))
        ), transport, etherscanRetryDelayMs = 0)
        val result = repo.history("eth", address)
        assertTrue(result is HistoryResult.Available)
        val txs = (result as HistoryResult.Available).transactions
        assertEquals(3, txs.size)
        assertEquals(TransactionStatus.Confirmed, txs[0].status)
        assertEquals(TransactionStatus.Failed, txs[1].status)
        assertEquals(TransactionStatus.Failed, txs[2].status)
        assertEquals("https://eth.blockscout.com/tx/0xaaa", txs[0].explorerUrl)
    }

    @Test
    fun evmHistoryNoTransactionsIsEmptyAvailable() = runBlocking {
        val transport = FakeTransport()
        transport.onGet(
            "https://eth.blockscout.com/api",
            """{"status":"0","message":"No transactions found","result":[]}"""
        )
        val repo = LiveHistoryRepository(registryWith(
            chainJson("eth", 1, 18, listOf("https://rpc1.example"))
        ), transport, etherscanRetryDelayMs = 0)
        val result = repo.history("eth", address)
        assertTrue(result is HistoryResult.Available)
        assertTrue((result as HistoryResult.Available).transactions.isEmpty())
    }

    @Test
    fun evmHistoryChainWithoutIndexerIsUnavailable() = runBlocking {
        val repo = LiveHistoryRepository(ethRegistry(), FakeTransport(), etherscanRetryDelayMs = 0)
        val result = repo.history("bsc", address)
        assertTrue(result is HistoryResult.Unavailable)
        assertTrue((result as HistoryResult.Unavailable).reason.contains("no keyless indexer"))
    }

    @Test
    fun evmHistoryAllSourcesDownIsUnavailable() = runBlocking {
        val transport = FakeTransport()
        transport.failGetOnce("https://eth.blockscout.com/api")
        val repo = LiveHistoryRepository(registryWith(
            chainJson("eth", 1, 18, listOf("https://rpc1.example"))
        ), transport, etherscanRetryDelayMs = 0)
        val result = repo.history("eth", address)
        assertTrue(result is HistoryResult.Unavailable)
    }

    @Test
    fun lineaEtherscanQuotaRetryReturnsRealTransactions() = runBlocking {
        val transport = FakeTransport()
        transport.onGetOnce(
            "https://api.etherscan.io/v2/api",
            """{"status":"0","message":"NOTOK","result":"Missing/Invalid API Key"}"""
        )
        transport.onGet(
            "https://api.etherscan.io/v2/api",
            """{"status":"1","message":"OK","result":[
                {"hash":"0xlineatx","from":"$address","to":"0x0000000000000000000000000000000000000001",
                 "value":"1000","timeStamp":"1700000000","txreceipt_status":"1","isError":"0"}
            ]}"""
        )
        val repo = LiveHistoryRepository(ethRegistry(), transport, etherscanRetryDelayMs = 0)
        val result = repo.history("linea", address)
        assertTrue(result is HistoryResult.Available)
        val txs = (result as HistoryResult.Available).transactions
        assertEquals(1, txs.size)
        assertEquals("0xlineatx", txs[0].hash)
        assertEquals(TransactionStatus.Confirmed, txs[0].status)
        // The quota hit was retried exactly once.
        assertEquals(2, transport.calls.count { it.second.startsWith("https://api.etherscan.io/v2/api") })
    }

    // --- EVM lookup ----------------------------------------------------------

    @Test
    fun evmLookupPendingWithoutReceipt() = runBlocking {
        val transport = FakeTransport()
        transport.onRpc(
            "https://rpc1.example", "eth_getTransactionByHash",
            rpcResult("""{"hash":"0xpending","from":"$address","to":"0x0000000000000000000000000000000000000001"}""")
        )
        transport.onRpc(
            "https://rpc1.example", "eth_getTransactionReceipt",
            rpcResult("null")
        )
        val repo = LiveHistoryRepository(ethRegistry(), transport, etherscanRetryDelayMs = 0)
        val hash = "0x" + "1".repeat(64)
        val result = repo.lookup("eth", hash)
        assertTrue(result is HistoryResult.Available)
        val txs = (result as HistoryResult.Available).transactions
        assertEquals(1, txs.size)
        assertEquals(TransactionStatus.Pending, txs[0].status)
    }

    @Test
    fun evmLookupReceiptStatusDecidesConfirmedOrFailed() = runBlocking {
        val transport = FakeTransport()
        transport.onRpc(
            "https://rpc1.example", "eth_getTransactionByHash",
            rpcResult("""{"hash":"0xabc"}""")
        )
        transport.onRpc(
            "https://rpc1.example", "eth_getTransactionReceipt",
            rpcResult("""{"status":"0x0","blockNumber":"0x100"}""")
        )
        val repo = LiveHistoryRepository(ethRegistry(), transport, etherscanRetryDelayMs = 0)
        val hash = "0x" + "2".repeat(64)
        val result = repo.lookup("eth", hash)
        assertTrue(result is HistoryResult.Available)
        assertEquals(
            TransactionStatus.Failed,
            (result as HistoryResult.Available).transactions[0].status
        )
    }

    // --- Solana ------------------------------------------------------------

    @Test
    fun solHistoryConfirmationStatusesStayDistinct() = runBlocking {
        val transport = FakeTransport()
        transport.onRpc(
            "https://solana-rpc.example", "getSignaturesForAddress",
            rpcResult("""[
                {"signature":"sigFinal","err":null,"confirmationStatus":"finalized","blockTime":1700000000},
                {"signature":"sigConf","err":null,"confirmationStatus":"confirmed","blockTime":1700000001},
                {"signature":"sigProc","err":null,"confirmationStatus":"processed","blockTime":1700000002},
                {"signature":"sigFail","err":{"InstructionError":[0,{"Custom":1}]},"confirmationStatus":"finalized","blockTime":1700000003}
            ]""")
        )
        val repo = LiveHistoryRepository(ethRegistry(), transport, etherscanRetryDelayMs = 0)
        val result = repo.history("sol", "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK")
        assertTrue(result is HistoryResult.Available)
        val txs = (result as HistoryResult.Available).transactions
        assertEquals(4, txs.size)
        assertEquals(TransactionStatus.Confirmed, txs[0].status)
        assertEquals(TransactionStatus.Included, txs[1].status)
        assertEquals(TransactionStatus.Pending, txs[2].status)
        assertEquals(TransactionStatus.Failed, txs[3].status)
    }

    // --- BTC (Esplora) -------------------------------------------------------

    @Test
    fun btcHistoryConfirmedVsPending() = runBlocking {
        val transport = FakeTransport()
        transport.onGet(
            "https://mempool.space/api/address/",
            """[
                {"txid":"aaa","status":{"confirmed":true,"block_height":800000}},
                {"txid":"bbb","status":{"confirmed":false}}
            ]"""
        )
        val repo = LiveHistoryRepository(ethRegistry(), transport, etherscanRetryDelayMs = 0)
        val result = repo.history("btc", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")
        assertTrue(result is HistoryResult.Available)
        val txs = (result as HistoryResult.Available).transactions
        assertEquals(2, txs.size)
        assertEquals(TransactionStatus.Confirmed, txs[0].status)
        assertEquals(TransactionStatus.Pending, txs[1].status)
        assertEquals("https://mempool.space/tx/aaa", txs[0].explorerUrl)
    }

    @Test
    fun btcLookupNotFoundIsUnavailable() = runBlocking {
        val transport = FakeTransport()
        transport.failGetOnce("https://mempool.space/api/tx/")
        transport.failGetOnce("https://blockstream.info/api/tx/")
        val repo = LiveHistoryRepository(ethRegistry(), transport, etherscanRetryDelayMs = 0)
        val result = repo.lookup("btc", "00".repeat(32))
        assertTrue(result is HistoryResult.Unavailable)
    }

    // --- TRON ---------------------------------------------------------------

    @Test
    fun tronHistoryTrongridMapsContractRet() = runBlocking {
        val registry = registryWith(
            chainJson("trx", null, 6, listOf("https://api.trongrid.io", "https://tron-rpc.publicnode.com"))
        )
        val transport = FakeTransport()
        transport.onGet(
            "https://api.trongrid.io/v1/accounts/",
            """{"data":[
                {"txID":"txok","ret":[{"contractRet":"SUCCESS"}]},
                {"txID":"txbad","ret":[{"contractRet":"REVERT"}]}
            ],"success":true}"""
        )
        val repo = LiveHistoryRepository(registry, transport, etherscanRetryDelayMs = 0)
        val result = repo.history("trx", "TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5")
        assertTrue(result is HistoryResult.Available)
        val txs = (result as HistoryResult.Available).transactions
        assertEquals(2, txs.size)
        assertEquals(TransactionStatus.Confirmed, txs[0].status)
        assertEquals(TransactionStatus.Failed, txs[1].status)
    }
}
