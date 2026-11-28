package com.bawa.wallet.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The bundled export parses and matches the Step 1 counts.
 * Reads the asset copies the app ships (src/main/assets/registry/),
 * so a broken copy fails the build here, not on a phone.
 */
class RegistryParsingTest {

    private fun registry(): ChainRegistry =
        ChainRegistry.load(File("src/main/assets/registry/chains.json").readText())

    @Test
    fun exportCountsMatchStep1() {
        val registry = registry()
        assertEquals(1, registry.version)
        assertEquals(87, registry.allChains.size)
        assertEquals(4, registry.testnets.size)
        assertEquals(169, registry.allChains.sumOf { it.rpcEndpoints.size })
        assertEquals(87, registry.allChains.map { it.id }.toSet().size)
    }

    @Test
    fun exportIsNotDirty() {
        val registry = registry()
        assertEquals("7efba143e2ba1238ba0f3a4f4ac06e0a21fd4168", registry.sourceCommit)
        assertEquals(false, registry.sourceDirty)
    }

    @Test
    fun bitcoinRecordFields() {
        val btc = registry().chainById("btc")
        assertNotNull(btc)
        btc!!
        assertEquals("Bitcoin", btc.name)
        assertEquals("BTC", btc.symbol)
        assertEquals("mainnet", btc.network)
        assertEquals(0, btc.coinType)
        assertEquals(8, btc.decimals)
        assertEquals("m/84'/0'/0'/0/0", btc.derivationPath)
        assertEquals("bitcoin", btc.coingeckoId)
        assertTrue(btc.rpcEndpoints.contains("https://mempool.space/api"))
        assertTrue(btc.priceSources.contains("CoinGecko"))
    }

    @Test
    fun everyChainHasAtLeastOneRpcAndACoingeckoId() {
        for (chain in registry().allChains) {
            assertTrue("no RPC for ${chain.id}", chain.rpcEndpoints.isNotEmpty())
            assertTrue("no coingecko id for ${chain.id}", chain.coingeckoId.isNotEmpty())
        }
    }

    @Test
    fun explorerTxUrlBuildsFromPattern() {
        val registry = registry()
        assertEquals(
            "https://explorer.zksync.io/tx/0xabc",
            registry.explorerTxUrl("zksync", "0xabc")
        )
        // Filecoin's placeholder is {messageCid}, not {hash}.
        assertEquals(
            "https://filfox.info/en/message/bafy1",
            registry.explorerTxUrl("filecoin", "bafy1")
        )
        // Bitcoin has no explorer transaction-URL pattern.
        assertNull(registry.explorerTxUrl("btc", "0xabc"))
        assertNull(registry.explorerTxUrl("no-such-chain", "0xabc"))
    }

    @Test
    fun derivationTemplatesPresentExceptSolAndTon() {
        val registry = registry()
        assertEquals("m/84'/0'/{account}'/0/{index}", registry.derivationTemplate("btc"))
        assertEquals("m/44'/60'/{account}'/0/{index}", registry.derivationTemplate("eth"))
        assertNull(registry.derivationTemplate("sol"))
        assertNull(registry.derivationTemplate("ton"))
    }

    @Test
    fun testnetsAreFourWithDevnetNames() {
        val testnets = registry().testnets
        assertEquals(
            listOf("Bitcoin testnet4", "Ethereum Sepolia", "TRON Nile", "TON testnet"),
            testnets.map { it.devnetName }
        )
        assertEquals("https://mempool.space/testnet4/api", registry().testnetById("btc")?.apiBaseUrl)
    }

    @Test
    fun allChainsAreMainnet() {
        assertTrue(registry().allChains.all { it.network == "mainnet" })
    }
}
