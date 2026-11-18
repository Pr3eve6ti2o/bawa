# Wallet reference map — Bawa panel rebuild

Lane: fix-vault (`panel-rebuild/fix-vault`), worktree off `feature/ai-wallet-builder` at `0759a81`.
Source: the research report (`panel-rebuild/research`, commit `57a6d37`,
`RESEARCH-REPORT.md`), whose URLs and file paths were verified first-hand
2026-11-18. This map transcribes that report's verified facts; it adds only
repo-verified facts from this worktree (marked "repo-verified").

Agent rule (report §1.6): an unresolved API or missing network integration
means "unsupported", not permission to invent an implementation. Never copy
test mnemonics, private keys or recipient addresses from upstream tests.
Never copy OneKey code without clearing the O-SSL licence gate (below).

## Pinned upstream commits

| Repo | Commit / branch | Licence (verified) | Role |
|---|---|---|---|
| Trust Wallet Core — https://github.com/trustwallet/wallet-core | master `7a21615` (verified 2026-11-18); **code pinned to npm 4.9.3**, not master | Apache-2.0 | Sole seed / HD / address / signing engine (WASM) for all four chains |
| BlueWallet — https://github.com/BlueWallet/BlueWallet | master `172c6768` | MIT | Production send/receive/QR workflow reference (Bitcoin only) |
| OneKey — https://github.com/OneKeyHQ/app-monorepo | branch **`x`**, commit `cd6c613` | **O-SSL (OneKey Standard Source License), NOT MIT/Apache** — GitHub reports NOASSERTION | Architecture reference ONLY (vault/keyring/service layering, secret-envelope design, ServiceSend ambiguous-broadcast rule). Read `LICENSE.md` and confirm permitted reuse before copying any OneKey code. Default: study/reference, do not copy. |
| MetaMask/core — https://github.com/MetaMask/core | main `1f153d4` | MIT | Vault/keyring architecture companion (`packages/keyring-controller/KeyringController.ts`, `packages/key-tree/`, `packages/cryptography/`); unlock/lock lifecycle; signing routed through a keyring boundary, never through UI components |
| bitcoinjs-lib / bip32 | tagged releases (README: master is dev) | MIT | Fallback only (BTC): `bip32` + `bitcoinjs-lib` `payments`/`Psbt` |
| ethers.js | tagged releases | MIT | Fallback only (ETH): `HDNodeWallet.fromPhrase()` |
| viem — https://github.com/wevm/viem | — | MIT per README (GitHub shows NOASSERTION: `LICENSE` is a symlink — read the file content) | ETH network ops: `createPublicClient({ chain: mainnet, transport: http() })` — balances, nonce, gas, broadcast |
| @ton/ton — https://github.com/ton-org/ton | — | MIT | TON network ops: `TonClient` vs TonCenter mainnet `https://toncenter.com/api/v2/jsonRPC`; `WalletContractV4` |
| @ton/crypto (npm v3.3.0) | — | MIT (npm) | TON fallback: `mnemonicToPrivateKey`, `mnemonicToHDSeed`, `deriveEd25519Path` (SLIP-10). **GitHub URL `ton-org/crypto` returns 404 — do not cite it.** Resolve the source repo from npm metadata before vendoring. |
| tronweb — https://github.com/tronprotocol/tronweb | 6.x TS rewrite | **MIT** (GitHub metadata + README; an earlier claim of LGPL-3.0 is wrong) | TRX network ops + fallback signing: `TronWeb.fromMnemonic()`, `TronWeb.address.fromPrivateKey()`, `trx.sign()`; RPC `https://api.trongrid.io` |

## Wallet Core 4.9.3 (pinned)

- npm `@trustwallet/wallet-core` **4.9.3** (`apps/web/package.json`), WASM copied
  to `dist` by `scripts/copy-wasm.mjs` (pinned binary, `scripts/wasm-integrity.mjs`).
- Existing WASM init: `apps/web/src/engine/boundary.ts` `initWasm()` (singleton,
  rejection does not poison the cache). The rebuild extends the same WASM object
  for creation/signing; it does not add a second engine.
- Audit status: one published review only —
  `audit/2023-09-15_TrustWallet_SecureCodeReviewReport_Public_v2.00.pdf`
  (2023 code review, **not** an audit of the 4.9.3 WASM artifact). Check 4.9.3
  security advisories before production.

## API sequence (Wallet Core WASM)

`HDWallet.create(entropyStrength, bip39Passphrase)` → `wallet.mnemonic()` →
`HDWallet.createWithMnemonic(mnemonic, passphrase)` →
`wallet.getAddressForCoin(CoinType.…)` / `getKeyForCoin` / `getKey(coinType, derivationPath)`.
Mnemonic validation: `TWMnemonic.h` (`Mnemonic.isValid` — fix lane to confirm
against 4.9.3). Authoritative API: `include/TrustWalletCore/TWHDWallet.h`
(`TWHDWalletCreate`, `CreateWithMnemonic`, `GetAddressForCoin`, `GetKey`,
`GetDerivedKey`, `GetExtendedPublicKey`). Coin types: `TWCoinType.h` (fix lane
to confirm against 4.9.3). Compare APIs and protobuf schemas with the vendored
4.9.3 package before adopting anything from master.

Matching upstream tests (all under `wasm/tests/`, master — note the
`Blockchain/` segment; `wasm/tests/Bitcoin.test.ts` is a wrong path):

- `wasm/tests/HDWallet.test.ts` — creation, mnemonic, multi-coin derivation.
  Published vector: `HDWallet.create(256, "password")` … `getAddressForCoin(CoinType.ethereum)`
  → `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979`.
- `wasm/tests/Blockchain/Bitcoin.test.ts`, `Ethereum.test.ts`,
  `TheOpenNetwork.test.ts` — signing examples per chain.
- `wasm/tests/StoredKey.test.ts`, `KeyStore.test.ts`, `Mnemonic.test.ts` —
  keystore / stored-key tests.
- Derivation paths + chain metadata: Wallet Core `registry.json` (repo root)
  per-coin derivation entries — consult instead of hardcoding one BIP-44 path
  per chain.

## Per-chain table

| Chain | Coin type | Derivation path (account 0, index 0) | Address derivation / signing engine | Network ops (mainnet) | Notes |
|---|---|---|---|---|---|
| BTC | `CoinType.bitcoin` | `m/84'/0'/0'/0/0` (BIP-84 segwit-bech32; change branch `m/84'/0'/0'/1/i`) | Wallet Core; fallback `bip32` + `bitcoinjs-lib` | Electrum over secure WebSocket or secured proxy (BlueWallet `blue_modules/BlueElectrum.ts` design; native TCP/TLS unusable in browser) or HTTP REST indexer | Only advertise send after fee/UTXO/sign/broadcast/confirm all work |
| ETH | `CoinType.ethereum` | `m/44'/60'/0'/0/0` (BIP-44) | Wallet Core; fallback `ethers` `HDNodeWallet.fromPhrase()` or viem local HD accounts | viem `createPublicClient({ chain: mainnet, transport: http() })` | Chain ID **1** enforced; no silent testnet fallback |
| TRX | `CoinType.tron` | `m/44'/195'/0'/0/0` (BIP-44) | Wallet Core; fallback `TronWeb.fromMnemonic()` | tronweb vs TronGrid `https://api.trongrid.io` (mainnet). **TronScan is a separate provider with separate keys — do not conflate** (2026-11-18 TRON correction) | Known defect: TRX 33-byte compressed pubkey aborts the 4.9.3 WASM runtime; 65-byte works; repo `tools/hdwallet-gen/derive.js` JS-first decompression applies. Re-test in the new code path. |
| TON | `CoinType.ton` | `m/44'/607'/0'` — fully hardened, one address per wallet (repo-verified: `tools/hdwallet-gen/derive-ton.js`) | Wallet Core (`wasm/tests/Blockchain/TheOpenNetwork.test.ts`); fallback `@ton/crypto` `mnemonicToPrivateKey` + `@ton/ton` `WalletContractV4` | @ton/ton `TonClient` vs TonCenter mainnet `https://toncenter.com/api/v2/jsonRPC` | Address depends on wallet-contract state init (version + params), not just pubkey hash. **Pinned: Wallet V4 R2, workchain 0, wallet ID 698983191** (repo-verified). Do not apply a BTC/ETH derivation recipe to TON. |

Repo-verified test vectors (public fixtures, not secrets):

- ETH (wallet-core `HDWallet.test.ts`): `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979`.
- TRX (repo-verified, main `74ae078`, 2026-11-18; also `apps/web/src/engine/boundary.test.ts`):
  index 0 → `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`, index 1 → `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B`.
- BTC/ETH watch-only fixtures in `apps/web/src/engine/boundary.test.ts`
  (zpub/ypub/xpub + derived addresses) — public test data, already in the repo.

## Mainnet network identity + providers

- BTC: mainnet only; Electrum-WS/proxy or HTTP indexer (adapter work, Phase 2).
- ETH: chain ID 1, viem public client over mainnet RPC.
- TRX: TronGrid `https://api.trongrid.io`; TronScan separate provider/keys.
- TON: TonCenter mainnet `https://toncenter.com/api/v2/jsonRPC`.
- No testnet entries anywhere in the new code. No silent testnet fallback.

## Vault parameters (Phase 1.1)

- WebCrypto **AES-GCM + PBKDF2** (follow OneKey's secret-envelope layering and
  MetaMask keyring-controller's unlock/lock lifecycle; do not invent crypto).
- Parameters (iterations, salt length, IV length) are recorded in
  `apps/web/src/wallet/vault.ts` next to the implementation and in
  `apps/web/REBUILD-EVIDENCE.md`; the vault stores only the encrypted envelope
  in localStorage. Keys/mnemonic are NEVER in localStorage plaintext, NEVER in
  React state, NEVER in logs.

## AGENTS.md acceptance rules (report §1.6 — local rules, enforced by this lane)

1. No plaintext secret persistence or logging (no mnemonics/seeds/keys/passwords
   in logs, telemetry, URLs, crash reports, React state or localStorage).
2. Transient secret memory only, inside an isolated keyring boundary; persist
   only the encrypted vault.
3. Mainnet allowlist, validate chain identity, no silent testnet fallback.
4. Real balances only — loading/unavailable/error states, never fabricated
   amounts or unverified zero.
5. Complete send flow (review → local sign → broadcast → report actual network
   status), never simulate success. **Broadcast stays DISABLED until separately
   authorised; this lane builds no broadcast path.**
6. Public fixtures stay in tests, never production defaults.

## Reference-file index (verified 2026-11-18, corrected paths)

- OneKey: `packages/kit-bg/src/services/ServiceAccount/ServiceAccount.ts`
  (`createHDWallet`/`createHDHiddenWallet`, PR #10412); `packages/kit-bg/src/dbs/local/localSecretEnvelope/service.ts`,
  `wrapping.ts`, `aesGcmLayerAdapter.ts`; `packages/kit-bg/src/dbs/local/LocalDbBase.ts`,
  `types.ts` (`IDBCredential`); `packages/kit-bg/src/vaults/impls/ton/KeyringHd.ts`,
  `Vault.ts`, `sdkTon/`; `packages/kit-bg/src/vaults/base/KeyringHdBase.ts`;
  `packages/kit-bg/src/vaults/base/VaultBase.ts`, `KeyringSoftwareBase.ts`;
  `packages/kit-bg/src/services/ServiceSend.ts` (1,042 lines; ambiguous-tx rule);
  `packages/core/src/chains/` + `packages/kit-bg/src/vaults/impls/` per chain.
  Fix lane to list the exact `btc`/`evm`/`tron` impl files when opening that work.
- BlueWallet (corrected, case-sensitive): `screen/send/SendDetails.tsx`,
  `screen/send/Confirm.tsx`, `screen/send/Broadcast.tsx`,
  `screen/send/ScanQRCode.tsx`, `screen/receive/ReceiveDetails.tsx`,
  `components/QRCode.tsx` (also `components/DynamicQRCode.tsx`),
  `class/wallets/hd-segwit-bech32-wallet.ts`,
  `class/wallets/abstract-hd-electrum-wallet.ts`,
  `blue_modules/BlueElectrum.ts` (1,446 lines), `components/SeedWords.tsx`,
  `components/AddressInputScanButton.tsx`, `components/CameraScreen.tsx`.
- MetaMask/core: `packages/keyring-controller/` (`KeyringController.ts` —
  content not read by the research lane; fix lane to read it before adopting
  the pattern), `packages/network-controller/`,
  `packages/transaction-controller/`, `packages/key-tree/`,
  `packages/cryptography/`; agent skills via `@metamask/skills` CLI.

## Open / unverified (carried from the research report §8)

- MetaMask `KeyringController.ts` content not read — read it before adopting.
- OneKey `ServiceAccount.ts` / `KeyringHd.ts` (TON) content not read line-by-line.
- Wallet Core `TWMnemonic.h` / `TWCoinType.h` named by Sol, not re-opened —
  confirm against 4.9.3.
- No published audit of the 4.9.3 WASM artifact exists.
- `@ton/crypto` source repo unresolved.
- Upstream links are to moving branches unless a commit is named above.

## Second governing roadmap — adopted 2026-11-18 (guide PR2/PR3)

Source: `BAWA-REPO-GUIDE.md` + `README.draft.md` + `AGENTS.draft.md` +
`wallet-build.example.json` + `wallet-build.schema.json`, owner-uploaded
2026-11-18, read in full by this lane. Orion verified the guide's core gap
first-hand (classifyRequest routes "Build a web wallet for Solana" to a
profile whose starter has no Solana support). The other AI's self-custody app
(`apps/self-custody`, commit 93088f0) does NOT exist on GitHub and does NOT
exist on this VM — it lives only on the other AI's local machine; it cannot
be used, copied or cited. This lane builds here, from `feature/ai-wallet-builder`
at `0759a81`, per the Mandatory Correction. PR1 (root README/AGENTS drafts,
stopping raw prompt retention) belongs to a separate lane, not this one.

### CAIP-2 network IDs (verified against multiple public sources 2026-11-18)

| Chain | CAIP-2 networkId | CAIP-19 native assetId |
|---|---|---|
| BTC mainnet | `bip122:000000000019d6689c085ae165831e93` (genesis hash) | `bip122:000000000019d6689c085ae165831e93/slip44:0` |
| ETH mainnet | `eip155:1` | `eip155:1/slip44:60` |
| TRX mainnet | `tron:0x2b6653dc` (decimal alias `tron:728126428`) | `tron:0x2b6653dc/slip44:195` |
| TON mainnet | `ton:-239` (global network ID) | `ton:-239/slip44:607` |
| Solana mainnet (unsupported, named only) | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | — (no asset; unsupported) |

### Pinned recovery profiles (a path change changes recovered addresses)

| Profile ID | Chain | Derivation path | Notes |
|---|---|---|---|
| `bawa-btc-bip84-v1` | BTC | `m/84'/0'/0'/0/i` (+ change `m/84'/0'/0'/1/i`) | BIP-84 segwit-bech32 |
| `bawa-evm-bip44-v1` | ETH | `m/44'/60'/0'/0/i` | Same ID as the guide's example build request |
| `bawa-trx-bip44-v1` | TRX | `m/44'/195'/0'/0/i` | BIP-44 |
| `bawa-ton-v4r2-v1` | TON | `m/44'/607'/0'` fully hardened | Wallet V4 R2, workchain 0, wallet ID 698983191 |
| `walletcore-solana-default-v1` | Solana | `m/44'/501'/0'` | UNSUPPORTED in this lane; named only, no code path |
| `solana-phantom-bip44change-v1` | Solana | `m/44'/501'/{i}'/0'` | UNSUPPORTED in this lane; OKX/Phantom bip44Change profile — distinct from the Wallet Core default even at index 0 |

Profiles are persisted with the encrypted vault (`vaultProfiles()`), and backup
instructions state the profile. A vault never silently changes its profile.

### Capability registry (guide §5 support matrix)

Keyed by (target=web, networkId, profileId, capability). Capabilities:
derive, restore, receive, balance, history, fee-quote, unsigned-plan,
local-sign, post-sign-verify. Statuses: `verified` (evidence exists),
`blocked` (missing adapter/infrastructure), `unsupported` (out of scope),
`candidate` (unreviewed). A capability with no evidence is never `verified`.

Current evidence in this lane (see `apps/web/REBUILD-EVIDENCE.md`):

| Chain | derive | restore | receive | balance | history | fee-quote | unsigned-plan | local-sign | post-sign-verify |
|---|---|---|---|---|---|---|---|---|---|
| BTC | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| ETH | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| TRX | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| TON | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| Solana | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported |

Blocked reasons: balance/history/fee-quote need Phase 2 adapters (not built);
unsigned-plan/local-sign/post-sign-verify need transaction construction +
signing verification (Phase 4, broadcast stays disabled). ETH is the PR3
priority slice: its create → backup → restore → receive path is proven first;
the other chains follow the same core, each listed as available only when its
adapter exists and its vectors pass.

### Upstream additions from the guide (§3)

- OKX JS Wallet SDK (`okx/js-wallet-sdk`, MIT, `8d5e808`) — Solana adapter
  reference (`@okxweb3/coin-solana`, explicit derivation/address/signing).
  PR4 only, not this lane. Do not install the whole SDK.
- TON SDK / WalletKit (`ton-org/ton`, MIT, `311dc33`; `ton-connect/kit-android`,
  MIT, `334abc3`) — TON per-family references; WalletKit documents V4R2/V5R1.
  Do not silently migrate the pinned V4R2 profile to V5R1.
- Phantom (Connect SDK, MIT, `512f721`) — recovery-path compatibility ONLY
  (published `bip44Change` paths). Never an on-device vault; never a
  dependency of the local build.
- Trust Wallet Core 4.9.3 stays the reference catalogue and first engine
  (registry snapshot: 168 rows, file SHA-256
  `9b6d3202e009dc5634531b84b4590d3d3fe6d08f1205f93f8eaae98444017240`).
  A registry row is not app coverage.
