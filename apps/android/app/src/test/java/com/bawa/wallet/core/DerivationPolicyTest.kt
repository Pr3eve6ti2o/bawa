package com.bawa.wallet.core

import org.junit.Assert.*
import org.junit.Test

class DerivationPolicyTest {
    @Test
    fun btcPathForIndexZeroIsBip84() {
        assertEquals(
            "m/84'/0'/0'/0/0",
            DerivationPolicy.pathFor(Chain.BTC, 0)
        )
    }

    @Test
    fun ethPathForIndexZeroIsBip44() {
        assertEquals(
            "m/44'/60'/0'/0/0",
            DerivationPolicy.pathFor(Chain.ETH, 0)
        )
    }

    @Test
    fun trxPathForIndexZeroIsBip44() {
        assertEquals(
            "m/44'/195'/0'/0/0",
            DerivationPolicy.pathFor(Chain.TRX, 0)
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun indexOutOfRangeThrows() {
        DerivationPolicy.pathFor(Chain.BTC, Int.MAX_VALUE + 1)
    }

    @Test
    fun confirmationPolicyMatchesM38() {
        assertEquals(6, DerivationPolicy.BTC_CONFIRMATIONS)
        assertTrue(DerivationPolicy.ETH_REQUIRES_FINALISED)
        assertEquals(12, DerivationPolicy.ETH_EXTRA_MINIMUM)
        assertEquals(19, DerivationPolicy.TRX_SOLIDIFIED_SUPER_REPRESENTATIVES)
        assertEquals(27, DerivationPolicy.TRX_TOTAL_SUPER_REPRESENTATIVES)
        assertEquals(1, DerivationPolicy.TON_CONFIRMATIONS)
    }

    @Test
    fun testnetsAreTestnetOnly() {
        assertEquals("testnet4", DerivationPolicy.TESTNETS[Chain.BTC])
        assertEquals("Sepolia", DerivationPolicy.TESTNETS[Chain.ETH])
        assertEquals("Nile", DerivationPolicy.TESTNETS[Chain.TRX])
        assertFalse(
            DerivationPolicy.TESTNETS.values.any {
                it.contains("mainnet", ignoreCase = true)
            }
        )
    }

    @Test
    fun engineBindingIsUnavailable() {
        assertEquals("4.8.4", DerivationPolicy.ENGINE_VERSION)
        assertFalse(DerivationPolicy.ENGINE_BINDING_AVAILABLE)
    }
}
