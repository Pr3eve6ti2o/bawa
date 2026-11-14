# ADR-0004 — Single repository organised by deployable

## Context

The team has 1–3 people. Web and Android share concepts, not implementation. Neither has an independent release cadence, a hard security boundary, or a separate compliance regime.

The R1 research split test (independent lifecycle, owned boundary, net maintenance benefit) finds that all four triggers for a split fail.

## Decision

Keep one repository, with `apps/web` and `apps/android` as deployables. Add `packages/` only when a second consumer exists. Keep the guide in root `docs/`. The guide's size alone never justifies a separate repository.

## Status

accepted

## Consequences

- Cross-cutting changes can be atomic: guide and code move together, with one checkout for everything.
- Web and Android remain separate implementations; shared concepts still require implementation work in both.
- A public SDK shipped on its own semver would earn its own repository.
- A hard access boundary for contractors, secrets, or compliance would force a split.
