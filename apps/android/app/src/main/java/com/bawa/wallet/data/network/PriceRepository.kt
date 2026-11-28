package com.bawa.wallet.data.network

import com.bawa.wallet.data.ChainRegistry
import com.bawa.wallet.data.TokenRecord
import com.bawa.wallet.data.TokenRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

// Live token prices (Android Step 5, Lane A).
//
// Fallback order mirrors the web (apps/web/src/wallet/token-prices.ts,
// dex-prices.ts and price-fallbacks.ts):
//   1. CoinGecko /simple/price, one batched call for every distinct id,
//      with usd_24h_change on the same call. Only a fresh quote counts:
//      a finite positive usd price with a last_updated_at no older than
//      10 minutes (web MAX_QUOTE_AGE_MS); a stale, missing or
//      timestamp-less entry falls through instead of being shown.
//   2. DexScreener /tokens/v1/{chain}/{addresses}, one batched call per
//      chain (max 30 addresses). A base-side pair prices the token
//      directly (highest liquidity wins); a quote-side pair prices it
//      ONLY by the implied price priceUsd / priceNative — priceUsd
//      itself is the base token's price and must never price the
//      queried token (the TRON USDT trap, verified live on the web).
//   3. TonAPI /v2/rates for TON Jettons (DexScreener does not price them).
//   4. CoinLore /api/ticker, one batched call — native assets only
//      (CoinLore ids are per chain, from the registry export).
//   5. Coinbase Exchange /products/{product}/ticker — native assets only.
//
// A token no source prices is Unavailable, never 0. A 24 h change is
// reported only where the source provides it (CoinGecko); everywhere
// else it is null, never a fabricated 0. Every result names the
// provider that actually answered it as `source`. All sources are
// keyless; no secret or API key is sent anywhere.
sealed interface PriceResult {
    data class Available(
        val priceUsd: Double,
        val change24h: Double?,
        val source: String
    ) : PriceResult

    data class Unavailable(val reason: String) : PriceResult
}

class PriceRepository(
    private val tokenRepository: TokenRepository,
    private val chainRegistry: ChainRegistry,
    private val transport: HttpTransport = OkHttpHttpTransport()
) {

    suspend fun prices(tokenKeys: List<String>): Map<String, PriceResult> {
        val nowMs = System.currentTimeMillis()
        val results = LinkedHashMap<String, PriceResult>()
        var transportFailed = false
        val resolved = LinkedHashMap<String, TokenRecord>()
        for (key in tokenKeys.distinct()) {
            val token = tokenRepository.tokenByKey(key)
            if (token == null) {
                results[key] = PriceResult.Unavailable("unknown token key")
            } else {
                resolved[key] = token
            }
        }
        if (resolved.isEmpty()) return results

        // Phase A: CoinGecko, one batched call for every distinct id.
        val (coingeckoPriced, coingeckoFailed) = fetchCoingecko(resolved, nowMs)
        transportFailed = transportFailed || coingeckoFailed
        results.putAll(coingeckoPriced)
        var pending = resolved.filterKeys { it !in results }

        // Phase B: DexScreener + TonAPI in parallel for what CoinGecko
        // did not price fresh.
        if (pending.isNotEmpty()) {
            val outcomes = coroutineScope {
                val dex = async { fetchDexScreener(pending) }
                val ton = async { fetchTonApi(pending) }
                listOf(dex.await(), ton.await())
            }
            for ((priced, failed) in outcomes) {
                transportFailed = transportFailed || failed
                results.putAll(priced)
            }
            pending = resolved.filterKeys { it !in results }
        }

        // Phase C: CoinLore + Coinbase in parallel, native assets only.
        if (pending.isNotEmpty()) {
            val outcomes = coroutineScope {
                val lore = async { fetchCoinLore(pending) }
                val base = async { fetchCoinbase(pending) }
                listOf(lore.await(), base.await())
            }
            for ((priced, failed) in outcomes) {
                transportFailed = transportFailed || failed
                results.putAll(priced)
            }
            pending = resolved.filterKeys { it !in results }
        }

        val reason = if (transportFailed) {
            "no price source answered (network or provider error)"
        } else {
            "no price source returned a price for this token"
        }
        for (key in pending.keys) {
            results[key] = PriceResult.Unavailable(reason)
        }
        return results
    }

    // One leg's outcome: the tokens it priced, and whether it hit a
    // transport or provider failure (which shapes the final reason).
    private data class LegOutcome(
        val priced: Map<String, PriceResult>,
        val transportFailed: Boolean
    )

    private suspend fun fetchCoingecko(
        tokens: Map<String, TokenRecord>,
        nowMs: Long
    ): LegOutcome {
        val ids = tokens.values.mapNotNull { it.coingeckoId.ifBlank { null } }.distinct()
        if (ids.isEmpty()) return LegOutcome(emptyMap(), false)
        val url = "$COINGECKO_BASE_URL/simple/price" +
            "?ids=${ids.joinToString(",")}" +
            "&vs_currencies=usd&include_last_updated_at=true&include_24hr_change=true"
        val root = getJsonObject(url) ?: return LegOutcome(emptyMap(), true)
        val priced = LinkedHashMap<String, PriceResult>()
        for ((key, token) in tokens) {
            if (token.coingeckoId.isBlank()) continue
            val entry = root[token.coingeckoId] as? JsonObject ?: continue
            val price = validUsdPrice(entry.numberOrNumericString("usd")) ?: continue
            val updatedAtSec = entry.numberOrNumericString("last_updated_at")
                ?.takeIf { it.isFinite() } ?: continue
            val updatedAtMs = (updatedAtSec * 1000).toLong()
            val ageMs = nowMs - updatedAtMs
            if (ageMs < -FUTURE_SKEW_MS || ageMs > MAX_QUOTE_AGE_MS) continue
            val change = entry.numberOrNumericString("usd_24h_change")
                ?.takeIf { it.isFinite() }
            priced[key] = PriceResult.Available(price, change, "CoinGecko")
        }
        return LegOutcome(priced, false)
    }

    private suspend fun fetchDexScreener(
        tokens: Map<String, TokenRecord>
    ): LegOutcome {
        val byChain = LinkedHashMap<String, MutableList<Map.Entry<String, TokenRecord>>>()
        for (entry in tokens.entries) {
            val slug = chainRegistry.chainById(entry.value.chain)
                ?.priceFallbackIds?.dexscreenerChainId ?: continue
            byChain.getOrPut(slug) { mutableListOf() }.add(entry)
        }
        if (byChain.isEmpty()) return LegOutcome(emptyMap(), false)
        val priced = LinkedHashMap<String, PriceResult>()
        var failed = false
        for ((slug, entries) in byChain) {
            for (chunk in entries.chunked(DEXSCREENER_MAX_ADDRESSES_PER_CALL)) {
                val addresses = chunk.joinToString(",") { it.value.contract }
                val url = "$DEXSCREENER_BASE_URL/tokens/v1/$slug/$addresses"
                val pairs = getJsonArray(url)
                if (pairs == null) {
                    failed = true
                    continue
                }
                for ((key, token) in chunk) {
                    dexScreenerPrice(pairs, slug, token.contract)?.let { price ->
                        priced[key] = PriceResult.Available(price, null, "DexScreener")
                    }
                }
            }
        }
        return LegOutcome(priced, failed)
    }

    // Best pair for one token: a base-side pair (highest liquidity)
    // wins; otherwise the highest-liquidity quote-side pair, priced by
    // the implied price priceUsd / priceNative only.
    private fun dexScreenerPrice(
        pairs: JsonArray,
        dexChain: String,
        contract: String
    ): Double? {
        var bestBase: Pair<Double, Double>? = null
        var bestQuote: Pair<Double, Double>? = null
        for (element in pairs) {
            val pair = element as? JsonObject ?: continue
            if (pair.stringField("chainId") != dexChain) continue
            val liquidity = liquidityUsd(pair)
            val baseToken = pair["baseToken"] as? JsonObject
            val baseAddress = baseToken?.stringField("address")
            if (baseAddress != null && sameTokenAddress(baseAddress, contract)) {
                val price = validUsdPrice(pair.numberOrNumericString("priceUsd"))
                if (price != null && (bestBase == null || liquidity > bestBase.second)) {
                    bestBase = price to liquidity
                }
                continue
            }
            val quoteToken = pair["quoteToken"] as? JsonObject
            val quoteAddress = quoteToken?.stringField("address")
            if (quoteAddress == null || !sameTokenAddress(quoteAddress, contract)) continue
            val basePrice = pair.numberOrNumericString("priceUsd") ?: continue
            val priceNative = pair.numberOrNumericString("priceNative") ?: continue
            if (!basePrice.isFinite() || basePrice <= 0) continue
            if (!priceNative.isFinite() || priceNative <= 0) continue
            val implied = basePrice / priceNative
            if (!implied.isFinite() || implied <= 0) continue
            if (bestQuote == null || liquidity > bestQuote.second) {
                bestQuote = implied to liquidity
            }
        }
        return (bestBase ?: bestQuote)?.first
    }

    private suspend fun fetchTonApi(
        tokens: Map<String, TokenRecord>
    ): LegOutcome {
        val ton = tokens.filterValues { it.chain == "ton" }
        if (ton.isEmpty()) return LegOutcome(emptyMap(), false)
        val masters = ton.values.map { it.contract }.distinct().joinToString(",")
        val url = "$TONAPI_BASE_URL/v2/rates?tokens=$masters&currencies=usd"
        val root = getJsonObject(url) ?: return LegOutcome(emptyMap(), true)
        val rates = root["rates"] as? JsonObject ?: return LegOutcome(emptyMap(), true)
        val priced = LinkedHashMap<String, PriceResult>()
        for ((key, token) in ton) {
            val entry = rates[token.contract] as? JsonObject ?: continue
            val prices = entry["prices"] as? JsonObject ?: continue
            val price = validUsdPrice(prices.numberOrNumericString("USD")) ?: continue
            priced[key] = PriceResult.Available(price, null, "TonAPI")
        }
        return LegOutcome(priced, false)
    }

    private suspend fun fetchCoinLore(
        tokens: Map<String, TokenRecord>
    ): LegOutcome {
        val natives = tokens.filterValues { isNative(it) }
        val ids = natives.values
            .mapNotNull { chainRegistry.chainById(it.chain)?.priceFallbackIds?.coinloreId }
            .distinct()
        if (ids.isEmpty()) return LegOutcome(emptyMap(), false)
        val url = "$COINLORE_BASE_URL/api/ticker/?id=${ids.joinToString(",")}"
        val coins = getJsonArray(url) ?: return LegOutcome(emptyMap(), true)
        val byId = HashMap<String, JsonObject>()
        for (element in coins) {
            val coin = element as? JsonObject ?: continue
            val id = coin.stringField("id") ?: continue
            byId[id] = coin
        }
        val priced = LinkedHashMap<String, PriceResult>()
        for ((key, token) in natives) {
            val id = chainRegistry.chainById(token.chain)?.priceFallbackIds?.coinloreId
                ?: continue
            val coin = byId[id] ?: continue
            val price = validUsdPrice(coin.numberOrNumericString("price_usd")) ?: continue
            priced[key] = PriceResult.Available(price, null, "CoinLore")
        }
        return LegOutcome(priced, false)
    }

    private suspend fun fetchCoinbase(
        tokens: Map<String, TokenRecord>
    ): LegOutcome {
        val natives = tokens.filterValues { isNative(it) }
        val byProduct = LinkedHashMap<String, MutableList<Map.Entry<String, TokenRecord>>>()
        for (entry in natives.entries) {
            val product = chainRegistry.chainById(entry.value.chain)
                ?.priceFallbackIds?.coinbaseProduct ?: continue
            byProduct.getOrPut(product) { mutableListOf() }.add(entry)
        }
        if (byProduct.isEmpty()) return LegOutcome(emptyMap(), false)
        val priced = LinkedHashMap<String, PriceResult>()
        var failed = false
        for ((product, entries) in byProduct) {
            val url = "$COINBASE_BASE_URL/products/$product/ticker"
            val root = getJsonObject(url)
            if (root == null) {
                failed = true
                continue
            }
            val price = validUsdPrice(root.numberOrNumericString("price")) ?: continue
            for ((key, _) in entries) {
                priced[key] = PriceResult.Available(price, null, "Coinbase")
            }
        }
        return LegOutcome(priced, failed)
    }

    // A token is its chain's native asset when its CoinGecko id is the
    // chain's native CoinGecko id. CoinLore and Coinbase quote natives
    // only, so a contract token must never be priced from them.
    private fun isNative(token: TokenRecord): Boolean {
        val nativeId = chainRegistry.coingeckoId(token.chain) ?: return false
        return token.coingeckoId.isNotEmpty() && token.coingeckoId == nativeId
    }

    // A 200 response with a JSON object body, or null on any transport,
    // status or parse failure (the caller then falls through).
    private suspend fun getJsonObject(url: String): JsonObject? {
        val result = transport.get(url)
        if (result !is HttpResult.Response || result.statusCode != 200) return null
        return parseJson(result.body) as? JsonObject
    }

    private suspend fun getJsonArray(url: String): JsonArray? {
        val result = transport.get(url)
        if (result !is HttpResult.Response || result.statusCode != 200) return null
        return parseJson(result.body) as? JsonArray
    }

    private fun parseJson(body: String): kotlinx.serialization.json.JsonElement? {
        return try {
            json.parseToJsonElement(body)
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        const val COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"
        const val DEXSCREENER_BASE_URL = "https://api.dexscreener.com"
        const val TONAPI_BASE_URL = "https://tonapi.io"
        const val COINLORE_BASE_URL = "https://api.coinlore.net"
        const val COINBASE_BASE_URL = "https://api.exchange.coinbase.com"

        // Web MAX_QUOTE_AGE_MS: a CoinGecko quote older than 10 minutes
        // is expired and falls through to the next source.
        const val MAX_QUOTE_AGE_MS: Long = 10 * 60 * 1000

        // Web isFreshQuote tolerates a provider clock up to 60 s ahead.
        const val FUTURE_SKEW_MS: Long = 60 * 1000

        // Web DEXSCREENER_MAX_ADDRESSES_PER_CALL.
        const val DEXSCREENER_MAX_ADDRESSES_PER_CALL = 30

        private val json = Json { ignoreUnknownKeys = true }
    }
}

// A USD price: a finite number greater than zero, sent as a JSON
// number or a numeric string. Anything else prices nothing.
private fun validUsdPrice(value: Double?): Double? {
    if (value == null || !value.isFinite() || value <= 0) return null
    return value
}

// A JSON number, or a numeric string holding one; null otherwise.
private fun JsonObject.numberOrNumericString(name: String): Double? {
    val primitive = this[name] as? JsonPrimitive ?: return null
    if (primitive.isString) return primitive.content.toDoubleOrNull()
    return primitive.doubleOrNull
}

private fun JsonObject.stringField(name: String): String? {
    val primitive = this[name] as? JsonPrimitive ?: return null
    if (!primitive.isString) return null
    return primitive.content
}

// Web sameTokenAddress: EVM hex compares case-insensitively
// (checksummed vs lowercase); base58 (Solana/TRON) compares exactly —
// lowercasing two different base58 strings could falsely equate them.
private fun sameTokenAddress(left: String, right: String): Boolean {
    if (left.startsWith("0x") && right.startsWith("0x")) {
        return left.equals(right, ignoreCase = true)
    }
    return left == right
}

// Web liquidityUsd: the pair's liquidity.usd, or 0 when absent.
private fun liquidityUsd(pair: JsonObject): Double {
    val liquidity = pair["liquidity"] as? JsonObject ?: return 0.0
    val usd = liquidity.numberOrNumericString("usd") ?: return 0.0
    if (!usd.isFinite() || usd <= 0) return 0.0
    return usd
}
