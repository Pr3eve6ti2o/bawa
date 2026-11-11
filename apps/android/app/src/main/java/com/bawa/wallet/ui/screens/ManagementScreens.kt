package com.bawa.wallet.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.bawa.wallet.ui.OutlineActionButton
import com.bawa.wallet.ui.PrimaryButton
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.ScreenHeader
import com.bawa.wallet.ui.TestnetBadge
import com.bawa.wallet.ui.WalletViewModel

@Composable
fun SendScreen(vm: WalletViewModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Send", onBack = { vm.navigate(Screen.Portfolio) })
        Text(
            text = "Sending is not implemented in this starter. " +
                "There is no signing, broadcast or transaction-construction code."
        )
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Future procedure — not implemented",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "frozen intent → human-readable details → " +
                        "validate payload against intent → broadcast the exact signed payload"
                )
            }
        }
        OutlinedTextField(
            value = "",
            onValueChange = {},
            enabled = false,
            label = { Text("Recipient") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = "",
            onValueChange = {},
            enabled = false,
            label = { Text("Amount") },
            modifier = Modifier.fillMaxWidth()
        )
        PrimaryButton(title = "Review", enabled = false, onClick = {})
        OutlineActionButton(title = "Receive", onClick = { vm.navigate(Screen.Receive) })
    }
}

@Composable
fun TransactionHistoryScreen(vm: WalletViewModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Transactions", onBack = { vm.navigate(Screen.Portfolio) })
        Text(
            text = "No transaction history — no provider is selected, " +
                "so this starter cannot fetch transactions."
        )
    }
}

@Composable
fun TransactionDetailScreen(vm: WalletViewModel) {
    val requestedId by vm.detailTxId.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(
            title = "Transaction details",
            onBack = { vm.navigate(Screen.TransactionHistory) }
        )
        Text(
            text = "Transaction not found — no transaction data exists in this starter."
        )
        requestedId?.let { id ->
            Text(text = "Requested transaction ID: $id")
        }
        OutlinedButton(onClick = { vm.navigate(Screen.TransactionHistory) }) {
            Text("Back")
        }
    }
}

@Composable
fun NetworkSelectionScreen(vm: WalletViewModel) {
    val networks = listOf(
        "Bitcoin" to "Bitcoin testnet4 — default",
        "Ethereum" to "Ethereum Sepolia — default",
        "TRON" to "TRON Nile testnet — default"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Networks", onBack = { vm.navigate(Screen.Welcome) })
        Text("Testnet only, in line with repository policy.")
        Text(
            text = "Network selection changes nothing in this starter yet — " +
                "no provider is connected."
        )
        networks.forEach { (name, defaultNetwork) ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = defaultNetwork,
                        style = MaterialTheme.typography.titleMedium
                    )
                    TestnetBadge()
                }
            }
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "$name mainnet",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Mainnet — out of scope by default, " +
                            "requires separate approval plus applicable gates"
                    )
                }
            }
        }
    }
}

@Composable
fun WalletManagementScreen(vm: WalletViewModel) {
    val locked by vm.locked.collectAsState()
    val wallets by vm.wallets.collectAsState()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Wallets", onBack = { vm.navigate(Screen.Welcome) })
        if (locked) {
            Text("Locked — wallets are hidden.")
        } else {
            val importedWallets = wallets.mapNotNull { (chain, wallet) ->
                wallet?.let { chain to it }
            }

            if (importedWallets.isEmpty()) {
                Text("No watch-only wallets have been imported.")
                Button(onClick = { vm.navigate(Screen.ImportWallet) }) {
                    Text("Import wallet")
                }
            } else {
                importedWallets.forEach { (chain, wallet) ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "Chain: ${chain.name}",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(text = "Label: ${wallet.label}")
                            Text(
                                text = "Extended public key: " +
                                    "${wallet.xpub.take(12)}…${wallet.xpub.takeLast(8)}"
                            )
                            OutlinedButton(onClick = { vm.removeWallet(chain) }) {
                                Text("Remove")
                            }
                        }
                    }
                }
            }
        }
        Text(
            text = "Only extended public keys are stored in memory. " +
                "No secrets are stored anywhere in this starter."
        )
    }
}

@Composable
fun SecuritySettingsScreen(vm: WalletViewModel) {
    val locked by vm.locked.collectAsState()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Security & backup", onBack = { vm.navigate(Screen.Welcome) })
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "What this starter does not do",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "• No mnemonic generation or storage\n" +
                        "• No private keys\n" +
                        "• No signing\n" +
                        "• No vault\n" +
                        "• No PIN"
                )
            }
        }
        if (locked) {
            Text("Locked — wallets are hidden.")
            Button(onClick = { vm.unlock() }) {
                Text("Unlock")
            }
        } else {
            Button(onClick = { vm.lock() }) {
                Text("Lock app")
            }
        }
        Text(
            text = "Locking is a UI state only — it hides wallets in memory " +
                "and is NOT a security boundary."
        )
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Real backup procedure",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "Read the procedure for backing up a real wallet. " +
                        "This starter has no mnemonic to back up."
                )
                OutlineActionButton(
                    title = "View backup procedure",
                    onClick = { vm.navigate(Screen.MnemonicBackup) }
                )
            }
        }
    }
}
