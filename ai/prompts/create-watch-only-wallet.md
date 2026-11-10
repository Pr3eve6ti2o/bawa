# ai/prompts/create-watch-only-wallet.md

Request: Create a watch-only wallet deriving from extended public keys only.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `registry/profiles.json` entry `watch-only-wallet` (validated in Phase 3; run `node scripts/validate-registry.mjs` to re-check).

- Proposed derivation input: extended public keys only.
- Chain and derivation-path coverage: OPEN.
- Verification required: Phase 3 validation of extended-public-key-only derivation with no secrets and no signing before promising this profile; exact procedures and passing evidence: OPEN.

Out of scope: secret-based operations, signing and broadcast.
