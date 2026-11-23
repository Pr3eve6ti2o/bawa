# UI/UX Fixes programme — 21 items (2026-11-23)

Owner order 2026-11-23 ~04:40 IST: 21 items, worked one by one and
reported per item. Coordinator `a8a711fd`, hands-on Muse, 0 Sol calls.
Branch `panel-rebuild/ui-ux-fixes`, branched from token-gaps `488f644`
and bringing devnet mode in from `panel-rebuild/devnet-temp`
(`8994584`). Merged into `panel-rebuild/token-gaps` by Lane E on
2026-11-23 (merge commit `4eb0242`). No code merged into
`panel-rebuild/adopt-proper` or `main` — those stay untouched for code.
Doc-only updates from this programme (item 21) were pushed to `main`
and every active remote branch the same day, per the owner's order.

## What was built

| # | Item | What changed |
|---|---|---|
| 1 | Sticky-section scroll bugs | Fixed: sections no longer break and drift with scrolling (dvh-based layout; Lane A — `app.tsx`, `asset-rows`, Receive/Send screens). Verified by scrolling every screen in CDP at 1919/1440/820/390. |
| 2 | Token display + devnet in wallet | Devnet sits in the wallet in the same place as mainnet: the header pill toggles Mainnet/Devnet and back, smoothly (Lane B — network-mode pill, Networks screen; devnet mode itself from `devnet-temp`). |
| 3 | Mobile UI/UX | Every section checked at 390/820 px (Lane A). CDP re-verification of the merged tree passed at 1919/1440/820/390 (coordinator). |
| 4 | Sharing | Sharing creates and shares the QR as an image, not just link + address — Web Share API files with a download fallback (Lane B; e2e `item4-qr-share.spec.ts`). |
| 5 | Import | 24-word and 25-word mnemonics in one section, not two (Lane C — `import-wallet.tsx`, `bip39-validation.ts`). |
| 6 | Same phrase, different wallet | Fixed: importing the same phrase offers a new account instead of failing or replacing the wallet (Lane C — `vault.ts`, `wallet-context.tsx`). |
| 7 | Bulk account creation | "Create wallet" button at the top where Account 1 is displayed, with a count (write 10 or 50); each new wallet is named Account 2, 3, 4… with distinct derived addresses (Lane C — `wallet-management.tsx`, `create-hub.tsx`). |
| 8 | Multichain vs HD | Both working: multichain (one address per chain) and HD (fresh address + QR per payment) (Lane C — `core.ts`, `chains.ts`). |
| 9 | Welcome | Rebuilt as an introduction explaining what Bawa is — a guide for humans and AI agents to create crypto/web/Android/HD wallets and smart contracts easily with a few prompts; other sections filled with proper writing; "create wallet" removed from the welcome section (Lane C — `welcome.tsx`). |
| 10 | "SOON" for the web wallet | Every instance found and fixed — the web wallet exists (Lane C). |
| 11 | Bug hunt | Bugs found across the app and fixed, including the price-blanking fix (Lane A — `prices.ts`, `token-prices.ts`). |
| 12 | Asset homepage | Balance, current value and current price display properly (Lane A — `asset-rows`, `token-prices.ts`). |
| 13 | Add Token | Every supported chain is now selectable (Lane B — `add-token.tsx`; e2e `item13-add-token.spec.ts`). |
| 14 | More chains | Trust Wallet Core 4.9.3 audited against the 13 chains in the registry; 9 supportable chains added: Scroll (534352), Mantle (5000), Metis (1088), opBNB (204), Aurora (1313161554), Fantom (250), Linea (59144), Celo (42220), Gnosis (100) (Lane B — `registry/capabilities.json`; e2e `item14-new-chains.spec.ts`). Which chains could not be added and why is not recorded in the repo — see "Still open". |
| 15 | Copy button on create wallet | Copy button added to the create (and import) flow — no more screenshotting the phrase (Lane C — `ui/components/copy-button.tsx`). |
| 16 | Watch wallet | Tracks other chains too, end to end (Lane C — SOL/DOGE adapters, `wallet-context.tsx`). |
| 17 | Multi-account without deleting | The "remove/delete your current account to create a new one" blocker is fixed; Account vs phrase vs HD vs multichain naming clarified (Lane C — `wallet-management.tsx`, `vault.ts`). |
| 18 | HD wallet | More chain support and more primary tokens, end to end (Lane B; e2e `item18-default-tokens.spec.ts`). |
| 19 | RPC backup/failover | Automatic failover plus manual custom RPC (https only, never keyed); a backup can be promoted to primary for one chain or for all chains; custom RPCs can be removed, all endpoints reset (Lane B — `RpcEndpointManager` in `network-selection.tsx`; e2e `item19-rpc-failover.spec.ts`; proven live in CDP per the coordinator). |
| 20 | Send + Receive stepped flow | Chain button → token button → amount + QR + address panel; multiple QR templates (main QR + small QRs, clicking a small one swaps it into the main slot); balance-aware token ordering, non-zero balances first (Lane A — `send.tsx`, `receive.tsx`). |
| 21 | Document everything | This file, the README section pointing at it, and `docs/DECISIONS.md` §10 (Lane E); propagated to `main` and the active remote branches (see below). |

## Gates — merged token-gaps tree (Lane E, first-hand, 2026-11-23)

Run on the merged tree (merge commit `4eb0242`), Node 22.23.4,
`apps/web`:

- `npx tsc --noEmit`: 0
- `npm run build`: 0 (palette audit passed)
- Full vitest: 86 files passed; 1644 tests passed, 5 skipped (1649 total)
- `npm run lint`: 0
- `npm audit`: 0 vulnerabilities
- Root `npm test`: 0 — after `npm ci` in `tools/hdwallet-gen`. The
  first attempt in the fresh worktree failed only because
  `node_modules` was absent there (`MODULE_NOT_FOUND`
  `@trustwallet/wallet-core`); not a code failure, and not waived —
  installed and re-run green.
- CDP re-verification (1919/1440/820/390, screenshots viewed) was done
  by the coordinator on `ui-ux-fixes` before the merge and passed; Lane
  E did not re-run CDP.

## Branch state (2026-11-23, after the merge)

| Branch | SHA | State |
|---|---|---|
| `main` | `ad77cce` | Untouched for code. Doc-only update from this programme (item 21). |
| `panel-rebuild/adopt-proper` | `67c48e2` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/desktop-layout-v2` | `bf00f54` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/devnet-temp` | `8994584` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/token-discovery` | `f76245a` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/token-gaps` | `4eb0242` | Merge of `ui-ux-fixes` into token-gaps. Contains all 21 items plus the token-gaps work (20 default tokens, Add Token, deep links/QR, watch wallet, SOL/DOGE live balances). Further work continues on top of token-gaps, per the owner's merge-destination decision (2026-11-23 ~05:11 IST). |
| `panel-rebuild/ui-ux-fixes` | `68fd75b` | Programme branch. Code complete; doc updates from item 21 pushed here first. |
| `gh-pages` | `ee63a13` | Pages site source. Not touched by this programme. |

Dead local-only lane branches (e.g. `panel-rebuild/uiux-a-layout`,
`uiux-b-chains`, `uiux-c-wallet`, the `fixgaps-*`, `layout-*`,
`multichain-*` and `adopt-proper-a/b/c/d` intermediates) were left
alone: they are superseded intermediates already merged upstream or
abandoned, they are not on the remote, and updating docs there would
serve nothing.

## Preview / Pages pointers

- Durable preview: GitHub Pages — https://pr3eve6ti2o.github.io/bawa/
  — serves the saved adopt-proper-based build. It does **not** include
  this programme: the UI/UX work lives on `panel-rebuild/token-gaps`
  only. To preview the programme, check out `panel-rebuild/token-gaps`
  and run the web starter locally (`apps/web`: `npm ci`, `npm run dev`).
- Pinggy free tunnels expire within about an hour and resolve
  IPv6-only; the owner's DNS cannot resolve them. Do not rely on a
  tunnel link as the durable preview.

## Still open

- E2E-03/06 need a stable-network run; non-zero DOGE watch-row render
  unproven; 1919 settled widths not captured (open from token-gaps).
- TON Issue 5 (first send from a fresh wallet cannot deploy — no state
  init in the signed BOC) and Issue 6 (`/track` cannot resolve the TON
  message hash shown as "Transaction") — see `DEVNET-ISSUES.md`. Both
  block mainnet TON behaviour too, not just devnet.
- Devnet exception E1 expires 2027-02-20 — renew or remove devnet by
  then (removal checklist in `docs/DECISIONS.md` §9).
- Mobile Receive screen 40 px shorter than the saved mobile build —
  DECIDED 2026-11-23 ~14:17 IST: the owner tapped "Keep the 40 px
  fix". The P8 dead-space removal stays; do not re-ask. (Reverify
  lane 1, 2026-11-23: the fix itself had been lost from the token-gaps
  tree by the Receive rework — restored in `receive.tsx`, see
  `docs/REVERIFY-CHECKLIST.md` item R-14.)
- Item 14 — chains added and why the rest were not (recorded by
  reverify lane 1, 2026-11-23; this closes the "not recorded in the
  repo" gap). Trust Wallet Core 4.9.3 lists 168 chains; the wallet
  enables 22. The 9 added by this programme, each with two
  independent keyless endpoints verified live (see
  `apps/web/src/wallet/chains.ts`):
  Scroll 534352 (scroll-rpc.publicnode.com, rpc.scroll.io), Mantle
  5000 (mantle-rpc.publicnode.com, rpc.mantle.xyz), Metis 1088
  (metis-rpc.publicnode.com, andromeda.metis.io), opBNB 204
  (opbnb-rpc.publicnode.com, opbnb-mainnet-rpc.bnbchain.org), Aurora
  1313161554 (mainnet.aurora.dev, 1rpc.io/aurora), Fantom 250
  (rpc.fantom.network, rpc2.fantom.network), Linea 59144
  (linea-rpc.publicnode.com, rpc.linea.build), Celo 42220
  (celo-rpc.publicnode.com, forno.celo.org), Gnosis 100
  (gnosis-rpc.publicnode.com, rpc.gnosischain.com). A chain was added
  only on that bar — two keyless endpoints, both answering live. The
  remaining Core chains were not added because they failed it: a
  single keyless endpoint, no keyless endpoint, a 403/401, or a dead
  provider (per the 2026-11-23 ~09:29 completion record). No
  per-chain enumeration of all 146 remaining chains was preserved in
  the repo, and none is invented here; re-auditing the full Core list
  is a separate job if the owner wants more chains.
- Out of scope, unchanged: M-39 (GUI TON withdrawal), broadcast
  authorisation (mainnet broadcast still disabled), Android Gradle
  build (no SDK/JDK on gray-pinee).

## Safety

No transfer, send or broadcast of real (mainnet) crypto in this
programme. No balances, prices or token metadata invented — every
number comes from a real source. No keyed/paid RPC or API used.
