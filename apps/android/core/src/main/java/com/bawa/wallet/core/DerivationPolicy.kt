package com.bawa.wallet.core

/**
 * MERGED derivation policy (Android Step 4, Lane B).
 *
 * Why one file in :core instead of two: the reference core module and
 * the :app module each defined `com.bawa.wallet.core.DerivationPolicy`
 * (and each defined a top-level `Chain` — the reference with 4 entries
 * and derivation metadata, the app with 3 bare entries in
 * ExtendedKeyValidator.kt). Two modules must not define the same class
 * in the same package: each compiles alone, but the APK dex merge
 * fails on the duplicate. So both definitions live here, merged:
 *
 * - ENGINE API (reference core, verbatim): the `Chain` enum with
 *   slip44/purpose/path/account-origin/export-kind/testnet, `ExportKind`,
 *   and the `DerivationPolicy` engine constants (`ACCOUNT`,
 *   `RECEIVING_BRANCH`, `MAX_INDEX`, `MNEMONIC_WORDS`, `PASSPHRASE`,
 *   `MAX_XPUB_LENGTH`, `checkIndex`, `checkChainForWatchOnly`).
 *   The ported engine files (CoreWalletEngine, Validation, Fixtures)
 *   depend on exactly this API and are ported unedited.
 * - APP/UI POLICY (from :app's DerivationPolicy.kt, verbatim): the
 *   `{index}` path templates, `pathFor`, the confirmation thresholds
 *   (BTC 6, ETH finalised + 12 extra minimum, TRX 19/27, TON 1),
 *   `TESTNETS`, and the engine-availability flags. `ConfirmationPolicy`,
 *   `PortfolioScreens` and `ManagementScreens` depend on these.
 *
 * Step 4 resolved both discrepancies (2026-11-28):
 * 1. ENGINE_VERSION is now 4.8.4, the Trust Wallet Core AAR built
 *    from source (commit d40d24a6) and staged in core/libs/. The
 *    web WASM pin stays 4.9.3; the Android engine is 4.8.4.
 * 2. ENGINE_BINDING_AVAILABLE is true: the 4.8.4 AAR is in
 *    core/libs/ and CoreWalletEngine compiles against it.
 *
 * `pathFor` (app/UI API, `{index}` templates) and `Chain.fullPath`
 * (engine API, `%d` templates) describe the same paths and must agree;
 * both are kept because each has its own callers and tests. `pathFor`
 * gains a TON branch that throws: TON has no derivation path template
 * (single deposit address only), matching `Chain.fullPath`.
 *
 * FIXED derivation policy. Copied from the phase-1 audit and docs 02/04 —
 * never changed by app code. Any change here is a policy change and
 * requires an explicit owner decision plus a fixture-suite update.
 *
 * Account is always 0, branch is always the external/receiving branch 0.
 * Only the final index varies (0..2147483647, the non-hardened range).
 * BIP-39: 256-bit entropy -> 24 words, EMPTY passphrase. Import must
 * reject a non-empty passphrase, never silently substitute "".
 */
enum class Chain(
    val id: String,
    val slip44: Int,
    val purpose: Int,
    /** Full path template; [index] is substituted verbatim. */
    val pathTemplate: String,
    /** Account origin whose public export the watch-only side uses. */
    val accountOrigin: String,
    val exportKind: ExportKind,
    val testnet: String,
) {
    BTC(
        id = "btc",
        slip44 = 0,
        purpose = 84,
        pathTemplate = "m/84'/0'/0'/0/%d",
        accountOrigin = "m/84'/0'/0'",
        exportKind = ExportKind.ZPUB,
        testnet = "Bitcoin testnet (testnet4)",
    ),
    ETH(
        id = "eth",
        slip44 = 60,
        purpose = 44,
        pathTemplate = "m/44'/60'/0'/0/%d",
        accountOrigin = "m/44'/60'/0'",
        exportKind = ExportKind.XPUB,
        testnet = "Sepolia",
    ),
    TRX(
        id = "trx",
        slip44 = 195,
        purpose = 44,
        pathTemplate = "m/44'/195'/0'/0/%d",
        accountOrigin = "m/44'/195'/0'",
        exportKind = ExportKind.XPUB,
        testnet = "Nile",
    ),
    TON(
        id = "ton",
        slip44 = 607,
        purpose = 44,
        // TON has no account export and no watch-only derivation. The
        // per-wallet path is recorded from Core at generation, never
        // hardcoded here. This template is NOT used for derivation.
        pathTemplate = "",
        accountOrigin = "",
        exportKind = ExportKind.SINGLE_ADDRESS,
        testnet = "TON testnet",
    );

    fun fullPath(index: Int): String {
        require(id != "ton") { "TON has no derivation path template (single deposit address only)" }
        return pathTemplate.format(index)
    }

    companion object {
        fun fromId(id: String): Chain? = entries.firstOrNull { it.id == id }
        val watchOnlyChains: List<Chain> = listOf(BTC, ETH, TRX)
    }
}

enum class ExportKind { XPUB, ZPUB, SINGLE_ADDRESS }

object DerivationPolicy {
    // ---- Engine API (reference core) ----
    const val ACCOUNT = 0
    const val RECEIVING_BRANCH = 0
    const val MAX_INDEX = 2147483647
    const val MNEMONIC_WORDS = 24
    const val PASSPHRASE = "" // empty-passphrase policy; import rejects anything else
    const val MAX_XPUB_LENGTH = 200

    fun checkIndex(index: Int): Result<Unit> = when {
        index < 0 -> Result.failure(EngineError.InvalidIndex("index must be >= 0"))
        index > MAX_INDEX -> Result.failure(EngineError.InvalidIndex("index must be <= $MAX_INDEX"))
        else -> Result.success(Unit)
    }

    fun checkChainForWatchOnly(chain: Chain): Result<Unit> = when (chain) {
        Chain.TON -> Result.failure(
            EngineError.UnsupportedChain("TON has no watch-only derivation (single deposit address only)"),
        )
        else -> Result.success(Unit)
    }

    // ---- App/UI policy (from :app) ----
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
            // Added by the Step 4 merge: the reference Chain has a TON
            // entry and this when must stay exhaustive. TON has no
            // derivation path template (single deposit address only).
            Chain.TON -> throw IllegalArgumentException(
                "TON has no derivation path template (single deposit address only)",
            )
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
    // NOTE: values are the short UI names ("testnet4"), not
    // Chain.testnet ("Bitcoin testnet (testnet4)"); the test asserts the
    // short forms. TON is intentionally absent: the watch-only UI lists
    // BTC/ETH/TRX only.
    val TESTNETS = mapOf(
        Chain.BTC to "testnet4",
        Chain.ETH to "Sepolia",
        Chain.TRX to "Nile"
    )

    // Trust Wallet Core 4.8.4 AAR, built from source (commit d40d24a6)
    // and staged in core/libs/ (Step 4, 2026-11-28). This is the
    // Android engine version; the web WASM pin (4.9.3) is separate.
    const val ENGINE_VERSION = "4.8.4"

    // The 4.8.4 AAR is in core/libs/ and CoreWalletEngine compiles
    // against it, so on-device derivation is available (Step 4).
    const val ENGINE_BINDING_AVAILABLE = true
}
