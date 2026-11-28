package com.bawa.wallet.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.ExtendedKeyValidator
import com.bawa.wallet.core.ValidationResult
import com.bawa.wallet.data.AddressDeriver
import com.bawa.wallet.data.BalanceRepository
import com.bawa.wallet.data.BalanceResult
import com.bawa.wallet.data.ChainRecord
import com.bawa.wallet.data.ChainRegistry
import com.bawa.wallet.data.DerivedAddressResult
import com.bawa.wallet.data.HistoryRepository
import com.bawa.wallet.data.HistoryResult
import com.bawa.wallet.data.LiveBalanceRepository
import com.bawa.wallet.data.TestnetRecord
import com.bawa.wallet.data.TokenRepository
import com.bawa.wallet.data.network.PriceRepository
import com.bawa.wallet.data.network.PriceResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Review is a state of Send and Lock is an app state, not extra screens.
enum class Screen {
    Welcome,
    CreateWallet,
    ImportWallet,
    MnemonicBackup,
    Portfolio,
    AssetList,
    AssetDetail,
    Receive,
    Send,
    TransactionHistory,
    TransactionDetail,
    NetworkSelection,
    WalletManagement,
    SecuritySettings
}

/** xpub is public and must never hold a private extended key. */
data class WatchOnlyWallet(
    val chain: Chain,
    val xpub: String,
    val label: String
)

enum class UiState { Loading, Empty, Ready, Error, Locked, GateFailed }

/** Which screen a QR scan fills: the Send recipient, or the Receive check card. */
enum class ScanTarget { SendRecipient, ReceiveCheck }

/**
 * Holds validated extended public keys in memory only; persistence is OPEN.
 * On-device address derivation is OPEN and is not performed here.
 *
 * Step 3 data layer: the chain registry and token lists load from the
 * generated export bundled in assets (built by MainActivity's factory).
 * Both are optional so existing no-argument construction keeps working;
 * with no registry the chains/testnets flows are empty and the screens
 * fall back to their hardcoded labels.
 *
 * Step 6 live data: the live repositories and the address deriver are
 * optional in the same pattern. With none of them the live flows stay
 * empty and the screens keep their honest "no provider" states; with
 * them, [refreshLiveData] fetches real balances, token balances,
 * prices and history for the imported wallets and the screens show
 * them. A fetch never invents a value: a failed fetch is an
 * Unavailable carrying the reason, never $0.00 and never a fabricated
 * transaction. Fetching runs on Dispatchers.IO, never the UI thread.
 * The ViewModel never fetches on its own — screens trigger a refresh
 * when they appear (LaunchedEffect) and the Refresh button calls
 * [requestRefresh] — so [addWallet] stays synchronous and the existing
 * no-argument construction keeps working in plain unit tests (no Main
 * dispatcher is touched except by [requestRefresh]/[requestLookup],
 * which are the UI's entry points).
 */
class WalletViewModel(
    private val chainRegistry: ChainRegistry? = null,
    private val tokenRepository: TokenRepository? = null,
    private val balanceRepository: BalanceRepository? = null,
    private val historyRepository: HistoryRepository? = null,
    private val priceRepository: PriceRepository? = null,
    private val addressDeriver: AddressDeriver? = null
) : ViewModel() {
    private val _currentScreen = MutableStateFlow(Screen.Welcome)
    val currentScreen: StateFlow<Screen> = _currentScreen.asStateFlow()

    /** All 87 mainnet chains from the registry, in export order; empty when no registry was loaded. */
    val registryChains: StateFlow<List<ChainRecord>> =
        MutableStateFlow(chainRegistry?.allChains.orEmpty()).asStateFlow()

    /** The 4 testnets from the registry; empty when no registry was loaded. */
    val registryTestnets: StateFlow<List<TestnetRecord>> =
        MutableStateFlow(chainRegistry?.testnets.orEmpty()).asStateFlow()

    /** True when the bundled registry export loaded (Step 3 data layer present). */
    val registryLoaded: Boolean = chainRegistry != null

    /** True when at least one live repository or the deriver was injected (Step 6 live data present). */
    val liveAvailable: Boolean =
        balanceRepository != null || historyRepository != null ||
            priceRepository != null || addressDeriver != null

    /** Registry record for an importable chain (Chain.BTC -> "btc"); null when not loaded or not listed. */
    fun chainRecord(chain: Chain): ChainRecord? =
        chainRegistry?.chainById(chain.name.lowercase())

    /** Registry network label for an importable chain ("Mainnet"); null when not loaded. */
    fun chainNetworkLabel(chain: Chain): String? =
        chainRecord(chain)?.network?.replaceFirstChar { it.uppercaseChar() }

    /** Curated tokens on one chain from the token export; empty when not loaded or none listed. */
    fun tokensForChain(chainId: String) =
        tokenRepository?.tokensForChain(chainId).orEmpty()

    // Navigation stack (layout makeover, Phase 2): the app is a
    // single-screen state machine (WDK Screens.kt shape) with stack
    // navigation for everything off home — no bottom tab bar (Rabby
    // Mobile: the tab bar is deliberately hidden; home + fixed bottom
    // actions + stack is the whole mobile pattern). navigate() pushes
    // the screen being left; goBack() pops to it. When the stack is
    // empty, goBack() falls back to the screen's fixed parent, so back
    // never exits the app from a sub-screen.
    private val _backStack = MutableStateFlow<List<Screen>>(emptyList())

    private val _wallets = MutableStateFlow<Map<Chain, WatchOnlyWallet?>>(
        Chain.values().associateWith { null }
    )
    val wallets: StateFlow<Map<Chain, WatchOnlyWallet?>> = _wallets.asStateFlow()

    private val _uiState = MutableStateFlow<Map<Chain, UiState>>(
        Chain.values().associateWith { UiState.Empty }
    )
    val uiState: StateFlow<Map<Chain, UiState>> = _uiState.asStateFlow()

    private val _errors = MutableStateFlow<Map<Chain, String?>>(
        Chain.values().associateWith { null }
    )
    val errors: StateFlow<Map<Chain, String?>> = _errors.asStateFlow()

    private val _selectedChain = MutableStateFlow(Chain.BTC)
    val selectedChain: StateFlow<Chain> = _selectedChain.asStateFlow()

    private val _locked = MutableStateFlow(false)
    val locked: StateFlow<Boolean> = _locked.asStateFlow()

    // Hide-balance toggle (Rabby DashboardPanel): the total is hidden
    // behind dots, with a text label — never by colour alone.
    private val _hideBalances = MutableStateFlow(false)
    val hideBalances: StateFlow<Boolean> = _hideBalances.asStateFlow()

    private val _detailChain = MutableStateFlow<Chain?>(null)
    val detailChain: StateFlow<Chain?> = _detailChain.asStateFlow()

    private val _detailTxId = MutableStateFlow<String?>(null)
    val detailTxId: StateFlow<String?> = _detailTxId.asStateFlow()

    private val _detailTxChain = MutableStateFlow<Chain?>(null)
    val detailTxChain: StateFlow<Chain?> = _detailTxChain.asStateFlow()

    // ---- Step 6 live data ------------------------------------------

    /** Derived index-0 address per imported chain, or the reason derivation failed. */
    private val _addresses = MutableStateFlow<Map<Chain, DerivedAddressResult>>(emptyMap())
    val addresses: StateFlow<Map<Chain, DerivedAddressResult>> = _addresses.asStateFlow()

    /** Native balance per imported chain; absent until a fetch runs. */
    private val _balances = MutableStateFlow<Map<Chain, BalanceResult>>(emptyMap())
    val balances: StateFlow<Map<Chain, BalanceResult>> = _balances.asStateFlow()

    /** Curated-token balances, keyed by token key ("eth:0x…"). */
    private val _tokenBalances = MutableStateFlow<Map<String, BalanceResult>>(emptyMap())
    val tokenBalances: StateFlow<Map<String, BalanceResult>> = _tokenBalances.asStateFlow()

    /**
     * Live prices, keyed by chain id for native assets ("btc") and by
     * token key for curated tokens ("eth:0x…"). Absent until fetched.
     */
    private val _prices = MutableStateFlow<Map<String, PriceResult>>(emptyMap())
    val prices: StateFlow<Map<String, PriceResult>> = _prices.asStateFlow()

    /** Transaction history per imported chain; absent until a fetch runs. */
    private val _history = MutableStateFlow<Map<Chain, HistoryResult>>(emptyMap())
    val history: StateFlow<Map<Chain, HistoryResult>> = _history.asStateFlow()

    /** Chains with a refresh currently in flight (the Loading state). */
    private val _refreshing = MutableStateFlow<Set<Chain>>(emptySet())
    val refreshing: StateFlow<Set<Chain>> = _refreshing.asStateFlow()

    /** Wall-clock ms of the last completed refresh, or null when none has run. */
    private val _lastRefreshMs = MutableStateFlow<Long?>(null)
    val lastRefreshMs: StateFlow<Long?> = _lastRefreshMs.asStateFlow()

    /**
     * Total worth of priced holdings in USD, or null when nothing is
     * priced — the UI shows "Unavailable", never $0.00. Unpriced
     * holdings are excluded from the sum and counted in
     * [unpricedHoldings].
     */
    private val _totalWorthUsd = MutableStateFlow<Double?>(null)
    val totalWorthUsd: StateFlow<Double?> = _totalWorthUsd.asStateFlow()

    /** Holdings with a real balance but no price — listed without a value, never $0.00. */
    private val _unpricedHoldings = MutableStateFlow(0)
    val unpricedHoldings: StateFlow<Int> = _unpricedHoldings.asStateFlow()

    /** Result of the last hash lookup (Track), or null when none ran / the hash was blank. */
    private val _lookupResult = MutableStateFlow<HistoryResult?>(null)
    val lookupResult: StateFlow<HistoryResult?> = _lookupResult.asStateFlow()

    /** The hash the last lookup ran for, trimmed. */
    private val _lookupHash = MutableStateFlow("")
    val lookupHash: StateFlow<String> = _lookupHash.asStateFlow()

    /** Scanner overlay target, or null when the scanner is closed. */
    private val _scanTarget = MutableStateFlow<ScanTarget?>(null)
    val scanTarget: StateFlow<ScanTarget?> = _scanTarget.asStateFlow()

    /** Last scanned text (stored verbatim — no URI parsing), or null when nothing was scanned. */
    private val _scannedAddress = MutableStateFlow<String?>(null)
    val scannedAddress: StateFlow<String?> = _scannedAddress.asStateFlow()

    /** Last scanner error (camera failure, permission denied), or null. */
    private val _scanError = MutableStateFlow<String?>(null)
    val scanError: StateFlow<String?> = _scanError.asStateFlow()

    /** Send recipient, editable and filled by the scanner. Sending itself is not implemented. */
    private val _sendRecipient = MutableStateFlow("")
    val sendRecipient: StateFlow<String> = _sendRecipient.asStateFlow()

    /** One chain's live data, fetched together. Null when the chain has no imported wallet. */
    private data class ChainLiveData(
        val chain: Chain,
        val addressResult: DerivedAddressResult?,
        val balance: BalanceResult?,
        val tokenBalances: Map<String, BalanceResult>,
        val history: HistoryResult?,
        val prices: Map<String, PriceResult>
    )

    /**
     * Fetches live data for the imported wallets (all watch-only
     * chains by default, or [chains] when given). Chains already
     * refreshing are skipped, and a call with no live repositories
     * configured is a no-op. Runs on Dispatchers.IO. A failed fetch
     * lands as Unavailable with the reason — this never throws for a
     * provider failure and never invents a value.
     */
    suspend fun refreshLiveData(chains: Set<Chain>? = null) {
        val targets = (chains ?: Chain.watchOnlyChains.toSet())
            .filter { _wallets.value[it] != null }
            .filter { it !in _refreshing.value }
            .toSet()
        if (targets.isEmpty()) return
        if (!liveAvailable) return
        _refreshing.update { it + targets }
        try {
            val results = withContext(Dispatchers.IO) {
                targets.map { async { refreshChain(it) } }.awaitAll().filterNotNull()
            }
            for (result in results) {
                result.addressResult?.let { address ->
                    _addresses.update { it + (result.chain to address) }
                }
                result.balance?.let { balance ->
                    _balances.update { it + (result.chain to balance) }
                }
                if (result.tokenBalances.isNotEmpty()) {
                    _tokenBalances.update { it + result.tokenBalances }
                }
                result.history?.let { history ->
                    _history.update { it + (result.chain to history) }
                }
                if (result.prices.isNotEmpty()) {
                    _prices.update { it + result.prices }
                }
            }
            _lastRefreshMs.value = System.currentTimeMillis()
            recomputeTotals(_balances.value, _tokenBalances.value, _prices.value)
        } finally {
            _refreshing.update { it - targets }
        }
    }

    /** UI entry point for a refresh (Refresh button). */
    fun requestRefresh(chains: Set<Chain>? = null) {
        viewModelScope.launch { refreshLiveData(chains) }
    }

    private suspend fun refreshChain(chain: Chain): ChainLiveData? = coroutineScope {
        val wallet = _wallets.value[chain] ?: return@coroutineScope null
        val chainId = chain.id

        // Derivation first: balances and history need the address.
        // A null deriver means no address and no address-dependent
        // fetch; prices do not need an address and still run.
        val addressResult = addressDeriver?.deriveAddress(chain, wallet.xpub, 0)
        val address = (addressResult as? DerivedAddressResult.Available)?.address

        val balanceAsync = async {
            if (balanceRepository == null || address == null) null
            else safeLiveFetch(
                { BalanceResult.Unavailable("Balance lookup failed for $chainId: $it") }
            ) { balanceRepository.balance(chainId, address) }
        }
        val tokenBalancesAsync = async {
            val live = balanceRepository as? LiveBalanceRepository
            if (live == null || address == null) emptyMap()
            else safeLiveFetch({ emptyMap<String, BalanceResult>() }) {
                live.tokenBalances(chainId, address)
                    .associate { (token, result) -> token.tokenKey to result }
            }
        }
        val historyAsync = async {
            if (historyRepository == null || address == null) null
            else safeLiveFetch(
                { HistoryResult.Unavailable("History lookup failed for $chainId: $it") }
            ) { historyRepository.history(chainId, address) }
        }
        val pricesAsync = async {
            if (priceRepository == null) emptyMap()
            else {
                val native = safeLiveFetch({ emptyMap<String, PriceResult>() }) {
                    priceRepository.nativePrices(listOf(chainId))
                }
                val tokenKeys = tokenRepository?.tokensForChain(chainId)
                    ?.map { it.tokenKey }.orEmpty()
                val tokenPrices = if (tokenKeys.isEmpty()) emptyMap()
                else safeLiveFetch({ emptyMap<String, PriceResult>() }) {
                    priceRepository.prices(tokenKeys)
                }
                native + tokenPrices
            }
        }

        ChainLiveData(
            chain = chain,
            addressResult = addressResult,
            balance = balanceAsync.await(),
            tokenBalances = tokenBalancesAsync.await(),
            history = historyAsync.await(),
            prices = pricesAsync.await()
        )
    }

    private fun recomputeTotals(
        balances: Map<Chain, BalanceResult>,
        tokenBalances: Map<String, BalanceResult>,
        prices: Map<String, PriceResult>
    ) {
        val values = mutableListOf<Double?>()
        var unpriced = 0
        for ((chain, balance) in balances) {
            if (balance !is BalanceResult.Available) continue
            val value = prices[chain.id]?.let { usdValue(balance, it) }
            if (value == null) unpriced++ else values += value
        }
        for ((tokenKey, balance) in tokenBalances) {
            if (balance !is BalanceResult.Available) continue
            val value = prices[tokenKey]?.let { usdValue(balance, it) }
            if (value == null) unpriced++ else values += value
        }
        _totalWorthUsd.value = totalWorthUsd(values)
        _unpricedHoldings.value = unpriced
    }

    /**
     * Looks one transaction hash up on [chain] (Track). The result
     * lands in [lookupResult]; a blank hash clears it. A missing
     * history repository answers Unavailable, never a fabricated
     * transaction.
     */
    suspend fun lookupTransaction(chain: Chain, txHash: String) {
        val hash = txHash.trim()
        _lookupHash.value = hash
        // Clear the previous answer first, so a slow lookup never
        // shows a stale result for a different hash.
        _lookupResult.value = null
        if (hash.isEmpty()) {
            return
        }
        val repo = historyRepository
        _lookupResult.value = if (repo == null) {
            HistoryResult.Unavailable(
                "No provider is selected, so this app cannot fetch transactions."
            )
        } else {
            withContext(Dispatchers.IO) {
                safeLiveFetch(
                    { HistoryResult.Unavailable("Transaction lookup failed: $it") }
                ) { repo.lookup(chain.id, hash) }
            }
        }
    }

    /** UI entry point for a hash lookup (Look up button). */
    fun requestLookup(chain: Chain, txHash: String) {
        viewModelScope.launch { lookupTransaction(chain, txHash) }
    }

    /** A repository call that throws anyway (a bug, not a provider failure) becomes Unavailable, never a crash. */
    private suspend fun <T> safeLiveFetch(
        onError: (String) -> T,
        block: suspend () -> T
    ): T = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        onError(e.message ?: e.javaClass.simpleName)
    }

    fun navigate(screen: Screen) {
        if (screen == _currentScreen.value) return
        _backStack.update { it + _currentScreen.value }
        _currentScreen.value = screen
    }

    /** Pop the navigation stack, or fall back to the screen's fixed parent. */
    fun goBack() {
        val stack = _backStack.value
        if (stack.isNotEmpty()) {
            _currentScreen.value = stack.last()
            _backStack.update { it.dropLast(1) }
        } else {
            _currentScreen.value = defaultParent(_currentScreen.value)
        }
    }

    // Fixed parents — these are the destinations the old hardcoded
    // onBack handlers used, kept as the empty-stack fallback.
    private fun defaultParent(screen: Screen): Screen = when (screen) {
        Screen.Welcome -> Screen.Welcome
        Screen.CreateWallet -> Screen.Welcome
        Screen.ImportWallet -> Screen.Welcome
        Screen.MnemonicBackup -> Screen.SecuritySettings
        Screen.Portfolio -> Screen.Portfolio
        Screen.AssetList -> Screen.Portfolio
        Screen.AssetDetail -> Screen.AssetList
        Screen.Receive -> Screen.Portfolio
        Screen.Send -> Screen.Portfolio
        Screen.TransactionHistory -> Screen.Portfolio
        Screen.TransactionDetail -> Screen.TransactionHistory
        Screen.NetworkSelection -> Screen.Welcome
        Screen.WalletManagement -> Screen.Welcome
        Screen.SecuritySettings -> Screen.Welcome
    }

    fun toggleHideBalances() {
        _hideBalances.update { !it }
    }

    fun selectChain(chain: Chain) {
        _selectedChain.value = chain
    }

    fun openAssetDetail(chain: Chain) {
        _detailChain.value = chain
        navigate(Screen.AssetDetail)
    }

    fun openTransactionDetail(txId: String, chain: Chain) {
        _detailTxId.value = txId
        _detailTxChain.value = chain
        navigate(Screen.TransactionDetail)
    }

    fun addWallet(chain: Chain, xpub: String, label: String): ValidationResult {
        val trimmedXpub = xpub.trim()
        val result = ExtendedKeyValidator.validate(trimmedXpub, chain)
        if (result is ValidationResult.Invalid) {
            return result
        }

        val wallet = WatchOnlyWallet(chain, trimmedXpub, label.trim())
        _wallets.update { it + (chain to wallet) }
        _uiState.update { it + (chain to UiState.Ready) }
        _errors.update { it + (chain to null) }
        return ValidationResult.Valid
    }

    fun removeWallet(chain: Chain) {
        _wallets.update { it + (chain to null) }
        _uiState.update { it + (chain to UiState.Empty) }
        _errors.update { it + (chain to null) }
        _addresses.update { it - chain }
        _balances.update { it - chain }
        _history.update { it - chain }
        // Token keys are "chain:contract", native prices are keyed by
        // chain id — both drop by prefix, no repository needed.
        _tokenBalances.update { current ->
            current.filterKeys { key -> !key.startsWith("${chain.id}:") }
        }
        _prices.update { current ->
            current.filterKeys { key ->
                key != chain.id && !key.startsWith("${chain.id}:")
            }
        }
        recomputeTotals(_balances.value, _tokenBalances.value, _prices.value)
    }

    fun lock() {
        // Locking only hides state in memory and is NOT a security boundary.
        _locked.value = true
        _uiState.value = Chain.values().associateWith { UiState.Locked }
    }

    fun unlock() {
        _locked.value = false
        val currentWallets = _wallets.value
        _uiState.value = Chain.values().associateWith { chain ->
            if (currentWallets[chain] != null) UiState.Ready else UiState.Empty
        }
    }

    // ---- QR scanner -------------------------------------------------

    fun openScanner(target: ScanTarget) {
        _scanError.value = null
        _scanTarget.value = target
    }

    fun closeScanner() {
        _scanTarget.value = null
    }

    /**
     * A scanned code's text, stored verbatim — the scanner only reads
     * the code, it never validates the text as an address and never
     * sends it anywhere. A Send scan also fills the recipient field.
     */
    fun onScanned(text: String) {
        val clean = text.trim()
        _scannedAddress.value = clean
        if (_scanTarget.value == ScanTarget.SendRecipient) {
            _sendRecipient.value = clean
        }
        _scanTarget.value = null
    }

    /** A scanner failure (camera unusable, permission denied). The scanner itself shows the honest state too. */
    fun onScanError(reason: String) {
        _scanError.value = reason
    }

    fun clearScannedAddress() {
        _scannedAddress.value = null
    }

    fun setSendRecipient(value: String) {
        _sendRecipient.value = value
    }
}
