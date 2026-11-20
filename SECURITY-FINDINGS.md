# Security findings — deferral register

This file is the **deferral register**: accepted residual risks and
deferred security findings, each with a reason, an owner, and a review
date. It is not the findings file. The canonical findings register is
`docs/SECURITY-FINDINGS.md` (14 items, Lane D, 2026-11-20); a finding
lives there, and its deferral decision lives here, with a pointer to
the finding. One home per fact: do not copy a finding into this file.

## Deferrals

### D-ecdsa-0.19.2 — ecdsa 0.19.2 (PYSEC-2026-1325 / CVE-2024-23342)

| Field | Value |
| --- | --- |
| Finding | `docs/SECURITY-FINDINGS.md` item 1 (ecdsa 0.19.2 — Minerva timing attack on P-256, `sign_digest()` nonce leak). |
| Status | Accepted residual risk, documented. There is no fix version; upstream considers side channels out of scope. |
| Reason | The advisory is P-256-specific and our tools never sign: `bip_utils` selects the coincurve backend for secp256k1 (verified first-hand 2026-11-20), our curves are secp256k1 (BTC/ETH/TRX) and Ed25519 (TON), and no code path in our tools reaches the P-256 classes or the ecdsa signing path. A Minerva attack needs timed signatures; we produce none. Full reachability evidence is in the finding, not repeated here. |
| Owner | **PENDING — no owner acceptance order is on record.** The acceptance is a lane verdict (diagnostics 2026-11-19, re-verified by Lane D 2026-11-20), not an owner decision. This deferral cannot be closed without the owner's word. |
| Recorded | 2026-11-20 (Lane P5, repo-study Phase 3, item 26). |
| Review date | 2027-02-20 (90 days), or sooner if the re-review trigger fires. |
| Re-review if | Crypto usage or dependencies change: a new signing path, `coincurve` dropped, `ecdsa` bumped, or a non-lockfile install without `coincurve` (which would select the ecdsa backend). |

## Rules for this file

- A deferral without an owner and a review date is not a deferral.
- An expiry more than 90 days out is not an expiry.
- When a deferral is closed (fixed, or accepted by the owner), record
  the closing decision and date here and update the finding in
  `docs/SECURITY-FINDINGS.md`. Do not delete the row: the history of
  what was deferred, and why, is the audit trail.
