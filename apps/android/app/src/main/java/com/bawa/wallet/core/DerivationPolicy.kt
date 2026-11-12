package com.bawa.wallet.core

// Policy metadata only; this watch-only starter does not derive addresses.
object DerivationPolicy {
    const val BTC_PATH_TEMPLATE = "m/84'/0'/0'/0/{index}"
    const val ETH_PATH_TEMPLATE = "m/44'/60'/0'/0/{index}"
    const val TRX_PATH_TEMPLATE = "m/44'/195'/0'/0/{index}"

    // Generation-only reference: TON has no xpub and is unsupported by this starter.
    const val TON_PATH_TEMPLATE = "m/44'/607'/0'"

    fun pathFor(chain: Chain, index: Int): String {
        require(index in 0..Int.MAX_VALUE) { "index out of range" }
        val template = when (chain) {
            Chain.BTC -> BTC_PATH_TEMPLATE
            Chain.ETH -> ETH_PATH_TEMPLATE
            Chain.TRX -> TRX_PATH_TEMPLATE
        }
        return template.replace("{index}", index.toString())
    }

    // Source: Bitcoin.org confirmation guidance (six confirmations for large payments).
    // https://bitcoin.org/en/you-need-to-know#instant-transactions-are-less-secure
    const val BTC_CONFIRMATIONS = 6

    // Source: Ethereum proof-of-stake finality; require the block to be finalised.
    // https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/#finality
    const val ETH_REQUIRES_FINALISED = true

    // Unsourced extra minimum, required alongside finality; never a standalone threshold.
    const val ETH_EXTRA_MINIMUM = 12

    // Sources: TRON transaction confirmation (19 SRs) and DPoS consensus (27 SRs).
    // https://developers.tron.network/docs/transaction#transaction-confirmation
    // https://developers.tron.network/docs/consensus
    const val TRX_SOLIDIFIED_SUPER_REPRESENTATIVES = 19
    const val TRX_TOTAL_SUPER_REPRESENTATIVES = 27

    // Source: TON payment-processing guidance.
    // https://docs.ton.org/v3/guidelines/dapps/asset-processing/payments-processing
    // Policy: one masterchain seqno confirmation plus an outgoing-message outcome check.
    const val TON_CONFIRMATIONS = 1

    // Testnet networks only; mainnet is out of scope by default.
    val TESTNETS = mapOf(
        Chain.BTC to "testnet4",
        Chain.ETH to "Sepolia",
        Chain.TRX to "Nile"
    )

    // Repo pin (T20: upgraded to 4.9.1; was 4.8.4).
    const val ENGINE_VERSION = "4.9.1"

    // No Trust Wallet Core AAR exists for any version, so on-device derivation is OPEN.
    const val ENGINE_BINDING_AVAILABLE = false
}
