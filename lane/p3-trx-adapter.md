# P3 — TRX adapter via TronGrid (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced ts block per file, path as heading. Output code, not descriptions.

Context: apps/web; adapters/types.ts (ChainAdapter, AdapterResult, fetchJson, assertNetworkId, BROADCAST_DISABLED_MESSAGE); chains.ts (TRX networkId tron:0x2b6653dc).

Write apps/web/src/wallet/adapters/trx.ts + trx.test.ts; update adapters/index.ts registerAllAdapters to also register TRX (keep ETH).

`createTronAdapter(overrides?: { baseUrl?: string }): ChainAdapter` (default 'https://api.trongrid.io'; TronScan is separate — never use it here):
- Chain identity: TRON has no on-chain chain-id. Verify the pinned mainnet endpoint: GET `${baseUrl}/wallet/getnowblock` must return block_header.raw_data.number > 0. Say so in a comment; call assertNetworkId('tron:0x2b6653dc', 'tron:0x2b6653dc', source) after it passes.
- getBalance(address): format check (starts 'T', length 34, base58) else {status:'error', reason:'Invalid TRON address'}. GET `${baseUrl}/v1/accounts/${address}`; empty data[] → exact zero. data[0].balance is SUN → AdapterBalance {chain:'trx', networkId:'tron:0x2b6653dc', valueBaseUnits: String(balance), decimals:6, source:'trongrid', fetchedAt}. Failure → error.
- getHistory(address, limit=20): GET `${baseUrl}/v1/accounts/${address}/transactions?limit=${limit}&order_by=block_timestamp,desc`. Map native TransferContract txs: txID; block_timestamp → timestamp ms; parameter.value {amount SUN string, owner_address, to_address} → direction vs address (both → 'self'), amountBaseUnits = amount, counterparty = other side (null for self); status 'confirmed'; explorerUrl `https://tronscan.org/#/transaction/${txID}` (link only). Empty data → ok []. Failure → error.
- estimateFee(): GET `${baseUrl}/wallet/getchainparameters` → key 'getEnergyFee'; feeBaseUnits = String(value), unit 'SUN per unit of energy', note 'TRON fees are energy/bandwidth, not a flat tx fee'.
- getTxInputs(address): reuse getBalance → {kind:'account', balanceSun: valueBaseUnits}; propagate non-ok.
- broadcast: throw BROADCAST_DISABLED_MESSAGE, never send.

Tests (vitest, mocked fetch): zero balance for empty data[]; balance SUN string, decimals 6; invalid address → error; getnowblock without block header → error; history in/out/self + empty; fee from chain parameters; tx inputs carry balanceSun; broadcast throws disabled message.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only, single attempt per call.
