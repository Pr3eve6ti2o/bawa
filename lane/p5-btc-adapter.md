# P5 — BTC adapter via mempool.space (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced ts block per file, path as heading. Output code, not descriptions.

Context: apps/web; adapters/types.ts (ChainAdapter, AdapterResult, fetchJson, assertNetworkId, BROADCAST_DISABLED_MESSAGE); chains.ts (BTC networkId bip122:000000000019d6689c085ae165831e93).

Write apps/web/src/wallet/adapters/btc.ts + btc.test.ts; update adapters/index.ts registerAllAdapters to register BTC too.

`createBtcAdapter(overrides?: { baseUrl?: string }): ChainAdapter` (default 'https://mempool.space/api'):
- Chain identity: GET `${baseUrl}/v1/blocks/0` must return id '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f' (mainnet genesis); then assertNetworkId with the BTC networkId. Cache the check per instance.
- getBalance(address): format check (starts 'bc1q', 'bc1p', '1' or '3', length >= 26) else {status:'error', reason:'Invalid Bitcoin address'}. GET `${baseUrl}/address/${address}` → chain_stats: balance = BigInt(String(funded_txo_sum)) - BigInt(String(spent_txo_sum)) → AdapterBalance {chain:'btc', networkId as above, valueBaseUnits: balance string, decimals:8, source:'mempool.space', fetchedAt}. Comment: JSON numbers lose precision above MAX_SAFE_INTEGER; personal-wallet limitation, recorded. Failure → error.
- getHistory(address, limit=25): GET `${baseUrl}/address/${address}/txs` (slice to limit). Map: txid; vin[].prevout.scriptpubkey_address, vout[].scriptpubkey_address + value sats; direction: address in both vin and vout → 'self'; only vout → 'in', amount = sum of vout values to the address; only vin → 'out', amount = sum of vout values NOT to the address; counterparty = first other-side address or null; timestamp = status.block_time * 1000 (null if unconfirmed); status from status.confirmed; explorerUrl `https://mempool.space/tx/<txid>`. Empty → ok [].
- estimateFee(): GET `${baseUrl}/v1/fees/recommended` → feeBaseUnits = String(fastestFee), unit 'sat/vB', note 'Rate per virtual byte; multiply by tx vsize in Phase 4'.
- getTxInputs(address): GET `${baseUrl}/address/${address}/utxo` → {kind:'utxo', utxos: [{txid, vout, valueBaseUnits: String(value)}]}.
- broadcast: throw BROADCAST_DISABLED_MESSAGE, never send.

Tests (vitest, mocked fetch): zero when funded equals spent; sats arithmetic, decimals 8; genesis mismatch → identity error; invalid address → error; history in/out/self + pending + empty; fee fastestFee sat/vB; UTXO inputs mapped; broadcast throws disabled.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only, single attempt per call.
