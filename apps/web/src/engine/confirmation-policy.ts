// Confirmation-policy enforcement for BTC and ETH (M-38, T15).
//
// Pinned policies (docs/mainnet/MAINNET-GUIDE.md section 16, resolved
// 2026-11-10): BTC 6 confirmations, a customary recommendation, not a
// protocol requirement; ETH at least 12 confirmations AND canonical
// finalised inclusion -- 12 alone is insufficient, and the 12 is an
// unsourced legacy extra minimum, never a sourced threshold.
//
// This module is a pure, provider-independent evaluator: it takes one
// chain observation and returns a settlement assessment. It performs no
// network access, holds no secrets, and never sends, signs or broadcasts
// anything. A live provider / transaction-observation path does not exist
// in either starter yet, so this evaluator is the enforcement point its
// future caller must use; until a caller supplies real observations, no
// payment may be treated as confirmed.
//
// Fail-closed rules (docs/07, docs/11, docs/14 section 5.2):
// - A stale, missing or invalid observation returns unknown, never
//   confirmed. A failed request is not an empty transaction list.
// - Canonicality is checked by block hash, never by height alone. A
//   hash mismatch at the inclusion height returns reorged and revokes
//   any prior confirmed status; the caller must preserve the audit trail
//   and must not present non-canonical evidence as current confirmation.
// - Broadcast acknowledgement is not confirmation. The evaluator is
//   deterministic: the same observation always yields the same
//   assessment, so a re-included transaction reconciles to the same
//   record instead of double-counting. Deduplication of payment records
//   (keyed by transaction identity) stays with the caller.
// - Check order: stale, missing transaction id, missing/invalid tip,
//   non-boolean finalised flag, mempool-only (seen, unless it carries
//   contradictory block data), invalid heights, malformed block hashes,
//   missing/malformed canonical hash, hash mismatch (reorged), then the
//   chain thresholds. Settlement eligibility is derived fresh on every
//   call and is true only for a current confirmed status; it is never
//   latched from a previous evaluation.
// - Input contract: block hashes are 64 hex characters, no 0x prefix.
//   A caller whose source prefixes hashes must strip the prefix first.

export type ConfirmationChain = 'btc' | 'eth';

export type ConfirmationStatus =
  | 'seen'
  | 'included'
  | 'confirmed'
  | 'reorged'
  | 'unknown';

// One chain observation of a single transaction. Heights are block
// heights; null means the value is not known. The caller must supply the
// canonical block hash at the inclusion height from a trusted chain
// view; without it, canonicality cannot be established.
export interface ConfirmationObservation {
  chain: ConfirmationChain;
  txid: string;
  // Null while the transaction is only in the mempool (not included).
  inclusionHeight: number | null;
  inclusionBlockHash: string | null;
  // Canonical block hash at inclusionHeight, or null if not checked.
  canonicalBlockHashAtInclusionHeight: string | null;
  tipHeight: number | null;
  // ETH only: true when the inclusion block is in the canonical
  // finalised chain. Ignored for BTC.
  finalized: boolean;
  // True when the observation is stale or the fetch that produced it
  // failed (timeout, rate limit, unavailable provider).
  stale: boolean;
}

export interface ConfirmationAssessment {
  status: ConfirmationStatus;
  // Confirmations counted as tipHeight - inclusionHeight + 1, or null
  // when the transaction is not included or cannot be counted.
  confirmations: number | null;
  // True only when status is confirmed. Settlement decisions must use
  // this flag (or status), never the raw confirmation count.
  settlementEligible: boolean;
  // Display label for the settlement state.
  settlementLabel: string;
  reason: string;
}

// BTC: 6 confirmations (bitcoin.org guidance for high-value transfers).
export const BTC_CONFIRMATIONS_REQUIRED = 6;

// ETH: extra minimum retained alongside finality; unsourced, never a
// standalone threshold. Finalised inclusion remains mandatory.
export const ETH_CONFIRMATIONS_MINIMUM = 12;

function isValidHeight(value: number | null): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0
  );
}

// Block hashes are 32-byte hashes in hex (64 characters, no 0x prefix).
// A malformed hash must never permit confirmation, even when the two
// supplied hashes match each other.
const BLOCK_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;

function isValidBlockHash(value: string | null): value is string {
  return typeof value === 'string' && BLOCK_HASH_PATTERN.test(value);
}

export function assessConfirmation(
  observation: ConfirmationObservation,
): ConfirmationAssessment {
  const unknown = (reason: string): ConfirmationAssessment => ({
    status: 'unknown',
    confirmations: null,
    settlementEligible: false,
    settlementLabel: 'unknown - do not settle',
    reason,
  });

  // Fail closed on stale or failed observations.
  if (observation.stale) {
    return unknown('Stale observation: the last verified state is preserved; a failed fetch is not an empty transaction list.');
  }
  if (typeof observation.txid !== 'string' || observation.txid.trim() === '') {
    return unknown('Invalid observation: transaction id is missing.');
  }
  if (!isValidHeight(observation.tipHeight)) {
    return unknown('Invalid observation: chain tip height is missing or invalid.');
  }
  const tipHeight = observation.tipHeight;
  // The finalised flag must be a real boolean; a missing or mistyped
  // value can never confirm (an undefined flag reads as false, which
  // is fail-closed, but it is rejected explicitly so bad input is
  // visible instead of silently downgraded).
  if (typeof observation.finalized !== 'boolean') {
    return unknown('Invalid observation: finalised flag is missing or not a boolean.');
  }

  // Not yet included: seen in the mempool only, never confirmed. A
  // mempool observation carrying block data contradicts itself.
  if (observation.inclusionHeight === null) {
    if (
      observation.inclusionBlockHash !== null ||
      observation.canonicalBlockHashAtInclusionHeight !== null
    ) {
      return unknown('Invalid observation: mempool-only transaction carries block data.');
    }
    return {
      status: 'seen',
      confirmations: null,
      settlementEligible: false,
      settlementLabel: 'seen, not included',
      reason: 'Transaction observed but not included in a block.',
    };
  }
  if (!isValidHeight(observation.inclusionHeight)) {
    return unknown('Invalid observation: inclusion height is invalid.');
  }
  const inclusionHeight = observation.inclusionHeight;
  if (tipHeight < inclusionHeight) {
    return unknown('Invalid observation: chain tip is below the inclusion height.');
  }
  if (!isValidBlockHash(observation.inclusionBlockHash)) {
    return unknown('Invalid observation: inclusion block hash is missing or malformed (expected 64 hex characters).');
  }

  // Canonicality by block hash, never by height alone. Without a
  // canonical hash to compare against, confirmation cannot be shown.
  // A malformed canonical hash is unknown, even if it happens to equal
  // the inclusion hash: matching malformed hashes never confirm.
  if (!isValidBlockHash(observation.canonicalBlockHashAtInclusionHeight)) {
    return unknown('Canonicality not established: no valid canonical block hash was supplied for the inclusion height.');
  }
  if (
    observation.canonicalBlockHashAtInclusionHeight !==
    observation.inclusionBlockHash
  ) {
    return {
      status: 'reorged',
      confirmations: null,
      settlementEligible: false,
      settlementLabel: 'reorged - do not settle',
      reason: 'Inclusion block is no longer canonical at its height: the transaction was displaced by a reorganisation. Any prior confirmed status is revoked; preserve the audit trail.',
    };
  }

  const confirmations = tipHeight - inclusionHeight + 1;

  if (observation.chain === 'btc') {
    if (confirmations >= BTC_CONFIRMATIONS_REQUIRED) {
      return {
        status: 'confirmed',
        confirmations,
        settlementEligible: true,
        settlementLabel: 'confirmed for settlement',
        reason: 'BTC: ' + confirmations + ' confirmations, at least the customary 6.',
      };
    }
    return {
      status: 'included',
      confirmations,
      settlementEligible: false,
      settlementLabel: 'unconfirmed for settlement',
      reason: 'BTC: ' + confirmations + ' of 6 confirmations; included but unconfirmed for settlement.',
    };
  }

  // ETH: confirmed only when finalised AND at least 12 confirmations.
  // Either condition alone leaves the transaction included, never
  // confirmed; 12 alone is insufficient.
  if (observation.finalized && confirmations >= ETH_CONFIRMATIONS_MINIMUM) {
    return {
      status: 'confirmed',
      confirmations,
      settlementEligible: true,
      settlementLabel: 'confirmed for settlement',
      reason: 'ETH: ' + confirmations + ' confirmations and finalised inclusion.',
    };
  }
  if (observation.finalized) {
    return {
      status: 'included',
      confirmations,
      settlementEligible: false,
      settlementLabel: 'unconfirmed for settlement',
      reason: 'ETH: finalised but only ' + confirmations + ' of the 12 extra-minimum confirmations; included but unconfirmed for settlement.',
    };
  }
  return {
    status: 'included',
    confirmations,
    settlementEligible: false,
    settlementLabel: 'unconfirmed for settlement',
    reason: 'ETH: ' + confirmations + ' confirmations but inclusion is not finalised; 12 alone is insufficient.',
  };
}


// ---- TRON / TON confirmation policy (T16, merged by the coordinator) ----
// T15's BTC/ETH evaluator above and this TRX/TON section share one file
// because both lanes wrote apps/web/src/engine/confirmation-policy.ts.
// POLICY_VERSION 'trx-ton-1' covers the TRX/TON evaluators below only.
// Confirmation policy evaluator (TRON/TON). Pure functions over
// already-fetched chain observations: no network, no keys, no funds.
// TRON: a block is solidified once at least 19 distinct active Super
// Representatives of 27 each produced a block at that height or above
// (TRON developer docs, consensus/DPoS; walletsolidity/getnowblock is
// the latest solidified block). Raw head height, elapsed time and
// block depth are never evidence. Confirmation is a policy, not a
// finality guarantee.

export const POLICY_VERSION = 'trx-ton-1';
export const TRX_REQUIRED_SUPER_REPRESENTATIVES = 19;
export const TRX_TOTAL_SUPER_REPRESENTATIVES = 27;

export type ConfirmationState =
  | 'seen'
  | 'included'
  | 'confirmed'
  | 'reorged'
  | 'unknown';

export type Evaluation = {
  state: ConfirmationState;
  confirmed: boolean;
  reason: string;
  policyVersion: string;
};

export interface TronObservation {
  txid: string;
  included: boolean;
  blockNumber: number | null;
  contractRet: 'SUCCESS' | 'FAILED' | null;
  solidifiedBlockNumber: number | null;
  distinctSolidifyingSRs: number | null;
  dataAvailable: boolean;
  stale: boolean;
}

export function evaluateTron(obs: TronObservation): Evaluation {
  // Fail closed on unavailable or stale chain data, or on missing
  // inclusion/execution facts. The two solidification evidence paths
  // are alternatives (see below), so they are not in this gate: a
  // solidified-block number OR an explicit distinct-SR count suffices.
  if (
    !obs.dataAvailable ||
    obs.stale ||
    obs.blockNumber === null ||
    obs.contractRet === null
  ) {
    return {
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
      policyVersion: POLICY_VERSION,
    };
  }

  if (!obs.included) {
    return {
      state: 'unknown',
      confirmed: false,
      reason: 'not-included',
      policyVersion: POLICY_VERSION,
    };
  }

  if (obs.contractRet === 'FAILED') {
    return {
      state: 'included',
      confirmed: false,
      reason: 'execution-failed',
      policyVersion: POLICY_VERSION,
    };
  }

  // No solidification evidence at all: unavailable, not "unconfirmed".
  if (
    obs.solidifiedBlockNumber === null &&
    obs.distinctSolidifyingSRs === null
  ) {
    return {
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
      policyVersion: POLICY_VERSION,
    };
  }

  const confirmed =
    (obs.solidifiedBlockNumber !== null &&
      obs.solidifiedBlockNumber >= obs.blockNumber) ||
    (obs.distinctSolidifyingSRs !== null &&
      obs.distinctSolidifyingSRs >= TRX_REQUIRED_SUPER_REPRESENTATIVES);

  return {
    state: confirmed ? 'confirmed' : 'included',
    confirmed,
    reason: confirmed ? 'solidified' : 'included-not-solidified',
    policyVersion: POLICY_VERSION,
  };
}

/**
 * TON policy is 1 masterchain seqno after inclusion plus an outgoing-message
 * outcome check (TON Docs, payment-processing overview: finality after a
 * single masterchain block confirmation).
 *
 * Count masterchain seqno from inclusion, never the wallet account seqno
 * and never wall-clock time. A masterchain head alone, a fee estimate,
 * or a simulation is never confirmation.
 */
export const TON_REQUIRED_MASTERCHAIN_SEQNO = 1;

export interface TonObservation {
  txid: string;
  included: boolean;
  shardBlockId: string | null;
  inclusionAnchorSeqno: number | null;
  currentMasterchainSeqno: number | null;
  outMessageOutcome: 'delivered' | 'bounced' | 'failed' | 'aborted' | null;
  dataAvailable: boolean;
  stale: boolean;
}

export function evaluateTon(obs: TonObservation): Evaluation {
  // Fail closed on unavailable or stale chain data, or on missing
  // inclusion identity / current head. The anchor seqno and the
  // outgoing-message outcome are progressive, not gating facts: with
  // fresh data, a null anchor means "not yet anchored" and a null
  // outcome means "outcome not yet observed", so the transaction is
  // 'included', not 'unknown'. Only dataAvailable / stale report
  // genuinely unavailable chain data.
  if (
    !obs.dataAvailable ||
    obs.stale ||
    obs.shardBlockId === null ||
    obs.currentMasterchainSeqno === null
  ) {
    return {
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
      policyVersion: POLICY_VERSION,
    };
  }

  if (!obs.included) {
    return {
      state: 'unknown',
      confirmed: false,
      reason: 'not-included',
      policyVersion: POLICY_VERSION,
    };
  }

  const confirmed =
    obs.inclusionAnchorSeqno !== null &&
    obs.currentMasterchainSeqno >= obs.inclusionAnchorSeqno &&
    obs.outMessageOutcome === 'delivered';

  return {
    state: confirmed ? 'confirmed' : 'included',
    confirmed,
    reason: confirmed
      ? 'masterchain-anchored-and-delivered'
      : 'included-not-anchored',
    policyVersion: POLICY_VERSION,
  };
}

export type Transition = {
  state: ConfirmationState;
  manualReview: boolean;
  reason: string;
};

export function transition(
  current: ConfirmationState,
  evaluation: Evaluation,
  wasSettled: boolean,
): Transition {
  if (
    current === 'confirmed' &&
    evaluation.state === 'unknown' &&
    evaluation.reason === 'not-included'
  ) {
    return {
      state: 'reorged',
      manualReview: wasSettled,
      reason: 'reorged-after-confirmation',
    };
  }

  if (evaluation.state === 'unknown') {
    return {
      state: current,
      manualReview: false,
      reason: 'stale-or-unavailable-preserved',
    };
  }

  if (current === 'reorged' && evaluation.state === 'included') {
    return {
      state: 'included',
      manualReview: false,
      reason: 'reobserved-reapply-threshold',
    };
  }

  if (current === 'included' && evaluation.state === 'confirmed') {
    return {
      state: 'confirmed',
      manualReview: false,
      reason: evaluation.reason,
    };
  }

  if (current === 'seen' && evaluation.state === 'confirmed') {
    return {
      state: 'included',
      manualReview: false,
      reason: 'cannot-skip-inclusion',
    };
  }

  return {
    state: current,
    manualReview: false,
    reason: 'state-preserved',
  };
}
