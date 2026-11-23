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
## 13. Deep Audit + Devnet E2E programme — 5 lanes, merged into token-gaps (2026-11-23)

**Decision: the 5-lane Deep Audit + Devnet E2E programme (owner order
2026-11-23 ~18:10 IST) is complete and merged into
`panel-rebuild/token-gaps`.** Branch `panel-rebuild/deep-audit-devnet`
(branched from token-gaps `b089c28`, devnet mode brought in from
`panel-rebuild/devnet-temp` `21f4726`, reverify-pro's token-gaps tip
`71326e1` merged in) was merged into token-gaps by the coordinator
(hands-on Muse, 0 Sol calls). No code merged into adopt-proper or
main. Full record: `docs/DEEP-AUDIT-DEVNET-PROGRAMME.md`;
`docs/GAP-ANALYSIS.md` (24 gaps, repos checked live).

Decisions and findings recorded here:

- **HD wallet verified; bot xpub export added.** All 22 chains match
  both independent oracles (Python bip_utils + Wallet Core 4.9.3)
  at indexes 0/1/2/5. There was no xpub export at all before this
  programme; the wallet now exposes per-chain account public keys
  on demand for the owner's bot (BTC zpub `m/84'/0'/0'`, LTC Ltub
  `m/84'/2'/0'`, DOGE dpub `m/44'/3'/0'`, TRX + all EVM xpub
  `m/44'/60'/0'`; TON/SOL one address per wallet). The bot use
  case is YES for 20 chains. DOGE dpub is now accepted on import
  (Wallet Core emits dpub; import only allowed dgub, so the wallet
  rejected its own export). LTC zpub stays rejected — it is BTC's
  version prefix, intentionally. SOL multi-address and TON
  one-address are by design (owner decisions to confirm as final);
  the bot must use shared `m/44'/60'` for CELO, not SLIP-44 527.
- **Devnet Issue 5 CLOSED with live proof.** The TON first-send
  state init IS present in the app-signed BOC (code hash
  `feb5ff68...`, V4R2, init address == wallet C's address exactly;
  TonViewer tx `4f35a862...fe4a42c0`, contract deploy, C uninit to
  active). The 2026-11-22 missing-init inference was wrong (that
  decode was of a garbage-seqno BOC). At seqno 0 Wallet Core
  4.9.3 sets valid_until to UINT32_MAX, so the first-send message
  is deterministic and never expires. The vendored-BOC-builder fix
  sketch is not needed.
- **Devnet Issue 6 FIXED in place.** `/track` resolves TON message
  hashes (0x-prefixed and base64 `in_msg.hash`); the exact landed
  A to B tx was returned in CDP.
- **Devnet faucets still 0 tokens (Issue 7).** Retried 2026-11-23:
  pk910 IP block is gone, new block `[INVALID_CAPTCHA]`; nileex
  Turnstile never completes; coinfaucet.eu hCaptcha; ZalalenA
  Turnstile gate never clears. Owner action: complete the captchas
  in their own browser with the wallet-A addresses. BTC/ETH/TRX
  stay NOT PROVEN on devnet until then.
- **Watch-only rejects devnet TON addresses (new finding).** A
  deliberate boundary (`validateWatchOnlyImport` /
  `deriveAddress` call `validateTonAddress` with no devnet
  option). Not fixed in this programme — threading devnet through
  validation, derivation and balance adapters is multi-site with
  mainnet safety implications and overrides a recorded deliberate
  decision. Needs an owner decision; fix sketch in the Lane B
  report; recorded as gap 21 in `docs/GAP-ANALYSIS.md`.
- **E2E harness fixed (ADR-0011).** Root-base `build:e2e` +
  `preview:e2e`; CI e2e job builds with `build:e2e`; Playwright
  config reads `E2E_PORT` (default 4193) so a shared machine
  cannot silently test another lane's build. Pages build untouched.
- **Re-verification:** nearly all Round 2 and showcase claims
  HOLD in CDP. One regression found and partially fixed (Send
  chain scroll 936 back to 844; Receive details 1446 to 1390;
  Share/Copy link/Download still need ~40–90 px scroll — owner
  decision: smaller buttons or top-stack rework). The hard-coded
  "Account 01" header now follows the selected account. Fantom
  price always "Price expired" (CoinGecko quote ~6.2 h stale vs
  the 10-min window — owner decision). DOGE has no working browser
  fallback when SoChain is rate-limited (owner decision on a
  second CORS-friendly source). Refresh-burst duplicates and the
  429 retry storm are measured and handed to the gap analysis
  (gap 5).
- **Merge notes.** The programme branch merged devnet-temp in
  first (1 DECISIONS.md conflict: devnet side added nothing in
  that hunk), then reverify-pro's token-gaps tip `71326e1` (clean).
  Lane cherry-picks were all clean except Lane E's
  `docs/index.md` (kept reverify-pro's two entries plus the
  gap-analysis entry). Lane A's and Lane C's header fixes composed
  (both headers now use `accountName(vaultAccount.account)`).
## 14. Marketing Fix + Found-Bugs programme — 8 lanes, merged into token-gaps (2026-11-23)

Owner order 2026-11-23 ~19:14 IST, from two phone screenshots (mobile `$0.00
(Partial)`; desktop `Ethereum history unavailable` + Retry): the screenshots look
bad, the Retry button should not be there, the mobile balance should not say
Partial. Hands-on Muse, 0 Sol calls. Branch `panel-rebuild/marketing-fix` from
`71326e1`, rebased onto `e290654` after the deep-audit programme merged into
token-gaps first; merged into token-gaps as `571f0fb` (merged tree
byte-identical to the verified `a8018fd` tree).

- **Lane 1 (first-impression defects).** Reproduced both screenshots on
  baseline first (burst ~230 requests, 36 failed). Partial: shared refresh
  limiter, cap 4 concurrent calls; all-loaded-zero returns the zero state —
  clean `$0.00` + quiet note. Retry: history Retry only when the wallet/chain
  has activity; a fresh wallet shows "No activity yet". Indexer gap recorded
  (keyed/paid indexer or owner-hosted Blockscout is an owner decision).
  Residual: one Retry remains — the Dogecoin row (sochain 429s every attempt,
  BlockCypher CORS-blocked).
- **Lane 2 (found bugs).** 8 unused deps removed (knip 0). jscpd 78 groups /
  1,332 lines → 15 / 183 (63 consolidated, 1,149 lines removed). send.ts/core.ts
  split DONE (`wallet/signing-intent.ts`). wallet-refresh re-wire PROVED
  infeasible without behaviour change (6 reasons in the lane report) — decision
  needed: redesign, keep as tested-but-unused, or delete. D-02 DONE: /lock
  double `<main>` fixed; "Lock now" button added to AutoLockSetting.
- **Lane 3 (marketing view).** Welcome wallet-first (Create card next to
  Import), one 22-chain Create card, factual hero tagline, Send step 1 matches
  its banner. `docs/VALUE-PROPOSITION.md` — every claim verified against code.
- **Lane 4 (README rewrite).** 256 → 180 lines, mined MetaMask / Trust Wallet /
  BlueWallet / RainbowKit / shadcn-ui READMEs; 4 screenshots re-shot clean on
  the fixed build. Reference-repo link never arrived — nothing invented.
- **Lane 5 (Mermaid diagram).** `docs/HOW-IT-WORKS.md`: two 8-node Mermaid
  flowcharts (how it starts / what it does), render-validated, all 49 cited
  paths exist. Trade-off stated: GitHub mobile app shows Mermaid as raw code.
- **Lane 6 (branch cleanup).** Remote 13 -> 9 branches: deleted ui-ux-round2,
  reverify-pro, readme-showcase-token, deep-audit-devnet (all verified
  ancestors of token-gaps `571f0fb`). Kept: token-discovery and ui-ux-fixes
  (not ancestors - post-merge doc-only commits with unique content),
  desktop-layout-v2 and devnet-temp (unique unmerged work), marketing-fix
  (programme branch), main, adopt-proper, token-gaps, gh-pages. Local 59 -> 56
  branches; the rest are pinned by checked-out worktrees and need a
  worktree-removal pass (finish-product Lane E). Full lists in
  `docs/MARKETING-FIX-PROGRAMME.md`.
- **Lane 7 (QR templates, owner correction).** The owner was right: templates
  were not visible as asked (Receive opened on the network picker; alternates
  40 px, below the fold, unlabelled; Payment request a disabled grey box;
  shown template unnamed). Fixed in place: 64 px small QRs + heading naming
  the shown template, amount inside the card, Payment-unavailable explained,
  selected template clamped to one with a value. CDP proof: template row ends
  above the tab bar at 390 px in all cases; tap-to-swap proven by payloads;
  share/download sends the selected template's card.
- **Lane 8 (reverify properly, browser-first).** Checklist rebuilt from scratch
  and re-verified by using the app in CDP. Corrected counts (42 rows): done 6,
  partial 7, missed 2, not verifiable in CDP 23, in progress 4. Five wrong old
  verdicts flagged (W-1..W-5) with the method flaw named in the checklist doc.
  D-01 (980 px breakpoint) is an owner decision: port it, merge
  desktop-layout-v2's breakpoint, or accept the mobile layout at 980 px.
- **Rebase.** Two conflicts, both resolved by the coordinator: `receive.tsx`
  (heading + templates first, action row right after — the templates own the
  above-fold slot); `wallet/core.test.ts` (split import per Lane 2).
- **Deviation found in merge verification (owner decision needed):** the main
  QR renders at 136 px, not the 192 px spec — deep-audit Lane A reduced it
  from 192 to 136 to get the actions above the fold. Restoring 192 px would
  put the template row at ~762 px (still above the fold by 8 px) but push the
  action row further below it.
- **Gates (rebased tree):** tsc 0, build pass, vitest 1,748 passed / 5 skipped
  (90 files), lint 25 errors all pre-existing in `apps/web/scripts/*.mjs`,
  npm audit 0, root `npm test` 0. E2E not run on this tree (deep-audit ran
  23/24 on its own tree; this tree covered by vitest + CDP).
