package com.bawa.wallet.core

import java.security.MessageDigest

/**
 * Address + extended-key validation. Mirrors the reference tooling
 * (derive.js / docs 14 §2) exactly: same private-version set, same
 * 200-char xpub limit, same index range, same redaction-adjacent rules.
 * Validation never proves an address belongs to the intended account —
 * enrolment must establish that separately.
 */
object Validation {
    const val B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

    /** The 8-entry private-version set from derive.js (hex, lowercase). */
    val PRIVATE_VERSIONS = setOf(
        "0488ade4", "049d7878", "04b2430c", "0295b005",
        "02aa7a99", "04358394", "044a4e28", "045f18bc",
    )

    private fun sha256(data: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(data)

    private fun doubleSha256(data: ByteArray): ByteArray = sha256(sha256(data))

    /** Base58 decode; null on any non-alphabet character. */
    fun decodeBase58(s: String): ByteArray? {
        var n = java.math.BigInteger.ZERO
        val fiftyEight = java.math.BigInteger.valueOf(58)
        for (ch in s) {
            val v = B58_ALPHABET.indexOf(ch)
            if (v < 0) return null
            n = n.multiply(fiftyEight).add(java.math.BigInteger.valueOf(v.toLong()))
        }
        var hex = if (n == java.math.BigInteger.ZERO) "" else n.toString(16)
        if (hex.length % 2 == 1) hex = "0$hex"
        val bytes = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        var leadingOnes = 0
        while (leadingOnes < s.length && s[leadingOnes] == '1') leadingOnes++
        return ByteArray(leadingOnes) + bytes
    }

    fun encodeBase58(data: ByteArray): String {
        var n = java.math.BigInteger(1, data)
        val fiftyEight = java.math.BigInteger.valueOf(58)
        val sb = StringBuilder()
        while (n > java.math.BigInteger.ZERO) {
            val (q, r) = n.divideAndRemainder(fiftyEight)
            sb.append(B58_ALPHABET[r.toInt()])
            n = q
        }
        var leadingZeros = 0
        while (leadingZeros < data.size && data[leadingZeros] == 0.toByte()) leadingZeros++
        repeat(leadingZeros) { sb.append('1') }
        return sb.reverse().toString()
    }

    /** True when [s] is a recognised checksummed private extended key. */
    fun isPrivateExtendedKey(s: String): Boolean {
        val t = s.trim()
        if (t.isEmpty()) return false
        val buf = decodeBase58(t) ?: return false
        if (buf.size < 8) return false
        val payload = buf.copyOfRange(0, buf.size - 4)
        val checksum = buf.copyOfRange(buf.size - 4, buf.size)
        if (!doubleSha256(payload).copyOfRange(0, 4).contentEquals(checksum)) return false
        val version = buf.copyOfRange(0, 4).joinToString("") { "%02x".format(it) }
        return version in PRIVATE_VERSIONS
    }

    /** Typed xpub gate: length, emptiness, private-key rejection. */
    fun checkXpub(xpub: String): Result<Unit> {
        if (xpub.length > DerivationPolicy.MAX_XPUB_LENGTH) {
            return Result.failure(EngineError.XpubTooLong("xpub exceeds ${DerivationPolicy.MAX_XPUB_LENGTH} chars"))
        }
        val t = xpub.trim()
        if (t.isEmpty()) return Result.failure(EngineError.EmptyXpub("xpub is empty"))
        if (isPrivateExtendedKey(t)) {
            return Result.failure(EngineError.PrivateExtendedKey("private extended keys are rejected"))
        }
        return Result.success(Unit)
    }

    // ---- Bech32 (BIP-173) for BTC native SegWit ----

    private const val BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

    private fun bech32Polymod(values: IntArray): Int {
        val generator = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)
        var chk = 1
        for (v in values) {
            val top = chk ushr 25
            chk = (chk and 0x1ffffff) shl 5 xor v
            for (i in 0 until 5) {
                if ((top shr i) and 1 == 1) chk = chk xor generator[i]
            }
        }
        return chk
    }

    private fun bech32HrpExpand(hrp: String): IntArray {
        val out = IntArray(hrp.length * 2 + 1)
        for (i in hrp.indices) {
            out[i] = hrp[i].code shr 5
            out[i + hrp.length + 1] = hrp[i].code and 31
        }
        out[hrp.length] = 0
        return out
    }

    /** Full Bech32 checksum verification for bc1q/tb1q witness-v0 addresses. */
    fun isValidBtcSegwit(address: String): Boolean {
        val lower = address.lowercase()
        if (address != lower && address != address.uppercase()) return false // mixed case forbidden
        val pos = lower.lastIndexOf('1')
        if (pos < 1) return false
        val hrp = lower.substring(0, pos)
        if (hrp != "bc" && hrp != "tb") return false
        val dataPart = lower.substring(pos + 1)
        if (dataPart.length < 8 || dataPart.length > 90) return false
        val values = IntArray(dataPart.length)
        for (i in dataPart.indices) {
            val v = BECH32_CHARSET.indexOf(dataPart[i])
            if (v < 0) return false
            values[i] = v
        }
        val combined = bech32HrpExpand(hrp) + values
        if (bech32Polymod(combined) != 1) return false
        // Witness version 0, program length 20 (P2WPKH) or 32 (P2WSH).
        val version = values[0]
        if (version != 0) return false
        val programBits = dataPart.length - 7 // minus version + 6-char checksum
        // 5-bit groups: 20 bytes -> 32 groups, 32 bytes -> 52 groups.
        if (programBits != 32 && programBits != 52) return false
        return true
    }

    /** EIP-55 checksum validation (all-lowercase / all-uppercase pass as unchecksummed). */
    fun isValidEth(address: String): Boolean {
        if (!address.startsWith("0x") || address.length != 42) return false
        val hex = address.substring(2)
        if (!hex.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) return false
        if (hex == hex.lowercase() || hex == hex.uppercase()) return true
        val hash = Keccak.digestHex(hex.lowercase())
        for (i in hex.indices) {
            val c = hex[i]
            if (c in 'a'..'f' || c in 'A'..'F') {
                val shouldUpper = hash[i].digitToInt(16) >= 8
                if (shouldUpper != c.isUpperCase()) return false
            }
        }
        return true
    }

    /** TRON Base58Check: version 0x41, 21-byte payload, valid checksum. */
    fun isValidTrx(address: String): Boolean {
        val decoded = decodeBase58(address) ?: return false
        if (decoded.size != 25) return false
        if (decoded[0] != 0x41.toByte()) return false
        val payload = decoded.copyOfRange(0, 21)
        val checksum = decoded.copyOfRange(21, 25)
        return doubleSha256(payload).copyOfRange(0, 4).contentEquals(checksum)
    }

    /** TON friendly address: 48-char base64url, CRC16 (poly 0x1021, init 0) over 34 bytes. */
    fun isValidTonFriendly(address: String): Boolean {
        if (address.length != 48) return false
        val raw = try {
            java.util.Base64.getUrlDecoder().decode(address)
        } catch (_: IllegalArgumentException) {
            return false
        }
        if (raw.size != 36) return false
        var crc = 0
        for (i in 0 until 34) {
            crc = crc xor (raw[i].toInt() and 0xff shl 8)
            repeat(8) {
                crc = if (crc and 0x8000 != 0) (crc shl 1) xor 0x1021 else crc shl 1
                crc = crc and 0xffff
            }
        }
        val stored = ((raw[34].toInt() and 0xff) shl 8) or (raw[35].toInt() and 0xff)
        return crc == stored
    }

    /** TON raw form "workchain:hex" (64 hex chars). */
    fun isValidTonRaw(address: String): Boolean {
        val parts = address.split(":")
        if (parts.size != 2) return false
        val wc = parts[0].toIntOrNull() ?: return false
        if (wc != 0 && wc != -1) return false
        val hex = parts[1]
        return hex.length == 64 && hex.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }
    }

    fun isValidTon(address: String): Boolean =
        isValidTonFriendly(address) || isValidTonRaw(address)

    fun isValidAddress(chain: Chain, address: String): Boolean = when (chain) {
        Chain.BTC -> isValidBtcSegwit(address)
        Chain.ETH -> isValidEth(address)
        Chain.TRX -> isValidTrx(address)
        Chain.TON -> isValidTon(address)
    }
}
