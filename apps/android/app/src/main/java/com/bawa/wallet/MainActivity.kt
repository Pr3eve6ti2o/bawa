package com.bawa.wallet

import android.content.Context
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.bawa.wallet.core.CoreWalletEngine
import com.bawa.wallet.data.AddressDeriver
import com.bawa.wallet.data.ChainRegistry
import com.bawa.wallet.data.CoreAddressDeriver
import com.bawa.wallet.data.LiveBalanceRepository
import com.bawa.wallet.data.LiveHistoryRepository
import com.bawa.wallet.data.TokenRepository
import com.bawa.wallet.data.network.OkHttpHttpTransport
import com.bawa.wallet.data.network.PriceRepository
import com.bawa.wallet.ui.BawaTheme
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.WalletViewModel
import com.bawa.wallet.ui.screens.AssetDetailScreen
import com.bawa.wallet.ui.screens.AssetListScreen
import com.bawa.wallet.ui.screens.CreateWalletScreen
import com.bawa.wallet.ui.screens.ImportWalletScreen
import com.bawa.wallet.ui.screens.MnemonicBackupScreen
import com.bawa.wallet.ui.screens.NetworkSelectionScreen
import com.bawa.wallet.ui.screens.PortfolioScreen
import com.bawa.wallet.ui.screens.ReceiveScreen
import com.bawa.wallet.ui.screens.SecuritySettingsScreen
import com.bawa.wallet.ui.screens.SendScreen
import com.bawa.wallet.ui.screens.TransactionDetailScreen
import com.bawa.wallet.ui.screens.TransactionHistoryScreen
import com.bawa.wallet.ui.screens.WalletManagementScreen
import com.bawa.wallet.ui.screens.WelcomeScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // T47: block screenshots, screen recording and recent-apps
        // thumbnails of receive QR codes and xpubs. UI hardening
        // only — the starter holds no secrets.
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
        enableEdgeToEdge()

        setContent {
            // Bawa Balanced direction-04 tokens (ui/BawaTheme.kt).
            // The previous inline scheme was the vendored WDK palette.
            BawaTheme {
                val vm: WalletViewModel = viewModel(factory = WalletViewModelFactory(applicationContext))
                BawaApp(vm)
            }
        }
    }
}

// Step 3 data layer: builds the chain registry and token lists from
// the generated export bundled in assets. A failed load falls back
// to null (empty registry), never a crash — the screens fall back to
// their hardcoded labels and the app stays usable.
//
// Step 6 live data: the same pattern builds the live repositories
// (balances, history, prices) on one shared OkHttp transport, plus
// the Trust Wallet Core address deriver. Each construction is guarded
// on its own — a failure falls back to null for that piece only
// (the ViewModel treats a missing piece as unavailable, never a
// crash), so the app stays usable with whatever did load. The
// engine's fixture gate does NOT run here: it runs lazily on the
// first derivation, on a background thread (see CoreAddressDeriver).
class WalletViewModelFactory(private val context: Context) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(WalletViewModel::class.java)) {
            val registry = try {
                context.assets.open("registry/chains.json").use { ChainRegistry.load(it) }
            } catch (_: Exception) {
                null
            }
            val tokens = try {
                context.assets.open("registry/tokens.json").use { TokenRepository.load(it) }
            } catch (_: Exception) {
                null
            }
            // One shared transport for every live repository (Step 6
            // unification: the Lane B duplicate transport is gone).
            val transport = try {
                OkHttpHttpTransport()
            } catch (_: Exception) {
                null
            }
            val balances = if (registry != null && tokens != null && transport != null) {
                try {
                    LiveBalanceRepository(registry, tokens, transport)
                } catch (_: Exception) {
                    null
                }
            } else {
                null
            }
            val history = if (registry != null && transport != null) {
                try {
                    LiveHistoryRepository(registry, transport)
                } catch (_: Exception) {
                    null
                }
            } else {
                null
            }
            val prices = if (registry != null && tokens != null && transport != null) {
                try {
                    PriceRepository(tokens, registry, transport)
                } catch (_: Exception) {
                    null
                }
            } else {
                null
            }
            // Watch-only derivation through Trust Wallet Core 4.8.4.
            // CoreWalletEngine() loads the native library and throws
            // when it cannot — that is a null deriver, never a crash.
            val deriver: AddressDeriver? = try {
                CoreAddressDeriver(CoreWalletEngine())
            } catch (_: Exception) {
                null
            }
            @Suppress("UNCHECKED_CAST")
            return WalletViewModel(
                chainRegistry = registry,
                tokenRepository = tokens,
                balanceRepository = balances,
                historyRepository = history,
                priceRepository = prices,
                addressDeriver = deriver
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}

// Layout contract (Lane C verdict, FINDINGS.md §4.5/§8): Rabby Mobile +
// WDK — NO bottom tab bar, a single home screen with a fixed bottom
// action row, stack navigation for everything else, a single-screen
// state machine for Welcome / Create / Import. The 14-screen contract
// is unchanged; only the navigation container differs from web.
@Composable
fun BawaApp(vm: WalletViewModel) {
    val screen by vm.currentScreen.collectAsState()

    // System back reverses the navigation stack (WalletViewModel.goBack),
    // instead of exiting the app from a sub-screen.
    BackHandler { vm.goBack() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        when (screen) {
            Screen.Welcome -> WelcomeScreen(vm)
            Screen.CreateWallet -> CreateWalletScreen(vm)
            Screen.ImportWallet -> ImportWalletScreen(vm)
            Screen.MnemonicBackup -> MnemonicBackupScreen(vm)
            Screen.Portfolio -> PortfolioScreen(vm)
            Screen.AssetList -> AssetListScreen(vm)
            Screen.AssetDetail -> AssetDetailScreen(vm)
            Screen.Receive -> ReceiveScreen(vm)
            Screen.Send -> SendScreen(vm)
            Screen.TransactionHistory -> TransactionHistoryScreen(vm)
            Screen.TransactionDetail -> TransactionDetailScreen(vm)
            Screen.NetworkSelection -> NetworkSelectionScreen(vm)
            Screen.WalletManagement -> WalletManagementScreen(vm)
            Screen.SecuritySettings -> SecuritySettingsScreen(vm)
        }
    }
}
