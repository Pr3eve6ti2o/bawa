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
| `docs/SECURITY-FINDINGS.md` (Lane D, finalisation programme) | `panel-rebuild/org-security-docs` (2026-11-20) | Dependency and supply-chain surface; `tools/`, `requirements.lock` | 14 findings; ecdsa 0.19.2 recorded as accepted residual risk **without** an owner acceptance order | Update 2026-11-28 (docs-audit-b, token-gaps ceade79): the register now states §1 (ecdsa) "stands as accepted residual risk with re-review by 2027-05-20" and `npm audit` for the web app is 0 vulnerabilities at token-gaps `2205f15` (re-verified 2026-11-28). The "owner acceptance still needed" wording above is the 2026-11-20 record; see `SECURITY-FINDINGS.md` (root deferral register) for the current state. |
| Repo-study programme, Phase 2 (Lanes A–H) + Phase 3 apply plan | Base `panel-rebuild/repo-study` at `0fd3a2e` | `apps/web/src/wallet/`, `apps/web/src/engine/`, `apps/web/src/state/`, docs, CI | 381 patterns mined; 36 consolidated APPLY items; 44 FOUND-NOT-APPLIED entries | In progress: Phase 3 lanes P1–P5 on local-only branches; nothing merged, nothing pushed. See `bawa-repo-study-consolidation/APPLY-PLAN.md` (programme lane dir, not this repo). |
| Full-repo bug hunt (Lanes A–F) | Fix commits `8247437`, `f999ccf`, `ae135f8`, `d156657`, `7efba14` (final cleanup, 2026-11-27) | `apps/web/src/` (signing, vault, prices, tokens, UI), docs, CI | 69 findings (1 blocking use, 20 visible, 38 latent, 10 cosmetic); all fixed in the listed commits | Fixed and pushed at `7efba14`. No standalone bug-hunt report file exists in this repo; the fix commits are the remediation record. Added 2026-11-28 (docs-audit-b). |

## Rules for adding an entry

- Name the commit. "Audited recently" is not a commit.
- Name the components by path. "The wallet" is not a component list.
- Record remediation as commits, or as open. A fix claimed without a
  commit reference is unverified.
- Never back-date coverage: if HEAD has moved past the audited commit,
  say so in the entry.
