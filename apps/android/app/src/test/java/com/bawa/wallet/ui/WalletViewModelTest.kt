package com.bawa.wallet.ui

import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.Reason
import com.bawa.wallet.core.ValidationResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the Add-button logic path: WalletViewModel.addWallet, the function
 * ImportWalletScreen's Add button calls. Covers the store/validate/overwrite/trim
 * behaviour; the Compose click-through is covered by ImportWalletAddButtonTest.
 */
class WalletViewModelTest {
    private val ethXpub =
        "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc"
    private val btcZpub =
        "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9"

    @Test
    fun validEthAddStoresWallet() {
        val vm = WalletViewModel()

        val result = vm.addWallet(Chain.ETH, ethXpub, "My ETH")

        assertEquals(ValidationResult.Valid, result)
        val wallet = vm.wallets.value[Chain.ETH]
        assertEquals(ethXpub, wallet?.xpub)
        assertEquals("My ETH", wallet?.label)
        assertEquals(UiState.Ready, vm.uiState.value[Chain.ETH])
        assertNull(vm.wallets.value[Chain.BTC])
        assertNull(vm.wallets.value[Chain.TRX])
        assertEquals(UiState.Empty, vm.uiState.value[Chain.BTC])
    }

    @Test
    fun badChecksumRejected() {
        val vm = WalletViewModel()
        val corrupted = ethXpub.dropLast(1) + "1"

        val result = vm.addWallet(Chain.ETH, corrupted, "Bad")

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_CHECKSUM, (result as ValidationResult.Invalid).reason)
        assertEquals("invalid extended key checksum", result.message)
        assertNull(vm.wallets.value[Chain.ETH])
        assertEquals(UiState.Empty, vm.uiState.value[Chain.ETH])
    }

    @Test
    fun reAddOverwritesSameChain() {
        val vm = WalletViewModel()

        vm.addWallet(Chain.ETH, ethXpub, "First")
        vm.addWallet(Chain.ETH, ethXpub, "Second")

        assertEquals("Second", vm.wallets.value[Chain.ETH]?.label)
        assertEquals(ethXpub, vm.wallets.value[Chain.ETH]?.xpub)
    }

    @Test
    fun whitespaceTrimmed() {
        val vm = WalletViewModel()

        val result = vm.addWallet(Chain.ETH, "  $ethXpub  ", "  My ETH  ")

        assertEquals(ValidationResult.Valid, result)
        assertEquals(ethXpub, vm.wallets.value[Chain.ETH]?.xpub)
        assertEquals("My ETH", vm.wallets.value[Chain.ETH]?.label)
    }

    @Test
    fun wrongVersionRejected() {
        val vm = WalletViewModel()

        val result = vm.addWallet(Chain.ETH, btcZpub, "BTC key on ETH")

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.VERSION_NOT_ALLOWED, (result as ValidationResult.Invalid).reason)
        assertNull(vm.wallets.value[Chain.ETH])
    }
}
