# Token-Everywhere Programme

Owner order 2026-11-24 ~04:49 IST (with the Bitget Wallet Receive ETH card
screenshot): Add Token is broken, verified marks are missing, token
send/receive must work on all chains, the mobile homepage must show complete
token names, and the Receive QR must become a full card. Lane 7 (Scan QR)
added by Orion as a follow-up task the same day. Coordinator: Orion
(subagent, hands-on Muse). **Sol calls: 0 made / 0 landed / 0 failed** —
the AgentRouter API is stopped by owner order; all work is hands-on Muse.

Branch: `panel-rebuild/token-everywhere`, off `panel-rebuild/token-gaps`
`f065128`. Merged into token-gaps at `c8af598` (see "Pushes" below).

## Currency note (2026-11-28, Lane A docs audit, token-gaps `ceade79`)

This record is from 2026-11-24, retained as written above. Since
then, open items 1–3 are resolved: (1) Lane 7 Scan QR was executed
— see `docs/SCAN-QR-FIX.md` (branch `panel-rebuild/scan-qr-fix`,
`b59d1f4`, merged into token-gaps as `2e8f128`); the live-camera
confirmation on the owner's phone (item 5) is still open. (2) The
PNG share path now draws the full QR card (QR-card programme, 7
templates A–G, 1080 px export). (3) SOL sending now works — the
Solana signer was replaced with `@solana/web3.js`, so native SOL and
SPL USDC sign offline and verify in the browser (expansion
programme, `192e53b`); the "SOL (SPL) — Not available" row in the
per-chain coverage table below describes 2026-11-24, not today.
Items 4 (token balances load only via the dashboard) and 6
(review/sign CDP-unverified for funded flows) are still open.

## The owner's order, point by point

1. **Add Token is broken + verified mark everywhere.** Typing a random
   ticker like "sushi" in Add Token failed to add, and nothing showed
   whether the token was verified.
2. **Token sending on all chains.** Held for the BSC native-send fix
   (separate agent, `panel-rebuild/bsc-send`), then built on the
   generalised signer. ERC-20, TRC-20, SPL, Jettons where feasible.
3. **Token receiving on all chains.** Receive QR + address + payment URI
   correct for tokens (EIP-681, Solana Pay, `ton://`, TRC-20).
4. **Mobile homepage — complete token names + UI/UX pass.** The complete
   token name was not displayed on the mobile homepage.
5. **Receive QR card redesign — Bitget-style full card.** A FULL card, not
   just a QR: logo, title, subtitle, big QR with centre logo, address +
   copy, footer. Bawa's own wording and branding — no Bitget branding,
   logo, or "Deposit from Bitget Exchange" link.
6. **Merge + verify + push.** Gates, CDP re-verification, link check,
   push to token-gaps + doc-only to main.
7. **Lane 7 — Scan QR fix.** The owner reports Scan QR is not working.
   (See "Lane 7 — BLOCKED" below.)

## Per-lane results

### Lane 1 — Add Token by ticker + verified mark everywhere: DONE
Commit `7e1da67` (worktree commit `c1b9aa3`). 14 files, +1149/−112
(as merged; the worktree commit was +1145/−107 — the merge added the
resolved conflict lines).

Reproduced first: contract field "sushi" → format error; search showed 9
candidates with no verified mark; CoinGecko 429 swallowed into a false
"No token found". Fix: `wallet/token-search.ts` (candidates gain
`verified`; honest error states), `screens/add-token.tsx` (`resolveQuery`
— local registry first, then CoinGecko; 1 match auto-fills, several shown
to pick; `coingeckoId` carried; result "Token added — ✓ Verified /
Unverified"). Verified is defined honestly on `isVerifiedToken`
(`wallet/tokens.ts`): verified ONLY when curated in-repo default OR
contract resolved to a real CoinGecko listing for that exact chain +
contract; anything else "Unverified". Marks added to: Add Token search
results + result, dashboard/asset-list rows (list + table, both states),
asset detail header, Send picker + footer, Receive picker + details
header, watch-only rows (automatic). QR card untouched (Lane 5).

Gates: vitest 1,877 passed / 5 skipped, tsc 0, eslint 0, build 0. CDP:
20 screenshots viewed (sushi added with ✓ Verified on all surfaces;
stored record eth `0x6B3595068778DD592e39A122f4f5a5cF09C90fE2`, 18 dec,
`coingeckoId: 'sushi'`). Caveats: CoinGecko rate-limits live (retry after
~60 s worked); 390 px list rows render the mark as "✓ …" (elided, DOM
carries full "✓ Verified"); Unverified not demonstrated live in CDP
(unit-tested); SUSHI has no bundled list icon (empty circle in list;
logo shows in detail header + QR card).

### Lane 2 — Token sending on all chains: DONE
Commit `88651ad` (worktree commit `6b88f49`). 7 files, +2482/−48.
Built on the generalised `signEvmOffline(chain, ...)` (BSC fix,
`31012a6`); the EVM generalisation was NOT redone.

- `wallet/send.ts`: `buildErc20TransferData` (hand-encoded `0xa9059cbb`
  + 32-byte recipient + 32-byte amount); `signEvmTokenOffline`
  (duplicates the native EVM signing core, does not refactor it; value 0,
  gas 100000, chainId from the registry); `verifyEvmTokenSignedTx`
  (to==contract, value==0, data==calldata, nonce, chainId, gas==100000,
  sender recovery); `signTrc20Offline` (Wallet Core
  `transferTrc20Contract`, feeLimit 100 TRX); `signJettonOffline` (V4R2,
  mode 3, dest = sender's Jetton wallet, attached 0.05 TON, forward 0,
  queryId 0); `estimateTokenSendFee` / `previewTokenSendAmount` /
  `simulateTokenSend` (preview takes the cached token balance; simulate
  re-reads it live; devnet only on ETH/TRX/TON).
- `wallet/adapters/token-balances.ts`: `fetchJettonWalletAddress`
  (TonAPI; `wallet_address` is an object, raw `0:` form; 404 → null) and
  `deriveAssociatedTokenAddress` (pure PDA math, verified against a
  `@solana/spl-token` oracle on 3 vectors).
- `screens/send.tsx`: token branch of `handleAmountNext` →
  `previewTokenSendAmount`; `handleSign` → `simulateTokenSend` +
  per-standard signing; token fee effect; Max = full token balance (fee
  is native); review values computed in the body. `SIGNING_CHAINS`
  untouched (gates native only); token sends gated on `tokenStandardFor`.
- `screens/send-review.tsx`: `tokenContract` prop, "Token contract" row.
- Tests in `send.test.ts`, `token-balances.test.ts`, `send.test.tsx`.

Gates: tsc 0, build 0, eslint 0, vitest 1,899 passed / 5 skipped
(an earlier run had 1 failure in the pre-existing flaky
`core.test.ts` SOL-address-length assertion on a random mnemonic —
untouched file, passes on re-run). CDP (serve hash-verified, no vite
preview; evidence `/home/boxd/workspace/bawa-token-lane2-cdp/`): live
pass — ETH/BSC/Base/TRX/TON reach the details step with the gate gone,
live fee estimates render, preview refuses on funds; stubbed-RPC pass —
all five reach review and "Send signed, not sent"; signed payloads
parsed in Node (ETH tx `0xdb9cb414…` chainId 1, BSC `0xe0f94e5e…`
chainId 56, Base `0x80c0833f…` chainId 8453, TRX txid `e0fa97a5…` all 9
checks, TON message hash `0xc4077add…` BOC). 8 screenshots viewed by eye
(390 + 1440).

Note for later: token balances load only via the dashboard (the
`refreshTokenBalances` effect lives in asset-rows). A direct deep-link or
fresh reload on `/send` shows "balance not loaded yet" until the user
visits the dashboard — pre-existing app behaviour, not changed by this
lane, but the Send flow depends on it.

### Lane 3 — Token Receive on all chains: DONE
Commit `2548a09` (worktree commit `b954fb8`). 3 files, +498/−10.

Two critical bugs in `wallet/payment-links.ts` (the Receive screen
already passed the token; the builder ignored it):
- SPL — a "25 USDC" receive encoded `solana:<addr>?amount=25`, a native
  SOL request for the token amount (a sender would pay 25 SOL).
- Jetton — a "25 USDT" receive encoded
  `ton://transfer/<addr>?amount=<nanotons>`, a native TON request.

Fixed: SOL `solana:<address>?amount=<decimal>&spl-token=<mint>`; TON
`ton://transfer/<address>?jetton=<master>&amount=<base units>` (25 USDt
= 25,000,000 units at 6 decimals). Parse accepts `spl-token`/`jetton`,
resolving mint/master against known tokens; unknown fails honestly.
ERC-20 already correct (EIP-681); TRC-20 correct by design (no
payment-URI standard — plain-address QR + Bawa link). BTC/LTC/DOGE N/A
(no tokens).

Gates: tsc 0, build 0, eslint 0, vitest 1,876 passed / 5 skipped. CDP
15/15 green, QR decoded with jsQR equals title exactly. Coverage:
CDP-verified eth, base, matic, arb, op, avax, bsc, sol, ton, trx;
unit-only (no default token) gnosis, celo, linea, mantle, scroll,
opbnb, metis, aurora, fantom.

### Lane 4 — Mobile homepage complete token names + UI/UX: DONE
Commit `9b8910d` (worktree commit `a33c19c`). 4 files.

Reproduced first: the complete token name was NOT displayed at all —
rows showed only the symbol (8 of 10 full names absent from the DOM;
only `USDT0`/`USD₮0` present where symbol == name). Also chain names
wrapped mid-name ("BNB Smart / Chain"), "Zero balance" wrapped,
VERIFIED tick split. The recorded "Ethere…" nit is NOT what the owner
saw (it lives in the `/assets` table variant, not homepage rows). Fix:
row title is now `token.name`; subline carries symbol + chain +
contract; tick `whitespace-nowrap`; TableRow wraps instead of truncating
(fixes "Ethere…" on `/assets`). After: 10/10 full names present at
390/820/1440, no clipping/overlap.

Gates: tsc 0, build 0, vitest 1,861 passed / 5 skipped. Caveats:
longest multi-word titles still wrap at a word boundary at 390 px ("USD /
Coin ✓ Verified") — complete but not one-line; 820 px shows the same
430 px mobile frame as 390 px; one probe run hit the wrong port (4244,
another lane's server) and was caught and redone.

### Lane 5 — Receive QR card redesign (Bitget-style full card): DONE
Commit `e0eba21` (worktree commit `979b4d4`). 4 files, +474/−111.

Full card in Bawa's own paper/ink/sun treatment — no Bitget
branding/logo/"Deposit from Bitget Exchange" link. Top to bottom: asset
logo in circle with network badge, "Receive {TOKEN}" title, subtitle
naming the one network, large **192 px QR** with asset logo in centre
(excavated, error level H), requested amount, "Receiving address" label
with full address + Copy button, token full name + network (tokens only),
footer "Share the card, keep the keys." Verified live for ETH, USDC-on-
Base, SOL, TRX at 390/1440; all 8 QR payloads decoded from screenshot
pixels with jsQR matched exactly; three templates keep working.

Gates: tsc 0, build 0, vitest 1,867 passed / 5 skipped.

**Trade-off, measured: the 192 px QR supersedes fix-all Lane E's "136
stays" decision** (136 was the fold fix; the owner explicitly ordered
the full card with a large QR). Cost: at 390 px the card bottom is
878–906 px vs the 844 fold, so the template row is one short scroll
below the fold. **Follow-up left open: PNG share/download still draws
the old card layout** (`qrCardToPngFile` in `payment-links.ts` — left
untouched to avoid colliding with Lane 3; porting the new card into the
PNG is a small follow-up for the merge lane).

### Lane 7 — Scan QR fix: BLOCKED
No commit. Worktree `/home/boxd/workspace/bawa-token-lane7-worktree`
(detached HEAD `f065128`, clean). An execution-risk flag on the
worktree-creation exec stopped all execution; the lane did read-only
diagnosis only. It needs the user/parent's explicit go-ahead to run
build/test/commit/CDP commands inside the worktree.

Diagnosis (code reading, every claim cited to file + line):
1. **PRIMARY** — bare-address scan from the chain step silently does
   nothing (the Round 2 item 1 bug, surviving): `handleScan`
   (`send.tsx:424-473`) — a payment URI goes through `applyPrefill`
   (sets step to `details`); a bare address fails `parsePaymentUri` (no
   scheme, `payment-links.ts:186-187`) and falls to the plain-address
   path (`send.tsx:465-473`), which only sets recipient + validates and
   never advances the step; recipient/amount only render on `details`
   (`send.tsx:1146-1165`); the chain step shows only `prefillNote`,
   never set. Scanning any plain-address QR (another wallet's Receive
   screen, printed address, exchange address) closes the scanner with
   nothing visibly changed. It escaped Round 2 because
   `send-scan.test.tsx:238-296` covers only the Base USDC payment-URI
   path.
2. **SECONDARY** — camera path single attempt, silent dead end
   (`qr-scanner.tsx:115-134`): one
   `getUserMedia({video:{facingMode:'environment'}})` attempt, no
   fallback; `OverconstrainedError`/`NotFoundError` collapse into the
   generic message; `video.play()` rejection swallowed silently so
   decoding never runs.

Fix spec delivered: `send.tsx` plain-address fallthrough calls
`setStep('details')` after setting recipient; `qr-scanner.tsx` `start()`
retries once with `{video:true}` on constraint errors, distinguishes
`NotAllowedError`/`NotFoundError` with upload-pointing messages,
surfaces `play()` failures. Live camera on the owner's phone is NOT
provable on the VM — the owner must confirm it on their phone.

## The merge

Cherry-picked onto `panel-rebuild/token-everywhere` (`31012a6`, which
already holds the BSC native-send fix) in order: Lane 3 `2548a09`,
Lane 5 `e0eba21`, Lane 4 `9b8910d`, Lane 1 `7e1da67`, Lane 2 `88651ad`,
then merge fix `c92e2fd`.

- Lane 3, Lane 5, Lane 4, Lane 2 cherry-picked cleanly (Lane 5's
  `receive.test.tsx` and Lane 2's `send.tsx`/`send.test.tsx` auto-merged).
- Lane 1 conflicted with Lane 4 on two files, resolved by keeping BOTH:
  - `asset-rows.tsx` (list row + table row): Lane 4's
    `whitespace-nowrap` tick + Lane 1's Verified/Unverified ternary.
  - `asset-list.test.tsx`: three interleaved tests reconstructed as
    three complete tests (Lane 4 full-name, Lane 1 Unverified, Lane 1
    failed-row tick).
- One merge defect found by vitest and fixed in place (`c92e2fd`):
  Lane 1's test "shows the verified tick on a failed token row in the
  wide table" finds the row by its symbol (USDC); Lane 4 made the title
  the full token name ("USD Coin") and the TableRow unavailable branch
  rendered statusText but not the subtitle, so the symbol appeared
  nowhere on that row. The TableRow unavailable branch now renders the
  subtitle (symbol · chain · contract) too, matching the ListRow, and
  its verified spans got the same `whitespace-nowrap` as the other two
  sites.

## Per-chain coverage

### Token sending (offline signing only; broadcast stays disabled)

| Chain | Token sending | Evidence |
|---|---|---|
| All 16 EVM chains (ERC-20) | Works | CDP review+sign+payload parse for ETH (chainId 1), BSC (56), Base (8453); all-16-chainIds unit test; MATIC USDC screen test reaches review while native Polygon stays unavailable |
| TRX (TRC-20) | Works | CDP review+sign; payload parsed: TriggerSmartContract, contract hex `41a614f8…`, data `a9059cbb…` + recipient word + amount `25000000`, fee_limit 100000000, txid = sha256(raw_data_hex) |
| TON (Jetton) | Works | CDP review+sign; BOC base64, magic `b5ee9c72` |
| SOL (SPL) | Not available | Wallet Core 4.9.3's Solana signer returns an `encoded` tx that is not a valid Solana wire tx (fails to parse with @solana/web3.js, contains none of the tx fields, signature does not verify against the correctly-built message); same failure for native SOL. Preview refuses with the concrete reason; ATA derivation kept as a verified utility |
| BTC / LTC / DOGE | Not applicable | No token standard; the block is kept with the reason |

### Token receiving

| Chain | Token receive | Evidence |
|---|---|---|
| EVM (ERC-20, EIP-681) | Works | CDP-verified eth, base, matic, arb, op, avax, bsc; unit-only gnosis, celo, linea, mantle, scroll, opbnb, metis, aurora, fantom |
| SOL (SPL, Solana Pay `spl-token`) | Works | CDP-verified |
| TON (Jetton, `ton://` `jetton=`) | Works | CDP-verified |
| TRX (TRC-20, plain-address QR + Bawa link) | Works | CDP-verified (no payment-URI standard exists for TRON) |
| BTC / LTC / DOGE | Not applicable | No tokens |

## Gates (merged tree, Node 22)

- `tsc --noEmit` 0 · `npm run build` 0 (palette audit passed) ·
  **vitest 1,944 passed / 5 skipped / 0 failed, 94 files** · `eslint` 0.
- Full link check: 167 md files, 306 relative links, **0 broken**.
- Build note: the first build in the merge worktree failed on a stale
  `node_modules` (`@fontsource-variable/baloo-2` in `package.json` but
  absent from the install) — fixed by a fresh `npm ci`, not a code
  change.

## CDP re-verification (merged tree)

Merge-lane CDP agent, on `panel-rebuild/token-everywhere` at `c92e2fd`
(before the programme-record commit). Rebuilt with Node 22, served
statically on a fresh port (4291), served JS hash matches dist, no vite
preview. Fresh disposable test wallets, unfunded, nothing broadcast.
Evidence: `/home/boxd/workspace/bawa-token-merge-cdp/` on gray-pinee.
**Verdict: all 7 items PASS. No merge regression found. No code touched.**

1. **Add Token by ticker — PASS.** "sushi" → 9 candidates, all
   "Sushi (SUSHI)✓ Verified" with chain + short contract. Picked
   Ethereum SUSHI (contract prefilled
   `0x6b3595068778dd592e39a122f4f5a5cf09c90fe2`), exact Add →
   "Token added — ✓ Verified". Dashboard row: "SushiToken✓ Verified
   SUSHI · Ethereum · 0x6B35…0fE2 Zero balance $0.1553 per SUSHI".
   Detail H1: "SUSHI✓ Verified". By contract: DAI pasted →
   "Already added" (DAI is a default token — the contract field resolved
   it correctly); AAVE (`0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9`,
   non-default) → "Token added — ✓ Verified". Caveat: one sushi search
   round timed out on CoinGecko 429s (live-network rate limiting, not
   the app); a retry landed. (A first-pass "add failed" was a harness
   error — it clicked the "Add token" tab instead of the exact Add
   button; corrected and re-proven.)
2. **Verified marks — PASS.** Dashboard 390 + 1440: 20 `✓ Verified`
   marks, 0 Unverified on default tokens. Asset detail SUSHI and AAVE:
   `✓ Verified` in H1. Send picker: `USD Coin · USDC✓ Verified`, 7
   marks on the token step. Receive picker: same, 7 marks. Watch-only
   (wallet's own ETH address, SUSHI seeded): row "SushiToken✓ Verified
   SUSHI · Ethereum · 0x6B35…0fE2 Zero balance $0.155294 per SUSHI" at
   1440 and 390.
3. **Token Receive URIs — PASS** (QR decoded with jsQR, exact match to
   title). SOL USDC:
   `solana:CgMn8LhZGnkvrDcv64N88kZJq5p29Fu5xrG6uCoFrpLE?amount=25&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
   — Solana Pay URI with spl-token mint, not native SOL. TON USDT:
   `ton://transfer/UQAibZCTbhE1amFPkTf1Z0h9EtCuERHqnjfMe_y7dgGuPagS?jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs&amount=25000000`
   — Jetton master + base units, not native TON. ETH USDC (control):
   `ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0xd3e8dc37470B6fe15ebFb15fd4b88107961a46A4&uint256=25000000`.
   All decoded == title at 390 and 1440. (First decode attempt failed
   on the app's CSP blocking `addScriptTag`; re-ran with
   `bypassCSP:true` — harness fix, not an app change.)
4. **Mobile homepage names — PASS.** At 390, token rows show complete
   names with no truncation and no horizontal overflow (`scrollWidth ==
   innerWidth == 390`, no `Ethere…`): "USD Coin ✓ Verified",
   "Tether USD ✓ Verified", "Dai Stablecoin ✓ Verified",
   "ChainLink Token ✓ Verified", "Uniswap ✓ Verified",
   "Wrapped BTC ✓ Verified". Names wrap to two lines in the narrow
   column (e.g. "USD / Coin") — complete, not clipped. Subtitles
   readable: "USDC · Ethereum · 0xA0b8…eB48". At 1440 the wide table
   shows the same full names.
5. **Receive QR full card — PASS.** Viewed at 390 (SOL, TON) and 1440
   (ETH): logo in circle with network badge, title "Receive USDC" /
   "Receive USD₮", subtitle naming the one network ("Only
   Solana/TON/Ethereum network assets can be received here."), QR
   **192 px** measured, asset logo centred in the QR, amount (25 USDC /
   25 USD₮), "Receiving address" with the FULL address + Copy button,
   "USD Coin · Solana" / "Tether USD · TON" / "USD Coin · Ethereum",
   footer "Share the card, keep the keys." QR decoded == title in all
   cases. All three templates work at 390 and 1440 (ETH USDC): Payment
   request `ethereum:…@1/transfer?address=0x8e9AE6Dd1C48d750117E148cAe04E02145F737dE&uint256=25000000`,
   Address `0x8e9AE6Dd1C48d750117E148cAe04E02145F737dE`, Share link
   `http://127.0.0.1:4291/bawa/send?chain=eth&to=0x8e9AE6Dd1C48d750117E148cAe04E02145F737dE&amount=25&token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
   — each decoded == title.
6. **Token sending — PASS.** Stubbed RPC (funded balances, real WASM
   offline signing), all "Send signed, not sent", payloads parsed in
   Node: ETH USDC tx `0xf5ccec1e7476de52a5db1eff2ec2ebc39bce331c1158217ddc9094deed3036ef`
   — chainId 1 ✓, to = USDC contract ✓, value 0 ✓,
   `transfer(vitalik, 25000000)` data ✓, gas 100000 ✓ (also at 1440,
   same hash); BSC USDT tx `0x1beb05e37d83a086833ed2fce146af8acc16f13b12d3049b87d37099a1d6b261`
   — chainId 56 ✓; Base USDC tx
   `0x28731385bb09e309f443e3c405627000000e93a2dd3a9ab40eb551db0080ee75`
   — chainId 8453 ✓; TRX USDT txid
   `cd56074fe8d9579db654e604963d51b291861ca821d114413d2ce55e8d58b31e`
   — TriggerSmartContract ✓, contract `41a614f8…` ✓, `a9059cbb`
   transfer data + amount word ✓, fee limit 100000000 ✓; TON USDT tx
   `0x398c9fe806326a5a4b4369125eea8e18f1c83ac3d53ff4bf16301de4ab07d894`
   — base64 BOC, magic `b5ee9c72` ✓. Live network (0-balance wallet):
   ETH/BSC/Base/TRX/TON all reach the details step with balance loaded
   and refuse on funds — "Amount exceeds available balance"
   (insufficientFunds true for all five). The "isn't available yet" gate
   is gone. SOL SPL — honest refusal, live and stubbed: "Fee estimate
   unavailable: Token sending on Solana is not available yet — the
   Solana signer in this wallet cannot produce a valid signed
   transaction." No silent failure.
7. **Merge fix — PASS.** Wide variant at 1440, external blocked,
   settled failed rows: "USD Coin✓ Verified USDC · Ethereum ·
   0xA0b8…eB48 Could not load balance Price error" and "Tether USD✓
   Verified USDT · Ethereum · 0xdAC1…1ec7 Could not load balance Price
   error" (5 failed rows total). List variant at 390 identical.

Non-defects noted: transient "Loading…" skeleton text can sit adjacent
to a settling row mid-load (gone after full settle). Live runs show
heavy CoinGecko 429s / price-feed errors in console noise; balances show
"Price error" / "Could not load balance" accordingly. No page exceptions
beyond a CSP `frame-ancestors` meta warning.

## Pushes

- `panel-rebuild/token-everywhere`: `c8af598` (7 commits from `31012a6`:
  BSC fix + 5 lanes + 1 merge fix + programme record). Verified by fresh
  ls-remote.
- `panel-rebuild/token-gaps`: fast-forward merged from token-everywhere
  at `c8af598`, verified by fresh ls-remote. (A doc-only fixup commit
  updating this section sits on top of `c8af598` on both branches.)
- `main`: doc-only (this programme record) at `a3d4c15`, verified by
  fresh ls-remote. Main's code still has no web wallet — the code lives
  on `panel-rebuild/token-gaps`.

## Open items / follow-ups

1. **Lane 7 (Scan QR) is BLOCKED** — needs the owner's explicit go-ahead
   to execute inside its worktree. Diagnosis + fix spec are delivered
   above; the live camera still needs the owner's phone to confirm.
2. **PNG share/download still draws the old QR card layout**
   (`qrCardToPngFile` in `payment-links.ts`). Port the Lane 5 full card
   into the PNG.
3. **SOL SPL sending is NOT available** — Wallet Core 4.9.3's Solana
   signer cannot produce a valid wire tx (same failure for native SOL).
   The app refuses honestly with the concrete reason.
4. **Token balances load only via the dashboard** — a direct deep-link
   or fresh reload on `/send` shows "balance not loaded yet" until the
   user visits the dashboard (pre-existing behaviour).
5. **Live camera scan path unverified** — needs the owner's phone (see
   Lane 7).
6. **Review/sign steps CDP-unverified for funded flows**
   (vitest-covered only) — needs a funded wallet to render live; the
   token-send lanes verified them with stubbed funded balances instead.
7. The 192 px QR puts the Receive template row one short scroll below
   the fold at 390 px (owner-ordered trade-off; supersedes fix-all Lane
   E's "136 stays").
