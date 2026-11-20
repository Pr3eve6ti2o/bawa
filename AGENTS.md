# AGENTS.md

## 1. Purpose and baseline

Bawa (`Pr3eve6ti2o/bawa`, `panel-rebuild/adopt-proper` line, base commit `e493720`) is the AI Wallet Builder’s wallet-engine and canonical-guide repository: one plain request should produce a real, buildable project. It is not a demonstrated full transaction wallet.

**Honesty state:** As of 2026-11-20, offline signing for BTC/ETH/TRX/TON exists in `apps/web/src/wallet/send.ts`, and unsigned-transaction builders exist in `tools/mainnet-tx/unsigned-tx.mjs`. `broadcastSigned` returns disabled; no send has ever run on any network and no live testnet spend has occurred. A debug APK (`app-debug.apk`, 52,456,212 bytes) was built, installed and launched on an emulator; welcome and import screens were verified visually. The on-device Add-button acceptance path remains **NOT VERIFIED** (taps were swallowed under TCG emulation), and on-device derivation still has no AAR. Recovery rehearsal has never been executed. Existing helpers do not establish end-to-end transaction capability. Never describe documentation as implemented or untested features as working. Never mark mainnet/production readiness **PASS**.

## 2. Read order

1. `AGENTS.md`.
2. `WALLET_BUILDER.md`.
3. `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md`.
4. `README.md`, then only the request-relevant documents below; use `docs/README.md` as the documentation map.

Follow: **parse → plan → profile → engine → chains → template → inspect → scaffold → implement → verify → audit claims → report**.

**Routing precedence:** Follow the mainnet-first direction (ADR-0003): mainnet is the **PRIMARY** target; testnet is secondary/testing. Do not delete testnet code or restrictions.

## 3. THE ROUTING TABLE

Resolve validated profiles and supported capability/engine/UI choices through `registry/profiles.json`, `registry/capabilities.json`, `registry/engines.json`, `registry/ui.json` and `registry/schemas/`. For profile requests, read `ai/profiles/<profile>.md` and the matching `ai/prompts/create-*.md`. Check expected outcomes against `docs/sample-requests.md`.

**Shared builder:** `node scripts/build-wallet.mjs "<request>"` classifies, generates into `generated/<profile-id>`, verifies and writes a JSON report. Alternatively, use `node scripts/generate-project.mjs <profile-id>` for explicit-profile generation.

Inspect executable code, dependencies and interfaces before use; do not infer arguments from filenames. Run watch-only derivation tools from `tools/hdwallet-gen`, using public roots only.

For Web/Android UI selection, consult `docs/UI-TEMPLATE-REGISTRY.yaml` and `docs/UI-UX-CATALOGUE.md`. 
| Request | Profile | Read first (exact doc paths) | Existing scripts/tools | Status/limits |
| --- | --- | --- | --- | --- |
| Create an HD wallet | `hd-wallet-cli` | `ai/prompts/create-hd-wallet.md`; `docs/01-fundamentals/README.md`; `docs/SECURITY.md` | Shared builder; `python3 tools/make_wallet.py`; `python3 tools/decrypt_seed.py` | Validated profile. Interactive generator uses Trust Wallet Core 4.9.3 WASM; this is not evidence of transaction functionality. |
| Create a professional Android HD wallet | `android-wallet` | `ai/prompts/create-android-wallet.md`; `docs/android-wallet/ANDROID-GUIDE.md`; `templates/android/UPSTREAM.md` | Shared builder; `apps/android` | UI starter with 57 `@Test` annotations across 5 Kotlin test files (annotation count re-counted on 2026-11-20, not a pass count). Executed passing count not re-established here: no Android SDK on this machine, so Gradle tests **NOT-RUN**. Debug APK built and emulator launch verified; on-device Add-button acceptance **NOT VERIFIED**. “professional” is a target, not a readiness claim. |
| Create a Bitcoin watch-only wallet | `watch-only-wallet` | `ai/prompts/create-watch-only-wallet.md`; `docs/01-fundamentals/README.md`; `docs/TESTING.md` | Shared builder; `tools/hdwallet-gen/derive.js`; `tools/hdwallet-gen/derive-daemon.js`; `tools/hdwallet-gen/compare.js` | Validated profile, scoped to BTC for this request. Public roots only; no secret inputs or signing. |
| Create a Bitcoin wallet | `bitcoin-wallet` | `ai/prompts/create-bitcoin-wallet.md`; `docs/01-fundamentals/README.md`; `docs/SECURITY.md` | Shared builder | Validated profile; BTC scaffolding does not establish spending or broadcast capability. |
| Create a Web wallet | `web-wallet` | `ai/prompts/create-web-wallet.md`; `docs/web-wallet/WEB-GUIDE.md`; `templates/web/UPSTREAM.md` | Shared builder; `apps/web` | Starter with in-browser wallet generation/recovery (`create-wallet` and `mnemonic-backup` screens), offline signing for BTC/ETH/TRX/TON (broadcast disabled), and read-only balances/history via `apps/web/src/wallet/adapters/`. Vitest on 2026-11-20: 51 test files, 669 passed + 1 skipped, exit 0. A price feed exists (CoinGecko, see ADR-0007, docs/adr/0007-price-feed-provider.md, and apps/web/src/wallet/prices.ts). There is no fee estimator — price is not a fee estimate. Not a demonstrated full transaction wallet, and no send has ever run on any network. |
| Create a multi-chain (BTC/ETH/TRX/TON) wallet | `multichain-wallet` | `ai/prompts/create-multichain-wallet.md`; `docs/01-fundamentals/README.md`; `docs/TESTING.md` | Shared builder | Validated profile; scaffolding does not prove end-to-end operation on all four chains. |
| Create an EVM wallet | `evm-wallet` | `ai/prompts/create-evm-wallet.md`; `docs/01-fundamentals/README.md`; `docs/SECURITY.md` | Shared builder | Validated profile; EVM scaffolding is not verified transaction functionality. |
| Create a payment tracker | None — AI-guided implementation | `docs/06-tracking/README.md`; `docs/07-payment-tracking/README.md`; `docs/08-security-recovery/README.md`; `docs/RECOVERY.md` | No implemented tracker product; read-only transaction history display exists in `apps/web` via adapters | **DOCUMENTED_NOT_TESTED**. Implement from the guides; do not present documentation or a wallet scaffold as a working tracker. |
| Create a wallet recovery utility | None — AI-guided implementation | `docs/06-tracking/README.md`; `docs/07-payment-tracking/README.md`; `docs/08-security-recovery/README.md`; `docs/RECOVERY.md`; `docs/SECURITY.md` | `python3 tools/decrypt_seed.py` — decryption check only; default `secrets/seed.enc.json`. In-browser recovery also exists in `apps/web` (import/mnemonic-backup screens). | **DOCUMENTED_NOT_TESTED** for the recovery utility. No recovery tool beyond the decryption check; recovery rehearsal **NOT-RUN**. |
| Verify derivation / run the differential test | Selected profile | `docs/TESTING.md`; `docs/mainnet/MAINNET-VECTORS.md` | `python3 test/differential_test.py`; `tools/hdwallet-gen/compare.js` | Independent differential coverage is BTC/ETH index 0 only, not other indices or TRX/TON. Report actual execution results. |
| Mainnet fee check / unsigned transaction / local signing | Helper request; no separate validated profile | `docs/SECURITY-RELEASE-GATES.md`; `docs/mainnet/MAINNET-GUIDE.md`; `docs/mainnet/MAINNET-GUARDS.md`; `docs/mainnet/MAINNET-UNSIGNED-TX.md`; `docs/mainnet/MAINNET-SIGNING.md`; `docs/mainnet/MAINNET-VECTORS.md`; `docs/mainnet/M35-REHEARSAL-PROCEDURE.md` | `tools/mainnet-fees/fees.mjs`; `tools/mainnet-guards/mainnet-guards.mjs`; `tools/mainnet-tx/unsigned-tx.mjs`; `tools/mainnet-signing/local-signing.mjs` | Helpers exist; inspect before use. Signing is local-only and never broadcasts. Verification must not sign or broadcast; real-funds gates and required approvals still apply. |
Profiles: 8
Chains: 13 (btc, eth, trx, ton, sol, bsc, matic, arb, op, base, avax, ltc, doge) — see registry/capabilities.json

ADR reference: ADR-0007 (docs/adr/0007-price-feed-provider.md)
ADR reference: ADR-0008 (docs/adr/0008-ecdsa-residual-risk.md)


## 4. Fixed policy and hard constraints

Vault locking and key storage are governed by the following fixed policy.

The vault stays unlocked by default. Auto-lock is an optional setting on the /security page: a toggle plus a duration — Immediately / 1 minute / 5 minutes / 15 minutes / 1 hour / 1 day. When enabled, the vault locks after the chosen period and unlocking needs the password. Key-storage invariant: while auto-lock is on, the raw derived key is NOT stored (the lock must be real); while auto-lock is off, the raw derived key IS stored under `bawa-vault-key` so the vault can auto-unlock.

Current implementation at 5e7eb1d: no lock exists; the optional restoration is not yet implemented.

Never silently change these settings or boundaries:

- **Derivation:** BTC `m/84'/0'/0'/0/i`; ETH `m/44'/60'/0'/0/i`; TRX `m/44'/195'/0'/0/i`; TON `m/44'/607'/0'`.
- **Seed and vault:** BIP-39, 24 words, empty passphrase; AAD `nova-shop-seed-v1`. Permissions: `secrets/` **0700**, `seed.enc.json` **0600**, `.env` **0600**.
- **Adapter boundary:** Chain adapters NEVER receive mnemonics, seeds, private keys, xprvs or vault keys, including in tests.
- **UI boundary:** UI is presentation only — never derivation, storage or signing policy.
- **Test keys:** fresh, real, functional test seed phrases / private keys MAY be generated for testing only (user-approved 2026-11-10). They are test-only: never production or existing keys, never funded with real mainnet funds. Placeholders are not required.
- **Secrets:** Never use real user mnemonics or private keys as test fixtures. Redact secrets everywhere, including prompts, logs and reports.
- **Network direction:** Mainnet is the **PRIMARY** target; testnet is secondary/testing. Do not delete testnet code or restrictions. Mainnet work remains subject to real-funds gates and separate approval wherever required.
- **Transaction safety:** Never sign or broadcast during verification on any network. Any future transaction functionality requires a documented preflight/dry-run, with broadcast disabled by default.

## 5. Evidence vocabulary

- **IMPLEMENTED_AND_VERIFIED** — Implemented behaviour supported by scoped, performed verification.
- **STARTER_IMPLEMENTED_AND_VERIFIED** — Verified starter behaviour only; not a complete transaction wallet.
- **DOCUMENTED_NOT_TESTED** — Documented design or procedure without execution evidence.
- **PROPOSED** — Suggested work or a plan, not implementation.
- **OPEN** — Unresolved decision, issue or gate.
- **EXTERNALLY_DEPENDENT** — Progress requires an external prerequisite.
- **UNVERIFIED** — Code or a claim without sufficient verification evidence.

## 6. Unsupported requests and reporting rules

If no validated profile or available capability covers the request, state the gap, ask only necessary clarifications and propose AI-guided implementation through the relevant guides. Do not invent profile IDs, tools, interfaces or evidence, or silently substitute a starter for the requested feature.

Every report must include:

- Selected profile and actual scope.
- Changed files and observed generated output/report locations.
- What works, what is mocked, what failed or was not run.
- Unresolved items, external dependencies and the next gate.
- An evidence table:

| Item / scope | Evidence label | Check | Evidence or reason not run | Mocks / limits | Next gate |
| --- | --- | --- | --- | --- | --- |
| … | … | PASS / FAIL / NOT-RUN | … | … | … |

Use **PASS** only for a performed check with supporting evidence, **FAIL** for a performed check that failed, and **NOT-RUN** for anything not performed, including blocked checks. **NOT-RUN is never a pass.** Test counts and file presence are not proof that tests passed. Audit every capability claim against its evidence and scope before reporting.
