package com.bawa.wallet.core

import java.math.BigInteger
import java.security.MessageDigest
import org.junit.Assert.*
import org.junit.Test

class ExtendedKeyValidatorTest {
    private val btcZpub =
        "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9"
    // F-17: BIP-49 ypub, the BTC fixture zpub re-versioned to 049d7cb2.
    // Independently, bip-utils derives the P2SH address
    // 34JdW53BKMNqjQXGU33G4N65VxbYdw6jFd at m/49'/0'/0'/0/0.
    private val btcYpub =
        "ypub6XYD5EHXRTjV5Ts4obsP9JGSgxcYzbxc1GcsWN73fjLXGXrpR3McpqJbko4xj3kFj41KRZpnymX4YbH6RTpUnKASUq94bKggxBAf5Wpvbv5"
    private val ethXpub =
        "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc"
    private val trxXpub =
        "xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF"

    private val base58Alphabet =
        "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

    @Test
    fun validBtcZpubReturnsValid() {
        assertEquals(
            ValidationResult.Valid,
            ExtendedKeyValidator.validate(btcZpub, Chain.BTC)
        )
    }

    @Test
    fun validBtcYpubReturnsValid() {
        assertEquals(
            ValidationResult.Valid,
            ExtendedKeyValidator.validate(btcYpub, Chain.BTC)
        )
    }

    @Test
    fun validEthXpubReturnsValid() {
        assertEquals(
            ValidationResult.Valid,
            ExtendedKeyValidator.validate(ethXpub, Chain.ETH)
        )
    }

    @Test
    fun validTrxXpubReturnsValid() {
        assertEquals(
            ValidationResult.Valid,
            ExtendedKeyValidator.validate(trxXpub, Chain.TRX)
        )
    }

    @Test
    fun badChecksumIsRejected() {
        val replacement = if (ethXpub.last() == '1') '2' else '1'
        val corrupted = ethXpub.dropLast(1) + replacement

        val result = ExtendedKeyValidator.validate(corrupted, Chain.ETH)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_CHECKSUM, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun wrongVersionIsRejected() {
        val result = ExtendedKeyValidator.validate(btcZpub, Chain.ETH)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.VERSION_NOT_ALLOWED, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun privateKeyIsRejected() {
        val payload = base58Decode(ethXpub).copyOfRange(0, 78)
        payload[45] = 0x00
        val mutated = base58Encode(withChecksum(payload))

        val result = ExtendedKeyValidator.validate(mutated, Chain.ETH)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.PRIVATE_KEY, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun invalidPointIsRejected() {
        val payload = base58Decode(btcZpub).copyOfRange(0, 78)
        payload[45] = 0x02
        payload.fill(0xff.toByte(), fromIndex = 46, toIndex = 78)
        val mutated = base58Encode(withChecksum(payload))

        val result = ExtendedKeyValidator.validate(mutated, Chain.BTC)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_POINT, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun invalidBase58IsRejected() {
        val malformed = ethXpub.substring(0, 4) + '0' + ethXpub.substring(4)

        val result = ExtendedKeyValidator.validate(malformed, Chain.ETH)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_BASE58, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun invalidLengthIsRejected() {
        val result = ExtendedKeyValidator.validate(ethXpub.take(50), Chain.ETH)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_LENGTH, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun whitespaceIsTrimmed() {
        assertEquals(
            ValidationResult.Valid,
            ExtendedKeyValidator.validate(" $ethXpub ", Chain.ETH)
        )
    }

    private fun base58Decode(value: String): ByteArray {
        val radix = BigInteger.valueOf(58L)
        var number = BigInteger.ZERO

        for (character in value) {
            val digit = base58Alphabet.indexOf(character)
            require(digit >= 0) { "Invalid Base58 character: $character" }
            number = number.multiply(radix).add(BigInteger.valueOf(digit.toLong()))
        }

        val bytes = number.toByteArray()
        val unsignedBytes = if (bytes[0] == 0.toByte()) {
            bytes.copyOfRange(1, bytes.size)
        } else {
            bytes
        }
        val leadingZeroes = value.takeWhile { it == '1' }.length

        return ByteArray(leadingZeroes) + unsignedBytes
    }

    private fun base58Encode(bytes: ByteArray): String {
        if (bytes.isEmpty()) return ""

        val radix = BigInteger.valueOf(58L)
        var number = BigInteger(1, bytes)
        val encoded = StringBuilder()

        while (number.signum() > 0) {
            val quotientAndRemainder = number.divideAndRemainder(radix)
            encoded.append(base58Alphabet[quotientAndRemainder[1].toInt()])
            number = quotientAndRemainder[0]
        }

        repeat(bytes.takeWhile { it == 0.toByte() }.size) {
            encoded.append('1')
        }

        return encoded.reverse().toString()
    }

    private fun withChecksum(payload78: ByteArray): ByteArray {
        require(payload78.size == 78) { "Extended key payload must be 78 bytes" }

        val sha256 = MessageDigest.getInstance("SHA-256")
        val checksum = sha256.digest(sha256.digest(payload78)).copyOfRange(0, 4)

        return payload78 + checksum
    }
}
