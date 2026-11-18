# P6b — Asset-list rows only

> STATUS: already complete hands-on, commit 4e607c2. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: apps/web; screens/asset-rows.tsx (AssetRows) already exists (from P6a); wallet-context exposes refreshBalances.
Write ONLY apps/web/src/screens/asset-list.tsx (full rewrite). No other screen.
Remove DEMO imports and the 'Demo figures' footnote. Hero states honestly that no fiat total exists: 'Portfolio total unavailable — no price feed connected'. Body is the shared AssetRows component; add Refresh (refreshBalances) and the hide-zero toggle. Never render a fabricated number.
Tests (vitest, mocked WalletProvider): rows render via AssetRows; no fabricated total appears; no dollar amount appears in the rendered output.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
