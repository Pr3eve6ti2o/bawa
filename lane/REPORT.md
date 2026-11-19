# Lane B — Multichain Registry: REPORT

- Branch: `panel-rebuild/multichain-b-registry` (base `panel-rebuild/adopt-proper` @ `f8255ff`, verified first-hand at lane start)
- Commit: `77a6beec1dc637e4b050b1b56eff3f896bf38701`
- Host: gray-pinee (nyc). Model: gpt-6.1-sol, API 1 ONLY, MAX REASONING, cap 32,000.
- Status: DONE, local only. **Do NOT push.**
- Date: 2026-11-20

## What was built

The registry is now the source of truth for 13 chains. Every chain the UI
shows is in the registry with its canonical network ID, recovery profile
and supported operations. Unsupported operations stay `blocked` — nothing
is faked.

### Chains added (9)

| id | chain | sym | canonical network ID | asset ID suffix | derivation path | recovery profile | evmChainId | dec |
|----|-------|-----|----------------------|-----------------|-----------------|------------------|------------|-----|
| sol | Solana | SOL | solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp | slip44:501 | m/44'/501'/0' | bawa-sol-bip44-v1 | null | 9 |
| bsc | BNB Smart Chain | BNB | eip155:56 | slip44:714 | m/44'/60'/0'/0/0 | bawa-evm-bip44-v1 | 56 | 18 |
| matic | Polygon | POL | eip155:137 | slip44:966 | m/44'/60'/0'/0/0 | bawa-evm-bip44-v1 | 137 | 18 |
| arb | Arbitrum One | ETH | eip155:42161 | slip44:60 | m/44'/60'/0'/0/0 | bawa-evm-bip44-v1 | 42161 | 18 |
| op | OP Mainnet | ETH | eip155:10 | slip44:60 | m/44'/60'/0'/0/0 | bawa-evm-bip44-v1 | 10 | 18 |
| base | Base | ETH | eip155:8453 | slip44:60 | m/44'/60'/0'/0/0 | bawa-evm-bip44-v1 | 8453 | 18 |
| avax | Avalanche C-Chain | AVAX | eip155:43114 | slip44:9000 | m/44'/60'/0'/0/0 | bawa-evm-bip44-v1 | 43114 | 18 |
| ltc | Litecoin | LTC | bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2 | slip44:2 | m/84'/2'/0'/0/0 | bawa-ltc-bip84-v1 | null | 8 |
| doge | Dogecoin | DOGE | bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691 | slip44:3 | m/44'/3'/0'/0/0 | bawa-doge-bip44-v1 | null | 8 |

Supported for all 9: create / derive / restore / receive — `verified`
(derivation probe 2026-11-20 + `core.test.ts` extended-chain checks).
Blocked for all 9: balance / history / fee-quote / plan-transfer /
local-sign / verify-signature — `NOT_SUPPORTED`, evidence contains
"never faked". No adapters, no RPC endpoints (`rpcEndpoints: []`), no send
builders for any of them.

Original 4 chains (btc/eth/trx/ton) unchanged: paths, IDs and operations
exactly as before; their existing tests still pass.

### Derivation probe (evidence: `lane/evidence/probe-2026-11-20.jsonl`)

BIP-39 test-vector mnemonic (`abandon` x11 + `about`, empty passphrase,
no funds). All 13 chains verified first-hand against Wallet Core 4.9.3:
`getAddressForCoin` == explicit-key path address == xpub round-trip,
`CoinTypeExt.validate` true. Spot values (full list in the evidence file
and in `core.test.ts`):
btc `bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu`,
eth/bsc/matic/arb/op/base/avax `0x9858EfFD232B4033E47d90003D41EC34EcaEda94`,
trx `TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH`,
ton `UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY`,
sol `GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL`,
ltc `ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh`,
doge `DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC`.

## Catalogue sources (read-only, verified first-hand)

- Trust Wallet wallet-core `registry.json`, commit
  `d40d24a63d92619167903369308bf0e2f7eb3a59` (2026-09-24), 168 coins.
  Licence **Apache-2.0** (verified via GitHub API + LICENSE text).
  Taken: coinType names (solana, litecoin, dogecoin, smartChain, polygon,
  arbitrum, optimism, base, avalancheCChain), coin IDs, segwit/BIP-44
  paths, xpub versions (Ltub `019da462`, dgub `02facafd`).
- ethereum-lists/chains, HEAD `428cd0b77764cb1cb930d790888590afa6b28e4b`
  (2026-11-19): eip155-56/137/42161/10/8453/43114 (names, native assets,
  chain IDs). Licence: the repo's LICENSE file and GitHub API both say
  **MIT** — the brief's "CC0" claim was NOT confirmed by the repo's own
  LICENSE file; report MIT.
- SLIP-44 (`satoshilabs/slips` slip-0044.md): BTC 0, LTC 2, DOGE 3,
  ETH 60, TRX 195, SOL 501, TON 607, BNB 714, MATIC 966, AVAX 9000.
- Genesis hashes via Blockchair API (2026-11-20): LTC block 0
  `12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2`,
  DOGE block 0
  `1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691`.
- Evidence in `lane/evidence/`: `probe-2026-11-20.jsonl`,
  `wc-registry-extract.json`, `el-{56,137,42161,10,8453,43114}.json`.

## Files changed

- `apps/web/src/wallet/chains.ts` — 9 entries, `capabilitiesForExtendedChain`, SUPPORTED_CHAINS 13, SOLANA_PROFILES trimmed to the phantom entry.
- `apps/web/src/engine/boundary.ts` — ChainId 13, ALLOWED_VERSIONS +9, DERIVATION_PREFIXES +8, `validateSolanaAddress`, SOL routed like TON in watch-only + deriveAddress + deriveAddresses.
- `apps/web/src/wallet/core.ts` — DEFAULT_PATHS +9, coinForChain +9, 13-chain deriveAddresses/deriveAddressesAt, pubkey forms (Ed25519 ton|sol, compressed btc|ltc|doge, uncompressed EVMs), deriveFromXpub rejects SOL like TON.
- `apps/web/src/wallet/send.ts` — CHAIN_NAMES +9, validateRecipient coinTypes +9 (no send builders added).
- `apps/web/src/wallet/format.ts` — CHAIN_DECIMALS +9 (sol 9, EVMs 18, ltc/doge 8).
- `apps/web/src/state/wallet-context.tsx` — perChain + vaultAddresses +9 (CHAINS const deliberately still 4 adapter chains).
- `apps/web/src/screens/import-wallet.tsx` — inputConfigByChain +9, profileIds deduped (picker list deliberately still 4).
- `apps/web/src/screens/asset-rows.tsx` — CHAIN_LOGOS now `Partial`, symbol-initial badge fallback when no logo file exists (no logo files added; token-logos lane owns logos).
- `apps/web/src/screens/create-wallet.tsx` — profileIds deduped (see below).
- `packages/contracts/src/index.ts` — ChainId 13 (the second ChainId definition; see open items).
- `registry/capabilities.json` — `updated` 2026-11-20, 9 chainSupport entries (profiles `["multichain-extended-wallet"]`).
- `registry/profiles.json` — new profile `multichain-extended-wallet` (web, 9 chains, trust-wallet-core 4.9.3; create/derive/restore/receive IMPLEMENTED_AND_VERIFIED, other 6 NOT_SUPPORTED; status DOCUMENTED_NOT_TESTED).
- `registry/schemas/registry.schema.json`, `registry/schemas/profile.schema.json` — chain enums +9, profile id enum += new profile.
- `scripts/validate-registry.mjs` — CHAINS 13; profile-count check fixed 7 -> 8 (see below).
- `scripts/plan-build.mjs` — CHAINS 13 (`RECOGNISED_UNSUPPORTED_CHAINS` deliberately left at `['solana']`; see below).
- `ai/profiles/multichain-extended-wallet.md`, `ai/prompts/create-multichain-extended-wallet.md` — new, modelled on web-wallet's files (no generator exists in the repo; hand-written).
- Tests: `apps/web/src/wallet/chains.test.ts` (17 tests), `core.test.ts` (17), `engine/boundary.test.ts` (62), 6 screen test files (local CHAINS mocks + full Record literals extended to 13), `screens/create-wallet.test.tsx` (7 distinct profileIds), `tests/registry.test.mjs` (profile count 8, entry count 33, PROFILE_IDS += new profile).

## Design decisions (mine — for the coordinator)

1. One new profile (`multichain-extended-wallet`) instead of adding chains to existing profiles: the minimum-rule would have dragged existing profiles' operation statuses down and changed the original 4 chains' profile membership.
2. `DestinationChain` (`packages/contracts/src/index.ts:143`) stays 4 by design: it drives mainnet destination validation + send, which only supports the 4 chains with send builders. Plan-transfer stays blocked for new chains.
3. ProfileIds deduped at vault creation (`create-wallet.tsx`, `import-wallet.tsx`): the vault stores the distinct recovery profiles (7: btc, evm, trx, ton, sol, ltc, doge), not 13 entries with `bawa-evm-bip44-v1` six times. The stored list is recovery metadata only; derivation iterates chains, not profiles.
4. Validator latent bug fixed: `validate-registry.mjs` compared `profiles.length !== 7` while its message said "expected 8 profiles" — with 8 profiles it errored while claiming to expect 8. Condition corrected to 8.
5. `RECOGNISED_UNSUPPORTED_CHAINS = ['solana']` kept: `tests/classifier.test.mjs` pins the exact reason string "chain 'solana' requested but not supported by the web-wallet profile" (2 tests). Removing the entry would change the planner's error taxonomy for the name 'solana'. See open item 2.
6. Skill: no installed skill covers multichain registries. `api-and-interface-design` was read and its contract-first / validate-at-boundaries principles applied to the registry design; it had no chain-registry-specific guidance.

## Verification (all first-hand, 2026-11-20)

- `tsc --noEmit` (apps/web): exit 0.
- `npm run build` (apps/web): exit 0 (only the pre-existing >500 kB chunk warning).
- Vitest full suite (apps/web): 40 files, **473/473 pass**.
- `npm ci`: 0 vulnerabilities. `npm audit`: 0 vulnerabilities.
- `node scripts/validate-registry.mjs`: `OK: 4 files, 33 entries validated`, exit 0.
- Repo-root node tests: 95/96 pass (registry 73/73 incl. T46 + classifier + plan-build). The 1 failure is pre-existing at base, untouched by this lane: `tests/stale-data.test.mjs` "M-31 must stay OPEN" — the guide records M-31 CLOSED by owner order 2026-11-13 and the test was never updated. My lane touched neither the guide nor that test.
- AVOID-list grep (whole worktree, all 14 names): **0 hits**.
- Per-chain: every new chain is in the registry with canonical ID, recovery profile and supported ops; derivation + address format verified against Wallet Core; UI shows a chain only where its ops are supported (Receive derives; send/balance/history stay blocked and asserted).
- Original 4 chains: existing tests pass, paths/IDs/ops unchanged.

## Sol calls (gpt-6.1-sol, API 1, MAX REASONING)

| # | prompt | words | result | dur |
|---|--------|-------|--------|-----|
| 1 | p1-chains.md | 541 | landed | ~240 s |
| 2 | p2-boundary.md | 542 | landed | ~360 s |
| 3 | p3-core.md | 519 | landed | ~240 s |
| 4 | p4-ripple.md | 568 | landed-partial (6/7; asset-rows split out) | ~360 s |
| 5 | p4b-asset-rows.md | 247 | landed | ~240 s |
| 6 | p5-chains-test.md | 724 | not-landed (Sol asked for the current file; split into P5a/P5b) | ~360 s |
| 7 | p5a-chains-test.md | 468 | landed | ~480 s |
| 8 | p5b-chains-test.md | 614 | landed | ~420 s |
| 9 | p6-core-test.md | 451 | FAILED — AgentRouter 400 content-blocked (request id `20261120040938433954032p2cgpcnyY5j2b`), no output | — |
| 10 | p6a-core-test.md | 382 | FAILED — AgentRouter 400 content-blocked (request id `202611200413376702735966p9sdtkYfTyPR`), no output | — |

Totals: 10 calls, 8 landed, 1 not-landed, 2 failed. Durations approximate
from file/process times.

Hands-on fixes to Sol output (all verified by running tests): P1 `pathFor`
defaults + field order; P2 third TON short-circuit site routing SOL;
P3 indent errors; P4 missing `export` on CHAIN_DECIMALS + missing `sol`
coinType (added by hand); P4b `src={logo}` fix; P5a spurious trailing
apostrophe on EVM/LTC/DOGE path expectations (my prompt typo).

Hands-on work after the content blocks (calls 9–10): P6a contained NO
mnemonic — only the Ltub/dgub extended keys — and was still blocked, so
the likely trigger is the extended-key strings, not the test phrase. The
whole of P6 (core.test.ts) and P7 (boundary.test.ts) was therefore written
hands-on from fixtures verified first-hand in the probe; both files pass
100% (core 17/17, boundary 62/62). No Sol call was retried as-is.

## Open items

1. adopt-proper moved to `d78e117` while this lane's base is `f8255ff`
   (evidence-transfer + branch-evaluation work on 2026-11-20). This lane
   needs a rebase/merge onto the current adopt-proper — coordinator-level.
2. Classifier/planner name mapping: `scripts/classify-request.mjs`
   maps the name `solana` (and `sol`) to the id `'solana'`, which is not
   a registry id (`'sol'` is). `extractChains('...Solana...')` returns
   `'solana'`, and the planner still treats it as recognised-unsupported
   (the classifier tests pin that message for web-wallet). A user typing
   "Solana" therefore fails closed even though `sol` is now supported.
   Fixing the mapping belongs to the classifier/planner scope, not this
   lane; flagged, not changed.
3. Two ChainId definitions must stay in sync (`apps/web/src/engine/boundary.ts:4`
   and `packages/contracts/src/index.ts:3`); unification is a follow-up.
4. New chains appear in Receive (derive/receive verified) but not in
   send/balance/history UI (blocked) and not in the import picker
   (hardcoded 4). UI exposure for new chains is other lanes' scope.
5. No adapters / RPC endpoints for new chains (`rpcEndpoints: []`).
6. `tests/stale-data.test.mjs` M-31 test fails at base (see Verification).
7. `ai/profiles/*.md` header says "re-generate after any registry change"
   but no generator exists in the repo; the new profile doc was written
   by hand following the web-wallet pattern.
