# Decisions

## 10. UI/UX Fixes programme — 21 items, merged into token-gaps (2026-11-23)

**Decision: the 21-item UI/UX Fixes programme (owner order 2026-11-23
~04:40 IST) is complete and merged into `panel-rebuild/token-gaps`.**
Branch `panel-rebuild/ui-ux-fixes` (`68fd75b`, branched from token-gaps
`488f644`, devnet mode brought in from `panel-rebuild/devnet-temp`
`8994584`) was merged into token-gaps by Lane E (hands-on Muse, 0 Sol
calls) as merge commit `4eb0242`. Merge destination per the owner's
decision 2026-11-23 ~05:11 IST: further work continues on top of
token-gaps. No code merged into `panel-rebuild/adopt-proper` or `main`.

Gates on the merged tree, first-hand (Node 22.23.4, `apps/web`): `npx
tsc --noEmit` 0; `npm run build` 0; full vitest 86 files, 1644 passed /
5 skipped; `npm run lint` 0; `npm audit` 0 vulnerabilities; root `npm
test` 0 (after `npm ci` in `tools/hdwallet-gen` — the first attempt in
the fresh worktree failed only on absent `node_modules`, not on code).
CDP re-verification at 1919/1440/820/390 was done by the coordinator on
`ui-ux-fixes` before the merge and passed; Lane E did not re-run CDP.

Item 21 (document everything): `docs/UI-UX-FIXES-PROGRAMME.md` is the
programme record (all 21 items, gates, branch state, preview/Pages
pointers, still-open list). Doc-only updates were pushed to `main` and
the active remote branches (`adopt-proper`, `desktop-layout-v2`,
`devnet-temp`, `token-discovery`, `token-gaps`, `ui-ux-fixes`) on
2026-11-23 per the owner's order. Dead local-only lane branches were
left alone (superseded intermediates, not on the remote).

Still open after the programme: E2E-03/06 need a stable-network run;
non-zero DOGE watch-row render unproven; 1919 settled widths not
captured; TON Issue 5 (first-send state init) and Issue 6 (`/track`
message hash) in `DEVNET-ISSUES.md`; devnet exception E1 expires
2027-02-20; the mobile Receive 40 px question awaits the owner's pick;
the item-14 cannot-add chain list is not recorded in the repo.

## 11. UI/UX Round 2 programme — 10 items, merged into token-gaps (2026-11-23)

**Decision: the 10-item UI/UX Round 2 programme (owner order 2026-11-23
~15:28 IST) is complete and merged into `panel-rebuild/token-gaps`.**
Branch `panel-rebuild/ui-ux-round2` (`5da29a8`, branched from token-gaps
`231ecbf`) was merged into token-gaps by Lane E (hands-on Muse, 0 Sol
calls) as merge commit `6147b74`. Merge destination per the owner's
standing decision: further work continues on top of token-gaps. No code
merged into `panel-rebuild/adopt-proper` or `main`.

Gates on the merged tree, first-hand (Node 22.23.4, `apps/web`): `npx
tsc --noEmit` 0; `npm run build` 0; full vitest 89 files, 1697 passed /
5 skipped; `npm run lint` 0; `npm audit` 0 vulnerabilities; root `npm
test` 0 (after `npm ci` in `tools/hdwallet-gen`). CDP re-verification
of the merged tree passed per item (Lane E). E2E: 2 specs failed
(`item4-qr-share`, `send-disabled`) because `vite preview` 404s
`/bawa/assets/*.js` under the new `base: '/bawa/'` — a harness problem,
not round-2 code; it needs a decision.

Decisions taken in the programme:

- **Devnet prices.** The fetch gate is lifted: both price hooks fetch
  and cache in devnet exactly as on mainnet, because prices are public
  market data for the native asset or token and a testnet BTC balance
  is still priced per BTC. Fiat valuation of test balances stays
  suppressed at the display layer, so a funded test wallet never
  shows an invented dollar value. Do not regress either half.
- **Font.** Baloo 2 replaces Caveat as the display face. Caveat, a
  handwriting script, was hard to read at mobile sizes, worst on the
  recovery phrase itself, where misreading one word loses the wallet.
  Baloo 2 keeps the rounded, friendly character without the legibility
  cost, and it is self-hosted. Inter stays the body font.
- **Copy.** Main titles and descriptions are plain human en-GB.
  Em dashes joining two sentences became full stops, trailing
  pile-ons were cut, redundant paragraphs went. Security-meaning lines
  kept every fact. Error and toast strings were left alone: their dash
  is a cause-to-remedy separator, not an AI tell.
- **Deep links.** A shared send link is kept while the wallet is
  locked or missing, the panels name the pending payment, and the
  create-wallet ready screen offers a way back to the send. With more
  than one vault account a chooser appears. The link keeps the
  `/bawa/` subpath, and the router carries the matching basename.
  `apps/web/vite.config.ts` is byte-identical to
  `panel-rebuild/pages-base` (`cd39306`).
- **QR card.** The Receive QR is a card (QR, amount, address, token
  plus chain with both logos), and the card itself is the shared
  image. Scanning a payment QR auto-selects chain, token, amount and
  address.
- **Mobile.** Inputs are 16 px on coarse pointers so iOS Safari does
  not zoom on focus. The viewport meta carries `viewport-fit=cover`.
  Send is chain, token, address plus amount, review, sign, result;
  Receive is network grid, token, amount plus QR. Picker steps fit a
  390 by 844 viewport with no scroll.
- **Watch wallet.** The horizontal chain sliding is gone: a search
  bar shows all chains on click, with picked chains in a Recent row
  below it.

Item 10 (document everything): `docs/UI-UX-ROUND2-PROGRAMME.md` is the
programme record (all 10 items, gates, branch state, preview/Pages
pointers, still-open list). Doc-only updates were pushed to `main` and
the active remote branches (`adopt-proper`, `desktop-layout-v2`,
`devnet-temp`, `token-discovery`, `token-gaps`, `ui-ux-round2`) on
2026-11-23 per the owner's order. Dead local-only lane branches were
left alone (superseded intermediates, not on the remote).

Still open after the programme: the E2E harness versus `base:
'/bawa/'` needs a decision; the camera path is unverified on a real
device (items 1 and 9); the Receive tagline removed in item 8; the
token contract tail truncated on one-line rows; review and sign steps
not CDP-verified; CoinGecko 429s on the shared VM IP; the word grid at
1024 px is tight; the import path has no "Continue to your send"
button; external wallet apps not tested for deep links; the mobile
Receive 40 px question still awaits the owner's pick; devnet exception
E1 expires 2027-02-20; TON Issues 5 and 6 in `DEVNET-ISSUES.md`.

## 12. Reverify + Professional Polish programme — 5 lanes, merged into token-gaps (2026-11-23)

Owner order 2026-11-23 ~18:14 IST. Branch
`panel-rebuild/reverify-pro` from token-gaps `b089c28`; fast-forwarded
into `panel-rebuild/token-gaps` to `ccb8195` on 2026-11-23. Doc-only
updates pushed the same day to `main` (`e64679e`),
`panel-rebuild/adopt-proper` (`d0aa6ba`),
`panel-rebuild/desktop-layout-v2` (`df6e54d`),
`panel-rebuild/devnet-temp` (`bd4bdd4`) and
`panel-rebuild/token-discovery` (`81994e8`). Full record: `docs/REVERIFY-PROGRAMME.md`;
checklist: `docs/REVERIFY-CHECKLIST.md`. Hands-on Muse, 0 Sol calls.

- **Vitest baseline corrected.** The Round 2 record says 89 files /
  1697 passed / 5 skipped on tip `b089c28`. Four independent
  first-hand runs on that tip (merge lane plus lanes 1, 3 and 4)
  measure 90 files / 1718 passed / 5 skipped. The Round 2 figure
  does not reproduce; its cause was not established. The merged
  reverify tree measures 1722 passed / 5 skipped — baseline 1718
  plus Lane 1's 4 new tests, exactly. The Round 2 record itself was
  left as written; the correction lives here and in the programme
  record.
- **Lane 3 discrepancies, recorded not resolved.** (1) SOL/LTC/DOGE
  history: `chains.ts` records history verified,
  `registry/capabilities.json` records it NOT_SUPPORTED for all 18
  additional chains — which source is right needs re-verification.
  (2) Vitest count, see above. (3) ADR-0007's 2026-11-20 amendment
  says 12 unique CoinGecko ids for the original 13 chains; the
  current `prices.ts` map yields 10 for those 13. The 2026-11-23
  amendment states the current verified map (15 unique for 22); the
  old amendment was left as written.
- **Reference-repo link still missing.** The owner never named the
  repo or attached a link for the README showcase. No layout from it
  was used or invented.
- **Hygiene scan (merge lane, `repo-hygiene-scan` skill, tools run
  first-hand).** Madge: no circular dependency. Ts-prune/knip:
  nothing deleted — the only genuinely unreferenced export is
  `registerLookupHandler` (designed extension point, kept), and the
  unused files are all false positives. Knip lists 8 unused
  dependencies (7 `@radix-ui/*` plus `react-hook-form`, orphaned by
  Lane 4's deletions); `package.json` cleanup is a separate change.
  Jscpd: 78 production-production clone groups; largest are the
  btc/ltc adapters, prices/token-prices, asset-list/dashboard and
  three BTC pairs in `send.ts`. Consolidation candidates for a
  future lane.
- **`send.ts` / `core.ts` split and `wallet-refresh.ts` re-wire stay
  open** (Lane 4, with evidence in its report): the split touches
  the secret-handling path, and the re-wire would change refresh
  behaviour for 18 chains, devnet mode, caching and the
  stale/refreshing flags. Neither is polish work.
- **Unwired modules stay:** `engine/destination.ts`,
  `wallet/adapters/confirmation.ts`, `wallet/evm-typed-data.ts`,
  `wallet/secretHandoff.ts` — wire them, or delete them by explicit
  decision.
- **Merge decisions.** The Lane 2 / Lane 3 README conflict was
  resolved by keeping Lane 2's canonical Screenshots section; Lane
  3's follow-up commit was skipped because its content was already
  in the tree from that resolution. Nothing from any lane was
  dropped.
