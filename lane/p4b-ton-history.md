# P4b — TON history only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; ton.ts factory already exists (from P4a).
Write ONLY getHistory(address, limit=10) of adapters/ton.ts. No other method.
POST getTransactions {address, limit}. Map: transaction_id.hash is base64 — convert to hex (helper base64ToHex using atob, no Buffer); utime → timestamp ms; out_msgs non-empty → 'out' (amount = first out_msg value, counterparty = first out_msg destination), else 'in' (amount = in_msg.value, counterparty = in_msg.source or null when empty); status 'confirmed'; explorerUrl `https://tonviewer.com/transaction/<hex hash>`. Empty result → ok []. Failure → error.
Tests (mocked fetch): history in/out, base64→hex hash, empty list.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
