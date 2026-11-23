# Runbook — refresh failure (balances / history)

Applies to `refreshBalances()` and `refreshHistory()` in
`apps/web/src/state/wallet-context.tsx` (they live there inline; the
standalone `apps/web/src/state/wallet-refresh.ts` module was deleted
in the fix-all programme, Lane H item 13 — it was never wired in, and
its re-wire was proved infeasible without behaviour change), and to
the screens that show their state (`screens/dashboard.tsx`,
`screens/transaction-history.tsx`).

## What the states mean

| State | Meaning | What the user sees |
| --- | --- | --- |
| `loading` | A fetch is in flight. | Skeleton / "Loading…". |
| `zero` | The provider answered: the balance is 0 (or history is empty). | `0` / "No transactions yet". This is a successful answer, not a failure. |
| `available` / `loaded` | The provider answered with data. | The value / the transactions. |
| `unavailable` | The provider answered that the data is not available (no adapter, no address, no network, provider-side "down"). The last-good value, if any, is retained. | "Unavailable" + the short reason (e.g. `no-adapter`, `no-network`) + the last successful check time + Retry. |
| `error` | The fetch failed (timeout, HTTP error, malformed response) after the retry budget was spent. The last-good value, if any, is retained. | "Error" + the sanitised reason + the last successful check time + Retry. |

Rules that never change:

- A failed fetch is never reported as zero. Zero is a successful answer.
- An RPC timeout must not read as "transaction failed". A timeout is a
  read failure; a transaction failure is a different outcome.
- The reason shown is a short machine-readable token, never a raw error payload,
  address, or balance. The tokens the refresh actually produces (see
  set inline in `wallet-context.tsx` — there is no single sanitiser
  function; the dead `sanitiseReason` lived only in the deleted
  `wallet-refresh.ts`): `no-adapter`,
  `adapter-load-failed` (report only), `timeout`, `network`,
  `rate-limited` (HTTP 429), `not-found`, `bad-request`,
  `provider-unavailable` (HTTP 502/503/504), `provider`,
  `invalid-response`, `invalid-address`, `network-mismatch`, `unknown`.

## Triage

1. **Which chains, which operation?** One chain failing points at that
   chain's provider; all chains failing points at the adapter load, the
   network, or the app.
2. **Read the sanitised failure.** On retry exhaustion the refresh
   reports operation, chain, attempt count, and the exhaustion reason.
   That is the diagnosis; do not go looking for more in the console.
3. **Check the last successful time.** If the last-good check was
   recent, the data shown is fresh enough to act on; if it is old, say
   so — do not present stale data as current.
4. **Retry once from the UI.** The Retry button re-runs the refresh with
   a fresh budget. If it fails again, stop: repeated manual retries do
   not fix a provider outage.
5. **Check the chain runbook.** TON has its own runbook
   (`ton-refresh.md`); the price feed has its own (`price-feed.md`).

## What not to do

- Do not clear the last-good value to "fix" the display. Stale data
  with a timestamp is more honest than an empty state.
- Do not retry broadcasts from here. Refresh retries apply to reads
  only. A possibly-successful broadcast stays unknown
  (`markBroadcastUnknown`) and is never auto-resubmitted.
- Do not paste raw error payloads, URLs with keys, or addresses into
  logs or reports. Sanitised operation/chain/attempt/exhaustion only.

## Background refresh

After unlock, balances and history refresh in the background; the
wallet shows as soon as addresses are derived. A failed background
refresh does not throw and does not block unlock — it lands in the
per-chain state above, and the Retry button re-runs it. If the adapter
module itself fails to load, the refresh reports an explicit failure
instead of failing silently (the empty catch that used to swallow it
was removed by the repo-study Phase 3, item 28).
