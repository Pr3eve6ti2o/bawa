# B3a — Dashboard spec (Lane B, fix-perf-ui-b)

Model: gpt-6.1-sol, API 1, max reasoning. One screen only. Output a
Markdown spec section of at most 600 words. Use en-GB spelling.

## Verified facts (use ONLY these sources; anything else, mark UNCERTAIN)

Current screen, read first-hand at branch panel-rebuild/fix-perf-ui-b (base
f9512b4):
- `apps/web/src/screens/dashboard.tsx` (350 lines): sr-only "Portfolio"
  heading; balance hero — label "Portfolio balance" 13px, hero value
  text-2xl (24px) bold, an honest "No price feed connected — portfolio
  total unavailable" line, and a Refresh/Retry outline button; the hero
  holds its last settled text while refreshing and never renders an error
  as zero. Action row: 3 icon + label buttons (Send, Receive, Activity) —
  56px circles, 24px icons, 11px labels. Tabs: Tokens / Activity in a
  pill container (keyboard: arrows/Home/End). Activity tab: recent
  transactions, date + status, amount, per-chain "history unavailable"
  boxes with Retry. Bottom of the screen still shows lock / no-vault
  banner boxes ("Locked — derived addresses are hidden", "No wallet yet")
  with Unlock / Create / Import buttons. Defects: hero is 24px (small for
  a balance hero); no fiat total (honest — no price feed exists); lock and
  no-vault banners sit on the home screen instead of being separate
  screens; colours are hardcoded hex values, not tokens.
- App shell: 430px panel; header has wallet icon, "Bawa Web Wallet",
  "Account 01" link, Mainnet pill.
- Design tokens, `apps/web/src/ui/styles/globals.css` (Bawa Balanced):
  --primary rgb(98 88 217), --background rgb(244 246 251),
  --card rgb(255 255 255), --foreground rgb(27 39 66),
  --muted-foreground rgb(100 113 140), --border rgb(214 222 237),
  --ring rgb(139 124 255), --success-text rgb(34 142 66),
  --destructive rgb(243 99 111), Inter font. Components available:
  skeleton, tabs, Button, Card, chip.

Pattern sources (all verified first-hand 2026-11-19, HTTP 200):
- MetaMask, `MetaMask/metamask-extension`, `ui/pages/home/home.tsx` (307
  lines): home body is AccountOverview, then notifications, with the
  connection bar pinned at the bottom. `account-overview-layout.tsx`
  order: NetworkConnectionBanner, hero balance, MoneyAccountBalance,
  Carousel, AccountOverviewTabs. Tabs are Tokens / NFTs / DeFi / Activity.
  Cached balance is shown while a fresh one loads (`isBalanceCached`).
  Custom ConsenSys licence, non-commercial only — patterns only.
- Rabby, `RabbyHub/Rabby`,
  `src/ui/views/Dashboard/components/BalanceView/BalanceView.tsx`:
  BalanceLabel (fiat total), ChainList (per-chain breakdown rows — chain
  logo + name + USD value, sorted by value descending), CurveView,
  ZeroAssets (zero state). Loading rule: balance-nil (nothing cached)
  shows loading UI; refresh-with-cache keeps showing the cached balance
  (`shouldShowBalanceLoading`). No global network selector governs the
  portfolio — multichain by default. Licence MIT with brand reservation
  — patterns only, no Rabby branding or code.
- Phantom (Help Center, verified 2026-11-18): fiat portfolio total first;
  zero balance shows an honest $0.00 with Receive/Buy available. App code
  is not public — patterns from vendor docs only.

## Task

Write the spec section for: Dashboard (hero, actions, tabs, activity).
Give: Primary pattern + exact source; Layout (top-to-bottom order);
Spacing / sizing / typography (px values, font sizes and weights —
including a hero size that is actually a hero); Colour (token names from
globals.css ONLY — never invent a hex value; where the dark panel needs a
token that does not exist yet, name it NEW-TOKEN and say which existing
shell colour it takes from); Behaviour + states (loading / zero / error /
cached-while-refreshing, tap targets, what tap does); REMOVE (what to
delete from the current screen, including the home-screen lock/no-vault
banners).

## Hard rules

- Do not invent repo paths, file names, pixel values from a real wallet,
  fiat values, prices or percentages. There is NO price feed: never spec
  a fiat total, unit price or percent change as if priced data existed —
  say exactly what the hero shows instead, and what appears if a feed is
  added later.
- Do not copy any third-party code, text, branding or assets. Patterns
  only, re-implemented in our own code. No demo or fake data, no testnet,
  no broadcast. en-GB.
