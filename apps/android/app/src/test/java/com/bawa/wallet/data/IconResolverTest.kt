package com.bawa.wallet.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Every registry chain and every listed token resolves to a bundled
 * logo file that actually exists — and an unknown id/symbol resolves
 * to null, so the UI falls back to the letter disc instead of
 * showing a wrong chain's mark.
 */
class IconResolverTest {

    private fun registry(): ChainRegistry =
        ChainRegistry.load(File("src/main/assets/registry/chains.json").readText())

    private fun tokens(): TokenRepository =
        TokenRepository.load(File("src/main/assets/registry/tokens.json").readText())

    @Test
    fun everyChainResolvesToAnExistingAsset() {
        val chains = registry().allChains
        assertEquals(87, chains.size)
        for (chain in chains) {
            val path = ChainIconResolver.assetPathFor(chain.id)
            assertNotNull("no logo mapping for ${chain.id}", path)
            assertTrue(
                "missing logo file for ${chain.id}: $path",
                File("src/main/assets/$path").isFile
            )
        }
    }

    @Test
    fun knownChainLogos() {
        assertEquals("icons/chains/bitcoin.webp", ChainIconResolver.assetPathFor("btc"))
        assertEquals("icons/chains/ethereum.webp", ChainIconResolver.assetPathFor("eth"))
        assertEquals("icons/chains/smartchain.webp", ChainIconResolver.assetPathFor("bsc"))
        assertEquals("icons/chains/ton.webp", ChainIconResolver.assetPathFor("ton"))
        assertNull(ChainIconResolver.assetPathFor("no-such-chain"))
    }

    @Test
    fun everyTokenSymbolResolvesToAnExistingAsset() {
        val symbols = tokens().allTokens.map { it.symbol }.toSet()
        assertEquals(11, symbols.size)
        for (symbol in symbols) {
            val path = TokenIconResolver.assetPathFor(symbol)
            assertNotNull("no logo mapping for $symbol", path)
            assertTrue(
                "missing logo file for $symbol: $path",
                File("src/main/assets/$path").isFile
            )
        }
    }

    @Test
    fun tokenSymbolAliases() {
        assertEquals("icons/tokens/usdt.webp", TokenIconResolver.assetPathFor("USD₮"))
        assertEquals("icons/tokens/usdt0.webp", TokenIconResolver.assetPathFor("USD₮0"))
        assertEquals("icons/tokens/usdt.webp", TokenIconResolver.assetPathFor("usdt"))
        assertEquals("icons/tokens/usdc.webp", TokenIconResolver.assetPathFor("USDC"))
        assertNull(TokenIconResolver.assetPathFor("NOPE"))
    }
}
