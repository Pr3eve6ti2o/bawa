/**
 * crypto-architecture.test.js — static boundary tests for apps/web/src.
 *
 * Run: node scripts/crypto-architecture.test.js (from the repo root, or
 * anywhere — the repo root is resolved from this file's location).
 * Plain node:test; no dependencies; reads files, never executes the app.
 *
 * Each test names the concrete violation it would catch. These are
 * architecture invariants, not behaviour tests: a refactor that moves a
 * boundary must update the allowlist here deliberately, not silently.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO_ROOT, 'apps', 'web', 'src');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

const ALL_FILES = walk(SRC);
const rel = (file) => file.slice(SRC.length + 1);
const layerOf = (file) => {
  const parts = rel(file).split(sep);
  return parts.length > 1 ? parts[0] : '(root)';
};

/**
 * Strip line/block comments and (unless keepStrings) string/template
 * literals, keeping line breaks, so identifier checks see code only.
 * A comment stating a rule (e.g. "adapters never receive mnemonics")
 * must not trip the check. Import specifiers are strings, so the
 * specifier extractor keeps them (keepStrings = true).
 */
function stripCommentsAndStrings(code, keepStrings = false) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const two = code.slice(i, i + 2);
    if (two === '//') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (two === '/*') {
      const end = code.indexOf('*/', i + 2);
      const chunk = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      out += chunk.replace(/[^\n]/g, ' ');
      i = end === -1 ? code.length : end + 2;
    } else if (code[i] === "'" || code[i] === '"' || code[i] === '`') {
      const quote = code[i];
      out += keepStrings ? quote : ' ';
      i++;
      while (i < code.length) {
        if (code[i] === '\\') {
          out += keepStrings ? code.slice(i, i + 2) : '  ';
          i += 2;
        } else if (code[i] === quote) {
          out += keepStrings ? quote : ' ';
          i++;
          break;
        } else {
          out += keepStrings ? code[i] : code[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
    } else {
      out += code[i];
      i++;
    }
  }
  return out;
}

const IMPORT_SPEC_RE =
  /(?:import\s+(?:[^'";]*?\sfrom\s+)?|export\s+(?:[^'";]*?\sfrom\s+)?|import\(\s*)['"]([^'"]+)['"]/g;

function importSpecifiers(code) {
  const stripped = stripCommentsAndStrings(code, true);
  const specs = [];
  for (const match of stripped.matchAll(IMPORT_SPEC_RE)) specs.push(match[1]);
  return specs;
}

function resolveLayer(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // package import: not a layer edge
  const parts = resolve(dirname(fromFile), spec)
    .slice(SRC.length + 1)
    .split(sep);
  return parts.length > 1 ? parts[0] : '(root)';
}

test('adapters never receive secrets', () => {
  // A chain adapter that took a mnemonic, seed phrase or private key
  // would leak vault material to third-party provider code. The only
  // mention in adapters/ is a comment stating this rule (stripped here).
  const bad = [];
  for (const file of ALL_FILES.filter((f) => rel(f).startsWith(`wallet${sep}adapters${sep}`))) {
    const code = stripCommentsAndStrings(readFileSync(file, 'utf8'));
    for (const word of ['mnemonic', 'seedPhrase', 'privateKey']) {
      if (new RegExp(`\\b${word}\\b`).test(code)) bad.push(`${rel(file)}: ${word}`);
    }
  }
  assert.deepEqual(bad, [], `secret identifier in an adapter: ${bad.join('; ')}`);
});

test('wallet-core is imported only by the engine boundary and the offline signer', () => {
  // The WASM engine has two consumers: engine/boundary.ts (initWasm) and
  // wallet/send.ts (TW namespace, offline signing). A new importer —
  // e.g. a screen or the state layer reaching past the boundary — fails.
  const importers = ALL_FILES.filter((f) =>
    importSpecifiers(readFileSync(f, 'utf8')).includes('@trustwallet/wallet-core'),
  ).map(rel);
  assert.deepEqual(
    importers.sort(),
    ['engine/boundary.ts', 'wallet/send.ts'].sort(),
    `unexpected @trustwallet/wallet-core importer: ${importers.join(', ')}`,
  );
});

test('broadcast is disabled', () => {
  // broadcastSigned must stay a hard disabled stub: any real broadcast
  // path would need separate authorisation. This fails if the function
  // ever returns anything other than the disabled reason.
  const send = readFileSync(join(SRC, 'wallet', 'send.ts'), 'utf8');
  assert.match(send, /export async function broadcastSigned\(/);
  assert.match(
    send,
    /return \{ status: 'disabled', reason: BROADCAST_DISABLED_MESSAGE \};/,
  );
});

test('engine never imports wallet, state or screens', () => {
  // The engine is the bottom layer: if it imported the wallet or UI
  // layers, the dependency direction would invert and the WASM boundary
  // could pull in vault/state code.
  const bad = [];
  for (const file of ALL_FILES.filter((f) => layerOf(f) === 'engine')) {
    for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
      const target = resolveLayer(file, spec);
      if (target === 'wallet' || target === 'state' || target === 'screens') {
        bad.push(`${rel(file)} imports ${target} via '${spec}'`);
      }
    }
  }
  assert.deepEqual(bad, [], `engine layer breach: ${bad.join('; ')}`);
});

test('the mnemonic has one entry point: the offline signer', () => {
  // withMnemonicAsync is the only function that yields the mnemonic, and
  // only the send screen calls it (to sign offline). A second caller —
  // e.g. a balance or history path — fails.
  const callers = [];
  for (const file of ALL_FILES) {
    if (rel(file) === join('wallet', 'vault.ts')) continue; // the definition
    const code = stripCommentsAndStrings(readFileSync(file, 'utf8'));
    if (/\bwithMnemonicAsync\s*\(/.test(code)) callers.push(rel(file));
  }
  assert.deepEqual(callers, ['screens/send.tsx'], `withMnemonicAsync caller: ${callers.join(', ')}`);
});

test('vault creation has two entry points', () => {
  // A vault is created only when the user creates or imports a wallet.
  // A third createVault caller (e.g. an auto-created vault on first run)
  // fails.
  const callers = [];
  for (const file of ALL_FILES) {
    if (rel(file) === join('wallet', 'vault.ts')) continue; // the definition
    const code = stripCommentsAndStrings(readFileSync(file, 'utf8'));
    if (/\bcreateVault\s*\(/.test(code)) callers.push(rel(file));
  }
  assert.deepEqual(
    callers.sort(),
    ['screens/create-wallet.tsx', 'screens/import-wallet.tsx'].sort(),
    `createVault caller: ${callers.join(', ')}`,
  );
});

test('vault module imports stay in state, screens and wallet', () => {
  // The vault module is imported by the context (state), the entry
  // screens (create/import/send/backup) and wallet-internal helpers.
  // app/ or engine/ importing it would widen vault access.
  const bad = [];
  for (const file of ALL_FILES) {
    for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
      if (/(^|\/)vault$/.test(spec)) {
        const layer = layerOf(file);
        if (layer !== 'state' && layer !== 'screens' && layer !== 'wallet') {
          bad.push(`${rel(file)} imports vault from ${layer}`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], `vault import outside state/screens/wallet: ${bad.join('; ')}`);
});
