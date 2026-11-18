# P4 — TON adapter via TonCenter (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced ts block per file, path as heading. Output code, not descriptions.

Context: apps/web; adapters/types.ts (ChainAdapter, AdapterResult, fetchJson, assertNetworkId, BROADCAST_DISABLED_MESSAGE); chains.ts (TON networkId ton:-239).

Write apps/web/src/wallet/adapters/ton.ts + ton.test.ts; update adapters/index.ts registerAllAdapters to register TON too.

`createTonAdapter(overrides?: { baseUrl?: string }): ChainAdapter` (default 'https://toncenter.com/api/v2/jsonRPC'; testnet host testnet.toncenter.com must never be used). All calls POST JSON-RPC {id:1, jsonrpc:'2.0', method, params} via fetchJson; ok:false or an error field → {status:'error', reason}.
- Chain identity: POST getMasterchainInfo must return ok:true with numeric last.seqno; host is the pinned mainnet host.
- getBalance(address): format check (starts 'EQ' or 'UQ', length 48) else {status:'error', reason:'Invalid TON address'}. POST getAddressBalance {address} → result nanoTON string → AdapterBalance {chain:'ton', networkId:'ton:-239', valueBaseUnits: result, decimals:9, source:'toncenter', fetchedAt}. Failure → error.
- getHistory(address, limit=10): POST getTransactions {address, limit}. Map: transaction_id.hash is base64 — convert to hex (helper base64ToHex using atob, no Buffer); utime → timestamp ms; out_msgs non-empty → 'out' (amount = first out_msg value, counterparty = first out_msg destination), else 'in' (amount = in_msg.value, counterparty = in_msg.source or null when empty); status 'confirmed'; explorerUrl `https://tonviewer.com/transaction/<hex hash>`. Empty result → ok [].
- estimateFee(): return {status:'unavailable', reason:'TON fees depend on the unsigned message; estimated in the Phase 4 send flow'}. Never invent a fee number.
- getTxInputs(address): POST runGetMethod {address, method:'seqno', stack:[]} → result.stack[0] is ['num', '0x<hex>'] → seqno = parseInt(hex, 16); return {kind:'seqno', seqno}. Failure → error.
- broadcast: throw BROADCAST_DISABLED_MESSAGE, never send.

Tests (vitest, mocked fetch): zero balance '0'; nanoTON string, decimals 9; invalid address → error; history in/out, base64→hex hash, empty; fee unavailable; seqno from hex stack; broadcast throws disabled; ok:false → error.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only, single attempt per call.
