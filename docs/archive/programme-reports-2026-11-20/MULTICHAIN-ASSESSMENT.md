# Multichain-Create Assessment — Lane A

**Scope:** the other AI's guide "Bawa — AI agent implementation guide" (`/home/boxd/workspace/other-ai-guide.md`, 92 lines), describing a "Wallet Workbench", assessed against OUR repo.

**Base verified first-hand:** branch `panel-rebuild/multichain-a-assessment` at `f8255ff` (`panel-rebuild/adopt-proper`), gray-pinee, 2026-11-20. Worktree: `/home/boxd/workspace/bawa-multichain-a-assessment`.

**Note:** while this lane ran, `panel-rebuild/adopt-proper` advanced to `d78e117` (evidence transfer, pushed). This assessment is against `f8255ff` as briefed; the files it cites are unchanged by that transfer (docs-only).

**Method:** every tree claim checked first-hand on the VM (`ls`, `grep`, `git ls-remote`); every licence/pin checked first-hand via the GitHub API at the exact pinned commit plus a raw `LICENSE` fetch. Sol (gpt-6.1-sol, API 1, MAX REASONING) drafted sections 1–4 from the supplied verified evidence only; the lane author verified Sol's drafts against the first-hand evidence and corrected two points (marked **[lane correction]**). Sol made no licence or existence claim of its own.

**Headline verdict:** the other AI is right about the gaps and wrong about the present state. The 4-chain limit, the missing price feed, the chain-only logos and the single-tool Create screen are all real. The "Wallet Workbench" — its paths, commands, branches, and "already works" numbers — does not exist in our repo or on GitHub. Of 17 pinned SDK references, 10 are usable with conditions, 3 are usable as reference only, and 4 must not be copied (1 GPLv3, 3 with no licence file at the pin — see §3).

---

## 1. What the other AI got right

| Claim | Verdict | Verified evidence |
|---|---|---|
| Only 4 chains supported | **Confirmed** | `apps/web/src/engine/boundary.ts:4`: `export type ChainId = 'btc' \| 'eth' \| 'trx' \| 'ton';` |
| No live price feed; portfolio total unavailable | **Confirmed** | `apps/web/src/screens/dashboard.tsx:36` ("No price feed exists"), `:41` and `:63` (hero text `'Unavailable'`), `:89`: "No price feed connected — portfolio total unavailable. Balances below are exact native amounts from the mainnet adapters." |
| Token logos only for the 4 chain logos | **Confirmed** | `apps/web/src/assets/chains/` holds only `bitcoin.png`, `ethereum.png`, `ton.png`, `tron.png`, imported as `ChainLogo` in `apps/web/src/screens/asset-rows.tsx:13-14`, sourced from Trust Wallet assets (MIT, cited at `asset-rows.tsx:10-11`). No per-token logos exist. |
| Create is a single wallet, not a workspace of tools | **Confirmed with correction** | Route `/create-wallet` registered at `apps/web/src/app/app.tsx:219`; `apps/web/src/screens/create-wallet.tsx` is a single 4-step mnemonic creation flow (password → write down → confirm → done), not a 7-tool workspace. |
| Transaction history is absent | **Wrong — partially exists** | `apps/web/src/screens/transaction-history.tsx` reads history from the four chain adapters. Public indexers, first-hand: ETH `https://eth.blockscout.com/api` (`apps/web/src/wallet/adapters/eth.ts:23`), BTC `https://mempool.space/api` (`btc.ts:15`), TRX `https://api.trongrid.io` (`trx.ts:14`), TON `https://toncenter.com/api/v2/jsonRPC` (`ton.ts:13`). What is genuinely missing: Solana, watch-any-address, and a 12-route tracker. |

**What this means:** the diagnosis (4 chains, no prices, chain-only logos, no tool workspace) is accurate. The prescription's premise — that a working Workbench already exists to extend — is not.

---

## 2. What is fictional or unverified in its guide

| Claim | Status | Evidence |
|---|---|---|
| A "Wallet Workbench" / seven-tool Create workspace exists | **Missing** | The real `/create-wallet` route is one four-step flow. `apps/self-custody/` and `START.html` do not exist in the checked tree. |
| Workbench, chain-read and market-data packages exist | **Missing** | `packages/wallet-overview/`, `packages/chain-read/`, `packages/market-data/` are absent. Real `packages/` contains only `contracts/`. |
| Workbench/network/support/upstream registry files exist | **Missing** | Absent: `registry/workbench-market.json`, `registry/tracker-networks.json`, `registry/network-catalog.json`, `registry/wallet-support.json`, `registry/upstreams.json`. Real `registry/` contains only `capabilities.json`, `engines.json`, `profiles.json`, `ui.json` and `schemas/`. |
| Solana support, watch-any-address or a 12-route tracker exists | **Missing** | Only BTC, ETH, TRX and TON are defined. Their transaction history exists (§1); Solana, watch-any-address and a 12-route tracker do not. |
| A connected price feed and available portfolio total exist | **Missing** | `apps/web/src/screens/dashboard.tsx:36,41,63,89` states "No price feed exists", displays "Unavailable", and says "No price feed connected — portfolio total unavailable." |
| The claimed npm commands exist | **Missing** | No `start:build`, `start:preview`, `skills:check`, `upstreams:check`, `test:live:wallet`, `wallet:plan` or `test:browser:*`. Root `package.json` scripts are only `check` and `test`; `apps/web/package.json` scripts are `dev`, `build`, `preview`, `typecheck`, `test`, `clean`, `predev`, `prebuild`. |
| The build-planner file exists | **Real (but the command does not)** | `scripts/plan-build.mjs` exists, but no npm script calls it `wallet:plan`. |
| Remote branches `feature/multichain-create-workbench` and `feature/self-custodial-web-wallet` exist | **Missing** | `git ls-remote --heads origin` returns 17 branches with zero matches for `multichain` or `self-custod`; neither named branch is present. |
| "2,894 EVM catalogue records", "168 Wallet Core profiles", "32 reviewed quote rows", "7/7 quotes, 7/7 balances, six transactions" | **Unverifiable here** | No matching counts in `registry/` or `docs/12-chain-registry-and-assets/`. These figures cannot be verified in our tree. |

**Count:** 10 fictional/missing claims (paths, packages, registry files, tracker scope, price feed, commands, 2 branches — counted as one row above but two branches), 1 real-but-misnamed item (`scripts/plan-build.mjs`), 1 unverifiable numbers row covering 4 figures. Nothing in §2 exists in our repo or on GitHub.

---

## 3. Pinned SDK / source references — licence and verdict

Licences verified first-hand 2026-11-20 via the GitHub API (`/license?ref=<pin>` + `/commits/<pin>`, all HTTP 200) and raw `LICENSE` fetches at each pin. Verdicts apply to our **MIT app**; licence verification does not establish functionality or security.

| Pinned source | Pin | Verified licence | Verdict | Reason |
|---|---|---|---|---|
| BitGo eth-multisig-v2 | `7d14d8b2` | Root LICENSE: Apache-2.0; package.json: ISC | Usable with conditions | Follow root Apache terms, reconcile the ISC metadata, and separately assess the legacy Solidity 0.4-era WalletSimple — compatibility reference only, not a new default. |
| Via web3-wallets | `44e90aa2` | MIT | Usable with conditions | Retain MIT licence and copyright notices; check current maintenance before installing any package. |
| Via tokenlists | `3ff5b3a1` | MIT | Usable with conditions | Retain notices; independently verify chain, contract and decimals per token — do not promote every listed token onto a balance reader. |
| Rabby | `99db3534` | MIT text in LICENSE file (API reports NOASSERTION because of an extra brand-name clause: "Brand name and logo of Rabby is copyright reserved") | Usable with conditions | Review the complete pinned licence text including the brand clause; retain notices. |
| RabbyDesktop | `39b04238` | Same MIT text as Rabby | Usable with conditions | Review the complete pinned licence text; retain notices; review native/extension licences separately. |
| Rabby Mobile | `c0d64c6e` | No LICENSE file at pin (HTTP 404); root package.json has NO licence field | **Do not copy** | No reuse grant is verified; establish a licence first. |
| RabbyKit | `653b79ae` | No LICENSE file at pin (HTTP 404); package.json licence ISC (root and `packages/rabbykit/`) | **Do not copy** | ISC manifest metadata alone is not a licence grant. |
| Rabby Security Engine | `645c0103` | No LICENSE file at pin (HTTP 404); package.json licence ISC | **Do not copy** | Licence remains unresolved beyond metadata; establish a grant first. |
| Safe Apps SDK | `529a3d48` | MIT | Usable with conditions | Retain notices; Safe-hosted dApp integration only, not vault/recovery/deployer. Enforce host/origin. |
| Safe CLI | `d57d1a53` | MIT | Usable with conditions | Reference only, or qualify exact Python dependencies and offline/read commands in isolation — it contains write paths. |
| Safe Core SDK | `dc6bf6d3` | MIT | Usable with conditions | Protocol Kit for drafts/hashes; verify deployed versions and code per chain. Relay/execute excluded. |
| safe-eth-py | `5c07bb9b` | MIT | Usable with conditions | Candidate for independent validation, ABI and deployments; not permission to submit transactions. |
| Safe Wallet monorepo | `a475eb1e` | GPL-3.0 | **Do not copy** | No copying into our MIT app without a separate owner compliance decision. Reference / UX review only. |
| Safe Transaction Service | `76965891` | Mixed: historical code up to and including 2026-02-16: MIT; new code from 2026-02-17: FSL-1.1-MIT (LICENSE file §§A–B, read first-hand) | Usable as reference | Do not treat this pin as wholly MIT; new-code reuse needs a separate terms review. Historic MIT tag commit `1c6290e3` verified MIT via API — that tag is the usable-with-conditions MIT baseline. |
| Wallet Core | `7a21615f` | Apache-2.0 (LICENSE file) | Usable as reference | Read-only catalogue input, not code to vendor. Separate artifact gates for signing/JNI. |
| Ethereum Lists | `428cd0b7` | MIT | Usable as reference | Read-only catalogue input; do not trust catalogue endpoint URLs. |
| OpenZeppelin Contracts | `d98b8f43` | MIT | Usable with conditions | Standards reference; choose a verified stable package and compatible compiler, not the inspected development HEAD. |

**Tally:** usable with conditions 10 (BitGo, Via ×2, Rabby, RabbyDesktop, Safe Apps SDK, Safe CLI, Safe Core SDK, safe-eth-py, OpenZeppelin); usable as reference 3 (Safe Transaction Service mixed pin, Wallet Core, Ethereum Lists — plus the historic MIT tag `1c6290e3` as the MIT baseline); do not copy 3 (Rabby Mobile, RabbyKit, Rabby Security Engine — no licence file) + 1 GPLv3 (Safe Wallet monorepo) = **4 do-not-copy**.

**Corrections to the guide's own licence notes:** the guide is right that Rabby Mobile's reuse grant is unverified, that RabbyKit is ISC metadata, that the Security Engine licence is unresolved, that Safe Wallet is GPLv3, and that Safe Transaction Service is FSL-1.1-MIT after 2026-02-16 (all confirmed first-hand). Two refinements: (a) Rabby and RabbyDesktop ARE MIT in their LICENSE file text despite the API returning NOASSERTION; (b) RabbyKit and Rabby Security Engine have ISC in `package.json` but no LICENSE file at the pin, so they stay do-not-copy rather than "ISC-licensed".

---

## 4. Smallest verified slice to build first

Build order, not evidence that the features already work. The owner's Create screen is the entry point; the registry + tracker + price feed + logos sit behind it.

1. **Expand the multichain registry.** Use the pinned Wallet Core (`7a21615f`, Apache-2.0) and Ethereum Lists (`428cd0b7`, MIT) catalogues as read-only inputs; do not vendor their code. Keep unsupported chains blocked (never fake success by switching profiles). **Verified:** both input licences; our registry shape (`registry/capabilities.json`, `profiles.json`, `engines.json`, `ui.json`, `schemas/`). **Still unproven:** catalogue mappings and actual new-chain support.
2. **Build the transaction tracker on the existing baseline, then add one chain.** Start with the existing four-chain adapter history (§1 — Blockscout, mempool.space, TronGrid, Toncenter); add exactly one new chain only after that baseline passes its tests. **[Lane correction:** Sol's draft said no tracker behaviour was evidenced; the four-chain history baseline IS verified first-hand — see §1.] **Still unproven:** history correctness under live/partial/429 conditions, and the additional chain's support.
3. **Connect a live price feed.** Show the source and freshness alongside prices. Missing, stale or failed quotes need an explicit state — never a fabricated `$0.00`. **Verified:** the current honest "Unavailable / No price feed" behaviour (§1). **Still unproven:** provider terms, live integration, freshness/error handling.
4. **Add token logos with readable badge fallback.** Build the fallback first; extend logos from Trust Wallet assets only with a pinned asset version. **[Lane correction:** Sol's draft said no Trust Wallet asset licence evidence was supplied; first-hand, `apps/web/src/screens/asset-rows.tsx:10-11` already cites Trust Wallet assets (MIT, Copyright (c) 2019-2023 Trust Wallet) and the 4 chain logos are already in the tree — the chain-logo reuse basis is established. What is still unproven is the per-token logo mapping and a pinned asset version.] **Still unproven:** token-to-logo mapping; do not copy token assets meanwhile.
5. **Make Create a seven-card briefing screen.** Each tool card (Multichain wallet, HD wallet, web wallet, android wallet, smart contract creator, Multi-Sig Wallet v2, Web3 Wallet Kit) describes purpose, inputs/outputs and acceptance criteria, with the §3 SDK references as build briefs. Label cards as build briefs and disable execution until implemented and gated. Keep the wallet dashboard a distinct workspace. **Verified:** the current single-flow Create screen (§1). **Still unproven:** every tool's functionality.
6. **Record gates and evidence for every step.** Require, in order: registry provenance and unsupported-chain blocking checks; four-chain history tests before new-chain tests; price source/terms and fresh/stale/error display checks; pinned asset permission and logo/badge checks; seven brief-only cards and per-tool acceptance tests before enablement. **Verified:** the licence findings in §3 only. **Still unproven:** every functional gate until its results are recorded.

**Open items for the build lanes:** provider terms for the price feed (no provider chosen yet); which chain is the "+1" tracker chain (Solana is the guide's candidate — needs its own adapter evidence); a pinned Trust Wallet assets version for token logos; per-tool acceptance criteria for the 7 Create cards.

---

## Appendix — first-hand verification log

- Branch/HEAD: `panel-rebuild/multichain-a-assessment` at `f8255ff` (`git rev-parse HEAD`, `git log --oneline -3`: `f8255ff Merge Lane D…`, `59f0fba Merge Lane C…`, `0eb35b2 Merge Lane B…`).
- `sed -n 1,20p apps/web/src/engine/boundary.ts` → line 4: `export type ChainId = 'btc' | 'eth' | 'trx' | 'ton';`
- `grep -rn "No price feed|Unavailable" apps/web/src` → `dashboard.tsx:36,41,63,67,89`; `asset-rows.tsx:49`; `dashboard.test.tsx:198`.
- `ls apps/web/src/assets/chains/` → `bitcoin.png ethereum.png ton.png tron.png`.
- `grep -rln "Create" apps/web/src` → `app.tsx`, `create-wallet.tsx`, `send.tsx`, `lock.tsx`, `welcome.tsx`, `create-wallet.test.tsx`.
- Missing-path loop (10 paths) → all `MISSING`; `ls registry/` → `capabilities.json engines.json profiles.json schemas ui.json`; `ls packages/` → `contracts`.
- Root `package.json` scripts → only `check`, `test`. `apps/web/package.json` scripts → `dev build preview typecheck test clean predev prebuild`.
- `git ls-remote --heads origin | grep -i "multichain|self-custod"` → no matches (exit 1); 17 remote branches listed, none matching.
- `grep -rn "2894|2,894|168 Wallet Core|168 profiles" registry/ docs/12-chain-registry-and-assets/` → no hits.
- Licence checks: 17/17 pins return commit HTTP 200; licence API + raw LICENSE reads recorded in §3 (scripts `/tmp/lic-check.py`, `/tmp/lic-check2.py` on gray-pinee; local copies `~/workspace/lic-check.py`, `~/workspace/lic-check2.py`).
- Sol calls (lane `lane/RUN-LOG.jsonl`): call 1 (sections 1–2, 314-word prompt) landed, 3,478 bytes, 115,958 ms; call 2 (sections 3–4, 394-word prompt) landed, 4,986 bytes, 169,970 ms. Both under 500 s. 2 calls, 2 landed, 0 failed. No 402/403.
- No AVOID-list items installed, run or included. No code changed; only this file (plus `lane/RUN-LOG.jsonl`) created. No push.
