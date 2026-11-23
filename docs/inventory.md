# Docs inventory

One home per fact. This file is the inventory of `docs/`: 66 Markdown
files before Lane P5, 78 with Lane P5's 10 new files (ADR-0009 and
the 9 process docs below) plus Lane P2's 2 new files (vault-design, custody), 106 after the repo-study merge into adopt-proper (2026-11-22) adds 36 adopt-proper-side docs: ADRs 0007–0008, DECISIONS.md, RENAME-MAP.md, SECURITY-RELEASE-GATES.md and 31 archive files — and drops 8 rows whose files moved into `docs/archive/` (7) or were renamed (lowercase `security-release-gates.md` → uppercase), 107 after the layout-rebuild merge (2026-11-22) adds ADR-0010 (renumbered from 0009), 110 after the reverify-pro Lane 3 pass (2026-11-23) adds the 3 programme/how-to docs below (CREATE-EXAMPLE-WALLET, UI-UX-FIXES-PROGRAMME, UI-UX-ROUND2-PROGRAMME), 112 after the reverify-pro merge-lane pass (2026-11-23) adds the 2 reverify docs below (REVERIFY-PROGRAMME, REVERIFY-CHECKLIST). Who owns each doc and how fresh it is. A doc
without an owner here defaults to the repository owner
(**Pr3eve6ti2o**); a doc that needs a different owner must name one in
the table. "Last changed" is the last commit touching the file on this
branch (`git log -1 --format=%cs`), measured 2026-11-20. A recent date
is not proof the doc is accurate — it is proof the doc was touched.
Staleness is decided by the drift check (below), not by this table.

## Conventions (item 29)

- **One home per fact.** A fact lives in exactly one doc; other docs
  link to it instead of copying it. The README owns its subject and
  links its children rather than copying detail.
- **`docs:affected`.** Every code change lists its affected docs in the
  commit message or the change description, as `docs:affected:
  <paths>`. A source-prefix match (the changed file's directory matches
  a doc's subject) is a mandatory review prompt, not proof the prose
  needs a diff: the reviewer checks whether the prose changed, and
  says so either way.
- **Drift check.** CI `docs-checks` runs a code-versus-doc last-change
  comparison beyond the link checker: for each doc with a named code
  subject, if the code changed after the doc, the check fails with the
  doc's name. The comparison uses `git log` dates and merge-base
  ancestry (see `documentation-and-adrs`: a doc whose staleness cannot
  be determined is reported as "can't tell", never as current).
- **Fresh-reader test.** Before accepting a substantial change to
  `README.md` or `WALLET_BUILDER.md`, a fresh agent given only the doc
  must perform its task. A doc that fails the fresh-reader test is not
  accepted, however well it reads.
- **TEMP-VERIFY marker rule.** A temporary test hook is marked
  `TEMP-VERIFY` in the code and grepped before commit
  (`grep -rn "TEMP-VERIFY" -- apps/web/src scripts tools`). A
  TEMP-VERIFY marker that survives into a commit is a failed check.
- **Diagrams.** Code-derived diagrams (adapter boundary, vault state
  machine, refresh dataflow) are generated from the code, not drawn by
  hand; a validation gate fails CI when a diagram drifts from the code
  it describes. No hand-drawn diagram is a source of truth.
- **Change logs are appended, never rewritten.** A doc with a change log
  gains a dated entry saying why it changed. Git keeps the old text;
  the log is the only record of the reasons.
- **Index.** `docs/index.md` is the docs sidebar/index (Diátaxis:
  tutorials, how-to, reference, explanation). Do not create a second
  docs root.

## Inventory

### Numbered guides (Docs 01–16)

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/01-fundamentals/README.md` | Pr3eve6ti2o | 2026-11-09 | |
| `docs/02-chains/README.md` | Pr3eve6ti2o | 2026-11-19 | Owned by P4 in Phase 3 (item 21). Do not edit in this lane. |
| `docs/03-tools-and-repositories/README.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/04-wallet-generation/README.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/05-watch-only/README.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/05-watch-only/gui-watch-only-workflow.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/05-watch-only/ton-watch-only-testing.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/06-tracking/README.md` | Pr3eve6ti2o | 2026-11-09 | |
| `docs/07-payment-tracking/README.md` | Pr3eve6ti2o | 2026-11-09 | |
| `docs/08-security-recovery/README.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/09-signing-and-hardware/README.md` | Pr3eve6ti2o | 2026-11-09 | |
| `docs/10-operations-and-testing/README.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/11-trust-wallet-and-independent-verification/README.md` | Pr3eve6ti2o | 2026-11-13 | Canonical fixture home (§5.3). |
| `docs/12-chain-registry-and-assets/README.md` | Pr3eve6ti2o | 2026-11-20 | Owned by P4 in Phase 3 (item 21). Do not edit in this lane. |
| `docs/13-wallet-app-architecture/README.md` | Pr3eve6ti2o | 2026-11-20 | |
| `docs/14-wallet-app-implementation/README.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/15-threat-model-and-theft-prevention/README.md` | Pr3eve6ti2o | 2026-11-09 | |
| `docs/16-security-decision-guide/README.md` | Pr3eve6ti2o | 2026-11-09 | |

### Specialist guides

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/web-wallet/WEB-GUIDE.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/android-wallet/ANDROID-GUIDE.md` | Pr3eve6ti2o | 2026-11-13 | |
| `docs/mainnet/MAINNET-GUIDE.md` | Pr3eve6ti2o | 2026-11-20 | |
| `docs/mainnet/MAINNET-GUARDS.md` | Pr3eve6ti2o | 2026-11-12 | |
| `docs/mainnet/MAINNET-SIGNING.md` | Pr3eve6ti2o | 2026-11-13 | |
| `docs/mainnet/MAINNET-UNSIGNED-TX.md` | Pr3eve6ti2o | 2026-11-12 | |
| `docs/mainnet/MAINNET-VECTORS.md` | Pr3eve6ti2o | 2026-11-13 | |
| `docs/mainnet/M35-REHEARSAL-PROCEDURE.md` | Pr3eve6ti2o | 2026-11-13 | |
| `docs/android-evidence.md` | Pr3eve6ti2o | 2026-11-10 | |

### Reference and index

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/index.md` | Pr3eve6ti2o | 2026-11-20 | The docs sidebar/index. No second docs root. |
| `docs/README.md` | Pr3eve6ti2o | 2026-11-09 | Documentation map. |
| `docs/README-FULL.md` | Pr3eve6ti2o | 2026-11-14 | Preserved 1,308-line README, verbatim. |
| `docs/CAPABILITY-MAP.md` | Pr3eve6ti2o | 2026-11-20 | |
| `docs/GLOSSARY.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/FAQ.md` | Pr3eve6ti2o | 2026-11-13 | |
| `docs/FURTHER-READING.md` | Pr3eve6ti2o | 2026-11-09 | |
| `docs/REFERENCES.md` | Pr3eve6ti2o | 2026-11-13 | |
| `docs/RECOVERY.md` | Pr3eve6ti2o | 2026-11-12 | |
| `docs/TESTING.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/IMPLEMENTATION.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/registry-maintenance.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/sample-requests.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/wallet-reference-map.md` | Pr3eve6ti2o | 2026-11-18 | |
| `docs/engine-reproducibility.md` | Pr3eve6ti2o | 2026-11-13 | Engine smoke suite 217 checks pass (2026-11-20). |
| `docs/accessibility-review.md` | Pr3eve6ti2o | 2026-11-10 | |
| `docs/UI-UX-CATALOGUE.md` | Pr3eve6ti2o | 2026-11-13 | |
| `docs/UI-UX-REFERENCE-RESEARCH.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/EXTERNAL-TOOLS.md` | Pr3eve6ti2o | 2026-11-14 | |
| `docs/EXTERNAL-TOOLS-RESEARCH-NOTES.md` | Pr3eve6ti2o | 2026-11-14 | |
| `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md` | Pr3eve6ti2o | 2026-11-19 | Governs architecture, phases, templates, gates, decisions. |
| `docs/vault-design.md` | Lane P2 | 2026-11-20 | Vault envelope, backup/migration, error table, KDF evaluation. |
| `docs/custody.md` | Lane P2 | 2026-11-20 | Custody guarantees/non-guarantees, unlock behaviour, test identities. |
| `docs/DECISIONS.md` | Pr3eve6ti2o | 2026-11-20 | Owner-delegated decisions register (ECDSA, confirmation policy, merges). |
| `docs/RENAME-MAP.md` | Pr3eve6ti2o | 2026-11-20 | Rename map (env/file renames). |
| `docs/SECURITY-RELEASE-GATES.md` | Pr3eve6ti2o | 2026-11-20 | Security release gates (renamed from lowercase `security-release-gates.md`). |

### Programme records

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/CREATE-EXAMPLE-WALLET.md` | Pr3eve6ti2o | 2026-11-23 | Create the pre-built example web wallet from a clean checkout. |
| `docs/UI-UX-FIXES-PROGRAMME.md` | Pr3eve6ti2o | 2026-11-23 | UI/UX Fixes programme record (21 items, merged into token-gaps). |
| `docs/UI-UX-ROUND2-PROGRAMME.md` | Pr3eve6ti2o | 2026-11-23 | UI/UX Round 2 programme record (10 items, merged into token-gaps). |
| `docs/REVERIFY-PROGRAMME.md` | Pr3eve6ti2o | 2026-11-23 | Reverify + Professional Polish programme record (5 lanes, merged into token-gaps). |
| `docs/REVERIFY-CHECKLIST.md` | Pr3eve6ti2o | 2026-11-23 | Reverify checklist: every owner order 2026-11-22 through 2026-11-23 ~18:14 IST, verdict + evidence per order. |

### Security

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/SECURITY.md` | Pr3eve6ti2o | 2026-11-20 | Canonical security summary. |
| `docs/SECURITY-FINDINGS.md` | Pr3eve6ti2o | 2026-11-20 | Canonical findings register (14 items). Deferral decisions live in the root `SECURITY-FINDINGS.md`. |
| `docs/SECURITY-AUDIT-TOOLCHAIN.md` | Pr3eve6ti2o | 2026-11-20 | Audit toolchain (§6: ecdsa adjudication). |

### ADRs

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/adr/README.md` | Pr3eve6ti2o | 2026-11-19 | ADR index. |
| `docs/adr/0001-wallet-core-pin.md` | Pr3eve6ti2o | 2026-11-14 | Engine pin 4.9.3. |
| `docs/adr/0002-ai-wallet-builder.md` | Pr3eve6ti2o | 2026-11-14 | |
| `docs/adr/0003-mainnet-first.md` | Pr3eve6ti2o | 2026-11-14 | |
| `docs/adr/0004-monorepo-by-deployable.md` | Pr3eve6ti2o | 2026-11-14 | |
| `docs/adr/0005-adopted-libraries.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/adr/0006-use-case-split.md` | Pr3eve6ti2o | 2026-11-19 | |
| `docs/adr/0007-price-feed-provider.md` | Pr3eve6ti2o | 2026-11-20 | CoinGecko keyless price feed provider. |
| `docs/adr/0008-ecdsa-residual-risk.md` | Pr3eve6ti2o | 2026-11-20 | ECDSA residual-risk acceptance; review date 2027-05-20. |
| `docs/adr/0009-fetchjson-no-retry.md` | Lane P5 | 2026-11-20 | New in this lane (item 29). Single-attempt transport. |
| `docs/adr/0010-guide-scope-extension.md` | Pr3eve6ti2o | 2026-11-20 | Guide scope extension beyond ten sections; supersedes ADR-0006's ten-section scope. Renumbered from 0009 by the layout-rebuild merge (2026-11-22). |

### Process docs (this lane, item 25/26/29/32/34)

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/inventory.md` | Lane P5 | 2026-11-20 | This file. |
| `docs/wallet-lifecycle.md` | Lane P5 | 2026-11-20 | Unlock → sign → broadcast → refresh. |
| `docs/review-rules.md` | Lane P5 | 2026-11-20 | Per-path rules, severity taxonomy, review workflow. |
| `docs/release-procedure.md` | Lane P5 | 2026-11-20 | Tagged baseline + rollback (full ceremony deferred). |
| `docs/launch-checklist.md` | Lane P5 | 2026-11-20 | Pre-B-1 checklist. |
| `docs/runbooks/refresh-failure.md` | Lane P5 | 2026-11-20 | Refresh failure states and triage. |
| `docs/runbooks/ton-refresh.md` | Lane P5 | 2026-11-20 | TON flakiness. |
| `docs/runbooks/price-feed.md` | Lane P5 | 2026-11-20 | Price feed by reference only (multichain-create). |
| `docs/audits/README.md` | Lane P5 | 2026-11-20 | Audit evidence trail. |

### Archive (adopt-proper side, 2026-11-20 programme work — kept as evidence, not live guidance)

| Doc | Owner | Last changed | Notes |
| --- | --- | --- | --- |
| `docs/archive/mainnet-gap-assessment.md` | Pr3eve6ti2o | 2026-11-20 | Archived mainnet gap assessment. |
| `docs/archive/archival-tags.md` | Pr3eve6ti2o | 2026-11-20 | Archived archival-tags record. |
| `docs/archive/branch-doc-status.md` | Pr3eve6ti2o | 2026-11-20 | Archived branch doc status. |
| `docs/archive/branch-audit.md` | Pr3eve6ti2o | 2026-11-20 | Archived branch audit. |
| `docs/archive/multibranch-report.md` | Pr3eve6ti2o | 2026-11-20 | Archived multibranch report. |
| `docs/archive/bawa-env-rename-plan.md` | Pr3eve6ti2o | 2026-11-20 | Archived env rename plan. |
| `docs/archive/handoff-2026-11-10.md` | Pr3eve6ti2o | 2026-11-20 | Archived handoff note. |
| `docs/archive/lane-evidence-2026-11-20/README.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane evidence index. |
| `docs/archive/lane-evidence-2026-11-20/report-b.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane evidence report B. |
| `docs/archive/lane-d-diagrams-2026-11-20/AUDIT.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane D diagrams audit. |
| `docs/archive/web-verification-2026-11-20/implementation-report.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification implementation report. |
| `docs/archive/web-verification-2026-11-20/rebuild-evidence.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification rebuild evidence. |
| `docs/archive/web-verification-2026-11-20/verify-a-build.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification: build. |
| `docs/archive/web-verification-2026-11-20/verify-b-derive.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification: derive. |
| `docs/archive/web-verification-2026-11-20/verify-c-addrs.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification: addresses. |
| `docs/archive/web-verification-2026-11-20/verify-d-balances.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification: balances. |
| `docs/archive/web-verification-2026-11-20/verify-e-sign.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification: signing. |
| `docs/archive/web-verification-2026-11-20/verify-f-secrets.md` | Pr3eve6ti2o | 2026-11-20 | Archived web verification: secrets. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/README.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F layout evidence index. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/DESIGN-SPEC.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F layout design spec. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/sol-prompt-app-layout.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F Sol prompt: app layout. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/sol-output-app-layout.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F Sol output: app layout. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/sol-prompt-sidebar-nav.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F Sol prompt: sidebar nav. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/sol-output-sidebar-nav.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F Sol output: sidebar nav. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/sol-prompt-design-spec.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F Sol prompt: design spec. |
| `docs/archive/lane-f-layout-evidence-2026-11-20/sol-output-design-spec.md` | Pr3eve6ti2o | 2026-11-20 | Archived lane F Sol output: design spec. |
| `docs/archive/programme-reports-2026-11-20/ORG-FINALISATION.md` | Pr3eve6ti2o | 2026-11-20 | Archived programme report: org finalisation. |
| `docs/archive/programme-reports-2026-11-20/MULTICHAIN-ASSESSMENT.md` | Pr3eve6ti2o | 2026-11-20 | Archived programme report: multichain assessment. |
| `docs/archive/programme-reports-2026-11-20/FINAL-REPORT.md` | Pr3eve6ti2o | 2026-11-20 | Archived programme final report. |
| `docs/archive/programme-reports-2026-11-20/LANE-C-REPORT.md` | Pr3eve6ti2o | 2026-11-20 | Archived programme report: lane C. |
| `docs/archive/programme-reports-2026-11-20/DIAGNOSTICS.md` | Pr3eve6ti2o | 2026-11-20 | Archived programme diagnostics. |

### Out of this lane's scope (named so nobody re-invents them)

- `docs/02-chains/README.md` and `docs/12-chain-registry-and-assets/README.md`
  — P4 (registry and pin table).
- `apps/web/src/engine/confirmation-policy.md` — P3 (engine).
