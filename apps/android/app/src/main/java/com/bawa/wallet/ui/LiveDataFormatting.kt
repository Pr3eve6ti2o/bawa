package com.bawa.wallet.ui

import com.bawa.wallet.data.BalanceResult
import com.bawa.wallet.data.network.PriceResult
import java.math.BigDecimal
import java.util.Locale

// Pure display formatting for live data (Step 6). No Android types,
// so these are plain JVM unit tests. The honesty rules live here:
// an unavailable value formats to null (the caller shows the reason),
// a priced holding never formats as $0.00 unless its real value
// rounds there — a real total under one cent shows "< $0.01".

/** Base-unit balance ("1000000", 6) -> human amount ("1"), or null when the raw value is not digits. */
fun formatCryptoAmount(rawAmount: String, decimals: Int): String? {
    val raw = try {
        BigDecimal(rawAmount)
    } catch (e: NumberFormatException) {
        return null
    }
    if (raw.signum() < 0) return null
    return try {
        raw.movePointLeft(decimals).stripTrailingZeros().toPlainString()
    } catch (e: ArithmeticException) {
        null
    }
}

/** Human amount for an available balance, or null when unavailable. */
fun BalanceResult.displayAmount(): String? = when (this) {
    is BalanceResult.Available -> formatCryptoAmount(rawAmount, decimals)
    is BalanceResult.Unavailable -> null
}

/** USD value of a holding: balance x price, or null when either side is unavailable. */
fun usdValue(balance: BalanceResult, price: PriceResult): Double? {
    if (balance !is BalanceResult.Available) return null
    if (price !is PriceResult.Available) return null
    val amount = formatCryptoAmount(balance.rawAmount, balance.decimals)?.toDoubleOrNull()
        ?: return null
    val value = amount * price.priceUsd
    return if (value.isFinite() && value > 0) value else null
}

/** A USD amount for display: grouped, two decimals; a real total under one cent never reads "$0.00". */
fun formatUsd(value: Double): String {
    if (!value.isFinite() || value < 0) return "Unavailable"
    if (value > 0 && value < 0.01) return "< \$0.01"
    return String.format(Locale.US, "\$%,.2f", value)
}

/** A 24 h change for display ("+2.34%", "-0.50%"), or null when the source did not provide one. */
fun formatChange24h(change24h: Double?): String? {
    if (change24h == null || !change24h.isFinite()) return null
    return String.format(Locale.US, "%+.2f%%", change24h)
}

/** Total worth of priced holdings, or null when nothing is priced (the UI shows "Unavailable", never $0.00). */
fun totalWorthUsd(values: List<Double?>): Double? {
    val priced = values.filterNotNull().filter { it.isFinite() && it > 0 }
    if (priced.isEmpty()) return null
    val total = priced.sum()
    return if (total.isFinite() && total > 0) total else null
}
