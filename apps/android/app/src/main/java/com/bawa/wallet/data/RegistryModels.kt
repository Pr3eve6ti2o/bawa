package com.bawa.wallet.data

import kotlinx.serialization.Serializable

// Data models for the generated Android registry export
// (registry/chains.json + registry/tokens.json, produced by
// apps/web/scripts/generate-android-registry.mjs from the web data).
// The export is the single source of truth; these models mirror its
// schema (registry/schemas/chains.schema.json +
// tokens.schema.json) and are validated against it by the unit tests.
// Nullability below was measured from the export itself, not guessed:
// curve is null for 30 chains, evmChainId for 26, addressFormat for 6,
// derivationTemplate for 2 (sol, ton), explorerUrl for 13,
// explorerTxUrlPattern for 22. Every chain has at least one RPC
// endpoint (169 total) and a CoinGecko id.

@Serializable
data class AddressFormat(
    val kind: String,
    val label: String,
    val patterns: List<String>,
    val description: String
)

@Serializable
data class PriceFallbackIds(
    val coinloreId: String? = null,
    val coinbaseProduct: String? = null,
    val dexscreenerChainId: String? = null,
    val wrappedNativeContract: String? = null,
    val wrappedNativeDexChain: String? = null
)

@Serializable
data class ChainRecord(
    val id: String,
    val name: String,
    val symbol: String,
    val network: String,
    val coinType: Int,
    val assetSlip44: Int,
    val coinTypeName: String,
    val trustWalletCoinType: Int,
    val curve: String? = null,
    val evmChainId: Int? = null,
    val networkId: String,
    val assetId: String,
    val profileId: String,
    val addressFormat: AddressFormat? = null,
    val derivationPath: String,
    val derivationTemplate: String? = null,
    val decimals: Int,
    val rpcEndpoints: List<String>,
    val explorerUrl: String? = null,
    val explorerTxUrlPattern: String? = null,
    val coingeckoId: String,
    val priceSources: List<String>,
    val priceFallbackIds: PriceFallbackIds,
    val notes: String? = null
)

@Serializable
data class TestnetRecord(
    val id: String,
    val name: String,
    val devnetName: String,
    val symbol: String,
    val network: String,
    val networkId: String,
    val apiBaseUrl: String,
    val rpcUrl: String? = null,
    val historyBaseUrl: String? = null,
    val evmChainId: Int? = null,
    val explorerTxUrl: String,
    val genesisHash: String? = null,
    val fallbackApiBaseUrl: String? = null
)

@Serializable
data class RegistryFile(
    val version: Int,
    val sourceCommit: String,
    val sourceDirty: Boolean,
    val chainCount: Int,
    val chains: List<ChainRecord>,
    val testnets: List<TestnetRecord>
)

@Serializable
data class TokenRecord(
    val chain: String,
    val contract: String,
    val tokenKey: String,
    val name: String,
    val symbol: String,
    val decimals: Int,
    val coingeckoId: String,
    val coingeckoPlatform: String,
    val verifiedSource: String,
    val priceSource: String,
    val priceFallback: String
)

@Serializable
data class TokensFile(
    val version: Int,
    val sourceCommit: String,
    val sourceDirty: Boolean,
    val tokenCount: Int,
    val tokens: List<TokenRecord>
)
