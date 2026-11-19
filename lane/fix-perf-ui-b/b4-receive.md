# B4 — Receive (address + QR) spec (Lane B, fix-perf-ui-b)

Model: gpt-6.1-sol, API 1, max reasoning. One screen only. Output a
Markdown spec section of at most 600 words. Use en-GB spelling.

## Verified facts (use ONLY these sources; anything else, mark UNCERTAIN)

Current screen, read first-hand at branch panel-rebuild/fix-perf-ui-b (base
f9512b4):
- `apps/web/src/screens/receive.tsx` (201 lines): "Receive" heading 24px
  semibold; chain pill row (BTC/ETH/TRX/TON) — selected pill is a violet
  gradient, others are outline; a watch-only Alert when the shown address
  belongs to a watch-only account ("this address can receive, but this
  wallet cannot sign"); a dark-navy card holding a 192px QR on a white
  rounded card, the full address in centred mono 14px with break-all, Copy
  address and Share buttons; for TRX/TON an amount is shown as text beside
  the QR because those chains have no standard payment URI here; an amount
  field below the card ("Amount (optional)") with validation ("Enter a
  valid amount."); BTC encodes a BIP-21 amount and ETH encodes value in
  wei in the QR; a "No receiving address available" empty state links to
  import. Defects: the QR card is dark-navy while the QR itself sits on
  white — two surfaces fighting; the amount field sits BELOW the QR, so
  the QR a user shares can be stale relative to the amount they typed;
  no network warning (the sender must use the selected network even where
  addresses coincide); colours are hardcoded hex values, not tokens.
- Design tokens, `apps/web/src/ui/styles/globals.css` (Bawa Balanced):
  --primary rgb(98 88 217), --background rgb(244 246 251),
  --card rgb(255 255 255), --foreground rgb(27 39 66),
  --muted-foreground rgb(100 113 140), --border rgb(214 222 237),
  --ring rgb(139 124 255), --destructive rgb(243 99 111), Inter font.
  Components available: Alert, Button, chip, Card, bottom-sheet-modal
  (a receive modal is an option if the pattern source says so).

Pattern sources (all verified first-hand, HTTP 200):
- MetaMask, `MetaMask/metamask-extension`,
  `ui/components/multichain/receive-modal/receive-modal.js`: receive is a
  MODAL over the home screen, rendering QrCodeView
  (`ui/components/ui/qr-code-view/`) with the account name and address,
  plus the address-copy control. A dedicated QR modal also exists:
  `ui/components/multichain-accounts/address-qr-code-modal/
  address-qr-code-modal.tsx`. Chain is chosen before the modal opens.
  Custom ConsenSys licence, non-commercial only — patterns only. Verified
  2026-11-19.
- Rabby, `RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx`: QRCode from
  qrcode.react, copy via copyAddress, ChainSelectorModal for the network,
  and a watch-mode alert when the account is watch-only. Same EVM address
  across EVM chains — selecting a network does not generate a different
  address. Licence MIT with brand reservation — patterns only. Verified
  2026-11-19.
- Phantom Help Center article 4406393831187 ("Receive tokens in Phantom",
  verified 2026-11-18): Home tab, Receive, select network, copy button
  copies the address, QR code button displays its QR code. "The sender
  needs your wallet address … and must send the crypto on the same network
  you select in Phantom." QR is behind a QR button — one tap away, not
  always visible. App code is not public — vendor docs only.
- Trust Wallet `trustwallet/assets` (MIT): chain logos at
  `blockchains/<bitcoin|ethereum|tron|ton>/info/logo.png`, verified
  2026-11-19 — MAY be reused with MIT attribution. Trust Wallet's
  consumer apps are closed-source; no app receive screen exists to cite.

## Task

Write the spec section for ONE screen: Receive (address + QR, with the
optional amount). Give: Primary pattern + exact source; Layout
(top-to-bottom order — including where the amount field goes relative to
the QR, and whether receive is a page or a modal); Spacing / sizing /
typography (px values, QR size, font sizes and weights); Colour (token
names from globals.css ONLY — never invent a hex value; where the dark
panel needs a token that does not exist yet, name it NEW-TOKEN and say
which existing shell colour it takes from); Behaviour + states (loading /
zero / error / watch-only, what Copy and Share do, what the sender must
be warned about, what happens when no address exists); REMOVE (what to
delete from the current screen).

## Hard rules

- Do not invent repo paths, file names, pixel values from a real wallet,
  or Trust Wallet app screens. Do not describe an amount-bearing payment
  request for TRX/TON as if a standard URI existed — the facts say it does
  not. If a detail is not in the facts above, write "not specified — Lane
  C to confirm" instead.
- Do not copy any third-party code, text, branding or assets, except the
  MIT Trust Wallet asset logos named above (with attribution). Patterns
  only otherwise. No demo or fake data, no testnet, no broadcast. en-GB.
