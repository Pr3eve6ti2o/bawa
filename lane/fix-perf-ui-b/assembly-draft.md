# Lane B assembly draft — sections written by the coordinator (first-hand)

## Trust Wallet GitHub findings (verified first-hand 2026-11-19)

Org `trustwallet`: 29 public repos (GitHub API, `orgs/trustwallet/repos`,
per_page=100, returned 29). GitHub code search: `org:trustwallet extension`
0 results, `org:trustwallet web wallet` 0 results; ios/android queries
return only `trustwallet/trust-web3-provider`. The consumer apps
(extension, iOS, Android, web wallet) are CLOSED-SOURCE — there is no app
UI repo or file to cite, and no Trust Wallet app screen is used as a
pattern source anywhere in this spec. (The prior lane, 2026-11-18, reached
the same conclusion; re-confirmed today.)

What IS public and interesting, each verified HTTP 200 today:

| Repo | Licence | What it is | Use in this spec |
|---|---|---|---|
| `trustwallet/wallet-core` | Apache-2.0 | Cross-platform crypto library (C++/Kotlin/Swift/WASM). `wasm/` holds `index.ts`, tests, package.json; `samples/` holds android/cpp/go/kmp/node/osx/rust/wasm — no UI sample. Already the rebuild's signing engine (4.9.3). | Engine confirmation only. No UI to take. |
| `trustwallet/assets` | MIT | Token/chain asset registry: 189 blockchains under `blockchains/`. Per asset: `blockchains/<chain>/assets/<address>/info.json` + `logo.png`. Native logos verified for all four of our chains: `blockchains/<bitcoin\|ethereum\|tron\|ton>/info/logo.png` (+ `square_logo.png`, `info.json`). WETH `info.json` fields verified: name, symbol, type, decimals, description, website, explorer, status, id. | REUSABLE with MIT attribution: real chain icons replace the ticker-letter chips (B3b). The one Trust Wallet asset Lane C may copy. |
| `trustwallet/tw-agent-skills` | MIT | 4 agent skills (`skills/api`, `mcp`, `sdk`, `wallet`). The wallet skill documents the `twak` CLI + MCP server: create wallet, balances, send, swap, onramp, history, alerts, DCA/limit orders, ERC-20 approvals, token risk. Flags: `--auto-lock <minutes>`, `--read-only` (signing tools neither listed nor callable), WalletConnect session resume. README: "Never give an agent your main wallet's recovery phrase." | Reference-only for UI. Directly relevant to Bawa as an AI Wallet Builder: Trust Wallet's own agent story is CLI-first + MCP + read-only mode. The minutes auto-lock and read-only mode are cited as patterns in B6. |
| `trustwallet/trust-connect-sdk` | Apache-2.0 | CAIP-compliant multi-chain wallet-connection SDK. Packages: core, namespaces, react, services, types, utils. Install: `@trustwallet/connect-react` + per-network packages (`connect-eip155-react`, `connect-solana-react`, `connect-bip122-react`). | Reference-only. Dapp-facing connect, not wallet UI. |
| `trustwallet/token-list` | Apache-2.0 | Token list data. | Reference-only. |
| `trustwallet/bip44-constants` | MIT | BIP-44 coin constants. | Reference-only. |

## The token spine (why the UI looks like a mock)

Read first-hand at f9512b4, the app runs THREE palettes at once:

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

That is the mock look: not one bad screen, but no shared surface. The
fix, before any screen is rebuilt: Lane C first adds ONE dark token set
to `globals.css` (the NEW-TOKEN names each section below proposes,
taking their values from the existing shell colours), then re-skins every
screen to tokens, then deletes every inline hex value. No screen section
below invents a colour; each names tokens only. The shell stays a dark
430px panel; the light tokens stay for the light theme.

## Values pass — concrete numbers from in-repo components (first-hand)

Every number below was read from the repo at f9512b4, not invented.
Lane C uses these where a Sol section says "not specified".

Type scale (`globals.css` lines 457–470): display-lg 40px/48px,
title-lg 28px/36px, title-md 24px/32px, title-sm 20px/28px, body-lg
16px/24px, body-md 14px/20px, body-sm 13px/20px. Font: Inter
(`--font-heading`), weights 400/500/600/700.

Components (`apps/web/src/ui/components/`):
- Button: h-10 (40px), px-4, rounded-full, body-md, focus ring 3px
  (`--ring` at 50%). Primary button shadow `--shadow-cta`.
- Input: h-12 (48px), px-4, rounded-md, body-md, `bg-input-background`.
- Card: rounded-xl, gap-6, header px-6/pt-6, title `text-title-sm`
  semibold; small variant gap-4, px-4/pt-4. Shadow `--shadow-card`.
- StepCard: flex gap-3, rounded-xl, p-4, 40px number circle
  (done: success bg; todo: `surface-blue-dim` bg + primary text),
  label semibold, detail muted, relaxed leading.
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

Current screens (keep unless a section says REMOVE):
- Action circles 56px, icons 24px, labels 11px semibold (dashboard).
- QR 192px on a white rounded-20 card with p-4 (receive).
- Asset avatar 40px circle; skeleton row 68px high (asset-rows).
- Shell: 430px max width, main px-5 pb-6, header px-5 pt-5 pb-4,
  header icon tile 36px rounded-xl, title 15px bold, Mainnet pill h-6
  px-3 10px bold.
- Chain colours (keep as data, not as text): BTC #f7931a, ETH #627eea,
  TRX #eb0029, TON #0098ea (`asset-rows.tsx` CHAIN_CHIP_COLORS).

Coordinator proposals (labelled as such in the spec, NOT from a real
wallet): 24-word grid = 3 columns x 8 rows of numbered word chips;
word chip = h-12, rounded-md, number muted + word semibold; step
progress = numbered circles 40px joined by a track (reuse StepCard
circles); dashboard hero = display-lg 40px/48px bold (Sol B3a proposal,
maps to the existing `--text-display-lg` token — supersedes the earlier
28px note); hero internal padding 20px, radius 16px; shell content inset
stays px-5 (20px) as built; receive QR stays 192px; lock card max-w-md
(448px) p-6 as now, but in tokens, not slate.

Dark token set for Lane C (values taken from OUR OWN existing shell
code, not invented — tokenising what is already there):
`--panel-surface` from `#0b1326` (dashboard panels),
`--panel-surface-raised` from `#243454` (cards/banners),
`--panel-border` from `#263454`, `--panel-text` from `#eff2fc`,
`--panel-text-muted` from `#aab5d1`, `--panel-text-soft` from `#c8d0e8`,
`--panel-accent` from `#b4aaff`, `--panel-accent-gradient` from
`#8b7cff → #4f7cff`, `--panel-success-pill-bg` from `#224f45` /
text `#94e1c3`, `--panel-icon-tile` from `#263451`. The lock screen's
slate-950/900/800 and sky-400 are deleted, not tokenised.

## Coordinator inventory notes (first-hand, fill Sol gaps)

Asset detail (`asset-detail.tsx`, 275 lines) — B3b was not given this
inventory, so record it here: h1 24px semibold (chain name) with Refresh
and Receive buttons; balance Card rounded-20 with skeleton h-8 w-48,
"Balance unavailable" 18px semibold + Retry; Recent transactions h2
18px semibold with skeleton h-24 or error + Retry; second Card with
truncated xpub (first 12 … last 8) + derivation-path text; derived
addresses h2 + list. REMOVE from detail: the hardcoded `#d6deed`
border; the derivation-path/xpub card stays but moves below actions
(B3b order: Back → holding-card → actions → breakdown). ADD: an
asset-scoped Send button — only Receive exists today; Swap stays
omitted (no engine support). The xpub/derivation card is honest
technical detail, keep it, but never show a full xpub on screen.

Security settings (`security-settings.tsx`, 68 lines): h1 "Security &
backup" 24px semibold; "What this wallet does" card (keys in memory
only while unlocked); Vault lock card (locked → Unlock link to /lock;
unlocked → "Lock vault" button; explanatory note that locking clears
decrypted phrase/keys from memory); Backup procedure card linking to
`/mnemonic-backup`. There is NO auto-lock setting anywhere yet — B6
specs it as new (timer choices: Phantom Immediately–1 day; Rabby
minutes preference, default 0 in code; twak `--auto-lock <minutes>`).

Mnemonic backup (`mnemonic-backup.tsx`, 131 lines): ChecklistCard,
per-chain list items rounded-lg border p-4, back-home link. Keep as the
backup-procedure screen; B1/B2 link to it.

## What the prior research missed (why it did not translate)

`panel-rebuild/ui-ux` commit 2298833 (2026-11-18) gave the layout page
real patterns (MetaMask home/send/receive/unlock, Phantom help docs,
Rabby dashboard/receive/send/unlock, all verified). It did not translate
because it specified STRUCTURE without a buildable surface: no typography
scale, no spacing scale, no colour tokens, no per-screen values — and it
covered only the layout page. Welcome, create, import, lock and the
send/review steps had no spec at all, so each lane re-invented its own
dark-navy styling inline. This spec closes that gap: every one of the
eight screens gets layout + spacing + type + tokens + behaviour + states
+ a REMOVE list, in values Lane C can type in without guessing.
