package com.bawa.wallet.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The bundled token export parses and matches the Step 1 counts. */
class TokenRepositoryTest {

    private fun tokens(): TokenRepository =
        TokenRepository.load(File("src/main/assets/registry/tokens.json").readText())

    @Test
    fun exportCountsMatchStep1() {
        val repo = tokens()
        assertEquals(1, repo.version)
        assertEquals(21, repo.allTokens.size)
        assertEquals(10, repo.allTokens.map { it.chain }.toSet().size)
        assertEquals(false, repo.sourceDirty)
    }

    @Test
    fun usdcOnEthFields() {
        val usdc = tokens().tokenByKey("eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
        assertNotNull(usdc)
        usdc!!
        assertEquals("eth", usdc.chain)
        assertEquals("USD Coin", usdc.name)
        assertEquals("USDC", usdc.symbol)
        assertEquals(6, usdc.decimals)
        assertEquals("usd-coin", usdc.coingeckoId)
        assertEquals("coingecko", usdc.priceSource)
        assertEquals("dexscreener", usdc.priceFallback)
    }

    @Test
    fun tokensForChainCounts() {
        val repo = tokens()
        assertEquals(7, repo.tokensForChain("eth").size)
        assertEquals(2, repo.tokensForChain("arb").size)
        assertEquals(1, repo.tokensForChain("sol").size)
        assertEquals(1, repo.tokensForChain("ton").size)
        assertTrue(repo.tokensForChain("no-such-chain").isEmpty())
    }

    @Test
    fun everyTokenHasContractAndCoingeckoId() {
        for (token in tokens().allTokens) {
            assertTrue("no contract for ${token.tokenKey}", token.contract.isNotEmpty())
            assertTrue("no coingecko id for ${token.tokenKey}", token.coingeckoId.isNotEmpty())
            assertEquals(token.tokenKey, "${token.chain}:${token.contract.lowercase()}")
        }
    }
}
