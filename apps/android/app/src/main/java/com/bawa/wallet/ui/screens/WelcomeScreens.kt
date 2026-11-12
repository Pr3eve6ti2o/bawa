package com.bawa.wallet.ui.screens

import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.ValidationResult
import com.bawa.wallet.ui.OutlineActionButton
import com.bawa.wallet.ui.PrimaryButton
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.ScreenHeader
import com.bawa.wallet.ui.TestnetBadge
import com.bawa.wallet.ui.WalletViewModel

@Composable
fun WelcomeScreen(vm: WalletViewModel) {
    val wallets by vm.wallets.collectAsState()
    val importedWallets = wallets.mapNotNull { (chain, wallet) ->
        wallet?.let { chain to it }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Bawa Wallet",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.weight(1f)
            )
            TestnetBadge()
        }

        Text("A watch-only wallet — it shows extended public keys and never holds secrets.")

        PrimaryButton(
            title = "Create a wallet",
            enabled = true,
            onClick = { vm.navigate(Screen.CreateWallet) }
        )
        OutlineActionButton(
            title = "Import a watch-only wallet",
            onClick = { vm.navigate(Screen.ImportWallet) }
        )

        if (importedWallets.isNotEmpty()) {
            Text("Imported wallets", style = MaterialTheme.typography.titleMedium)
            importedWallets.forEach { (chain, wallet) ->
                Text("${chain.name} — ${wallet.label.orEmpty().ifBlank { "Unlabelled wallet" }}")
            }
        }

        OutlineActionButton(
            title = "Networks",
            onClick = { vm.navigate(Screen.NetworkSelection) }
        )
        OutlineActionButton(
            title = "Manage wallets",
            onClick = { vm.navigate(Screen.WalletManagement) }
        )
        OutlineActionButton(
            title = "Security",
            onClick = { vm.navigate(Screen.SecuritySettings) }
        )
        Text("Testnet by default; mainnet is out of scope.")
    }
}

@Composable
fun CreateWalletScreen(vm: WalletViewModel) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader("Create a wallet", onBack = { vm.navigate(Screen.Welcome) })

        Text(
            "This starter cannot create a wallet on-device — there is no vault design yet, " +
                "so no mnemonic is ever generated or shown here."
        )
        Text("From the root of a fresh clone of the repo, run either:")
        Text("python3 tools/make_wallet.py\nor\nnode tools/hdwallet-gen/generate.js")
        Text("Follow the on-screen steps and keep the printed 24 words offline.")

        PrimaryButton(
            title = "I have created a wallet — import its public key",
            enabled = true,
            onClick = { vm.navigate(Screen.ImportWallet) }
        )
    }
}

@Composable
fun ImportWalletScreen(vm: WalletViewModel) {
    var xpub by remember { mutableStateOf("") }
    var label by remember { mutableStateOf("") }
    var validationMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }
    val wallets by vm.wallets.collectAsState()
    val selectedChain by vm.selectedChain.collectAsState()
    val importedWallets = wallets.mapNotNull { (chain, wallet) ->
        wallet?.let { chain to it }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader("Import a watch-only wallet", onBack = { vm.navigate(Screen.Welcome) })

        Text(
            "Only extended PUBLIC keys are accepted. Private extended keys (xprv/zprv) " +
                "are rejected. Never paste a mnemonic, seed or private key here."
        )
        Text("Selected chain: ${selectedChain.name}")

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(Chain.BTC, Chain.ETH, Chain.TRX).forEach { chain ->
                val onSelect = {
                    vm.selectChain(chain)
                    validationMessage = null
                    successMessage = null
                }
                if (chain == selectedChain) {
                    Button(onClick = onSelect, modifier = Modifier.weight(1f)) {
                        Text(chain.name)
                    }
                } else {
                    OutlinedButton(onClick = onSelect, modifier = Modifier.weight(1f)) {
                        Text(chain.name)
                    }
                }
            }
        }

        OutlinedTextField(
            value = xpub,
            onValueChange = {
                xpub = it
                validationMessage = null
                successMessage = null
            },
            label = { Text("Extended public key (xpub)") },
            singleLine = true,
            isError = validationMessage != null,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = label,
            onValueChange = {
                label = it
                validationMessage = null
                successMessage = null
            },
            label = { Text("Label (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = {
                when (val result = vm.addWallet(selectedChain, xpub, label)) {
                    is ValidationResult.Invalid -> validationMessage = result.message
                    is ValidationResult.Valid -> {
                        xpub = ""
                        label = ""
                        validationMessage = null
                        successMessage = "Watch-only wallet added for ${selectedChain.name}."
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Add")
        }

        successMessage?.let { message ->
            Text(text = message, color = MaterialTheme.colorScheme.primary)
        }

        validationMessage?.let { message ->
            Text(text = message, color = MaterialTheme.colorScheme.error)
        }

        Text("Imported wallets", style = MaterialTheme.typography.titleMedium)
        if (importedWallets.isEmpty()) {
            Text("No watch-only wallets imported yet.")
        }
        importedWallets.forEach { (chain, wallet) ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "${chain.name} — ${wallet.label.orEmpty().ifBlank { "Unlabelled wallet" }}",
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text("${wallet.xpub.take(12)}…${wallet.xpub.takeLast(8)}")
                }
            }
        }
    }
}

@Composable
fun MnemonicBackupScreen(vm: WalletViewModel) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader("Mnemonic backup", onBack = { vm.navigate(Screen.Welcome) })

        Text("This starter holds no mnemonic, so there is nothing to back up here.")
        Text(
            "The 24 words printed by the repo tools are the only backup. Write them on paper, " +
                "store them offline, and never photograph them or paste them into any app or website."
        )
        Text("For recovery, use tools/decrypt_seed.py with the seed bundle.")

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Guidance — not verified by this app",
                    style = MaterialTheme.typography.titleMedium
                )
                Text("• Words written on paper")
                Text("• Stored offline in two places")
                Text("• Never shared")
                Text("• Bundle file kept")
            }
        }
    }
}
