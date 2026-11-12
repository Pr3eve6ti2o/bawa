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
    fun smallXNonResiduePointIsRejected() {
        // T42: Legendre branch — x = 5 gives y^2 = 132, a non-residue mod p.
        val payload = base58Decode(btcZpub).copyOfRange(0, 78)
        payload[45] = 0x02
        payload.fill(0.toByte(), fromIndex = 46, toIndex = 78)
        payload[77] = 5.toByte()
        val mutated = base58Encode(withChecksum(payload))

        val result = ExtendedKeyValidator.validate(mutated, Chain.BTC)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_POINT, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun smallXValidPointIsAccepted() {
        // T42: Legendre branch — x = 1 gives y^2 = 8, a quadratic residue.
        val payload = base58Decode(btcZpub).copyOfRange(0, 78)
        payload[45] = 0x02
        payload.fill(0.toByte(), fromIndex = 46, toIndex = 78)
        payload[77] = 1.toByte()
        val mutated = base58Encode(withChecksum(payload))

        assertEquals(
            ValidationResult.Valid,
            ExtendedKeyValidator.validate(mutated, Chain.BTC)
        )
    }

    @Test
    fun overLongInputIsRejected() {
        val overLong = "1".repeat(200)
        val result = ExtendedKeyValidator.validate(overLong, Chain.BTC)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_LENGTH, (result as ValidationResult.Invalid).reason)

        val justOver = "z".repeat(113)
        val result2 = ExtendedKeyValidator.validate(justOver, Chain.BTC)

        assertTrue(result2 is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_LENGTH, (result2 as ValidationResult.Invalid).reason)
    }

    @Test
    fun privateVersion0295b005IsRejected() {
        // T40-F2: 0295b005 is in the documented 8-version private set
        // (docs/05-watch-only/README.md) and in the shared Node validator.
        val payload = base58Decode(ethXpub).copyOfRange(0, 78)
        payload[0] = 0x02.toByte()
        payload[1] = 0x95.toByte()
        payload[2] = 0xb0.toByte()
        payload[3] = 0x05.toByte()
        val mutated = base58Encode(withChecksum(payload))

        val result = ExtendedKeyValidator.validate(mutated, Chain.ETH)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.PRIVATE_KEY, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun privateVersion02aa7a99IsRejected() {
        // T40-F2: 02aa7a99, same documented set as 0295b005.
        val payload = base58Decode(ethXpub).copyOfRange(0, 78)
        payload[0] = 0x02.toByte()
        payload[1] = 0xaa.toByte()
        payload[2] = 0x7a.toByte()
        payload[3] = 0x99.toByte()
        val mutated = base58Encode(withChecksum(payload))

        val result = ExtendedKeyValidator.validate(mutated, Chain.ETH)

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.PRIVATE_KEY, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun depth0FingerprintIsRejected() {
        // T40-F1: same vector as the shared Node validator's
        // DEPTH0_FINGERPRINT regression (test/smoke.test.js).
        val result = ExtendedKeyValidator.validate(
            "xpub661MyMwTWkfYbGsHSkBPfK8hV3UhGjbN4hYBHFNRsZRFaUa3Eg5jKNwq1HMHBXDCDy9zSQTnhJgVAJY3gs8sTpDdrNWrHzwdEoY7Lf6dzxA",
            Chain.BTC
        )

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_DEPTH_METADATA, (result as ValidationResult.Invalid).reason)
    }

    @Test
    fun depth0ChildIsRejected() {
        // T40-F1: same vector as the shared Node validator's
        // DEPTH0_CHILD regression (test/smoke.test.js).
        val result = ExtendedKeyValidator.validate(
            "xpub661MyMwAqRbcHG7iAofhFTywCv8fdScxFvDJvpPZrQfnYjTChfcdCM7UWu179f4DmYcB4d3xuhXR1fFqeykXjsYQFQ9WHho2G6GX5dSHoAV",
            Chain.BTC
        )

        assertTrue(result is ValidationResult.Invalid)
        assertEquals(Reason.INVALID_DEPTH_METADATA, (result as ValidationResult.Invalid).reason)
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
