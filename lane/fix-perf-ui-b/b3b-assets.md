# B3b — Asset list / asset detail spec (Lane B, fix-perf-ui-b)

Model: gpt-6.1-sol, API 1, max reasoning. One screen group only. Output a
Markdown spec section of at most 600 words. Use en-GB spelling.

## Verified facts (use ONLY these sources; anything else, mark UNCERTAIN)

Current screens, read first-hand at branch panel-rebuild/fix-perf-ui-b (base
f9512b4):
- `apps/web/src/screens/asset-rows.tsx` (125 lines) + `asset-list.tsx`
  (48 lines): one row per chain (BTC/ETH/TRX/TON), never per token. Avatar
  is a 40px circle in the chain colour with the ticker text ("BTC") and a
  small badge bottom-right that repeats the SAME ticker — the badge
  duplicates the chip. Row text: symbol line is the chain display name,
  second line is "BTC · Bitcoin mainnet" (network text where a balance
  belongs), value is the native amount only, no fiat. States are honest:
  loading shows a 68px skeleton row; error shows "Balance unavailable" /
  "Could not load balance" with a Retry button; zero shows "Zero balance".
  Rows tap through to `/assets/<chain>`. The Tokens tab also has a bare
  "Hide zero balances" checkbox (see dashboard).
- `apps/web/src/screens/asset-detail.tsx` (275 lines): per-chain detail.
- `apps/web/src/ui/components/asset-row.tsx`: props avatar, symbol,
  amount, value, detail, detailColor; symbol 16px semibold, amount 14px
  muted, value 16px semibold.
- Design tokens, `apps/web/src/ui/styles/globals.css` (Bawa Balanced):
  --primary rgb(98 88 217), --background rgb(244 246 251),
  --card rgb(255 255 255), --foreground rgb(27 39 66),
  --muted-foreground rgb(100 113 140), --border rgb(214 222 237),
  --ring rgb(139 124 255), --success-text rgb(34 142 66),
  --destructive rgb(243 99 111), Inter font. Components available:
  skeleton, Button, Card, asset-row, holding-card, chip, badge.

Pattern sources (all verified first-hand 2026-11-19, HTTP 200):
- MetaMask, `MetaMask/metamask-extension`,
  `ui/components/app/assets/token-list/token-list.tsx`: rows are TokenCell
  with tap to detail; loading returns skeleton rows, not a spinner over
  the list; a LowValueAssetsToggle collapses dust; a real empty state
  exists. TokenCell cells: title (name/symbol), primary (token balance),
  secondary (fiat value), price (unit price), percent-change. Custom
  ConsenSys licence, non-commercial only — patterns only.
- Rabby, `RabbyHub/Rabby`, `src/ui/views/CommonPopup/AssetList/
  TokenItem.tsx`: 32px token logo with the chain logo as a small badge
  overlaid bottom-right, symbol, protocol name, amount, USD value, and
  per-row quick Send/Swap buttons; `TokenListEmpty.tsx` and
  `TokenListViewSkeleton.tsx` exist. Licence MIT with brand reservation
  — patterns only, no Rabby branding or code.
- Phantom (Help Center, verified 2026-11-18): row tap opens the asset
  detail, which owns Send/Receive/Swap for that asset. App code is not
  public — vendor docs only.
- Trust Wallet `trustwallet/assets` (MIT): native chain logos exist at
  `blockchains/<bitcoin|ethereum|tron|ton>/info/logo.png` (plus
  `square_logo.png` and `info.json`), verified 2026-11-19. These MAY be
  reused with MIT attribution — name the licence when citing them.

## Task

Write the spec section for: Asset list + Asset detail. Give: Primary
pattern + exact source per screen; Layout (top-to-bottom order); Spacing
/ sizing / typography (px values, font sizes and weights — including what
replaces the duplicated ticker badge, and how the hide-zero/dust control
should look instead of a bare checkbox); Colour (token names from
globals.css ONLY — never invent a hex value; where the dark panel needs a
token that does not exist yet, name it NEW-TOKEN and say which existing
shell colour it takes from); Behaviour + states (loading / zero / error,
tap targets, what tap does, per-chain breakdown placement); REMOVE (what
to delete from the current screens).

## Hard rules

- Do not invent repo paths, file names, pixel values from a real wallet,
  fiat values, prices or percentages. There is NO price feed: never spec
  a fiat value, unit price or percent change as if priced data existed —
  say exactly what rows show instead.
- Do not copy any third-party code, text, branding or assets, except the
  MIT Trust Wallet asset logos named above (with attribution). Patterns
  only otherwise. No demo or fake data, no testnet, no broadcast. en-GB.
