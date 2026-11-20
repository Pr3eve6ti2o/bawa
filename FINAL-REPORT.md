# Bawa repo-organisation + desktop-layout — Finalisation report

**Date:** 2026-11-20. **Owner order:** 2026-11-20 ~13:56 IST (finalise the programme properly; do not make unnecessary changes just to claim completion). **Coordinator:** finalisation coordinator, Sol 6.1 / API 1 / max reasoning. **Remote:** 4 branches, unchanged (main `74ae078`, main-adopt-fixes `df3dd25`, adopt-proper, multichain-create `40d8cc5`). **No branch was pushed. No merge into main. No branch deleted.**

## Completed

### Phase 0 — Archival tags (owner said YES; done first, verified)
Two annotated tags created, pushed, and verified by fresh `ls-remote` + `git ls-tree`/`git show`:
- `archive/docs-usecase-split` — tag `529da466` → commit `7e543ec`. Preserves the 27-commit use-case-split line (ADR blob `cdb9089`, `docs/standards.md`, `scripts/check-links.py` blob `3a177f7`).
- `archive/feat-trust-wallet-reference-implementation` — tag `89c0f97b` → commit `39a98e5`. Preserves the 33-commit reference-implementation line (`generate.js` blob `4079afb`, docs/01–12).
- Pre-existing: `archive/hd-wallet-professional` — tag `cc028e05` → `4272a82` (README-FULL blob `0495a44`, 2,834 lines / 81,780 bytes).
Both tips were confirmed present on gray-pinee before tagging; no prune ran. All three tags are documented in `docs/ARCHIVAL-TAGS.md` (249 lines, merged as `3654368`).

### Phase 1 — Loss audit re-verified (Lane A)
Verdict **confirmed**: nothing important lost. `LOSS-AUDIT.md` updated (26,143 → 40,732 bytes, dated re-verification section appended; backup `LOSS-AUDIT.md.bak-2026-11-20`). Corrections: `docs/standards.md` coverage is 7/12 links in `docs/REFERENCES.md` (all 12 survive repo-wide); `tools/bawa_cli.py` is 1,045 lines, not 1,046. The §7 prune risk is **closed** — all four deleted tips are now tag- or ancestor-protected. One real gap flagged (not a loss): the Nova Shop runbook (~170 lines) is absent as a coherent section from the live docs; it is preserved verbatim in the tag. **Owner decision needed** on whether to restore it to the live docs.

### Phase 2 — Org finalisation (Lane B)
All 5 org branches **merged into adopt-proper**, each verified after merging (tsc 0, build 0, vitest, root suite, Python 89/30):
- org-docs → `a6a8953`; org-requirements → `abc15d6`; org-naming → `6279a59`; org-diagrams → `2316e9a`; org-diagnostics → `c2c1fca` (vitest 460/460 at that point).
- ADR 0006 collision **fixed** on new local branch `panel-rebuild/multichain-adr0007` (`b0365ba`, not pushed): `0006-price-feed-provider.md` → `0007-price-feed-provider.md`.
- `lane/` scratch files **left as-is** (referenced provenance; deletion would fail the "content preserved elsewhere" test).
- M-31 stale-data test **fixed** (`9f06e41`, one line, now 7/7 pass).
- Classifier testnet sentence **fixed** (`e10794b`, code + docs + all 6 test places; 47/47 tests pass).
- Record: `ORG-FINALISATION.md` in adopt-proper.

### Phase 3 — Layout verification + fixes (Lane C)
Branch `panel-rebuild/desktop-layout-final` at `a84d4eb` (local only, **not** merged into adopt-proper or multichain-create — integration is a separate decision). All 7 gaps from the live re-verification closed:
- Welcome is now a two-column `lg` layout; lock centres in the shell; create-wallet **keeps** the 480px column with a documented Bawa Balanced justification.
- **Price feed was not a regression** — `prices.ts` is byte-identical to multichain-create. The live failure was no auto-fetch by design + likely shared-IP 429. Fix: auto-fetch on mount + 60s interval. Live CDP proof: 2 CoinGecko requests, both HTTP 200. No fake prices.
- Dev copy scrubbed site-wide (0 occurrences of repo paths/hashes/WASM/"Build brief" on /create); `xpub` kept as the correct domain term.
- Text joins fixed (real text spaces; `innerText` shows 0× "Step2of"/"aEthereum"/"TONhistory"); "Step 1 of 4" renders correctly; "Enter a Ethereum" → "Enter an Ethereum".
- Contrast: 0 low-contrast elements on all 16 routes (computed-contrast audit); new tokens `--primary-solid` 5.36:1, `--step-pending-text` 4.65:1.
- Mobile 390px verified by headless CDP with screenshots viewed; one real problem found and fixed (sticky bottom nav hid the last ~40px; `main` now `pb-24` below `lg`).
- Gates: tsc 0, vitest 566 passed + 1 skipped, build 0, npm audit 0.
- **Fresh preview (verified by the coordinator with curl):** https://zlvro-185-209-179-229.run.pinggy-free.link — root 200, served JS `index-BUlVWxQt.js`, hash `5e783996…` matches the verified build. Expires ~15:48 IST.

### Phase 4 — Security / dependency / deleted-component documentation (Lane D)
Branch `panel-rebuild/org-security-docs` (`86aa27a`), merged into adopt-proper as `d6b993a`. Register: `docs/SECURITY-FINDINGS.md` (14 items).
- ecdsa 0.19.2 (PYSEC-2026-1325 / CVE-2024-23342): accepted residual risk, documented with evidence (pip-audit 2 records, no fix versions; `USE_COINCURVE: True`; our tools never import ecdsa and never sign). **Note: risk acceptance is a lane verdict — no owner acceptance order is on record. Owner decision needed.**
- Both formatFeePreview DoS caps documented (100 decimals fixed in Lane D; 1,000 digits fixed on the diagnostics branch, now merged).
- Deleted components (36 UI + ThemeToggle + 20 deps, +166/−5,047) recorded with the recovery path (`git show 82970d2^:<path>`); desktop-layout imports none of them.
- `mnemonic-words` moved to devDependencies (verified: install clean, build 0, vitest 457/457 on that branch).
- Secret-scan gate **PASS** on the merged tree. Other items documented-still-open, with corrections to the brief (confirmation-policy.ts has 54 tests, not 29; npm outdated is 53 packages, not 50; Android "40 unexecuted" is not established — counts from different revisions).

### Phase 5 — Archival-tag documentation (Lane E)
`docs/ARCHIVAL-TAGS.md` (249 lines) in adopt-proper, merged as `3654368`. All SHAs re-verified first-hand. Corrections: the feat tip holds docs/01–12 (not 01–08). Trap documented: main still has a `docs/README-FULL.md`, but it is a different blob (1,285 lines) — the preserved pre-audit blob exists only via the tag. Lane E's Sol review call **failed** (max_output_tokens, no output file) and was **not** retried — the doc is first-hand-verified and a prose re-review adds little; recorded here so it is not hidden.

## What changed (adopt-proper, local only)
Adopt-proper HEAD is now `d6b993a` (was `e493720`). Merges, in order: `a6a8953` (docs), `abc15d6` (requirements), `6279a59` (naming), `2316e9a` (diagrams), `c2c1fca` (diagnostics), `9f06e41` (M-31 test), `e10794b` (classifier sentence), `3654368` (archival-tags doc), `d6b993a` (security docs). Worktree clean. New local branches (unpushed): `panel-rebuild/desktop-layout-final` (`a84d4eb`), `panel-rebuild/multichain-adr0007` (`b0365ba`). `LOSS-AUDIT.md` updated in `/home/boxd/workspace/bawa-org/` (not a repo branch).

## What was verified (final tree, coordinator, first-hand)
- `npm ci` (apps/web): 0 vulnerabilities. `tsc --noEmit`: 0 errors. `npm run build`: 0 (9.48s; the only warning is the known 2.9 MB `boundary` chunk).
- Vitest: 460 tests. Full-suite runs under VM load (load average 5–9 from parallel lanes) showed 7 non-deterministic 5000ms-timeout flakes in WASM/crypto-heavy tests, with a different failing set each run; the 5 affected files pass **21/21** with `--testTimeout=30000`. This is environmental load flaking, not a regression — the same files passed 460/460 in Lane B's quieter run. Recorded honestly here.
- Python: `test_make_wallet.py` 89/89 OK, `test_decrypt_seed.py` 30/30 OK.
- Root suite: zero `not ok` lines; "All register-links checks passed". (Lane B's baseline was 381/382, the single failure being the clean-checkout Android test — environmental, no Android SDK on the VM.)
- `mnemonic-words` in devDependencies, lockfile `dev=true`; viem 2.58.0 / jsqr 1.4.0 / long 5.3.2 pins preserved; diagnostics dep removals preserved.
- Preview: root 200, served JS `index-BUlVWxQt.js` matches the verified build hash.
- AVOID-list grep: 0 hits (lanes). No branch pushed. No merge into main. No prune ran.

## Remaining risks
- Vitest 5000ms timeout flakes under VM load (environmental; tests pass with a 30s timeout). Worth a timeout/config look if the suite is run on a loaded machine again.
- Clean-checkout Android test fails (environmental; needs an Android SDK machine or a test-tolerance change).
- The desktop-layout-final branch is not merged anywhere; the multichain-adr0007 branch is not pushed. Both need a decision.
- Lane E's Sol review failed on the 32k cap and was not retried (doc merged as first-hand-verified).
- Send-flow step circles were verified by code + token math, not a live render (needs an unlocked vault; headless cannot render it).

## Decisions needed from the owner
1. **Nova Shop runbook** — restore the ~170 lines to the live docs, or leave it preserved only in the tag? (Lane A flagged it as a real live-docs gap.)
2. **ecdsa risk acceptance** — confirm the accept-and-document verdict (PYSEC-2026-1325 / CVE-2024-23342, no fix version exists). No owner acceptance order is currently on record.
3. **Desktop-layout-final integration** — merge `panel-rebuild/desktop-layout-final` (`a84d4eb`) into adopt-proper (or multichain-create), leave it as a separate branch, or discard it?
4. **Push `panel-rebuild/multichain-adr0007`** (`b0365ba`, ADR 0006 → 0007 renumber) to the remote?
5. **confirmation-policy.ts** — integrate it or keep it spec-only? (54 tests, no production importer.)

## Sol calls (all lanes)
7 calls total, 6 landed, 1 failed. Lane A: 2/2 (~111s). Lane B: 1/1 (~2 min). Lane C: 2/2. Lane D: 1/1 (142s). Lane E: 1 call failed (max_output_tokens, no output) — not retried. Prompts were kind and clear; all under 500s except Lane E's review call, which ran 700s+ before failing on the cap (flagged, not hidden).

## Skills actually used (name + what each changed)
- **git-workflow-and-versioning** — merge discipline and atomic commits (Lane B); annotated tags as source of truth and separate worktrees (Lane E); branch-reference deletion cost lens (Lane A).
- **verify_before_claim** — re-running every loss-audit number first-hand (Lane A); clean-install check on a detached worktree (Lane B); every tag SHA/blob/count re-verified (Lane E).
- **code-review-and-quality** — five-axis review and lockfile discipline (Lane B).
- **docs-governance** — one home per fact (Lanes D, E); lane logs belong outside the repo (Lane B).
- **documentation-and-adrs** — ADR sequencing and dated append-only updates (Lanes B, D, E).
- **security-and-hardening** — reachability-based dependency triage for ecdsa; native audit against the lockfile (Lane D).
- **dead-code-cleanup** — verify-before-delete, test-only-use-is-alive-use (Lanes B, D).
- **frontend-design** — two-pass plan-then-build, restraint (Lane C).
- **frontend-ui-engineering** — landmarks, active-state markers, 44px targets, focus rings (Lane C).
- **accessibility-engineering** — computed-contrast audit, text-space fixes (Lane C).
- **performance-optimization** — measure-first, price-feed auto-fetch investigation (Lane C).
Skills searched but not applied are recorded in each lane's report (Lane A: seo-audit, aso, merged_deliverable_verification, local-external-delegate; Lane B: merged_deliverable_verification, open_code_review, gh_pr_review, pr_feedback_quality_gate, translate_docs, documentation_generation, doc_coauthoring, local_external_delegate, security-and-hardening, webapp-testing; Lane C: frontend-dev, frontend-skill, web-design-guidelines, form-design, animation-performance, emil-design-eng; Lane D: code-review-and-quality, webapp-testing, documentation-generation; Lane E: documentation-generation, translate-docs, doc-coauthoring, knowledge-organization).
