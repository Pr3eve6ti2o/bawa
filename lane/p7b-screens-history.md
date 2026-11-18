# P7b — Asset detail + transaction history screens (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced tsx block per file, path as heading. Output code, not descriptions.

Context: apps/web; wallet-context exposes balances {status, value?, reason?}, history {status:'loading'|'loaded'|'empty'|'unavailable'|'error', txs: AdapterTx[], reason?}, refreshBalances, refreshHistory, xpubs, addresses; format.ts formatNativeAmount/CHAIN_DECIMALS; screens use `// @vitest-environment jsdom`, createRoot + act, vi.mock('../state/wallet-context') (see create-wallet.test.tsx).

Write:
1. apps/web/src/screens/asset-detail.tsx (full rewrite): remove DEMO import; chip colour → static CHIP_COLORS {btc:'#f7931a', eth:'#627eea', trx:'#eb0029', ton:'#0098ea'}. Header with icon+chain badge, Refresh button (refreshBalances + refreshHistory), Receive link. Balance card per balances[chain]: loading → Skeleton; zero → '0'; available → formatted native amount; unavailable/error → state text + Retry. Keep the derived-addresses section and xpub/derivation card unchanged. History section: top 5 txs from history[chain] (direction, formatted amount, truncated counterparty, date, status, explorer link) + 'View all' link to /transactions; empty → 'No transactions yet for this address.'; unavailable/error → state text + Retry.
2. apps/web/src/screens/transaction-history.tsx (full rewrite): chain filter pills (All + chains with verified history). Rows per chain history, same row shape as asset detail; per-chain states (loading Skeleton; empty 'No transactions yet'; unavailable/error + Retry calling refreshHistory). Tap a row → /transactions/<hash>. Keep Receive/Import links in the empty state.
3. apps/web/src/screens/transaction-detail.tsx (edit): look the :id hash up across history chains; show hash, chain, direction, amount, counterparty, date, status, explorer link; if absent: 'Transaction not in loaded history — check the explorer.' Keep the back link.

Tests: transaction-history.test.tsx + asset-detail.test.tsx (mocked useWallet): empty, loading, error states render; a history row links to /transactions/<hash>; asset detail shows the formatted balance and the top-5 history.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, never render a fabricated number, mainnet only.
