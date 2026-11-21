# Runbook — price-feed flakiness (by reference)

> **Scope note.** This checkout has no price feed. There is no CoinGecko
> client, no `prices.ts`, and no per-unit price display in this tree; the
> dashboard shows native amounts only and never invents a fiat value.
> The price feed exists only on `panel-rebuild/multichain-create`
> (`apps/web/src/wallet/prices.ts`, `prices.test.tsx`). This runbook
> covers that feed **by reference only**, for the merge that brings it
> in (see Prerequisite 0 of the repo-study apply plan). Do not create a
> price feed in this tree on the strength of this runbook.

## How the multichain-create feed works (reference)

Verified against the multichain-create tree by Lane P1's Prerequisite 0
diff (2026-11-20). Two claims the apply plan's brief made about this
feed are **wrong** and are corrected here — do not repeat them:

- Source: CoinGecko, 13 chains (`PRICE_IDS` / `PRICE_ASSET_IDS`),
  `fetchPrices`, `usePrices`, `portfolioTotal`. One GET, 10 s timeout,
  **no retry**. 429 maps to `rate-limited` with `Retry-After` seconds
  honoured as `retryAfterMs`; non-2xx → `provider`; abort → `timeout`;
  other fetch failure → `network`.
- Freshness states exist: `fresh` / `expired` / `unavailable`
  (`missing` / `missing-timestamp` / `invalid-price`) / `error`;
  `MAX_QUOTE_AGE_MS` is 10 minutes.
- **Correction 1 — no last-good cache.** A failed refresh replaces
  the whole map: `usePrices` sets all 13 entries to
  `{ status: 'error', reason: 'network' }` on fetch failure, and
  `fetchPrices` returns an all-error map on 429 / non-2xx / parse
  failure. The previous good quotes are discarded, not retained. The
  merge must **add** last-good retention; it cannot carry it over.
- **Correction 2 — no 60-second refresh.** There is no `setInterval`
  anywhere in `apps/web/src` on multichain-create, and `refreshPrices`
  occurs in `dashboard.tsx` only twice (the `usePrices()` destructure
  and the button `onClick`). Prices load only when the user presses
  "Refresh prices". (The auto-fetch on mount + 60 s refresh seen live
  on 2026-11-20 belongs to the `fix-preview-gaps` branch, not to
  multichain-create.) The merge must decide the refresh policy
  explicitly; it must not assume a 60 s interval exists to preserve.
- **No in-flight coalescing.** `usePrices` guards concurrent refreshes
  with a boolean `useRef(false)` — a second `refresh()` while one is
  in flight is silently dropped, not coalesced onto the same promise.
  The merge must replace this with a shared-promise coalescer if
  callers are to share one in-flight response.
- Display: per-unit price per chain when fresh (`BTC $61,596.00 per
  BTC`); `Price expired`, `Price unavailable`, or `Price error`
  otherwise. Zero-balance rows and locked rows show no price slot.
- The hero total (`portfolioTotal`) honestly returns `unavailable`
  (never `$0.00`) when any balance or price is missing/expired/error,
  and `partial` when only some chains contribute. One TON failure
  blanks the whole portfolio total even when BTC/ETH/TRX loaded. That
  is display logic, documented, not a feed failure.

## Failure modes (reference)

### 1. No values after load

- **Symptom:** the dashboard shows no per-unit prices a few seconds
  after load, with a disabled "Refreshing prices…" button.
- **Triage:** check whether the CoinGecko request returned 200 with
  fresh quotes (then it is a display gap — the feed was healthy and
  nothing rendered it) or whether the request failed / rate-limited
  (then it is a feed failure). Do not assume a rate limit: the feed
  has been healthy while the display was empty.
- **Fix direction:** wire the price into every surface that shows a
  balance (dashboard rows, asset list), with the three honest states
  above. Never render a stale price as current, and never render
  `$0.00` for a failed feed.

### 2. Rate limiting

- **Symptom:** intermittent `Price unavailable` / `Price error`.
- **Triage:** a 429 is reported as `rate-limited` with the server's
  `Retry-After` honoured as `retryAfterMs`. There is no last-good
  cache to cover the outage — a failed refresh replaces the map with
  errors — so the honest state is `Price error` with the last
  successful time, not a fabricated value. Adding last-good retention
  is merge work (see above), not existing behaviour.

### 3. Stale hero total

- **Symptom:** portfolio total `Unavailable` while individual rows
  show prices.
- **Cause:** the hero goes `Unavailable` when ANY chain fails. Fix by
  changing the hero rule (sum the chains that loaded and mark the
  total partial), not by hiding the failed chain.

## What not to do

- Never invent a price. A missing price is `unavailable`, never `$0.00`.
- Never retry the feed in a tight loop against a rate limit. There is
  no automatic refresh and no back-off in the feed today; any retry
  added at merge must be bounded and must honour `Retry-After`.
- Never present a cached price without its age. A price without a time
  is a claim; a price with a time is data.
