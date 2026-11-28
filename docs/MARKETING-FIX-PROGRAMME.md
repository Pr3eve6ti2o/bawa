# Marketing Fix + Found-Bugs programme — record

**Owner order:** 2026-11-23 ~19:14 IST, with phone screenshots (mobile dashboard
`$0.00 (Partial)`; desktop `Ethereum history unavailable` + Retry). Owner verdict:
from a marketing view, why would anyone choose this wallet — the screenshots look
bad, the Retry button should not be there, the mobile balance should not say
Partial. Fix it properly, make the repo look professional, create a new updated
diagram (not a PNG or SVG), do something about the increased branch count.

**Method:** hands-on Muse, 0 Sol calls, 0 AgentRouter calls. Branch
`panel-rebuild/marketing-fix`, created from `panel-rebuild/token-gaps` `71326e1`,
rebased onto `e290654` after the parallel deep-audit programme merged into
token-gaps. Merged into token-gaps as `571f0fb` (verified by fresh ls-remote;
merged tree is byte-identical to the verified `a8018fd` tree).
No code merged into `adopt-proper` or `main`.

## Lane 1 — Fix the first-impression defects (commit `49840e9`)

Reproduced both screenshots first on baseline `71326e1` in CDP: 390 px hero
`$0.00 (Partial)` + "Partial total…" paragraph; 1440 px 2× "history unavailable"
with 3 Retry buttons. Burst evidence: ~230 external requests in one session,
36 failed (sochain/Blockscout 429s, solana publicnode 403, BlockCypher CORS).

- **Partial:** unlock fires ~50 requests in the first second across 14
  `*.publicnode.com` hosts; `portfolioTotal` returned `{partial, "$0.00"}`
  when all loaded balances were zero. Fix: shared refresh limiter, cap 4
  concurrent network calls across all three refreshers, retries inside the
  slot (`wallet-context.tsx`); all-loaded-zero now returns the zero state and
  the dashboard shows clean `$0.00` + quiet note "Some balances or prices
  couldn't be checked just now." (`prices.ts`, `dashboard.tsx`). Non-zero
  partial totals unchanged.
- **Retry:** `eth.blockscout.com/api` returns HTTP 429 from this egress; no
  keyless history source exists to adopt. Fix is state handling: history
  Retry appears only when the wallet/chain has activity
  (`recent-activity.tsx`, `transaction-history.tsx`, `asset-detail.tsx`).
  Indexer gap recorded for the gap analysis (keyed/paid indexer or
  owner-hosted Blockscout is an owner decision).
- Verified on the fixed build: clean `$0.00` hero at 390/1440, 0
  "history unavailable", 0 Retry on Activity/Transactions/asset detail —
  even in a run with CoinGecko fully 429'd.
- **Residual (honest):** exactly one Retry remains on the settled dashboard
  — the Dogecoin row (sochain 429s on every attempt, BlockCypher fallback
  CORS-blocked in-browser). It is a live retry for a real failed fetch.
  Decisions needed: keep the DOGE row Retry or remove per-row balance
  Retries entirely; DOGE provider path.

## Lane 2 — Fix the found bugs (14 commits, `7fcc978`..`693dcf5`)

- **(a) Unused dependencies — DONE.** All 8 removed (`@radix-ui/react-avatar`,
  `react-popover`, `react-progress`, `react-radio-group`, `react-select`,
  `react-separator`, `react-toggle`, `react-hook-form`). Knip: 0 unused deps.
- **(b) Duplicates — DONE in part: 63 of 78 groups, 1,149 lines.**
  jscpd 78 prod-prod groups / 1,332 lines → 15 groups / 183 lines. Biggest
  first: prices/token-prices/dex-prices helpers, UTXO adapter pieces
  (`adapters/utxo-shared.ts`), live-price wiring (`screens/use-live-prices.ts`),
  address codecs (`engine/address-codecs.ts`), coin-type table. 15 groups
  remain with reasons recorded (hook scaffolding differs in inputs; rows
  differ in labelling; `fetchJson` cannot be used for the broadcast POST).
- **(c1) send.ts/core.ts split — DONE** (`ec68303`). New
  `wallet/signing-intent.ts` holds the pure, secret-free model moved
  byte-for-byte from core.ts; `createPartialSigner`/`withSigningKey` stay in
  core.ts (mnemonic, raw key bytes).
- **(c2) wallet-refresh.ts re-wire — NOT done; proved infeasible without
  behaviour change.** Six first-hand reasons in the lane report: 4 hardcoded
  chains vs 21 registry chains; mainnet-only vs devnet-aware; different
  retry policy (observable under 429s); `refreshing`/`stale` flags the
  context sets and the UI renders; `bawa:balances-cache:v1` the context
  writes; token balances not covered at all. Safe part done: canonical
  `BalanceState`/`BalanceStatus` shared. Decision needed: redesign
  `createRefresh` + rewrite its characterisation tests, keep it as a
  tested-but-unused module, or delete it.
- **(d) Deep-audit check — DONE.** Deep-audit had landed by then; reviewed
  its full src diff first-hand. None of its fixed bugs is in Lane 2's scope.
- **D-02 (Lane 8 referral) — DONE** (`68c3d66`). `/lock` rendered two
  `<main>` landmarks (fixed in `lock.tsx` and `transaction-detail.tsx`);
  manual lock was genuinely missing — "Lock now" button added to
  `AutoLockSetting` on /security, calling existing `lockVault()`.

## Lane 3 — Marketing view + value proposition (commit `367f38e`)

First-impression audit (CDP, fresh user, 390 then 1440): Welcome had no way
to create a wallet; it advertised things the app does not do (Android wallet,
smart contract); Create offered two cards for one wallet and understated scope
as 4 chains; the hero tagline was a joke; Send step 1 contradicted its own
banner. Fixed in place: wallet-first Welcome (Create a wallet card next to
Import, honest "What this wallet does" list, guide kept as one line); one
Create a wallet card (22-chain scope); factual hero tagline ("The total value
of your coins, in US dollars."); Send step 1 matches its banner. Value
proposition in `docs/VALUE-PROPOSITION.md`: "Your keys, your coins — on 22
chains, in your browser." Every claim verified against the code with evidence
pointers; the doc also states what the wallet does not do.

Decisions flagged, not assumed: (1) the Create card back on Welcome reverses
Lane C's deliberate removal (`2e8d708`) — confirm it stands or one-commit
revert; (2) the quiet "couldn't be checked" note still appears under a fresh
wallet's $0.00 when APIs rate-limit; (3) "Coming soon" cards dominate Create
(4 of 6) — honest labelling, removing them is a product decision.

## Lane 4 — Professional README rewrite (commit `508d7a3`)

READMEs mined live (read in full): MetaMask extension (link routing,
quickstart, Architecture), Trust Wallet wallet-core (badges, Supported
Blockchains count+link, Audit Reports, Disclaimer), BlueWallet (tagline,
feature bullets, Responsible Disclosure), RainbowKit (one-line promise,
commands-first quickstart), shadcn-ui (restraint). The owner's reference-repo
link never arrived; nothing was invented from it.

`README.md` 256 → 180 lines. Value proposition written from verified facts
only (it caught and fixed its own overclaim — addresses do go to RPC
providers). Example-wallet wording kept ("template" only for QR templates and
the bug-report template); 22-chain count with the 168-chain Trust Wallet Core
guide distinction; direct links to `docs/CREATE-EXAMPLE-WALLET.md` and
`docs/HOW-IT-WORKS.md`. Four screenshots re-shot clean on the fixed build
(dashboard desktop/mobile, Receive desktop/mobile) — clean $0.00 hero, live
prices, "No activity yet", QR card with the template row; the degraded
reverify images were overwritten in place. Caveat: one per-row Retry still
exists below the fold (DOGE, real failed fetch — not visible in any image);
Receive shots show a localhost share-link origin (small, truncated).

## Lane 5 — New updated diagram, Mermaid text (commit `876b231`)

New `docs/HOW-IT-WORKS.md` (180 lines): two Mermaid `flowchart TB` diagrams,
8 nodes each — "How Bawa starts" (Guide → Clone → Install → Build → Run →
Welcome → Create/import/watch-only → Dashboard) and "What the example wallet
does" (Vault/HD → 22 chain adapters → Balances → Prices; Receive/Send; Track;
Add Token; Devnet). No PNG/SVG. Render-validated with mermaid-cli 11.17.1 +
headless Chromium (both SVGs exit 0, 8/8 labels present per diagram). Accuracy:
all 49 cited file paths exist in the tree. Trade-off stated in the doc: the
GitHub mobile app shows Mermaid as raw code; it renders on github.com web.

## Lane 6 — Branch cleanup

Remote before: 13 branches — main `5c6dc76`, gh-pages `ee63a13`,
adopt-proper `6ac3c99`, deep-audit-devnet `9be792e`, desktop-layout-v2
`92817cf`, devnet-temp `5b991b5`, marketing-fix `a8018fd`,
readme-showcase-token `eab8861`, reverify-pro `ccb8195`, token-discovery
`ff7f30d`, token-gaps `571f0fb`, ui-ux-fixes `a9eb6aa`, ui-ux-round2 `5cbf5fc`.

Ancestry checked first-hand against token-gaps `571f0fb` with
`merge-base --is-ancestor`. **Deleted from the remote (4, all verified
ancestors):** ui-ux-round2, reverify-pro, readme-showcase-token,
deep-audit-devnet. **Kept, not ancestors — they hold post-merge doc-only
commits:** token-discovery (`ff7f30d`, 5 doc commits after merge-base
`f76245a`) and ui-ux-fixes (`a9eb6aa`, one doc commit after merge-base
`68fd75b`; its programme record differs from token-gaps' copy, so the
content is genuinely unique). **Kept, unique unmerged work:**
desktop-layout-v2, devnet-temp. **Kept, programme/protected:** marketing-fix
(the just-merged programme branch, kept like earlier programme branches),
main, adopt-proper, token-gaps, gh-pages.

Remote after: 9 branches (the 4 deletions above; ls-remote verified).

Local (gray-pinee): 59 → 56 branches. Only 3 deleted
(`panel-rebuild/desktop-layout`, `panel-rebuild/fix-perf-ui`,
`panel-rebuild/org-security-docs`) — nearly every other ancestor branch is
checked out in a worktree and git refuses to delete a checked-out branch.
`main-adopt-fixes` is not an ancestor and was kept. The remaining
ancestor-but-checked-out lane branches need a worktree-removal pass before
they can be deleted; that is handed to the finish-product programme's
Lane E (repo cleanup + branches), not forced here.

## Lane 7 — QR templates (commit `ed4459d`)

Owner correction 2026-11-23 ~19:16 IST: the three QR templates (Address,
Payment request, Share link) were reported finished but the owner says they
are not there as asked. Verified first-hand in CDP before touching anything —
the owner was right:

1. Opening Receive shows no QR at all (step 1 is a network picker; templates
   live on step 3, two taps away).
2. On the details step the alternates were 40 px (spec: 64 px), below the fold
   at 390 px (row y 786–862, viewport 844, tab bar from 770), with no heading.
3. For a token with no amount, Payment request was a disabled greyed-out
   "Not available" box — a third of the feature visibly missing.
4. The shown template was never named, and a selected payment template that
   lost its value silently fell back to the address QR.

Fixed in place (`receive.tsx` + `qr-card.tsx`): small QRs 40 → 64 px with a
heading naming the shown template ("QR type: Payment request — tap another to
switch"); amount input moved inside the card under the template row;
Payment-unavailable explained ("Needs amount" + hints), typing an amount
enables it; selected template clamped to one that has a value; duplicate
full-address line removed. Main QR stays 192 px in this lane's build — see the
merge note below for what the rebased tree actually renders.

After-fix proof (CDP, 390 + 1440, screenshots viewed): template row ends
666–762 px (ETH), 646–742 (USDC), 630–726 (TRON), 666–762 (BTC) — fully above
the tab bar in all cases. Tap-to-swap proven by main-QR payloads. Share /
download sends the selected template's card (each of the three downloaded
cards decoded with jsQR to exactly its template's payload).

Open decision (flagged, not assumed): Receive still opens on the network
picker — surfacing the QR on step 1 would change the item-20 stepped flow.

## Lane 8 — Reverify properly, browser-first (commit `72fa85e`)

Rebuilt the checklist from scratch and re-verified every row by using the app
in CDP (390/820/980/1024/1440/1919) — code presence, tests and lane reports
do not count as evidence. Corrected counts (42 rows): done 6, partial 7,
missed 2, not verifiable in CDP 23, in progress 4. The old "28 implemented
of 39" is replaced — mostly because code, merges and process answers no
longer count as "implemented". Five genuinely wrong old verdicts:

- **W-1 C-16:** 980 px breakpoint — the fix exists only on unmerged
  `desktop-layout-v2`, not in this tree. Decision needed: port just the
  breakpoint, merge desktop-layout-v2's breakpoint, or accept the mobile
  layout at 980 px.
- **W-2 C-25:** 15–17 of 21 items seen working; Web Share files path, live
  RPC failover, balance-aware ordering and QR templates not shown working.
- **W-3 C-34:** Receive amount+QR step scrolls at 390×844; template buttons
  below the fold.
- **W-4 C-21:** DOGE row renders "Balance unavailable" (sochain + BlockCypher
  both 429 the shared VM IP — environmental, adapter path verified correct).
- **W-5 C-13:** P1–P10 not individually re-proven.

The checklist doc (`docs/REVERIFY-CHECKLIST.md`, 322 lines) carries the
corrected verdicts plus a "what the first checklist got wrong" section naming
the method flaw plainly (judged a visual product by reading code, deferred
CDP runs that never happened, state-blind, confused branches). Lane 8 also
fixed two skills on the VM only (`cdp-visual-verification` now bans
`vite preview` for this repo; `order-traceability-checklist` now admits
`in progress` / `not verifiable in CDP` verdicts) — the sandbox copies were
synced by the coordinator afterwards. D-02 (double `<main>` on /lock, no
manual lock) was referred to Lane 2 and fixed there.

## Merge into token-gaps + rebase notes

The parallel deep-audit programme merged into token-gaps first
(`e290654`), so this branch was rebased onto it (20 commits replayed).
Two conflicts, both resolved by the coordinator:

1. **`receive.tsx`** (Lane 7 vs deep-audit Lane A): deep-audit put the action
   row directly under the card (fold fix); Lane 7 put the template heading
   there. Resolution: heading + small QRs first (the templates own the
   above-fold slot — the owner's explicit correction), the action row
   immediately after them (before the amount input). The trade-off is
   recorded in-code: the actions sit one short scroll below the templates
   instead of at the card bottom.
2. **`wallet/core.test.ts`** (Lane 2 c1 vs deep-audit): deep-audit imports
   the moved intent names from `'./core'`; Lane 2 moved them to
   `'./signing-intent'`. Resolution exactly as Lane 2 prescribed: split the
   import, keeping `getAccountExtendedPublicKey` in the `'./core'` import.

**Coordinator merge verification (rebased tree, CDP, screenshots viewed):**
fresh disposable wallet — dashboard hero clean `$0.00` at 390 (no Partial),
Activity tab 0 Retry / 0 "history unavailable" / "No activity yet"; Receive
details at 390: heading present, small QRs 64×64, template row bottom 706
(tab bar at 770), action row present (Copy address / Share / Download card),
tap-to-swap proven (Payment request → Share link, heading + payload change);
Welcome at 390 and 1440 shows the Create CTA with honest copy; zero page
errors. **Deviation found:** the main QR renders at **136 px, not the 192 px
spec** — deep-audit Lane A reduced it from 192 to 136 to get the actions
above the fold. Restoring 192 px would put the template row at ~762 px
(still above the fold by 8 px) but push the action row further below it.
Owner decision needed: keep 136 or restore 192.

## Gates (rebased tree, first-hand by the coordinator)

- `tsc --noEmit`: 0. Build: pass (palette audit passed).
- Vitest: **90 files, 1,748 passed / 5 skipped**.
- ESLint: 25 errors, all pre-existing in the 3 unmodified
  `apps/web/scripts/*.mjs` files (identical on baseline).
- `npm audit`: 0 vulnerabilities. Root `npm test`: 0.
- E2E: not run on this tree (deep-audit fixed the harness and ran 23/24
  on its own tree; this tree's changes are covered by vitest + CDP above).

## Skills and repos actually used

- Lane 1: `cdp-visual-verification` (read in full on the VM).
- Lane 2: `repo-hygiene-scan`, `dead-code-cleanup`,
  `code-review-and-quality` (read in full on the VM).
- Lane 3: `product-marketing` (read in full on the VM); competitor
  presentation mined from MetaMask, Trust Wallet and BlueWallet public
  homepages/listings.
- Lane 4: `copywriting`, `writing-guidelines`, `documentation-and-adrs`,
  `markdown-mermaid-writing`, `cdp-visual-verification` (read in full on
  the VM); READMEs mined live from MetaMask, Trust Wallet, BlueWallet,
  RainbowKit, shadcn-ui.
- Lane 5: `markdown-mermaid-writing`, `diagram-design` (read in full on
  the VM).
- Lane 7: `cdp-visual-verification` (read in full on the VM).
- Lane 8: `order-traceability-checklist`, `cdp-visual-verification`
  (read in full on the VM; both fixed on the VM and synced to the sandbox).

## Still open / needs the owner's decision

**Resolved since (2026-11-28, Lane A docs audit):** (1) the 136/192
QR question is superseded — the QR card was flattened to polished
style B with 7 templates A–G and QR codes at 60–62% of card width
(QR-card programme); (2) the DOGE row Retry is gone — zero per-row
Retry buttons, one list-level Retry only when at least one balance
failed (P0, `3db591e`); (3) the 980 px breakpoint is merged
(shell-only, `34849a2`); (4) the refresh re-wire is moot —
`wallet-refresh.ts` was deleted by fix-all Lane H (823 lines);
(5) devnet fiat suppression was a bug and was fixed by fix-all Lane
H; (7) the `/create` hub is deleted (P0, `33f1ff1`) — one "Create
wallet" button straight to `/create-wallet`, so the "Coming soon"
cards question is gone with it; (8) partly — Gnosis and Linea
history are fixed (keyless gnosisscan.io `d06a224`, Linea Etherscan
V2 with retry), leaving 4 history-blocked chains (bsc, opbnb,
metis, fantom), and Fantom pricing now has a CoinLore leg. Items
6 (Receive QR on step 1), 9 (reference-repo link) and 10 (live
camera scan; review/sign CDP-unverified) are still open, as is the
keyed-indexer decision in item 8.

1. Main QR 136 px vs the 192 px spec (see merge note).
2. DOGE row Retry — keep it or remove per-row balance Retries entirely;
   DOGE provider path (no working browser fallback when SoChain rate-limits).
3. 980 px breakpoint (D-01): port it, merge desktop-layout-v2's breakpoint,
   or accept the mobile layout at 980 px.
4. Refresh re-wire: redesign `createRefresh` + rewrite its characterisation
   tests, keep it as a tested-but-unused module, or delete it.
5. Token rows devnet fiat suppression — deliberate or bug?
   (`getTokenRowModel` passes `devnet=false`.)
6. Receive: surface the QR on step 1, or leave the flow as is (Lane 7).
7. Lane 3: confirm the Create card back on Welcome stands (reverses Lane C
   `2e8d708`); the quiet "couldn't be checked" note under a fresh wallet's
   $0.00; "Coming soon" cards dominating Create (4 of 6).
8. History indexer gap (keyed/paid indexer or owner-hosted Blockscout);
   Fantom price always "Price expired" (CoinGecko quote ~6.2 h stale vs
   10-min window); refresh-burst staggering design.
9. Reference-repo link for the README showcase — still missing; nothing
   from it was used or invented.
10. Live camera scan path — unverified on a real device; needs the owner's
    phone. Review/sign steps — CDP-unverified (vitest-covered only).

## Programme record locations

- Lane reports: `/home/boxd/workspace/bawa-marketing-fix/LANE{1,2,3,4,5,7,8}-REPORT.md`
  on gray-pinee (Lane 6 in the merge note below).
- CDP evidence: Lane 1 `/home/boxd/workspace/bawa-mkt-l1/cdp/`, Lane 7
  `cdp-l7/` in its worktree, Lane 8 `/home/boxd/workspace/bawa-mkt-l8/cdp/`,
  coordinator merge probe `/home/boxd/workspace/bawa-marketing-fix/cdp-merge/`.
- Worktrees: `bawa-marketing-fix-worktree` (programme branch),
  `bawa-mkt-l1/l2/l3/l4/l5/l7/l8-worktree` (lanes, detached).
