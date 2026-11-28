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
| `registry/profiles.json` | 8 wallet profiles, each with a v2 `operations` map (10 wallet-build operations) |
| `registry/capabilities.json` | Version 4: 87-chain `chainSupport` roll-up (v4, 2026-11-26, commit `2a0fa75`), each entry recording 10 operations; `coins` table holds 57 entries |
| `registry/engines.json` | 6 engine entries |
| `registry/ui.json` | 11 UI entries, including 3 research-only `OPEN` entries |

The schemas are `registry/schemas/profile.schema.json`,
`registry/schemas/registry.schema.json`,
`registry/schemas/chains.schema.json` and
`registry/schemas/tokens.schema.json`. Follow their existing structure when editing.
The 33-entry total counts registry entries, not individual operation records.

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

## Registry v2 (2026-11-19, PR2 Lane A)

Version 2 adds the machine-readable operation support a planner checks
before routing a request. A catalogue listing is NOT support: listing a
chain never implies the profile can do an operation on it.

### The wallet-build operations

The 10 operations are the wallet-build schema `require` vocabulary:

`create`, `derive`, `restore`, `receive`, `balance`, `history`,
`fee-quote`, `plan-transfer`, `local-sign`, `verify-signature`.

They are NOT the per-network operations in `capabilities.json` entries
(`generate`, `derive`, `watch-only`, `receive-address`, `import`,
`recover`, `send`, `sign`, `broadcast`, `confirm`). The per-network maps
are the repository-tooling record and are unchanged in v2; the new maps
are the per-profile / per-chain support record. There is deliberately no
`broadcast` wallet-build operation: broadcast is disabled in every
adapter and in `broadcastSigned`, in all profiles.

### Where the statuses live

- Every profile in `registry/profiles.json` carries an `operations`
  object with all 10 operations. The status is the MINIMUM across the
  profile's chains: an operation is only claimed at a status if it holds
  for every chain the profile lists. (Example: web-wallet `fee-quote` is
  `DOCUMENTED_NOT_TESTED` because TON fee-quote is blocked, even though
  BTC/ETH/TRX fee-quote is verified.)
- `registry/capabilities.json` carries a top-level `chainSupport` object
  keyed by chain id (`btc`, `eth`, `trx`, `ton`). Each entry is
  `{ "profiles": [<profile ids listing this chain>], "operations": {...} }`.
  The operations status is the BEST status demonstrated for that operation
  on that specific chain by any profile listing it. (Example:
  `chainSupport.btc.fee-quote` is `IMPLEMENTED_AND_VERIFIED` from the web
  wallet, while `chainSupport.ton.fee-quote` is `DOCUMENTED_NOT_TESTED`.)
- `chainSupport.profiles` must list exactly the profiles whose `chains`
  include that chain. The validator enforces this, plus version 2, plus
  that every `operations` map has exactly the 10 operations with a known
  status.

### Status vocabulary for operations

Only these four statuses may appear in an `operations` map:

| Status | Meaning |
| --- | --- |
| `IMPLEMENTED_AND_VERIFIED` | Demonstrated behaviour for the exact claim, backed by a test run, build or recorded inspection (same evidence rule as the entry-level status). |
| `STARTER_IMPLEMENTED_AND_VERIFIED` | The starter demonstrates the operation within its documented scope; it is not a complete wallet. (Android `receive` only: receive-QR display in the starter UI, with no on-device derivation behind it.) |
| `DOCUMENTED_NOT_TESTED` | Documented or described but not demonstrated — including documented as blocked or unavailable (TON fee-quote; TON post-sign-verify, which is partial only). |
| `NOT_SUPPORTED` | The profile/chain does not provide the operation: no implementation in scope (all CLI send/sign/broadcast-adjacent operations; Android on-device derivation — the AAR now exists, Step 4 `f9f312b`, but on-device execution is still unverified, so the operation stays `NOT_SUPPORTED` until that verification lands). |

Do not use `PROPOSED`, `OPEN`, `UNVERIFIED` or `EXTERNALLY_DEPENDENT`
inside an `operations` map; the validator rejects them there.

### Send/sign claims in free-text lists

The validator's send/sign wording ban in `implemented[]` is now
evidence-scoped, because the rebuild falsified its old premise ("no
signing code exists in the repository"). A profile may name send/sign in
`implemented[]` only when its own `operations` map verifies BOTH
`plan-transfer` and `local-sign` (currently only web-wallet). Broadcast
and submission wording stays forbidden in `implemented[]` for EVERY
profile. Bare `send` / `sign` / `broadcast` elements are never allowed in
`implemented[]` — write an evidenced sentence instead.

### Recorded caveats (2026-11-19)

These limits are part of the v2 record, not footnotes to be dropped on
the next edit:

- TON `fee-quote` is blocked: send preview reports unavailable; signing
  still works with a seqno. No fee is invented.
- TON `verify-signature` is partial only: no-error + 32-byte hash + BOC
  magic, no BOC re-parse (no BOC parser vendored). Lane E's independent
  TON verification covers the cryptography through repo tooling, not
  inside the app.
- TRX index-1 HDWallet-path address does not match the published xpub
  fixture (`TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` via xpub); the
  discrepancy is unresolved and recorded, not claimed.
- Balances/history are verified in Node (Lane D, two-source cross-checks);
  the app's own CSP (`connect-src 'self'`) blocks the adapter fetches in
  a served browser preview, so no lane verified balances inside a real
  browser. Widening `connect-src` to the four pinned provider origins is
  a later code change.
- No live non-zero balance was ever checked; all fixture addresses are
  exact-zero. Non-zero rendering is covered by stubbed unit tests only.

**Correction (2026-11-28, Lane A docs audit):** the two caveats above
no longer hold. Balances and history have been verified inside a real
browser since 2026-11-23 (CDP runs in the fix programme and the
dashboard-count lane — `docs/DECISIONS.md` §46/§47, live rows with real
balances, 43/43 linked rows), and live non-zero balances have been
checked (funded and watch-only addresses, e.g. the Vitalik watch-only
fan-out across 16 EVM chains). The 2026-11-19 text above stays as the
dated v2 record.

## Registry v4 (2026-11-26, commit `2a0fa75`)

Version 4 upgrades the validator and the vocabulary to the 87-chain
tree: version check 4 (from v3), the 87-chain `chainSupport`
vocabulary taken from the schema enum (from 84, +cardano, kaspa,
starknet), and the v4 profiles rule for the 74 expansion chains.
`chainSupport.history` I&V went from 10 to 17 chains in the same
change; the validator exits 0 with 0 errors. The v2 record above
stays as the dated record of the 2026-11-19 model.

**Lag (2026-11-28, Lane A docs audit):** `chainSupport.history` I&V
is still 17 in the registry while `chains.ts` history covers 18 —
Gnosis joined via keyless gnosisscan.io (`d06a224`, 2026-11-28) and
the registry entry has not caught up. That is a registry lag, not a
docs fix.

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

The engine pin is `@trustwallet/wallet-core` **4.9.3**. A version change needs a
separate recorded decision and a re-run of install, the suite, differential checks
and fixtures. Registry checks are not a substitute for those runs.

## Update procedure

1. Edit the relevant JSON against the schemas. Check the resource, supported scope
   and usage instructions against repository evidence. Apply the lifecycle and
   licence rules above, and record any inspection, test or build findings.

2. From the repository root, run `node scripts/validate-registry.mjs`.
   The current baseline prints `OK: 4 files, 33 entries validated` and exits `0`.
   An intentional addition may change the totals; investigate unexplained changes.

3. Run `node --test tests/registry.test.mjs`. The current suite contains 29 tests;
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

The recorded baseline is 33 validated entries. `web-wallet` and `android-wallet`
are `STARTER_IMPLEMENTED_AND_VERIFIED` since the acceptance programme (2026-11-10);
they carried `IMPLEMENTED_AND_VERIFIED` in Phases 6–7 under the old label. Three UI entries remain
research-only `OPEN`, and the XChain pin is verified in `XChain-Platform/xchain-wallet`; XChain remains never selectable, and no XChain code has been copied. The XChain pin verification is fresh evidence (2026-11-12); the rest of this summary records the existing state.

Registry v2 (2026-11-19, PR2 Lane A): `capabilities.json` is version 2 with
`chainSupport` for btc/eth/trx/ton; every profile carries the 10-operation
map. The rebuilt web wallet verifies offline send (`plan-transfer` +
`local-sign`, all four chains; post-sign verification for BTC/ETH/TRX) and
read-only balances/history; broadcast remains not implemented anywhere.
(Superseded in part — see Registry v4 above: `capabilities.json` is now
version 4 with 87-chain `chainSupport`, and offline local-sign now covers
BTC/ETH/TRX/TON/SOL plus the generalised EVM signer for all 61 EVM
chains.)
