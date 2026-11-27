# Bawa — Shared Design System (Redesign Programme, Lane 0)

**Status:** Lane 0 foundation document. **Date:** 2026-11-25.
**Source tree studied first-hand:** `bawa-token-gaps-worktree` at `token-gaps 7fea3e4`
(`apps/web/src/app/app.tsx`, `apps/web/src/app/sidebar-nav.tsx`,
`apps/web/src/ui/styles/globals.css`, `apps/web/src/screens/*`,
`apps/web/src/ui/components/*`, `docs/DECISIONS.md` §24).
**Authority:** owner order — full redesign, both mobile and desktop; the
2026-11-22 mobile UI/UX lock is LIFTED for this programme only.
**Rule for every lane:** this file is the shared foundation. If a section
needs something that contradicts it, do not improvise — record it as an
owner decision and keep building to this file until the owner rules.

**Hands-on, 0 Sol calls.** No Bawa code was changed in this lane, nothing
committed, nothing pushed.

---

## 1. Principles — convenience first

The redesign's one test, applied to every element: **is it where a user
reaches for it, the way real wallet providers put it?** Everything else
follows from that.

1. **Balance first, actions second, detail third.** Every wallet home
   (Bitget, OKX, Coinbase Wallet, MetaMask, Rabby) opens with the total,
   then the four money actions, then the list. Bawa already does this
   (dashboard: Portfolio balance → Send / Receive / Scan / Activity →
   Assets). Keep that order on every screen that shows money; never put
   settings, marketing, or secondary lists above the balance or the
   primary action.
2. **One primary action per screen, in coral, at thumb height.** The
   primary action is the only coral-filled element on its screen. On
   mobile it sits where the thumb rests: bottom of the content or sticky
   above the bottom nav — never at the top, never hidden behind a menu.
3. **No dead controls.** A control that cannot act in the current state
   must not look tappable. No wallet + no amount = show `0` / an honest
   empty state, never a Retry button (standing owner correction; see §9).
4. **Real assets, never placeholders.** Real chain/token logos, real
   balances from a real source, real prices. A missing logo gets the
   redesigned paper-disc fallback — never a yellow square with a ticker,
   never an emoji, never a grey box.
5. **Drawing-illustration style, 4 colours, hard lines.** The app is a
   hand-drawn line drawing on paper: 2 px ink strokes, hard offset
   shadows (no blur), wobbly hand-drawn radii, squiggle underlines.
   Nothing glossy, no gradients, no glass, no purple/blue AI-default
   palettes.
6. **Every screen works at 390 px first.** Mobile is the primary surface
   (the owner judges on their phone). Desktop is the same content laid
   out wider — never a different app.
7. **State is visible, not implied.** Loading = skeleton, never blank.
   Error = inline at the field + a focusable summary, never toast-only.
   Success = confirmed in place with the hash/amount shown. Pending =
   labelled pending, with the hash linkable.

---

## 2. What the current system actually is (recorded, not assumed)

Read first-hand from `globals.css`, `app.tsx`, `sidebar-nav.tsx`,
`button.tsx`, `card.tsx`, and the screens. Lanes build FROM this, they do
not re-invent it.

### 2.1 Colour — the 4-colour cap (hard rule)

| Token | Value | Job — and only that job |
|---|---|---|
| `--bawa-paper` | `#FFFDF7` | Page and every surface/card. |
| `--bawa-ink` | `#2B2B2B` | The ONLY text colour, and every border/line. |
| `--bawa-coral` | `#FF6B4A` | Primary action ONLY (CTA fill, destructive, focus ring, tx-failed marker). Never body text. |
| `--bawa-sun` | `#FFD93B` | Selected / highlight / hover. The current choice, the marker highlight, the action-tile disc. |

All semantic tokens in `globals.css` are aliases onto these four
(`--success`, `--warning`, `--error-text`, `--info`, `--tx-*`, chart
colours, sidebar colours — all paper / ink / coral / sun). Status is
therefore conveyed by **label + icon + position, never by colour alone**:
success, warning, error and info text are all ink; a failed transaction
is coral-marked AND labelled "Failed". Do not re-introduce green/red
status colours — that is an owner decision, not a lane decision.

**Contrast — verified first-hand with the design-auditor
`color_contrast_checker.py` (WCAG AA):**

| Pair | Ratio | Verdict |
|---|---|---|
| Ink `#2B2B2B` on paper `#FFFDF7` | 13.92:1 | Passes AAA normal |
| Ink on sun `#FFD93B` | 10.28:1 | Passes AAA normal |
| Ink on coral `#FF6B4A` | 5.03:1 | Passes AA normal — the ONLY text-on-colour pair allowed |
| Paper on coral | 2.77:1 | **FAILS** — never put paper/white text on coral |
| White `#FFFFFF` on QR teal `#023139` | 13.99:1 | Passes (QR Template A only) |
| QR muted `#7A9491` on QR teal `#023139` | 4.31:1 | **FAILS AA normal** (passes large-text 3:1 only) — inside the QR card, keep muted text large or decorative; never copy this pairing outside the QR card |

### 2.2 The QR-card exception — confined, not a precedent

`docs/DECISIONS.md` §24 records the ONE confined breach of the cap: ten
named `--qr-*` tokens (`--qr-teal #023139`, `--qr-teal-deep #011F29`,
`--qr-teal-band #0E2127`, `--qr-teal-copy #1B2023`, `--qr-bar #121818`,
`--qr-muted #7A9491`, `--qr-grey #6B7280`, `--qr-faint #9CA3AF`,
`--qr-nearblack #111111`, `--qr-white-dim #FFE9E4`). They are used ONLY
by the Receive QR card (`screens/qr-card.tsx`, seven templates A–G,
default B) and its PNG exporter (`wallet/payment-links.ts`,
`DEFAULT_QR_CARD_TEMPLATE = 'b'`). The palette audit allowlists exactly
those ten literals. **No other screen may use them, and no further
literal may be added without a recorded decision in DECISIONS.md.**
If your section needs a new colour, record it as an owner decision —
do NOT silently add it.

### 2.3 Type

- **Display / headings:** Baloo 2 (`--font-display`), weight 600.
  `h1` = 35 px / 36 px lh, `h2` = 30 px / 32 px, `h3` = 25 px / 28 px
  (all `calc(title * 1.25)` in `globals.css`). Headings are the only
  Baloo 2 text; everything else is Inter.
- **Body / UI:** Inter (`--font-sans`), weights 400/500/600/700.
  Fallback stack: `"Inter", "Noto Sans SC" (latin subsets only),
  ui-sans-serif, system-ui, -apple-system, sans-serif`.
- **Mono (addresses, hashes, amounts-as-code):** JetBrains Mono
  (`--font-mono`), fallback `ui-monospace, SFMono-Regular, Menlo`.
- **Type scale in use** (`--text-*`): display-lg 40/48, title-lg 28/36,
  title-md 24/32, title-sm 20/28, body-lg 16/24, body-md 14/20,
  body-sm 13/20, caption 12/16, 2xs 11/16. **Floors (huashu-design
  readability rule, adopted): body ≥ 14 px, labels ≥ 12 px, nothing
  below 11 px anywhere.** The mobile bottom-nav labels are 11 px —
  that is the floor, do not go smaller.
- **iOS zoom rule (already in `globals.css`, keep it):** on coarse
  pointers, `input / textarea / select` are 16 px. Never disable zoom.
- **Tracking:** tight −0.4 px (h1), snug −0.2 px (h2), normal 0 (h3).
- **Line length:** body copy caps with the content column (§4); never
  run body text edge-to-edge on desktop.

### 2.4 Spacing, radii, stroke, shadow, motion

- **Spacing scale:** 4 px base (`--spacing: 0.25rem`). Section rhythm
  16 / 24 / 32 / 48. Density presets already in `globals.css`:
  compact 8×12, comfortable 16×24, spacious 24×32, airy 32×48.
  Use the 8 px rhythm for gaps between touch targets (minimum 8 px
  gap, ui-ux-pro-max `touch-spacing`).
- **Stroke:** `--bawa-stroke: 2px`, `--bawa-border: 2px solid ink`,
  dashed variant for disabled/empty states. **Every card, input,
  button and nav item carries a 2 px ink border.** Borderless controls
  are a defect in this style.
- **Radii (hand-drawn wobble, NOT geometric):**
  `--bawa-radius: 255px 15px 225px 15px / 15px 225px 15px 255px`,
  `--bawa-radius-sm: 15px 225px 15px 255px / 255px 15px 225px 15px`.
  All `rounded-*` theme radii map onto these two. Do not introduce
  geometric radii (8/12/16 px) — except the QR card, whose templates
  own their radii, and `Button size="pill"` (22 px, existing).
- **Shadow:** `--bawa-shadow: 4px 4px 0 ink` — one hard offset, never
  blur, never coloured. Elevation = offset shadow + sun fill, not blur.
- **Motion:** `--duration-fast 150ms`, `--duration-normal 240ms`,
  `--duration-soft 360ms`, `--duration-hero 500ms`;
  `--ease-emphasis: cubic-bezier(0.16, 1, 0.3, 1)`. Press feedback
  80–150 ms (opacity/scale, never layout shift). `active:scale-[0.98]`
  on primary buttons (existing). Respect
  `prefers-reduced-motion: reduce` — the draw/dot animations already
  switch off; any new animation must too.
- **Focus (visible, always):** `:focus-visible` = 2 px ink outline,
  2 px offset; links/buttons additionally get a wavy coral underline.
  Never remove focus rings. Focus order = visual order.
- **Selection:** sun background, ink text (`::selection`).

### 2.5 Touch targets — the rule and the known gap

- **Rule (adopted from ui-ux-pro-max / Apple HIG): primary actions and
  nav items ≥ 44 × 44 px; icon-only controls ≥ 44 px hit area even if
  the visible icon is smaller; ≥ 8 px gap between adjacent targets;
  mobile inputs ≥ 44 px tall.**
- **Known gap lanes must close:** the current `Button` sizes include
  `sm h-8` (32 px), `xs h-7` (28 px), `icon-sm size-8` (32 px). Those
  sizes exist in code; the redesign must not use them for tappable
  controls without expanding the hit area to 44 px. Default usable
  sizes: `hero h-14` (56 px), `lg h-12` (48 px), `default h-10`
  (40 px — acceptable only with 8 px+ gaps and only for secondary
  actions; prefer `lg` for anything money-moving), `icon size-10`
  (40 px — expand hit area to 44 px).
- **No hover-only interaction.** Everything hover does, tap/keyboard
  must also do. `touch-action: manipulation` is already global; keep it.

---

## 3. Components (existing inventory — restyle, don't rebuild)

| Component | File | Current contract — keep it |
|---|---|---|
| Button | `ui/components/button.tsx` | `cva` variants: `default` (coral), `secondary` / `outline` / `ghost` (paper, hover sun), `destructive` (coral), `foreground` (ink fill, paper text), `link` (squiggle underline), `sun`. Disabled = paper fill, ink text, dashed ink border. Sizes per §2.5. |
| Card | `ui/components/card.tsx` | Props `radius` (`bawa` \| `xl`), `tone` (`paper` \| `card`), `padding` (`md` py-6 px-6 \| `sm` p-3). One class per property; 2 px ink border. |
| Input / Label / Switch / Checkbox / Tabs / Dialog / Alert / Badge / Skeleton / Loading / Toast (Sonner) / CopyButton / StepCard / SquiggleDivider | `ui/components/*` | All paper/ink/coral/sun. Inputs: paper bg, 2 px ink border, 16 px on touch. CopyButton is the address-copy pattern — reuse it, don't build a second one. |
| Icons | `ui/components/icons.tsx` (`BawaIcon`) | SVG only, one stroke width per layer (1.5–2 px), one style per hierarchy level. **No emoji as icons, ever** (ui-ux-pro-max pro-rules). Token/chain logos are real image assets via `screens/token-logo.tsx`, never emoji. |
| Squiggle | `.bawa-squiggle-underline`, `.bawa-marker` | Wavy coral underline for active nav + links; sun marker highlight for the hero balance number. Use sparingly — one squiggle per screen region, not per line. |

**New-component rule:** if a section needs a component that does not
exist, build it from these primitives (Card + Button + 2 px border +
bawa radius) rather than importing a new library. The bundle budget
(6,000,000 bytes total JS) forbids new dependencies without an owner
decision.

---

## 4. Layout — breakpoints and shells

### 4.1 Breakpoints (as built — do not renumber)

| Breakpoint | Value | What it does |
|---|---|---|
| Mobile | 390 px (design width), 820 px (large phone / small tablet check) | Phone frame: centred 430 px max-width column (`max-w-[430px]`), bottom tab nav, single column. All E2E viewports include 390 and 820. |
| Shell | **980 px** (`--breakpoint-desktop: 61.25rem`, Tailwind `desktop:` variant) | **Shell only.** Below 980: mobile layout. At/above 980: sidebar + desktop header, bottom nav hidden. This exists because Chrome/Brave force a 980 px viewport in "Desktop site" mode on phones — keying the shell off `lg:` (1024 px) rendered mobile layout on a phone in desktop mode. In-page `lg:` grids stay at 1024 px. |
| Desktop content | 1024 → 1152 (`xl`) → 1440 (`2xl`) | Content column steps `max-w-[1024px]` → `xl:max-w-[1152px]` → `2xl:max-w-[1440px]`. At 1919 px the column caps at 1440 px; the shell itself is full-bleed. |
| Narrow task screens | 480 px cap | `/send`, `/receive`, `/import-wallet`, `/mnemonic-backup`, `/assets/:chain` — one focused column, centred, at every width. `/create-wallet`, `/security`, `/lock` are 480 px below desktop and full content width at desktop (two-column layout). |

### 4.2 Mobile shell (below 980 px)

- **Frame:** centred 430 px column on paper; `sm:` (640 px) it becomes a
  bordered phone card (`rounded-bawa`, 2 px ink border, min-height 720).
- **Header (mobile):** wallet icon tile (36 px, 2 px border) + "Bawa Web
  Wallet" (15 px bold) + account name link (12 px, wavy coral hover) on
  the left; Mainnet/Devnet pill on the right. Height ~72 px total
  (`pt-5 pb-4 px-5`).
- **Bottom nav (mobile):** sticky bottom, `border-t-2 ink`, paper bg,
  `pb-[env(safe-area-inset-bottom)]`. Exactly **5 items** (ui-ux-pro-max
  bottom-nav limit): Home, Assets, Receive, Send, More. Each: 24 px
  icon tile (2 px border; active = sun fill) + 11 px semibold label,
  `py-3`. Active item gets the squiggle underline. Content gets
  `pb-24` so the last ~30 px never slides under the nav.
- **More sheet:** opens above the nav (`bottom-[76px]`, centred,
  `max-w-[398px]`, `max-h-[60vh]`, scrollable, `role="menu"`). Items:
  Wallets, Transactions, Track a transaction, Import wallet,
  Create wallet, Security, Networks, Mnemonic backup, Welcome.
  Escape closes and returns focus to the trigger.
- **Network pill:** sun fill, 2 px ink border, 10 px bold uppercase-ish
  label ("Mainnet" / "Devnet test mode"). It is a BUTTON that toggles
  mode — never a static label. Disabled with no vault.
- **Focused flows hide the nav:** `/send` and `/create-wallet` hide
  both the sidebar and the bottom nav (and take `pb-0`); the desktop
  header stays for account context. Any new focused flow (e.g. a
  multi-step send review) follows the same rule — full attention, one
  job, back is explicit.

### 4.3 Desktop shell (980 px and up)

- **Sidebar:** 224 px expanded / 72 px collapsed (shell-owned width,
  `transition-[width] 200ms`), sticky full-height, `border-r-2 ink`,
  paper. Logo tile (40 px) top; nav list `space-y-1 px-3`; active item
  = sun fill + semibold + coral square marker; hover = sun; collapse
  button in the footer. All 13 routes listed (Home, Assets, Receive,
  Send, divider, then the More links). Collapsed = icons only, labels
  `sr-only`, `title` tooltips.
- **Desktop header:** 72 px, `border-b-2 ink`, `px-6` (`xl:px-8`):
  account name link left ("No wallet" or account ›), NetworkModePill
  right.
- **Content:** `px-5` mobile → `desktop:px-6 desktop:py-6` →
  `xl:px-8`. Two-column grids at `lg:` for dashboard-class screens
  (`lg:grid-cols-[7fr_5fr]`, `xl:[2fr_1fr]`); single 480 px column for
  narrow task screens (§4.1).
- **No horizontal scroll, ever.** `overflow-x-hidden` on the sidebar
  wrapper; content columns are `min-w-0` flex children.

### 4.4 The Bitget reference — what "real wallet providers" means here

Owner-supplied Bitget Wallet Receive screenshot
(`~/workspace/user/media_library/image/1795475406544.jpg`, viewed
first-hand). Its placement, in order, top to bottom:

1. Centred token icon (large, circular, chain glyph + small badge).
2. Title "Receive ETH" (large bold) + one-line network warning
   ("Only supports receiving Ethereum network assets" — network name
   bolded inside the sentence).
3. QR in a rounded card, generous padding, centre mark.
4. Address block BELOW the QR: label "Receiving address", mono
   address (wrapped to 2 lines), copy button at the right edge.
5. "Deposit from Bitget Exchange ›" as a single chevron row.
6. Brand footer ("Bitget Wallet") pinned at the bottom.

**Take from this:** centre the token, title the screen by asset
("Receive ETH", not "Receive"), warn about the network in plain words
directly under the title, QR first and address second with copy beside
it, one exchange/deposit shortcut row, brand quiet at the bottom.
**Do NOT take:** Bitget's dark-teal palette — Bawa's QR Template A is
the only place dark teal exists, and only inside the QR card. The
in-app Receive screen stays paper/ink/coral/sun.

---

## 5. Wallet-provider patterns (from the survey repos — patterns, not code)

Source: `~/workspace/wallet-repos/SURVEY.md` + per-org reports. No
wallet-app repo exists anywhere (Bitget/OKX apps are closed source,
re-confirmed) — these are patterns from docs, SDKs and screenshots.
Licence gate: patterns only where a licence forbids reuse; no verbatim
copying without a licence check.

| Pattern | Source | Bawa placement rule |
|---|---|---|
| Header: logo \| nav \| network \| wallet status | Bitget developer skill `dapp-common-skill/references/layout.md` (modelled on Uniswap/Aave/OpenSea) | Bawa already matches: logo + account left, network pill right, nav below/side. Keep. Multi-chain: chain selector sits directly under the header, never inside settings. |
| Feature card first, secondary content second | Same layout reference | Send/Receive forms are the feature card; history/activity is the secondary card below, never above. |
| Skeleton, never blank | Bitget `ux-patterns.md` (BalanceSkeleton) | Every balance/price/list has a skeleton state. Blank = bug. |
| Toast follows the transaction lifecycle | Bitget `ux-patterns.md` (`sendWithToast`: waiting → submitted → confirmed / failed, hash linked) | Bawa's Sonner toasts already do this; each toast carries the tx hash + explorer link and survives navigation. Pending toasts never auto-close. |
| Empty state = icon + title + description + ONE action | Bitget `ux-patterns.md` | No wallet → "Create wallet" action. No history → no action, just the honest line. No balance → "Receive" action. Never an empty card. |
| Human-readable names in address fields | Bitget `ux-patterns.md` (ENS resolution) | Send's recipient field accepts a pasted address first; name resolution is a future lane, not this programme. |
| Onramp = one button, preset amount, destination address fixed | Coinbase `cbpay-js` README (`PayWithCoinbaseButton`, `presetFiatAmount`) | If a Buy flow ever lands: one "Buy" button beside Send/Receive, amount preset, address pre-filled from the wallet — never a form that re-asks for the address. Owner decision required (needs Coinbase onboarding + keys); not in this programme. |
| WalletConnect = approve / reject, session first | WalletConnect monorepo (sign-client API) | If dApp-connect ever lands: connect is a session request the user approves/rejects explicitly, with the dApp name + requested chains shown before approval. Licence is Reown Community Licence (2.22.0+) — owner decision required. Not in this programme. |
| Backup shares: encrypt first, split the key, never split raw words | Privy `shamir-secret-sharing` (Apache-2.0) | If Shamir backup ever lands: split the vault's AES-GCM key (2-of-3), encode shares as base64/QR, trial-decrypt on combine. Never split mnemonic words. Owner decision required; not in this programme. |
| Clear signing: show the human-readable call before signing | OKX `clear-signing-erc7730-registry` (CC0 1.0) | Send review already shows recipient + amount + network before signing. Any future contract-call screen shows the decoded call in plain words first, hash second. |

---

## 6. Per-section placement guidance (for the section lanes)

Each lane implements its section from this table + §§2–5. "Keep" means
the current placement is already right — restyle it, don't move it.

### Dashboard (`screens/dashboard.tsx`, `/`)
- Keep: Portfolio balance card first (label 13 px medium, hero number
  40 px bold with sun marker, 20 px display subtitle, price-attribution
  + partial-total + error lines in 12 px below). Eye toggle (36 px
  tile) at the card's top-right.
- Keep: 4 action tiles in one row (Send / Receive / Scan / Activity),
  56 px sun disc icon tile + 12 px label, `py-1`, hover sun/50.
  Scan goes to `/send?scan=1`.
- Keep: Assets section below with "Assets" h2 left + controls right;
  asset rows are the list, not cards-per-token.
- Desktop: `lg:grid-cols-[7fr_5fr]` — balance + assets left, secondary
  (recent activity / info) right. Mobile: single column, same order.
- Fix in this programme: "Popular chains" is REMOVED from the homepage
  (owner order, finish-product Lanes G–J). Do not re-add any chain
  marketing strip to the dashboard.

### Assets (`screens/asset-list.tsx`, `asset-detail.tsx`, `asset-rows.tsx`, `/assets`, `/assets/:chain[/:token]`)
- List: one row per asset — logo left (real logo, paper-disc fallback),
  name + ticker, balance + fiat value right. Row height ≥ 56 px, full
  row tappable, chevron or press feedback. Zero balance shows `0`,
  never Retry.
- Detail (`/assets/:chain` is a narrow 480 px screen): token header
  (logo + name + balance), Send / Receive actions immediately under
  the header, then holdings / transactions. The sticky Refresh on
  `/assets/btc` stays (existing test design) — flag it if the owner
  calls it dead, don't remove silently.
- Search/filter: the visible Filters panel is a feature (owner) — keep
  it on the list, restyle around it, never remove it.

### Send (`screens/send.tsx`, `send-review.tsx`, `/send`)
- Focused flow: nav hidden (§4.2). Steps, in order, one per viewport:
  **chain → token → recipient + amount (one step) → review → sign →
  result.** Each step fits the viewport without scrolling to reach the
  next control; chain step is chips only.
- Details step: recipient input (16 px on touch, `inputmode`
  appropriate, paste + scan buttons beside it) ABOVE the amount input;
  amount input large (balance + "Max" beside it); fiat equivalent
  under the amount; fee line before the primary button.
- Review step: recipient, amount, network, fee — each on its own
  labelled row, then ONE coral "Sign & send" button. Broadcast stays
  DISABLED until separately authorised (safety rule — absolute).
- Result step: success/failure in place, hash shown + copy + explorer
  link, "Done" returns home. Errors preserve the entered values
  (never `form.reset()`), mark only the failing fields, focus the
  error summary.

### Receive / QR (`screens/receive.tsx`, `qr-card.tsx`, `/receive`)
- Narrow 480 px screen. Order (Bitget pattern, §4.4): chain picker
  first (sleek search picker — Popular chains first, search replaces
  sections with a flat filtered list; NOT an 84-button grid), then
  token picker, then the QR card.
- QR card: the seven templates A–G (default B) via the "Card style —
  tap to switch" picker (`aria-pressed`, active = sun). The card is
  the shareable object: title, network subtitle (network name bolded),
  QR, address + copy. Share / Download / Copy-link sit directly under
  the card, in that order.
- In-app/PNG parity gap is ACCEPTED (DECISIONS.md §24.3): in-app the
  address wraps to 3 lines at 390 px, the PNG to 2 — do not shrink the
  address font below design size or widen the card to chase parity.
- The `--qr-*` palette lives ONLY inside the card (§2.2).

### Track (`screens/track-transaction.tsx`, `/track`)
- Single purpose: paste hash → status. Input + "Track" coral button
  at the top; result card below with status (label + marker, never
  colour alone), confirmations, explorer link. `pb-24` clearance for
  the "Show recent activity" button above the bottom nav (known
  past bug — keep the clearance).
- Recent activity list below the result, not above it.

### Create / Import (`screens/create-wallet.tsx`, `import-wallet.tsx`, `welcome.tsx`, `/create-wallet`, `/import-wallet`, `/welcome`)
- Exactly ONE "Create wallet" button in the whole app (owner order).
  It opens the create flow and carries a small message saying what it
  is and that creating it gives access to 87 chains (finish-product
  Lane I; app is at 87 chains as of the 2026-11-26 guide-update pass). No duplicate create entry anywhere (sidebar, More sheet,
  welcome — one each, same target).
- Create flow: one choice visible at a time; the multichain/HD choice
  is explicit (one 24-word phrase, one account, each chain's address
  derived from it; EVM chains share one address — the honest copy,
  already agreed). Mnemonic display: words in a numbered grid, copy +
  "I wrote it down" confirmation before proceeding; backup screen is
  a focused flow.
- Import: accepts 12/15/18/21/24-word mnemonics (BIP-39; the 15-word
  gate bug is fixed — keep all five counts). Paste field + word-count
  feedback live, error inline at the field.
- Welcome (no-vault home): single sleek entry — Create wallet primary
  (coral), Import secondary, Watch-only tertiary. No separate
  login/create-account split, no password anywhere (passwordless
  decision is Wulu's, not Bawa's — Bawa's vault is password-protected
  local encryption; keep the vault password flow exactly as built).

### Watch-only (`screens/wallet-management.tsx`, `/wallets`)
- One watch-only address detects balances from ALL its chains in real
  time (mainnet only — devnet is never threaded through watch-only,
  owner decision 2026-11-23). Add-watch flow: address input → chain
  auto-detection shown explicitly ("Detected: Ethereum") → confirm.
  Watch-only rows are visually distinct (labelled "Watch-only", no
  Send action on them — sending from a watch-only address is
  impossible and must not be offered).

### Add Token (`screens/add-token.tsx`)
- Two paths, both visible: add a whole chain, or add a single token by
  contract address. Contract path: chain picker → contract input →
  fetched real name/symbol/icon/price preview → confirm. A token is
  verified by contract address (CoinGecko → Jupiter Strict → 1inch →
  Uniswap Default → PancakeSwap Extended), never by name/symbol: a
  copycat shows "Unverified" and never gets the real logo.
- The Add Token button lives on Assets and on Receive's token step —
  same button, same target, both places.

### Networks (`screens/network-selection.tsx`, `/networks`)
- List of 87 chains, searchable, grouped (Popular first, then
  alphabetical). Each row: logo, name, chain ID, current RPC status.
  Devnet toggle lives here AND on the header pill — same flag, both
  places, same failure copy. Selecting a network never navigates away
  silently; it confirms in place.

### Settings / Security (`screens/security-settings.tsx`, `auto-lock-setting.tsx`, `devnet-setting.tsx`, `/security`)
- Desktop two-column, mobile single column (480 px cap below desktop,
  §4.1). Sections in order: vault lock (auto-lock toggle + duration),
  mnemonic backup, connected wallets, devnet mode, about/version.
- Auto-lock is OFF by default with a toggle + duration picker; the
  stored derived key is conditional on the setting (a lock is real
  when enabled — owner-corrected 2026-11-25).
- Destructive actions (delete wallet, reset) sit last, in their own
  section, with a confirm step — never beside primary actions.

### History (`screens/transaction-history.tsx`, `transaction-detail.tsx`, `recent-activity.tsx`, `tx-row.tsx`, `/transactions`, `/transactions/:id`)
- List: newest first, one row per transaction — direction icon, counterparty
  (shortened address), amount + fiat, status label, time. Row ≥ 56 px,
  tappable to detail. Detail: full hash + copy, status timeline
  (submitted → confirmed), explorer link, amount breakdown.
- Empty state: "No transactions yet" + "Your history will appear here
  after your first transaction" + Receive action. No Retry column.

---

## 7. What the redesign must NOT do

- No new colours (except via an owner decision recorded in
  DECISIONS.md). No gradients, no glass, no dark mode (Bawa is a
  light-paper app; the QR Template A dark teal is inside the card
  only — it is not a dark-mode precedent).
- No emoji as icons; no grey placeholder boxes where a real asset
  belongs; no Lorem ipsum; no invented balances, prices or fees.
- No hover-only controls; no focus-ring removal; no zoom disabling.
- No second "Create wallet" button; no "Popular chains" on the
  homepage; no Retry where there is nothing to retry.
- No new npm dependency without an owner decision (bundle budget).
- No maker-claims copy anywhere (Bawa is a wallet, not a maker —
  the reseller rule is Wulu's, but the same honesty applies: describe
  what the app does, not a studio story).
- **ui-ux-pro-max's `--design-system` output for "crypto wallet"
  is NOT adopted:** it proposed a dark slate background with gold
  primary + purple accent and Orbitron/Exo 2 type. That contradicts
  the 4-colour cap, the paper/ink drawing style, and the Baloo 2 +
  Inter pairing — all owner-set. The skill's domain rules (touch
  targets, contrast, forms, navigation) ARE adopted; its palette
  and type suggestions are not.
- **huashu-design's three-direction gate does NOT apply here:** the
  direction is already chosen by the owner (drawing-illustration,
  4 colours, Baloo 2 + Inter). What IS adopted from huashu-design:
  real assets before layout, the readability floors (§2.3), no
  template decoration (no all-caps micro-label above every title,
  no `01/02/03` numbering, no `→` on buttons, no one-word
  colour-swap titles), and the polish loop — screenshot your screen
  at 390/820/1440/1919 and fix the worst three things before
  calling it done.

---

## 8. Verification checklist (every lane, before calling a screen done)

- [ ] Viewed at 390, 820, 1440 and 1919 px in the live preview; worst
      three issues fixed (huashu-design polish loop).
- [ ] All touch targets ≥ 44 px hit area (or hit area expanded to
      44 px); ≥ 8 px gaps; no content under the bottom nav (`pb-24`)
      or under safe areas.
- [ ] Contrast: only ink-on-paper, ink-on-sun, ink-on-coral text;
      no paper-on-coral; no `--qr-*` outside the QR card.
- [ ] No new hex literals (palette audit passes); no new dependency.
- [ ] Focus visible on every control; focus order = visual order;
      errors inline + focusable summary; entered values preserved
      after a failed submit.
- [ ] Loading = skeleton; empty = honest empty state + at most one
      action; error = labelled, never a dead Retry.
- [ ] `prefers-reduced-motion` respected; no horizontal scroll;
      inputs 16 px on touch; zoom not disabled.
- [ ] Real logos, real numbers, real copy. Nothing invented.
- [ ] Screen works with no vault, with a locked vault, and with a
      watch-only-only wallet — not just the happy path.

---

## 9. Decisions this document records (for the owner)

1. **No new colours needed.** The 4-colour cap + confined `--qr-*`
   exception covers every section in §6. Nothing is requested.
2. **Rejected:** ui-ux-pro-max's dark/gold/purple palette + Orbitron
   type (§7). No owner action needed — recorded so a later lane
   doesn't "fix" it back.
3. **Known gap for lanes to close:** `Button` `sm`/`xs`/`icon-sm`
   sizes are below the 44 px touch rule (§2.5). Lanes must expand
   hit areas or use larger sizes; deleting the sizes is a code
   decision for the implementing lane, not this document.
4. **Known QR contrast note:** `--qr-muted` on `--qr-teal` is 4.31:1
   (below AA normal). It stays inside the QR card only, where the
   muted text is small supporting copy next to 13.99:1 white — but
   if a lane touches the QR card, keep muted text large or treat it
   as decorative, and never reuse the pairing elsewhere.

---

## Appendix A — Skills actually used (and what each contributed)

| Skill | Used for | Contribution |
|---|---|---|
| `ui-ux-pro-max` | Design-system search (`--design-system` "crypto wallet self-custody finance") + `--domain ux` searches: bottom navigation, touch target size, form validation, typography scale, colour contrast; `references/pro-rules.md` + `quick-reference.md` read | Touch rules (44 pt iOS / 48 dp Android / 24 px web minimum, 8 px gaps), form rules (preserve input after failed submit, focusable error summary), contrast 4.5:1, type scale discipline, no-emoji-icons, safe areas, pre-delivery checklist. Palette/type output REJECTED (§7). |
| `huashu-design` | `SKILL.md` + `references/typography.md`, `references/app-paradigms.md`, `references/app-prototype.md` (skimmed) | Readability floors (body ≥ 14 px, labels ≥ 12 px), real-assets-first, no template decoration, polish loop (screenshot → worst three → fix), app paradigms ("interface as world", "reachability decides form"). Three-direction gate NOT applied (direction pre-chosen by owner). |
| `design-system` (claudekit) | `SKILL.md` + `references/token-architecture.md` (skimmed) | Three-layer token structure (primitive → semantic → component) — matches how `globals.css` already aliases everything onto the four primitives; used to structure §2. |
| `design-auditor` | `SKILL.md` skimmed + `scripts/color_contrast_checker.py` RUN | All contrast ratios in §2.1 verified first-hand (13.92 / 10.28 / 5.03 / 2.77 / 4.31 / 13.99). |
| `apple-design` | `SKILL.md` skimmed | Fluid-motion framing (interruptible, velocity-aware, springs; response kills latency) — informs §2.4 motion tokens. |
| `borghei-design-system` | `SKILL.md` skimmed | Document/deck theming only (no buttons/form states) — not applicable to product UI; noted, not used. |
| `banner-design` | `SKILL.md` skimmed | Banner/social creative only — not applicable; noted, not used. |
| `canvas-design` | `SKILL.md` skimmed | Static art/poster philosophy — not applicable to product UI; noted, not used. |

Other design/UI skills installed 2026-11-25 were NOT read in full:
they are catalogue entries (1400-skill library) and the eight above
cover the foundation. Lanes needing deeper coverage (e.g. motion,
charts, forms) should run the ui-ux-pro-max domain searches for their
own concern and record it, rather than re-reading the catalogue.

## Appendix B — Wallet sources actually used

- `~/workspace/wallet-repos/SURVEY.md` + per-org reports (read).
- Bitget developer skill `dapp-common-skill/references/layout.md` +
  `ux-patterns.md` (read — header/layout, skeletons, toast lifecycle,
  empty states, ENS).
- Owner's Bitget Receive screenshot
  (`~/workspace/user/media_library/image/1795475406544.jpg`, viewed —
  §4.4).
- Coinbase `cbpay-js` README (read — onramp button/preset-amount
  pattern).
- WalletConnect / OKX / Privy survey reports (read for the licence and
  placement notes in §5; no app UI exists in those repos to study).
- No wallet-app repo exists anywhere — stated in the survey and
  re-confirmed; there is no app source to copy, only patterns.

## Appendix C — Installs on loud-stone

**Nothing installed.** The toolchain (Node 22.23.4 at
`/home/boxd/node22/bin`), fonts (Baloo 2, Inter — `fc-list` confirms
Inter Variable present), Playwright Chromium and the skills library
were already present from the 2026-11-25 setup; this lane needed no
new tool, font or package. The contrast checker ran on the sandbox
against the skill already installed there. No repo re-clone, no
toolchain re-install (per task order).

## Appendix D — What could NOT be verified

- **Live rendering of the current app in a browser.** This lane read
  code and measured tokens; it did not run the dev server or
  screenshot the app. Section lanes must do the live-preview loop
  (§8) — a code reading is not proof a screen looks right.
- **OKX / Bitget app UI beyond the one Bitget screenshot.** Both apps
  are closed source; the survey found no app repo, no screenshots
  beyond the owner's, and no QR/share-card code in either org. The
  placement guidance in §5 is therefore patterns-from-docs, not
  measured from the apps themselves.
- **Whether the owner's phone renders the 980 px shell breakpoint as
  intended.** The breakpoint exists in code with a recorded rationale
  (Chrome/Brave desktop-site mode); first-hand phone confirmation is
  still the owner's, per the standing rule.
- **Font rendering of Baloo 2 on loud-stone** — VERIFIED during this
  lane: `fc-list` on loud-stone shows `Baloo2-Variable.ttf` (Baloo 2)
  and `Inter-Variable.ttf` both installed.
