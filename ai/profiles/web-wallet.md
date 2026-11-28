# web-wallet

- Platform: web
- Status: STARTER_IMPLEMENTED_AND_VERIFIED — Starter implemented and verified within its documented scope; not a complete wallet.
- Chains: btc (m/84'/0'/0'/0/i), eth (m/44'/60'/0'/0/i), trx (m/44'/195'/0'/0/i), ton (m/44'/607'/0' generation-only)
- Engine: trust-wallet-core 4.9.3 — IMPLEMENTED_AND_VERIFIED
- UI: token-ui / web-01-token-ui — IMPLEMENTED_AND_VERIFIED
- Verification: IMPLEMENTED_AND_VERIFIED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- in-browser HD wallet creation (BIP-39 24 words, empty passphrase) with password-protected encrypted local vault (AES-256-GCM, PBKDF2 600k) and recovery confirmation reproducing identical addresses
- watch-only address derivation in the browser for BTC/ETH/TRX via wallet-core WASM with pre-WASM validation (Base58Check, checksum, private rejection, per-chain versions, R-01 point validation)
- 19 screens with honest loading/empty/stale/locked/gate-failed/error states (the 14-screen contract in docs/14 §5.1 plus swap, backup-shares, address-book, track-transaction and lock; routes counted in src/app/app.tsx at HEAD ceade79)
- receive-QR display
- import of extended public keys only
- read-only mainnet balances and transaction history via per-chain adapters (87 chains, 169 RPCs; 4 chains history-blocked — bsc, opbnb, metis, fantom — balance-only; Gnosis fixed 2026-11-28 via gnosisscan.io keyless)
- offline send: transaction construction (plan-transfer) and local signing via wallet-core AnySigner for BTC/ETH/TRX/TON, with post-sign verification for BTC/ETH/TRX
- live prices for the 21 default tokens via the CoinGecko feed with DexScreener/TonAPI fallback
- optional auto-lock (OFF by default; toggle + duration on /security; vault locks after the chosen period, unlocking needs the password, raw derived key not stored while on)

## Missing

- broadcast
- TON fee-quote (send preview reports unavailable; signing still works with a seqno)
- TON post-sign verification (partial only: no-error + 32-byte hash + BOC magic, no BOC re-parse)
- fee estimator (price feed exists; no per-chain fee estimator)
- swap execution (quotes live on /swap; execution approved, not implemented; broadcast disabled)
- live-browser balance/history run on a normal network (adapters verified in Node; history loading diagnosed as sandbox-network, unproven outside it)
- on-device derivation (web has no on-device concept — derivation is in-browser WASM)

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- The web boundary (apps/web/src/engine/boundary.ts) derives all 6 published fixture addresses exactly (BTC/ETH/TRX indices 0 and 1) via wallet-core 4.9.3 WASM; 129 test files: 3,437 tests passed and 5 skipped (gates at token-gaps `1a85258`, 2026-11-28, three findings; the 3,429-passed figure was the gates at `1253bf6`); vite build exits 0; live site serves index-B9gxTjOm.js, root 200, asset 200. 4.9.3 is the repository pin and the guides' reference engine. CLI derivation evidence alone does not verify this integration — the boundary tests do.
- WEB-01 pre-approves token-ui, registry foundation web-01-token-ui, as the web UI foundation. Phase 5 inspection is complete (2026-11-10). token-ui (pin 6380d5d4, MIT) is vendored into apps/web/src/ui/; the 14-screen contract from docs/14 section 5.1 is implemented and the app now has 19 screens; send is implemented as offline signing (broadcast disabled).
- The visual direction is style B (polished financial: flat, hairline, tabular, real semantic colour), owner-picked 2026-11-27, superseding Bawa Balanced (STYLE-04) and its 4-colour cap (docs/DECISIONS.md §34); only the QR share-card templates and the Welcome illustration keep the paper/comic touch. The 14-screen contract in docs/14-wallet-app-implementation section 5.1 is the single source of truth for screens.
- Planned generation uses BIP-39 with 24 words and an empty passphrase. Fixed derivation policy: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i. Account 0 and receiving branch 0 are fixed. Watch-only derivation is restricted to BTC, ETH and TRX; the web boundary verifies it in-browser via the boundary tests.
- TON is a single address at m/44'/607'/0', wallet V4 R2, wallet ID 698983191. TON has no xpub; watch-only is by public address, and the web wallet has TON balance/history adapters and offline signing for it.
- The end-to-end send/sign/broadcast/confirm flow remains DOCUMENTED_NOT_TESTED; transaction construction (plan-transfer) and local signing exist in apps/web, but broadcast is not implemented anywhere in the repository.
- Mainnet is the default (ADR-0003); testnet is for demonstration/testing only.
- M-38 confirmation policies are implemented as an evaluator module (apps/web/src/engine/confirmation-policy.ts: BTC 6 confirmations as a customary recommendation; ETH finalised, retaining "12" only as an unsourced extra minimum, never as a substitute for finality; TRX 19 distinct SRs of 27 via /walletsolidity/*; TON 1 masterchain seqno after inclusion plus an outgoing-message outcome check) but are not yet wired into a live send/receive flow.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- starter builds from a clean checkout
- 14-screen contract coverage checked against docs/14 section 5.1
- the token-ui foundation completes Phase 5 inspection before adoption and retains UI-only responsibilities (met: Phase 5 inspection done 2026-11-10; foundation adopted in Phase 6)
- Trust Wallet Core 4.9.3 integration is verified for the web profile without exposing secrets or signing authority to the UI
- the fixed derivation policy is preserved, including BTC/ETH/TRX-only watch-only derivation and TON single-address generation-only
- broadcast and confirmation-policy wiring have separate implementation and verification evidence on testnet (transaction construction, send and signing are implemented in apps/web; broadcast is not)

## Sources

- tools/hdwallet-gen
- docs/11-trust-wallet-and-independent-verification
- docs/14-wallet-app-implementation
- docs/mainnet/MAINNET-GUIDE.md
- web-01-token-ui
- WEB-01
- STYLE-04
- M-38
