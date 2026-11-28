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
// - Honest states throughout (catalogue §7): an unavailable balance
//   or price shows its reason, never $0.00.
//
// Step 6: the screens read the ViewModel's live flows (derived
// addresses, balances, token balances, prices, history) and trigger
// a refresh when they appear. The total is the sum of priced
// holdings only; unpriced holdings are listed without a value.

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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.DerivationPolicy
import com.bawa.wallet.data.BalanceResult
import com.bawa.wallet.data.ChainIconResolver
import com.bawa.wallet.data.DerivedAddressResult
import com.bawa.wallet.data.HistoryResult
import com.bawa.wallet.data.network.PriceResult
import com.bawa.wallet.ui.AssetRow
import com.bawa.wallet.ui.BawaTokens
import com.bawa.wallet.ui.ChainLogo
import com.bawa.wallet.ui.ChainTint
import com.bawa.wallet.ui.DetailActionBar
import com.bawa.wallet.ui.FixedBottomActionBar
import com.bawa.wallet.ui.QrCodeImage
import com.bawa.wallet.ui.ScanTarget
import com.bawa.wallet.ui.Screen
import com.bawa.wallet.ui.ScreenHeader
import com.bawa.wallet.ui.TestnetBadge
import com.bawa.wallet.ui.UiState
import com.bawa.wallet.ui.WalletViewModel
import com.bawa.wallet.ui.WatchOnlyWallet
import com.bawa.wallet.ui.displayAmount
import com.bawa.wallet.ui.formatChange24h
import com.bawa.wallet.ui.formatUsd
import com.bawa.wallet.ui.scanner.QrCodeScanner
import com.bawa.wallet.ui.usdValue
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val portfolioChains = listOf(Chain.BTC, Chain.ETH, Chain.TRX)

/** Amount + value lines for one asset row, from the live flows. */
private data class AssetRowValues(val amount: String, val usd: String)

private fun assetRowValues(
    wallet: WatchOnlyWallet?,
    symbol: String,
    balance: BalanceResult?,
    price: PriceResult?,
    refreshing: Boolean
): AssetRowValues {
    if (wallet == null) return AssetRowValues("Not imported", "Balance unavailable")
    val amount = when (balance) {
        is BalanceResult.Available ->
            balance.displayAmount()?.let { "$it $symbol" } ?: "Balance unavailable"
        is BalanceResult.Unavailable -> "Balance unavailable"
        null -> if (refreshing) "Loading…" else "Balance unavailable"
    }
    val usd = when {
        balance is BalanceResult.Available && price is PriceResult.Available ->
            usdValue(balance, price)?.let { formatUsd(it) } ?: "Price unavailable"
        price is PriceResult.Available ->
            "1 $symbol = ${formatUsd(price.priceUsd)}"
        refreshing -> "Loading…"
        else -> "Price unavailable"
    }
    return AssetRowValues(amount, usd)
}

@Composable
fun PortfolioScreen(vm: WalletViewModel) {
    val wallets by vm.wallets.collectAsState()
    val uiState by vm.uiState.collectAsState()
    val locked by vm.locked.collectAsState()
    val hideBalances by vm.hideBalances.collectAsState()
    val balances by vm.balances.collectAsState()
    val prices by vm.prices.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val lastRefreshMs by vm.lastRefreshMs.collectAsState()
    val totalWorthUsd by vm.totalWorthUsd.collectAsState()
    val unpricedHoldings by vm.unpricedHoldings.collectAsState()

    // Live data loads when the screen appears and whenever the
    // imported wallets change; the Refresh button re-runs it.
    LaunchedEffect(wallets) { vm.refreshLiveData() }

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
                    PortfolioHero(
                        vm = vm,
                        hideBalances = hideBalances,
                        showTotal = false,
                        totalWorthUsd = null,
                        unpricedHoldings = 0,
                        refreshing = false,
                        lastRefreshMs = null
                    )
                    PopularChainsStrip(vm, uiState, balances, prices, refreshing)
                    Text("No wallets yet — import an extended public key to see your watch-only wallets.")
                    Button(onClick = { vm.navigate(Screen.ImportWallet) }) { Text("Import wallet") }
                }
                else -> {
                    PortfolioHero(
                        vm = vm,
                        hideBalances = hideBalances,
                        showTotal = true,
                        totalWorthUsd = totalWorthUsd,
                        unpricedHoldings = unpricedHoldings,
                        refreshing = refreshing.isNotEmpty(),
                        lastRefreshMs = lastRefreshMs
                    )
                    PopularChainsStrip(vm, uiState, balances, prices, refreshing)
                    Text("Assets", style = MaterialTheme.typography.titleMedium)
                    portfolioChains.forEach { chain ->
                        val values = assetRowValues(
                            wallet = wallets[chain],
                            symbol = vm.chainRecord(chain)?.symbol ?: chain.name,
                            balance = balances[chain],
                            price = prices[chain.id],
                            refreshing = chain in refreshing
                        )
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
                                amount = values.amount,
                                usd = values.usd,
                                logoAsset = ChainIconResolver.assetPathFor(chain.name.lowercase())
                            )
                        }
                    }
                    Text("TON is not supported by this starter (generation-only in the repo).")
                }
            }
            if (!vm.liveAvailable) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Balances are unavailable — no provider is selected. This starter validates " +
                            "extended public keys only; it does not derive addresses, fetch balances, " +
                            "prices or history on-device.",
                        modifier = Modifier.padding(16.dp)
                    )
                }
            } else {
                Text(
                    text = "Live balances, prices and history load from public sources (read-only). " +
                        "No keys leave this device.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
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
// toggle beside the total (Rabby hide-balance). The total is the sum
// of priced holdings only — "Unavailable" while nothing is priced,
// never $0.00 — and unpriced holdings are counted in the note.
@Composable
private fun PortfolioHero(
    vm: WalletViewModel,
    hideBalances: Boolean,
    showTotal: Boolean,
    totalWorthUsd: Double?,
    unpricedHoldings: Int,
    refreshing: Boolean,
    lastRefreshMs: Long?
) {
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
                    totalWorthUsd != null -> formatUsd(totalWorthUsd)
                    refreshing -> "Loading…"
                    else -> "Unavailable"
                },
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (!showTotal) {
                        "Import a wallet to see your portfolio."
                    } else {
                        val refresh = lastRefreshMs?.let {
                            "Last refresh: " + SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(it))
                        } ?: "Last refresh: never."
                        if (unpricedHoldings > 0) "$refresh · $unpricedHoldings holding(s) without a price." else refresh
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f)
                )
                if (showTotal && vm.liveAvailable) {
                    OutlinedButton(
                        onClick = { vm.requestRefresh() },
                        enabled = !refreshing
                    ) { Text(if (refreshing) "Refreshing…" else "Refresh") }
                }
            }
        }
    }
}

// Popular chains strip (Lane C §5.2): four chains in Bawa's canonical
// order plus an "All networks" trailing entry. Each entry is a shortcut
// to its asset detail. States: loading shows "Loading…"; not imported
// shows "Not imported"; a priced holding shows its value, an unpriced
// one its unit price, and a chain with neither shows
// "Balance unavailable" — never $0.00.
@Composable
private fun PopularChainsStrip(
    vm: WalletViewModel,
    uiState: Map<Chain, UiState>,
    balances: Map<Chain, BalanceResult>,
    prices: Map<String, PriceResult>,
    refreshing: Set<Chain>
) {
    val wallets by vm.wallets.collectAsState()
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
                    valueLine = assetRowValues(
                        wallet = wallets[chain],
                        symbol = vm.chainRecord(chain)?.symbol ?: chain.name,
                        balance = balances[chain],
                        price = prices[chain.id],
                        refreshing = chain in refreshing
                    ).usd,
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
private fun PopularChainCard(chain: Chain, stateLine: String, valueLine: String, onClick: () -> Unit) {
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
            Text(valueLine, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun AssetListScreen(vm: WalletViewModel) {
    val wallets by vm.wallets.collectAsState()
    val balances by vm.balances.collectAsState()
    val prices by vm.prices.collectAsState()
    val refreshing by vm.refreshing.collectAsState()

    LaunchedEffect(wallets) { vm.refreshLiveData() }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ScreenHeader(title = "Assets", onBack = { vm.goBack() })
        portfolioChains.forEach { chain ->
            val values = assetRowValues(
                wallet = wallets[chain],
                symbol = vm.chainRecord(chain)?.symbol ?: chain.name,
                balance = balances[chain],
                price = prices[chain.id],
                refreshing = chain in refreshing
            )
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
                    amount = values.amount,
                    usd = values.usd,
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
    val addresses by vm.addresses.collectAsState()
    val balances by vm.balances.collectAsState()
    val tokenBalances by vm.tokenBalances.collectAsState()
    val prices by vm.prices.collectAsState()
    val history by vm.history.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val chain = detailChain

    LaunchedEffect(chain) {
        if (chain != null) vm.refreshLiveData(setOf(chain))
    }

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
            val symbol = vm.chainRecord(chain)?.symbol ?: chain.name
            val chainRefreshing = chain in refreshing
            if (wallet == null) {
                Text("No wallet imported for this chain")
                Button(onClick = {
                    vm.selectChain(chain)
                    vm.navigate(Screen.ImportWallet)
                }) { Text("Import wallet") }
            } else {
                // Derived deposit address (Step 6): the index-0
                // address from the imported xpub, or the honest
                // reason derivation failed.
                when (val addressResult = addresses[chain]) {
                    is DerivedAddressResult.Available -> {
                        Text("Deposit address", style = MaterialTheme.typography.titleSmall)
                        Text(addressResult.address)
                        Text(
                            "Path: ${addressResult.path}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    is DerivedAddressResult.Unavailable -> {
                        Text("Address unavailable", style = MaterialTheme.typography.titleSmall)
                        Text(
                            addressResult.reason,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    null -> {
                        Text(
                            if (chainRefreshing) "Deriving address…" else "Address unavailable",
                            style = MaterialTheme.typography.titleSmall
                        )
                    }
                }
                when (val balance = balances[chain]) {
                    is BalanceResult.Available -> {
                        Text(
                            "${balance.displayAmount() ?: "—"} $symbol",
                            style = MaterialTheme.typography.headlineSmall
                        )
                        val price = prices[chain.id]
                        if (price is PriceResult.Available) {
                            usdValue(balance, price)?.let { value ->
                                Text(
                                    "≈ ${formatUsd(value)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                    is BalanceResult.Unavailable -> {
                        Text("Balance unavailable", style = MaterialTheme.typography.headlineSmall)
                        Text(
                            balance.reason,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    null -> {
                        Text(
                            if (chainRefreshing) "Loading…" else "Balance unavailable",
                            style = MaterialTheme.typography.headlineSmall
                        )
                    }
                }
                when (val price = prices[chain.id]) {
                    is PriceResult.Available -> {
                        Text(
                            "Price: ${formatUsd(price.priceUsd)}" +
                                (formatChange24h(price.change24h)?.let { " ($it)" } ?: ""),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Source: ${price.source}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    is PriceResult.Unavailable -> {
                        Text(
                            "Price unavailable — ${price.reason}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    null -> {
                        if (chainRefreshing) {
                            Text(
                                "Loading price…",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                Text("Extended public key: ${truncatedXpub(wallet.xpub)}")
                // Curated tokens on this chain, with live balances
                // and prices where the providers answer them.
                val chainTokens = vm.tokensForChain(chain.id)
                if (chainTokens.isNotEmpty()) {
                    Text("Tokens", style = MaterialTheme.typography.titleSmall)
                    chainTokens.forEach { token ->
                        val tokenBalance = tokenBalances[token.tokenKey]
                        val tokenPrice = prices[token.tokenKey]
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    "${token.symbol} — ${token.name}",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = when (tokenBalance) {
                                        is BalanceResult.Available ->
                                            tokenBalance.displayAmount()?.let { "$it ${token.symbol}" }
                                                ?: "Balance unavailable"
                                        is BalanceResult.Unavailable ->
                                            "Balance unavailable — ${tokenBalance.reason}"
                                        null -> if (chainRefreshing) "Loading…" else "Balance unavailable"
                                    },
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = when (tokenPrice) {
                                        is PriceResult.Available ->
                                            "Price: ${formatUsd(tokenPrice.priceUsd)}" +
                                                (formatChange24h(tokenPrice.change24h)?.let { " ($it)" } ?: "") +
                                                " · ${tokenPrice.source}"
                                        is PriceResult.Unavailable ->
                                            "Price unavailable — ${tokenPrice.reason}"
                                        null -> if (chainRefreshing) "Loading price…" else "Price unavailable"
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
            Text("Derivation path template (index 0 example)", style = MaterialTheme.typography.titleSmall)
            Text(DerivationPolicy.pathFor(chain, 0))
            // The address above was derived on-device when derivation
            // worked; otherwise the repo-tools route is still the
            // honest fallback — the AAR is present (Step 4), but the
            // on-device fixture gate is unverified without a device.
            if (addresses[chain] is DerivedAddressResult.Available) {
                Text(
                    "The deposit address above was derived on-device from your extended public key " +
                        "(index 0). Verify it matches the address your wallet shows before accepting funds.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Addresses are not derived on-device — no Trust Wallet Core AAR exists for any " +
                            "version. Derive the address with the repo tools (echo \"<xpub>\" | node " +
                            "tools/hdwallet-gen/derive.js <chain> <index>) and compare it with the " +
                            "address your wallet shows.",
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
            Text("Recent transactions", style = MaterialTheme.typography.titleSmall)
            when (val chainHistory = history[chain]) {
                is HistoryResult.Available -> {
                    if (chainHistory.transactions.isEmpty()) {
                        Text("No transactions for this address.")
                    } else {
                        chainHistory.transactions.take(10).forEach { tx ->
                            Card(
                                modifier = Modifier.fillMaxWidth()
                                    .clickable(role = Role.Button) {
                                        vm.openTransactionDetail(tx.hash, chain)
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
                                    // The five statuses stay distinct —
                                    // pending, included, confirmed,
                                    // failed and replaced are never merged.
                                    Text(
                                        "Status: ${tx.status.name}",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                        if (chainHistory.transactions.size > 10) {
                            Text(
                                "Showing 10 of ${chainHistory.transactions.size}.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                is HistoryResult.Unavailable -> {
                    Text(chainHistory.reason)
                }
                null -> {
                    Text(
                        if (chainRefreshing) "Loading…" else "No transaction history — no live data was fetched yet."
                    )
                }
            }
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
    val addresses by vm.addresses.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val scanTarget by vm.scanTarget.collectAsState()
    val scannedAddress by vm.scannedAddress.collectAsState()
    val scanError by vm.scanError.collectAsState()
    val wallet = wallets[chain]

    LaunchedEffect(chain, wallets) { vm.refreshLiveData(setOf(chain)) }

    Box(modifier = Modifier.fillMaxSize()) {
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
                // Deposit address, derived on-device from the xpub
                // (Step 6), with its QR code.
                when (val addressResult = addresses[chain]) {
                    is DerivedAddressResult.Available -> {
                        Text(addressResult.address)
                        Text(
                            "Path: ${addressResult.path}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        QrCodeImage(addressResult.address, size = 200)
                        Text(
                            "Only share this address after verifying it matches the address your wallet shows.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    is DerivedAddressResult.Unavailable -> {
                        Text(
                            "No deposit address is shown here — ${addressResult.reason}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text("Only share an address derived by the repo tools to receive funds.")
                    }
                    null -> {
                        Text(
                            if (chain in refreshing) "Deriving address…" else "No deposit address is shown here — no live data was fetched yet.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            Text("Derivation path template (index 0 example)", style = MaterialTheme.typography.titleSmall)
            Text(DerivationPolicy.pathFor(chain, 0))
            // Scan a QR code (Step 6): the scanned text is shown
            // verbatim so it can be checked before it is used
            // anywhere. The scanner itself handles a denied camera
            // permission with an honest message and a settings button.
            OutlinedButton(onClick = { vm.openScanner(ScanTarget.ReceiveCheck) }) {
                Text("Scan QR code")
            }
            scanError?.let { error ->
                Text(
                    error,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            scannedAddress?.let { scanned ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Scanned address", style = MaterialTheme.typography.titleSmall)
                        Text(scanned)
                        Text(
                            "This text was read from a QR code. Verify it before using it — " +
                                "the scanner only reads the code, it does not check the address.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        OutlinedButton(onClick = { vm.clearScannedAddress() }) { Text("Clear") }
                    }
                }
            }
        }
        // Scanner overlay: covers the screen while open; Close exits
        // without scanning anything.
        if (scanTarget == ScanTarget.ReceiveCheck) {
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

private fun chainName(chain: Chain): String = when (chain) {
    Chain.BTC -> "Bitcoin"
    Chain.ETH -> "Ethereum"
    Chain.TRX -> "TRON"
    Chain.TON -> "TON"
}

private fun truncatedXpub(xpub: String): String =
    "${xpub.take(12)}…${xpub.takeLast(8)}"
