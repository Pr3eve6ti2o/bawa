# Release procedure — tagged baseline and rollback

This is the release procedure for Bawa. Only the baseline + rollback core
is in force now. The full ceremony (release branches, signed/DCO commits,
draft-release CI chain, post-release metadata PR, bilingual notes) is
deferred until the B-1 production launch — see "Deferred" below.

## 1. Tagged baseline

- The baseline is the latest published non-draft semver GitHub Release,
  verified by its tag. A version number in a file is not a baseline; a
  tag is.
- A new version is strictly greater by semver than the baseline. A
  version that is not greater is not a release, it is a re-tag, and it
  does not happen.
- Before drafting, reconcile net changes against the baseline: inspect
  the endpoint diff, not commit wording. Changes introduced and fully
  undone in-cycle are omitted. The notes describe only the final outcome
  versus the baseline.
- Update version files and generated history via a script, never by
  hand-editing generated files. A hand-edited generated file is a drift
  bug, not a release step.

## 2. Pre-release gates (all must pass)

- `CONSTRAINTS.md` checks green on the release commit (see the `Checked
  by` column for the exact commands).
- `apps/web`: typecheck 0 errors, build 0 errors, vitest all passing,
  `npm audit` 0, bundle-size gate green, E2E harness green.
- Root suite exit 0 (register-links checks and any root checks).
- Python reference tests, if touched: `test_make_wallet` 89 OK,
  `test_decrypt_seed` 30 OK.
- Docs drift check green; every code change in the release lists its
  affected docs.
- No broadcast path built or enabled; no real crypto moved; no fake
  data in the release notes or the build.
- The dependency-version check (`scripts/check-pinned-dependencies.js`)
  passes: the Trust Wallet Core 4.9.3 WASM pin is verified, and any
  recorded patch in `patches/` still applies cleanly.

## 3. Rollback plan (written before the deploy)

Every release writes its rollback plan before it deploys, not after
something breaks. The plan names:

- **The previous good version:** the baseline tag to return to.
- **The rollback action:** the exact commands (e.g. re-point the
  deployment at the baseline tag, re-run the deploy from that tag).
- **The data question:** whether anything the release wrote (storage
  format, vault envelope version, persisted state) needs migrating back,
  and what happens if it does not migrate. A release that changes a
  persisted format without a backwards-compatible read path does not
  ship until that question has an answer.
- **The trigger:** who decides to roll back, on what signal (error
  budget spent, error boundary firing, health check failing), and within
  what time.
- **The verification:** how to confirm the rollback worked (same gates
  as §2, run against the rolled-back deployment).

A rollback is a re-deploy of a known-good tag, not a hot-fix committed
under pressure. If the baseline tag cannot be re-deployed cleanly, the
release does not ship.

## 4. After the release

- Record the release in `CHANGELOG.md` by appending a dated entry. Never
  rewrite or collapse earlier entries.
- Record the release in `docs/audits/README.md` if any audit evidence
  covers it (report → commit → components → remediation).
- If the release changed the engine pin, record the new WASM SHA-256 in
  ADR-0001's successor (a new ADR supersedes; the old one is kept).

## 5. Deferred until B-1

Release branches, signed/DCO commits, the draft-release CI chain, the
post-release metadata PR, and bilingual release notes. Deferring them is
a decision, not an oversight: the tagged-baseline + rollback core above
is what a bad WASM pin (the 4.8.4 served with 4.9.3 glue, November 2026)
showed was missing, and it is what this procedure fixes first.
