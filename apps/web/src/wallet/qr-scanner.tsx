import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/components/button';

type JsQR = typeof import('jsqr').default;

// Lane C (bundle-size gate): jsQR (130 KB) loads on demand — on
// the first decode, not at boot. The scanner chunk is separate
// from the send chunk; the camera loop and the image upload both
// go through decodeQrImageData, so one cached import covers both.
let jsQRPromise: Promise<JsQR> | null = null;
function loadJsQR(): Promise<JsQR> {
  jsQRPromise ??= import('jsqr').then((module) => module.default);
  return jsQRPromise;
}

export interface QrScannerProps {
  /** Called exactly once, with the decoded QR payload. */
  onScan: (value: string) => void;
  onCancel: () => void;
}

/**
 * Decode raw RGBA pixels into a QR payload, or null when no code is
 * found. The camera loop and the image upload share this step.
 */
export async function decodeQrImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<string | null> {
  const jsQR = await loadJsQR();
  return jsQR(data, width, height)?.data ?? null;
}

/**
 * Decode a QR code from an image file (PNG/JPEG), for devices without a
 * camera — desktops, and the headless check. Returns null when the file
 * cannot be read, is not an image, or holds no QR code.
 */
export async function decodeQrImageFile(file: File): Promise<string | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return decodeQrImageData(image.data, image.width, image.height);
      } finally {
        bitmap.close();
      }
    }
    // Fallback for browsers without createImageBitmap.
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('unreadable image'));
        element.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return decodeQrImageData(pixels.data, pixels.width, pixels.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

/**
 * Camera failure, in the user's words, always pointing at the
 * image-upload fallback — the scanner must never be a dead end.
 * A permission denial names the denial; a missing camera names that;
 * anything else falls back to the generic wording.
 */
export function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Camera access was denied. Allow the camera, or upload a QR image instead.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No camera was found on this device. Upload a QR image instead.';
  }
  return 'Camera access was denied or is unavailable. Upload a QR image instead.';
}

/**
 * Browser camera QR scanner, wired into the send flow (send.tsx scan
 * buttons on the chain step and the details step; the decoded value
 * fills the recipient and prefills the whole payment for a
 * payment-request URI or a Bawa send link). Follows the BlueWallet
 * ScanQRCode contract: a decoded value and a cancel action. Decodes at
 * ~10 fps from the camera frame via an off-screen canvas and jsQR.
 * When the camera cannot start, the panel stays open with the failure
 * note and an image-upload fallback instead of closing — a desktop
 * without a camera can still scan from a file. The rear camera is
 * tried first; when the device cannot satisfy that constraint the
 * scanner retries once with any camera (Lane 7: a single attempt was
 * a silent dead end on devices with no rear camera).
 */
export function QrScanner({ onScan, onCancel }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannedRef = useRef(false);
  const callbacksRef = useRef({ onScan });
  callbacksRef.current = { onScan };
  const [scanned, setScanned] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastRun = 0;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage(
          'Camera is not available in this browser. Upload a QR image instead.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch (error) {
        // The rear camera is not available on this device, or the
        // constraint cannot be satisfied — retry once with any camera
        // before giving up. A permission denial is not retried.
        if (
          error instanceof DOMException &&
          (error.name === 'OverconstrainedError' ||
            error.name === 'NotFoundError')
        ) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
            });
          } catch (retryError) {
            setCameraMessage(cameraErrorMessage(retryError));
            return;
          }
        } else {
          setCameraMessage(cameraErrorMessage(error));
          return;
        }
      }
      const video = videoRef.current;
      if (!video || cancelled) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        if (cancelled) return;
        // The camera started but the preview could not play — without a
        // playing video the decode loop sees no frames (videoWidth stays
        // 0), so say so instead of waiting silently.
        setCameraMessage(
          'The camera preview could not start. Upload a QR image instead.',
        );
        return;
      }

      const loop = (now: number) => {
        if (cancelled || scannedRef.current) return;
        raf = requestAnimationFrame(loop);
        if (now - lastRun < 100) return; // ~10 fps
        lastRun = now;
        const canvas = canvasRef.current;
        if (!video.videoWidth || !video.videoHeight || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // The decoder loads on demand (see loadJsQR above); the
        // scan callback fires when it resolves, guarded by the
        // same flags.
        void decodeQrImageData(image.data, image.width, image.height).then(
          (code) => {
            if (cancelled || scannedRef.current || !code) return;
            scannedRef.current = true;
            setScanned(true);
            callbacksRef.current.onScan(code);
          },
        );
      };
      raf = requestAnimationFrame(loop);
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleUpload(file: File | undefined): Promise<void> {
    if (!file || scannedRef.current) return;
    setUploadMessage(null);
    const value = await decodeQrImageFile(file);
    if (scannedRef.current) return;
    if (value) {
      scannedRef.current = true;
      setScanned(true);
      callbacksRef.current.onScan(value);
    } else {
      setUploadMessage('No QR code found in that image. Try another image.');
    }
  }

  return (
    <div className="space-y-4">
      {/* Redesign Lane 3 (Send): the preview is 16:9 and cropped, not
          full-width at the camera's own aspect — unconstrained it ran
          to ~500 px tall on a phone and pushed the status line and the
          Cancel / Upload buttons below the fold. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="aspect-video w-full rounded-bawa-sm bg-ink object-cover"
        aria-label="Camera preview"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <p role="status">
        {scanned
          ? 'Code scanned.'
          : (cameraMessage ?? 'Point the camera at a QR code…')}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="outline" asChild>
          <label>
            Upload a QR image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                void handleUpload(event.target.files?.[0])
              }
            />
          </label>
        </Button>
      </div>
      {uploadMessage && (
        <p role="alert" className="text-sm text-ink bawa-squiggle-underline">
          {uploadMessage}
        </p>
      )}
    </div>
  );
}
