# P9b — Fixture/testnet cleanup (Bawa wallet rebuild, Fix Lane 2, Phases 2+3)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced tsx/ts block per file, path as heading, for every file you change. Output code, not descriptions. Do NOT touch send.tsx, create-wallet.tsx, import-wallet.tsx, mnemonic-backup.tsx, security-settings.tsx, welcome.tsx.

Context: apps/web; dashboard, asset-list and asset-detail no longer import demo-fixtures (rewritten in P6/P7b — verify by the imports you see); wallet-management.tsx still imports DEMO_ASSETS for a chip colour only.

Write:
1. apps/web/src/screens/wallet-management.tsx (edit): remove the DEMO_ASSETS import; chip colour → static CHIP_COLORS {btc:'#f7931a', eth:'#627eea', trx:'#eb0029', ton:'#0098ea'}. Nothing else changes.
2. apps/web/src/screens/network-selection.tsx (full rewrite, mainnet only): list BTC/ETH/TRX/TON mainnet as ACTIVE; remove all testnet entries and the 'Testnet only' / 'Mainnet — unavailable' copy; state 'Mainnet only — no testnet networks are configured. Balances and history come from the mainnet adapters.'
3. apps/web/src/engine/destination.ts (edit): reword the two testnet-name mentions to generic wording keeping the meaning: 'A TRON address string cannot prove mainnet: test networks share the 0x41 prefix, so the network comes from the configured endpoint, never the address.' and the limitations entry likewise. Do not change any logic.
4. apps/web/src/engine/confirmation-policy.md (edit): reword the line naming testnet adapters to 'no testnet adapters', keeping the sentence meaning.
5. DELETE apps/web/src/state/demo-fixtures.ts (confirm the deletion in your reply; the lane agent deletes the file).

After these changes, grep `demo-fixtures`, `$12,480`, `Testnet4`, `Sepolia`, `Nile` must return zero hits in apps/web/src — state explicitly whether your changes achieve that.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only.
