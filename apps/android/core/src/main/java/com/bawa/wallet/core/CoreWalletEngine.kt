package com.bawa.wallet.core

import com.google.protobuf.ByteString
import wallet.core.java.AnySigner
import wallet.core.jni.CoinType
import wallet.core.jni.HDVersion
import wallet.core.jni.HDWallet
import wallet.core.jni.Purpose
import wallet.core.jni.proto.Bitcoin
import wallet.core.jni.proto.Ethereum
import wallet.core.jni.proto.Tron

/**
 * Trust Wallet Core 4.8.4 binding (the ONLY file in the app that
 * imports wallet.core.jni / wallet.core.java / wallet.core.jni.proto).
 *
 * API surface verified against the 4.8.4 tag (not docs or memory):
 * - Binding package is `wallet.core.jni`, generated at AAR build time
 *   from the TrustWalletCore C headers via codegen; the AAR's
 *   sourceSets add `../../jni/java` (hand-written AnySigner helper)
 *   and the generated classes. Test usage at 4.8.4 confirms:
 *   `HDWallet(mnemonic, passphrase)`, `hd.getKeyForCoin(CoinType)`,
 *   `hd.mnemonic()/seed()/entropy()`,
 *   `hd.getExtendedPublicKey(Purpose, CoinType, HDVersion)`,
 *   `HDWallet.getPublicKeyFromExtended(xpub, coin, path)`,
 *   `coin.deriveAddress(key)`, `CoinType.BITCOIN.value() == 0`,
 *   `TRON == 195`, `ETHEREUM == 60`, `BITCOIN.purpose() == BIP84`.
 * - C headers at 4.8.4 confirm: TWHDWalletCreate(strength, passphrase)
 *   -> `HDWallet(strength, passphrase)` constructor (no static create);
 *   TWHDWalletGetAddressForCoin; TWCoinTypeTON = 607;
 *   TWCoinTypeDeriveAddressFromPublicKey; TWCoinTypeValidate;
 *   TWAnySignerSign (proto input -> proto output);
 *   TWTransactionCompiler pre-image/compile (used by the frozen-
 *   payload path only through AnySigner here).
 * - Proto Java package is `wallet.core.jni.proto` (java_package in
 *   src/proto/ definitions at 4.8.4): Bitcoin.SigningInput.private_key
 *   is REPEATED bytes (field 6); Ethereum.SigningInput.private_key
 *   is bytes (field 9); Tron.SigningInput.private_key is bytes
 *   (field 2). Outputs: Bitcoin/Ethereum `encoded`, Tron `json`,
 *   all with `error_message`.
 *
 * COMPILE GATE: this file compiles only when the 4.8.4 AAR + proto
 * JAR are on the classpath (GitHub Packages credentials, or a
 * locally built AAR in core/libs/ — see tools/build-core-aar.md).
 * It is NEVER compiled against a substitute Core version.
 *
 * TON SIGNING IS UNIMPLEMENTED: 4.8.4 has no TON.proto; TON signing
 * goes through a different route that is not verified here, so
 * signFrozenPayload refuses TON rather than faking it. TON receive
 * (single deposit address via getAddressForCoin) IS implemented.
 *
 * DISPOSAL: unlocked HDWallet references are dropped on lockWallet
 * and on every failure path; native cleanup runs through Core's
 * phantom-reference mechanism, CONFIRMED from the 4.8.4 source
 * (jni/java GenericPhantomReference: a WCFinalizingDaemon thread
 * invokes the native onDelete callback when the Java object is
 * collected). Whether the 4.8.4 generated HDWallet class ALSO
 * exposes an explicit delete() is UNVERIFIED — the builder with
 * the AAR must confirm before relying on prompt disposal
 * (see core/README.md). No mnemonic, seed, or private-key bytes
 * are ever logged; key byte arrays are zeroed after signing.
 */
class CoreWalletEngine : WalletEngine {

    private val unlocked = mutableMapOf<String, HDWallet>()
    private val lock = Any()

    @Volatile
    override var gatePassed: Boolean = false
        private set

    init {
        try {
            System.loadLibrary("TrustWalletCore")
        } catch (e: Throwable) {
            throw EngineError.CoreInitialisationFailed(
                "Trust Wallet Core native library could not be loaded: " +
                    Redaction.redact(e.message ?: "unknown"),
            )
        }
    }

    // ---- Fixture gate -------------------------------------------------

    override fun runFixtureGate(): Result<List<Fixtures.FixtureCheck>> {
        val checks = mutableListOf<Fixtures.FixtureCheck>()
        checks += Fixtures.pureChecks()
        try {
            checks += coreCheck("coin-values") {
                CoinType.BITCOIN.value() == 0 &&
                    CoinType.ETHEREUM.value() == 60 &&
                    CoinType.TRON.value() == 195 &&
                    CoinType.TON.value() == 607
            }
            checks += coreCheck("btc-purpose-bip84") {
                CoinType.BITCOIN.purpose() == Purpose.BIP84
            }
            checks += coreCheck("core-validates-fixtures") {
                CoinType.BITCOIN.validate(Fixtures.BTC_ADDRESS_0) &&
                    CoinType.ETHEREUM.validate(Fixtures.ETH_ADDRESS_0) &&
                    CoinType.TRON.validate(Fixtures.TRX_ADDRESS_0) &&
                    CoinType.TRON.validate(Fixtures.TRX_ADDRESS_1) &&
                    CoinType.TON.validate(Fixtures.TON_ADDRESS_FROM_VECTOR)
            }
            // End-to-end binding proof without any secret vector: a
            // fresh wallet must yield 24 words and addresses that pass
            // our independent validators, plus correctly-prefixed xpubs.
            val probe = HDWallet(256, "")
            try {
                val words = probe.mnemonic().trim().split(Regex("\\s+"))
                checks += coreCheck("fresh-wallet-24-words") { words.size == 24 }
                val btc = probe.getAddressForCoin(CoinType.BITCOIN)
                val eth = probe.getAddressForCoin(CoinType.ETHEREUM)
                val trx = probe.getAddressForCoin(CoinType.TRON)
                val ton = probe.getAddressForCoin(CoinType.TON)
                checks += coreCheck("probe-addresses-validate") {
                    Validation.isValidBtcSegwit(btc) &&
                        Validation.isValidEth(eth) &&
                        Validation.isValidTrx(trx) &&
                        Validation.isValidTon(ton)
                }
                val zpub = probe.getExtendedPublicKey(
                    Purpose.BIP84, CoinType.BITCOIN, HDVersion.ZPUB,
                )
                val ethXpub = probe.getExtendedPublicKey(
                    Purpose.BIP44, CoinType.ETHEREUM, HDVersion.XPUB,
                )
                checks += coreCheck("probe-xpub-prefixes") {
                    zpub.startsWith("zpub") && ethXpub.startsWith("xpub")
                }
            } finally {
                dropReference(probe)
            }
        } catch (e: Exception) {
            checks += Fixtures.FixtureCheck(
                "core-gate",
                false,
                "Core gate threw: ${Redaction.redact(e.message ?: "unknown")}",
            )
        }
        gatePassed = checks.all { it.passed }
        return if (gatePassed) Result.success(checks)
        else Result.failure(
            EngineError.FixtureGateFailed(
                "Fixture gate failed: " +
                    checks.filter { !it.passed }.joinToString("; ") { it.name },
            ),
        )
    }

    private fun coreCheck(name: String, test: () -> Boolean): Fixtures.FixtureCheck {
        val passed = try {
            test()
        } catch (e: Exception) {
            false
        }
        return Fixtures.FixtureCheck(name, passed, if (passed) "ok" else "failed")
    }

    // ---- Create / import ----------------------------------------------

    override fun createWallet(
        tonConfig: TonConfig,
        onPhrase: (List<String>) -> Unit,
    ): Result<PublicWallet> {
        // Creation-time check excludes the deposit address: it does
        // not exist until Core derives it below. The final config
        // (with the real address) must pass full validation.
        if (tonConfig.validateBasics().isFailure) {
            return Result.failure(
                EngineError.InvalidTonConfig("TON config is invalid (see TonConfig rules)"),
            )
        }
        return try {
            val wallet = HDWallet(256, "")
            try {
                val words = wallet.mnemonic().trim().split(Regex("\\s+"))
                if (words.size != 24) {
                    return Result.failure(
                        EngineError.PublicDerivationFailed("Fresh wallet did not yield 24 words"),
                    )
                }
                val finalTon = tonConfig.copy(
                    depositAddress = wallet.getAddressForCoin(CoinType.TON),
                )
                if (finalTon.validate().isFailure) {
                    return Result.failure(
                        EngineError.InvalidTonConfig("Core TON address failed validation"),
                    )
                }
                val pub = publicMaterial(wallet, finalTon)
                    ?: return Result.failure(
                        EngineError.PublicDerivationFailed("Public material derivation failed"),
                    )
                // Phrase delivered exactly once; the caller seals it in
                // the vault before reporting success. This engine never
                // stores it.
                onPhrase(words)
                Result.success(pub)
            } finally {
                dropReference(wallet)
            }
        } catch (e: Exception) {
            Result.failure(
                EngineError.PublicDerivationFailed(
                    Redaction.redact(e.message ?: "wallet creation failed"),
                ),
            )
        }
    }

    override fun previewImport(
        mnemonicWords: List<String>,
        passphrase: String,
    ): Result<PublicWallet> {
        // Empty-passphrase policy: a non-empty passphrase is REJECTED,
        // never silently replaced with "".
        if (passphrase.isNotEmpty()) {
            return Result.failure(
                EngineError.InvalidPassphrasePolicy(
                    "Non-empty passphrases are not supported; use an empty passphrase",
                ),
            )
        }
        if (mnemonicWords.size != 24) {
            return Result.failure(
                EngineError.InvalidMnemonic("Import requires exactly 24 words"),
            )
        }
        return try {
            val wallet = HDWallet(mnemonicWords.joinToString(" "), "")
            try {
                // TON config is recorded at creation, not import: the
                // import flow re-derives the deposit address and the
                // caller re-attaches the config recorded at creation.
                // Until the caller supplies it, preview uses the
                // recorded-address path only; tonConfig here is a
                // placeholder the caller MUST replace from its record.
                val preview = publicMaterial(wallet, null)
                    ?: return Result.failure(
                        EngineError.PublicDerivationFailed("Public material derivation failed"),
                    )
                Result.success(preview)
            } finally {
                dropReference(wallet)
            }
        } catch (e: Exception) {
            Result.failure(
                EngineError.InvalidMnemonic(
                    Redaction.redact(e.message ?: "mnemonic rejected by Core"),
                ),
            )
        }
    }

    /**
     * Public material for a wallet. [tonConfig] may be null only for
     * import preview (caller re-attaches the creation-time config);
     * createWallet always passes a validated config.
     */
    private fun publicMaterial(wallet: HDWallet, tonConfig: TonConfig?): PublicWallet? {
        val btcZpub = wallet.getExtendedPublicKey(
            Purpose.BIP84, CoinType.BITCOIN, HDVersion.ZPUB,
        )
        val ethXpub = wallet.getExtendedPublicKey(
            Purpose.BIP44, CoinType.ETHEREUM, HDVersion.XPUB,
        )
        val trxXpub = wallet.getExtendedPublicKey(
            Purpose.BIP44, CoinType.TRON, HDVersion.XPUB,
        )
        if (btcZpub.isBlank() || ethXpub.isBlank() || trxXpub.isBlank()) return null
        if (Validation.checkXpub(btcZpub).isFailure ||
            Validation.checkXpub(ethXpub).isFailure ||
            Validation.checkXpub(trxXpub).isFailure
        ) {
            return null
        }
        val config = tonConfig ?: TonConfig(
            contractVersion = "unknown-import",
            walletId = 0L,
            workchain = 0,
            network = "testnet",
            tonPath = "m/44'/607'/0'",
            depositAddress = wallet.getAddressForCoin(CoinType.TON),
        )
        return PublicWallet(
            walletId = "",
            btcZpub = btcZpub,
            ethXpub = ethXpub,
            trxXpub = trxXpub,
            tonConfig = config,
        )
    }

    // ---- Unlock / lock -------------------------------------------------

    override fun unlockWallet(walletId: String, mnemonicWords: List<String>): Result<Unit> {
        if (mnemonicWords.size != 24) {
            return Result.failure(EngineError.InvalidMnemonic("Unlock requires exactly 24 words"))
        }
        return try {
            val wallet = HDWallet(mnemonicWords.joinToString(" "), "")
            synchronized(lock) {
                unlocked[walletId]?.let { dropReference(it) }
                unlocked[walletId] = wallet
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(
                EngineError.InvalidMnemonic(
                    Redaction.redact(e.message ?: "mnemonic rejected by Core"),
                ),
            )
        }
    }

    override fun lockWallet(walletId: String) {
        synchronized(lock) {
            unlocked.remove(walletId)?.let { dropReference(it) }
        }
    }

    private fun unlockedWallet(walletId: String): HDWallet? =
        synchronized(lock) { unlocked[walletId] }

    /**
     * Drop a Core object reference. Native cleanup is via Core's
     * phantom-reference mechanism; see the class header note about
     * the unverified explicit delete().
     */
    private fun dropReference(@Suppress("UNUSED_PARAMETER") wallet: HDWallet) {
        // Reference dropped by the caller (try/finally scopes above).
        // No explicit native call here: the 4.8.4 generated binding's
        // disposal API is unverified (see header + core/README.md).
    }

    // ---- Watch-only derivation -----------------------------------------

    override fun deriveAddress(chain: Chain, xpub: String, index: Int): Result<DerivedAddress> {
        if (chain == Chain.TON) {
            return Result.failure(
                EngineError.UnsupportedChain("TON has no xpub and no watch-only derivation"),
            )
        }
        val indexCheck = DerivationPolicy.checkIndex(index)
        if (indexCheck.isFailure) {
            return Result.failure(
                EngineError.InvalidIndex("Index out of range 0..2147483647"),
            )
        }
        val xpubCheck = Validation.checkXpub(xpub)
        if (xpubCheck.isFailure) {
            return Result.failure(
                EngineError.MalformedXpub(xpubCheck.exceptionOrNull()?.message ?: "bad xpub"),
            )
        }
        val path = chain.fullPath(index)
        return try {
            val pubkey = HDWallet.getPublicKeyFromExtended(xpub, chain.toCoinType(), path)
            val address = chain.toCoinType().deriveAddressFromPublicKey(pubkey)
            val ours = Validation.isValidAddress(chain, address)
            val coreOk = chain.toCoinType().validate(address)
            if (!ours || !coreOk) {
                return Result.failure(
                    EngineError.AddressValidationFailed(
                        "Derived address failed validation for ${chain.id}",
                    ),
                )
            }
            Result.success(DerivedAddress(chain, index, address, path))
        } catch (e: Exception) {
            Result.failure(
                EngineError.AddressDerivationFailed(
                    Redaction.redact(e.message ?: "derivation failed"),
                ),
            )
        }
    }

    override fun tonDepositAddress(walletId: String): Result<String> {
        val wallet = unlockedWallet(walletId)
            ?: return Result.failure(EngineError.VaultLocked("Wallet is not unlocked"))
        return try {
            val address = wallet.getAddressForCoin(CoinType.TON)
            if (!Validation.isValidTon(address) || !CoinType.TON.validate(address)) {
                return Result.failure(
                    EngineError.AddressValidationFailed("TON deposit address failed validation"),
                )
            }
            Result.success(address)
        } catch (e: Exception) {
            Result.failure(
                EngineError.AddressDerivationFailed(
                    Redaction.redact(e.message ?: "TON address derivation failed"),
                ),
            )
        }
    }

    // ---- Signing ---------------------------------------------------------

    override fun signFrozenPayload(payload: FrozenPayload): Result<ByteArray> {
        if (payload.decodedSummary.isBlank()) {
            return Result.failure(
                EngineError.SigningRefused("Undecodable action: refusing to blind-sign"),
            )
        }
        if (payload.chain == Chain.TON) {
            return Result.failure(
                EngineError.SigningRefused("TON signing is unimplemented in this build"),
            )
        }
        if (!Validation.isValidAddress(payload.chain, payload.senderAddress) ||
            !Validation.isValidAddress(payload.chain, payload.recipientAddress)
        ) {
            return Result.failure(
                EngineError.InvalidAddress("Sender or recipient address is invalid"),
            )
        }
        val wallet = unlockedWallet(payload.walletId)
            ?: return Result.failure(EngineError.VaultLocked("Wallet is not unlocked"))
        val coin = payload.chain.toCoinType()
        var keyBytes: ByteArray? = null
        return try {
            val key = wallet.getKey(coin, payload.derivationPath)
            keyBytes = key.data()
            val signed = when (payload.chain) {
                Chain.BTC -> {
                    val input = Bitcoin.SigningInput.parseFrom(payload.signingInputBytes)
                        .toBuilder().addPrivateKey(ByteString.copyFrom(keyBytes)).build()
                    val out = AnySigner.sign(input, coin, Bitcoin.SigningOutput.parser())
                    if (out.errorMessage.isNotEmpty()) {
                        return Result.failure(
                            EngineError.SigningRefused(
                                Redaction.redact(out.errorMessage),
                            ),
                        )
                    }
                    out.encoded.toByteArray()
                }
                Chain.ETH -> {
                    val input = Ethereum.SigningInput.parseFrom(payload.signingInputBytes)
                        .toBuilder().setPrivateKey(ByteString.copyFrom(keyBytes)).build()
                    val out = AnySigner.sign(input, coin, Ethereum.SigningOutput.parser())
                    if (out.errorMessage.isNotEmpty()) {
                        return Result.failure(
                            EngineError.SigningRefused(
                                Redaction.redact(out.errorMessage),
                            ),
                        )
                    }
                    out.encoded.toByteArray()
                }
                Chain.TRX -> {
                    val input = Tron.SigningInput.parseFrom(payload.signingInputBytes)
                        .toBuilder().setPrivateKey(ByteString.copyFrom(keyBytes)).build()
                    val out = AnySigner.sign(input, coin, Tron.SigningOutput.parser())
                    if (out.errorMessage.isNotEmpty()) {
                        return Result.failure(
                            EngineError.SigningRefused(
                                Redaction.redact(out.errorMessage),
                            ),
                        )
                    }
                    // TronGrid broadcast takes the signed-transaction JSON.
                    out.json.toByteArray(Charsets.UTF_8)
                }
                Chain.TON -> throw IllegalStateException("unreachable")
            }
            Result.success(signed)
        } catch (e: EngineError) {
            Result.failure(e)
        } catch (e: Exception) {
            Result.failure(
                EngineError.SigningRefused(
                    Redaction.redact(e.message ?: "signing failed"),
                ),
            )
        } finally {
            keyBytes?.fill(0)
        }
    }

    private fun Chain.toCoinType(): CoinType = when (this) {
        Chain.BTC -> CoinType.BITCOIN
        Chain.ETH -> CoinType.ETHEREUM
        Chain.TRX -> CoinType.TRON
        Chain.TON -> CoinType.TON
    }
}
