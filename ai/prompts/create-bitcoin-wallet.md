# ai/prompts/create-bitcoin-wallet.md

Request: Create a Bitcoin derivation and watch-only wallet.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `ai/profiles/bitcoin-wallet.md` (planned for Phase 3; profile pending validation).

- Proposed chain and derivation reference: BTC — `m/84'/0'/0'/0/i`.
- Proposed scope: watch-only with a 6-confirmation policy.
- Verification required: Phase 3 validation covering the derivation reference, watch-only scope and 6-confirmation policy before promising this profile; exact procedures and passing evidence: OPEN.

Out of scope: non-BTC profile scope and signing/broadcast in the current repo.
