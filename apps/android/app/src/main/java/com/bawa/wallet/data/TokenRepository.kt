package com.bawa.wallet.data

import java.io.InputStream
import kotlinx.serialization.json.Json

// Token lists from the generated export (registry/tokens.json,
// bundled under app/src/main/assets/registry/). 21 curated tokens
// across 10 chains, each verified by contract address — never by
// name or symbol alone. Pure Kotlin, unit-testable on the JVM.
class TokenRepository private constructor(private val file: TokensFile) {

    val version: Int get() = file.version
    val sourceCommit: String get() = file.sourceCommit
    val sourceDirty: Boolean get() = file.sourceDirty

    /** All 21 tokens, in export order. */
    val allTokens: List<TokenRecord> get() = file.tokens

    private val byKey: Map<String, TokenRecord> =
        file.tokens.associateBy { it.tokenKey }

    private val byChain: Map<String, List<TokenRecord>> =
        file.tokens.groupBy { it.chain }

    /** A token by its key, e.g. "eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48". */
    fun tokenByKey(tokenKey: String): TokenRecord? = byKey[tokenKey]

    /** Tokens on one chain, e.g. 7 on eth; empty when the chain has none listed. */
    fun tokensForChain(chainId: String): List<TokenRecord> =
        byChain[chainId].orEmpty()

    /** CoinGecko id for a token's price, e.g. "usd-coin" for USDC. */
    fun coingeckoId(tokenKey: String): String? = byKey[tokenKey]?.coingeckoId

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun load(stream: InputStream): TokenRepository =
            TokenRepository(json.decodeFromString(stream.readBytes().decodeToString()))

        fun load(text: String): TokenRepository =
            TokenRepository(json.decodeFromString(text))
    }
}
