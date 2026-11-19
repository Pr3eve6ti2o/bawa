# Lane A, call 3 — mnemonic-words wordlist: EMIT the test file (you have no shell access)

You have NO shell or filesystem access in this session. Do NOT try to install, run, or edit anything. Your ONLY job: output the complete contents of ONE file, exactly as it should be written to disk. A lane agent already installed `mnemonic-words@2.0.0` (MIT) in apps/web and will write the file verbatim and run the checks. Output nothing but the one file in a fenced code block with the file path as the first line.

Verified export shape (do not guess another): the package is ESM, default export is the word array — `import mnemonicWords from 'mnemonic-words';` gives a `string[]`. Its source is the BIP-0039 English wordlist (per its own index.js comment). Already in the tree: `apps/web/src/wallet/bip39-validation.ts` exporting `validateBip39Mnemonic(mnemonic)` and `generateBip39Mnemonic(strength?)`, and `@scure/bip39/wordlists/english.js` exporting `wordlist`.

## File: apps/web/src/wallet/bip39-wordlist.test.ts
Vitest test asserting the mnemonic-words data matches the BIP39 English wordlist and works as a lightweight wordlist (data only — no generation, validation or seed derivation from this package itself):
- `mnemonicWords` has length 2048;
- it deep-equals the @scure English `wordlist` (same words, same order);
- spot checks: index 0 is `abandon`, and it includes `about`, `zoo`, `abandon` exactly once (use `filter` count for the `abandon` uniqueness check, or assert `indexOf('abandon')` is 0 and `lastIndexOf('abandon')` is 0);
- using it as the wordlist for @scure generation works: `generateMnemonic(mnemonicWords, 256)` from '@scure/bip39' returns 24 words that `validateBip39Mnemonic` accepts (import generateMnemonic from '@scure/bip39'; note the @scure wordlist import path needs the `.js` suffix: '@scure/bip39/wordlists/english.js');
- header comment: data only — mnemonic-words is the BIP39 English wordlist as JSON, for tests/tooling where a lightweight wordlist is needed without pulling in wallet-core; wallet-core WASM (@trustwallet/wallet-core 4.9.3) owns production mnemonic handling.

Keep the file short and typed. No other files, no commentary outside the code block.
