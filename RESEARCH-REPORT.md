# Bawa wallet-panel rebuild — RESEARCH-REPORT

- **Lane:** research (`panel-rebuild/research`), worktree off `feature/ai-wallet-builder` at `0759a81`
- **Branch:** `panel-rebuild/research` — local commits only, never pushed
- **Scope:** owner order 2026-11-18 ~18:22 IST + mandatory correction 2026-11-18 ~18:35 IST (§1–§7).
  The correction governs wherever it conflicts with the earlier brief.
- **Method:** Sol (gpt-6.1-sol, API 1 only, cap 32,000, max reasoning) for discovery;
  every repo URL and every file path in this report was then verified first-hand
  by the lane agent (GitHub pages fetched 2026-11-18, crawl timestamps in §9).
  Sol cannot browse live: several of its paths and one licence claim were wrong
  and are corrected here — see §8. Nothing in this report is copied on Sol's
  word alone.
- **Panel source read first-hand:** `apps/web/src/screens/create-wallet.tsx`,
  `send.tsx`, `receive.tsx`, `src/state/demo-fixtures.ts`,
  `src/state/wallet-context.tsx`, `package.json`, `src/engine/boundary.ts`.

## Sol calls (RUN-LOG.jsonl is the record)

| Call | Prompt | Words | Output | Result |
|---|---|---|---|---|
| 1 | Reference repos: Trust Wallet HD generator + production send/receive/QR UI | 250 | `lane/sol1-reference-repos.md` (10,790 B) | Landed, 471,127 ms |
| 2 | §1 supplement (full prompt3) | 235 | — | **FAILED: runner timeout after 3,600,000 ms, no output.** Never retried identically; micro-split per rules |
| 2b | Micro-split: wallet-core libs comparison | 110 | `lane/sol2b-libs.md` (2,690 B) | Landed, 391,073 ms |
| 2c | Micro-split: complete reference app + per-chain + reuse/adapt/implement | 133 | `lane/sol2c-refapp.md` (3,894 B) | Landed, 574,892 ms |
| 3 | AI-agent guide repo | 220 | `lane/sol3-ai-guide.md` (7,792 B) | Landed, 321,549 ms |

Totals: 5 launches, 4 landed, 1 failed (timeout). All on API 1, gpt-6.1-sol.
Two runtime restarts interrupted wait-polls during calls 2b/2c; both calls were
verified alive afterwards and landed — no call was killed, no launch was repeated.

## §0 Diagnosis — confirmed first-hand in this worktree (0759a81)

All paths under `apps/web/`.

1. **No wallet creation.** `src/screens/create-wallet.tsx:26` — "This starter
   cannot create a wallet in the browser — there is no vault design yet, so no
   mnemonic is ever generated or shown here." It only instructs
   `python3 tools/make_wallet.py` outside the browser, then xpub import.
2. **Fake $ balances.** `src/state/demo-fixtures.ts:9` — total `'$12,480.62'`,
   per-asset `$5,180` / `$4,240` / `$2,060`, presented as the balance. The file
   header admits they are "TESTNET FIXTURES for presentation only" and "must
   never be presented as a real balance" — but they are.
3. **Testnet, not mainnet.** `demo-fixtures.ts:28,37,46` — BTC `Testnet4`, ETH
   `Sepolia`, TRX `Nile`.
4. **Only 3–4 chains.** `demo-fixtures.ts` assets are btc/eth/trx;
   `receive.tsx:7` chains are `['btc', 'eth', 'trx', 'ton']`. Not a general HD
   generator.
5. **Send not implemented.** `src/screens/send.tsx:18` badge `NOT IMPLEMENTED`;
   `:39` — "Sending is not implemented in this starter. There is no signing,
   broadcast or transaction-construction code." The form is a disabled fieldset.
6. **Receive QR with no wallet.** `receive.tsx:3` uses `qrcode.react`
   (`package.json:54`, v4.2.0) but shows only an address derived from an
   imported watch-only xpub; with no import there is no address.
7. **Generic UI.** Dark-navy mock (`bg-[#243454]` cards throughout), demo data.
   Owner verdict: generic AI slop.

Existing foundation the rebuild extends (not starts from zero):

- `@trustwallet/wallet-core` **4.9.3** already pinned (`package.json:47`) and
  its WASM copied to `dist` by `scripts/copy-wasm.mjs` (pinned binary,
  `scripts/wasm-integrity.mjs`).
- `src/engine/boundary.ts:1,59` already imports `initWasm` from
  `@trustwallet/wallet-core` and initialises WASM; `:492` already calls
  `core.HDWallet.getPublicKeyFromExtended(key, coin, path)` for watch-only
  derivation. The fix adds creation/signing use of the same WASM object.
- `src/state/wallet-context.tsx:17-18,61` — localStorage holds public
  watch-only data only (`bawa-watch-only-xpubs`); "No state or refs may hold
  a mnemonic, seed, private key…" This invariant must be replaced by an
  encrypted-vault design (§2), not quietly dropped.
- `src/screens/mnemonic-backup.tsx` currently explains there is nothing to
  back up; it becomes the recovery-confirmation screen.

## §1 Research (mandatory correction §1)

### 1.1 Wallet-core libraries for browser integration

| Library | Repo (verified) | Licence (verified) | Maintenance (verified 2026-11-18) | Audit | Browser | Chains |
|---|---|---|---|---|---|---|
| **Trust Wallet Core** | https://github.com/trustwallet/wallet-core | Apache-2.0 | Active: master commit `7a21615`, 3,594 stars, 396 releases, 1,701 commits, not archived | One published review only: `audit/2023-09-15_TrustWallet_SecureCodeReviewReport_Public_v2.00.pdf` (2023 code review, **not** an audit of the 4.9.3 WASM artifact) | WASM (npm, beta); async init, large payload | BTC/ETH/TRX/TON + 130+ |
| **bitcoinjs-lib** | https://github.com/bitcoinjs/bitcoinjs-lib | MIT | Active: 6,007 stars, 101 tags, not archived. README: master is dev, use tagged releases | No whole-library audit verified | Browser via browserify/bundle; key mgmt split out (`ecpair`, `bip32`) | BTC only |
| **bip32** | https://github.com/bitcoinjs/bip32 | MIT | Active: 196 stars, 43 tags, not archived | None verified | Browser-capable (needs `tiny-secp256k1` ECC) | BTC (BIP-32) |
| **ethers** | https://github.com/ethers-io/ethers.js | MIT | Active: 8,734 stars, 231 releases, not archived | No whole-library audit verified | Browser ESM bundle in `dist/`; HD wallets + mnemonic import/export + JSON-RPC | ETH (EVM) |
| **viem** | https://github.com/wevm/viem | MIT per README (GitHub license detection shows NOASSERTION because `LICENSE` is a symlink — fix lane must read the file content) | Active: 3,638 stars, 674 releases, not archived | No SDK audit verified | Browser-native BigInt, TS-first; local HD accounts, signing, RPC clients | ETH (EVM) |
| **@ton/ton** | https://github.com/ton-org/ton | MIT | Active: 244 stars, 189 tags, not archived | None verified | Browser-capable; needs `buffer` polyfill (README says so) | TON |
| **@ton/crypto** | npm package `@ton/crypto` v3.3.0, MIT, ~78k weekly downloads (verified on npm). **GitHub URL Sol gave (`ton-org/crypto`) returns 404 — do not use it.** Fix lane must resolve the source repo from npm metadata before vendoring. | MIT (npm) | Published ~a year ago (v3.3.0) | None verified | Browser (Buffer polyfill); `mnemonicNew`, `mnemonicToPrivateKey`, `mnemonicToHDSeed`, `deriveEd25519Path` (SLIP-10) | TON |
| **tronweb** | https://github.com/tronprotocol/tronweb | **MIT** (GitHub metadata + README "Licence: TronWeb is distributed under a MIT licence") — **Sol claimed LGPL-3.0; that is wrong.** | Active: 578 stars, 44 releases, 6.x TS rewrite, not archived; browser + React compatible; GPG-signed releases | None verified | Browser `dist/TronWeb.js`; local signing + RPC (`https://api.trongrid.io`) | TRX |

**Recommendation (Sol 2b, endorsed by this lane's verification): use Wallet Core
WASM as the SOLE seed/HD/address/signing engine for all four chains, and use
the chain SDKs only for public network operations and broadcasting already-signed
transactions — viem (ETH), @ton/ton (TON), tronweb (TRX), plain HTTP for BTC
UTXOs/fees/broadcast.** This reuses the vendored 4.9.3 implementation and avoids
separate, potentially inconsistent key-derivation pipelines. No additional
bitcoinjs-lib or ethers signing layer is needed. Before production: review 4.9.3
security advisories, test TON derivation + wallet-contract-version compatibility
(WalletContractV4 vs V5), use browser CSPRNG entropy, and ensure seeds/private
keys never reach RPC servers.

### 1.2 Complete reference wallet application — OneKey (verified, with a licence warning)

**Repo:** https://github.com/OneKeyHQ/app-monorepo — public, default branch **`x`**
(not master/main — all links below use `/x/`), commit `cd6c613`, 2,484 stars,
8,888 commits, 112 releases, not archived. Multi-chain wallet (BTC, ETH, Solana,
Tron, …), with web (`apps/web/`), desktop, mobile and extension targets from one
TypeScript monorepo. Sol named it as a candidate but could not verify the proof
files; the lane agent verified each file below first-hand on branch `x`.

**Licence warning — read before reusing any code:** the repo is licensed under
the **OneKey Standard Source License (O-SSL)** (`LICENSE.md`); GitHub reports
license NOASSERTION. O-SSL is a source-available licence, **not** MIT/Apache.
The fix lane must read `LICENSE.md` and confirm what reuse is permitted
(typically: study/reference is fine, redistribution/commercial use is restricted)
before copying any OneKey code. Treat OneKey as an **architecture reference** by
default, not a code donor.

Five capabilities, each proved by a real file (all fetched 2026-11-18):

| Capability | Proof file (branch `x`, verified) | What it proves |
|---|---|---|
| 1. HD wallet generation | `packages/kit-bg/src/services/ServiceAccount/ServiceAccount.ts` (exists; `createHDWallet`/`createHDHiddenWallet` evidenced by merged PR #10412, "feat: support HD passphrase wallets for non-hardware flows") | Central HD/HW/imported/watching/QR wallet creation, derivation and persistence orchestration |
| 2. Encrypted key storage | `packages/kit-bg/src/dbs/local/localSecretEnvelope/service.ts`, `wrapping.ts`, `aesGcmLayerAdapter.ts` + `packages/kit-bg/src/dbs/local/LocalDbBase.ts`, `types.ts` (`IDBCredential`: encrypted mnemonic seeds/private keys) | AES-GCM secret-envelope system; credentials stored encrypted, never plaintext |
| 3. Address derivation | `packages/kit-bg/src/vaults/impls/ton/KeyringHd.ts` (+ `Vault.ts`, `sdkTon/`) and `packages/kit-bg/src/vaults/base/KeyringHdBase.ts` | Per-chain HD keyrings derive addresses from the seed; TON is the worked example |
| 4. Signing | `packages/kit-bg/src/vaults/base/VaultBase.ts` + `KeyringSoftwareBase.ts` | Vault/keyring boundary through which signing is routed |
| 5. Transaction handling | `packages/kit-bg/src/services/ServiceSend.ts` (1,042 lines, read first 351: `signAndSendTransaction`, broadcast records, ambiguous-tx handling — a broadcast tx with no verdict is kept unresolved, never blindly rebuilt/resent) | Full send pipeline: build → decode → sign → broadcast → history |

Per-chain implementations inside OneKey: `packages/core/src/chains/` (chain crypto,
tx builders, signing primitives) with vaults in `packages/kit-bg/src/vaults/impls/`
per chain (e.g. `ton/`, `tron/`, `btc/`, `evm/`); `packages/core/src/chains/ton/
sdkTon/createWalletTransfer.ts` is the TON transfer example. Fix lane must list
the exact `btc`/`evm`/`tron` impl files when it opens the work — this report
verified the TON side and the vault architecture, not every chain dir.

**Reuse / adapt / implement for OneKey:**

- **REUSE as-is:** the architectural pattern only — ServiceAccount orchestration,
  VaultBase + per-chain Vault + KeyringHd/KeyringWatching split, secret-envelope
  (AES-GCM) storage design, ServiceSend's ambiguous-broadcast handling.
  (Code reuse is gated by the O-SSL licence — see warning.)
- **ADAPT:** the vault/keyring/service layering to `apps/web` scale (OneKey is a
  huge monorepo with background services, Realm/IndexedDB agents and hardware
  transports; Bawa needs the same boundaries in a small Vite app, not the
  monorepo). OneKey already has a web target (`apps/web`, `yarn app:web`), which
  makes the port plausible.
- **IMPLEMENT INDEPENDENTLY:** Bawa's own encrypted browser vault (WebCrypto
  AES-GCM + PBKDF2, see §2), mainnet adapters per chain (§3), the recovery
  confirmation flow, and chain-specific integration tests. Never invent crypto
  primitives.

### 1.3 Production send/receive/QR reference — BlueWallet (Bitcoin only)

**Repo:** https://github.com/BlueWallet/BlueWallet — public, master commit
`172c6768`, 3,361 stars, MIT, 115 releases, not archived. Real production
React Native Bitcoin wallet. **Bitcoin only** — it supplies no EVM/TRX/TON
adapters; it is a workflow reference, not a multi-chain one.

Corrected file paths (verified first-hand; Sol's lowercase paths 404):

| Function | Verified path (master) |
|---|---|
| Send entry + tx preparation | `screen/send/SendDetails.tsx` |
| Confirm + broadcast orchestration | `screen/send/Confirm.tsx` |
| Broadcast + QR scan in send | `screen/send/Broadcast.tsx`, `screen/send/ScanQRCode.tsx` |
| Receive + QR payload | `screen/receive/ReceiveDetails.tsx` |
| QR display component | `components/QRCode.tsx` (also `components/DynamicQRCode.tsx`; Sol's `QRCodeComponent.tsx` does not exist) |
| HD segwit wallet (signing) | `class/wallets/hd-segwit-bech32-wallet.ts` |
| Shared HD + Electrum integration | `class/wallets/abstract-hd-electrum-wallet.ts` |
| Balance/UTXO/fee/broadcast transport | `blue_modules/BlueElectrum.ts` (1,446 lines, read: Electrum client, `bitcoinjs-lib`, Realm encrypted cache) |
| Recovery-phrase UI, scan button | `components/SeedWords.tsx`, `components/AddressInputScanButton.tsx`, `components/CameraScreen.tsx` |

**Port into `apps/web`:** the recipient → amount/fees → review → sign →
broadcast → result interaction and error states; the account-backed receive
address + copy/share + payment-request QR; the scan-result/cancel/error contract
(replace native camera with browser camera + browser decoder).
**Do not port:** BlueWallet's Bitcoin key/signing stack (Wallet Core is the
signer here) or its Electrum TCP/TLS transport (`blue_modules/BlueElectrum.ts`
uses Node `net`/`tls` — a browser cannot use it; use a secure WebSocket
Electrum endpoint or a secured backend proxy instead).

### 1.4 Trust Wallet HD wallet generator — the reference the owner named

**Repo:** https://github.com/trustwallet/wallet-core (see §1.1 table). There is
no separate "Trust Wallet HD wallet generator" repository — the generator is
Wallet Core's WASM `HDWallet` API plus its tests. Verified files (master):

| Purpose | Verified file |
|---|---|
| HDWallet creation, mnemonic, multi-coin derivation | `wasm/tests/HDWallet.test.ts` (read: `HDWallet.create(256, "password")`, `wallet.mnemonic()`, `createWithMnemonic`, `getAddressForCoin(CoinType.ethereum)`; published test vector derives `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979`) |
| Authoritative HDWallet API | `include/TrustWalletCore/TWHDWallet.h` (read: `TWHDWalletCreate`, `CreateWithMnemonic`, `GetAddressForCoin`, `GetKey`, `GetDerivedKey`, `GetExtendedPublicKey`) |
| Mnemonic validation | `include/TrustWalletCore/TWMnemonic.h` (named by Sol; not re-opened — fix lane to confirm) |
| Derivation paths + chain metadata | `registry.json` (root file, confirmed in listing; per-coin derivation entries — consult instead of hardcoding one BIP-44 path per chain) |
| Coin types | `include/TrustWalletCore/TWCoinType.h` (named by Sol; fix lane to confirm) |
| Signing examples | `wasm/tests/Blockchain/Bitcoin.test.ts`, `wasm/tests/Blockchain/Ethereum.test.ts`, `wasm/tests/Blockchain/TheOpenNetwork.test.ts` (all confirmed in `wasm/tests/Blockchain/` listing — Sol's `wasm/tests/Bitcoin.test.ts` path is wrong, the `Blockchain/` segment is required) |
| Keystore / stored-key tests | `wasm/tests/StoredKey.test.ts`, `KeyStore.test.ts`, `Mnemonic.test.ts` (confirmed in `wasm/tests/` listing) |

API sequence for the fix lane: `HDWallet.create(entropyStrength,
bip39Passphrase)` → `wallet.mnemonic()` → `HDWallet.createWithMnemonic(mnemonic,
passphrase)` → `wallet.getAddressForCoin(CoinType.…)` / `getKeyForCoin` /
`getKey(coinType, derivationPath)`. **Pin to the 4.9.3 source, not master** —
master has moved on; compare APIs and protobuf schemas with the vendored 4.9.3
package before adopting anything. Never copy test mnemonics, private keys or
recipient addresses from the tests (their secrets are public).

### 1.5 Per-chain implementations (BTC / ETH / TRX / TON)

| Chain | Derivation + signing (Wallet Core is the engine in all four) | Network ops (balance, fees, UTXO, broadcast) | Notes |
|---|---|---|---|
| BTC | Wallet Core `CoinType.bitcoin`, BIP-84 (`m/84'/0'/0'/0/0` segwit-bech32). Fallback lib: `bip32` + `bitcoinjs-lib` `payments`/`Psbt` (both MIT, verified) | Electrum over secure WebSocket or secured proxy (BlueWallet `BlueElectrum.ts` design; native TCP/TLS unusable in browser). Or HTTP REST indexer | Only advertise send after fee/UTXO/sign/broadcast/confirm all work |
| ETH | Wallet Core `CoinType.ethereum`, BIP-44 `m/44'/60'/0'/0/0`. Fallback: `ethers` `HDNodeWallet.fromPhrase()` or viem local HD accounts | viem `createPublicClient({ chain: mainnet, transport: http() })` — balances, nonce, gas, broadcast | Chain ID 1 enforced; no silent testnet fallback |
| TRX | Wallet Core `CoinType.tron`, BIP-44 `m/44'/195'/0'/0/0`. Fallback: `TronWeb.fromMnemonic()`, `TronWeb.address.fromPrivateKey()`, `trx.sign()` | tronweb vs TronGrid `https://api.trongrid.io` (mainnet; TronScan is a separate provider with separate keys — do not conflate, per 2026-11-18 TRON correction) | Known defect: TRX 33-byte compressed pubkey aborts the 4.9.3 WASM runtime; 65-byte works; `derive.js` JS-first decompression applies. Fix lane must re-test on 4.9.3 |
| TON | Wallet Core `CoinType.ton` + `wasm/tests/Blockchain/TheOpenNetwork.test.ts`. Fallback: `@ton/crypto` `mnemonicToPrivateKey` + `@ton/ton` `WalletContractV4` | @ton/ton `TonClient` vs TonCenter mainnet `https://toncenter.com/api/v2/jsonRPC` | TON address depends on wallet-contract state init (version + params), not just pubkey hash. Contract version (V4 vs V5) must be pinned and tested; do not apply a BTC/ETH derivation recipe to TON |

Derivation-path source of truth: Wallet Core `registry.json` per coin, cross-checked
against the chain's own docs. Never invent a universal path.

### 1.6 AI-agent guide repo — finding: no perfect dedicated repo exists

Sol (call 3) searched for a repo that teaches AI agents how to write/find/use
wallet code and reports honestly that **no public repository confidently combines
an AI-agent wallet-building curriculum with the required security rules**. This
lane's verification supports that: the closest real things are a pair, and the
curriculum itself must be built locally (small, pinned, enforceable).

**Pair to adopt:**

1. **Trust Wallet Core as the executable reference catalogue**
   (https://github.com/trustwallet/wallet-core — verified §1.1/§1.4).
   What it teaches: BIP-39/HD creation and restoration, chain-specific
   derivation and addresses, tx construction inputs and local signing, WASM
   integration. **Tests-as-recipes:** the agent must identify a matching
   upstream test + protobuf schema (`src/proto/`) before implementing each
   chain's signing path. What NOT to copy: test mnemonics/keys/entropy, testnet
   endpoints, native memory/lifecycle assumptions, any assumption it supplies
   balances or broadcasting (it does not).
2. **MetaMask/core as the vault/keyring architecture companion**
   (https://github.com/MetaMask/core — verified: public, main, MIT, 421 stars,
   9,453 commits, 1,567 releases, not archived). Key files named by Sol and
   confirmed present in the package listing: `packages/keyring-controller/`
   (`KeyringController.ts`), `packages/network-controller/`,
   `packages/transaction-controller/` (also `packages/key-tree/`,
   `packages/cryptography/`). What it teaches: separating account metadata from
   private-key management; encrypted-vault + unlock/lock lifecycle; routing
   signing through a keyring boundary, never through UI components; separating
   network data from signing. **Also relevant:** the repo ships agent skills
   (`MetaMask/skills` via `@metamask/skills` CLI, `yarn skills`; AGENTS.md and
   CLAUDE.md at root) — the closest thing found to an "agent skills" pattern
   for wallet work. What NOT to copy: the whole extension/controller
   architecture into Vite; EVM-specific behaviour as a universal multi-chain
   implementation; secret-export flows without a separately reviewed disclosure
   flow. Gap: it is not an agent-security-rules repo and it supports testnets —
   Bawa's mainnet-only / no-fake-balances rules must be local rules.

**Build locally (proposed Bawa files, not found upstream):**

- `docs/wallet-reference-map.md` — per chain: pinned upstream commit + package
  version, actual derivation/address APIs, signing schema + matching upstream
  tests, mainnet network identity + provider, balance/fee/broadcast/confirm
  methods, known limitations. Agent rule: an unresolved API or missing network
  integration means "unsupported", not permission to invent an implementation.
- `AGENTS.md` (apps/web or repo) — acceptance requirements: (1) no plaintext
  secret persistence or logging (no mnemonics/seeds/keys/passwords in logs,
  telemetry, URLs, crash reports, React state or localStorage); (2) transient
  secret memory only, inside an isolated keyring boundary; persist only the
  encrypted vault; (3) mainnet allowlist, validate chain identity, no silent
  testnet fallback; (4) real balances only — loading/unavailable/error states,
  never fabricated amounts or unverified zero; (5) complete send flow
  (review → local sign → broadcast → report actual network status), never
  simulate success; (6) public fixtures stay in tests, never production defaults.

## §2 Fix plan — concrete, file-specific, ordered (maps to the 7 diagnosis points + correction §2/§3/§5)

Work on the feature branch only; preserve the existing watch-only project until
the replacement is verified; local commits, no push. Phase order matters: do not
build send UI before the vault exists; do not show a balance before its adapter
exists.

**Phase 0 — Foundations (no user-visible change).**

- 0.1 Pin references: create `docs/wallet-reference-map.md` (§1.6) with the
  4.9.3-pinned Wallet Core commit + the §1.1/§1.2/§1.3 repos at verified
  commits (wallet-core `7a21615`, BlueWallet `172c6768`, OneKey `cd6c613` on
  branch `x`, MetaMask/core `1f153d4`). Record the O-SSL licence gate for OneKey.
- 0.2 New module `apps/web/src/wallet/core.ts`: WASM singleton init (extend
  `src/engine/boundary.ts:59` `initWasm()`), create/restore, derive addresses,
  transient signing keys, release WASM objects. Tests against published vectors
  only (wallet-core `HDWallet.test.ts` ETH vector; §6).
- 0.3 New module `apps/web/src/wallet/chains.ts`: curated mainnet chain config
  from `registry.json` — coin types, derivation paths, mainnet RPC endpoints,
  EVM chain IDs, adapter capabilities. No testnet entries.
- 0.4 Delete-or-gate demo data first: `src/state/demo-fixtures.ts` is deleted
  (or, if deletion breaks the build mid-migration, emptied to zero entries with
  a TODO that blocks the phase). Nothing in the new UI reads it.

**Phase 1 — Vault + wallet creation/import (fixes diagnosis 1, 4; correction §2).**

- 1.1 New `apps/web/src/wallet/vault.ts`: password-protected encrypted local
  vault — WebCrypto AES-GCM + PBKDF2 (parameters recorded in the reference map;
  follow OneKey's secret-envelope layering and MetaMask keyring-controller's
  unlock/lock lifecycle, do not invent crypto). Keys/mnemonic never in
  localStorage plaintext, never in React state, never in logs. Unlock/lock,
  wrong-password and corrupted-vault states.
- 1.2 Rewrite `src/screens/create-wallet.tsx`: real in-browser creation —
  CSPRNG entropy (never `Math.random`), `HDWallet.create(256, passphrase)`,
  show the mnemonic once for write-down, then a recovery-confirmation step
  (user re-enters/re-orders words) before the wallet is usable. Keep the
  existing "never paste words into this app" warning for imports.
- 1.3 Rewrite `src/screens/import-wallet.tsx` + `mnemonic-backup.tsx`:
  mnemonic import (12/24 words, `Mnemonic.isValid`, `createWithMnemonic`),
  recovery with identical derived addresses (§6 proof), backup checklist.
- 1.4 Extend `src/state/wallet-context.tsx`: replace the xpub-only model with
  vault-backed accounts; keep watch-only xpub accounts as a separate,
  explicitly labelled account type (an xpub can never be upgraded into signing
  keys — creation or mnemonic restoration is required for spending).
- 1.5 Multi-chain derivation: BTC/ETH/TRX/TON at account 0, index 0 first, then
  indexed accounts; derivation paths from `chains.ts`, verified against §6
  vectors. Only chains with a working adapter are listed as available.

**Phase 2 — Real balances + history (fixes diagnosis 2, 3; correction §3).**

- 2.1 New `apps/web/src/wallet/adapters/` — one adapter per chain (BTC via
  Electrum-WS/proxy or HTTP indexer; ETH via viem; TRX via tronweb/TronGrid;
  TON via @ton/ton/TonCenter mainnet). Each adapter: balance, tx history,
  fee estimation, UTXO/nonce/seqno inputs, broadcast.
- 2.2 Rewrite `src/screens/dashboard.tsx`, `asset-list.tsx`,
  `asset-detail.tsx`, `transaction-history.tsx`: genuine balances only.
  States: loading, zero, unavailable, error. A failed fetch shows
  "unavailable", never zero and never a fabricated number. An asset appears
  only when its adapter exists.
- 2.3 Remove all fake tx records (check `transaction-history.tsx` and any
  fixture it reads; delete with `demo-fixtures.ts`).

**Phase 3 — Receive + QR (fixes diagnosis 6; correction §2/§5).**

- 3.1 Rewrite `src/screens/receive.tsx`: address from the vault-derived
  account (not an imported xpub), chain selector over available chains,
  `qrcode.react` QR of the address (keep the existing component — it is already
  a dependency), copy/share, payment-request amount option (BlueWallet
  `ReceiveDetails.tsx` pattern). Verify the displayed address against the
  repo-tool derivation before release.
- 3.2 Add QR scanning for send (Phase 4): browser camera + browser decoder,
  following BlueWallet `ScanQRCode.tsx`'s scan-result/cancel/error contract and
  `AddressInputScanButton.tsx`.

**Phase 4 — Send (fixes diagnosis 5; correction §3).**

- 4.1 Rewrite `src/screens/send.tsx` following BlueWallet's flow:
  recipient → amount/fees → review → sign → broadcast → result, with the
  OneKey `ServiceSend.ts` ambiguous-broadcast rule (unknown outcome stays
  unresolved; never resend or blindly compose a replacement).
  Chain-specific signing via Wallet Core `AnySigner` patterns from
  `wasm/tests/Blockchain/*.test.ts`; live nonce/fees/UTXOs from the adapters.
- 4.2 Explicit user approval step before broadcast (confirm screen with
  recipient, amount, network fee, total — all real, from the adapter).
  **Broadcast stays DISABLED until separately authorised (§4).** Until then the
  flow is built and tested offline only, and the UI must not present send as
  working.
- 4.3 `src/screens/transaction-detail.tsx`: real on-chain status (pending/
  confirmed/failed from the network), never a simulated success.

**Phase 5 — UI rebuild around real state (fixes diagnosis 7; correction §5).**

- 5.1 Rebuild the dashboard/navigation around real wallet state: create/import,
  recovery confirmation, genuine balances, multi-chain accounts, receive + QR,
  send with previews/fees, history, network/account selection, vault
  lock/unlock/recovery (`security-settings.tsx`, `wallet-management.tsx`,
  `network-selection.tsx`, `welcome.tsx` updated to match).
- 5.2 Rule: a feature is not displayed as functional unless its implementation
  works. Anything unimplemented is absent or explicitly labelled unavailable —
  never a working-looking disabled form presented as a feature.
- 5.3 Keep the existing visual system (Bawa Balanced tokens) only where it
  does not conflict with real-state clarity; the mock dashboard is not the
  foundation.

## §3 Safety restrictions (correction §4 — absolute, for all fix lanes)

- **No transfer, send or broadcast of real cryptocurrency during development.
  Mainnet broadcasting stays DISABLED until separately authorised.**
- Disposable generated test credentials only, for implementation tests.
- Test mnemonic generation, recovery and address derivation against established
  test vectors (§6).
- Read-only mainnet integration tests only.
- Transaction construction and signing tested **offline** with disposable keys;
  verify formats, signatures, fees and destination addresses.
- Never expose, log, commit or upload private keys or mnemonics. Never use real
  user funds or seed phrases for testing.
- No plaintext secrets in state, refs, localStorage, logs, telemetry, URLs or
  crash reports (extends the existing `wallet-context.tsx:61` invariant).
- WASM does not protect secrets from compromised page JavaScript; the vault
  boundary and XSS hygiene are part of the security model, not an afterthought.

## §4 Mandatory verification evidence (correction §6 — the fix is not done without these)

1. Successful wallet creation (fresh mnemonic, CSPRNG entropy).
2. Successful wallet recovery with **identical derived addresses**.
3. Correct chain-specific derivation (paths from `registry.json`, per chain).
4. Valid mainnet addresses (BTC/ETH/TRX/TON format + checksum checks).
5. Accurate read-only mainnet balance retrieval (vs a second source).
6. Successful offline transaction signing and verification (disposable keys).
7. No demo balances or fake transaction data anywhere in the app
   (grep `demo-fixtures`, `$12,480`, `Testnet4`, `Sepolia`, `Nile` → zero hits
   in `apps/web/src`).
8. No private keys or mnemonics in backend requests, logs or persistent
   plaintext storage (grep + storage inspection).
9. Successful build, automated tests and security checks (`npm run build`,
   `npm test`, typecheck).

Published vectors to test against (public fixtures, not secrets): wallet-core
`HDWallet.test.ts` ETH vector → `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979`;
repo-verified TRX derivation (main 74ae078, 2026-11-18): index 0 →
`TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`, index 1 →
`TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B`. TRX 33-byte WASM abort (4.9.3) must be
re-tested in the new code path.

## §5 Risks, caveats and what must NOT be done

- **Never** store a mnemonic/seed/private key in plaintext localStorage, React
  state, logs or URLs. The current `wallet-context.tsx:61` invariant is the
  floor, not the ceiling.
- **Never** present a fixture, mock or testnet number as a balance; never
  simulate a successful send.
- **Never** copy test mnemonics/keys/entropy from upstream tests into the app.
- **Never** assume a reference repo contains a capability — §1.2/§1.3 were
  verified file by file precisely because Sol's paths were partly wrong.
- **Never** use OneKey code without clearing the O-SSL licence gate.
- **Never** use `Math.random` for entropy; never reuse addresses needlessly;
  never share xpubs casually (bitcoinjs-lib README warns xpubs are a liability).
- **Never** treat "more derived addresses" as "more working chains" — a chain
  is supported only when balance + fee + sign + broadcast + confirm all work.
- **Never** broadcast on mainnet during development (§3); never use real funds
  or real seed phrases for testing.
- Watch-only xpub accounts cannot sign; do not let the UI imply otherwise.
- Wallet Core is not a balance/RPC/broadcast service; the adapters are
  independent work and the largest schedule risk.
- TON contract-version (V4 vs V5) and TRX 33-byte WASM abort are the two
  known chain-specific traps; both need explicit tests before either chain is
  called supported.
- Encrypted storage does not protect an unlocked web wallet from malicious
  same-origin JavaScript or XSS.
- Master-branch links drift: every upstream reference must be pinned to the
  4.9.3-era commit (or the verified commit in §9) in `docs/wallet-reference-map.md`.

## §6 Sol errors corrected first-hand (do not repeat them)

1. BlueWallet `screen/send/details.tsx` → 404. Real path:
   `screen/send/SendDetails.tsx` (same for `Confirm.tsx`,
   `ReceiveDetails.tsx`, `ScanQRCode.tsx`). GitHub paths are case-sensitive.
2. BlueWallet `components/QRCodeComponent.tsx` → 404. Real component:
   `components/QRCode.tsx` (also `DynamicQRCode.tsx`).
3. Wallet Core `wasm/tests/Bitcoin.test.ts` / `Ethereum.test.ts` → wrong
   directory. Real paths: `wasm/tests/Blockchain/Bitcoin.test.ts`,
   `Ethereum.test.ts`, `TheOpenNetwork.test.ts`.
4. tronweb licence: Sol said LGPL-3.0. Verified MIT (GitHub + README).
5. `@ton/crypto` GitHub URL `ton-org/crypto` → 404. npm package verified;
   source repo unresolved — do not cite the GitHub URL.
6. OneKey default branch is `x`, not master/main; licence is O-SSL, not
   MIT/Apache. Both matter for links and reuse.
7. viem licence: README says MIT but GitHub reports NOASSERTION (LICENSE is a
   symlink) — read the file before relying on it.
8. Sol could not verify OneKey's five proof files (no live access) — the lane
   agent verified them instead (§1.2). Sol's "no dedicated AI-agent wallet
   curriculum repo" finding stands and is adopted (§1.6).

## §7 Verification log (all fetched 2026-11-18 by the lane agent)

| URL / repo | Result |
|---|---|
| https://github.com/trustwallet/wallet-core | 200, public, master `7a21615`, 3,594 stars, Apache-2.0, 396 releases, `audit/` + `wasm/` + `registry.json` present |
| `wasm/tests/HDWallet.test.ts` | 200, read: `HDWallet.create(256, …)`, `createWithMnemonic`, `getAddressForCoin(ethereum)` → `0x27Ef…` |
| `include/TrustWalletCore/TWHDWallet.h` | 200, read: `TWHDWalletCreate`, `CreateWithMnemonic`, `GetAddressForCoin`, `GetKey`, `GetDerivedKey`, `GetExtendedPublicKey` |
| `wasm/tests/` + `wasm/tests/Blockchain/` listings | 200: `HDWallet/Mnemonic/StoredKey/KeyStore.test.ts`; `Blockchain/Bitcoin, Ethereum, TheOpenNetwork.test.ts` |
| `audit/` listing | 200: single file `2023-09-15_TrustWallet_SecureCodeReviewReport_Public_v2.00.pdf` |
| https://github.com/BlueWallet/BlueWallet | 200, public, master `172c6768`, 3,361 stars, MIT, 115 releases |
| `blue_modules/BlueElectrum.ts` | 200, 1,446 lines, read: Electrum client, `bitcoinjs-lib`, Realm encrypted cache, native `net`/`tls` |
| `screen/send/`, `screen/receive/`, `class/wallets/`, `components/` listings | 200: corrected paths in §1.3 confirmed |
| https://github.com/OneKeyHQ/app-monorepo | 200, public, branch `x` `cd6c613`, 2,484 stars, O-SSL licence, `apps/web` present |
| OneKey `ServiceAccount/`, `dbs/local/`, `localSecretEnvelope/`, `vaults/impls/ton/`, `vaults/base/` listings + `ServiceSend.ts` | 200: all five proof files confirmed (§1.2); `ServiceSend.ts` 1,042 lines, read first 351 |
| https://github.com/bitcoinjs/bitcoinjs-lib | 200, public, MIT, 6,007 stars, 101 tags |
| https://github.com/bitcoinjs/bip32 | 200, public, MIT, 196 stars, 43 tags |
| https://github.com/ethers-io/ethers.js | 200, public, MIT, 8,734 stars, 231 releases |
| https://github.com/wevm/viem | 200, public, 3,638 stars, 674 releases; licence MIT-per-README / NOASSERTION-per-GitHub |
| https://github.com/ton-org/ton | 200, public, MIT, 244 stars, 189 tags; README confirms Buffer polyfill + `WalletContractV4` |
| https://github.com/tronprotocol/tronweb | 200, public, MIT, 578 stars, 44 releases; browser + React compatible |
| https://github.com/ton-org/crypto | **404 — does not exist** |
| https://www.npmjs.com/package/@ton/crypto | 200 (crawled copy): v3.3.0, MIT, ~78k weekly downloads, SLIP-10 HD keys |
| https://github.com/MetaMask/core | 200, public, main `1f153d4`, MIT, 421 stars, 9,453 commits, 1,567 releases; agent-skills section + `keyring-controller` in package list |

## §8 Open / unverified (for the fix lanes, not hidden)

- MetaMask `KeyringController.ts` content was not read — only the repo root and
  package list were verified. Fix lane to read it before adopting the pattern.
- OneKey `ServiceAccount.ts` content was not read line-by-line (file existence
  + PR #10412 evidence only). Same for `KeyringHd.ts` (TON) content.
- Wallet Core `TWMnemonic.h` / `TWCoinType.h` were named by Sol, not re-opened.
- No published audit of the 4.9.3 WASM artifact exists (only the 2023 review).
  Fix lane to check 4.9.3 advisories before production.
- `@ton/crypto` source repo unresolved (see §1.1).
- Upstream links are to moving branches (master/main/x) unless a commit is
  named; `docs/wallet-reference-map.md` must pin commits.
- Call 2 (full §1 prompt) timed out after 60 min with no output; its content
  was recovered via micro-splits 2b/2c plus first-hand verification. Nothing in
  this report depends on a call that did not land.

---
*Research lane only — no `apps/web` code was edited. Report + RUN-LOG.jsonl
committed on `panel-rebuild/research` (local only, never pushed).*
