# web-wallet

- Platform: web
- Status: STARTER_IMPLEMENTED_AND_VERIFIED — Starter implemented and verified within its documented scope; not a complete wallet.
- Chains: btc (m/84'/0'/0'/0/i), eth (m/44'/60'/0'/0/i), trx (m/44'/195'/0'/0/i), ton (m/44'/607'/0' generation-only)
- Engine: trust-wallet-core 4.8.4 — IMPLEMENTED_AND_VERIFIED
- UI: token-ui / web-01-token-ui — IMPLEMENTED_AND_VERIFIED
- Verification: IMPLEMENTED_AND_VERIFIED

<!-- Derived from registry/profiles.json. Do not edit by hand; re-generate after any registry change. -->

## Implemented

- watch-only address derivation in the browser for BTC/ETH/TRX via wallet-core WASM with pre-WASM validation (Base58Check, checksum, private rejection, per-chain versions, R-01 point validation)
- 14 screens with honest loading/empty/stale/locked/gate-failed/error states
- receive-QR display
- import of extended public keys only

## Missing

- send
- sign
- broadcast
- balances
- prices
- transaction history
- live-browser run (preview HTTP checks + unit tests only)
- on-device derivation (web has no on-device concept — derivation is in-browser WASM)

## Security boundaries

- mnemonics, seeds, private keys, private extended keys, vault keys and wallet handles stay inside the trusted key/vault boundary
- chain adapters never receive secrets or secret-bearing objects
- UI never holds secrets and never owns transaction authority or signing policy

## Security notes

- The web boundary (apps/web/src/engine/boundary.ts) derives all 6 published fixture addresses exactly (BTC/ETH/TRX indices 0 and 1) via wallet-core 4.8.4 WASM; 25 web tests pass; vite build exits 0; preview serves index + wallet-core.wasm with HTTP 200. 4.9.2 is the guides' reference engine only, never the tool pin. CLI derivation evidence alone does not verify this integration — the boundary tests do.
- WEB-01 pre-approves token-ui, registry foundation web-01-token-ui, as the web UI foundation. Phase 5 inspection is complete (2026-11-10). token-ui (pin 6380d5d4, MIT) is vendored into apps/web/src/ui/; the 14-screen contract from docs/14 section 5.1 is implemented; app tests render title, empty dashboard, import and send-not-implemented states.
- The default visual direction is Bawa Balanced (STYLE-04). The 14-screen contract in docs/14-wallet-app-implementation section 5.1 is the single source of truth for screens.
- Planned generation uses BIP-39 with 24 words and an empty passphrase. Fixed derivation policy: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i. Account 0 and receiving branch 0 are fixed. Watch-only derivation is restricted to BTC, ETH and TRX; the web boundary verifies it in-browser via the boundary tests.
- TON is generation-only at m/44'/607'/0': a single address, wallet V4 R2, wallet ID 698983191. TON has no xpub and no watch-only route.
- Send, sign and broadcast are DOCUMENTED_NOT_TESTED. No transaction-construction, signing or broadcast code exists in the repository.
- Testnet is the default; mainnet is out of scope by default.
- M-38 confirmation policies are not enforced in code: BTC 6 confirmations as a customary recommendation; ETH finalised, retaining "12" only as an unsourced extra minimum, never as a substitute for finality; TRX 19 distinct SRs of 27 via /walletsolidity/*; TON 1 masterchain seqno after inclusion plus an outgoing-message outcome check.

## Verification requirements

- derivation reproduces the published fixtures
- no secret reaches adapters, UI state, logs or telemetry
- starter builds from a clean checkout
- 14-screen contract coverage checked against docs/14 section 5.1
- the token-ui foundation completes Phase 5 inspection before adoption and retains UI-only responsibilities (met: Phase 5 inspection done 2026-11-10; foundation adopted in Phase 6)
- Trust Wallet Core 4.8.4 integration is verified for the web profile without exposing secrets or signing authority to the UI
- the fixed derivation policy is preserved, including BTC/ETH/TRX-only watch-only derivation and TON single-address generation-only
- any future transaction construction, send, sign, broadcast or confirmation-policy enforcement has separate implementation and verification evidence on testnet

## Sources

- tools/hdwallet-gen
- docs/11-trust-wallet-and-independent-verification
- docs/14-wallet-app-implementation
- docs/mainnet/MAINNET-GUIDE.md
- web-01-token-ui
- WEB-01
- STYLE-04
- M-38
