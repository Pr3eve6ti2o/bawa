# SDK-PICK — wallet-generation engine for the Bawa wallet-panel rebuild

- **Lane:** sdk-pick (panel-rebuild programme, owner direction 2026-11-18 ~21:20 IST)
- **Branch:** `panel-rebuild/sdk-pick`, off `feature/ai-wallet-builder` at `0759a81`
- **Date:** 2026-11-18
- **Model:** gpt-6.1-sol, API 1 ONLY. 5 calls made, 5 landed (see RUN-LOG.jsonl).
- **Scope:** research ONLY. No `apps/web` code was edited.
- **Rule applied throughout:** every repo URL and licence claim in §1 was verified
  first-hand by this lane agent (GitHub repo page and/or LICENSE file, fetched
  2026-11-18) or is explicitly marked Sol-reported / UNVERIFIED. Sol's answers
  were treated as leads, never as verified facts. Corrections Sol needed are
  listed in §6.

## §1 Comparison table — all verified first-hand unless marked otherwise

"Generates" means: creates a BIP-39 mnemonic and derives mainnet addresses from
it in a browser. "Audit" means a published audit or code review of that
component — a whole-app audit does not count as a component audit.

| Candidate | What it generates | Chains (from one BIP-39 mnemonic) | Licence (verified) | Maintenance (verified 2026-11-18) | Audit |
|---|---|---|---|---|---|
| **Trust Wallet Core 4.9.3 — WASM `HDWallet` API** | BIP-39 mnemonic (`HDWallet.create` / `createWithMnemonic`), HD derivation, addresses, signing inputs. `TWHDWallet.h`: `Create`, `CreateWithMnemonic`, `GetAddressForCoin`, `GetKey`, `GetDerivedKey`. | **BTC, ETH, TRX, TON, SOL, Cosmos** — all six, from one mnemonic. README: 130+ blockchains. | **Apache-2.0** | Active: master commit `7a21615`, 3,594 stars, 396 releases, 1,701 commits, not archived. npm package is labelled beta. | One published review only: `audit/2023-09-15_TrustWallet_SecureCodeReviewReport_Public_v2.00.pdf` (2023 code review, **not** an audit of the 4.9.3 WASM artifact). No whole-artifact audit verified. |
| **OKX JS Wallet SDK** (`@okxweb3/*`) | Per-coin wallets: `SolWallet` / `EthWallet` / `TronWallet` / `TonWallet` etc. derive addresses + sign from a mnemonic/private key via `crypto-lib` (BIP-39) + `coin-base` + per-coin packages. No single unified HD-wallet class — each coin is its own package. | **BTC, ETH, TRX, TON, SOL, Cosmos** (README table: Generate Address ✅ for coin-bitcoin, coin-ethereum, coin-tron, coin-ton, coin-solana, coin-cosmos, + Aptos/Sui/Near/EOS/Starknet). | **MIT** | Active: 386 stars, 626 commits, 0 releases, 1 tag, not archived. Current commit `8d5e808` — the same pin the repo guide §3 cites. Smallest community of the multi-chain candidates. | **None verified.** No published SDK audit found. |
| **MetaMask stack** (ethers `HDNodeWallet` + `@metamask/keyring-controller` + `@metamask/key-tree` + `@metamask/browser-passworder` + `@metamask/eth-hd-keyring`) | ethers v6 `HDNodeWallet.fromPhrase` / `createRandom()` — BIP-39 + BIP-32, EVM addresses. `eth-hd-keyring` is the standard ETH HD keyring (`m/44'/60'/0'/0/i`). `key-tree` is chain-neutral BIP-32/SLIP-10 key derivation (secp256k1 + Ed25519) — keys only, no chain addresses. `keyring-controller` orchestrates keyrings + encrypted vault; `browser-passworder` encrypts the vault (PBKDF2 + AES-GCM, WebCrypto). | **ETH/EVM only.** Cannot generate BTC, TRX, TON, SOL, Cosmos natively. | ethers **MIT**; `keyring-controller` **MIT** (MetaMask/core monorepo); `key-tree` **MIT**; `browser-passworder` **ISC**; `eth-hd-keyring` **ISC** | MetaMask/core: 421 stars, 9,459 commits, 1,567 releases, not archived. ethers: 8,734 stars, 231 releases, not archived. `browser-passworder`: 126 stars, 10 releases, not archived. `eth-hd-keyring` standalone repo: **ARCHIVED** (86 stars, moved into MetaMask/core). `key-tree` standalone repo: **ARCHIVED** (54 stars, moved into MetaMask/core). | `key-tree`: **audited by Cure53, Feb 2023 + Apr 2024** (README states this; reports in repo `audits/` — PDFs not opened). No whole-stack audit verified for ethers, keyring-controller, browser-passworder or eth-hd-keyring. |
| **Phantom stack** (public reproduction: `bip39` + `ed25519-hd-key` + `@solana/web3.js`) | Phantom app itself is **closed source** — no public generation SDK exists. Reproduction stack: `bip39` generates/validates the mnemonic → SLIP-0010 hardened Ed25519 derivation (`ed25519-hd-key`, path `m/44'/501'/…`) → 32-byte seed → `Keypair.fromSeed` (`@solana/web3.js`). `web3.js` does NOT generate mnemonics or do HD derivation. | **SOL only** (reproduction stack). The closed Phantom app also supports BTC + ETH/EVM from one phrase, but **not TRX or TON**, and its internals are unverified. | `bip39` **ISC**; `ed25519-hd-key` **MIT**; `@solana/web3.js` **MIT** | `@solana/web3.js` (now `solana-foundation/solana-web3.js`): 2,780 stars, 587 releases, not archived. v1.x is maintenance-only (critical fixes); new development is v3+. `bip39`: 1,183 stars, 289 commits, 0 releases, not archived. `ed25519-hd-key`: 72 stars, 54 commits, 0 releases, not archived. | **None verified** for any of the three. |
| **Rabby stack** (`@rabby-wallet/eth-keyring-hd`, `bip39`, `hdkey`, `ethereumjs-wallet`, `browser-passworder`) | Own background keyring service (MetaMask-style architecture, not the upstream controller — that dependency is UNVERIFIED). `eth-keyring-hd`: BIP-39-backed ETH HD accounts, path `m/44'/60'/0'/0/i`. `bip39` = mnemonic, `hdkey` = BIP-32/secp256k1, `ethereumjs-wallet` = ETH address handling. Vault encrypted (PBKDF2 + AES-GCM). | **ETH/EVM only.** Cannot generate BTC, TRX, TON, SOL, Cosmos natively. | App repo **MIT** (LICENSE file read first-hand: MIT text + brand/logo reservation clause; GitHub reports NOASSERTION). Scoped keyring packages: licences UNVERIFIED — do not assume the app licence. | RabbyHub/Rabby: 1,939 stars, 4,408 commits, 351 releases, default branch `develop`, not archived. | Sol-reported: published **Least Authority Rabby Wallet security audit**; repo has an `audits/` directory (seen in root listing). Report version and current-release coverage **UNVERIFIED** — not opened. No audit verified for the keyring packages themselves. |
| **BlueWallet stack** (`bip39` + `bip32` + `bitcoinjs-lib`) | `bip39` = mnemonic/seed; `bip32` = BIP-32 HD derivation (needs `tiny-secp256k1`); `bitcoinjs-lib` = Bitcoin scripts/addresses/Psbt. BlueWallet's `class/wallets/hd-segwit-bech32-wallet.ts` = BIP-84 native-SegWit HD wallet. | **BTC only.** Cannot generate ETH, TRX, TON, SOL, Cosmos. | **MIT** (all three; BlueWallet app MIT) | BlueWallet: 3,361 stars, 13,955 commits, 115 releases, master `172c6768`, not archived. bitcoinjs-lib: 6,007 stars, 101 tags, not archived (README: master is dev, use tagged releases). bip32: 196 stars, 43 tags, not archived. | **None verified** for BlueWallet, bitcoinjs-lib or bip32 as whole libraries. bitcoinjs-lib's README explicitly tells users to audit it themselves ("Don't trust. Verify."). |
| **OneKey stack** (own `ServiceAccount` + per-chain `KeyringHd` vaults + `@onekeyhq/core`) | Own account service + per-chain keyring/vault architecture. `ServiceAccount.createHDWallet` orchestrates creation; per-chain `KeyringHd.ts` vaults (btc/evm/tron/ton/…) derive addresses; encrypted secret-envelope (AES-GCM) storage. This is a whole application monorepo, not a drop-in generation SDK. | **BTC, ETH, TRX, TON, SOL, Cosmos-family** (per Sol + README: BTC, ETH, Solana, Tron, BNB + more). Architecture-level coverage; exact current catalogue UNVERIFIED. | **OneKey Standard Source License (O-SSL)** — source-available, **NOT MIT/Apache**. GitHub reports NOASSERTION. Code reuse is gated by O-SSL; architecture reference only unless the licence is cleared. | 2,484 stars, 8,889 commits, 112 releases, default branch **`x`** (not master/main), not archived. Has a web target (`apps/web`). | **None verified** for the app/HD-generation stack. |

### Per-candidate verdicts (Sol + lane verification agree)

- **Trust Wallet Core: YES** — the only candidate that is a single engine
  generating all six chains from one mnemonic, browser-ready, permissively
  licensed, and already vendored in this repo at 4.9.3.
- **OKX JS Wallet SDK: YES at feature level, NO as a single engine** — it covers
  all six chains, but only as separate per-coin packages with no unified
  HD-wallet class; smallest community (386 stars, 0 releases) and no audit.
  It is the strongest alternative and the right differential-test source.
- **MetaMask stack: NO** — ETH/EVM only. `key-tree` is chain-neutral key
  derivation, not chain address generation.
- **Phantom stack: NO** — no public SDK (closed app); the reproduction stack
  is Solana-only, and the app itself lacks TRX/TON.
- **Rabby stack: NO** — ETH/EVM only.
- **BlueWallet stack: NO** — BTC only.
- **OneKey stack: TECHNICALLY YES as an architecture, NO as an SDK** — it is a
  whole app monorepo under O-SSL, not a reusable generation library. Its
  generation is its own keyring/vault architecture; whether it embeds Trust
  Wallet Core is **UNVERIFIED** (Sol P4 explicitly refused to label it so —
  see §6.7). Adopting OneKey would mean adopting a second wallet app, not
  an engine.

## §2 The pick

**PICK: Trust Wallet Core 4.9.3, WASM `HDWallet` API, as the SINGLE
wallet-generation engine for the rebuild.**

Pin: npm `@trustwallet/wallet-core` **4.9.3** (already vendored in this repo;
WASM sha256 `13a18a38…77217`, verified in earlier lanes). Do not follow
master — master has moved on (current commit `7a21615`); compare APIs and
protobuf schemas with the vendored 4.9.3 package before adopting anything
new. Derivation paths come from Wallet Core `registry.json` per coin,
cross-checked against the chain's own docs — never hardcode one BIP-44 path
per chain, and never invent a universal path.

### Justification against the others

1. **Coverage from one mnemonic.** It is the only candidate with a single
   `HDWallet` abstraction that generates BTC, ETH, TRX, TON, SOL and Cosmos
   addresses from one BIP-39 mnemonic (Sol P5 rank 1; verified in §4 below).
   Every other candidate either covers one chain family or is a set of
   per-coin packages (OKX) or a whole app (OneKey).
2. **Browser fit.** The WASM build is browser-usable (`initWasm()` async
   init) and is already integrated in this repo (`tools/hdwallet-gen`,
   `apps/web` declares the same 4.9.3 dependency). Trade-offs: async init
   and WASM payload size/bundling cost. OKX has more natural modular JS
   packaging, but no unified HD interface.
3. **Licence.** Apache-2.0 — permissive, verified first-hand. (Sol P5
   wrongly called Wallet Core MIT — corrected in §6.6.) OneKey's O-SSL
   and Rabby's NOASSERTION/brand clause are both worse for reuse.
4. **Maintenance.** The most actively maintained multi-chain core of the
   set (3,594 stars, 396 releases, 1,701 commits, not archived), and the
   engine behind Trust Wallet itself. OKX (386 stars, 0 releases) is an
   order of magnitude smaller.
5. **Audit — stated honestly.** The only published review is the 2023 Secure
   Code Review, which is **not** an audit of the 4.9.3 WASM artifact. No
   candidate in this comparison has a verified whole-artifact audit for the
   exact shipped build (key-tree's Cure53 audits are the one genuine
   component audit found, and key-tree is only a derivation primitive).
   The pick does NOT rest on an audit advantage; it rests on coverage,
   browser fit, licence and the working proof in §4.
6. **Already proven in this repo.** The repo's own tools (`generate.js`,
   `derive.js`, `derive-ton.js`) already generate and derive with it, and
   the §4 proof re-runs that path on the feature branch.
7. **Expansion chains are covered, not a future rewrite.** SOL and Cosmos
   generation exist in the same engine (README: 130+ blockchains), so the
   guide's later expansion does not need a second engine. (Per-network
   Cosmos-SDK derivation paths/prefixes still need per-network checking —
   "Cosmos support" is not universal ecosystem coverage.)

### Biggest risk of the pick (Sol P5 agrees)

**Recovery-policy incompatibility, especially TON.** Wallet Core can
generate valid addresses without reproducing another wallet's accounts from
the same words. TON-native mnemonic processing differs from BIP-39, and
the TON wallet-contract version + wallet ID change the address. BTC
address/script type and Solana derivation-path choices create the same
interoperability issue. The fix lane must pin the recovery policy per chain
and validate recovery against the clients it promises to support.
"Supports the chain" must not be mistaken for "the same mnemonic recovers
the same addresses everywhere."

## §3 Per-chain gaps — stated explicitly

**There is NO generation gap for any required or expansion chain.**
Wallet Core generates BTC, ETH, TRX, TON, SOL and Cosmos from one mnemonic
(proved in §4 for the four required chains; SOL/Cosmos generation is
claimed by the same `HDWallet`/`registry.json` mechanism and must be
exercised by the fix lane before either is advertised — not yet proved
hands-on in this lane).

What Wallet Core does **NOT** supply — these are not generation gaps, they
are separate work the rebuild must still do, with the named supplementary
component:

| Need | Supplementary component (not a second generation engine) |
|---|---|
| BTC balances, UTXOs, fees, broadcast | Electrum over secure WebSocket or secured proxy, or HTTP REST indexer (BlueWallet `BlueElectrum.ts` design; native TCP/TLS unusable in browser). Fallback signing lib if ever needed: `bip32` + `bitcoinjs-lib` (MIT, verified). |
| ETH balances, nonce, gas, broadcast | viem `createPublicClient({ chain: mainnet })` (MIT per README; GitHub NOASSERTION — LICENSE is a symlink). Fallback: ethers `HDNodeWallet` (MIT, verified). |
| TRX balances, fees, broadcast | tronweb vs TronGrid `https://api.trongrid.io` (tronweb MIT, verified; TronScan is a separate provider with separate keys — do not conflate). |
| TON balances, fees, broadcast | `@ton/ton` `TonClient` vs TonCenter mainnet (MIT, verified in research report §1.1). Fallback derivation: `@ton/crypto` `mnemonicToPrivateKey` (npm MIT, v3.3.0; GitHub URL unresolved — do not cite `ton-org/crypto`, it 404s). |
| Encrypted vault / lock-unlock lifecycle | Bawa's own vault (WebCrypto AES-GCM + PBKDF2), modelled on the MetaMask `keyring-controller` + `browser-passworder` (ISC, verified) boundary and OneKey's secret-envelope design — **architecture reference only**, no OneKey code (O-SSL). |
| Differential (second-implementation) tests | OKX JS Wallet SDK per-coin packages (MIT, verified) — cross-check derived addresses per chain. Do not install the whole SDK as a runtime dependency. |

Known chain-specific traps the fix lane must test before calling a chain
supported (from the research report, confirmed in §4 where noted):

- **TRX 33-byte compressed-pubkey WASM abort (4.9.3):** reproducing it was
  a known defect. In this lane's proof the TRX xpub route (index 0 and 1)
  worked on 4.9.3 without aborting — the JS-first decompression in
  `derive.js` stays in place, and the fix lane must re-test the exact new
  code path rather than assume the defect is gone.
- **TON contract version:** Wallet Core 4.9.3 defaults (V4 R2, wallet ID
  698983191, subwallet 0) reproduce the recorded fixture (proved in §4).
  V4 vs V5 must be pinned and tested; do not silently migrate.
- **Wallet Core is not a balance/RPC/broadcast service** — an address
  derived is not a chain supported; a chain is supported only when balance
  + fee + sign + broadcast + confirm all work.

## §4 Generation proof — hands-on, in this repo's environment

Run by this lane agent on muse-vm, 2026-11-18, in the worktree
`panel-rebuild/sdk-pick`, with Node v22.23.4 and the repo's own
`@trustwallet/wallet-core` **4.9.3** (fresh `npm install` in
`tools/hdwallet-gen`; 14 packages). Script:
`tools/hdwallet-gen/sdk-pick-proof.js`. Full output:
`proof/proof-output-2026-11-18.txt`. **Result: ALL PASS (12/12 checks).**

Safety: the proof generated a **fresh disposable 256-bit test mnemonic**
in-process, used it once, and destroyed it with the wallet object. The
mnemonic was **never printed, logged, committed or written to disk** —
only the word count (24) and the derived public addresses are recorded
below. No real funds, no real seed phrases, no transfer/send/broadcast.

### 4.1 Published-vector cross-check (public fixture)

Fixture mnemonic: the repo's public test mnemonic, already committed in
`tools/hdwallet-gen/generate.js` (also wallet-core's own public test
mnemonic). Empty passphrase unless noted.

| Check | Expected | Result |
|---|---|---|
| BTC `m/84'/0'/0'/0/0` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | PASS |
| ETH `m/44'/60'/0'/0/0` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | PASS |
| TON (V4 R2, wallet ID 698983191) | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` | PASS |
| TRX index 0 `m/44'/195'/0'/0/0` | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | PASS |
| TRX index 1 `m/44'/195'/0'/0/1` (xpub route) | `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` | PASS |
| ETH, same mnemonic + passphrase `TREZOR` (upstream `wasm/tests/HDWallet.test.ts` vector, file read first-hand) | `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979` | PASS |

### 4.2 Fresh disposable mnemonic → real mainnet addresses

Fresh 24-word BIP-39 mnemonic, 256-bit entropy, valid per
`Mnemonic.isValid`. Derived and `CoinTypeExt.validate`-checked:

| Chain | Path | Derived mainnet address (disposable test wallet, never funded) |
|---|---|---|
| BTC | `m/84'/0'/0'/0/0` | `bc1qsrzz6xkf0t4m2ya48stng74fvl5tmhzfn5tkfn` |
| ETH | `m/44'/60'/0'/0/0` | `0x13215A1047a871A7b382c279e1aBCa977EC1ae3a` |
| TRX | `m/44'/195'/0'/0/0` | `TRZAQZsjH6s7uqdMhmdNCS34Z2DJciLWGx` |
| TRX index 1 | `m/44'/195'/0'/0/1` (xpub route) | `TJGHkwoJ6wm9AYihVgKQeevTj1ui5PGVbf` |
| TON | `m/44'/607'/0'/0/0` (V4 R2) | `UQC77RtaO22V_a76bfVV5RVF7axU3DU-Gs88_oboDnIZIt-f` |

No chain failed. The TRX xpub route did **not** abort on 4.9.3 in this
proof (both indices). SOL/Cosmos derivation was **not** exercised in this
proof — the fix lane must run it before advertising either chain.

## §5 Sol calls (record: RUN-LOG.jsonl)

| Call | Prompt | Words | Output | Result |
|---|---|---|---|---|
| 1 | MetaMask stack | 187 | `out/sol-p1-metamask.md` (4,788 B, 352 s) | Landed |
| 2 | Phantom + OKX | 211 | `out/sol-p2-phantom-okx.md` (4,550 B, 353 s) | Landed |
| 3 | Rabby | 192 | `out/sol-p3-rabby.md` (4,724 B, 347 s) | Landed |
| 4 | BlueWallet + OneKey | 227 | `out/sol-p4-bluewallet-onekey.md` (4,825 B, 364 s) | Landed |
| 5 | Head-to-head synthesis | 199 | `out/sol-p5-synthesis.md` (4,784 B, 433 s) | Landed |

5 made, 5 landed, 0 failed, 0 retried. No 402/403. One local service
restart interrupted a status-check exec mid-lane; the detached P3 call
was unaffected (setsid/nohup, as designed). One boxd exec failed with an
h2 transport error on the check itself; retried, P5 still running, landed
shortly after.

## §6 Sol errors corrected first-hand (do not repeat them)

1. **eth-hd-keyring / key-tree "not archived" (P1, UNVERIFIED).** Both
   standalone repos **are archived** — moved into the MetaMask/core
   monorepo (verified on their GitHub pages: eth-hd-keyring 86 stars,
   key-tree 54 stars, both "Public archive").
2. **key-tree audit "NONE VERIFIED" (P1).** Wrong: the key-tree README
   states it was **audited by Cure53 in February 2023 and April 2024**,
   reports in the repo's `audits/` directory. The only genuine component
   audit found in this comparison.
3. **OKX licence "UNVERIFIED" + "thousand-scale stars" (P2).** Licence is
   **MIT** (repo page + README, verified first-hand); stars are **386**,
   not thousand-scale.
4. **@solana/web3.js repo (P2).** The repo moved from `solana-labs` to
   **`solana-foundation/solana-web3.js`**; v1.x is maintenance-only,
   new development is v3+ (README, verified).
5. **bip39 licence "MIT" (P2, P3).** Wrong: **ISC** (GitHub page,
   verified first-hand: 1,183 stars, 289 commits).
6. **Wallet Core licence "MIT" (P5 synthesis).** Wrong: **Apache-2.0**
   (verified first-hand).
7. **OneKey stack = "Wallet Core + own keyring" (task brief; P5 ranking
   assumed it).** Sol P4 refused to certify this: OneKey's generation is
   its own keyring/vault architecture and `@onekeyhq/core`; Trust Wallet
   Core participation at current `x` HEAD is **UNVERIFIED**. This document
   does not repeat the Wallet Core claim for OneKey.
8. **Rabby "several thousand stars" (P3).** Actually **1,939** (verified).
   Rabby's Least Authority audit is Sol-reported only (report version and
   coverage unverified); the repo's `audits/` directory exists (seen in
   the root listing).
9. **`@metamask/encryption` (P1 prompt).** Sol correctly refused to
   invent a repo for it — no standalone repo with that exact name was
   established. MetaMask/core contains `packages/cryptography` instead;
   do not cite `@metamask/encryption` as a repo.

## §7 Open / unverified (for the fix lane, not hidden)

- SOL and Cosmos derivation with Wallet Core 4.9.3 WASM in this repo's
  environment: not yet run hands-on — exercise before advertising.
- Wallet Core 4.9.3 WASM artifact has no verified whole-artifact audit;
  the 2023 Secure Code Review is a code review, not an artifact audit.
  Before production: review 4.9.3 security advisories.
- TRX 33-byte WASM abort: not reproduced in this proof's paths, but the
  JS-first decompression in `derive.js` must stay until the fix lane
  re-tests its exact new code path.
- TON V4 vs V5: V4 R2 is the proved default; V5 compatibility is untested.
- OKX SDK as differential-test source: per-coin package versions, transitive
  licences, browser bundling and TON contract configuration still to be
  qualified if used.
- OneKey O-SSL: architecture reference only; no code reuse without a
  licence clearance the fix lane must obtain.
- Rabby scoped keyring packages (`@rabby-wallet/eth-keyring-hd` etc.):
  standalone repo URLs and licences UNVERIFIED — not needed for the pick.
- `viem` licence: README says MIT but GitHub reports NOASSERTION (LICENSE
  is a symlink) — read the file before relying on it (carried from the
  research report §1.1).

## §8 Sources

- Research lane: `../research/RESEARCH-REPORT.md` §1.1, §1.2, §1.3, §1.4,
  §1.5, §1.6, §4, §6 (read first; its verified table is the base this
  lane extends).
- Repo guide: `../BAWA-REPO-GUIDE.md` §3 (upstream pins: Wallet Core
  4.9.3 at `7a21615`; OKX JS SDK at `8d5e808`; TON SDK/WalletKit).
- Sol outputs: `out/sol-p1-metamask.md` … `out/sol-p5-synthesis.md`
  (prompts in `prompts/`, all ≤300 words).
- First-hand GitHub verifications (2026-11-18, this lane): trustwallet/
  wallet-core, ethers-io/ethers.js, MetaMask/core, MetaMask/
  browser-passworder, MetaMask/eth-hd-keyring, MetaMask/key-tree,
  solana-foundation/solana-web3.js, okx/js-wallet-sdk, RabbyHub/rabby
  (+ LICENSE file content), BlueWallet/BlueWallet, OneKeyHQ/app-monorepo,
  bitcoinjs/bitcoinjs-lib, bitcoinjs/bip32, bitcoinjs/bip39,
  alepop/ed25519-hd-key, trustwallet/wallet-core `wasm/tests/
  HDWallet.test.ts` (ETH `0x27Ef…` vector source).
- Generation proof: `tools/hdwallet-gen/sdk-pick-proof.js`,
  `proof/proof-output-2026-11-18.txt`.
