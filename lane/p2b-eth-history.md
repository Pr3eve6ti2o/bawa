# P2b — ETH history only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; eth.ts factory + identity check already exist (from P2a); Blockscout is the history source.
Write ONLY getHistory(address, limit=20) of adapters/eth.ts. No other method.
GET `${historyBaseUrl ?? 'https://eth.blockscout.com/api'}?module=account&action=txlist&address=<addr>&page=1&offset=<limit>&sort=desc` via fetchJson. 'No transactions found' → ok []. Map each tx: hash; direction by from/to vs address case-insensitive (both → 'self'); amountBaseUnits = value wei string; counterparty = other side (null for self); timestamp = Number(timeStamp)*1000; status 'confirmed' if txreceipt_status==='1' else 'failed'; explorerUrl `https://eth.blockscout.com/tx/<hash>`.
Tests (mocked fetch): history in/out/self + failed + empty list.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
