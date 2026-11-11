# ai/prompts/build-wallet.md

Request: Build a wallet, with the profile not yet selected.
Classify the request via `ai/request-routing.md` first.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: the selected `ai/profiles/<id>.md` from the routing guide (validated in Phase 3; run `node scripts/validate-registry.mjs` to re-check).

- Select one listed profile per build; split requests requiring multiple profiles.
- Take scope, chains, derivation and foundation from the selected profile; unspecified facts: OPEN.
- Verification required: the selected profile's Phase 3 pass before promising it; retain all profile-specific verification requirements, including Phase 5 foundation inspection for web/Android; passing evidence: OPEN.

Out of scope: unsupported requests listed in `ai/request-routing.md`, including any unlisted profile.
