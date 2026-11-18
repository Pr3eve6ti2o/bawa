# P4c — TON fee only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; ton.ts already exists (from P4a–P4b).
Write ONLY estimateFee() of adapters/ton.ts. No other method.
Return {status:'unavailable', reason:'TON fees depend on the unsigned message; estimated in the Phase 4 send flow'}. Never invent a fee number — TON fee-quote stays blocked in chains.ts for this reason.
Tests: fee-quote returns unavailable with that reason.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
