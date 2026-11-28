package com.bawa.wallet.core

/**
 * Diagnostic redaction — docs 14 §5.4, mirroring derive.js exactly.
 * Defence in depth only: this cannot recognise mnemonic phrases or
 * every short secret. Prevention (never collecting secrets) is the rule;
 * redaction is the backstop.
 */
object Redaction {
    private val EXTENDED_KEY_PREFIXES = listOf(
        "xprv", "xpub", "yprv", "ypub", "zprv", "zpub",
        "Yprv", "Ypub", "Zprv", "Zpub", "tprv", "tpub",
        "uprv", "upub", "vprv", "vpub",
    )
    private val extendedKeyRegex = Regex(
        "(?:${EXTENDED_KEY_PREFIXES.joinToString("|")})[1-9A-HJ-NP-Za-km-z]+",
    )
    private val longBase58Regex = Regex("[1-9A-HJ-NP-Za-km-z]{100,}")

    /** Replace extended-key-like strings and 100+ Base58 runs with [REDACTED]. */
    fun redact(message: String?): String {
        if (message == null) return ""
        var out = extendedKeyRegex.replace(message, "[REDACTED]")
        out = longBase58Regex.replace(out, "[REDACTED]")
        return out
    }

    /** Safe log line: redacted message + module + stable code, never raw causes. */
    fun logLine(module: String, code: String, message: String?): String =
        "[$module][$code] ${redact(message)}"
}
