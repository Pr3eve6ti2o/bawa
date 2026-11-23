# Finish the Product programme — merge record (Lane F)

**Owner order:** 2026-11-23 ~20:34 IST. Coordinator: hands-on Muse, 0 Sol calls,
0 AgentRouter calls, 0 runner invocations. Branch `panel-rebuild/finish-product`,
from `token-gaps` `e290654`, rebased onto `d47d282` (marketing-fix merge) before
the merge lane started. Merged into `token-gaps` as [SHA TBD — see Pushes].
No code merged into `adopt-proper` or `main`.

**Method:** cherry-pick each lane's single verified commit onto
`panel-rebuild/finish-product` in the worktree
`/home/boxd/workspace/bawa-finish-product-worktree` on gray-pinee, resolve
conflicts in favour of the merged tree + the lane's fix (never silently drop a
lane's change), browser-first re-verify every headline fix in CDP, full gates,
fresh hash-verified preview, then push.

## Merge order + SHAs

Order E, A, C, K, G, H, I, J, D, B-last (B needed the rebase from `e290654`).

| Lane | Lane commit | Merged as | Notes |
|---|---|---|---|
| E (resumed) | `bfbca6a` | `8382d84` | Clean cherry-pick. |
| A | `d6dc728` | `fb9c101` | 1 conflict (`wallet/send.ts`): kept both the `signing-intent` import (HEAD) and `deriveAddressesAt`/`pathFor` (Lane A). |
| C | `85f9070` | `2420ea8` | 4 conflicts. `prices.ts`: kept `isPlainObject` + `applyPriceFallbacks`. `dex-prices.ts`: kept Lane C's `fetchJson` — see the merge-defect fix below (its import + local helper were dropped by the resolution and restored in the follow-up). `recent-activity.tsx`: kept both gates — see the merge-defect fix below. `transaction-history.test.tsx`: merged dual-state semantics (empty iff `anyLoaded`; unavailable iff the wallet has activity). Lane C's real commit stat is +1716 insertions, not +565 as the programme record said. |
| K | `0f2cf19` | `8840796` | Clean cherry-pick. Price-fallback copy + derivation paths predate Lanes C and A — fixed by follow-up edits (see below). |
| G | `329b232` | `7f1c5d2` | 1 conflict (`asset-rows.tsx`): kept both — zero balance shows `$0.00` (Lane G) and the fresh-price source detail renders under it (Lane C). |
| H | `4311e579` | `44bf0c7` | 2 conflicts. `receive.tsx`: disclosure label is Lane H's "All networks (N)"; HEAD's ChainLogo fragment belonged to the deleted old grid button and was dropped (Lane G's ChainLogo change survives in the new ChainRow). `globals.css`: kept Lane H's longer token comment; removed the duplicate `--bawa-shadow`. |
| I | `49ae48a` | `e33eddf` | Clean cherry-pick. |
| J | `f0c1624` | `c21fc14` | 4 conflicts. `asset-list.tsx`: merged into one `useWallet()` call. `asset-list.test.tsx`: kept Lane C's price-source test + Lane J's no-per-row-Retry test. `welcome.test.tsx`: kept Lane J's side in both hunks — removal wins per owner order (strip gone). `globals.css`: kept HEAD's `:root` comment. |
| D | `cc7b896` | `7328f93` | 3 conflicts. Merged CSP = 51 total origins, 46 mainnet (HEAD's 48 + Lane D's 3 gap-1 history origins, inserted after `rpc2.fantom.network`); the test's `httpsOrigins` array matches exactly. Fixed two stale prose sub-counts in the test (nine→eleven token-discovery origins; twenty-four→twenty-three UI/UX origins — `1rpc.io` double-counted). `DECISIONS.md`: kept both sections; Lane D's renumbered to §16. |
| B | `dfaff99` | `3e9f9a9` | 11 conflicts (base `e290654`, rebased onto `d47d282`). Merged CSP = 56 total origins, 51 mainnet (Lane B's 8 history hosts after `eth.blockscout.com`, minus Lane D's 3 duplicates; the test's `httpsOrigins` array rebuilt from the merged string). `boundary.ts`: Lane B's plain-address guard (superset). `import-wallet.tsx`: Lane B's EVM labels + Lane A's LTC label (`Ltub or zpub`). `adapters/evm.ts`: explicit `config.historySource` wins (Lane D labels), else derive from URL (Lane B). `adapters/index.ts`: registry URLs + Lane D's record spread after (same URLs, plus the explicit labels). `chains.ts`: both comment paragraphs with stale blocked-counts fixed to six (`bsc, gnosis, linea, opbnb, metis, fantom`); the three URL regions keep Lane B's side. `chains.test.ts`: test name fixed to "sixteen" (neither side's count was right — the list has 16); comment rewritten to nine EVM verified / six blocked; list + conditions keep Lane B's side. `chain-registry.test.ts`: Lane B's side both regions. `DECISIONS.md`: HEAD's §§14–16 + Lane B's section renumbered §17 (it wrote itself as "14" at its `e290654` base) + its CSP count fixed 54→56 / 49→51. `GAP-ANALYSIS.md`: table keeps HEAD's rows with row 1 fixed to 9-of-15 wired / 6 remain; §1 keeps Lane D's text + Lane B's 9-chain update, with its counts fixed (54→56 origins, "seven"→"eight" Blockscout v2 chains — the list has eight). |

## Merge-lane follow-up commit `69f7d8c`

- Deleted `screens/chain-strip.tsx`, `screens/chain-strip-display.ts`,
  `screens/chain-strip.test.tsx` — removal wins per owner order via Lane J;
  verified no production importers (only the test imported the component).
- Lane K follow-ups: `docs/diagrams/architecture.svg` Providers panel + desc
  now list CoinLore + Coinbase native fallbacks (Lane C); `docs/HOW-IT-WORKS.md`
  Mermaid prices node, Prices prose and trace row gain `price-fallbacks.ts`;
  HD-core TON/SOL line and the 22-addresses prose/trace gain per-account
  rotation (Lane A: `deriveAddressesAt` `core.ts:369`, `pathFor`
  `chains.ts:888`).
- Merge-defect fixes found by tsc/vitest on the merged tree (all my own
  resolutions, all fixed in place, all with in-file comments):
  - `dex-prices.ts`: restored Lane C's `PRICE_FETCH_TIMEOUT_MS` import and
    its local `isAbortError` definition (the resolution had kept Lane C's
    `fetchJson` body but HEAD's import block).
  - `chains.ts`: removed a stray comment line left by the region-1 fix (a
    6-line stale sentence, 5 skipped) and a duplicate
    `HISTORY_EVIDENCE_2026_11_23` const git auto-merged from both sides
    (kept HEAD's more detailed version).
  - `chains.test.ts`: removed a dead `else if (chain === 'op')` left outside
    the resolved region (Lane B's `if` already covers op; the comparison
    was a type error).
  - `recent-activity.tsx`: reason-aware `showUnavailable` gate — Lane C's
    all-failed unavailable state AND the marketing-fix fresh-wallet empty
    state both hold: the block renders when the wallet has activity, while
    locked, or when any chain failed with a reason other than `no-address`
    (`no-address` is the initial state, not a failure —
    `wallet-context.tsx:165`). Both tests pass. Known divergence, recorded
    in `docs/DECISIONS.md` §18: the Transactions screen keeps its own
    merged semantics (neither state with no activity; E2E-05 covers it).
  - `history-sources.test.ts` header comment: "the other twelve" → six.
- SVG fix commit `e0f0c0a`: the architecture.svg TON/SOL line ran past the
  HD-core panel edge at 900 px after the follow-up append (viewed, clipped
  mid-word); shortened to "— per-account", V4R2 detail stays in
  `docs/HOW-IT-WORKS.md`.

## Judgements recorded (see `docs/DECISIONS.md` §18)

- **`--bawa-shadow`: keep as-is.** The Oishi treatment was explicitly ordered
  by the research steer; a flat 4 px ink offset is not the blur/glow the
  `globals.test.ts` box-shadow guard covers, and the guard bans literal
  `box-shadow` in `globals.css` source — the token holds the value in a CSS
  variable, so the source stays clean.
- **QR 136 px vs 192 px spec: keep 136 px.** Owner decision; do not change
  silently.
- **Receive details scroll 426 px: owner decision** (smaller buttons vs
  top-stack rework); recorded, not reworked.
- **E2E-02 devnet-derivation race: real app bug**, not fixed by any lane;
  the E2E result below reports it exactly.

## Gates (final tree, Node 22)

- tsc 0, build 0, build:e2e 0 (palette audit passed: 29 approved colour
  literals).
- vitest **1871 passed / 5 skipped / 0 failed, 97 files** (baseline 1748/5;
  the 5 skipped stay skipped with their reasons).
- lint 0 (apps/web eslint + root eslint), npm audit 0 vulnerabilities,
  root `npm test` 0, root `npm run check` 0.
- E2E (root-base build, full suite): **15/24 pass, 9 fail (13.3 min).**
  Failures: E2E-06 (SHIB add-token row), E2E-03 (39/40 rows settled),
  E2E-13 (USDT SPL Metaplex, 2.0 min timeout), E2E-18 (13 defaults settle),
  E2E-19 (Solana RPC failover), E2E-02 (devnet toggle — the known real bug),
  Item D DISC (SPL DexScreener, 2.0 min), Item D MY (Jetton TonAPI, 2.0 min),
  E2E-05 (empty state not settled in 60 s with the network blocked).
  Alone on the merged tree: E2E-03 passes (12.1 s), E2E-18 passes (30.8 s),
  MY/NOT/ANTS pass; E2E-06, E2E-19, E2E-02, E2E-05, E2E-13, DISC fail
  alone too, and Item D SHIB (CoinGecko) flipped between runs (passed in
  the full suite, failed alone) — CoinGecko 429 storm. Alone on the
  PRISTINE `d47d282` baseline: E2E-06, E2E-19, E2E-02, E2E-05, E2E-13,
  DISC fail identically (same specs, same failure modes) — pre-existing,
  not merge defects (the third CoinGecko failure flipped too: NOT on
  baseline, SHIB on merged — same 2.0 min CoinGecko timeout). E2E-03,
  E2E-18 and MY pass alone on the merged tree (suite-load flakes). Root
  causes: E2E-02 is the known devnet-derivation race (Lane D, real app
  bug). The rest are live-network: the Solana backup RPC
  (`public.rpc.solanavibestation.com`) is currently unreachable from this
  egress (probed empty), which breaks E2E-19 and the Solana-side SPL
  metadata (E2E-13, DISC); CoinGecko 429s; public-RPC rate limits under
  suite load (E2E-03, E2E-18). E2E is NOT claimed green.

## Browser-first re-verification (CDP, Playwright chromium-1255, root-base build on :5193)

Screenshots viewed at `/home/boxd/workspace/bawa-finish-f-shots/`
(`01`–`42`). Every check below was done by USING the app, not by reading code.

- **A — SOL rotation live:** Receive → Solana → "New address" → address
  `AWJmCKgCDxWAZova6rTGeyhA6YyeN56jqRUv2BbVMGkH` →
  `C4McuDyEcMAH8HRhBpKtPjeBvFDptUmiM7wKwW7eKwDC`, "Receiving address 2 of
  this account." QR decodes (jsQR) to `solana:C4McuDyE…` (the rotated
  address). **Verified live.**
- **A — TON second address live:** `UQBlsndFlClRH1pPnld0laauHZ4tM65Sz5DQtK1UZmA8286X`
  → `UQDI4-PAZuC9y1uF7JM0vY_jcUjJESjjFfn4nMMw9UfWGZbc`, "Receiving address
  2 of this account." + "New receiving address ready." **Verified live.**
- **A — CELO shared path live:** `/wallets` shows Celo and Ethereum rows
  with the same address `0x9ABF253F0Ee741FB320eA095733bfbFec9191fE3`;
  exactly one distinct `0x` address on the page. Tool-level:
  `derive.js eth/celo/scroll 0` all give `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`.
  **Verified live.**
- **A — LTC zpub import live:** import screen, Watch-only, Litecoin via the
  combobox — label "Account public key (Ltub or zpub)", placeholder
  "Ltub… or zpub…"; pasting the Lane A fixture
  `zpub6rAbGSHg…TDfyzXSk` → toast "Watch-only wallet added." and an
  Imported wallets entry "LTC / Unlabelled wallet / zpub6rAbGSHg…TDfyzXSk".
  **Verified live** (the derived `ltc1…` address display on `/wallets`
  was not captured in the 8 s window after import; the derivation itself
  is proven by unit test + `derive.js ltc 0` →
  `ltc1qrw5czevuyhhgzrz2ca6hd8ulncqwnl8dp6gtca`).
- **B — watch-only fan-out 16/16 live:** Vitalik
  `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` imported → "Watching this
  address on 16 chains"; `/wallets` shows all 16 live balances at the
  expected values (ETH 5.799, BSC 0.170, POL 592.7, ARB 0.159, OP 0.181,
  Base 3.128, AVAX 0.324, XDAI 8.709, CELO 1.843, Linea 0.0068, MNT 0.275,
  Scroll 0.0709, opBNB 0.0004, METIS 0.523, Aurora 0.0019, FTM 3.124).
  **Verified live.**
- **C — prices with CoinGecko blocked live:** `api.coingecko.com` route-aborted;
  `/assets` still prices every row, source named CoinLore — BTC $61,878.40,
  ETH $1,763.80, TRX $0.312045; Fantom $0.029092 (DexScreener).
  **Verified live.**
- **C — ETH history single state:** the Transactions screen on a fresh wallet
  settles on "No transactions yet." with no "history unavailable" block
  (E2E-05's honest empty state, also live). The Recent Activity tab on a
  fresh wallet settled on "history unavailable" + Retry on both runs —
  the live indexers 429'd that day, so Lane C's all-failed state is what
  rendered (correct behaviour); the "No activity yet" empty state was not
  captured live in CDP and is covered by unit test + E2E-05 instead.
- **C — Networks copy:** "Mainnet by default" present on `/networks`.
  **Verified live.**
- **D — gap 1 Celo history live:** `/assets/celo` settles on "No transactions
  yet for this chain." (price $0.056751 per CELO, CoinGecko).
  **Verified live.**
- **D — gap 16 derive.js:** 20 chains in `ALLOWED_CHAINS` (5 non-EVM + 15
  EVM); `derive.js` run live for eth/celo/scroll/ltc (see above).
  **Verified live.**
- **D — gap 24 copy:** "Send signed — broadcast failed" — verified in code +
  `send.test.tsx` (Lane D, 20/20); **not verifiable in CDP** (needs a failed
  devnet broadcast; no devnet funds in this run).
- **G — no Retry / no "Balance unavailable" / real logos:** welcome, dashboard
  (fresh wallet), `/assets` at 390/1440/1919 — 0 visible Retry buttons,
  0 "Balance unavailable", real Trust Wallet logos (BTC $62,016.00, ETH
  $1,763.91 live), zero balances read $0.00. **Verified live.**
- **H — Receive redesign live:** search filters the list (Solana in, Dogecoin
  out); Popular with real logos; "All networks (18)" disclosure collapsed
  by default (`aria-expanded=false`) and opens; QR card 136×136 px;
  segmented control with all three templates (Address / Payment request /
  Share link); QR decodes via jsQR. **Verified live.**
- **I — single Create button live:** `/create` has exactly one "Create your
  wallet" button in main, with the "One recovery phrase, one wallet — 22
  chains" message; the create flow reaches "Your wallet is ready" with a
  24-word phrase. **Verified live.**
- **J — homepage live:** no "Popular chains" on the welcome screen or the
  dashboard; Scan tile present on the dashboard (4th tile); perf cold load
  (fresh context, 3 attempts, median): 390 unthrottled FCP 96 ms, heading
  198 ms, settled 3201 ms, **1,376,967 bytes** (Lane J: 1,369,955);
  390 Slow 4G settled 5263 ms (Lane J: 3836 ms — same order, egress variance).
  **Verified live.**
- **K — SVGs render live:** `architecture.svg` 900×726 (54 text nodes) and
  `explainer.svg` 400×490 (34 text nodes) render in Chromium at 900 px with
  no overflow/clipping (after the TON/SOL line fix, re-viewed); at 390 px
  the structure reads, body text small (same as Lane K found — the
  explainer is the mobile-readable one). **Verified live** (viewed).
- **D — 1919 px dashboard:** no horizontal overflow. **Verified live.**
- **D — 820 px welcome:** no horizontal overflow. **Verified live.**

## Preview

Fresh Pinggy tunnel (static serve of the root-base `build:e2e` dist from
gray-pinee, port 8080, `serve-dir.cjs` pattern — not vite preview). Served
JS hash verified identical to dist (`assets/index-C2_z_7NS.js`,
sha256 `1acb00cd11a39bbc943a2d8a03cf3721e0f90768c79ee422c5fe4107f20ee840`)
via curl on the tunnel itself, both URLs 200:

- https://hgknn-185-209-179-229.run.pinggy-free.link
- https://teahs-185-209-179-229.free.pinggy.net (alt)

Tunnel expires 60 minutes after minting (minted 2026-11-23 18:13 UTC, expires ~19:13 UTC); the
durable link remains GitHub Pages (which still serves the saved
`67c48e2` build, not token-gaps — C-11).

## Pushes

- `panel-rebuild/finish-product`: `d47d282..bdb8fa8`, pushed via PAT
  protocol, fresh `ls-remote` read-back `bdb8fa827d46d643f431ca37c2f37966326d268c`.
- `panel-rebuild/token-gaps`: fast-forward merge of finish-product
  (`d47d282..bdb8fa8`, no merge commit — token-gaps was an ancestor),
  pushed via PAT protocol, fresh `ls-remote` read-back `bdb8fa8` on both
  branches.
- Doc-only pushes (programme record + DECISIONS §§15–18 + checklist + gap
  analysis, verified docs-only by `git diff --stat` on each branch, fresh
  `ls-remote` read-back):
  - `main` → `6af3daf8aff61efc05f10e41175d3868c217a307`
  - `panel-rebuild/desktop-layout-v2` → `3c1a6dfe8a973481f9400869b7e88355f138d7a9`
  - `panel-rebuild/devnet-temp` → `db221c4049b017877c1dae15b7da30f3c63fe6b7`
  - `panel-rebuild/token-discovery` → `84142e2333671cb933dea81dc158fc898cee1679`
  - `panel-rebuild/ui-ux-fixes` → `d4ea91d1ca2d3fdc0fd501710999aad6ad737d2c`
  (`adopt-proper` not pushed, per the brief; `gh-pages` untouched.)
- Branch deletion: `panel-rebuild/marketing-fix` (`a8018fd`) DELETED from
  the remote — first-hand re-checked as a verified ancestor of token-gaps
  with 0 unique commits (`git merge-base --is-ancestor` + `rev-list
  --count … ^token-gaps` = 0, against the remote tip `bdb8fa8`), then
  deleted via PAT protocol; fresh `ls-remote` confirms the ref is gone
  (9 branches remain).
- README-on-GitHub check: both SVGs load 200 via raw URLs on
  `panel-rebuild/token-gaps` (architecture.svg 9255 B, explainer.svg
  7604 B); README embeds them at lines 8 and 10; the GitHub blob page
  returns 200.

## Remaining risks and owner decisions

Carried forward (see `docs/DECISIONS.md` §18 for the full list): QR 136/192,
Receive 426 px scroll, E2E-02 race, 12 EVM chains balance-only without a keyed
API, rotation funds invisible, multi-phrase vaults, faucets, TonCenter keyed
tier, DOGE fallback, xDAI+MNT no keyless fallback, FTM low-liquidity pair,
devnet+unlocked-vault Retry, asset-detail sticky Refresh, Number Ticker
CDP-unverified, live-camera scan unverified, review/sign CDP-unverified,
Receive tagline, showcase link.
