# P8b — QR scanner component (Bawa wallet rebuild, Fix Lane 2, Phase 3)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced tsx block per file, path as heading. Output code, not descriptions.

Context: apps/web; jsqr 1.4.0 installed; tests use `// @vitest-environment jsdom`, createRoot + act. Do NOT touch send.tsx — the send flow is Phase 4; the scanner is a standalone component only.

Write apps/web/src/wallet/qr-scanner.tsx + qr-scanner.test.ts:
- `QrScanner({ onScan, onCancel, onError }: { onScan: (text: string) => void; onCancel: () => void; onError: (message: string) => void })`.
- Browser camera: navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }) into a <video autoPlay playsInline muted>; draw frames to a canvas (~10 fps via requestAnimationFrame + time throttle); decode with jsqr(imageData.data, width, height); on a result call onScan ONCE with the text and stop the camera. Cancel button → stop camera, onCancel. Camera denied/absent or jsqr throws → onError with a plain message, camera stopped. Stop all tracks on unmount. If mediaDevices is missing → onError('Camera is not available in this browser.') and render the Cancel button. No new deps.
- Tests: mock navigator.mediaDevices.getUserMedia (resolve a fake stream with getTracks returning [{stop: vi.fn()}]), mock 'jsqr' via vi.mock to return null then {data: 'bitcoin:bc1qtest'}; mock HTMLCanvasElement getContext to return a fake 2d context (getImageData returns {data: new Uint8ClampedArray(4), width: 1, height: 1}, drawImage vi.fn()). Assert: decoded text calls onScan once; Cancel calls onCancel; getUserMedia rejection calls onError; tracks stopped after scan.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only.
