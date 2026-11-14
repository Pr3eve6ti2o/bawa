# ADR-0001 — wallet-core 4.9.3 pin

## Context

The Node tools use `@trustwallet/wallet-core`. Between 2026-11-12 and 2026-11-13, the pin moved from `4.8.4` to `4.9.1` to `4.9.3`.

The `4.9.3` WASM is 10,422,325 bytes, with SHA-256 `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217`. CVE-2023-31290 was verified absent on `4.9.3`.

The review verdict on `4.9.3` was HOLD: a Solana-only delta with zero regressions. The owner nevertheless ordered the upgrade on 2026-11-13.

## Decision

Pin `@trustwallet/wallet-core` to exactly `4.9.3`. Never use a version range. Verify the WASM SHA-256 on every upgrade.

## Status

accepted

## Consequences

- The exact pin supports reproducible builds; the recorded WASM hash makes the engine verifiable.
- Every upgrade adds qualification work: hash verification plus the full test suite.
- Dependabot ignores major bumps pending qualification.
