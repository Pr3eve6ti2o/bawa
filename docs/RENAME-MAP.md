# Bawa rename map — Lane I (Phase 4 layout makeover)

- **Lane:** renames, branch `panel-rebuild/layout-makeover`, base `a0495c1`
  (Phase 3 committed)
- **Worktree:** `/home/boxd/workspace/bawa-layout-makeover` (gray-pinee)
- **Date:** 2026-11-20
- **Source:** Lane E §4 (`bawa-layout-study/lane-e-monorepo/FINDINGS.md`),
  built on `NAMING-MAP.md` (Lane A, `panel-rebuild/org-naming`) — none of
  Lane A's applied renames are repeated here.
- **Method (NAMING-MAP method, mandatory):** for each move, `grep -rn` for
  the old path first, move with `git mv` (rename tracking preserved), update
  every live reference the grep found, then verify. No file or directory was
  deleted anywhere in this lane — archive, don't delete (coordinator
  decision, which overrules Lane E §4.1 #7's delete proposal for the logs).
- **KEEPS:** the 12 items in Lane E §4.2 were not renamed
  (`test/` vs `tests/`, `registry/ui.json`, `LICENSE-token-ui`,
  `engine/boundary.ts`, `docs/index.md` vs `docs/README.md`, `docs/01–16`,
  the `EXTERNAL-TOOLS.md` pair, kebab-case docs, `research/ui-candidates.md`,
  `tools/mainnet-*/` single-file dirs, `gate-verdict` / `quality-gates` /
  `classify-request` / `plan-build`, `fixture-oracle` / `oracle` /
  `asset-rows` / `confirmation-policy` names).
- **`NAMING-MAP.md` stays at the root** until the makeover lands, then
  archives with the programme reports — it was not moved in this lane.
- **`docs/README-FULL.md` was not touched** (verbatim preservation).

## 1. Archive moves — `lane/` (14 tracked files, not 13 as Lane E counted)

| Old path | New path |
|---|---|
| `lane/` | `docs/archive/lane-evidence-2026-11-20/` |
| `lane/evidence/el-10.json` | `docs/archive/lane-evidence-2026-11-20/evidence/el-10.json` |
| `lane/evidence/el-56.json` | `docs/archive/lane-evidence-2026-11-20/evidence/el-56.json` |
| `lane/evidence/el-137.json` | `docs/archive/lane-evidence-2026-11-20/evidence/el-137.json` |
| `lane/evidence/el-8453.json` | `docs/archive/lane-evidence-2026-11-20/evidence/el-8453.json` |
| `lane/evidence/el-42161.json` | `docs/archive/lane-evidence-2026-11-20/evidence/el-42161.json` |
| `lane/evidence/el-43114.json` | `docs/archive/lane-evidence-2026-11-20/evidence/el-43114.json` |
| `lane/evidence/wc-registry-extract.json` | `docs/archive/lane-evidence-2026-11-20/evidence/wc-registry-extract.json` |
| `lane/evidence/probe-2026-11-20.jsonl` | `docs/archive/lane-evidence-2026-11-20/evidence/probe-2026-11-20.jsonl` |
| `lane/report-b.md` | `docs/archive/lane-evidence-2026-11-20/report-b.md` |
| `lane/run-log-a.jsonl` … `run-log-e.jsonl` | `docs/archive/lane-evidence-2026-11-20/run-log-a.jsonl` … `run-log-e.jsonl` |

New: `docs/archive/lane-evidence-2026-11-20/README.md` — one-line-per-file
description (the `el-*.json` files are per-chain registry extracts named by
chain ID; read first-hand before writing). Filenames inside the archive were
deliberately not renamed (opaque element IDs — no descriptive names invented
by guessing).

Live references updated: `registry/profiles.json:627` and
`ai/profiles/multichain-extended-wallet.md:50` (source lists naming the probe
file) now point at the archive path. All other `lane/` mentions are
historical prose in reports that moved to the archive with the files, or
records of other lanes' worktrees (`apps/web/UI-UX-REFERENCE.md`,
`NOV18-*.md`, `docs/UI-UX-REFERENCE-RESEARCH.md`) — left as written, per
the NAMING-MAP §3 precedent. One exception inside the archive itself:
`report-b.md:40` still cites the old `lane/evidence/probe-2026-11-20.jsonl`
path; it is the archived report's own contemporary citation, left untouched.

## 2. Archive moves — `lane-d/` (10 files)

| Old path | New path |
|---|---|
| `lane-d/` | `docs/archive/lane-d-diagrams-2026-11-20/` |
| `lane-d/AUDIT.md` | `docs/archive/lane-d-diagrams-2026-11-20/AUDIT.md` |
| `lane-d/sol1.mmd` / `sol1.svg` | `docs/archive/lane-d-diagrams-2026-11-20/repository-architecture-diagram-1.mmd` / `.svg` |
| `lane-d/sol2.mmd` / `sol2.svg` | `docs/archive/lane-d-diagrams-2026-11-20/web-wallet-components-diagram-2.mmd` / `.svg` |
| `lane-d/sol3.mmd` / `sol3.svg` | `docs/archive/lane-d-diagrams-2026-11-20/chain-support-overview-diagram-3.mmd` / `.svg` |
| `lane-d/sol4.mmd` / `sol4.svg` | `docs/archive/lane-d-diagrams-2026-11-20/one-prompt-wallet-build-workflow-diagram-4.mmd` / `.svg` |
| `lane-d/verify-diagrams.py` | `docs/archive/lane-d-diagrams-2026-11-20/verify-diagrams.py` |

Topics come from each diagram's own `accTitle` (verified first-hand):
1 — repository architecture, 2 — web wallet components and data flow,
3 — chain support overview, 4 — one-prompt wallet build workflow.
`lane-d/AUDIT.md` contains zero references to the `solN` filenames (verified
by grep), so it needed no update. `verify-diagrams.py` was updated: the four
`CASES` paths, the docstring ("archived .mmd files"), and the root resolution
(`parents[1]` → `parents[3]`, because the script now sits three levels below
the repo root instead of one). Verified: `python3
docs/archive/lane-d-diagrams-2026-11-20/verify-diagrams.py` → ALL OK (4/4
match the embedded blocks and render).

## 3. Archive moves — `lane-f/` (64 tracked files, 3.3 MB)

| Old path | New path |
|---|---|
| `lane-f/` | `docs/archive/lane-f-layout-evidence-2026-11-20/` |
| `lane-f/o01-design-spec.md` | `docs/archive/lane-f-layout-evidence-2026-11-20/sol-output-design-spec.md` |
| `lane-f/o02-sidebar-nav.md` | `docs/archive/lane-f-layout-evidence-2026-11-20/sol-output-sidebar-nav.md` |
| `lane-f/o03-app-layout.md` | `docs/archive/lane-f-layout-evidence-2026-11-20/sol-output-app-layout.md` |
| `lane-f/p01-design-spec.md` | `docs/archive/lane-f-layout-evidence-2026-11-20/sol-prompt-design-spec.md` |
| `lane-f/p02-sidebar-nav.md` | `docs/archive/lane-f-layout-evidence-2026-11-20/sol-prompt-sidebar-nav.md` |
| `lane-f/p03-app-layout.md` | `docs/archive/lane-f-layout-evidence-2026-11-20/sol-prompt-app-layout.md` |

All other 58 files moved unchanged (screenshots, probe JSON, probe/serve
scripts, and all logs). The `o`/`p` distinction, confirmed from
`RUN-LOG.jsonl`: `p*` = prompt sent to gpt-6.1-sol, `o*` = Sol's output.
`o03` is the exception: Sol asked for the current `AppLayout`/tabs paste
instead of emitting (`failed-no-emit`); the AppLayout was assembled
hands-on. `RUN-LOG.jsonl` keeps the old `lane-f/o*`/`p*` paths as the
historical record of the run — not updated.

The logs (`build-2.log` … `build-6.log`, `chrome2.log`, `pinggy.log`,
`baseline-npm-ci.log`, `baseline-home-390.log`, plus `baseline-build.log`,
`serve-baseline.log`, `typecheck-*.log`, `vitest-*.log`, `sol-p*.log`) were
**archived, not deleted**, on the coordinator decision — Lane E §4.1 #7
proposed deletion, which this lane overruled. New:
`docs/archive/lane-f-layout-evidence-2026-11-20/README.md` records the
`o`/`p` distinction and the `o03` exception. Zero live references to
`lane-f/` existed outside the directory itself (verified by grep).

## 4. `apps/web/src/screens/create.tsx` → `create-hub.tsx`

| Old path | New path |
|---|---|
| `apps/web/src/screens/create.tsx` | `apps/web/src/screens/create-hub.tsx` |

`apps/web/src/screens/create-wallet.tsx` kept. Imports updated (the only
two, found by grep before moving): `apps/web/src/app/app.tsx:20`
(`../screens/create` → `../screens/create-hub`) and
`apps/web/src/screens/create.test.tsx:6` (`./create` → `./create-hub`).
No other file imports `./create` (route strings such as `/create` are URL
paths, not module paths, and are unchanged).

**Note (2026-11-28, Lane A docs audit):** `create-hub.tsx` no longer
exists at token-gaps `ceade79` — the `/create` hub was deleted in P0
(2026-11-27, `33f1ff1`); there is one "Create wallet" button going
straight to `/create-wallet`, and no `/create` route. The rename above
is the 2026-11-20 record.

## 5. `apps/web` verification reports → `docs/archive/web-verification-2026-11-20/`

| Old path | New path |
|---|---|
| `apps/web/VERIFY-A-BUILD.md` | `docs/archive/web-verification-2026-11-20/verify-a-build.md` |
| `apps/web/VERIFY-B-DERIVE.md` | `docs/archive/web-verification-2026-11-20/verify-b-derive.md` |
| `apps/web/VERIFY-C-ADDRS.md` | `docs/archive/web-verification-2026-11-20/verify-c-addrs.md` |
| `apps/web/VERIFY-D-BALANCES.md` | `docs/archive/web-verification-2026-11-20/verify-d-balances.md` |
| `apps/web/VERIFY-E-SIGN.md` | `docs/archive/web-verification-2026-11-20/verify-e-sign.md` |
| `apps/web/VERIFY-F-SECRETS.md` | `docs/archive/web-verification-2026-11-20/verify-f-secrets.md` |
| `apps/web/IMPLEMENTATION-REPORT.md` | `docs/archive/web-verification-2026-11-20/implementation-report.md` |
| `apps/web/REBUILD-EVIDENCE.md` | `docs/archive/web-verification-2026-11-20/rebuild-evidence.md` |

Zero references from `docs/` or `apps/web/README.md` (verified). The only
references to the VERIFY files live inside `IMPLEMENTATION-REPORT.md`
itself, as bare filenames — they moved together, so they still resolve as
siblings. The only live references to `apps/web/REBUILD-EVIDENCE.md` were
`docs/wallet-reference-map.md:98,196`, updated to the archive path.
`IMPLEMENTATION-REPORT.md` is cited by `NAMING-MAP.md` §3 (historical note)
and by bare filename in `registry/profiles.json:377`,
`tests/registry.test.mjs:391`, `scripts/validate-registry.mjs:392`
(prose/comments, no path) — all left as written.

## 6. `scripts/test.mjs` → `scripts/run-test-suites.mjs`

| Old path | New path |
|---|---|
| `scripts/test.mjs` | `scripts/run-test-suites.mjs` |

References updated: `docs/index.md:71`, `docs/CAPABILITY-MAP.md:140`,
`docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md:494`, `ARCHITECTURE.md:86`,
plus the script's own usage string (`scripts/run-test-suites.mjs:62`).
`docs/README-FULL.md:28` still says `scripts/test.mjs` — verbatim
preservation, not touched. Verified by running the renamed script:
`node scripts/run-test-suites.mjs --platform web` → `test web: PASS`,
`test android: NOT-RUN` (no Android SDK on this machine), `test: OK`.

## 7. `docs/handoff.md` → `docs/archive/handoff-2026-11-10.md`

References updated: `docs/index.md:89,99` and
`docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md:512`. The two
`docs/BAWA-ENV-RENAME-PLAN.md` pointers inside the handoff file itself were
updated to `docs/archive/bawa-env-rename-plan.md` (the target moved in the
same lane). Remaining `docs/handoff.md` mentions are historical prose in
`NAMING-MAP.md:22`, `CHANGELOG.md:5`, `docs/README-FULL.md:17,1300`
(verbatim) and the archived `branch-doc-status.md` /
`multibranch-report.md` — left as written.

## 8. Audit-history docs → `docs/archive/<same-name-lowercased>.md`

| Old path | New path |
|---|---|
| `docs/BRANCH-AUDIT.md` | `docs/archive/branch-audit.md` |
| `docs/MULTIBRANCH-REPORT.md` | `docs/archive/multibranch-report.md` |
| `docs/BRANCH-DOC-STATUS.md` | `docs/archive/branch-doc-status.md` |
| `docs/MAINNET-GAP-ASSESSMENT.md` | `docs/archive/mainnet-gap-assessment.md` |
| `docs/ARCHIVAL-TAGS.md` | `docs/archive/archival-tags.md` |
| `docs/BAWA-ENV-RENAME-PLAN.md` | `docs/archive/bawa-env-rename-plan.md` |

Live references updated: `docs/index.md:54,55`
(`MAINNET-GAP-ASSESSMENT.md`, `BRANCH-AUDIT.md`),
`README.md:114,124` (`docs/MAINNET-GAP-ASSESSMENT.md`),
`ARCHITECTURE.md:98` (`docs/BRANCH-AUDIT.md`,
`docs/MAINNET-GAP-ASSESSMENT.md`),
`docs/adr/0003-mainnet-first.md:7` (`docs/MAINNET-GAP-ASSESSMENT.md`).
No live references to `MULTIBRANCH-REPORT.md`, `BRANCH-DOC-STATUS.md`,
`ARCHIVAL-TAGS.md` or `BAWA-ENV-RENAME-PLAN.md` existed outside the
archived reports themselves (verified by grep); their mentions there are
historical prose and were left as written. The
`docs/security-release-gates.md` pointer inside `bawa-env-rename-plan.md:16`
was updated to `docs/SECURITY-RELEASE-GATES.md` (see §10).

## 9. Root programme reports → `docs/archive/programme-reports-2026-11-20/`

| Old path | New path |
|---|---|
| `DIAGNOSTICS.md` | `docs/archive/programme-reports-2026-11-20/DIAGNOSTICS.md` |
| `FINAL-REPORT.md` | `docs/archive/programme-reports-2026-11-20/FINAL-REPORT.md` |
| `LANE-C-REPORT.md` | `docs/archive/programme-reports-2026-11-20/LANE-C-REPORT.md` |
| `ORG-FINALISATION.md` | `docs/archive/programme-reports-2026-11-20/ORG-FINALISATION.md` |
| `MULTICHAIN-ASSESSMENT.md` | `docs/archive/programme-reports-2026-11-20/MULTICHAIN-ASSESSMENT.md` |

`docs/index.md` "Start here" links none of these (verified — it links
`AGENTS.md`, `WALLET_BUILDER.md`, the implementation plan, the builder
command, `README.md` and `README-FULL.md` only). Remaining mentions are
bare filenames in `docs/SECURITY-FINDINGS.md:68,146`,
`docs/archive/branch-doc-status.md:101` and the archived reports
themselves — historical prose, left as written. `NAMING-MAP.md` stays at
the root (not moved in this lane).

## 10. `docs/security-release-gates.md` → `docs/SECURITY-RELEASE-GATES.md`

Case consistency with its SECURITY group (`SECURITY.md`,
`SECURITY-FINDINGS.md`, `SECURITY-AUDIT-TOOLCHAIN.md`). References updated:
`docs/index.md:85,93`, `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md:502`,
`docs/archive/bawa-env-rename-plan.md:16`, `AGENTS.md:41`.
`docs/README-FULL.md:1301` still links the old lowercase path — verbatim
preservation, not touched (see "Known consequence" below).

## 11. Package names → `@bawa/` scope

| Old name | New name | File |
|---|---|---|
| `bawa-web` | `@bawa/web` | `apps/web/package.json`, `apps/web/package-lock.json` (2 occurrences) |
| `bawa-tools` | `@bawa/tools` | `tools/package.json` (no lockfile exists) |
| `bawa-hd-wallet-core-tools` | `@bawa/hdwallet-gen` | `tools/hdwallet-gen/package.json`, `tools/hdwallet-gen/package-lock.json` (2 occurrences) |

Safety was verified by grep before renaming: no code imports any of the
three package names; `apps/web/package.json` still consumes
`@bawa/contracts` as `file:../../packages/contracts` (relative path,
unaffected); no CI workflow, script or test asserts the names. Companion
updates: `tests/registry.test.mjs:319` (fixture manifest now uses
`@bawa/hdwallet-gen` — the test reads the wallet-core pin, not the name),
`apps/web/README.md:11`, `docs/14-wallet-app-implementation/README.md:22`.
Deliberately untouched: the vault AAD `bawa-web-vault-v1` and database
`bawa-web-wallet` (different identifiers — asserted by
`tests/register-t01.test.mjs`, must not change), the archived
`docs/archive/multibranch-report.md:412` (historical report), and the
archived `lane-f` build logs (`> bawa-web@0.1.0 build` — run records).
Lockfile sync verified: `npm install --package-lock-only --dry-run` in
`apps/web` reports "up to date", and `npm --prefix tools/hdwallet-gen run
check` now runs as `@bawa/hdwallet-gen@1.1.0`.

## 12. `docs/index.md` "Doc N" labels dropped

- `[Doc 2 — Web wallet]` → `[Web wallet]`
- `[Doc 3 — Android wallet]` → `[Android wallet]`
- `[Doc 4 — Mainnet]` → `[Mainnet]` — same collision as Doc 2/3 (it
  collides with numbered `Doc 04`), dropped on the same reasoning although
  the lane brief named only Doc 2/3; revert this one line if strict scope is
  wanted.
- Inline references updated to match: `Doc 4 §21` → `Mainnet guide §21`
  (2 occurrences), `Doc 4 §5` → `Mainnet guide §5`.
- Convention documented in `docs/index.md` under "Tutorials — learn by
  doing": numbered labels (`Doc 01`, `Doc 02`, …) follow the guide sequence
  in `docs/01`–`docs/16`; the unnumbered entries (Web wallet, Android
  wallet, Mainnet) are platform references, not steps in that sequence.
- `docs/index.md` only. No directory was renumbered.

## Deferred items

None. All 17 items landed, including #16 (package names) — the pre-rename
grep showed it was safe, and the lockfile-sync check passed.

## Items with zero live references (moved with no reference updates)

- #1 `lane/` — zero live references outside historical prose (the two live
  probe-file references are listed in §1).
- #2 `lane-d/` — zero live references outside the directory (only
  `ORG-FINALISATION.md`, which moved to the archive in §9).
- #3 `lane-f/` — zero references anywhere outside the directory.
- #9/#10 VERIFY files — zero references outside `IMPLEMENTATION-REPORT.md`
  itself (see §5).
- #13 `MULTIBRANCH-REPORT.md`, `BRANCH-DOC-STATUS.md`, `ARCHIVAL-TAGS.md`,
  `BAWA-ENV-RENAME-PLAN.md` — zero live references (see §8).
- #14 root reports — zero live links from `docs/index.md` (see §9).

## Known consequence — `check-links` and the verbatim file

`python3 tools/check-links.py` now reports 2 broken internal links, both in
`docs/README-FULL.md:1300-1301` (`handoff.md` and
`security-release-gates.md`), because those two files moved and the
verbatim-preserved file must not be edited. Every other link resolves
(129 files checked). The coordinator's call: either exempt `README-FULL.md`
from `check-links`, or accept the 2 broken links as the known cost of the
renames. Nothing else is broken — the same two paths are the only stale
links in the tree.

**Resolved (2026-11-28, Lane A docs audit):** the first option was
taken — `tools/check-links.py` now excludes `docs/README-FULL.md`
("Verbatim-preserved historical snapshots ... Excluded from the link
check"), and `python tools/check-links.py` reports OK (181 files) at
token-gaps `ceade79`. The 2 stale links still sit in the verbatim file
by design; they are not checked.

## Verification per batch

| Batch | `tsc --noEmit` | `npm run build` | Vitest (apps/web) | Other |
|---|---|---|---|---|
| A — items 1–7 | OK | OK (1.21 s) | 685 pass, 1 skip (52 files) | `tests/registry.test.mjs` 29/29; `check-links` OK (129 files); `verify-diagrams.py` ALL OK (4/4) |
| B — items 8–10 | OK | OK (1.31 s) | 685 pass, 1 skip (52 files); affected files `create.test.tsx` + `app.test.tsx` 14/14 | `check-links` OK (129 files); zero remaining `apps/web/VERIFY*` / `REBUILD-EVIDENCE` / `IMPLEMENTATION-REPORT` path references outside the archive |
| C — items 11–15 | OK | OK (1.79 s) | 685 pass, 1 skip (52 files) | renamed script `node scripts/run-test-suites.mjs --platform web` → `test web: PASS`, `test: OK`; `check-links` 2 broken links, both in verbatim `README-FULL.md` (see above) |
| D — item 16 | OK | OK (1.27 s) | 685 pass, 1 skip (52 files) | `tools/hdwallet-gen` check PASS; `tests/registry.test.mjs` 29/29; `npm install --package-lock-only --dry-run` "up to date" |
| E — item 17 | OK | OK | 685 pass, 1 skip (52 files) | `check-links` same 2 README-FULL breaks as batch C; `tests/registry.test.mjs` 29/29 |

One fix was needed mid-lane (Batch B): a `sed` replacing
`../screens/create` also rewrote the adjacent `../screens/create-wallet`
import to `../screens/create-hub-wallet`. Caught by `tsc --noEmit`
(TS2307), fixed back, re-verified before moving on. No batch was left
broken.

Final tree state: no deletions in the staged diff (renames + modifications
only); `NAMING-MAP.md` untouched at the root; `docs/README-FULL.md`
untouched.

## Final full-suite verification (after all batches)

- Full Node suite `tests/*.mjs`: **380 pass / 2 fail across 31 files** —
  the same 380/382 totals NAMING-MAP recorded on its older base. Both
  failures were reproduced identically on a pristine `a0495c1` worktree, so
  neither is caused by this lane:
  - `tests/clean-checkout.test.mjs` 2/3 (same failure NAMING-MAP recorded
    on `e493720`: `build-wallet: PLAN REJECTED`, a registry/profile data
    issue).
  - `tests/diagram-references.test.mjs` 4/5 — the "Web Send signs offline"
    test asserts `send.tsx` contains the literal string "not sent anywhere:
    broadcast is disabled until separately"; Phase 2/3 moved that wording
    into the `BROADCAST_DISABLED_MESSAGE` constant, so the literal is gone
    from `send.tsx`. `send.tsx` itself is untouched by this lane (verified:
    not in the staged diff). A test-or-copy update for the new phrasing,
    owned by whoever owns that test — not a rename.
- `stale-data.test.mjs` passes 7/7 in this tree (it failed on NAMING-MAP's
  base; the fix came from Phase 2/3 content, not this lane).
- `python3 tools/check-links.py`: 2 broken links, both in verbatim
  `docs/README-FULL.md:1300-1301` (see "Known consequence" above); 130
  files checked.
- `verify-diagrams.py`: ALL OK (4/4).
- Final staged diff: 111 renames + 20 modified + 3 added = 134 files,
  0 deletions. Branch still `panel-rebuild/layout-makeover` at `a0495c1`;
  nothing committed, nothing pushed.

## Sol calls

0 made, 0 landed, 0 failed. Mechanical rename work needed no model calls.
Run log: `/home/boxd/workspace/bawa-layout-study/lane-i-p4-renames/RUN-LOG.jsonl`.

## Skills used (read in full on gray-pinee, `/home/boxd/workspace/custom-skills/`)

- **`file-organizer`** — the naming bar for the whole lane: descriptive
  names, consistent patterns (kebab-case, dated archive dirs, lowercase
  archive filenames), archive-don't-delete, and its "propose a plan before
  moving, log all moves" discipline (this map is that log). It changed the
  archive layout (dated `docs/archive/*-2026-11-20/` dirs) and the decision
  to keep opaque `el-*.json` filenames instead of inventing names.
- **`code-review-and-quality`** — the readability bar: names descriptive and
  consistent with project conventions; a rename must reduce confusion, not
  relocate it. It is the reason the `bawa-web-vault-v1` AAD and the
  `bawa-web-wallet` database were left untouched (different identifiers
  from the package name), and why historical prose keeps old names instead
  of being rewritten.
