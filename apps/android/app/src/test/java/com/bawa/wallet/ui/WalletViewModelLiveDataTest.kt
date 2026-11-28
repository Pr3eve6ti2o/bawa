package com.bawa.wallet.ui

import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.ValidationResult
import com.bawa.wallet.data.AddressDeriver
import com.bawa.wallet.data.BalanceResult
import com.bawa.wallet.data.ChainRegistry
import com.bawa.wallet.data.DerivedAddressResult
import com.bawa.wallet.data.HistoryResult
import com.bawa.wallet.data.LiveBalanceRepository
import com.bawa.wallet.data.LiveHistoryRepository
import com.bawa.wallet.data.TokenRepository
import com.bawa.wallet.data.TransactionStatus
import com.bawa.wallet.data.network.HttpResult
import com.bawa.wallet.data.network.HttpTransport
import com.bawa.wallet.data.network.PriceRepository
import com.bawa.wallet.data.network.PriceResult
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Step 6: the ViewModel wired to the live Step 5 repositories.
 * Real LiveBalanceRepository / LiveHistoryRepository / PriceRepository
 * run against a fake transport — no test touches the network. Proves
 * balances, token balances, prices, history and the total worth flow
 * into the UI state, Unavailable shows its reason, and no-argument
 * construction still works.
 */
class WalletViewModelLiveDataTest {

    private val ethXpub =
        "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc"
    private val address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    private val usdcKey = "eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    private val txHash = "0x" + "ab".repeat(32)

    // --- Fake transport (network.HttpTransport) ------------------------

    private class FakeTransport : HttpTransport {
        private data class GetRule(val prefix: String, val answer: () -> HttpResult)
        private data class PostRule(val prefix: String, val method: String, val answer: () -> HttpResult)
        private val getRules = mutableListOf<GetRule>()
        private val postRules = mutableListOf<PostRule>()
        val requestedUrls = mutableListOf<String>()

        fun onGet(prefix: String, body: String) {
            getRules += GetRule(prefix) { HttpResult.Response(200, body) }
        }

        fun failGet(prefix: String) {
            getRules += GetRule(prefix) { HttpResult.Failure("fake GET failure") }
        }

        fun onRpc(prefix: String, method: String, body: String) {
            postRules += PostRule(prefix, method) { HttpResult.Response(200, body) }
        }

        fun failRpc(prefix: String, method: String) {
            postRules += PostRule(prefix, method) { HttpResult.Failure("fake RPC failure") }
        }

        override suspend fun get(url: String): HttpResult {
            requestedUrls += url
            return getRules.firstOrNull { url.startsWith(it.prefix) }?.answer?.invoke()
                ?: HttpResult.Failure("no fake GET rule for $url")
        }

        override suspend fun postJson(url: String, body: String): HttpResult {
            requestedUrls += url
            val method = try {
                Json.parseToJsonElement(body).jsonObject["method"]?.jsonPrimitive?.content
            } catch (e: Exception) {
                null
            }
            return postRules.firstOrNull { url.startsWith(it.prefix) && it.method == method }
                ?.answer?.invoke()
                ?: HttpResult.Failure("no fake POST rule for $url")
        }
    }

    private class FakeDeriver(
        private val address: String,
        private val unavailableReason: String? = null
    ) : AddressDeriver {
        override fun deriveAddress(chain: Chain, xpub: String, index: Int): DerivedAddressResult =
            if (unavailableReason != null) {
                DerivedAddressResult.Unavailable(unavailableReason)
            } else {
                DerivedAddressResult.Available(address, chain.fullPath(index))
            }
    }

    // --- Fixtures ------------------------------------------------------

    private fun registry(): ChainRegistry = ChainRegistry.load(
        """
        {"version":1,"sourceCommit":"test","sourceDirty":false,"chainCount":1,
        "chains":[{"id":"eth","name":"Ethereum","symbol":"ETH","network":"mainnet","coinType":60,
        "assetSlip44":60,"coinTypeName":"test","trustWalletCoinType":60,
        "evmChainId":1,"networkId":"test:eth","assetId":"test:eth",
        "profileId":"test-eth","derivationPath":"m/44'/60'/0'/0/0",
        "decimals":18,"rpcEndpoints":["https://rpc1.example"],"coingeckoId":"ethereum",
        "priceSources":["coingecko"],
        "priceFallbackIds":{"coinloreId":"80","coinbaseProduct":"ETH-USD","dexscreenerChainId":"ethereum"}}],
        "testnets":[]}
        """.trimIndent()
    )

    private fun tokens(): TokenRepository = TokenRepository.load(
        """
        {"version":1,"sourceCommit":"test","sourceDirty":false,"tokenCount":1,
        "tokens":[{"chain":"eth","contract":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "tokenKey":"eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "name":"USD Coin","symbol":"USDC","decimals":6,"coingeckoId":"usd-coin",
        "coingeckoPlatform":"ethereum","verifiedSource":"test","priceSource":"test",
        "priceFallback":"test"}]}
        """.trimIndent()
    )

    private fun viewModel(
        transport: HttpTransport,
        deriver: AddressDeriver = FakeDeriver(address)
    ): WalletViewModel {
        val reg = registry()
        val toks = tokens()
        return WalletViewModel(
            chainRegistry = reg,
            tokenRepository = toks,
            balanceRepository = LiveBalanceRepository(reg, toks, transport),
            historyRepository = LiveHistoryRepository(reg, transport, etherscanRetryDelayMs = 0),
            priceRepository = PriceRepository(toks, reg, transport),
            addressDeriver = deriver
        )
    }

    private fun nowSec(): Long = System.currentTimeMillis() / 1000

    private fun rpcResult(resultJson: String): String =
        """{"jsonrpc":"2.0","id":1,"result":$resultJson}"""

    /** Transport stubbed for the happy path: 1 ETH, 2.5 USDC, prices, two history entries. */
    private fun happyTransport(): FakeTransport {
        val transport = FakeTransport()
        transport.onRpc("https://rpc1.example", "eth_getBalance", rpcResult("\"0xde0b6b3a7640000\""))
        transport.onRpc("https://rpc1.example", "eth_call", rpcResult("\"0x2625a0\""))
        transport.onGet(
            "https://api.coingecko.com",
            """{"ethereum": {"usd": 2000.0, "last_updated_at": ${nowSec()}, "usd_24h_change": 2.5},
               "usd-coin": {"usd": 1.0, "last_updated_at": ${nowSec()}}}"""
        )
        transport.onGet(
            "https://eth.blockscout.com/api",
            """{"status":"1","message":"OK","result":[
                {"hash":"0xaaa","from":"$address","to":"0x0000000000000000000000000000000000000001",
                 "value":"1000","timeStamp":"1700000000","txreceipt_status":"1","isError":"0"},
                {"hash":"0xbbb","from":"$address","to":"0x0000000000000000000000000000000000000001",
                 "value":"2000","timeStamp":"1700000001","txreceipt_status":"0","isError":"0"}]}"""
        )
        return transport
    }

    private fun addEth(vm: WalletViewModel) {
        val result = vm.addWallet(Chain.ETH, ethXpub, "My ETH")
        assertEquals(ValidationResult.Valid, result)
    }

    // --- Tests ---------------------------------------------------------

    @Test
    fun noArgConstructionStillWorksAndRefreshIsNoop() = runBlocking {
        val vm = WalletViewModel()

        assertEquals(UiState.Empty, vm.uiState.value[Chain.ETH])
        vm.refreshLiveData()
        assertTrue(vm.balances.value.isEmpty())
        assertTrue(vm.prices.value.isEmpty())
        assertTrue(vm.history.value.isEmpty())
        assertNull(vm.totalWorthUsd.value)
        assertNull(vm.lastRefreshMs.value)

        val result = vm.addWallet(Chain.ETH, ethXpub, "My ETH")
        assertEquals(ValidationResult.Valid, result)
        assertEquals(UiState.Ready, vm.uiState.value[Chain.ETH])
    }

    @Test
    fun refreshFlowsBalancePriceHistoryAndTotalIntoState() = runBlocking {
        val vm = viewModel(happyTransport())
        addEth(vm)

        vm.refreshLiveData()

        val derived = vm.addresses.value[Chain.ETH] as DerivedAddressResult.Available
        assertEquals(address, derived.address)
        assertEquals("m/44'/60'/0'/0/0", derived.path)

        val balance = vm.balances.value[Chain.ETH] as BalanceResult.Available
        assertEquals("1000000000000000000", balance.rawAmount)
        assertEquals(18, balance.decimals)

        val usdc = vm.tokenBalances.value[usdcKey] as BalanceResult.Available
        assertEquals("2500000", usdc.rawAmount)
        assertEquals(6, usdc.decimals)

        val ethPrice = vm.prices.value["eth"] as PriceResult.Available
        assertEquals(2000.0, ethPrice.priceUsd, 0.001)
        assertEquals(2.5, ethPrice.change24h!!, 0.001)
        assertEquals("CoinGecko", ethPrice.source)
        val usdcPrice = vm.prices.value[usdcKey] as PriceResult.Available
        assertEquals(1.0, usdcPrice.priceUsd, 0.001)

        // Total: 1 ETH x $2000 + 2.5 USDC x $1.
        assertEquals(2002.5, vm.totalWorthUsd.value!!, 0.001)
        assertEquals(0, vm.unpricedHoldings.value)

        val history = vm.history.value[Chain.ETH] as HistoryResult.Available
        assertEquals(2, history.transactions.size)
        assertEquals(TransactionStatus.Confirmed, history.transactions[0].status)
        assertEquals(TransactionStatus.Failed, history.transactions[1].status)
        assertTrue(vm.lastRefreshMs.value != null)
        assertTrue(vm.refreshing.value.isEmpty())
    }

    @Test
    fun unavailableBalanceShowsReasonAndTotalStaysNull() = runBlocking {
        val transport = FakeTransport()
        transport.failRpc("https://rpc1.example", "eth_getBalance")
        transport.failRpc("https://rpc1.example", "eth_call")
        transport.onGet(
            "https://api.coingecko.com",
            """{"ethereum": {"usd": 2000.0, "last_updated_at": ${nowSec()}}}"""
        )
        val vm = viewModel(transport)
        addEth(vm)

        vm.refreshLiveData()

        val balance = vm.balances.value[Chain.ETH] as BalanceResult.Unavailable
        assertTrue(balance.reason.contains("All RPC endpoints failed"))
        // The price still arrived — but with no balance there is no
        // holding to value, so the total stays null, never $0.00.
        assertTrue(vm.prices.value["eth"] is PriceResult.Available)
        assertNull(vm.totalWorthUsd.value)
        assertEquals(0, vm.unpricedHoldings.value)
    }

    @Test
    fun unpricedHoldingExcludedFromTotal() = runBlocking {
        val transport = FakeTransport()
        transport.onRpc("https://rpc1.example", "eth_getBalance", rpcResult("\"0xde0b6b3a7640000\""))
        transport.onRpc("https://rpc1.example", "eth_call", rpcResult("\"0x2625a0\""))
        // CoinGecko prices the token but not the native asset.
        transport.onGet(
            "https://api.coingecko.com",
            """{"usd-coin": {"usd": 1.0, "last_updated_at": ${nowSec()}}}"""
        )
        val vm = viewModel(transport)
        addEth(vm)

        vm.refreshLiveData()

        assertTrue(vm.prices.value["eth"] is PriceResult.Unavailable)
        assertEquals(2.5, vm.totalWorthUsd.value!!, 0.001)
        assertEquals(1, vm.unpricedHoldings.value)
    }

    @Test
    fun derivationUnavailableSkipsBalanceButNotPrices() = runBlocking {
        val vm = viewModel(
            happyTransport(),
            FakeDeriver(address, unavailableReason = "no engine on this device")
        )
        addEth(vm)

        vm.refreshLiveData()

        val derived = vm.addresses.value[Chain.ETH] as DerivedAddressResult.Unavailable
        assertEquals("no engine on this device", derived.reason)
        // No address, so no balance or history fetch was possible.
        assertNull(vm.balances.value[Chain.ETH])
        assertNull(vm.history.value[Chain.ETH])
        // Prices do not need an address and still arrived.
        assertTrue(vm.prices.value["eth"] is PriceResult.Available)
        assertNull(vm.totalWorthUsd.value)
    }

    @Test
    fun historyLookupFindsTransactionAndBlankClears() = runBlocking {
        val transport = happyTransport()
        transport.onRpc(
            "https://rpc1.example",
            "eth_getTransactionByHash",
            rpcResult("""{"hash":"$txHash"}""")
        )
        transport.onRpc(
            "https://rpc1.example",
            "eth_getTransactionReceipt",
            rpcResult("""{"status":"0x1"}""")
        )
        val vm = viewModel(transport)

        vm.lookupTransaction(Chain.ETH, txHash)

        val result = vm.lookupResult.value as HistoryResult.Available
        assertEquals(1, result.transactions.size)
        assertEquals(txHash, result.transactions[0].hash)
        assertEquals(TransactionStatus.Confirmed, result.transactions[0].status)
        assertEquals(txHash, vm.lookupHash.value)

        vm.lookupTransaction(Chain.ETH, "   ")
        assertNull(vm.lookupResult.value)
        assertEquals("", vm.lookupHash.value)
    }

    @Test
    fun scanFillsSendRecipientAndRecordsScannedText() {
        val vm = WalletViewModel()

        vm.openScanner(ScanTarget.SendRecipient)
        assertEquals(ScanTarget.SendRecipient, vm.scanTarget.value)
        vm.onScanned("  0xRecipientAddress  ")
        assertEquals("0xRecipientAddress", vm.sendRecipient.value)
        assertEquals("0xRecipientAddress", vm.scannedAddress.value)
        assertNull(vm.scanTarget.value)

        vm.openScanner(ScanTarget.ReceiveCheck)
        vm.onScanned("0xAnotherAddress")
        // A Receive scan shows the text but does not touch the
        // Send recipient.
        assertEquals("0xRecipientAddress", vm.sendRecipient.value)
        assertEquals("0xAnotherAddress", vm.scannedAddress.value)

        vm.onScanError("Camera is not available on this device.")
        assertEquals("Camera is not available on this device.", vm.scanError.value)

        vm.setSendRecipient("0xTyped")
        assertEquals("0xTyped", vm.sendRecipient.value)
        vm.clearScannedAddress()
        assertNull(vm.scannedAddress.value)
    }

    @Test
    fun removeWalletClearsLiveEntries() = runBlocking {
        val vm = viewModel(happyTransport())
        addEth(vm)
        vm.refreshLiveData()
        assertTrue(vm.balances.value.containsKey(Chain.ETH))
        assertEquals(2002.5, vm.totalWorthUsd.value!!, 0.001)

        vm.removeWallet(Chain.ETH)

        assertTrue(vm.balances.value.isEmpty())
        assertTrue(vm.history.value.isEmpty())
        assertTrue(vm.addresses.value.isEmpty())
        assertTrue(vm.tokenBalances.value.isEmpty())
        assertTrue(vm.prices.value.isEmpty())
        assertNull(vm.totalWorthUsd.value)
        assertEquals(0, vm.unpricedHoldings.value)
    }

    @Test
    fun refreshWithNoWalletIsNoop() = runBlocking {
        val vm = viewModel(happyTransport())

        vm.refreshLiveData()

        assertNull(vm.lastRefreshMs.value)
        assertTrue(vm.balances.value.isEmpty())
    }
}
