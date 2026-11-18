# P9a — Capability wiring (Bawa wallet rebuild, Fix Lane 2, Phases 2+3)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced tsx/ts block per file, path as heading, for every file you change. Output code, not descriptions.

Context: apps/web; adapters/index registerAllAdapters registers all four adapters; chains.ts has balance/history/fee-quote currently 'blocked' (evidence 'No Phase 2 adapter yet'); main.tsx renders <App/>; chains.test.ts tests the registry.

Write:
1. apps/web/src/wallet/chains.ts (edit): set balance/history/fee-quote to verified for btc/eth/trx with evidence 'Verified by apps/web/src/wallet/adapters/<chain>.test.ts + live mainnet balance cross-check (2026-11-19, REBUILD-EVIDENCE.md Phase 2+3)'. TON: balance/history verified (same evidence), fee-quote stays blocked with evidence 'TON fees depend on the unsigned message; estimated in Phase 4'. Update rpcEndpoints: btc ['https://mempool.space/api'], eth ['https://ethereum-rpc.publicnode.com'] (replace the 'viem:mainnet' marker); keep trx/ton URLs. All other capabilities unchanged.
2. apps/web/src/main.tsx (edit): import registerAllAdapters from './wallet/adapters' and call it once before createRoot().render.
3. apps/web/src/wallet/chains.test.ts (edit): add — availableFor('balance'|'history') returns all four chains; availableFor('fee-quote') returns btc/eth/trx only; rpcEndpoints contain no 'viem:mainnet' marker and no testnet URL. Keep existing tests passing.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only.
