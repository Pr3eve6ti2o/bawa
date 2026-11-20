# Architecture Decision Records

Decisions that shape the repository, recorded so a later reader knows what was decided, why, and what it costs. Each record has Context, Decision, Status and Consequences. A new decision gets the next number; a superseded record is kept and marked superseded, never deleted.

| ADR | Decision |
| --- | --- |
| [0001](0001-wallet-core-pin.md) | Pin `@trustwallet/wallet-core` to exactly 4.9.3; verify the WASM SHA-256 on every upgrade. |
| [0002](0002-ai-wallet-builder.md) | Bawa is an AI Wallet Builder: the repo is the builder's source of truth. |
| [0003](0003-mainnet-first.md) | Mainnet-first direction; testnet code stays secondary and for testing. |
| [0004](0004-monorepo-by-deployable.md) | One repository organised by deployable; `packages/` only with a second consumer. |
| [0005](0005-adopted-libraries.md) | Adopt six scoped, pinned libraries for mnemonic checks/data and fee/fiat/display math; keep wallet-core as the only engine. |
| [0006](0006-use-case-split.md) | Split the guide into 10 numbered use-case sections (docs/01–docs/10). |
| [0007](0007-price-feed-provider.md) | CoinGecko as the default (and only) live price provider for the native assets; missing/stale/failed prices shown as unavailable, never as $0.00. |
| [0008](0008-ecdsa-residual-risk.md) | Accept the `ecdsa` 0.19.2 residual risk (PYSEC-2026-1325 / CVE-2024-23342, no fix version); do not replace or remove it; guard test fails the gate if the safety facts change; re-review by 2027-05-20. |
| [0009](0009-guide-scope-extension.md) | Guide scope extension beyond ten sections: docs/01–16 plus the Web, Android and mainnet guides and the implementation plan; supersedes ADR-0006's ten-section scope. |
