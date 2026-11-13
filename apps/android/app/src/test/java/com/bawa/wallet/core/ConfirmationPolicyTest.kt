package com.bawa.wallet.core

import com.bawa.wallet.core.ConfirmationPolicy.Assessment
import com.bawa.wallet.core.ConfirmationPolicy.Chain
import com.bawa.wallet.core.ConfirmationPolicy.Observation
import com.bawa.wallet.core.ConfirmationPolicy.Status
import org.junit.Assert.*
import org.junit.Test

// Mirror of apps/web/src/engine/confirmation-policy.test.ts: same
// vectors, same expectations. Fixture hashes are invented; no live
// chain, provider or funds are involved.
class ConfirmationPolicyTest {
    private val hashA = "aa".repeat(32)
    private val hashB = "bb".repeat(32)

    private fun btc(
        inclusionHeight: Int? = 100,
        inclusionBlockHash: String? = hashA,
        canonicalHash: String? = hashA,
        tipHeight: Int? = 105,
        finalized: Boolean = false,
        stale: Boolean = false,
        txid: String = "tx-btc-1",
    ) = Observation(
        chain = Chain.BTC,
        txid = txid,
        inclusionHeight = inclusionHeight,
        inclusionBlockHash = inclusionBlockHash,
        canonicalBlockHashAtInclusionHeight = canonicalHash,
        tipHeight = tipHeight,
        finalized = finalized,
        stale = stale,
    )

    private fun eth(
        inclusionHeight: Int? = 100,
        inclusionBlockHash: String? = hashA,
        canonicalHash: String? = hashA,
        tipHeight: Int? = 111,
        finalized: Boolean = true,
        stale: Boolean = false,
        txid: String = "tx-eth-1",
    ) = Observation(
        chain = Chain.ETH,
        txid = txid,
        inclusionHeight = inclusionHeight,
        inclusionBlockHash = inclusionBlockHash,
        canonicalBlockHashAtInclusionHeight = canonicalHash,
        tipHeight = tipHeight,
        finalized = finalized,
        stale = stale,
    )

    @Test
    fun thresholdsMatchDerivationPolicy() {
        assertEquals(6, ConfirmationPolicy.BTC_CONFIRMATIONS_REQUIRED)
        assertEquals(12, ConfirmationPolicy.ETH_CONFIRMATIONS_MINIMUM)
        assertTrue(ConfirmationPolicy.ETH_REQUIRES_FINALISED)
    }

    @Test
    fun btcSixConfirmationsIsConfirmed() {
        val result = ConfirmationPolicy.assess(btc(tipHeight = 105))
        assertEquals(Status.CONFIRMED, result.status)
        assertEquals(6, result.confirmations)
        assertTrue(result.settlementEligible)
        assertEquals("confirmed for settlement", result.settlementLabel)
    }

    @Test
    fun btcFiveConfirmationsIsIncludedUnconfirmedForSettlement() {
        val result = ConfirmationPolicy.assess(btc(tipHeight = 104))
        assertEquals(Status.INCLUDED, result.status)
        assertEquals(5, result.confirmations)
        assertFalse(result.settlementEligible)
        assertEquals("unconfirmed for settlement", result.settlementLabel)
    }

    @Test
    fun btcOneConfirmationIsIncludedWithActualCount() {
        val result = ConfirmationPolicy.assess(btc(tipHeight = 100))
        assertEquals(Status.INCLUDED, result.status)
        assertEquals(1, result.confirmations)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun btcMempoolOnlyIsSeen() {
        val result = ConfirmationPolicy.assess(
            btc(inclusionHeight = null, inclusionBlockHash = null, canonicalHash = null),
        )
        assertEquals(Status.SEEN, result.status)
        assertNull(result.confirmations)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun ethFinalisedTwelveIsConfirmed() {
        val result = ConfirmationPolicy.assess(eth(tipHeight = 111, finalized = true))
        assertEquals(Status.CONFIRMED, result.status)
        assertEquals(12, result.confirmations)
        assertTrue(result.settlementEligible)
    }

    @Test
    fun ethFinalisedElevenIsIncluded() {
        val result = ConfirmationPolicy.assess(eth(tipHeight = 110, finalized = true))
        assertEquals(Status.INCLUDED, result.status)
        assertEquals(11, result.confirmations)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun ethTwelveWithoutFinalityIsIncludedNeverConfirmed() {
        val result = ConfirmationPolicy.assess(eth(tipHeight = 111, finalized = false))
        assertEquals(Status.INCLUDED, result.status)
        assertEquals(12, result.confirmations)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun ethFiftyWithoutFinalityIsStillNotConfirmed() {
        val result = ConfirmationPolicy.assess(eth(tipHeight = 149, finalized = false))
        assertEquals(Status.INCLUDED, result.status)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun ethFinalisedSixIsIncluded() {
        val result = ConfirmationPolicy.assess(eth(tipHeight = 105, finalized = true))
        assertEquals(Status.INCLUDED, result.status)
        assertEquals(6, result.confirmations)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun reorgRevokesPriorConfirmedStatus() {
        val before = ConfirmationPolicy.assess(btc(tipHeight = 105))
        assertEquals(Status.CONFIRMED, before.status)
        val after = ConfirmationPolicy.assess(btc(tipHeight = 105, canonicalHash = hashB))
        assertEquals(Status.REORGED, after.status)
        assertNull(after.confirmations)
        assertFalse(after.settlementEligible)
        assertEquals("reorged - do not settle", after.settlementLabel)
    }

    @Test
    fun reorgedEthIsNotConfirmedEvenWhenFinalised() {
        val result = ConfirmationPolicy.assess(
            eth(tipHeight = 111, finalized = true, canonicalHash = hashB),
        )
        assertEquals(Status.REORGED, result.status)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun reinclusionReconcilesToSameAssessment() {
        val first = ConfirmationPolicy.assess(btc(tipHeight = 105))
        val again = ConfirmationPolicy.assess(btc(tipHeight = 105))
        assertEquals(first, again)
    }

    @Test
    fun staleObservationIsUnknown() {
        val result = ConfirmationPolicy.assess(btc(tipHeight = 105, stale = true))
        assertEquals(Status.UNKNOWN, result.status)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun missingTipIsUnknown() {
        val result = ConfirmationPolicy.assess(btc(tipHeight = null))
        assertEquals(Status.UNKNOWN, result.status)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun tipBelowInclusionIsUnknown() {
        val result = ConfirmationPolicy.assess(btc(tipHeight = 99))
        assertEquals(Status.UNKNOWN, result.status)
        assertNull(result.confirmations)
    }

    @Test
    fun noCanonicalHashIsUnknown() {
        val result = ConfirmationPolicy.assess(btc(tipHeight = 105, canonicalHash = null))
        assertEquals(Status.UNKNOWN, result.status)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun missingInclusionHashIsUnknown() {
        val result = ConfirmationPolicy.assess(btc(inclusionBlockHash = null))
        assertEquals(Status.UNKNOWN, result.status)
    }

    @Test
    fun missingTxidIsUnknown() {
        val result = ConfirmationPolicy.assess(btc(txid = "   "))
        assertEquals(Status.UNKNOWN, result.status)
    }

    @Test
    fun negativeHeightsAreUnknown() {
        assertEquals(Status.UNKNOWN, ConfirmationPolicy.assess(btc(tipHeight = -1)).status)
        assertEquals(Status.UNKNOWN, ConfirmationPolicy.assess(btc(inclusionHeight = -5)).status)
    }

    @Test
    fun mempoolWithBlockDataIsUnknown() {
        assertEquals(
            Status.UNKNOWN,
            ConfirmationPolicy.assess(
                btc(inclusionHeight = null, inclusionBlockHash = hashA, canonicalHash = null),
            ).status,
        )
        assertEquals(
            Status.UNKNOWN,
            ConfirmationPolicy.assess(
                btc(inclusionHeight = null, inclusionBlockHash = null, canonicalHash = hashA),
            ).status,
        )
    }

    @Test
    fun staleMempoolOnlyIsUnknown() {
        val result = ConfirmationPolicy.assess(
            btc(inclusionHeight = null, inclusionBlockHash = null, canonicalHash = null, stale = true),
        )
        assertEquals(Status.UNKNOWN, result.status)
    }

    @Test
    fun matchingMalformedHashesNeverConfirm() {
        val result = ConfirmationPolicy.assess(
            btc(inclusionBlockHash = "xyz", canonicalHash = "xyz"),
        )
        assertEquals(Status.UNKNOWN, result.status)
        assertFalse(result.settlementEligible)
    }

    @Test
    fun malformedInclusionHashIsUnknown() {
        val result = ConfirmationPolicy.assess(btc(inclusionBlockHash = "0x$hashA"))
        assertEquals(Status.UNKNOWN, result.status)
    }
}
