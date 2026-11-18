# P6 — Dashboard + asset list on real balances (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced tsx/ts block per file, path as heading. Output code, not descriptions.

Context: apps/web; wallet-context exposes balances {status:'loading'|'zero'|'available'|'unavailable'|'error', value?, reason?}, vaultState, refreshBalances; chains.ts availableFor(capability); adapters/index getAdapter(chain); ui AssetRow (props avatar, symbol, amount, value, detail) and Skeleton.

Write:
1. apps/web/src/wallet/format.ts + format.test.ts: `formatNativeAmount(valueBaseUnits: string, decimals: number): string` — exact decimal shift, thousands grouping, trim trailing zeros; throws on non-integer/negative input. `CHAIN_DECIMALS = {btc:8, eth:18, trx:6, ton:9}`. `formatNativeWithSymbol(value, decimals, symbol)` appends ' BTC' etc.
2. apps/web/src/screens/dashboard.tsx (full rewrite): remove DEMO imports, testnet chip, demo footnote, address cards, lock banner. Hero: no fiat total exists (no price feed) — state honestly: 'Portfolio total unavailable — no price feed connected'. Action row: icon+text buttons (lucide-react) to /send, /receive, /transactions, /import-wallet. Assets: rows ONLY for availableFor('balance') chains, via AssetRow (avatar = first-letter chip + chain badge; symbol = chain name; amount = 'SYMBOL · <network name>'; value = formatted native balance or state text; detail = state). loading → Skeleton rows; zero → '0', detail 'Zero balance'; available → formatted balance; unavailable/error → detail 'Balance unavailable'/'Could not load balance' + Retry (refreshBalances). 'Hide zero balances' toggle. Refresh. Empty state: 'No balance adapters verified yet.' Vault card: 'locked' → 'Vault locked — unlock in Security'; 'no-vault' → onboarding card.
3. apps/web/src/screens/asset-list.tsx (full rewrite): same rows, hero, Refresh, toggle, empty state. Remove DEMO imports and the 'Demo figures' footnote.

Tests: dashboard.test.tsx + asset-list.test.tsx (vitest, mocked WalletProvider value, follow create-wallet.test.tsx patterns): loading shows skeletons; zero shows '0'; unavailable shows 'Balance unavailable' and never '0'; unverified chains absent; hide-zero toggle hides zero rows. Fix app.test.tsx assertions only if they depend on removed text.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, never render a fabricated number, mainnet only.
