# UI/UX Reference — Bawa wallet-panel fix (screen-by-screen spec)

- **Lane:** UI/UX research + spec, `panel-rebuild/fix-perf-ui-b`, worktree
  `/home/boxd/workspace/bawa-panel-rebuild/fix-perf-b/`, base `f9512b4`
  (`panel-rebuild/fix-preview`).
- **Date:** 2026-11-19. **Model:** gpt-6.1-sol, API 1 only, max reasoning.
  **Status:** research + specification only — no `apps/web` code was edited
  in this lane. Lane C implements from this file.
- **Owner order:** 2026-11-19 ~15:19 IST — "UI/UX is garbage — scrape some
  of the wallets UI UX and use it in ours" and "check Trust Wallet GitHub
  — you might find something interesting there".
- **Governs:** all eight screens — Welcome/generator, create-wallet flow,
  import, dashboard, asset list / asset detail, receive (address + QR),
  send (+ review), lock (+ security settings). Each section is precise
  enough to build from: layout, spacing, type, colour tokens, behaviour,
  states, and a REMOVE list.

**Status (2026-11-28 docs pass, HEAD `734cfef`):** this spec is a dated 2026-11-19 research record. Its visual direction (Bawa Balanced / STYLE-04, dark-navy tokens in §1) is superseded: the owner picked style B (polished financial — flat, hairline, tabular, real semantic colour) on 2026-11-27 (docs/DECISIONS.md §34), and the money screens were rebuilt flat under it. The per-screen layout, behaviour and states research below remains reference; do not build new screens from the §1 colour tokens. The spec covers eight screens; the app now has 19.

## How to read this spec

- **VERIFIED FIRST-HAND** — read from the live source (GitHub API / raw
  file, Help Center article, or this repo's own code) on 2026-11-19.
  Lane C may rely on these.
- **SOL** — a gpt-6.1-sol section (calls B1–B7, prompts in
  `lane/fix-perf-ui-b/b*-*.md`, outputs in `lane/fix-perf-ui-b/b*-out.md`).
  Sol has no browsing in-session; every Sol section was written against
  verified facts supplied in its prompt, and Sol marked anything beyond
  them "not specified". Where Sol proposed dimensions, they are labelled
  as proposals, not measured wallet values.
- **COORDINATOR PROPOSAL** — a value the coordinator (not a real wallet)
  proposes so Lane C does not have to guess, with its provenance stated.
  The owner / Lane C may change it; it is not a verified wallet fact.
- **NOT SPECIFIED** — no source states it. Lane C confirms before
  building that detail; it must not be invented silently.
- **Licence key.** *Code reuse* — only code/assets under a permitting
  licence may be copied (Trust Wallet `assets` MIT; Rabby MIT with brand
  reservation; token-ui MIT). *Pattern inspiration* — layout ideas from a
  closed or non-commercially licensed UI are re-implemented in our own
  code, with no copied assets, text, branding or code. MetaMask's licence
  forbids commercial derivative use; Phantom / Trust Wallet / Coinbase /
  OKX publish no wallet UI code at all.

## What the prior research missed (why it did not translate)

`panel-rebuild/ui-ux` commit `2298833` (2026-11-18) gave the layout page
real patterns (MetaMask home/send/receive/unlock, Phantom help docs,
Rabby dashboard/receive/send/unlock — all verified first-hand, and the
load-bearing file paths re-verified HTTP 200 on 2026-11-19, see
Appendix A). It did not translate because it specified STRUCTURE without
a buildable surface: no typography scale, no spacing scale, no colour
tokens, no per-screen values — and it covered only the layout page.
Welcome, create, import, lock and the send/review steps had no spec at
all, so each lane re-invented its own dark-navy styling inline. This
spec closes that gap for all eight screens.

## 0. Trust Wallet GitHub — checked first-hand

Org `trustwallet`: 29 public repos (GitHub API `orgs/trustwallet/repos`,
per_page=100, returned 29, 2026-11-19). GitHub code search:
`org:trustwallet extension` 0 results, `org:trustwallet web wallet` 0
results; ios/android queries return only
`trustwallet/trust-web3-provider`. **The consumer apps (extension, iOS,
Android, web wallet) are closed-source — there is no app UI repo or file
to cite, and no Trust Wallet app screen is used as a pattern source
anywhere in this spec.** (The prior lane reached the same conclusion on
2026-11-18; re-confirmed today.)

What IS public and interesting, each verified HTTP 200 on 2026-11-19:

| Repo | Licence | What it is | Use in this spec |
|---|---|---|---|
| `trustwallet/wallet-core` | Apache-2.0 | Cross-platform crypto library (C++/Kotlin/Swift/WASM). `wasm/` holds `index.ts`, tests, `package.json`; `samples/` holds android/cpp/go/kmp/node/osx/rust/wasm — no UI sample. Already the rebuild's signing engine (4.9.3). | Engine confirmation only. No UI to take. |
| `trustwallet/assets` | MIT | Token/chain asset registry: 189 blockchains under `blockchains/`. Per asset: `blockchains/<chain>/assets/<address>/info.json` + `logo.png`. Native logos verified for all four of our chains: `blockchains/<bitcoin\|ethereum\|tron\|ton>/info/logo.png` (plus `square_logo.png`, `info.json`). WETH `info.json` fields verified: name, symbol, type, decimals, description, website, explorer, status, id. | **REUSABLE with MIT attribution: real chain icons replace the ticker-letter chips (§7). The one Trust Wallet asset Lane C may copy.** |
| `trustwallet/tw-agent-skills` | MIT | 4 agent skills (`skills/api`, `mcp`, `sdk`, `wallet`). The wallet skill documents the `twak` CLI + MCP server: create wallet, balances, send, swap, onramp, history, alerts, DCA/limit orders, ERC-20 approvals, token risk. Flags: `--auto-lock <minutes>`, `--read-only` (signing tools neither listed nor callable), WalletConnect session resume. README: "Never give an agent your main wallet's recovery phrase." | Reference-only for UI. Directly relevant to Bawa as an AI Wallet Builder: Trust Wallet's own agent story is CLI-first + MCP + read-only mode. The minutes auto-lock and read-only mode are cited as patterns in §10. |
| `trustwallet/trust-connect-sdk` | Apache-2.0 | CAIP-compliant multi-chain wallet-connection SDK. Packages: core, namespaces, react, services, types, utils. Install: `@trustwallet/connect-react` + per-network packages (`connect-eip155-react`, `connect-solana-react`, `connect-bip122-react`). | Reference-only. Dapp-facing connect, not wallet UI. |
| `trustwallet/token-list` | Apache-2.0 | Token list data. | Reference-only. |
| `trustwallet/bip44-constants` | MIT | BIP-44 coin constants. | Reference-only. |

## 1. The token spine — why the UI looks like a mock

Read first-hand at `f9512b4`, the app runs THREE palettes at once:

1. Light Bawa Balanced tokens in `apps/web/src/ui/styles/globals.css`
   (`--primary` rgb(98 88 217), `--background` rgb(244 246 251),
   `--card` white, `--foreground` rgb(27 39 66), `--muted-foreground`
   rgb(100 113 140), `--border` rgb(214 222 237), `--ring`
   rgb(139 124 255), `--destructive` rgb(243 99 111), Inter 400–700).
   The light theme exists; the screens do not use it.
2. Hardcoded dark-navy hex per screen: shell gradient `#11172b` →
   `#18264a`, cards `#243454`, panels `#0b1326`, borders `#263454`,
   accent `#b4aaff`, muted text `#aab5d1`, gradient buttons
   `#8b7cff` → `#4f7cff`, success pill `#224f45` / `#94e1c3`.
   Every screen re-invents the same dark theme slightly differently.
3. Tailwind slate on the lock screen only (`slate-950` / `slate-900` /
   `slate-800` / `sky-400` links) — a third palette no other screen uses.

That is the mock look: not one bad screen, but no shared surface. **The
fix, before any screen is rebuilt:** Lane C first adds ONE dark token
set to `globals.css` (below), then re-skins every screen to tokens,
then deletes every inline hex value. No section below invents a colour;
each names tokens only. The shell stays dark; since Lane F (2026-11-20,
desktop layout) it is a responsive shell, not a 430px panel — 430px cap
below lg, 224px sidebar + centred content frame (1024px at lg, 1152px
at xl) at lg and above. The light
tokens stay for the light theme.

### 1.1 Dark tokens to add (values taken from OUR OWN existing shell code, not invented)

| New token | Value (from existing code) | Source in current code |
|---|---|---|
| `--panel-surface` | `#0b1326` | dashboard panels |
| `--panel-surface-raised` | `#243454` | cards / banners |
| `--panel-border` | `#263454` | panel borders |
| `--panel-text` | `#eff2fc` | panel body text |
| `--panel-text-muted` | `#aab5d1` | panel muted text |
| `--panel-text-soft` | `#c8d0e8` | panel secondary text |
| `--panel-accent` | `#b4aaff` | panel accent / focus |
| `--panel-accent-gradient` | `#8b7cff → #4f7cff` | header icon tile, primary pills |
| `--panel-success-pill-bg` / `--panel-success-pill-text` | `#224f45` / `#94e1c3` | Mainnet pill |
| `--panel-icon-tile` | `#263451` | dashboard action circles |

The lock screen's slate-950/900/800 and sky-400 are deleted, not
tokenised. Chain colours stay as data, not text:
BTC `#f7931a`, ETH `#627eea`, TRX `#eb0029`, TON `#0098ea`
(`asset-rows.tsx` `CHAIN_CHIP_COLORS`).

### 1.2 Type scale and components (VERIFIED FIRST-HAND from the repo)

Type scale (`globals.css`): display-lg 40px/48px, title-lg 28px/36px,
title-md 24px/32px, title-sm 20px/28px, body-lg 16px/24px,
body-md 14px/20px, body-sm 13px/20px. Font Inter (`--font-heading`),
weights 400/500/600/700.

Components (`apps/web/src/ui/components/`, all read first-hand):

- Button: h-10 (40px), px-4, rounded-full, body-md, focus ring 3px
  (`--ring` at 50%). Primary shadow `--shadow-cta`.
- Input: h-12 (48px), px-4, rounded-md, body-md, `bg-input-background`.
- Card: rounded-xl, gap-6, header px-6/pt-6, title `text-title-sm`
  semibold; small variant gap-4, px-4/pt-4. Shadow `--shadow-card`.
- StepCard: flex gap-3, rounded-xl, p-4, 40px number circle (done:
  success bg; todo: `surface-blue-dim` bg + primary text), label
  semibold, detail muted, relaxed leading.
- ActionBar: h-12, rounded-full, text-sm semibold, grid gap-3, 2 or 4 cols.
- Tabs: container h-9, rounded-xl, p-1, bg-muted; tab px-2 py-1,
  text-sm medium, rounded-xl; active tab bg-card.
- Skeleton: bg-accent, animate-pulse, rounded-md.
- AssetRow: symbol 16px semibold, amount 14px muted, value 16px semibold.
- HoldingCard: rounded-20, p-5, shadow-card; label 14px muted, amount
  text-2xl (24px) bold, value 14px semibold.
- ChecklistCard: rounded-lg, p-4.
- BottomSheetModal: rounded-t-32px, max-w 560px, drag handle h-1.5 w-14,
  backdrop `bg-foreground/28` + blur 2px, close button 40px circle.

Current screens — keep unless a section says REMOVE:

- Action circles 56px, icons 24px, labels 11px semibold (dashboard).
- QR 192px on a white rounded-20 card with p-4 (receive).
- Asset avatar 40px circle; skeleton row 68px high (asset-rows).
- Shell (Lane F, 2026-11-20, responsive — see `src/app/app.tsx`):
  below lg a 430px max-width panel, main px-5 pb-6, header px-5 pt-5
  pb-4, bottom tab bar; at lg+ a 1440px app frame with a 224px sidebar
  (72px brand area) and a 72px workspace header, content frame
  max-width 1024px (lg) / 1152px (xl), narrow task screens capped at
  480px. Header icon tile 36px rounded-xl, title 15px bold, Mainnet
  pill h-6 px-3 10px bold (unchanged).

### 1.3 Screen map — primary pattern per screen

| Screen | Primary pattern | Exact source (verified) |
|---|---|---|
| Welcome/generator | Rabby branded-entry hierarchy | `RabbyHub/Rabby`, `src/ui/views/Unlock/index.tsx` (MIT, brand reserved) |
| Create-wallet flow | Our own 4-step StepCard flow; MetaMask password-entry reference | `apps/web/src/screens/create-wallet.tsx`; `MetaMask/metamask-extension`, `ui/pages/unlock-page/unlock-page.component.tsx` |
| Import | MetaMask restore-first hierarchy; Rabby watch-only labelling | MetaMask unlock-page (restore-vault route); `RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx` (`watchModeAlert`) |
| Dashboard | Rabby summary-first, cache-preserving balance view | `RabbyHub/Rabby`, `src/ui/views/Dashboard/components/BalanceView/BalanceView.tsx` (`shouldShowBalanceLoading`) |
| Asset list | MetaMask TokenCell | `MetaMask/metamask-extension`, `ui/components/app/assets/token-list/token-list.tsx` |
| Asset detail | Phantom detail-owns-actions | Phantom Help Center (verified 2026-11-18) |
| Receive | Rabby Receive grouping, kept as a page | `RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx` |
| Send (+ review) | Rabby SendToken chain-first + MetaMask poisoning alerts | `RabbyHub/Rabby`, `src/ui/views/SendToken/index.tsx`; MetaMask `ui/pages/confirmations/components/send/amount-recipient/amount-recipient.tsx` |
| Lock / unlock | MetaMask dedicated unlock screen | MetaMask `ui/pages/unlock-page/unlock-page.component.tsx` |
| Auto-lock settings | Phantom timer range + Rabby minutes preference | Phantom Help Center article 28951350406803; `RabbyHub/Rabby`, `src/background/service/autoLock.ts` |

## 2. Welcome / generator

**Primary pattern + exact source (SOL B1):** Branded-entry hierarchy,
`RabbyHub/Rabby` — `src/ui/views/Unlock/index.tsx` (MIT, branding
reserved). Adapt the hierarchy, not biometrics or unlock functionality.
Local baseline: `apps/web/src/screens/welcome.tsx` (82 lines, read
first-hand).

**Current state — what is wrong:** dark-navy hero card, "BAWA" eyebrow,
30px bold title, one paragraph, a Network row with a MAINNET pill, then
two light Cards (Create / Import) and a footnote aside. The hero card
and the light cards mix two surfaces; there is no brand mark beyond
text; there is no preview of the steps ahead; colours are hardcoded hex
values, not tokens.

**Layout, top-to-bottom:**

1. Shell header (existing: wallet icon tile, "Bawa Web Wallet",
   "Account 01" link, Mainnet pill).
2. Welcome brand block, reusing the existing Bawa wallet-icon tile,
   "BAWA", "Welcome to Bawa Web Wallet" (title 30px/700 — keep the
   current size; it maps to title-lg 28px/36px, so use title-lg), and
   the paragraph (body-md, `--panel-text-muted` on the dark surface).
3. Network row with MAINNET pill (keep; pill is h-6 px-3 10px bold,
   `--panel-success-pill-bg` / `--panel-success-pill-text`).
4. **Four-step preview (NEW, COORDINATOR PROPOSAL):** password, 24-word
   backup, three-word confirmation, success — the same four steps as the
   create flow, shown as a numbered list reusing StepCard circles
   (40px). Copy: "1 Set a vault password · 2 Write down 24 words ·
   3 Confirm 3 words · 4 See your addresses". Geometry follows
   StepCard (gap-3, p-4, rounded-xl).
5. Create a wallet / Import a wallet Cards, retaining descriptions and
   full-width Buttons (Button h-10, Card rounded-xl, header px-6/pt-6).
   Use `--card` consistently for content surfaces.
6. Mainnet-only, offline-signing, broadcast-disabled aside (keep words).

**Colour:** `--panel-*` tokens for the dark brand block;
`--card` / `--foreground` / `--muted-foreground` / `--border` for the
two Cards; `--primary` for the Create button; `--ring` for focus.

**Behaviour + states:** Create opens the four-step creation flow;
Import opens the import flow. Do not show sample words or addresses.
Success is reached inside creation, not simulated here. Loading /
empty / error presentation on this screen: NOT SPECIFIED — this screen
has no async state; Lane C confirms there is none to add.

**REMOVE:** the separate navy-hero treatment (the hero becomes a
`--panel-surface-raised` block in tokens, not a one-off hex card);
text-only branding with no step preview; all hardcoded colours.

## 3. Create-wallet flow

**Primary pattern + exact source (SOL B1):** Bawa's own four-step
StepCard flow, `apps/web/src/screens/create-wallet.tsx` (412 lines,
read first-hand). Password-entry reference only:
`MetaMask/metamask-extension` —
`ui/pages/unlock-page/unlock-page.component.tsx`. CLI flow-order
reference only: `trustwallet/tw-agent-skills` — `skills/wallet/SKILL.md`
(create wallet, keychain); no Trust Wallet app UI exists.

**Current state — what is wrong:** 4 steps via a StepCard list — 1 set
a vault password (minimum 8 characters, plus confirm, plus an optional
BIP-39 passphrase), 2 write down 24 words shown once, 3 re-enter 3
randomly chosen words, 4 success showing all 4 chain addresses. The
mnemonic lives in local state only and is cleared on unmount and on
error (keep). Defects: no word-grid layout is specified anywhere; no
progress indicator beyond the step list; step 4 is an address dump, not
a success state; colours are hardcoded hex values.

**Layout, top-to-bottom:** shell header → four-step progress → StepCards
in order:

1. Vault password, minimum 8 characters; confirmation field; optional
   BIP-39 passphrase field (Input h-12, Label above, body-md).
2. Once-only, ordered **24-word write-down grid**, containing the actual
   mnemonic. **COORDINATOR PROPOSAL:** 3 columns × 8 rows of numbered
   word chips; chip h-12, rounded-md, border `--border`, number muted
   body-sm + word semibold body-md. The grid is the one place the phrase
   ever appears on screen.
3. **Three randomly selected word-position prompts** with inputs for
   answers from the written copy (same chip/input styling; prompt shows
   the position, e.g. "Word 7").
4. Success acknowledgement FIRST ("Your wallet is ready" — title-md),
   then all four actual chain addresses as secondary content, then the
   backup-checklist link. Success wording and address arrangement:
   COORDINATOR PROPOSAL as stated; Lane C confirms the exact success
   copy.

**Progress (COORDINATOR PROPOSAL):** numbered circles 40px joined by a
track (reuse StepCard circles: done = success bg, current = primary
bg, todo = `surface-blue-dim` bg + primary text), with the current step
labelled in text — progress is never communicated through colour alone.

**Behaviour + states:** step actions follow password setup →
write-down → verification → success. The three-word check must prove
the written copy was saved; a mismatch shows "One or more words do not
match the recovery phrase you wrote down. Check your written copy and
try again." (existing copy, keep) and stays on step 3. Button labels,
transition gates, normalisation, loading/empty presentation, focus
movement and success exit destination: NOT SPECIFIED in the Sol
section — keep the existing flow's behaviour (buttons are full-width
Button h-10; busy state disables the fieldset). Backup access opens
`apps/web/src/screens/mnemonic-backup.tsx`. Keep the mnemonic in local
state only; clear on unmount and error. No fake data, testnet or
broadcast.

**REMOVE:** reliance on the step list as the sole progress cue; the
bare address-dump success presentation; hardcoded colours. Preserve all
four steps and the mnemonic-lifecycle safeguards.

## 4. Import-wallet

**Primary pattern + exact source (SOL B2):** restore-first hierarchy —
`MetaMask/metamask-extension`, `ui/pages/unlock-page/unlock-page.component.tsx`
(forgotten password routes to the restore-vault route; restore is a
first-class entry point). Watch-only labelling —
`RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx` (`watchModeAlert`)
and `src/ui/views/AddressManagement/` (imported accounts get a label
and a place in the account list). Security reference:
`trustwallet/tw-agent-skills`, `skills/wallet/SKILL.md` ("Never give an
agent your main wallet's recovery phrase"); not a consumer-app UI source.

**Current state — what is wrong:** `apps/web/src/screens/import-wallet.tsx`
(533 lines, read first-hand) defaults to watch-only (paste an xpub per
chain, with a label). Phrase-restore is secondary: enter phrase (12/24
words) → preview derived addresses → saved → set vault password (+
confirm) + optional BIP-39 passphrase. A vault-exists state blocks
phrase restore. Defects: the default is backwards; the mode switch is
not labelled as a choice; watch-only import is per-chain xpub with no
explanation that a watch-only account cannot sign; colours are
hardcoded hex values.

**Layout, top-to-bottom:**

1. "Import wallet" title (title-md 24px semibold, as now).
2. Labelled tabs: **Restore full wallet** (default) / **Watch-only**
   (Tabs component: container h-9, rounded-xl, p-1; tab text-sm medium).
3. Active `Card` containing the current `StepCard`, fields and inline
   `Alert`:
   - **Restore:** recovery-phrase field (12/24 words) → derived-address
     preview → Saved → vault password, confirmation and optional BIP-39
     passphrase. Preserve the existing step sequence; the "Saved
     persistence semantics" point Sol flagged as UNCERTAIN is a property
     of the existing flow logic, which Lane C keeps — it is not a spec
     gap.
   - **Watch-only:** persistent warning, "Watch-only accounts cannot
     sign transactions. Import one chain at a time." (Sol B2 copy, keep)
     → chain choice → account label → xpub.
4. Current-step primary action (full-width Button h-10) and applicable
   edit control.
5. **Backup checklist** link; tap opens `/mnemonic-backup`.

All stages remain within this screen.

**Spacing / sizing / typography:** Inter; Button h-10, Input h-12,
Card rounded-xl px-6/pt-6, StepCard p-4 gap-3 (§1.2). All other
padding/gaps: NOT SPECIFIED — use the §1.2 component values, do not
infer wallet measurements.

**Colour:** canvas `--background`; surfaces `--card`; text
`--foreground`; helpers `--muted-foreground`; outlines `--border`;
actions `--primary` / `--primary-hover`; selection `--primary-soft`;
focus `--ring`; errors `--destructive`. Dark-panel fill, if any surface
needs it: `--panel-surface-raised` (§1.1). No new hex values.

**Behaviour + states:**

- Mode taps select the corresponding form without saving.
- Existing vault blocks phrase restore. Alert: "A vault already exists.
  Phrase restore is unavailable." (Sol B2 copy.)
- **Preview addresses** requires 12/24 words; otherwise: "Enter a 12-
  or 24-word recovery phrase." Before any save, show actual chain
  identifiers and full derived addresses, grouped by chain. Never show
  the phrase or fabricated results.
- **Edit** returns to phrase entry and invalidates the preview.
  **Confirm import** requests saving; show Saved only on actual success,
  with the imported-address summary.
- **Set vault password** opens password, confirmation and
  optional-passphrase fields. **Save password** completes only on
  success. Mismatch: "Passwords do not match." (existing copy.)
- **Import watch-only** imports one selected chain's xpub with its
  label. Empty xpub: "Enter an xpub for the selected chain." Preserve
  the warning in Saved and watch-only labelling in the account list.
- Empty: blank fields, no samples; block incomplete submissions. Empty
  preview: "No addresses to review." Block saving. Loading: busy action,
  prevent duplicate taps. Error: remain on step; "Could not complete
  this step. Try again." **Retry** repeats the failed action.
- Phrase-entry instructions refer only to the restore field. No agent
  sharing, no digital-storage advice, no demo data, no testnet, no
  broadcast.

**REMOVE:** watch-only default, unlabelled switch, unexplained
watch-only / per-chain presentation, hardcoded hex styling. Retain both
paths, restore steps and backup link.

## 5. Dashboard

**Primary pattern + exact source (SOL B3a):** Rabby's summary-first,
cache-preserving balance view: `RabbyHub/Rabby`,
`src/ui/views/Dashboard/components/BalanceView/BalanceView.tsx`
(`shouldShowBalanceLoading`). Borrow composition and loading rules, not
its priced breakdown or curve. Balance-before-tabs also follows
MetaMask's `MetaMask/metamask-extension`, `ui/pages/home/home.tsx` and
`account-overview-layout.tsx`. Independently implement; copy no
third-party code, text, branding or assets.

**Current state — what is wrong:** `apps/web/src/screens/dashboard.tsx`
(350 lines, read first-hand). sr-only "Portfolio" heading; balance hero
— label "Portfolio balance" 13px, hero value text-2xl (24px) bold, an
honest "No price feed connected — portfolio total unavailable" line, and
a Refresh/Retry outline button; the hero holds its last settled text
while refreshing and never renders an error as zero. Action row: 3 icon
+ label buttons (Send, Receive, Activity) — 56px circles, 24px icons,
11px labels. Tabs: Tokens / Activity in a pill container (keyboard:
arrows/Home/End). Tokens tab: "Assets" heading 18px bold + a bare "Hide
zero balances" checkbox, then AssetRows. Activity tab: recent
transactions, date + status, amount, per-chain "history unavailable"
boxes with Retry. Bottom of the screen still shows lock / no-vault
banner boxes ("Locked — derived addresses are hidden", "No wallet yet")
with Unlock / Create / Import buttons. Defects: hero is 24px (small for
a balance hero); no fiat total (honest — no price feed exists); lock and
no-vault banners sit on the home screen instead of being separate
screens; the hide-zero control is a bare checkbox; no per-chain
breakdown; colours are hardcoded hex values.

**Layout, top-to-bottom (Lane F responsive shell: phone stacks as
before; at lg+ hero + actions share the top row 7:5, tabs span both
columns, and in the Tokens view the asset list sits left with recent
activity right 7:5 — 2:1 at xl):**

1. sr-only "Portfolio" heading.
2. Dark hero (`--panel-surface-raised`, radius 16px, padding 20px —
   SOL B3a proposal): label → prominent value → explanation → outline
   Refresh/Retry button.
3. Equal-width Send / Receive / Activity actions (56px circles, 24px
   icons, labels 12px/16px weight 500 — SOL B3a proposal; current
   labels are 11px, raise to 12px).
4. Tokens / Activity pill tabs (Tabs component, §1.2).
5. Selected panel.

Tokens show genuine holdings grouped by chain, with asset units — not
USD ranking. Activity shows newest-first real transactions: date,
textual status, amount with asset, and chain. Each unavailable chain
gets its own "History unavailable" box and Retry; successful chains
remain visible.

**Spacing / sizing / typography (SOL B3a proposals, not measured wallet
values):** Inter throughout; shell content inset stays px-5 (20px) as
built; section gaps 16px. Hero label 13px/18px weight 500. Main value
**40px/48px weight 700** (`--text-display-lg`). Explanation 12px/18px
weight 400. Action circles 56px, icons 24px, labels 12px/16px weight
500. Tabs and buttons: minimum 44px height, 44×44px tap target.
Activity rows: minimum 64px height, 12px padding; amount 14px/20px
weight 600; metadata 12px/16px weight 400.

**Colour:** `--background` for the screen; `--card` for rows/tab
container; `--foreground` for text; `--muted-foreground` for metadata;
`--border` for separators; `--primary` for action/selection accents;
`--ring` for focus. Hero surface: `--panel-surface-raised`; hero text
`--panel-text`; secondary hero text `--panel-text-muted`. Status
indicators use `--success-text` and `--destructive` alongside readable
text, never colour alone.

**Hero, behaviour and states — without a price feed, show exactly:**

- Label: "Portfolio balance"
- Main value: "Unavailable"
- Explanation: "No price feed connected — portfolio total unavailable"

Do not sum unlike asset units. No fiat total, unit price or percentage
change. Only after a real feed is integrated may the hero display its
currency-labelled fiat total; explicitly identify incomplete pricing
coverage and stale data.

- **Initial loading:** skeletonise uncached panel rows; retain the known
  no-feed hero message.
- **Refreshing with cache:** retain settled hero text and rows; show
  "Refreshing" and prevent duplicate requests.
- **Error:** preserve cached data; show scoped error/Retry, including
  per-chain history failures. Never replace an error with zero.
- **Confirmed empty holdings:** "No tokens yet"; Receive remains
  available. Empty history: "No activity yet". The unpriced hero remains
  "Unavailable".

**Tap behaviour:** Send/Receive open their flows; transaction rows open
details. Activity selects the Activity tab; tab taps switch panels.
Preserve arrows/Home/End keyboard navigation. Refresh reloads read-only
holdings/history; per-chain Retry repeats only that failed request.

**REMOVE:** the 24px hero sizing and hardcoded colour values; both
home-screen lock/no-vault banners and their Unlock/Create/Import
controls. Gate those states outside Dashboard into separate screens
(Welcome for no-vault, `/lock` for locked). Real mainnet data only: no
demo/fake data, no testnet, no dashboard broadcasting.

## 6. Asset list / asset detail

**Primary patterns (SOL B3b):**

- **List:** `MetaMask/metamask-extension`,
  `ui/components/app/assets/token-list/token-list.tsx`: TokenCell
  tap-to-detail, skeleton rows, genuine empty/collapse states.
  ConsenSys non-commercial licence; patterns only.
- **Detail:** Phantom Help Center (verified 2026-11-18): detail owns
  asset-scoped Send/Receive/Swap. Vendor documentation only; reuse no
  vendor code, copy or branding. Only the MIT logos below are permitted
  assets.

**Current state — what is wrong:** `apps/web/src/screens/asset-rows.tsx`
(125 lines) + `asset-list.tsx` (48 lines), read first-hand. One row per
chain (BTC/ETH/TRX/TON), never per token. Avatar is a 40px circle in the
chain colour with the ticker text ("BTC") and a small badge bottom-right
that repeats the SAME ticker — the badge duplicates the chip. Row text:
symbol line is the chain display name, second line is "BTC · Bitcoin
mainnet" (network text where a balance belongs), value is the native
amount only, no fiat. States are honest: loading shows a 68px skeleton
row; error shows "Balance unavailable" / "Could not load balance" with a
Retry button; zero shows "Zero balance". Rows tap through to
`/assets/<chain>`.

**Asset detail inventory (COORDINATOR, first-hand — B3b was not given
it):** `asset-detail.tsx` (275 lines): h1 24px semibold (chain name)
with Refresh and Receive buttons; balance Card rounded-20 with skeleton
h-8 w-48, "Balance unavailable" 18px semibold + Retry; Recent
transactions h2 18px semibold with skeleton h-24 or error + Retry;
second Card with truncated xpub (first 12 … last 8) + derivation-path
text; derived-addresses h2 + list.

**Layout, spacing and typography (SOL B3b proposals):** Inter
throughout. Screen inset and section gaps 16px. Card radius 16px.
Headings 24px/600. Detail cards 16px padding; list Card: no padding
outside rows.

- **List order:** Assets heading → filter → Card containing native rows
  or an empty state. Keep BTC/ETH/TRX/TON order. Rows: minimum 68px
  high; 12px vertical / 16px horizontal padding; 12px avatar/text gap.
  `symbol`: native ticker, 16px/600. `amount`: actual native quantity
  plus ticker, 14px/400. `detail`: existing network name, 12px/400,
  separately aligned right. Omit `value`: no fiat, unit price,
  percentage or monetary placeholder. (This remaps the AssetRow props:
  symbol ← ticker, amount ← native quantity + ticker, detail ← network
  name, value ← omitted.)
- **Avatar:** 40px circular native-chain logo replaces both ticker disc
  and duplicated badge. No native overlay; the caption provides network
  context. Use `trustwallet/assets`,
  `blockchains/<bitcoin|ethereum|tron|ton>/info/logo.png`, **MIT**;
  retain attribution, copyright and licence notice (see §11).
- **Filter:** "Hide zero balances" as a Button/chip (44px high, 12px
  horizontal padding, 22px radius, 14px/500), toggling with
  `aria-pressed`, not a checkbox. Collapse confirmed zeros only. Do not
  expose dust filtering: threshold/support NOT SPECIFIED; no price feed
  exists.
- **Detail order:** 44px Back target → dark holding-card → asset-scoped
  actions → chain-breakdown Card. Hero order: 48px native logo → asset
  name 24px/600 and network 14px/400 → actual native quantity plus
  ticker 32px/600. Action buttons 44px high, 12px gaps. Breakdown sits
  below actions and shows only the selected chain's actual native
  amount/network; no invented multichain total. The xpub/derivation
  card stays below the breakdown (honest technical detail; never show a
  full xpub on screen).

**Colour:** canvas `--background`; cards `--card`; text `--foreground`;
captions `--muted-foreground`; dividers / unpressed filter border
`--border`; actions / pressed filter `--primary` with `--card` text;
focus `--ring`; errors `--destructive`. Dark hero background:
`--panel-surface-raised`; hero text `--panel-text`, captions
`--panel-text-muted`.

**Behaviour and states:**

- Row content is a full-width keyboard-accessible link to
  `/assets/<chain>`. Error Retry is a separate button, never nested
  inside the link. Back returns to the list. No list quick Send/Swap
  (COORDINATOR DECISION: rows tap to detail; detail owns the actions —
  the Rabby quick-action pattern is deliberately not adopted, to keep
  rows unambiguous). Interactive targets at least 44px.
- **Loading:** 68px skeleton rows; structural detail skeletons, never a
  spinner covering the list.
- **Zero:** "Zero balance" in the amount line. Hide only confirmed
  successful zeros, never loading/errors. If all rows are filtered, show
  "No non-zero balances" and "Show all", which clears the filter.
- **Error:** retain asset identity, "Balance unavailable" / "Could not
  load balance" and 44px Retry. Never substitute zero; Retry refetches
  that chain.
- Send/Receive/Swap capabilities and routing: expose only verified
  existing asset-scoped flows; omit unsupported actions. **ADD an
  asset-scoped Send button to detail — only Receive exists today; Swap
  stays omitted (no engine support).** These screens never broadcast.

**REMOVE:** ticker disc / repeated badge; chain display name in the
symbol slot; network wording in the amount slot; bare checkbox. Do not
introduce priced columns, demo data or testnet.

## 7. Receive (address + QR)

**Primary pattern + exact source (SOL B4):** Rabby:
`RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx` — QR, address
copying, network selection and watch-only disclosure. Adopt that
grouping, not its `ChainSelectorModal`: **our Receive remains a page**,
with existing network pills and the QR visible directly. Network-safety
guidance: Phantom Help Center article 4406393831187, "Receive tokens in
Phantom". Patterns only; reuse no third-party code, interface text,
branding or assets.

**Current state — what is wrong:** `apps/web/src/screens/receive.tsx`
(201 lines, read first-hand). "Receive" heading 24px semibold; chain
pill row (BTC/ETH/TRX/TON) — selected pill is a violet gradient, others
outline; a watch-only Alert when the shown address belongs to a
watch-only account; a dark-navy card holding a 192px QR on a white
rounded card, the full address in centred mono 14px with break-all,
Copy address and Share buttons; for TRX/TON an amount is shown as text
beside the QR because those chains have no standard payment URI here; an
amount field below the card ("Amount (optional)") with validation
("Enter a valid amount."); BTC encodes a BIP-21 amount and ETH encodes
value in wei in the QR; a "No receiving address available" empty state
links to import. Defects: the QR card is dark-navy while the QR itself
sits on white — two surfaces fighting; the amount field sits BELOW the
QR, so the QR a user shares can be stale relative to the amount they
typed; no network warning; colours are hardcoded hex values.

**Layout — top to bottom:**

1. **Receive** heading (keep 24px semibold).
2. BTC / ETH / TRX / TON network pills; selected network clearly
   distinguished (solid `--primary`, not the gradient — see REMOVE).
3. Network-warning Alert ("Send only on the selected network — the
   sender must use the network you selected, even where addresses look
   the same").
4. Watch-only Alert, when applicable to the displayed address's account.
5. **Amount (optional)** field and inline validation — **above the QR**,
   not below it (Input h-12, Label above, body-md).
6. One Card containing: QR; for TRX/TON, entered amount as separate
   plain text beside the QR; full address, centred and untruncated;
   **Copy address** and **Share** Buttons.

No separate QR screen or receive modal.

**Spacing / sizing / typography:** retain the verified 24px semibold
heading, **192px × 192px QR**, and **14px monospace** address with
centred alignment and `break-all`. Use Inter elsewhere. Card padding,
gaps, radii, QR quiet-zone dimensions, control heights, other font
sizes/weights, address weight and monospace family: NOT SPECIFIED —
use the §1.2 component values (Card rounded-xl p-6, Button h-10,
Input h-12); do not infer from wallet screenshots.

**Colour:** `--background` page; `--card` single receive surface and QR
surround; `--foreground` main text; `--muted-foreground` supporting
text; `--border` outlines; `--primary` selected pill and action
emphasis; `--ring` focus; `--destructive` validation errors. Replace
the selected gradient with a solid token-based treatment. **COORDINATOR
DECISION:** the receive surface is `--card` (light), not a dark token —
the QR needs a white surround for scannability, and this matches the
Welcome light Cards already on the dark shell. No NEW-TOKEN is required
for this screen.

**Behaviour + states:**

- **Network warning:** tell the sender to use the selected network.
  Identical address text does not establish network compatibility.
- **QR updates:** chain or amount changes must refresh the displayed QR
  from current validated inputs; never expose an earlier amount-bearing
  payload for sharing.
- **Amounts:** BTC encodes a BIP-21 amount; ETH encodes value in wei.
  TRX/TON retain an address-only QR, with amount shown separately as
  text — no standard payment URI is claimed.
- **Copy:** copy the complete displayed receiving address, not an
  amount-bearing QR URI.
- **Share:** NOT SPECIFIED in detail (payload, QR attachment, platform
  integration, fallback, feedback) — Lane C confirms. Any QR-sharing
  implementation must share the current QR.
- **Validation error:** retain "Enter a valid amount." Do not offer a
  stale amount-bearing QR while the current amount is invalid.
- **Watch-only:** retain the Alert explaining that receiving is possible
  but this wallet cannot sign; receiving actions remain available.
- **Zero / no address:** show "No receiving address available" with the
  existing import link instead of the amount field, QR, address and
  actions. Do not substitute fabricated data.
- **Loading / copy feedback / zero-amount acceptance:** NOT SPECIFIED.
  Never display stale account data during transitions.

**REMOVE:** the dark-navy wrapper and redundant nested QR-card surface,
the below-QR amount placement, hardcoded colour values, selected-pill
gradient, stale QR-sharing behaviour.

## 8. Send (+ review / confirm)

**Primary pattern + exact source (SOL B5):** Rabby,
`RabbyHub/Rabby`, `src/ui/views/SendToken/index.tsx`: chain-first
selection, Max, fee reserve and recipient-risk checks. Adapt these
concepts to our existing order and offline signing only. Supporting
alert patterns: MetaMask, `MetaMask/metamask-extension`,
`ui/pages/confirmations/components/send/amount-recipient/
amount-recipient.tsx` (poisoning); Phantom Help Center, "Send tokens
from Phantom" (new-address, network and native-fee cautions).
Reimplement patterns only: no third-party code, text, branding or
assets.

**Current state — what is wrong:** `apps/web/src/screens/send.tsx`
(533 lines) + `send-review.tsx` (99 lines), read first-hand. Multi-step
flow — chain, then recipient (+ QR scanner), then amount/fees, then
review, then offline sign, then result. Broadcast is DISABLED until
separately authorised: after review the button is "Sign offline", never
"Send"; the result step shows the signed payload with a copy action.
Recipient step validates the address and offers a QR scanner; amount
step runs a fee preview (`previewSendAmount`) with a "Checking…" busy
state and shows the preview failure reason inline; review shows
destination, asset, amount, fee and total plus a fee note; the user can
go back from review to amount. Defects are visual only — step order and
states are right, but there is no step indicator showing where the user
is in the flow; no new-address warning; no insufficient-funds-for-fees
treatment is specified in the UI copy; no gas-reserve concept is
surfaced; colours are hardcoded hex values.

**Shared layout and styling:** every step, top-to-bottom: non-clickable
six-step indicator with the current step explicitly labelled (Chain →
Recipient → Amount → Review → Sign → Result — **COORDINATOR NOTE:**
the indicator is presentation over the existing flow, whose steps are
chain selector + recipient / amount / review / result with signing as
the review action); heading; ordered content below; inline alerts; Back
and the step action. Do not communicate progress through colour alone.
Use existing Button, Input, Label, Alert, Card/StepCard and skeleton
components. Exact padding, gaps, panel widths, control heights, font
sizes and weights: NOT SPECIFIED — use §1.2 component values; do not
infer wallet measurements.

**Colour:** `--background` page, `--card` content surfaces,
`--foreground` text, `--muted-foreground` supporting text, `--border`
boundaries, `--ring` focus, `--primary` / `--primary-hover` actions,
`--warning` cautions, `--destructive` errors. Dark-panel surface, if a
step needs one: `--panel-surface-raised` (§1.1).

**Steps and states:**

1. **Chain.** Chain selector → selection feedback → actions. Require a
   selection before Next.
2. **Recipient.** Labelled address input and QR scanner → validation →
   recipient alerts → actions. Retain address validation; validate
   scanned addresses too. Invalid addresses block Next. Show a
   new-address caution only when supported by real first-use
   information (**COORDINATOR NOTE:** derive first-use from real
   per-chain history if Lane C can; otherwise omit the caution rather
   than guessing); show poisoning and sorted risk findings only from
   actual checks. Prompt independent verification of the full address
   and network; explain that a transaction, if later broadcast, is
   irreversible. Detection/history and warning acknowledgement/blocking
   policy: NOT SPECIFIED. Never invent a "safe" verdict. Back → Chain.
3. **Amount.** Asset and amount → Max → estimated fee and native-token
   fee reserve → inline feedback → actions. Run `previewSendAmount`,
   retain "Checking…" and show the actual preview failure reason inline.
   Label the fee **Estimated fee**, with a note that it may change.
   Block progression while checking, on invalid input, preview failure
   or confirmed insufficient fee funds. Explain insufficient native
   token for fees explicitly. Max must preserve the fee reserve;
   non-native asset balance does not replace native-fee funding. Balance
   inputs and reserve/Max calculation: NOT SPECIFIED — disable Max if
   the required calculation is unavailable. Back → Recipient.
4. **Review / confirm.** Selected chain → full destination → asset →
   amount → estimated fee → total with explicit units → fee note →
   reserve and active warnings → actions. Back → Amount. Changed inputs
   invalidate stale previews and signatures. Recheck validity and fee
   sufficiency before enabling **Sign offline**. This is review before
   signing, not network confirmation; no broadcast action.
5. **Sign.** Transaction recap → local signing status. Enter only
   through **Sign offline**; prevent duplicate signing. Back → Review
   while idle; unavailable whilst signing.
6. **Result.** Status → details → actions.
   - **Pending:** local offline-signing operation only; busy
     indicator/skeleton, no payload or copy action.
   - **Signed:** "Signed offline — not broadcast", actual signed payload
     and Copy.
   - **Failed:** failure state and actual available signing error; no
     success claim or copyable signature.
   
   Back → Review once settled; disabled whilst pending. Back never
   automatically signs. No submitted-to-network or on-chain-confirmation
   states.

**REMOVE:** hardcoded hex styling (replace with tokens). Delete no
functional stages. Retain validation, QR scanning, preview busy/error
feedback, review Back and signed-payload copy. No demo/fake data, no
testnet. **Broadcast stays disabled: the flow ends at offline signing.
Never spec a "Send" / broadcast button, a submitted-to-network state,
or an on-chain confirmation state.**

## 9. Lock / unlock (+ security settings)

**Primary patterns (SOL B6):**

- **Unlock:** MetaMask, `MetaMask/metamask-extension`,
  `ui/pages/unlock-page/unlock-page.component.tsx`: branded password
  entry, restoration and post-unlock redirect. Borrow the
  dedicated-screen presentation; `/lock` remains **a route, not an
  app-wide gate**.
- **Settings:** Phantom Help Center article 28951350406803, "Turn on
  auto-lock": timer settings and bottom manual-lock action. Rabby,
  `RabbyHub/Rabby`, `src/background/service/autoLock.ts` and
  `src/background/service/preference.ts`: minutes preference, activity
  reset and persisted deadline.

Patterns only; use our own implementation, wording and Bawa assets.

**Current state — what is wrong:** `apps/web/src/screens/lock.tsx`
(139 lines, read first-hand). Full-screen branded password lock —
header "Bawa Web Wallet", centred card (max-width medium) with heading
"Unlock your wallet" (or "Set up your wallet" when no vault exists), a
Password field, an optional BIP-39 passphrase field shown only when the
vault was created with one, an error line, a full-width Unlock button
("Unlocking…" while busy), and a "Back to dashboard" link at the bottom.
Wrong password shows the vault's message and clears both fields. The
vault is NOT gated app-wide: watch-only mode stays usable while the
vault is locked, so this screen is a route (/lock) linked from the
dashboard banner and the send screen, not an app-wide gate. Defects: it
uses Tailwind slate colours (slate-950 / slate-900 / slate-800) — a
THIRD palette; no brand mark or logo; the "Back to dashboard" link
undermines the lock; no forgot-password / restore link; no auto-lock
information anywhere.

`apps/web/src/screens/security-settings.tsx` (68 lines, read first-hand):
h1 "Security & backup" 24px semibold; "What this wallet does" card
(keys in memory only while unlocked); Vault lock card (locked → Unlock
link to /lock; unlocked → "Lock vault" button; note that locking clears
decrypted phrase/keys from memory); Backup procedure card linking to
`/mnemonic-backup`. **There is NO auto-lock setting anywhere yet — the
auto-lock control below is new.**

**Layout — top to bottom:**

**`lock.tsx`:** full-screen route with one centred, medium-max-width
Card (max-w-md, p-6 as now, but in tokens). Vault-present order:

1. Bawa brand mark and "Bawa Web Wallet". **COORDINATOR DECISION:** the
   brand mark is the existing header wallet-icon tile (36px rounded-xl,
   `--panel-accent-gradient`, Wallet lucide icon) — our own existing
   asset; no new mark is designed in this lane.
2. "Unlock your wallet", followed by: "Locked means derived addresses
   are hidden and signing is unavailable. Watch-only remains usable."
   (Sol B6 copy.)
3. Password field (Input h-12); optional BIP-39 passphrase field
   **only** when the vault was created with one.
4. Error line (`--destructive`, role=alert).
5. Full-width Unlock button (Button h-10).
6. "Forgotten password? Restore wallet" link (→ import/restore flow;
   do not promise password recovery).
7. Helper: "Auto-lock affects signing access, not watch-only use.
   Configure it in Security settings."

**`security-settings.tsx`:** "Lock after inactivity" Label and select;
helper explaining activity reset and watch-only availability; manual
**Lock now** Button at the bottom of this Security area. Do not
introduce another settings screen.

**Spacing / sizing / typography:** Inter; retain the centred,
medium-max-width card. Card width/padding, page margins, gaps,
control/mark dimensions, font sizes and weights: NOT SPECIFIED beyond
§1.2 component values — do not infer measurements from reference
wallets.

**Colour:** light card `--card`; light settings surfaces `--background`;
main text `--foreground`; supporting text `--muted-foreground`; borders
`--border`; primary action `--primary`; focus `--ring`; errors
`--destructive`. Dark lock backdrop: `--panel-surface`; keep card
content on the light surface.

**Behaviour and states:**

- **Wrong password:** display the vault's message and clear both
  password and passphrase fields.
- **Busy:** action reads "Unlocking…".
- **No vault:** show "Set up your wallet"; do not attempt to unlock a
  missing vault.
- **Success:** redirect to `/` (existing behaviour, keep).
  **COORDINATOR CORRECTION to Sol B6:** Sol wrote "unlock alone never
  authorises signing" (Rabby's pending-approval rule). In OUR app,
  unlocking restores vault access — decrypted phrase/keys return to
  memory and signing becomes possible (see security-settings copy:
  "Private keys are held in memory only while the vault is unlocked").
  The correct rule here is: unlocking restores vault access; it does
  not by itself sign or broadcast anything — each send still needs its
  own explicit review + **Sign offline**. No implicit broadcast.
- **Locked:** keep watch-only usable; hide vault-derived addresses and
  block vault-backed signing. Never force watch-only routes through
  `/lock`.
- **Auto-lock:** use the documented range **Immediately–1 day**
  (Phantom). **COORDINATOR PROPOSAL for the choices (not from a real
  wallet):** Immediately, 1 minute, 5 minutes, 15 minutes, 1 hour,
  1 day; default 5 minutes. Adopt Rabby's minutes preference, activity
  reset and restart-persisted deadline. (Rabby's code default is 0 in
  `preference.ts`, read first-hand; the settings UI choices were not
  read — do not copy numbers from Rabby.)
- **Manual lock:** applies the same vault restrictions while preserving
  watch-only access. Do not promise lock-on-close; Bawa browser-close
  handling is NOT SPECIFIED.

**REMOVE:** lock-screen slate-950/slate-900/slate-800 styling, "Back to
dashboard", and the bottom locked/no-vault banners in
`apps/web/src/screens/dashboard.tsx` (§5). Do not replace them with
another dashboard banner or an app-wide gate.

## 10. Consolidated REMOVE list (all screens)

- **Three palettes → one token set.** Every inline hex value
  (`#11172b`, `#18264a`, `#243454`, `#0b1326`, `#263454`, `#b4aaff`,
  `#aab5d1`, `#8b7cff`, `#4f7cff`, `#224f45`, `#94e1c3`, `#d6deed`,
  and the lock screen's slate-950/900/800 + sky-400) is deleted and
  replaced by §1 tokens. No screen keeps its own colours.
- **Home-screen lock / no-vault banners** (dashboard bottom) — gone;
  no-vault is the Welcome screen, locked is the `/lock` route.
- **"Back to dashboard" on the lock screen** — gone.
- **Watch-only as the import default** — restore is the default;
  watch-only is a labelled secondary tab, always labelled where it
  appears.
- **Ticker-letter avatar + duplicated ticker badge** (asset rows) —
  replaced by the real MIT chain logo (§6).
- **Chain display name in the symbol slot; network wording in the
  amount slot** (asset rows) — remapped per §6.
- **Bare "Hide zero balances" checkbox** — replaced by an
  `aria-pressed` Button/chip (§6).
- **Dark-navy receive wrapper + nested QR card + below-QR amount field
  + gradient selected pill** (§7).
- **Step list as the only create progress cue; address-dump success**
  (§3).
- **Any priced column, fiat total, unit price or percent change** —
  there is no price feed; never render one (§5, §6).
- **Any demo/fake data, testnet label, disabled-looking send, or
  broadcast affordance** — broadcast stays disabled (§8).
- **Copied branding, text or code** from any wallet (see §11).

## 11. Licences — what may be reused, what is reference-only

| Material | Licence (verified) | Status |
|---|---|---|
| Trust Wallet chain logos, `trustwallet/assets`, `blockchains/<bitcoin\|ethereum\|tron\|ton>/info/logo.png` | MIT | **MAY BE REUSED** with MIT attribution, copyright and licence notice. The only third-party asset Lane C copies. |
| Rabby patterns (`RabbyHub/Rabby`) | MIT, brand name/logo reserved | Patterns only. Code may be reused under MIT terms, but this spec re-implements patterns in our own code; **do not reuse the Rabby name or logo**. |
| MetaMask patterns (`MetaMask/metamask-extension`) | Custom ConsenSys licence, non-commercial only; no distribution / modification / derivative works except non-commercial use with prominent notice | **Patterns/inspiration only. Do not copy MetaMask code, text or assets.** |
| Phantom patterns | App/extension code not public | Help Center docs only; inspiration only. |
| Trust Wallet `wallet-core` (Apache-2.0), `tw-agent-skills` (MIT), `trust-connect-sdk` (Apache-2.0), `token-list` (Apache-2.0) | As listed | Reference-only for UI. `wallet-core` is already the signing engine under its own licence. |
| token-ui foundation (`consenlabs/token-ui`, MIT) | MIT | Owner-pre-approved Web component foundation (§1.2 components). Its demo `mock-data.ts` holds fake asset amounts only and must never be wired into a screen. |
| RainbowKit (MIT), ConnectKit (BSD-2-Clause) | As listed (prior lane, verified 2026-11-18) | Dapp-facing connection UI only; not cited for any screen here. |

A repo's code licence does not settle rights for separately hosted
Figma assets, screenshots or brand marks. No Figma/Dribbble/Behance
wallet kit is cited: the prior lane found only paid commercial mobile
kits, no open extension kit.

## 12. Open / not specified (Lane C confirms before building)

- Welcome: loading/empty/error presentation — the screen has no async
  state; confirm none is added.
- Create: button labels, transition gates, normalisation, focus
  movement, success exit destination — keep the existing flow's
  behaviour unless §3 states otherwise.
- Import: mode-switch input retention; "Done" destination after a
  successful import — keep existing behaviour; confirm.
- Dashboard: destination availability for the gated lock/no-vault
  states — Welcome for no-vault, `/lock` for locked (§5).
- Receive: Share payload/attachment/fallback/feedback; loading
  presentation; copy feedback; zero-amount acceptance.
- Send: Back's entry destination from the Chain step; warning
  acknowledgement/blocking policy; reserve/Max calculation inputs;
  signer mechanics and cancellation support.
- Lock: setup fields/actions and local restore route for the no-vault
  state; brand-mark asset (resolved in §9 as the existing header tile);
  auto-lock intermediate choices and default (coordinator proposal in
  §9 — owner/Lane C confirm); browser-close lock behaviour.
- Asset detail: Back target is the list (§6); detail-internal copy
  beyond the inventory in §6 was not specified by Sol — the inventory
  is in §6, use it.
- MetaMask onboarding paths: `ui/pages/onboarding` and
  `ui/pages/first-time-flow` both returned **404 from the GitHub API on
  2026-11-19** — the paths moved; no MetaMask onboarding path is cited
  in this spec.
- Backpack: no live source (GitHub API 404, 2026-11-18, prior lane).
  Excluded until reachable again.
- Phantom loading/error states and header-address display, Rabby ENS in
  header, Rabby auto-lock settings UI choices, MetaMask default
  auto-lock timeout: unverified (prior lane §9); not used as patterns.

## Appendix A — Verification log (first-hand, 2026-11-19)

| Source | Check | Result |
|---|---|---|
| `github.com/trustwallet` org | API `orgs/trustwallet/repos?per_page=100` | 200; 29 repos |
| Trust Wallet extension / web wallet | GitHub code search `org:trustwallet extension`, `org:trustwallet web wallet` | 0 results each |
| Trust Wallet iOS / Android | GitHub code search | Only `trustwallet/trust-web3-provider` |
| `trustwallet/wallet-core` | API contents `/`, `/wasm`, `/samples` | 200; lib only, no UI; wasm `index.ts` + tests |
| `trustwallet/assets` | API contents `blockchains/` (189), `blockchains/<bitcoin\|ethereum\|tron\|ton>/info` | 200; each has `info.json`, `logo.png`, `square_logo.png`; WETH `info.json` fields read |
| `trustwallet/tw-agent-skills` | API contents `/`, `/skills`; raw `README.md`, `skills/wallet/SKILL.md` | 200; 4 skills (api/mcp/sdk/wallet); `--auto-lock <minutes>`, `--read-only`, "Never give an agent your main wallet's recovery phrase" |
| `trustwallet/trust-connect-sdk` | API contents `/`, `/packages`; raw `README.md` | 200; CAIP SDK, packages core/namespaces/react/services/types/utils |
| `trustwallet/assets` + `tw-agent-skills` | API licence endpoints | 200; both MIT |
| MetaMask `ui/pages/home/home.tsx`, `coin-buttons.tsx`, `receive-modal.js`, `token-list.tsx`, `unlock-page.component.tsx`, `send/amount-recipient.tsx` | API contents, `main` | 200 each (re-verified; prior lane 2026-11-18) |
| MetaMask `ui/pages/onboarding`, `ui/pages/first-time-flow` | API contents | **404 both** — paths moved, not cited |
| Rabby `Dashboard/index.tsx`, `BalanceView.tsx`, `TokenItem.tsx`, `Receive/index.tsx`, `SendToken/index.tsx`, `Unlock/index.tsx`, `autoLock.ts` | API contents, `develop` | 200 each (re-verified; prior lane 2026-11-18) |
| Rabby `preference.ts` autoLockTime | raw file grep | Default 0 in code (`if (!this.store.autoLockTime) { this.store.autoLockTime = 0; }`); settings UI choices not read |
| `MetaMask/metamask-extension`, `RabbyHub/Rabby` licences | Prior lane verification log (2026-11-18) | MetaMask custom ConsenSys non-commercial; Rabby MIT + brand reservation |
| Phantom Help Center receive/send/auto-lock | Prior lane verification log (2026-11-18) | Articles 4406393831187, send-crypto-from-phantom-5530158379539, 28951350406803 live |
| Current screens at `f9512b4` | Read in worktree: welcome, dashboard, asset-rows, asset-list, asset-detail, create-wallet, import-wallet, mnemonic-backup, receive, send, send-review, lock, security-settings, app shell, globals.css, token-ui components | All read first-hand; line counts and defects recorded in §§2–9 |
| Token-ui component values | Read in worktree: button, card, input, step-card, action-bar, skeleton, tabs, asset-row, holding-card, checklist-card, bottom-sheet-modal | Values in §1.2 |

## Appendix B — Sol calls (all gpt-6.1-sol, API 1, via `mcp-chat-sol-api1.mjs`)

| Call | Prompt | Words | Output | Result |
|---|---|---|---|---|
| B1 | `lane/fix-perf-ui-b/b1-welcome-create.md` | 648 | `b1-out.md` (4,092 B) | Landed in 325,715 ms. Structure + sources good, no invented paths; thin on px values — values pass in §1.2. |
| B2 | `lane/fix-perf-ui-b/b2-import.md` | 588 | `b2-out.md` (4,318 B) | Landed in 416,273 ms. Restore-first, watch-only labelling, error copy. |
| B3a | `lane/fix-perf-ui-b/b3a-dashboard.md` | 628 | `b3a-out.md` (3,870 B) | Landed in 198,153 ms. Proposed hero 40px/48px (display-lg token); states explicit. |
| B3b | `lane/fix-perf-ui-b/b3b-assets.md` | 614 | `b3b-out.md` (3,916 B) | Landed in 421,139 ms. Row remap, MIT logo avatar, filter as chip. Local forwarder died mid-call (recovered via `run-forwarder.sh`); VM call unaffected. |
| B4 | `lane/fix-perf-ui-b/b4-receive.md` | 735 | `b4-out.md` (3,703 B) | Landed in 250,639 ms. Page (not modal), amount above QR, `--card` surface. |
| B5 | `lane/fix-perf-ui-b/b5-send.md` | 732 | `b5-out.md` (4,674 B) | Landed in 318,058 ms. Six-step indicator, Max preserves fee reserve, warnings only from real checks. |
| B6 | `lane/fix-perf-ui-b/b6-lock.md` | 808 | `b6-out.md` (3,870 B) | Landed in 242,459 ms. Lock route + auto-lock settings; B6's "unlock never authorises signing" corrected in §9 to our vault model. |

Full run log: `lane/RUN-LOG.jsonl` in this worktree (7 launched, 7
landed, 0 failed, 0 timeouts, no 402/403). Total Sol time ≈ 36 min.
No keys were printed or pasted. No wallet logic, vault, derivation or
signing was changed. No broadcast path was touched. No real crypto, no
seed phrases, no demo/fake data.
