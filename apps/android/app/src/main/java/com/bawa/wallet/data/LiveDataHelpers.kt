package com.bawa.wallet.data

import java.math.BigInteger
import java.util.Base64
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Small parsing helpers shared by the live Step 5 repositories. All
// parsing is defensive: a malformed provider answer is a failure to
// report as Unavailable, never a crash and never an invented number.

internal val liveJson = Json { ignoreUnknownKeys = true }

internal fun parseJsonObject(text: String): JsonObject? {
    return try {
        liveJson.parseToJsonElement(text).jsonObject
    } catch (e: Exception) {
        null
    }
}

internal fun parseJsonElement(text: String): JsonElement? {
    return try {
        liveJson.parseToJsonElement(text)
    } catch (e: Exception) {
        null
    }
}

internal fun JsonObject.stringField(name: String): String? {
    val value = this[name] ?: return null
    if (value !is JsonPrimitive) return null
    return if (value.isString) value.content else null
}

/**
 * A JSON value that may be a number or a digit string, read as its
 * exact decimal digits. JSON numbers lose precision above 2^53 in some
 * parsers, so the raw content is kept as text, never forced through
 * Double.
 */
internal fun JsonObject.numberStringField(name: String): String? {
    val value = this[name] ?: return null
    if (value !is JsonPrimitive) return null
    val content = value.content
    return if (content.matches(Regex("-?\\d+(\\.\\d+)?"))) content else null
}

internal fun JsonObject.objectField(name: String): JsonObject? {
    val value = this[name] ?: return null
    return try {
        value.jsonObject
    } catch (e: Exception) {
        null
    }
}

/** Hex ("0x…" or bare) to BigInteger, or null when unparsable. */
internal fun hexToBigInteger(hex: String): BigInteger? {
    val clean = hex.removePrefix("0x").removePrefix("0X")
    if (clean.isEmpty() || !clean.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
        return null
    }
    return try {
        BigInteger(clean, 16)
    } catch (e: Exception) {
        null
    }
}

internal fun isEvmAddress(address: String): Boolean {
    if (!address.startsWith("0x") || address.length != 42) return false
    return address.substring(2).all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }
}

/** A 20-byte address hex (no 0x) left-padded to a 32-byte ABI word. */
internal fun paddedAddressWord(address: String): String {
    return address.lowercase().removePrefix("0x").padStart(64, '0')
}

/**
 * Decimal string ("12.345") to base units at [decimals] places, or null
 * when the shape is not a plain decimal. Used for SoChain DOGE amounts,
 * which arrive as decimal coin values, not base units.
 */
internal fun decimalToBaseUnits(decimal: String, decimals: Int): BigInteger? {
    if (!decimal.matches(Regex("-?\\d+(\\.\\d{1,18})?"))) return null
    val negative = decimal.startsWith("-")
    val unsigned = decimal.removePrefix("-")
    val parts = unsigned.split(".")
    val whole = parts[0]
    val fraction = if (parts.size > 1) parts[1] else ""
    if (fraction.length > decimals) return null
    val combined = whole + fraction.padEnd(decimals, '0')
    val stripped = combined.trimStart('0').ifEmpty { "0" }
    return try {
        val value = BigInteger(stripped)
        if (negative) value.negate() else value
    } catch (e: Exception) {
        null
    }
}

private const val BASE58_ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

/**
 * Base58-decoded bytes as lowercase hex, or null for an invalid input.
 * Used for TRON addresses (base58check, 0x41 + 20 bytes + 4 checksum
 * bytes); the caller checks the 0x41 prefix and length.
 */
internal fun base58ToHex(input: String): String? {
    if (input.isEmpty() || input.any { it !in BASE58_ALPHABET }) return null
    var value = BigInteger.ZERO
    for (ch in input) {
        value = value.multiply(BigInteger.valueOf(58))
            .add(BigInteger.valueOf(BASE58_ALPHABET.indexOf(ch).toLong()))
    }
    var hex = value.toString(16)
    if (hex.length % 2 == 1) hex = "0$hex"
    val leadingOnes = input.takeWhile { it == '1' }.length
    val leadingZeros = "00".repeat(leadingOnes)
    return leadingZeros + hex
}

/** Base64 (TonCenter transaction hashes) to lowercase hex, or null. */
internal fun base64ToHex(base64: String): String? {
    return try {
        val bytes = Base64.getDecoder().decode(base64)
        bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
    } catch (e: Exception) {
        null
    }
}
