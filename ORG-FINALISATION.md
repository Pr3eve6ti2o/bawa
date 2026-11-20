# Org finalisation — Lane B (2026-11-20)

Owner order 2026-11-20 ~13:56 IST. Lane B decided the final state of the five
org branches on `panel-rebuild/adopt-proper` and addressed open items (a)–(d).
All work on gray-pinee. Nothing was pushed; no branch was deleted; `main` was
not touched; no prune or `fetch --prune` was run.

## Final state

- `panel-rebuild/adopt-proper` HEAD: `c2c1fca` (was `e493720` at lane start).
- New local branch `panel-rebuild/multichain-adr0007` at `b0365ba` (off
  `panel-rebuild/multichain-create` `40d8cc5`), local only, not pushed.
- Worktree clean. All five org branches merged; the branch refs themselves
  are untouched and remain as the record of the lanes' original work.

## Per-branch decisions (all MERGED)

Every merge was verified after the merge in the adopt-proper worktree:
`tsc --noEmit` 0, `npm run build` 0, vitest, `node --test tests/*.test.mjs`,
`node --test test/*.test.js`, root `npm test`, Python `test_make_wallet.py`
and `test_decrypt_seed.py`. Baseline at `e493720` (verified first-hand before
any merge): tsc 0, build 0, vitest 457/457 (40 files), root tests 380/382,
`test/*.test.js` 3/3, Python 89 OK / 30 OK. The two baseline failures were
pre-existing: the stale-data M-31 assertion (fixed by this lane, 9f06e41) and
the clean-checkout Android test (environmental — no `JAVA_HOME`/`ANDROID_HOME`
on this VM; the plan is rejected with exit 2, which the test only tolerates
as 0/1).

### org-docs (54ae555) — MERGED as a6a8953

Docs refresh on the adopt-proper line. Front-door branch name corrected to
`panel-rebuild/adopt-proper`; AGENTS.md honesty state and routing table
updated to the verified 2026-11-20 state (offline signing exists, broadcast
disabled, APK built, web 457 vitest tests, Android 57 `@Test` annotations
labelled as an annotation count, Gradle NOT-RUN); WALLET_BUILDER.md, AGENTS.md
and `ai/request-routing.md` aligned to mainnet-first (separate-approval gate
kept); the `apps/web` README watch-only contradiction fixed; CAPABILITY-MAP,
`docs/index.md` evidence figures and MAINNET-GUIDE dated rows refreshed;
`docs/BRANCH-DOC-STATUS.md` added. Merged clean, no conflicts.
Verification after merge: tsc 0, build 0, vitest 457/457, root tests 381/382
(only the Android environmental failure), Python 89/30 OK.

### org-requirements (5853afe) — MERGED as abc15d6

Dependency pins and licence records. Root + `tools/` `.npmrc` gain
`ignore-scripts=true` (consistent with `apps/web` and `tools/hdwallet-gen`,
which already set it); `apps/web/package.json` pins jsqr/long/viem (carets
removed) and gains the MIT licence field; `packages/contracts/package.json`
gains description, `node >=22 <23` engines and MIT licence;
`requirements.txt` gains licence comments and the transitive-floor
justification for pynacl/requests. `LANE-C-REPORT.md` kept as the lane's
durable record. Merged clean, no conflicts; `npm ci` rc=0 after the merge
(package.json/lockfile still in sync).
Verification after merge: tsc 0, build 0, vitest 457/457, root tests 381/382,
Python 89/30 OK.

### org-naming (79a1c07) — MERGED as 6279a59

Kebab-case renames plus `NAMING-MAP.md`: `scripts/build.mjs` →
`build-platforms.mjs`; `tools/hdwallet-gen/derive_daemon.js` →
`derive-daemon.js`; `apps/web` `providers.ts` → `balance-providers.ts`,
`format.ts` → `chain-amount-format.ts`, wallet-context tests →
`state/wallet-provider*.test.tsx`; watch-only guides to kebab-case; NOV18
lane reports renamed; SECURITY-AUDIT-TOOLCHAIN / UI-UX-REFERENCE-RESEARCH
case-normalised. References were updated in code, tests and live docs;
verified first-hand that the remaining old-name mentions are deliberate
historical/pinned references (README-FULL.md, MULTIBRANCH-REPORT.md,
BRANCH-AUDIT.md, evidence reports, MAINNET-GUIDE gate links, plan-doc
history) and were correctly left alone.
Conflict: AGENTS.md routing-table rows — kept org-docs' 4.9.3 / 57-annotation
rows (the naming branch carried stale 4.8.4 / 17-test text) and took the
naming branch's `derive-daemon.js` filename.
Verification after merge: tsc 0, build 0, vitest 457/457, root tests 381/382,
Python 89/30 OK.

### org-diagrams (6f39fd5) — MERGED as 2316e9a

Four Mermaid architecture diagrams: repository architecture in
ARCHITECTURE.md, web-wallet component diagram in docs/13, chain diagram in
docs/12 (4-chain adopt-proper state, 13-chain registry on multichain-create
labelled as such), build-flow diagram in `ai/request-routing.md`. Sources
kept as `lane-d/*.mmd` with rendered `lane-d/*.svg` mirrors,
`lane-d/AUDIT.md` as the lane's record, and `lane-d/verify-diagrams.py`.
The verify script was fixed in the merge: its ROOT was hardcoded to the
lane's `/home/boxd/workspace/bawa-org/diagrams` worktree and is now derived
from the script's location. Run in-tree after the merge: all four embedded
blocks match their `.mmd` and render via mmdc, with rendered sizes identical
to the committed SVGs (16557 / 23843 / 12802 / 15450 bytes).
Conflict: ARCHITECTURE.md intro — kept the adopt-proper line wording and
reworded the branch-state paragraph to adopt-proper (the lane text named
`org-diagrams`); the Change notes entry was reworded the same way.
Verification after merge: tsc 0, build 0, vitest 457/457, root tests 381/382,
Python 89/30 OK.

### org-diagnostics (82970d2) — MERGED as c2c1fca

Dead-code deletion plus the fee-preview DoS cap. Deletes 36 dead UI
components + ThemeToggle and 20 unused dependencies; `formatFeePreview` /
`fiatMinorUnits` gain a 1,000-digit input cap with 3 new tests (100k digits
measured ~7s before the cap). Verified first-hand before merging: zero
imports of any deleted component in `apps/web/src` (the only apparent hits
were CSS theme tokens in `globals.css`, one prose comment, and `vault`
substring matches for `vaul`); `sonner` is correctly KEPT —
`import-wallet.tsx` calls `toast.success` and `app.tsx` mounts the Toaster.
A clean-install check on the branch itself (detached worktree at 82970d2)
passed: `npm ci` 0, tsc 0, build 0, vitest 460/460.
`DIAGNOSTICS.md` kept as the lane's durable record (build/test/dependency
health, ecdsa PYSEC-2026-1325 accept-and-document).
Conflict: `apps/web/package.json` — kept org-requirements' jsqr/long/viem
pins and took diagnostics' 20 dep removals; `npm ci` rc=0 after resolution.
Desktop-layout cross-check: that branch imports none of the deleted
components, so this merge does not block it.
Verification after merge (final state): tsc 0, build 0, vitest **460/460**
(457 + 3 new fee-cap tests), root tests 381/382 (only the Android
environmental failure), `test/*.test.js` 3/3, root `npm test` pass, Python
89/30 OK.

## Scratch files excluded from the merges (not deleted)

The programme keeps lane logs outside the repo (`bawa-org/`,
`bawa-prompts/`); adopt-proper carried no lane log files at `e493720`.
The following were excluded from the merge commits by `git rm -f` during
`--no-commit` merges. The originals remain on the unmerged branch refs, so
nothing is lost:

- org-requirements: `lane-c-sol*.log/.txt/.out.md` (9 files), `RUN-LOG.jsonl`.
- org-naming: `sol/*.log`, `sol/prompt*.md`, `sol/out*.md` (12 files),
  `RUN-LOG.jsonl`.
- org-diagrams: `lane-d/*.log`, `lane-d/*-prompt.md`, `lane-d/sol*.md`
  (Sol raw outputs), `lane-d/RUN-LOG.jsonl`.
- org-diagnostics: no scratch files on the branch (nothing excluded).

Durable lane records were kept: `NAMING-MAP.md`, `LANE-C-REPORT.md`,
`lane-d/AUDIT.md` (+ `.mmd`/`.svg`/verify script), `DIAGNOSTICS.md`,
`docs/BRANCH-DOC-STATUS.md`.

## Open items

### (a) ADR 0006 collision — FIXED on a new branch (b0365ba, not pushed)

`panel-rebuild/multichain-create` created `docs/adr/0006-price-feed-provider.md`
while adopt-proper already holds `docs/adr/0006-use-case-split.md` (preserved
from docs-usecase-split at `e493720`). Same number, two decisions. On new
local branch `panel-rebuild/multichain-adr0007` (off multichain-create
`40d8cc5`): renamed to `docs/adr/0007-price-feed-provider.md`, title changed
to ADR-0007, and added the 0007 row to `docs/adr/README.md` (which had never
indexed the price-feed ADR). Verified first-hand: no other file referenced
`0006-price-feed-provider.md`, no test asserts ADR numbering,
`tools/check-links.py` OK (109 files). Not pushed. The use-case-split ADR
was not restored onto multichain-create — that deletion is multichain-create's
own history and the content is preserved on adopt-proper.

### (b) lane/ scratch files on multichain-create — LEFT AS-IS

No deletion. Evidence first-hand: `lane/evidence/*` are referenced
provenance (`registry/profiles.json:627` and
`ai/profiles/multichain-extended-wallet.md:50` cite
`lane/evidence/probe-2026-11-20.jsonl`; `lane/report-b.md` cites the
evidence dir), so deleting them would break live references.
`lane/report-b.md` is the multichain-registry lane's durable record.
`lane/run-log-a..e.jsonl` are unreferenced process artifacts, but their
content is not preserved elsewhere and deleting five small files from an
already-pushed branch on a local-only branch buys nothing. Leave all of
`lane/` in place.

### (c) Stale-data M-31 test — FIXED (9f06e41)

`tests/stale-data.test.mjs:147` asserted M-31 `**Status:** OPEN` while
Doc 4 §21 row M-31 reads `**Status:** CLOSED (owner, 2026-11-13)` (owner
accepted Sol's fresh-context re-audit R02 as the review-gate evidence) and
`docs/index.md:93` says the same. The test failed 1 of 7 at baseline. One-line
fix in the test only (the guide is the authority and already says CLOSED);
verified 7/7 pass. The row still carries its 2026-11-12 verification note,
so the test's date assertion is unaffected.

### (d) Classifier testnet sentence — FIXED (e10794b)

`scripts/classify-request.mjs:367` said "I cannot support mainnet use
without separate approval; the default scope is testnet." The second clause
is stale: the direction is mainnet-first (ADR-0003), an unnamed network
stays OPEN, and a refused request builds nothing — `build-wallet.mjs`
writes a refusal report (profile null, exit 2), so there is no testnet
fallback for the clause to describe. Verified first-hand that
`findRefusal` fires before classification (`classify-request.mjs:429`,
`build-wallet.mjs:100-116`). Sol (gpt-6.1-sol, API 1) analysed the sentence
and recommended dropping the clause; the minimal replacement was adopted:
"I cannot support mainnet use without separate approval." Updated in code,
the `ai/request-routing.md` verbatim table, all six
`tests/classifier.test.mjs` places, and the two doc mentions
(`docs/BRANCH-DOC-STATUS.md`, `docs/CAPABILITY-MAP.md` — the latter's
"partly resolved" entry is now marked resolved). The
`ai/request-routing.md` 2026-11-20 note was rewritten to record the change
instead of describing the old wording. `scripts/generate-project.mjs:215`
("- Testnet only..." for generated Android projects) is unchanged — it is a
separate, true per-platform scope statement. Verified live:
`findRefusal('Deploy the wallet on mainnet')` returns the new sentence;
`node --test tests/classifier.test.mjs tests/generate-project.test.mjs`
47/47 pass.

## Desktop-layout — out of scope for this lane

`panel-rebuild/desktop-layout` (b43c2eb) was not merged, left or discarded by
this lane: it is the base of the parallel fix-preview-gaps programme, which
works on a new branch off it. Recorded interaction only: the diagnostics
merge deletes no component that desktop-layout imports, and desktop-layout's
sonner/toast usage is unaffected (sonner was kept).

## Sol calls

One Sol call (gpt-6.1-sol, API 1 only, max reasoning, 32,000 cap), for the
classifier-sentence analysis (open item d). Prompt
`bawa-org/lane-b/sol1-classifier-prompt.md` (3,242 bytes), output
`bawa-org/lane-b/sol1-classifier-out.md` (2,768 bytes). The first launch
failed on mechanics (background AND-chain killed at exec teardown before
setsid ran; zero model time) and was relaunched with setsid first; landed
in ~2 minutes. No 402/403. Every Sol claim was verified first-hand before
being acted on (refusal path, all 8 sentence locations, generate-project
exclusion). All git checks, edits, builds, tests and merges were done
hands-on by the lane, not by Sol. Full log: `bawa-org/lane-b/RUN-LOG.jsonl`.

## Skills used (read first-hand, what each changed)

- `git-workflow-and-versioning` — merge discipline: one logical merge per
  branch, separate commits for the M-31 fix and the classifier change,
  `--no-commit` merges with conflicts resolved hands-on, no pushes, no
  branch deletions; drove the per-merge verification loop.
- `code-review-and-quality` — five-axis review of each branch before
  merging; dependency discipline (lockfile honesty, `npm ci` after every
  package.json change) drove the pin review and the diagnostics verdict.
- `documentation-and-adrs` — ADR numbering convention (continue the
  sequence, never delete an ADR) drove the 0006 → 0007 renumber; dated
  entries appended, never rewritten, for the doc updates.
- `docs-governance` — one home per fact; drove the decision to exclude lane
  process logs from the repo tree (the programme keeps them in `bawa-org/`).
- `dead-code-cleanup` (read on gray-pinee) — search-before-delete and
  compiler-as-safety-net drove the diagnostics reference verification and
  the clean-install check; its "follow the dependency chain" rule is what
  caught the need to check `sonner`'s import chain (kept, correctly).
- `verify-before-claim` — first-hand re-verification of every delegated
  claim; the clean-install `npm ci` on a detached worktree (not the stale
  worktree `node_modules`) is what established the diagnostics branch is
  green, and re-checking the diff is what corrected an initial misread of
  the `sonner` removal (sonner was never removed).

Searched but NOT applied: `merged_deliverable_verification` (assembled
documents, not branch merges); `open_code_review`, `gh_pr_review`,
`pr_feedback_quality_gate` (PR-review flows — no PR exists here);
`translate_docs`, `documentation_generation`, `doc_coauthoring`
(document production, not this lane's decisions); `local_external_delegate`
(the lane used the Sol runner directly, one call); `security-and-hardening`,
`webapp-testing` (cited in DIAGNOSTICS.md but not re-read; the lane's own
first-hand checks covered the ground instead).

## Remaining risks / decisions for the coordinator

- The clean-checkout Android test still fails at final HEAD (environmental:
  no `JAVA_HOME`/`ANDROID_HOME` on gray-pinee; plan rejected exit 2). It is
  a test-tolerance issue, not a code defect; needs a machine with an Android
  SDK or a test change. Not this lane's scope.
- `mnemonic-words` remains a runtime dependency in `apps/web/package.json`
  (the Phase 4 open item "mnemonic-words → devDependencies" is untouched).
- The `boundary` chunk warning (2,899.89 kB) persists in every build; known
  wallet-core WASM glue chunk, unchanged by these merges.
- Temp worktrees left on gray-pinee for inspection:
  `/home/boxd/workspace/bawa-org/lane-b/tmp-diag` (detached at 82970d2,
  diagnostics clean-install evidence) and
  `/home/boxd/workspace/bawa-org/lane-b/tmp-adr0007` (branch
  `panel-rebuild/multichain-adr0007` at `b0365ba`). Neither holds uncommitted
  work. Lane logs and verification logs: `/home/boxd/workspace/bawa-org/lane-b/`.
