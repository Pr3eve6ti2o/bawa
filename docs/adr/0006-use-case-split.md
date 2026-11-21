# ADR-0006: Split the Bawa guide into numbered use-case sections

## Context

The Bawa guide previously had the shape of a single guide. Readers arrive with a job: learn the cryptography, choose a repository, generate a wallet once, track a wallet, track a payment, or protect recovery material. They do not arrive intending to read a manual front to back.

The split gives each job its own entry point rather than making readers navigate one guide for every task.

## Decision

Split the guide into 10 numbered use-case sections under `docs/`, each with its own `README.md`:

- `docs/01-fundamentals/README.md`
- `docs/02-chains/README.md`
- `docs/03-tools-and-repositories/README.md`
- `docs/04-wallet-generation/README.md`
- `docs/05-watch-only/README.md`
- `docs/06-tracking/README.md`
- `docs/07-payment-tracking/README.md`
- `docs/08-security-recovery/README.md`
- `docs/09-signing-and-hardware/README.md`
- `docs/10-operations-and-testing/README.md`

The root `README.md` routes readers to a section by the job they need to do.

## Status

**Accepted.** This records the decision that created `docs-usecase-split` and is already implemented on that branch. It does not propose a new change.

The branch history shows the split was built section by section, with one commit per section, followed by refinements and then the audit-and-sync commit `c0be1eb`.

The branch contains only the guide: the root `README.md` and 10 section READMEs, totaling 3,265 lines. It has no code, tests, or CI. The decision was not measured or tested; this record describes what the artifact and branch history show.

Superseded by ADR-0010 (2026-11-20): the guide scope is now docs/01–16 plus the Web, Android and mainnet guides and the implementation plan. This record is kept as history; its ten-section scope no longer describes the guide.

## Consequences

- Each job has a clear entry point, and you can open only what you need.
- There are now 11 `README.md` files to keep in sync instead of one.
- You must keep links between sections relative so they work in any clone or branch.
- A change that spans jobs touches more than one file.

## Provenance

Originally recorded as ADR-0001 (`docs/adr/0001-use-case-split.md`) on branch `docs-usecase-split` at commit `7e543ec0d155d2bcd347d40df65fa16ae798327e` (SHA-256 of the original file: `e1f1e03adfd8c8f17652654a37e4a167ca48148724062aa39573dc816e955fb7`). Renumbered to ADR-0006 on import into `panel-rebuild/adopt-proper` because that branch already has its own ADR-0001 (wallet-core pin); only the number changed, the decision text is unchanged. The source branch was deleted after this transfer.
