# Review rules

These rules govern every review of Bawa — human, delegated, or lane-based.
A review that does not follow them is not a review; it is a read-through.

## 1. Per-path rules

Rules are checked at the path, not the topic. A file is reviewed against
the rules of its path first; general quality judgement comes second.

| Path | Rules |
| --- | --- |
| `apps/web/src/wallet/` | No broadcast path built or enabled. No seed, mnemonic, private key, xprv or vault key in logs, errors, tests, or state. Adapters receive public addresses only, never secrets. No fake balances or prices: honest `unavailable` with a reason, never `$0.00`. |
| `apps/web/src/engine/` | No caller bypasses the boundary for engine access. WASM exceptions and null/empty engine returns are handled, never assumed away. No new native layer: the boundary is a narrow TypeScript facade. |
| `apps/web/src/state/` | No mnemonic, seed, private key or vault key in state. Refresh failures are explicit states, never swallowed. Last-good values are retained on failure, never replaced with zero. |
| `apps/web/src/screens/` | UI is presentation only: no derivation, storage, or signing policy in a screen. No secret echoed back in an error message. Send stages (review → sign → broadcast) stay distinct. |
| `apps/web/src/app/` | Security headers and the error boundary stay wired. No route added without its screen in the 14-screen contract. |
| `tools/`, `scripts/` | No secrets in source. Deterministic public fixtures only. A changed derivation path updates the docs and fixtures in the same change. |
| `docs/` | One home per fact (see `docs/inventory.md`). A code change lists its affected docs. No claim without evidence; no rewritten change log (append, dated). |
| `.github/` | No gate weakened to make a change pass. A removed check names its replacement or its owner decision. |

## 2. Severity and category taxonomy

Every finding carries one severity and one category. A finding without
both is incomplete.

**Severity**

| Severity | Meaning |
| --- | --- |
| Critical | Loss of funds, key exposure, or a bypass of a security boundary is possible. Stops the review. |
| High | A real defect with a concrete user or security impact, but not fund-loss. Must be fixed before merge. |
| Medium | A defect with a bounded impact, or a missing guard with a known trigger. Fix before merge, or track as an exception with an owner and expiry. |
| Low | Polish, clarity, or a latent issue with no known trigger. May be deferred with a reason. |

**Category:** bug, security, performance, maintainability, test, style,
documentation, other. Exactly one; if two apply, pick the one that
describes the loss, and name the other in the finding text.

## 3. Delegated, coverage-accounted review workflow

Bawa's own review lanes (including the repo-study lanes) run this workflow:

1. **Preview step.** Read the diff and the lane brief before reading any
   code. Restate the scope in the report; anything outside it is
   out of scope unless it is Critical.
2. **Per-file checklist.** Every in-scope file is checked against the
   per-path rules above and the lane's acceptance criteria. A file with
   no applicable rule is recorded as checked, not skipped.
3. **Coverage rate in the report.** The report states files reviewed /
   files in scope as a counted rate. An explained skip is accounted for
   but **must not count as reviewed**. "Not checked" is a section, not
   an omission (see §4).
4. **Validate only what changed.** A review validates the diff, not the
   whole tree. Pre-existing issues found on the way are reported
   separately as observations, never as blockers for the change unless
   they are Critical.
5. **SMALL_SCOPE.** A reviewable change is at most 1000 changed lines
   AND at most 20 files AND no binary. Above that, a reviewer-verifier
   pair is required: one reviewer reads for correctness, the verifier
   re-checks the findings against the code independently.
6. **Product Demand gate.** Owner decisions are a checkable gate. On a
   conflict between the work and a recorded owner decision, STOP the
   whole review and report the mismatch. Do not review around it.

## 4. Report templates

### Lane report (outcome first)

```markdown
# <Lane> report — <scope>

Outcome: <done / blocked / partial> — one line.
Decisions: <what was decided, and who owns each>.
Needed: <what is needed, from whom, by when>.
Coverage: <n> / <m> files reviewed.

## Must / Should / Nice-to-have
| Priority | What | Problem | Fix | If we skip it |
| --- | --- | --- | --- | --- |
| Must | ... | ... | ... | ... |

## Lean line
<counted line: e.g. "3 Must, 2 Should, 1 Nice-to-have; 12/12 files reviewed">

## Not checked
<what was in scope but not checked, and why>

## Finding ledger
| ID | Evidence | Confidence | Search boundary | Remaining unknowns |
| --- | --- | --- | --- | --- |
| F-01 | <file:line / command output> | high / medium / low | <what was searched> | <what is still unknown> |

## Observations vs inferences vs unknowns
- Observations: <what was directly seen>
- Inferences: <what was concluded, and from what>
- Unknowns: <what could not be established>
```

### Finding ledger rules

- Every finding has an evidence ID (file and line, or the exact command
  and its observed output). A finding without evidence is an opinion.
- Confidence is stated, not implied. Low-confidence findings are still
  reported, as low-confidence.
- The search boundary says what was searched, so a later reader knows
  what was *not* searched.

## 5. Phase-to-skill routing

The phase-to-skill routing table lives in `AGENTS.md` §7 — one home
for it, read before starting any phase of work. The repo-study exists
because skill use was selective; the table is the check that prevents
that. A lane prompt that names no skill must say why none applies.
"No skill fits" is a claim to record, not a default.

## 6. Plan-mode discipline

- `tasks/plan.md` holds the plan; `tasks/todo.md` holds the ordered task
  list with acceptance criteria. Plans are never overwritten: an
  incomplete plan is appended to, or superseded by a new dated plan that
  references it.
- Task-size cap: one task is one focused piece, small enough to implement
  and verify in a single session. A task that needs splitting is split
  before it is started, never mid-way.
- No-overwrite rule: a plan that is still being executed is not edited
  in place by another agent. Corrections go in as dated amendments.

## 7. Git-workflow rules

- Parallel agents work in worktrees on their own branches, never in the
  same checkout. Branches are local-only until verified and the owner
  gives the go-ahead (fix-review rule).
- Every report ends with a DIDN'T-TOUCH summary: files the lane
  considered and deliberately did not change, so the coordinator can see
  the boundary.
- Pre-commit hygiene: secret-scan the staged diff before committing
  (`scripts/secret-scan.mjs`); never commit `.env`, `secrets/`,
  `seed-backup/`, mnemonics, private keys, production xpubs, or real
  recovery material. A secret in a diff is reported, never pasted.

## 8. Definition of Done

The Definition of Done lives in `AGENTS.md` (§8) and applies to every
change. A change is done when the checks in `CONSTRAINTS.md` pass on its
files, the affected docs are listed and current, and the report states
what was verified, what was not run, and what remains open. A green
suite on an unreviewed scope is not done.
