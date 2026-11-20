package com.bawa.wallet.ui.screens

// Send / Transactions / Networks / Wallets / Security.
//
// Layout (Phase 2, Lane C §8):
// - Send: the structured form is kept, and the review step gains
//   Rabby-style risk rows (explicit chain label, full recipient,
//   fee) — layout only, no risk scoring invented, no signing added.
// - Transaction history is also where Track lives on Android: the
//   lookup form comes FIRST and the guide second (Lane C §8), so the
//   14-screen contract is kept without adding a fifteenth screen —
//   the catalogue's screen 10/11 are history/detail, and lookup is
//   a function of history, not a new destination.
// - Network selection: each network is a row with its chain avatar
//   and explicit testnet name; TON is shown as not supported.

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.DerivationPolicy
import com.bawa.wallet.ui.ChainAvatar
import com.bawa.wallet.ui.OutlineActionButton
import com.bawa.wallet.ui.PrimaryButton
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.ScreenHeader
import com.bawa.wallet.ui.TestnetBadge
import com.bawa.wallet.ui.WalletViewModel

@Composable
fun SendScreen(vm: WalletViewModel) {
    val selectedChain by vm.selectedChain.collectAsState()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Send", onBack = { vm.goBack() })
        Text(
            text = "Sending is not implemented in this starter. " +
                "There is no signing, broadcast or transaction-construction code."
        )
        // The chain the review rows describe, chosen explicitly —
        // no silent switching (catalogue §6/§7).
        Text("Chain", style = MaterialTheme.typography.titleSmall)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(Chain.BTC, Chain.ETH, Chain.TRX).forEach { chain ->
                if (chain == selectedChain) {
                    Button(onClick = { vm.selectChain(chain) }, modifier = Modifier.weight(1f)) {
                        Text(chain.name)
                    }
                } else {
                    OutlinedButton(onClick = { vm.selectChain(chain) }, modifier = Modifier.weight(1f)) {
                        Text(chain.name)
                    }
                }
            }
        }
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
        // Review risk rows (Rabby Approval / SecurityListItem shape,
        // layout only): the exact values the user would approve, shown
        // before any Review button could exist. Nothing here is a
        // risk score — the fields are empty because the form is.
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Review — check before you send",
                    style = MaterialTheme.typography.titleMedium
                )
                Text("Chain: ${selectedChain.name} (${DerivationPolicy.TESTNETS[selectedChain] ?: "Testnet"})")
                Text("Recipient: not entered — the full address will be shown here.")
                Text("Amount: not entered.")
                Text("Fee: not available — no provider is selected.")
            }
        }
        PrimaryButton(title = "Review", enabled = false, onClick = {})
        OutlineActionButton(title = "Receive", onClick = { vm.navigate(Screen.Receive) })
    }
}

@Composable
fun TransactionHistoryScreen(vm: WalletViewModel) {
    // Track lives here: lookup first, guide second (Lane C §8).
    var hash by remember { mutableStateOf("") }
    var lookupMessage by remember { mutableStateOf<String?>(null) }
    val selectedChain by vm.selectedChain.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Transactions", onBack = { vm.goBack() })
        Text("Track a transaction", style = MaterialTheme.typography.titleMedium)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(Chain.BTC, Chain.ETH, Chain.TRX).forEach { chain ->
                if (chain == selectedChain) {
                    Button(onClick = { vm.selectChain(chain) }, modifier = Modifier.weight(1f)) {
                        Text(chain.name)
                    }
                } else {
                    OutlinedButton(onClick = { vm.selectChain(chain) }, modifier = Modifier.weight(1f)) {
                        Text(chain.name)
                    }
                }
            }
        }
        OutlinedTextField(
            value = hash,
            onValueChange = {
                hash = it
                lookupMessage = null
            },
            label = { Text("Transaction hash") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = {
                lookupMessage = if (hash.isBlank()) {
                    "Enter a transaction hash to look it up."
                } else {
                    "Transaction not found — no provider is selected, " +
                        "so this starter cannot fetch transactions."
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Look up")
        }
        lookupMessage?.let { message ->
            Text(text = message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(
            text = "No transaction history — no provider is selected, " +
                "so this starter cannot fetch transactions."
        )
        Text(
            text = "How tracking works: paste a hash from the chain you received it on, " +
                "and the lookup checks that chain's indexer. Statuses stay distinct — " +
                "pending, included, confirmed, failed and replaced are never merged.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
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
            onBack = { vm.goBack() }
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
        Chain.BTC to "Bitcoin testnet4 — default",
        Chain.ETH to "Ethereum Sepolia — default",
        Chain.TRX to "TRON Nile testnet — default"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Networks", onBack = { vm.goBack() })
        Text("Testnet only, in line with repository policy.")
        Text(
            text = "Network selection changes nothing in this starter yet — " +
                "no provider is connected."
        )
        networks.forEach { (chain, defaultNetwork) ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ChainAvatar(chain, sizeDp = 36)
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = defaultNetwork,
                            style = MaterialTheme.typography.titleMedium
                        )
                        TestnetBadge()
                    }
                }
            }
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "${chainName(chain)} mainnet",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Mainnet — out of scope by default, " +
                            "requires separate approval plus applicable gates"
                    )
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "TON",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "Not supported by this starter (generation-only in the repo)."
                )
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
        ScreenHeader(title = "Wallets", onBack = { vm.goBack() })
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
        ScreenHeader(title = "Security & backup", onBack = { vm.goBack() })
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

private fun chainName(chain: Chain): String = when (chain) {
    Chain.BTC -> "Bitcoin"
    Chain.ETH -> "Ethereum"
    Chain.TRX -> "TRON"
}
