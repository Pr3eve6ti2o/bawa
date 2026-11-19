## Dashboard

**Primary pattern + source.** Rabby’s summary-first, cache-preserving balance view: `RabbyHub/Rabby`, `src/ui/views/Dashboard/components/BalanceView/BalanceView.tsx` (`shouldShowBalanceLoading`). Borrow composition and loading rules, not its priced breakdown or curve. Balance-before-tabs also follows MetaMask’s `MetaMask/metamask-extension`, `ui/pages/home/home.tsx` and `account-overview-layout.tsx`. Independently implement; copy no third-party code, text, branding or assets.

### Layout
Retain the 430px shell and existing header. Top to bottom:
1. sr-only “Portfolio” heading.
2. Dark hero: label → prominent value → explanation → outline Refresh/Retry.
3. Equal-width Send / Receive / Activity actions.
4. Tokens / Activity pill tabs.
5. Selected panel.

Tokens show genuine holdings grouped by chain, with asset units—not USD ranking. Activity shows newest-first real transactions: date, textual status, amount with asset, and chain. Each unavailable chain gets its own “History unavailable” box and Retry; successful chains remain visible.

### Spacing, sizing and typography
These are **proposed Bawa dimensions**, not measured wallet values.

- Inter throughout; content inset 16px; section gaps 16px.
- Hero padding 20px; corner radius 16px.
- Hero label: 13px/18px, weight 500. Main value: **40px/48px, weight 700**. Explanation: 12px/18px, weight 400.
- Action circles: 56px; icons: 24px; labels: 12px/16px, weight 500.
- Tabs and buttons: minimum 44px height and 44×44px tap target.
- Activity rows: minimum 64px height, 12px padding; amount 14px/20px, weight 600; metadata 12px/16px, weight 400.

### Colour
Use `--background` for the screen; `--card` for rows/tab container; `--foreground` for text; `--muted-foreground` for metadata; `--border` for separators; `--primary` for action/selection accents; `--ring` for focus. Use `--success-text` and `--destructive` for status indicators alongside readable text, never colour alone.

Dark hero surface: **NEW-TOKEN**, a proposed semantic alias taking the shell palette’s existing `--foreground` colour—not a guessed dark value. Hero text uses `--card`; secondary text and outline use `--border`.

### Hero, behaviour and states
**Without a price feed, show exactly:**
- Label: “Portfolio balance”
- Main value: “Unavailable”
- Explanation: “No price feed connected — portfolio total unavailable”

Do not sum unlike asset units. No fiat total, unit price or percentage change. Only after a real feed is integrated may the hero display its currency-labelled fiat total; explicitly identify incomplete pricing coverage and stale data.

- **Initial loading:** skeletonise uncached panel rows; retain the known no-feed hero message.
- **Refreshing with cache:** retain settled hero text and rows; show “Refreshing” and prevent duplicate requests.
- **Error:** preserve cached data; show scoped error/Retry, including per-chain history failures. Never replace an error with zero.
- **Confirmed empty holdings:** “No tokens yet”; Receive remains available. Empty history: “No activity yet”. The unpriced hero remains “Unavailable”.

### Tap behaviour
Send/Receive open their respective flows; transaction rows open details. Existing handlers/routes are **UNCERTAIN**: verify integration, invent no paths. Activity selects the Activity tab; tab taps switch panels. Preserve arrows/Home/End keyboard navigation. Refresh reloads read-only holdings/history; per-chain Retry repeats only that failed request.

### REMOVE
Replace the 24px hero sizing and hardcoded colour values. Delete both home-screen lock/no-vault banners and their Unlock/Create/Import controls. Gate these states outside Dashboard into separate screens; destination availability is **UNCERTAIN**.

Real Mainnet data only: no demo/fake data, testnet or dashboard broadcasting.