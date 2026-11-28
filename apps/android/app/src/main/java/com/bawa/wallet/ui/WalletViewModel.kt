package com.bawa.wallet.ui

import androidx.lifecycle.ViewModel
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.ExtendedKeyValidator
import com.bawa.wallet.core.ValidationResult
import com.bawa.wallet.data.ChainRecord
import com.bawa.wallet.data.ChainRegistry
import com.bawa.wallet.data.TestnetRecord
import com.bawa.wallet.data.TokenRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

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

/**
 * Holds validated extended public keys in memory only; persistence is OPEN.
 * On-device address derivation is OPEN and is not performed here.
 *
 * Step 3 data layer: the chain registry and token lists load from the
 * generated export bundled in assets (built by MainActivity's factory).
 * Both are optional so existing no-argument construction keeps working;
 * with no registry the chains/testnets flows are empty and the screens
 * fall back to their hardcoded labels.
 */
class WalletViewModel(
    private val chainRegistry: ChainRegistry? = null,
    private val tokenRepository: TokenRepository? = null
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

    fun openTransactionDetail(txId: String) {
        _detailTxId.value = txId
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
}
