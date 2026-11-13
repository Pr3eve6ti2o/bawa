package com.bawa.wallet.core

// Confirmation-policy enforcement for BTC and ETH (M-38, T15).
// Pure Kotlin mirror of apps/web/src/engine/confirmation-policy.ts:
// same thresholds, same fail-closed rules, same test vectors.
//
// Pinned policies (docs/mainnet/MAINNET-GUIDE.md section 16, resolved
// 2026-11-10): BTC 6 confirmations, a customary recommendation, not a
// protocol requirement; ETH at least 12 confirmations AND canonical
// finalised inclusion -- 12 alone is insufficient, and the 12 is an
// unsourced legacy extra minimum, never a sourced threshold.
//
// Thresholds are read from DerivationPolicy, the single source of truth
// for policy constants. This evaluator is pure and provider-independent:
// no network access, no secrets, no send/sign/broadcast. A live
// transaction-observation path does not exist in this starter yet; until
// a caller supplies real observations, no payment may be treated as
// confirmed. Fail closed: stale, missing or invalid observations return
// UNKNOWN, never CONFIRMED. Canonicality is checked by block hash, never
// by height alone; a hash mismatch returns REORGED and revokes any prior
// confirmed status. The evaluator is deterministic, so a re-included
// transaction reconciles to the same assessment instead of double-counting.
// Check order: stale, missing transaction id, missing/invalid tip,
// mempool-only (SEEN, unless it carries contradictory block data),
// invalid heights, malformed block hashes, missing/malformed canonical
// hash, hash mismatch (REORGED), then the chain thresholds. Settlement
// eligibility is derived fresh on every call and is true only for a
// current CONFIRMED status, never latched from a previous evaluation.
// Input contract: block hashes are 64 hex characters, no 0x prefix.
// Kotlin's type system enforces the Boolean finalised flag and integer
// heights, so those two runtime checks exist only in the TypeScript twin.
object ConfirmationPolicy {
    val BTC_CONFIRMATIONS_REQUIRED: Int
        get() = DerivationPolicy.BTC_CONFIRMATIONS

    val ETH_CONFIRMATIONS_MINIMUM: Int
        get() = DerivationPolicy.ETH_EXTRA_MINIMUM

    val ETH_REQUIRES_FINALISED: Boolean
        get() = DerivationPolicy.ETH_REQUIRES_FINALISED

    enum class Chain { BTC, ETH }

    enum class Status { SEEN, INCLUDED, CONFIRMED, REORGED, UNKNOWN }

    data class Observation(
        val chain: Chain,
        val txid: String,
        // Null while the transaction is only in the mempool.
        val inclusionHeight: Int?,
        val inclusionBlockHash: String?,
        // Canonical block hash at inclusionHeight, or null if not checked.
        val canonicalBlockHashAtInclusionHeight: String?,
        val tipHeight: Int?,
        // ETH only: true when the inclusion block is in the canonical
        // finalised chain. Ignored for BTC.
        val finalized: Boolean,
        // True when the observation is stale or its fetch failed.
        val stale: Boolean,
    )

    data class Assessment(
        val status: Status,
        // tipHeight - inclusionHeight + 1, or null when not included
        // or uncountable.
        val confirmations: Int?,
        // True only when status is CONFIRMED.
        val settlementEligible: Boolean,
        val settlementLabel: String,
        val reason: String,
    )

    private fun unknown(reason: String): Assessment = Assessment(
        status = Status.UNKNOWN,
        confirmations = null,
        settlementEligible = false,
        settlementLabel = "unknown - do not settle",
        reason = reason,
    )

    // Block hashes are 32-byte hashes in hex (64 characters, no 0x
    // prefix). A malformed hash must never permit confirmation, even
    // when the two supplied hashes match each other.
    private val blockHashPattern = Regex("^[0-9a-fA-F]{64}$")

    private fun isValidBlockHash(value: String?): Boolean =
        value != null && blockHashPattern.matches(value)

    fun assess(observation: Observation): Assessment {
        if (observation.stale) {
            return unknown("Stale observation: the last verified state is preserved; a failed fetch is not an empty transaction list.")
        }
        if (observation.txid.isBlank()) {
            return unknown("Invalid observation: transaction id is missing.")
        }
        val tipHeight = observation.tipHeight
        if (tipHeight == null || tipHeight < 0) {
            return unknown("Invalid observation: chain tip height is missing or invalid.")
        }
        val inclusionHeight = observation.inclusionHeight
        if (inclusionHeight == null) {
            if (observation.inclusionBlockHash != null ||
                observation.canonicalBlockHashAtInclusionHeight != null
            ) {
                return unknown("Invalid observation: mempool-only transaction carries block data.")
            }
            return Assessment(
                status = Status.SEEN,
                confirmations = null,
                settlementEligible = false,
                settlementLabel = "seen, not included",
                reason = "Transaction observed but not included in a block.",
            )
        }
        if (inclusionHeight < 0) {
            return unknown("Invalid observation: inclusion height is invalid.")
        }
        if (tipHeight < inclusionHeight) {
            return unknown("Invalid observation: chain tip is below the inclusion height.")
        }
        val inclusionBlockHash = observation.inclusionBlockHash
        if (!isValidBlockHash(inclusionBlockHash)) {
            return unknown("Invalid observation: inclusion block hash is missing or malformed (expected 64 hex characters).")
        }
        val canonicalHash = observation.canonicalBlockHashAtInclusionHeight
        if (!isValidBlockHash(canonicalHash)) {
            return unknown("Canonicality not established: no valid canonical block hash was supplied for the inclusion height.")
        }
        if (canonicalHash != inclusionBlockHash) {
            return Assessment(
                status = Status.REORGED,
                confirmations = null,
                settlementEligible = false,
                settlementLabel = "reorged - do not settle",
                reason = "Inclusion block is no longer canonical at its height: the transaction was displaced by a reorganisation. Any prior confirmed status is revoked; preserve the audit trail.",
            )
        }
        val confirmations = tipHeight - inclusionHeight + 1
        if (observation.chain == Chain.BTC) {
            if (confirmations >= BTC_CONFIRMATIONS_REQUIRED) {
                return Assessment(
                    status = Status.CONFIRMED,
                    confirmations = confirmations,
                    settlementEligible = true,
                    settlementLabel = "confirmed for settlement",
                    reason = "BTC: $confirmations confirmations, at least the customary 6.",
                )
            }
            return Assessment(
                status = Status.INCLUDED,
                confirmations = confirmations,
                settlementEligible = false,
                settlementLabel = "unconfirmed for settlement",
                reason = "BTC: $confirmations of 6 confirmations; included but unconfirmed for settlement.",
            )
        }
        // ETH: confirmed only when finalised AND at least 12 confirmations.
        if (observation.finalized && confirmations >= ETH_CONFIRMATIONS_MINIMUM) {
            return Assessment(
                status = Status.CONFIRMED,
                confirmations = confirmations,
                settlementEligible = true,
                settlementLabel = "confirmed for settlement",
                reason = "ETH: $confirmations confirmations and finalised inclusion.",
            )
        }
        if (observation.finalized) {
            return Assessment(
                status = Status.INCLUDED,
                confirmations = confirmations,
                settlementEligible = false,
                settlementLabel = "unconfirmed for settlement",
                reason = "ETH: finalised but only $confirmations of the 12 extra-minimum confirmations; included but unconfirmed for settlement.",
            )
        }
        return Assessment(
            status = Status.INCLUDED,
            confirmations = confirmations,
            settlementEligible = false,
            settlementLabel = "unconfirmed for settlement",
            reason = "ETH: $confirmations confirmations but inclusion is not finalised; 12 alone is insufficient.",
        )
    }
}
