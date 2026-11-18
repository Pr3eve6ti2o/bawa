# P5c — BTC fee only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; btc.ts factory already exists (from P5a).
Write ONLY estimateFee() of adapters/btc.ts. No other method.
GET `${baseUrl}/v1/fees/recommended` → feeBaseUnits = String(fastestFee), unit 'sat/vB', note 'Rate per virtual byte; multiply by tx vsize in Phase 4'. Failure → error.
Tests (mocked fetch): fee is fastestFee sat/vB; failure → error.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
