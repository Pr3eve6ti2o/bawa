package com.bawa.wallet.core

/**
 * Transaction lifecycle state machine (design §6, docs 13/14).
 * Rules enforced here, not in UI code:
 * - Any edit to a reviewed payload restarts review (never re-signs).
 * - Broadcast timeout means UNKNOWN: reconcile by txid before any
 *   retry of identical bytes; never auto-create a replacement.
 * - Absence from one server is not evidence of disappearance.
 * - Cancellation / invalid evidence / undecodable action leaves no
 *   usable signature.
 */
enum class TxState {
    COMPOSED,
    REVIEWED,
    SIGNED,
    BROADCAST,
    PENDING,
    INCLUDED,
    CONFIRMED,
    FAILED,
    REPLACED,
    DROPPED,
    UNKNOWN,
}

sealed class TxEvent {
    data object ReviewApproved : TxEvent()
    data object PayloadEdited : TxEvent()
    data object Signed : TxEvent()
    data object BroadcastAccepted : TxEvent()
    data object SeenPending : TxEvent()
    data object Included : TxEvent()
    data class Confirmed(val confirmations: Int) : TxEvent()
    data object Failed : TxEvent()
    data object Replaced : TxEvent()
    data object Dropped : TxEvent()
    data object BroadcastTimeout : TxEvent()
    data object Cancelled : TxEvent()
    data object ReorgInvalidated : TxEvent()
}

data class TxTransition(val from: TxState, val event: TxEvent, val to: TxState)

object TxStateMachine {
    /** Returns the next state, or null when the transition is illegal. */
    fun transition(state: TxState, event: TxEvent): TxState? = when (state) {
        TxState.COMPOSED -> when (event) {
            is TxEvent.ReviewApproved -> TxState.REVIEWED
            is TxEvent.Cancelled -> TxState.FAILED
            else -> null
        }
        TxState.REVIEWED -> when (event) {
            is TxEvent.PayloadEdited -> TxState.COMPOSED // review restarts
            is TxEvent.Signed -> TxState.SIGNED
            is TxEvent.Cancelled -> TxState.FAILED
            else -> null
        }
        TxState.SIGNED -> when (event) {
            is TxEvent.PayloadEdited -> TxState.COMPOSED // signed payload edited: back to start
            is TxEvent.BroadcastAccepted -> TxState.BROADCAST
            is TxEvent.BroadcastTimeout -> TxState.UNKNOWN
            is TxEvent.Cancelled -> TxState.FAILED
            else -> null
        }
        TxState.BROADCAST -> when (event) {
            is TxEvent.SeenPending -> TxState.PENDING
            is TxEvent.Included -> TxState.INCLUDED
            is TxEvent.BroadcastTimeout -> TxState.UNKNOWN
            is TxEvent.Failed -> TxState.FAILED
            else -> null
        }
        TxState.PENDING -> when (event) {
            is TxEvent.Included -> TxState.INCLUDED
            is TxEvent.Replaced -> TxState.REPLACED
            is TxEvent.Dropped -> TxState.DROPPED
            is TxEvent.Failed -> TxState.FAILED
            else -> null
        }
        TxState.INCLUDED -> when (event) {
            is TxEvent.Confirmed -> TxState.CONFIRMED
            is TxEvent.ReorgInvalidated -> TxState.PENDING // reorg is reversible
            is TxEvent.Failed -> TxState.FAILED // included but execution failed
            else -> null
        }
        TxState.UNKNOWN -> when (event) {
            // Reconciliation only: re-observed states resume tracking.
            is TxEvent.SeenPending -> TxState.PENDING
            is TxEvent.Included -> TxState.INCLUDED
            is TxEvent.Failed -> TxState.FAILED
            is TxEvent.Dropped -> TxState.DROPPED
            else -> null
        }
        // Terminal states: no outgoing transitions.
        TxState.CONFIRMED, TxState.FAILED, TxState.REPLACED, TxState.DROPPED -> null
    }

    fun isTerminal(state: TxState): Boolean = when (state) {
        TxState.CONFIRMED, TxState.FAILED, TxState.REPLACED, TxState.DROPPED -> true
        else -> false
    }

    /** A signed payload may only be broadcast while SIGNED; never re-sign silently. */
    fun mayBroadcast(state: TxState): Boolean = state == TxState.SIGNED
}
