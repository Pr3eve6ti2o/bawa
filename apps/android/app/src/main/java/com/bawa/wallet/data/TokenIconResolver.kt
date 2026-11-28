package com.bawa.wallet.data

// Token logo resolution: symbol -> bundled asset path.
//
// The map mirrors the web wallet's TOKEN_LOGOS
// (apps/web/src/screens/token-logo.tsx): the same real logos from
// Trust Wallet Assets (MIT; see the token-logo.tsx header), copied
// verbatim from apps/web/src/assets/tokens/*.webp. Symbols are
// uppercased before lookup, and the two on-chain spellings with no
// exact symbol key map through the same aliases the web uses.
// Returns null when a symbol has no bundled logo, so the caller
// falls back to the letter disc — never a wrong token's mark.
object TokenIconResolver {

    private val tokenIcons: Map<String, String> = mapOf(
        "USDC" to "icons/tokens/usdc.webp",
        "USDT" to "icons/tokens/usdt.webp",
        "DAI" to "icons/tokens/dai.webp",
        "LINK" to "icons/tokens/link.webp",
        "UNI" to "icons/tokens/uni.webp",
        "WBTC" to "icons/tokens/wbtc.webp",
        "WETH" to "icons/tokens/weth.webp",
        "USDT0" to "icons/tokens/usdt0.webp"
    )

    private val aliases: Map<String, String> = mapOf(
        "USD₮" to "USDT",
        "USD₮0" to "USDT0"
    )

    /** Asset path for a token symbol, e.g. "icons/tokens/usdc.webp" for "USDC"; null when unmapped. */
    fun assetPathFor(symbol: String): String? {
        val key = symbol.trim().uppercase()
        return tokenIcons[aliases[key] ?: key]
    }
}
