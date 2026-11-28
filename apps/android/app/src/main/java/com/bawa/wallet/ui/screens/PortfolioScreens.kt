package com.bawa.wallet.ui.screens

// Portfolio / Asset list / Asset detail / Receive.
//
// Layout (Phase 2, Lane C §5/§8):
// - Home is ONE screen: header -> portfolio hero -> Popular chains
//   strip -> asset list, with a FIXED bottom action row (Rabby Mobile
//   bottomContainer) and NO tab bar. The list scrolls between the
//   header and the pinned row; the row never covers content (96dp
//   bottom padding on the scrolling column).
// - Popular chains strip (Bawa invention, Lane C §5.2): the four
//   chains in canonical order BTC, ETH, TRX, TON, each a shortcut to
//   its asset detail — never a mode switch, never value-sorted.
//   TON is shown as not supported; "All networks" leads to Networks.
// - Asset detail order (MetaMask asset-page): header -> balance ->
//   sticky Send/Receive row -> derivation -> history note.
// - Receive (Phantom + OKX): one row per network — a per-network
//   address list — instead of reaching each chain only via its
//   asset page. The selected chain's detail sits below the list.
// - Honest states throughout (catalogue §7): no provider means
//   "Balance unavailable" / "Unavailable", never $0.00.

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.DerivationPolicy
import com.bawa.wallet.data.ChainIconResolver
import com.bawa.wallet.ui.AssetRow
import com.bawa.wallet.ui.BawaTokens
import com.bawa.wallet.ui.ChainLogo
import com.bawa.wallet.ui.ChainTint
import com.bawa.wallet.ui.DetailActionBar
import com.bawa.wallet.ui.FixedBottomActionBar
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.ScreenHeader
import com.bawa.wallet.ui.TestnetBadge
import com.bawa.wallet.ui.UiState
import com.bawa.wallet.ui.WalletViewModel

private val portfolioChains = listOf(Chain.BTC, Chain.ETH, Chain.TRX)

@Composable
fun PortfolioScreen(vm: WalletViewModel) {
    val wallets by vm.wallets.collectAsState()
    val uiState by vm.uiState.collectAsState()
    val locked by vm.locked.collectAsState()
    val hideBalances by vm.hideBalances.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Portfolio", style = MaterialTheme.typography.headlineMedium)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TestnetBadge()
                    IconButton(onClick = { vm.lock() }) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = "Lock app",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            when {
                locked -> {
                    Text("Locked — wallets are hidden until you unlock.")
                    Button(onClick = { vm.unlock() }) { Text("Unlock") }
                }
                wallets.values.all { it == null } -> {
                    PortfolioHero(vm, hideBalances, showTotal = false)
                    PopularChainsStrip(vm, uiState)
                    Text("No wallets yet — import an extended public key to see your watch-only wallets.")
                    Button(onClick = { vm.navigate(Screen.ImportWallet) }) { Text("Import wallet") }
                }
                else -> {
                    PortfolioHero(vm, hideBalances, showTotal = true)
                    PopularChainsStrip(vm, uiState)
                    Text("Assets", style = MaterialTheme.typography.titleMedium)
                    portfolioChains.forEach { chain ->
                        Box(
                            modifier = Modifier.fillMaxWidth()
                                .clickable(role = Role.Button) { vm.openAssetDetail(chain) }
                        ) {
                            AssetRow(
                                iconText = chain.name.take(1),
                                iconColor = ChainTint(chain),
                                // Step 3: name, network and logo come from
                                // the registry when it loaded; the hardcoded
                                // testnet names are the no-registry fallback.
                                name = vm.chainRecord(chain)?.name ?: chainName(chain),
                                network = vm.chainNetworkLabel(chain)
                                    ?: (DerivationPolicy.TESTNETS[chain] ?: "Testnet"),
                                amount = if (wallets[chain] == null) "Not imported" else "Imported",
                                usd = "Balance unavailable",
                                logoAsset = ChainIconResolver.assetPathFor(chain.name.lowercase())
                            )
                        }
                    }
                    Text("TON is not supported by this starter (generation-only in the repo).")
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
        // Fixed bottom action row — pinned, never scrolling away.
        // Disabled while locked: lock takes precedence over cached values.
        Box(modifier = Modifier.align(Alignment.BottomCenter)) {
            FixedBottomActionBar(
                onSend = { vm.navigate(Screen.Send) },
                onReceive = { vm.navigate(Screen.Receive) },
                onActivity = { vm.navigate(Screen.TransactionHistory) },
                enabled = !locked
            )
        }
    }
}

// Portfolio hero: total first, freshness note second, hide-balance
// toggle beside the total (Rabby hide-balance). The total is
// "Unavailable" while no provider is selected — never $0.00.
@Composable
private fun PortfolioHero(vm: WalletViewModel, hideBalances: Boolean, showTotal: Boolean) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Portfolio balance", style = MaterialTheme.typography.titleSmall)
                IconButton(onClick = { vm.toggleHideBalances() }) {
                    Icon(
                        if (hideBalances) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = if (hideBalances) "Show balance" else "Hide balance",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Text(
                text = when {
                    !showTotal -> "—"
                    hideBalances -> "••••••"
                    else -> "Unavailable"
                },
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = if (showTotal) "No provider selected — last refresh: never."
                else "Import a wallet to see your portfolio.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// Popular chains strip (Lane C §5.2): four chains in Bawa's canonical
// order plus an "All networks" trailing entry. Each entry is a shortcut
// to its asset detail. States: loading never applies here (no fetch);
// not imported shows "Not imported"; a failed price feed would show
// "Unavailable" — this starter has no feed, so the value line is
// always the honest "Balance unavailable".
@Composable
private fun PopularChainsStrip(
    vm: WalletViewModel,
    uiState: Map<Chain, UiState>
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Popular chains", style = MaterialTheme.typography.titleMedium)
            Text(
                "All networks ›",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(role = Role.Button) { vm.navigate(Screen.NetworkSelection) }
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            portfolioChains.forEach { chain ->
                PopularChainCard(
                    chain = chain,
                    stateLine = when (uiState[chain]) {
                        UiState.Ready -> "Imported"
                        UiState.Locked -> "Locked"
                        else -> "Not imported"
                    },
                    onClick = { vm.openAssetDetail(chain) }
                )
            }
            // TON: generation-only in the repo; shown, not hidden, so
            // the strip never pretends the set is larger than it is.
            Card(
                modifier = Modifier.width(160.dp)
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("TON", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text("Not supported", style = MaterialTheme.typography.bodySmall)
                    Text("Balance unavailable", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun PopularChainCard(chain: Chain, stateLine: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier.clickable(role = Role.Button, onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Step 3: real logo from the registry icons, letter
                // disc when the asset is missing.
                ChainLogo(chain.name.lowercase(), chainName(chain).take(1), ChainTint(chain), sizeDp = 32)
                Text(chainName(chain), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
            Text(stateLine, style = MaterialTheme.typography.bodySmall)
            Text("Balance unavailable", style = MaterialTheme.typography.bodySmall)
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
        ScreenHeader(title = "Assets", onBack = { vm.goBack() })
        portfolioChains.forEach { chain ->
            Box(
                modifier = Modifier.fillMaxWidth()
                    .clickable(role = Role.Button) { vm.openAssetDetail(chain) }
            ) {
                AssetRow(
                    iconText = chain.name.take(1),
                    iconColor = ChainTint(chain),
                    name = vm.chainRecord(chain)?.name ?: chainName(chain),
                    network = vm.chainNetworkLabel(chain)
                        ?: (DerivationPolicy.TESTNETS[chain] ?: "Testnet"),
                    amount = if (wallets[chain] == null) "Not imported" else "Imported",
                    usd = "Balance unavailable",
                    logoAsset = ChainIconResolver.assetPathFor(chain.name.lowercase())
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
    val locked by vm.locked.collectAsState()
    val chain = detailChain
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (chain == null) {
                Text("Unknown chain", style = MaterialTheme.typography.headlineSmall)
                Button(onClick = { vm.navigate(Screen.AssetList) }) { Text("Back") }
                return@Column
            }
            ScreenHeader(title = chainName(chain), onBack = { vm.goBack() })
            // Balance first (MetaMask asset-page order), then the
            // sticky actions, then derivation and history.
            val wallet = wallets[chain]
            if (wallet == null) {
                Text("No wallet imported for this chain")
                Button(onClick = {
                    vm.selectChain(chain)
                    vm.navigate(Screen.ImportWallet)
                }) { Text("Import wallet") }
            } else {
                Text("Balance unavailable", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "No provider is selected, so no balance can be shown.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
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
            Text("Recent transactions", style = MaterialTheme.typography.titleSmall)
            Text("No transaction history — no provider is selected.")
        }
        if (chain != null) {
            Box(modifier = Modifier.align(Alignment.BottomCenter)) {
                DetailActionBar(
                    onSend = {
                        vm.selectChain(chain)
                        vm.navigate(Screen.Send)
                    },
                    onReceive = {
                        vm.selectChain(chain)
                        vm.navigate(Screen.Receive)
                    },
                    enabled = !locked
                )
            }
        }
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
        ScreenHeader(title = "Receive", onBack = { vm.goBack() })
        // Per-network address list (Phantom + OKX): one row per
        // network, each with its own key and path. Tapping a row
        // selects that chain; the detail below follows the selection.
        Text("Receive on a network", style = MaterialTheme.typography.titleMedium)
        portfolioChains.forEach { option ->
            val optionWallet = wallets[option]
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button) { vm.selectChain(option) }
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ChainLogo(option.name.lowercase(), chainName(option).take(1), ChainTint(option), sizeDp = 36)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(vm.chainRecord(option)?.name ?: chainName(option), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(
                            if (optionWallet == null) "Not imported"
                            else "Extended public key: ${truncatedXpub(optionWallet.xpub)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(DerivationPolicy.pathFor(option, 0), style = MaterialTheme.typography.bodySmall)
                    }
                    if (option == chain) {
                        Text("Selected", color = BawaTokens.Accent, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("TON", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text("Not supported by this starter (generation-only in the repo).", style = MaterialTheme.typography.bodySmall)
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
