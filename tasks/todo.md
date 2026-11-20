# Todo — Lane P5

Ordered task list. One task is one focused piece, small enough to
implement and verify in a single session. A task that needs splitting
is split before it is started. Completed tasks are marked with the
commit they landed in; a task is not done when its files are written,
but when the §4 checks pass on them.

- [x] T01 Baseline gates (done 2026-11-20; typecheck 0, build 0, vitest 40 files / 460 passed, audit 0; bundle 3,846,651 / largest 2,899,891) on the unmodified tree (typecheck / build /
  vitest / audit) — record counts.
- [x] T02 CONSTRAINTS.md (done; PERF.md ratchet updated 2026-11-20: total JS 3,864,036 after the item-28 split) (item 25) + AGENTS.md pointer line.
- [x] T03 Docs set A (done) (item 29/32/34): `docs/inventory.md`,
  `docs/adr/0007-fetchjson-no-retry.md`, `docs/wallet-lifecycle.md`,
  `docs/audits/README.md`, `docs/review-rules.md`,
  `docs/release-procedure.md`, `docs/launch-checklist.md`,
  `docs/runbooks/` (3 files), `tasks/plan.md`, `tasks/todo.md`.
- [x] T04 `SECURITY-FINDINGS.md` (done; root file is a deferral register only — docs file already existed at 0fd3a2e) root deferral register + `PERF.md`
  attempt ledger (item 26).
- [x] T05 README.md (done) product-user route + WALLET_BUILDER.md 4.9.3
  workflow doc + capability section from `chains.ts` (items 29, 11).
- [x] T06 AGENTS.md (done) routing table + Definition of Done (item 32);
  CONTRIBUTING.md adopt-a-dependency checklist (item 29).
- [x] T07 Scripts (done; S6 written hands-on after the Sol 403 stop:
  check-wallet-cycles.mjs + crypto-architecture.test.js, both verified
  by running + fault injection) (items 26, 30): `scripts/check-pinned-dependencies.js`,
  `scripts/check-wallet-cycles.mjs`, `scripts/crypto-architecture.test.js`,
  `patches/` directory + README.
- [x] T08 CI + Dependabot (done; floor-guard tested against the real worktree; chains drift guarded until P4's generator lands) (item 26): `apps/web` job, floor-guard job,
  docs drift check, chains drift check (guarded until P4's generator
  lands), E2E job; Dependabot npm entries for `apps/web` and root.
- [x] T09 E2E harness (done; specs written hands-on after S5/S5a
  failed with no output — 5/5 green against the built app) (item 27): `apps/web/playwright.config.ts`,
  `apps/web/e2e/manifest.json`, cases, `.mcp.json`. Add
  `@playwright/test` as a devDependency (recorded decision; lockfile
  diff reviewed, never hand-edited).
- [x] T10 Prefix expansion (done; Sol S2 landed; 16/16 in import-wallet.test.tsx) (item 31): `expandUniquePrefix` in
  `import-wallet.tsx` + tests in `import-wallet.test.tsx`.
- [x] T11 Simplification survey (done 2026-11-20; report in the lane dir, not the repo: simplification-survey.md — C1 dead registry delete recommended to P1, C2 shared messageOf helper, C3 docs-merge pass, C4 test-helper constant, C5/C7 investigated not duplications, C6 split cost +501 lines recorded) (item 33): read-only survey report in
  the lane dir (not the repo).
- [x] T12 Error boundary (done; Sol S1 landed; 4/4 tests; app.tsx mount flagged) (item 28): `apps/web/src/app/error-boundary.tsx`
  + tests + minimal mount in `app.tsx` (flagged wiring edit).
- [x] T13 Refresh characterisation tests (done hands-on; 3 + 2 tests) (item 28): pin current
  behaviour of `refreshBalances` / `refreshHistory` / background
  refresh before the split.
- [x] T14 Wallet-context split (done hands-on; wallet-refresh.ts + pending-broadcasts.ts; suite 44 files / 480 passed) (item 28): extract refresh into
  `apps/web/src/state/wallet-refresh.ts`; add pending-broadcast
  bookkeeping (`apps/web/src/state/pending-broadcasts.ts`); expose
  `lastOkAt` + stale/error state; Retry in `transaction-history.tsx`.
- [x] T15 Retry wiring (done as far as this lane can: P1's retry.ts
  verified first-hand; local loop aligned to its ACTUAL semantics;
  the import itself is a merge-time swap — retry.ts is P1's file) (item 28): apply P1's `withRetry` to
  `refreshHistory` / `refreshBalances` per the fixed contract;
  sanitised exhaustion reporting. Verify with temporary stub if P1
  has not landed; record the merge-order dependency.
- [x] T16 Final gates on the lane branch (done 2026-11-20 ~15:50 UTC):
  typecheck 0, lint 0, vitest 44 files / 480 passed, build 0
  (total JS 3,864,173, largest 2,899,891 — both inside budget),
  `npm audit` 0, depcheck agree, cycles OK (73 files, 183 edges),
  arch test 7/7, E2E 5/5, link checker OK (130 files), drift
  CURRENT + inventory complete. Committed on
  panel-rebuild/repo-study-p5 (see RUN-LOG). Report back.
