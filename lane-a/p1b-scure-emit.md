# Lane A, call 1b — @scure/bip39 v2.4.0: EMIT the two files (you have no shell access)

You have NO shell or filesystem access in this session. Do NOT try to install, run, or edit anything. Your ONLY job: output the complete contents of the two files below, exactly as they should be written to disk. A lane agent will write them verbatim and run the checks. Output nothing but the two files, each in its own fenced code block with the file path as the first line.

Context: Bawa web wallet, apps/web, TypeScript, vitest. Library: @scure/bip39 v2.4.0 (MIT). API: `import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39'` and `import { wordlist } from '@scure/bip39/wordlists/english'`. `generateMnemonic(wordlist, strength)`, `validateMnemonic(mnemonic, wordlist)`, `mnemonicToSeedSync(mnemonic, passphrase?)` returns Uint8Array (64 bytes).

## File 1: apps/web/src/wallet/bip39-validation.ts
Thin wrapper exporting:
- `validateBip39Mnemonic(mnemonic: string): boolean` — validateMnemonic with the English wordlist; return false (do not throw) on any invalid input.
- `bip39SeedHex(mnemonic: string, passphrase = ''): string` — mnemonicToSeedSync, hex-encoded (128 hex chars). Throw a plain Error('Invalid mnemonic.') if validation fails.
- `generateBip39Mnemonic(strength: 128 | 256 = 256): string` — generateMnemonic(wordlist, strength).
File header comment must state: validation / test-vector / docs use ONLY — NOT the production mnemonic engine; Trust Wallet Core WASM (@trustwallet/wallet-core 4.9.3) owns production mnemonic handling; never log a mnemonic or seed.

## File 2: apps/web/src/wallet/bip39-validation.test.ts
Vitest tests (import from 'vitest', import the wrapper from './bip39-validation'):
- the published test phrase `abandon` x11 + `about` validates true;
- the string `not a real mnemonic phrase at all` validates false;
- `generateBip39Mnemonic(256)` returns 24 words, every word in the @scure English wordlist, and validates true;
- `generateBip39Mnemonic(128)` returns 12 words and validates true;
- `bip39SeedHex` is deterministic (same input twice gives the same 128-hex-char string) and differs when the passphrase differs;
- `bip39SeedHex` throws on an invalid mnemonic.
Use ONLY published test phrases — never a real mnemonic. No network, no wallet-core imports in this test.

Keep both files short, typed, and lint-clean. No other files, no commentary outside the two code blocks.
