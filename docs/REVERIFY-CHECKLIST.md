# Reverify checklist — every owner order, 2026-11-22 to 2026-11-23 ~19:17 IST

**CORRECTED by Lane 8 of the Marketing Fix + Found-Bugs programme
(coordinator `308b6734`). Hands-on Muse, 0 Sol calls, 0 AgentRouter calls,
0 runner invocations. Base: `panel-rebuild/token-gaps` tip `71326e1`.
Worktree: `/home/boxd/workspace/bawa-mkt-l8-worktree` on gray-pinee.**

This document REPLACES the first checklist's verdicts (same file, written by
Reverify Lane 1, coordinator `3e052fbd`, base `b089c28`). The old verdicts
are kept in the table's "Old verdict" column so every correction is visible;
nothing was silently overwritten. The old checklist's "Fixes made by this
lane" (F-1 40 px, F-2 import Continue, F-3 item-14 record) are NOT reverted
— F-1 and F-2 are re-verified in CDP below and stand; F-3 is a docs record
and stands.

## Method — browser-first (this lane)

The ONLY evidence that counts for a feature is using the app in CDP and
seeing it work on a rendered screen. Code presence, test existence and lane
reports are NOT evidence. If a feature cannot be verified in the browser
(needs a funded wallet, a real camera, a faucet, a real phone, or is a
docs / merge / push / process claim), it is marked **not verifiable in CDP**
with the exact reason and what proof exists instead.

- Built the exact tree under test: `npm run build` passed (`tsc --noEmit`
  0, vite built, palette audit passed: 29 approved colour literals).
  Dist JS `assets/index-Co_iBr5E.js`.
- Served the built dist statically (`serve-dir.cjs` pattern, port 4222,
  dist at `/` and under `/bawa/` with SPA fallback — **not** `vite preview`,
  which 404s `/bawa/assets/*.js` with base `/bawa/`). Served JS hash
  verified to match the dist hash before capturing.
- CDP: Playwright (Node 22) scripts
  `/home/boxd/workspace/bawa-mkt-l8/l8-cdp-verify.mjs`,
  `l8b-`, `l8c-`, `l8d-`, `l8e-`, `l8f-`, `l8g-`, `l8h-cdp-verify.mjs`
  (results JSONs + screenshots in
  `/home/boxd/workspace/bawa-mkt-l8/cdp/`). Fresh disposable wallets only;
  nothing sent or broadcast. Viewports 390 / 820 / 980 / 1024 / 1440 / 1919.
  States covered: no-wallet, wallet-ready (fresh zero-balance), locked vault
  (via the 1-minute auto-lock timer), devnet, watch-only, import flow.
- Screenshots VIEWED by eye (not summarised from text reports):
  `l8-receive-390.png`, `l8-dash-390.png`, `l8-home-980.png`,
  `l8-dash-1440.png`, `l8-dash-1919.png`, `l8e-empty-save-390.png`.

Order sources, in priority order: (1) `~/MEMORY.md` plus the daily logs
`~/memory/2026-11-22.md` and `~/memory/2026-11-23.md`; (2) the programme
records on gray-pinee under `/home/boxd/workspace/bawa-*/`; (3)
`docs/DECISIONS.md` at the tip; (4) fresh `git ls-remote` / ancestry checks.
Rows C-01–C-39 are the old checklist's order set, re-verified. Rows C-40–
C-42 are the owner orders since the old checklist closed (~18:14 IST).

## What the first checklist got wrong

Plainly: **it judged a visual product by reading code.** Five specific
flaws, all in the old checklist's own "Method" section:

1. **Code presence counted as proof.** Its verdict rule said an order is
   "implemented" if "the code at the tip … proves it — checked first-hand
   by `grep` / `git show` / `ls-remote`". For UI orders that rule is wrong:
   code present does not mean working on screen. The QR templates are the
   proof — `QrTemplate`, `qrTemplates`, `smallQrs` and tap-to-swap all exist
   in `receive.tsx`, and the old method would pass them, while on a 390 px
   screen the template buttons sit below the fold (top 786, bottom 862 in
   an 844 px viewport) and no label says which template the main QR
   currently shows. The owner, looking at the screen, correctly said they
   are not there as asked.
2. **CDP was explicitly deferred, then never done for these rows.** The old
   checklist wrote: "What this lane did NOT re-prove live: full CDP runs …
   the parallel deep-audit programme, Lane A, is re-verifying Round 2 +
   showcase claims in CDP right now". Lane A never re-verified this
   checklist's rows; the deferral became the verdict.
3. **State blindness.** No row recorded which state the claim lives in
   (no-wallet vs wallet-ready vs locked vs devnet). A fix that exists only
   in wallet-ready state is invisible to an owner in the no-wallet state —
   and the owner's two corrections (QR templates, this reverify) both came
   from the screen they were actually looking at.
4. **Branch confusion.** Evidence from one branch was recorded as proof for
   another tree. C-16 ("still mobile layout in desktop mode") was marked
   Implemented on `desktop-layout-v2` `bf00f54` evidence, but that branch
   was never merged into token-gaps — in this tree, at 980 px, the app
   still shows the mobile layout (sidebar `display=none`, bottom nav).
   The old checklist's own C-10 says the desktop layout lives on that
   branch, unmerged; C-16 ignored that boundary.
5. **It violated its own skills.** The reverify programme created
   `order-traceability-checklist` (UI claims need a screenshot you viewed
   yourself; "never mark `implemented` from a coordinator's word alone")
   and `cdp-visual-verification` (the screenshot, viewed by eye, is the
   ground truth). The first checklist used neither for its verdicts. Both
   skills carry Lane 8 corrections now (see "Skills used"): the CDP skill
   no longer suggests `vite preview` (it 404s with base `/bawa/`), and the
   traceability skill now admits the `in progress` and `not verifiable in
   CDP` verdicts a browser-first brief requires.

## Summary counts (corrected, 42 rows)

| Verdict | Rows |
|---|---|
| Done (seen working in CDP) | 8 |
| Partial (some sub-items seen working, some not) | 7 |
| Missed | 1 |
| Not verifiable in CDP (reason + alternate proof in evidence) | 25 |
| In progress (parallel programme / this lane) | 1 |
| **Total table rows** | **42** |

42 rows cover 41 distinct orders: C-14 and C-33 are one item (the 40 px
question, decided 2026-11-23 ~14:17). The old checklist claimed 28
implemented of 39; browser-first re-verification confirms **6 done** of 42.
That is not a claim that 22 orders regressed — most of the difference is
the old method counting code, merges, pushes and process answers as
"implemented", where this lane marks those rows "not verifiable in CDP"
with the alternate proof instead. The genuinely wrong old verdicts are the
five listed under "Wrong old verdicts" below.

## Checklist

| # | Order (owner's words, short) | Date | New verdict | Old verdict | Evidence (browser-first) |
|---|---|---|---|---|---|
| C-01 | Display method B — the 9 README diagrams become static SVGs | 2026-11-22 ~01:59 | Not verifiable in CDP | Implemented | Docs claim, not a feature. Git readback on `origin/main`: 9 `.mmd` + 9 `.svg` in `docs/diagrams/`, 9 svg refs in README. |
| C-02 | Fix all four rebuild preview issues: sidebar scrollbar, "All networks" clipped, narrow column, dead Retry while locked | 2026-11-22 ~01:59 | Done | Implemented | CDP 1440/1919: sidebar renders, "All networks" card fully visible, content spans the width, no horizontal scrollbar. Locked (1-min auto-lock test): asset detail shows "Locked. Unlock to see balances." + Unlock, **0 Retry** buttons, addresses hidden. Screenshots `l8-dash-1440.png`, `l8-dash-1919.png`, `l8g-locked-asset-390.png`. |
| C-03 | Merge BOTH (repo-study + layout-rebuild) into adopt-proper; do NOT merge adopt-proper into main | 2026-11-22 ~01:59 | Not verifiable in CDP | Implemented | Merge claim. Git: `4862ba8` is an ancestor of HEAD; fresh `ls-remote`: main `ed26765`, adopt-proper `ae189db` (doc pushes only since the old check — no code merge into main). |
| C-04 | "Push which is not pushed and work on what is still not fixed" | 2026-11-22 ~02:0x | Not verifiable in CDP | Implemented | Process order, answered at the time. Re-checked now: `ls-remote` shows token-gaps `71326e1`, reverify-pro `ccb8195`, desktop-layout-v2 `0baf11b`, devnet-temp `54e2fbf`, token-discovery `24f9502`; deep-audit-devnet + marketing-fix branches are local-only (in progress, unpushed). |
| C-05 | Accept F7 (~8.1 px) as best achievable for D1 | 2026-11-22 ~02:32 | Not verifiable in CDP | Implemented | Docs claim. Git readback on `origin/main`: `docs/diagrams/architecture.svg` root `viewBox` width 571.406. The live 9.1 px measurement was not re-run by this lane. |
| C-06 | "Fix both": (1) sticky Refresh dead while locked on /assets/:chain; (2) verify the 5-minute auto-lock timer end to end | 2026-11-22 ~14:17 | Done | Implemented | CDP, 1-minute timer (same mechanism as 5-minute): auto-lock on, duration 1 min selected, waited 75 s — vault locked; `/assets/eth` shows Unlock, 0 Retry, addresses hidden, history "Locked. Unlock to see activity." The 5-minute duration itself was proven at 300.3 s by the earlier programme and was not re-run; the lock mechanism is the same. |
| C-07 | "Preview link not working fix it. And push what is not pushed" | 2026-11-22 ~15:00 | Not verifiable in CDP | Implemented | Process order; tunnels expire by design. Durable link is Pages (C-11). |
| C-08 | Preview link still fails — ERR_NAME_NOT_RESOLVED | 2026-11-22 ~15:14 | Not verifiable in CDP | Implemented | Process/diagnosis order; diagnosis stands (Pinggy free domains resolve IPv6-only). Pages is the durable link (C-11). |
| C-09 | "Save it and never touch it. Mobile layout is really good" — save + lock the mobile UI/UX | 2026-11-22 ~15:28 | Not verifiable in CDP | Implemented | Standing rule + tag. Git: tag `save/mobile-loved-2026-11-22` → `67c48e2`, `ls-remote`-verified. CDP spot check: mobile 390 renders the same layout (no horizontal overflow). |
| C-10 | A DIFFERENT desktop layout with the SAME UI/UX (1440/1919 px, layout change only) | 2026-11-22 ~15:28 | Not verifiable in CDP (from this tree) | Implemented | Lives on `panel-rebuild/desktop-layout-v2` (`0baf11b` on remote), never merged. Cannot be CDP-verified from this worktree (brief: work only here). Desktop at 1440/1919 in THIS tree is the token-gaps layout, verified separately (C-02). |
| C-11 | "Publish to GitHub Pages" (tapped option) | 2026-11-22 ~15:36 | Not verifiable in CDP | Implemented | Publish claim. Live check: `https://pr3eve6ti2o.github.io/bawa/` returns 200; served JS `assets/index-CJcjZBf5.js` matches `origin/gh-pages` (`ee63a13`) exactly. Pages still serves the saved `67c48e2` build, not token-gaps. |
| C-12 | "Progress update?" | 2026-11-22 ~16:37 | Not verifiable in CDP | Implemented | Status question, answered at the time. |
| C-13 | "Check in your live browser. Use puppeteer or something like this to check if you have to. And fix minor defects you find on the way so it looks more polished." | 2026-11-22 ~16:47 | Partial | Implemented | CDP confirms the visible parts: dashboard quick-actions rail (Send/Receive/Activity) beside the hero at 1440/1919, and the `/bawa/` subpath working (deep link V5a/V5b). P1–P10 were NOT individually re-proven item by item in this lane either — Lane D could not locate the P1–P10 list in the worktree docs (only the W-5 reference to it), so the old "Implemented" still over-claims CDP coverage. |
| C-14 | Mobile Receive 40 px — "Keep the 40 px fix" (question opened 2026-11-22 ~19:17, decided 2026-11-23 ~14:17) | 2026-11-23 ~14:17 | Done | Missed — fixed by Lane 1 | CDP: `p[role="status"]` count is **0** before any copy action and **1** after Copy (status line appears with the copy message). The F-1 fix holds on screen. |
| C-15 | "Show live preview" | 2026-11-22 ~19:11 | Not verifiable in CDP | Implemented | Process order; tunnel expired since, as free tunnels do. Durable link is Pages (C-11). |
| C-16 | Phone screenshot: "still mobile layout in desktop mode" + "use top GitHub repos … why is there a Retry icon, is it really needed there, do some finishing and it should not break" | 2026-11-22 ~19:28 | Missed (in this tree) | Implemented | **CDP at 980 px: the app still shows the MOBILE layout** — narrow centred column, mobile bottom nav, sidebar `display=none`. At 1440 the sidebar is `display=block`. This tree's shell keys the desktop layout off `lg:` (1024 px); there is no 980 px `desktop:` breakpoint here. The fix exists only on unmerged `desktop-layout-v2` (`0baf11b`). Screenshot `l8-home-980.png` (viewed). See D-01 — needs the owner's decision, not a silent port. The Retry part of this order is Lane 1's (see below). |
| C-17 | "Add devnet temporary so we can test send and receive … get some devnet token for each chain yourself. And tell me how it went. Devnet will be temporary" | 2026-11-22 ~19:53 | Partial | Partially implemented | Unchanged in substance. CDP confirms the devnet toggle works both ways (Mainnet ↔ Devnet, no leakage — asset shows "Ethereum mainnet" after switching back) and devnet shows live per-unit prices. TON send/receive was proven by the earlier programme and was NOT re-run here (no devnet tokens obtained in this lane); BTC/ETH/TRX remain unfunded (faucets captcha-blocked, O-04). |
| C-18 | Token discovery: wallet loads with 20 tokens from different chains; one "Add token" button that adds a whole chain and adds a token by contract address | 2026-11-22 ~20:51 | Done | Implemented | CDP: **43 rows render** on the dashboard — 42 asset links + the DOGE row in its failed/unavailable state (no link by design for unavailable rows). `DEFAULT_TOKENS` has 21 entries (code count, matches the screen). Add Token dialog lists all 22 chains; adding PEPE by contract returns "Token added". |
| C-19 | Devnet scope expanded to ALL tokens: send, receive and track each one, write issues down at the end | 2026-11-22 ~20:54 | Partial | Partially implemented | Same scope limit as C-17. Issues are written down (`DEVNET-ISSUES.md`); per-token send/receive beyond TON is unproven (faucets blocked, O-04). |
| C-20 | "Try these repos for captcha but check these chains too" (5 captcha repos, 4 blocked faucets) | 2026-11-22 ~22:01 | Not verifiable in CDP | Implemented | Process outcome: 0 test tokens obtained; honestly reported. Nothing new to verify in the browser. |
| C-21 | Token gaps: free SOL/DOGE RPCs that work from a browser, Base USDC as #21, Receive fix, QR + amount + share + deep link with chooser and prefill, Send showing only four tokens, Wallets explanation, watch wallet test, portfolio "Unavailable" | 2026-11-22 ~23:21 + ~23:26 + ~23:27 | Partial | Implemented | CDP confirms most of it: Base USDC row exists (`/bawa/assets/base/usdc`); Send token step lists **8** Ethereum tokens (not four); payment QR encodes the `ethereum:` URI; share link present; deep link keeps the payment cold-start; Wallets screen explains account vs phrase vs HD vs multichain; watch-only search + recent work; portfolio shows `$0.00 (Partial)`, not "Unavailable". **NOT confirmed:** SOL/DOGE live balances. The DOGE row renders "Balance unavailable" — the adapter calls the correct sochain `/balance/` path, but the shared VM IP has exhausted sochain's 2,500/day keyless quota (429) and BlockCypher is 429 "Limits reached" too. Environmental on this VM, not a code bug — but the screen does not show working DOGE balances, so "Implemented" overstates it. |
| C-22 | "Is there anything that is still not pushed?" | 2026-11-22 ~23:35 | Not verifiable in CDP | Implemented | Status question, answered at the time; re-checked now (see C-04). |
| C-23 | "Is there anything that is still not pushed?" (asked again) | 2026-11-23 ~01:35 | Not verifiable in CDP | Implemented | Status question, answered at the time; re-checked now (see C-04). |
| C-24 | "Working?" | 2026-11-23 ~01:44 | Not verifiable in CDP | Implemented | Status question, answered at the time. |
| C-25 | UI/UX Fixes + Build programme, 21 items | 2026-11-23 ~04:40 | Partial | Implemented | CDP confirms on screen: (2) devnet pill toggles both ways; (4) Download card produces a real PNG (`bawa-receive-eth.png`, 37,223 bytes) — the Web Share API files path cannot run in headless Chromium, so the share half is unverified in CDP; (5) one import field ("12, 15, 18, 21 or 24 words"); (6) same-phrase offers "Add as Account N" ("This is the same recovery phrase… there is no need to delete anything"); (7) bulk create 10 → Account 11 shown; (8) HD rotation: New address changes the QR address, "Receiving address 2 of this account"; (9) Welcome rebuilt, no Create button; (10) Create hub: Web wallet "Available" (Coming soon only for genuinely-unavailable items); (12) asset rows show balance + fiat value + per-unit price; (13) Add Token dialog lists all 22 chains; (14) 9 chains added, record exists; (15) Copy button on the create words screen; (16) watch-only all chains searchable; (17) multi-account without deleting + naming explained; (18) 21 default tokens / 43 rows. **Lane D update:** (19) live RPC failover RE-PROVEN — E2E-19 specs passed in Lane D's full-suite runs (Ethereum falls back to the backup RPC, 6.2 s; RPC manager add/remove). **Lane F update (2026-11-23): the Solana half no longer passes** — E2E-19 Solana failover fails in the full suite AND alone AND on the pristine `d47d282` baseline (1.5 min timeout, identical); the Solana backup RPC (`public.rpc.solanavibestation.com`) is currently unreachable from this egress (probed empty), so the failover has nowhere to fall back to. The Ethereum half still passes (2.7–2.9 s, alone and in the suite). **NOT re-proven in CDP:** (1) the scroll-jump behaviour itself (only the `min-h-dvh` classes in the DOM); (3) mobile "every section" (spot-checked at 390 across screens, no horizontal overflow — not an exhaustive pass); (20) QR templates — see C-41 (Done in this lane) — and balance-aware ordering, unobservable with an all-zero fresh wallet; (21) docs (done — see C-37). |
| C-26 | CORRECTION: "You never said about waiting for my review?" — do not state token-gaps is "waiting for your review" | 2026-11-23 ~04:48 | Not verifiable in CDP | Implemented | Standing correction. Complied with: this lane makes no "waiting for review" claim. |
| C-27 | "Merge it and do this on top of that branch after current is done by you" / "Add wherever you feel like it" — merge destination delegated | 2026-11-23 ~05:11 | Not verifiable in CDP | Implemented | Merge claim. Git: `ui-ux-fixes` merge `4eb0242` is an ancestor of HEAD; work continues on token-gaps. |
| C-28 | In-place fix rule (standing): edit the existing sections where bugs live; new files only when genuinely needed | 2026-11-23 ~05:11 | Not verifiable in CDP | Standing rule — complied with | Standing rule. This lane changed no app code; its only repo change is this document, in place. |
| C-29 | Skills (standing): keep using the skill library — read each SKILL.md in full on the VM, mine public wallet repos, report skills/repos actually used, no verbatim copying without a licence check | 2026-11-23 ~05:11 | Not verifiable in CDP | Standing rule — complied with | Standing rule. Skills read in full on the VM (see "Skills used"). No repo code copied; no new dependency. The CDP harness was adapted from the Round 2 lane-E script, not written from scratch. |
| C-30 | UI/UX preview link dead — fresh tunnel | 2026-11-23 ~10:25 | Not verifiable in CDP | Implemented | Process order; tunnel expired since, as free tunnels do. |
| C-31 | Two open decisions asked via tap widgets: (a) five new-chain stables as defaults? (b) 40 px keep or revert? | 2026-11-23 ~10:3x | Not verifiable in CDP | Implemented | Process order; both answered by the owner 2026-11-23 ~14:17 (C-32, C-33). |
| C-32 | "Leave them in Add Token" — the 5 verified new-chain stables stay in Add Token, NOT defaults; dashboard stays at 43 rows | 2026-11-23 ~14:17 | Done | Implemented | CDP: `DEFAULT_TOKENS` has 21 entries; the five stables' chains (Gnosis/Celo/Linea/Scroll/Fantom) appear in the Add Token dialog's chain list, not in the defaults. 43 rows render (C-18). |
| C-33 | "Keep the 40 px fix" | 2026-11-23 ~14:17 | Done | Missed — fixed by Lane 1 | Same item as C-14. CDP-confirmed (see C-14). Do not re-ask. |
| C-34 | UI/UX Round 2 programme, 10 items | 2026-11-23 ~15:28 | Partial | Implemented | CDP confirms: (1) QrCard (QR, amount, address, token + chain, logos) and QR auto-select — a Base USDC EIP-681 QR upload prefills chain + token + amount 25 + recipient and lands on step 3; (2) deep link cold start keeps the payment, "Continue to your send" after create (amount 0.5 prefilled) AND after import (see F-2 note below); (3) watch search combobox filters + recent persists across reload; (4) headings render in Baloo 2; (6) devnet shows live per-unit prices; (9) scan icon is 44×44 with an upload fallback that decodes QR images — live camera not verifiable in CDP (O-08). (5) copy rewrite sampled only (plain en-GB on the screens visited, no AI tells spotted — not an exhaustive pass). (7) mobile pass sampled (no horizontal overflow at 390; 16 px inputs not measured). **(8) FAILS on the Receive step:** the amount + QR step scrolls at 390×844 — the template buttons are below the fold (see C-41). (10) docs done; push audit re-verified (see C-04). |
| C-35 | README showcase + Add Token programme: (A) README wallet-UI showcase like another repo's README; (B) wording — fully functional example wallet, never "template", chain count stated properly; (C) separate create instructions; (D) Add Token — any token by contract, price detected live | 2026-11-23 ~15:37 | Partial | Partially implemented | (A) Still blocked — the owner never named the repo or attached a link; nothing invented. (B) Done in substance: README states "22 chains" + "the guide covers … 168 chains"; the single "template" in README is "bug report template" (GitHub Issues), not the wallet called a template — the old "zero 'template'" was literally off by one word in an unrelated sentence. (C) `docs/CREATE-EXAMPLE-WALLET.md` exists (4,076 bytes) and is linked from README:18; the clean-checkout follow-through was NOT re-done by this lane. (D) CDP: Add Token dialog accepts a contract address and returns "Token added" (PEPE on Ethereum); the live price on the added token's row was not confirmed in CDP — but E2E itemD proves it (SHIB via CoinGecko, ANTS/DISC via DexScreener, aGnoGHO honestly "Price unavailable"; all 8 itemD specs passed across Lane D's full-suite runs, the two 2.0 m timeouts being live-network flakes that passed alone). **Lane F update (2026-11-23):** itemD in this lane's runs — ANTS, SHIB and aGnoGHO pass in the full suite; DISC fails in the full suite AND alone AND on the pristine `d47d282` baseline (2.0 min, Solana-side); MY fails in the full suite but passes alone (suite-load flake); SHIB/NOT flip by run (CoinGecko 429s). |
| C-36 | Deep audit + devnet E2E programme, 5 lanes (bug hunt + reverify, devnet E2E all chains, HD verification incl. bot use case, multichain start to finish, gap analysis) | 2026-11-23 ~18:10 | Not verifiable in CDP | In progress (parallel programme) | Parallel programme, merged into token-gaps (via the marketing-fix merge `571f0fb`; token-gaps tip `d47d282`, fresh `ls-remote` 2026-11-23). `docs/GAP-ANALYSIS.md` exists on this tree with all 24 gaps. |
| C-37 | Reverify + professional polish programme, 5 lanes | 2026-11-23 ~18:14 | Not verifiable in CDP | In progress (this programme) | This programme. Lane 1 is the checklist corrected here; lanes 2–5 report separately; merged into token-gaps at `ccb8195` → `71326e1`. |
| C-38 | Bawa work by Muse hands-on on gray-pinee, 0 Sol calls while the API is below $1 (confirmed for the desktop-layout work) | 2026-11-22 | Not verifiable in CDP | Standing rule — complied with | Standing rule. This lane: hands-on Muse on gray-pinee, **0 Sol calls, 0 AgentRouter calls, 0 runner invocations**. |
| C-39 | API $1 stop rule: stop if the API goes below $1; do not switch to API 1 | 2026-11-21 ~04:09 (standing, in force throughout) | Not verifiable in CDP | Standing rule — complied with | Standing rule. Sol stays stopped in this lane; no Sol call was made or attempted. |
| C-40 | Marketing fix + found-bugs programme, 6 lanes (owner order with phone screenshots: mobile '$0.00 (Partial)' + desktop 'Ethereum history unavailable' + Retry) | 2026-11-23 ~19:14 | Not verifiable in CDP | — (new) | This programme. Merged into token-gaps (merge `571f0fb` + follow-up; tip `d47d282`, fresh `ls-remote` 2026-11-23); branch `panel-rebuild/marketing-fix` at `a8018fd`. Lane 1 owns the (Partial)/Retry/history defects; Lane 7 owns the QR templates. |
| C-41 | CORRECTION: the three QR templates (Address, Payment request, Share link) are NOT done | 2026-11-23 ~19:16 | Done | — (new) | **Lane D CDP, this tree:** fixed by marketing-fix Lane 7 and verified live. Details step at 390 px (screenshot `11-receive-details-390.png`, viewed): main QR 136×136 measured, two 64×64 template QRs (Address, Share link) visible, and the heading now labels the shown template — "QR type: Payment request — tap another to switch" — the exact defect this row cited. The details step still scrolls 426 px at 390 px (content 1,270 px in an 844 px viewport; action buttons below the fold) — that is gap 14, not this row. **Lane F (2026-11-23): re-measured live on the merged tree** — main QR 136×136, all three template segments present (Address / Payment request / Share link), QR decodes via jsQR to the rotated SOL address. |
| C-42 | CORRECTION: the re-verification was NOT properly checked — redo it browser-first | 2026-11-23 ~19:17 | Done | — (new) | **Lane F (merge lane, 2026-11-23): redone browser-first.** Every lane headline re-verified live in CDP on the merged tree (root-base build, Playwright chromium-1255, 390/820/1440/1919): SOL rotation + QR decode, TON second address, CELO shared address, LTC zpub import, Vitalik 16/16 fan-out, CoinGecko-blocked prices + Fantom, Celo history empty state, Transactions honest empty state, Receive redesign + 136 px QR + 3 templates, single Create button, no Popular chains + Scan tile, cold load 1,376,967 bytes, both SVGs render. Full evidence: `docs/FINISH-PRODUCT-PROGRAMME.md`; screenshots `/home/boxd/workspace/bawa-finish-f-shots/` (viewed). E2E full suite 15/24 (live-network failures, reproduced identically on the pristine `d47d282` baseline; E2E-02 is the known real bug). |

## Wrong old verdicts (old verdict vs browser reality vs why)

- **W-1 — C-16 (Implemented → Missed in this tree).** Old: "Implemented", evidence `bf00f54` on `desktop-layout-v2`. Browser reality: at 980 px this tree shows the mobile layout (sidebar `display=none`, bottom nav, narrow column — screenshot `l8-home-980.png`, viewed). Why: the evidence came from a different, unmerged branch; the token-gaps tree never got the 980 px breakpoint.
- **W-2 — C-25 (Implemented → Partial).** Old: "All 21 items", evidence code spots. Browser reality: 15–17 of 21 confirmed on screen; the Web Share files path, live RPC failover, balance-aware ordering and the QR templates were not shown working in CDP. Why: code spots were treated as screen proof.
- **W-3 — C-34 (Implemented → Partial).** Old: "All 10 items", evidence code spots. Browser reality: item 8 fails on the Receive step — the amount + QR step scrolls at 390×844 and the template buttons are below the fold. Why: the no-scroll claim was never measured on the rendered step.
- **W-4 — C-21 (Implemented → Partial).** Old: "Implemented", evidence endpoint strings in `chains.ts`. Browser reality: the DOGE row renders "Balance unavailable" and the dashboard shows 3 Retry buttons on failed rows; sochain and BlockCypher both 429 the shared VM IP. Why: endpoint strings were treated as working balances; live delivery from this VM was never checked.
- **W-5 — C-13 (Implemented → Partial).** Old: "Implemented", evidence the follow-up's CDP screenshots. Browser reality: this lane re-confirmed the rail and the subpath, but P1–P10 were not individually re-proven. Why: a prior lane's screenshots were inherited as this checklist's evidence without re-checking each item.
- **Precision correction, not a verdict change — C-35 (B).** Old: 'zero "template" in `README.md`'. Reality: one occurrence — "bug report template" (GitHub Issues). The wallet is never called a template; the substance holds.

**NOT wrong, now CDP-backed:** F-2 (import "Continue to your send") — confirmed end to end in CDP, with one probe trap worth recording: the import flow's "Check the restored addresses" step has its OWN vault-password fields, and "Save to vault" does nothing visible until they are filled (an empty save shows "Vault password must be at least 8 characters." — screenshot `l8e-empty-save-390.png`, viewed). Two of this lane's early probes stopped at that step and wrongly recorded the link as absent; the completed flow shows "Wallet restored" → "Continue to your send" → amount 0.5 + recipient prefilled.

## Fixes made by this lane

**No app-code changes.** The two live defects this re-verification found are
already owned by parallel lanes in this programme — the "(Partial)" hero +
"history unavailable" + Retry (Lane 1) and the QR templates / Receive
no-scroll step (Lane 7) — and the brief forbids re-fixing them. The one
other missed item (C-16, the 980 px breakpoint) needs the owner's decision
(D-01 below), not a silent port: porting it would ship part of the
unreviewed desktop-layout programme into token-gaps. Nothing else missed
that is in scope for this lane was found.

**Method fixes (skills, VM copy only):**

- `custom-skills/cdp-visual-verification/SKILL.md` — the skill suggested
  `vite preview` for local CDP; with base `/bawa/` that 404s
  `/bawa/assets/*.js` (O-01). Now says: serve the built dist statically
  (`serve-dir.cjs` pattern), hash-verify before capturing.
- `custom-skills/order-traceability-checklist/SKILL.md` — the verdict table
  forbade "in progress" and had no browser-first verdict; now admits `in
  progress (parallel programme)` and `not verifiable in CDP` (with the rule
  that a UI claim checked only in code is `missed` in the browser-first
  sense, not `implemented`).

The sandbox copies of these two skills still carry the old text — the
coordinator should sync them. No other skill was used. No repo code was
copied verbatim; no new dependency was added.

**Open items resolved by CDP evidence (no code change):** O-06 (1919
settled-dashboard widths — screenshots `l8-dash-1919.png` viewed: no
clipping, full-width layout) and O-10 (word grid at 1024 px — grid 524 px
wide, 3 columns, widest word 67 px, no horizontal overflow).

## Still open — needs the owner's decision or action

| # | Item | Why it needs the owner | Status |
|---|---|---|---|
| O-01 | E2E harness vs `base: '/bawa/'` — 2 specs fail at boot because `vite preview` 404s `/bawa/assets/*.js` | Needs a decision: serve the bawa-layout static server for E2E, or build with `--base /` for E2E runs | **Resolved (Lane E, ADR-0011 + this lane):** root-base build for E2E (`build:e2e`, `preview:e2e`, `E2E_PORT` in `playwright.config.ts`; CI e2e job builds with `build:e2e`). Lane D ran the full suite 4 times on token-gaps `d47d282`: 22/24, 23/24, 22/24 (killed run 19/20 before that). E2E-05 was a stale test contradicting the app's deliberate rule — rewritten in place, green alone (56.2 s) and in run 3. E2E-02 exposes a real devnet-derivation race (see GAP-ANALYSIS gap 4). Item D Jetton timeouts are live-network flakes (pass alone). |
| O-02 | Devnet Issue 5 — TON first send from a fresh wallet cannot deploy (signed BOC carries no state init); blocks first TON send on mainnet too | Needs a design decision (V4R2 state-init BOC builder) | **Resolved (Lane B, verified by Lane D):** closed — the 2026-11-22 inference was wrong; the init IS present in the app-signed BOC (TonViewer tx `4f35a862...fe4a42c0`). No BOC builder needed; no app code carries `state_init` (Wallet Core sets it). `DEVNET-ISSUES.md` Issue 5 updated to [CLOSED]. |
| O-03 | Devnet Issue 6 — `/track` cannot resolve a TON message hash, but the result screen displays the message hash as "Transaction" | Needs a fix decision | **Resolved (Lane B, verified in code by Lane D):** fixed — `apps/web/src/wallet/tracker.ts:300-305` matches both the transaction hash and the base64 `in_msg.hash`. `DEVNET-ISSUES.md` Issue 6 updated to [FIXED]. |
| O-04 | BTC/ETH/TRX devnet faucets — captcha-blocked; 0 tokens obtained after the captcha-bypass programme | Owner-side only: complete the captchas in their own browser with the wallet-A devnet addresses, or accept BTC/ETH/TRX as unproven | Open; owner action. Wallet-A addresses are in `DEVNET-ISSUES.md` Issue 7. |
| O-05 | Non-zero DOGE watch-row render unproven | Needs a funded DOGE xpub or an accept | Open since token-gaps. Note from this lane's CDP: watch-only DOGE takes an **xpub**, not a plain address ("Only extended PUBLIC keys or TON public addresses are accepted"). |
| O-06 | E2E-03/06 need a stable-network run; 1919 settled-dashboard widths not captured | — | **Resolved by this lane (CDP):** 1919 widths captured and viewed (`l8-dash-1919.png` — no clipping, full-width layout). E2E-03/06 stay environment-blocked. |
| O-07 | Review + sign steps CDP-unverified (vitest-covered only — a fresh disposable wallet holds no funds, so any positive amount is honestly stopped at the details step) | Needs a funded test wallet or an accept | Open; unchanged by this lane. |
| O-08 | Live camera scan path unverified (headless Chromium denies `getUserMedia`; image-upload fallback verified instead) | Needs the owner's phone | Open; unchanged. Upload fallback CDP-proven again this lane (Base USDC QR prefills). |
| O-09 | Receive tagline removed in Round 2 item 8 to make the no-scroll steps fit | Owner may miss it — restore it somewhere, or leave it removed | Open; needs owner word. Flagged, not rebuilt without that word. (Note: the no-scroll fit it was removed for does not hold on the Receive QR step — see C-34/C-41.) |
| O-10 | Word grid at exactly 1024 px has ~34 px slack for the worst-case word | — | **Resolved by this lane (CDP):** at 1024 px the recovery-word grid is 524 px wide, 3 columns, widest word 67 px, no horizontal overflow. |
| O-11 | Publish the new desktop build to GitHub Pages vs leave Pages on the saved `67c48e2` build | Needs the owner's pick | Open; needs owner decision. Pages still serves the saved build (`gh-pages ee63a13`, live-verified this lane: 200, JS hash matches the branch). |
| O-12 | README wallet-UI showcase (showcase programme item A) | Blocked: the owner never named the reference repo or attached a link | Open; needs owner input. Nothing invented. |
| D-01 | **NEW — C-16:** the 980 px breakpoint exists only on unmerged `desktop-layout-v2`. Port just the breakpoint to token-gaps, merge that branch's breakpoint, or accept the mobile layout at 980 px? | Owner decision — porting pre-empts the owner's pending review of the desktop-layout programme | Open; needs owner decision. This lane did not port it. |
| D-02 | **NEW — found bug, not an owner order:** `/lock` renders TWO `<main>` landmarks (the app shell's plus the lock screen's `aria-labelledby="lock-title"`), a duplicate-main accessibility defect. No manual "Lock now" control exists anywhere in the UI — the vault locks only via the auto-lock timer. | Referred to Lane 2 (found-bugs lane) — not fixed by this lane | **Resolved (marketing-fix, verified first-hand by Lane D in CDP on this tree):** `/lock` renders exactly 1 `<main>` (measured + screenshot `09-lock-390.png` viewed — clean unlock card) and `/security` has a "Lock now" button (measured `hasLockNow: true`). |
| D-03 | **NEW — scope note:** the deep-audit programme (C-36) and the marketing-fix programme (C-40) run in parallel; their branches are local-only and unpushed. | Coordinator's call when they land | **Landed (Lane D, 2026-11-23):** both merged into token-gaps — deep-audit via the marketing-fix merge `571f0fb`, marketing-fix at `a8018fd`; token-gaps tip is now `d47d282` (fresh `ls-remote`). |

## Not ordered — no action taken

- Merging `desktop-layout-v2`, `devnet-temp`, `token-discovery` or
  `token-gaps` into adopt-proper or main: **not ordered**. The owner
  reviews first; merging is a separate decision each time.
- Porting the devnet-branch TON seqno/fee fixes to mainnet: **not
  ordered** (separate decision; the fixes live only on `devnet-temp`
  / in the merged token-gaps tree's devnet mode).
- Devnet exception E1 expires 2027-02-20: renew or remove devnet by
  then (removal checklist in `docs/DECISIONS.md` §9). Future, not due.

## Known limitations carried honestly (not misses)

- Token contract tail truncated on one-line rows (Round 2 item 8):
  name, symbol and verified tick stay readable; the full contract
  stays in the DOM and in Add Token. Cosmetic, recorded.
- CoinGecko keyless feed rate-limits on the shared VM IP (429s) and
  sochain / BlockCypher keyless quotas are exhausted on the shared VM IP
  (both 429 at the time of this lane's checks): the app retries and
  degrades honestly ("Price error", "Partial total", "Balance
  unavailable"). Environmental, not a code miss — but it is exactly what
  the owner sees on a fresh wallet, which is why Lane 1 exists.
- External wallet apps not tested for deep links: cannot be tested
  from the VM. The Bawa web link is CDP-proven.
- `/assets` deep links on Pages return HTTP 404 status while rendering
  via the `404.html` fallback — cosmetic, browsers render the app.
- E2E-03/06 environment-blocked (see O-01/O-06).
- Review + sign steps and the live camera path cannot be verified in
  headless CDP (O-07, O-08) — they need a funded test wallet and the
  owner's phone respectively.
- The Web Share API files path cannot run in headless Chromium (no share
  target); only the download fallback was CDP-proven (C-25 item 4).

## Gates (this lane's worktree, first-hand)

Run on `/home/boxd/workspace/bawa-mkt-l8-worktree`, Node 22.23.4,
`apps/web`, on the untouched tip `71326e1` (this lane changed no app code):

- `npm run build`: 0 (`tsc --noEmit` 0, vite built in 1.68 s, palette
  audit passed: 29 approved colour literals). Dist JS
  `assets/index-Co_iBr5E.js`, served and hash-verified for every CDP run.
- Full vitest suite: **not re-run by this lane** — no code was changed, so
  there is nothing to regress; the base tree's gates stand (reverify
  programme: 1,722 passed / 5 skipped, 90 files). The checklist and skill
  edits in this lane are docs-only.
- CDP: 8 scripts, all completed (`LANE8_CDP_DONE` … `LANE8H_CDP_DONE`);
  every section that failed did so for a recorded probe reason (wrong
  route, wrong selector, or a step the probe had not reached), and each
  was re-probed with corrected selectors — no CDP failure was left
  unexplained. Console errors per section were captured in the results
  JSONs (no page errors that change a verdict; the copy action reports
  "Unable to copy. Please copy it manually." in headless Chromium, where
  there is no clipboard — the status line itself still appears, which is
  what the 40 px check needs).

## Skills used (read in full on gray-pinee)

- **order-traceability-checklist**
  (`/home/boxd/workspace/custom-skills/order-traceability-checklist/SKILL.md`):
  the order-set-first method and the fix-or-record loop. Changed: the
  verdicts in this checklist, and a small addition to the skill itself
  (the `in progress` / `not verifiable in CDP` verdicts a browser-first
  brief requires).
- **cdp-visual-verification**
  (`/home/boxd/workspace/custom-skills/cdp-visual-verification/SKILL.md`):
  build + hash-verify, serve fresh, capture at the owner's viewports, check
  the state the owner is actually in, view the screenshot. Changed: the
  verdicts in this checklist, and the skill's `vite preview` line (now
  bans it for this repo — static serve instead).

No other skill was used. No repo code was copied verbatim; no new
dependency was added. Public wallet repos were not re-mined by this lane
(the CDP harness was adapted from the Round 2 lane-E script in
`/home/boxd/workspace/bawa-uiux-round2/cdp-lane-e-verify.mjs`, and the
static server from `/home/boxd/workspace/bawa-deep-audit/serve-dir.cjs`).

## CDP evidence index

All under `/home/boxd/workspace/bawa-mkt-l8/cdp/` on gray-pinee:

- Scripts + results: `l8-cdp-verify.mjs` / `l8-results.json`,
  `l8b-…`, `l8c-…`, `l8d-…` (import Continue proof), `l8e-…`,
  `l8f-…`, `l8g-…` (auto-lock proof), `l8h-…` (same-phrase + rotation).
- Screenshots viewed by eye: `l8-receive-390.png` (templates below the
  fold), `l8-dash-390.png` ("$0.00 (Partial)"), `l8-home-980.png` (mobile
  layout at 980 px), `l8-dash-1440.png`, `l8-dash-1919.png`,
  `l8e-empty-save-390.png` ("Vault password must be at least 8
  characters.").
- Screenshots captured (not all individually viewed): `l8-dash-820.png`,
  `l8-receive-1440.png`, `l8-send-chain-390.png`,
  `l8-send-after-base-usdc-390.png`, `l8-deeplink-*.png`,
  `l8-watch-*.png`, `l8-wallets-*.png`, `l8-devnet-dashboard-390.png`,
  `l8-asset-eth-390.png`, `l8-history-390.png`, `l8-mnemonic-1024.png`,
  `l8b-dash-assets-390.png`, `l8b-receive-amount-390.png`,
  `l8b-import-*.png`, `l8b-watch-doge-result-390.png`,
  `l8b-wallets-bulk-390.png`, `l8b-devnet-dashboard-390.png`,
  `l8b-asset-eth-mainnet-390.png`, `l8b-transactions-390.png`,
  `l8b-add-token-*.png`, `l8b-send-token-step-390.png`,
  `l8c-downloaded-card.png`, `l8d-*.png`, `l8e-*.png`, `l8f-*.png`,
  `l8g-locked-asset-390.png`, `l8h-*.png`.
