// Copy the pinned wallet-core WASM binary into public/ so the browser
// loader (which resolves wallet-core.wasm relative to the page URL)
// can fetch it. The file is a build artifact, never committed.
//
// T47: the copy is integrity-checked. The binary must hash to the published
// @trustwallet/wallet-core@4.9.3 value in scripts/wasm-integrity.mjs; a
// mismatch fails the build instead of silently shipping a tampered engine.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_WASM_SHA256,
  sha256Hex,
  verifyWasmHash,
} from './wasm-integrity.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@trustwallet', 'wallet-core',
  'dist', 'lib', 'wallet-core.wasm');
const target = join(root, 'public', 'wallet-core.wasm');
if (!existsSync(source)) {
  console.error(`wallet-core.wasm not found at ${source}; run npm install first.`);
  process.exit(1);
}
const bytes = readFileSync(source);
if (!verifyWasmHash(bytes)) {
  console.error(
    `wallet-core.wasm integrity check FAILED: sha256 ${sha256Hex(bytes)} ` +
    `does not match the pinned 4.9.3 value ${EXPECTED_WASM_SHA256}. ` +
    `Refusing to copy; reinstall @trustwallet/wallet-core@4.9.3 from the registry.`,
  );
  process.exit(1);
}
mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(source, target);
console.log(`copied wallet-core.wasm -> public/wallet-core.wasm (sha256 verified)`);
