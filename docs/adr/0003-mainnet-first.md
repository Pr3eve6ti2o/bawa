# ADR-0003 — Mainnet-first direction

## Context

On 2026-11-14, the owner ordered a mainnet-first direction. The repository is primarily built for mainnet, not testnet; testnet code remains secondary and for testing.

`docs/MAINNET-GAP-ASSESSMENT.md` marks all four chains NOT ready. No broadcast exists; all send, broadcast, token, and contract functions throw. The owner declined M-35 funding on 2026-11-13, so no live-send verification exists. TON is receive-only under the owner's scope.

## Decision

The README, capability map, and gap assessment will frame mainnet as primary and testnet as testing-only. Keep testnet code as secondary support. Nothing may claim mainnet readiness the repository does not have.

## Status

accepted

## Consequences

- The gap assessment is the honest readiness record.
- The repository stays testnet-safe in behaviour while mainnet-first in direction.
- Mainnet sending remains unavailable; changing the framing does not close the implementation or verification gaps.
- Any mainnet claim needs executed evidence.
