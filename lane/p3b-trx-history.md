# P3b — TRX history only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; trx.ts factory already exists (from P3a); TronGrid only — TronScan is a link target, never a provider.
Write ONLY getHistory(address, limit=20) of adapters/trx.ts. No other method.
GET `${baseUrl}/v1/accounts/${address}/transactions?limit=${limit}&order_by=block_timestamp,desc`. Map native TransferContract txs only (skip contract calls, never fabricate): txID; block_timestamp → timestamp ms; parameter.value {amount SUN string, owner_address, to_address} → direction vs address (both → 'self'), amountBaseUnits = amount, counterparty = other side (null for self); status 'confirmed'; explorerUrl `https://tronscan.org/#/transaction/${txID}`. Empty data → ok []. Failure → error.
Tests (mocked fetch): history in/out/self + empty list.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
