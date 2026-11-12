# Confirmation-policy enforcement: TRON / TON — policy-to-code mapping

Scope: T16 (W2 gaps). Policy version `trx-ton-1`.
Module: `apps/web/src/engine/confirmation-policy.ts`.
Tests: `apps/web/src/engine/confirmation-policy.test.ts` (29 TRX/TON tests in the shared file, alongside the T15 BTC/ETH tests).

## Pinned policies (sources)

| Chain | Policy | Source |
|---|---|---|
| TRX | Confirmed only when the containing block is solidified: at least 19 distinct active Super Representatives of 27 have each produced a block at that height or above. Evidence from the node's solidified / last-irreversible view (`/walletsolidity/*`). Never elapsed time or raw height subtraction. `contractRet` must be `SUCCESS`, checked separately. | TRON developer docs, "Consensus and DPoS" (updated 2026-10-20); MAINNET-GUIDE §12/§16 (M-38) |
| TON | Confirmed only when 1 masterchain seqno anchors the inclusion (a masterchain block references the shardchain block containing the transaction) AND the outgoing message is verified delivered (not bounced, not failed, not aborted). Count masterchain seqno from inclusion, not the wallet account seqno, not wall-clock time. A masterchain head alone, a fee estimate, or a simulation is never confirmation. | TON Docs, payment-processing overview (checked 2026-11-10); MAINNET-GUIDE §12/§16 (M-13) |

Both are confirmation policies, not finality guarantees. BTC (6) and ETH
(finalised + unsourced extra 12) are covered by the BTC/ETH section of the same module (T15).

## Code mapping

| Policy rule | Code |
|---|---|
| TRX threshold 19 of 27 | `TRX_REQUIRED_SUPER_REPRESENTATIVES = 19`, `TRX_TOTAL_SUPER_REPRESENTATIVES = 27`; `evaluateTron` |
| TRX solidified view: solidified block number covers the tx block | `evaluateTron`: `solidifiedBlockNumber >= blockNumber` |
| TRX explicit SR evidence as an alternative path | `evaluateTron`: `distinctSolidifyingSRs >= 19` (either path suffices; both missing is unavailable data, not "unconfirmed") |
| TRX execution success is separate from inclusion | `evaluateTron`: `contractRet === 'SUCCESS'` required; `'FAILED'` yields state `included`, reason `execution-failed` |
| TRX: head height / elapsed time / depth are never evidence | These are not inputs to the module at all; there is no parameter that could carry them |
| TON threshold 1 masterchain seqno | `TON_REQUIRED_MASTERCHAIN_SEQNO = 1`; `evaluateTon` |
| TON anchor: a masterchain block references the shard block | `evaluateTon`: `inclusionAnchorSeqno !== null && currentMasterchainSeqno >= inclusionAnchorSeqno` |
| TON outgoing-message outcome check | `evaluateTon`: `outMessageOutcome === 'delivered'` required; bounced / failed / aborted never confirm |
| TON: head alone, wallet seqno, fee estimate, simulation are never evidence | None of these are inputs to the module |
| Unavailable / stale chain data fails closed | Both evaluators: `!dataAvailable || stale` (or a missing gating fact) yields state `unknown`, `confirmed: false`, reason `unavailable-chain-data`; the last verified state is preserved by `transition` |
| Absence is not proof of non-payment | Available data reporting `included: false` yields state `unknown`, reason `not-included`; the module never returns a "not paid" verdict |
| Reorg: confirmed record removed from the canonical view | `transition('confirmed', not-included evaluation, wasSettled)` yields `reorged`; `manualReview: true` when the record was settled |
| Reorg recovery: re-observation restores eligibility only after re-applying the threshold | `transition('reorged', included evaluation)` yields `included`, never `confirmed` |
| No state may skip inclusion | `transition('seen', confirmed evaluation)` yields `included`, reason `cannot-skip-inclusion` |

## Null-field semantics (why the two evaluators differ)

- TRX: `blockNumber` and `contractRet` are gating facts; a null means the
  lookup did not return the transaction's own record, so the result is
  `unknown`. The two solidification evidence fields are alternatives.
- TON: `shardBlockId` and `currentMasterchainSeqno` are gating facts (they
  identify the inclusion and the head it is measured against). The anchor
  seqno and the message outcome are progressive: with fresh, available
  data, a null anchor means "not yet anchored" and a null outcome means
  "outcome not yet observed", so the result is `included`, reason
  `included-not-anchored`. Only `dataAvailable: false` / `stale: true`
  report genuinely unavailable chain data.

## Observation shapes the future adapter lane must supply

- TRON, per transaction: `txid`, `included`, `blockNumber`,
  `contractRet` (from the tx lookup, e.g. `ret[].contractRet`), plus
  either `solidifiedBlockNumber` (from `/walletsolidity/getnowblock`,
  field `block_header.raw_data.number` — verified live 2026-11-12:
  solidified 87932150 vs head 87932169) or `distinctSolidifyingSRs`.
- TON, per transaction: `txid`, `included`, `shardBlockId`,
  `inclusionAnchorSeqno` (seqno of the masterchain block referencing the
  shard block), `currentMasterchainSeqno` (from `getMasterchainInfo`,
  field `result.last.seqno` — verified live 2026-11-12: 104929457),
  `outMessageOutcome` (from the message trace).

## Explicitly NOT in this patch

- No chain-data adapter exists yet (no `reconcileTx`, no
  `NetworkConfig.kt`, no `TronNileAdapter` / `TonTestnetAdapter`; TON
  `txid` is `null` per MAINNET-GUIDE §12). This module evaluates
  observations only; fetching them and wiring the evaluator into a live
  send/receive flow is a separate follow-up (blocker B1).
- No live-chain finality test: exercising real solidification /
  anchoring needs a broadcast transaction; broadcasting is out of scope
  and M-35 execution remains a separate gate (blocker B2).
- The Android constants in `DerivationPolicy.kt` are untouched; a
  Kotlin mirror of this evaluator is not included — one enforcement
  surface (Web) was chosen so the coordinator can verify one patch.
- `ai/profiles/*.md` still state the policies are "not enforced in
  code": that statement is now stale for TRX/TON in the Web starter
  only, and is left for the coordinator to update alongside the
  adapter lane, rather than editing profile prose in this patch.
