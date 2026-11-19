# Lane A, call 2 — bitcoinjs/bip39 v3.1.2 as JS test oracle: EMIT the test file (you have no shell access)

You have NO shell or filesystem access in this session. Do NOT try to install, run, or edit anything. Your ONLY job: output the complete contents of ONE file, exactly as it should be written to disk. A lane agent will install the dependency, write the file verbatim, and run the checks. Output nothing but the one file in a fenced code block with the file path as the first line.

Context: Bawa web wallet, apps/web, TypeScript, vitest. Already installed: @scure/bip39 v2.4.0 with wrapper `apps/web/src/wallet/bip39-validation.ts` exporting `validateBip39Mnemonic(mnemonic)`, `bip39SeedHex(mnemonic, passphrase?)`, `generateBip39Mnemonic(strength?)`. To be installed by the agent as a devDependency: `bip39@3.1.2` (ISC, bitcoinjs/bip39) — JS test oracle ONLY. It must NEVER be imported by runtime wallet code, only by this test file.

## File: apps/web/src/wallet/bip39-oracle.test.ts
Vitest test asserting cross-implementation agreement between bitcoinjs/bip39 and the @scure wrapper:
- `import * as bip39 from 'bip39'` (bitcoinjs API: `validateMnemonic(mnemonic)`, `mnemonicToSeedSync(mnemonic, password?)` returning a Buffer, `generateMnemonic(strength?)`).
- the published test phrase `abandon` x11 + `about` validates true under BOTH implementations; the string `not a real mnemonic phrase at all` validates false under BOTH.
- seed agreement: `bip39.mnemonicToSeedSync(TEST_MNEMONIC).toString('hex')` equals `bip39SeedHex(TEST_MNEMONIC)`; and with passphrase `TREZOR`, `bip39.mnemonicToSeedSync(TEST_MNEMONIC, 'TREZOR').toString('hex')` equals `bip39SeedHex(TEST_MNEMONIC, 'TREZOR')`.
- `bip39.generateMnemonic(256)` returns 24 words that validate true under the @scure wrapper.
- Do NOT guess any seed hex value. Assert ONLY the cross-implementation equalities above plus validation booleans. (If you can reproduce the exact BIP39 spec test-vector seed hex for this phrase with passphrase TREZOR from the BIP-0039 spec, you may add it as an extra assertion with a comment citing the spec; if unsure, leave it out.)
- Header comment: oracle only — bitcoinjs/bip39 is a devDependency for tests; wallet-core WASM (@trustwallet/wallet-core 4.9.3) owns production mnemonic handling; published test phrases only, never real mnemonics.

Keep the file short and typed. No other files, no commentary outside the code block.
