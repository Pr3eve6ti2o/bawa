# Runbook — TON refresh flakiness

TON balances and history come from TonCenter's unauthenticated JSON-RPC
endpoint (`https://toncenter.com/api/v2/jsonRPC`), via the hand-rolled
client in `apps/web/src/wallet/adapters/ton.ts`. This runbook covers the
failure modes that are specific to TON. The general refresh states are
in `refresh-failure.md`.

## Known failure modes

### 1. Rate limiting (HTTP 429)

TonCenter's unauthenticated limit is about 1 request per second per IP.
The wallet used to fire the balance and history requests in parallel,
so they raced for the single token and whichever lost 429'd into serial
retry chains — the "Loading TON balance…" state that lasted 10+ seconds.

- **Symptom:** TON balance stuck on loading, then `error` with reason
  `http-429` (or a timeout after retries); other chains fine.
- **Fix in place:** history starts only after the balance wave settles
  (sequenced, not parallel). Do not re-parallelise them.
- **Residual:** history can still 429 twice and retry to success in a
  few seconds. The balance wins first-try and the history lag is
  invisible to the user. If the balance itself 429s, wait: the retry
  budget is finite and the state will show `error` with a Retry button.
  Do not hammer Retry — each press spends budget against the same
  1 req/s limit.

### 2. Slow first load

TON is the slowest adapter on a cold start. A balance that takes
several seconds is normal; a balance that never resolves is not.

- **Symptom:** "Loading TON balance…" for more than ~10 seconds.
- **Triage:** check whether the state moves to `zero` / `available`
  (healthy, just slow) or to `error` (see §1). A whole-dashboard
  "Balance unavailable" episode that clears on its own after ~10
  seconds without action is the sequenced-retry behaviour, not a bug.

### 3. `seqno` / validity edge cases

The TON adapter validates TonCenter payloads with shape checks
(`getAddressBalance`, `getAddressState`, seqno stack). A malformed
payload is reported as `error`, never accepted silently. If a TON
history entry shows an impossible timestamp or a seqno of 0 with a
bogus validity, that is a payload-validation failure: record the
sanitised reason and the payload shape (never the address or balance),
and treat it as an adapter bug, not a network blip.

## What not to do

- Do not add a second TON endpoint or an API key to work around the
  rate limit without an architecture decision (open question: adopt
  `@ton/ton` vs keep the hand-rolled client). The limit is a property
  of the unauthenticated endpoint, not a bug in the wallet.
- Do not raise the retry budget for TON alone. The budget is
  per-operation and finite by design; a higher budget just waits longer
  against the same limit.
