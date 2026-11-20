Please write a desktop layout design spec for the Bawa web wallet. Be kind and clear, and keep it focused: a spec document only, no code in this call.

WHAT EXISTS TODAY (verified first-hand on 2026-11-20):
- React 19 + Vite 8 + Tailwind v4 app, apps/web in the Bawa repo. Branch panel-rebuild/desktop-layout, base multichain-create 40d8cc5.
- The app shell is a single centred column, max-width 430px, dark navy panel gradient, with a header (logo, "Bawa Web Wallet", account link, Mainnet pill) and a bottom tab bar (Home, Assets, Receive, Send, More menu with Wallets, Transactions, Track a transaction, Import wallet, Create wallet, Create, Security, Networks, Mnemonic backup, Welcome).
- Dashboard: portfolio-balance hero card, 3 action buttons (Send, Receive, Activity), Tokens/Activity tabs, asset list card, recent-activity list. All stacked in one narrow column.
- Create screen (/create): 7 tool cards in one vertical list (2 working: Multichain wallet, HD wallet; 5 build briefs).
- Track screen (/track): chain picker buttons, hash lookup form, result card, then a recent-activity-for-an-address section. All stacked.
- Design tokens already exist in src/ui/styles/globals.css: Bawa Balanced direction (direction-04 from the UI/UX catalogue), dark panel tokens (--panel-*), light/dark themes, Inter + Noto Sans. Do not invent a new palette.
- Chain logos are MIT Trust Wallet PNGs in src/assets (10 files, 3-34 KB each, shown at 40px). No new images, no new dependencies.
- Tests assert on text content (titles, labels), not on layout classes. Do not rename any route, label, or heading.

REFERENCE PATTERNS (from real wallet sites, patterns and structure only, never copy assets or text):
- Rabby (rabby.io + extension): total balance at top, action grid below, unified multi-chain dashboard, approvals/security shortcuts visible, DeBank-style portfolio overview.
- Phantom (phantom.com, 1280px page width, 72px header): balance at top, tabs for tokens/collectibles/activity, pill CTAs, editorial restraint, single accent colour.
- OKX Wallet web (web3.okx.com): top navigation with a Portfolio section, one-stop multi-chain/multi-wallet dashboard, PnL analysis as a web-only desktop view.
- Bitget Wallet: dashboard shows portfolio balance, asset list, recent transactions and quick Send/Receive together; navigation tabs separate assets, swap, NFT, discover.

YOUR SPEC MUST COVER, CONCRETELY:
1. Breakpoints (use Tailwind defaults where possible): phone (<768px), tablet (768-1023px), desktop (>=1024px), wide (>=1280px). State the max content width at each.
2. App shell: desktop sidebar (which nav items, in what order, icons from lucide-react already in the app) vs the existing bottom tab bar on phone. How the header changes on desktop. How the "More" menu items map into the sidebar. Keep every route reachable on both.
3. Dashboard desktop grid: portfolio hero + actions + assets + activity side by side where it makes sense (state exact grid columns per breakpoint). What stays stacked on phone.
4. Create screen: the 7 cards in a proper grid per breakpoint (state columns at each width).
5. Track screen: lookup form + result beside the recent-activity section on desktop; state the grid.
6. Other screens (welcome, asset list/detail, send, receive, transactions, wallets, security, networks, lock, import, create-wallet, mnemonic backup): one line each saying centred narrow column, full-width, or two-column, and why.
7. Mobile fallback rules: what must stay clean at 390px (no horizontal overflow, no clipped buttons, bottom nav reachable, tap targets >= 44px).
8. Performance rules: no new dependencies, no new raster images, CSS/SVG only, keep the 10.4 MB wallet-core WASM lazy-loaded off first paint (it already is; do not change that), keep lazy route chunks.
9. Accessibility: sidebar nav landmarks, active-state indication, keyboard focus visible, reduced-motion respected.
10. A short acceptance checklist I can verify with a build, vitest, and headless-Chromium screenshots at 1440px and 390px.

Do NOT propose: new colours, new fonts, new dependencies, new routes, renamed labels, copied logos/images/text from the reference wallets, or any change to balances, prices, derivation, vault, signing or broadcast behaviour. This is a layout change only.

Please write the spec as Markdown with short sections and a per-screen table. Thank you.
