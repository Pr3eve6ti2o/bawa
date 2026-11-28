package com.bawa.wallet.core

/**
 * Keccak-256 (original Keccak padding, NOT NIST SHA-3) for EIP-55
 * checksum validation. Pure Kotlin, no dependencies. Verified against
 * the standard vectors: keccak256("") and keccak256("abc").
 */
object Keccak {
    // Round constants as signed longs (values above Long.MAX_VALUE are
    // written negated; bit patterns are identical to the Keccak spec).
    private val RC = longArrayOf(
        0x1L, 0x8082L, -0x7fffffffffff7f76L, -0x7fffffff7fff8000L,
        0x808bL, 0x80000001L, -0x7fffffff7fff7f7fL, -0x7fffffffffff7ff7L,
        0x8aL, 0x88L, 0x80008009L, 0x8000000aL,
        0x8000808bL, -0x7fffffffffffff75L, -0x7fffffffffff7f77L,
        -0x7fffffffffff7ffdL, -0x7fffffffffff7ffeL, -0x7fffffffffffff80L,
        0x800aL, -0x7fffffff7ffffff6L, -0x7fffffff7fff7f7fL,
        -0x7fffffffffff7f80L, 0x80000001L, -0x7fffffff7fff7ff8L,
    )

    // Rotation offsets r[x + 5*y], x = column, y = row.
    private val ROT = intArrayOf(
        0, 1, 62, 28, 27,
        36, 44, 6, 55, 20,
        3, 10, 43, 25, 39,
        41, 45, 15, 21, 8,
        18, 2, 61, 56, 14,
    )

    private fun rotl(x: Long, n: Int): Long =
        if (n == 0) x else (x shl n) or (x ushr (64 - n))

    private fun keccakF(state: LongArray) {
        for (round in 0 until 24) {
            // Theta
            val c = LongArray(5)
            for (x in 0 until 5) {
                c[x] = state[x] xor state[x + 5] xor state[x + 10] xor state[x + 15] xor state[x + 20]
            }
            for (x in 0 until 5) {
                val d = c[(x + 4) % 5] xor rotl(c[(x + 1) % 5], 1)
                for (y in 0 until 5) state[x + 5 * y] = state[x + 5 * y] xor d
            }
            // Rho + Pi
            val b = LongArray(25)
            for (x in 0 until 5) {
                for (y in 0 until 5) {
                    val src = x + 5 * y
                    val dstX = y
                    val dstY = (2 * x + 3 * y) % 5
                    b[dstX + 5 * dstY] = rotl(state[src], ROT[src])
                }
            }
            // Chi
            for (x in 0 until 5) {
                for (y in 0 until 5) {
                    state[x + 5 * y] = b[x + 5 * y] xor ((b[(x + 1) % 5 + 5 * y].inv()) and b[(x + 2) % 5 + 5 * y])
                }
            }
            // Iota
            state[0] = state[0] xor RC[round]
        }
    }

    /** Keccak-256 digest of [input]. */
    fun digest(input: ByteArray): ByteArray {
        val rate = 136 // bytes per block for Keccak-256
        val state = LongArray(25)
        var offset = 0
        while (offset + rate <= input.size) {
            for (i in 0 until rate / 8) {
                var word = 0L
                for (j in 0 until 8) {
                    word = word or ((input[offset + i * 8 + j].toLong() and 0xffL) shl (8 * j))
                }
                state[i] = state[i] xor word
            }
            keccakF(state)
            offset += rate
        }
        // Final block with Keccak padding: 0x01 ... 0x80
        val block = ByteArray(rate)
        val remaining = input.size - offset
        for (i in 0 until remaining) block[i] = input[offset + i]
        block[remaining] = (block[remaining].toInt() or 0x01).toByte()
        block[rate - 1] = (block[rate - 1].toInt() or 0x80).toByte()
        for (i in 0 until rate / 8) {
            var word = 0L
            for (j in 0 until 8) {
                word = word or ((block[i * 8 + j].toLong() and 0xffL) shl (8 * j))
            }
            state[i] = state[i] xor word
        }
        keccakF(state)
        val out = ByteArray(32)
        for (i in 0 until 4) {
            for (j in 0 until 8) {
                out[i * 8 + j] = (state[i] ushr (8 * j)).toByte()
            }
        }
        return out
    }

    fun digestHex(input: String): String =
        digest(input.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
