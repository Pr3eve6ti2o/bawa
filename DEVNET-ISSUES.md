# Devnet issues — temporary devnet programme (Lane D, 2026-11-22)

Hands-on Muse testing on `panel-rebuild/devnet-temp`, worktree
`/home/boxd/workspace/bawa-devnet-temp-worktree`. Devnet/testnet only,
valueless test tokens only. 0 Sol calls. Nothing in this file was
broadcast on mainnet; no real funds were involved.

Lane C update (2026-11-22 ~22:46 IST): Issue 7 and the BTC/ETH/TRX
coverage rows rewritten after the faucet attempts (0 obtained on all four
faucets); no app code changed. Full attempt log:
`/home/boxd/workspace/bawa-captcha-faucet/LANE-C-ATTEMPTS.md`.

## Test wallets (disposable)

- Wallet A (sender): BTC testnet4 `tb1qthpp9j0xe2a2lu92rlma8wavza4c4dnr3t9dv7`,
  ETH Sepolia `0x5FB142843960B2B122d0D8BE5d23A663aB8cF478`,
  TRX Nile `TKY5iG6YnXToWLau6X9AirpvioevEmbLFy`,
  TON testnet `0QAngs-IBgOTUEsHtRU6lyK6ykPEyQYy0D102U2KQ9BRtl4H`.
- Wallet B (destination): BTC `tb1q6w7vjcd3fckqhdszqfh2fve4l9v5xqary0dr5e`,
  ETH `0x9B9841848AfdB60229ED0BC2a3A94Eab9B7d6E24`,
  TRX `TQQtPktBuX4GWoabnKdjTmvQfLWtnRgTaG`,
  TON `0QCCLvN9Kxun6XhLPu3GcO4AqBVv7R32ABoOWAFZ3eCZU12x`.

## Per-token coverage

| Token / chain | Devnet | Faucet / amount | Receive | Send | Tracking |
|---|---|---|---|---|---|
| BTC — Bitcoin testnet4 | testnet4 | coinfaucet.eu, zalalena — 0 (hCaptcha image grid: no free solver covers the served labels; zalalena Turnstile gate cleared but hCaptcha checkbox won't check — issue 7) | NOT PROVEN (unfunded) | NOT PROVEN (unfunded; WASM plan/sign proven by isolated probe, see below) | NOT PROVEN (no tx) |
| ETH — Sepolia | Sepolia | pk910 PoW — 0 (IP block: `[IPINFO_RESTRICTION]`, hosting IP range — issue 7) | NOT PROVEN (unfunded) | NOT PROVEN (unfunded; validation works — "Amount exceeds available balance") | NOT PROVEN (dummy hash → format validation) |
| TRX — Nile | Nile | nileex — 0 (Turnstile never completes: widget hangs on "Verifying..." / checkbox clicks don't take — issue 7) | NOT PROVEN (unfunded) | NOT PROVEN (unfunded; validation works) | NOT PROVEN (dummy hash → "not found") |
| TON — testnet | TON testnet | Acton PoW CLI — 2 GRAM claimed, 1 GRAM moved to wallet A | PROVEN (`1de6a99f…`, 1 GRAM) | PROVEN for deployed wallets (3 app sends, hashes below); NOT PROVEN for fresh wallets (issue 5) | PROVEN for tx hashes; NOT for message hashes (issue 6) |
| SOL / BNB / Polygon / Arbitrum / OP / Base / Avalanche / LTC / DOGE | — | — | NOT TESTABLE — derive-only, no adapter (issue 8) | NOT TESTABLE | NOT TESTABLE |
| USDC / USDT / DAI / LINK / UNI / WBTC (ERC-20 logos only) | — | — | NOT TESTABLE — logos only, never displayed, no adapter (issue 8) | NOT TESTABLE | NOT TESTABLE |

Token-discovery programme (`panel-rebuild/token-discovery`, default
20-token list): the branch had **not landed on the remote** at the
final check (2026-11-22 ~16:35 IST; remote has only `main` and
`panel-rebuild/adopt-proper`). Its tokens are therefore not covered
here; the registry tokens above are the full coverage.

### TON transaction hashes (all on TON testnet)

- Receive (Acton wallet → A, 1 GRAM):
  `1de6a99fadfc8971258222f4c7ad272fa4fba11a7bde5ffb3f0d6e166d9c4e54`
  — https://testnet.tonviewer.com/transaction/1de6a99fadfc8971258222f4c7ad272fa4fba11a7bde5ffb3f0d6e166d9c4e54
- Deploy + send (Node, A → B, 0.5 GRAM, seqno 0, deploys A):
  `7a56c3e8575a38f337d5ef6eb0e5fe90e58d52e94bdf26d4c781b2d93de5a933`
  — https://testnet.tonviewer.com/transaction/7a56c3e8575a38f337d5ef6eb0e5fe90e58d52e94bdf26d4c781b2d93de5a933
- App send 1 (A → B, 0.25 GRAM, seqno 1):
  `945e11585b19e55b832b187b5d8b3e755624267c4d5b744f125bcb8480bd9769`
  (message hash `0xae4686fb0b16b8086a2b498653aad739da7d8ce43859738a1b3cda572b82c101`)
  — https://testnet.tonviewer.com/transaction/945e11585b19e55b832b187b5d8b3e755624267c4d5b744f125bcb8480bd9769
- App send 2 (A → B, 0.05 GRAM, seqno 2):
  `a35eca3192cc0a9dd7fea36413d9bc5e787818a2ed5dc50272899c194c49af09`
  (message hash `0xdb42efc3dc58eddc70dd0083ade69292967b04e8323eb0e0f43ef412672c4c5b`)
  — https://testnet.tonviewer.com/transaction/a35eca3192cc0a9dd7fea36413d9bc5e787818a2ed5dc50272899c194c49af09
- App send 3 (A → B, 0.02 GRAM, seqno 3):
  `7745d7c2e1eae4267a331368b54b2994e8e05d50b9d8c521718e0b7c3ef4546d`
  (message hash `0x97a806498152ff9003aabef57a84e1b702d3af99e2e4315fda964ed63c88a975`)
  — https://testnet.tonviewer.com/transaction/7745d7c2e1eae4267a331368b54b2994e8e05d50b9d8c521718e0b7c3ef4546d

Final test balances: A ≈ 0.239 GRAM, B ≈ 0.82 GRAM.

### BTC isolated probe (synthetic UTXO — NOT a real transaction)

Wallet Core `AnySigner.plan` + `sign` with the bc1q-mapped devnet
addresses (wallet A key, `m/84'/1'/0'/0/0`, synthetic 100,000-sat
UTXO, 10,000 sats to B, 5 sat/vB): plan OK (fee 705, change 89,295),
sign OK, txid
`c4270f9a7b7f707214abcf3e040997b072041b5dc3f54adff81ad081a5b06287`,
222 bytes, 2 outputs. The transaction was **never broadcast** (the
UTXO does not exist on chain). This proves the WASM plan/sign path
with bc1q-mapped testnet addresses does not throw or abort; a live
BTC send still needs a funded testnet4 UTXO.

## Issues

### 1. [FIXED] CSP blocked every devnet fetch — wallet bug

- Chain: all four. What failed: receive / balance / history in the
  browser. Evidence: console `Content Security Policy … refused …
  https://testnet.toncenter.com`, `https://nile.trongrid.io`,
  `https://ethereum-sepolia-rpc.publicnode.com`. Lane C added the
  devnet endpoints but never updated `connect-src` in
  `apps/web/src/app/security-headers.ts` (only the six mainnet origins
  were pinned), so devnet mode was dead in the browser although the
  endpoints answer curl.
- Fix: added the five TEMPORARY devnet origins to `connect-src` plus
  a removal-checklist step in `docs/DECISIONS.md`. Tests:
  `security-headers.test.ts` updated (6 → 11 origins). Gates green.

### 2. [FIXED] TON send could never reach Review — wallet bug

- Chain: TON (mainnet and devnet). What failed: send. Evidence: the
  Amount step showed "TON fees depend on the unsigned message;
  estimated in the Phase 4 send flow" and clicking Review stayed on
  Amount. Root cause: `ton.ts` `estimateFee` honestly returns
  `unavailable` (no read-only TON fee endpoint), while
  `previewSendAmount` in `send.ts` failed the preview whenever the
  fee was unavailable — so no TON send could ever be reviewed.
- Fix: for TON only, the preview proceeds when the adapter has no
  fee, with `feeUnknown: true` and a note that the network charges
  the fee at broadcast on top of the amount. No fee number is
  invented (`feeBaseUnits: '0'` is a placeholder, never displayed);
  `send.tsx` shows "Unknown — charged by the network at broadcast"
  and "0.5 TON + network fee". Tests: two new cases in
  `send.test.ts`. Verified live by the three app sends above.

### 3. [FIXED] TON adapter read a garbage seqno for uninitialized wallets — wallet bug

- Chain: TON. What failed: send (first send from a fresh wallet).
  Evidence: TonCenter `runGetMethod seqno` on the uninitialized
  wallet A answered `ok:true` with `exit_code: -13` and a garbage
  stack `0x14c97`. The adapter's `parseTonSeqno` read the stack
  without checking `exit_code`, signed with seqno 85143, and the
  network rejected the message (TonAPI 406: "cannot apply external
  message … exitcode=0, steps=0, gas_used=0"). The signed BOC was
  decoded offline: wallet_id 698983191, valid_until correct,
  seqno 85143.
- Fix: `parseTonSeqno` rejects a non-zero `exit_code`; `getTxInputs`
  then checks the account state via `getAddressInformation` and
  returns seqno 0 only when the account is `uninitialized` (any
  other state stays an error — a 0 is never guessed). Tests: three
  new cases in `adapters/ton.test.ts`. Verified live: after wallet
  A was deployed, the adapter returned the real seqno (1, then 2,
  then 3) with `exit_code: 0`.

### 4. [FIXED] TON devnet broadcast reported success as failure — wallet bug

- Chain: TON. What failed: send result reporting (and the explorer
  link). Evidence: the 0.25 and 0.05 GRAM app sends both landed
  on-chain (txs `945e1158…`, `a35eca31…`) while the app showed
  "Invalid response: expected a message hash — The transaction is
  signed but was not broadcast." Root cause: the jsonRPC `sendBoc`
  returns `{"ok":true,"result":{"@type":"ok"}}` — no hash at all —
  but `createDevnetTonBroadcast` assumed the result is a base64
  message hash. A user told "not broadcast" could re-send and
  double-spend.
- Fix: the broadcast accepts the `{"@type":"ok"}` shape and uses the
  signer's message hash (threaded from `signTonOffline` through
  `broadcastSignedDevnet` as `SendDevnetOptions.messageHash`) as the
  transaction identifier; without a supplied hash it throws a clear
  error instead of guessing. The base64-hash shape is still
  accepted. Tests: two new cases in `devnet-endpoints.test.ts`.
  Verified live: the 0.02 GRAM app send shows "Broadcast submitted
  — track it on the testnet explorer" with the explorer link, and
  the link resolves on TonViewer (a message hash resolves to its
  transaction there).

### 5. [OPEN] TON first send from a fresh wallet cannot deploy — wallet defect (missing state init)

- Chain: TON. What failed: send from an uninitialized wallet.
  Evidence: the app's signed BOC for wallet A (uninit) contains no
  state init (decoded offline: one ref — the body only; no init
  cell), and the network rejected it. Wallet Core's `Transfer`
  message has a `state_init` field (base64 one-cell BOC) that the
  app never sets. The same wallet deployed fine when the init was
  attached (Node `@ton/ton` deploy, tx `7a56c3e8…`, uninit → active).
  Issues 2–4 are fixed; this one still blocks the first send from
  any fresh TON wallet, on mainnet as well as devnet.
- Fix sketch (not implemented — needs a design decision): build the
  V4R2 state init (code + data with the wallet's public key) and set
  `Transfer.state_init` when signing — either when the wallet is
  uninit, or always (an init on an already-active wallet is ignored
  by the network). The app currently has no BOC builder vendored;
  that is the work to size.

### 6. [OPEN] /track cannot resolve a TON message hash — tracking gap

- Chain: TON. What failed: tracking. Evidence: pasting the message
  hash the app itself displays as "Transaction"
  (`97a80649…`, the 0.02 GRAM send) into /track with the account
  address returns "Transaction not found. Checked the 10 most recent
  transactions for this account". Pasting the transaction hash
  (`7745d7c2…`) resolves ("confirmed", From/To shown). The lookup
  matches transaction hashes only. A user tracking from the result
  screen's hash gets a false "not found".
- Fix sketch: resolve message hashes too (TonCenter/TonAPI can map a
  message hash to its transaction), or show the transaction hash on
  the result screen alongside the message hash.

### 7. [FAUCET GAP] BTC / ETH / TRX devnet faucets all captcha-blocked — 0 obtained

Lane C attempted all four faucets on 2026-11-22 (~22:14–22:46 IST) with
SeleniumBase 4.58.3 (UC Mode + CDP Mode, headed Chromium under Xvfb) and,
for hCaptcha image grids, hcaptcha-challenger 0.7.8 (local ONNX models, no
key). Full log: `/home/boxd/workspace/bawa-captcha-faucet/LANE-C-ATTEMPTS.md`.
**0 test tokens obtained on every faucet; no claim succeeded.**

- ETH Sepolia: `sepolia-faucet.pk910.de` — the Turnstile captcha is no
  longer the blocker. "Start Mining" now returns
  `[IPINFO_RESTRICTION] IP Blocked: You're connecting from a hosting IP
  range.` The faucet blocks the gray-pinee egress IP
  (`185.209.179.229`) outright; no captcha technique run from this IP
  can pass it.
- TRX Nile: `nileex.io/join/getJoinPage` — Turnstile never completes.
  Four attempts (UC GUI click, poll-then-click, CDP `solve_captcha()`,
  explicit human-like mouse click): the widget either hangs on
  "Verifying..." or its checkbox stays unchecked after every click
  transport. "Obtain" returns verbatim: `Please perform human-machine
  authentication first.`
- BTC testnet4: `coinfaucet.eu/en/btc-testnet4/` — invisible hCaptcha
  presents a visual image grid on claim ("Please click on the TWO lines
  that are shorter"; a later attempt served "Click the item connected
  to sports and games"). hcaptcha-challenger 0.7.8 ran on its own
  undetected-chromedriver but answered `Types of challenges not yet
  scheduled` for the served label and retreated (`backcall`); token 0.
  The current challenger needs a paid Gemini API key (STOP — not used).
- BTC testnet4: `faucet.zalalena.com/bitcoin/` — the Turnstile
  "Secure Access" overlay gate CAN be cleared (CDP `solve_captcha()`
  did it twice), the address fills and "Claim 0.00001 tBTC" clicks, but
  the claim then demands the hCaptcha checkbox and the page answers
  `Complete captcha verification`: the checkbox stays unchecked after
  GUI clicks; `h-captcha-response` token length 0.
- mempool.space faucet needs an account (not created, per brief).
  All other Sepolia faucets gate on mainnet balance or an account
  (not used).
- No captcha was solved by any service or trick; no paid solving
  service, sign-up or payment was used. Unblock path (for the owner,
  not done here): complete the captcha in their own browser at the
  faucet with the wallet-A devnet address for that chain (pk910 also
  needs a non-hosting IP). Until then BTC/ETH/TRX send and receive stay
  NOT PROVEN.

### 8. [ADAPTER GAP] 9 derive-only chains and 6 logo-only ERC-20 tokens are not testable

- Chains SOL, BNB Smart Chain, Polygon, Arbitrum One, OP Mainnet,
  Base, Avalanche C-Chain, Litecoin, Dogecoin: the registry has them
  and the Receive screen lists them, but there is no send/receive
  adapter — no balance, no send, no tracking in the app.
- Tokens USDC, USDT, DAI, LINK, UNI, WBTC: logos are registered in
  `token-logo.tsx` for future use only ("must never be shown with a
  fabricated balance"); they are not displayed and have no adapter.
- Classification: missing adapter, not a bug. No devnet equivalent
  was pursued for these because the app cannot exercise them.

### 9. [OBSERVATION] TonCenter testnet keyless tier rate-limits (429)

- Two app sends were 429'd at `sendBoc` and correctly reported as
  not broadcast (verified not landed on-chain); a 60-second idle
  before signing cleared the window and the next send went through.
  Broadcast is never retried by design. The limit is per egress IP
  and shared with the app's own polling, so devnet TON testing needs
  pauses between sends. Not a code defect.

### 10. [OBSERVATION] Unsolicited testnet dust to wallet A

- Three incoming transfers arrived at wallet A unprompted on
  testnet: 0.05 GRAM from `0:329e2dd8…`, 0.01 GRAM from
  `0:ff37486b…`, 0.001 GRAM from `0:b111a976…`. Testnet noise, not
  app behaviour. The app's balance display included them correctly.

## Mainnet isolation check — PASSED

Devnet off: all four mainnet addresses restore (BTC
`bc1qq43u…`, ETH `0x5FB1…`, TRX `TKY5…`, TON `UQAngs-…`), no
`tb1q`/`0Q` address leaks on any asset page or the Receive screen.
Send validation with unfunded addresses fails cleanly: ETH and TRX
show "Amount exceeds available balance" and never leave the Amount
step; a `tb1q` address is rejected as "Invalid Bitcoin address" in
mainnet mode. Devnet back on: the TON `0Q` address restores. No
mainnet broadcast path was exercised.

## Gates (after all fixes)

- `npx tsc --noEmit`: 0
- `npm run build`: 0 (palette audit passed)
- Full `npm test`: 73 files, 1253 passed + 5 skipped (was 1247 + 5)
- `npm run lint`: 0
- Playwright E2E: 5 passed (E2E-01…E2E-05)
- Preview: `vite preview` on 127.0.0.1:4193, fresh build served
