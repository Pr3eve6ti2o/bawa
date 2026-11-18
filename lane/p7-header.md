Rewrite ONLY the header block of AppLayout in apps/web/src/app/app.tsx (the <header> inside the .bawa-panel div, roughly lines 44-64). Do not touch the nav, routes, or any other file.

Current header: a "B" letter tile, "Bawa Web Wallet", an "Account 01 ›" link to /wallets, and a "TESTNET · ACTIVE" chip. The app is mainnet-only — there is no testnet anywhere.

New header must: (1) delete the TESTNET chip and show a "Mainnet" network chip instead; (2) replace the "B" letter tile with the lucide Wallet icon (no letter tiles); (3) read useWallet(): when vaultState is 'no-vault' the account label reads "No wallet", otherwise "Account 01", still linking to /wallets; (4) add no chain switcher — there is no global chain switch in this app.

Return the full replacement header JSX plus any new imports. Keep all existing Tailwind classes and the dark-navy panel styling. Acceptance: header shows Mainnet, never Testnet, and the account label follows vaultState.
