# Bawa token-verify programme — record

**Date:** 2026-11-24 · **Base:** `panel-rebuild/token-gaps` `6c93e66` (84 chains)
**Merged tip:** `panel-rebuild/token-gaps` `7f12de4` (pushed; fresh ls-remote read-back confirms)
**Work:** hands-on Muse only. **Sol calls: made 0, landed 0, failed 0.**
**Skills used:** `cdp-visual-verification`, `order-traceability-checklist`.
No other skill was loaded or used.

## Order (owner, 2026-11-24 ~21:03 IST)

Tokens must be verified by contract address, not by name or symbol, so real
tokens and fake copycats are told apart; show a verified mark for well-known
tokens even down to memecoins, using whatever contract-address verification
token swaps have. Add Token must work for any token on any chain, detecting
that token's icon, ticker and real-time price.

Boundaries: merge into `panel-rebuild/token-gaps` only (never merge into
main's code; doc-only pushes to main are fine); 0 Sol calls; user-visible
content in en-GB; no mainnet broadcast (stays disabled); test-only fresh
seed phrases/keys, never funded with real mainnet funds; verify in a real
browser (CDP) at 390/820/1440 before claiming anything done.

## Lanes (all based on 6c93e66, all committed, none pushed — merged, not pushed separately)

| Lane | Branch | Commit | Change |
| --- | --- | --- | --- |
| A — token verification by contract address | `panel-rebuild/token-verify-a` | `cfcd41a` | 19 files, +1,886/−225. CoinGecko contract first, then Jupiter Strict (CSV), 1inch, Uniswap Default, PancakeSwap Extended. Fixed a base defect: no SPL token could be added by contract (PublicNode refuses `getProgramAccounts`; now reads the Metaplex metadata account by PDA). +8,097 bytes bundle. |
| B — new-chains bug hunt | `panel-rebuild/token-verify-b` | `0c05cdb` | 10 files, +347/−71. 5 bugs: /track refusing the 10 new Blockscout-v2 chains; ChainLogo showing the Ethereum logo on 11 icon-less ETH-symbol chains; yellow ticker badge still in Receive and in the QR card; Ronin send accepting a `ronin:` address it could not sign to. |
| C — bundle-size gate | `panel-rebuild/token-verify-c` | `dbb5965` | 39 files, +1,965/−630. Total JS 4,474,784 → 4,176,047 — under the 4,177,711 budget by 1,664. Minimal Solana module replacing `@solana/web3.js` at runtime (−190,108), `long` dedupe, sonner → minimal toast, tailwind-merge removal, decimal.js + dinero.js → BigInt `decimal.ts`, chains `evmChainFacts` derivation, jsQR lazy-load. CONSTRAINTS.md not re-baselined. |
| D — npm audit | `panel-rebuild/token-verify-d` | `cc52085` | Audit 9 → 0 via jayson overrides (stream-json 3.7.0, uuid 11.1.1) + vendored pure-JS fork of bigint-buffer 1.1.6 in `packages/bigint-buffer/` (with PATCH-NOTES.md). No breaking-major upgrade. |
| E — icon fallback | `panel-rebuild/token-verify-e` | `108b843` | 7 files + 56 new icon files. All 28 icon-less chains now have real icons (DefiLlama 22, CoinGecko 5, Tatum 1); fallback redesigned (paper disc, ink ring, chain-link mark — no yellow, no ticker), verified with logos blocked. |

## Merge (lane, this record's author)

Merge commits on `panel-rebuild/token-gaps`, in order:

| Commit | Content |
| --- | --- |
| `b3dec9d` | Merge Lane A (clean) |
| `cc9df05` | Merge Lane B (clean auto-merge; verified A+B intent in `token-logo.tsx`) |
| `0f728a6` | Merge Lane C (clean auto-merge; verified B3's `normalizeEvmAddress` survives in C's rewritten `send.ts`) |
| `8e543cb` | Merge Lane D — lockfile conflict, 5 hunks, all resolved to Lane D's side (see MERGE-REPORT.md). Validated: `npm ci` exit 0, `npm audit` 0 vulnerabilities. |
| `8381d45` | Merge Lane E — `token-logo.tsx` conflict, 3 hunks. Resolved to one shared `FallbackMark` (Lane E's link mark) used by TokenLogo, ChainLogo and the QR card's LogoImage; Lane B's symbol-fallback restriction (btc/eth/trx/ton only) kept; Lane A's contract-keyed `iconUrl`/`allowSymbolLogo` kept. 3 token-logo tests + 2 qr-card tests updated to the merged reality; 7 stale "empty ring" doc comments updated. |
| `7f12de4` | Merge lane: close the bundle-size gate (see below). |

## Bundle gate — the merged tree needed one more real reduction

Merged A+B+C+D+E totalled **4,185,615 bytes — 7,904 over** the 4,177,711
budget (Lane C under by 1,664 + Lane A +8,097, as predicted). No
re-baseline, no gate weakening. Stub-measured candidates (temporary vite
config, exact minified deltas): `class-variance-authority` 589 bytes,
`qrcode.react` 16,084 bytes, `@radix-ui/react-dialog` 26,572 bytes.
Taken: the Dialog replacement only. `src/ui/components/dialog.tsx` is now
a minimal dialog (same exports, same visuals, same open/close behaviour —
Escape, overlay click, focus trap, focus return, scroll lock, portal to
`document.body`); the Radix tree was used by exactly one dialog (Add
Token) and pulled in remove-scroll, roving-focus, dismissable-layer,
focus-scope and friends. Net saving **25,085 bytes**. Not taken:
`qrcode.react` → `qrcode-generator` (needs a new dependency; the net after
the generator's own size is ~5K per Lane C's estimate and was not needed)
and local `cva` (589 bytes, not needed). `viem` was audited and ruled out:
it is load-bearing (transaction serialise/parse/recover, address utils).
Final total JS **4,160,530 — under budget by 17,181**. Largest chunk
(boundary, wallet-core) 2,905,015, under its 3,050,000 budget.

## Gates on the merged tree (7f12de4, Node 22)

| Gate | Result |
| --- | --- |
| `npm run typecheck` (tsc --noEmit) | **0 errors** |
| `npm run build` (incl. palette audit) | **0 errors** (palette audit passed; total JS 4,160,530) |
| `npx vitest run` | **99 files, 2,799 passed / 5 skipped, 0 failed** (2,804 total) |
| `npm run lint` (eslint) | **0 errors** |
| `npm audit` | **0 vulnerabilities** (`npm ci` exit 0) |
| Bundle (gate's own method) | **4,160,530 ≤ 4,177,711 — PASS by 17,181** |
| `node scripts/check-pinned-dependencies.js` | pass (exit 0) |
| `node scripts/check-wallet-cycles.mjs` | **FAIL, 1 violation** (`engine/boundary.ts ↔ engine/coin-type-keys.ts`) — **pre-existing, identical on base 6c93e66** (115 files / 406 edges on the merged tree) |

Targeted re-run of the 10 lane-touching test files: **852 passed / 5 skipped**.

## CDP verification on the merged tree (summary; full evidence in MERGE-REPORT.md)

- Link: static serve `http://127.0.0.1:4226/bawa/` (never `vite preview`).
  Served JS `index-7eubvSB3.js`, sha256
  `f3cefb26b092b1b6d230f987be22e74c247d03bbd720ee79a5642c9d7b5e9a40`,
  matched dist before capturing. Viewports 390 / 820 / 1440 / 1919,
  every screenshot viewed by eye. Disposable wallets only.
- Real BONK by contract → **✓ Verified (Jupiter Strict)** this run, real
  BONK logo, live price $0.000002 (DexScreener), "Verified by Jupiter
  Strict", "Icon from Trust Wallet Assets". (Lane A saw CoinGecko; the
  CoinGecko leg was silent during this run — most likely the known
  rate-limiting under dashboard polling; the endpoint returns 200 on a
  direct probe afterwards. Verification itself is a real leg of the model.)
- Fake BONK copycat → **Unverified**, link-mark fallback, never the real
  logo, price $0.000007 (DexScreener), Decimals 6, no "Verified by" row.
- aAMPL on Ethereum → **✓ Verified (1inch)**.
- ZK by ticker on ZKsync Era → **✓ Verified (CoinGecko)**, real ZK logo,
  "Verified by CoinGecko", "Icon from CoinGecko". Balance showed
  "Balance unavailable for this network" and price "Price error" in this
  run (transient zkSync RPC + CoinGecko rate-limit; Lane A saw the same
  balance state).
- SOL native + SPL USDC sign offline: **verifySignatures() === true** for
  both (native 1,000,000 lamports, sig `3cLLHyUh58CrUQhb…`; SPL 25,000,000
  base units, 2 instructions, sig `5rEPmgxHTX8srd6z…`). **Verdict PASS.
  No broadcast anywhere.**
- Add chain list: **84 chain logos rendered** (Zora, Berachain, Flare,
  Celestia, dYdX confirmed by alt text). /track Mode: **"ok — 3,047
  confirmations"** (Lane B1 holds). Add Token dialog (new minimal dialog):
  Escape, overlay click and X all close it.
- Images blocked: **44–45 link marks, 0 `role="img"` yellow badges,
  0 faded rings.** (The 5 `span.bg-sun` matches are the yellow Send /
  Receive / Scan / Activity tiles — legitimate UI, not fallback badges.)
- 84 chains load (Add chain list + /track chain list).

## CI vs CONSTRAINTS budget discrepancy (recorded, not resolved)

The CI workflow (`.github/workflows/ci.yml`, bundle step) enforces
**4,040,000** bytes total, stricter than `CONSTRAINTS.md`'s 4,177,711.
The merged tree (4,160,530) is **120,530 over the CI figure** (Lane C's
tree was 136,047 over). Satisfying both is not possible without removing
a feature (jsQR alone is 129,986 — the Scan QR feature). Neither budget
was changed; reconciliation is the owner's decision.

## Build-hash non-determinism (confirmed first-hand)

Rebuilding the identical committed tree (7f12de4, clean) produced the
same total (4,160,530) with a different content hash
(`index-7eubvSB3.js` → `index-ClVv0p3m.js`, sha256
`c55b4ab19a3d52cfb6f46846dd64b9fd6efc4d5f5c9094bc4b71b22fc33c8b8c`).
Same total, different hash, no source change — as Lane C reported. The
CDP evidence is for the `7eubvSB3` build of the same tree; the published
Pages build is the `ClVv0p3m` rebuild, verified live by hash (below).

## Push audit + Pages republish

- Remote holds 6 branches: `gh-pages`, `main`, `panel-rebuild/desktop-layout-v2`,
  `panel-rebuild/expansion`, `panel-rebuild/token-everywhere`,
  `panel-rebuild/token-gaps`. 80 local branches are not on the remote —
  all pre-existing working/lane branches, local by design; the five
  token-verify lane branches were deliberately NOT pushed as separate
  branches (fully-merged ancestors). `main` local (60116e9) is BEHIND
  remote (7f9d364) — not pushed. `desktop-layout-v2` local (3c1a6df) vs
  remote (15af54c) — different tips, untouched, not this programme.
- `panel-rebuild/token-gaps`: pushed `6c93e66..7f12de4`; fresh ls-remote
  read-back `7f12de4f9d214a2fc736316236880578dae4f822`.
- `gh-pages`: republished from the final token-gaps tip
  (`ec1a75c..764912c`; fresh ls-remote read-back
  `764912c7ba96313d1806cc273219709b51329c4a`). 404.html regenerated from
  the new index.html; `.nojekyll` kept.
- Live site: https://pr3eve6ti2o.github.io/bawa/ — root 200, serves
  `index-ClVv0p3m.js`, sha256 `c55b4ab1…` matching the published dist.
  (First check still showed the old `index-CAipiAnb.js`; the new build
  appeared after one deploy cycle, ~90 s.)

## What was NOT verified first-hand (honest gaps)

- **E2E Playwright suite:** not run on the merged tree (same as all five lanes).
- **Uniswap Default and PancakeSwap legs live in the browser:** unit-tested
  with mocked fetches only; no CDP case reached them (a token must 404 on
  CoinGecko *and* miss 1inch first).
- **Jupiter Strict via a live API:** CSV only; `tokens.jup.ag` is
  DNS-unreachable from this egress and the successor VRFD API needs a key.
  The banned-mint refusal path is unit-tested, not CDP-exercised.
- **Live prices/balances for every new chain inside the browser:** sampled
  (10 chains × 2 RPCs live in Lane B, CoinGecko 48/48 ids live, dashboard
  live prices seen in CDP), not watched for all 84.
- **Live camera scan:** not verified (needs the owner's phone).
- **ZK dashboard row:** the add + detail are verified; the row itself had
  not rendered within the wait while the dashboard settled (same in Lane A
  and in this run). The detail route is the one the row navigates to.
- **ZK balance / price in the merge run:** "Balance unavailable" + "Price
  error" (transient zkSync RPC + CoinGecko rate-limit, also seen by Lane A).

## Decision needed (owner only)

- **CI (4,040,000) vs CONSTRAINTS.md (4,177,711) budget reconciliation.**
  The merged tree satisfies CONSTRAINTS.md (under by 17,181) but not CI
  (over by 120,530). Only the owner can re-baseline or reconcile them.

## Process notes (for the next lane)

- `pkill -f` with a pattern that appears in your own command line kills
  your own shell (AGENTS.md lesson, re-bitten here while stopping the
  static server — the server did stop; use a bracket pattern and separate
  the kill from anything else).
- A piped `echo "exit: $?"` after `cmd | tail` reports `tail`'s exit code,
  not the command's — capture the real exit code before piping (this
  caught a real tsc failure only because the errors were also visible).
- `/track` query params (`?chain=&hash=`) pre-fill the form but do NOT
  auto-run the lookup; the CDP check must click "Look up". Lane B's
  report wording is imprecise on this point — the result ("ok — 3,047
  confirmations") was verified by submitting the form.
