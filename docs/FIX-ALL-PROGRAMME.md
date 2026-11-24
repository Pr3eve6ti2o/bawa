# FIX-ALL programme — record

Owner order 2026-11-24 ~01:23 IST. Hands-on Muse, 0 Sol calls.
Base: panel-rebuild/fix-all from token-gaps 8191b2c.
Branch: panel-rebuild/fix-all (local only until Lane J verifies + pushes).
Worktrees: /home/boxd/workspace/bawa-fixall-a .. -i (branches panel-rebuild/fix-all-a .. -i, local only).
Skills: read first-hand by the coordinator (order-traceability-checklist 98 lines, cdp-visual-verification 80 lines, repo-hygiene-scan 121 lines, all in /home/boxd/workspace/custom-skills/). UI/UX research copied to /home/boxd/workspace/bawa-fix-all/RESEARCH.md.

## Lanes
- A watch-only failures + 6 blocked history chains + all backup RPCs
- B price errors permanent + token logos in docs
- C document everything the wallet is built from (free/paid tiers verified)
- D E2E-02 devnet-derivation race + suite
- E QR template row + QR size (decided by live preview)
- F RPCs + backups in the Security section
- G two honest gaps (skills archive + doc-push record TBD fix)
- H "still needing your word" items (decided by live preview)
- I branches under 4 + files renamed + everything pushed
- J merge + re-verify + gates + preview + docs + push (coordinator)

## Status
- Dispatched 2026-11-24 ~01:24 IST: all 9 lanes (A-I) running in parallel.
- Lane J runs after A-I complete.

## Lane G — DONE + VERIFIED first-hand by coordinator
- Skills archive: /home/boxd/workspace/bawa-fix-all/skills-archive/ (3 skills + README); both skill dirs verified byte-identical; no skills dir in repo.
- Second honest gap fixed: 5 doc-pushes (main 250272a, desktop-layout-v2 5fff7ce, devnet-temp 76fdd25, token-discovery 150b2f6, ui-ux-fixes 8ac66fa) — all ls-remote-verified by coordinator; main record TBD count 0.
- Lane commit 0dd82de on panel-rebuild/fix-all-g (docs-only, local). Gates: tsc 0, build 0, vitest 1871/5, lint 0, audit 0. One vitest flake on first run, clean on re-run.
- Limits disclosed: five branches DECISIONS.md copies still carry the S18 placeholder; local worktrees show old tips (remote refs correct).

## Branch note (coordinator, verified)
- Remote now 8 branches: panel-rebuild/finish-product is gone from ls-remote (was 8191b2c, fully merged into token-gaps). Lane I deleted it under its brief (already-merged branches may go now). Remaining: gh-pages, main, adopt-proper, desktop-layout-v2, devnet-temp, token-discovery, token-gaps, ui-ux-fixes.

## Lanes C + I — DONE + VERIFIED first-hand by coordinator
- Lane C commit 68aa8e6 on fix-all-c. 12 docs files, +457/-2, docs-only. Gates: tsc 0, build 0, vitest 1871/5, lint 0, audit 0. Report 19,473 bytes on disk. Flagged (not fixed): docs/13 Signing boundary still says Core 4.8.4; adapters/index.ts twelve-unwired comment stale; capabilitiesForBalanceChain contradictory notes; bip-utils 2.12.2 vs 2.12.3. Open: 6 blocked history chains + Blockscout Pro key need owner decisions.
- Lane I: 4 commits on fix-all-i (3fce3f7 980px port, 77ad733 Lane G docs cherry-pick, 6a8cdf5 rename itemD spec, 2aab406 docs). Gates: tsc 0, build 0, vitest 1873/5, lint 0, audit 0. Deleted finish-product (ls-remote verified). Branch audit: adopt-proper/devnet-temp/token-discovery/ui-ux-fixes unique docs superseded by token-gaps corrected versions (NOT cherry-picked — would regress docs); deletion list for merge lane: desktop-layout-v2, devnet-temp, token-discovery, ui-ux-fixes, adopt-proper (post fix-all merge). Unpushed sweep: nothing pushed; pages-base cd39306 deliberately left; 57/66 local branches ancestors of token-gaps.
- REMOTE MOVED mid-lane: main is now 58e7c36 (Lane G reported 250272a; one further doc-only commit after Lane G push — coordinator verifying TBD count on the new tip separately).
- main 58e7c36 resolved: parent-agent doc-only push ("Main README: new diagrams + clean wallet screenshots; captcha runner generalised") on top of Lane G 250272a. TBD count on new tip: 0; record shows final 8191b2c SHAs. Lane G fix still holds.

## Parent note (Orion, 2026-11-24 ~01:43 IST) — main-branch updates, NOT part of fix-all lanes
- main 58e7c36: README new diagrams + clean screenshots. main a6c9193: captcha folder fully generalised (captcha/run-tronscan-check/test-tronscan.ts -> captcha/run-captcha-check/test-captcha.ts; runner is a general captcha challenge-solving tool, TronScan P22 is one worked example; captcha/README.md rewritten general-first; docs/diagrams/captcha.mmd/svg updated + re-rendered). Do NOT overwrite or revert either.
- NO branch other than main has a captcha/ folder — nothing captcha-related is to be merged in from elsewhere (Lane I confirmed zero captcha paths in its tree).
- The 9 remaining TronScan mentions in captcha/README.md are all inside the "Worked example: TronScan Approval-tab check (P22)" section — intentional, do NOT scrub.
- Applies to Lane J (merge lane): fix-all -> token-gaps merge must not touch main captcha work; do not merge main into token-gaps; do not cherry-pick captcha content.
- Verified on fresh tip a6c9193 ("Captcha README fully generalised; captcha diagram updated"): captcha/run-captcha-check/test-captcha.ts + docs/diagrams/captcha.mmd/svg all present on main. TronScan mentions in captcha/README.md: 9 case-insensitive occurrences, all in/around the Worked-example section (lines 22, 62, 64, 84, 107) — intentional, do NOT scrub. (Coordinator note: case-sensitive grep gives 5 lines; the 9 count is case-insensitive incl. tronscan.org URLs. Substance confirmed either way.)

## Lane E — DONE + VERIFIED first-hand by coordinator
- Commit 24fcd20 on fix-all-e (2 files, +14/-7). Decisions by live preview at 390px: SMALLER BUTTONS (not top-stack rework) — scroll 489 -> 405px, template row -21px vs fold, action row +57px; QR 136 STAYS (192 measured: template row 55px below fold, actions 197px below — rejected with numbers). Note: brief 426px figure not reproduced (baseline measured 489px in wallet-ready ETH state); -84px before/after measured identically both sides.
- Gates: tsc 0, build 0, vitest 1871/5, lint 0, audit 0. Screenshots viewed at 390/820/1440/1919. Skills used: cdp-visual-verification, order-traceability-checklist, RESEARCH.md sources.
- Lane note: boxd machine exec drops empty-string CLI args ("" silently fell back to /bawa default, burned two 120s timeouts) — pass a non-empty sentinel instead.

## Lane B — DONE + VERIFIED first-hand by coordinator
- Commit 23ae583 on fix-all-b (11 files, +717/-85). All price errors fixed: 43/43 rows fresh at 390/820/1440/1919 with CoinGecko blocked — 0 Price error / Price unavailable / Price expired. Last fix: quote-side implied price in parseDexScreenerResponse (Polygon USDT0 .00 via Decimal priceUsd/priceNative). Sources: CoinLore 19, DexScreener 21, TonAPI 2, Coinbase 1. XDAI $1.00, MNT $0.399986, FTM $0.028425 (CoinLore Sonic) — live with independent checks.
- Honestly unfixable: Gnosis/Aurora user-added tokens without CoinGecko id (WXDAI, GNO) stay Price unavailable. FTM divergence caveat recorded (CG $0.0252 vs Sonic $0.0283 vs DexScreener-implied $0.0287).
- Logos: canonical source documented (Trust Wallet Assets, pinned e8f61783, 22-chain table + fallback chain); token-logo.tsx fallback now honest empty state; 6 sampled logo URLs 200 live.
- Gates: tsc 0, build 0, vitest 1879/5 (+8), lint 0, audit 0. Skills: cdp-visual-verification, order-traceability-checklist.
- Note (not fixed, pre-existing): chain names truncate on narrow mobile card (Ethere…, Arbitru…, OP Mai…).

## Lane F — DONE + VERIFIED first-hand by coordinator
- Commit c518704 on fix-all-f (17 files, +1,742/-46). Screen lives on NETWORKS, not Security (RPC manager already lived there; RPCs are connection settings, not vault/keys/signing) — Security carries a one-line pointer card only. Reason stated in report + docs.
- Per-chain RPCs all 22 (Primary/Backup/Custom badges, Use backup, Switch all to backup, Use this one, add/remove custom, reset all); "Last balance from {host} - HH:MM" under every chain; Check / Check all live probes; prices card in plain words + live line; history per chain with honest no-working-source line for the 6 blocked chains.
- CDP proof (hash-verified build, 8 screenshots viewed): backup switch proven (1rpc.io answered usage-limit error, failover to publicnode — lane honestly does NOT claim balance came from backup); custom RPC Flashbots clean proof (Last balance from rpc.flashbots.net 20:43).
- Gates: tsc 0, build 0, build:e2e 0, vitest 1900/5, lint 0, audit 0, E2E lane spec 3/3. Skills: cdp-visual-verification, order-traceability-checklist, RESEARCH.md.
- Caveat: prices<->price-fallbacks madge cycle pre-exists; Lane F adds nothing to it.

## Lane A — DONE + VERIFIED first-hand by coordinator
- Commit 3e18b7b on fix-all-a (17 files, +883/-91). TRX FIXED: TronScan fallback + PublicNode TRON full node; three-way agreement Trongrid = TronScan = PublicNode = 20,032,755.932541 TRX; CDP proof on /wallets at 390px. TON: the 0 was genuine (TonCenter + TonAPI agree, active v4r2) — no code change; funded address renders 41.293091416 TON.
- DOGE: best honest state, NOT a fix — dogechain.info added then removed in-lane (correct data in Node, no CORS headers, proven in CDP 6x ERR_FAILED vs 200 in Node); Zelcore Blockbook + DogeSoft same defect; Trezor 403, Blockchair 430, NOWNodes/Ankr keyed. Adapter stays SoChain -> BlockCypher; honest Could-not-load + Retry when both quota-limited.
- History: Linea WIRED via Etherscan V2 keyless (real tx 0x75dfb5f5c555... rendered in CDP); 17 chains now verified. bsc/gnosis/opbnb/metis/fantom stay blocked with per-source evidence (Routescan unsupported, Etherscan V2 refusals/502, Blockscout 404s, Gnosis 403 Cloudflare).
- RPC audit: 38 endpoints through app adapters; 2 1RPC backups dead (-32001 usage limit), replaced with dRPC (eth.drpc.org, aurora.drpc.org) and re-verified with Vitaliks exact balance; Solana backup answers again.
- Gates: tsc 0, build 0, vitest 1881/5, lint 0, audit 0, root npm test 0. Skills: cdp-visual-verification, order-traceability-checklist.
- Open for owner: DOGE Blockchair key or accept outage; 5 history chains keyed Etherscan V2 or accept balance-only. Nit recorded not fixed: Linea asset balance clips at 390px card edge.

## Lane H — DONE + VERIFIED first-hand by coordinator
- Commit a72ebf7 on fix-all-h (46 files, +1,046/-3,714). All 13 items decided, none left open.
- Done: 980px breakpoint ported (shell-only, globals.css + app.tsx/sidebar-nav.tsx; v2 regressions deliberately NOT ported); devnet fiat suppression was a BUG, fixed (token rows hardcoded false; hero also valued test tokens); Lane 3 (Create stands at 1440, fresh-$0.00 note added, Coming soon collapsed into closed <details>, Create at 390 now 1,276px); Receive tagline restored ("This is your address — share the drawing, keep the keys."); 4 unwired modules ALL DELETED (destination, confirmation-adapter, evm-typed-data, secret-handoff + tests); ci.yml one web job; jscpd 20 -> 1 (brief 16 does not reproduce; independent audit confirmed 20/267); wallet-refresh re-wire DELETED (823 lines incl. tests).
- Recorded: Receive QR on step 1 — leave the flow (no network chosen, no address to encode; default-chain QR risks wrong-network payment); 12 EVM chains corrected to 6 balance-only with honest note (bsc, gnosis, linea, opbnb, metis, fantom — NOTE: Lane A wired Linea history, so Linea drops out at merge); rotation funds stated-not-shown; multi-phrase vaults plan only (options A/B/C + owner decision in DECISIONS S19); DOGE fallback owner key decision needed (no working keyless option; fixture address emptied, adapter doc 10007.79 DOGE example stale).
- Cannot-do items recorded with reasons (live-camera scan, review/sign, README showcase, Android, ECDSA, password migration not ordered, broadcast not authorised, M-39).
- Gates: tsc 0, build 0, vitest 1808/5 (91 files; -56 deleted-with-modules, reconciles), lint 0, audit 0, root check 0, root test 0. CDP 10 screenshots viewed; 980px desktop shell proven; mobile 390 unchanged.
- MERGE FLAGS for Lane J: (1) 980px ported by BOTH Lane H and Lane I (3fce3f7) — reconcile, take one. (2) confirmation-policy.ts orphaned by the module deletion — Lane H recorded for Lane I but Lane I had already finished; Lane J must decide (delete with gate proof or keep + report). (3) Lane H "6 balance-only chains" includes Linea — Lane A wired Linea history, so merge must drop Linea from that list. (4) Lane H process note: first R-family edit script corrupted prices.ts/token-prices.ts, recovered by git checkout — verify those files at merge.

## Parent note (Orion, 2026-11-24 ~02:36 IST) — token-gaps + main moved
- Token-gaps 8191b2c -> df48d9c (doc-only README-FULL link fix: handoff.md -> archive/handoff-2026-11-10.md x2, security-release-gates.md case fix). Same fix on the other five feature branches: adopt-proper 0edee43, desktop-layout-v2 04cdde5, devnet-temp 82480e8, token-discovery 95e7470, ui-ux-fixes 333880f. All ls-remote-verified by coordinator.
- Main: a6c9193 -> 161abfd -> 15e57bd ("README Quickstart: expected output now matches the live route output"). Lane G doc pushes are history — any FUTURE doc push to main (Lane J) must be based on the new tip, not 250272a/58e7c36/a6c9193.
- Lane J: when merging fix-all into token-gaps, incorporate df48d9c (do not revert the README-FULL fix). The fixed README-FULL.md blob is identical on all six branches (verified below) — Lane I merges should see no conflict on that file.

## Lane D — DONE + VERIFIED first-hand by coordinator
- Commit 09cf474 on fix-all-d (3 files, +157/-40). E2E-02 ROOT CAUSE found first-hand: setDevnetEnabled flips the pill synchronously before awaiting refreshVaultAccounts (22-chain derivation + second HDWallet open); spec reload kills in-flight derivation; devnet record never persisted; boot never re-derives; refresh guards read in-memory lock state before await vault.autoUnlock (|| short-circuits); both refresh functions shared one generation counter. FIX in wallet-context.tsx: boot re-derives when persisted record missing/empty; guards await autoUnlock first; separate receiveDerivations counter; + regression unit test. Proof: probe 3/3 pass (2.5-2.6s vs 30s timeouts); toggle spec 3/3; E2E-02 passes in final full suite.
- E2E-05 spec rewritten (spec defect, not network): old expectation does not reproduce (180s probe shows blank content area — merged Lane C rule withholds both empty state and retry when every shown chain failed). New spec 3/3 alone + passes in suite. Manifest E2E-05 case still describes failure + Retry — manifest drift recorded; manifest.json deliberately not rewritten. COORDINATOR DECISION (Lane J): update manifest.json E2E-05 case to the pinned honest behaviour (wallet-refresh.ts was deleted by Lane H, so landing it is no longer an option).
- Final full suite run 3: 17/24 (up from 15/24); run 2 was 20/24 — window-dependent. All 7 failures fail-live-network with evidence (E2E-06, E2E-13 SPL USDT, E2E-18, E2E-19 SOL + ETH fallback incl. 1RPC -32001 exhausted, Item D DISC, Item D NOT). Baseline reproduction on pristine 8191b2c worktree. Served JS hash verified.
- Gates: tsc 0, build:e2e passed, vitest 1872/5 (+1 new test), lint 0, root test 0, audit 0. Skills: order-traceability-checklist, cdp-visual-verification, browser-testing-with-devtools, webapp-testing (read only).
- Lane D handoff note corrected: merging into token-gaps is LANE J (coordinator), not Lane I.

## Lane J — merge started
- Worktree /home/boxd/workspace/bawa-fix-all-worktree on panel-rebuild/fix-all. Merged token-gaps df48d9c -> 3d74879 (clean, README-FULL.md only).
- Cherry-pick order: C, G, I-docs, E, I-980px, A, B, D, F, H-last (H biggest + conflicts expected: 980px vs I, DECISIONS S19 vs G, HOW-IT-WORKS vs C/F, receive.tsx vs E).

## Lane J — merge progress (2026-11-24, coordinator hands-on, 0 Sol)

Cherry-picks onto fix-all (from token-gaps 8191b2c): C 68aa8e6 -> 0ace17d (clean);
G 0dd82de -> 8b3ee85 (clean); I-docs 2aab406 -> 324b72b (clean); E 24fcd20 -> 7a93bed
(clean); I-980px 3fce3f7 -> c8b4cf3 (clean); A 3e18b7b -> 97e93c1 (DECISIONS §19
conflict only — A's section renumbered §21); B 23ae583 -> a91ca4d (docs/12
conflict only — both logo sections kept, one stale sentence fixed);
D 09cf474 -> 0455c65 (clean); F c518704 -> 5a3cd84 (CSP origins only — union
minus dead 1rpc.io: 62 unique, 57 mainnet + 5 devnet; Flashbots after
eth.drpc.org; CSP order == test order verified); H a72ebf7 -> 2fefeca
(8 files: trx.ts hand-merged + deduped; price-fallbacks.ts kept F's
priceFallbackSourcesFor, H's deletion stands; DECISIONS H §19 -> §22;
HOW-IT-WORKS Balances + Networks rows; 980px files = HEAD wording + both
border assertions); I-rename 6a8cdf5 -> ff8ed05 (clean); I's 77ad733 skipped
(G already in). Merge-lane commit b534c4f: Linea out of the balance-only
list (five chains now) + E2E-05 manifest corrected. Token-gaps 8aefab7
merged -> 2aab753 (diagrams + screenshots + trace fix; HOW-IT-WORKS 1-hunk
conflict resolved). Trace re-verification commit 62a8d59: 48/48 refs pass
(11 stale from the token-gaps-verified trace fix; duplicate Prices row
stripped).

Join-bug lesson: the marker-regex resolver dropped the newline after a
resolved hunk when the next line was not blank — joined lines in
app.test.tsx, app.tsx, globals.test.ts, price-fallbacks.ts,
HOW-IT-WORKS.md, DECISIONS.md. Found by tsc (TS1128); fixed by
fix-joins.py; tsc 0 after.

Merge-lane fix commit 313cacb (14 files): Lane F's new tests were stale
vs the merged data — ETH registry lists dRPC not 1RPC (Lane A, -32001
dead); CoinLore now covers 19 chains incl. Gnosis/Mantle/Fantom (Lane B).
Tests + Prices-card prose + HOW-IT-WORKS bullets + GAP-ANALYSIS (history
16 -> 17) + ADR-0007 amendment updated to the new truth. Every chain now
has a second price source (new every-chain test pins it). priceFallbacks
doc comment restored with correct counts (19/13; TonAPI/Coinbase/
DexScreener cover the three CoinLore misses). Mantle also has a
DexScreener leg (wrapped MNT). docs/index.md counts to the merged tree
(web 302, screens 58, wallet 85, e2e 14 specs).

Gates on the merged tree (HEAD 313cacb): tsc 0, build 0, build:e2e 0
(dist index-DSvPtC7x.js), vitest 1858 passed / 5 skipped / 0 failed
(94 files), lint apps/web 0, lint root 0, root test 0 (register-links
checks passed), npm audit 0 vulnerabilities (apps/web, root,
tools/hdwallet-gen). E2E full suite running (port 4299, 27 tests).

Coordinator decisions (for DECISIONS §23): confirmation-policy.ts KEEP
(standing owner decision: spec-only; orphaned by H's deletion, no
production importer); E2E-05 manifest UPDATED (wallet-refresh.ts deleted
by H, landing it is no longer an option); Linea out of balance-only;
CSP 62 origins; priceFallbackSourcesFor kept as API though the Prices
card hardcodes the order in prose (drift noted, not re-engineered).

Still to do in Lane J: E2E result; CDP re-verification at
390/820/980/1440/1919 with screenshots viewed (script
lane-j-shots.mjs); fresh hash-verified preview; DECISIONS §23; docs/index
re-stamp to the final fix-all SHA; push fix-all only; merge into
token-gaps; Lane I deletion list; doc-only push to main from 5462641.

## Parallel programme — readme-marketing (parent note, 2026-11-24 ~03:29 IST)

A second programme started in parallel on `panel-rebuild/readme-marketing`,
based off token-gaps `8aefab7`. It reworks the README (uniform 2-image
Showcase grid, quick-link + install code, redrawn diagrams showing the
HD-wallet purpose and planned Android/more, a single Mermaid
project-structure diagram replacing the 8 stale structure SVGs) and the
captcha folder on main (genericisation + fcukcaptcha files).

Verified by fresh ls-remote at receipt: token-gaps still `8aefab7`,
readme-marketing created at `8aefab7` (no commits yet), main `5462641`.
Nothing has landed anywhere yet — no conflict with fix-all today.

LANE J LANDING RULE: when merging fix-all into token-gaps, re-check
ls-remote first. If token-gaps has moved past `8aefab7` (readme-marketing
merged), incorporate the new tip into fix-all and resolve any
README.md / docs/diagrams / captcha conflicts in favour of the tip
(the readme-marketing side) — never overwrite those changes. If it
has not moved, merge as planned: fix-all's README/diagram content is
already `8aefab7`'s, so nothing is overwritten. The parent will send
the final tip when readme-marketing merges.

MAIN DOC PUSH RULE (Lane J): the doc-only push to main must avoid
README.md, docs/diagrams/ and captcha/ while this programme runs.
Scope it to the FIX-ALL docs only (DECISIONS §23, GAP-ANALYSIS,
docs/index.md as applicable) and record the scoping.

## Lane J — COMPLETE (2026-11-24)

Coordinator did the merge lane directly. Hands-on Muse, 0 Sol calls.

### Merge chain (all on panel-rebuild/fix-all, worktree bawa-fix-all-worktree)
- token-gaps df48d9c merged (3d74879); Lane C 68aa8e6 → 0ace17d;
  Lane G 0dd82de → 8b3ee85; Lane I docs 2aab406 → 324b72b;
  Lane E 24fcd20 → 7a93bed; Lane I 980px 3fce3f7 → c8b4cf3;
  Lane A 3e18b7b → 97e93c1 (DECISIONS §19→§21); Lane B 23ae583 →
  a91ca4d (docs/12 logo sections kept both); Lane D 09cf474 →
  0455c65; Lane F c518704 → 5a3cd84 (CSP union 62 origins, no
  1rpc.io); Lane H a72ebf7 → 2fefeca (8 files; trx hand-merge +
  dedup fix; DECISIONS §19→§22); Lane I rename 6a8cdf5 → ff8ed05.
- Merge-lane fixes: b534c4f (Linea out of balance-only, E2E-05
  manifest); 313cacb (Lane F stale tests/prose → Lane A/B truth);
  4995e65 (E2E specs dRPC not 1RPC); b38130a (item19 custom RPC
  Flashbots); 62a8d59 (HOW-IT-WORKS trace 48/48); 62abe11 (Linea
  Etherscan V2 quota retry — see below); 739f703 (§23 + index
  re-stamp to 62abe11); 343cd3a (merge token-gaps 6db1d1e, README
  marketing — clean, both sides' README content kept).
- token-gaps moved during the lane: 8aefab7 → 6db1d1e (readme-
  marketing landed as 6d4bfbf + 6db1d1e; main 5462641 → 8126b8e
  as bcc8555 + 8126b8e). Incorporated 6db1d1e before merging;
  README conflicts resolved in favour of the tip per the landing
  rule (no conflict in fact — clean ort merge; the two deleted
  receive screenshots are referenced only in the historical
  REVERIFY-PROGRAMME.md record, left as history).

### Linea history — the live saga (fixed in the merge lane)
- First CDP pass: /assets/linea stuck on "Loading transactions…",
  then "No transactions yet" — wrong for an address with a known
  tx (0x75dfb5f5...).
- Proven live: Etherscan V2 keyless tier is 1 request per 5 s per
  IP; inside the window it answers NOTOK "Missing/Invalid API Key"
  (the same message as a missing key). The app fires the history
  refresh twice in quick succession; the store's request counter
  discards the first (good) result, so the page ends empty.
- An empty `&apikey=` parameter was tried first and proven a
  placebo (quiet call without it → status 1; call inside the
  window → NOTOK with it). Reverted, not shipped.
- Real fix (62abe11): one 6 s-delayed retry in the EVM adapter
  when the etherscan-v2 response is status 0 + NOTOK
  "Missing/Invalid API Key" (signal is in `result`, not
  `message` — caught by the first failing test run), plus a
  regression test (fake timers, NOTOK-then-OK, asserts 2 calls).
  Proved live in CDP: NOTOK, NOTOK, then status 1 with the real
  tx; 0x75dfb5f5... renders under Recent transactions (five real
  Linea txs). Screenshot: lane-j/merge-followup-linea-fixed2-390.png.

### Gates on the merged tree (code tip 62abe11; later commits docs-only)
- tsc 0, build 0, build:e2e 0, vitest 1,859 passed / 5 skipped /
  0 failed (94 files), lint apps/web 0, lint root 0, root test 0,
  npm audit 0 vulnerabilities (apps/web, root, tools/hdwallet-gen).

### E2E on the merged tree — 23/27 verified passing
- Full run (port 4299, 12.4 min): 17/27 — the last three (05/04/02)
  failed on a dead preview server ([WebServer] Terminated mid-run),
  all passed on re-run. E2E-19 ETH + LANE-F switch failed on the
  stale 1rpc.io expectation, fixed (4995e65) and passed on re-run.
- Re-runs: item19-only 2/3 (ETH passed after the dRPC + Flashbots
  fixes; SOL failed again); flaky-4 re-run 8/12 (MY flipped to
  pass, NOT flipped to fail — window-dependent both ways).
- Never passing in any Lane J run (all live-network): E2E-06 SHIB
  (add dialog never opened), Item D DISC ("Token added" never
  appeared, Solana RPC degraded), E2E-13 SPL USDT (Metaplex over
  degraded Solana RPC), E2E-19 SOL fallback (backup
  public.rpc.solanavibestation.com unreachable; price loads,
  RPCs don't).

### CDP re-verification (scripts lane-j-shots.mjs, lane-j-followup.mjs;
  shots in lane-j/, viewed by eye)
- 390/820/980/1440/1919, no-wallet + wallet-ready. Welcome, Create
  (one button, "One recovery phrase, one wallet — 22 chains"),
  Receive step 1 + details (tagline restored, QR 136 px, template
  row at the fold bottom), Dashboard (sidebar at desktop widths,
  real logos, live prices, Scan 4th tile, no Retry), Networks
  (backup switch proven live: BTC mempool → blockstream,
  ETH publicnode → eth.drpc.org), Assets CoinGecko-blocked
  (0 price errors; BTC $61,284.26, ETH $1,720.70, TRX $0.309491).
- Watch-only proven live: TRX 20,044,337.675202 (three-way ground
  truth); Vitalik's one EVM address fans out to all 16 EVM chains
  with real balances. Full-page shot merge-followup-wallets-full-390.png
  viewed.
- Pre-existing nits confirmed visible, not fixed: chain names
  truncate on narrow card ("Ethere…"); Linea hero balance clips
  at the 390 px card edge.

### Pushes (all PAT protocol, fresh ls-remote read-back)
- panel-rebuild/fix-all → 343cd3a (pushed, then deleted after merge).
- panel-rebuild/token-gaps: 6db1d1e → 343cd3a (merge, fast-forward)
  → dccc99c (§23 merge/deletion record) → 7c98420 (checklist
  addendum). Final: 7c98420.
- main: 8126b8e → b9fc917 (doc-only: DECISIONS §§19–23,
  GAP-ANALYSIS, REVERIFY-CHECKLIST addendum; README.md,
  docs/diagrams/, captcha/ untouched).

### Branch deletions (verified first-hand, ls-remote-confirmed)
- Deleted: devnet-temp 915054b, token-discovery 176613f,
  ui-ux-fixes 333880f, adopt-proper 21ce11d (0 unique code files
  since merge-base; unique commits all superseded programme-record
  docs; their CREATE-EXAMPLE-WALLET.md copies carried a stale blob
  vs token-gaps' corrected b8319c2), readme-marketing 8aefab7
  (0 unique commits), fix-all 343cd3a (tip == token-gaps tip).
- KEPT: desktop-layout-v2 15af54c — 40 unique code files
  (+1,755/−197 since merge-base 67c48e2): the two-column desktop
  layout (ed0abba/0e194f4) deliberately not ported by Lane H
  (v2 regressions; only the 980 px shell was ported).
- Final remote: 4 branches — main b9fc917, token-gaps 7c98420,
  gh-pages ee63a13, desktop-layout-v2 15af54c. (Target was under 4;
  4 is the honest count with desktop-layout-v2 kept for its unique
  code.)

### Docs updated
- DECISIONS §23 (merge-lane decisions + merge defects + gates +
  merge SHA + deletion record, filled in dccc99c).
- docs/index.md "Verified against" re-stamped token-gaps 8191b2c →
  fix-all 62abe11.
- docs/REVERIFY-CHECKLIST.md gains the Lane J re-verification
  section (7c98420 on token-gaps, b9fc917 on main).
- docs/index.md was NOT ported to main (its stamp describes the
  token-gaps tree, not main's).

### Skills used in Lane J (read on the VM)
- cdp-visual-verification (serve-dist-statically rule, hash
  verification, view-every-screenshot rule — caught the Linea
  empty state the unit tests could not).
- order-traceability-checklist (evidence structure for the merge
  defects and the E2E per-test verdicts).
- repo-hygiene-scan (ancestry + unique-content verification for
  the deletions: merge-base diffs, not just log counts).
