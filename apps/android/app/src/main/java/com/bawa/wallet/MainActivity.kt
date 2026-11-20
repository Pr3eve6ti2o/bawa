package com.bawa.wallet

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
import androidx.lifecycle.viewmodel.compose.viewModel
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
                val vm: WalletViewModel = viewModel()
                BawaApp(vm)
            }
        }
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
