// Copy the pinned wallet-core WASM binary into public/ so the browser
// loader (which resolves wallet-core.wasm relative to the page URL)
// can fetch it. The file is a build artifact, never committed.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@trustwallet', 'wallet-core',
  'dist', 'lib', 'wallet-core.wasm');
const target = join(root, 'public', 'wallet-core.wasm');
if (!existsSync(source)) {
  console.error(`wallet-core.wasm not found at ${source}; run npm install first.`);
  process.exit(1);
}
mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(source, target);
const hash = createHash('sha256').update(readFileSync(target)).digest('hex');
console.log(`copied wallet-core.wasm -> public/wallet-core.wasm (sha256 ${hash.slice(0, 16)}…)`);
