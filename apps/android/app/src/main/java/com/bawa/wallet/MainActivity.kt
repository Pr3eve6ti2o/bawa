package com.bawa.wallet

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel
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
        enableEdgeToEdge()

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF4FC3F7),
                    background = Color(0xFF121212),
                    surface = Color(0xFF1E1E1E),
                    surfaceVariant = Color(0xFF2A2A2A),
                    onBackground = Color.White,
                    onSurface = Color.White,
                    onSurfaceVariant = Color(0xFFAAAAAA),
                    outline = Color(0xFF3A3A3A),
                    error = Color(0xFFEF5350)
                )
            ) {
                val vm: WalletViewModel = viewModel()
                BawaApp(vm)
            }
        }
    }
}

@Composable
fun BawaApp(vm: WalletViewModel) {
    val screen by vm.currentScreen.collectAsState()

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
