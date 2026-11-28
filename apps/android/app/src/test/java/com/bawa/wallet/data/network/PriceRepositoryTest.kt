package com.bawa.wallet.data.network

import com.bawa.wallet.data.ChainRegistry
import com.bawa.wallet.data.TokenRepository
import java.io.File
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Live prices from fake transports: no test ever touches the network.
 * Proves the web's fallback order (CoinGecko, DexScreener, TonAPI,
 * CoinLore, Coinbase), the DexScreener quote-side trap, and that a
 * token no source prices is Unavailable — never 0, never invented.
 */
class PriceRepositoryTest {

    private class FakeTransport : HttpTransport {
        // Synchronized: the DexScreener + TonAPI legs (and the
        // CoinLore + Coinbase legs) run in parallel.
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

    private fun tokens(): TokenRepository =
        TokenRepository.load(File("src/main/assets/registry/tokens.json").readText())

    private fun chains(): ChainRegistry =
        ChainRegistry.load(File("src/main/assets/registry/chains.json").readText())

    private fun repository(transport: HttpTransport): PriceRepository =
        PriceRepository(tokens(), chains(), transport)

    private fun nowSec(): Long = System.currentTimeMillis() / 1000

    private fun coingeckoEntry(usd: Double, updatedAtSec: Long, change: Double? = null): String {
        val changePart = if (change != null) ", \"usd_24h_change\": $change" else ""
        return "{\"usd\": $usd, \"last_updated_at\": $updatedAtSec$changePart}"
    }

    @Test
    fun coingeckoSuccessPricesBothWithChangeInOneBatchedCall() = runBlocking {
        val transport = FakeTransport()
        transport.stubJson(
            "api.coingecko.com",
            "{\"usd-coin\": ${coingeckoEntry(1.0, nowSec(), 0.12)}," +
                " \"tether\": ${coingeckoEntry(0.999, nowSec(), -0.05)}}"
        )
        val results = repository(transport).prices(listOf(USDC_ETH, USDT_ETH))
        assertEquals(1, transport.requestedUrls.size)
        assertTrue(transport.requestedUrls.single().contains("ids=usd-coin,tether"))

        val usdc = results[USDC_ETH] as PriceResult.Available
        assertEquals(1.0, usdc.priceUsd, 0.0)
        assertEquals(0.12, usdc.change24h!!, 0.0)
        assertEquals("CoinGecko", usdc.source)
        val usdt = results[USDT_ETH] as PriceResult.Available
        assertEquals(0.999, usdt.priceUsd, 0.0)
        assertEquals(-0.05, usdt.change24h!!, 0.0)
        assertEquals("CoinGecko", usdt.source)
    }

    @Test
    fun coingeckoBatchDedupesSharedId() = runBlocking {
        val transport = FakeTransport()
        transport.stubJson(
            "api.coingecko.com",
            "{\"tether\": ${coingeckoEntry(1.0, nowSec(), 0.01)}}"
        )
        val results = repository(transport).prices(listOf(USDT_ETH, USDT_TRX))
        assertEquals(1, transport.requestedUrls.size)
        val url = transport.requestedUrls.single()
        assertEquals(1, url.split("tether").size - 1)
        assertEquals(1.0, (results[USDT_ETH] as PriceResult.Available).priceUsd, 0.0)
        assertEquals(1.0, (results[USDT_TRX] as PriceResult.Available).priceUsd, 0.0)
    }

    @Test
    fun coingeckoFailureFallsThroughToDexScreener() = runBlocking {
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        transport.stubJson(
            "api.dexscreener.com",
            "[{\"chainId\": \"ethereum\"," +
                " \"baseToken\": {\"address\": \"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\"}," +
                " \"quoteToken\": {\"address\": \"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\"}," +
                " \"priceUsd\": \"1.001\", \"liquidity\": {\"usd\": 5000000}}]"
        )
        val results = repository(transport).prices(listOf(USDC_ETH))
        val usdc = results[USDC_ETH] as PriceResult.Available
        assertEquals(1.001, usdc.priceUsd, 0.0)
        assertEquals("DexScreener", usdc.source)
        assertTrue(usdc.change24h == null)
        assertTrue(transport.requestedUrls.any { it.contains("api.coingecko.com") })
        assertTrue(transport.requestedUrls.any { it.contains("tokens/v1/ethereum/") })
    }

    @Test
    fun dexScreenerQuoteSidePricesByImpliedPriceOnly() = runBlocking {
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        // USDC only as the quote token: priceUsd (0.2953) is the base
        // token's price, so the implied price 0.2953 / 0.2953 = 1.0
        // is the only honest quote (web Polygon USDT0 proof).
        transport.stubJson(
            "api.dexscreener.com",
            "[{\"chainId\": \"ethereum\"," +
                " \"baseToken\": {\"address\": \"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\"}," +
                " \"quoteToken\": {\"address\": \"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48\"}," +
                " \"priceUsd\": \"0.2953\", \"priceNative\": \"0.2953\"," +
                " \"liquidity\": {\"usd\": 5980000}}]"
        )
        val results = repository(transport).prices(listOf(USDC_ETH))
        val usdc = results[USDC_ETH] as PriceResult.Available
        assertEquals(1.0, usdc.priceUsd, 1e-9)
        assertEquals("DexScreener", usdc.source)
    }

    @Test
    fun dexScreenerQuoteSideWithoutPriceNativePricesNothing() = runBlocking {
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        // The TRON USDT trap: USDT only as the quote token, no
        // priceNative, priceUsd is the base token's price (61,571) —
        // it must never price the queried token.
        transport.stubJson(
            "api.dexscreener.com",
            "[{\"chainId\": \"tron\"," +
                " \"baseToken\": {\"address\": \"0x0000000000000000000000000000000000000000\"}," +
                " \"quoteToken\": {\"address\": \"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t\"}," +
                " \"priceUsd\": \"61571.71\", \"liquidity\": {\"usd\": 9000000}}]"
        )
        val results = repository(transport).prices(listOf(USDT_TRX))
        val result = results[USDT_TRX]
        assertTrue(result is PriceResult.Unavailable)
        assertTrue((result as PriceResult.Unavailable).reason.isNotEmpty())
    }

    @Test
    fun staleCoingeckoFallsThroughToDexScreener() = runBlocking {
        val transport = FakeTransport()
        transport.stubJson(
            "api.coingecko.com",
            "{\"usd-coin\": ${coingeckoEntry(1.0, nowSec() - 3600, 0.5)}}"
        )
        transport.stubJson(
            "api.dexscreener.com",
            "[{\"chainId\": \"ethereum\"," +
                " \"baseToken\": {\"address\": \"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48\"}," +
                " \"quoteToken\": {\"address\": \"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\"}," +
                " \"priceUsd\": \"1.002\", \"liquidity\": {\"usd\": 1000000}}]"
        )
        val results = repository(transport).prices(listOf(USDC_ETH))
        val usdc = results[USDC_ETH] as PriceResult.Available
        assertEquals(1.002, usdc.priceUsd, 0.0)
        assertEquals("DexScreener", usdc.source)
    }

    @Test
    fun coingeckoMissingTimestampFallsThrough() = runBlocking {
        val transport = FakeTransport()
        transport.stubJson("api.coingecko.com", "{\"usd-coin\": {\"usd\": 1.0}}")
        transport.stubJson(
            "api.dexscreener.com",
            "[{\"chainId\": \"ethereum\"," +
                " \"baseToken\": {\"address\": \"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48\"}," +
                " \"quoteToken\": {\"address\": \"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\"}," +
                " \"priceUsd\": \"1.003\", \"liquidity\": {\"usd\": 1000000}}]"
        )
        val results = repository(transport).prices(listOf(USDC_ETH))
        assertEquals("DexScreener", (results[USDC_ETH] as PriceResult.Available).source)
    }

    @Test
    fun coingeckoInvalidPriceFallsThroughAndIsNeverShownAsZero() = runBlocking {
        val transport = FakeTransport()
        transport.stubJson(
            "api.coingecko.com",
            "{\"usd-coin\": ${coingeckoEntry(0.0, nowSec())}}"
        )
        transport.stubJson(
            "api.dexscreener.com",
            "[{\"chainId\": \"ethereum\"," +
                " \"baseToken\": {\"address\": \"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48\"}," +
                " \"quoteToken\": {\"address\": \"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\"}," +
                " \"priceUsd\": \"1.004\", \"liquidity\": {\"usd\": 1000000}}]"
        )
        val results = repository(transport).prices(listOf(USDC_ETH))
        val usdc = results[USDC_ETH] as PriceResult.Available
        assertEquals(1.004, usdc.priceUsd, 0.0)
        assertTrue(usdc.priceUsd > 0)
    }

    @Test
    fun tonApiFallbackPricesJetton() = runBlocking {
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        // The TON master address is mixed-case and case-sensitive:
        // take it from the token record, never retype it.
        val contract = tokens().tokenByKey(USDT_TON)!!.contract
        transport.stubJson(
            "tonapi.io",
            "{\"rates\": {\"$contract\": {\"prices\": {\"USD\": 0.999}}}}"
        )
        val results = repository(transport).prices(listOf(USDT_TON))
        val usdt = results[USDT_TON] as PriceResult.Available
        assertEquals(0.999, usdt.priceUsd, 0.0)
        assertEquals("TonAPI", usdt.source)
        assertTrue(usdt.change24h == null)
        assertTrue(transport.requestedUrls.any { it.contains("tonapi.io/v2/rates") })
    }

    @Test
    fun allSourcesDownReturnsUnavailableNeverZero() = runBlocking {
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        transport.stubFailure("api.dexscreener.com")
        transport.stubFailure("tonapi.io")
        val results = repository(transport).prices(listOf(USDC_ETH))
        val result = results[USDC_ETH]
        assertTrue(result is PriceResult.Unavailable)
        assertTrue((result as PriceResult.Unavailable).reason.contains("network or provider error"))
    }

    @Test
    fun unknownTokenKeyIsUnavailable() = runBlocking {
        val transport = FakeTransport()
        val results = repository(transport).prices(listOf("nope:0x1234"))
        val result = results["nope:0x1234"]
        assertTrue(result is PriceResult.Unavailable)
        assertTrue((result as PriceResult.Unavailable).reason.contains("unknown token"))
        assertEquals(0, transport.requestedUrls.size)
    }

    @Test
    fun coinLoreAndCoinbasePriceNativeAssetsOnly() = runBlocking {
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        transport.stubJson(
            "api.coinlore.net",
            "[{\"id\": \"90\", \"symbol\": \"BTC\", \"price_usd\": \"43210.5\"}]"
        )
        transport.stubJson("api.exchange.coinbase.com", "{\"price\": \"42.95\"}")
        val repo = PriceRepository(
            TokenRepository.load(SYNTHETIC_TOKENS_JSON),
            ChainRegistry.load(SYNTHETIC_CHAINS_JSON),
            transport
        )
        val results = repo.prices(listOf("btc:native", "ltc:native"))
        val btc = results["btc:native"] as PriceResult.Available
        assertEquals(43210.5, btc.priceUsd, 0.0)
        assertEquals("CoinLore", btc.source)
        val ltc = results["ltc:native"] as PriceResult.Available
        assertEquals(42.95, ltc.priceUsd, 0.0)
        assertEquals("Coinbase", ltc.source)
        assertTrue(transport.requestedUrls.any { it.contains("api.coinlore.net/api/ticker/?id=90") })
        assertTrue(transport.requestedUrls.any { it.contains("products/LTC-USD/ticker") })
        assertTrue(transport.requestedUrls.none { it.contains("dexscreener") })
    }

    @Test
    fun contractTokenIsNeverPricedFromNativeLegs() = runBlocking {
        val transport = FakeTransport()
        transport.stubFailure("api.coingecko.com")
        transport.stubJson("api.dexscreener.com", "[]")
        // CoinLore answers for ETH (id 80) — but USDC is not ETH's
        // native asset, so this quote must never price it.
        transport.stubJson(
            "api.coinlore.net",
            "[{\"id\": \"80\", \"symbol\": \"ETH\", \"price_usd\": \"3000.00\"}]"
        )
        val results = repository(transport).prices(listOf(USDC_ETH))
        assertTrue(results[USDC_ETH] is PriceResult.Unavailable)
        assertTrue(transport.requestedUrls.none { it.contains("coinlore") })
        assertTrue(transport.requestedUrls.none { it.contains("coinbase") })
    }

    companion object {
        const val USDC_ETH = "eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        const val USDT_ETH = "eth:0xdac17f958d2ee523a2206206994597c13d831ec7"
        const val USDT_TRX = "trx:tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t"
        const val USDT_TON = "ton:eqcxe6mutqjkfngfarotkot1lzbdiix1kcixrv7nw2id_sds"

        // Two native assets only, so the CoinLore / Coinbase legs can
        // be exercised without the 87-chain export: BTC has a CoinLore
        // id and no Coinbase product, LTC the reverse.
        const val SYNTHETIC_CHAINS_JSON = """
            {
              "version": 1, "sourceCommit": "test", "sourceDirty": false,
              "chainCount": 2, "testnets": [],
              "chains": [
                {"id": "btc", "name": "Bitcoin", "symbol": "BTC",
                 "network": "mainnet", "coinType": 0, "assetSlip44": 0,
                 "coinTypeName": "Bitcoin", "trustWalletCoinType": 0,
                 "networkId": "btc",
                 "assetId": "bip122:000000000019d6689c085ae165831e93/slip44:0",
                 "profileId": "btc", "derivationPath": "m/84'/0'/0'/0/0",
                 "decimals": 8, "rpcEndpoints": ["https://example.invalid"],
                 "coingeckoId": "bitcoin",
                 "priceSources": ["CoinGecko", "CoinLore"],
                 "priceFallbackIds": {"coinloreId": "90"}},
                {"id": "ltc", "name": "Litecoin", "symbol": "LTC",
                 "network": "mainnet", "coinType": 2, "assetSlip44": 2,
                 "coinTypeName": "Litecoin", "trustWalletCoinType": 2,
                 "networkId": "ltc",
                 "assetId": "bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2/slip44:2",
                 "profileId": "ltc", "derivationPath": "m/84'/2'/0'/0/0",
                 "decimals": 8, "rpcEndpoints": ["https://example.invalid"],
                 "coingeckoId": "litecoin",
                 "priceSources": ["CoinGecko", "Coinbase"],
                 "priceFallbackIds": {"coinbaseProduct": "LTC-USD"}}
              ]
            }
        """

        const val SYNTHETIC_TOKENS_JSON = """
            {
              "version": 1, "sourceCommit": "test", "sourceDirty": false,
              "tokenCount": 2,
              "tokens": [
                {"chain": "btc", "contract": "native", "tokenKey": "btc:native",
                 "name": "Bitcoin", "symbol": "BTC", "decimals": 8,
                 "coingeckoId": "bitcoin", "coingeckoPlatform": "",
                 "verifiedSource": "test", "priceSource": "coingecko",
                 "priceFallback": "coinlore"},
                {"chain": "ltc", "contract": "native", "tokenKey": "ltc:native",
                 "name": "Litecoin", "symbol": "LTC", "decimals": 8,
                 "coingeckoId": "litecoin", "coingeckoPlatform": "",
                 "verifiedSource": "test", "priceSource": "coingecko",
                 "priceFallback": "coinbase"}
              ]
            }
        """
    }
}
