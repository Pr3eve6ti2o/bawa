package com.bawa.wallet.ui.screens

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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.DerivationPolicy
import com.bawa.wallet.ui.AssetRow
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.ScreenHeader
import com.bawa.wallet.ui.TestnetBadge
import com.bawa.wallet.ui.WalletViewModel

private val portfolioChains = listOf(Chain.BTC, Chain.ETH, Chain.TRX)

@Composable
fun PortfolioScreen(vm: WalletViewModel) {
    val wallets by vm.wallets.collectAsState()
    val locked by vm.locked.collectAsState()
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Portfolio", style = MaterialTheme.typography.headlineMedium)
            TestnetBadge()
        }
        when {
            locked -> {
                Text("Locked — wallets are hidden until you unlock.")
                Button(onClick = { vm.unlock() }) { Text("Unlock") }
            }
            wallets.values.all { it == null } -> {
                Text("No wallets yet — import an extended public key to see your watch-only wallets.")
                Button(onClick = { vm.navigate(Screen.ImportWallet) }) { Text("Import wallet") }
            }
            else -> portfolioChains.forEach { chain ->
                wallets[chain]?.let { wallet ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(chainName(chain), style = MaterialTheme.typography.titleMedium)
                            Text(wallet.label)
                            Text("Extended public key: ${truncatedXpub(wallet.xpub)}")
                            OutlinedButton(onClick = { vm.openAssetDetail(chain) }) { Text("View") }
                        }
                    }
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Balances are unavailable — no provider is selected. This starter validates " +
                    "extended public keys only; it does not derive addresses, fetch balances, " +
                    "prices or history on-device.",
                modifier = Modifier.padding(16.dp)
            )
        }
    }
}

@Composable
fun AssetListScreen(vm: WalletViewModel) {
    val wallets by vm.wallets.collectAsState()
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Assets", onBack = { vm.navigate(Screen.Portfolio) })
        portfolioChains.forEach { chain ->
            Box(
                modifier = Modifier.fillMaxWidth()
                    .clickable(role = Role.Button) { vm.openAssetDetail(chain) }
            ) {
                AssetRow(
                    iconText = chain.name.take(1),
                    iconColor = when (chain) {
                        Chain.BTC -> MaterialTheme.colorScheme.primary
                        Chain.ETH -> MaterialTheme.colorScheme.secondary
                        Chain.TRX -> MaterialTheme.colorScheme.tertiary
                    },
                    name = chainName(chain),
                    network = DerivationPolicy.TESTNETS[chain] ?: "Testnet",
                    amount = if (wallets[chain] == null) "Not imported" else "Imported",
                    usd = "Balance unavailable"
                )
            }
        }
        Text("TON is not supported by this starter (generation-only in the repo).")
    }
}

@Composable
fun AssetDetailScreen(vm: WalletViewModel) {
    val detailChain by vm.detailChain.collectAsState()
    val wallets by vm.wallets.collectAsState()
    val chain = detailChain
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (chain == null) {
            Text("Unknown chain", style = MaterialTheme.typography.headlineSmall)
            Button(onClick = { vm.navigate(Screen.AssetList) }) { Text("Back") }
            return@Column
        }
        ScreenHeader(title = chainName(chain), onBack = { vm.navigate(Screen.AssetList) })
        val wallet = wallets[chain]
        if (wallet == null) {
            Text("No wallet imported for this chain")
            Button(onClick = {
                vm.selectChain(chain)
                vm.navigate(Screen.ImportWallet)
            }) { Text("Import wallet") }
        } else {
            Text("Extended public key: ${truncatedXpub(wallet.xpub)}")
        }
        Text("Derivation path template (index 0 example)", style = MaterialTheme.typography.titleSmall)
        Text(DerivationPolicy.pathFor(chain, 0))
        Card(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Addresses are not derived on-device — no Trust Wallet Core AAR exists for any " +
                    "version. Derive the address with the repo tools (echo \"<xpub>\" | node " +
                    "tools/hdwallet-gen/derive.js <chain> <index>) and compare it with the " +
                    "address your wallet shows.",
                modifier = Modifier.padding(16.dp)
            )
        }
        Button(onClick = {
            vm.selectChain(chain)
            vm.navigate(Screen.Receive)
        }) { Text("Receive") }
    }
}

@Composable
fun ReceiveScreen(vm: WalletViewModel) {
    val chain by vm.selectedChain.collectAsState()
    val wallets by vm.wallets.collectAsState()
    val wallet = wallets[chain]
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Receive", onBack = { vm.navigate(Screen.Portfolio) })
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            portfolioChains.forEach { option ->
                if (option == chain) {
                    Button(
                        onClick = { vm.selectChain(option) },
                        modifier = Modifier.weight(1f)
                    ) { Text(option.name) }
                } else {
                    OutlinedButton(
                        onClick = { vm.selectChain(option) },
                        modifier = Modifier.weight(1f)
                    ) { Text(option.name) }
                }
            }
        }
        Text(chainName(chain), style = MaterialTheme.typography.titleMedium)
        if (wallet == null) {
            Text("No wallet imported for this chain")
            Button(onClick = { vm.navigate(Screen.ImportWallet) }) { Text("Import wallet") }
        } else {
            Text("Extended public key: ${truncatedXpub(wallet.xpub)}")
        }
        Text("Derivation path template (index 0 example)", style = MaterialTheme.typography.titleSmall)
        Text(DerivationPolicy.pathFor(chain, 0))
        Text(
            "No deposit address is shown here — on-device derivation is unavailable. " +
                "Derive the address with the repo tools and verify it matches before accepting funds."
        )
        Text("Only share an address derived by the repo tools to receive funds.")
    }
}

private fun chainName(chain: Chain): String = when (chain) {
    Chain.BTC -> "Bitcoin"
    Chain.ETH -> "Ethereum"
    Chain.TRX -> "TRON"
}

private fun truncatedXpub(xpub: String): String =
    "${xpub.take(12)}…${xpub.takeLast(8)}"
