# ADR-0010 — Guide scope extension beyond ten sections

## Context

ADR-0006 split the guide into 10 numbered use-case sections (`docs/01`–`docs/10`).

As of 2026-11-20, the guide has grown to 16 numbered sections (`docs/01`–`docs/16`), plus the Web wallet guide, the Android wallet guide, the mainnet guide and the implementation plan.

## Decision

The guide scope is:

- The 16 numbered sections, `docs/01`–`docs/16`.
- The Web wallet guide, `docs/web-wallet/WEB-GUIDE.md`.
- The Android wallet guide, `docs/android-wallet/ANDROID-GUIDE.md`.
- The mainnet guide, `docs/mainnet/MAINNET-GUIDE.md`.
- The implementation plan, `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md`.

## Status

accepted

## Consequences

- ADR-0006's ten-section scope is superseded by this record.
- ADR-0006 is kept as history and marked superseded by appending a dated supersession note. Its original text is retained, never deleted or silently rewritten.
- `index.md`, `AGENTS.md` and `WALLET_BUILDER.md` already describe the extended scope.
