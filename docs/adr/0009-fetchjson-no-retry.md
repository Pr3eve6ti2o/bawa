# ADR-0009 — fetchJson stays single-attempt (no retry in the transport)

## Context

`apps/web/src/wallet/adapters/types.ts` provides `fetchJson`, the single
JSON fetch every chain adapter uses: one attempt, a 10-second default
timeout via `AbortController`, no retries. A failed fetch is reported as
`unavailable` or `error` by the adapter, never silently retried or replaced
with a cached value.

Several upstream RPC layers retry transient failures automatically (viem's
`withRetry`, xrpl.js exponential backoff, the TON client's backoff loop).
Bawa deliberately does not. The reasons were spread across a code comment
and lane findings, not recorded as a decision, so a later reader could
reasonably "fix" the transport by adding a retry loop — including the
unbounded form one upstream ships — without knowing the choice was deliberate.

## Decision

`fetchJson` remains single-attempt. Retries, where they are wanted, live
one layer up, in the caller, under an explicit budget:

- Retries apply only to safe idempotent reads (balance and history refresh),
  never to transaction submission or broadcast.
- A retrying caller uses the shared retry helper (`apps/web/src/wallet/retry.ts`,
  item 2 of the repo-study apply plan) with a finite per-operation budget,
  jitter, and an `AbortSignal` — never an unbounded loop.
- An ambiguous outcome stays ambiguous: a possibly-successful broadcast is
  recorded as unknown (`markBroadcastUnknown` in `send.ts`), never retried
  into a second submission.
- A caller that retries must surface the outcome: last-good value retained,
  stale/error state shown, retry availability exposed. See
  `docs/runbooks/refresh-failure.md`.

## Status

Accepted. This records the decision already implemented in
`adapters/types.ts` (header comment: "Single-attempt JSON fetch with a
timeout. No retries").

## Consequences

- The transport stays small, predictable, and testable: one attempt, one
  timeout, one error shape. Callers cannot inherit a hidden retry policy
  from the transport.
- Flaky networks surface as visible degraded states instead of long hidden
  waits. That is the intended trade: visibility over smoothness.
- Any future caller that wants retries must name its budget and its
  classification of retryable errors, and test exhaustion — it cannot get
  retries for free from `fetchJson`.
- The 10-second single-attempt semantics are pinned by characterisation
  tests in the wallet-context suite; changing them requires changing the
  tests and this record together.
