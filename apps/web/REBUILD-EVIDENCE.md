# Bawa wallet-panel rebuild — evidence (fix-vault lane)

Branch: `panel-rebuild/fix-vault`, worktree off `feature/ai-wallet-builder` at `0759a81`.
Scope: Phases 0 + 1 only (vault + wallet creation/import). Local commits only, never pushed.
Spec: research report `panel-rebuild/research` commit `57a6d37` + `docs/wallet-reference-map.md`.

## Second governing roadmap — adopted 2026-11-18

Guide files read in full by this lane: `BAWA-REPO-GUIDE.md` (156 lines),
`README.draft.md`, `AGENTS.draft.md`, `wallet-build.example.json`,
`wallet-build.schema.json` (VM `/home/boxd/workspace/bawa-panel-rebuild/`).
Adoption confirmed. The guide's core gap (classifyRequest routing a Solana web
request to a starter with no Solana support) was verified first-hand by Orion.
The other AI's self-custody app does NOT exist on GitHub or this VM — it is not
used, copied or cited here. PR1 is a separate lane's scope, not this lane's.

### Capability-registry design (guide §2 P0 + §5)

`apps/web/src/wallet/chains.ts` is a capability registry, not a chain list.
Keyed by (target=web, CAIP-2 networkId, profileId, capability). Capabilities:
derive, restore, receive, balance, history, fee-quote, unsigned-plan,
local-sign, post-sign-verify. Statuses: verified / blocked / unsupported /
candidate. A capability with no evidence is `unsupported`/`blocked`, never
silently `verified`. The UI may list a chain for an operation only when
`availableFor(capability)` returns it (status verified).

| Chain (networkId) | derive | restore | receive | balance | history | fee-quote | unsigned-plan | local-sign | post-sign-verify |
|---|---|---|---|---|---|---|---|---|---|
| BTC (`bip122:000000000019d6689c085ae165831e93`) | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| ETH (`eip155:1`) | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| TRX (`tron:0x2b6653dc`) | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| TON (`ton:-239`) | verified | verified | verified | blocked | blocked | blocked | blocked | blocked | blocked |
| Solana (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`) | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported |

Blocked reasons: balance/history/fee-quote need Phase 2 adapters (not built in
this lane); unsigned-plan/local-sign/post-sign-verify need transaction
construction + signing verification (Phase 4; broadcast stays disabled).
PR3 priority: the Ethereum create → backup → restore → receive path is proven
first; BTC/TRX/TON follow the same core, each available only when its adapter
exists and its vectors pass.

### Pinned recovery profiles

Profiles are persisted with the encrypted vault (`vaultProfiles()`), and backup
instructions state the profile. A vault never silently changes its profile.

| Profile ID | Chain | Path |
|---|---|---|
| `bawa-btc-bip84-v1` | BTC | `m/84'/0'/0'/0/i` (change `m/84'/0'/0'/1/i`) |
| `bawa-evm-bip44-v1` | ETH | `m/44'/60'/0'/0/i` |
| `bawa-trx-bip44-v1` | TRX | `m/44'/195'/0'/0/i` |
| `bawa-ton-v4r2-v1` | TON | `m/44'/607'/0'` fully hardened, Wallet V4 R2, workchain 0, wallet ID 698983191 |
| `walletcore-solana-default-v1` | Solana | `m/44'/501'/0'` — unsupported, named only |
| `solana-phantom-bip44change-v1` | Solana | `m/44'/501'/{i}'/0'` — unsupported, named only |

The two Solana profiles are distinct derivations even at index 0. No Solana
support is added in this lane; no single Solana path is hard-coded anywhere.

### Phase 0.3 verification — chains.ts (2026-11-18, first-hand)

`apps/web/src/wallet/chains.ts` + `chains.test.ts` written HANDS-ON by the lane
agent (0 Sol calls): Sol call 2c (impl + tests, 297 words) failed after ~48 min
with an upstream-transient stream error, and its micro-split 2d (impl only,
249 words) failed the same way after ~60 min. The module is a pure
data registry fully specified in the prompt, so it was written from that spec
and verified directly; the hands-on version stands as the implementation.

Verification (VM, `apps/web`): `npx tsc --noEmit` exit 0; `npx vitest run
src/wallet/chains.test.ts` 15/15 pass; full suite 11 files / 169 tests pass
(baseline 144 + core.test.ts 10 + chains.test.ts 15). Tests assert: exactly
four mainnet chains; mainnet CAIP-2 IDs (`eip155:1`, `bip122:…`, `tron:0x2b6653dc`,
`ton:-239`); CAIP-19 asset IDs via slip44; account-0 paths from the pinned
profiles; fully hardened TON path with no index suffix; `availableFor('derive'|'restore'|'receive')`
returns all four, `availableFor` for the six adapter/tx capabilities returns
none; `assertSupported` throws naming the exact unavailable combination;
registry text contains no `testnet`/`Sepolia`/`Nile` string; `chainConfigForNetwork`
throws for any non-mainnet ID; both Solana profiles exist only as `unsupported`.

### Phase 1.1 verification — vault.ts (2026-11-19, first-hand)

`apps/web/src/wallet/vault.ts` + `vault.test.ts` written HANDS-ON by the lane
agent (0 Sol calls): Sol call 3d (impl only, 231 words) failed after ~53 min
with the same upstream-transient stream error as 2c/2d (third consecutive
failure; only 1c has landed in this lane). The module is fully specified in
the prompt, so it was written from that spec and verified directly.

Verification (VM, `apps/web`): `npx tsc --noEmit` exit 0; `npx vitest run
src/wallet/vault.test.ts` 10/10 pass; full suite 13 files / 182 tests pass
(baseline 144 + core 10 + chains 15 + vault 10 + context 3). Tests assert:
vault creation + `vaultProfiles()`; the stored envelope contains no plaintext
mnemonic or password (raw localStorage string searched); envelope parameters
(version 1, PBKDF2-HMAC-SHA256 600,000 iterations, 16-byte salt, 12-byte IV);
unlock with the right password exposes the mnemonic only via `withMnemonic`
while unlocked; wrong password throws one fixed message and stays locked;
second `createVault` throws; empty mnemonic/password throw; `changePassword`
re-encrypts and keeps stored profiles; tampered ciphertext fails closed
(wrong-password error, no oracle); structurally invalid envelope fails closed
(corrupted error); `deleteVault` removes the envelope. WebCrypto AES-GCM-256
+ PBKDF2. The mnemonic lives only transiently in the vault module closure;
JavaScript strings are immutable, so "zeroing" means dropping every reference
on lock — recorded honestly, no stronger claim is made.

### Phase 1.4 verification — wallet-context + providers.ts (2026-11-19, first-hand)

`apps/web/src/state/wallet-context.tsx` extended HANDS-ON (per
`lane/context-design.md`, to preserve the epoch/hydration/not-account-key
logic verbatim) and `apps/web/src/wallet/providers.ts` added (types + registry
only). New context surface: `vaultState` (`no-vault`/`locked`/`unlocked`),
`vaultAddresses` (public account-0 addresses, one per chain), `vaultProfileIds`,
`unlockVault(password)`, `lockVault()`, `refreshVaultAccounts()`,
`balances` (per chain: `loading`/`zero`/`available`/`unavailable`/`error`,
initial `unavailable` / `no-adapter`), `refreshBalances()`. Watch-only xpubs
are unchanged and stay a separate, explicitly labelled account type; an xpub
can never be upgraded into signing keys. `lock()` (no-arg) also locks the vault
and clears vault addresses; `unlock()` (no-arg) re-derives watch-only only.

Correction recorded in `lane/context-design.md`: `BalanceState` gained an
`available` status for a non-zero provider balance (the design's four statuses
had no state for it); `createVault` takes the pinned profileIds; `chains.ts`
exposes `availableFor(capability)`, not `availableChains(kind)`.

Verification: `npx tsc --noEmit` exit 0; `src/wallet/wallet-context.test.tsx`
3/3 pass (unlock derives vault addresses identical to `core.deriveAddresses`
for all four chains; wrong password rejected; balances `unavailable` /
`no-adapter` for all chains with no provider registered); full suite 13 files /
182 tests pass.

## SDK/core pick — evaluation + working generation proof (owner addition 1)

The chosen SDK/core is the SINGLE wallet-generation engine for the rebuild:
Trust Wallet Core 4.9.3 (WASM `HDWallet` API). `core.ts` uses it and nothing
else for seed/HD/signing. The pick is justified below, not assumed.

### Comparison (starting point: research report §1.1, verified first-hand 2026-11-18)

| SDK/core | What it generates | Chains | Licence | Maintenance / audit |
|---|---|---|---|---|
| **Trust Wallet Core 4.9.3 (WASM)** | BIP-39 mnemonic from entropy, BIP-32 HD seed, per-coin keys, addresses, local signing (AnySigner) | BTC/ETH/TRX/TON + 130+ (one seed, one pipeline) | Apache-2.0 | Active (master `7a21615`); one published 2023 code review only — NOT an audit of the 4.9.3 WASM artifact |
| bitcoinjs-lib + bip32 | BIP-32 keys, BTC addresses, PSBT signing | BTC only | MIT | Active; no whole-library audit verified |
| ethers | HDNodeWallet from phrase, ETH addresses/signing | ETH (EVM) only | MIT | Active; no whole-library audit verified |
| viem | Local HD accounts, signing, RPC clients | ETH (EVM) only | MIT per README | Active; no SDK audit verified |
| @ton/ton + @ton/crypto | TON mnemonic/SLIP-10 keys, WalletContractV4 | TON only | MIT | Active; no audit verified; @ton/crypto source repo unresolved (npm only) |
| tronweb | Mnemonic, TRX addresses, trx.sign() | TRX only | MIT | Active, 6.x TS rewrite; no audit verified |

### Why Wallet Core

Only Wallet Core covers all four required chains (BTC/ETH/TRX/TON) from one
BIP-39 seed through one HD derivation pipeline — the per-chain SDKs each cover
one chain, so using them for keys would mean four separate, potentially
inconsistent derivation pipelines. It is already vendored and pinned at 4.9.3
with WASM integrity checks (`scripts/copy-wasm.mjs`,
`scripts/wasm-integrity.mjs`), Apache-2.0, and its `HDWallet` API
(`createWithEntropy` / `createWithMnemonic` / `getAddressForCoin` / `getKey`)
was verified first-hand against the vendored 4.9.3 typings.

### Explicit gap — no single SDK covers everything

Wallet Core supplies seed/HD/address/signing ONLY. It supplies NO balances, NO
RPC, NO broadcast and NO history. Per-chain network operations need separate
adapters (Phase 2): ETH via viem, TRX via tronweb/TronGrid, TON via
@ton/ton/TonCenter, BTC via Electrum-WS/proxy or HTTP indexer. No SDK
evaluated here covers both generation and network operations for all four
chains; the rebuild does not pretend one does.

### Working generation proof (this repo's environment, 2026-11-18)

Probe: ephemeral `/tmp/trx-probe.js` on muse-vm, wallet-core 4.9.3, node.
A FRESH disposable test mnemonic was generated in-script with
`HDWallet.createWithEntropy(crypto.getRandomValues(32), '')` — never printed,
never committed, never funded. Real mainnet addresses derived from it:

- Fresh mnemonic: 24 words, `Mnemonic.isValid` true.
- BTC: `bc1qgtvgyrjclgcgr63h6ffynhn88yc5u7uuzk36qa`, `CoinTypeExt.validate` true.
- ETH: `0xb3e37E2762cC2fb47Ad3B9e419a3A700D1AAD198`, validate true.
- TRX: `TTitJGuqD9R5JPzCdXfnyMk3agk3QERzth`, validate true (65-byte path; see below).
- TON: `UQASc_jJwKH9ULuQ3b9XaAG6kdLewRznS5F2JPmC9mLtbk8J`, validate true, UQ (non-bounceable, tag 0x51), workchain 0 (V4).
- ETH published vector (wallet-core `HDWallet.test.ts`, TREZOR passphrase):
  `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979`, match=true.
- TRX 33-byte abort reproduced on 4.9.3 and fixed by the 65-byte path
  (see Hands-on probes below).

## Layout-page API (owner addition 2 — the later Phase 5 lane builds the page)

The layout page is NOT built in this lane. These modules expose everything it
needs, so it can be built directly on them with no rework:

- `wallet/core.ts` — `createWallet(passphrase?)`, `restoreWallet(mnemonic, passphrase?)`, `deriveAddresses(mnemonic, passphrase?)` (account-0 index-0 per chain), `deriveFromXpub(chain, xpub, index)`, `withSigningKey(...)` (transient signing keys, callback-scoped). The created wallet's accounts with real mainnet addresses per chain.
- `wallet/chains.ts` — capability registry: `CHAINS`, `chainConfig(chain)`, `profileFor(chain)`, `capabilitiesFor(chain)`, `availableFor(capability)`, `assertSupported(chain, capability)`. The layout page lists a chain for an operation only via `availableFor`.
- `wallet/vault.ts` — `createVault(mnemonic, password, profileIds)`, `hasVault()`, `vaultProfiles()`, `unlock(password)`, `lock()`, `isLocked()`, `withMnemonic(fn)`, `changePassword`, `deleteVault`. Lock/unlock actions.
- `wallet/providers.ts` (types + registry, hands-on) — `BalanceProvider` interface (`getBalance`, `getHistory`) and `registerBalanceProvider(chain, provider)`; Phase 2 adapters implement it. Until an adapter registers, balances report `unavailable`.
- `state/wallet-context.tsx` — `vaultState` (`no-vault`/`locked`/`unlocked`), `vaultAddresses` (per-chain real addresses), `balances` (per-chain `{status: 'loading'|'zero'|'available'|'unavailable'|'error', value?}` — the `available` status was added for a non-zero provider balance; the design's four statuses had no state for it), `refreshBalances()`, `unlockVault(password)`, `lockVault()`, `refreshVaultAccounts()`, plus the separate watch-only `xpubs` set. Receive action reads the address from `vaultAddresses`; send is exposed as blocked until Phase 4 (`assertSupported` throws the exact unavailable combination).
- Real balance states are loading / zero / unavailable / error — never a fabricated number and never a silent zero on failure.

## Sol calls

See `lane/RUN-LOG.jsonl` (record of truth). Summary: 7 Sol calls made, 1 landed.
- Call 1 (299 words): failed — no delivery (Sol replied it has no tools, wrote nothing).
- Call 1b (286 words, core.ts + core.test.ts): failed — upstream-transient after ~60 min.
- Call 1c (234 words, core.ts impl only): LANDED in ~19 min (8,165 bytes).
- Call 2c (297 words, chains.ts + tests): failed — upstream-transient after ~48 min.
- Call 2d (249 words, chains.ts impl only): failed — upstream-transient after ~60 min.
- Call 3d (231 words, vault.ts impl only): failed — upstream-transient after ~53 min.
- Call 4c (299 words, create-wallet rewrite): failed — runner timeout after 60 min, no output.
- Call 5c was NOT attempted: four consecutive gateway failures, and the prompt (two screens) is bigger than 4c. Import + backup were written hands-on from the prompt 5c spec instead.
- Hands-on (0 Sol calls): `core.test.ts`, `chains.ts` + `chains.test.ts`, `vault.ts` + `vault.test.ts`, `wallet-context.tsx` extension + `providers.ts` + `wallet-context.test.tsx`, `create-wallet.tsx` + `create-wallet.test.tsx`, `import-wallet.tsx` + `mnemonic-backup.tsx` + their tests, `demo-fixtures.ts` emptying, `app.test.tsx` heading update. Every hands-on file was verified first-hand (tsc + vitest + build, see §6.9).
- Model: gpt-6.1-sol, API 1 only, cap 32,000 max_output_tokens, max reasoning. No 402/403 occurred.

### Phase 1.2 verification — create-wallet.tsx (2026-11-19, first-hand)

Written HANDS-ON from the prompt 4c spec after call 4c timed out at 60 min.
Four steps: (1) vault password twice, ≥8 characters, must match; (2) generate
with `createWallet` (CSPRNG entropy, 24 words), mnemonic shown once as a
numbered word grid with never-photograph/share/store-digitally warnings;
(3) recovery confirmation — three randomly chosen word positions, progress
blocked until all correct; (4) on success, `createVault` with all four pinned
profileIds, mnemonic cleared immediately, `unlockVault(password)` +
`refreshVaultAccounts()`, derived account-0 addresses shown ETHEREUM FIRST,
then BTC, TRX, TON. Existing vault blocks creation with a link to Security.
Mnemonic cleared on unmount and on every error path; it lives in the screen's
local state only. No dark-navy mock styling. File-header comment records the
mnemonic-handling rule.

Verification: `npx tsc --noEmit` exit 0; `src/screens/create-wallet.test.tsx`
4/4 pass (mocked core/vault): mismatched passwords block generation; wrong
confirmation words block progress; correct confirmation calls `createVault`
with all four profileIds and clears the words; existing vault blocks creation.
Real creation/recovery proven by `core.test.ts` + `vault.test.ts`.

### Phase 1.3 verification — import-wallet.tsx + mnemonic-backup.tsx (2026-11-19, first-hand)

Written HANDS-ON from the prompt 5c spec (call 5c not attempted — see above).
Import has two modes, defaulting to watch-only so existing behaviour and
tests are preserved. Mode A (recovery phrase): 12/24-word input, validated
with `restoreWallet` (`Mnemonic.isValid`), derived account-0 addresses shown
ETHEREUM FIRST before a vault password is set, `createVault` with all four
pinned profileIds, input cleared immediately after use and on unmount.
Mode B (watch-only xpub): existing behaviour kept verbatim — chain selector,
`validateWatchOnlyImport`, secret-like input rejected and cleared at once,
the "never paste a mnemonic, seed or private key here" warning, watch-only
accounts labelled and unable to sign. Backup screen: checklist (written on
paper, stored offline in two places, never shared, never photographed), states
the stored recovery profiles from `vaultProfiles()`, warns restoring with a
different profile recovers different addresses, states nothing to back up
without a vault, keeps the statement that an xpub alone cannot recover
spending access. Neither screen reuses the dark-navy mock styling.

Verification: `npx tsc --noEmit` exit 0; `src/screens/import-wallet.test.tsx`
8/8 pass (5 pre-existing watch-only tests untouched and passing, 3 new
recovery-phrase tests using the real WASM core and vault: invalid phrase
rejected and cleared; valid phrase restores and shows the same addresses
`core.deriveAddresses` produces; save flow creates the vault); `src/screens/mnemonic-backup.test.tsx`
2/2 pass (nothing to back up without a vault; profiles listed with a vault).
One pre-existing test updated: `src/app/app.test.tsx` expected the old
heading 'Import a watch-only wallet'; the screen now imports vault wallets
too, so it expects 'Import a wallet'.

## §6 verification evidence

### 1. Wallet creation (fresh mnemonic, CSPRNG entropy)

`src/wallet/core.test.ts` (10/10 pass, 2026-11-19): fresh `createWallet()` returns
24 words, `Mnemonic.isValid` true, entropy from `crypto.getRandomValues` (never
`Math.random`). The create screen's mocked test (4/4 pass) proves the UI flow
(password → generate → confirm → vault). Lane files: 7/7 pass, 52/52 tests.

### 2. Wallet recovery with IDENTICAL derived addresses

`src/wallet/core.test.ts`: restore round-trip — `restoreWallet` of the created
mnemonic derives the identical BTC/ETH/TRX/TON addresses. `src/wallet/wallet-context.test.tsx`
(3/3): `unlockVault` derives vault addresses identical to `core.deriveAddresses`
for all four chains. `src/screens/import-wallet.test.tsx` (8/8): a valid phrase
import derives the same addresses `deriveAddresses` produces. No test shows
divergent addresses.

### 3. Correct chain-specific derivation (paths from registry.json)

Paths: BTC m/84'/0'/0'/0/0, ETH m/44'/60'/0'/0/0, TRX m/44'/195'/0'/0/0, TON m/44'/607'/0' (fully hardened).

`src/wallet/chains.test.ts` (15/15) asserts the account-0 paths from the pinned
profiles, the fully hardened TON path with no index suffix, and rejection of
negative/non-integer account/index values. `src/wallet/core.test.ts` (10/10)
asserts derivation against the published vectors (see §6.4) and the repo xpub
fixtures.

### 4. Valid mainnet addresses (format + checksum)

- ETH vector (wallet-core HDWallet.test.ts, public fixture): `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979` — verified hands-on 2026-11-18 (see probe below).
- TRX index 0 → `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`, index 1 → `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` — verified hands-on (see probe below).

`src/wallet/core.test.ts` (10/10): every derived address passes
`CoinTypeExt.validate`; the ETH vector matches exactly; TRX/BTC/ETH xpub
fixtures match; TON xpub derivation is rejected (fully hardened Ed25519 cannot
derive children from an xpub). The two `Aborted(Assertion failed…)` lines in
the core test output are the EXPECTED raw-WASM trap tests proving the TRX
33-byte abort and the BTC uncompressed abort — the tests pass because the abort
is the asserted behaviour.

### 7. No demo balances or fake transaction data

PARTIAL — recorded honestly. `src/state/demo-fixtures.ts` was emptied to zero
entries on 2026-11-19 (fake `$12,480.62` total and per-asset values removed;
`DEMO_PORTFOLIO.total` is now `'Unavailable'`, `DEMO_ASSETS` is `[]`, with a
blocking TODO). Grep results in `apps/web/src` (2026-11-19):
- `$12,480`: 0 hits.
- `Testnet4`: 0 hits.
- `Sepolia` / `Nile`: hits remain ONLY in pre-existing, out-of-scope files —
  `src/engine/destination.ts` (a comment and an error string about testnet
  name ambiguity), `src/engine/confirmation-policy.md` (docs), and
  `src/screens/network-selection.tsx` (the network selector offering Sepolia /
  Nile as testnet options). None is a demo balance; the network selector is a
  Phase 2/5 screen, not touched by this lane.
- `demo-fixtures`: 4 hits — the import statements in `dashboard.tsx`,
  `asset-list.tsx`, `asset-detail.tsx`, `wallet-management.tsx` (Phase 2/5
  screens). The file itself contains no fake values any more. Deleting the file
  and those imports is the Phase 2/5 lanes' work; until then item 7 stays
  partial.

### 8. No private keys or mnemonics in requests, logs or persistent plaintext storage

- No network requests exist in the new code: `grep fetch\(|axios|XMLHttpRequest`
  in `src/wallet` + the three rewritten screens → zero hits.
- No logging in the new code: `grep console.log|console.warn|console.error` in
  `src/wallet`, `src/screens`, `src/state` (excluding tests) → zero hits.
- Persistent storage: only three localStorage keys exist in `src` —
  `bawa-vault` (AES-GCM-256 encrypted envelope: version, KDF params, salt, IV,
  ciphertext, profileIds — never a mnemonic, seed, key or password),
  `bawa-watch-only-xpubs` (public xpubs + labels only), and the theme
  preference. `src/wallet/vault.test.ts` (10/10) asserts the raw stored
  envelope string contains neither the test mnemonic nor the password.
- The words `mnemonic`/`seed`/`privateKey` appear in shipped code only as API
  names, comments and UI copy — never as secret values. Published public test
  vectors (ETH TREZOR vector, `abandon`×11+`about`) appear only in `*.test.ts`
  files, never in shipped code. The mnemonic lives only in the create/import
  screens' local state during write-down/confirmation and in the vault module
  closure while unlocked; it is cleared on unmount, on error paths, on lock,
  and immediately after vault creation.

### 9. Build, tests, typecheck

Baseline before lane work (2026-11-18, worktree at 0759a81, node v24.22.2, `npm ci --force` — see note below): vitest 9 files, 144 tests, all pass.

Final (2026-11-19, worktree `panel-rebuild/fix-vault`, same environment):
- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — 15 files, 191 tests, all pass (baseline 144 + 47 new:
  core 10, chains 15, vault 10, context 3, create 4, import 3 new, backup 2;
  lane files alone: 7 files, 52 tests, all pass).
- `npm run build` — exit 0, `✓ built in 1.81s` (chunk-size warning only,
  pre-existing).

## Hands-on probes (2026-11-18, wallet-core 4.9.3, node)

Probe script: ephemeral `/tmp/trx-probe.js` on muse-vm (fresh disposable mnemonic generated in-script, never printed, never committed). Full output recorded in lane notes.

- Fresh mnemonic via `HDWallet.createWithEntropy(crypto.getRandomValues(32), '')`: 24 words, `Mnemonic.isValid` true.
- ETH TREZOR vector: `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979`, match=true.
- BTC/ETH/TON from the same fresh wallet: all `CoinTypeExt.validate` true; TON `UQ…` (non-bounceable, tag 0x51), workchain 0 (V4).
- TRX 33-byte abort REPRODUCED: `getKey(tron, m/44'/195'/0'/0/0)` → `getPublicKeySecp256k1(true)` (33 bytes, compressed) → `deriveAddressFromPublicKey` aborts with `Aborted(Assertion failed: Exception thrown, but exception catching is not enabled...)`. Process survived; the call itself fails.
- TRX 65-byte path works: `.uncompressed()` (65 bytes) → `TTitJGuqD9R5JPzCdXfnyMk3agk3QERzth`, valid=true; identical via `PublicKey.createWithData(65B, secp256k1Extended)` and via direct `getAddressForCoin(tron)`.
- Root cause pinned: `HDWallet.getPublicKeyFromExtended` returns the form each chain's derivation needs — BTC 33-byte COMPRESSED (keyType 0), ETH and TRX 65-byte UNCOMPRESSED (keyType 1) — verified hands-on for TRX index 0/1 → `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` / `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B`, valid=true. The rule is PER-CHAIN, not blanket uncompression: forcing `.uncompressed()` aborts BTC derivation, and forcing a compressed key aborts TRX derivation (both proven by `core.test.ts` raw-WASM tests). `deriveFromXpub` therefore passes the xpub-derived pubkey through unchanged.

## Notes / limitations

- Node version: the VM has node v24.22.2; `apps/web` engines require `>=22 <23`. `npm ci` fails on the engine check; `npm ci --force` installs cleanly (260 packages) and the baseline suite passes 144/144. No Node 22 is installed on the VM. This is an environment deviation, recorded, not hidden: build/test evidence in this file was produced on node v24 with `--force`.
- Mainnet broadcasting stays DISABLED; this lane builds no broadcast path.
- No real user funds or seed phrases were used. All test mnemonics are fresh disposable or published public test vectors, confined to tests.

## Incomplete / open

- §6 item 7 is PARTIAL: fake values are gone (`$12,480` 0 hits, `Testnet4` 0
  hits), but `demo-fixtures` still has 4 import hits in the Phase 2/5 screens
  (dashboard, asset-list, asset-detail, wallet-management) and `Sepolia` /
  `Nile` still appear in pre-existing out-of-scope files (network selector,
  destination.ts, confirmation-policy.md). Deleting the fixtures file and
  those imports, and wiring the screens to real balances, is the Phase 2/5
  lanes' work; the blocking TODO is in `src/state/demo-fixtures.ts`.
- BIP-39 passphrases (25th word) are supported by `core.ts`
  (`createWallet`/`restoreWallet` take a passphrase) but have NO UI in the
  create/import screens. A user restoring a passphrase-protected wallet
  would derive wrong addresses with no warning. A later lane should add an
  optional passphrase field (and state the profile implication).
- Indexed accounts beyond account 0 / index 0 are an extension point
  (`deriveFromXpub` exists; `vault.withMnemonic` can derive more), not
  implemented in this lane. The layout page shows account-0 addresses only.
- `deriveMore(chain, count)` from the context design was deferred for the
  same reason; recorded here, not silently dropped.
- The gateway failed 4 consecutive Sol calls in this lane (2c, 2d, 3d
  upstream-transient; 4c 60-min timeout); only 1c landed. Six of the seven
  lane modules were therefore written hands-on from the prompt specs and
  verified first-hand. If the coordinator wants Sol authorship on any of
  them, the prompts are in `lane/` and can be re-run when the gateway
  recovers — but the verified hands-on versions should not be replaced
  without re-running the full suite.
- The wallet panel layout page itself (Phase 5) is not built in this lane;
  the API it needs is recorded above under "Layout-page API".
- No balance/history/fee-quote/signing UI exists yet (capabilities blocked,
  no Phase 2 adapter, no Phase 4 transaction construction); `refreshBalances`
  reports `unavailable` / `no-adapter` for every chain, honestly.
- `npm run build` chunk-size warning is pre-existing (3.2 MB JS bundle);
  not addressed in this lane.

## Phase 2 + 3 — Real balances/history + receive/QR (Fix Lane 2, 2026-11-19)

Branch `panel-rebuild/fix-adapters`, worktree `fix-adapters/`, local commits only, never pushed.
Parent: Fix Lane 1 `panel-rebuild/fix-vault` at `057655b`. Node 22.23.4 via nvm for all runs.

Commits (this lane):
- `d87139c` — Phase 2 chain adapters (BTC/ETH/TRX/TON) + shared types (P1–P5).
- `4e607c2` — Dashboard + asset list on real balances (P6).
- `48bc995` — Adapter-backed balances/history in context + screens (P7).
- `fbc0b9a` — Receive + QR and standalone QR scanner (P8).
- `faf68da` — Capability registry + adapter wiring (P9a).
- `87c4ab2` — Cleanup: demo fixtures deleted, mainnet-only copy (P9b).

### Sol calls (actual durations)

- lane2-1 (p1 adapter types, 299 words): 45 s, FAILED — refusal; the runner session has no filesystem/shell tools, so Sol asked for files to be pasted.
- lane2-1b (p1b adapter types, 299 words): launched ~02:01 IST 2026-11-19, STILL RUNNING at 02:42 IST (42+ min elapsed, PIDs 614988/614990), no output file. Never killed (lane rule). The hands-on P1 stands as the verified version.
- No other Sol calls were launched in this lane. P2–P9b were written hands-on from the prompt specs and verified first-hand. Sol tally: 2 calls made, 0 landed as code.
- Owner 500-second rule (2026-11-19 ~02:41 IST): the p2–p6 prompts were re-split into one-function prompts (lane/p2a–p6b, bodies 77–149 words; index lane/SPLIT-PROMPTS.md). None launched — the work was already complete. Any future rework launches the small prompt, never the original.

### §6 item 5 — Accurate read-only mainnet balances, cross-checked (2026-11-19 ~02:42–02:44 IST)

Live adapter integration test (temporary file `live-check.test.ts`, run once, then deleted): 4/4 passed in 4.31 s. Each adapter was called with its real code and real fetch, and the value compared live against a second source.

| Chain | Address | Adapter (source) | Adapter value | Second source | Second value |
|---|---|---|---|---|---|
| BTC | bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd | mempool.space | 0 sats (funded 311775 − spent 311775) | blockstream.info | 0 sats (funded 311775 − spent 311775) |
| ETH | 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7 | publicnode eth_getBalance | 0 wei (`0x0`) | eth.blockscout.com balance | 0 wei (`"0"`) |
| TRX | TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c | TronGrid /v1/accounts | 0 SUN (no balance field) | TronGrid /wallet/getaccount (second endpoint) | 0 SUN (no balance field) |
| TON | UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn | TonCenter getAddressBalance | 0 nanoTON (`"0"`) | tonapi.io | 0 nanoTON (`balance: 0`) |

All four fixture addresses are exact-zero balances — verified as data by two sources each, not failed fetches. A failed fetch shows "unavailable", never zero (adapter tests + context tests cover the mapping).
Limitation: TRX's independent second source (TronScan API) was rate-limited at check time ("request rate exceeded", suspension 89 s), so the TRX cross-check used TronGrid's second endpoint — same provider, weaker independence. The account demonstrably exists (create_time 2021, recent operation time, TRC20 holdings present), so "no balance field → 0 TRX" is the provider's answer, not a missing account.
Limitation: no live non-zero mainnet balance was checked (no funded public address was used). Non-zero rendering is covered by unit tests with stubbed adapters (e.g. 1.5 ETH renders "1.5 ETH").

### §6 item 7 — No demo balances or fake transaction data

`grep -rn "demo-fixtures\|\$12,480\|Testnet4\|Sepolia\|Nile" apps/web/src/` → ZERO hits (grep exit 1), 2026-11-19 ~02:39 IST.
`apps/web/src/state/demo-fixtures.ts` DELETED (commit `87c4ab2`); its last import (wallet-management.tsx) removed.
Test guards now assert no `$` amount appears at all in the rendered balance screens (dashboard/asset-list/asset-detail tests), so the zero-hit grep is literal, not evaded.

### §6 item 8 — No private keys or mnemonics in requests, logs or plaintext storage

- `grep -rni "mnemonic\|seed\|privateKey\|private.key\|xprv" apps/web/src/wallet/adapters/` → only 2 hits, both a doc comment in `types.ts` stating the policy (adapters "take public addresses only and never see a seed, mnemonic, private key or xpub"). No code hits.
- Adapters send public addresses only: single `fetchJson` call site (`adapters/types.ts:104`); ETH via viem `client.getBalance({address})` (publicnode); TON via TonCenter `getAddressBalance {address}`; TRX/BTC via `fetchJson` with the address in the URL. No seed, mnemonic, private key or xpub is passed to any provider.
- localStorage keys in `apps/web/src`: `bawa-vault` (Lane 1 encrypted vault envelope only), `bawa-watch-only-xpubs` (public xpubs + labels, never secrets), theme preference. No plaintext secrets in state, refs, localStorage, logs, telemetry, URLs or crash reports.

### §6 item 9 — Build, tests, typecheck (2026-11-19)

- `npx tsc --noEmit` in `apps/web`: exit 0.
- `npx vitest run` in `apps/web`: 281/281 passed (22 test files).
- `npm run build` in `apps/web`: exit 0, "✓ built in 1.49s". Advisory only: vite chunk-size warning (index.js 3,595.96 kB, gzip 500.37 kB — wallet-core WASM + viem in one chunk; code-splitting is Phase 5/out of scope).

### Receive QR correctness

Generated real QR PNGs for the exact payloads the receive screen encodes and decoded them with jsqr 1.4.0 (the version the QrScanner component uses): 5/5 decode byte-exactly (exit 0).
- ETH vault-derived address `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979` → decodes exactly.
- BTC payment URI `bitcoin:bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd?amount=0.001` → decodes exactly.
- ETH payment URI `ethereum:0x27Ef5cDBe01777D62438AfFeb695e33fC2335979?value=500000000000000000` (0.5 ETH in wei) → decodes exactly.
- TRX plain address `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` → decodes exactly.
- TON plain address `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` → decodes exactly.
Chain selector lists only `availableFor('receive')` chains; vault-derived address first, watch-only fallback with the watch-mode alert ("Watch-only account — this address can receive, but this wallet cannot sign or send from it."). The receive screen test asserts the vault address renders and the QR SVG is present.
Boundary, stated plainly: the decode check used generated QR PNGs of the exact payloads, not the rendered `qrcode.react` SVG from the screen (SVG path data is not decodable by jsQR). The screen's `qrValue` equals the address (or the payment URI when an amount is set) by construction, and the payloads decode exactly.

### Capability updates (chains.ts)

| Chain | balance | history | fee-quote |
|---|---|---|---|
| btc | verified (adapter tests + live cross-check 2026-11-19) | verified | verified |
| eth | verified | verified | verified |
| trx | verified | verified | verified |
| ton | verified | verified | blocked — needs the unsigned message (Phase 4); no fee invented |

`unsigned-plan`, `local-sign`, `post-sign-verify` stay blocked for all chains (Phase 4). `derive`/`restore`/`receive` remain verified (Lane 1). `main.tsx` registers all Phase 2 adapters once before render. `rpcEndpoints` pinned: btc `https://mempool.space/api`, eth `https://ethereum-rpc.publicnode.com`, trx `https://api.trongrid.io`, ton `https://toncenter.com/api/v2/jsonRPC` (the `viem:mainnet` marker is gone).

### What changed (files)

- New: `src/wallet/adapters/` (`types.ts`, `index.ts`, `btc.ts`, `eth.ts`, `trx.ts`, `ton.ts` + tests), `src/wallet/format.ts`, `src/wallet/qr-scanner.tsx`, `src/screens/asset-rows.tsx`.
- Rewritten: `src/screens/dashboard.tsx`, `asset-list.tsx`, `asset-detail.tsx`, `transaction-history.tsx`, `transaction-detail.tsx`, `receive.tsx`, `network-selection.tsx` (mainnet-only).
- Edited: `src/state/wallet-context.tsx` (history state, adapter-backed refresh, lock clears stale balances), `src/wallet/chains.ts`, `src/main.tsx`, `src/screens/wallet-management.tsx`, `src/engine/destination.ts`, `src/engine/confirmation-policy.md`, `src/app/app.test.tsx` (empty-dashboard wording).
- Deleted: `src/state/demo-fixtures.ts`.
- Deps: viem 2.58.0, jsqr 1.4.0 (package.json + package-lock.json).

### Incomplete / limitations / security notes (honest)

- Sol P1b still running at report time (42+ min, no output). Never killed. Hands-on P1 stands.
- Broadcast is DISABLED in every adapter (throws `BROADCAST_DISABLED_MESSAGE`); `send.tsx` untouched; the UI never presents send as working. Mainnet broadcasting stays disabled until separately authorised.
- No price feed exists: no fiat totals anywhere; the dashboard states "Portfolio total unavailable — no price feed connected".
- BTC adapter: JSON-number precision above `Number.MAX_SAFE_INTEGER` is a recorded limitation (comment in `btc.ts`).
- TRX has no on-chain chain-id; identity rests on the pinned mainnet endpoint (TronGrid `getnowblock` > 0). TronScan is used only as an explorer link, never as a provider.
- TON fee-quote stays blocked (see capability table).
- QR scanner (`qr-scanner.tsx`) is standalone and unwired until Phase 4. Its decode path was verified with jsqr (see above); its camera/cancel/error contract is unit-tested with mocked `getUserMedia`.
- The app shell still shows a "TESTNET · ACTIVE" header chip (AppLayout) — Phase 5 UI scope, out of this lane.
- The temporary live-check test was deleted after its run; the values above are the recorded evidence, not a permanent live test (the suite stays offline-deterministic).
