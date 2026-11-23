# LANE 7 (marketing-fix) — QR templates: report

Hands-on Muse, 0 Sol calls, 0 AgentRouter calls. Base 71326e1
(token-gaps tip). Worktree: /home/boxd/workspace/bawa-mkt-l7-worktree.
Build served statically (lane-b serve-dir.cjs, serve-root/bawa on
127.0.0.1:4237); served JS hash verified against dist on every run
(final: index-WdAJKnuF.js). CDP scripts: cdp-l7-before.mjs,
cdp-l7-after.mjs. Screenshots + downloaded cards: cdp-l7/.

## What the owner was seeing (verified first-hand in CDP, before)

The template machinery existed in code (QrTemplate, qrTemplates,
smallQrs, tap-to-swap) and the tap-to-swap even worked — but the
owner was right that the templates were not there as asked:

1. Opening Receive shows NO QR at all: step 1 is a network picker
   (22 buttons). The templates live on step 3, two taps away.
2. On the details step the two alternate templates were 40 px
   (spec: 64 px), BELOW the fold at 390 px (row y 786–862,
   viewport 844, sticky tab bar from 770), with no heading naming
   them — the owner sees one QR and nothing hinting two more exist.
3. For a token with no amount typed, the Payment request template
   was a disabled greyed-out "Not available" box — a third of the
   feature visibly missing. (EIP-681 token transfers require an
   amount; the UI never said so.)
4. Minor: the selected template was never named on screen, and if
   a selected payment template lost its value (amount cleared) the
   main QR silently fell back to the address while the selection
   still said payment.

Before screenshots (viewed): cdp-l7/l7-before-landing-390.png,
l7-before-details-native-390.png, l7-before-details-usdc-390.png,
l7-before-after-link-tap-390.png.

## What changed (in place, receive.tsx + qr-card.tsx)

- Small QRs 40 px -> 64 px, with a heading naming the shown
  template: "QR type: Payment request — tap another to switch".
- The amount input moved from above the card to inside the card,
  under the template row (it is the optional refinement that
  enables the payment request for tokens); the QR + its three
  types are now the first thing on the step.
- Payment-unavailable is explained, not a dead box: "Needs
  amount" + "Payment request needs an amount — enter one below."
  for tokens; a TRON hint where TRON has no payment-URI standard.
  Typing an amount enables the template (it becomes the main QR).
- The selected template is clamped to one that has a value, so the
  main QR never disagrees with the named template.
- Removed the duplicated full-address line below the card (the
  address stays on the card, now one line at text-xs).
- "Step 3 of 3" line not rendered on the details step (steps 1–2
  keep theirs) — its 32 px is what the template row needed to sit
  above the fold. QrCard tightened slightly (p-4 -> p-3,
  gap-3 -> gap-1.5); card rows unchanged (QR 192, amount, address,
  token + chain with logos, subline kept).
- The main QR stays 192 px; share/download still sends the card
  for the SELECTED template (qrPngFile serialises the main QR).

## After (verified in CDP, screenshots viewed)

At 390 px, scroll position 0, tab bar top 770:
- ETH native: row 666–762, heading "QR type: Payment request",
  small QRs 64 px, both labels visible. Main QR 192, encodes
  `ethereum:<addr>@1`.
- Tap Share link -> main QR becomes the Bawa send link, heading
  "QR type: Share link". Tap Payment request -> back to the
  `ethereum:` URI. Tap Address -> plain address. All three swaps
  proven by the main QR payload (svg title).
- Downloads decoded with jsqr (the app's own scanner lib): the
  link download decodes to the Bawa send link, the payment
  download to the `ethereum:` URI, the address download to the
  plain address; all three PNGs differ (640x608 card each).
- Base USDC, no amount: payment disabled, "Needs amount", hint
  shown, row 646–742. Typing 25 makes the payment request the
  main QR (`ethereum:<USDC>@8453/transfer?...uint256=25000000`).
- TRON native: payment disabled with the TRON hint, row 630–726.
- BTC native: row 666–762 (longest addresses still fit).
- 1440 px: row 634–730, heading + both 64 px QRs visible.

After screenshots (viewed): cdp-l7/l7-after-details-native-390.png,
l7-after-details-usdc-390.png, l7-after-details-usdc-25-390.png,
l7-after-after-link-tap-390.png, l7-after-details-btc-390.png,
l7-after-details-native-1440.png, l7-after-download-link.png
(downloaded card, viewed).

## Gates

- tsc --noEmit: 0
- vite build + palette audit: pass (final dist index-WdAJKnuF.js)
- vitest src/screens/receive.test.tsx + qr-card.test.tsx: 31 passed
- full vitest suite: 90 files, 1,723 passed, 5 skipped, 0 failed
- eslint (full `npm run lint`): clean
- Root `npm test` (tools/hdwallet-gen smoke): FAILS with
  MODULE_NOT_FOUND in test/smoke.test.js — reproduced identically
  on the untouched baseline 71326e1 (git stash), so pre-existing
  and unrelated to this lane; waived on that evidence.

## Tests added

- receive.test.tsx: swap test now asserts the 64 px small QRs,
  the "QR type:" heading, and the explained disabled payment
  template; new test "enables the payment-request template once a
  token amount is typed" (type 25 -> payment becomes main QR;
  tap away to Address and back proves the swap).

## Open / needs a decision

- Receive still opens on the network picker: the three templates
  are now obvious on the details step (step 3), but nothing about
  them is visible on landing. Surfacing the QR on step 1 would be
  a flow change (the stepped flow is item 20's design), so it was
  NOT done here — flagging to the coordinator/owner whether they
  also want the QR visible before a network + token are picked.

## Skills / repos used

- cdp-visual-verification (custom skill, read in full on the VM):
  hash-verified static serve, viewports 390/1440, state the owner
  is in, every screenshot viewed by eye.
- Prior lanes' CDP harness patterns (bawa-uiux-round2/cdp-item1-check.mjs,
  lane-b serve-dir.cjs) adapted, not rebuilt.
- No public wallet repos mined: the fix is in-place against the
  existing Round 2 QrCard design; no new pattern was needed.
