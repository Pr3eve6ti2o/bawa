# AGENTS.md

## Purpose and baseline
Bawa (`Pr3eve6ti2o/bawa`) is the wallet-engine and canonical-guide repository for the AI Wallet Builder programme. The builder routes work; it is not a cryptographic implementation or a demonstrated full transaction wallet.

Verified snapshot (2026-11-10): main at `0b2aa295` (H9: H8 audit/review fixes + H9 doc refresh). The engine suite recorded 130 checks, 0 fail at H9. This is supplied baseline evidence, not a new test run or evidence for untested capabilities.

At H9 there is NO signing, broadcast or transaction-construction code. Send/sign/broadcast has never been exercised on any network.

## Read order
1. `AGENTS.md` — these repository-wide instructions.
2. `WALLET_BUILDER.md` — request classification and routing.
3. `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md` — read front matter for post-draft updates, then relevant material in sections 1–6.
4. `README.md` and canonical Docs 01–16, including the relevant specialist guides:
   - Doc 2: `docs/web-wallet/WEB-GUIDE.md`.
   - Doc 3: `docs/android-wallet/ANDROID-GUIDE.md`.
   - Doc 4: `docs/mainnet/MAINNET-GUIDE.md`.

The plan is authoritative for architecture, phases, templates, gates and decisions. Do not invent filenames for numbered guides or treat documentation as execution evidence.

## One-prompt workflow
Follow **parse → plan → profile → engine → chains → template → inspect → scaffold → implement → verify → audit claims → report**. Interpret the request, identify scope and gates, route through a proposed profile and authoritative sources, select engine/chain responsibilities and a candidate template, then inspect the repository and candidate foundation before scaffolding. Implement only scoped work in the correct layers, run applicable checks, audit every claim against evidence, and report working behavior, mocks, failures and unresolved gaps. A route is not proof that a capability exists.

`scripts/build-wallet.mjs` runs the workflow for one plain-language request: it classifies the request, GENERATES a differentiated project for its profile with `scripts/generate-project.mjs` (output `generated/<profile-id>`, gitignored), verifies that generated project, and writes a JSON report. The workflow generates a project; it does not merely verify starters.

## Hard constraints
- **Builder:** route work; never implement cryptography in prompt text or invent engine interfaces.
- **Engine:** owns generation, derivation, custody, recovery and signing through narrow typed interfaces; never an indexer. Ownership does not establish implementation, especially for signing.
- **Chain adapters:** own endpoints, fees, broadcast and confirmation. They NEVER receive mnemonics, seeds, private keys, private extended keys, vault keys or secret-bearing objects, including during tests.
- **UI:** presentation only; never derivation, storage or signing policy.
- **Orchestration:** coordinates intents, approval and status; does not absorb other layers' responsibilities.
- **Networks:** default to testnet everywhere. Mainnet is out of scope by default and requires separate approval plus applicable gates. Real-funds gates remain mandatory.
- **Fixed policy:** preserve the engine versions, derivation restrictions, confirmation rules and UI contract recorded in `WALLET_BUILDER.md` and authoritative sources. Do not silently change paths or broaden chain support.
- **Test keys:** fresh, real, functional test seed phrases/private keys MAY be generated; placeholders are not required. They are test-only: never production or existing keys, and never funded with real mainnet funds.
- **Secrets and controls:** never expose secrets, including in prompts, logs, reports or commits; never weaken controls to make tests pass.
- **Honesty:** do not invent capabilities, files, paths, versions, interfaces, commands or results. Missing facts are OPEN.

## Planned assets — not an existence inventory
Profiles are VALIDATED in Phase 3 (`registry/profiles.json`, 7 profiles, with `implemented`/`missing` fields). Locations below are the installed state; inspect existence before use; do not synthesize names.

| Asset | Planned location / status |
| --- | --- |
| Profile definitions | VALIDATED in Phase 3: `registry/profiles.json` (7 profiles); run `node scripts/validate-registry.mjs`. The two starters carry status `STARTER_IMPLEMENTED_AND_VERIFIED`. |
| Profile routing prompts | INSTALLED in `ai/prompts/`, named `create-*.md`; individual files must be inspected. |
| Profile files | INSTALLED in `ai/profiles/` (one per profile, derived from `registry/profiles.json`). |
| Registries | INSTALLED in Phase 3: `registry/` (`profiles.json`, `capabilities.json`, `engines.json`, `ui.json`, `schemas/`); validated. |
| Templates | token-ui VENDORED in `apps/web/src/ui/`; WDK Starter UI layer VENDORED in `apps/android`. Upstream notes in `templates/web/UPSTREAM.md` and `templates/android/UPSTREAM.md`. |
| Starters | INSTALLED: `apps/web` (watch-only starter, 25 tests) and `apps/android` (UI starter, 17 tests). |

If section 2.2 cannot be read, keep unspecified locations OPEN and stop work that requires them. Do not claim planned assets are installed or present.

## Evidence vocabulary
| Label | Meaning |
| --- | --- |
| IMPLEMENTED_AND_VERIFIED | Demonstrated behavior only, within the evidenced revision, environment and scope. |
| STARTER_IMPLEMENTED_AND_VERIFIED | The starter for this profile is implemented and verified within its documented scope; it is not a complete wallet; missing components are listed in the profile's `implemented`/`missing` fields. |
| DOCUMENTED_NOT_TESTED | Described in documentation without execution evidence for that behavior. |
| PROPOSED | Intended design, profile or future work; not an implementation claim. |
| OPEN | Missing fact, unresolved decision or required evidence/input. |
| EXTERNALLY_DEPENDENT | Depends on an external service, party or prerequisite; identify it explicitly. |
| UNVERIFIED | A claim or apparent implementation whose behavior has not been sufficiently checked. |

A guide describing a feature never justifies IMPLEMENTED_AND_VERIFIED. A passing generator test does not verify custody, recovery, signing, broadcast, transaction construction or mainnet readiness.

## Unsupported requests
State precisely which requested portion is unsupported and why. Mark missing facts OPEN and proposed additions PROPOSED. Ask for the needed decision, source, access or approval; offer only an evidence-backed narrower scope. Do not silently substitute a mock, invent support or bypass a gate.

## Reporting
Return an evidence table with: claim/scope, evidence label, revision/network, actual command or artifact and observed result, check status, mocks/limitations, and next gate.
Use **PASS / FAIL / NOT-RUN** for checks; NOT-RUN is never a pass.
List changed files, what actually works, what is mocked, and what remains unresolved or externally dependent. Redact secrets.
Distinguish the supplied H9 baseline (130 checks, 0 fail) from current-run results; never report an unexecuted build or check as successful.
