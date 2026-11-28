# UI/UX Round 2 programme — 10 items (2026-11-23)

Owner order 2026-11-23 ~15:28 IST: 10 items, worked one by one and
reported per item. Coordinator `7a83a6c9`, hands-on Muse, 0 Sol calls.
Branch `panel-rebuild/ui-ux-round2`, branched from token-gaps `231ecbf`.
Merged into `panel-rebuild/token-gaps` by Lane E on 2026-11-23 (merge
commit `6147b74`). No code merged into
`panel-rebuild/adopt-proper` or `main` — those stay untouched for code.
Doc-only updates from this programme (item 10) were pushed to `main`
and every active remote branch the same day, per the owner's order.

## What was built

| # | Item | What changed |
|---|---|---|
| 1 | QR card + QR auto-select | Receive shows the QR as a card: QR, amount, full address, token name with chain plus both logos (`usdc (base)`). Share and Download send the card as a 640 px PNG. Scanning a payment QR on the asset step auto-selects chain, token, amount and address; a QR for a chain with no wallet here says so instead of doing nothing. Lane A2, commit `95cad71`, merged as `5b91e2d`. Verified in CDP at 1440 and 390, including a Base USDC EIP-681 QR landing on the amount step with all four fields filled. |
| 2 | Shared-link deep-link fix | The owner's failure reproduced first: a cold open of a `/send?chain=eth&to=...&amount=0.5` link with no wallet, or a locked vault, dropped the link silently. Now the link is kept while the wallet is locked or missing, the panels name the pending payment, the create-wallet ready screen offers "Continue to your send", and a wallet chooser appears when there is more than one vault account. The share link also keeps the `/bawa/` subpath, and the router has the matching basename. Lane B, commit `c6b1a5e`, merged as `15e33fb`. Verified in CDP, five runs (V1 to V5), fresh profiles at 390 px, including the subpath build. |
| 3 | Watch wallet | The horizontal chain sliding is gone. A search bar shows all chains on click, and picked chains stay in a Recent row right below the search. Lane C, commit `4d8afff`, the base the other lanes built on. Verified in the merged-tree CDP: searching "sol" filters to Solana, and the Recent row persists across reload. |
| 4 | Font change | Caveat, a handwriting script, is gone from headings, card and dialog titles, the 24 recovery-phrase words and the token-logo symbols. The display face is now Baloo 2, self-hosted, with Inter as the body font. The wider face broke the recovery-phrase word grid, so the grid went from 3/4 columns to 2/3, with smaller words and tighter cells; all 24 words are fully visible at 390 and 820 px, with nothing truncated. Lane C2, commit `30e2819`, merged as `8c6e860`. Verified in CDP at 390 and 820. |
| 5 | Copy rewrite | Main titles and descriptions rewritten in plain human en-GB across 20 screens. Em dashes joining two sentences became full stops, trailing pile-ons were cut, redundant paragraphs went, and security wording kept every fact. Error and toast strings were left alone: their dash is a cause-to-remedy separator, not an AI tell. Lane C2, commit `30e2819`, merged as `8c6e860`. 29 test assertions updated to the new copy. |
| 6 | Devnet prices | Devnet showed no token prices because both price hooks no-opped entirely in devnet mode. The fetch gate is lifted: live per-unit prices show in devnet (proven live in CDP, `$61,436.00 per BTC`, `$1,725.71 per ETH`), while fiat valuation of test balances stays suppressed at the display layer, so a funded test wallet never shows an invented dollar value. Lane D2, commit `d370c58`, merged as `3522f0e`. |
| 7 | Mobile layout pass | Inputs are 16 px on coarse pointers so iOS Safari does not zoom on focus and never zoom back out; desktop keeps 14 px. The viewport meta gains `viewport-fit=cover` so the safe-area inset the bottom nav already used takes effect. Tap highlight, touch action and button text selection follow mobile-native practice. Lane D1 fixed Mnemonic backup density and the Import watch-only chain search; Lane D2 did the rest. Commit `d370c58`, merged as `3522f0e`, plus Lane E's port of D1's mnemonic work in `d01a603`. Every screen checked at 390 px, no horizontal overflow anywhere. |
| 8 | Send + Receive no-scroll stepped flow | Send is now chain, token, address plus amount in one step, review, sign, result. Receive is network grid, token, amount plus QR. Each picker step fits a 390 by 844 viewport with no scroll; on the details steps every forward control sits above the fold and only safety copy scrolls. The Receive tagline was removed from the screen to make the steps fit. Lane D2, commit `d370c58`, merged as `3522f0e`. Verified in CDP with measured scroll heights per step. |
| 9 | Scan icon | A scan icon matching the owner's reference (black disc, white corner brackets, centre line) replaces the "Scan QR" text button on Send, 44 by 44. The scanner panel gains "Upload a QR image" as a fallback, and a camera failure no longer closes the panel: the note shows inline and the upload stays available. Lane A, commit `1d433f8`. Verified in CDP at 1919/1440/820/390, including an uploaded QR prefilling the recipient and amount, and a blank image reporting "No QR code found in that image." |
| 10 | Document everything | This file, the README section pointing at it, and `docs/DECISIONS.md` §11 (Lane F); propagated to `main` and the active remote branches (see below). |

## Gates — merged ui-ux-round2 tree (Lane E, first-hand, 2026-11-23)

Run on the merged tree (commit `5da29a8`), Node 22.23.4,
`apps/web`:

- `npx tsc --noEmit`: 0
- `npm run build`: 0 (palette audit passed)
- Full vitest: 89 files passed; 1697 tests passed, 5 skipped (1702 total)
- `npm run lint`: 0
- `npm audit`: 0 vulnerabilities
- Root `npm test`: 0 — after `npm ci` in `tools/hdwallet-gen`. The
  first attempt in the fresh worktree failed only because
  `node_modules` was absent there (`MODULE_NOT_FOUND`
  `@trustwallet/wallet-core`); not a code failure, and not waived —
  installed and re-run green.
- CDP re-verification of the merged tree (Lane E, scripts
  `cdp-lane-e-verify.mjs`, `cdp-lane-e-compare.mjs`,
  `cdp-lane-e-devnet.mjs`; results in `cdp/lane-e-results.json`):
  every item checked and passing at 390 and 1440, including the
  deep-link runs V1 to V5, the subpath build, the devnet price
  re-probe after a CoinGecko 429 storm, and a mobile-layout
  comparison against the saved tag `67c48e2` (no horizontal overflow
  anywhere; every scroll-height difference is programme scope or
  inherited).
- E2E (affected specs only): **2 failed** —
  `item4-qr-share.spec.ts` and `send-disabled.spec.ts`, both failing
  at wallet creation because `vite preview` 404s
  `/bawa/assets/*.js` under the new `base: '/bawa/'` (see "Merge
  notes"). The E2E harness needs to serve the bawa-layout static
  server or build with `--base /` for E2E runs. That change was not
  made here; it needs a decision.

## Merge notes (Lane E)

- Cherry-pick order from the base `4d8afff`: A2 `95cad71` (clean),
  C2 `30e2819` (1 conflict), B `c6b1a5e` (2 conflicts), D2 `d370c58`
  (3 files, 7 conflicts). Every conflict was resolved keeping both
  lanes' features: C2's item-5 wording on the shared branches, B's
  pending-link handling plus A2's no-wallet note, D2's compact
  structure rendering A2's QrCard (never the plain QR), and D2's
  stepped flow with the item-9 scan icon button on the details step.
  `tsc` 0 after every pick, plus targeted vitest per pick.
- Two merge defects found by first-hand `tsc` and vitest and fixed
  in `d01a603`: Lane D's mnemonic-density work was missing (a
  cherry-pick carries only the diff, so `d5093f6` never landed) and
  was ported onto the merged tree keeping C2's copy; D2's
  `scannerError` plumbing was stale against item 9's QrScanner
  rewrite and broke `tsc`, so it was removed (the failure message
  still surfaces inside QrScanner).
- Pages-base reconciliation (`5da29a8`): `apps/web/vite.config.ts`
  is now byte-identical to `panel-rebuild/pages-base` (`cd39306`):
  `base: '/bawa/'` plus the build-only `<base>` rewrite. Lane B's
  router basename now resolves to `/bawa`, so routing and asset
  paths match on a `/bawa/` deployment. Both serves verified: root
  build and `/bawa/` build, each 200 with matching JS hashes.
- The redundant `panel-rebuild/uiux-r2-mnemonic-watch` branch
  (`d5093f6`) was deleted after the port, on content equivalence.

## Branch state (2026-11-23, after the merge)

| Branch | SHA | State |
|---|---|---|
| `main` | `fd6a58d` | Untouched for code. Doc-only update from this programme (item 10). |
| `panel-rebuild/adopt-proper` | `7f31603` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/desktop-layout-v2` | `79b5b75` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/devnet-temp` | `783b43f` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/token-discovery` | `743d071` | Untouched for code. Doc-only update from this programme. |
| `panel-rebuild/token-gaps` | `6147b74` | Merge of `ui-ux-round2` (docs, item 10) into token-gaps. The code merge was `315b5a7`. Contains all 10 round-2 items plus the token-gaps work and the README showcase and Add Token work from the parallel programme. Further work continues on top of token-gaps, per the owner's merge-destination decision (2026-11-23 ~05:11 IST). |
| `panel-rebuild/ui-ux-round2` | `5da29a8` | Programme branch. Code complete; doc updates from item 10 pushed here first. |
| `panel-rebuild/readme-showcase-token` | `eab8861` | Parallel programme (README showcase plus Add Token). Not touched by this lane. Its work is already in token-gaps. |
| `gh-pages` | `ee63a13` | Pages site source. Not touched by this programme. |

Dead local-only lane branches (e.g. `panel-rebuild/uiux-a-layout`,
`uiux-b-chains`, `uiux-c-wallet`, the `fixgaps-*`, `layout-*`,
`multichain-*` and `adopt-proper-a/b/c/d` intermediates) were left
alone: they are superseded intermediates already merged upstream or
abandoned, they are not on the remote, and updating docs there would
serve nothing. `panel-rebuild/pages-base` stays unpushed by design:
its vite config change was reconciled into this tree instead.

## Preview / Pages pointers

- Durable preview: GitHub Pages — https://pr3eve6ti2o.github.io/bawa/
  — serves the saved adopt-proper-based build. It does **not** include
  this programme: the UI/UX work lives on `panel-rebuild/token-gaps`
  only. To preview the programme, check out `panel-rebuild/token-gaps`
  and run the web starter locally (`apps/web`: `npm ci`, `npm run dev`).
- Lane E minted a hash-verified Pinggy tunnel for the merged tree
  (alt host `ktqtv-2a04-4e41-4c-4e97--1373-4e97.free.pinggy.net`,
  JS hashes matched dist). Free tunnels expire within about an hour
  (this one ~18:05 IST 2026-11-23) and resolve IPv6-only; the owner's
  DNS cannot resolve them. Do not rely on a tunnel link as the durable
  preview.

## Still open

**Resolved since (2026-11-28, Lane A docs audit):** the Receive
tagline was restored by fix-all Lane H ("This is your address —
share the drawing, keep the keys."; the QR card footer is now
"Share the card, keep the keys."); TON Issue 5 is CLOSED with live
proof and Issue 6 is FIXED (see
`docs/DEEP-AUDIT-DEVNET-PROGRAMME.md` Lane B, 2026-11-23); the E2E
harness was fixed by deep-audit Lane E (root-base `build:e2e` +
`preview:e2e`) and E2E has run on later merged trees; the GitHub
Pages preview now serves the token-gaps build (`ceade79`,
`index-Brm7r34g.js`), not the saved adopt-proper build named in
"Preview / Pages pointers" above. The remaining items below are as
recorded 2026-11-23 unless noted.

- E2E harness versus `base: '/bawa/'` — needs a decision (see Gates).
- The camera path itself is unverified on a real device (items 1
  and 9): headless Chromium denies `getUserMedia`, so the live camera
  loop was verified only at unit level and through the image-upload
  path. Needs the owner's phone to confirm a real scan.
- Receive tagline removed in item 8 — restore it somewhere if the
  owner misses it.
- Token contract tail truncated on one-line rows (item 8): name,
  symbol and the verified tick stay readable; the full contract stays
  in the DOM and in Add Token.
- Review and sign steps not CDP-verified (item 8): a fresh disposable
  wallet holds no funds, so any positive amount is honestly stopped
  at the details step. Vitest covers the flow with mocked balances.
- CoinGecko keyless feed is rate-limited on the shared VM IP (429s
  seen during probes). The app retries and degrades honestly ("Price
  error", "Partial total").
- Word grid at exactly 1024 px has about 34 px slack for the worst
  case word (item 4). Worth one glance if the owner checks a 1024 px
  viewport.
- `--font-mono` names "JetBrains Mono", which is not bundled
  (pre-existing, out of scope for items 4 and 5).
- The import-wallet path has no "Continue to your send" button (item
  2). After importing, the user returns through the Send tab, where
  the stored link resumes. Verified in unit tests, not end to end in
  CDP.
- External wallet apps were not tested for deep links (item 2). This
  lane covers the Bawa web link only.
- Mobile Receive screen 40 px shorter than the saved mobile build —
  DECIDED 2026-11-23 ~14:17 IST: the owner tapped "Keep the 40 px
  fix". The P8 dead-space removal stays; do not re-ask. (Reverify
  lane 1, 2026-11-23: the fix itself had been lost from the token-gaps
  tree by the Receive rework — restored in `receive.tsx`, see
  `docs/REVERIFY-CHECKLIST.md` item R-14.)
- Devnet exception E1 expires 2027-02-20 — renew or remove devnet by
  then (removal checklist in `docs/DECISIONS.md` §9).
- TON Issue 5 (first send from a fresh wallet cannot deploy — no
  state init in the signed BOC) and Issue 6 (`/track` cannot resolve
  the TON message hash shown as "Transaction") — see
  `DEVNET-ISSUES.md`. Both block mainnet TON behaviour too, not just
  devnet.
- Out of scope, unchanged: M-39 (GUI TON withdrawal), broadcast
  authorisation (mainnet broadcast still disabled), Android Gradle
  build (no SDK/JDK on gray-pinee).

## Safety

No transfer, send or broadcast of real (mainnet) crypto in this
programme. No balances, prices or token metadata invented — every
number comes from a real source. No keyed/paid RPC or API used.
