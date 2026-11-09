# ai/prompts/create-evm-wallet.md

Request: Create an ETH-focused wallet under the proposed EVM profile.
Read: `AGENTS.md`.
Read: `WALLET_BUILDER.md`.
Profile: `ai/profiles/evm-wallet.md` (planned for Phase 3; profile pending validation).

- Proposed chain and derivation reference: ETH — `m/44'/60'/0'/0/i`.
- Proposed chain-state policy: finalized.
- Capability boundary: ETH derivation does not establish generic EVM operation.
- Verification required: Phase 3 validation covering ETH derivation and the finalized policy before promising this profile; exact procedures, passing evidence and generic EVM-operation evidence: OPEN.

Out of scope: generic EVM-operation claims inferred from ETH derivation alone, and signing/broadcast in the current repo.
