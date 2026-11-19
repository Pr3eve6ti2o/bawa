Rewrite three user-facing strings in apps/web/src/screens/receive.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-copy, branch panel-rebuild/fix-copy). Use plain user language, en-GB. Change NOTHING else in the file.

1. Current BTC warning (exact text):
"Only share this address to receive funds. Verify the address matches the one your repo tools derive before accepting funds."
Rewrite it with NO reference to repo or tools. Keep the substance: only share the address to receive funds, and check the address carefully before accepting funds.

2. Current TON note (exact text):
"This address can only receive. Withdrawing TON needs an external GUI wallet or the @ton/ton expert-assisted route — see docs/05-watch-only/GUI-WATCH-ONLY-WORKFLOW.md."
Rewrite it with NO docs/ path or repo reference. Keep the substance: this address can only receive TON; to withdraw or send TON you need an external wallet.

3. Current line (exact text):
"Mainnet only — this is a {config.displayName} mainnet address. Funds sent on another network cannot be recovered."
displayName is Bitcoin, Ethereum, TRON or TON, so this renders as "a Ethereum mainnet address" and "a TRON mainnet address" — wrong article. Reword it so it reads correctly for every chain.

Return ONLY the three complete replacement <p>...</p> blocks, one per fix, numbered 1-3. No explanation, no other changes.

Acceptance: no replacement contains "repo", "tools", "docs/", "a Ethereum", "a TRON", or "a TON" as a wrong article.
