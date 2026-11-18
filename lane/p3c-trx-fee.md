# P3c — TRX fee/bandwidth only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; trx.ts factory already exists (from P3a).
Write ONLY estimateFee() of adapters/trx.ts. No other method.
GET `${baseUrl}/wallet/getchainparameters` → key 'getEnergyFee'; feeBaseUnits = String(value), unit 'SUN per unit of energy', note 'TRON fees are energy/bandwidth, not a flat tx fee'. Failure → error.
Tests (mocked fetch): fee comes from chain parameters; failure → error.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
