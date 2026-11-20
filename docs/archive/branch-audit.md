# BRANCH-AUDIT.md

- **Repository:** `Pr3eve6ti2o/bawa`
- **Audit date:** 2026-11-14
- **Method:** Supplied first-hand inspection of branch worktrees at `/home/boxd/workspace/bawa-multibranch/<branch>/`; feature live-working-copy evidence is identified separately.
- **Ref warning:** The bare-repo refs are **STALE, pre-audit commits**. This audit uses worktree HEADs, not those refs.
- **Owner constraint:** All five branches must stay as they are. No branch consolidation or publication is authorised by this audit.

## Branch snapshot

All reported trees are clean. “Runnable” below describes the implementation surface present, not a newly verified execution result.

| Branch | Tip commit | Tracked files | README lines | Characterisation |
|---|---|---:|---:|---|
| `main` | `16c074e` | 51 | 1,275 | Existing wallet implementation and documentation; not the full builder. |
| `docs-usecase-split` | `c0be1eb` | 12 | 61 | Documentation-only use-case split experiment. |
| `feat/trust-wallet-reference-implementation` | `44ea253` | 38 | 108 | Reference engine and verification-documentation slice. |
| `hd-wallet-professional` | `680c721` | 1 | 2,834 | Single-document HD-wallet guide. |
| `feature/ai-wallet-builder` | `42e765a` worktree lane; `85b8d47` live working copy | 321 worktree; 322 live | 1,308 | Full AI Wallet Builder programme. |

The feature live working copy is at `85b8d47`, a merge of `9750a91` and `27ff384`. Its additional file is `docs/MULTIBRANCH-REPORT.md`, the prior audit record; preserve it.

## Branch-by-branch findings

### `main`

- **Contains:** Root documentation, manifests, environment template, editor/Git configuration and CI; `docs/01–16` and supporting FAQ, glossary, recovery, reference, security and testing material; Android/web guides and the sole mainnet document, `MAINNET-GUIDE`.
- **Implementation:** `make_wallet.py`, `decrypt_seed.py`; hdwallet-gen generate/derive/derive_daemon/compare/extended-key tooling, package manifest and lockfile; `differential_test.py`, `smoke.test.js`, `test_make_wallet.py`.
- **Lacks:** `AGENTS.md`, `WALLET_BUILDER.md`, `ai/`, `registry/`, `scripts/`, `apps/`, `templates/`, `derive-ton.js`, mainnet tools, the extra `docs/05` files, and mainnet documentation beyond `MAINNET-GUIDE`.
- **Runnable:** Existing wallet-tooling/test tree, but not the feature builder or planned launcher. Wallet-core is pinned to **4.8.4**, stale relative to feature’s **4.9.3**.

HEAD is `16c074e`, “docs: audit and sync documentation and dependency pins for main”. The README begins `# Bawa — How to run it`; its verified-on table references repair commit `e3b65fb8` and reports **Partially verified**.

### `docs-usecase-split`

- **Contains:** A 61-line README with a use-case chooser linking `docs/01–10`, those ten READMEs, and `docs/README.md`.
- **Lacks:** Code, tests, tooling and `package.json`.
- **Runnable:** **No.** This is a documentation split experiment, not an executable checkout.

### `feat/trust-wallet-reference-implementation`

- **Contains:** Root documentation; `docs/01–12`, RECOVERY, REFERENCES, SECURITY and TESTING; `make_wallet.py`, `decrypt_seed.py`, and hdwallet-gen generate/derive/derive_daemon/compare. Tests are limited to `differential_test.py` and `smoke.test.js`.
- **Lacks:** `extended-key.js`, `derive-ton.js`, `docs/13–16`, Android/web guides, mainnet documentation, and `ai/`, `registry/`, `scripts/`, `apps/`, `templates/`.
- **Runnable:** Reference-tooling slice, not the full builder. For this DX run it is a documentation source, not a launcher-routing target.

### `hd-wallet-professional`

- **Contains:** Only `README.md`, headed `# Bawa — HD Wallets, Derivation, Recovery & Tracking: A Practical Guide`.
- **Lacks:** Every implementation file, manifest, environment template and test.
- **Runnable:** **No.** Its explicit branch-scope notice says setup/test commands cannot run from this checkout; the runnable implementation is on `main`.

### `feature/ai-wallet-builder`

- **Contains:** Main’s implementation/documentation surface, with differing shared content, plus:
  - `AGENTS.md`, `WALLET_BUILDER.md`; `ai/` capability detection, seven profiles, eight prompts and request routing.
  - `registry/` profiles/capabilities/engines/UI and schemas; `scripts/` build-wallet, project generation, classification, quality gates, test/setup/build, registry validation, secret scanning, lockfile checks, verdicts and template generation.
  - `apps/web`: 14-screen starter with vendored token-ui; `apps/android`: watch-only starter and WDK UI layer; web/Android templates with UPSTREAM records.
  - `derive-ton.js`, mainnet fees/guards/signing/transaction tools, `tools/package.json`; `test/` additions and `tests/` containing 31 files.
  - Builder implementation-plan, UI catalogue/registry, accessibility, Android evidence, reproducibility, handoff, index, registry-maintenance, sample-request and security documentation; extra `docs/05` watch-only workflows; expanded `docs/mainnet` rehearsal, guards, signing, unsigned-transaction, vector, evidence and payment-record material.
- **Lacks:** The planned launcher, `tools/bawa_cli.py`, which exists on **none** of the five branches.
- **Runnable:** The only full builder implementation tree; the new launcher is not yet available. Wallet-core is pinned to **4.9.3**.

## Differences that affect the new entry point

### Main versus feature

- **Missing launcher targets on main:** `AGENTS.md`, registry data, `scripts/build-wallet.mjs`, AI profiles, app starters, mainnet tools and `derive-ton.js`. Main also lacks the wider builder scripts, templates and `WALLET_BUILDER.md`.
- **Dependency mismatch:** Main pins wallet-core **4.8.4**; feature pins **4.9.3**.
- **Shared content is not interchangeable:** Changed documents include `docs/02`, `03`, `04`, `05`, `10`, `11`, `13`, `14`, FAQ, FURTHER-READING, GLOSSARY, RECOVERY, REFERENCES, SECURITY, TESTING, ANDROID-GUIDE, WEB-GUIDE and MAINNET-GUIDE. Shared generate/derive/derive_daemon/compare/extended-key tooling, package-lock, `make_wallet.py` and `decrypt_seed.py` also differ.
- **Unchanged documentation:** `docs/01`, `06`, `07`, `08`, `09`, `12`, `15`, `16`, and `docs/README.md`.
- **README target:** The restructured README targets default branch `main`, currently `16c074e`. That does not make main the builder implementation source. A feature-targeted launcher cannot run there as-is.

### Requirement for main to become the full-builder source of truth

That designation would require the following feature content to be present on main:

1. `AGENTS.md`, `WALLET_BUILDER.md`, `ai/`, `registry/` and `scripts/`.
2. `apps/web`, `apps/android` and `templates/`, including their upstream records.
3. TON/mainnet tooling, `tools/package.json`, corresponding shared-tool/lockfile changes and the **4.9.3** wallet-core pin.
4. Feature test additions and expanded builder, UI, security, watch-only and mainnet documentation, including relevant shared-document changes.
5. The new launcher itself, once implemented, and its supporting DX capability/gap material.

These are content requirements only, **not a proposal to move content or change any branch**.

## What this means for the DX run

- **README lane:** The restructured README is staged **for main as the delivery target**, not for publication. Preserve the current README content in a docs file. It must not be pushed to main without the owner’s word.
- **Other deliverables:** The launcher, `AGENTS.md` work, capability map and gap assessment belong in the **feature live working copy at `85b8d47`**, distinct from the audited worktree lane at `42e765a`.
- **Slice branches:** `docs-usecase-split`, `feat/trust-wallet-reference-implementation` and `hd-wallet-professional` are documentation sources only for this DX entry point; none supplies its builder-routing surface.
- **Prior record:** Preserve `docs/MULTIBRANCH-REPORT.md`. All five branches remain as ordered.

## Unverified / open

- Runtime/test outcomes at these HEADs are not established by the supplied inventories or diffs; launcher behaviour cannot yet be verified because the launcher is absent.
- The README-preservation filename and capability-map/gap-assessment paths are unspecified.
- Actual Git staging or completion of the planned DX edits is not evidenced; “staged for main” above identifies the delivery lane.

---
*Assembled by lane D1 from `sol-04-branches.md`; every branch fact above was verified first-hand against the worktrees at `/home/boxd/workspace/bawa-multibranch/<branch>/` by the lane.*
