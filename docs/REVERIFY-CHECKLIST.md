# Reverify checklist — every owner order, 2026-11-22 to 2026-11-23 ~18:14 IST

Lane 1 of the Reverify + Professional Polish programme (coordinator
`3e052fbd`). Hands-on Muse, 0 Sol calls, 0 AgentRouter calls.
Base: `panel-rebuild/token-gaps` tip `b089c28`. Worktree:
`/home/boxd/workspace/bawa-reverify-l1-worktree` on gray-pinee.

## Method

Sources, in priority order: (1) `~/MEMORY.md` plus the daily logs
`~/memory/2026-11-22.md` and `~/memory/2026-11-23.md` (the fullest
record of the owner's words — every order below was traced to a dated
entry there, not to MEMORY.md alone); (2) the programme records on
gray-pinee under `/home/boxd/workspace/bawa-*/` (token-discovery,
token-gaps, ui-ux-fixes, ui-ux-round2, readme-showcase, captcha-faucet,
devnet-temp, desktop-v2, desktop-v2-followup, desktop-mode, pages,
fix-both, merge-adopt-proper); (3) `docs/DECISIONS.md`,
`docs/UI-UX-FIXES-PROGRAMME.md`, `docs/UI-UX-ROUND2-PROGRAMME.md` at
the tip; (4) the git log of `panel-rebuild/token-gaps` and the other
branches named below.

Verdict rule: an order is **implemented** only if the code at the tip
(or the named branch, where the order lives there) proves it — checked
first-hand by `grep` / `git show` / `ls-remote` in this lane. A claim
resting only on a lane report was re-checked first-hand; where the
re-check contradicted the report, the report is marked wrong and the
item is listed under "Missed — fixed by this lane". Nothing below is
"implemented" on a report's word alone.

What this lane did NOT re-prove live: full CDP runs and fresh preview
serves (the parallel deep-audit programme, Lane A, is re-verifying
Round 2 + showcase claims in CDP right now — duplicating that here
would double-run the same live checks on a shared VM); the E2E suite
(2 specs are environment-blocked — see O-01 — and the stable-network
run for E2E-03/06 is still open). The full vitest suite, `tsc`,
`build`, `lint` and `npm audit` were run first-hand on this lane's
worktree after the fixes (see "Gates" below).

## Summary counts

| Verdict | Rows |
|---|---|
| Implemented | 28 |
| Partially implemented | 3 |
| Missed — fixed by this lane | 2 |
| In progress (parallel programme) | 2 |
| Standing rule — complied with | 4 |
| **Total table rows** | **39** |

39 rows cover 38 distinct orders: C-14 and C-33 are one item (the 40 px
question opened 2026-11-22 ~19:17, decided 2026-11-23 ~14:17). The 12
open follow-ups O-01–O-12 below are separate from the 39 — they are
carried-forward gaps and decisions still awaiting the owner, not
orders in the table.

The three missed items are the point of this lane: the owner suspected
something from 2026-11-22 had been dropped between programmes, and
three things had been — the 40 px Receive fix lost from the token-gaps
tree, the import-path "Continue to your send" button never built, and
the item-14 cannot-add chain list never recorded. All three are fixed
in this lane (see "Fixes made by this lane").

## Checklist

| # | Order (owner's words, short) | Date | Verdict | Evidence |
|---|---|---|---|---|
| C-01 | Display method B — the 9 README diagrams become static SVGs | 2026-11-22 ~01:59 | Implemented | Main `431a1a9`; 9 `.mmd` + 9 `.svg` in `docs/diagrams/` on main; README width caps on the `<img>` tags. Verified on main. |
| C-02 | Fix all four rebuild preview issues: sidebar scrollbar, "All networks" clipped, narrow column, dead Retry while locked | 2026-11-22 ~01:59 | Implemented | `layout-rebuild 9da911b`, merged into adopt-proper `4862ba8`, ancestor of the tip (`67c48e2` is an ancestor of token-gaps). Locked-state Unlock checks present in the tip's `apps/web/src/screens/asset-detail.tsx` (lines 283, 334, 496). |
| C-03 | Merge BOTH (repo-study + layout-rebuild) into adopt-proper; do NOT merge adopt-proper into main | 2026-11-22 ~01:59 | Implemented | Adopt-proper `4862ba8`; `git ls-remote` confirms main still at `ad77cce`, adopt-proper at `67c48e2`; no merge into main. |
| C-04 | "Push which is not pushed and work on what is still not fixed" | 2026-11-22 ~02:0x | Implemented | Push check 2026-11-22 ~15:00 found nothing to push (adopt-proper `67c48e2`, main `ad77cce` in sync); fixing continued through the day. |
| C-05 | Accept F7 (~8.1 px) as best achievable for D1 | 2026-11-22 ~02:32 | Implemented | Main `ad77cce`; `docs/diagrams/architecture.svg` root `viewBox` width 571.406, README `<img width="571">`; accDescr prose verbatim under the image (README lines 68–70 on main); live 9.1 px at 390 px, still under the 10 px bar, accepted as best achievable. |
| C-06 | "Fix both": (1) sticky Refresh dead while locked on /assets/:chain; (2) verify the 5-minute auto-lock timer end to end (show the fix first if it fails) | 2026-11-22 ~14:17 | Implemented | Adopt-proper `4862ba8 → 67c48e2`. (1) Sticky bar renders Unlock while locked (`asset-detail.tsx`, present in the tip). (2) Timer passed at 300.3 s in the real app — no fix needed, nothing applied silently. `autoLockDurationMs` in `apps/web/src/wallet/auto-lock.ts:85` in the tip. |
| C-07 | "Preview link not working fix it. And push what is not pushed" | 2026-11-22 ~15:00 | Implemented | Dead gvgvc tunnel killed, fresh vbmvg tunnel minted, JS hash matched the dist; push check found nothing to push. |
| C-08 | Preview link still fails — ERR_NAME_NOT_RESOLVED | 2026-11-22 ~15:14 | Implemented | Diagnosed first-hand: Pinggy free domains resolve IPv6-only, the owner's DNS cannot resolve them. Resolved by the Pages publish (C-11). |
| C-09 | "Save it and never touch it. Mobile layout is really good" — save + lock the mobile UI/UX | 2026-11-22 ~15:28 | Implemented | Tag `save/mobile-loved-2026-11-22` on adopt-proper `67c48e2`, `ls-remote`-verified this lane (`4cce9bbd → 67c48e2`). Honest caveat, recorded by the programmes: strict pixel-identical is unachievable with live prices/clocks (control: the branch vs itself differed by up to 687 px); mobile is verified structure-identical (widths, columns, order, overflow) at 390/820 instead. |
| C-10 | A DIFFERENT desktop layout with the SAME UI/UX (1440/1919 px, layout change only) | 2026-11-22 ~15:28 | Implemented | `panel-rebuild/desktop-layout-v2` `ed0abba → 0e194f4 → bf00f54`; no merge into adopt-proper or main; mobile structure-identical vs the saved tag. |
| C-11 | "Publish to GitHub Pages" (tapped option) | 2026-11-22 ~15:36 | Implemented | `panel-rebuild/pages-base` `cd39306` (deliberately unpushed — `ls-remote` returns no pages-base ref, verified this lane); `gh-pages` `ee63a13`, verified still current this lane; live at https://pr3eve6ti2o.github.io/bawa/. |
| C-12 | "Progress update?" | 2026-11-22 ~16:37 | Implemented | Status answered from a first-hand subagent-list check. |
| C-13 | "Check in your live browser. Use puppeteer or something like this to check if you have to. And fix minor defects you find on the way so it looks more polished." | 2026-11-22 ~16:47 | Implemented | Desktop follow-up `0e194f4`: dashboard quick-actions rail, P10 trailing-slash fix (`outletWrapperClass`), polish P1–P10, all CDP-verified with screenshots viewed. |
| C-14 | Mobile Receive 40 px — "Keep the 40 px fix" (question opened 2026-11-22 ~19:17, decided 2026-11-23 ~14:17) | 2026-11-23 ~14:17 | Missed — fixed by this lane | The decision is real and the fix is in `desktop-layout-v2` (`bf00f54`, `receive.tsx:282` renders the status `<p>` only when `copyStatus !== ''`). But the token-gaps tree had LOST it: the UI/UX Receive rework left the status `<p>` rendering unconditionally (`receive.tsx:678-680` at the tip), reintroducing the dead space the owner ordered kept. Fixed in place by this lane — see F-1. |
| C-15 | "Show live preview" | 2026-11-22 ~19:11 | Implemented | Fresh icxql tunnel minted on the `0e194f4` dist, JS hash matched; expired since, as free tunnels do — the durable link is Pages (C-11). |
| C-16 | Phone screenshot: "still mobile layout in desktop mode" + "use top GitHub repos with stars and forks … why is there a Retry icon, is it really needed there, do some finishing and it should not break" | 2026-11-22 ~19:28 | Implemented | `bf00f54`: root cause proven in CDP (phone "Desktop site" mode = forced 980 px viewport; app keyed the desktop shell off `lg:` = 1024 px). Shell-only 980 px breakpoint (`@theme --breakpoint-desktop: 61.25rem` in `globals.css:382`, 15 `desktop:` uses in `app.tsx`, verified in the tree). Retry gated on `balance.reason !== 'no-address'` (verified in `asset-detail.tsx` at `bf00f54`); no-wallet state shows one empty-state block. Repos mined: MetaMask, shadcn-ui, BlueWallet, RainbowKit. Caveat carried honestly: final confirmation rests on the owner's phone — a VM cannot run Brave on a real phone. |
| C-17 | "Add devnet temporary so we can test send and receive … get some devnet token for each chain yourself. And tell me how it went. Devnet will be temporary" | 2026-11-22 ~19:53 | Partially implemented | Mode built and pushed (`devnet-temp 1b04269`, merged into the token-gaps tree via ui-ux-fixes `dfa2de5`; `8994584` is an ancestor of the tip). TON receive/send/track proven by real devnet transactions. BTC/ETH/TRX NOT proven — unfunded, all no-account faucets captcha-blocked. 9 derive-only chains + 6 logo-only ERC-20s not testable (no adapter). Issues written down in `DEVNET-ISSUES.md` (240 lines). "Tell me how it went" was delivered. Remainder is O-02/O-03/O-04. |
| C-18 | Token discovery: wallet loads with 20 tokens from different chains; one "Add token" button that adds a whole chain and adds a token by contract address | 2026-11-22 ~20:51 | Implemented | `panel-rebuild/token-discovery f76245a`. In the tip: 22 chains (`SUPPORTED_CHAINS`, `chains.ts:675`) + 21 default tokens (`DEFAULT_TOKENS`, `tokens.ts:31`) = 43 dashboard rows; Add Token flow with contract validation, CoinGecko prices, Trust Wallet logos. |
| C-19 | Devnet scope expanded to ALL tokens: send, receive and track each one, write issues down at the end | 2026-11-22 ~20:54 | Partially implemented | Same scope limit as C-17: only TON proven; BTC/ETH/TRX unfunded; 9 chains + 6 ERC-20s not testable. The parallel deep-audit programme (Lane B) retries the faucets and checks Issues 5–10 — in progress, not duplicated here. |
| C-20 | "Try these repos for captcha but check these chains too" (5 captcha repos, 4 blocked faucets) | 2026-11-22 ~22:01 | Implemented | Attempted and honestly reported: **0 test tokens obtained** on all four faucets; `DEVNET-ISSUES.md` Issue 7 updated (`devnet-temp 8994584`, docs-only). No paid solver, sign-up, payment or owner account used; no new wallets; no app code changed. Unblock is owner-side (O-04). |
| C-21 | Token gaps: free SOL/DOGE RPCs that work from a browser, Base USDC as #21, Receive fix, QR + amount + share + deep link with chooser and prefill, Send showing only four tokens, Wallets explanation, watch wallet test, portfolio "Unavailable" — plus live-browser bug hunt, duplicate Create buttons, multichain + HD verified, skills/repos | 2026-11-22 ~23:21 + ~23:26 + ~23:27 | Implemented | `panel-rebuild/token-gaps 488f644`. Spot-verified first-hand in the tip: SOL `solana-rpc.publicnode.com` + Vibe Station fallback and DOGE sochain + BlockCypher fallback in `chains.ts:388,516`; Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` in `tokens.ts:100`; `wallet/payment-links.ts` (BIP-21, EIP-681, Solana Pay, `ton://`, no invented `tron:` URI); 15-word import gate (`import-wallet.tsx:194,427`); watch-only hydration iterates `ALL_CHAIN_IDS` (`wallet-context.tsx:491,544`); duplicate Create removed (welcome CTA settled by UI/UX item 9). Known sub-gaps carried as O-01, O-05, O-06. |
| C-22 | "Is there anything that is still not pushed?" | 2026-11-22 ~23:35 | Implemented | Answered first-hand from fresh `ls-remote` + ancestry checks; nothing unpushed except deliberate (`pages-base`, old local-only lane branches). |
| C-23 | "Is there anything that is still not pushed?" (asked again) | 2026-11-23 ~01:35 | Implemented | Answered first-hand; same state as C-22. |
| C-24 | "Working?" | 2026-11-23 ~01:44 | Implemented | Status answered (token-gaps programme then running). |
| C-25 | UI/UX Fixes + Build programme, 21 items | 2026-11-23 ~04:40 | Implemented | `panel-rebuild/ui-ux-fixes a9eb6aa` merged into token-gaps (`4eb0242`). All 21 items. Spot-verified first-hand in the tip: `dvh` layout (`app.tsx:251,259,276`); devnet pill + Networks switch; QR-as-image share; import 24/25 in one section; same-phrase second account; bulk accounts; HD rotation; Welcome rebuilt with no Create button; "SOON" fixed for the web wallet; price-blanking fix; asset rows with balance + value + price; Add Token all chains; +9 chains (C-18); copy button; watch wallet all chains; multi-account without deleting; HD primary tokens (21 defaults, 43 rows); RPC failover (`RpcEndpointManager` in `network-selection.tsx`); stepped Send/Receive; programme doc. Sub-gaps: item-14 record (fixed by this lane, F-3), E2E-03/06 (O-01), non-zero DOGE watch row (O-05), 1919 widths (O-06). |
| C-26 | CORRECTION: "You never said about waiting for my review?" — do not state token-gaps is "waiting for your review" | 2026-11-23 ~04:48 | Implemented | Standing correction recorded in MEMORY.md; nothing is "pending review" unless the owner says so. No code involved. |
| C-27 | "Merge it and do this on top of that branch after current is done by you" / "Add wherever you feel like it" — merge destination delegated | 2026-11-23 ~05:11 | Implemented | `ui-ux-fixes` merged into `token-gaps` (`4eb0242`); further work continues on top of token-gaps; the tip `b089c28` is that line. Adopt-proper and main untouched for code. |
| C-28 | In-place fix rule (standing): edit the existing sections where bugs live; new files only when genuinely needed | 2026-11-23 ~05:11 | Standing rule — complied with | This lane fixed in place: `receive.tsx`, `import-wallet.tsx`, three programme docs. The only new file is this checklist, which the lane brief orders. |
| C-29 | Skills (standing): keep using the skill library — read each SKILL.md in full on the VM, mine public wallet repos, report skills/repos actually used, no verbatim copying without a licence check | 2026-11-23 ~05:11 | Standing rule — complied with | Read in full on gray-pinee: `test-driven-development` (400 lines — RED-first tests for both fixes) and `code-review-and-quality` (402 lines — five-axis method for this reverify). No repo code copied; no new dependency. |
| C-30 | UI/UX preview link dead — fresh tunnel | 2026-11-23 ~10:25 | Implemented | Renewed and sent ~10:30–10:31 IST (qdcqx). |
| C-31 | Two open decisions asked via tap widgets: (a) five new-chain stables as defaults? (b) 40 px keep or revert? | 2026-11-23 ~10:3x | Implemented | Both answered by the owner 2026-11-23 ~14:17 (C-32, C-33). Stale widgets must not be re-presented. |
| C-32 | "Leave them in Add Token" — the 5 verified new-chain stables (Gnosis USDC, Celo USDm, Linea USDC, Scroll USDC, Fantom USDC) stay in Add Token, NOT defaults; dashboard stays at 43 rows | 2026-11-23 ~14:17 | Implemented | Verified first-hand in the tip: `DEFAULT_TOKENS` has 21 entries on chains eth/arb/avax/base/matic/op/bsc/sol/ton/trx only — no Gnosis/Celo/Linea/Scroll/Fantom stable; the five chains are Add Token chains (`EVM_TOKEN_CHAINS`, `tokens.ts:324-340`); 22 chains + 21 tokens = 43 rows. No code change was needed. |
| C-33 | "Keep the 40 px fix" | 2026-11-23 ~14:17 | Missed — fixed by this lane | Same item as C-14 (one question, one decision). The fix was kept on `desktop-layout-v2` but lost from the token-gaps tree; restored by this lane (F-1). Do not re-ask. |
| C-34 | UI/UX Round 2 programme, 10 items | 2026-11-23 ~15:28 | Implemented | `panel-rebuild/ui-ux-round2 5da29a8` merged into token-gaps (`6147b74`). All 10 items. Spot-verified first-hand in the tip: QrCard (`screens/qr-card.tsx`); pending-link helpers + "Continue to your send" on the create ready screen (`create-wallet.tsx:599-608`); watch search combobox (`screens/chain-search-select.tsx`, WAI-ARIA combobox, `bawa:watch-only-recent-chains`); Baloo 2 display font (`globals.css:11,327`) with zero Caveat references in `apps/web/src`; copy rewrite; devnet prices (fetch gate lifted, fiat valuation suppressed — `wallet/prices.ts:820-826`); 16 px inputs on coarse pointers (`globals.css:459`) + `viewport-fit=cover` (`index.html:5`); no-scroll stepped flow; ScanIcon. Sub-gaps: import-path continue button (fixed by this lane, F-2), review/sign CDP-unverified (O-07), live camera unverified (O-08), Receive tagline removed (O-09), token-contract tail truncation (known cosmetic), word grid at 1024 px (O-10), E2E harness (O-01). |
| C-35 | README showcase + Add Token programme: (A) README wallet-UI showcase like another repo's README; (B) wording — fully functional example wallet, never "template", chain count stated properly; (C) separate create instructions; (D) Add Token — any token by contract, price detected live | 2026-11-23 ~15:37 | Partially implemented | (A) BLOCKED — the owner never named the repo or attached a link; nothing invented, nothing built. (B) Implemented: zero "template" in `README.md`; "22 chains" + "the guide covers … 168 chains" (`README.md:14,16`). (C) Implemented: `docs/CREATE-EXAMPLE-WALLET.md`, linked from `README.md:18`. (D) Implemented: `wallet/dex-prices.ts` (DexScreener) + TonAPI fallback, `screens/add-token.tsx`; honest "price unavailable" when no source has it. Merged into token-gaps (`5b84b72`, `eab8861`). |
| C-36 | Deep audit + devnet E2E programme, 5 lanes (bug hunt + reverify, devnet E2E all chains, HD verification incl. bot use case, multichain start to finish, gap analysis) | 2026-11-23 ~18:10 | In progress (parallel programme) | Coordinator `16bb9f99`, branch `panel-rebuild/deep-audit-devnet`, dispatched 2026-11-23 ~18:10. Not this lane's to verify; this checklist does not duplicate its CDP work. |
| C-37 | Reverify + professional polish programme, 5 lanes | 2026-11-23 ~18:14 | In progress (this programme) | Coordinator `3e052fbd`, branch `panel-rebuild/reverify-pro`. Lane 1 is this checklist; lanes 2–5 report separately. |
| C-38 | Bawa work by Muse hands-on on gray-pinee, 0 Sol calls while the API is below $1 (confirmed for the desktop-layout work) | 2026-11-22 | Standing rule — complied with | This lane: hands-on Muse on gray-pinee, **0 Sol calls, 0 AgentRouter calls, 0 runner invocations**. Stated plainly here as the owner asked. |
| C-39 | API $1 stop rule: stop if the API goes below $1; do not switch to API 1 | 2026-11-21 ~04:09 (standing, in force throughout) | Standing rule — complied with | Sol stays stopped in this lane; no Sol call was made or attempted. |

## Missed — fixed by this lane

### F-1 — P8: the 40 px Receive fix was missing from the token-gaps tree (C-14 / C-33)

**What was wrong.** On `desktop-layout-v2` (`bf00f54`) the Receive
status line renders only when there is something to report
(`{copyStatus !== '' && (...)}`, `receive.tsx:282`). In the token-gaps
tip the UI/UX rework of Receive left it unconditional
(`receive.tsx:678-680`): an always-rendered empty `<p role="status">`
under the Copy/Share buttons — the exact ~40 px of dead space P8
removed and the owner ordered kept on 2026-11-23 ~14:17. The 14:17
decision note ("the fix is already in the desktop-layout-v2 /
token-gaps trees") was wrong for token-gaps; this lane re-checked the
code first-hand instead of trusting it.

**Fix (in place).** `apps/web/src/screens/receive.tsx`: the status
`<p>` now renders only when `copyStatus !== ''`, with a comment
naming P8 and the 2026-11-23 decision.

**Proof (TDD, RED first).** New tests in
`apps/web/src/screens/receive.test.tsx`: "renders no empty status line
before any copy action (P8 dead-space fix)" — FAILED before the fix
(the empty `<p role="status">` was in the DOM) and passes after; "shows
the status line once a copy action reports" — passes (the line still
appears after Copy, with the copy message). Both files: 47 tests pass
together (see Gates).

### F-2 — Import path had no "Continue to your send" button (Round 2, item 2)

**What was wrong.** Round 2 fixed the shared-link deep-link failure
for the create flow (`create-wallet.tsx:599-608`) but the import flow
never got the same button — the Round 2 record itself lists it as
still open ("The import-wallet path has no 'Continue to your send'
button"). A user who opens a payment link and then imports a wallet
had no way back to the send; the link only resumed via the Send tab.

**Fix (in place, mirroring create).**
`apps/web/src/screens/import-wallet.tsx`: imports
`readPendingSendLinkSearch` from `../wallet/payment-links` and renders
the same "Continue to your send" button on the "Wallet restored" step
whenever a pending send link is stored. The stored query is
re-validated by the Send screen on arrival, exactly as in create.
Scope kept minimal: only the fresh-import restored screen (the direct
mirror of create step 4). The same-phrase "add as Account N" path
lands on the wallets list, where the stored link still resumes via the
Send tab — noted, not rebuilt here.

**Proof (TDD, RED first).** Two new tests in
`apps/web/src/screens/import-wallet.test.tsx`: "offers to continue to a
pending send link after restoring" — FAILED before the fix (no link in
the DOM) and passes after; "shows no continue-to-send link after
restoring without a pending send link" — passes. Both files: 47 tests
pass together (see Gates).

### F-3 — Item-14 cannot-add chain list was never recorded (UI/UX Fixes, item 14)

**What was wrong.** Both programme records carried the same open
bullet: "the chains that could not be added and why are not recorded
in the repo". No lane report on the VM preserves a per-chain
enumeration of the 146 remaining Trust Wallet Core chains, and none
is invented here.

**Fix (doc, in place).** `docs/UI-UX-FIXES-PROGRAMME.md` now records
the 9 added chains with chainId and both verified keyless endpoints
(read first-hand from `apps/web/src/wallet/chains.ts`): Scroll 534352,
Mantle 5000, Metis 1088, opBNB 204, Aurora 1313161554, Fantom 250,
Linea 59144, Celo 42220, Gnosis 100 — plus the bar (two keyless
endpoints, both answering live) and the exclusion reasons as recorded
in the 2026-11-23 ~09:29 completion (single/no keyless endpoint,
403/401, dead provider). The same stale "40 px question awaits the
owner's pick" bullets were corrected in the same pass in
`docs/UI-UX-FIXES-PROGRAMME.md`, `docs/UI-UX-ROUND2-PROGRAMME.md` and
`docs/DECISIONS.md` §§10–11 (decision 2026-11-23 ~14:17: keep the fix;
the import-path button is now built — F-2).

## Still open — needs the owner's decision or action

| # | Item | Why it needs the owner | Status |
|---|---|---|---|
| O-01 | E2E harness vs `base: '/bawa/'` — 2 specs fail at boot because `vite preview` 404s `/bawa/assets/*.js` | Needs a decision: serve the bawa-layout static server for E2E, or build with `--base /` for E2E runs | Open; needs owner decision. Not a code defect — the harness, not round-2 code. |
| O-02 | Devnet Issue 5 — TON first send from a fresh wallet cannot deploy (signed BOC carries no state init); blocks first TON send on mainnet too | Needs a design decision (V4R2 state-init BOC builder) | Open; deep-audit Lane B checks Issues 5–10. |
| O-03 | Devnet Issue 6 — `/track` cannot resolve a TON message hash, but the result screen displays the message hash as "Transaction" | Needs a fix decision | Open; deep-audit Lane B checks Issues 5–10. |
| O-04 | BTC/ETH/TRX devnet faucets — captcha-blocked; 0 tokens obtained after the captcha-bypass programme | Owner-side only: complete the captchas in their own browser with the wallet-A devnet addresses, or accept BTC/ETH/TRX as unproven | Open; owner action. Wallet-A addresses are in `DEVNET-ISSUES.md` Issue 7. |
| O-05 | Non-zero DOGE watch-row render unproven (no funded DOGE xpub for the fixture address; SOL proves the render path) | Needs a funded DOGE xpub or an accept | Open since token-gaps; carried through every programme since. |
| O-06 | E2E-03/06 need a stable-network run; 1919 settled-dashboard widths not captured | Environment-blocked (shared-VM egress will not hold ~90 s) | Open; deep-audit Lane D's start-to-finish journey covers the dashboard widths. |
| O-07 | Review + sign steps CDP-unverified (vitest-covered only — a fresh disposable wallet holds no funds, so any positive amount is honestly stopped at the details step) | Needs a funded test wallet or an accept | Partial; vitest covers the flow. |
| O-08 | Live camera scan path unverified (headless Chromium denies `getUserMedia`; image-upload fallback verified instead) | Needs the owner's phone | Open; needs owner action. |
| O-09 | Receive tagline removed in Round 2 item 8 to make the no-scroll steps fit | Owner may miss it — restore it somewhere, or leave it removed | Open; needs owner word. Flagged, not rebuilt without that word. |
| O-10 | Word grid at exactly 1024 px has ~34 px slack for the worst-case word | Worth one glance if the owner checks a 1024 px viewport | Open, minor; deep-audit Lane A is re-verifying Round 2 claims in CDP. |
| O-11 | Publish the new desktop build to GitHub Pages vs leave Pages on the saved `67c48e2` build (offered 2026-11-22 ~18:26, never answered; proactive re-offer 2026-11-23 ~15:29 expired unsent) | Needs the owner's pick | Open; needs owner decision. Pages still serves the saved build (`gh-pages ee63a13`, verified this lane). |
| O-12 | README wallet-UI showcase (showcase programme item A) | Blocked: the owner never named the reference repo or attached a link | Open; needs owner input. Nothing invented. |

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
- CoinGecko keyless feed rate-limits on the shared VM IP (429s): the
  app retries and degrades honestly ("Price error", "Partial total").
  Environmental, not a code miss.
- External wallet apps not tested for deep links: cannot be tested
  from the VM. The Bawa web link is CDP-proven.
- `/assets` deep links on Pages return HTTP 404 status while rendering
  via the `404.html` fallback — cosmetic, browsers render the app.
- E2E-03/06 environment-blocked (see O-01/O-06).

## Gates (this lane's worktree, first-hand)

Run on `/home/boxd/workspace/bawa-reverify-l1-worktree`, Node
22.23.4, `apps/web`, after the fixes (F-1, F-2) and doc updates (F-3):

- `npx vitest run src/screens/receive.test.tsx
  src/screens/import-wallet.test.tsx`: 2 files, **47 passed** (24 +
  23), including the 4 new tests — each new test was run RED first
  and failed as expected before its fix.
- `npx tsc --noEmit`: 0.
- `npm run build`: 0 (palette audit passed: 29 approved colour
  literals).
- Full vitest suite: 90 files, **1722 passed / 5 skipped** (1727
  total). Untouched-baseline comparison, first-hand: the tip before
  this lane's changes runs 90 files, **1718 passed / 5 skipped** — the
  delta is exactly the 4 new regression tests, zero regressions.
- `npm run lint`: 0.
- `npm audit`: 0 vulnerabilities.
- Root `npm test`: 0 ("All register-links checks passed"; `npm ci` in
  `tools/hdwallet-gen` first — the fresh worktree had no
  `node_modules` there, not a code failure).

Baseline rule applied: no failure was waived — there were no failures
to waive. The only suite run on a modified tree that could have hidden
a regression (the full vitest run) was repeated on the untouched tip
via `git stash` / `git stash pop`, and the worktree was verified
restored afterwards (same 7 modified files).

## Skills used (read in full on gray-pinee)

- **test-driven-development** (400 lines,
  `/home/boxd/workspace/custom-skills/test-driven-development/SKILL.md`):
  the Prove-It pattern — a failing reproduction test before each fix
  (F-1, F-2), GREEN after, full-suite verification. Changed: the 4 new
  regression tests and the two fixes they guard.
- **code-review-and-quality** (402 lines,
  `/home/boxd/workspace/custom-skills/code-review-and-quality/SKILL.md`):
  five-axis review method for the reverify itself — correctness first
  (every "implemented" verdict re-checked against code, not reports),
  no rubber-stamping. Changed: the verdicts in this checklist,
  including the three missed items the reports had called done or
  left unrecorded.

No other skill was used. No repo code was copied verbatim; no new
dependency was added.
