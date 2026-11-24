# Scan QR fix (2026-11-24)

Owner report 2026-11-24 ~04:52 IST: "scan Qr is not working find the
cause and find the fix from where you found it from and find a fix and
fix it." The diagnosis was delivered as Lane 7 of the token programme
(see [TOKEN-EVERYWHERE-PROGRAMME.md](TOKEN-EVERYWHERE-PROGRAMME.md));
the owner gave the explicit go-ahead to execute it 2026-11-24 ~13:18 IST
("Yes, run the Scan QR fix").

Agent: hands-on Muse, **0 Sol calls**. Branch `panel-rebuild/scan-qr-fix`,
commit `b59d1f4` (on token-gaps `047232e`). Merged into
`panel-rebuild/token-gaps` as merge commit `2e8f128` (the scan branch was
based on 047232e and the agent had test-merged 89a5804 cleanly — the real
merge auto-merged send.tsx with no conflicts) and pushed — token-gaps
`2e8f128`, verified by fresh ls-remote. Orion reviewed the diff and the
CDP screenshots first-hand, ran tsc 0 + qr-scanner/send-scan tests
(14 passed) on the branch tree, and tsc 0 + qr-scanner/send-scan/send
tests (41 passed) on the merged tree.

## The cause (reproduced in CDP before fixing, exactly as Lane 7 diagnosed)

1. **Primary:** `handleScan`'s plain-address fallthrough (`send.tsx`) set
   the recipient and validated it but never advanced the step — and the
   recipient/amount inputs only render on the details step. Scanning a
   bare-address QR from the chain step closed the scanner with nothing
   visibly changed. Reproduced at 390 and 1440: still "Step 1 of 6:
   Chain", recipient not visible, no note. (Payment-URI scans already
   worked — Step 3 with Base/USDC/25/recipient — and still do.)
2. **Secondary:** `qr-scanner.tsx` `start()` made one
   `getUserMedia({video:{facingMode:'environment'}})` attempt with no
   fallback; every failure collapsed into the generic "Camera access was
   denied or is unavailable."; a `play()` rejection was swallowed, so
   decoding never ran and the panel waited silently.

## The fix (4 files, +231/−16)

- `send.tsx`: the plain-address fallthrough now calls
  `setStep('details')` after setting the recipient (a no-op when the
  scan already happened on the details step). The stale comment claiming
  "there is no step to advance to" is corrected.
- `qr-scanner.tsx`: `start()` retries once with `{video:true}` on
  `OverconstrainedError`/`NotFoundError` (a permission denial is not
  retried); new exported `cameraErrorMessage()` distinguishes
  `NotAllowedError` ("Camera access was denied. Allow the camera, or
  upload a QR image instead.") from `NotFoundError` ("No camera was
  found on this device. Upload a QR image instead."); a `play()`
  rejection is surfaced as "The camera preview could not start. Upload
  a QR image instead." (unless the component unmounted); the no-camera
  message also points at the upload fallback. The upload button itself
  was already present — the messages now point at it.
- Tests: 1 new test in `send-scan.test.tsx` (bare-address scan from the
  chain step lands on Step 3 with the recipient prefilled, amount empty)
  + 4 new tests in `qr-scanner.test.tsx` (retry on OverconstrainedError
  with exactly 2 calls and the right constraints; denied → 1 call +
  upload-pointing message; NotFound → 2 calls + "No camera was found";
  play() rejection → preview-failure message).

## Gates (Node 22)

tsc **0** · build **0** (palette audit passed) · **vitest 1,949 passed /
5 skipped / 0 failed (94 files)** — baseline 1,944 + 5 new · eslint **0**.

## CDP verification (skill followed, screenshots viewed by eye)

- **Before** (dist `index-DS-ingCT.js`, sha `8cddf46a`, served :4295,
  hash-verified): bare-address scan → Step 1 unchanged, recipient
  invisible (390 + 1440); camera denied → generic message.
- **After** (dist `index-Bfn_q8dX.js`, sha `ce8ae1ac`, served :4296,
  hash-verified): bare-address scan → **Step 3 details, recipient
  prefilled, amount empty** (390 + 1440); payment-URI scan unchanged;
  camera denied → **"No camera was found on this device. Upload a QR
  image instead."**; fake camera → 1 `getUserMedia` call with
  `facingMode:'environment'` (accepted first try), no failure message,
  video playing 640×480 with a live stream (green test pattern visible).

## Honest limits — state these plainly

1. **The live camera on a real phone is NOT proven.** The VM has no real
   camera. The fake-camera CDP proves the camera starts and plays; the
   retry is proven by unit test only. The owner must confirm the live
   camera on their phone.
2. **A bare address is validated against the currently selected chain.**
   In CDP the default chain is Bitcoin, so scanning an ETH address lands
   on details with the recipient prefilled **and** an "Invalid Bitcoin
   address" error — visible and honest, and the recipient stays filled
   if the user goes back and picks Ethereum. Chain auto-detection from a
   bare address is NOT implemented (a `0x…` address is valid on all 16
   EVM chains, so there is no single right chain to pick). Possible
   follow-up if the owner wants it.
3. **The retry was not exercised in CDP** — the fake device accepted
   `facingMode:'environment'` on the first attempt. The retry branch is
   unit-test-proven only.

## Skills read

- `cdp-visual-verification` (full) and `order-traceability-checklist`
  (head; this is a single fix, not a multi-order reverify).
