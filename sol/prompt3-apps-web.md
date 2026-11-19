Hi Sol, please help with a small naming review for the Bawa repo web app (apps/web/src, branch panel-rebuild/adopt-proper). I verified each file's contents first-hand; judge ONLY whether the current name is confusing, misleading, or inconsistent, and suggest a better name or say KEEP. Do not invent contents. Do not rename for the sake of it: a name that is merely plain but clear should be KEEP.

Items (current path — what it actually contains):
1. src/engine/boundary.ts — the wallet-core engine boundary: ChainId type, extended-key version validation, address validation, WASM init. Imported by 19 files. Its sibling src/wallet/chains.ts holds the supported-chains list and imports from boundary.ts.
2. src/wallet/providers.ts — registry of read-only balance providers (registerBalanceProvider, getBalance/getHistory interfaces). Imported by src/wallet/adapters/index.ts, which registers one adapter per chain.
3. src/wallet/wallet-context.test.tsx (165 lines) and src/wallet/wallet-context-balances.test.tsx — tests for the provider in src/state/wallet-context.tsx (they import WalletProvider from ../state/wallet-context). A DIFFERENT file, src/state/wallet-context.test.tsx (275 lines), also tests the same provider and sits next to it. So two test files share the basename wallet-context.test.tsx in different directories.
4. src/app/theme-toggle.tsx — a theme toggle component with ZERO imports anywhere in the app; the dark theme it would toggle is never applied.
5. src/ui/LICENSE-token-ui — the MIT licence file for the vendored token-ui components in src/ui/ (65 components copied from consenlabs/token-ui). Referenced from src/ui/NOTICE.md and templates/web/UPSTREAM.md.
6. src/app/app.tsx — the root App component, imported by src/main.tsx as ./app/app.
7. src/wallet/bip39-oracle.test.ts — a test-only cross-check: it compares our BIP39 validation against the bitcoinjs/bip39 library, which is a devDependency used only as a test oracle; production mnemonic handling is wallet-core WASM.
8. src/wallet/format.ts — chain decimal constants and amount formatting helpers. Compare src/wallet/money.ts — Decimal/dinero.js fiat display math (display and fiat only, never transaction inputs).
9. src/screens/asset-rows.tsx — shared asset-row components used by asset-list.tsx, asset-detail.tsx, dashboard.tsx, and wallet-management.tsx.
10. src/engine/confirmation-policy.md — a Markdown specification document sitting inside src/engine/ next to the TypeScript implementation files (confirmation-policy.ts and its test).

Reply as a short table, one row per item: current path | verdict KEEP or RENAME | new name (blank if KEEP) | one-line reason. For item 4, note that deleting the file is out of scope for this lane (renames only), so judge the name only. Acceptance check: every numbered item gets a verdict with a reason, and no rename is proposed without a concrete confusion it fixes. Keep the whole reply under 450 words. Thank you.
