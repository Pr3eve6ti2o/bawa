# ai/prompts/create-multichain-extended-wallet.md

Request: Create an extended multichain wallet (derivation/receive only) for SOL, BNB Smart Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Litecoin and Dogecoin.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `registry/profiles.json` entry `multichain-extended-wallet` (run `node scripts/validate-registry.mjs` to re-check).

- Proposed UI contract: 14 screens, referenced by `docs/14`, section 5.1.
- Foundation: `token-ui` (owner-approved).
- Chain and derivation coverage: SOL m/44'/501'/0'; BSC, Polygon, Arbitrum, Optimism, Base, Avalanche m/44'/60'/0'/0/i; LTC m/84'/2'/0'/0/i; DOGE m/44'/3'/0'/0/i.
- Verification required: a Phase 3 profile pass before promising this profile; derivation probe evidence (2026-11-20) for all nine chains; exact procedures and passing evidence: OPEN.

Out of scope: inferring balance/history/price support from derivation, or claiming send/sign/broadcast support.
