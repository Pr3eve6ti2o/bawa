package com.bawa.wallet.ui

// Bawa Balanced direction-04 tokens (catalogue §5, STYLE-04), adapted
// for the dark Android shell. The web tokens live in
// apps/web/src/ui/styles/globals.css; the mapping is:
//   --panel-surface        #0b1326  -> BawaBackground
//   --panel-surface-raised #243454  -> BawaSurfaceRaised
//   --panel-border         #263454  -> BawaBorder
//   --panel-text           #eff2fc  -> BawaText
//   --panel-text-muted     #aab5d1  -> BawaTextMuted
//   --panel-text-soft      #c8d0e8  -> BawaTextSoft
//   --panel-accent-from    #8b7cff  -> BawaAccent (primary on dark)
//   --panel-accent-to      #4f7cff  -> BawaAccentEnd (secondary)
//   --primary-solid        #6258d9  -> BawaPrimarySolid (filled controls,
//                                     white text — kept for buttons)
//   --panel-success-pill-* #94e1c3 on #224f45 -> BawaSuccess*
//
// The previous scheme was the vendored WDK starter palette (light-blue
// primary #4FC3F7 on #121212). That blue is replaced: Bawa's identity is
// the violet accent, and #8B7CFF (not #6258D9) is the primary on dark
// because #6258D9 text on #0B1326 fails WCAG AA for normal text while
// #8B7CFF passes. Filled buttons keep #6258D9 with white text, exactly
// as the web does with --primary-solid.
//
// Chain tints are the chains' standard brand colours, used only as
// icon/avatar tints (text glyphs, no copied assets):
//   BTC #F7931A, ETH #627EEA, TRX #FF0013, TON #0098EA.

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.bawa.wallet.core.Chain

object BawaTokens {
    val Background = Color(0xFF0B1326)
    val Surface = Color(0xFF11172B)
    val SurfaceRaised = Color(0xFF243454)
    val Border = Color(0xFF263454)
    val BorderStrong = Color(0xFF334767)
    val Text = Color(0xFFEFF2FC)
    val TextMuted = Color(0xFFAAB5D1)
    val TextSoft = Color(0xFFC8D0E8)
    val Accent = Color(0xFF8B7CFF)
    val AccentEnd = Color(0xFF4F7CFF)
    val PrimarySolid = Color(0xFF6258D9)
    val PrimarySolidHover = Color(0xFF5248C0)
    val SuccessText = Color(0xFF94E1C3)
    val SuccessBackground = Color(0xFF224F45)
    val Error = Color(0xFFEF5350)
    val Warning = Color(0xFFFF9800)
    val BtcTint = Color(0xFFF7931A)
    val EthTint = Color(0xFF627EEA)
    val TrxTint = Color(0xFFFF0013)
    val TonTint = Color(0xFF0098EA)
}

val BawaColors = darkColorScheme(
    primary = BawaTokens.Accent,
    onPrimary = Color.White,
    primaryContainer = BawaTokens.PrimarySolid,
    onPrimaryContainer = Color.White,
    secondary = BawaTokens.AccentEnd,
    onSecondary = Color.White,
    tertiary = BawaTokens.SuccessText,
    onTertiary = BawaTokens.SuccessBackground,
    background = BawaTokens.Background,
    onBackground = BawaTokens.Text,
    surface = BawaTokens.Surface,
    onSurface = BawaTokens.Text,
    surfaceVariant = BawaTokens.SurfaceRaised,
    onSurfaceVariant = BawaTokens.TextMuted,
    outline = BawaTokens.Border,
    outlineVariant = BawaTokens.BorderStrong,
    error = BawaTokens.Error,
    onError = Color.White
)

/** Bawa Balanced theme wrapper. Replaces the inline WDK scheme that lived in MainActivity. */
@Composable
fun BawaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BawaColors,
        content = content
    )
}

/** Chain tint for avatars and chain rows. */
fun ChainTint(chain: Chain): Color = when (chain) {
    Chain.BTC -> BawaTokens.BtcTint
    Chain.ETH -> BawaTokens.EthTint
    Chain.TRX -> BawaTokens.TrxTint
    Chain.TON -> BawaTokens.TonTint
}
