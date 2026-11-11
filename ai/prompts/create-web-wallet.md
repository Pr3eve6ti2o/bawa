# ai/prompts/create-web-wallet.md

Request: Create a web wallet UI following the 14-screen contract.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `registry/profiles.json` entry `web-wallet` (validated in Phase 3; run `node scripts/validate-registry.mjs` to re-check).

- Proposed UI contract: 14 screens, referenced by `docs/14`, section 5.1.
- Foundation: `token-ui` (owner-approved).
- Chain and derivation coverage: OPEN.
- Verification required: a Phase 3 profile pass before promising this profile; 14-screen contract verification and Phase 5 foundation confirmation by inspection; exact procedures and passing evidence: OPEN.

Out of scope: inferring engine capabilities from the UI foundation or claiming signing/broadcast support.
