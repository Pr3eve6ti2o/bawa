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
 * Live balances against a fake transport (Step 5, Lane B). No network
 * is touched: every provider answer is scripted here, including the
 * failover orders the web verified live (registry RPC sweep,
 * Trongrid -> PublicNode, TonCenter -> TonAPI).
 */
class LiveBalanceRepositoryTest {

    // --- Fake transport ---------------------------------------------------

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

        fun failRpcOnce(urlPrefix: String, rpcMethod: String) {
            rules += Rule(
                { method, url, body ->
                    method == "POST" && url.startsWith(urlPrefix) &&
                        rpcMethodOf(body) == rpcMethod
                },
                { _, _, _ -> throw IOException("fake RPC failure for $urlPrefix") },
                once = true
            )
        }

        fun onPost(urlPrefix: String, response: String) {
            rules += Rule(
                { method, url, _ -> method == "POST" && url.startsWith(urlPrefix) },
                { _, _, _ -> response },
                once = false
            )
        }

        fun failPostOnce(urlPrefix: String) {
            rules += Rule(
                { method, url, _ -> method == "POST" && url.startsWith(urlPrefix) },
                { _, _, _ -> throw IOException("fake POST failure for $urlPrefix") },
                once = true
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

    // --- Fixtures ----------------------------------------------------------

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

    private fun tokensWith(vararg tokens: String): TokenRepository {
        val json = """
            {"version":1,"sourceCommit":"test","sourceDirty":false,
            "tokenCount":${tokens.size},"tokens":[${tokens.joinToString(",")}]}
        """.trimIndent()
        return TokenRepository.load(json)
    }

    private fun ethRegistry(): ChainRegistry = registryWith(
        chainJson("eth", 1, 18, listOf("https://rpc1.example", "https://rpc2.example")),
        chainJson("bsc", 56, 18, listOf("https://bsc-rpc.example")),
        chainJson("kaspa", null, 8, listOf("https://kaspa.example"))
    )

    private fun emptyTokens(): TokenRepository = tokensWith()

    private val usdc = """
        {"chain":"eth","contract":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "tokenKey":"eth:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "name":"USD Coin","symbol":"USDC","decimals":6,"coingeckoId":"usd-coin",
        "coingeckoPlatform":"ethereum","verifiedSource":"test","priceSource":"test",
        "priceFallback":"test"}
    """.trimIndent()

    private val trxUsdt = """
        {"chain":"trx","contract":"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "tokenKey":"trx:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "name":"Tether USD","symbol":"USDT","decimals":6,"coingeckoId":"tether",
        "coingeckoPlatform":"tron","verifiedSource":"test","priceSource":"test",
        "priceFallback":"test"}
    """.trimIndent()

    private val address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

    private fun rpcResult(resultJson: String): String =
        """{"jsonrpc":"2.0","id":1,"result":$resultJson}"""

    // --- EVM ---------------------------------------------------------------

    @Test
    fun evmBalanceSuccess() = runBlocking {
        val transport = FakeTransport()
        transport.onRpc("https://rpc1.example", "eth_getBalance", rpcResult("\"0xde0b6b3a7640000\""))
        val repo = LiveBalanceRepository(ethRegistry(), emptyTokens(), transport)
        val result = repo.balance("eth", address)
        assertTrue(result is BalanceResult.Available)
        assertEquals("1000000000000000000", (result as BalanceResult.Available).rawAmount)
        assertEquals(18, result.decimals)
    }

    @Test
    fun evmBalanceSweepsToSecondEndpoint() = runBlocking {
        val transport = FakeTransport()
        transport.failRpcOnce("https://rpc1.example", "eth_getBalance")
        transport.onRpc("https://rpc2.example", "eth_getBalance", rpcResult("\"0x1\""))
        val repo = LiveBalanceRepository(ethRegistry(), emptyTokens(), transport)
        val result = repo.balance("eth", address)
        assertTrue(result is BalanceResult.Available)
        assertEquals("1", (result as BalanceResult.Available).rawAmount)
        // The dead primary was tried exactly once, then the backup won.
        val rpc1Calls = transport.calls.count { it.second.startsWith("https://rpc1.example") }
        assertEquals(1, rpc1Calls)
    }

    @Test
    fun evmBalanceAllEndpointsDownIsUnavailable() = runBlocking {
        val transport = FakeTransport()
        transport.failRpcOnce("https://rpc1.example", "eth_getBalance")
        transport.failRpcOnce("https://rpc2.example", "eth_getBalance")
        val repo = LiveBalanceRepository(ethRegistry(), emptyTokens(), transport)
        val result = repo.balance("eth", address)
        assertTrue(result is BalanceResult.Unavailable)
        assertTrue((result as BalanceResult.Unavailable).reason.contains("All RPC endpoints failed"))
    }

    @Test
    fun evmBalanceInvalidAddressIsUnavailable() = runBlocking {
        val repo = LiveBalanceRepository(ethRegistry(), emptyTokens(), FakeTransport())
        val result = repo.balance("eth", "not-an-address")
        assertTrue(result is BalanceResult.Unavailable)
    }

    @Test
    fun unknownChainIsUnavailable() = runBlocking {
        val repo = LiveBalanceRepository(ethRegistry(), emptyTokens(), FakeTransport())
        val result = repo.balance("nope", address)
        assertTrue(result is BalanceResult.Unavailable)
    }

    @Test
    fun chainWithoutKeylessSourceIsUnavailable() = runBlocking {
        val repo = LiveBalanceRepository(ethRegistry(), emptyTokens(), FakeTransport())
        val result = repo.balance("kaspa", "kaspa:qpztestaddress")
        assertTrue(result is BalanceResult.Unavailable)
        assertTrue((result as BalanceResult.Unavailable).reason.contains("No keyless balance source"))
    }

    // --- ERC-20 ------------------------------------------------------------

    @Test
    fun erc20BalanceOfDecoding() = runBlocking {
        val transport = FakeTransport()
        // balanceOf returns 1,000,000 base units (1 USDC at 6 decimals).
        val encoded = "0x" + "0".repeat(58) + "0f4240"
        transport.onRpc("https://rpc1.example", "eth_call", rpcResult("\"$encoded\""))
        val repo = LiveBalanceRepository(ethRegistry(), tokensWith(usdc), transport)
        val token = repo.let {
            TokenRepository.load(
                """{"version":1,"sourceCommit":"test","sourceDirty":false,"tokenCount":1,"tokens":[$usdc]}"""
            ).tokenByKey("eth:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")!!
        }
        val result = repo.tokenBalance(token, address)
        assertTrue(result is BalanceResult.Available)
        assertEquals("1000000", (result as BalanceResult.Available).rawAmount)
        assertEquals(6, result.decimals)
        // The calldata carried the balanceOf selector and the padded owner.
        val callBody = transport.calls.first { it.first == "POST" }.third!!
        assertTrue(callBody.contains("70a08231"))
        assertTrue(callBody.contains(address.removePrefix("0x").lowercase().padStart(64, '0')))
    }

    // --- Solana ------------------------------------------------------------

    @Test
    fun solBalanceSuccess() = runBlocking {
        val registry = registryWith(
            chainJson("sol", null, 9, listOf("https://solana-rpc.example", "https://solana2.example"))
        )
        val transport = FakeTransport()
        transport.onRpc(
            "https://solana-rpc.example",
            "getBalance",
            rpcResult("""{"context":{"slot":1},"value":2368210}""")
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("sol", "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK")
        assertTrue(result is BalanceResult.Available)
        assertEquals("2368210", (result as BalanceResult.Available).rawAmount)
        assertEquals(9, result.decimals)
    }

    // --- TRON --------------------------------------------------------------

    @Test
    fun tronBalanceTrongridSuccess() = runBlocking {
        val registry = registryWith(
            chainJson("trx", null, 6, listOf("https://api.trongrid.io", "https://tron-rpc.publicnode.com"))
        )
        val transport = FakeTransport()
        transport.onGet(
            "https://api.trongrid.io/v1/accounts/",
            """{"data":[{"balance":20032755932541,"address":"TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5"}],"success":true}"""
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("trx", "TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5")
        assertTrue(result is BalanceResult.Available)
        assertEquals("20032755932541", (result as BalanceResult.Available).rawAmount)
        assertEquals(6, result.decimals)
    }

    @Test
    fun tronBalanceFallsBackToPublicNode() = runBlocking {
        val registry = registryWith(
            chainJson("trx", null, 6, listOf("https://api.trongrid.io", "https://tron-rpc.publicnode.com"))
        )
        val transport = FakeTransport()
        transport.failGetOnce("https://api.trongrid.io/v1/accounts/")
        transport.onPost(
            "https://tron-rpc.publicnode.com/wallet/getaccount",
            """{"balance":20032755932541,"address":"TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5"}"""
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("trx", "TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5")
        assertTrue(result is BalanceResult.Available)
        assertEquals("20032755932541", (result as BalanceResult.Available).rawAmount)
        assertTrue(transport.calls.any { it.second.startsWith("https://tron-rpc.publicnode.com") })
    }

    @Test
    fun tronBalanceNeverFundedIsExactZero() = runBlocking {
        val registry = registryWith(
            chainJson("trx", null, 6, listOf("https://api.trongrid.io", "https://tron-rpc.publicnode.com"))
        )
        val transport = FakeTransport()
        transport.onGet(
            "https://api.trongrid.io/v1/accounts/",
            """{"data":[],"success":true}"""
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("trx", "TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5")
        assertTrue(result is BalanceResult.Available)
        assertEquals("0", (result as BalanceResult.Available).rawAmount)
    }

    @Test
    fun trc20BalanceViaTriggerConstantContract() = runBlocking {
        val registry = registryWith(
            chainJson("trx", null, 6, listOf("https://api.trongrid.io", "https://tron-rpc.publicnode.com"))
        )
        val transport = FakeTransport()
        // balanceOf for the owner: 258,880,897 base units (258.880897 USDT).
        val encoded = "0f4240".let { "0x" + "0".repeat(58) + "0f4240" }
        transport.onPost(
            "https://api.trongrid.io/wallet/triggerconstantcontract",
            """{"result":{"result":true},"constant_result":["$encoded"]}"""
        )
        val repo = LiveBalanceRepository(registry, tokensWith(trxUsdt), transport)
        val token = TokenRepository.load(
            """{"version":1,"sourceCommit":"test","sourceDirty":false,"tokenCount":1,"tokens":[$trxUsdt]}"""
        ).tokenByKey("trx:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")!!
        val result = repo.tokenBalance(token, "TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5")
        assertTrue(result is BalanceResult.Available)
        assertEquals("1000000", (result as BalanceResult.Available).rawAmount)
        assertEquals(6, result.decimals)
        val callBody = transport.calls.first { it.first == "POST" }.third!!
        assertTrue(callBody.contains("balanceOf(address)"))
    }

    // --- TON ---------------------------------------------------------------

    @Test
    fun tonBalanceTonCenterThenTonApiFallback() = runBlocking {
        val registry = registryWith(
            chainJson("ton", null, 9, listOf("https://toncenter.com/api/v2/jsonRPC"))
        )
        val tonAddress = "EQ" + "A".repeat(46)
        // TonCenter down: fall through to TonAPI.
        val transport = FakeTransport()
        transport.failRpcOnce("https://toncenter.com", "getAddressBalance")
        transport.onGet(
            "https://tonapi.io/v2/accounts/",
            """{"balance":"5000000000","address":"$tonAddress"}"""
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("ton", tonAddress)
        assertTrue(result is BalanceResult.Available)
        assertEquals("5000000000", (result as BalanceResult.Available).rawAmount)
        assertEquals(9, result.decimals)
    }

    @Test
    fun tonBalanceTonCenterSuccess() = runBlocking {
        val registry = registryWith(
            chainJson("ton", null, 9, listOf("https://toncenter.com/api/v2/jsonRPC"))
        )
        val tonAddress = "EQ" + "A".repeat(46)
        val transport = FakeTransport()
        transport.onRpc(
            "https://toncenter.com",
            "getAddressBalance",
            rpcResult("\"5000000000\"")
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("ton", tonAddress)
        assertTrue(result is BalanceResult.Available)
        assertEquals("5000000000", (result as BalanceResult.Available).rawAmount)
    }

    // --- BTC / DOGE ----------------------------------------------------------

    @Test
    fun btcEsploraBalanceIsFundedMinusSpent() = runBlocking {
        val registry = registryWith(
            chainJson("btc", null, 8, listOf("https://mempool.space/api", "https://blockstream.info/api"))
        )
        val transport = FakeTransport()
        transport.onGet(
            "https://mempool.space/api/address/",
            """{"chain_stats":{"funded_txo_count":2,"funded_txo_sum":150000,"spent_txo_count":1,"spent_txo_sum":50000,"tx_count":2}}"""
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("btc", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")
        assertTrue(result is BalanceResult.Available)
        assertEquals("100000", (result as BalanceResult.Available).rawAmount)
        assertEquals(8, result.decimals)
    }

    @Test
    fun dogeBalanceSochainDecimalConversion() = runBlocking {
        val registry = registryWith(
            chainJson("doge", null, 8, listOf("https://sochain.com/api/v3", "https://api.blockcypher.com/v1/doge/main"))
        )
        val transport = FakeTransport()
        transport.onGet(
            "https://sochain.com/api/v3/balance/DOGE/",
            """{"status":"success","data":{"confirmed":"12.34567890","unconfirmed":"0"}}"""
        )
        val repo = LiveBalanceRepository(registry, emptyTokens(), transport)
        val result = repo.balance("doge", "D8r8y7n8testaddress1234567890abcd")
        assertTrue(result is BalanceResult.Available)
        assertEquals("1234567890", (result as BalanceResult.Available).rawAmount)
        assertEquals(8, result.decimals)
    }
}
