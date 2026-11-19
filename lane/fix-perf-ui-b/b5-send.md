# B5 — Send (+ review / confirm) spec (Lane B, fix-perf-ui-b)

Model: gpt-6.1-sol, API 1, max reasoning. One flow only. Output a
Markdown spec section of at most 700 words. Use en-GB spelling.

## Verified facts (use ONLY these sources; anything else, mark UNCERTAIN)

Current flow, read first-hand at branch panel-rebuild/fix-perf-ui-b (base
f9512b4):
- `apps/web/src/screens/send.tsx` (533 lines): multi-step flow —
  chain, then recipient (+ QR scanner), then amount/fees, then review
  (`send-review.tsx`, 99 lines), then offline sign, then result.
  Broadcast is DISABLED until separately authorised: after review the
  button is "Sign offline", never "Send"; the result step shows the signed
  payload with a copy action. Recipient step validates the address and
  offers a QR scanner; amount step runs a fee preview
  (`previewSendAmount`) with a "Checking…" busy state and shows the
  preview failure reason inline; review shows destination, asset, amount,
  fee and total plus a fee note; the user can go back from review to
  amount. Defects: visual only — step order and states are right, but
  there is no step indicator showing where the user is in the flow; no
  new-address warning; no insufficient-funds-for-fees treatment is
  specified in the UI copy; no gas-reserve concept is surfaced; colours
  are hardcoded hex values, not tokens.
- Design tokens, `apps/web/src/ui/styles/globals.css` (Bawa Balanced):
  --primary rgb(98 88 217), --primary-hover rgb(82 72 192),
  --background rgb(244 246 251), --card rgb(255 255 255),
  --foreground rgb(27 39 66), --muted-foreground rgb(100 113 140),
  --border rgb(214 222 237), --ring rgb(139 124 255),
  --warning (orange) tokens and --destructive rgb(243 99 111) exist,
  Inter font. Components available: Button, Input, Label, Alert,
  StepCard, Card, skeleton.

Pattern sources (all verified first-hand 2026-11-19, HTTP 200, unless
noted):
- MetaMask, `MetaMask/metamask-extension`,
  `ui/pages/confirmations/components/send/amount-recipient/
  amount-recipient.tsx`: ONE Amount + Recipient step — asset picker,
  network filter, recipient input with validation, an address-poisoning
  alert and a confusable-name check, amount input with validation and an
  unreliable-RPC warning. Only then a separate confirmation screen (the
  confirmations flow) with fee preview. Custom ConsenSys licence,
  non-commercial only — patterns only.
- Rabby, `RabbyHub/Rabby`, `src/ui/views/SendToken/index.tsx`: chain
  first (ChainSelectorInSend), TokenAmountInput (amount + Max button),
  GasLevel selector, SendReserveGasPopup, recipient via AddressInfoTo,
  recipient risk check (useAddressRisks, RiskType, sorted findings),
  confirm via DirectSignToConfirmBtn. `src/ui/views/Approval/` — 172
  component files driven by a security engine: the approval screen shows
  transaction simulation, estimated balance changes, and security/risk
  findings BEFORE signing. Licence MIT with brand reservation — patterns
  only.
- Phantom Help Center article "Send tokens from Phantom" (verified
  2026-11-18): recipient field accepts a username or wallet address, a
  QR-code icon scans an address, or pick from recently used / saved
  contacts / own accounts. Before sending: check the recipient's network,
  keep enough native token for fees, and review address warnings —
  "Phantom may warn you when sending to a new address. Continue only if
  you are sure the address is correct." Transactions are irreversible.
  App code is not public — vendor docs only.
- Trust Wallet's consumer apps are closed-source; no app send screen
  exists to cite. Do not cite one.

## Task

Write the spec section for ONE flow: Send (chain, recipient, amount,
review/confirm, sign, result). Give: Primary pattern + exact source;
Layout per step (top-to-bottom order, including a step indicator);
Spacing / sizing / typography (px values, font sizes and weights);
Colour (token names from globals.css ONLY — never invent a hex value;
where the dark panel needs a token that does not exist yet, name it
NEW-TOKEN and say which existing shell colour it takes from); Behaviour
+ states per step (validation, new-address / poisoning / risk warnings,
  Max, fee estimate labelled as an estimate, fee-reserve handling, what
  the review screen must show, what each result state — signed,
  failed, pending — shows, and what happens on Back at each step);
REMOVE (what to delete from the current flow).

## Hard rules

- Broadcast is DISABLED and stays disabled: the flow ends at offline
  signing and the result step. Never spec a "Send" / broadcast button,
  a submitted-to-network state, or an on-chain confirmation state as if
  broadcast existed. Submission is not proof of confirmation in any case.
- Do not invent repo paths, file names, pixel values from a real wallet,
  fee numbers, or Trust Wallet app screens. If a detail is not in the
  facts above, write "not specified — Lane C to confirm" instead.
- Do not copy any third-party code, text, branding or assets. Patterns
  only, re-implemented in our own code. No demo or fake data, no testnet.
  en-GB.
