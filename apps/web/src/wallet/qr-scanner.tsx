import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '../ui/components/button';

export interface QrScannerProps {
  /** Called exactly once, with the decoded QR payload. */
  onScan: (value: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

/**
 * Browser camera QR scanner (Phase 4 preparation — standalone, unwired).
 * Follows the BlueWallet ScanQRCode contract: a decoded value, a cancel
 * action, and an error callback. Decodes at ~10 fps from the camera frame
 * via an off-screen canvas and jsQR. The send flow itself is Phase 4.
 */
export function QrScanner({ onScan, onCancel, onError }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannedRef = useRef(false);
  const callbacksRef = useRef({ onScan, onError });
  callbacksRef.current = { onScan, onError };
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastRun = 0;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        callbacksRef.current.onError('Camera is not available in this browser.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        callbacksRef.current.onError('Camera access was denied or is unavailable.');
        return;
      }
      const video = videoRef.current;
      if (!video || cancelled) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Play interrupted by unmount — the cleanup below stops the stream.
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
        const code = jsQR(image.data, image.width, image.height);
        if (code?.data) {
          scannedRef.current = true;
          setScanned(true);
          callbacksRef.current.onScan(code.data);
        }
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

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full rounded-lg bg-black"
        aria-label="Camera preview"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <p role="status">
        {scanned ? 'Code scanned.' : 'Point the camera at a QR code…'}
      </p>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
