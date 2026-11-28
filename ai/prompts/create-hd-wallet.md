# ai/prompts/create-hd-wallet.md

Request: Create a CLI HD wallet for generation, derivation, watch-only and recovery.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `registry/profiles.json` entry `hd-wallet-cli` (validated in Phase 3; run `node scripts/validate-registry.mjs` to re-check).

- Proposed CLI functions: HD generation, derivation and recovery.
- Proposed watch-only coverage: BTC, ETH and TRX (extended public keys) plus TON (32-byte Ed25519 public key, single V4 R2 address, via tools/hdwallet-gen/derive-ton.js).
- Verification required: Phase 3 validation of these functions and chain coverage before promising this profile; exact verification procedures and passing evidence: OPEN.

Out of scope: signing/broadcast in the current repo and unsupported requests listed in `ai/request-routing.md`.
