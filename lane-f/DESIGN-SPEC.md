# Lane F — Desktop Layout: Design Spec (as built)

Branch `panel-rebuild/desktop-layout`, base multichain-create `40d8cc5`.
Date: 2026-11-20. Model: gpt-6.1-sol, API 1, max reasoning (spec + sidebar
component). AppLayout, dashboard extraction, track/create grids, image
optimisation and verification assembled hands-on and verified first-hand.

## Design authority

- **Direction: Bawa Balanced (direction-04)** from the UI/UX catalogue
  (`bawa-ui-ux-catalogue/docs/UI-UX-CATALOGUE.md`, STYLE-04): Phantom
  structure + Rabby review discipline + Bawa Balanced tokens. No new
  colours, fonts or tokens — everything reuses `globals.css` panel tokens.
- Repo spec: `apps/web/UI-UX-REFERENCE.md` §1/§1.2/§4 updated by this lane
  (the 430px-shell wording replaced with the responsive shell).

## Reference wallets — pattern attributions (structure only, no assets/text copied)

- **Rabby** (rabby.io + extension, DeBank-style): total balance first,
  action grid directly below, unified multi-chain dashboard, approvals /
  security shortcuts visible from home. Taken: balance-first hero,
  Send/Receive/Activity action row, all 14 destinations reachable from
  the primary navigation (no buried More submenu on desktop).
- **Phantom** (phantom.com, 1280px page width, 72px header): balance at
  top, Tokens/Activity tabs, pill CTAs, single accent, editorial
  restraint. Taken: 1280px content thinking, 72px header/brand height,
  tabbed Tokens/Activity, restrained single-accent sidebar.
- **OKX Wallet web** (web3.okx.com): top navigation with a Portfolio
  section; one-stop multi-chain/multi-wallet dashboard; PnL analysis as
  a web-only desktop view. Taken: desktop top-level navigation (here a
  sidebar, the app's own pattern) and the idea that desktop shows
  portfolio + activity together.
- **Bitget Wallet**: dashboard shows portfolio balance, asset list,
  recent transactions and quick Send/Receive together; tabs separate
  assets / swap / NFT / discover. Taken: assets + recent activity side
  by side on desktop instead of stacked.

## Breakpoints and frame

Tailwind defaults. Phone <768px: 430px cap, bottom tab bar. Tablet
768–1023px: 896px cap, bottom tab bar. Desktop 1024–1279px: app frame
max 1440px, 224px sidebar, content max 1024px. Wide ≥1280px: content
max 1152px. Gaps 16px phone/tablet, 24px desktop/wide.

## Shell (`src/app/app.tsx` + `src/app/sidebar-nav.tsx`)

- Below lg: the existing phone shell unchanged (430px panel, header,
  bottom tabs Home/Assets/Receive/Send/More, More menu with the same 10
  destinations in the same order).
- At lg+: 1440px flex-row frame; 224px sidebar (`SidebarNav`: 72px
  brand area with logo tile + "Bawa Web Wallet", 14 NavLinks, divider
  after Send, active link = panel-active + 3px accent bar + semibold);
  72px workspace header (account link + Mainnet pill); content frame
  1024px (lg) / 1152px (xl), centred. Only one navigation variant is
  ever visible (`hidden`/`lg:hidden` — display:none, not visual-only).
- Narrow task screens cap at 480px inside the content frame via a
  route check in AppLayout (`/send`, `/receive`, `/security`, `/lock`,
  `/import-wallet`, `/create-wallet`, `/mnemonic-backup`,
  `/assets/<chain>`; `/assets` itself stays full-width). Welcome
  self-caps at 480px in `welcome.tsx` because it also renders on the
  home route (`/` shows the welcome screen when there is no vault).
- More menu (phone): fixed above the bottom bar
  (`bottom-[76px]`, centred, `max-h-[60vh]` scrollable), Escape closes
  it and returns focus to the More button.

## Screens

- **Dashboard**: phone stacks as before. lg: hero + actions share the
  top row (7:5, 2:1 at xl); tabs span both columns; Tokens view shows
  the asset list left and recent activity right (7:5, 2:1 at xl);
  Activity view spans the full lower row. The activity list lives in
  one component (`src/screens/recent-activity.tsx`, extracted verbatim
  from the dashboard) so it is never rendered twice.
- **Create** (`/create`): 1 column phone, 2 columns md, 3 columns xl
  (rows 3/3/1). Working cards' action buttons bottom-align (`mt-auto`).
- **Track** (`/track`): 1 column phone/tablet; lg 7:5, xl 2:1 —
  lookup left, recent-activity-for-an-address right, top-aligned.
- **Welcome / asset detail / send / receive / security / lock /
  import / create-wallet / mnemonic backup**: centred 480px column.
  **Asset list / transactions / wallets / networks**: full content
  frame. No route, label, heading, balance, price, derivation, vault,
  signing or broadcast behaviour changed.

## Performance

- Logos: Trust Wallet PNGs (167,628 bytes total, 128–512px shown at
  40px) re-encoded as 96px WebP quality 85 (23,378 bytes, −86%). The
  original PNGs stay in `src/assets` as canonical sources; imports in
  `token-logo.tsx` point at the WebP files. `decoding="async"` added.
- `vite.config.ts`: `assetsInlineLimit: 0` — Vite's 4 KB default was
  inlining all ten logos as base64 into the first-paint JS chunk
  (+32.5 KB, including 6 ERC-20 logos no screen displays). As files
  they load on demand, only when an asset row renders.
- No new dependencies, no new raster images, no new fonts. The 10.4 MB
  wallet-core WASM stays lazy-loaded off first paint; route chunks stay
  lazy.

## Verification (all first-hand, loopback, cache disabled)

- `tsc --noEmit` 0 errors; vitest 45 files, 564 passed, 1 skipped;
  `npm audit` 0 vulnerabilities; AVOID-list grep 0 hits.
- Headless Chromium 146 (CDP) at 1440×900 and 390×844: home, dashboard
  (locked-vault fixture), create, track, welcome, More-open at 390px.
  Sidebar 224px visible at 1440 with bottom bar hidden; bottom bar
  visible and sidebar hidden at 390; no horizontal overflow anywhere;
  no console errors or exceptions.
- First paint (loopback, cache disabled): home 1440px 320 ms before →
  224 ms after; create 88 → 84 ms; track 80 → 84 ms. First-visit
  network is dominated by the idle WASM warm-up (10.4 MB + 2.9 MB
  glue) in both builds; critical first-paint payload: JS 337.5 → 339.3
  kB, CSS 477.1 → 426.2 kB (gzip 172.4 → 128.5 kB), total dist
  32,885,752 → 32,735,399 bytes.
