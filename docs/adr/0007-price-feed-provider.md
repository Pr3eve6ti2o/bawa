# ADR-0007 — Live price feed provider (CoinGecko)

## Context

- The dashboard showed "Unavailable / No price feed" and the portfolio total was
  "Unavailable". That honesty was correct: no price feed existed.
- The adopt-libs programme added fiat display utilities in
  `apps/web/src/wallet/money.ts` (`formatFeePreview`, `fiatMinorUnits`,
  `formatFiatUSD`, `sumFiatUSD`) with no live call site. This lane wires a live
  feed into them; it does not re-implement fiat formatting.
- The other AI's guide named CoinPaprika and DexPaprika as price sources (with
  an opt-in `BAWA_PERSONAL_PRICE_BACKUP=1` flag for noncommercial dev testing
  only) and claimed "7/7 quotes" from a one-shot run on its machine. That claim
  was not taken as proof: the providers' terms and the live behaviour were
  verified first-hand on 2026-11-19/20 before any provider was chosen.
- Requirements: public USD quotes for the 4 native assets (BTC/ETH/TRX/TON)
  with exact source, asset identity and freshness; on-demand quotes, no polling
  loop; a subtotal includes only fresh-quoted balances and reads "Partial" when
  incomplete; a missing/stale/failed price is shown as unavailable/expired/an
  error, never as $0.00 and never as a fabricated price; no ticker-price
  substitution, no estimated stablecoin peg, no assumed wrapped-native
  equivalence (ETH USDC and Solana USDC are different asset IDs; WETH is not
  ETH, WTRX is not TRX).

## Decision

Use CoinGecko as the default (and only) price provider:

- Endpoint (one batched call per manual refresh):
  `GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tron,the-open-network&vs_currencies=usd&include_last_updated_at=true`
- Keyless by default (no account, no key). Optional free Demo key via
  `VITE_COINGECKO_DEMO_KEY`, sent as the `x-cg-demo-api-key` header; absent key
  means keyless. The key is never committed.
- CoinGecko ids: `bitcoin`, `ethereum`, `tron`, `the-open-network`. The live TON
  id is `the-open-network`: the stale id `toncoin` returns `{}` (verified live
  2026-11-19 19:15 UTC: BTC $62,683, ETH $1,774.93, TRX $0.310229, TON $1.028
  via `the-open-network`; `toncoin` alone returned `{}`).
- Freshness: a quote is fresh for at most 10 minutes from the provider's
  `last_updated_at` (`MAX_QUOTE_AGE_MS` in `apps/web/src/wallet/prices.ts`).
  A missing `last_updated_at` is "unavailable", never fresh.
- Attribution: "Powered by CoinGecko" is shown whenever a price is displayed
  (CoinGecko API Terms, section 3: prominent attribution, font size 10+).
- CSP: exactly one new pinned origin, `https://api.coingecko.com`, in
  `connect-src` (`apps/web/src/app/security-headers.ts`). No wildcard.

## Provider terms (read first-hand 2026-11-20)

### CoinGecko — CHOSEN

- API Terms of Service (`coingecko.com/en/api_terms`), Scope of Use clause 6:
  "You are entitled to charge for your services and products that incorporate
  or integrates our CoinGecko API." Only selling, renting, leasing,
  sub-licensing, re-distributing or syndicating access to the API itself is
  barred. Displaying prices inside a product is permitted.
- Clause 3: attribution "Powered by CoinGecko" must be displayed prominently
  in a legible font no smaller than font size 10.
- Clause 2: rate and monthly call limits per plan must not be exceeded or
  circumvented.
- Keyless public API (`docs.coingecko.com/docs/keyless-public-api`): no account
  or key; about 5 calls/min from a shared IP-based pool (dynamic, varies by
  server load); a 429 means back off exponentially; "not recommended for
  production environments due to shared IP rate limits". Our use is one batched
  call per manual refresh, far inside that budget.
- Demo plan (free key, no card): 10,000 credits/month, 100 calls/min.
  CoinGecko data refreshes about every 60 seconds; it is not tick data.
- Live-verified from gray-pinee 2026-11-19 19:15 UTC: keyless
  `/simple/price` returned HTTP 200 with BTC/ETH/TRX and `the-open-network`.

### CoinPaprika — REJECTED as default

- Pricing page (`coinpaprika.com/api/pricing`, read first-hand): Free is
  "Personal use only" — 20,000 calls/month per IP, 2,000 assets, 10
  requests/second per IP, attribution "Powered by CoinPaprika" required on
  every plan. Paid self-serve plans (Starter $99/mo and up) are "Internal
  commercial" only; "Showing the data to your customers or redistributing it
  needs Enterprise" (custom contract). No self-serve plan permits displaying
  prices in this wallet. Live endpoint works (BTC ticker returned $62,682.23
  at 2026-11-19 19:15 UTC) but the licence forbids the use.

### DexPaprika — REJECTED as default

- Terms of Use (`dexpaprika.com/terms`, section 4, read first-hand): the user
  must not "copy, manipulate or aggregate any Content (including data) for the
  purpose of making it available to any third party" nor "trade, sell, rent,
  loan, lease or license any Content ... whether commercially or free of
  charge". Displaying DexPaprika prices in a wallet UI is making content
  available to a third party. Section 6: the API is beta, no warranty, "should
  not be used for any critical applications".
- Pricing (`dexpaprika.com/api/pricing`): Free key 100K credits/month at
  30 req/min; keyless 15 req/min and 10K credits per IP over a rolling 30 days;
  free-tier data delayed up to 60 seconds, best effort, no SLA.
- Coverage gap (verified live from the `/networks` endpoint): 32 networks,
  no Bitcoin — BTC native cannot be priced. ETH and TRX exist only as wrapped
  WETH (`0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`) and WTRX
  (`TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR`), which would violate the
  no-wrapped-native-equivalence rule. TON native is indexed
  (`EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c`).

## Alternatives Considered

- CoinPaprika free tier — rejected: personal-use only; customer display needs
  an Enterprise contract (see above).
- DexPaprika free tier — rejected: terms forbid third-party display; no
  Bitcoin network; wrapped-only ETH/TRX (see above).
- CoinPaprika/DexPaprika as an opt-in personal-dev backup behind
  `BAWA_PERSONAL_PRICE_BACKUP=1` (the other AI's flag) — not implemented in
  this lane. The flag's own guide limits it to noncommercial dev testing; the
  shipped default must use a permitted plan, and adding a second provider,
  CSP origin and code path for a backup the product cannot use was out of
  scope. If a backup is ever wanted, it needs its own terms check first.
- CoinGecko Demo key as the default — not used: a Demo key is per-user
  provisioning, and embedding one in the shipped client would expose it. The
  key stays an optional per-deployment upgrade; keyless is the default.

## Status

accepted

Amendment (2026-11-20): the live price feed now covers all 13 chains in the chain registry (apps/web/src/wallet/prices.ts), using 12 unique CoinGecko ids — Base shares Ethereum's id (ethereum). The 4-native-asset scope stated above is the scope at the time this ADR was written, not the current coverage. No other part of this record changes.

## Consequences

- `apps/web/src/wallet/prices.ts` is the feed: one batched CoinGecko call per
  manual refresh, strict boundary validation of the provider payload, per-chain
  fresh/expired/unavailable/error states, exact Decimal fiat math through
  `money.ts`, portfolio totals that include only fresh-quoted balances and
  read "Partial" when incomplete. The `money.ts` fiat utilities now have their
  live call site (closing ADR-0005's open consequence).
- The dashboard hero and asset rows show real prices with source
  ("CoinGecko") and freshness ("Updated just now / N min ago / HH:MM"). No
  polling loop exists anywhere in the feed.
- The asset-list screen shares `AssetRows` but passes no prices, so its rows
  show native balances only (honest, no fabricated fiat). Wiring prices there
  is open follow-up, not a silent gap: see the lane report.
- Known limitation: fiat display rounds to whole cents (the `money.ts`
  semantics). A sub-cent dust balance can round to $0.00; that is exact
  rounding of a true sub-cent value, not a missing price shown as zero — the
  four in-scope assets all price above $0.30, so a whole-unit price never
  rounds to zero.
- Known limitation: keyless CoinGecko shares an IP pool at about 5 calls/min
  and is not recommended for production. If the wallet ships to production
  traffic, the deployment must provision a Demo or paid CoinGecko key (or a
  different permitted provider) — the code already accepts
  `VITE_COINGECKO_DEMO_KEY`.
- Live checks: `scripts/check-live-prices.mjs` queries the real provider
  (4/4 fresh quotes + a forced-failure check that shows no price). The vitest
  suite uses recorded fixtures only and never touches the network.
