package com.bawa.wallet.core

import java.math.BigInteger
import java.security.MessageDigest

enum class Chain { BTC, ETH, TRX }

enum class Reason {
    INVALID_BASE58,
    INVALID_LENGTH,
    INVALID_CHECKSUM,
    PRIVATE_KEY,
    VERSION_NOT_ALLOWED,
    INVALID_POINT
}

sealed interface ValidationResult {
    data object Valid : ValidationResult
    data class Invalid(val reason: Reason, val message: String) : ValidationResult
}

// Watch-only validation; no address derivation is performed.
object ExtendedKeyValidator {
    private const val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    private const val DECODED_LENGTH = 82
    private const val PAYLOAD_LENGTH = 78
    private const val KEY_DATA_OFFSET = 45

    private val PRIVATE_VERSIONS = setOf(
        "0488ade4", "049d7878", "04b2430c",
        "04358394", "044a4e28", "045f18bc"
    )
    private val FIELD_PRIME = BigInteger.ONE.shiftLeft(256)
        .subtract(BigInteger.ONE.shiftLeft(32))
        .subtract(BigInteger.valueOf(977L))
    private val LEGENDRE_EXPONENT = FIELD_PRIME.subtract(BigInteger.ONE).shiftRight(1)

    fun validate(xpub: String, chain: Chain): ValidationResult {
        val input = xpub.trim()

        // Check the whole alphabet first so character errors take precedence over overflow.
        if (input.any { ALPHABET.indexOf(it) < 0 }) {
            return ValidationResult.Invalid(
                Reason.INVALID_BASE58,
                "invalid base58 character in extended key"
            )
        }

        val decoded = decodeBase58(input)
        if (decoded == null) {
            return ValidationResult.Invalid(
                Reason.INVALID_LENGTH,
                "invalid extended key length"
            )
        }

        val sha256 = MessageDigest.getInstance("SHA-256")
        sha256.update(decoded, 0, PAYLOAD_LENGTH)
        val firstHash = sha256.digest()
        val checksum = sha256.digest(firstHash)
        if ((0 until 4).any { decoded[PAYLOAD_LENGTH + it] != checksum[it] }) {
            return ValidationResult.Invalid(
                Reason.INVALID_CHECKSUM,
                "invalid extended key checksum"
            )
        }

        val version = buildString(8) {
            for (i in 0 until 4) {
                append((decoded[i].toInt() and 0xff).toString(16).padStart(2, '0'))
            }
        }
        if (decoded[KEY_DATA_OFFSET] == 0.toByte() || version in PRIVATE_VERSIONS) {
            return ValidationResult.Invalid(
                Reason.PRIVATE_KEY,
                "extended public key required (private extended keys are rejected)"
            )
        }

        // R-01: validate the point before applying the version allow-list.
        if (!isValidPoint(decoded)) {
            return ValidationResult.Invalid(
                Reason.INVALID_POINT,
                "extended key contains an invalid secp256k1 public key point"
            )
        }

        // BTC/ETH/TRX xpubs share version 0488b21e, so cross-chain xpub misuse
        // between those three is undetectable from serialisation alone.
        // F-17: BIP-49 ypub (049d7cb2) is accepted for BTC, like the shared
        // validator (tools/hdwallet-gen/extended-key.js).
        val allowed = when (chain) {
            Chain.BTC -> version == "0488b21e" || version == "049d7cb2" || version == "04b24746"
            Chain.ETH, Chain.TRX -> version == "0488b21e"
        }
        if (!allowed) {
            return ValidationResult.Invalid(
                Reason.VERSION_NOT_ALLOWED,
                "extended key version $version is not allowed for ${chain.name.lowercase()}"
            )
        }

        return ValidationResult.Valid
    }

    // The alphabet has already been checked; null means too short or too long.
    private fun decodeBase58(input: String): ByteArray? {
        val decoded = ByteArray(DECODED_LENGTH)
        var leadingZeroes = 0
        while (leadingZeroes < input.length && input[leadingZeroes] == '1') {
            leadingZeroes++
            if (leadingZeroes > DECODED_LENGTH) return null
        }

        for (character in input) {
            var carry = ALPHABET.indexOf(character)
            for (i in decoded.lastIndex downTo 0) {
                val value = (decoded[i].toInt() and 0xff) * 58 + carry
                decoded[i] = value.toByte()
                carry = value ushr 8
            }
            if (carry != 0) return null
        }

        var firstNonZero = 0
        while (firstNonZero < decoded.size && decoded[firstNonZero] == 0.toByte()) {
            firstNonZero++
        }

        // Each leading '1' contributes one zero byte to the decoded length.
        val significantLength = decoded.size - firstNonZero
        if (leadingZeroes + significantLength != DECODED_LENGTH) return null
        return decoded
    }

    private fun isValidPoint(decoded: ByteArray): Boolean {
        val prefix = decoded[KEY_DATA_OFFSET].toInt() and 0xff
        if (prefix != 0x02 && prefix != 0x03) return false

        val x = BigInteger(1, decoded.copyOfRange(KEY_DATA_OFFSET + 1, PAYLOAD_LENGTH))
        if (x >= FIELD_PRIME) return false

        val ySquared = x.modPow(BigInteger.valueOf(3L), FIELD_PRIME)
            .add(BigInteger.valueOf(7L))
            .mod(FIELD_PRIME)

        return ySquared == BigInteger.ZERO ||
            ySquared.modPow(LEGENDRE_EXPONENT, FIELD_PRIME) == BigInteger.ONE
    }
}
