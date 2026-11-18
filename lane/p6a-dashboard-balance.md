# P6a — Dashboard balance display only

> STATUS: already complete hands-on, commit 4e607c2. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: wallet-context exposes balances {status, value?, reason?}, refreshBalances; chains.ts availableFor; wallet/format.ts exists; ui AssetRow and Skeleton exist.
Write ONLY apps/web/src/screens/asset-rows.tsx: the shared AssetRows component. No other screen.
Rows ONLY for availableFor('balance') chains. Avatar = letter chip + chain badge. loading → Skeleton row; zero → formatted '0 SYM', detail 'Zero balance'; available → formatted native balance (never fiat); unavailable/error → 'Balance unavailable'/'Could not load balance' + Retry (refreshBalances). 'Hide zero balances' toggle prop. Empty state: 'No balance adapters verified yet.' Each row links to /assets/<chain>.
Tests (mocked WalletProvider): loading → skeletons; zero shows '0'; unavailable shows 'Balance unavailable', never '0'; unverified chains absent; hide-zero hides zero rows.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
