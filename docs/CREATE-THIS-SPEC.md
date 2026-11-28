# CREATE-THIS-SPEC — the single "create this" specification for Bawa

**Status:** canonical guide entry point, written 2026-11-25 (Lane G, "install all
usable" programme, branch `usable-lane-g-guide`, base `token-gaps 7fea3e4`).
**Read this first, with `WALLET_BUILDER.md` and `AGENTS.md`.** If this spec and
an older guide section disagree, this spec wins for the items it covers, and
the older section is listed as fixed or stale in the trace table (§17).

**How an AI agent must use this document.** Follow the sections in order.
Do not skip a section because a capability sounds familiar. Every section
names the real files, real function names, real numbers and real constraints.
Only resources that actually exist are cited. Anything marked **PENDING**
is not in the code yet: implement it from the survey plus the named lane
plan, and re-check it against the lane's committed code before claiming it
done. Nothing here is implied, assumed, or invented. User-visible content
is en-GB.

**Evidence labels** are exactly those in `AGENTS.md` §5:
`IMPLEMENTED_AND_VERIFIED`, `STARTER_IMPLEMENTED_AND_VERIFIED`,
`DOCUMENTED_NOT_TESTED`, `PROPOSED`, `OPEN`, `EXTERNALLY_DEPENDENT`,
`UNVERIFIED`.

## Part A status — all six lanes landed, re-checked 2026-11-26

The six Part A implementation lanes have all landed in
`panel-rebuild/token-gaps` through the `usable-install` programme
branch (rebased onto the token-gaps tip `7a170f4`, then merged).
Each section below was re-checked against the merged code by the
coordinator's re-check pass (2026-11-26, hands-on, 0 Sol calls);
where implementation differs from the survey, the section matches
the implementation. Lane H's mining record is §18. Merged-tree gates (loud-stone, Node 22): typecheck 0, build 0, vitest 129 files / 3,416 passed + 5 skipped (gates at `7f24ef1`, 2026-11-28 — Lanes A+B merged, run first-hand on loud-stone by the Lane D guide-gap audit; the earlier 129-file / 3,351-passed figure was the publish gates at token-gaps `734cfef`, 2026-11-28 — wobbly-cards + Starknet QR warning + web follow-ups, verified first-hand on loud-stone before pushing; the 129-file / 3,347-passed figure was the publish gates at `2205f15`, P2/P3 merge + bughunt-v2-fixes; the 121-file / 3,245-passed figure was the loud-stone run at `f1f0e6c`, 2026-11-27; earlier sandbox runs on Node 22 did not reproduce the loud-stone figure — see docs/index.md), eslint 0, link check 0,
`check-wallet-cycles` 0 (the one pre-existing type-only cycle was
a checker false positive — fixed in the checker, not the source;
see §17).

| Lane | Work | Section | Status |
| --- | --- | --- | --- |
| A | Bitget Agent API as an extra token verifier | §6.6 | IMPLEMENTED (browser leg + agent-side script) |
| B | Cardano, Starknet, Kaspa from OKX js-wallet-sdk | §2.5 | IMPLEMENTED (derive-only) |
| C | WalletConnect 2.21.0, lazy-loaded | §11 | REMOVED (providers programme, 2026-11-26) |
| D | Coinbase Onramp Buy, lazy-loaded | §12 | IMPLEMENTED |
| E | Shamir backup shares | §13 | IMPLEMENTED |
| F | ERC-7730 clear signing | §14 | IMPLEMENTED |
| H | Mining pass (wallet-repos, agent-repos, skills) | §18 | IMPLEMENTED |

Providers programme (2026-11-26, commit `7fb1c4a`, hands-on, 0 Sol
calls): removed WalletConnect (§11), added the Buy provider picker
(§12.1) and the swaps providers (§12A). It is recorded in the trace
table (§17) and in the sections themselves, not in the Part A table
above — Part A is the six lanes only.

**Bundle note:** the merged tree passes the budget — total JS 4,509,097 vs the 6,000,000 budget (§0.2), passing by 1,490,903 bytes; largest chunk 2,906,616 at `7f24ef1` (under the 3,050,000 cap). Measured at `7f24ef1` (2026-11-28, Lanes A+B merged, Lane D audit gates, verified first-hand on loud-stone). The budget was re-baselined to 6,000,000 by owner order at `f5a5f19` (2026-11-26); see §0.2 for why.

## §0. Hard constraints — these are not negotiable

1. **Broadcast is disabled on mainnet in code; swap execution is approved but not implemented.**
   `apps/web/src/wallet/send.ts:65-66` — "no module broadcasts on mainnet:
   broadcast stays DISABLED until separately authorised". `broadcastSigned`
   returns `{ status: 'disabled', reason: BROADCAST_DISABLED_MESSAGE }` on
   mainnet (it does not throw). No MAINNET send has ever run. Devnet
   test sends have run (TON testnet, app sends 1–3 with transaction hashes;
   `docs/DEVNET-ISSUES.md:50-66`) — that is the only send history, and it
   is testnet-only. Owner order 2026-11-27 approved swap execution — but
   it is NOT implemented yet, and broadcast stays disabled in the code
   until that implementation lands and is verified.
   The only exception is the temporary devnet-only broadcast path, §10.
   Never build, enable, or work around a mainnet broadcast path.
2. **Bundle budget: total JS in `dist/assets` ≤ 6,000,000 bytes; largest
   single JS chunk ≤ 3,050,000 bytes** (`CONSTRAINTS.md:40`; CI bundle-size
   step sums `dist/assets/*.js` after `npm run build`; budgets in `PERF.md`).
   The budget is the binding constraint on every new npm dependency (§17
   table). Do not re-baseline it without an owner order recorded in
   `docs/DECISIONS.md`.

   **Why 6,000,000 — the re-baseline history (do not re-baseline again
   without reading this).** The budget was re-baselined three times by owner
   order. First 4,185,000 → 4,215,000 (redesign growth; the trim hunt
   found no legitimate trim ≥ 25,808 bytes). Then 4,215,000 → 4,650,000
   (`7a170f4`, 2026-11-25, owner order; `docs/DECISIONS.md` §27). Then
   4,650,000 → 6,000,000 (`f5a5f19`, 2026-11-26, owner order; UX-major
   programme). Most
   of the growth is on-demand lazy code the gate counts anyway:
   jsQR 129,986 B, Shamir library 4,785 B
   (route chunk 10,085 B) — none of it on the cold-load path (home cold
   load fetches 564,002 B, no WalletConnect; measured 2026-11-26, Lane C).
   The WalletConnect lazy chunk (348,194 B) was removed with the feature
   in the providers programme (2026-11-26, §11). The P0 verification (2026-11-27, token-gaps `33f1ff1`) re-measured the total on the current tree: 4,473,583 bytes total JS, passing by **1,526,417 bytes (25.4% margin)**; largest chunk 2,906,489 bytes (under the 3,050,000 cap). Re-measured at `7f24ef1` (2026-11-28, Lanes A+B merged, Lane D audit gates): 4,509,097 bytes total JS, passing by 1,490,903 bytes; largest chunk 2,906,616 bytes. Whether the gate should exclude lazy
   chunks is an open owner question, not a lane decision.
3. **Visual direction: style B (owner pick, 2026-11-27).** Polished financial style everywhere — flat, hairline, tabular, real semantic colour — with illustration kept only for brand moments, plus a tiny bounded fraction of the paper/comic theme (the Welcome illustration, at most one small brand touch per screen — the QR card templates were paper/comic until Lane B flattened them to style B on 2026-11-28, §8). This supersedes the 2026-11-20 drawing-illustration order and its four-colour cap: the cap no longer governs new work. Transition state, stated honestly: the current tree still carries the four `--bawa-*` tokens in `apps/web/src/ui/styles/globals.css:60-63` (`--bawa-paper #FFFDF7`, `--bawa-ink #2B2B2B`, `--bawa-coral #FF6B4A`, `--bawa-sun #FFD93B`) while the P1 style lane migrates screens — do not cite the cap as the current rule, and do not re-impose it on migrated screens. The single confined exception that STANDS is the QR card: exactly ten named `--qr-*` tokens
   (`--qr-teal`, `--qr-teal-deep`, `--qr-teal-band`, `--qr-teal-copy`,
   `--qr-bar`, `--qr-muted`, `--qr-grey`, `--qr-faint`, `--qr-nearblack`,
   `--qr-white-dim`) in `apps/web/src/ui/styles/globals.css`, used ONLY by
   the QR card and its PNG exporter (`docs/DECISIONS.md` §24, line 2015).
   The QR card was redesigned to the polished flat style-B language by Lane B (2026-11-28, `fec71be`) — the wobbly paper/comic treatment is gone from it; see §8. No further literal colour may be added without a recorded decision there. `docs/DESIGN-SYSTEM.md`
   is owned by the P1 style lane; this spec states the direction, not the
   token list.
4. **No fake balances or prices, no invented data.** A chain with no
   balance source shows no balance (never zero-as-balance, never a
   placeholder). A chain no price source covers keeps its expired/error
   CoinGecko entry — never a guessed price (`apps/web/src/wallet/
   price-fallbacks.ts`, header). Listing a chain never implies it can do
   an operation; a chain is available for an operation only when
   `availableFor(capability)` in `apps/web/src/wallet/chains.ts` returns it.
5. **No secrets in source, logs, fixtures, prompts, or reports.** Never
   print, paste, or copy a secret value anywhere. Test keys are fresh,
   disposable, and never funded with real mainnet funds (`AGENTS.md` §4).
6. **Mainnet is the PRIMARY target; testnet is secondary/testing**
   (ADR-0003). Do not delete testnet code or restrictions. Mainnet use
   needs separate approval plus the real-funds gates.
7. **Self-custody only.** Keys are derived and held locally. Never route
   custody through a third-party service (Privy, hosted wallets, TEE/HSM
   key management). Never store a mnemonic, password, or key outside the
   encrypted vault (§4).

## §1. What Bawa is — build this

Bawa is an AI Wallet Builder plus a self-custodial multi-chain HD wallet.
One plain request must produce a real, buildable project from only
resources that actually exist. The web starter is `apps/web/`; the Android
starter is `apps/android/`; the engine is `tools/hdwallet-gen/` (Trust
Wallet Core 4.9.3 WASM). The builder entry point is
`node scripts/build-wallet.mjs "<request>"`, which classifies, generates
into `generated/<profile-id>`, verifies, and writes a JSON report; or
`node scripts/generate-project.mjs <profile-id>` for an explicit profile.

**Profiles (8, validated, in `registry/profiles.json`).** Do not invent a
ninth profile. Profile selection is routing, not a capability claim.

| Profile | Scope |
| --- | --- |
| `hd-wallet-cli` | CLI generation/derivation under the fixed engine policy |
| `bitcoin-wallet` | Bitcoin-focused; transaction support must not be assumed |
| `evm-wallet` | ETH/EVM-oriented; support beyond the specified ETH policy is OPEN |
| `multichain-wallet` | Combined BTC, ETH, TRX, TON; TON remains generation-only, single-address |
| `multichain-extended-wallet` | As registered in `registry/profiles.json`, 9 chains (sol, bsc, matic, arb, op, base, avax, ltc, doge) — the extended nine; combined with the 4 base chains (btc, eth, trx, ton, from `multichain-wallet`) the profile covers 13-chain requests. The web wallet now wires 87 chains (§2); the registry was re-validated for the 87-chain set in the registry v4 update (commit `2a0fa75`, 2026-11-26; validator exits 0, 0 errors), so the wider set is no longer OPEN on this count |
| `web-wallet` | Browser wallet; starter scope only, not a complete wallet |
| `android-wallet` | Android wallet; approved starter is UI layer only |
| `watch-only-wallet` | Public-data-only observation; no secret intake, no signing |

**Route every request** through `WALLET_BUILDER.md`: parse → plan →
profile → engine → chains → template → inspect → scaffold → implement →
verify → audit claims → report. Inspection precedes scaffolding. A blocked
step stops the work; it is never silently skipped or faked.

## §2. Chains — 87, not 13, not 22, not 84

**The count is 87: 22 curated chains in `apps/web/src/wallet/chains.ts`
plus 65 expansion chains in `apps/web/src/wallet/chains-expanded.ts`
(`EXPANDED_CHAINS`, line 156; `EXPANDED_CHAIN_COUNT = 65`, line 1914).
The 65 break down as 45 EVM + 17 non-EVM (9 Cosmos-ecosystem + 8 other) + 3
OKX-reference chains — Cardano, Starknet, Kaspa (§2.5) — whose full
fact records live in the same file (cardano `:1832`, kaspa `:1859`,
starknet `:1886`), not in a separate file. `SUPPORTED_CHAINS`
(`chains.ts:1687`) holds all 87.**
The expansion programme wired 84 into the app (adapters, prices,
icons, explorers; `docs/EXPANSION-PROGRAMME.md`); Lane B added the
three, so the app now wires 87. The 22-row capability
table in `WALLET_BUILDER.md` covers only the curated `chains.ts` set; the
65 expanded chains have their facts in `chains-expanded.ts`, each
cross-checked against at least two sources. Each expanded chain ships
two live-verified RPC endpoints — 130 in total
(`rpcEndpoints`, 65 arrays × 2; each called live 2026-11-24) — and
45 of the 65 have a live-clicked explorer transaction page
(`explorerTxLive: true`); the other 20 were not live-clicked, do not
claim they were. Price fallbacks per source on the 65 (see §7):
CoinGecko 65, CoinLore 56, Coinbase 46, DexScreener 15; 60 of the 65
have at least one non-CoinGecko fallback in their chain record. Caveat: the DexScreener leg is record-declared only for the expanded chains — `dexScreenerChainId` is set on 15 records, but the runtime (`priceFallbackSourcesFor`, `price-fallbacks.ts:371-379`) grants DexScreener only via `NATIVE_WRAPPED_TOKENS` (13 curated chains), so at runtime 58 of the 65 have at least one non-CoinGecko fallback (pulsechain and telos are the two that fall out).
`docs/02-chains/README.md` §2 previously said Solana was
reference-only — that is stale and fixed: Solana is a wired chain in the
87-chain set.

**Rule for every chain.** A chain supports an operation only if
`availableFor(capability)` in `chains.ts` returns it. Verified today for
the curated 22: derive/restore/receive/balance verified on all 22;
history verified for BTC, ETH, TRX, TON, SOL, LTC, DOGE, MATIC, ARB,
OP, Base, AVAX, CELO, Linea, Mantle, Scroll, Aurora and Gnosis (18 chains — Gnosis joined 2026-11-28 via gnosisscan.io, §2.7);
the other four — BSC, opBNB, Metis, Fantom — have no working
keyless history indexer and stay blocked. Fee-quote,
unsigned-plan, local-sign and post-sign-verify verified for BTC, ETH, TRX
only (TON fee-quote and post-sign-verify blocked — see §5). For the 65
expanded chains, derivation evidence is the Wallet Core 4.9.3 derivation
probe of 2026-11-24 recorded in `chains.ts:339-347`; do not claim send,
history, or fee behaviour for an expanded chain without its own adapter
evidence.

### §2.1 Derivation paths — fixed, do not invent alternates

BIP-39, 256-bit entropy, 24 words, empty passphrase, account 0, receiving
branch 0 only. Preserve the chain-specific paths; do not invent alternate
paths or index ranges.

| Chain | Path |
| --- | --- |
| BTC | `m/84'/0'/0'/0/i` (native SegWit P2WPKH, `zpub`) |
| ETH and all EVM chains | `m/44'/60'/0'/0/i` (default EVM path, `chains.ts` `EVM_PATH`) |
| TRX | `m/44'/195'/0'/0/i` |
| TON | `m/44'/607'/0'`; generation-only, single address; wallet V4 R2; wallet ID 698983191 |
| SOL | `m/44'/501'/0'` legacy single path; indexed form `m/44'/501'/<account>'/0'` / `m/44'/501'/<account>'/0'/<index>'` (`chains.ts:432-455`) |
| LTC | `m/84'/2'/0'/0/i` |
| DOGE | `m/44'/3'/0'/0/i` |
| Expanded chains | The `derivationTemplate` recorded per chain in `chains-expanded.ts`, generalised with `{account}` and `{index}` placeholders, from Trust Wallet Core registry paths (account-0 path) |

**One phrase, one account, one wallet identity.** Every chain's address
derives from the same 24-word phrase. All EVM chains share one address.
One literal public key across all chains is not how any
standards-compliant wallet works: TON and SOL use Ed25519 while the
others use secp256k1, with different address formats. Show the shared EVM
address once and the one wallet identity clearly; never claim a single
pubkey covers all chains.

### §2.2 Chain data sources (only these)

- Trust Wallet Core registry (168 coins) for derivation paths; Trust
  Wallet Assets pinned at commit
  `e8f61783ac6451fa8b7b1b4f72bf4a9607f6872e`
  (`chains-expanded.ts: TRUST_WALLET_ASSETS_PIN`).
- Chainlist, official chain docs/RPCs, CoinGecko `/coins/list` for the
  expansion cross-checks. Excluded chains are listed in
  `CHAIN-DATA-REPORT.md` — do not re-add an excluded chain without fresh
  evidence meeting the same bar (two sources + live RPC tip).
- Icons: `apps/web/src/assets/chains/` (PNG canonical + 96 px WebP q85),
  wired through `CHAIN_LOGOS` in `apps/web/src/screens/token-logo.tsx`.
  All 87 chains have a real icon; load failure shows only the deliberate
  paper-and-ink link mark, never a yellow ticker square.

### §2.3 RPCs and explorers

Every expanded chain ships two RPC endpoints verified live on
2026-11-24 — 130 in total (65 chains × 2; the 3 OKX chains add 6 to
the expansion programme's 124) — in `chains-expanded.ts`
(`rpcEvidence` per chain; EVM: `eth_chainId` + `eth_blockNumber` +
`eth_getBlockByNumber` freshness sweep; non-EVM: protocol-native
status probes). Do not swap in an unverified RPC.
Explorer transaction pages: 45 of the 65 have
`explorerTxLive: true` (live-clicked); `explorerTxLive: false`
means the tx page was NOT live-clicked — do not claim it was.

### §2.4 XRP, Stellar, NEAR — already in the registry

The coordinator's first-hand registry check (2026-11-25) found XRP,
Stellar and NEAR already present as derive entries in
`chains-expanded.ts`. They are part of the 87; the OKX SDK adds nothing
for them beyond reference material.

### §2.5 Cardano, Starknet, Kaspa — IMPLEMENTED (Lane B)

**Status: IMPLEMENTED.** All three are in the app as derive-only
chains (87 total). Registration: `SUPPORTED_CHAINS` in
`apps/web/src/wallet/chains.ts` ends with `cardano`, `kaspa`,
`starknet`; full fact records in `apps/web/src/wallet/
chains-expanded.ts` (cardano `:1832`, kaspa `:1859`, starknet
`:1886`). Derive-only means receive works (an address is derived
and shown); balance, history and send have no adapter and are
honestly unavailable, never faked (`availableFor` returns them for
derive/receive only).

- **Cardano (CIP-1852).** Path `m/1852'/1815'/{account}'/0/{index}`
  (payment; staking `m/1852'/1815'/0'/2/0`), via Wallet Core 4.9.3's
  cardano coin — the pubkey MUST come from
  `getPublicKeyEd25519Cardano` (`apps/web/src/wallet/core.ts:468`);
  the plain Ed25519 route aborts the WASM instance. CAIP-2
  `cardano:mainnet`. Icon from Trust Wallet Assets (same pin).
  **Passphrase caveat (proven, pinned by test):** Wallet Core
  derives the Cardano key from the mnemonic ENTROPY, not the BIP-39
  seed — a BIP-39 passphrase does NOT change the Cardano address or
  key. A user who sets a passphrase gets no passphrase protection
  on Cardano (Kaspa and Starknet DO change with the passphrase).
  Pinned by a test so a future core upgrade fails loudly; recorded
  in `docs/DECISIONS.md`.
- **Kaspa.** Address via the in-app CashAddr encoder (lazy-loaded
  `apps/web/src/wallet/kaspa-address.ts`); derivation verified
  against the SDK's test vectors. Coin type 111111
  (`m/44'/111111'/0'`). CAIP-2 `kaspa:mainnet`. Icon from CoinGecko.
- **Starknet.** Address via hand-rolled Stark-curve Pedersen +
  hand-rolled BIP32 (lazy-loaded
  `apps/web/src/wallet/starknet-derive.ts`); derivation verified
  against the SDK's test vectors. Coin type 9004
  (`m/44'/9004'/0'`). CAIP-2 `starknet:SN_MAIN`. Receive-only
  (counterfactual Argent proxy account). Icon from CoinGecko.
- **Reference, not bundle:** no `@okxweb3/crypto-lib` is bundled;
  `@noble/hashes` 1.8.0 is the only new direct dependency. The
  derivation/address logic was studied from the OKX `js-wallet-sdk`
  (MIT, `coin-cardano` / `coin-kaspa` / `coin-starknet` +
  `crypto-lib`, in `/home/boxd/workspace/wallet-repos/
  js-wallet-sdk/`) and written into Bawa's own code; the SDK's test
  vectors were used as the oracle. RPCs called live 2026-11-25:
  Koios tip + blocks, api.kaspa.org blockdag + network, dRPC
  Starknet chainId SN_MAIN on two hosts. Cardanoscan tx pattern NOT
  live-clicked (bot-gated 403 from this egress) — recorded in the
  chain record, do not claim it was.
- **Prices:** all three have a CoinGecko id (`cardano`, `kaspa`,
  `starknet`, `prices.ts`) and a CoinLore fallback
  (`price-fallbacks.ts:222-224`), so the price-fallback count is
  80 of 87 (§7).

### §2.6 Machine-readable export for other builders (Android) — the JSON-export proposal

**The registry exists; it is incomplete, not absent.** `registry/
capabilities.json` (v4) already enumerates all 87 chain ids in
`chainSupport`, and its `coins` table already holds 57 entries with
real fields (derivationTemplate, decimals, curve, networkId, assetId,
rpcEndpoints) — but 53 of the 57 are prospective stubs with empty
`rpcEndpoints` and `bawaChainId` null; only btc/eth/trx/ton are
supported with real RPCs. 52 of the 87 `chainSupport` keys have no
coin entry at all (only 35 of the 57 coin keys match a `chainSupport`
key — the rest use Trust Wallet Assets naming: `bitcoin`, `ethereum`,
`arbitrum`, `avalanchec`, …); there are no icons, explorers, or
CoinGecko ids anywhere in the JSON. An agent told "there is no JSON
registry" would rebuild what already exists; the work is completion, not creation.

**Registry v4 event (2026-11-26, commit `2a0fa75`):** the validator was upgraded from v3 to v4 (87-chain vocabulary from the schema enum; the v4 profiles rule), history I&V went from 10 to 17 chains, and the schema enum went from 84 to 87 (+cardano, kaspa, starknet). The validator exits 0 with 0 errors; `docs/index.md` records the re-earned IMPLEMENTED_AND_VERIFIED status.

**Implemented (Android Step 1, 2026-11-27, commit `58d85c5`):** the web wallet's data is exported as generated, versioned JSON — `registry/chains.json` (87 chains, 169 RPC endpoints, 4 testnets, `sourceCommit`, `coverage`) + `registry/tokens.json` (the 21 default tokens, `tokens.ts:182`) — generated by `apps/web/scripts/generate-android-registry.mjs` from `apps/web/src/wallet/*.ts` and `registry/capabilities.json` (current files generated from `7efba14`). This was the step that unblocked the Android programme: data export first, toolchain in parallel, then the data layer. Lanes must read chain/token data from the export; no Android lane may hand-write chain data from the TypeScript files.

**Why Android needs it — the data gap (A1–A12).** The Android starter
(`apps/android`) is a watch-only UI starter, not a wallet, and the
guide must not let an agent assume otherwise:
- Chain data: 4 derivation-path templates + a confirmation-policy
  evaluator for BTC/ETH only, as metadata — `DerivationPolicy.kt:5-10`
  ("Policy metadata only; this watch-only starter does not derive
  addresses"), `ConfirmationPolicy.kt`. No chain registry, no RPCs,
  no tokens, no prices, no icons in the app.
- No network permission: zero `<uses-permission>` in
  `AndroidManifest.xml` — the app cannot reach any network today.
- No data layer: no Room, Ktor, Retrofit or OkHttp in the build.
- No on-device derivation: `ENGINE_BINDING_AVAILABLE = false`
  (`apps/android/core/src/main/java/com/bawa/wallet/core/DerivationPolicy.kt:208`) — no Trust Wallet Core AAR exists yet (Step 4 is building it from the cloned source, owner-authorized 2026-11-28), so on-device derivation is OPEN.
- Tests: 77 `@Test` annotations counted across the Android tree (Step 3, `e20cee6` — was 57 across 5 Kotlin test files before Step 3).
- Toolchain — INSTALLED and proven (2026-11-27, loud-stone): JDK 17 (OpenJDK 17.0.21.1), Android SDK at `/home/boxd/Android/Sdk` with platform-tools 37.0.3, platforms `android-34` + `android-35`, build-tools 34.0.0 + 35.0.0, cmake 3.22.1, ndk 27.2.12479018. `./gradlew assembleDebug` succeeds (clean build re-run first-hand by the docs-currency lane, BUILD SUCCESSFUL in 32 s; the earlier proven run took 1 m 49 s). The build needs `ANDROID_HOME=/home/boxd/Android/Sdk` in the shell (or `sdk.dir` in `local.properties`) — without it Gradle fails with "SDK location not found". AGP is 8.2.2 with compileSdk 35 (`build.gradle.kts:3-4,12`). Step 3 of the Android programme is DONE (`e20cee6`, 2026-11-28, hands-on, 0 Sol calls): the data layer from the Step 1 export — 87 chains, 169 RPCs, 4 testnets, 21 tokens, 77 unit tests, APK 53,712,159 bytes. Step 4 (Trust Wallet Core AAR build from the cloned source) is RUNNING, owner-authorized 2026-11-28 — do not state it as done; steps 5–6 still await it. Steps 3–6 were BLOCKED before that: the Step 3 lane's report was removed by safety classifiers before the coordinator could see it, and the coordinator was instructed not to continue that request — the same pattern that blocked Step 2. No on-device derivation exists in the app yet; that work is Step 4, not a toolchain gap.
- **Policy tension, recorded not resolved:** watch-only is
  mainnet-only by owner order 2026-11-23 (`docs/DECISIONS.md`,
  Gap 21) — while the Android starter's own header states testnet-only
  (`apps/android/app/build.gradle.kts:1-2`: "Testnet only; mainnet is
  out of scope"). Any Android watch-only work must resolve this with
  the owner first; do not thread devnet through watch-only silently.

### §2.7 History indexers — the 18/4 split, Gnosis, and the four still blocked

**Status: 18 verified, 4 blocked (2026-11-28).** The verified set is
pinned by test — `availableFor('history')` in
`apps/web/src/wallet/chains.test.ts:416` lists exactly BTC, ETH, TRX,
TON, SOL, MATIC, ARB, OP, Base, AVAX, LTC, DOGE, Gnosis, CELO, Linea,
Mantle, Scroll, Aurora. A chain outside that list has no working
keyless history indexer and its history stays blocked, never faked.

- **Gnosis — wired 2026-11-28 (`d06a224`), keyless.**
  `https://gnosisscan.io/api` (Etherscan v1 API) with
  `historyExplorerBase` `https://gnosisscan.io`
  (`apps/web/src/wallet/chains.ts:812-815`).
  `GET /api?module=account&action=txlist&address=<addr>&page=1&offset=5&sort=desc`
  returns status 1 with real transactions and message "OK". The
  adapter branches on the host (`apps/web/src/wallet/adapters/evm.ts:172-181`,
  `historyBaseUrl` containing `gnosisscan.io` → source `gnosisscan`).
  Evidence is the browser fetch, not curl: plain curl is
  Cloudflare-403, while a headless-Chromium fetch — and an in-page
  fetch from a blank page, the exact path the adapter uses — returns
  200 with identical JSON (CORS passes), and a second address returns
  different transactions (address filter proven). Single source — the
  host itself, no second keyless indexer answers for Gnosis. Recorded
  in `HISTORY_EVIDENCE_2026_11_28_GNOSIS` (`chains.ts:299-310`).
- **The four still blocked — BSC, opBNB, Metis, Fantom.** Probed live
  2026-11-24 and again 2026-11-28; no keyless source exists for any
  of them (`chains.ts:231-264`): Routescan does not index any of them;
  the Etherscan V2 free tier refuses BSC and does not list the
  Metis/Fantom chain ids; opBNB V2 502s; the Metis explorers 504;
  no Blockscout host answers for them. The 2026-11-28 probes add:
  BSC — BscScan V1 needs a key, and Etherscan V2 refuses it keyless
  with no Blockscout; opBNB — opbnbscan serves HTML only, no JSON
  API, and no Blockscout; Fantom — Etherscan V2 dropped the chain id,
  Blockscout 503s, ftmscout 522s; Metis — Andromeda returns real
  transactions to curl but sends NO CORS header, so the browser
  blocks every fetch (the wiring was built, then correctly REVERTED
  after CDP caught the CORS block). **Owner decision needed:** the
  four need a KEYED source (free Etherscan/BscScan key, NodeReal
  free-tier for BSC, or Blockscout PRO) — no key invented, nothing
  faked.
- **Probe lesson, recorded so it is not re-learned:** curl probes
  cannot see CORS, and Cloudflare bot-gating answers curl and the
  browser differently (Gnosis 403s curl and answers the browser;
  Metis answers curl and is blocked in the browser). Every history
  probe must include a browser fetch — in-page where the adapter
  runs, or headless Chromium — and the evidence is that fetch, not
  the curl exit code.

## §3. HD wallet and engine — fixed pins

- Engine: `tools/hdwallet-gen` pins `@trustwallet/wallet-core` **4.9.3**;
  Node range **>=22 <23**. The 4.9.3 WASM is 10,422,325 bytes, SHA-256
  `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217`.
  Verify the hash on every upgrade; never use a version range. The
  prebuild step (`apps/web/scripts/copy-wasm.mjs`, run by `prebuild` /
  `predev` / `build`) copies the pinned WASM into the app; the
  dependency-version check (`scripts/check-pinned-dependencies.js`)
  guards the pin.
- Adopted `apps/web` libraries (ADR-0005): `@scure/bip39` **2.4.0**,
  `decimal.js` **10.6.0** (kept as the differential-test oracle for the
  BigInt `decimal.ts`, which replaced both `decimal.js` and `dinero.js`
  at runtime — `dinero.js` is NOT a dependency any more; 0 hits in
  `package-lock.json`), `mnemonic-words` **2.0.0**; `bip39` **3.1.2** as
  a devDependency used only as a test oracle.
- Python tools: Python **>=3.11**, `cryptography` **50.0.2**,
  `bip-utils` **2.12.3**.
- Verification workflow (from `apps/web`, after `npm ci`):
  `npm run typecheck` (tsc --noEmit, 0 errors), `npm run build`
  (copy-wasm + tsc + vite build, 0 errors), `npm run test` (vitest — 129 files; the 3,416-passed + 5-skipped figure is the gates at `7f24ef1` (2026-11-28, Lanes A+B merged, run first-hand on loud-stone by the Lane D guide-gap audit); the earlier 129-file / 3,351-passed figure was the publish gates at token-gaps `734cfef` (2026-11-28, wobbly-cards + Starknet QR warning + web follow-ups), verified first-hand on loud-stone before pushing; the 129-file / 3,347-passed figure was the publish gates at `2205f15` (P2/P3 merge + bughunt-v2-fixes); the 121-file / 3,245-passed figure was the loud-stone run at `f1f0e6c`, 2026-11-27; earlier sandbox runs on Node 22 did not reproduce the loud-stone figure — see `docs/index.md`). Engine smoke suite:
  440 checks pass (`docs/engine-reproducibility.md`).
- Confirmation policy: BTC 6 confirmations (recommendation, not
  protocol); ETH `finalized`; TRX 19 distinct SRs of 27 via
  `/walletsolidity/*`; TON 1 masterchain seqno after inclusion plus an
  outgoing-message outcome check.
- A successful build and test run prove only their build scope. They do
  not demonstrate transaction handling, mainnet readiness, or a send on
  any network.

## §4. Encrypted local vault and auto-lock — implemented

**Correction to older guide text:** `WALLET_BUILDER.md` and `AGENTS.md`
previously said "Current implementation at 5e7eb1d: no lock exists; the
optional restoration is not yet implemented." That is stale. Auto-lock IS
implemented (owner order 2026-11-20). Implement and describe it as follows.

- Vault: password-protected, AES-GCM-256, PBKDF2 with 600,000 iterations
  (`apps/web/src/wallet/vault.ts:85`). Storage key for the derived key:
  `bawa-vault-key` (`vault.ts:83`, `VAULT_KEY_STORAGE_KEY`).
- Auto-lock is an **optional setting on the /security page, OFF by
  default**: a toggle plus a duration — Immediately / 1 minute / 5 minutes
  / 15 minutes / 1 hour / 1 day (`apps/web/src/wallet/auto-lock.ts`:
  `AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 60, 1440]`, `AUTO_LOCK_LABELS`,
  keys `bawa-auto-lock-enabled` / `bawa-auto-lock-minutes`).
- **Key-storage invariant (absolute):** while auto-lock is ON, the raw
  derived key is NOT stored (`bawa-vault-key` must be absent) so the lock
  is real and unlocking needs the password. While auto-lock is OFF, the
  raw derived key IS stored under `bawa-vault-key` so the vault can
  auto-unlock. With auto-lock OFF the vault must never be described as
  locked. Never silently change these settings or boundaries.
- **RISK - auto-unlock key in localStorage (owner decision, 2026-11-28: KEEP auto-unlock, with the fix below ordered):** while auto-lock is OFF (the default), the raw derived key is stored under `bawa-vault-key` in `localStorage` as a base64 string, and `autoUnlock()` (`apps/web/src/wallet/vault.ts:624`) imports it extractable. That is the pattern OWASP warns against: `localStorage` is readable by any JavaScript on the page, and "a single Cross Site Scripting can be used to steal all the data in these objects" (OWASP HTML5 Security Cheat Sheet). One XSS, one compromised dependency, or one malicious extension reads the key and decrypts the vault. The key being extractable means it can be exported and reused elsewhere.
- **FIX - non-extractable CryptoKey in IndexedDB (the Mauvely "Trust this device" model):** keep auto-unlock, but change where and how the key is kept. Store the vault key as a **non-extractable** `CryptoKey` in **IndexedDB**, not as raw base64 in `localStorage`. IndexedDB is the only place a non-extractable `CryptoKey` can persist (W3C WebCrypto recommendation; OWASP WSTG: keys in IndexedDB should be `extractable: false`). The browser can use the key to decrypt, but no script can read or export the raw key bytes - even if XSS lists the database it sees a key handle, not the bytes. `autoUnlock()` must use the key non-extractable. Keep the auto-lock timer so the in-memory key is dropped on inactivity, and add a "Forget this device" switch so the trust can be revoked. The vault envelope itself stays AES-GCM ciphertext. Honest caveat: a non-extractable key stops script from *reading* the key, not from *using* it while the page is open - an attacker running code could still call decrypt through the handle. It kills silent exfiltration (the key cannot be stolen and used elsewhere) but does not make XSS harmless. References: MetaMask `metamask-extension` + `@metamask/browser-passworder` (PBKDF2 600,000 + AES-GCM; keys only in memory, no persistent auto-unlock - the most secure model, at the cost of the convenience); Mauvely docs "Setting up your vault" ("Trust this device"); OWASP HTML5 Security Cheat Sheet; "Stop Storing Secrets in localStorage" (Pattern 3: non-extractable CEK + IndexedDB).
- **Change password (fix programme, 2026-11-28, `f77b803`).** On
  /security (`screens/security-settings.tsx:166`, "Change password"):
  current password, new password (at least 8 characters,
  `MIN_PASSWORD_LENGTH = 8`), confirm. The current password is
  verified first by trial decrypt — `verifyVaultPassword`
  (`wallet/vault.ts:592`) — with no state change, so a wrong current
  password fails honestly ("Incorrect password.") and leaves the
  vault untouched; a locked vault is unlocked through the context
  first, because `changePassword` needs the mnemonic in the closure.
  `changePassword` (`wallet/vault.ts:771`) re-encrypts the vault
  under the new password (a newly derived key), follows the
  stored-key rule (stored key replaced when auto-lock is off so
  auto-unlock keeps working, deleted when on — a stale old key must
  not survive), refreshes the vault backup, and never changes the
  stored recovery profileIds or key provenance. **A password change
  cancels all Shamir backup-share sets** (§13): the shares split
  the old vault key, and the new password derives a new key —
  create fresh shares after changing the password.
- Seed storage on the CLI side: `secrets/` **0700**, `seed.enc.json`
  **0600**, `.env` **0600**; AAD `nova-shop-seed-v1`.
- **Adapter boundary:** chain adapters NEVER receive mnemonics, seeds,
  private keys, xprvs, or vault keys, including in tests.
- **UI boundary:** UI is presentation only — never derivation, storage,
  or signing policy.

## §5. Offline signing — which chains sign, and the broadcast rule

- Offline signing and unsigned-transaction construction exist in the web
  starter (`apps/web/src/wallet/send.ts`); broadcast is disabled (§0.1).
  `send.ts:987` — "Nothing here broadcasts."
- **Sign (local-sign verified): BTC, ETH, TRX.** TON local-sign is
  verified with two blocks: fee-quote is blocked (a TON fee depends on
  the unsigned message, which is Phase 4 work — no fee number is ever
  invented) and post-sign-verify is blocked (the signed BOC is not
  re-parsed; no BOC parser is vendored; verification is no-error +
  32-byte hash + BOC magic only).
- **Solana signs offline via `@solana/web3.js`** (`send.ts:2779`,
  "Solana signing (minimal wire format, Lane C)"): Wallet Core 4.9.3's
  Solana signer returns an `encoded` transaction that is not a valid
  Solana wire transaction, so the app builds and signs with
  `@solana/web3.js` instead. Broadcast stays disabled; native SOL and
  SPL USDC sign offline and verify in the browser.
- **All other chains: local-sign, fee-quote, unsigned-plan and
  post-sign-verify are blocked** — no adapter or send builder exists for
  them yet, and no capability is ever faked. `simulate` is candidate on
  all chains: declared, owned by the send lane in `send.ts`; no
  simulation runs yet, and simulation is a pre-check, never confirmation.
- EVM send builder: generalised EVM signer (chainId 56 for BSC;
  `docs/BSC-SEND-FIX.md`). The Receive/Send QR flow, the 22-button grid
  fix (single "Create wallet" button with a message saying what it is
  and that creating it gives access to 87 chains —
  `welcome.tsx`; the count is the full
  wired set, 22 enabled by default), and the Scan icon are covered by
  the finish-product programme (`docs/FINISH-PRODUCT-PROGRAMME.md`).

## §6. Token verification by contract address

**Verify by contract address, never by name or symbol.** A fake copycat
with the same name and symbol shows Unverified and never gets the real
logo. A real token shows a verified mark with its real logo and live
price, even down to memecoins. Implementation:
`apps/web/src/wallet/token-verification.ts` (see its header, lines 25-45,
for the full source notes). Add Token works for any token on any chain by
contract address, pulling in icon, ticker and live price.

### §6.1 CoinGecko (first verifier)

CoinGecko contract endpoint first. Only the chains CoinGecko serves are
queried; a token verified here is verified.

### §6.2 Jupiter Strict (Solana)

Jupiter Strict validated-token list for Solana tokens.

### §6.3 1inch (EVM)

The 1inch token list, served address-keyed per chain at
`tokens.1inch.io/v1.2/{chainId}` — one small fetch per chain, no key.
Only the chains 1inch actually serves are queried
(`token-verification.ts:101`).

### §6.4 Uniswap Default

`tokens.uniswap.org`, "Uniswap Labs Default" v22.34.0, 2,176 tokens last
recorded (`token-verification.ts:31`).

### §6.5 PancakeSwap Extended

`tokens.pancakeswap.finance`. The Default list is 13 tokens last recorded
(`token-verification.ts:45`); use the Extended list.

### §6.6 Bitget Agent API — extra verifier — IMPLEMENTED (Lane A) + agent-side deep check (Lane H)

**Status: IMPLEMENTED in the browser leg (Lane A) and verified live;
agent-side deep check added by Lane H, 2026-11-26.** The Bitget Agent
API is a no-key token/security/market API
(`https://copenapi.bgwapi.io`) reached through the MIT
`bitget-wallet-skill` / `bitget-wallet-cli` / `bitget-wallet-mcp`
(Python scripts / MCP server: 21 market tools + smart-money + RWA).
Survey verdict: token info, security audit, dev/rug check, market info,
K-line, holders — an extra token-verification source with **zero bundle
cost** (Python/server-side, never in the browser bundle).

**Browser leg (Lane A, merged).** `apps/web/src/wallet/
token-verification.ts`: `bitgetSignedPost` reproduces the skill's
`_request` signing (BKHmacAuth, unsalted SHA-256 of method + path +
body + timestamp — no secret) with WebCrypto; `bitgetTokenInfoMatches`
requires the exact chain + contract AND a non-empty symbol and name
(a fake answers a zeroed stub); `bitgetSecurityClean` vetoes on a
highRisk audit (a fake answers highRisk false with support 0 — audit
pending — so the audit alone never verifies). **Browser limit,
verified first-hand:** the API's OPTIONS handler demands
X-SIGN/X-TIMESTAMP, which a CORS preflight never carries, so from a
browser the call fails at the preflight and the leg verifies nothing —
it is wired fail-closed and verifies the moment the API allows
browser calls. The leg is therefore NOT the live verification path
today.

**Agent-side leg (Lane H, this programme).** `scripts/
verify-token-bitget.mjs` (Node >= 22, global fetch, zero
dependencies, zero bundle cost) runs the SAME two signed POSTs from
Node, where there is no preflight, and adds the deep fields the
browser leg does not use: top-10 / insider / sniper / dev holder
percents, dev rug percent + counts, LP lock percent, from the
`batchGetBaseInfo` entry. Thresholds are the skill docs' own
(`bitget-wallet-skill/docs/market-data.md`): dev_rug_percent > 20%
red flag; sniper_holder_percent > 10% warning; top10 > 50%
concentration risk; trade tax >= 50% risk, >= 10% warn. Verdicts:
VERIFIED / VERIFIED-WITH-WARNINGS / HIGH-RISK / UNVERIFIED, exit 0
for verified, 1 otherwise, 2 for usage errors. Tests:
`scripts/verify-token-bitget.test.mjs` (plain node:test, mocked
fetch, 9 tests). **Live verification, 2026-11-26, loud-stone:**
USDC (eth) VERIFIED, exit 0 (price 1.001, holders 9,272,568,
top-10 22.5%); PEPE (eth) VERIFIED, exit 0; fake contract
`0x0000…0001` UNVERIFIED, exit 1 (zeroed stub, no symbol/name).
Two live findings recorded in the script: (1) the API sits behind
Cloudflare and returns 403 "error code: 1010" for a bare
Python-urllib User-Agent — Node's fetch and python-requests
User-Agents answer 200; the script sets an explicit User-Agent.
(2) The "percent" fields arrive as FRACTIONS (USDC top-10 0.2248,
PEPE 0.3807), so the script normalises (0, 1] x100 to the docs'
0–100 scale before comparing; the dev_rug_percent scale has no live
non-zero sample and is normalised like its sibling fields — that
inference is stated in the code, not hidden. Usage:
`node scripts/verify-token-bitget.mjs --chain eth --contract 0x...`.
Swap/transfer scripts in those repos are reference only: Bawa
forbids mainnet broadcast (§0.1). The TS SDK
`@bitget-wallet/api` (`tob-api-sdk-ts`) is NOT the route: it needs an API
key + HMAC secret (never in the browser — backend proxy only, which Bawa
has none) and its dist JS is 182,504 B unminified (~34× the headroom).

### §6.7 What is deliberately NOT a verifier

Raydium and DexScreener are deliberately NOT verifiers: any token with a
pool is listable there. DexScreener is a price fallback only (§7).

### §6.8 Removing an added token — IMPLEMENTED (fix programme, 2026-11-28)

**Status: IMPLEMENTED.** Before this fix there was no remove control
anywhere: a user who added a token — including a fake copycat pasted
by contract — could never remove it short of wiping the vault
(Lane C §6b, 2026-11-28). Now the asset-detail page of a
custom-added token shows a two-tap Remove
(`screens/asset-detail.tsx:950`, "Remove token" — first tap arms,
second deletes, the address-book pattern, DESIGN-SYSTEM §6):
`removeCustomToken(chain, contract)`
(`state/wallet-context.tsx:1411`) calls `removeCustomTokenFromList`
(`wallet/tokens.ts:762`), which drops exactly that chain+contract
entry and leaves the rest of the list alone; success navigates to
/assets. Only custom-added tokens can be removed — the 21 default
tokens (`DEFAULT_TOKENS`, `tokens.ts:182`) have no Remove control.
A removed token can be added again later from Add token.

## §7. Prices — CoinGecko first, never CoinGecko only

Owner order 2026-11-23: "do NOT depend completely on CoinGecko — find
alternatives too." Price stack (`apps/web/src/wallet/prices.ts`,
`price-fallbacks.ts`, ADR-0007 `docs/adr/0007-price-feed-provider.md`):

1. **CoinGecko first** — `usePrices()` fetches its batched
   `/simple/price` call first; only chains whose quote is NOT fresh reach
   the fallbacks (`applyPriceFallbacks`).
2. **CoinLore** (`api.coinlore.net/api/ticker/?id=...`) — one batched call
   for every mapped chain, keyless, CORS open. Verified quotes track
   CoinGecko within 0.7%. Excluded from the map: CoinLore TON and MATIC
   (stale legacy quotes), LTC and FTM (not listed). Mantle MNT, Gnosis
   xDAI (via DAI, 1:1 bridge), and Fantom FTM (via Sonic S, 1:1 upgrade)
   mappings are recorded in the file header — read them before touching
   the map.
3. **DexScreener** (`tokens/v1/<chain>/<wrapped>`) — on-chain price of
   the wrapped native, one call per chain. Quote-side only: the implied
   price `priceUsd / priceNative` — NOT `priceUsd` itself, which is the
   base token's price (the trap documented in `dex-prices.ts`).
4. **TonAPI rates for TON, Coinbase Exchange ticker for LTC** — the two
   chains CoinLore cannot cover.
5. **Rejected live, do not re-add without fresh evidence:** Binance
   (geo-blocked 451; `.us` quotes a frozen pre-delisting FTM ~16× too
   high), CoinPaprika (frozen FTM quote; free tier is personal-use only),
   CoinCodex (returns `not_trading_anymore`), Kraken (no CORS header).
6. The row label shows the quote's real source, never a hardcoded
   provider. A chain no source prices stays on its CoinGecko entry —
   expired, error, or unavailable — never a guessed price.

### §7.1 okx-cex-market — keyless second price source, agent skill only

**This is an agent skill. It does NOT go in the Bawa app. Record it as
such and never bundle it.**

- Skill: `okx-cex-market`, MIT v1.5.2, installed at
  `custom-skills/okx-cex-market/` (SKILL.md + 5 reference files + shared
  `_shared/preflight.md`). Source: OKX `agent-skills` repo
  (`/home/boxd/workspace/wallet-repos/agent-skills/`).
- What it does: public OKX CEX prices, tickers, order books, candles,
  funding, open interest, 70+ indicators — **read-only, no API
  credentials**. Runtime needs only the `okx` CLI binary
  (`npm install -g @okx_ai/okx-trade-cli`; verify with
  `okx market ticker BTC-USDT`).
- Use it when an agent needs a second price source to cross-check
  CoinGecko: `okx market ticker <instId>`, `okx market tickers`,
  `okx market orderbook`, `okx market candles`, `okx market funding-rate`,
  `okx market open-interest`, `okx market indicator <name> <instId>`,
  `okx market filter` (screener). Add `--json` for the raw OKX API v5
  response.
- Do NOT use it for account balances/positions (`okx-cex-portfolio`,
  not installed), placing/cancelling orders (`okx-cex-trade`, not
  installed), or bots (`okx-cex-bot`, not installed). Its siblings were
  NOT installed because every one requires API credentials / a CEX
  account.
- **Not verified first-hand:** end-to-end behaviour needs the `okx` CLI
  binary at runtime; the first live run will confirm it.
- `okx-dex-market` (onchainos-skills) — verdict CORRECTED 2026-11-26
  (guide-update pass): the source proves anonymous auth exists —
  `cli/src/client.rs:213`, "Create a client with JWT auth when logged
  in, otherwise anonymous auth", and "anonymous" appears 41 times in
  that file — so the earlier verdict ("keyless operation could not be
  verified without running OKX's installer") was wrong: only 2 of the
  8 onchainos skills mention wallet login. Keyless read-only DEX
  market/token data (price by contract, batch prices, K-lines, index
  price, token search/metadata/risk, holders, smart-money signals,
  wallet PnL) is the strongest CoinGecko-alternative candidate of the
  survey. Live keyless run RECORDED — M9 NOT-BUILT (2026-11-28,
  `docs/M9-NOT-BUILT.md`): 9 live probes from loud-stone, 0 successes
  — market endpoints demand x402 payment up front (HTTP 402),
  index/security/config endpoints demand an API key (HTTP 401). No
  free quota is granted to a fresh anonymous caller. M9 stays NOT-BUILT
  until the owner orders an OKX API key or a funded x402 arrangement.
  The other caveats stand: the free-quota size is unstated; UK
  geo-restriction with API-key bypass; WebSocket needs login; native
  SOL needs the wSOL address.

### §7.2 Asset price chart — CoinGecko with one retry + Coinbase candles fallback (fix programme, 2026-11-28)

**Status: IMPLEMENTED.** The 7-day chart on the asset-detail page
(`screens/price-chart.tsx`, lazy-loaded; `MAX_PLOTTED_POINTS = 48`,
downsampled) used to be a single CoinGecko `/market_chart` call with
no retry — Lane B measured it loading only ~3 of 7 visits, tracking
CoinGecko 429s on the keyless ~5 calls/min shared budget.
`fetchPriceHistory` (`wallet/prices.ts:963`) now spends the budget
sparingly, in this order: (1) CoinGecko once — a success returns
immediately and the chart footer names CoinGecko. (2) A 429 goes
straight to the Coinbase candles fallback — no re-hit of a
rate-limited endpoint. A network / timeout / provider failure
retries CoinGecko once after a 1 s backoff, then falls back. An id
with no Coinbase product retries CoinGecko once after
min(Retry-After, 5 s) on a 429. (3) The fallback is
`fetchCoinbaseChartHistory` (`wallet/price-fallbacks.ts:749`):
Coinbase Exchange daily candles,
`GET /products/<product>/candles?granularity=86400`, keyless, CORS
`*`, already in CSP `connect-src`, verified live 2026-11-28 — 44
products in `COINBASE_CHART_PRODUCTS` (`price-fallbacks.ts:650`).
Daily closes, not intraday points; the footer names Coinbase when it
serves. (4) When the fallback also fails, the CoinGecko failure is
what the chart reports — never a blended reason. Fewer than two
points from either source is `unavailable`, never invented points or
a flat line through one price. The retry sleep is injectable so
tests never wait.

## §8. QR cards — seven templates, PNG parity

Implementation: `apps/web/src/screens/qr-card.tsx`,
`apps/web/src/wallet/payment-links.ts` (from line 700),
`apps/web/src/screens/receive.tsx`. Design record: `docs/DECISIONS.md`
§24 (line 1987).

- **Seven templates, original Bawa designs** informed by Bitget/OKX
  patterns only — no competitor logo, colour-as-brand, cyan arrow, or
  "Deposit from Bitget Exchange" link is copied; the brand bar is Bawa's
  own wordmark. `QR_CARD_TEMPLATES` (`payment-links.ts:728`):
  A "Dark Teal" (showcase variant, closest to the Bitget bar), B "Paper"
  (default), C "Minimal" (plain and quiet, the fallback), D "Poster"
  (bold, for sharing), E "Sun" (bright sun field), F "Ink" (dark
  card, safe code), G "Ticket" (two-tone ticket stub). The redesign
  programme added E/F/G (2026-11-25); the QR-cards programme built
  A–D. Default: `DEFAULT_QR_CARD_TEMPLATE = 'b'`
  (`payment-links.ts:739`). **Flat style-B since Lane B (2026-11-28,
  `fec71be`):** the wobbly paper/comic treatment — irregular radii,
  hard offset shadows, 2 px ink borders — is gone from the in-app
  card and every PNG template. Clean 24/20/16 px radii, 1 px
  hairlines, soft shadows (`qr-card.tsx` header). This is the one
  place the paper/comic theme was removed rather than kept (§0.3);
  nothing of Bitget's branding, logo, colours-as-brand or "Deposit
  from Bitget Exchange" link is copied.
- **Template picker:** Receive screen, "Card style — tap to switch",
  all seven templates, `aria-pressed`, active `bg-sun`, driving both the
  in-app card and the PNG.
- **PNG parity (the rule):** the shared/downloaded PNG must be the same
  card in the picked template. Geometry: every template is laid out in
  390 px design units and scaled by `width/390`, so the 640 px export
  and the 1080 px export are the same card at two sizes — never a
  reflowed one. Layout is measured first, then drawn, on the same
  numbers. Heights are computed from the wrapped subtitle and address,
  so a long non-EVM address grows the card instead of clipping.
  QR code per template (`QR_CARD_TEMPLATE_QR`, `payment-links.ts:756`):
  A 218 px white on `#011F29`, B 216 px, C 224 px, D 222 px, E 218 px,
  F 216 px, G 216 px; centre-logo marks A 28 px, B 44 px, C 32 px,
  D 42 px, E 42 px, F 40 px, G 44 px. The guide's earlier sizes
  (B 200, C 216, D 210, E 210, F 208, G 200) predate the UX-major
  Lane 1 growth toward Bitget's ~62%-of-card share (B/G 200 → 216,
  C 216 → 224, D 210 → 222, E 210 → 218, F 208 → 216; A already
  218) — do not quote them. Footer on every card:
  "Share the card, keep the keys." — the constant `QR_CARD_FOOTER`
  (`payment-links.ts:770`), rendered in every template in-app
  (`qr-card.tsx:92`, re-exported there) and in every PNG export, not
  only in B. Template C adds
  "Scan or share this QR code to receive crypto."
- **Template A centre mark:** the logo is redrawn as a white silhouette
  (pixels brighter than luminance 160 go transparent, then a `source-in`
  white fill) in both the PNG exporter (`buildWhiteSilhouette`) and the
  in-app hook (`useDiscLogoImage`). A plain white fill keeps the whole
  disc; a light glyph degrades to no mark rather than a white circle.
  Template A deliberately has NO white ring in place of the
  bottom-right alignment pattern — the ring alone breaks the repo's own
  jsQR decoder.
- **Address splitting — `splitAddressLines`:** a 42-char EVM address
  reads as two 21-char lines, a 44-char address as 22 + 22, a
  66-char Starknet address as 22 + 22 + 22 — never a 1–2 char orphan
  line (the old greedy wrap left 'BD' alone on a line in the PNG
  export), never a break mid-address at a random fill point. Two
  twins, kept in step: the in-app one in `qr-card.tsx:113` and the
  canvas twin in `payment-links.ts:2439`.
- **Starknet receive-only warning (2026-11-28, `77e4473`):** Starknet QR cards carry the shared `STARKNET_RECEIVE_ONLY_WARNING` (`payment-links.ts:786`) in every template, after the subtitle and before the QR tile — in-app (`qr-card.tsx:268`, `StarknetWarning`, rendered at `:688` and `:778`) and in the PNG exporter — never paraphrased or shortened. Ethereum negative control: 0 warnings.
- **In-app/PNG band difference (Lane B, 2026-11-28):** template A's
  in-app band is stacked — the address gets the full band width on
  its own row — because CDP measurement proved the single-row band
  gave the address column only 136 px while a 21-char line needs
  168 px at 14 px bold, so the tail ran under the copy circle
  (`qr-card.tsx:704`). Stacking gives the line the whole 236 px
  band width. The PNG export keeps its measured single-row band
  (canvas `measureText` proves 17 px fits its 252 px band), and PNG
  A's footer/link order was aligned to the in-app card in the same
  lane. Do not "fix" the in-app/PNG band difference by shrinking
  the address font below design size or widening the card past the
  locked layout.
- **Palette:** the ten `--qr-*` tokens (§0.3) are used ONLY by the QR
  card and its PNG exporter. E2E: `e2e/qr-card-templates.spec.ts`
  (every template shares a PNG decoding to the payment URI; viewports
  390/820/1440/1919) and `e2e/png-decode.ts`.
- **Template A unproven on phone cameras; live-camera scan unverified
  (open, 2026-11-26):** every template's PNG decodes to the payment
  URI through the repo's own jsQR decoder (`e2e/qr-card-templates.spec.ts`,
  7/7), but no template has been scanned with a real phone camera —
  Template A least of all (dark teal field, white-silhouette centre
  mark, deliberately no white ring by the bottom-right alignment
  pattern). The live-camera scan in the app is likewise unverified and
  needs the owner's phone. Do not claim phone-scan parity until a
  phone-camera scan of each template is recorded.
- **No QR/share-card code exists in the Bitget or OKX orgs** (survey):
  the only QR file found is a deprecated WalletConnect v1 QR modal in a
  demo. The seven templates are Bawa-original; there is nothing to import.

## §9. Watch-only — mainnet-only

- Watch-only is **mainnet-only** by owner decision (2026-11-23). Devnet
  is not threaded through watch-only, and devnet mode (§10) does not
  change watch-only behaviour.
- One watch-only address must detect balances from all its chains in
  real time. Implementation: `apps/web/src/wallet/watch-only-families.ts`
  and the hydration path in `state/wallet-context.tsx`, which iterates
  `ALL_CHAIN_IDS` (the 2026-11-22 fix for hydration covering only 4 of
  13 chains — a stored watch-only wallet for SOL was persisted but
  dropped on every reload).
- Public data only: no secret intake, no signing. BTC/ETH/TRX via xpub
  deposit derivation (`tools/hdwallet-gen/derive.js`); TON via 64-hex
  Ed25519 public key to one Wallet V4 R2 address, workchain 0, wallet ID
  698983191 (`tools/hdwallet-gen/derive-ton.js`) — no TON xpub, no index.
- Monitoring support still requires evidence; do not claim a monitoring
  UI is verified until it is.
- **Watch-only on the dashboard and /assets (fix programme,
  2026-11-28, `e6a2727`).** A watch-only wallet is no longer invisible
  outside /wallets: the dashboard reads the watched addresses — the
  hero copies a watched address when no vault address exists,
  labelled Watch-only (`screens/dashboard.tsx:410-421`,
  `heroAddressIsWatchOnly`), the fresh-zero "Nothing here yet" note
  stays off while watched balances sit below it, and the /assets
  list shows a "Watch-only — showing balances for addresses you
  watch. They can’t send." banner with a link to /wallets
  (`screens/asset-list.tsx:177`). A watched address is never a send
  source — the Send screen never offers one. **Home routing for
  watch-only-only (`4adbd30`):** with no vault but watched
  addresses, `/` renders the Dashboard, not Welcome
  (`app/app.tsx:136`, `HomeScreen`) — and the decision waits for
  hydration to read the stored xpubs, or Welcome flashes briefly
  before the dashboard takes over.
- **TRON balance fallback — PublicNode (fix programme, 2026-11-28,
  `e6a2727`).** TRON balances read Trongrid first; when Trongrid
  429s the shared egress IP ("request credit rate exceeded"), the
  first fallback is PublicNode's full node
  (`https://tron-rpc.publicnode.com`,
  `wallet/adapters/trx.ts:55`, `PUBLIC_NODE_BASE_URL`): POST
  `/wallet/getaccount`, keyless, CORS-open
  (`access-control-allow-origin: *` with a 204 preflight). A
  never-funded account answers `{}` — read as an exact zero, the
  same rule as Trongrid's empty data list; a 200 with an `Error`
  field is never read as a balance. TronScan
  (`apilist.tronscanapi.com`) is the second fallback — it sends no
  CORS header, so the browser blocks it exactly when it is needed.
  The registry's second TRON endpoint is the same PublicNode full
  node: it answers `/wallet/*` paths but not Trongrid's `/v1/*`
  REST paths — a `/v1` sweep that reaches it 404s fast (404 is not
  retried) and the fallbacks below own the balance then.
- **TRON token (TRC-20) fallback — PublicNode (fix programme,
  2026-11-28).** The TRC-20 read used to hit only the registry's
  first TRON endpoint (Trongrid), so TRON USDT went missing in 3/10
  baseline runs on Trongrid `triggerconstantcontract` 429s while
  native TRX survived the same 429s via its PublicNode fallback.
  The token read now sweeps the TRON endpoints in order (Trongrid
  -> PublicNode) — `wallet/adapters/token-balances.ts:87`
  (`tronTokenBaseUrls`), `:295` (`triggerConstant`, one `withRetry`
  around the whole sweep, one raw attempt per endpoint, the same
  shape as the EVM sweep in `createJsonRpcClient`), `:396`
  (`fetchTronTokenMetadata`), `:560` (`fetchTrc20Balance`, which
  reports the endpoint that actually answered as its source, so a
  PublicNode balance never claims Trongrid). PublicNode answers
  POST `/wallet/triggerconstantcontract` with the same shape as
  Trongrid — probed live 2026-11-28 for USDT
  `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` / owner
  `TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5`: both hosts 200, balance
  258880897 base units, `decimals()` 6, OPTIONS preflight 204 with
  `access-control-allow-origin: *`. TronScan cannot join this sweep:
  its API has no `triggerconstantcontract` (POST
  `/api/triggerconstantcontract` answers 405, probed the same day).
  No CSP change: `tron-rpc.publicnode.com` is already in
  `connect-src` for the native fallback. Unit tests
  (`token-balances.test.ts`, TRC-20 balanceOf / metadata /
  verifyTronToken) cover the Trongrid-429 fall-through and the
  all-endpoints-down error; e2e `lane2-tron-usdt-fallback.spec.ts`
  aborts `api.trongrid.io` in the browser and adds USDT by
  contract through PublicNode at 390/1280 px.
- **Failed rows stay visible, never vanish (fix programme,
  2026-11-28, `e6a2727`).** A chain whose balance check fails keeps
  its row with an honest error — "Balance unavailable" / "Could not
  load balance" (`screens/asset-rows.tsx:401`, `:536`) — plus the
  `FailedBalancesRetry` control (`screens/dashboard.tsx:675`); only
  the failed row is ever marked, a failure never blanks the rest of
  the list. The one exception is a balance that can never be
  fetched: a no-address / devnet-no-tokens row renders as zero,
  because a Retry for it could only fail again
  (`asset-rows.tsx:222`, `noWalletBalance`). The 24h change rides on
  the same row model (`asset-rows.tsx:58`, `change24hForEntry`) —
  /assets rows now show it, closing Lane B's gap (dashboard and
  /assets both render `AssetRows`).
- **Activity wallet switcher, counted progress, /track auto-retry
  (fix programme, 2026-11-28, `63fb8c4`).** Activity
  (`/transactions`) has a wallet switcher — a `#history-wallet`
  select (`screens/transaction-history.tsx:398`) offering the HD
  accounts and the watch-only wallets, so a watched wallet's history
  is viewable at last (Lane B: no path existed). While history
  loads, the wait is counted — "Checked N of M chains…"
  (`transaction-history.tsx:485`) — so a 15–20 s wait reads as
  progress, not a stuck spinner; rows stream in as chains settle on
  the watch-only path. `/track` address-activity auto-retries
  transient failures up to 3 attempts (`ACTIVITY_MAX_ATTEMPTS = 3`,
  `screens/track-transaction.tsx:44`, `:262`) with 1 s then 2 s
  backoff, showing "Retrying, attempt N of 3"; a non-transient
  failure ("Indexer unavailable") is one attempt only, then the
  honest error.
- **Watch-only display programme — combined hero, allocation, live
  balances (owner order 2026-11-28 ~20:17 IST, `4728ff1`;
  audit `/home/boxd/workspace/bawa-watchonly-audit/report.md`,
  research
  `/home/boxd/workspace/bawa-watchonly-research/REPORT.md`,
  decisions §51).** The hero rule above (a watched address as the
  no-vault fallback) is superseded by the combined hero: the
  homepage total is the vault + all watched wallets together, and
  the hero follows the wallet switcher — All wallets shows the
  combined total, one wallet shows that wallet's part
  (`screens/dashboard.tsx:640-660`, `displayTotal`; switcher state
  `:483`, options `:939-954`). On "All wallets" with both sides the
  split line reads "Your wallets $X · Watched $Y"
  (`dashboard.tsx:913-916`) so watched money is never silently
  counted as the user's own (MetaMask Portfolio pattern). A watched
  selection gets the eye mark and a persistent "Watching <address>
  — view-only, can't send." banner (`dashboard.tsx:976`); Send/Swap
  render disabled with the reason when viewing watch-only
  (`dashboard.tsx:1082-1109`). The per-chain allocation (OKX +
  Zerion pattern): each watched wallet shows its Top-5 chains with
  shares and its total — in the Watch-only section in State A and as
  a standalone section in State B, where the main rows ARE the
  watched wallet (`screens/asset-rows.tsx:1352-1383`, `:1505-1531`,
  `:1533-1549`); more than 5 chains reads "And N more chains — see
  the rows below." The Watch-only sections on Home and /assets
  include token rows, not natives only — one row per token per
  watched chain from `watchTokenBalances`
  (`asset-rows.tsx:1302-1342`). **Live balances (polling-guide
  pattern):** balances poll every 45 s while a portfolio screen is
  mounted (`screens/use-live-balances.ts:18`,
  `BALANCE_POLL_INTERVAL_MS = 45_000`), pause while the tab is
  hidden, refresh when it becomes visible again, and keep the manual
  "Refresh balances" button; the poll is also the bounded auto-retry
  — a failed fetch recovers on the next tick and its last-good value
  stays visible meanwhile, so a failed balance never silently counts
  as $0 (`use-live-balances.ts:20-58`). "Balances updated HH:MM"
  sits beside "Prices updated HH:MM" (`dashboard.tsx:998-1000`;
  stamp set in `state/wallet-context.tsx:1133`, `:1414`). A failed
  or unpriced holding is named in the hero's Missing note
  ("Missing: Dogecoin balance.", `dashboard.tsx:1007`) — never just
  "(Partial)"; a balance that can never be fetched (no address / no
  adapter / disabled / devnet-no-tokens) no longer forces Partial
  forever (`dashboard.tsx:37-46`).
- **Watch-only display programme — Activity default, add flow, asset
  detail, /track (same order, `4728ff1`; decisions §51).**
  **Activity default:** with no stored choice, if the vault's
  history has settled with zero rows and a watched wallet exists,
  Activity opens on the first watched wallet; the stored choice is
  never overridden (`screens/transaction-history.tsx:322-355`).
  **Add flow:** the address field is first on the Watch-only tab
  ("Paste any address — the chain is detected automatically."), the
  chain picker below for xpubs and multi-chain addresses only
  (`screens/import-wallet.tsx:899-904`, `:938`). **Asset detail:** a
  known imported address never reads "No address is available" —
  the error is "Could not load the balance." with "The address is
  imported — this is a load failure. Try Retry below."
  (`screens/asset-detail.tsx:640-644`); the addresses block reads
  "Watched address" for a watched wallet
  (`asset-detail.tsx:1005`); token history loads the token's
  transfers (EVM `tokentx`,
  `wallet/adapters/evm.ts:392-402`) with the adapter registration
  awaited first and one delayed retry on error
  (`asset-detail.tsx:233-247`), a failed load saying "Could not load
  token transactions. {reason}" with Retry
  (`asset-detail.tsx:934`). **/track:** linked from the nav
  (`app/sidebar-nav.tsx:37-50`) and prefilled from `?address=` /
  `?chain=` or the first watched wallet, auto-running its recent
  activity once (`screens/track-transaction.tsx:182-197`,
  `:239-279`). **Research sources (patterns only, no code copied):**
  Phantom help centre — watch-only addresses and
  add-another-wallet; OKX help — manage-my-wallet (web); MetaMask
  Portfolio review + `@metamask/watch-only-keyring` (licence NOT
  verified — pattern only); Trust Wallet help — watch-only wallets;
  Bitget Wallet v7.3.1 blog; Zerion / DeBank / Rabby tracker layout;
  Web3 dashboard polling guide (khalilahmed.dev) + wallet-tracking
  API comparison (bitquery.io). Full URLs in the research report.
  **Known partial (2026-11-28, Blockscout 429s on loud-stone's
  shared egress IP):** USDC token-history rows and /track
  recent-activity rows did not load in verification — "Could not
  load token transactions. HTTP 429" / "Tried 3 times — the indexer
  stayed unreachable." They load once the rate-limit window resets,
  a different egress IP is used, or a keyed history source is
  configured (the owner decision already pending for the four
  history-blocked chains, §2.7). **Not changed by this programme:**
  the hero count-up still animates from $0 at first paint; amounts
  still render at full precision; "Hide zero balances" is still a
  manual toggle, off by default.

## §10. Devnet mode — temporary, exception E1, expires 2027-02-20

- Devnet mode is a **temporary, test-only switch** (owner order
  2026-11-22), clearly marked, removable without touching mainnet, and
  **never merged** into mainnet behaviour. Implementation:
  `apps/web/src/wallet/devnet.ts` (`DEVNET_ENABLED_KEY =
  'bawa-devnet-enabled'`), `apps/web/src/wallet/devnet-endpoints.ts`.
- It exists to test send and receive on every chain with valueless test
  tokens and report per chain with transaction hashes. The owner extended
  it to cover ALL tokens, not just the four main chains. The picker offers
  only devnet chains in devnet mode (`docs/DEVNET-SEND-CRASH-FIX.md`).
- **Exception E1** (`CONSTRAINTS.md`, owner 2026-11-22, **expires
  2027-02-20**): carves the devnet-only broadcast path out of the "no
  broadcast path" floor. Mainnet broadcast stays disabled (`broadcastSigned` returns `{ status: 'disabled' }`).
  If devnet is still needed after 2027-02-20, the owner must renew it.
  Recorded in `docs/DECISIONS.md:399-410` and `:685`, `:770`.
- `AGENTS.md` §8 ("No broadcast path was built or enabled") is read with
  E1: the DoD line states the mainnet rule; E1 is the recorded, expiring
  devnet-only exception. Do not edit the DoD line to weaken it.

## §11. WalletConnect — REMOVED (providers programme, 2026-11-26)

**Status: REMOVED.** WalletConnect was removed from the web wallet
in the providers programme (commit `7fb1c4a`, 2026-11-26, hands-on,
0 Sol calls). The `/walletconnect` screen no longer exists. What was
deleted, verified against that commit:
`apps/web/src/screens/walletconnect.tsx` + its test;
`apps/web/src/wallet/walletconnect.ts`,
`walletconnect-client.ts`, `walletconnect-signing.ts` + their tests;
the lazy `/walletconnect` route, the `loadWalletConnect` loader and
the preload-map entry in `apps/web/src/app/app.tsx`; the nav entry in
`apps/web/src/app/sidebar-nav.tsx`; the CSP entries for
`wss://relay.walletconnect.org`, `https://verify.walletconnect.org`
and `https://verify.walletconnect.com` in
`apps/web/src/app/security-headers.ts`; and the
`@walletconnect/sign-client` and `@walletconnect/utils` 2.21.0
dependencies from `apps/web/package.json` (+ `package-lock.json`).
The `VITE_WALLETCONNECT_PROJECT_ID` prompt went with the screen; the
name now appears only in the restoration note below and its test. The
~348 KB lazy SDK chunk went away with the dependency (it measured
348,194 B in the Lane C tree; see §0.2 — the merged-tree total there
predates the removal). The screen list in `apps/web/README.md` was
updated the same way. Two files still mention WalletConnect in
comments only — `apps/web/src/wallet/caip.ts` (function names mirror
`@walletconnect/utils`) and `apps/web/src/wallet/send.ts` — neither
imports the package.

Why — proven from WalletConnect's own docs and a live test, not
assumed (research: `RESEARCH.md` §1 in
`/home/boxd/workspace/bawa-providers/`, and
`research/walletconnect.md` there): the relay authenticates the Cloud
projectId — the Relay doc's error table returns 401 when the project
ID doesn't exist, and Reown's AppKit options doc marks `projectId`
"Required: Yes". With the real `@walletconnect/sign-client@2.21.0`
and no projectId, `init()` succeeds but the relayer never connects
and `connect()` never yields a pairing URI (live test, 2026-11-26: no
`relayer_connect` event in 12 s; a raw WebSocket probe was closed
with JSON-RPC error 3000 "JWT is missing"). Omitting the id does not
fail loudly — it ships a dead screen. A self-hosted relay is not a
path: WalletConnect's own relay README says it is unsupported, the
repo is frozen at the pre-2.21.6 protocol, and the v2 pairing URI
carries no relay address (`relay-protocol=irn` only), so both peers
must share one relay and every public dApp uses the official one.

What replaces it — a short honest note where the screen was, in
Security settings (`apps/web/src/screens/security-settings.tsx`):
"WalletConnect — connecting Bawa to dApps — is not available in this
build. It needs a free Reown Cloud project ID, which has not been set
up. No keys or funds are affected." Restoration, if the owner ever
wants it: create a free account at https://cloud.reown.com, create a
project, copy the projectId into `VITE_WALLETCONNECT_PROJECT_ID`,
and restore the deleted files from git history.

History kept, because it still binds a future restoration
(`docs/DECISIONS.md` §26 is the Lane C decision record):

- **Pin 2.21.0 — the last Apache-2.0 release.** The WalletConnect JS
  SDK is no longer Apache-2.0: 2.22.0+ switched to Reown Inc.'s custom
  WalletConnect Community License Agreement (20 Aug 2025). Key terms:
  §2(b) all use must connect to Reown's proprietary gateway unless
  explicitly approved otherwise; §3 commercial licence above 500 MAU/month
  or 2.5M RPC/month; §1(c) Reown owns all modifications/derivative works
  of the SDK; §10 binding arbitration, Delaware law. Bawa does not accept
  those terms by default. **Do not install 2.22.0 or later without an
  owner decision recorded in `docs/DECISIONS.md`.** Restoring at 2.21.0
  needs the same owner decision for the projectId itself.
- **What the removed screen did (for the record, not as a current
  feature).** It paired with a dApp by `wc:` URI, showed the session
  proposal for approve/reject, and answered signing requests —
  message signing ONLY (`personal_sign`, `eth_signTypedData`,
  `eth_signTypedData_v4`, `eth_chainId`, `eth_accounts`) for Ethereum
  chains. Transaction signing (`eth_sendTransaction`,
  `eth_signTransaction`) was never approved — sending stays switched
  off, so no session could move funds. A live dApp connection was never
  verified — it needed the owner's projectId.
- **Measured cost of the removed code (Lane C tree, history).**
  Minimal `import { SignClient }`, esbuild bundle + minify: **2.21.0 =
  396,013 B minified / 121,377 B gzip**; 2.26.0 = 455,831 B / 137,742 B
  gzip. In Bawa's build: total JS 4,577,447 (+397,262 over its 4,180,185
  base); lazy `walletconnect-client` chunk 348,194 B; main-bundle delta
  +49,068 B; 0 occurrences of the relay URL in the main chunk. All of
  it is gone with the removal — do not quote these figures as current
  costs.
- **A WalletConnect Cloud projectId is required** for sign-client, on
  any restoration. Bawa has none. Obtaining one is an owner step; never
  invent or hardcode one.
- **Wallet-side API only (for any future restoration).** The verified wallet-side surface is
  `approve` / `reject` / `respond` and session authenticate
  (in `walletconnect-monorepo`, `/home/boxd/workspace/wallet-repos/
  walletconnect-monorepo/`). Bawa IS a wallet: dApp-side libraries are
  the wrong side. **ConnectKit is dApp-side** ("a React component library
  for connecting a wallet to your dApp", BSD-2-Clause) — not usable for
  Bawa, not installed. `web3modal`/AppKit is dApp-side under the Reown
  licence — same exclusion.
- **Android route (alternative, not this lane):** `WalletConnectKotlinV2`
  (Apache-2.0, `com.walletconnect:web3wallet`) — the Android-first option,
  where the web bundle budget does not apply. Owner decision (a)–(d) in
  the survey: accept Reown + gateway + projectId and lazy-load; pin
  2.21.0 and accept no further updates; defer until re-baseline; or ship
  Android-first via Kotlin.
- **Android route, verified by Lane H (2026-11-26, mining pass).**
  The Kotlin SDK is live on Maven Central:
  `com.walletconnect:web3wallet`, latest **1.35.2** (verified from
  loud-stone against `repo1.maven.org/maven2/com/walletconnect/
  web3wallet/maven-metadata.xml`). Licence Apache-2.0 (LICENSE file in
  `/home/boxd/workspace/wallet-repos/WalletConnectKotlinV2/`). The
  wallet-side surface is verified in the clone: `Web3Wallet`
  delegate `onSessionProposal` and `approveSession(params, onSuccess,
  onError)` (`product/web3wallet/src/main/kotlin/com/walletconnect/
  web3/wallet/client/Web3Wallet.kt`) — note `approveSession` is marked
  for replacement by `WalletKit.approveSession`; use the WalletKit
  name in new code. The repo ships a BOM; the sample uses
  `implementation("com.walletconnect:web3wallet")` through it. **Not
  added to `apps/android/app/build.gradle.kts` by Lane H:** the
  Android app is watch-only and testnet-only with no signing path
  (`apps/android/app/build.gradle.kts` header), so WalletConnect is a
  future feature needing a scope decision first. (Lane H also could
  not build-verify the dependency — no Android SDK/JDK on loud-stone
  at the time. That gap is closed: the toolchain is installed and
  `./gradlew assembleDebug` succeeds, §2.6 — a future lane can
  build-verify it.)
  A WalletConnect Cloud projectId is still required (owner step;
  never invent or hardcode one).
- Removal verified against commit `7fb1c4a` (providers programme,
  2026-11-26): the screen, the three modules, the route, the nav
  entry, the CSP entries and both dependencies are all gone from the
  tree; the restoration note is in Security settings.
- **The Android data programme's 4th decision (WalletConnect
  projectId) is now moot for the web wallet** — the projectId
  requirement is removed with the feature. It remains an owner step
  only if WalletConnect is ever restored, or for the Android route
  above.

## §12. Coinbase Onramp Buy — IMPLEMENTED (Lane D)

**Status: IMPLEMENTED.** Dashboard Buy tile → `/receive?buy=1` Buy
panel → the Coinbase Onramp pop-up. Implementation:
`apps/web/src/wallet/onramp.ts` + the Buy panel in
`apps/web/src/screens/receive.tsx` (the `?buy=1` branch). The widget
opens for the wallet's addresses on the ten Coinbase destination
networks (Bitcoin, Ethereum, Solana, Base, Optimism, Arbitrum,
Polygon, Avalanche, BNB Chain, TRON); Coinbase sets the price, fees,
payment methods and regional availability. The panel shows the first
deliverable address the purchase lands on by default — the widget
itself is the network picker. There is deliberately no in-app
success/exit feedback: the purchase completes inside the pop-up and
the delivery shows up as a normal incoming transaction.

The survey's verified facts, which Lane D implemented from:

- **SDK:** `@coinbase/cbpay-js` **2.4.0**, MIT, zero dependencies, from
  `cbpay-js` (`/home/boxd/workspace/wallet-repos/cbpay-js/`). It lets
  users top up a self-custody wallet with fiat — the only Coinbase repo
  aimed at self-custody wallets as the destination.
- **Lazy-load only.** Measured via Bundlephobia: **7,473 B minified /
  2,841 B gzip** — 7,473 B alone exceeds the ~5,304 B headroom at survey
  time (1.4× over; headroom is now 1,517,378 B under the 6,000,000 budget — see §0.2, 2026-11-28). It is loaded by dynamic import on the Buy screen
  only, by design. The Bundlephobia figure is not a build inside Bawa's Vite
  bundle — Lane D must measure the real cost in Bawa's build and record it.
- **The SDK is NOT bundled.** `@coinbase/cbpay-js` 2.4.0 (MIT) is not
  a dependency: its whole 7,282 B survives the build (no
  `sideEffects: false`; a treeshake rule and a `resolveId` plugin both
  failed across three builds). The URL builder in `onramp.ts` is a
  faithful port of the SDK's `generateOnRampURL`, with parity tests
  mirroring the SDK's own URL vectors. Measured cost in Bawa's build:
  +4,447 B. A separate `/buy` route was cut for the same budget
  reason — the Buy UI lives in Receive, reusing its components.
- **Requires Coinbase Onramp onboarding + the public project ID** as
  `VITE_COINBASE_ONRAMP_APP_ID` at build time. Bawa has no Coinbase
  account. Onboarding and keys are owner steps; never invent
  credentials. Without the project ID the Buy panel says so plainly
  and offers no purchase. **A live purchase has not been verified**
  (no onboarding/keys exist yet). This is a new "Buy" feature, not a
  core need.
- **Wrong-side exclusion:** `coinbase-wallet-sdk` and
  `wallet-mobile-sdk` let dApps connect *to* Coinbase Wallet — Bawa *is*
  a wallet, so they do not apply. `onchainkit` is deprecated ("do not use
  them for new projects"). Nothing in the Coinbase org is a self-custodial
  HD-wallet library, BIP-39/32 code, or a QR/share component.
- Re-checked against Lane D's committed code by the coordinator's
  re-check pass (2026-11-26): the Buy tile, the `?buy=1` panel, the
  `onramp.ts` URL builder and the absence of `cbpay-js` from
  `package.json` are all in the merged tree.

### §12.1 Buy provider picker — seven on-ramps (providers programme, 2026-11-26)

**Status: IMPLEMENTED.** The Buy panel is now a provider picker, not
a single Coinbase button. Implementation:
`apps/web/src/wallet/buy-providers.ts` (`buyProviders()`, rendered by
`apps/web/src/screens/receive.tsx:1025`) + the existing Coinbase path
in `apps/web/src/wallet/onramp.ts`. No SDK is bundled for any provider
— every widget URL is hand-rolled, like the Coinbase URL builder.
Providers are integrated in this order, and each row states plainly
which keys it needs and where they live (source of truth:
`RESEARCH.md` §2.8 in `/home/boxd/workspace/bawa-providers/`).

**The deciding constraint:** Bawa is a static site with no backend
(GitHub Pages). Any provider whose flow needs a server-side secret
cannot work as-is — it needs a signing backend/proxy first. That is
why Ramp (on-ramps) is the only one that can work from a static page
once configured — its key is public by design — while MoonPay /
Transak wait on a backend. No provider key is configured yet (see
below), so Buy shows "not set up yet" for every provider today. The
same constraint decides the swaps providers (§12A).

| # | Provider | Key in the app (safe) | Secret (server-only, never in the app) | Works from a static page? |
| --- | --- | --- | --- | --- |
| 1 | Ramp — first, works from a static page once configured | `hostApiKey` — public by Ramp's own design (support article, updated 2026-11-12: "disclosing your API key within the URL is completely safe") | None for the widget | Yes |
| 2 | MoonPay — second, alongside a signing backend | `pk_live_…` publishable key | `sk_live_…` — signs the widget URL (HMAC-SHA256) whenever `walletAddress` is pre-filled; without the signature the widget fails to load | No with address pre-fill; yes if the user pastes their own address (worse UX — do not present it as the polished path) |
| 3 | Onramper — third, or instead of MoonPay | `apiKey` — public identifier in the widget URL | Signing key pair (production go-live) | Yes (widget) |
| 4 | Banxa Referral — cheap fourth | None — only the `partnerRef` subdomain | `x-api-key` (API path only) | Yes (Referral) |
| 5 | Transak — when a backend exists | API key | API secret — the widget URL itself is minted server-side since the 2026-11-16 migration; there is no client-side path | No |
| 6 | Mercuryo — fallback | `widget_id` | Widget secret (address signing), Sign Key, `Sdk-Partner-Token` | Partial (redirect yes; address pre-fill no) |
| 7 | Coinbase — the previous single provider, kept last | Public project ID (`VITE_COINBASE_ONRAMP_APP_ID`) | CDP API key + private key — since 2025-07-31 the widget needs a server-minted session token | No (without a backend); kept as a row, see §12 |

- **What is built, and what is deliberately not.** `buy-providers.ts`
  builds widget URLs for Ramp, MoonPay, Onramper, Banxa, Mercuryo and
  Coinbase; MoonPay / Onramper / Mercuryo builders take NO address
  (their signatures must come from a server — MoonPay omits
  `walletAddress`, Onramper omits `wallets` / `networkWallets`,
  Mercuryo omits the address, and its signature scheme is unresolved:
  SHA-512 vs HMAC-SHA512 — resolve it from Mercuryo's own security
  page before implementing address pre-fill). There is NO Transak
  builder at all: no client-side path exists since the migration. No
  key is ever invented: every config value is empty by default and
  comes from the owner-must-provide list below. **Honest states:** any
  provider whose key or onboarding the owner has not provided shows as
  "not set up yet" with what is needed — never a fake "Buy" that
  cannot work (`buyProviderReadiness`: `ready`, `ready-no-prefill`,
  `not-configured`, `needs-backend`).
- **Fees are indicative only; the quote at purchase time is
  authoritative.** Ramp cheapest by bank transfer (up to 1.40%
  manual); MoonPay up to 4.5% by card; Onramper $199/month business
  plan (third-party figure) + provider quotes; Banxa 1.99% processing
  on card/Apple Pay, 0% on other methods (spread and partner settings
  dominate the all-in cost); Transak card 3.99% + $1, bank 2% + $1
  (November 2026 figures — re-check at integration time, they moved
  during 2026); Mercuryo up to 5.5% by card, up to 3% by bank; Coinbase
  about 2.5% by card (third-party figure). Full table: `RESEARCH.md`
  §2.9.
- **Region gating (Ramp).** EU/EEA users cannot buy USDT/USDT0/DAI/AUSD;
  eight US states + Puerto Rico unserved (Louisiana, Minnesota, Nevada,
  New Jersey, New York, Pennsylvania, Vermont, Washington, Puerto
  Rico); Texas no stablecoins. Bawa does not know the user's region,
  so the restrictions are stated on the Ramp row and enforced by pure
  helpers for callers that do know it; the default pre-fill buys the
  chain's NATIVE asset, which no regional rule blocks.
- **Per-chain availability is gated in the Buy UI, not one global list.**
  `rampAssetFor`, `moonpayCurrencyFor`, `banxaCoinFor` and
  `onramperSupportsChain` map each Bawa chain to the provider's live
  asset list. **TON, previously unconfirmed for every provider, is now
  confirmed live** (Buy lane, 2026-11-26, against the providers' own
  live lists): Ramp — TON chain, `TON_GRAM` native (enabled) +
  `TON_USDT`; MoonPay — code `gram`, `minBuyAmount` 5.21, TON address
  regex; Banxa — GRAM on TON, Buy ✅ (restricted geo: US). Mercuryo
  TON stays unconfirmed — its live pairs list mixes fiat and crypto
  codes, so a bare `TON` entry there is ambiguous — and Mercuryo
  carries no chain pre-fill anyway, so nothing in the UI depends on
  it. Not prioritised: Paybis, Wert, Simplex, Stripe (backend-required,
  sales-gated, fees/SDK unverified from own docs, or too narrow —
  Stripe is US/EU + stablecoins only, still in preview).
- **Owner must provide (onboarding is the bottleneck).** No provider
  gives a production key instantly; every one needs a partner account
  + KYB/business verification, so do not promise a date until the keys
  are in hand. Ramp: onboarding form + KYB → production `hostApiKey`.
  MoonPay: dashboard account → Account Review + Business Verification
  (KYB) + product approval → `pk_live_…` + `sk_live_…`, plus a signing
  backend before addresses can be pre-filled. Onramper: account +
  API key + signing key pair + $199/month plan. Banxa: `partnerRef` +
  API key. Transak: signup (corporate email) → KYB → API key + API
  secret. Mercuryo: dashboard access via an integration manager →
  widget + `widget_id`. Coinbase: onboarding + project ID (§12). Full
  list: `RESEARCH.md` §4.1. **A live purchase has not been verified
  for any provider** (no onboarding/keys exist yet).

## §12A. Swaps — provider-aware quotes (providers programme, 2026-11-26)

Numbered §12A, not §13, so the sections after it keep their numbers:
it sits between Buy (§12) and Shamir (§13) because it belongs with
the money-in/money-out features, and renumbering §13–§18 for it would
break every cross-reference in this spec.

**Status: IMPLEMENTED (quotes only).** One swaps button → one screen
with a provider-aware quote comparison: per pair, each covering
provider's expected output + fee + time, with the cheapest/best
pre-selected; pairs no provider covers are shown as unavailable with
the reason, never with an invented quote. Implementation:
`apps/web/src/wallet/swap-providers.ts` (`providersForPair`,
`selectBestRoute`, `COMPARE_CHAINS`, `UNCOVERED_CHAINS`),
`swap-quotes.ts` (LI.FI), `relay-quotes.ts`, `stonfi-quotes.ts`,
`gaszip-refuel.ts`, rendered by `apps/web/src/screens/swap.tsx`.
Route selection prefers Relay / STON.fi where they cover the pair and
are cheaper, and falls back to LI.FI otherwise; "cheaper" is the
highest expected output for the same pair, ties break toward Relay,
then STON.fi, then LI.FI, and only LIVE quotes compete — honest
not-set-up / not-covered states never win. **Quotes first; execution
approved but not implemented** — the owner approved swap execution on
2026-11-27, but no execution path is built yet, and broadcast stays
disabled on mainnet in code until that implementation lands and is
verified (§0.1). Nothing here signs, sends or bridges
anything.

**The deciding constraint** is the same as for Buy (§12.1): Bawa is a
static site with no backend. Any provider whose flow needs a
server-side secret cannot work as-is — it needs a signing
backend/proxy first. That is why gas.zip and STON.fi work today and
Relay waits on a proxy.

1. **gas.zip — first, "Refuel gas".** No key, no account, no backend,
   no SDK: public GET quotes from `https://backend.gas.zip/v2`
   (`GET /v2/chains`, `GET /v2/quotes/<deposit_chain>/<deposit_wei>/
   <outbound_chains>`) + one user-signed transaction to the Direct
   Deposit address. It is gas refuel only (native gas assets) — it
   does not swap or bridge tokens. It appears as a separate "Refuel
   gas" action, never labelled a swap. Limits $0.25–$50 per destination
   chain. No published fee schedule (verified gap) — the fee lives
   only in the quote, so the UI must show the quote's per-chain
   `expected`/`usd` before signing. Quotes expire — re-quote if stale.
   Live-checked 2026-11-26: `GET /v2/chains` returned 186 entries
   (the docs overview says 300+ destination / 77 deposit chains — the
   live list is the authority at integration time); the deposit address
   comes from the live quote's `contractDepositTxn.to` for THAT deposit
   chain — never the docs' example address (`0x391E…`, which a live
   quote showed is a different address, `0x2a37…`, and which gas.zip's
   own screening flags as high-risk); a quote without it is malformed
   and surfaces as unavailable. Solana is listed as a destination
   (chain 501474) but live quotes fail with "Chain Limit Exceeded", so
   it is excluded from the destination list with that reason, never
   offered dead.
2. **Relay (RelaySwap) — second, quotes-first.** The best general
   cross-chain swap engine: one endpoint (`POST /quote/v3` on
   `https://api.relay.link`) covers bridge, same-chain swap,
   cross-chain swap and calls. Cheapest fees (0.00% bridge, 0.01–0.15%
   swaps, +$0.02 flat). **Blocker: the API key is secret and
   server-side only — it must never ship in the app.** The client talks
   to a CONFIGURABLE proxy that appends the key server-side (the docs'
   own recommendation), or sends a 15-minute access token minted by a
   backend; the proxy base URL comes from `VITE_RELAY_PROXY_URL` and is
   EMPTY by default — with no proxy configured, quotes report
   `not-configured` with the honest sentence. This module NEVER fakes
   keyless operation and NEVER accepts an API key (there is no apiKey
   parameter anywhere in `relay-quotes.ts`, by design). No Relay SDK is
   in the tree — quotes go over raw REST through the proxy, so there is
   no `@relayprotocol/relay-sdk` version to pin (the research said pin
   9.x if the SDK is ever adopted). **Licence UNVERIFIED** — npm
   metadata declares no licence field; read the SDK repo's LICENSE file
   before vendoring any of its code. The proxy's origin must also be
   added to `connect-src` in `security-headers.ts` at deploy time. Owner
   must provide: Relay Dashboard account + App + API key, and the
   proxy/token endpoint. Coverage, live `GET /chains` 2026-11-26: **58
   chains**, none disabled — 33 EVM chains + BTC, SOL, TON, TRX and
   XRP. XRP IS covered (xrpvm, Limited, XRP only, bridging supported) —
   the research had listed it as not covered. NOT covered: LTC, DOGE
   (neither appears in `/chains`), fraxtal, immutable, taiko, astar,
   telos, conflux, core, songbird, rootstock, pulsechain, xdc, chiliz,
   flare, zetachain, hemi, opbnb, aurora, fantom, kava, filecoin, and
   the whole Cosmos / Polkadot / NEAR / Aptos / Tezos / Algorand /
   Hedera / Cardano / Kaspa / Starknet slice. Non-EVM legs are Limited:
   BTC native only, TON GRAM only, TRON USDT/TRX only, XRP native only;
   Solana is tokenSupport All. (The docs say 69+ networks — the live
   `/chains` count of 58 is the authority.)
3. **STON.fi Omniston (+ TON DEX) — third, as the TON leg.** The only
   route that gives Bawa TON↔EVM swaps at all, with no key, MIT SDKs,
   and a clean client-side flow. Omniston (RFQ + HTLC atomic swaps, API
   v1beta8, `wss://omni-ws.ston.fi`) covers 15 chains, **stablecoins
   only** (USDT/USDC/USDT0/pUSD/USDg + TON GRAM); Solana is NOT covered;
   TRON is listed but live-unverified: the live chains page was re-fetched 2026-11-27 (HTTP 200, USDT TRC-20 `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`), the production WebSocket accepts connections, but every live TRON RFQ came back `noQuote` — no resolver is quoting TRON in either direction at any tried amount. TRON pairs are flagged live-unverified and are NOT offered until a live quote is seen. DEX pool fee
   default 0.3%. **Status in the tree: live quotes + TON order signing wired, execution gated.** `stonfi-quotes.ts` holds the Omniston asset table (from the live chains page), the pair-coverage check, the QuoteRequest builder AND the live RFQ client (`fetchStonfiQuote`), which runs on the real SDK. The SDK is installed: `@ston-fi/omniston-sdk@0.8.13` — **exact pin 0.8.13** (latest 0.8.x, MIT verified first-hand from the installed package's LICENSE; the SDK README warns breaking changes may happen even in minor releases while major version is 0). It loads by dynamic import inside `fetchStonfiQuote`, so it lands in its own async chunk and only loads when a STON.fi quote is fetched. The Swap screen shows live quotes where the corridor covers the pair — proven live 2026-11-27: 1 USDT on TON → 0.972388 USDC on Base, "Best quote" — and the honest not-covered / no-quote state where it does not. No STON.fi quote is ever invented. No current per-transaction limit is published anywhere official — the only figure is the 2026-06-16 launch post's temporary $1,000 at launch, five months stale, so it is not quoted as current. TRON is live-unverified: still listed on the live chains
   page with USDT (TRC-20 `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`) and the
   production WebSocket accepts connections, but NO live TRON quote has
   been seen — TRON pairs are flagged live-unverified and are NOT
   offered until one is. **TON signing is wired (signed BoC only, no broadcast):** `signStonfiOrderTonOffline` in `stonfi-signing.ts` signs an order's messages TON Connect-style with the existing Trust Wallet Core engine (V4R2, mode 3, `m/44'/607'/0'` for account 0) and returns the signed BoC only — verified 2026-11-27 against a real live orderTx (quoteId `7fc458a6…59e`), 15 tests. Quotes need no signature; execution still needs its implementation — the owner approved swap execution on 2026-11-27, but no execution path is built yet; broadcast stays DISABLED on mainnet until then. Owner must still provide: destination-chain integrator address(es) and the fee choice (`integratorFeePips` / `referralValue` bps); nothing else.
4. **LI.FI — stays as the fallback.** Already integrated and proven live
   in Bawa (0.1 ETH → POL). Apache-2.0, no key for basic use. Live
   `GET https://li.quest/v1/chains` 2026-11-26 returns **64 chains**,
   all EVM type in that response (including 3 Sepolia testnets); Solana
   is supported via the separate chain id already in the tree
   (1151111081099710). There is NO `@lifi/sdk` in this tree — Bawa
   quotes LI.FI over raw REST (`li.quest`), not the SDK, so there is no
   4.x version to pin (the research said pin the exact 4.x version if
   the SDK is ever adopted). Sui, Stellar and Zcash coverage is per
   LI.FI's docs (SDK providers) and is NOT verified through Bawa's REST
   path — do not claim it from the app's chain list. 0.25% service fee
   per transaction — the highest headline fee of the four, the price of
   that breadth. Route selection prefers Relay / STON.fi where they
   cover the pair and are cheaper, and falls back to LI.FI otherwise.

**Coverage honesty:** no provider covers the Cosmos-family / Cardano /
Starknet slice of Bawa's 87 chains, nor LTC, DOGE, Stellar or Filecoin
— the exact uncovered set is computed in code (`UNCOVERED_CHAINS` in
`swap-providers.ts`; a chain is offered in the pickers when at least
one provider covers it, the rest are listed as uncovered with the
reason). Label coverage per pair honestly in the UI, and never hardcode
the list here — it moves when a provider's live list moves.

## §13. Shamir backup shares — IMPLEMENTED (Lane E)

**Status: IMPLEMENTED.** The vault's raw 256-bit AES-GCM key — never
the recovery phrase — is split into N-of-M shares (2-of-3 / 2-of-5 /
3-of-5) via `shamir-secret-sharing` 0.0.4 (Privy org, Apache-2.0),
lazy-loaded. Implementation: `apps/web/src/wallet/backup-shares.ts`
+ `apps/web/src/screens/backup.tsx` (Shares tab), lazy-loaded from
`apps/web/src/app/app.tsx` (`loadBackup`); the Shares tab lives
under `/mnemonic-backup?tab=shares` (`/backup-shares` redirects there);
the screen is linked from Security. Shares are
`bawa-share-v1:` base64 + QR. Restore is proven by trial-decrypting
the real vault envelope after combining (`combine` does NOT verify
reconstruction integrity, so a bad reconstruction errors clearly
instead of being silently accepted). No restore-from-shares UI exists yet — check-only by design. A
password change cancels all share sets (§4): the shares split the
vault key, and `changePassword` derives a new key under the new
password — create fresh shares after changing the password.

The survey's verified facts, which Lane E implemented from:

- **Library:** `shamir-secret-sharing` (Privy org), Apache-2.0
  (verified three ways: API, LICENSE file, npm), zero-dependency
  TypeScript, GF(2^8), `Uint8Array`, Node + browser, `split` /
  `combine`. Source: `/home/boxd/workspace/wallet-repos/
  shamir-secret-sharing/`.
- **What to split:** the vault's AES-GCM key (or raw seed entropy) into
  N-of-M shares (for example 2-of-3). **Do NOT split raw mnemonic words**
  — they are not uniformly random. **Encrypt first, split the key.**
- **`combine` does NOT verify reconstruction integrity.** Bawa must
  trial-decrypt the vault after combining and error clearly on bad
  shares. Never silently accept a bad reconstruction.
- **Shares are raw bytes, not words.** This is NOT SLIP-39 (shares are
  raw bytes, incompatible with SLIP-39 word-shares). Bawa must add
  user-facing encoding (base64 and/or QR) for the shares.
- **Measured cost in Bawa's build:** the Backup screen chunk is
  17,019 B (`dist/assets/backup-*.js`, measured on the `2205f15`
  publish build, 2026-11-28) — the whole Backup screen (both tabs,
  Shamir library included, `bawa-share-v1:` present in the chunk) ships
  as this one lazy chunk. The 10,085 B `backup-shares-*.js` figure was
  the 2026-11-26 measurement, before the Shares tab moved into the
  single Backup screen — do not quote it as the current chunk. The
  Shamir library alone was 4,785 B and the main-bundle delta +923 B
  at the 2026-11-26 measurement; neither has been re-measured at this
  tip. The library is loaded by dynamic import on the backup
  screen only.
- **Vault change (flagged for review):** `autoUnlock()` now imports the
  stored key extractable so an auto-unlocked vault can create shares.
  The lane's claim is that this adds no new privilege (page JS can
  already read the mnemonic while the vault is unlocked) — that claim
  needs a second look at review time. The extractable-key rationale is
  recorded in `apps/web/src/wallet/vault.ts:463-465` so it is not
  missed.
- **Custody boundary:** Privy's model is the opposite of Bawa's
  self-custody — Privy embedded wallets route key material through
  Privy's infrastructure (TEE/HSM) with a Privy App ID/secret. Adopting
  any Privy SDK would be a redesign, not an integration. Only the
  standalone Shamir library is in scope; no Privy service, App ID, or
  dashboard account is used.
- Re-checked against Lane E's committed code by the coordinator's
  re-check pass (2026-11-26): the share creation, the `bawa-share-v1:`
  encoding, the trial-decrypt restore check and the lazy chunk are
  all in the merged tree.

- **Backup-completion flag (P1 item 8, S3-A).** One flag,
  `bawa-backup-done` in `localStorage`
  (`apps/web/src/wallet/backup-state.ts` — stores the flag only, never
  a mnemonic, password or key). It is set only when the user takes a
  backup step on the Backup screen: revealing the phrase
  (`RecoveryPhrasePanel` `onBackedUp`) or creating a set of shares
  (`BackupSharesPanel` `onBackedUp`) calls `markBackedUp()`
  (`apps/web/src/screens/backup.tsx:737-740`), which calls
  `writeBackupDone()`. The Wallets screen reads it
  (`apps/web/src/screens/wallet-management.tsx:153`): a backed-up
  wallet shows a "Backed up" badge, otherwise a "Back up your recovery
  phrase" nudge linking to `/mnemonic-backup`. Deleting the vault
  clears the flag (`vault.ts:851`), so a fresh vault never inherits a
  previous wallet's "Backed up". **Follow-up (S3-a, CLOSED 2026-11-28, `734cfef`):** Create now calls `writeBackupDone()` at the end (`create-wallet.tsx:203`), so a fresh wallet shows the 'Backed up' badge on Wallets (3 new assertions on success + both failure paths).

## §14. ERC-7730 clear signing — IMPLEMENTED (Lane F)

**Status: IMPLEMENTED.** The Send review screen shows an ERC-20 token
send as human-readable rows (Send, To, Amount) from a curated
ERC-7730 snapshot (`apps/web/src/wallet/clear-signing-snapshot.json`,
1,523 bytes; generic ERC-20 transfer/approve + 1inch `unoswapTo`).
Unknown calls fall back honestly to raw data. Implementation:
`apps/web/src/wallet/clear-signing.ts` +
`apps/web/src/screens/send-review.tsx` (with
`send-review-clear-signing.test.tsx`); the snapshot is generated by
`apps/web/scripts/generate-clear-signing-snapshot.mjs`. CAIP-2/CAIP-10
helpers in `apps/web/src/wallet/caip.ts` are implemented from the
public specs — no code taken from WalletConnect (the CAIP module lives
in the WalletConnect monorepo under the Reown licence).

**Review section, scope and refresh.** The Send review screen shows a
"Contract call" section (`apps/web/src/screens/send-review.tsx`) for
calls the snapshot resolves: the generic ERC-20 `transfer`/`approve`
descriptors (which apply to any ERC-20 contract) and the vendored 1inch
AggregationRouterV6 `unoswapTo` only. The decoder handles address and
uint parameters only; the registry's `$ref` formatters (token amounts,
address names, dates, enums) are not implemented, and EIP-712 is not
wired — the wallet has no EIP-712 signing surface. A call the snapshot
does not resolve falls back to raw calldata; a reading is never
invented. Refresh: re-run
`apps/web/scripts/generate-clear-signing-snapshot.mjs`, pulling the
registry from upstream (`ethereum/clear-signing-erc7730-registry`);
the surveyed checkout was the okxlabs fork at `3d60345`.

The survey's verified facts, which Lane F implemented from:

- **Data:** `clear-signing-erc7730-registry` (okxlabs), **CC0 1.0**,
  ERC-7730 clear-signing metadata (JSON) for human-readable EVM
  contract-call / message display. Source:
  `/home/boxd/workspace/wallet-repos/clear-signing-erc7730-registry/`.
  Zero bundle cost as JSON data.
- **Purpose:** show the user, in plain language, what an EVM
  contract call or signed message actually does — before they approve it.
  This is a signing-safety feature, not a new signing method.
- **Upstream preference:** the okxlabs copy is a fork — **prefer the
  upstream ERC-7730 registry as canonical if ever adopted**. Record
  which registry (upstream or fork) and which commit/pin is vendored.
- **Related dev tool (not shipped):** `sonar` (okxlabs, MIT, Rust CLI)
  for local Solana transaction simulation (LiteSVM), transaction parsing,
  and PDA derivation — a dev tool for verifying Solana behaviour
  off-device, never shipped in the app. **Lane H note (2026-11-26):**
  licence re-verified first-hand (LICENSE: "The MIT License (MIT)",
  Copyright (c) 2022-2026 OKX labs). Concrete use for Bawa: simulate
  a Solana send construction locally before it is ever signed —
  `sonar simulate <BASE58_OR_BASE64_TX> --rpc-url
  https://api.mainnet-beta.solana.com`, or synthesise from instruction
  specs (`sonar simulate --payer <PUBKEY> --ix 'program=... data=...'`).
  Simulation is a pre-check, never confirmation (§5), and `sonar send`
  must never be used on mainnet — broadcast stays disabled (§0.1).
  **Not build-verified:** there is no cargo/rustc on loud-stone, so
  the release build (`cargo build --release`) has not been run here;
  the first build is a follow-up on a machine with a Rust toolchain.
- **Measured cost in Bawa's build:** +4,404 B. EIP-712 is not wired
  (no signing surface); Safe `execTransaction` and 1inch `unoswap`
  were cut for bundle.
- Re-checked against Lane F's committed code by the coordinator's
  re-check pass (2026-11-26): the review-screen rows, the snapshot,
  the raw-data fallback and the CAIP helpers are all in the merged
  tree.

## §15. UI contract

- The design system is `docs/DESIGN-SYSTEM.md` (moved into the repo
  2026-11-26 from the redesign programme; this answers the old open
  question that the core cited "DESIGN-SYSTEM §2.5" with no such file
  in-tree). It records, not assumes: the four `--bawa-*` tokens (§2.1)
  and their contrast ratios (§2.1, 13.92/10.28/5.03:1 with two FAIL
  pairs), the 44 px touch rule and the known `Button` gap (§2.5),
  breakpoints (980 px shell, 480 px task cap; viewports 390/820/1440/
  1919) (§4), type scale and floors (§2.3), spacing/stroke/radius/
  shadow/motion tokens (§2.4), and per-section placement guidance (§6).
  "Popular chains" was removed from the homepage by owner order and
  must not be re-added (§6, §7). **Style B (owner pick 2026-11-27,
  §0.3) supersedes the drawing-illustration direction the design
  system was written under; the P1 style lane owns
  `docs/DESIGN-SYSTEM.md` and is migrating it — this spec states the
  direction, not the token list.**
- Follow Doc 14 §5.1's **14-screen contract**. **Review is a Send state;
  Lock is an app state**, not extra screens. Required states: **loading,
  empty, stale, locked, gate-failed, error**. The app now also ships Swap, Track, Address book and Lock as screens beyond the 14 (routed in `app.tsx`); Doc 14 §5.1 needs updating to record them (flagged 2026-11-28, docs-currency Lane B).
- Default visual direction: **style B** (owner pick, 2026-11-27 —
  polished financial style everywhere, illustration only for brand
  moments, plus a tiny bounded paper/comic fraction; §0.3). The
  "Bawa Balanced" default is superseded. Web foundation: **token-ui**
  (`consenlabs/token-ui`), **MIT**, vendored in `apps/web/src/ui/`.
  Android foundation: **Tether WDK Starter Kotlin**, **UI layer only**,
  **Apache-2.0**, in `apps/android`. The Android starter is a watch-only
  UI starter, not a wallet: 4 derivation-path templates + a
  confirmation-policy evaluator for BTC/ETH only, no chain registry,
  no RPCs/tokens/prices/icons, no network permission, no data layer,
  no on-device derivation (`ENGINE_BINDING_AVAILABLE = false`), AGP
  8.2.2 + compileSdk 35. The JSON export in §2.6 exists (Step 1,
  2026-11-27) and the toolchain is installed and proven
  (`./gradlew assembleDebug` succeeds) — Android Step 3 is DONE
  (`e20cee6`, 2026-11-28) and Step 4 (AAR build) is RUNNING,
  owner-authorized 2026-11-28; steps 5–6 still await it — not the
  toolchain or the export — and the owner still has to resolve
  the mainnet-only vs testnet-only tension (§2.6).
- Style B governs the visual direction (§0.3); the four-colour cap no
  longer governs new work. The `--qr-*` exception is confined to the
  QR card and its PNG exporter, and the QR card is untouched by the
  style work.
- Dead controls in a state where they cannot act are defects: where a
  row IS shown with no wallet and no amount, show zero — never a Retry
  button with nothing to retry. On /assets, with no wallet the list is
  hidden entirely (P0, token-gaps `33f1ff1`): the empty state says why
  and offers Create / Import, with live prices one tap away on the
  asset page — 43 rows of $0.00 are gone, not bannered over. Keep the
  Assets screen's search filter bar in a restyle; restructure around
  it (it is the wallet's filter rail).
- Owner-approved foundations are not proof of integration — the adoption
  evidence is the starter builds, tests, and preview checks.
- A first preview must use the REAL site's assets with only the
  prescribed changes applied, never wireframe-grade placeholders; verify
  design passes visually before reporting.

### §15.1 Wallet management — /wallets (fix programme, 2026-11-28)

**Status: IMPLEMENTED.** `/wallets`
(`screens/wallet-management.tsx`) lists the HD accounts ("Your
accounts — Account 1 [Current]"), the per-chain addresses, the
"Backed up" badge (§13), and the watch-only wallets with per-chain
Forget. **Create more accounts:** a count selector (1 / 10 / 50) +
"Create accounts"; **switch:** "Switch to Account N" moves Current
and the header together. **Rename (Lane E item 4a, `65edc90`):**
inline edit on the account row (`wallet-management.tsx:312`);
`renameAccountName` (`wallet/vault.ts:1066`,
`MAX_ACCOUNT_NAME_LENGTH = 40`) — a blank save clears the custom
name back to the default, an over-long name is refused.
**Per-account delete (same lane):** two-tap, like Delete vault and
the address book's Remove — first tap arms, second deletes.
Deleting the Current account moves Current to the first remaining
account; the only account has no Delete button at all (removing it
is what Delete vault on /security is for), and the store refuses a
last-account delete.
**Watch-only cards (watch-only display programme, 2026-11-28,
`4728ff1`; decisions §51):** the per-chain "Forget stored key"
buttons are gone — one watched address used to render 59 rows each
with its own Forget. The per-chain rows sit behind a "N chains —
show balances" disclosure
(`wallet-management.tsx:1080-1082`), each row carrying its fiat
value (`WatchOnlyBalance`, `:63`, `:1107`), and forgetting is one
two-tap "Forget this wallet" control per card (`:1132`). The "You
don't have a wallet yet" line no longer shows when watched wallets
exist. This supersedes the "per-chain Forget" wording above.

### §15.2 Mobile overflow — the Add Token dialog fix, and the pattern to copy (Lane A, 2026-11-28)

**Status: IMPLEMENTED.** The Add Token dialog overflowed 390 px
viewports by 284 px: its candidate rows' nowrap line (long token
name + Verified badge) drove the form min-content to 617 px, and the
dialog's single implicit auto grid column let the grid item stretch
past the 358 px box (`aea4b58`). Because the dialog is fixed,
`documentElement.scrollWidth` stayed 390 — the earlier "no
horizontal overflow" claim was wrong; measure the dialog's own
content, never the document. The fix, in
`apps/web/src/ui/components/dialog.tsx` (`DialogContent`, used only
by Add Token) and `screens/add-token.tsx` /
`screens/chain-search-select.tsx`:
- `DialogContent` gains `grid-cols-[minmax(0,1fr)]` plus
  `max-h-[calc(100dvh-2rem)] overflow-y-auto` — the dialog can
  neither widen past its box nor run off the top (it was 932 px
  tall, top -44, with body scroll locked).
- The Verified badge / Unverified span move out of the truncating
  name span into the row flex row as `shrink-0`, so only the name
  ellipsises and the badge stays visible.
- The open chain dropdown scrolls into view (`block: 'nearest'`)
  so it is not clipped below the fold by the dialog's new max-h —
  guarded with a `typeof scrollIntoView === 'function'` check,
  because jsdom lacks it.
**The general rule for every dialog and row in this app:** a grid
item that must not widen gets `minmax(0,1fr)`; a truncating flex
child gets `min-w-0` and its badge gets `shrink-0`; a scrollable
overlay gets a `max-h` in `dvh` plus `overflow-y-auto`. Verified in
Playwright Chromium at 390, 412 and 1280 px: 23 screens, 0 overflow
/ 0 offenders each, including vault + deep states and the Receive
Cake details step.

## §16. Verify and report honestly

- Use exactly the evidence labels in `AGENTS.md` §5. For each scoped
  claim, populate an evidence table: Claim / scope | Evidence label |
  Revision / network | Actual command or artifact and observed result |
  PASS / FAIL / NOT-RUN | Mock / limitation / next gate.
- **PASS** only for a performed check with supporting evidence. **FAIL**
  for a performed check that failed. **NOT-RUN** for anything not
  performed, including blocked checks. **NOT-RUN is never a pass.** Test
  counts and file presence are not proof that tests passed.
- Gates in the repo: `npm run typecheck`, `npm run build`,
  `npm run test` (apps/web); `scripts/quality-gates.mjs`; the bundle-size
  gate (CI); the link check over changed docs (see §17 method).
- Report changed files, demonstrated behaviour, mocked behaviour, and
  unresolved work separately. Redact secrets; missing evidence is OPEN.
- **Fix-review rule:** present the fix and its rationale first; apply
  only on the owner's go-ahead. Nothing is pushed on the strength of a
  guide file alone.

## §17. Section-by-section trace — how this spec was checked

Method (2026-11-25, Lane G, hands-on, 0 Sol calls): for each section, the
claim was traced to the file:line in the `usable-lane-g-guide` worktree
(base `7fea3e4`) or to the wallet-org survey, and the older guide text was
compared. Where the older guide was wrong, it was fixed in place in the
same lane (see the commit). Where a Part A lane had not committed, the
section is marked PENDING with the reason. **Re-check pass
(2026-11-26, coordinator, hands-on, 0 Sol calls):** every PENDING row
was re-traced against the merged rebased tree (`usable-install` on
token-gaps `7a170f4`) and updated to Implemented where the code
landed; the budget, chain count, QR template count and test counts
were re-measured from that tree (see the rows below).

| Spec section | Traced to (file:line or survey) | Older guide state | Verdict |
| --- | --- | --- | --- |
| §0.1 broadcast disabled | `apps/web/src/wallet/send.ts:65-66`, `:1359` (`isBroadcastAllowedFor`), `:1391` (`broadcastSigned` returns `{ status: 'disabled' }`) | Correct in `AGENTS.md` §4/§8, `WALLET_BUILDER.md`; this spec wrongly said "throws unconditionally" | Fixed in place (docs-currency Lane 2, 2026-11-27); swap execution approved by the owner 2026-11-27 but not implemented, broadcast stays disabled in code |
| §0.2 bundle 6,000,000 | `CONSTRAINTS.md:40` (re-baselined by owner order 2026-11-26, commit `f5a5f19`); CI `ci.yml:194` | Was 4,185,000 at Lane G writing; re-baselined with the redesign to 4,215,000, then to 4,650,000 by owner order at `7a170f4`, then to 6,000,000 by owner order at `f5a5f19` | Fixed in place (guide-update pass, 2026-11-26; budget updated in the Phase 7 merge) |
| §0.3 style B + `--qr-*` | Owner pick 2026-11-27 (style B, polished financial style; tiny paper/comic fraction kept); `docs/DECISIONS.md` §24 (`:1987`), palette exception `:2015` | Was the 4-colour cap (2026-11-20 drawing-illustration order) | Fixed in place (docs-currency Lane 2, 2026-11-27; the cap is superseded as the governing rule, the `--qr-*` exception stands, the current tree still carries the `--bawa-*` tokens while P1 migrates screens) |
| §0.4 no fake data | `apps/web/src/wallet/price-fallbacks.ts` header; `chains.ts` `availableFor` | Correct | Verified |
| §1 profiles (8) | `registry/profiles.json`; `WALLET_BUILDER.md` | `multichain-extended-wallet` 13-chain registry scope vs 87-chain app — noted as OPEN, not silently widened | Fixed (note updated 84 → 87) |
| §2 87 chains | `apps/web/src/wallet/chains.ts` (`SUPPORTED_CHAINS`, 87 entries); `chains-expanded.ts:156`, `:1914` (`EXPANDED_CHAIN_COUNT = 65` — 45 EVM + 17 non-EVM (9 Cosmos + 8 other) + 3 OKX-reference in the same file); §2.5 (Cardano `:1832`, Kaspa `:1859`, Starknet `:1886`) | `WALLET_BUILDER.md` said "Chains: 13" and its generated table covered only 22; `docs/02-chains/README.md` §2 said SOL reference-only | Fixed in place (84 → 87; 62 → 65, guide-update pass) |
| §2.1 derivation paths | `chains.ts:403-455` (EVM_PATH, SOL/TON); `WALLET_BUILDER.md` policy table | Correct; SOL indexed form added from code | Verified |
| §2.2 icons / assets pin | `chains-expanded.ts` header; `TRUST_WALLET_ASSETS_PIN` | Correct | Verified |
| §2.3 RPCs verified live | `chains-expanded.ts` header (`rpcEvidence`) | Correct | Verified |
| §2.4 XRP/Stellar/NEAR | Coordinator first-hand registry check, 2026-11-25 (survey) | Not previously recorded in the guide | Added |
| §2.5 Cardano/Starknet/Kaspa | `chains.ts` `SUPPORTED_CHAINS` (ends with the three); `chains-expanded.ts:1832` (cardano), `:1859` (kaspa), `:1886` (starknet); `core.ts:468` (`getPublicKeyEd25519Cardano`); `kaspa-address.ts`, `starknet-derive.ts` (lazy) | `docs/02-chains` §2 called Cardano reference-only with the CIP-1852 path (kept); the three were absent from the app | Implemented (Lane B, derive-only) |
| §2.6 Android JSON export + toolchain | `registry/chains.json` (87 chains, 169 RPCs, 4 testnets, `sourceCommit 7efba14`), `registry/tokens.json` (21 tokens); `apps/web/scripts/generate-android-registry.mjs`; `./gradlew assembleDebug` BUILD SUCCESSFUL (clean, 32 s, 2026-11-27) | Was "Proposal (not yet implemented)" with no SDK/JDK on loud-stone | Fixed in place (docs-currency Lane 2, 2026-11-27; export Step 1 commit `58d85c5`; steps 3–6 were BLOCKED, Step 3 report removed by safety classifiers; Step 3 DONE (`e20cee6`, 2026-11-28), Step 4 running, owner-authorized 2026-11-28) |
| §3 engine pins | `WALLET_BUILDER.md` "Verified 4.9.3 workflow"; `apps/web/package.json` pin | Test counts stale (40 files / 460 tests, 2026-11-20); engine smoke 217 stale; `dinero.js` listed as adopted but removed by token-verify Lane C (0 hits in `package-lock.json`) | Fixed in place (110 files — the 2,945 + 5 skipped figure is Lane C's loud-stone run, not reproduced in this sandbox, 2026-11-26; smoke 440; dinero.js dropped) |
| §4 vault + auto-lock | `apps/web/src/wallet/vault.ts:85`, `:83`; `auto-lock.ts:13-15` | `WALLET_BUILDER.md` + `AGENTS.md` said "no lock exists" (5e7eb1d) | Fixed in place |
| §5 offline signing | `apps/web/src/wallet/send.ts:2527-2530` (Solana); capability table in `WALLET_BUILDER.md` | Correct; SOL `@solana/web3.js` route added from code | Verified |
| §6 token verification | `apps/web/src/wallet/token-verification.ts:25-45`, `:101` | Correct in code; `docs/TOKEN-VERIFY-PROGRAMME.md` records the programme | Verified |
| §6.6 Bitget Agent API | `token-verification.ts` (Lane A browser leg, read first-hand); live answers verified by Lane H (USDC/PEPE VERIFIED, fake UNVERIFIED, 2026-11-26) | Not in the guide before | Implemented (Lane A browser leg + Lane H agent-side) |
| §6.6 Bitget Agent API (Lane H) | `token-verification.ts` (Lane A browser leg, read first-hand); `scripts/verify-token-bitget.mjs` + test (9 tests); live USDC/PEPE VERIFIED, fake UNVERIFIED, 2026-11-26 | Browser leg wired but fail-closed at the CORS preflight; no agent-side form existed | Implemented (agent-side) + browser leg recorded |
| §11 WalletConnect (Lane H) | `repo1.maven.org/.../com/walletconnect/web3wallet/maven-metadata.xml` (1.35.2, live); `Web3Wallet.kt` `approveSession`; Apache-2.0 LICENSE | Android route named but unversioned | Added (Android record only; no Gradle change — no SDK on loud-stone at the time, toolchain installed 2026-11-27, §2.6; app has no signing path) |
| §7 prices + fallbacks | `apps/web/src/wallet/price-fallbacks.ts` header; `dex-prices.ts` trap note | Correct | Verified |
| §7.1 okx-cex-market skill | `custom-skills/okx-cex-market/okx-cex-market/SKILL.md` (MIT v1.5.2; `okx` CLI binary required) | Not in the guide before | Added (agent skill only) |
| §8 QR cards | `apps/web/src/screens/qr-card.tsx`; `payment-links.ts:728-767` (`QR_CARD_TEMPLATES`, 7 entries; `QR_CARD_TEMPLATE_QR`); `docs/DECISIONS.md` §24 + §25 (redesign E/F/G) | Said four templates (A–D); the redesign added E/F/G on token-gaps | Fixed in place (four → seven) |
| §9 watch-only mainnet-only | Owner decision 2026-11-23 (standing record); `apps/web/src/wallet/watch-only-families.ts`; `state/wallet-context.tsx` `ALL_CHAIN_IDS` hydration fix | `docs/05-watch-only/README.md` predates the 87-chain hydration fix | Verified; §9 states the fix |
| §10 devnet / E1 | `apps/web/src/wallet/devnet.ts:30`; `docs/DECISIONS.md:399-410`; `CONSTRAINTS.md` E1 | Correct; E1 expiry 2027-02-20 stated | Verified |
| §11 WalletConnect | Commit `7fb1c4a` (providers programme): screen + 3 modules + tests deleted; route/nav/CSP/deps removed; `security-settings.tsx` restoration note; `docs/DECISIONS.md` §26 (Lane C record, not updated by that commit — see report) | Was IMPLEMENTED (Lane C) | Removed in place (providers programme, 2026-11-26; Android Kotlin route kept as an unimplemented record) |
| §12 Coinbase Onramp | `apps/web/src/wallet/onramp.ts` (URL builder, no SDK); `receive.tsx` `?buy=1` panel; `package.json` has NO `cbpay-js` | Not in the guide before | Implemented (Lane D; live purchase NOT verified — needs onboarding/keys) |
| §12.1 Buy provider picker | `apps/web/src/wallet/buy-providers.ts` (`buyProviders()`, rank order, key copy, readiness); `receive.tsx:1097` renders the table | Not in the guide before | Implemented (providers programme, 2026-11-26; TON confirmed live for Ramp/MoonPay/Banxa, Mercuryo TON unconfirmed; no live purchase verified). "Works today" wording qualified by docs-currency Lane 2, 2026-11-27: no provider key is configured, every provider shows "not set up yet" |
| §12A Swaps providers | `apps/web/src/wallet/swap-providers.ts` (`providersForPair`, `selectBestRoute`); `relay-quotes.ts` (58 chains live, XRP covered, LTC/DOGE not); `gaszip-refuel.ts` (quote deposit address, Solana excluded); `stonfi-quotes.ts` (SDK pin 0.8.13, installed; live RFQ client + TON order signing wired, signed BoC only); `swap-quotes.ts` (LI.FI raw REST, no SDK) | Not in the guide before | Implemented, quotes + TON order signing (providers programme, 2026-11-26; STON.fi Lanes B/C, 2026-11-27; Relay proxy not configured; execution approved by the owner 2026-11-27 but NOT implemented — broadcast stays disabled in code until it lands) |
| §13 Shamir | `apps/web/src/wallet/backup-shares.ts`; `apps/web/src/screens/backup.tsx` (Shares tab under `/mnemonic-backup?tab=shares`; `/backup-shares` redirects there, `app.tsx:496`); `package.json` `shamir-secret-sharing` 0.0.4; `vault.ts:431-433` (extractable-key note) | Not in the guide before | Implemented (Lane E; restore-from-shares UI not built — check-only; screen/route citation corrected by docs-currency Lane B, 2026-11-28 — no separate `backup-shares.tsx` screen or lazy `/backup-shares` route exists at this tip, §13 body already had it right) |
| §14 ERC-7730 | `apps/web/src/wallet/clear-signing.ts`; `clear-signing-snapshot.json` (1,523 B); `apps/web/src/wallet/caip.ts`; `send-review.tsx` | Not in the guide before | Implemented (Lane F) |
| §14 sonar (Lane H) | `sonar/LICENSE` (MIT, OKX labs 2022-2026); README simulate commands | Mentioned only as "dev tool" | Added (concrete use; build NOT verified — no cargo on loud-stone) |
| §18 Lane H mining | Wallet-repos survey + agent-repos dirs (sandbox, read-only) + FEC skills (MIT) | Not in the guide before | Added |
| §15 UI contract | `WALLET_BUILDER.md` "UI foundations and contract"; Doc 14 §5.1; owner style-B pick 2026-11-27 | Said "Bawa Balanced" + four-colour cap; /assets showed zero rows with no wallet | Fixed in place (docs-currency Lane 2, 2026-11-27: style B, /assets no-wallet list hidden per P0 `33f1ff1`) |
| §16 verify/report | `AGENTS.md` §5/§6 | Correct | Verified |
| §2 history 18/4 + Gnosis | `chains.ts:299-310` (`HISTORY_EVIDENCE_2026_11_28_GNOSIS`), `:812-815`; `adapters/evm.ts:172-181` (gnosisscan branch); `chains.test.ts:416-434` (`availableFor('history')`, 18 entries) | Said 17 verified / 5 blocked incl. Gnosis | Fixed in place (Lane D audit, 2026-11-28; Gnosis wired `d06a224`) |
| §2.7 history indexers | `chains.ts:231-264` (blocked-set probes), `adapters/index.ts:26-48` (`EVM_HISTORY_SOURCES`) | Not in the guide before | Added (Lane D audit, 2026-11-28) |
| §4 change password | `vault.ts:771` (`changePassword`), `:592` (`verifyVaultPassword`); `security-settings.tsx:67-96`, `:166` | No change-password path existed before `f77b803` | Implemented (fix programme, 2026-11-28) |
| §6.8 remove token | `tokens.ts:762` (`removeCustomTokenFromList`); `wallet-context.tsx:1411`; `asset-detail.tsx:950` | No remove control existed before `9fc01e9` | Implemented (fix programme, 2026-11-28) |
| §7.2 chart retry + Coinbase | `prices.ts:963` (`fetchPriceHistory`); `price-fallbacks.ts:749`, `:650` (44 products); `price-chart.tsx:15-16` | Chart was a single CoinGecko call, no retry; ~3/7 loads | Implemented (fix programme, 2026-11-28) |
| §8 QR sizes + flat style + footer + split | `payment-links.ts:756` (QR sizes), `:770` (`QR_CARD_FOOTER`), `:2439` (canvas twin); `qr-card.tsx:113` (`splitAddressLines`), `:704` (stacked band) | Sizes predated Lane 1 growth; footer location unstated; "untouched by style work" | Fixed in place (Lane D audit, 2026-11-28; Lane B `fec71be`) |
| §9 watch-only surfacing + TRON + Activity | `dashboard.tsx:410-421`; `asset-list.tsx:177`; `app.tsx:136`; `adapters/trx.ts:55`; `transaction-history.tsx:398`, `:485`; `track-transaction.tsx:44`, `:262` | Watch-only invisible outside /wallets; TRON fallback unrecorded; Activity had no switcher | Implemented (fix programme, 2026-11-28) |
| §13 shares cancelled by password change | `vault.ts:771`; `backup.tsx:504` | Unstated | Added (Lane D audit, 2026-11-28) |
| §15.1 /wallets manage | `wallet-management.tsx:312`; `vault.ts:1066`, `:969` (MAX 40) | /wallets screen undescribed; rename/delete absent before `65edc90` | Implemented (fix programme, 2026-11-28) |
| §15.2 mobile overflow pattern | `dialog.tsx:155-166`; `add-token.tsx:715-717`; `chain-search-select.tsx:292-294` | Overflow pattern undescribed; earlier "no overflow" claim wrong for the fixed dialog | Fixed in place (Lane A `aea4b58`, 2026-11-28) |
| §19 Lane D audit | This lane, hands-on, 0 Sol calls; gates at `7f24ef1` | Not in the guide before | Added |
| §9 watch-only display programme | `dashboard.tsx:916` (split), `:1000` (Balances updated), `:1007` (Missing note); `asset-rows.tsx:1302-1342` (watched tokens), `:1505-1531` (allocation Top-5); `use-live-balances.ts:18` (45 s poll); `transaction-history.tsx:322-355` (Activity default); `wallet-management.tsx:1080`, `:1132` (/wallets disclosure + Forget); `track-transaction.tsx:182-279` (/track prefill); `sidebar-nav.tsx:50` (Track link) | Watch-only invisible outside /wallets; hero vault-only; no allocation; no balance polling; /track unlinked | Implemented (watch-only display programme, 2026-11-28, `4728ff1`; DECISIONS.md §51) |
| §20 Owner-configured API keys + Relay proxy | `apps/web/src/wallet/buy-providers.ts` (six `VITE_*` env vars, `readEnv`); `relay-quotes.ts` (`RELAY_PROXY_URL_ENV`, `relayProxyBaseUrl()`, `fetchRelayQuote`, `parseQuote`); `screens/swap.tsx:579`; `app/security-headers.ts:55` (CSP, proxy origin at deploy time); no `apiKey` anywhere in `apps/web/src/wallet/adapters/`; `stonfi-quotes.ts:307` (`flexibleIntegratorFee` only) | Not in the guide before | Added (docs-audit Lane A, 2026-11-28, owner orders 2026-11-28 ~20:40 IST; Relay proxy to AI-usable depth per the 2026-11-28 ~20:46 IST refinement) |

**Not verified first-hand (re-check pass, 2026-11-26; providers
programme additions, 2026-11-26):** Relay quotes with a live proxy (no
proxy is configured yet); a live purchase through any Buy provider (needs onboarding +
keys); the Bitget Agent
API leg from a browser (fail-closed at the CORS preflight — the
agent-side script is the live path); `okx-cex-market` end-to-end
behaviour (needs the `okx` CLI binary); the Cardano passphrase
caveat's user-facing wording (flagged, no owner decision yet);
phone-camera QR decode (needs the owner's phone); Send review/sign
in the browser (needs a funded wallet). Each is marked where it is
used above. The duplicated copy of this paragraph that Lane G left
in the spec has been removed.

## §18. Lane H mining record — "install all usable", 2026-11-26

**Method (Lane H, hands-on, 0 Sol calls).** Base `usable-install`
`637c139` (Part A Lanes A, C, D, E, F merged). Three sources, in
order: (1) wallet-repos (`/home/boxd/workspace/wallet-repos/`,
survey `~/workspace/wallet-repos/SURVEY.md`); (2) agent-repos
(`~/workspace/agent-repos/` in the sandbox — **not on loud-stone**,
and its SURVEY.md never appeared while this lane worked, so the
directories were mined directly, read-only; the installing
coordinator was not disturbed, nothing was installed twice);
(3) skills library (`/home/boxd/workspace/custom-skills/`, 1,906
entries, plus the Front-End-Checklist skill corpus inside
agent-repos, which loud-stone's custom-skills does NOT carry).
Licence checked first for every find; no verbatim copying without a
licence check. Bundle budget in Lane H's base was 4,185,000 total JS
(`CONSTRAINTS.md:40`, CI `ci.yml:193`); the 4,215,000 re-baseline
lived on token-gaps only and was NOT in that base — Lane H measured
against 4,185,000 and re-baselined nothing. After the rebase the
merged tree enforced 4,215,000 (§0.2) and measured 4,648,952 total
JS (over by 433,952 — reported, not re-baselined). **Current state
(2026-11-26, guide-update pass): the owner has since ordered a
second re-baseline to 4,650,000 (`7a170f4`); the merged tree measures
4,648,952 and passes by 1,048 bytes (§0.2, `docs/DECISIONS.md` §27).
Lane H's 4,185,000 / 4,215,000 figures above are its base's history,
not the current budget.**

### §18.1 Finds applied

| Find | Licence | Useful for | Applied in code | Applied in guide |
| --- | --- | --- | --- | --- |
| Bitget Agent API, agent-side deep check (token-info + security audit + dev/rug + holder concentration) | MIT (`bitget-wallet-skill`) | Wallet: the browser leg cannot fire (CORS preflight); the same calls work from Node, so a dev/CI token check is the useful form | `scripts/verify-token-bitget.mjs` + `scripts/verify-token-bitget.test.mjs` (9 tests); live: USDC VERIFIED, PEPE VERIFIED, fake UNVERIFIED | §6.6 |
| WalletConnect Kotlin SDK, Android route | Apache-2.0 | Wallet (Android): dApp connectivity where the web bundle budget does not apply | Not added to `apps/android/app/build.gradle.kts` — the app is watch-only/testnet-only with no signing path, and no Android SDK/JDK existed on loud-stone at the time to build-verify it (toolchain installed 2026-11-27, §2.6 — a future lane can build-verify it) | §11 (coordinates `com.walletconnect:web3wallet` 1.35.2, Maven-verified; `approveSession` / WalletKit note; projectId still an owner step) |
| OKX sonar, Solana tx simulation | MIT | Wallet (dev tooling): simulate a Solana send construction locally before signing; never shipped | None — no cargo on loud-stone, build not run | §14 (commands + `sonar send` never on mainnet) |
| Front-End-Checklist `touch-targets` | MIT | Wallet: touch-target floor for the web app | Audit only, no code change: class audit finds no interactive element below 24 px (default 40, sm 32, xs 28 — xs unused, icon-sm 32); WCAG 2.2 AA 24 px floor passes. The 44 px AAA gap is the known, owner-saved-layout state — restyling it is an owner decision, not a lane fix | This section |
| Front-End-Checklist `performance-budget` | MIT | Guide + wallet: budgets enforced in CI | Verified, no code change: the bundle-size gate IS the budget (CI `ci.yml:194`, total + largest chunk). Lighthouse CI and production RUM are not wired — flagged, not added | This section |
| Front-End-Checklist `code-splitting` | MIT | Wallet: heavy Part A modules behind dynamic import | Verified in the built `dist/`: WalletConnect and Shamir ship as separate lazy chunks, not in the main chunk (see the lane's bundle measurement) | This section |
| Front-End-Checklist `leaked-secrets` | MIT | Wallet: secret hygiene | Ran `node scripts/secret-scan.mjs` on the worktree: exit 0, no findings. The new script carries no secrets or keys | This section |
| Front-End-Checklist `token-storage-security` | MIT | Wallet: vault-key storage | Verified in code, no change: the skill's httpOnly-cookie prescription does not apply — Bawa has no server and no session tokens. The mitigation is the auto-lock key-storage invariant (§4): the derived key is stored under `bawa-vault-key` only while auto-lock is OFF, never while it is ON | This section |
| `planning-with-files` (three-file method) + `ponytail` (lazy senior dev) | MIT, MIT | Guide: agent-workflow method for the AI Wallet Builder | None in the app | Recorded here as the standing method this lane followed: user-owned plan/design files agents never edit, findings + progress in files, smallest complete change, fix in place, one small test for non-trivial logic. Bawa already works this way (lane files, PROGRAMME.md); these two sources name the discipline, they do not change it |

### §18.2 Finds read and rejected (with reason)

| Find | Licence | Reason rejected |
| --- | --- | --- |
| `okx-dex-market` (onchainos-skills) as a CoinGecko alternative | MIT | Source proves anonymous auth (`cli/src/client.rs:213`, "anonymous" ×41) — keyless read-only DEX data is the strongest candidate; live end-to-end still unverified, free-quota size unstated, UK geo-restriction, WebSocket needs login, native SOL needs the wSOL address. Live keyless run recorded 2026-11-28 (M9, `docs/M9-NOT-BUILT.md`): 9 probes, 0 successes — NOT-BUILT (verdict corrected 2026-11-26; §7.1). |
| Multi-AI-Workflow (multi-model orchestration: Claude + Codex + Gemini) | MIT | Conflicts with the standing Astra-only / Sol-only model rule for Bawa. Not adopted. |
| `yn`, Firecrawl | AGPL-3.0, AGPL-3.0 | Copyleft: no code copied into Bawa. Firecrawl noted only as a possible self-hosted research tool (needs API key / self-host); not adopted. |
| Wanwu (multi-agent platform), QwenPaw (Qwen desktop agent app) | Apache-2.0, Apache-2.0 | Heavy agent platforms / a different product, not wallet inputs. No Bawa application. |
| DeepSeek Harness | MIT | Developer preview with stated compatibility-breaking changes. Not pinned for the guide. |
| ECC (agent harness conventions: coding-style, git-workflow, TDD, patterns) | MIT | Reference only. Bawa already has its own conventions (`AGENTS.md`); nothing imported. |
| `agent-skills` (90 single-word agents) | MIT | Name-scanned only; no agent read in depth and none applied this lane. A deeper pass may find a review/security agent worth adopting — OPEN, not claimed. |
| Bitget `bitget-wallet-developer-skill` / `bitget-wallet-partner-skill` | MIT (subdirs only for developer-skill; root has no LICENSE) | Reference only. Developer-skill teaches DApps to connect *to* Bitget Wallet (direction inverted); partner-skill needs a partner key + IP whitelist. Nothing applied. |
| OKX `go-wallet-sdk` | MIT | Go signing SDK; cannot run in the TS web app. Reference only (Lane B owns the chain-reference work). |
| Coinbase / Privy / WalletConnect JS beyond Part A | As surveyed | Already covered by Part A (§11–§13) or excluded in the survey (wrong side, custodial, key-gated). Nothing further. |

### §18.3 Skills actually read (Lane H)

From the Front-End-Checklist corpus (MIT, in agent-repos):
`touch-targets`, `performance-budget`, `code-splitting`,
`leaked-secrets`, `token-storage-security` (SKILL.md files read in
full; `color-contrast` NOT re-read — the redesign programme already
ran contrast first-hand, and re-claiming it would be double-counting).
From agent-repos: `planning-with-files` AGENTS.md (three-file
method), `ponytail` AGENTS.md (lazy senior dev). From
loud-stone custom-skills: the library was name-scanned (1,906
entries); no additional SKILL.md was read in full beyond the two
above, which live in agent-repos, not in custom-skills. The
`cdp-visual-verification` skill (already the standing CDP method)
was NOT re-read: Lane H changed nothing user-visible, so no CDP
run was needed.

### §18.4 Known discrepancies for the coordinator's re-check pass — RESOLVED

- **QR templates:** §8 said four templates (A–D). The redesign
  added templates E/F/G on token-gaps. **Resolved by the
  coordinator's re-check pass (2026-11-26):** §8 now says seven
  templates, with the E/F/G sizes and logo caps from
  `QR_CARD_TEMPLATE_QR` (`payment-links.ts:748`).
- **Bundle budget:** §0.2 said 4,185,000, which matched Lane H's
  base. **Resolved:** §0.2 now says 4,650,000 — the owner-ordered
  re-baselines, first to 4,215,000 (commit `4a12409`), then to
  4,650,000 (commit `7a170f4`, 2026-11-25; `docs/DECISIONS.md` §27) —
  and the merged tree measures 4,648,952, passing by 1,048 bytes,
  not re-baselined further.
- **CI comment:** `ci.yml` said "dist/assets <= 4,040,000 bytes"
  while the enforced gate is 4,185,000. Fixed in this lane
  (comment only, to match the enforced number). The rebase carried
  the fix; the gate now enforces 4,650,000 (`ci.yml:193`) — the
  comment is corrected to 4,650,000 in the guide-update pass
  (2026-11-26).
- **Agent-repos SURVEY.md never appeared** during this lane, and
  agent-repos is not installed on loud-stone. The mining above is
  from the sandbox copy, read-only. Still true at merge time — the
  agent-repos install had no SURVEY.md when the programme closed;
  the merge was not blocked on it (owner order).
- **Not verified first-hand by Lane H:** `sonar` release build (no
  cargo on loud-stone); the WalletConnect Kotlin dependency inside
  a Gradle build (no Android SDK/JDK on loud-stone at the time;
  toolchain installed 2026-11-27, §2.6);
  `okx-cex-market` end-to-end (needs the `okx` CLI binary);
  `dev_rug_percent` scale at a non-zero value (normalised like its
  sibling fields — stated in the script, not hidden). All still
  open; carried to §17's not-verified list.

### §18.5 Second survey (REVERIFY, 2026-11-26) — 47 skills the first survey missed + `mcp-interviewer`

The guided-repo re-verification survey (`~/workspace/
bawa-guided-repo-survey/REVERIFY.md` §2.1) read 47 further SKILL.md
files in full that the first survey never read. None of the 47 is
named anywhere in this spec (checked by grep); the rows below record
them in three groups so a later lane can apply them without
re-surveying. **Licence caveat (applies to all three groups): most
state no licence — read and apply them; do not copy their text
verbatim into Bawa without a licence check.** The REVERIFY lane read
the SKILL.md files in full; the guide-update lane did not re-read
them — the "new to the guide" verdict rests on REVERIFY §2.1 plus
spec greps. Two per-rule siblings were read in full but are NOT
counted among the 47: `viewport-zoom` (never `user-scalable=no`;
16 px inputs) and `accessibility-testing` (axe-core in CI).

| Group | Skills | Licence | What it adds |
| --- | --- | --- | --- |
| Method — guide truth + verification (15) | `attest`, `constraint-driven-development`, `spec-driven-development`, `chisel`, `zero-hallucination-coder`, `docs-grounding-verifier`, `docs-corpus-audit`, `docs-sync`, `harness-audit`, `parallel-execution-optimizer`, `order-traceability-checklist`, `repo-hygiene-scan`, `test-collaboration`, `production-audit`, `sentinel` | `harness-audit` MIT; `parallel-execution-optimizer` MIT; rest none stated | The working methods for the guide's own standing requirements: `attest` (spec-compliance verdicts CERTIFIED/CONDITIONAL/REJECTED, evidence ladder E0–E6; a value read off the implementation is PARTIAL, never PASS); `chisel` (Numeric Licensing Cascade — never invent a number); the docs-truth family (`docs-grounding-verifier` per-claim, `docs-sync` per-PR, `docs-corpus-audit` per-corpus — the method behind §17's "checked section-by-section" claim; the APM substrate caveat applies — the method transfers, the tooling needs Bawa equivalents); `constraint-driven-development` (CONSTRAINTS.md as a contract that does not get weakened to pass); `spec-driven-development` (spec-before-code); `zero-hallucination-coder` (no invented APIs); `sentinel` (secret-scan + MASVS); `harness-audit` (agent-harness audit; maps onto `scripts/quality-gates.mjs`); `parallel-execution-optimizer` (lane programmes); `order-traceability-checklist` (owner-order reconstruction); `repo-hygiene-scan` (dead code, import cycles); `test-collaboration` (TEST-ID evidence); `production-audit` (pre-launch audit) |
| Android — wallet/crypto (11) | `evm-token-decimals`, `nodejs-keccak256`, `crypt`, `port`, `native`, `compose-multiplatform-patterns`, `kotlin-coroutines-flows`, `senior-mobile`, `hexagonal-architecture`, `llm-trading-agent-security`, `security-review` | `senior-mobile` MIT + Commons Clause; `security-review` MIT; rest none stated | `port` (web→Android porting method — the single most relevant find for the §2.6 gap; data-layer porting localStorage → Room/DataStore/Tink-encrypted DataStore); `native` (Kotlin/Compose/Room/DataStore — baselines newer than Bawa's stack, do not apply blindly); `crypt` (Android Keystore + StrongBox, Tink-encrypted DataStore); `kotlin-coroutines-flows` (Flow data layer); `compose-multiplatform-patterns` (Compose patterns; KMP parts do not apply); `hexagonal-architecture` (per-chain adapters as outbound ports); `evm-token-decimals`; `nodejs-keccak256` (Node `sha3-256` ≠ Ethereum Keccak-256); `senior-mobile` (API 36 target); `llm-trading-agent-security` and `security-review` are partial/marginal (trading-agent and generic-web scoped) |
| Preview — build, verification, CI (21) | `vite-patterns`, `browser-qa`, `browser-use`, `browser-screenshot-diff`, `e2e-testing`, `voyager`, `playwright-uitest`, `webapp-testing`, `playwright-trace`, `fix`, `generate`, `pw-init`, `skill-visual-feedback`, `break-ui`, `mobile-native`, `ui-ux-pro-max`, `impeccable`, `performance-optimization`, `gear`, `devops-workflow-engineer`, `ci-cd-and-automation` | `e2e-testing` MIT; `impeccable` Apache 2.0; `devops-workflow-engineer` MIT + Commons Clause; `webapp-testing` LICENSE.txt present; `playwright-uitest` AgenticX, no licence stated; `browser-use` no licence stated; rest none stated | Preview-loop method: `vite-patterns` (Vite 8+; `vite build` does not type-check — confirms the separate tsc gate); `e2e-testing` + `voyager` + `playwright-trace`/`fix`/`generate`/`pw-init`/`playwright-uitest`/`webapp-testing` (E2E authoring, debugging, flake budgets); `browser-qa` + `skill-visual-feedback` + `break-ui` + `mobile-native` (the owner's phone-screenshot correction workflow; worst-case data; 16 px inputs; safe areas); `browser-use` (CDP driver alternative — needs its CLI/daemon); `browser-screenshot-diff` (needs ruvector, not installed); `ui-ux-pro-max` + `impeccable` (design review); `performance-optimization` + `gear` + `devops-workflow-engineer` + `ci-cd-and-automation` (perf targets, CI, bundle gate) |

| Find | Licence | Useful for |
| --- | --- | --- |
| `mcp-interviewer` (Python CLI) | MIT | Verification tooling: constraint + functional testing of MCP servers. Bawa's agent tooling depends on MCP servers; RAMPART covers safety testing and SkillSpector covers skill scanning, but neither tests the MCP servers themselves. Small, single-purpose, agent-side QA for the guide's own execution tooling. |

### §18.6 Main-only reference material — `captcha/` (Lane B, 2026-11-26)

`captcha/` exists ONLY on `main` (82 files) and stays main-only — do
NOT port anything from it into token-gaps or this spec's build. It is
reference material, not part of the wallet: the FuckCaptcha CC0-1.0
field guides plus a read-only captcha runner. The runner requires
`CAPTCHA_URL` and never submits forms, clicks, signs or sends. It is
recorded here so a later lane knows it exists and where it lives, and
does not mistake its absence from token-gaps for a gap.

## §19. Guide-gap audit — fix programme + Lanes A/B (2026-11-28)

**Method (Lane D, hands-on, 0 Sol calls, 0 external-model calls).**
Base `7f24ef1` (Lanes A+B merged). The guide was read in full
(1,524 lines), then each section was re-traced to the code it cites
and to the fix-programme commits (`d06a224` Gnosis history;
`f77b803` change password; `9fc01e9` remove token; `63fb8c4` Activity
switcher; `65edc90` /wallets rename+delete; `ae519f0` chart retry;
`e6a2727` watch balances + TRON fallback; `4adbd30` watch-only-only
Home) and the Lane A (`aea4b58`) and Lane B (`fec71be`) commits,
plus the five fix-programme verification reports in
`bawa-verify/lanes/lane-a.md` … `lane-e.md`. Gaps were added in
place in their sections (§2.7, §4, §6.8, §7.2, §8, §9, §13,
§15.1, §15.2); stale claims were corrected in place (§2 history
count, §8 QR sizes, §0.3 QR-card style note, §3/Part A gate
figures). Gates at this tip, run first-hand on loud-stone (Node 22)
by this lane: typecheck 0, build 0, eslint 0, vitest 129 files /
3,416 passed + 5 skipped, total JS 4,509,097 / 6,000,000, largest
chunk 2,906,616 / 3,050,000.

**Gaps found and added (13):** (1) history indexers — the 18/4
split, Gnosis via gnosisscan.io, the four still-blocked chains with
per-chain probe reasons, and the browser-fetch probe lesson (§2.7);
(2) change password — trial-decrypt verification, re-encryption,
stored-key rule (§4); (3) removing an added token — two-tap
Remove, custom tokens only (§6.8); (4) asset chart retry +
Coinbase candles fallback, 44 products (§7.2); (5) QR sizes
corrected to the Lane 1 growth, flat style-B, `QR_CARD_FOOTER`
location, `splitAddressLines` twins, template A stacked band (§8);
(6) watch-only on the dashboard and /assets + watch-only-only Home
routing (§9); (7) TRON PublicNode fallback (§9); (8) failed rows
stay visible + /assets 24h (§9); (9) Activity wallet switcher,
counted progress, /track auto-retry (§9); (10) password change
cancels Shamir share sets (§13); (11) /wallets rename + per-account
delete (§15.1); (12) mobile overflow fix patterns (§15.2); (13) the
§17 trace rows for all of the above.

**Guide claims corrected (5):** (§2) history 17 verified / 5 blocked
→ 18 / 4; (§8) QR code sizes B–G and centre-logo caps; (§0.3) the
QR card is no longer "untouched by the style work" — Lane B
flattened it; (§8) the in-app/PNG parity-gap note replaced by the
stacked-band difference; (§3 + Part A) test counts 3,351 → 3,416
passed and total JS 4,482,622 → 4,509,097 at `7f24ef1`.

**Dashboard row count — FIXED (Lane 2, 2026-11-28, `3db591e`, hands-on, 0 Sol calls):** the live count varied 41–43 because failed rows rendered as a plain `<li>` with no link — the count of navigable rows was 43 minus the rows whose balance fetch had failed (native Dogecoin, SoChain 429s on the shared egress with BlockCypher CORS-blocked as its only fallback; TRON USDT, Trongrid `triggerconstantcontract` 429 — the native TRX row survives the same 429s via its PublicNode fallback, the token path has none). The `<li>` count itself was always 43 (`e6a2727` held: failed rows stay visible). Fix in `screens/asset-rows.tsx`: every main-list row is a link to its asset detail in every state — ready, failed, or still loading — in both the list and table variants, so the linked-row count is the full 43 whatever the network does; watch-only rows are never links (a watched address can never send). Verified first-hand in the real browser (production build, fresh disposable test wallet per viewport, phrases never logged): 5 reloads at 390 px + 5 at 1280 px, `li` = 43 and linked = 43 at every sample (40 samples, including mid-load and with 1 balance failed), with count logs + screenshots. Gates at `3db591e`: tsc 0, eslint clean, build exit 0, vitest 3,428 passed + 5 skipped (129 files) on the worktree as tested (which also held other lanes' uncommitted test edits; this lane's own suites, dashboard + asset-list, 61 passed), total JS 4,509,662 / 6,000,000.

**Watch-only display programme — documented (docs lane, 2026-11-28,
hands-on, 0 Sol calls, 0 external-model calls).** Build `4728ff1`
on `panel-rebuild/token-gaps` (merged `0640e1e`); the guide records
it in §9 (combined hero, allocation, live balances, Activity
default, add flow, asset detail, /track), §15.1 (/wallets
disclosure + one "Forget this wallet" per card) and the §17 trace
row; DECISIONS.md §51 is the programme record. Two file:line
citations were corrected first-hand before commit
(import-wallet address field `:899-904` with the chain picker at
`:938`, not `:899-909` / `:943`; State B allocation block
`:1533-1549`, not `:1533-1550`). Docs gates run first-hand on
loud-stone after the edit: `python tools/check-links.py` OK (183
files); `node tests/diagram-references.test.mjs` 4 pass / 1 fail —
the same pre-existing failure as the baseline before this edit
(test 3, "validation-draft files stay out of the repo",
`EthSendComposer.kt` on the branch; recorded in §49). No code
changed; nothing pushed.

**Docs audit, Lane A (2026-11-28, hands-on, 0 Sol calls).** The guide was re-read in full (1,831 lines) against token-gaps `ceade79` and each section re-traced to the code it cites. Current-state figures corrected in place: vitest 3,416 → 3,429 passed (gates at `1253bf6`) and total JS 4,509,097 → 4,509,662 (Part A status, Bundle note, §0.2, §3); Buy headroom 1,517,378 → 1,490,338 (§12); `SUPPORTED_CHAINS` line `chains.ts:1687` → `:1731` (§2); Gnosis history record `chains.ts:812-815` → `:832-833` (§2.7); `send.ts:987` "Nothing here broadcasts" → the per-signer occurrences (EVM `:1165`, TRX `:1715`, TRC-20 `:2487`) (§5). Android state corrected in place: Step 4 DONE (`f9f312b`, 2026-11-28 — AAR in-tree, `ENGINE_BINDING_AVAILABLE = true` at `DerivationPolicy.kt:199`, on-device derivation bound, execution still unverified); Step 3 added the `INTERNET` permission and the data layer (§2.6, §15, §17 trace row). Two registry lags found, not fixed here (data, not docs): `registry/capabilities.json` `chainSupport.history` I&V is 17 while `chains.ts` history covers 18 (Gnosis, `d06a224`, never reached the registry); `registry/chains.json` is stale at `ceade79` — last regenerated at `b65e8c3` from `7efba14`, it has no DeFiBit BSC RPC (`ff63077`), so regeneration is owed (`ci.yml:221` runs the generator's `--check`). The 3 open findings (vite-dev WASM 404, TRON USDT PublicNode fallback, mmdc persistent reinstall) are still open and are not claimed fixed anywhere in this guide.

**Docs-audit merge (2026-11-28, hands-on, 0 Sol calls).** The 3 open findings above are now FIXED at token-gaps `1a85258` (vite-dev WASM `ae07a45`, TRON USDT PublicNode fallback `8a7943d`, mmdc persistent path `aece05d`; DECISIONS.md §49; live site republished, gh-pages `e0bc252`, serving `index-B9gxTjOm.js`). Current-state figures in this guide were updated to the `1a85258` gates: vitest 3,429 → 3,437 passed (Part A status, §0.2, §3), total JS 4,509,662 → 4,509,960 (Bundle note, §0.2), Buy headroom 1,490,338 → 1,490,040 (§12). The vite-dev WASM warnings (CREATE-EXAMPLE-WALLET.md, HOW-IT-WORKS.md) are fixed by `ae07a45`. The Lane A §19 record above is the dated record of the `ceade79` audit and is left unchanged.

## §20. Owner-configured API keys and the Relay proxy — "I have a key, what do I do?" (2026-11-28, docs-audit Lane A)

This section answers one question: a user HAS an API key (or a proxy
endpoint) — where does it go, what does it unlock, and what does the
app show without it? No key value is given anywhere here; no key value
has been invented. All config paths were verified first-hand in the
code at token-gaps `1a85258`.

### §20.1. History keys — the 4 blocked chains (BSC, opBNB, Fantom, Metis)

**No key slot exists today.** No `apiKey` appears anywhere in
`apps/web/src/wallet/adapters/` (verified 2026-11-28 at token-gaps
`1a85258`). The four chains are balance-only; their history stays
blocked, never faked (Doc 06 §3). Per-chain probe reasons
(DECISIONS §46): BSC — Etherscan V2 refuses keyless, no Blockscout,
BscScan V1 needs a key; opBNB — Etherscan V2 502s, opbnbscan is
HTML-only with no JSON API, no Blockscout; Fantom — Etherscan V2
dropped the chain id, Blockscout 503, ftmscout 522; Metis — Andromeda
returns real transactions to curl but sends no CORS header, so the
browser blocks every fetch (wiring was built, then reverted).

**Options for a user who has a key:** (a) a free Etherscan/BscScan API
key, (b) a NodeReal free-tier key, or (c) Blockscout PRO. Which one,
and where it goes, is an owner decision and code work — there is no
env var or config file to drop a key into today, and no key value
should be invented. **What the app shows without a key:** balances
load; history for these four chains stays blocked with the honest
blocked state.

### §20.2. Buy-provider keys

Six build-time env vars, read via `readEnv` in
`apps/web/src/wallet/buy-providers.ts` (trims whitespace; empty =
unset) — full table in §12.1: `VITE_RAMP_HOST_API_KEY` (public by
Ramp's design), `VITE_MOONPAY_API_KEY` (publishable `pk_live_…` only —
the secret `sk_live_…` is never read), `VITE_ONRAMPER_API_KEY`,
`VITE_BANXA_PARTNER_REF` (a partner subdomain, not a key),
`VITE_MERCURYO_WIDGET_ID`, `VITE_COINBASE_ONRAMP_APP_ID`
(`onramp.ts:73`). Transak has no env var and no builder: its widget
URL is minted server-side with the API secret (POST refresh-token →
POST auth/session → widgetUrl, valid 5 minutes, single-use sessionId)
and its readiness is always `needs-backend`. **What the app shows
without a key:** each provider's Buy row says "Not set up yet —
{setupCopy}" (`receive.tsx:200`).

### §20.3. Relay proxy — implementable spec

Full spec: §12A item 2, "Relay proxy — implementable spec". The
contract in brief, so this section stands alone: the app never calls
`https://api.relay.link` directly — it calls `POST
${proxyUrl}/quote/v3` and `GET ${proxyUrl}/chains` on a proxy whose
base URL comes from the build-time env `VITE_RELAY_PROXY_URL`
(`relayProxyBaseUrl()` in `apps/web/src/wallet/relay-quotes.ts`;
empty by default). The proxy appends the secret Relay API key
server-side; the key is NEVER in the browser (no `apiKey` parameter
anywhere in `relay-quotes.ts`, by design) — or a short-lived access
token minted by a backend (15-minute expiry) goes in the
`Authorization: Bearer` header. The quote request body is exactly
`user`, `recipient`, `originChainId`, `destinationChainId`,
`originCurrency`, `destinationCurrency`, `amount` (base units),
`tradeType: "EXACT_INPUT"`; the 15 s timeout, the strict v3 response
parsing (`requestId`, non-empty `steps`, `details.currencyOut`
`amount`/`minimumAmount`/`amountUsd`, `fees` summed to `feeUsd`,
`originGas` to `gasUsd`), the status mapping (`ok` / `no-route` /
`not-configured` / `unavailable`), and the chain-id and
currency-address tables are all specified in §12A. The proxy's origin
must be added to `connect-src` in
`apps/web/src/app/security-headers.ts` at deploy time — the CSP cannot
learn a host at runtime. **What the app shows without a proxy:** the
Relay row says plainly it is not set up ("Relay quotes need a proxy
or access-token endpoint — not set up yet") and no Relay request is
made (`swap.tsx:19-21`, `relay-quotes.ts` returns `not-configured`
without touching the network). **Owner must provide:** Relay Dashboard
account + App + API key, and the proxy/token endpoint.

### §20.4. STON.fi integrator addresses

**No config slot exists.** `buildStonfiQuoteRequest` takes only
fromChain / fromToken / toChain / toToken / fromAmountBaseUnits, and
the only fee field in the tree is `flexibleIntegratorFee: true`
(`stonfi-quotes.ts:307`). Quotes work without integrator addresses
(live: 1 USDT on TON → 0.972388 USDC on Base). Supplying
destination-chain integrator addresses and the fee choice
(`integratorFeePips` / `referralValue` bps) is code work, not an env
var — do not invent an env var name for them.
