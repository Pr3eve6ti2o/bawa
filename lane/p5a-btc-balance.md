# P5a — BTC balance + UTXO inputs only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; BTC networkId bip122:000000000019d6689c085ae165831e93.
Write ONLY getBalance + getTxInputs of adapters/btc.ts, plus the factory shell (default 'https://mempool.space/api') and identity check. Other methods are stubs.
Identity: GET `${baseUrl}/v1/blocks/0` must return id '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f' (mainnet genesis); then assertNetworkId.
getBalance(address): format check (starts 'bc1q', 'bc1p', '1' or '3', length >= 26) else error 'Invalid Bitcoin address'. GET `${baseUrl}/address/${address}` → balance = BigInt(String(funded_txo_sum)) - BigInt(String(spent_txo_sum)) → {chain:'btc', networkId, valueBaseUnits: balance string, decimals:8, source:'mempool.space', fetchedAt}. Note JSON precision above MAX_SAFE_INTEGER as a recorded limitation. Failure → error.
getTxInputs(address): GET `${baseUrl}/address/${address}/utxo` → {kind:'utxo', utxos: [{txid, vout, valueBaseUnits: String(value)}]}.
Tests (mocked fetch): zero when funded equals spent; sats, decimals 8; genesis mismatch → identity error; invalid address → error; UTXO mapped.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
