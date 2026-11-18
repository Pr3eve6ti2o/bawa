# P2c — ETH fee-quote only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; eth.ts factory + identity check already exist (from P2a); viem 2.58.0 installed.
Write ONLY estimateFee() of adapters/eth.ts. No other method.
gasPrice = await client.getGasPrice(); feeBaseUnits = (gasPrice * 21000n).toString(), unit 'wei', note 'Native-transfer estimate at current gas price, 21000 gas; not a final fee'. Failure → error.
Tests (mocked client): fee equals gasPrice × 21000; failure → error.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
