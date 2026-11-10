# ai/prompts/create-multichain-wallet.md

Request: Create a BTC/ETH/TRX/TON multichain wallet within the proposed profile.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `registry/profiles.json` entry `multichain-wallet` (validated in Phase 3; run `node scripts/validate-registry.mjs` to re-check).

- Proposed chains: BTC, ETH, TRX and TON.
- Proposed derivation references: BTC `m/84'/0'/0'/0/i`; ETH `m/44'/60'/0'/0/i`; TRX `m/44'/195'/0'/0/i`; TON `m/44'/607'/0'` (generation-only).
- TON scope: generation-only.
- Verification required: Phase 3 validation covering all four derivation references and each chain's permitted scope before promising this profile; exact procedures and passing evidence: OPEN.

Out of scope: TON send, TON xpub, signing/broadcast, and chains outside BTC/ETH/TRX/TON.
