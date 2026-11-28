package com.bawa.wallet.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Without a provider (Step 5) the only honest answer for balances
 * and history is Unavailable — never $0.00, never an invented
 * transaction.
 */
class BalanceHistoryUnavailableTest {

    @Test
    fun balancesUnavailableWithoutProvider() = runBlocking {
        val result = NoProviderBalanceRepository().balance("eth", "0x0000000000000000000000000000000000000000")
        assertTrue(result is BalanceResult.Unavailable)
        assertEquals(
            "No provider is selected, so no balance can be shown.",
            (result as BalanceResult.Unavailable).reason
        )
    }

    @Test
    fun historyUnavailableWithoutProvider() = runBlocking {
        val repo = NoProviderHistoryRepository()
        val history = repo.history("eth", "0x0000000000000000000000000000000000000000")
        assertTrue(history is HistoryResult.Unavailable)
        val lookup = repo.lookup("eth", "0xabc")
        assertTrue(lookup is HistoryResult.Unavailable)
    }
}
