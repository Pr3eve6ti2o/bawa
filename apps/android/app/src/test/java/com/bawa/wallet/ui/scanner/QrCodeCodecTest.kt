package com.bawa.wallet.ui.scanner

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Step 5, Lane C — JVM unit tests for the QR encode/decode path.
 * Pure ZXing, no Android classes, no Robolectric: the encode side is
 * exactly what QrCodeImage draws, and the decode side is exactly what
 * the CameraX analyser calls ([decodeLuminance]).
 */
class QrCodeCodecTest {

    private val ethAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"

    @Test
    fun qrRoundTripReturnsExactInput() {
        val matrix = encodeQrCode(ethAddress, 256)

        assertEquals(ethAddress, decodeBitMatrix(matrix))
    }

    @Test
    fun qrRoundTripWithUriPayload() {
        val payload = "ethereum:$ethAddress?value=1000000000000000000"

        val matrix = encodeQrCode(payload, 320)

        assertEquals(payload, decodeBitMatrix(matrix))
    }

    @Test
    fun qrUsesErrorCorrectionMNotL() {
        // M and L encode the same payload into different codewords,
        // so their matrices must differ; both must still decode.
        // This pins the programme requirement (M, not ZXing's
        // default L) instead of trusting the encode call alone.
        val lHints = mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.L)
        val lMatrix = com.google.zxing.qrcode.QRCodeWriter()
            .encode(ethAddress, BarcodeFormat.QR_CODE, 256, 256, lHints)
        val mMatrix = encodeQrCode(ethAddress, 256)

        assertNotEquals(lMatrix.toString(), mMatrix.toString())
        assertEquals(ethAddress, decodeBitMatrix(lMatrix))
        assertEquals(ethAddress, decodeBitMatrix(mMatrix))
    }

    @Test
    fun code128BarcodeRoundTrip() {
        // The scanner accepts common barcodes as well as QR codes.
        val payload = "HELLO-12345"
        val matrix = MultiFormatWriter()
            .encode(payload, BarcodeFormat.CODE_128, 300, 100)

        assertEquals(payload, decodeBitMatrix(matrix))
    }

    @Test
    fun luminanceDecodeRoundTrip() {
        // The exact function the CameraX analyser calls, fed with a
        // packed Y-plane built from a generated M-level code.
        val matrix = encodeQrCode(ethAddress, 256)
        val width = matrix.width
        val height = matrix.height
        val luminance = ByteArray(width * height)
        for (y in 0 until height) {
            for (x in 0 until width) {
                luminance[y * width + x] = if (matrix[x, y]) 0.toByte() else 255.toByte()
            }
        }

        assertEquals(ethAddress, decodeLuminance(luminance, width, height))
    }

    @Test
    fun blankWhiteImageReturnsNullNotCrash() {
        val pixels = IntArray(200 * 200) { 0xFFFFFFFF.toInt() }

        assertNull(decodeBarcode(pixels, 200, 200))
    }

    @Test
    fun blankBlackImageReturnsNullNotCrash() {
        val pixels = IntArray(200 * 200) { 0xFF000000.toInt() }

        assertNull(decodeBarcode(pixels, 200, 200))
    }

    @Test
    fun blankLuminanceReturnsNullNotCrash() {
        val luminance = ByteArray(200 * 200) { 255.toByte() }

        assertNull(decodeLuminance(luminance, 200, 200))
    }

    @Test
    fun badDimensionsReturnNullNotCrash() {
        assertNull(decodeBarcode(IntArray(0), 0, 0))
        assertNull(decodeBarcode(IntArray(10), 100, 100))
        assertNull(decodeLuminance(ByteArray(0), 0, 0))
        assertNull(decodeLuminance(ByteArray(10), 100, 100))
    }
}
