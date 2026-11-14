# Architecture Decision Records

Decisions that shape the repository, recorded so a later reader knows what was decided, why, and what it costs. Each record has Context, Decision, Status and Consequences. A new decision gets the next number; a superseded record is kept and marked superseded, never deleted.

| ADR | Decision |
| --- | --- |
| [0001](0001-wallet-core-pin.md) | Pin `@trustwallet/wallet-core` to exactly 4.9.3; verify the WASM SHA-256 on every upgrade. |
| [0002](0002-ai-wallet-builder.md) | Bawa is an AI Wallet Builder: the repo is the builder's source of truth. |
| [0003](0003-mainnet-first.md) | Mainnet-first direction; testnet code stays secondary and for testing. |
| [0004](0004-monorepo-by-deployable.md) | One repository organised by deployable; `packages/` only with a second consumer. |
