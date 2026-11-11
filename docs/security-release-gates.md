# Security release gates

Every release of the Bawa AI Wallet Builder must pass the release gates below at the candidate commit. Real-value use has additional blockers; passing release checks does not authorise funding or mainnet activation.

This page is policy, not a test-run report. A gate that did not run is **NOT-RUN**, never a pass. Any **FAIL** or **NOT-RUN** blocks release, even if a wrapper command exits successfully.

## Release gates

Run commands from the repository root. Record the commit SHA, date, exact commands, exit statuses and individual gate results. Keep evidence free of secrets.

The first seven rows share the canonical runner, `scripts/quality-gates.mjs`. Run it once and require every listed sub-gate to pass; its overall status must not conceal skipped checks.

| Gate | Exact command | Required evidence |
| --- | --- | --- |
| Registry validation + tests | `node scripts/quality-gates.mjs` | Registry validation and registry tests both pass. |
| Negative-input tests | `node scripts/quality-gates.mjs` | Invalid and unsupported inputs are rejected as expected; no skipped cases counted as passes. |
| Engine suite | `node scripts/quality-gates.mjs` | The complete engine suite passes against the pinned engine. |
| Web typecheck/tests/build | `node scripts/quality-gates.mjs` | Typecheck, tests and production build all pass separately. |
| Android unit tests | `node scripts/quality-gates.mjs` | Android unit tests actually execute and pass. Missing tooling is NOT-RUN, not an exemption. |
| Secret scan | `node scripts/quality-gates.mjs` | Scan completes with no unresolved findings. Do not copy secret-bearing matches into reports. |
| Lockfile pins | `node scripts/quality-gates.mjs` | Lockfile and pin checks pass, with no unreviewed pin changes or lockfile drift. |
| Clean-checkout tests — 2 requests | `node --test tests/clean-checkout.test.mjs` | Both requests execute successfully from clean checkouts, without relying on untracked files or previous generated output. |
| Detector — profiles + starters | `node --test tests/clean-checkout.test.mjs` | For both request runs, retain detector evidence showing both `profiles` and `starters` as `ok`. Missing detector evidence is NOT-RUN. |

The last two rows use the clean-checkout workflow as the end-to-end route. The one-prompt workflow is `scripts/build-wallet.mjs`; testing a helper alone is not a substitute. Retain separate results for both requests and their detector checks. A test exit code alone does not establish that those checks ran.

### Pinned baseline

- Engine: **`@trustwallet/wallet-core` 4.8.4**, the repository pin and Phase 4 decision. **4.9.1 exists but is untested here**; do not substitute it or imply coverage.
- Web starter: derives **in-browser from extended public keys only**. This is not a signing capability.
- Android starter: derives **nothing on-device**. There is **no wallet-core AAR**; passing its unit tests does not demonstrate on-device derivation.

| Chain | Derivation policy |
| --- | --- |
| BTC | `m/84'/0'/0'/0/i` |
| ETH | `m/44'/60'/0'/0/i` |
| TRX | `m/44'/195'/0'/0/i` |
| TON | `m/44'/607'/0'` — generation-only |

Changes to the engine pin or derivation policy require an explicit decision and fresh evidence, not an incidental dependency refresh.

**Open documentation action:** the Doc 4 §5 step-4 SHA still names H5, while `main` has advanced past it. Refresh it on the next Doc 4 re-issue. H5 evidence must not be presented as evidence for later commits.

## Secret handling

The following must never appear in repository files or history, logs, reports or commits:

- Mnemonics and seeds.
- Private keys and private extended keys.
- Vault keys and data keys.
- `.env` files and seed bundles.

Do not put secret-bearing dumps, screenshots, exception objects or generated artefacts into release evidence. A scanner passing is not proof that every possible secret is absent.

**Boundary rule:** adapters never receive secrets. UI, logs and telemetry never carry secrets. Keep this boundary intact on success, validation failure, exceptions and debug paths.

**R-01 — point validation:** a checksum-correct key with an invalid `secp256k1` point must be rejected **before derivation**. This includes imported extended public keys. Valid encoding, length, prefix or checksum is not point validation; retain a negative regression test for the invalid-point case.

## Transaction gates

There is **no transaction-construction, signing or broadcast code anywhere in this repository**. Send/sign/broadcast has **never been exercised**. None of the procedure below is implemented or exercised; it is a requirement for future transaction capability, not a description of today's starters.

The required procedure is:

1. **Freeze the intent.** Fix the chain, network, account, asset, destination, amount and units, fee limits, and applicable inputs, nonce or seqno. Assign an identifier to the frozen intent.
2. **Present human-readable details.** Show the complete proposed action, including fees, contract calls or additional messages where applicable. Require deliberate human review; never display secrets.
3. **Validate the payload against the intent.** Check the complete payload, not merely its displayed summary. Reject omissions, substitutions and extra actions. Sign only after validation and explicit human approval; verify that the signed result still represents the approved intent.
4. **Broadcast the exact signed payload.** Do not rebuild, replace or mutate it after signing. Any change requires a new intent, validation and approval. Track the resulting transaction against the applicable confirmation and outcome policy.

### Confirmation policy

These are policy constraints, not evidence of an implemented or tested send path.

| Chain | Required policy |
| --- | --- |
| BTC | 6 confirmations. |
| ETH | `finalised`, plus `"12"` **only as an unsourced extra minimum**. `"12"` is not a sourced finality guarantee and cannot replace finalisation. |
| TRX | 19 of 27 super representatives. |
| TON | 1 masterchain seqno **plus an outgoing-message outcome check**. |

Address derivation, watch-only checks and receive-only rehearsals do not establish send/sign/broadcast coverage.

## Real-value blockers

Every item below remains **OPEN**. Release checks, review notes and proposed rehearsal amounts are not authorisation to use real funds.

### OPEN — Independent external review (M-31/M-15)

Reviewer designated (owner, 2026-11-10 ~14:30 IST): Astra, max reasoning. The review runs after the acceptance programme finishes, so it reviews the final state. The Opus independent audit was dropped by owner decision 2026-11-10 ~14:28 IST (the Opus audit lane had already ended BLOCKED: 8 consecutive HTTP 503 "no available channel under current group probation"). Astra authored the implementation, so the review is a second-pass review by the same model; its report must state that plainly, not present itself as a fully independent audit. The Phase 9 review is likewise an **Astra second-pass review**, not an independent review; never present it as independent.

**Unblocks when:** the designated review is completed, blocking findings are resolved and verified, and the outcome is recorded. Designating a reviewer alone does not close this gate.

### OPEN — M-35 rehearsal authorisation

Rehearsal execution needs **separate explicit approval**. The proposed amounts are **for review only**, all **receive-only**:

| Chain | Proposed amount |
| --- | --- |
| BTC | 0.0002 BTC |
| ETH | 0.001 ETH |
| TRX | 1 TRX |
| TON | 0.05 TON |

**Unblocks when:** explicit authorisation for the reviewed rehearsal plan, scope, operator and amounts is recorded before execution. Record execution results separately afterwards. This list is not an instruction to transfer funds, and rehearsal approval is not mainnet activation or send-path approval.

### OPEN — M-39 GUI watch-only test

The next step is a **GUI watch-only test on a desktop machine**, or the **`@ton/ton` expert-assisted route**.

**Unblocks when:** the chosen route is completed and its expected versus observed results are reviewed and recorded without secrets. Do not substitute Android unit-test success for this check or imply that Android derives on-device.

### OPEN — Mainnet activation

Mainnet activation requires a **separate explicit approval**, plus all applicable release and real-value gates.

**Unblocks when:** those gates are satisfied for the named commit, network and scope, and activation approval is recorded. Any sending scope additionally requires the transaction procedure to be implemented, reviewed and exercised; that capability is absent today. A release tag or M-35 approval cannot authorise it by implication.

### OPEN — `SECURITY.md` disclosure procedure

`SECURITY.md` currently has **no disclosure procedure or contact**. This is an open maintainer action.

**Unblocks when:** maintainers publish and verify a working private reporting contact and a disclosure procedure covering report handling, ownership and acknowledgement expectations. Placeholder text or a public issue tracker alone is not a private disclosure route.

### OPEN — D06 F8 environment-name collision

The `NOVA_*` collision requires a rename to **`BAWA_*` with guarded migration**.

**Unblocks when:** consumers, configuration, documentation and tests use the new namespace, and the migration is implemented and tested. Guard legacy-variable use explicitly, reject conflicting or ambiguous old/new values, and prevent silent reuse of another application's `NOVA_*` settings. Migration diagnostics must not print secret values.

## What this repo is not

This repo is not a hosted wallet, a custody service or an exchange. It is not production-ready or audited.

Neither starter is claimed safe for real funds. A green gate report, an Astra second-pass review or successful public-key derivation does not change that.
