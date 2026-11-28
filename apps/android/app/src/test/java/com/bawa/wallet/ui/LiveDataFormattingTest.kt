package com.bawa.wallet.ui

import com.bawa.wallet.data.BalanceResult
import com.bawa.wallet.data.network.PriceResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Display formatting for live data (Step 6). The honesty rules:
 * unavailable formats to null (the caller shows the reason), and a
 * real total under one cent never reads "$0.00".
 */
class LiveDataFormattingTest {

    @Test
    fun cryptoAmountFromBaseUnits() {
        assertEquals("1", formatCryptoAmount("1000000000000000000", 18))
        assertEquals("1.5", formatCryptoAmount("1500000", 6))
        assertEquals("0.000001", formatCryptoAmount("1", 6))
        assertEquals("0", formatCryptoAmount("0", 18))
        assertEquals("2.5", formatCryptoAmount("2500000000000000000", 18))
    }

    @Test
    fun cryptoAmountRejectsBadInput() {
        assertNull(formatCryptoAmount("not-a-number", 18))
        assertNull(formatCryptoAmount("", 6))
        assertNull(formatCryptoAmount("-5", 6))
    }

    @Test
    fun unavailableBalanceHasNoAmount() {
        val unavailable = BalanceResult.Unavailable("no provider")
        assertNull(unavailable.displayAmount())
        val available = BalanceResult.Available("1000000", 6)
        assertEquals("1", available.displayAmount())
    }

    @Test
    fun usdValueNeedsBothSides() {
        val balance = BalanceResult.Available("1000000000000000000", 18)
        val price = PriceResult.Available(2000.0, 2.5, "CoinGecko")
        assertEquals(2000.0, usdValue(balance, price)!!, 0.001)
        assertNull(usdValue(BalanceResult.Unavailable("x"), price))
        assertNull(usdValue(balance, PriceResult.Unavailable("x")))
    }

    @Test
    fun usdFormatsGrouped() {
        assertEquals("\$2,000.00", formatUsd(2000.0))
        assertEquals("\$2,002.50", formatUsd(2002.5))
        assertEquals("\$0.10", formatUsd(0.1))
    }

    @Test
    fun tinyTotalNeverReadsZeroDollars() {
        assertEquals("< \$0.01", formatUsd(0.004))
        assertEquals("Unavailable", formatUsd(Double.NaN))
        assertEquals("Unavailable", formatUsd(-1.0))
    }

    @Test
    fun changeFormatsSignedOrNull() {
        assertEquals("+2.34%", formatChange24h(2.34))
        assertEquals("-0.50%", formatChange24h(-0.5))
        assertEquals("+0.00%", formatChange24h(0.0))
        assertNull(formatChange24h(null))
        assertNull(formatChange24h(Double.NaN))
    }

    @Test
    fun totalIsNullWhenNothingPriced() {
        assertNull(totalWorthUsd(emptyList()))
        assertNull(totalWorthUsd(listOf(null, null)))
        assertEquals(2002.5, totalWorthUsd(listOf(2000.0, 2.5, null))!!, 0.001)
    }
}
