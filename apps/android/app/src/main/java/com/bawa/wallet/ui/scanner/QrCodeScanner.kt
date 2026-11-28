package com.bawa.wallet.ui.scanner

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FlashlightOff
import androidx.compose.material.icons.filled.FlashlightOn
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Step 5, Lane C — standalone CameraX QR / barcode scanner.
 *
 * Standalone on purpose: Step 6 wires this into Receive / Send
 * navigation. Step 6 calls this composable and handles the scanned
 * text; this file owns only camera + decode.
 *
 * - [onScanned] fires exactly once, with the decoded text, when a
 *   code is recognised. The scanner only reads the text and returns
 *   it; it never sends anything anywhere.
 * - [onError] fires with a human-readable reason when the camera
 *   cannot be used (no camera on the device, binding failure). The
 *   UI also shows the reason on screen; nothing crashes.
 * - Camera permission is requested at runtime with the
 *   activity-compose launcher (no new dependencies). While it is
 *   denied the screen shows an honest message plus a button that
 *   opens the app settings, and a button to ask again.
 * - Torch toggle is shown only when the bound camera reports a
 *   flash unit.
 *
 * On-device camera verification is still open (no device or
 * emulator was available); the decode path is covered by JVM unit
 * tests on [decodeLuminance] / [decodeBarcode], and the camera
 * plumbing by a successful build.
 */
@Composable
fun QrCodeScanner(
    onScanned: (String) -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var permissionRequested by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasPermission = granted
    }

    // Ask once, on first entry, so the user lands straight on the
    // viewfinder when permission is already granted. A denial is
    // not re-asked unprompted — the denied state offers the buttons.
    LaunchedEffect(hasPermission) {
        if (!hasPermission && !permissionRequested) {
            permissionRequested = true
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        if (hasPermission) {
            CameraPreview(
                onScanned = onScanned,
                onError = onError,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp, vertical = 48.dp)
            ) {
                Text(
                    "Camera permission is needed to scan QR codes.",
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "The scanner only reads the code and shows you the address — " +
                        "it never sends anything. Allow the camera, or open settings to turn it on.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(24.dp))
                Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                    Text("Allow camera")
                }
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { context.startActivity(openAppSettingsIntent(context)) }) {
                    Text("Open app settings")
                }
            }
        }
    }
}

private fun openAppSettingsIntent(context: Context): Intent {
    return Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
}

@Composable
private fun CameraPreview(
    onScanned: (String) -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mainExecutor = ContextCompat.getMainExecutor(context)
    val analyserExecutor = remember { Executors.newSingleThreadExecutor() }
    // The PreviewView is created once in remember and handed to
    // AndroidView, so no state is written during composition.
    val previewView = remember {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }

    var camera by remember { mutableStateOf<Camera?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var cameraError by remember { mutableStateOf<String?>(null) }
    var torchOn by remember { mutableStateOf(false) }
    // One-shot guard: the analyser sees the same code on many
    // consecutive frames; only the first hit is reported. Atomic so
    // the analyser thread never writes Compose state.
    val scannedGuard = remember { AtomicBoolean(false) }

    DisposableEffect(lifecycleOwner) {
        onDispose {
            try {
                cameraProvider?.unbindAll()
            } catch (_: Exception) {
                // Unbinding during teardown must never crash.
            }
            analyserExecutor.shutdown()
        }
    }

    LaunchedEffect(lifecycleOwner) {
        val providerFuture = ProcessCameraProvider.getInstance(context)
        providerFuture.addListener(
            {
                try {
                    val provider = providerFuture.get()
                    cameraProvider = provider
                    if (!provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)) {
                        val reason = "No camera available on this device."
                        cameraError = reason
                        onError(reason)
                        return@addListener
                    }
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val analysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { useCase ->
                            useCase.setAnalyzer(analyserExecutor) { image ->
                                analyseFrame(image, scannedGuard) { text ->
                                    // onScanned may touch Compose state:
                                    // always report on the main thread.
                                    mainExecutor.execute { onScanned(text) }
                                }
                            }
                        }
                    provider.unbindAll()
                    camera = provider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis
                    )
                } catch (e: Exception) {
                    val reason = "Could not start the camera: " +
                        (e.message ?: e.javaClass.simpleName)
                    cameraError = reason
                    onError(reason)
                }
            },
            mainExecutor
        )
    }

    Box(modifier = modifier) {
        if (cameraError != null) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp)
            ) {
                Text(
                    cameraError ?: "Camera unavailable.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            AndroidView(
                factory = { previewView },
                modifier = Modifier.fillMaxSize()
            )
            // Framing guide: where to hold the code. Decorative only.
            Box(
                modifier = Modifier
                    .size(240.dp)
                    .align(Alignment.Center)
                    .border(
                        2.dp,
                        MaterialTheme.colorScheme.primary,
                        RoundedCornerShape(16.dp)
                    )
            )
            Text(
                "Point the camera at a QR code",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 32.dp)
            )
            if (camera?.cameraInfo?.hasFlashUnit() == true) {
                IconButton(
                    onClick = {
                        val next = !torchOn
                        try {
                            camera?.cameraControl?.enableTorch(next)
                            torchOn = next
                        } catch (_: Exception) {
                            // A torch failure must not kill scanning.
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(16.dp)
                ) {
                    Icon(
                        if (torchOn) Icons.Default.FlashlightOff else Icons.Default.FlashlightOn,
                        contentDescription = if (torchOn) "Turn torch off" else "Turn torch on",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

/**
 * Decodes one camera frame. The Y plane of a YUV_420_888 frame is
 * the luminance, but its rows may be stride-padded, so each row is
 * copied into a tightly packed array before decoding. Always closes
 * [image], even when decoding throws (the decoder itself never
 * throws — this is belt and braces for the buffer copy).
 */
private fun analyseFrame(
    image: ImageProxy,
    scannedGuard: AtomicBoolean,
    onDecoded: (String) -> Unit
) {
    try {
        if (scannedGuard.get()) return
        val width = image.width
        val height = image.height
        if (width <= 0 || height <= 0) return
        val yPlane = image.planes[0]
        val yBuffer = yPlane.buffer
        val rowStride = yPlane.rowStride
        val packed = ByteArray(width * height)
        yBuffer.rewind()
        for (y in 0 until height) {
            yBuffer.get(packed, y * width, width)
            if (y < height - 1 && rowStride > width) {
                yBuffer.position(yBuffer.position() + (rowStride - width))
            }
        }
        val text = decodeLuminance(packed, width, height)
        if (text != null && scannedGuard.compareAndSet(false, true)) {
            onDecoded(text)
        }
    } catch (_: Exception) {
        // A bad frame is skipped; the next frame is analysed.
    } finally {
        image.close()
    }
}
