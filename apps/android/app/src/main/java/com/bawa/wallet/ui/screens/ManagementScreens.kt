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
// - Network selection (Step 3): every network comes from the
//   registry — 87 mainnet chains + 4 testnets — each row with its
//   real logo, name and RPC count. Mainnet is the programme default.

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.DerivationPolicy
import com.bawa.wallet.data.HistoryResult
import com.bawa.wallet.ui.ChainLogo
import com.bawa.wallet.ui.OutlineActionButton
import com.bawa.wallet.ui.PrimaryButton
import com.bawa.wallet.ui.ScanTarget
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.ScreenHeader
import com.bawa.wallet.ui.TestnetBadge
import com.bawa.wallet.ui.WalletViewModel
import com.bawa.wallet.ui.scanner.QrCodeScanner

@Composable
fun SendScreen(vm: WalletViewModel) {
    val selectedChain by vm.selectedChain.collectAsState()
    val sendRecipient by vm.sendRecipient.collectAsState()
    val scanTarget by vm.scanTarget.collectAsState()
    val scanError by vm.scanError.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
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
            // The recipient is editable and can be filled by scanning
            // a QR code (Step 6). The amount stays disabled: there is
            // no send to complete, so no amount can be acted on.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = sendRecipient,
                    onValueChange = { vm.setSendRecipient(it) },
                    label = { Text("Recipient") },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                OutlinedButton(onClick = { vm.openScanner(ScanTarget.SendRecipient) }) {
                    Text("Scan")
                }
            }
            scanError?.let { error ->
                Text(
                    error,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
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
            // risk score — the amount is empty because the form is.
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
                    Text(
                        "Recipient: " + if (sendRecipient.isBlank()) {
                            "not entered — the full address will be shown here."
                        } else {
                            sendRecipient
                        }
                    )
                    Text("Amount: not entered.")
                    Text("Fee: not available — fee estimation is not implemented.")
                }
            }
            PrimaryButton(title = "Review", enabled = false, onClick = {})
            OutlineActionButton(title = "Receive", onClick = { vm.navigate(Screen.Receive) })
        }
        // Scanner overlay: covers the screen while open; Close exits
        // without scanning anything.
        if (scanTarget == ScanTarget.SendRecipient) {
            Box(modifier = Modifier.fillMaxSize()) {
                QrCodeScanner(
                    onScanned = { vm.onScanned(it) },
                    onError = { vm.onScanError(it) }
                )
                Button(
                    onClick = { vm.closeScanner() },
                    modifier = Modifier.align(Alignment.TopEnd).padding(16.dp)
                ) { Text("Close") }
            }
        }
    }
}

@Composable
fun TransactionHistoryScreen(vm: WalletViewModel) {
    // Track lives here: lookup first, guide second (Lane C §8).
    var hash by remember { mutableStateOf("") }
    var lookupMessage by remember { mutableStateOf<String?>(null) }
    val selectedChain by vm.selectedChain.collectAsState()
    val history by vm.history.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val lookupResult by vm.lookupResult.collectAsState()
    val lookupHash by vm.lookupHash.collectAsState()

    LaunchedEffect(selectedChain) { vm.refreshLiveData(setOf(selectedChain)) }

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
                if (hash.isBlank()) {
                    lookupMessage = "Enter a transaction hash to look it up."
                } else {
                    lookupMessage = null
                    vm.requestLookup(selectedChain, hash)
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Look up")
        }
        lookupMessage?.let { message ->
            Text(text = message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        // The lookup answer: the record with its distinct status, an
        // honest not-found, or the provider's reason.
        when (val result = lookupResult) {
            is HistoryResult.Available -> {
                if (result.transactions.isEmpty()) {
                    Text("Transaction not found on ${selectedChain.name}.")
                } else {
                    result.transactions.forEach { tx ->
                        Card(
                            modifier = Modifier.fillMaxWidth()
                                .clickable(role = Role.Button) {
                                    vm.openTransactionDetail(tx.hash, selectedChain)
                                }
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    "${tx.hash.take(12)}…${tx.hash.takeLast(8)}",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    "Status: ${tx.status.name}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                }
            }
            is HistoryResult.Unavailable -> {
                if (lookupHash.isNotEmpty()) {
                    Text(text = result.reason, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            null -> {
                // No lookup has run yet.
            }
        }
        Text("History", style = MaterialTheme.typography.titleMedium)
        when (val chainHistory = history[selectedChain]) {
            is HistoryResult.Available -> {
                if (chainHistory.transactions.isEmpty()) {
                    Text("No transactions for this address.")
                } else {
                    chainHistory.transactions.take(20).forEach { tx ->
                        Card(
                            modifier = Modifier.fillMaxWidth()
                                .clickable(role = Role.Button) {
                                    vm.openTransactionDetail(tx.hash, selectedChain)
                                }
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    "${tx.hash.take(12)}…${tx.hash.takeLast(8)}",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    "Status: ${tx.status.name}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                    if (chainHistory.transactions.size > 20) {
                        Text(
                            "Showing 20 of ${chainHistory.transactions.size}.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            is HistoryResult.Unavailable -> {
                Text(
                    text = chainHistory.reason,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            null -> {
                Text(
                    if (selectedChain in refreshing) "Loading…"
                    else "No transaction history — no live data was fetched yet."
                )
            }
        }
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
    val requestedChain by vm.detailTxChain.collectAsState()
    val lookupResult by vm.lookupResult.collectAsState()

    LaunchedEffect(requestedId, requestedChain) {
        val id = requestedId
        val chain = requestedChain
        if (id != null && chain != null) vm.lookupTransaction(chain, id)
    }

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
        val id = requestedId
        val chain = requestedChain
        if (id == null || chain == null) {
            Text("No transaction selected.")
        } else {
            Text("Transaction: $id")
            Text("Chain: ${chain.name}")
            when (val result = lookupResult) {
                is HistoryResult.Available -> {
                    if (result.transactions.isEmpty()) {
                        Text("Transaction not found on ${chain.name}.")
                    } else {
                        result.transactions.forEach { tx ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        tx.hash,
                                        style = MaterialTheme.typography.titleSmall
                                    )
                                    // The five statuses stay distinct.
                                    Text("Status: ${tx.status.name}")
                                    tx.explorerUrl?.let { url ->
                                        Text(
                                            "Explorer: $url",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                is HistoryResult.Unavailable -> {
                    Text(text = result.reason, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                null -> {
                    Text("Looking up…")
                }
            }
        }
        OutlinedButton(onClick = { vm.navigate(Screen.TransactionHistory) }) {
            Text("Back")
        }
    }
}

// Network selection (Step 3): every network comes from the registry
// — 87 mainnet chains + 4 testnets — instead of the hardcoded
// 3-testnet list. Mainnet is the programme default. Selection still
// changes nothing yet: no provider is connected.
@Composable
fun NetworkSelectionScreen(vm: WalletViewModel) {
    val chains by vm.registryChains.collectAsState()
    val testnets by vm.registryTestnets.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Networks", onBack = { vm.goBack() })
        if (!vm.registryLoaded) {
            Text("Network list unavailable — the registry did not load.")
            Text(
                text = "Network selection changes nothing yet — " +
                    "no provider is connected."
            )
            return@Column
        }
        Text("Mainnet — ${chains.size} networks from the registry.")
        Text(
            text = "Network selection changes nothing yet — " +
                "no provider is connected."
        )
        Text("Mainnet", style = MaterialTheme.typography.titleMedium)
        chains.forEach { record ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ChainLogo(
                        record.id,
                        record.symbol.take(1),
                        MaterialTheme.colorScheme.surfaceVariant,
                        sizeDp = 36,
                        fallbackTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = record.name,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "${record.symbol} · ${record.rpcEndpoints.size} RPC endpoints",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
        Text("Testnets", style = MaterialTheme.typography.titleMedium)
        testnets.forEach { testnet ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ChainLogo(
                        testnet.id,
                        testnet.symbol.take(1),
                        MaterialTheme.colorScheme.surfaceVariant,
                        sizeDp = 36,
                        fallbackTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = testnet.devnetName,
                            style = MaterialTheme.typography.titleMedium
                        )
                        TestnetBadge()
                    }
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
