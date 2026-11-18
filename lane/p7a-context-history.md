# P7a — History state in wallet context (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced tsx block per file, path as heading. Output code, not descriptions.

Context: apps/web/src/state/wallet-context.tsx (read it in full in the repo — it has balances + refreshBalances using getBalanceProvider, vaultAddresses, addresses, availableFor via chains.ts capabilitiesFor). adapters/index getAdapter(chain) returns a ChainAdapter with getBalance/getHistory returning AdapterResult. AdapterTx type is in adapters/types.ts.

Edit apps/web/src/state/wallet-context.tsx ONLY, keeping everything else byte-identical in behaviour:
- Add history: Record<chain, {status:'loading'|'loaded'|'empty'|'unavailable'|'error', txs: AdapterTx[], reason?: string}> to WalletState, initial per-chain {status:'unavailable', reason:'no-adapter', txs:[]}.
- Add refreshHistory(): Promise<void> — per chain: if availableFor('history') excludes it → {status:'unavailable', reason:'no-adapter', txs:[]}; else address = vaultAddresses[chain][0] ?? addresses[chain][0]?.address; no address → {status:'unavailable', reason:'no-address', txs:[]}; else set loading, call getAdapter(chain).getHistory(address, 25): ok with [] → {status:'empty', txs:[]}; ok with txs → {status:'loaded', txs}; unavailable → {status:'unavailable', reason, txs:[]}; error → {status:'error', reason, txs:[]}. Guard stale results with a per-chain request counter like the existing balanceRequests pattern.
- Rewrite refreshBalances to use getAdapter(chain) directly instead of getBalanceProvider: ok → value '0' ? {status:'zero', value} : {status:'available', value}; unavailable → {status:'unavailable', reason}; error → {status:'error', reason}. Keep the no-adapter / no-address branches. Keep the existing stale-request guard.
- Expose history + refreshHistory in WalletContextValue and the provider value memo.
- After refreshVaultAccounts successfully derives addresses, call refreshBalances() and refreshHistory().

Tests: append to apps/web/src/wallet/wallet-context.test.tsx (follow its existing patterns — read it first): register stub adapters via registerAdapter; history loaded/empty/unavailable/error per stub result; refreshBalances maps adapter unavailable → 'unavailable' (not 'error'); balances still report unavailable with no adapter. Return the complete updated test file too.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only.
