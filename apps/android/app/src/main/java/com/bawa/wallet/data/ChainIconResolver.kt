package com.bawa.wallet.data

// Chain logo resolution: chain id -> bundled asset path.
//
// The map is transcribed from the web wallet's CHAIN_LOGOS
// (apps/web/src/screens/token-logo.tsx) — the same real logos, the
// same Trust Wallet Assets source (MIT; see apps/web/README.md
// "Chain logos" and the token-logo.tsx header for the full licence
// note). The .webp files are verbatim copies of the web's canonical
// assets (apps/web/src/assets/chains/*.webp); the drift test asserts
// they stay byte-identical. Returns null when a chain has no bundled
// logo, so the caller falls back to the letter-disc avatar — never a
// wrong chain's mark.
object ChainIconResolver {

    private val chainIcons: Map<String, String> = mapOf(
        "abstract" to "icons/chains/abstract.webp",
        "algorand" to "icons/chains/algorand.webp",
        "apechain" to "icons/chains/apechain.webp",
        "aptos" to "icons/chains/aptos.webp",
        "arb" to "icons/chains/arbitrum.webp",
        "arbnova" to "icons/chains/arbnova.webp",
        "astar" to "icons/chains/astar.webp",
        "aurora" to "icons/chains/aurora.webp",
        "avax" to "icons/chains/avalanchec.webp",
        "axelar" to "icons/chains/axelar.webp",
        "base" to "icons/chains/base.webp",
        "berachain" to "icons/chains/berachain.webp",
        "bob" to "icons/chains/bob.webp",
        "boba" to "icons/chains/boba.webp",
        "bsc" to "icons/chains/smartchain.webp",
        "btc" to "icons/chains/bitcoin.webp",
        "cardano" to "icons/chains/cardano.webp",
        "celestia" to "icons/chains/celestia.webp",
        "celo" to "icons/chains/celo.webp",
        "chiliz" to "icons/chains/chiliz.webp",
        "conflux" to "icons/chains/cfxevm.webp",
        "core" to "icons/chains/core.webp",
        "cosmos" to "icons/chains/cosmos.webp",
        "cronos" to "icons/chains/cronos.webp",
        "doge" to "icons/chains/doge.webp",
        "dydx" to "icons/chains/dydx.webp",
        "etc" to "icons/chains/classic.webp",
        "eth" to "icons/chains/ethereum.webp",
        "fantom" to "icons/chains/fantom.webp",
        "filecoin" to "icons/chains/filecoin.webp",
        "flare" to "icons/chains/flare.webp",
        "flowevm" to "icons/chains/flowevm.webp",
        "fraxtal" to "icons/chains/fraxtal.webp",
        "fuse" to "icons/chains/fuse.webp",
        "gnosis" to "icons/chains/gnosis.webp",
        "hedera" to "icons/chains/hedera.webp",
        "hemi" to "icons/chains/hemi.webp",
        "hyperevm" to "icons/chains/hyperevm.webp",
        "immutable" to "icons/chains/immutable.webp",
        "injective" to "icons/chains/nativeinjective.webp",
        "ink" to "icons/chains/ink.webp",
        "iotex" to "icons/chains/iotexevm.webp",
        "juno" to "icons/chains/juno.webp",
        "kaspa" to "icons/chains/kaspa.webp",
        "kava" to "icons/chains/kavaevm.webp",
        "linea" to "icons/chains/linea.webp",
        "ltc" to "icons/chains/litecoin.webp",
        "manta" to "icons/chains/manta.webp",
        "mantle" to "icons/chains/mantle.webp",
        "matic" to "icons/chains/polygon.webp",
        "metis" to "icons/chains/metis.webp",
        "mode" to "icons/chains/mode.webp",
        "monad" to "icons/chains/monad.webp",
        "near" to "icons/chains/near.webp",
        "noble" to "icons/chains/noble.webp",
        "op" to "icons/chains/optimism.webp",
        "opbnb" to "icons/chains/opbnb.webp",
        "osmosis" to "icons/chains/osmosis.webp",
        "polkadot" to "icons/chains/polkadot.webp",
        "pulsechain" to "icons/chains/pulsechain.webp",
        "ronin" to "icons/chains/ronin.webp",
        "rootstock" to "icons/chains/rootstock.webp",
        "scroll" to "icons/chains/scroll.webp",
        "sei" to "icons/chains/seievm.webp",
        "seicosmos" to "icons/chains/sei.webp",
        "sol" to "icons/chains/solana.webp",
        "soneium" to "icons/chains/soneium.webp",
        "songbird" to "icons/chains/songbird.webp",
        "sonic" to "icons/chains/sonic.webp",
        "starknet" to "icons/chains/starknet.webp",
        "stellar" to "icons/chains/stellar.webp",
        "syscoin" to "icons/chains/syscoin.webp",
        "taiko" to "icons/chains/taiko.webp",
        "telos" to "icons/chains/telos.webp",
        "tezos" to "icons/chains/tezos.webp",
        "theta" to "icons/chains/theta.webp",
        "ton" to "icons/chains/ton.webp",
        "trx" to "icons/chains/tron.webp",
        "unichain" to "icons/chains/unichain.webp",
        "velas" to "icons/chains/velas.webp",
        "worldchain" to "icons/chains/worldchain.webp",
        "xdc" to "icons/chains/xdc.webp",
        "xlayer" to "icons/chains/xlayer.webp",
        "xrp" to "icons/chains/ripple.webp",
        "zetachain" to "icons/chains/zetaevm.webp",
        "zksync" to "icons/chains/zksync.webp",
        "zora" to "icons/chains/zora.webp",
    )

    /** Asset path for a chain id, e.g. "icons/chains/bitcoin.webp" for "btc"; null when unmapped. */
    fun assetPathFor(chainId: String): String? = chainIcons[chainId]
}
