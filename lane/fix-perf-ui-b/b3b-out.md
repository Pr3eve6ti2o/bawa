## Asset list + asset detail

**Scope.** Retain four native assets: BTC/ETH/TRX/TON, with per-chain detail. New layout/dimensions below are proposals, not wallet measurements; their presence in current code is UNCERTAIN.

### Primary patterns
- **List:** `MetaMask/metamask-extension`, `ui/components/app/assets/token-list/token-list.tsx`: TokenCell tap-to-detail, skeleton rows, genuine empty/collapse states. ConsenSys non-commercial licence; patterns only.
- **Detail:** Phantom Help Center, verified 2026-11-18: detail owns asset-scoped Send/Receive/Swap. Vendor documentation only; exact article title/URL UNCERTAIN. Reuse no vendor code, copy or branding; only the MIT logos below are permitted assets.

### Layout, spacing and typography
Inter throughout. Screen inset and section gaps: 16px. Card radius: 16px. Headings: 24px/600. Detail cards: 16px padding; list Card: no padding outside rows.

- **List order:** Assets heading → filter → Card containing native rows or an empty state. Keep BTC/ETH/TRX/TON order. Rows: minimum 68px high; 12px vertical/16px horizontal padding; 12px avatar/text gap. `symbol`: native ticker, 16px/600. `amount`: actual native quantity plus ticker, 14px/400. `detail`: existing network name, 12px/400, separately aligned right. Omit `value`: no fiat, unit price, percentage or monetary placeholder.
- **Avatar:** 40px circular native-chain logo replaces both ticker disc and duplicated badge. No native overlay; the caption provides network context. Use `trustwallet/assets`, `blockchains/<bitcoin|ethereum|tron|ton>/info/logo.png`, **MIT**; retain attribution, copyright and licence notice.
- **Filter:** “Hide zero balances” Button/chip: 44px high, 12px horizontal padding, 22px radius, 14px/500; toggle using `aria-pressed`, not a checkbox. Collapse confirmed zeros only. Do not expose dust filtering: threshold/support UNCERTAIN; no price feed exists.
- **Detail order:** 44px Back target → dark holding-card → asset-scoped actions → chain-breakdown Card. Hero order: 48px native logo → asset name, 24px/600, and network, 14px/400 → actual native quantity plus ticker, 32px/600. Action buttons: 44px high, 12px gaps. Breakdown sits below actions and shows only the selected chain’s actual native amount/network; no invented multichain total.

### Colour
Canvas `--background`; cards `--card`; text `--foreground`; captions `--muted-foreground`; dividers/unpressed filter border `--border`; actions/pressed filter `--primary` with `--card` text; focus `--ring`; errors `--destructive`.

Dark hero background: `NEW-TOKEN`, taking the existing shell’s dark-panel background. Exact shell token/value is UNCERTAIN; verify before implementation. Hero text uses `--card`, captions `--border`.

### Behaviour and states
- Row content is a full-width keyboard-accessible link to `/assets/<chain>`. Error Retry is a separate button, never nested inside the link. Back returns to the list. No list quick Send/Swap; interactive targets are at least 44px.
- **Loading:** 68px skeleton rows; structural detail skeletons, never a spinner covering the list.
- **Zero:** “Zero balance” in the amount line. Hide only confirmed successful zeros, never loading/errors. If all rows are filtered, show “No non-zero balances” and “Show all”, which clears the filter.
- **Error:** retain asset identity, “Balance unavailable” / “Could not load balance” and 44px Retry. Never substitute zero; Retry refetches that chain.
- Send/Receive/Swap capabilities and routing are UNCERTAIN. Expose only verified existing asset-scoped flows; omit unsupported actions. These screens never broadcast.

### REMOVE
Ticker disc/repeated badge; chain display name in the symbol slot; network wording in the amount slot; bare checkbox. Do not introduce priced columns, demo data or testnet. Detail-specific deletions are UNCERTAIN: its internal inventory was not supplied.