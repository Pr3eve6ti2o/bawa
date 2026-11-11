package com.bawa.wallet.ui

import androidx.lifecycle.ViewModel
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.ExtendedKeyValidator
import com.bawa.wallet.core.ValidationResult
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
 */
class WalletViewModel : ViewModel() {
    private val _currentScreen = MutableStateFlow(Screen.Welcome)
    val currentScreen: StateFlow<Screen> = _currentScreen.asStateFlow()

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

    private val _detailChain = MutableStateFlow<Chain?>(null)
    val detailChain: StateFlow<Chain?> = _detailChain.asStateFlow()

    private val _detailTxId = MutableStateFlow<String?>(null)
    val detailTxId: StateFlow<String?> = _detailTxId.asStateFlow()

    fun navigate(screen: Screen) {
        _currentScreen.value = screen
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
