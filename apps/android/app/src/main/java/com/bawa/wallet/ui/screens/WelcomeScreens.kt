package com.bawa.wallet.ui.screens

// Welcome / Create / Import / Mnemonic backup.
//
// Layout (Phase 2): the WDK single-screen state machine — Welcome is
// one screen, Create and Import branch from it, and the system back
// button reverses the stack (WalletViewModel.goBack). No tab bar.
// The 4-chain row under the testnet pill is the strip's first
// appearance (Lane C §8: chains visible before a vault exists).
// Create gains a risk-check first step (Rabby CreateMnemonics
// risk-check -> display; MetaMask Reveal -> Review -> Confirm):
// the phrase is shown once and never stored online, stated BEFORE
// any phrase or instruction appears.

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.ValidationResult
import com.bawa.wallet.ui.ChainAvatar
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

        // The strip's first appearance: the supported chains, visible
        // before a vault exists. TON is shown as not supported.
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            listOf(Chain.BTC, Chain.ETH, Chain.TRX).forEach { chain ->
                ChainAvatar(chain, sizeDp = 32)
            }
            Text(
                "Bitcoin, Ethereum, TRON. TON is not supported by this starter.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f)
            )
        }

        Text("A watch-only wallet — it shows extended public keys and never holds secrets.")

        // The four steps, one sentence each (the sequence is real, so
        // the numbering carries information, not decoration).
        Text("How it works", style = MaterialTheme.typography.titleMedium)
        Text("1. Create a wallet with the repo tools.")
        Text("2. Write down the 24 words, offline, on paper.")
        Text("3. Import only its extended public key here.")
        Text("4. See your watch-only wallets — no secrets on this device.")

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
            OutlineActionButton(
                title = "Open portfolio",
                onClick = { vm.navigate(Screen.Portfolio) }
            )
        }

        // Secondary destinations as a compact list, not three
        // full-width buttons: one job per row, chevron rows like a
        // settings list (OKX puts everything behind one Main menu;
        // Bawa keeps the three links but stops shouting them).
        Text("More", style = MaterialTheme.typography.titleMedium)
        SecondaryRow("Networks") { vm.navigate(Screen.NetworkSelection) }
        SecondaryRow("Manage wallets") { vm.navigate(Screen.WalletManagement) }
        SecondaryRow("Security") { vm.navigate(Screen.SecuritySettings) }
        // Step 3: mainnet is the programme default — the 87 mainnet
        // networks come from the registry; no provider is connected yet.
        Text("Mainnet networks come from the registry; balances are not loaded yet.")
    }
}

@Composable
private fun SecondaryRow(label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
        Text("›", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun CreateWalletScreen(vm: WalletViewModel) {
    // Step 0 = risk check, step 1 = instructions. The phrase is
    // shown once and never stored online — stated before anything
    // else, as in Rabby's risk-check step.
    var step by remember { mutableStateOf(0) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader("Create a wallet", onBack = { vm.goBack() })

        if (step == 0) {
            Text("Step 1 of 2 — Before you create a wallet", style = MaterialTheme.typography.titleSmall)
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Your recovery phrase is shown once",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text("• The 24 words are shown once, and never stored online.")
                    Text("• Anyone with the words controls the wallet.")
                    Text("• This app never shows, stores or asks for the words.")
                    Text("• No address exists to receive on until the wallet is created and backed up.")
                }
            }
            PrimaryButton(
                title = "I understand — continue",
                enabled = true,
                onClick = { step = 1 }
            )
        } else {
            Text("Step 2 of 2 — Create with the repo tools", style = MaterialTheme.typography.titleSmall)
            Text(
                "This starter cannot create a wallet on-device — there is no vault design yet, " +
                    "so no mnemonic is ever generated or shown here."
            )
            Text("From the root of a fresh clone of the repo, run:")
            Text("python3 tools/make_wallet.py")
            Text("The wrapper verifies the encrypted backup independently; do not run the generator directly.")
            Text("Follow the on-screen steps and keep the printed 24 words offline.")

            PrimaryButton(
                title = "I have created a wallet — import its public key",
                enabled = true,
                onClick = { vm.navigate(Screen.ImportWallet) }
            )
        }
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
        ScreenHeader("Import a watch-only wallet", onBack = { vm.goBack() })

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
        ScreenHeader("Mnemonic backup", onBack = { vm.goBack() })

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
