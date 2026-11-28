# multichain-extended-wallet

- Platform: web
- Status: DOCUMENTED_NOT_TESTED — Derivation and receive verified by the 2026-11-20 Wallet Core probe; the profile as a whole has no separate build verification.
- Chains: sol (m/44'/501'/0' generation-only), bsc (m/44'/60'/0'/0/i), matic (m/44'/60'/0'/0/i), arb (m/44'/60'/0'/0/i), op (m/44'/60'/0'/0/i), base (m/44'/60'/0'/0/i), avax (m/44'/60'/0'/0/i), ltc (m/84'/2'/0'/0/i), doge (m/44'/3'/0'/0/i)
- Engine: trust-wallet-core 4.9.3 — IMPLEMENTED_AND_VERIFIED
- UI: token-ui / web-01-token-ui — DOCUMENTED_NOT_TESTED
- Verification: DOCUMENTED_NOT_TESTED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- in-browser HD wallet creation (BIP-39 24 words, empty passphrase) with password-protected encrypted local vault (AES-256-GCM, PBKDF2 600k) and recovery confirmation reproducing identical addresses for the nine extended chains
- derivation and receive-address display for SOL, BNB Smart Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Litecoin and Dogecoin via wallet-core 4.9.3 WASM (verified by the 2026-11-20 derivation probe)
- live balances for all nine chains and live transaction history for eight (all but BNB Smart Chain) via per-chain adapters (registry/capabilities.json v4, 2026-11-26)
- live prices for the 21 default tokens via the CoinGecko feed with DexScreener/TonAPI fallback (registry/tokens.json: all 21 with a CoinGecko ID and a price fallback)

## Missing

- history for BNB Smart Chain (balance-only)
- fee-quote
- plan-transfer
- local-sign
- verify-signature
- broadcast

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- Extended chains are derivation/receive plus balance/history: SOL, BNB Smart Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Litecoin and Dogecoin derive and receive through wallet-core 4.9.3 WASM (verified by the 2026-11-20 derivation probe on the BIP-39 test-vector mnemonic); balance adapters exist for all nine and history adapters for eight (not BNB Smart Chain); no fee-quote, no send builder and no broadcast for any of them.
- SOL has no xpub and no watch-only route: one address per wallet at m/44'/501'/0', like TON at m/44'/607'/0'.
- Mainnet only: testnet addresses are rejected as wrong-network and no testnet adapter exists.

## Verification requirements

- derivation reproduces the Wallet Core 4.9.3 probe fixtures for all nine chains
- no secret reaches adapters, UI state, logs or telemetry
- unsupported operations stay blocked and are never faked

## Sources

- apps/web/src/wallet/chains.ts
- apps/web/src/wallet/core.ts
- docs/archive/lane-evidence-2026-11-20/evidence/probe-2026-11-20.jsonl
