# Registry maintenance

The Bawa AI Wallet Builder registries catalogue wallet profiles, chain/network
operation support, engines and UI resources. They record availability and evidence,
not capabilities we hope an upstream project might provide.

Only include resources that actually exist in this repository. Each entry must
describe what is available, what it supports and how to use it. Use repository
paths and recorded findings; do not invent support or extrapolate between networks.

## Files

| Path | Contents |
| --- | --- |
| `registry/profiles.json` | 7 wallet profiles |
| `registry/capabilities.json` | 8 chain/network entries, each recording 10 operations |
| `registry/engines.json` | 5 engine entries |
| `registry/ui.json` | 11 UI entries, including 3 research-only `OPEN` entries |

The schemas are `registry/schemas/profile.schema.json` and
`registry/schemas/registry.schema.json`. Follow their existing structure when editing.
The 31-entry total counts registry entries, not individual operation records.

Validation lives in `scripts/validate-registry.mjs`; registry tests live in
`tests/registry.test.mjs`. The capability detector is `ai/detect-capabilities.mjs`.

## Entry lifecycle and evidence

Add an existing repository resource as `PROPOSED`. Inspect it, run the relevant
tests or build it, and record the scope and result. Move to
`IMPLEMENTED_AND_VERIFIED` only when the evidence demonstrates the claimed behaviour.
A profile starter moves to `STARTER_IMPLEMENTED_AND_VERIFIED` when its starter is
demonstrated within its documented scope; the missing components are listed in the
profile's `implemented`/`missing` fields.
Use `DOCUMENTED_NOT_TESTED` when support is documented but has not been demonstrated.

Mark an entry `OPEN` when a necessary fact is missing; state the question rather
than guessing. An unverified licence or pin also requires a research-only
restriction. Research-only entries are never selectable, whatever other checks pass.

Use these evidence statuses consistently:

| Status | Evidence required when assigning it |
| --- | --- |
| `PROPOSED` | Identify the existing repository resource and proposed use; make no verified-support claim. |
| `IMPLEMENTED_AND_VERIFIED` | Demonstrated behaviour for the exact claim, backed by a test run, build or recorded inspection. Record the scope, method and outcome. |
| `STARTER_IMPLEMENTED_AND_VERIFIED` | The starter for this profile is implemented and verified within its documented scope; it is not a complete wallet. Missing components are listed in the profile's `implemented`/`missing` fields. |
| `DOCUMENTED_NOT_TESTED` | Cite documentation or inspection findings describing support, and state what has not been exercised or demonstrated. |
| `OPEN` | Record the missing fact, why it matters and what evidence would settle it. |
| `EXTERNALLY_DEPENDENT` | Identify and evidence the external prerequisite; distinguish local support from what depends on it. |
| `UNVERIFIED` | Record the unsubstantiated claim or pin, checks attempted and their outcome. A pin that does not resolve belongs here. |

A guide's assertion is not verification. Registry validation and registry tests
check the records; they do not by themselves demonstrate wallet behaviour.
A successful build proves buildability, not every operation listed for a network.

Every transition needs the previous status, new status, dated reason and supporting
evidence. Promotions must meet the destination status's evidence rule for the
resource and version concerned. Resolve the stated gap before promoting from
`OPEN` or `UNVERIFIED`; check the relevant prerequisite before promoting from
`EXTERNALLY_DEPENDENT`.

Record downgrades on the same day the problem is found. If a verified foundation
stops building, record the failing command and result and downgrade to the status
the remaining evidence supports. Do not leave it verified while waiting for a fix,
and do not erase the earlier evidence.

## Licences and pins

MIT and Apache-2.0 foundations are adopted. Record their licence evidence; adoption
does not automatically verify their build or behaviour.

Reciprocal licences, including AGPL, stay research-only without an explicit,
recorded licensing decision. Unknown or unverified licences also stay research-only.
Do not lift that restriction until the licence decision is recorded, the pin is
verified and the normal evidence requirements are met. Passing tests is not a
licensing decision.

A pin that does not resolve is `UNVERIFIED`. Preserve the failed lookup evidence;
never silently substitute a plausible version, tag or commit. Any correction must
be explicit and evidenced. The AGPL-3.0-or-later XChain entry remains `OPEN`, research-only, and never selectable; its pin `3e550d05e913e29e5c3cf24527bf504f1a4fe942` is verified as the `master` HEAD of `XChain-Platform/xchain-wallet` (commit 2026-11-01, release v0.342.1) and is absent from `xchainjs/xchainjs-lib`.

The engine pin is `@trustwallet/wallet-core` **4.9.1**. A version change needs a
separate recorded decision and a re-run of install, the suite, differential checks
and fixtures. Registry checks are not a substitute for those runs.

## Update procedure

1. Edit the relevant JSON against the schemas. Check the resource, supported scope
   and usage instructions against repository evidence. Apply the lifecycle and
   licence rules above, and record any inspection, test or build findings.

2. From the repository root, run `node scripts/validate-registry.mjs`.
   The current baseline prints `OK: 4 files, 31 entries validated` and exits `0`.
   An intentional addition may change the totals; investigate unexplained changes.

3. Run `node --test tests/registry.test.mjs`. The current suite contains 10 tests;
   require all tests to pass. Do not weaken checks to hide an unsupported entry.

4. Run `node ai/detect-capabilities.mjs`. Review the result against the edited
   records and check that research-only resources cannot become selectable.
   Successful execution alone is not evidence of supported wallet behaviour.

5. Set `reviewed_at` to today's date (`YYYY-MM-DD`) for every entry reviewed or
   changed. Every entry must carry a date. Do not refresh untouched entries merely
   to make the registry look current. Re-run the checks on the final JSON.

6. Review the diff and commit the JSON with any supporting repository changes.
   Put the evidence in the commit message: affected entries, old and new statuses,
   review date, commands and results, inspected paths and findings, and references
   to recorded licence or pin decisions. For `IMPLEMENTED_AND_VERIFIED`, include
   behavioural evidence separately from the registry check results.

## Current state

The recorded baseline is 31 validated entries. `web-wallet` and `android-wallet`
are `STARTER_IMPLEMENTED_AND_VERIFIED` since the acceptance programme (2026-11-10);
they carried `IMPLEMENTED_AND_VERIFIED` in Phases 6–7 under the old label. Three UI entries remain
research-only `OPEN`, and the XChain pin is verified in `XChain-Platform/xchain-wallet`; XChain remains never selectable, and no XChain code has been copied. The XChain pin verification is fresh evidence (2026-11-12); the rest of this summary records the existing state.
