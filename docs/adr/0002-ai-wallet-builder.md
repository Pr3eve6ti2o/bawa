# ADR-0002 — Bawa as AI Wallet Builder

## Context

On 2026-11-10, the owner pivoted Bawa to an AI Wallet Builder. The repo is an AI-readable guide and resource repo: an AI coding agent receives one plain request and produces a real, buildable project. Only resources that actually exist are included.

## Decision

Use the repo as the builder's source of truth:

- Machine-readable registries for profiles, capabilities, engines, and UI.
- Real Web and Android starters.
- `AGENTS.md` and `WALLET_BUILDER.md` as entry points.

Recommend `token-ui` as the Web foundation. Use Tether WDK Starter as the Android foundation, for its UI layer only. Use Bawa Balanced as the default visual direction.

## Status

accepted

## Consequences

- The builder works from the repo's verified resources and never invents a stack.
- Keeping guides and registries machine-readable and accurate adds maintenance work.
- Every new resource must exist and be verified before it is referenced.
- Web and Android use separate foundations; the Android foundation covers UI only.
