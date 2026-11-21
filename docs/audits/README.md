# Audit evidence trail

This directory is the index of audit and review evidence for Bawa. It maps
reports to the commits they were made against, the components reviewed, and
the remediation evidence. It is an index, not a verdict: **the presence of
an audit does not establish that HEAD was audited.** Every entry names the
commit it covers; a report written against an older commit says nothing
about the current tree until it is re-run or explicitly re-confirmed.

## How to read an entry

| Field | Meaning |
| --- | --- |
| Report | The report file (in this repo or linked). |
| Commit | The exact commit the audit ran against. |
| Components | What was reviewed, by path. |
| Verdict | What the audit concluded, in its own words. |
| Remediation | Where the fixes landed (commits), or that they are still open. |

## Entries

| Report | Commit | Components | Verdict | Remediation |
| --- | --- | --- | --- | --- |
| `docs/SECURITY-FINDINGS.md` (Lane D, finalisation programme) | `panel-rebuild/org-security-docs` (2026-11-20) | Dependency and supply-chain surface; `tools/`, `requirements.lock` | 14 findings; ecdsa 0.19.2 recorded as accepted residual risk **without** an owner acceptance order | Open: owner acceptance for the ecdsa deferral is still needed. See `SECURITY-FINDINGS.md` (root deferral register). |
| Repo-study programme, Phase 2 (Lanes A–H) + Phase 3 apply plan | Base `panel-rebuild/repo-study` at `0fd3a2e` | `apps/web/src/wallet/`, `apps/web/src/engine/`, `apps/web/src/state/`, docs, CI | 381 patterns mined; 36 consolidated APPLY items; 44 FOUND-NOT-APPLIED entries | In progress: Phase 3 lanes P1–P5 on local-only branches; nothing merged, nothing pushed. See `bawa-repo-study-consolidation/APPLY-PLAN.md` (programme lane dir, not this repo). |

## Rules for adding an entry

- Name the commit. "Audited recently" is not a commit.
- Name the components by path. "The wallet" is not a component list.
- Record remediation as commits, or as open. A fix claimed without a
  commit reference is unverified.
- Never back-date coverage: if HEAD has moved past the audited commit,
  say so in the entry.
