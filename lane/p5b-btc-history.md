# P5b — BTC history only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; btc.ts factory already exists (from P5a).
Write ONLY getHistory(address, limit=25) of adapters/btc.ts. No other method.
GET `${baseUrl}/address/${address}/txs` (slice to limit). Map: txid; vin/vout addresses + value sats; direction: address in both vin and vout → 'self'; only vout → 'in', amount = sum of vout values to the address; only vin → 'out', amount = sum of vout values NOT to the address; counterparty = first other-side address or null; timestamp = status.block_time * 1000 (null if unconfirmed); status from status.confirmed; explorerUrl `https://mempool.space/tx/<txid>`. Empty → ok [].
Tests (mocked fetch): history in/out/self + pending + empty list.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
