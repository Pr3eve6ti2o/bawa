# Bawa wallet-panel rebuild — final implementation report (§7)

- **Branch:** `panel-rebuild/final-report` (worktree `/home/boxd/workspace/bawa-panel-rebuild/final-report/`, on muse-vm)
- **Base commit:** `ebb30b2` — Fix Lane 3 close-out ("Lane 3 p15: Phase 4+5 evidence + layout-correctness test (close-out)"), confirmed by `git log --oneline -1` before starting
- **Date:** 2026-11-19
- **Model:** gpt-6.1-sol, API 1 only — **this lane made 0 Sol calls** (hands-on assembly only; no model call was needed)
- **Status:** local commit only, **never pushed**
- **Governing orders:** owner order 2026-11-18 ~18:22 IST (rebuild), mandatory correction 2026-11-18 ~18:35 IST (§1–§7), owner order 2026-11-19 ~04:20 IST (parallelise; assemble the final report once the verification lanes report)

This report assembles the whole programme from the evidence files read first-hand on the VM: `apps/web/REBUILD-EVIDENCE.md` (Fix Lane 3's tip, 590 lines), the six verification reports (VERIFY-A…F), the research report (`panel-rebuild/research`, 504 lines), the SDK pick (`panel-rebuild/sdk-pick`, 286 lines), the UI/UX reference (`panel-rebuild/ui-ux`, 670 lines), and the lane RUN-LOGs. Nothing in this report is copied from a number I did not see in one of those files, in a `git log`, or in a command I ran myself in the final-report worktree.

## 1. What was rebuilt

### 1.1 The diagnosis (research lane, confirmed first-hand at `0759a81`)

The panel the owner judged "serious slop" was a watch-only mock, not a wallet (research report §0, all paths under `apps/web/`):

1. **No wallet creation.** `create-wallet.tsx` said outright that no mnemonic is ever generated and the user must run `tools/make_wallet.py` outside the browser and import the xpub.
2. **Fake balances.** `demo-fixtures.ts` showed a hardcoded total of `$12,480.62` plus per-asset fake values (`$5,180` / `$4,240` / `$2,060`), presented as the balance, although the file header admitted they were testnet fixtures that "must never be presented as a real balance".
3. **Testnet, not mainnet.** BTC `Testnet4`, ETH `Sepolia`, TRX `Nile`.
4. **Only 3–4 chains**, not a general HD wallet generator.
5. **Send not implemented.** Disabled fieldset, "no signing, broadcast or transaction-construction code".
6. **Receive QR with no wallet** — only an address from an imported watch-only xpub; no address without an import.
7. **Generic dark-navy mock UI** (`bg-[#243454]` cards throughout).

Existing foundation the rebuild extended: `@trustwallet/wallet-core` 4.9.3 already pinned with WASM integrity checks (`scripts/copy-wasm.mjs`, `scripts/wasm-integrity.mjs`); `boundary.ts` already initialised the same WASM object for watch-only derivation; localStorage already held public watch-only data only.

### 1.2 The rebuild, lane by lane (all local commits, none pushed)

| Lane | Branch | Tip | What it changed |
|---|---|---|---|
| Research | `panel-rebuild/research` | `57a6d37` | §1 best maintained/audited/license-compatible wallet-core libs + a complete reference wallet app; per-chain BTC/ETH/TRX/TON implementations; reuse/adapt/implement split. Findings: no separate Trust Wallet HD-generator repo exists (the generator is Wallet Core's WASM `HDWallet` API); the complete reference app is OneKey (O-SSL licensed — architecture reference only, no code copied); BlueWallet is the send/receive/QR workflow reference (Bitcoin only); no perfect AI-agent guide repo exists. |
| PR1 (truth + reproducibility) | `panel-rebuild/pr1-docs` | `f9f2938` | New root README/AGENTS, stop raw prompt retention, `scripts/request-safety.mjs`, build-wallet canary test. 14 files, +963/−180. |
| UI/UX reference | `panel-rebuild/ui-ux` | `2298833` | Wallet-extension UI/UX patterns taken from real extensions: MetaMask, Phantom, Rabby and others — balance, asset list, receive + QR, send + fee preview + confirm, lock/unlock. |
| SDK pick | `panel-rebuild/sdk-pick` | `c91dbf5` | **Trust Wallet Core 4.9.3 WASM `HDWallet` API is the single wallet-generation/signing engine.** Compared against OKX JS Wallet SDK, MetaMask stack, Phantom stack, Rabby stack, BlueWallet stack, OneKey stack — only Wallet Core generates all four chains from one BIP-39 mnemonic through one HD pipeline, Apache-2.0, already vendored. Explicit gap: Wallet Core supplies seed/HD/address/signing ONLY — no balances, RPC, broadcast or history; per-chain adapters cover network ops. |
| Fix Lane 1 — vault + wallet creation (Phases 0+1) | `panel-rebuild/fix-vault` | `057655b` | Capability registry `chains.ts` (derive/restore/receive verified, the rest blocked, Solana `unsupported`); `core.ts` (CSPRNG 24-word creation, restore, derivation, `withSigningKey`); `vault.ts` (WebCrypto AES-256-GCM + PBKDF2-HMAC-SHA256 600,000 iterations, 16-byte salt, 12-byte IV; encrypted envelope in localStorage, never a plaintext secret); create/import/backup screens with recovery confirmation; `demo-fixtures.ts` emptied to zero entries; `providers.ts` types + registry; context gains `vaultState`, `vaultAddresses`, `balances` (loading/zero/available/unavailable/error). **191 tests, all pass.** |
| Fix Lane 2 — balances/history + receive/QR (Phases 2+3) | `panel-rebuild/fix-adapters` | `fe6fd76` | Real mainnet adapters (BTC mempool.space, ETH viem/publicnode RPC + Blockscout history, TRX TronGrid, TON TonCenter JSON-RPC); dashboard/asset list/detail/history on real balances; receive + QR + standalone QR scanner; capability registry wired; **`demo-fixtures.ts` deleted**; mainnet-only copy. **281 tests, all pass.** |
| Fix Lane 3 — send + layout page (Phases 4+5) | `panel-rebuild/fix-send-ui` | `ebb30b2` | `send.ts` (recipient validation, amount + fee preview, offline signing for all four chains via Wallet Core `AnySigner`, broadcast stub that always returns disabled); send flow screens (chain → recipient → amount/fees → review → offline sign → result); transaction detail; layout page (Mainnet header chip, balance hero, Send/Receive/Activity actions, asset rows, Tokens/Activity tabs, `/lock` screen, welcome + security-settings rewrites); BIP-39 passphrase UI; indexed accounts (`deriveAddressesAt`). **347 tests, all pass.** |

Net effect against the diagnosis: the panel now creates a real 24-word BIP-39 wallet in the browser, stores it in a password-encrypted vault, derives real mainnet addresses on four chains, shows real read-only balances and history, generates real receive QR codes, and signs sends offline — with broadcast disabled and no fake money anywhere.

## 2. §6 verification evidence, item by item

All six verification lanes ran hands-on (0 Sol calls between them), each on its own branch off Fix Lane 2 at `fe6fd76`, each verified by `git log --oneline -1` before starting, all on Node v22.23.4 via nvm (the repo enforces `>=22 <23`; the VM default v24.22.2 fails `npm ci` with EBADENGINE).

### Item 1 — Wallet creation (fresh mnemonic, CSPRNG entropy) — PASS

- **Verified on:** `panel-rebuild/verify-derive` (`ebde1ed`, VERIFY-B-DERIVE.md); `core.test.ts` 10/10.
- Fresh disposable 24-word BIP-39 mnemonic from 256 bits of `crypto.randomBytes` via `HDWallet.createWithEntropy(entropy, "")`; `Mnemonic.isValid` true. Mainnet addresses derived from it (public only): BTC `bc1q3kaegfvl66t4v92pn0naxu5mrxt6ategdj8phl` (m/84'/0'/0'/0/0), ETH `0x6b15599B8849D046df7f566522a27eEFdBF2f7De` (m/44'/60'/0'/0/0), TRX `TMPw7BSyK2Rtbc1HbFv9GbTKdDj55jdySW` (m/44'/195'/0'/0/0), TON `UQACGsZERPoiOILkDMyfTv1GK7Q5OeHuNc2Pe0uYTlmz57XL` (m/44'/607'/0'). All four pass `CoinTypeExt.validate`. The mnemonic was never printed, logged, committed or funded.

### Item 2 — Recovery with identical addresses — PASS

- **Verified on:** `panel-rebuild/verify-derive` (`ebde1ed`).
- The same disposable mnemonic restored with a fresh `HDWallet.createWithMnemonic(mnemonic, "")` derives byte-identical addresses on all four chains plus TRX index 1 (`TVBATvtQfpWM4o9ykQZNQ51m7wwnohFMh5`) — all five values identical between creation and recovery runs.

### Item 3 — Correct chain-specific derivation vs published fixtures — PASS

- **Verified on:** `panel-rebuild/verify-derive` (`ebde1ed`); `core.test.ts` + `chains.test.ts` 27/27.
- Fixture mnemonic is the published TREZOR BIP-39 vector already committed in the repo (`tools/hdwallet-gen/generate.js` `VEC_MNEMONIC`, 15 words). All values derived first-hand: BTC idx 0 `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`; ETH idx 0 `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`; ETH with passphrase `TREZOR` `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979`; TRX idx 0 `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`; TRX idx 1 via xpub `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B`; TON (V4 R2, wallet ID 698983191) `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`. Three further xpub-derived cross-checks match, and the TRX/ETH/BTC xpubs derived from the fixture mnemonic are exactly the xpub/zpub fixtures in `core.test.ts`.
- Paths pinned and asserted: BTC m/84'/0'/0'/0/0, ETH m/44'/60'/0'/0/0, TRX m/44'/195'/0'/0/0, TON m/44'/607'/0' (fully hardened, no index suffix).

### Item 4 — Valid mainnet addresses (format + checksum) — PASS

- **Verified on:** `panel-rebuild/verify-addrs` (`f1d4c61`, VERIFY-C-ADDRS.md).
- Three independent checks per address: Wallet Core `CoinTypeExt.validate` (4.9.3), independent format checks (Bech32 polymod for BTC, viem `getAddress` EIP-55 for ETH, Base58Check + double-SHA-256 for TRX, TON friendly-address decode + CRC16-XMODEM + tag/workchain bytes), and the repo's own `validateDestination` / `validateTonAddress`. Every listed address passes all three; a fresh disposable mnemonic's four addresses pass too (BTC `bc1qha27sdanjws7tjt0eu099pya4zt3mhjtgyppxw`, ETH `0x7637492856b8bFE2848C90C04d14B6800A697E0d`, TRX `TUSTJe4ka2LTyDGkCRjg2B6un2HsptjSLG`, TON `UQDeIhJnChxHLEfTl7RgeWBiZ-qwZaVqbbTYW67V1oDmRB7D`).
- Negative controls prove the validators are not vacuous: mutated BTC/TRX/TON last characters rejected; `tb1q` testnet form rejected as `wrong-network`; mutated ETH rejected by the repo validator (`invalid-checksum`) and by viem, even though wallet-core `validate` alone passes it (format-only, no EIP-55 enforcement — recorded as a validator limitation, not an address defect); testnet-flagged TON rejected as `wrong-network`.
- Correction recorded by the lane: the brief's "TON UQ, bounceable" is wrong — `UQ` (tag `0x51`) is the **non-bounceable** form; `EQ` is bounceable. The listed TON address is a valid mainnet, workchain-0, non-bounceable UQ address.
- Vitest: `src/wallet` 12 files / 105 tests pass; `src/engine` destination + boundary + boundary-retry 3 files / 68 tests pass.

### Item 5 — Accurate read-only mainnet balances + tx history — PASS

- **Verified on:** `panel-rebuild/verify-balances` (`bd26f82`, VERIFY-D-BALANCES.md); also Fix Lane 2's live check (4/4 in 4.31 s).
- All four fixture addresses are exact-zero balances, confirmed as data by two sources each — not failed fetches: BTC 0 sats (mempool.space funded 311775 − spent 311775, tx_count 32; blockstream.info agrees exactly); ETH 0 wei (publicnode `eth_getBalance` `0x0`; Blockscout `"result":"0"`); TRX 0 SUN (TronGrid `/v1/accounts`, no `balance` field; second endpoint `/wallet/getaccount` agrees — see the weaker-independence limitation below); TON 0 nanoTON (TonCenter `getAddressBalance` `"0"`; tonapi.io `"balance":0`, status `active`).
- History through the real adapter code: BTC 25 real txs (sample hash `6d2e9737…` verified on blockstream.info); ETH 20 real txs (sample `0x0cf75c8f…` verified on Blockscout); TRX 0 native transfers — honest empty, because the adapter covers native `TransferContract` only and this address's 45 txs contain only 2 native ones (both Sep 2021, outside the most-recent-20 window; verified against TronScan API); TON 2 real txs (first hash `088cbcac…` matches tonapi.io's event exactly).
- Zero vs unavailable/error: `wallet-context.tsx` maps `ok` + `'0'` → `zero`, failures → `unavailable`/`error`, never zero. Forced-failure run (adapters pointed at unreachable `https://127.0.0.1:9`) returns `error` on all four chains — never rendered as zero.
- Vitest: adapter suite 49/49 (5 files).
- Limitations (recorded, not failures): TRX second source is weaker (TronScan API now returns HTTP 401, apparently requiring a key; the cross-check fell back to TronGrid's second endpoint — same provider); TON history first attempt hit TonCenter HTTP 429 (free-tier burst throttle; one re-attempt after a 60 s pause succeeded — the adapter correctly reported `error`, never fake or empty data); no live non-zero balance was checked (all fixture addresses are exact-zero; non-zero rendering is covered by stubbed unit tests, e.g. 1.5 ETH renders "1.5 ETH"); `toBalanceProvider` in `adapters/types.ts` maps a non-`ok` history result to `[]`, swallowing the error on the legacy `BalanceProvider` path (the live UI path does not use that wrapper and preserves the error).

### Item 6 — Offline transaction construction, signing + verification — PASS (with the boundary in §3)

- **Verified on:** `panel-rebuild/verify-sign` (`6aa5933`, VERIFY-E-SIGN.md) — through the repo's offline tooling; **and** Fix Lane 3's in-app probes (see §3).
- Lane E runner (`tools/verify-sign/run-verify-sign.mjs`, committed, offline-only, exit 0): fresh 24-word CSPRNG mnemonic, fresh keys, amounts/fees/nonce/seqno different from the repo fixtures. All four chains PASS, preflight 11/11 each (`ISOLATION, NETWORK, DESTINATION, AMOUNT, FEE, CHANGE, NONCE-SEQUENCE-EXPIRY, REPLAY, SIGNED-MATCHES-APPROVED, SIGNATURE-VALID, NO-BROADCAST`):
  - **BTC:** signed offline via `AnySigner` (P2WPKH, BIP-143 verifies); 1 synthetic UTXO 50,000 sats → 30,000 sats to `bc1qpsp72…`, 19,718 change, fee 282 sats (= 2 sat/vB × 141 vB); decoded outputs match the unsigned artifact. Baseline repo suite `tests/mainnet-signing.test.mjs` 19/19.
  - **ETH:** EIP-1559, chainId 1, nonce 7, 0.0025 ETH to `0xA3Dcd899…`, gas 21,000, 30/2 gwei; ecrecover sender `0x041b71f8…` equals the signer; decoded chain/to/amount/fees match.
  - **TRX:** 2.5 TRX to `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`; secp256k1 recovery matches the owner; txID `b6d1f890…` recomputes as SHA-256 of the signed raw_data; decoded owner/to/amount/timestamps match.
  - **TON:** V4 R2, 0.12 TON, seqno 5; Ed25519 verifies; normalised signing hash `e764975c…` equals the unsigned artifact's signing hash exactly.
- Documented deviations (pre-existing, in the modules): wallet-core emits BTC version 1 while the unsigned artifact is version 2 (signature valid for the signed tx as-is); TRON `ref_block_hash` differs from the fixture (signer derives it as SHA-256 of the BlockHeader protobuf); TON signing hash differs from the unsigned artifact because the signer attaches an empty body cell (normalised hash matches).
- What it does NOT prove: no balance, unspentness (BTC UTXO is synthetic), current nonce/seqno, block freshness or executability — offline cryptographic success proves none of those. No broadcast anywhere: `assertNoNetworkCapability()` true, no network import/fetch/broadcast in the signing module, preflight check 11 passes for every chain.

### Item 7 — No demo balances or fake transaction data — PASS (at `ebb30b2`)

- **Verified on:** Fix Lane 2 (`fe6fd76`) + Fix Lane 3 (`ebb30b2`); re-checked first-hand in this lane (see below).
- `demo-fixtures.ts` deleted (Lane 2, commit `87c4ab2`); grep at Lane 3 time: `demo-fixtures` 0, `$12,480` 0, `Testnet4` 0, `Sepolia` 0, `Nile` 0, `TESTNET` 0 in `apps/web/src`. Test guards assert no `$` amount appears in the rendered balance screens.
- Re-checked first-hand in this lane's worktree (at `ebb30b2`): `grep -rn "demo-fixtures\|TESTNET" apps/web/src/` returns exactly one hit — `dashboard.test.tsx:297`, a test asserting the rendered text does NOT contain `TESTNET`. No demo/fake data remains in source.
- No price feed exists anywhere: no fiat totals; the dashboard states "Portfolio total unavailable — no price feed connected" and the hero shows an honest `$0.00` all-zero state. No NFTs tab, no Swap/Buy — omitted, not faked.

### Item 8 — No private keys or mnemonics in requests, logs or plaintext storage — PASS

- **Verified on:** `panel-rebuild/verify-secrets` (`0577b1a`, VERIFY-F-SECRETS.md, 602 lines).
- Source grep (`mnemonic|seed|privateKey|private_key|xprv|secret` over `apps/web/src/`): **196 hits in 24 files, every one classified, zero leaks.** Classes: (a) doc comment / UI copy / identifier stating the no-secrets policy; (b) in-memory-only holder, never persisted, logged or sent. The mnemonic exists in memory in exactly two places: React local state in `create-wallet.tsx` / `import-wallet.tsx` (cleared on unmount, on error, and on success) and the vault module closure while unlocked (dropped by `lock()`). The whole network layer (adapters) contains no secret-pattern hit at all.
- Network: exactly one `fetch` site (`fetchJson` in `adapters/types.ts:104`, single-attempt, 10 s timeout) plus the viem public client for ETH balance/nonce. Every request sends public addresses only (or nothing); adapter signatures take only `address` + `limit`. All four adapters' `broadcast()` throws `BROADCAST_DISABLED_MESSAGE`.
- Storage: three localStorage keys only — `bawa-vault` (AES-256-GCM ciphertext envelope: version, PBKDF2 600k / SHA-256 params, salt, IV, ciphertext, profileIds), `bawa-watch-only-xpubs` (public xpubs + labels, max 40 chars), `token-ui-theme` (`light`/`dark`). Zero `sessionStorage` use. The vault test "stores only an encrypted envelope, never plaintext secrets" passes 10/10 (`vault.test.ts`), asserting the raw stored string contains neither the test mnemonic words nor the test password.
- Build output: the production bundle contains no test-mnemonic phrase and no test password (checked by a script that reads the values from the test file without printing them); `abandon` appears once in `dist/wallet-core.wasm` only as part of the embedded BIP-39 English wordlist; `about` once in JS as the `about:` URL scheme. The remaining `privateKey`/`mnemonic`/`seed`/`secret` strings in the bundle are library identifiers and UI copy, never values.
- Logs: zero `console.*` calls in non-test `apps/web/src/wallet/`, `screens/`, `state/`, `app/`, `engine/`. Clipboard use is public-address only.
- Caveats recorded by the lane (not leaks): the 40-char label bound is a bound, not a guarantee — a shorter complete secret (e.g. a 23-char Chinese mnemonic, a 40-char Z85 key) or a fragment could still fit in a label (mitigated by secret-like input rejection in `boundary.ts`); and at `fe6fd76`, `withSigningKey` had no production caller — its only caller was `core.test.ts:178`. That second caveat is **closed at `ebb30b2`** — see §3.

### Item 9 — Build, tests, typecheck — PASS

- **Verified on:** `panel-rebuild/verify-build` (`421acad`, VERIFY-A-BUILD.md) at `fe6fd76`; and Fix Lane 3 at `ebb30b2` (REBUILD-EVIDENCE.md).
- Lane A (at `fe6fd76`): `npm ci` 275 packages, 0 vulnerabilities; `npx tsc --noEmit` exit 0 (empty output); `npm test` **281/281 pass, 29 files, 0 failed, 0 skipped, 9.78 s**; `npm run build` exit 0, built in 6.10 s (vite 8.3.8, 3,082 modules; `dist/index.html`, `dist/wallet-core.wasm`, `dist/assets/index-CJOXFLgY.js`, CSS 473.41 kB / gzip 171.75 kB); `npm audit` 0 vulnerabilities. The two `Aborted(…)` stderr lines are the expected TRX-33-byte / BTC-65-byte abort probes inside tests that pass by design.
- Lane 3 (at `ebb30b2`): `npx tsc --noEmit` exit 0; `npx vitest run` **347/347 pass**; `npm run build` exit 0, built in 2.22 s. Advisory only: chunk-size warning (single JS chunk 3,595.96 kB, gzip 500.37 kB at Lane A; 3,770.40 kB at Lane 3 — code-splitting not done).
- Re-run in this lane's worktree (`panel-rebuild/final-report`, at `ebb30b2` + this report file only, Node v22.23.4, 2026-11-19 ~05:08 IST): `npm ci` 275 packages, 0 vulnerabilities, 10 s; `npx tsc --noEmit` exit 0; `npx vitest run` **347/347 pass, 36 files, 0 failed, 11.58 s**; `npm run build` exit 0, built in 6.04 s (JS `index-CnXeIIbT.js` 3,772.36 kB / gzip 561.56 kB; CSS 478.07 kB / gzip 172.92 kB; `dist/wallet-core.wasm` sha256 `13a18a38…77217`, matching the pinned 4.9.3 hash). The full log is `/tmp/final-report-build.log` on muse-vm.

## 3. The honest boundary — signing inside the app vs through repo tooling

This is the one place where the §6 evidence must be read carefully, because the two halves were verified on different trees.

**At `fe6fd76` (the tree all six verification lanes verified), the app had no signing path.** Lane E states it plainly: `apps/web/src/wallet/chains.ts` marked `local-sign` and `post-sign-verify` as `blocked` for all four chains, there was **no `AnySigner` reference anywhere in `apps/web/src/`**, and the only signing-adjacent code was `withSigningKey` in `core.ts`, which hands private-key bytes to a callback but constructs no transaction and signs nothing. Lane F adds that `withSigningKey` had no production caller there (only `core.test.ts:178`) and `send.tsx` was a disabled stub. Lane E's §6-item-6 PASS therefore covers offline construction + signing + independent verification **through the repo's own offline tooling** (`tools/mainnet-tx/unsigned-tx.mjs` and `tools/mainnet-signing/local-signing.mjs`, Wallet Core 4.9.3 `AnySigner`, independent verification with own secp256k1/keccak256 code, Node Ed25519 and own BOC parsing for TON) — **not** signing inside `apps/web`.

**Fix Lane 3 (`ebb30b2`) is the work that wires signing into the app.** Verified first-hand in this lane's worktree (at `ebb30b2`, by reading the code, not by taking the evidence file's word):

- `src/wallet/send.ts` (new) calls `core.AnySigner.plan` / `core.AnySigner.sign` for all four chains: BTC plan + sign (lines ~147, ~569, ~578), ETH sign (~389), TRX sign (~764), TON sign (~873). `chains.ts` now marks `unsigned-plan` and `local-sign` as **verified** for all four chains (via `send.test.ts` + the AnySigner probes, no broadcast), and `post-sign-verify` as verified for BTC/ETH/TRX and still **blocked for TON** (the signed BOC is not re-parsed — no BOC parser vendored).
- `withSigningKey` now HAS production callers: `send.ts:360` (ETH), `:531` (BTC), `:727` (TRX). The Lane F caveat is closed for those three chains. TON is the exception by design: `signTonOffline` (~801–873) uses the `HDWallet` directly instead of `withSigningKey`, because TON needs the Ed25519 public key from the same key object as the seed and `withSigningKey` yields seed bytes only. The seed view is zero-filled after signing and the wallet/key objects deleted.
- Lane 3's in-app probes (disposable fresh mnemonics, `/tmp` scripts on muse-vm, no broadcast): ETH `AnySigner.sign` error 0, 109-byte encoding, sender recovered via `serializeTransaction` + `keccak256` + `recoverAddress` equals `getAddressForCoin` exactly; BTC plan error 0, fee 1,410 sats for the 1-in/2-out fixture (100,000 − 50,000 − 1,410 = 48,590 change), sign no error, 223 bytes, outputs verified; TRX no error, 65-byte signature, 32-byte id, sha256 of raw_data_hex equals the output id, signature recovers to the owner; TON no error, 32-byte hash, BOC magic `b5ee9c72`, 965-byte BOC, mode 3, V4R2, expireAt now+600 s. Two real bugs found and fixed hands-on during the lane: Sol called `key.data()` on bytes already passed raw (the WASM-memory view must be used before the wallet/key is deleted — the first probe failed with error 15 for exactly this), and the BTC outpoint byte-order probe (proto `outPoint.hash` is serialised/internal order, so a display-order txid from the adapter must be reversed first).
- `send.test.ts` covers validate/preview/sign/broadcast-stub per chain (25 tests); the BTC preview test asserts fee `1410`, total `51410` at 10 sat/vB from the live UTXO set. `broadcastSigned` always returns disabled; `markBroadcastUnknown` keeps an unknown outcome unresolved — never resend or compose a replacement without independent reconciliation. The send UI signs offline and stops there, stating "Send signed — not broadcast". The UI never presents send as working.
- What Lane 3 did **not** wire in: TON `post-sign-verify` (partial — no-error + 32-byte hash + BOC magic only, no BOC re-parse); TON `fee-quote` (still blocked — send preview for TON reports unavailable; signing still works with a seqno); broadcast anywhere (disabled in every adapter and in `broadcastSigned`); the auto-lock timer (see §4).

So the accurate statement is: **offline signing is verified twice — cryptographically through the repo's offline tooling with independent verification (Lane E, all four chains, preflight 11/11), and functionally inside `apps/web` through Lane 3's `send.ts` AnySigner paths with probe-verified outputs (all four chains sign; BTC/ETH/TRX post-sign-verify wired, TON partial). What is NOT verified is an end-to-end in-app send to a live network, because broadcast is disabled by design and was never exercised.**

## 4. Remaining risks and open items (consolidated from all lanes)

1. **Auto-lock timer not implemented.** The `/lock` screen exists as a route; settings `autoLockMinutes` + an inactivity timer calling `lockVault()` is designed but not built. Mitigation in place: closing the tab drops the in-memory vault key, so the vault starts locked on reload.
2. **TON fee-quote blocked.** Send preview for TON reports unavailable; signing still works with a seqno. No fee is invented.
3. **TON post-sign-verify partial.** No BOC re-parse (no parser vendored); verification is no-error + 32-byte hash + BOC magic. Lane E's independent TON verification (own BOC parsing) covers the cryptography through repo tooling, not inside the app.
4. **BTC UTXOs assumed to belong to the from address (P2WPKH).** Valid here since the wallet only receives at its own account address; a UTXO at another address would fail signing.
5. **No price feed (no fiat totals).** The dashboard states the total is unavailable; the hero shows an honest `$0.00` all-zero state. This is a missing feature, stated, not a fake number.
6. **No NFTs / Swap / Buy.** Omitted, not faked. No engine or on-ramp exists.
7. **TRX index-1 HDWallet-path address does not match the published xpub fixture.** The HDWallet-path index-1 TRX address differs from the xpub-derived `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` (Lane B confirmed the xpub route *does* match the fixture). No test asserts the xpub fixture for the HDWallet path. Unresolved discrepancy, recorded, not claimed.
8. **TRX 33-byte WASM abort persists on 4.9.3.** A 33-byte compressed TRX pubkey passed to `deriveAddressFromPublicKey` aborts the WASM runtime (`Aborted(Assertion failed: Exception thrown, but exception catching is not enabled…)`), re-confirmed first-hand by Lanes B, C and E. The 65-byte uncompressed path works; `derive.js` uses JS-first decompression / the xpub route. Do not call `deriveAddressFromPublicKey` for TRON with a private-key-derived compressed pubkey. The per-chain pubkey rule is: BTC 33-byte compressed, ETH/TRX 65-byte uncompressed, TON Ed25519 — forcing the wrong form aborts (proven by `core.test.ts` raw-WASM tests).
9. **TRX second balance source weaker.** TronScan API now returns HTTP 401 (apparently key-gated); the TRX balance cross-check fell back to TronGrid's second endpoint — same provider, weaker independence.
10. **TON history can 429 under burst load.** TonCenter free-tier throttle; the adapter correctly reports `error`, never fake or empty data. One re-attempt after a 60 s pause succeeded.
11. **No live non-zero balance checked.** All four fixture addresses are exact-zero. Non-zero rendering is covered by stubbed unit tests only (e.g. 1.5 ETH renders "1.5 ETH"). A funded public address would be needed to close this; none was used.
12. **QR decode check used generated PNGs, not the rendered `qrcode.react` SVG.** 5/5 payloads decode byte-exactly with jsqr 1.4.0 (ETH address, BTC payment URI, ETH payment URI, TRX address, TON address), but the SVG path data itself is not decodable by jsQR. The screen's `qrValue` equals the address (or payment URI when an amount is set) by construction.
13. **3.6 MB single JS chunk (code-splitting not done).** Vite chunk-size warning at every build (3,595.96 kB, gzip 500.37 kB at Lane A; 3,770.40 kB at Lane 3). Wallet Core WASM + viem in one chunk. Performance note, not a §6 failure.
14. **`withSigningKey` had no production caller in the `fe6fd76` tree** (send is Lane 3's work) — **closed at `ebb30b2`** (§3). Listed here because Lane F recorded it and the closure is part of this report's evidence.
15. **The 40-char label bound is not a guarantee against short secret fragments.** A shorter complete secret (e.g. a 23-char Chinese mnemonic, a 40-char Z85 key) or a fragment could still fit in a watch-only label. Mitigations present: watch-only import rejects secret-like input (`boundary.ts`), and an over-long stored label is restored as `''` and overwritten. No secret was found stored.
16. **Wallet-core `validate` alone does not prove checksum or network for ETH/TON** (Lane C, note 2). A one-char-mutated ETH address still passes `CoinTypeExt.validate` (format-only, no EIP-55 enforcement), and a testnet-flagged TON address also passes it. The checksum/mainnet proof for those chains rests on the additional checks (viem `getAddress` equality; repo `validateDestination` `verified` / `wrong-network`), which all pass. Address strings alone cannot prove the network for TRX/ETH either (TRON testnets share the `0x41` prefix; an ETH address is identical on every EVM chain) — the network comes from the configured endpoint / chainId 1.
17. **BTC precision above `Number.MAX_SAFE_INTEGER`.** Balances use JSON numbers (`funded_txo_sum`/`spent_txo_sum`) via `BigInt(Math.trunc(...))`; a documented limitation in `btc.ts`. Fixture values (311775) are far below it.
18. **Legacy `toBalanceProvider` swallows history errors** (Lane D, observation 5). A non-`ok` history result maps to `[]` on the legacy path. The live UI path (`wallet-context.tsx` `refreshHistory` via `getAdapter`) does not use that wrapper and preserves `unavailable`/`error`, so this does not affect what the user sees.
19. **No published audit of the 4.9.3 WASM artifact exists** (only the 2023 Trust Wallet code review). The research lane flags checking 4.9.3 advisories before production. Upstream links in the research are to moving branches unless a commit is pinned.
20. **TRX has no on-chain chain-id**; identity rests on the pinned mainnet endpoint (TronGrid `getnowblock` > 0). TronScan is used only as an explorer link, never as a provider.
21. **The temporary live-check and probe scripts live in `/tmp` on muse-vm (ephemeral).** Their outputs are the recorded evidence in the lane reports, not permanent tests — the suite stays offline-deterministic. Re-running them needs fresh scripts.
22. **The app's own CSP blocks live adapter fetches in a served browser preview.** `src/app/security-headers.ts` sets `connect-src 'self'` (comment: "the only fetch is the same-origin wallet-core.wasm"), injected into `dist/index.html` at build time — but the balance/history adapters fetch four external provider origins from the browser. In the §7 preview, balances/history therefore surface as unavailable/error, never live values. The Lane D evidence (§2 item 5) was gathered in Node, where no CSP applies; no lane verified balances inside a real browser. Widening `connect-src` to the four pinned provider origins (mempool.space, ethereum-rpc.publicnode.com, api.trongrid.io, toncenter.com) is a code change for a later lane — not done here. Wallet creation, receive/QR and offline signing are all local and unaffected.

## 5. Security limitations (Mandatory Correction §4 — absolute)

- **Broadcast DISABLED everywhere until separately authorised.** Every adapter's `broadcast()` throws `BROADCAST_DISABLED_MESSAGE`; `broadcastSigned` in `send.ts` always returns disabled. No transfer, send or broadcast of real cryptocurrency took place during this programme, and none is possible from the built panel.
- **Send signs offline only and says so.** The UI states "Send signed — not broadcast" and never presents send as working. An unknown broadcast outcome stays unresolved; never resend or compose a replacement without independent reconciliation.
- **Disposable test credentials only.** Every fresh mnemonic in every lane was generated once in memory, never funded, never printed/logged/committed/uploaded; key byte arrays were zeroed (`fill(0)`) after use and WASM wallet/key objects deleted. No real user funds, seed phrases or production keys were used at any point. Test files use published, disposable BIP-39 test vectors only.
- **Private keys in memory only while unlocked, zeroed after use.** The mnemonic lives only in the create/import screens' local state during write-down/confirmation and in the vault module closure while unlocked; it is cleared on unmount, on error paths, on lock, and immediately after vault creation. Honest limit, recorded in `vault.ts`: JavaScript strings are immutable, so "zeroing" means dropping every reference on lock — no stronger claim is made. `withSigningKey` hands private-key bytes to a callback only, `bytes.fill(0)` in `finally`, `privateKey.delete()`, `wallet.delete()`.
- **Storage:** the vault envelope in localStorage holds only version, KDF parameters, salt, IV, ciphertext and profileIds — never a plaintext mnemonic, seed, key or password (asserted by test, 10/10). Watch-only storage holds public xpubs/labels only. No `sessionStorage` use. No `console.*` logging in non-test wallet/screen/state/app/engine code.
- **Mainnet only.** Testnet addresses are rejected as `wrong-network`; no testnet adapter exists; the "TESTNET · ACTIVE" header chip is gone (replaced by a "Mainnet" chip).

## 6. Sol call counts and durations per lane

Model gpt-6.1-sol, API 1 only, cap 32,000 max_output_tokens, max reasoning, throughout. A call counts as LANDED only when its output file exists and is non-empty. Durations are from the lane RUN-LOGs (record of truth). The 500-second rule (owner order 2026-11-19 ~02:41 IST) governs every call from that point on: one small focused piece per prompt, never retried as-is after a death/timeout.

| Lane | Made | Landed | Failed / stalled | Durations (landed) |
|---|---|---|---|---|
| Research | 5 | 4 | 1 (call 2, 60-min timeout; content recovered via micro-splits 2b/2c + first-hand verification) | 471,127 ms; 391,073 ms; 574,892 ms; 321,549 ms |
| PR1 | 2 | 2 | 0 | 272 ms; 282 ms (answer 2,326 / 9,321 chars) |
| UI/UX | 5 | 5 | 0 | 59,049 ms; 278,727 ms; 282,682 ms; 543,161 ms; 297,283 ms (call 1b) |
| SDK pick | 5 | 5 | 0 | 352,058 ms; 353,290 ms; 347,460 ms; 364,292 ms; 432,883 ms |
| Fix Lane 1 (vault + creation) | 7 | 1 (call 1c, `core.ts` impl, 8,165 bytes) | 6 — call 1 no delivery (Sol replied it has no tools, wrote nothing); 1b, 2c, 2d, 3d upstream-transient stream errors after ~48–60 min; 4c runner timeout after 60 min | 1c: 1,143,115 ms (~19 min — predates the 500 s rule). Six of seven lane modules were written hands-on from the prompt specs and verified first-hand. |
| Fix Lane 2 (adapters + receive/QR) | 2 | 0 as code | 1 failed (lane2-1, 45 s — refusal: the runner session has no filesystem/shell tools, so Sol asked for files to be pasted); 1 stalled (lane2-1b, still running at 42+ min, no output; never killed) | — (P2–P9b written hands-on; p2–p6 prompts re-split into 77–149-word one-function prompts, none launched — the work was already complete) |
| Fix Lane 3 (send + layout) | 18 | 15 | 3 failed (p7, p9, p13b — each asked for the file contents back because the prompt did not paste the exact current code; all three redone hands-on or with code pasted) | Every landed call under 500 s: 131,765; 136,406; 64,788; 197,439; 29,269; 352,630; 38,307; 367,201; 21,392; 9,066; 445,628; 90,664; 149,890; 192,397; 389,360 ms. Longest: p11b tabs, 445,628 ms. |
| Verification lanes A–F | 0 | 0 | 0 | — (all hands-on) |
| **This lane (final report + preview)** | **0** | **0** | **0** | — (hands-on assembly only) |
| **Programme total** | **44** | **32** | **11 failed + 1 stalled** | |

Notes: no 402/403 occurred anywhere in the programme. The gateway's failure mode in Fix Lanes 1–2 was upstream-transient stream errors and 60-minute timeouts on long prompts, not quota — the fix that worked was micro-splitting prompts to 100–250 words and pasting the exact current code into the prompt. Lane 3's lesson, learned three times (p7, p9, p13b): prompts that do not paste the exact current code fail by asking for the file back.

## 7. Live preview

- **URL (verbatim):** https://vcsyx-67-213-121-219.run.pinggy-free.link
- **What it serves:** the production build from this lane's worktree (`panel-rebuild/final-report` at `ebb30b2` + this report), built 2026-11-19 ~05:08 IST (Node v22.23.4). Served by a minimal static server on muse-vm (`127.0.0.1:8082`, SPA fallback to `index.html`) through a Pinggy free tunnel.
- **Tunnel started:** 2026-11-19 05:12:55 IST. **Expiry: ~06:13 IST the same day (60 minutes, Pinggy free tier).** After that the link dies; put up a fresh one the same way (serve `apps/web/dist`, `ssh -p 443 -R0:127.0.0.1:<port> free.pinggy.io`).
- **Live check (from outside the VM, 2026-11-19 ~05:13 IST):** index `/` → **200**, title **"Bawa Web Wallet"**; JS bundle `/assets/index-CnXeIIbT.js` → **200**; `/wallet-core.wasm` → **200**; SPA route `/lock` → **200**.
- **What the owner can judge from it:** wallet creation + recovery confirmation, the vault lock/unlock flow, the layout page (Mainnet header, hero, Send/Receive/Activity, asset rows, Tokens/Activity tabs), receive + QR, and the offline-sign send flow up to "Send signed — not broadcast".
- **Preview caveat — read before judging balances:** the built panel's own Content Security Policy (`src/app/security-headers.ts`, injected into `dist/index.html` at build time) sets `connect-src 'self'` with the comment "the only fetch is the same-origin wallet-core.wasm". The balance/history adapters fetch mempool.space, publicnode, TronGrid and TonCenter from the browser, so in this served preview those cross-origin fetches are blocked by the app's own CSP and balances/history will show as **unavailable/error — honestly, never zero** — rather than live values. The real balance/history evidence is the Lane D verification (§2 item 5), which ran in Node where no CSP applies; no lane verified balances inside a real browser. This is recorded as open item 22 in §4, not fixed in this lane — widening `connect-src` to the four pinned provider origins is a code change for the owner/coordinator to order.
- **Safety:** the preview serves the built panel only. It creates no wallets on the server, holds no funds, and cannot broadcast anything (broadcast is disabled in the code). Any wallet the owner creates in the preview lives only in their own browser's localStorage (encrypted vault) and is theirs to delete.

## 8. What this report does NOT claim

- It does not claim an end-to-end in-app send to a live network was verified — broadcast is disabled and was never exercised (§3).
- It does not claim a live non-zero balance was ever checked (§4 item 11).
- It does not claim the rendered `qrcode.react` SVG itself was decoded (§4 item 12).
- It does not claim the 4.9.3 WASM artifact is audited (§4 item 19).
- It does not claim the TRX index-1 HDWallet-path discrepancy is resolved (§4 item 7).
- It does not claim the auto-lock timer, TON fee-quote, TON post-sign-verify, price feed, NFTs, Swap or Buy exist — they do not, and the report lists them as open (§4).
- Nothing in this report was pushed. Every branch named here is a local branch on muse-vm; the only commit this lane makes is the report itself, on `panel-rebuild/final-report`, local only.

## Sources (all read first-hand on muse-vm)

- `apps/web/REBUILD-EVIDENCE.md` in this worktree (Fix Lane 3's tip, 590 lines)
- `panel-rebuild/verify-build:apps/web/VERIFY-A-BUILD.md` (`421acad`, 60 lines)
- `panel-rebuild/verify-derive:apps/web/VERIFY-B-DERIVE.md` (`ebde1ed`, 105 lines)
- `panel-rebuild/verify-addrs:apps/web/VERIFY-C-ADDRS.md` (`f1d4c61`, 154 lines)
- `panel-rebuild/verify-balances:apps/web/VERIFY-D-BALANCES.md` (`bd26f82`, 120 lines)
- `panel-rebuild/verify-sign:apps/web/VERIFY-E-SIGN.md` (`6aa5933`, 140 lines)
- `panel-rebuild/verify-secrets:apps/web/VERIFY-F-SECRETS.md` (`0577b1a`, 602 lines)
- `/home/boxd/workspace/bawa-panel-rebuild/research/RESEARCH-REPORT.md` (504 lines) + `RUN-LOG.jsonl`
- `/home/boxd/workspace/bawa-panel-rebuild/sdk-pick/SDK-PICK.md` (286 lines) + `RUN-LOG.jsonl`
- `/home/boxd/workspace/bawa-panel-rebuild/ui-ux/UI-UX-REFERENCE.md` (670 lines) + `RUN-LOG.jsonl`
- `/home/boxd/workspace/bawa-panel-rebuild/pr1-docs/RUN-LOG.jsonl`
- `lane/RUN-LOG.jsonl` in this worktree (combined Fix Lanes 1–3 log, 55 entries)
- First-hand greps in this worktree at `ebb30b2`: `AnySigner` in `apps/web/src` (send.ts only), `withSigningKey` production callers (send.ts:360/531/727), `chains.ts` capability states, `demo-fixtures`/`TESTNET` (one test assertion only)
