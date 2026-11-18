# AGENTS.md

## Purpose and baseline

Bawa (`Pr3eve6ti2o/bawa`, `main` branch) is a practical open-source reference for HD-wallet generation, watch-only derivation, recovery, tracking and reconciliation — not a hosted wallet, custody service or exchange. The owner's direction is **mainnet-first**, but that direction is not yet delivered: the current documented workflow is **testnet-only**. Mainnet work is gated behind a separate reviewed change, and real-funds gates remain mandatory; no mainnet execution without separate explicit approval.

Verified snapshot (2026-11-14): main at `16c074e`. The engine is Trust Wallet Core **4.9.3** WASM (re-pinned from 4.8.4 on owner order, 2026-11-18; qualification run passed). The tools suite (`npm --prefix tools/hdwallet-gen test`) records 130 checks, 0 fail. This is supplied baseline evidence, not a new test run or evidence for untested capabilities.

There is NO signing, broadcast or transaction-construction code on this branch, and send/sign/broadcast has never been exercised on any network. **Do not mark mainnet/production readiness as PASS.** The full AI Wallet Builder — profiles, registry, starters, mainnet tools, TON watch-only derivation — lives on the `feature/ai-wallet-builder` branch, not here.

## Read order

1. `AGENTS.md` — these repository-wide instructions.
2. `README.md` — the short entry point; the preserved full README is `docs/README-FULL.md`.
3. `docs/01-fundamentals/README.md` through `docs/16-security-decision-guide/README.md` — the canonical guides.
4. Specialist guides: Doc 2 `docs/web-wallet/WEB-GUIDE.md`, Doc 3 `docs/android-wallet/ANDROID-GUIDE.md`, Doc 4 `docs/mainnet/MAINNET-GUIDE.md`.
5. `docs/SECURITY.md`, `docs/RECOVERY.md`, `docs/TESTING.md`, `docs/GLOSSARY.md`, `docs/FAQ.md`.

Note: "Docs 1–3" means the testnet guide set in `docs/mainnet/MAINNET-GUIDE.md`, but the three specialist guides (Web, Android, mainnet) in the Android register.

Do not invent filenames for numbered guides or treat documentation as execution evidence. Inspect executable code, dependencies and interfaces before use; do not infer arguments from filenames.

## Routing table

| Plain-language request | Route on this branch |
|---|---|
| Create an HD wallet | `python3 tools/bawa_cli.py` (menu 1), or `python3 tools/make_wallet.py` |
| Derive a watch-only address from an xpub | `python3 tools/bawa_cli.py` (menu 2), or `echo "<xpub>" \| node tools/hdwallet-gen/derive.js <chain> <index>` |
| Build a cryptocurrency wallet application | AI-guided implementation — read `docs/13-wallet-app-architecture/README.md` and `docs/14-wallet-app-implementation/README.md`; no one-prompt builder exists on this branch |
| Build cryptocurrency tools / track payments | AI-guided implementation — read `docs/06-tracking/README.md` and `docs/07-payment-tracking/README.md`; no tracker executable exists on this branch |
| Decrypt / recover a seed bundle | `python3 tools/bawa_cli.py` (menu 5), or `python3 tools/decrypt_seed.py` |
| Security, verification and safety tests | `python3 tools/bawa_cli.py` (menu 5), or `npm --prefix tools/hdwallet-gen test` and `python3 test/differential_test.py` |
| TON watch-only derivation | **Not available on this branch** — no TON derivation mode is provided; see `docs/05-watch-only/README.md` |
| Mainnet fee quote / signing / broadcast | **Not available on this branch** — procedure only; see `docs/mainnet/MAINNET-GUIDE.md` |

`python3 tools/bawa_cli.py` is the one-command entry point. It never executes a shell string and never echoes secret material. Some of its options point to tools and docs that exist only on the feature branch; on this branch those options report "unavailable in this checkout" instead of running. That is the correct behaviour — do not work around it.

## Fixed policy and hard constraints

- **Engine:** Trust Wallet Core 4.9.3 WASM. Do not silently re-pin or change the engine version.
- **Derivation:** BTC `m/84'/0'/0'/0/i` (BIP-84, zpub), ETH `m/44'/60'/0'/0/i`, TRX `m/44'/195'/0'/0/i`, TON `m/44'/607'/0'` generation-only, single deposit address, no xpub. Account 0, receiving branch 0 only. BIP-39 256-bit, 24 words, **empty passphrase**. Do not change paths, the passphrase policy, or the AAD `nova-shop-seed-v1`.
- **Permissions:** `secrets/` 0700, `seed.enc.json` 0600, `.env` 0600.
- **Networks:** testnet-only workflow; the owner's mainnet-first direction is not yet delivered. Mainnet work is gated behind a separate reviewed change; real-funds gates remain mandatory; no mainnet execution without separate explicit approval.
- **Test keys:** fresh, real, functional test seed phrases / private keys MAY be generated for testing only (user-approved 2026-11-10). They are test-only: never production or existing keys, never funded with real mainnet funds. Placeholders are not required.
- **Secrets:** never use real user mnemonics or private keys as test fixtures. Never log, print or store a wallet secret. Redact secrets everywhere, including prompts, logs and reports.
- **Chain adapters and UI:** chain adapters own endpoints, fees, broadcast and confirmation; they NEVER receive mnemonics, seeds, private keys, private extended keys, vault keys or secret-bearing objects, including during tests. UI is presentation only — never derivation, storage or signing policy.
- **Honesty:** do not invent capabilities, files, paths, versions, interfaces, commands or results. Missing facts are OPEN.

## Evidence vocabulary

- **Verified:** reproduced by a command run first-hand, with the command and its output recorded.
- **Implemented:** code exists in this checkout and has been run.
- **Documented-untested:** described in a guide, not run.
- **Not tested:** no evidence either way.
- **Blocked:** a named dependency or gate prevents the check.

## Unsupported requests and reporting rules

- Unsupported requests are **AI-guided implementation** or **unavailable**, never silently treated as working. Say which, and name the doc or gate that decides it.
- Report results as an evidence table (claim, verdict, evidence, date). Record the exact command and its actual output. Never claim an unexecuted test passed. Never describe documentation as implemented.
- When a check contradicts a claim, trust the check and record the contradiction.

## Changelog note

The previous README (1,275 lines) is preserved verbatim at `docs/README-FULL.md`. This `AGENTS.md` replaces the earlier feature-branch version for this branch; the feature-branch AGENTS.md (routing table, profiles, registry) remains on `feature/ai-wallet-builder`.
