package com.bawa.wallet.ui.scanner

import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.EncodeHintType
import com.google.zxing.LuminanceSource
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.BitMatrix
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * Step 5, Lane C — pure ZXing encode/decode helpers (no Android
 * imports, so they are unit-testable on the JVM).
 *
 * The scanner only reads an address / QR text and returns it to the
 * caller; it never sends anything.
 */

// The programme requires error correction M (about 15% of codewords
// recoverable), not ZXing's default L (about 7%). Every QR code the
// wallet draws (QrCodeImage) and every code the scanner decodes goes
// through here, so the level is set in exactly one place.
val QrErrorCorrectionLevel: ErrorCorrectionLevel = ErrorCorrectionLevel.M

// Formats the scanner accepts: QR codes plus the barcodes a wallet
// address or payment code might plausibly arrive as.
val AcceptedBarcodeFormats: List<BarcodeFormat> = listOf(
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR
)

/**
 * Encodes [content] as a QR code with error correction level M.
 * Throws IllegalArgumentException for empty content and
 * WriterException when the content does not fit; callers that draw
 * UI must catch (QrCodeImage does).
 */
fun encodeQrCode(content: String, size: Int): BitMatrix {
    val hints = mapOf(EncodeHintType.ERROR_CORRECTION to QrErrorCorrectionLevel)
    return QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
}

private fun decodeSource(source: LuminanceSource): String? {
    return try {
        val hints = mapOf(DecodeHintType.POSSIBLE_FORMATS to AcceptedBarcodeFormats)
        val reader = MultiFormatReader()
        reader.setHints(hints)
        reader.decode(BinaryBitmap(HybridBinarizer(source))).text
    } catch (_: Exception) {
        // NotFoundException (nothing decodable in frame), checksum /
        // format errors, bad dimensions: all mean "no result", never a
        // crash. The camera keeps scanning the next frame.
        null
    }
}

/**
 * Decodes a QR code or barcode from an ARGB pixel array (e.g. a
 * Bitmap's pixels). Returns the decoded text, or null when nothing
 * decodable is present. Never throws.
 */
fun decodeBarcode(pixels: IntArray, width: Int, height: Int): String? {
    if (width <= 0 || height <= 0 || pixels.size < width * height) return null
    return decodeSource(RGBLuminanceSource(width, height, pixels))
}

/**
 * Decodes a QR code or barcode from a packed Y-plane luminance array
 * (one byte per pixel, row-major, no stride padding) — exactly what
 * the CameraX analyser hands over. Returns the decoded text, or null
 * when nothing decodable is present. Never throws.
 */
fun decodeLuminance(luminance: ByteArray, width: Int, height: Int): String? {
    if (width <= 0 || height <= 0 || luminance.size < width * height) return null
    return decodeSource(
        com.google.zxing.PlanarYUVLuminanceSource(
            luminance, width, height, 0, 0, width, height, false
        )
    )
}

/**
 * Decodes a [BitMatrix] (e.g. one produced by [encodeQrCode]) back to
 * text. Convenience for tests and for verifying the encode path;
 * the camera path uses [decodeLuminance] instead. Returns null when
 * nothing decodable is present. Never throws.
 */
fun decodeBitMatrix(matrix: BitMatrix): String? {
    val width = matrix.width
    val height = matrix.height
    val pixels = IntArray(width * height)
    for (y in 0 until height) {
        for (x in 0 until width) {
            pixels[y * width + x] =
                if (matrix[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
        }
    }
    return decodeBarcode(pixels, width, height)
}
