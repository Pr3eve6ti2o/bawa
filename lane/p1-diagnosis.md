# P1 — Diagnose: create-wallet step never advances to step 4 (READ-ONLY, no code changes)

Worktree on this VM: `/home/boxd/workspace/bawa-panel-rebuild/fix-create/` (branch `panel-rebuild/fix-create`, base `5638eea`).

## Symptom (observed in a real served browser)
After the user verifies the recovery words (step 3) and the wallet is created, the step indicator does NOT advance: step 3 stays highlighted/unticked and step 4 "Your wallet is ready" never shows its promised addresses. Navigating Home shows the wallet exists. No error banner was reported.

## Files to read first-hand
- `apps/web/src/screens/create-wallet.tsx` (407 lines) — `handleConfirm` calls `createVault`, then `unlockVault`, then `refreshVaultAccounts`, then `setStep(4)`; any throw lands in the catch, which sets an error and leaves step at 3.
- `apps/web/src/screens/create-wallet.test.tsx` — the mocked happy-path test PASSES and already asserts "Your wallet is ready" appears, so the bug is in the real (unmocked) path, not the mocked one.
- `apps/web/src/state/wallet-context.tsx` — `unlockVault` calls `vault.unlock` then `refreshVaultAccounts`; `refreshVaultAccounts` derives addresses via `vault.withMnemonic`, updates state with `vaultAddresses`, THEN awaits `refreshBalances()` and `refreshHistory()`. Adapters catch fetch errors and return `{status:'error'}`, so a failed balance/history fetch does not itself throw — find what CAN throw on this path in a real browser (CSP blocks cross-origin fetches; derivation uses wallet-core WASM).
- `apps/web/src/wallet/vault.ts` (`unlock`, `withMnemonic`), `apps/web/src/wallet/adapters/*.ts` (only the throw paths, not a full review).

## Deliverable
Write your answer to the output file ONLY (this call writes no code). Name the single most likely root cause with file:line evidence for each link in the throw chain, plus one alternative hypothesis if the first is wrong, and the exact minimal fix plan confined to `create-wallet.tsx` and its test (do NOT change verification logic, wallet creation, derivation, vault, signing, CSP, routing, or any other screen; do NOT change user-facing copy except what is strictly needed to show the addresses on step 4). State what test would prove the fix.

## Hard limits
No real crypto, disposable test credentials only, never real user funds or seed phrases. Never print, log, or include a private key or mnemonic.
