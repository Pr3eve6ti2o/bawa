# Changelog

All notable changes to the `docs-usecase-split` branch are documented here.
This branch has no releases and no version numbers; the `Unreleased` section
below records work since the last audit commit (`c0be1eb`, 2026-11-13).
Earlier history is in the git log: the guide was built section by section on
2026-10-05 and audited on 2026-11-13.

## [Unreleased]

### Added

- MIT `LICENSE` (same license as the rest of the Bawa project).
- `CONTRIBUTING.md`: how to contribute to this branch's documentation.
- `SECURITY.md`: security policy for this branch (no private reporting
  channel exists yet; establishing one remains an open maintainer action).
- `docs/standards.md`: the standards and projects link list, moved out of
  the root README.
- `docs/adr/0001-use-case-split.md`: records the decision to split the
  guide into 10 numbered use-case sections.
- `scripts/check-links.py`: checks that every relative link in the branch's
  Markdown files resolves, including anchors.

### Changed

- Root `README.md` rewritten per the repo-craft research: it now opens with
  what the guide is, who it is for, and what it does; states the branch is
  documentation-only; gives a 30-second reading path; and routes readers to
  a section by the job they need to do. The standards link list moved to
  `docs/standards.md`.
- `docs/README.md` rewritten as a guide map: each section now states its
  Diátaxis purpose (Explanation, Reference, or How-to) alongside its scope,
  and the recommended reading order is kept with its rationale.
