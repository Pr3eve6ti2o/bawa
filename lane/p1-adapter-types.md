# P1 — Adapter shared types + registry (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced ts block per file, path as heading. Output code, not descriptions.

Context: apps/web; chains.ts (mainnet CAIP-2 IDs); providers.ts (BalanceProvider, register/getBalanceProvider).

Write:
1. apps/web/src/wallet/adapters/types.ts:
- `AdapterResult<T>`: ok {status:'ok', data, source, fetchedAt}; unavailable {status:'unavailable', reason}; error {status:'error', reason}. Exact zero is data, never an error.
- `AdapterBalance { chain, address, networkId, valueBaseUnits: string, decimals: number, source, fetchedAt }` — raw smallest-unit integer string; never float, never fiat.
- `AdapterTx { hash, chain, networkId, direction:'in'|'out'|'self', amountBaseUnits:string, counterparty:string|null, timestamp:number|null, status:'confirmed'|'pending'|'failed', explorerUrl:string|null }`. Unknowns are null.
- `FeeEstimate { chain, networkId, feeBaseUnits:string, unit:string, note:string, source, fetchedAt }`.
- `TxInput`: BTC {kind:'utxo', utxos:{txid,vout,valueBaseUnits}[]}, ETH {kind:'nonce', nonce:number}, TRX {kind:'account', balanceSun:string}, TON {kind:'seqno', seqno:number}.
- `ChainAdapter` (do NOT extend BalanceProvider — signatures clash): `chain`, `networkId`, `getBalance(address)`, `getHistory(address, limit?)`, `estimateFee()`, `getTxInputs(address)` (all return AdapterResult), `broadcast(_signedTx: unknown): Promise<never>` — MUST throw Error('Broadcast is disabled until separately authorised.') and never send anything. Plus `toBalanceProvider(): BalanceProvider` — getBalance returns {value: valueBaseUnits} on ok, throws Error(reason) otherwise; getHistory returns data or [].
- `fetchJson(url, init?, timeoutMs=10000)` via global fetch + AbortController; single attempt, no retry; timeout/network failure throws Error starting 'Network error: '; non-2xx throws 'HTTP <status>'; bad JSON throws 'Invalid response: '. No secrets in URL, headers or logs; adapters take public addresses only.
- `assertNetworkId(actual, expected, source)` throws naming expected vs actual on mismatch. Export `BROADCAST_DISABLED_MESSAGE`.
2. apps/web/src/wallet/adapters/index.ts — `registerAdapter(adapter)` (also calls registerBalanceProvider(chain, adapter.toBalanceProvider())), `getAdapter(chain)`, `registeredChains()`, `registerAllAdapters()` (empty for now).
3. apps/web/src/wallet/adapters/types.test.ts — vitest, mocked fetch: fetchJson timeout, HTTP error, invalid JSON, called exactly once (no retry); assertNetworkId pass/throw; broadcast throws the disabled message on a stub; toBalanceProvider ok/throw; registry register/get/registeredChains.

Rules: TypeScript strict, no `any` (unknown + narrowing), no new deps, no console.log, no mnemonic/seed/key handling, mainnet only.
