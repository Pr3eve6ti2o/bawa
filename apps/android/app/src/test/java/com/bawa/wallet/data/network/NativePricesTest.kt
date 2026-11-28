package com.bawa.wallet.data.network

import com.bawa.wallet.data.ChainRegistry
import com.bawa.wallet.data.TokenRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Native-asset prices (Step 6): the curated token export lists
 * contract tokens only, so [PriceRepository.nativePrices] resolves
 * natives from the chain registry and runs the same fallback legs.
 * No test touches the network.
 */
class NativePricesTest {

    private class FakeTransport : HttpTransport {
        val requestedUrls: MutableList<String> =
            java.util.Collections.synchronizedList(mutableListOf())
        private val stubs = mutableListOf<Pair<String, HttpResult>>()

        fun stubJson(urlContains: String, body: String, status: Int = 200) {
            stubs.add(urlContains to HttpResult.Response(status, body))
        }

        fun stubFailure(urlContains: String, message: String = "boom") {
            stubs.add(urlContains to HttpResult.Failure(message))
        }

        override suspend fun get(url: String): HttpResult {
            requestedUrls.add(url)
            return stubs.firstOrNull { url.contains(it.first) }?.second
                ?: HttpResult.Failure("no stub for url")
        }

        override suspend fun postJson(url: String, body: String): HttpResult =
            HttpResult.Failure("no POST stub for url")
    }

    private fun chains(): ChainRegistry = ChainRegistry.load(
        """
        {"version":1,"sourceCommit":"test","sourceDirty":false,"chainCount":2,
        "chains":[
        {"id":"eth","name":"Ethereum","symbol":"ETH","network":"mainnet","coinType":60,
        "assetSlip44":60,"coinTypeName":"test","trustWalletCoinType":60,
        "evmChainId":1,"networkId":"test:eth","assetId":"test:eth",
        "profileId":"test-eth","derivationPath":"m/44'/60'/0'/0/0",
        "decimals":18,"rpcEndpoints":["https://rpc1.example"],"coingeckoId":"ethereum",
        "priceSources":["coingecko"],
        "priceFallbackIds":{"coinloreId":"80","coinbaseProduct":"ETH-USD","dexscreenerChainId":"ethereum"}},
        {"id":"btc","name":"Bitcoin","symbol":"BTC","network":"mainnet","coinType":0,
        "assetSlip44":0,"coinTypeName":"test","trustWalletCoinType":0,
        "evmChainId":null,"networkId":"test:btc","assetId":"test:btc",
        "profileId":"test-btc","derivationPath":"m/84'/0'/0'/0/0",
        "decimals":8,"rpcEndpoints":["https://mempool.space/api"],"coingeckoId":"bitcoin",
        "priceSources":["coingecko"],
        "priceFallbackIds":{"coinloreId":"1","coinbaseProduct":"BTC-USD"}}
        ],"testnets":[]}
        """.trimIndent()
    )

    private fun emptyTokens(): TokenRepository = TokenRepository.load(
        """{"version":1,"sourceCommit":"test","sourceDirty":false,"tokenCount":0,"tokens":[]}"""
    )

    private fun repository(transport: HttpTransport): PriceRepository =
        PriceRepository(emptyTokens(), chains(), transport)

    private fun nowSec(): Long = System.currentTimeMillis() / 1000

    @Test
    fun coingeckoPricesNativesWithChange() = runBlocking {
        val transport = FakeTransport()
        transport.stubJson(
            "api.coingecko.com",
            """{"ethereum": {"usd": 2000.0, "last_updated_at": ${nowSec()}, "usd_24h_change": 2.5},
               "bitcoin": {"usd": 90000.0, "last_updated_at": ${nowSec()}}}"""
        )
        val result = repository(transport).nativePrices(listOf("eth", "btc"))

        val eth = result["eth"] as PriceResult.Available
        assertEquals(2000.0, eth.priceUsd, 0.001)
        assertEquals(2.5, eth.change24h!!, 0.001)
        assertEquals("CoinGecko", eth.source)
        val btc = result["btc"] as PriceResult.Available
        assertEquals(90000.0, btc.priceUsd, 0.001)
        assertEquals("CoinGecko", btc.source)
    }

    @Test
    fun unknownChainIsUnavailable() = runBlocking {
        val result = repository(FakeTransport()).nativePrices(listOf("nope"))
        assertTrue(result["nope"] is PriceResult.Unavailable)
        assertEquals("unknown chain \"nope\"", (result["nope"] as PriceResult.Unavailable).reason)
    }

    @Test
    fun emptyInputIsEmpty() = runBlocking {
        assertTrue(repository(FakeTransport()).nativePrices(emptyList()).isEmpty())
    }

    @Test
    fun nativeSkipsDexScreenerAndTonApi() = runBlocking {
        // CoinGecko down: a native has no contract, so the DexScreener
        // and TonAPI legs must not even be attempted — only CoinLore
        // (native fallback) answers.
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        transport.stubJson(
            "api.coinlore.net",
            """[{"id": "80", "price_usd": "2000.0"}]"""
        )
        val result = repository(transport).nativePrices(listOf("eth"))

        val eth = result["eth"] as PriceResult.Available
        assertEquals(2000.0, eth.priceUsd, 0.001)
        assertEquals("CoinLore", eth.source)
        assertFalse(transport.requestedUrls.any { it.contains("dexscreener") })
        assertFalse(transport.requestedUrls.any { it.contains("tonapi") })
    }

    @Test
    fun staleCoingeckoFallsThroughToCoinbase() = runBlocking {
        val transport = FakeTransport()
        val staleSec = nowSec() - 20 * 60
        transport.stubJson(
            "api.coingecko.com",
            """{"ethereum": {"usd": 1990.0, "last_updated_at": $staleSec}}"""
        )
        transport.stubJson(
            "api.exchange.coinbase.com",
            """{"price": "2001.5"}"""
        )
        val result = repository(transport).nativePrices(listOf("eth"))

        val eth = result["eth"] as PriceResult.Available
        assertEquals(2001.5, eth.priceUsd, 0.001)
        assertEquals("Coinbase", eth.source)
    }
}
