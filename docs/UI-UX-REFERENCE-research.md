> NOTE: Historical layout-page UI/UX research, originally the repository-root UI-UX-REFERENCE.md on branch panel-rebuild/ui-ux (research dated 2026-11-18; gpt-6.1-sol; API 1), preserved here when that branch was retired. This document is distinct from the later eight-screen specification at apps/web/UI-UX-REFERENCE.md (2026-11-19), which governs the build. References here to untransferred lane/prompt and lane/sol files are historical pointers, not current dependencies.

# UI/UX Reference — Bawa wallet-panel rebuild (layout page)

- **Lane:** UI/UX research, `panel-rebuild/ui-ux`, worktree
  `/home/boxd/workspace/bawa-panel-rebuild/ui-ux/`, base `0759a81` on
  `feature/ai-wallet-builder`.
- **Date:** 2026-11-18. **Model:** gpt-6.1-sol, API 1 only. **Status:** research
  only — no `apps/web` code was edited in this lane.
- **Governs:** the layout page (main wallet screen) the fix lane will build on
  the chosen SDK/core around real wallet state (Mandatory Correction §5).
  This reference gives that lane concrete, citable patterns — not vague advice
  and not a mock.

## How to read this reference

- **VERIFIED FIRST-HAND** — I fetched the live source myself (GitHub API /
  raw file, Help Center article, store listing) on 2026-11-18 and quote the
  exact file path or URL. The fix lane may rely on these.
- **SOL (KNOWLEDGE)** — gpt-6.1-sol's answer from its own knowledge, with a
  CONFIDENT / UNCERTAIN flag per pattern. Sol has no browsing in-session, so
  these are leads: use only the ones marked VERIFIED FIRST-HAND below, or
  verify them yourself before building on them.
- **UNVERIFIED** — could not be confirmed; listed in §9, not used as a
  pattern.
- **Licence key.** Two different things: (1) *code reuse* — only code under a
  licence that permits it (Rabby MIT, token-ui MIT) may be copied; (2)
  *pattern inspiration* — layout ideas taken from a closed or
  non-commercially licensed UI must be re-implemented in our own code, with
  no copied assets, text, branding or code. MetaMask's licence forbids
  commercial derivative use; Phantom / Trust Wallet / Coinbase / OKX publish
  no extension UI code at all.

## What is being replaced (read first-hand, 2026-11-18)

Current panel at `0759a81`, `apps/web/src/screens/`:

| Screen | Current state — what is wrong with it |
|---|---|
| `dashboard.tsx` (192 lines) | Phantom *structure* copied, Bawa Balanced dark-navy tokens. Balance is the hardcoded fixture `$12,480.62` (`DEMO_PORTFOLIO.total`); change `+2.4% this week` is hardcoded. Four action tiles are single letters (S / R / A / I) in circles — Send, Receive, Activity, Import — no icons. Asset rows use a first-letter chip, not a token icon. A "Testnet status / ACTIVE" chip and a "Demo portfolio — testnet fixture figures" footnote sit on the home screen. Below the fold: per-chain derived-address cards with a Copy button, and a "Locked — derived addresses are hidden" box with a bare Unlock button. |
| `asset-list.tsx` (86 lines) | Same fixture balances per chain; sub-line is derivation status ("3 derived addresses · Testnet4") instead of a balance state. |
| `asset-detail.tsx` (149 lines) | "Demo balance" card, xpub shown truncated, derivation path shown, derived-address list with Copy per row. Loading skeleton exists; empty and error states exist. |
| `receive.tsx` (92 lines) | Chain pill row (BTC/ETH/TRX/TON), 192px QR on white card, full address in mono, Copy button. No amount / payment-request field. TON note points at docs. This is the closest to a real pattern — keep the shape, wire it to real state. |
| `send.tsx` (106 lines) | NOT IMPLEMENTED. A "Future procedure" card plus a *disabled* form (Recipient / Amount / Review) labelled "Sending is not implemented". A working-looking disabled send is exactly what §7 forbids carrying forward. |
| `wallet-management.tsx` (107 lines) | Per-chain xpub cards with "Forget stored key"; honest note that only xpubs are stored. No account name, no switching — one key per chain. |
| `security-settings.tsx` (67 lines) | "What this starter does not do" list (no mnemonic, no keys, no signing, no vault, no PIN). Lock is "a UI state only … NOT a security boundary". |

## 1. MetaMask extension — VERIFIED FIRST-HAND from live repo

- **Source:** `https://github.com/MetaMask/metamask-extension` (repo live,
  `main` branch, inspected 2026-11-18).
- **Licence:** custom ConsenSys licence (`LICENSE`, 3,585 bytes, "Copyright
  ConsenSys Software Inc. 2022. All rights reserved"). Non-commercial use
  only; no distribution / modification / derivative works except for
  non-commercial use with prominent notice; a fork with more than 10,000
  monthly active users needs a commercial agreement. **Patterns below are
  inspiration-only. Do not copy MetaMask code, text or assets.**
- **Sol call 1** (prompt `lane/prompt1-metamask.md`, 171 words) landed but
  returned no patterns: Sol stated it cannot access GitHub in-session and
  marked everything UNVERIFIED. **Sol call 1b**
  (`lane/prompt1b-metamask.md`, 158 words) is the knowledge-based re-ask; see
  §9 for its status. Every MetaMask pattern in this section is my own
  first-hand read of the files listed, not Sol output.

### (a) Account / header

- App header is a separate shell component, not part of the home screen:
  `ui/components/multichain/app-header/app-header.tsx` with
  `app-header-unlocked-content.tsx` and `account-name.tsx`. The header holds
  the account picker (account name + avatar, switches accounts) and the
  network pill selector (`ui/components/multichain/network-pill-selector/`,
  `network-list-menu/`). The home screen itself never re-implements account
  or network selection.
- Address copy is its own component:
  `ui/components/multichain/address-copy-button/`.
- **Take for the layout page:** header (account name + avatar + picker, network
  pill) lives above the home screen; the home screen starts at the balance.

### (b) Balance

- Home: `ui/pages/home/home.tsx` (307 lines). The home body is one
  component: `AccountOverview` (`ui/components/multichain/account-overview/`),
  then `HomeNotificationsContainer`, with `DappConnectionControlBar` pinned
  to the bottom.
- `account-overview-layout.tsx` order, top to bottom: `NetworkConnectionBanner`
  → hero balance (`children` = `EthOverview`) → `MoneyAccountBalance` →
  `Carousel` → `AccountOverviewTabs`.
- `EthOverview` (`ui/components/app/wallet-overview/eth-overview.js`) renders
  `CoinOverview` with the cached selected-account balance
  (`getSelectedAccountCachedBalance`, `isBalanceCached`) — i.e. MetaMask
  shows the last cached balance while a fresh one loads, it does not blank
  the hero.
- Tabs: `account-overview-tabs.tsx` — **Tokens / NFTs / DeFi / Activity**
  (tab keys seen in source: Tokens, DeFi; NFT and Activity tabs present in
  the same tab component). The token list is a tab, not a separate page.
- **Take:** balance hero first (fiat total, cached while loading), then action
  row, then a tabbed list (Tokens / NFTs / Activity). No separate "All chains"
  chip — the account is multichain by default.

### (c) Asset list

- `ui/components/app/assets/token-list/token-list.tsx`: rows are `TokenCell`
  with an `onClick` (tap → token detail). While loading it returns
  `TokenListLoadingSkeleton` (skeleton rows, not a spinner over the list).
  There is a `LowValueAssetsToggle` — low-value / dust holdings collapse
  behind an expandable toggle instead of cluttering the list. An
  empty-balance state exists ("Disable virtualization when empty balance
  state is shown").
- `TokenCell` cells (`ui/components/app/assets/token-cell/cells/`):
  `token-cell-title` (name/symbol), `token-cell-primary-display` (token
  balance), `token-cell-secondary-display` (fiat value),
  `token-cell-price` (unit price), `token-cell-percent-change`.
- **Take:** one row = icon + name/symbol + token balance + fiat value (+ unit
  price and % change where priced); tap opens the asset detail; skeleton
  rows while loading; dust collapsed behind a toggle; a real empty state.

### (d) Receive

- Receive is a **modal**, not a page: `ReceiveModal`
  (`ui/components/multichain/receive-modal/receive-modal.js`) opened from the
  action row. It renders `QrCodeView` (`ui/components/ui/qr-code-view/`)
  with the account name and address, plus the address-copy control.
  A dedicated QR modal also exists:
  `ui/components/multichain-accounts/address-qr-code-modal/address-qr-code-modal.tsx`.
- The extension also has a deeplink QR modal for incoming links
  (`ui/pages/home/deeplink-qrcode-modal-container.tsx`).
- No standard amount-bearing payment request in the extension receive flow:
  Sol 1b does not recall one and flags it UNCERTAIN — do not describe the
  basic address QR as an invoice with an embedded amount.
- **Take:** receive = modal over the home screen: QR (white card) + account
  name + full address + Copy. Chain is chosen before the modal opens (the
  address shown is the selected account's address for the active network).

### (e) Send

- Action row: `ui/components/app/wallet-overview/coin-buttons.tsx` —
  primary actions **Buy / Swap / Receive / Send** (labels `t('buy')`,
  `t('swap')`, `t('receive')`, `t('send')`), icon buttons with text labels
  (not letter tiles), plus a "More" overflow menu. Receive opens the modal;
  Send navigates to the send route.
- Send flow: `ui/pages/confirmations/components/send/` — one
  **Amount + Recipient** step (`amount-recipient/amount-recipient.tsx`):
  asset picker (`asset/`, `asset-list/`), network filter, recipient input
  (`recipient-input/recipient-input.tsx`) with validation
  (`useRecipientValidation`), an **address-poisoning alert**
  (`address-poisoning-alert-content/`) and a confusable-name check
  (`confusable-recipient-name.tsx`), amount input with validation
  (`useAmountValidation`, unreliable-RPC warning). Only then a confirmation
  screen (the confirmations flow) with fee preview.
- **Take:** Send = asset → recipient (validated, with poisoning/confusable
  warnings) → amount (validated, max) → **separate review/confirm screen**
  (destination, asset, amount, fee) → result. Never a single-screen form,
  never a disabled form pretending to be a send.

### (f) Lock / unlock

- Locked screen: `ui/pages/unlock-page/unlock-page.component.tsx` — branded
  password-entry view, `onSubmit(password)`, passkey unlock section
  (`UnlockPasskeyIconButton`, `UnlockPasskeySection`), reset-password modal,
  redirect-after-unlock. Forgotten password routes to the restore-vault
  route (`home.tsx`: `if (forgottenPassword) return <Navigate
  to={RESTORE_VAULT_ROUTE} />`).
- Auto-lock: Settings → Security & password → auto-lock sub-page
  (`ui/pages/settings/security-and-password-tab/auto-lock-sub-page.tsx`,
  `auto-lock-utils.ts`).
- **Take:** locked = full-screen password view that replaces the wallet (not
  a banner on the home screen); unlock with the vault password (or passkey);
  auto-lock is a settings value (timeout), not a home-screen control.

## 2. Phantom extension — SOL (KNOWLEDGE), VERIFIED against Help Center

- **Source status — VERIFIED FIRST-HAND:** Phantom's wallet app and
  extension code are **not public**. Its GitHub organisation holds SDKs
  (e.g. Phantom Connect SDK, MIT), demos, a scam blocklist and audit
  reports — no extension source. Confirmed by three independent reviews
  read 2026-11-18 (cryptoinfrastructure.io, skrumble.com, gemwallet.com).
  **All Phantom patterns below are therefore inspiration-only, sourced from
  vendor docs and published screenshots, never from code.**
- **Sol call 2** (`lane/prompt2-phantom.md`, 167 words) landed
  (8,199 bytes, 278,727 ms). Sol flagged each pattern CONFIDENT / UNCERTAIN;
  only CONFIDENT items are listed as patterns here, and each was checked
  against the Help Center articles below.
- **Verified sources:**
  - Receive: `https://help.phantom.com/articles/4406393831187` ("Receive
    tokens in Phantom", crawled 2026-11-18).
  - Send: `https://help.phantom.com/articles/send-crypto-from-phantom-5530158379539`
    ("Send tokens from Phantom").
  - Auto-lock: `https://help.phantom.com/articles/28951350406803` ("Turn on
    auto-lock in your Phantom app").
  - Store listing: official "Phantom" Chrome Web Store listing (screenshots
    — check before citing a layout from them).

### (a) Account / header — SOL CONFIDENT, partly verified

- Account identified by name/nickname; an account control/menu switches
  accounts (Sol CONFIDENT). **Multichain, not per-network:** the portfolio
  aggregates assets across supported networks; there is no MetaMask-style
  global network switch on the home screen — the relevant chain is selected
  through the asset or receiving-address context (Sol CONFIDENT; consistent
  with the Receive article: "Your Phantom wallet has a deposit address on
  each supported network").
- Truncated address permanently in the header: **UNCERTAIN** (Sol) — do not
  assume it. A multichain account has no single receiving address.
- **Take:** one portfolio across chains; chain choice happens per asset /
  per receive address, not via a global header switch. This matches the
  rebuild (BTC/ETH/TRX/TON in one wallet) better than MetaMask's
  network-pill model.

### (b) Balance — SOL CONFIDENT on settled states

- Prominent fiat portfolio total on the home screen, aggregated across
  networks (Sol CONFIDENT). Per-token fiat value beside the token quantity
  (Sol CONFIDENT).
- Zero balance: an unfunded account shows **$0.00**, with Receive/Buy
  available (Sol CONFIDENT).
- Loading and error states: **UNCERTAIN** (Sol) — no verified spinner /
  skeleton / error-banner pattern. Do not invent one; use MetaMask's cached-
  balance + skeleton pattern instead (§1b).
- **Take:** fiat total first; `$0.00` is the honest zero state (not "—" and
  not a fixture).

### (c) Asset list — SOL CONFIDENT

- Row = token icon + name/ticker + token quantity + fiat value where priced
  (Sol CONFIDENT). Tapping a row opens that asset's detail view, with Send /
  Receive / Swap actions there — it does not start a transfer (Sol
  CONFIDENT).
- NFTs/collectibles live in a **separate view**, presented visually, not as
  fungible-token rows (Sol CONFIDENT).
- **Take:** same row shape as MetaMask; detail view owns the actions.

### (d) Receive — VERIFIED FIRST-HAND from Help Center

- Extension flow (article 4406393831187): Home tab → **Receive** → select
  network → **copy button** copies the address, **QR code button** displays
  its QR code. "The sender needs your wallet address … and must send the
  crypto on the same network you select in Phantom." Each account has a
  different set of addresses on all supported networks; some networks share
  an address but the sender must still select the correct network.
- Home actions are four buttons: **Receive, Send, Swap, Buy** (confirmed by
  the Gate and Binance Phantom guides, 2026).
- **Take:** receive = network picker → address + Copy + QR button (QR on
  demand, not always visible). Warn that the sender must use the selected
  network even when addresses coincide across EVM chains.

### (e) Send — VERIFIED FIRST-HAND from Help Center

- Article send-crypto-from-phantom-5530158379539: recipient field accepts
  `@username or wallet` address, a **QR-code icon scans an address**, or pick
  from recently used / saved contacts / own accounts. Before sending:
  check the recipient's network, keep enough native token for fees, and
  **review address warnings** — "Phantom may warn you when sending to a new
  address. Continue only if you are sure the address is correct."
  Transactions are irreversible; sending to the wrong network/address fails
  or loses funds.
- Sol CONFIDENT: fee preview before authorisation (chain-specific estimate,
  not final), a review/confirm step (destination, asset, amount, fee), and
  an Activity/history route to transaction details and the block explorer.
  Submission is not proof of on-chain confirmation.
- **Take:** recipient input with QR-scan icon + contacts/recents; new-address
  warning; fee estimate on the review screen; result + activity entry after
  submission.

### (f) Lock / unlock — VERIFIED FIRST-HAND from Help Center

- Article 28951350406803, browser extension: avatar (upper left) →
  **Settings > Security & Privacy > Auto-Lock Timer**, duration from
  **Immediately** up to **1 day**; unlock by entering the password. Manual
  lock: avatar → Settings → scroll to bottom → **Lock Wallet**. Closing the
  popup is **not** a reliable lock (confirmed by the same article and by
  coinextra.net).
- **Take:** lock entry lives in Settings (avatar menu), not on the home
  screen; auto-lock is a timer setting (Immediately–1 day); locked screen =
  password entry; closing the popup ≠ locking — the rebuild must say so if
  its lock behaves that way.

## 3. Rabby extension — VERIFIED FIRST-HAND from live repo

- **Source:** `https://github.com/RabbyHub/Rabby` (repo live, `develop`
  branch, tree 3,794 entries, inspected 2026-11-18).
- **Licence:** MIT with a brand reservation (`LICENSE`, 1,197 bytes:
  "MIT License / Copyright (c) 2021-present Rabby / Brand name and logo of
  Rabby is copyright reserved. You can not use brand name or logo of Rabby
  for your re-publish software."). **Code may be reused under MIT terms;
  the Rabby name and logo must not be reused.**
- **Sol call 3** (`lane/prompt3-rabby.md`, 163 words) landed (6,287 bytes,
  282,682 ms). Sol's account agrees with the first-hand reads below; where
  Sol was UNCERTAIN (loading/empty/error details, ENS in header, exact
  timeouts), this section gives the file-level facts instead.

### (a) Account / header

- Home: `src/ui/views/Dashboard/index.tsx` renders `DashboardHeader` +
  `DashboardPanel` + `Settings`. **No global network selector governs the
  portfolio** — Rabby's portfolio is multichain; chain context is per
  flow (send/approval carry an explicit chain). Sol agrees and warns
  against asserting a persistent header chain dropdown.
- Account switching: `src/ui/views/AddressManagement/` (address list, sort,
  popup). Account label + shortened EVM address in the header (Sol
  CONFIDENT). ENS in the header: **UNCERTAIN** (Sol) — do not claim it.
- **Take:** multichain header (account label + short address + switcher),
  no global chain dropdown.

### (b) Balance

- `DashboardPanel` → `BalanceView`
  (`src/ui/views/Dashboard/components/BalanceView/BalanceView.tsx`):
  `BalanceLabel` (fiat total), `ChainList` (per-chain breakdown rows —
  chain logo + name + USD value, sorted by value descending), `CurveView`
  (portfolio-value curve thumbnail), `ZeroAssets` (zero state). Loading is
  handled explicitly: `shouldShowBalanceLoading` distinguishes
  balance-nil (no cached value → loading UI) from refresh-with-cache
  (keep showing the cached balance while refreshing) — the same
  cached-while-loading rule as MetaMask.
- **Take:** fiat total + per-chain breakdown list + zero-assets state;
  cached balance stays visible during refresh; loading UI only when there
  is nothing cached to show.

### (c) Asset list

- `src/ui/views/CommonPopup/AssetList/TokenItem.tsx`: 32px token logo with
  the **chain logo as a small badge overlaid bottom-right**, symbol (+
  `UnknownTag` for unknown tokens), protocol name, amount string, USD
  value, and **per-row quick actions** — `gotoSwap` and `gotoSend` buttons
  on the row itself. `TokenListEmpty.tsx` and `TokenListViewSkeleton.tsx`
  exist (empty + skeleton states).
- **Take:** chain-badge-on-icon is the clearest multichain row pattern of
  the three extensions — adopt it (icon + chain badge, symbol, amount, fiat,
  row tap → detail; optional quick Send/Swap on the row).

### (d) Receive

- `src/ui/views/Receive/index.tsx`: `QRCode` from `qrcode.react`, copy via
  `copyAddress`, `ChainSelectorModal` for the network, Gnosis Safe chain
  handling, and a **watch-mode alert** (`page.receive.watchModeAlert1/2`)
  when the account is watch-only. Same EVM address across EVM chains —
  selecting a network does not generate a different address (Sol CONFIDENT,
  consistent with the code).
- **Take:** receive = chain selector → QR + full address + Copy; show a
  watch-only alert when the account cannot sign (directly relevant: the
  rebuild's TON watch-only path needs this treatment, not a silent QR).

### (e) Send — Rabby's signature pattern

- `src/ui/views/SendToken/index.tsx`: `ChainSelectorInSend` (chain first),
  `TokenAmountInput` (amount + Max button), `GasLevel` selector,
  `SendReserveGasPopup`, recipient via `AddressInfoTo`, **recipient risk
  check** (`useAddressRisks`, `RiskType`, `sortRisksDesc`), confirm via
  `DirectSignToConfirmBtn`.
- Confirm/approval: `src/ui/views/Approval/` — **172 component files**,
  driven by a security engine (`useSecurityEngineStore`): per-action
  detail components (`Actions/Send.tsx`, `Swap.tsx`, `TokenApprove.tsx`,
  `ContractCall.tsx`, …). The approval screen shows **transaction
  simulation, estimated balance changes, and security/risk findings**
  before signing (Sol CONFIDENT). A successful check is not a guarantee of
  safety.
- **Take:** send = chain → asset → recipient (with address-risk findings)
  → amount → gas level → **approval screen with simulation + balance-change
  preview + risk findings** → sign. This pre-sign review is the pattern the
  rebuild's send (Mandatory Correction §3: "tx construction, fee estimation,
  chain-specific signing, broadcast behind explicit user approval") should
  follow most closely.

### (f) Lock / unlock

- `src/ui/views/Unlock/index.tsx`: branded unlock screen (logo +
  background), unlock types **Biometrics or Password**, `hasForgotPassword`
  state; a plain unlock is not consent to a pending sign/approval (the code
  binds an Unlock approval only after its unlock event is observed).
- Auto-lock: `src/background/service/autoLock.ts` — `autoLockTime`
  preference in **minutes**; `resetTimer()` on activity
  (`setLastActiveTime`); the lock deadline persists in MV3 session storage
  (`autoLockAt`) so a service-worker restart still locks on time.
- **Take:** full-screen branded unlock (password or biometrics); auto-lock
  = a minutes preference reset by activity, persisted across restarts.

## 4. Other major extensions — VERIFIED FIRST-HAND: no extension UI code

- **Trust Wallet:** extension and mobile apps are **closed**; only Wallet
  Core is public (`trustwallet/wallet-core`, Apache 2.0, latest release
  4.9.3, 2026-11-11 — already the rebuild's signing engine). No extension
  UI code to cite; UI patterns only from the Chrome Web Store listing and
  docs (inspiration-only). Note for the fix lane: Trust Wallet's extension
  v2.68 (Dec 2025) was a malicious build published with a leaked store API
  key — a reminder that the published build, not the source, is what users
  get.
- **Coinbase Wallet (Base app):** app and extension are **fully closed**;
  only `coinbase/coinbase-wallet-sdk` is public (MIT). Renamed "Base app"
  July 2025, back to "Coinbase Wallet" 10 Sept 2026. No extension UI code
  to cite.
- **OKX Wallet:** app and extension are **closed**; only the signing SDKs
  (`go-wallet-sdk`, `js-wallet-sdk`) are public. A 2023 press release
  saying OKX Wallet was "now open source" is superseded — September 2026
  reviews confirm the wallet itself is not public. No extension UI code to
  cite. Extension ID `mcohilncbfahbmgdjkbpemcciiolgcge` (per a 2026 review;
  secondary source).
- **Backpack (Coral):** **UNVERIFIED — do not cite.** The repo
  `coral-xyz/backpack` returned **HTTP 404 from the GitHub API on
  2026-11-18** (both the repo endpoint and the licence endpoint). Secondary
  sources disagree about it (GPL-3.0 in some, "Proprietary" in WalletGuard,
  "single commit, not production-ready" in others). Until the repo is
  reachable again, treat Backpack as having no citable live source.
- **OKX / Backpack patterns (SOL KNOWLEDGE only, call 4):** Sol describes
  the same general shapes as §1–§3 for both — multichain portfolio with a
  fiat total, icon/name/quantity/fiat rows, tap → asset detail, network-aware
  receive (address + QR + copy), send as asset → recipient → amount → review
  with fee estimate → approval, and a branded password unlock screen. All
  details (placements, zero/error/loading treatments, timeouts) are Sol
  UNCERTAIN and were **not** verified; they add no new pattern beyond §6,
  so §6 does not depend on them. Sol confirms Backpack's licence as unknown
  from memory, consistent with the 404 above.

## 5. Shared wallet UI/UX design resources — VERIFIED FIRST-HAND: none reusable

- Searched Figma Community / Behance / Dribbble / CodeCanyon for wallet UI
  kits, 2026-11-18. What exists is **commercial, paid, mobile-app** work,
  not open extension UI:
  - Crista — Crypto Wallet App UI Kit (Behance, by MunirSr, 180 screens,
    Figma, premium/paid). `https://www.behance.net/gallery/154070693/Crista-Crypto-Wallet-App-UI-Kit`
  - CoinSpace (CodeCanyon, $24), Binity (CodeCanyon, $24, Regular /
    Extended licence), PayBank (CodeCanyon, $19) — paid marketplace
    templates with React Native code; licences are paid marketplace
    licences, not open source.
- **No free, openly-licensed, extension-shaped wallet UI kit was found.**
  Do not buy or lift one; the extension patterns in §1–§3 are the source.
- **Citable component libraries with the wrong scope (Sol call 4 lead,
  licences VERIFIED FIRST-HAND):**
  - RainbowKit (`rainbow-me/rainbowkit`) — **MIT** (GitHub API, 2026-11-18).
    React wallet-connection UI: wallet chooser, account/address controls,
    connection status, network switching. Dapp-facing UI, **not** an
    extension portfolio/send/unlock design — do not cite it for the layout
    page's balance, send-review or lock screens.
  - ConnectKit (`family/connectkit`) — **BSD-2-Clause** (GitHub API,
    2026-11-18). **Sol said MIT; Sol was wrong — the licence is
    BSD-2-Clause, verified first-hand.** Same scope caveat as RainbowKit:
    connection/account modals, not a wallet shell or transfer workflow.
  - A WalletConnect pairing QR in these libraries is not a receiving-address
    QR; a repo's code licence does not settle rights for separately hosted
    Figma assets, screenshots or brand marks (Sol call 4).
- **Figma Community:** Sol recalls Reown/Web3Modal design-kit material
  (discovery: `https://www.figma.com/community`, `https://reown.com/`) but
  could not give a file permalink, uploader or licence — **LICENCE UNKNOWN,
  unverified lead only**. Its scope is wallet-selection/connection/pairing
  dialogs, not extension balance/send/unlock screens. Do not cite a file
  until a permalink, uploader and terms are established first-hand.
- **Dribbble/Behance:** Sol could not identify any specific qualifying
  extension-style post and its author; I found only paid mobile-app kits
  above. No Dribbble/Behance item is cited in this reference.
- **Already-selected foundation (prior lane, not this one):** `consenlabs/token-ui`
  (MIT, pin `6380d5d…`, verified first-hand 2026-11-10 by the research lane)
  is the owner-pre-approved Web component foundation: `apps/web` demo with
  a wallet dashboard, `packages/ui` with `asset-row`, `holding-card`,
  `bottom-sheet-modal`, `action-bar`, `checklist-card`. It is a component
  library, not an extension UI — the fix lane builds the §6 layout from
  token-ui components following the extension patterns in this reference.
  Its demo `mock-data.ts` holds fake asset amounts only and must be replaced
  by the real engine boundary (same rule as §7).

## 6. Consolidated pattern list for the layout page

The main wallet screen, in order, following the extensions. Each item names
its source; the fix lane implements each against real wallet state
(Mandatory Correction §5) — a state with no data shows its honest
loading/zero/error treatment, never a fixture.

1. **Header (above the home screen)** — account avatar + name + account
   switcher; network/chain indicator only where the wallet is single-chain
   at a time (MetaMask). For our multichain wallet, follow Phantom/Rabby:
   no global chain switch in the header; chain is chosen per asset and per
   receive address. Address-copy control in the header (MetaMask).
2. **Balance hero** — fiat total, large, first on screen (all three). Show
   the last cached balance while a fresh one loads (MetaMask
   `isBalanceCached`, Rabby `shouldShowBalanceLoading`); skeleton rows only
   when nothing is cached. Zero state is an honest `$0.00` with Receive/Buy
   available (Phantom), or Rabby's `ZeroAssets` view — never "—" and never a
   fixture. A failed fetch is an error state with retry, never rendered as
   $0.00 (all three: Sol CONFIDENT for Rabby/Phantom; MetaMask
   `NetworkConnectionBanner` for connectivity).
3. **Action row** — icon buttons with text labels, in this order:
   **Send, Receive, Swap, Buy** (Phantom home order; MetaMask Buy/Swap/
   Receive/Send; Rabby Swap/Send/Bridge/Receive). Our four: Send, Receive,
   Swap (if the engine supports it — otherwise omit, do not show disabled),
   Buy (only if a real on-ramp exists — otherwise omit). No letter tiles, no
   "Import" as a home action (import belongs in wallet management / onboarding).
   Rabby adds Bridge and Transactions to the same row family; Activity lives
   under the tabs (see 4).
4. **Tabbed asset area: Tokens / NFTs / Activity** (MetaMask tabs; Phantom
   separate collectibles view). Tokens tab = asset list (see 5). NFTs are a
   separate visual view, not token rows (Phantom). Activity = transaction
   history with explorer links (Phantom, Rabby).
5. **Asset rows** — token icon (32px) with a **chain badge overlaid
   bottom-right** (Rabby — the clearest multichain row); name/symbol; token
   balance (primary); fiat value (secondary); unit price and % change where
   priced (MetaMask `TokenCell`). Tap → asset detail (all three); detail
   owns Send/Receive/Swap for that asset. Optional quick Send/Swap buttons
   on the row (Rabby). Loading = skeleton rows (MetaMask, Rabby). Dust /
   low-value holdings collapse behind an expandable toggle (MetaMask
   `LowValueAssetsToggle`). Empty list = a real empty state, not a fixture.
6. **Per-chain breakdown** — Rabby's `ChainList`: chain logo + name + USD
   value per chain, sorted by value descending. Use it inside the Tokens tab
   or the asset detail, so a user can see where value sits across BTC/ETH/
   TRX/TON.
7. **Receive (modal over home, MetaMask; or dedicated flow, Phantom/Rabby)**
   — chain selector first (our chains have different addresses); then QR on
   a white card + account name + **full address** + Copy button. QR may be
   behind a QR button (Phantom) but must be one tap away. Show a watch-only
   alert when the account cannot sign (Rabby `watchModeAlert`; our TON
   watch-only path). Warn that the sender must use the selected network even
   when addresses coincide across EVM chains (Phantom, Rabby).
8. **Send (multi-step, never a single form)** — (i) chain, then asset;
   (ii) recipient: address input with validation, **QR-scan icon** (Phantom),
   recents/saved contacts/own accounts, and warnings for new addresses
   (Phantom), address-poisoning and confusable-name alerts (MetaMask),
   recipient risk findings (Rabby); (iii) amount: input + Max, validated
   against balance, with gas-reserve handling (Rabby `SendReserveGasPopup`);
   (iv) **review/confirm screen**: destination, asset, amount, **fee
   estimate** (chain-specific, labelled as an estimate), plus simulation /
   balance-change preview and risk findings (Rabby Approval); (v) result:
   submitted/pending/confirmed are distinct states, with transaction hash
   and explorer link, and an Activity entry (Phantom, Rabby). Submission ≠
   confirmation. Broadcast stays behind explicit user approval (Mandatory
   Correction §3).
9. **Lock / unlock (full screen, never a home-screen banner)** — branded
   password-entry view replacing the wallet (MetaMask unlock page, Rabby
   Unlock, Phantom lock screen); unlock with the vault password (or
   passkey/biometrics where supported); forgotten password → restore flow
   (MetaMask `RESTORE_VAULT_ROUTE`). Manual lock in Settings (Phantom:
   avatar → Settings → Lock Wallet; Rabby: manual lock + auto-lock).
   Auto-lock = a **settings timer** (Phantom: Immediately–1 day; Rabby:
   minutes preference, reset on activity, persisted across restarts;
   MetaMask: Security & password → auto-lock sub-page). Closing the popup
   is **not** a lock — say so in the UI if that is our behaviour.
10. **Notifications / connection state** — MetaMask shows a network-connection
    banner and a dapp-connection control bar; Rabby shows recent connections.
    The layout page needs a visible "connected site" state and a network
    error state, not a silent failure.

## 7. What NOT to copy

Anything below conflicts with the Mandatory Correction. The fix lane must
remove it, not restyle it.

- **Demo balances.** `DEMO_PORTFOLIO.total` `$12,480.62`, change `+2.4% this
  week`, and the per-asset fixtures (BTC `0.084` / `$5,180`, ETH `1.42` /
  `$4,240`, TRX `1,200` / `$2,060`) in `apps/web/src/state/demo-fixtures.ts`
  — delete the file's use from every screen. No hardcoded total, no
  hardcoded per-asset value, no hardcoded change %.
- **Testnet labels as identity.** "Testnet4 / Sepolia / Nile" networks and
  the "Testnet status / ACTIVE" chip on the dashboard. Mainnet only
  (Mandatory Correction §3); a network label, if shown, must name the real
  network the address belongs to.
- **A working-looking disabled send.** `send.tsx`'s disabled Recipient /
  Amount / Review form and its "Future procedure" card. Either send works
  end-to-end (per §6 item 8) or the entry point is absent — never a disabled
  form that looks like a send.
- **Letter-tile action buttons.** Single letters (S/R/A/I) in circles. All
  three extensions use icon + text label.
- **The dark-navy mock as a whole.** The `dashboard.tsx` structure
  (balance → letter tiles → asset list → testnet chip → address cards →
  disclaimer footnote) and the Bawa Balanced dark-navy tokens are the
  rejected mock. The replacement follows §6; visual tokens come from the
  chosen foundation (token-ui), not from the mock.
- **Watch-only presented as a wallet.** Per-chain derived-address cards and
  "No wallets yet — import a watch-only wallet" as the home empty state.
  The home empty state is the real onboarding (create / import / restore),
  and a watch-only account is labelled watch-only wherever it appears
  (Rabby's watch-mode alert is the model).
- **Lock as a UI banner.** The dashboard's "Locked — derived addresses are
  hidden" box and `security-settings.tsx`'s "Locking is a UI state only —
  NOT a security boundary". Lock must be the vault lock (§6 item 9).
- **Copied branding, text or code.** MetaMask's licence forbids commercial
  derivatives; Rabby's licence forbids reusing its name/logo; Phantom,
  Trust Wallet, Coinbase and OKX publish no UI code. Re-implement every
  pattern in our own code with our own copy.
- **A global chain switch for a multichain portfolio.** MetaMask's network
  pill belongs to a single-network-at-a-time wallet. Our wallet holds
  BTC/ETH/TRX/TON together (Phantom/Rabby model) — do not put a global
  chain dropdown on the home screen.

## 8. Screen map: current panel → replacement

| Current screen | Replacement, per §6 |
|---|---|
| `dashboard.tsx` | Layout page: header (§6.1) + balance hero (§6.2) + action row (§6.3) + Tokens/NFTs/Activity tabs (§6.4) + asset rows (§6.5) + per-chain breakdown (§6.6). No fixture, no testnet chip, no address cards, no lock banner. |
| `asset-list.tsx` | Tokens tab of the layout page (§6.4–6.5). Delete as a separate screen unless the fix lane needs a full-page list. |
| `asset-detail.tsx` | Asset detail: icon + chain badge, real balance + fiat + price + % change, derived addresses for that chain with Copy, Send/Receive/Swap for that asset, Refresh. Keep its loading/empty/error states; wire them to real data. |
| `receive.tsx` | Receive modal/flow (§6.7). Keep the chain pills + QR + address + Copy shape; add an amount/payment-request field only if the engine supports it; add the watch-only alert for TON. |
| `send.tsx` | Full send flow (§6.8). Delete the disabled form entirely. |
| `wallet-management.tsx` | Accounts view: account name + address + chain, switcher, add/import, forget. One account holds all chains (Phantom/Rabby model), not one xpub card per chain. |
| `security-settings.tsx` | Security view: vault lock/unlock state, auto-lock timer setting, manual Lock, backup/recovery-phrase procedure. Lock is the real vault lock. |

## 9. Open / unverified

- **Sol call 1b (MetaMask, knowledge-based)** — landed (9,818 bytes,
  297,283 ms). Its patterns agree with the first-hand reads in §1 (account
  picker, truncated address + full-address copy, row → detail, receive
  address + copy + QR, send recipient/amount/fee-preview/confirm,
  submitted ≠ confirmed, password unlock, popup closure ≠ lock). Two of
  its recalled paths are stale (`ui/pages/send/`,
  `ui/components/app/asset-list/` — send now lives under
  `ui/pages/confirmations/components/send/`, the list under
  `ui/components/app/assets/token-list/`), which is why §1 uses the live
  files. Its "no standard amount-bearing payment request" note is folded
  into §1(d).
- **Sol call 4 (other extensions + design resources)** — landed (11,898
  bytes, 543,161 ms). Its OKX/Backpack patterns are folded into §4 and its
  library leads into §5 (with the ConnectKit licence corrected first-hand
  from MIT to BSD-2-Clause). Its Figma/Dribbble/Behance leads produced no
  citable item.
- **Phantom loading/error states** — Sol UNCERTAIN, no Help Center article
  found describing them. Use MetaMask/Rabby cached-balance + skeleton
  instead (§6.2).
- **Phantom header address display** — Sol UNCERTAIN whether a truncated
  address is permanently shown. Do not assume it.
- **Rabby ENS in header** — Sol UNCERTAIN. Do not claim it.
- **Rabby auto-lock default timeout and interval choices** — the code shows
  a minutes preference (`autoLockTime`) but the default value and the
  settings UI choices were not read; verify in `src/background/service/preference.ts`
  and the settings view before copying numbers.
- **MetaMask default auto-lock timeout** — same: the sub-page exists, the
  default was not read.
- **Backpack** — no live source (GitHub API 404, 2026-11-18). Excluded until
  reachable again.
- **Coinbase/OKX/Trust Wallet extension UI** — closed; patterns only from
  store screenshots and docs, not verified at screen level. Not used as
  pattern sources in §6.
- **No shared open wallet-UI kit** — none found (§5). If the fix lane finds
  one, it must record its URL and licence here before using it.

## Appendix A — Verification log (first-hand, 2026-11-18)

| Source | Check | Result |
|---|---|---|
| `github.com/MetaMask/metamask-extension` | GitHub API `repos/.../license` + raw `LICENSE` | 200; custom ConsenSys non-commercial licence, 3,585 bytes |
| MetaMask `ui/pages/home/home.tsx` | raw file, `main` | 200; 307 lines; AccountOverview + notifications + DappConnectionControlBar |
| MetaMask `account-overview-layout.tsx` | raw file | 200; balance hero → MoneyAccountBalance → Carousel → Tabs |
| MetaMask `coin-buttons.tsx` | raw file | 200; Buy/Swap/Receive/Send + More menu |
| MetaMask `receive-modal.js`, `qr-code-view` | tree + raw file | 200; modal with QrCodeView + account name |
| MetaMask `token-list.tsx`, `token-cell/cells/` | raw file + tree | 200; skeleton, low-value toggle, empty state; title/primary/secondary/price/%-change cells |
| MetaMask `unlock-page.component.tsx` | raw file | 200; password submit, passkey section, reset modal |
| MetaMask `send/amount-recipient.tsx`, `recipient-input`, `amount` | raw file + tree | 200; Amount+Recipient step, poisoning alert, confusable-name check, amount validation |
| MetaMask auto-lock sub-page | tree | exists under `ui/pages/settings/security-and-password-tab/` |
| `github.com/RabbyHub/Rabby` | GitHub API `repos/.../license` + raw `LICENSE` (`develop`) | 200; MIT + brand-name/logo reservation, 1,197 bytes |
| Rabby tree (`develop`) | git trees API recursive | 200; 3,794 entries, not truncated |
| Rabby `Dashboard/index.tsx`, `DashboardPanel/index.tsx`, `BalanceView/*` | raw files | 200; header+panel; Swap/Send/Bridge/Receive/Transactions; BalanceLabel/ChainList/CurveView/ZeroAssets; cached-while-loading logic |
| Rabby `TokenItem.tsx` | raw file | 200; 32px logo + chain badge, symbol, protocol, amount, USD, row quick actions |
| Rabby `Receive/index.tsx` | raw file | 200; qrcode.react QR, copyAddress, ChainSelectorModal, watch-mode alert |
| Rabby `SendToken/index.tsx` | raw file | 200; chain selector, amount+Max, GasLevel, reserve-gas popup, address risks, confirm button |
| Rabby `Approval/` | tree | 172 component files; security-engine store |
| Rabby `Unlock/index.tsx`, `background/service/autoLock.ts` | raw files | 200; Biometrics/Password unlock, forgot-password; minutes preference, activity reset, MV3 persistence |
| `github.com/coral-xyz/backpack` | GitHub API repo + licence endpoints | **404 both** on 2026-11-18 |
| Phantom closed source | web search, 3 independent reviews | app/extension code not public; SDKs + blocklist + audits only |
| Phantom Help Center receive/send/auto-lock | web search (crawled 1–3 h before reading) | articles 4406393831187, send-crypto-from-phantom-5530158379539, 28951350406803 live |
| Trust Wallet closed apps / Wallet Core Apache 2.0 | web search, multiple reviews | apps closed; Wallet Core public, 4.9.3 |
| Coinbase Wallet closed | web search | app + extension closed; SDK MIT |
| OKX Wallet closed | web search | app + extension closed; SDKs public; 2023 "open source" release superseded |
| `github.com/rainbow-me/rainbowkit` | GitHub API licence endpoint | 200; **MIT** (Sol correct) |
| `github.com/family/connectkit` | GitHub API licence endpoint | 200; **BSD-2-Clause** — Sol said MIT; corrected first-hand |
| Figma/Behance/CodeCanyon wallet kits | web search | only paid commercial mobile kits (Crista, CoinSpace $24, Binity $24, PayBank $19); no open extension kit |

## Appendix B — Sol calls (all gpt-6.1-sol, API 1, via `mcp-chat-sol-api1.mjs`)

| Call | Prompt | Words | Output | Result |
|---|---|---|---|---|
| 1 | `lane/prompt1-metamask.md` | 171 | `lane/sol1-metamask.md` (1,538 B) | Landed in 59 s; **no patterns** — Sol cannot browse in-session, marked all UNVERIFIED. Honest refusal; kept as the record. |
| 1b | `lane/prompt1b-metamask.md` | 158 | `lane/sol1b-metamask.md` (9,818 B) | Landed in 297,283 ms; agrees with first-hand §1; two recalled paths stale (see §9); "no amount-bearing payment request" folded into §1(d). |
| 2 | `lane/prompt2-phantom.md` | 167 | `lane/sol2-phantom.md` (8,199 B) | Landed in 278,727 ms; CONFIDENT/UNCERTAIN flags used in §2. |
| 3 | `lane/prompt3-rabby.md` | 163 | `lane/sol3-rabby.md` (6,287 B) | Landed in 282,682 ms; agrees with first-hand reads in §3. |
| 4 | `lane/prompt4-others.md` | 176 | `lane/sol4-others.md` (11,898 B) | Landed in 543,161 ms; OKX/Backpack patterns folded into §4, library leads into §5 (ConnectKit licence corrected first-hand). |

Full run log: `RUN-LOG.jsonl` in this worktree. No 402/403 occurred. No
keys were printed or pasted. No wallet, seed or funds were touched.
