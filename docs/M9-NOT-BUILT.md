# M9 — okx-dex-market keyless DEX data: NOT-BUILT

Lane P2-D, 2026-11-28. Base token-gaps f1f0e6c. Hands-on Muse on
loud-stone, 0 Sol calls. No app code changed; no push.

## Verdict

NOT-BUILT. Live keyless operation does NOT verify. Every anonymous
request to the OKX DEX market API from loud-stone is refused: the
market endpoints demand x402 payment up front (HTTP 402), and the
index / security / config endpoints demand an API key (HTTP 401).
No free quota is granted to a fresh anonymous caller. Nothing was
wired into Bawa: no price fallback, no index price, no token-risk
signal. No price or risk value was invented.

## What the source evidence said (and what it actually means)

- The onchainos CLI source does contain an anonymous auth path: when
  no login token is present the client proceeds anonymously, sending
  only client-identifying headers (client version, agent-cli client
  type, platform, device-id, device-name) and no API key.
- The skill's payment notes describe a monthly free quota (1M basic
  calls, 100K premium calls) with x402 payment only after it is used
  up, plus new-user / grace-period quota allocations.
- What the live probes show is that this quota is allocated to a
  registered identity, not to an anonymous device-id. Anonymous auth
  existing in the client does not mean the server serves free data
  to anonymous callers. The earlier surveys' correction ("anonymous
  auth exists") is true at code level and false at server level for
  a fresh caller.

## Live evidence (all from loud-stone, 2026-11-28, curl, no account, no key)

Anonymous header set used for probes 3-9 (exactly the headers the
CLI sends anonymously): Content-Type application/json,
ok-client-version 4.6.12 (the CLI's own version), Ok-Access-Client-type
agent-cli, platform agent-cli, device-id a fresh random UUID,
device-name loud-stone. Token used in probes: USDT on Ethereum,
chainIndex 1, contract 0xdac17f958d2ee523a2206206994597c13d831ec7.

1. POST /api/v6/dex/market/price — bare curl, no extra headers:
   HTTP 402, x402 v2 payment demand.
2. POST /api/v6/dex/index/current-price — bare curl:
   HTTP 401, code 50103, "Request header OK-ACCESS-KEY can not be empty."
3. POST /api/v6/dex/market/price — full anonymous headers:
   HTTP 402. x402 accepts: 100 units on network eip155:196, payable in
   USDG or USDT0 to 0x0dedc3c5e15bee45166924ea5b02f54a35b1f9c6.
4. POST /api/v6/dex/index/current-price — full anonymous headers:
   HTTP 401, code 50114, "Invalid Authority".
5. GET /api/v6/dex/market/candles (1H, limit 5) — full headers:
   HTTP 402, same 100-unit x402 demand.
6. GET /api/v6/dex/market/token/search (keyword USDT) — full headers:
   HTTP 402, same 100-unit x402 demand.
7. POST /api/v6/dex/market/price-info — full headers:
   HTTP 402, x402 demand of 200 units.
8. POST /api/v6/security/token-scan — full headers:
   HTTP 401, code 50114, "Invalid Authority".
9. GET /api/v6/dex/market/config — full headers:
   HTTP 401, code 50114, "Invalid Authority". This endpoint is
   described in the CLI source as not paid; it still refuses
   anonymous callers, so no quota/tier map is obtainable anonymously
   either.

Score: 9 probes, 0 successes. 6 x 402, 3 x 401.

## What was NOT done, and why

- The installer / CLI binary was not run. The only remaining path
  that could conceivably obtain quota is the CLI's own first-run
  device registration, but that is a local CLI flow, not something a
  web app can do: Bawa in the browser would have to call these same
  HTTP endpoints, and they refuse anonymous callers. Even a CLI-side
  success would not make the source usable from the app.
- No key or account was created, and no payment was made. The x402
  amounts above are the server's demands, not anything paid.
- No code was changed in apps/web, prices.ts, price-fallbacks.ts,
  asset rows, or asset detail. The gates were not run because there
  is no diff to gate; the tree is exactly f1f0e6c plus this note.
- The existing verified-mark logic (tokens verified by contract
  address, not name/symbol) is untouched.

## What would unblock M9 (owner decision, not assumed)

- An OKX developer-portal project / API key, or a funded x402
  pay-per-use arrangement, either of which is a keyed/paid source —
  the opposite of the keyless premise of this item. Until the owner
  orders one of those, M9 stays NOT-BUILT and Bawa keeps its current
  price sources (CoinGecko first, then CoinLore / DexScreener /
  TonAPI / Coinbase) with no OKX index price and no DEX-side
  token-risk signal on screen.

## Skills used

- okx-dex-market (MIT, v4.6.12, wallet-repos survey copy): SKILL.md
  plus references/market.md, token.md, market-cli-reference.md,
  token-cli-reference.md, and _shared/payment-notifications.md,
  read for endpoint paths, request shapes, and the quota model.
  CLI source cli/src/client.rs, cli/src/endpoints.rs,
  cli/src/commands/market.rs, cli/src/commands/token.rs read for
  the anonymous-auth path, base URL, and exact endpoint paths.
- No Bawa design-system / CDP / a11y skill was needed: there is no
  UI change to verify.
