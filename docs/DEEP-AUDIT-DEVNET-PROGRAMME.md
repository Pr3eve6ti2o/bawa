# Deep Audit + Devnet E2E programme — 5 lanes, merged into token-gaps (2026-11-23)

**Decision: the 5-lane Deep Audit + Devnet E2E programme (owner order
2026-11-23 ~18:10 IST) is complete and merged into
`panel-rebuild/token-gaps`.** Branch `panel-rebuild/deep-audit-devnet`
(branched from token-gaps `b089c28`, devnet mode brought in from
`panel-rebuild/devnet-temp` `21f4726` as merge `9fa1df6`, then
reverify-pro's token-gaps tip `71326e1` merged in as `53e6e24`)
was merged into token-gaps by the coordinator (hands-on Muse, 0 Sol
calls). Merge destination per the owner's standing decision; no code
merged into adopt-proper or main.

## What each lane did

### Lane A — deep bug hunt + re-verification (commits `7167e0a`, `699f874`)

Re-verified the Round 2 and showcase claims first-hand in CDP: nearly
all HOLD (QR card + auto-select, shared-link V1–V5 including the
locked-vault case and the 2-account chooser, watch search/recent,
Baloo 2/Inter + 24 words, copy, devnet prices, mobile no-overflow,
scan icon + upload prefill, Add Token ×6, README wording). One
regression found and partially fixed: Send chain had scrolled back
to 936 px (was 844) and Receive details to 1446 px (was 1190) —
unconditional `pb-24` on focused flows, and the 136 px QR lost in
the merge. After the fix Send chain is back to 844 zero-scroll and
Receive details to 1390 with the QR at 136 and Copy/New above the
fold; Share/Copy link/Download still need ~40–90 px of scroll
(owner decision: smaller buttons or top-stack rework). Also fixed:
the hard-coded "Account 01" header (same bug Lane C fixed — both
fixes composed in the merge, both headers now use
`accountName(vaultAccount.account)`), and vacuous E2E-02 lock
assertions (switched to `getByText`, CDP-proven). Not fixed, with
reasons: DOGE has no working browser fallback when SoChain is
rate-limited (BlockCypher is CORS-blocked — needs an owner decision
on a second CORS-friendly source); refresh-burst duplicates
(trongrid ×3, Blockscout ×2 per navigation — needs the staggering
design). Verified in the hunt: imports 12/15/18/21/24, bulk 10 →
Accounts 2–11 and bulk 50 → 61 accounts, rotation, auto-lock
Immediately + 1-minute timer (fires at the full 60 s), pill
toggles, SOL failover, Send validation, empty states, watch-only
SOL import, Receive BTC/SOL/TON.

### Lane B — devnet E2E, all chains (commit `7b6e4c0`)

TON testnet funded and proven end to end. Wallet A 0.238551757
GRAM; wallet C funded 0.05 GRAM via TonAPI tx
`dd2d3675...` (TonViewer-confirmed). A→B 0.02 GRAM sent, message
`0x57fc1edc...`, TonViewer tx `07f4ef09...c3641483`, seqno 5,
exit 0. C→B 0.01 GRAM first send (seqno 0) landed via the
app-signed BOC through keyless TonAPI after 4× TonCenter
`sendBoc` 429, TonViewer tx `4f35a862...fe4a42c0`, message
`0xed4c4066...`, contract deploy wallet_v4r2, C uninit → active.
Final balances: A 0.167710152, C 0.039031524, B 0.849999831 GRAM.
BTC/ETH/TRX: NOT PROVEN — 0 tokens obtained on any faucet on the
2026-11-23 retry (pk910 IP block is gone, new block is
`[INVALID_CAPTCHA]`; nileex Turnstile never completes;
coinfaucet.eu hCaptcha; ZalalenA Turnstile gate never clears).
Owner action: complete the captchas in their own browser with the
wallet-A addresses. Issue 5 CLOSED with live proof: the first-send
state init IS present in the app-signed BOC (code hash
`feb5ff68...`, V4R2, init address == C's address exactly) — the
2026-11-22 missing-init inference was wrong (that decode was of a
garbage-seqno BOC). Issue 6 FIXED in place: `lookupTon` also
matches base64 `in_msg.hash`, `lookupTransaction` strips leading
`0x` for TON; /track with the 0x-prefixed message hash returns
the exact landed tx, CDP-proven. Issue 7 still blocks, Issue 8
unchanged (not a bug), Issue 9 still blocks (keyless 429s), Issue
10 needs no change. New finding: watch-only rejects devnet TON
addresses — `validateWatchOnlyImport` and `deriveAddress` call
`validateTonAddress` with no devnet option, a deliberate boundary
decision; not fixed in this lane (multi-site, mainnet safety
implications) — needs a coordinator/owner decision; fix sketch in
the Lane B report. Caveat: the C send landed via keyless TonAPI
transport, so the app's own broadcast path for a first send is
proven only by the A→B landing (seqno 5).

### Lane C — HD wallet + bot use case (commit `e3a9318`)

All 22 chains MATCH both independent oracles (Python bip_utils +
Wallet Core 4.9.3) at indexes 0/1/2/5, fresh disposable 24-word
phrase. The bot use case is YES for 20 chains: there was no xpub
export at all before this lane — it added `getAccountExtendedPublicKey`,
`accountPathFor`, `exportAccountExtendedPublicKey` and the
on-demand "Account public keys for your bot" section on Wallet
Management (22 chains, path shown, keys never rendered unprompted
or stored). `deriveFromXpub` round-trips every exported key to the
oracle addresses (20 chains × 4 indexes). Watch-only import
accepts the exported key for every chain — CDP-verified for BTC
zpub, DOGE dpub, Gnosis xpub. Bot needs per chain: BTC zpub
`m/84'/0'/0'`; LTC Ltub `m/84'/2'/0'`; DOGE dpub `m/44'/3'/0'`;
TRX + all EVM xpub `m/44'/60'/0'` (EVM xpubs byte-identical to
ETH's); TON/SOL: the address itself, one per wallet. Fixes: DOGE
dpub accepted (Wallet Core emits dpub, import only allowed dgub,
so the wallet rejected its own export); the hard-coded
"Account 01" header now follows the selected account; export rows
crashed Wallets on a missing address list (now guarded).
12/15-word restores verified, second account gives different
addresses, rotation changes the Receive address. Limits:
old-address balance/history after rotation not verified live (RPC
429s); 18/21-word phrases not exercised; `derive.js` still
BTC/ETH/TRX-only. Owner decisions: SOL multi-address (path
ignores account/index by design); TON one address by design; bot
must use shared `m/44'/60'` for CELO, not SLIP-44 527; LTC zpub
intentionally still rejected.

### Lane D — multichain start to finish (commit `b29932b`)

One continuous journey on mobile (390) and desktop (1440/1919),
screenshots at every stage: create works; dashboard settles 43
rows in 5 s when healthy, degrades to 41 zero + "$0.00 (Partial)"
under the 429 storm; asset detail all 22 chains; Receive all 22
(BIP-21 verified on BTC); Send BTC/ETH/TRX/TON reaches details
then honest "Amount exceeds available balance" (review/sign NOT
claimed verified — unfunded); other 18 chains honestly blocked
(SOL + Fantom walked fully); watch-only works; history works with
limits; Add Token by contract and by chain works; network
switching both ways, no leakage (devnet `tb1q...` vs mainnet
`bc1q...`, restored exactly); no horizontal overflow anywhere.
The +9 EVM chains genuinely work for derive/balance/receive — not
list-only. One fix: a raw `HTTP 429` on the TRX send fee line now
shows a human sentence (RED→GREEN regression test). Not fixed:
Fantom price always "Price expired" (CoinGecko's Fantom quote
~6.2 h stale vs the 10-min window — owner decision); the 429
retry storm (SoChain DOGE ×1,359, Etherscan ×335–497 per run —
handed to Lane E); ETH history dual state; Networks screen saying
"Mainnet only" directly above the devnet switch; Receive chain
names truncating at 390 (left to protect the locked mobile
layout). Correction: Round 2 "zero scroll" is only partly true
(Send step 1 = 936 px, Receive step 3 = 1,446 px at 390 before
Lane A fixed them).

### Lane E — gap analysis + repos for the guide (commits `b990318`, `68dbe62`)

`docs/GAP-ANALYSIS.md` (1,065 lines, 20 gaps) + gaps 21–24 added
by the coordinator from Lane B (watch-only devnet TON rejection,
faucet retry results, TonCenter 429 measurements, result-screen
copy tension). Every gap names the public repos that solve it
(stars and licences checked live 2026-11-23) and where the fix
belongs in the guide. Also FIXED the E2E harness (gap 4): root-base
`build:e2e` + `preview:e2e`, CI wired to it, Playwright config
reads `E2E_PORT` so a shared machine cannot silently test another
lane's build. Proof: 18/24 passed on the root-base build, all 7
failing tests re-ran individually to green; no fresh full-suite
run after the last fix, recorded honestly. Key research
corrections: Blockscout is not dead (`eth.blockscout.com`
answers); the E2E failure was the route, not the assets;
Blockchair is CORS-friendly but this VM's egress IP is already
blacklisted by it (error 430); BlueWallet's rate-freshness rule is
30 min fresh / 31 min outdated vs Bawa's 10-min window.

## Merges

- `9fa1df6` — devnet-temp merged into the programme branch (1
  conflict, `docs/DECISIONS.md`: devnet side added nothing in that
  hunk, kept the token-discovery record).
- `53e6e24` — token-gaps `71326e1` (reverify-pro) merged in, clean.
- Lane cherry-picks, all clean except one: C `e3a9318` →
  `4d12c6c`; A `7167e0a` → `f7693c7`, `699f874` → `4a9dfea`
  (header fix composed with Lane C's — both headers now use
  `accountName(vaultAccount.account)`); B `7b6e4c0` → `dc4ceec`;
  D `b29932b` → `a194982`; E `b990318` → `c64db66`, `68dbe62` →
  `9f11417` (1 conflict, `docs/index.md`: kept reverify-pro's two
  entries plus Lane E's gap-analysis entry).
- Coordinator follow-up: Lane B gaps 21–24 appended to
  `docs/GAP-ANALYSIS.md`, "Awaiting Lane B input" closed.

## Gates (merged tree, run by the coordinator first-hand)

- `tsc --noEmit`: 0 errors. Build: pass (palette audit passed).
  Vitest: **91 files, 1,738 passed / 5 skipped, 0 failed**.
  ESLint: 0. `npm audit`: **0 vulnerabilities**. Root suite
  (`npm test`): exit 0 after `npm ci` in `tools/hdwallet-gen`
  (before it, `MODULE_NOT_FOUND` for `@trustwallet/wallet-core`
  — the known fresh-worktree environment gap, not a code
  failure). E2E on the root-base build (Lane E harness,
  `build:e2e` + `preview:e2e`, port 4221): **23/24 passed** in
  the full run; the 1 failure (Jetton MY, TonAPI price) passed
  in 3.1 s on an isolated re-run — live-network pressure on the
  shared egress, not a code defect. 24/24 across runs.

## Preview

- Fresh preview (hash-verified by the coordinator just now, both
  roots 200 at `/bawa/`): primary
  https://fktri-2a04-4e41-8-9c4--bbb8-9c4.run.pinggy-free.link/bawa/
  — alt
  https://bdtev-2a04-4e41-8-9c4--bbb8-9c4.free.pinggy.net/bawa/
  (use the alt — the `.run.pinggy-free.link` domain resolves
  IPv6-only and the owner's DNS cannot resolve it). Live until
  ~15:45 IST (free tunnel, ~60 min from mint). Served JS
  `index-BjMt1q_R.js` sha256
  `d9a65a40b9c1974c21121f085b8a077504df2cf35e09ce46d31549dd80665ca7`
  — matches the dist build exactly. Served from gray-pinee :4261
  (static server with SPA fallback) via a sandbox socat bridge,
  tunnel minted from the sandbox through the proxy forwarder.

## Still open (owner decisions)

1. Faucets: complete the captchas in the owner's own browser
   (wallet-A addresses in the Lane B report) — until then
   BTC/ETH/TRX stay NOT PROVEN on devnet.
2. TonCenter keyed key (or accept off-peak retries) for reliable
   devnet TON testing.
3. Watch-only in devnet mode: thread devnet through validation +
   derivation + balance adapters, or keep mainnet-only and accept
   the devnet watch row untestable.
4. DOGE second CORS-friendly source (Blockchair with a key, or
   accept the outage when SoChain is rate-limited).
5. Fantom price: widen the freshness window, switch source or id,
   or reword "Price expired".
6. Receive details full no-scroll: smaller buttons (tap-target
   trade-off) or top-stack rework.
7. ETH history dual state: pick which state wins.
8. Networks "Mainnet only" copy above the devnet switch.
9. The four Lane C derivation decisions to confirm as final
   (SOL multi-address, TON one address, CELO shared path, LTC
   zpub rejection).
10. Etherscan key vs another indexer for EVM history; E1
    renewal/removal by 2027-02-20.
11. Review/sign steps CDP-unverified (vitest-covered only);
    live-camera scan unverified (needs the owner's phone);
    non-zero DOGE watch-row render unproven; 1919
    settled-dashboard widths not captured.

## Programme record

`/home/boxd/workspace/bawa-deep-audit/` on gray-pinee
(`PROGRAMME.md`, `LANE-A/B/C/D/E-REPORT.md`, `cdp/`). Lane
worktrees `bawa-deep-audit-a/b/c/d/e-worktree` (detached HEADs,
commits as above).
