# Plan — Lane P5 (Phase 3: process, docs, CI, refresh observability)

Owner: Lane P5. Base: `panel-rebuild/repo-study` at `0fd3a2e`. Branch
(local-only, never push): `panel-rebuild/repo-study-p5`. Worktree:
`/home/boxd/workspace/bawa-repo-study-p5/`. Lane dir:
`/home/boxd/workspace/bawa-repo-study-p5-lane/`.

Source: `bawa-repo-study-consolidation/APPLY-PLAN.md` §1 items 25–34 and
11 (doc half), §3 P5 manifest, §4 verification checklist. The plan is
the authority; this file is the lane's execution record.

## Scope

Apply items 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 11 (doc half).
Files: exactly the P5 manifest in APPLY-PLAN §3, plus the two flagged
wiring edits (see "Boundary notes"). No other files.

## Order

1. Baseline gates on the unmodified tree (typecheck / build / vitest /
   audit) — record counts before changing anything.
2. Docs and process (items 25, 26-docs, 29, 32, 33, 34, 11-doc-half):
   no code behaviour changes, so no test risk.
3. Scripts and CI (items 26, 30): new scripts + `ci.yml` + Dependabot.
4. E2E harness (item 27): Playwright config, manifest, cases, `.mcp.json`.
5. Prefix expansion (item 31): helper + tests in `import-wallet`.
6. Refresh observability (item 28) LAST: characterisation tests first,
   then the wallet-context split, then retry wiring against P1's
   `wallet/retry.ts` contract. Item 28 is sequenced after Prerequisite 0;
   no PREREQ-0-DIFF.md existed when this lane started (checked
   2026-11-20), so the price-feed runbook covers the multichain-create
   feed by reference only.

## Boundary notes (flagged for the coordinator)

- `apps/web/src/app/app.tsx` is NOT in the P5 manifest, but the error
  boundary (item 28) must be mounted to do anything. The lane mounts it
  with a minimal edit and flags it here; the coordinator confirms.
- `apps/web/src/screens/import-wallet.test.tsx` is not named in the
  manifest, but item 31 explicitly requires "expansion tests"; they live
  in that existing test file. No other lane owns it.
- `SECURITY-FINDINGS.md` at the repo root is created as a deferral
  register (item 26). Correction to the plan: `docs/SECURITY-FINDINGS.md`
  DOES exist in this tree (405 lines, ecdsa item 1) — the plan's "verified
  missing" premise was wrong for the docs path. The root file therefore
  records only the deferral decision and points at the docs file as the
  canonical finding. The coordinator may direct moving the deferral
  into the docs file instead.
- Item 28 imports P1's `apps/web/src/wallet/retry.ts`, which does not
  exist in this tree yet (P1 had not started when this lane began). The
  lane codes against the contract fixed in APPLY-PLAN §1 item 2 and
  records the exact expected interface in the refresh module header.
  Local gates are verified with a temporary contract-faithful stub that
  is NOT committed; merged-tree verification is the coordinator's gate.
  See `tasks/todo.md` and the final lane report.
- The wallet-context split creates one new file,
  `apps/web/src/state/wallet-refresh.ts`, as the split target for item
  28. No other lane owns `apps/web/src/state/`.
- New-file names chosen by this lane (per §3 "TBD by lane"):
  `docs/inventory.md`, `apps/web/src/app/error-boundary.tsx`,
  `apps/web/src/state/wallet-refresh.ts`,
  `apps/web/src/state/pending-broadcasts.ts`,
  `docs/adr/0007-fetchjson-no-retry.md`.

## Amendments

- 2026-11-20: plan created (this file). No amendments yet.
