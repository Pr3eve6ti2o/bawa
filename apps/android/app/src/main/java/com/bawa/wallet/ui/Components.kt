package com.bawa.wallet.ui

// Vendored from Tether WDK Starter (Apache-2.0, pin a4fa2172):
// ScreenHeader, NetworkPill, TestnetBadge, PrimaryButton,
// OutlineActionButton, QrCodeImage, ActionCard, AssetRow.
// REMOVED: SeedWordCell and SeedInputCell — the starter never
// handles mnemonics. No other behaviour changed.
//
// Added in the Phase 2 layout makeover (Bawa originals, not copies):
// ChainAvatar, FixedBottomActionBar, DetailActionBar.
//
// Added in Step 3 (data layer): ChainLogo — the bundled real logo for
// a chain (assets/icons/chains/*.webp, Trust Wallet Assets, MIT),
// falling back to the letter-disc ChainAvatar when the asset is
// missing or undecodable. Never a wrong chain's mark.
//   - FixedBottomActionBar: Rabby Mobile's fixed bottomContainer —
//     the action row pinned to the bottom of home, no tab bar.
//   - DetailActionBar: MetaMask's asset-sticky-actions — Send/Receive
//     pinned to the bottom of the asset detail screen.

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bawa.wallet.core.Chain
import com.bawa.wallet.ui.scanner.encodeQrCode

@Composable
fun ScreenHeader(title: String, onBack: () -> Unit) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 14.dp)
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(34.dp)
                    .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
            ) {
                Icon(
                    Icons.Default.ChevronLeft,
                    contentDescription = "Back",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        }
        Divider(color = MaterialTheme.colorScheme.outline)
    }
}

@Composable
fun NetworkPill(label: String, icon: String, isSelected: Boolean, onClick: () -> Unit) {
    val bgColor = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
    else MaterialTheme.colorScheme.surfaceVariant
    val borderColor = if (isSelected) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.outline
    val textColor = if (isSelected) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.onSurfaceVariant

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp)
    ) {
        Text(icon, fontSize = 12.sp, color = textColor)
        Spacer(Modifier.width(5.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = textColor)
    }
}

@Composable
fun TestnetBadge() {
    Text(
        "Testnet",
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = Color(0xFFFF9800),
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFFFF9800).copy(alpha = 0.15f))
            .padding(horizontal = 12.dp, vertical = 4.dp)
    )
}

@Composable
fun PrimaryButton(title: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = BawaTokens.PrimarySolid,
            disabledContainerColor = Color.Gray
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
    ) {
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun OutlineActionButton(title: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
    ) {
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun QrCodeImage(content: String, size: Int = 200) {
    val bitmap = remember(content) {
        if (content.isEmpty()) null
        else try {
            // Step 5, Lane C: encoded with error correction level M
            // (see ui/scanner/QrCodeCodec.kt), not ZXing's default L.
            val bitMatrix = encodeQrCode(content, size)
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    bmp.setPixel(x, y, if (bitMatrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                }
            }
            bmp
        } catch (_: Exception) { null }
    }

    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "QR Code",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
        )
    } else {
        Box(
            modifier = Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("QR", fontSize = 24.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun ActionCard(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 16.dp)
            .fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = label, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.height(8.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// Chain avatar: a tinted circle with the chain's initial. The tint is
// the chain's standard brand colour (BawaTheme.ChainTint).
@Composable
fun ChainAvatar(chain: Chain, sizeDp: Int = 42) {
    Box(
        modifier = Modifier
            .size(sizeDp.dp)
            .clip(CircleShape)
            .background(ChainTint(chain)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            chain.name.take(1),
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}

// Chain logo: the bundled real logo for a chain id (Step 3 data
// layer, ChainIconResolver.assetPathFor). The WebP decodes natively;
// any failure falls back to a letter disc (fallbackText on
// fallbackColor), so a missing or corrupt asset never breaks the
// row and never shows a wrong chain's mark.
@Composable
fun ChainLogo(
    chainId: String,
    fallbackText: String,
    fallbackColor: Color,
    sizeDp: Int = 42,
    fallbackTextColor: Color = Color.White
) {
    val context = LocalContext.current
    val assetPath = com.bawa.wallet.data.ChainIconResolver.assetPathFor(chainId)
    val bitmap = remember(assetPath) {
        if (assetPath == null) null
        else try {
            context.assets.open(assetPath).use { BitmapFactory.decodeStream(it) }
        } catch (_: Exception) {
            null
        }
    }
    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .size(sizeDp.dp)
                .clip(CircleShape)
        )
    } else {
        Box(
            modifier = Modifier
                .size(sizeDp.dp)
                .clip(CircleShape)
                .background(fallbackColor),
            contentAlignment = Alignment.Center
        ) {
            Text(
                fallbackText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = fallbackTextColor
            )
        }
    }
}

// Logo image for an asset row: the bundled logo for an asset path,
// falling back to the tinted letter disc when the asset is missing
// or undecodable.
@Composable
private fun AssetLogoImage(assetPath: String, iconText: String?, iconColor: Color, name: String) {
    val context = LocalContext.current
    val bitmap = remember(assetPath) {
        try {
            context.assets.open(assetPath).use { BitmapFactory.decodeStream(it) }
        } catch (_: Exception) {
            null
        }
    }
    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
        )
    } else {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(iconColor),
            contentAlignment = Alignment.Center
        ) {
            Text(
                iconText ?: name.first().toString(),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

// Fixed bottom action row (Rabby Mobile bottomContainer pattern):
// pinned to the bottom of the home screen, above the navigation bar
// (navigationBarsPadding = safe area / gesture bar). This replaces
// the web's 5-item bottom nav — Android has no tab bar at all.
// Screens using it must give their scrolling content bottom padding
// of at least 96dp so the last row is never hidden under the bar.
@Composable
fun FixedBottomActionBar(
    onSend: () -> Unit,
    onReceive: () -> Unit,
    onActivity: () -> Unit,
    enabled: Boolean = true
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline)
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        FilledTonalButton(
            onClick = onSend,
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.filledTonalButtonColors(
                containerColor = BawaTokens.PrimarySolid,
                contentColor = Color.White
            ),
            modifier = Modifier.weight(1f).height(48.dp)
        ) {
            Icon(Icons.Default.ArrowUpward, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Send", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
        FilledTonalButton(
            onClick = onReceive,
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.filledTonalButtonColors(
                containerColor = BawaTokens.PrimarySolid,
                contentColor = Color.White
            ),
            modifier = Modifier.weight(1f).height(48.dp)
        ) {
            Icon(Icons.Default.ArrowDownward, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Receive", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
        OutlinedButton(
            onClick = onActivity,
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.weight(1f).height(48.dp)
        ) {
            Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Activity", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// Sticky Send/Receive row for the asset detail screen (MetaMask
// asset-sticky-actions pattern): the two actions stay reachable
// without scrolling back to the top.
@Composable
fun DetailActionBar(
    onSend: () -> Unit,
    onReceive: () -> Unit,
    enabled: Boolean = true
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline)
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        FilledTonalButton(
            onClick = onSend,
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.filledTonalButtonColors(
                containerColor = BawaTokens.PrimarySolid,
                contentColor = Color.White
            ),
            modifier = Modifier.weight(1f).height(48.dp)
        ) {
            Icon(Icons.Default.ArrowUpward, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Send", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
        FilledTonalButton(
            onClick = onReceive,
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.filledTonalButtonColors(
                containerColor = BawaTokens.PrimarySolid,
                contentColor = Color.White
            ),
            modifier = Modifier.weight(1f).height(48.dp)
        ) {
            Icon(Icons.Default.ArrowDownward, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Receive", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun AssetRow(
    iconText: String?,
    iconColor: Color,
    name: String,
    network: String,
    amount: String,
    usd: String,
    // Step 3: bundled logo asset for the row's chain (ChainIconResolver);
    // null keeps the letter disc.
    logoAsset: String? = null
) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 14.dp)
        ) {
            if (logoAsset != null) {
                AssetLogoImage(logoAsset, iconText, iconColor, name)
            } else {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(iconColor),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        iconText ?: name.first().toString(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                Text(network, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(amount, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                Text(usd, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Divider(
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.padding(start = 74.dp)
        )
    }
}
