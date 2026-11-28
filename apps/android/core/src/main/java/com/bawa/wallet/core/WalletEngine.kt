package com.bawa.wallet.core

/**
 * The engine boundary. The app talks ONLY to this interface; the only
 * implementation is CoreWalletEngine (:core module, Trust Wallet Core
 * 4.8.4). No other module imports Core types.
 *
 * Rules carried by every implementation:
 * - Fixture gate runs at startup and before the first wallet operation;
 *   any failure blocks all wallet actions (no bypass).
 * - Secrets never leave this boundary: methods return public data,
 *   opaque wallet IDs, or signature material — never mnemonics, seeds,
 *   private keys, or native handles.
 * - Native/Core objects are disposed on every exit path.
 * - TON: single deposit address only, full TonConfig recorded.
 */
/**
 * Public wallet material. [walletId] is assigned by the caller's store
 * (WalletStore row id) when the wallet is persisted; engines return ""
 * here because they do not own storage.
 */
data class PublicWallet(
    val walletId: String,
    val btcZpub: String,
    val ethXpub: String,
    val trxXpub: String,
    val tonConfig: TonConfig,
)

data class DerivedAddress(
    val chain: Chain,
    val index: Int,
    val address: String,
    val fullPath: String,
)

interface WalletEngine {
    /** Runs the full fixture gate (pure + Core derivation checks). */
    fun runFixtureGate(): Result<List<Fixtures.FixtureCheck>>

    /** True only when the last fixture gate passed for this engine. */
    val gatePassed: Boolean

    /**
     * Create a wallet from fresh secure-random entropy (256-bit ->
     * 24 words, empty passphrase). Returns public material only; the
     * caller must seal the phrase via the vault before reporting
     * success, and the phrase itself is delivered through [onPhrase]
     * exactly once (backup screen), never stored in this object.
     * [tonConfig] is the user-chosen TON wallet contract, recorded at
     * creation (TON has no xpub; the deposit address comes from Core).
     */
    fun createWallet(
        tonConfig: TonConfig,
        onPhrase: (List<String>) -> Unit,
    ): Result<PublicWallet>

    /**
     * Unlock a wallet into engine memory from its vault-decrypted
     * phrase. The phrase lives only inside the Core object for this
     * session; [lockWallet] drops it. The caller must wipe its own
     * copy after this call returns.
     */
    fun unlockWallet(walletId: String, mnemonicWords: List<String>): Result<Unit>

    /** Drop an unlocked wallet from engine memory. */
    fun lockWallet(walletId: String)

    /**
     * Import from a mnemonic. Validates wordlist/count/checksum via
     * Core, rejects any non-empty passphrase under the empty-passphrase
     * policy, and returns public material + a public-address preview
     * for user confirmation before the caller seals the wallet.
     */
    fun previewImport(mnemonicWords: List<String>, passphrase: String): Result<PublicWallet>

    /** Watch-only derivation: validated address or typed error. */
    fun deriveAddress(chain: Chain, xpub: String, index: Int): Result<DerivedAddress>

    /** TON deposit address for a wallet (no xpub exists for TON). */
    fun tonDepositAddress(walletId: String): Result<String>

    /**
     * Sign a FROZEN payload. The caller must have completed review;
     * this method verifies the payload binding and returns SIGNATURE
     * MATERIAL ONLY. Any undecodable action is refused, never signed.
     */
    fun signFrozenPayload(payload: FrozenPayload): Result<ByteArray>
}

/**
 * The frozen, reviewed transaction intent. Any change to any field
 * after approval invalidates it (TxStateMachine restarts review).
 * The signer verifies these fields against the bytes it will sign.
 */
data class FrozenPayload(
    val walletId: String,
    val chain: Chain,
    val network: String,
    val senderAddress: String,
    val derivationPath: String, // full path of the sender key, e.g. m/84'/0'/0'/0/3
    val recipientAddress: String,
    val assetId: String,
    val amount: String, // decimal string in the asset's smallest unit
    val feeEstimate: String,
    val maxFee: String,
    val signingInputBytes: ByteArray, // chain-specific protobuf input, WITHOUT any private key
    val decodedSummary: String, // human-readable decode of the payload
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is FrozenPayload) return false
        return walletId == other.walletId && chain == other.chain &&
            network == other.network &&
            senderAddress == other.senderAddress &&
            derivationPath == other.derivationPath &&
            recipientAddress == other.recipientAddress &&
            assetId == other.assetId && amount == other.amount &&
            feeEstimate == other.feeEstimate && maxFee == other.maxFee &&
            signingInputBytes.contentEquals(other.signingInputBytes) &&
            decodedSummary == other.decodedSummary
    }

    override fun hashCode(): Int {
        var result = walletId.hashCode()
        result = 31 * result + chain.hashCode()
        result = 31 * result + network.hashCode()
        result = 31 * result + senderAddress.hashCode()
        result = 31 * result + derivationPath.hashCode()
        result = 31 * result + recipientAddress.hashCode()
        result = 31 * result + assetId.hashCode()
        result = 31 * result + amount.hashCode()
        result = 31 * result + feeEstimate.hashCode()
        result = 31 * result + maxFee.hashCode()
        result = 31 * result + signingInputBytes.contentHashCode()
        result = 31 * result + decodedSummary.hashCode()
        return result
    }
}
