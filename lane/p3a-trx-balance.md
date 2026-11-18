# P3a — TRX balance only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; TRX networkId tron:0x2b6653dc; TronGrid is the ONLY provider here — TronScan is separate, never use it.
Write ONLY getBalance of adapters/trx.ts, plus the factory shell (default 'https://api.trongrid.io') and endpoint check. Other methods are stubs.
Chain identity: TRON has no on-chain chain-id. Verify the pinned mainnet endpoint: GET `${baseUrl}/wallet/getnowblock` must return block_header.raw_data.number > 0; say so in a comment.
getBalance(address): format check (starts 'T', length 34, base58) else error 'Invalid TRON address'. GET `${baseUrl}/v1/accounts/${address}`; empty data[] → exact zero. data[0].balance is SUN → {chain:'trx', networkId:'tron:0x2b6653dc', valueBaseUnits: String(balance), decimals:6, source:'trongrid', fetchedAt}. Failure → error.
Tests (mocked fetch): zero for empty data[]; SUN string, decimals 6; invalid address → error; getnowblock without block header → error.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
