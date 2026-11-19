# Lane A, call 1 — @scure/bip39 v2.4.0 in apps/web (validation/test use only)

Worktree: /home/boxd/workspace/bawa-adopt-bip39, branch panel-rebuild/adopt-bip39.
Node 22: every npm/node command MUST run with PATH=/home/boxd/node22/bin:$PATH (system Node 24 fails the engine check).

## Do this one piece only
1. Install exact version in apps/web: `npm install --save-exact @scure/bip39@2.4.0` (MIT, verified from npm). Confirm package.json shows 2.4.0 and package-lock.json updated. Do NOT touch @trustwallet/wallet-core 4.9.3 — it stays the production mnemonic engine. This library is for validation, test vectors and docs examples ONLY.
2. Create `apps/web/src/wallet/bip39-validation.ts`: a thin wrapper around @scure/bip39 exporting `validateBip39Mnemonic(mnemonic: string): boolean`, `bip39SeedHex(mnemonic: string, passphrase?: string): string` (via mnemonicToSeedSync, hex-encoded), and `generateBip39Mnemonic(strength?: 128 | 256): string` (via generateMnemonic with the English wordlist). File header comment must state: validation/test/docs only, NOT the production engine; wallet-core WASM owns production mnemonic handling; never log a mnemonic or seed.
3. Create `apps/web/src/wallet/bip39-validation.test.ts` (vitest) asserting: the published test phrase `abandon` x11 + `about` validates true; a garbage string validates false; `generateBip39Mnemonic(256)` returns 24 words, each in the English wordlist, and validates true; `bip39SeedHex` is deterministic (same input twice gives the same 128-hex-char output) and differs with a different passphrase. Use ONLY published test phrases — never a real mnemonic.
4. Run in apps/web: `npm run typecheck` (tsc --noEmit) exit 0, and `npx vitest run src/wallet/bip39-validation.test.ts` pass.

## Hard limits
- Do NOT change wallet-core usage, derivation paths, vault encryption, or any broadcast path. Do NOT install/run/include anything from the AVOID list (Seed-Generator, Ethereum-Stealer, seedphrasegenerator, Pymmdrza tools, EnigmaCracker, eth-fast-mnemonic-checker, Mizogg-Tools, MinightDev, BLM_0.2BTC, tatum-kms, passivedns-client, blockchain-certification). Do NOT commit or push (LOCAL ONLY).
- Do NOT print or log any mnemonic or seed value in test output beyond the already-published `abandon` test phrase.

## Report back in your output (short)
Exact version installed (package.json + lockfile lines), files created/changed, typecheck + test results (pass/fail counts), and anything that did not verify.
