# P4d — TON broadcast stub only (disabled)

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; ton.ts already exists (from P4a–P4c).
Write ONLY broadcast() of adapters/ton.ts. No other method.
broadcast must throw BROADCAST_DISABLED_MESSAGE and never send, sign or build a transaction. Mainnet broadcasting stays disabled until separately authorised (Mandatory Correction §4).
Tests: broadcast throws the disabled message.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
