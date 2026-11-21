#!/usr/bin/env node
/**
 * check-wallet-cycles — import-graph cycle detector + layer-rule checker
 * for apps/web/src.
 *
 * Usage: node scripts/check-wallet-cycles.mjs (from the repo root, or
 * anywhere — the repo root is resolved from this file's location).
 * Exit 0 when the graph is clean; exit 1 listing every violation.
 *
 * Layers (first path segment under apps/web/src) and what each may import
 * (relative imports only; package imports are outside this check):
 *   engine  -> engine
 *   wallet  -> engine, wallet, ui (ui is a presentational leaf: it imports
 *               nothing from wallet/state/screens/engine, so using a Button
 *               does not create a dependency on app logic)
 *   state   -> engine, wallet, state, ui
 *   screens -> engine, wallet, state, screens, ui
 *   app     -> engine, wallet, state, screens, ui, app, assets
 *   ui      -> ui
 *   assets  -> assets
 *   (root)  -> anything (main.tsx is the composition entry point)
 * Files under any other top-level directory have no layer rule and are
 * only checked for cycles.
 *
 * Test files (*.test.*) are skipped: test-only cycles do not ship.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO_ROOT, 'apps', 'web', 'src');

const ALLOWED = {
  engine: new Set(['engine']),
  wallet: new Set(['engine', 'wallet', 'ui']),
  state: new Set(['engine', 'wallet', 'state', 'ui']),
  screens: new Set(['engine', 'wallet', 'state', 'screens', 'ui']),
  app: new Set(['engine', 'wallet', 'state', 'screens', 'ui', 'app', 'assets']),
  ui: new Set(['ui']),
  assets: new Set(['assets']),
};

const IMPORT_RE =
  /(?:import\s+(?:[^'";]*?\sfrom\s+)?|export\s+(?:[^'";]*?\sfrom\s+)?|import\(\s*)['"](\.[^'"]+)['"]/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

function layerOf(file) {
  const rel = file.slice(SRC.length + 1);
  const first = rel.split(sep)[0];
  return rel.includes(sep) ? first : '(root)';
}

function resolveImport(fromFile, spec) {
  // Only code modules are edges. Asset imports (.png/.css/.svg/...) resolve
  // to a file but carry no code dependency, so they are not layer edges.
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const files = walk(SRC);
const edges = new Map(); // file -> [{ to, line }]
const violations = [];

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  const lines = code.split('\n');
  const fileEdges = [];
  for (let i = 0; i < lines.length; i++) {
    IMPORT_RE.lastIndex = 0;
    for (const match of lines[i].matchAll(IMPORT_RE)) {
      const target = resolveImport(file, match[1]);
      if (target === null) continue; // asset/css/json import: not a module edge
      fileEdges.push({ to: target, line: i + 1 });
      const fromLayer = layerOf(file);
      const toLayer = layerOf(target);
      const allowed = ALLOWED[fromLayer];
      if (allowed && toLayer !== '(root)' && !allowed.has(toLayer)) {
        violations.push(
          `${file}:${i + 1}: layer violation: ${fromLayer} imports ${toLayer} (${target.slice(SRC.length + 1)})`,
        );
      }
    }
  }
  edges.set(file, fileEdges);
}

// Cycle detection: iterative DFS, one report per distinct cycle.
const WHITE = 0;
const GREY = 1;
const BLACK = 2;
const color = new Map(files.map((f) => [f, WHITE]));
const cycles = [];
for (const start of files) {
  if (color.get(start) !== WHITE) continue;
  const stack = [{ file: start, index: 0 }];
  color.set(start, GREY);
  const path = [start];
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    const neighbours = (edges.get(top.file) ?? []).map((e) => e.to);
    if (top.index < neighbours.length) {
      const next = neighbours[top.index];
      top.index += 1;
      if (color.get(next) === GREY) {
        const at = path.indexOf(next);
        cycles.push([...path.slice(at), next]);
      } else if (color.get(next) === WHITE) {
        color.set(next, GREY);
        path.push(next);
        stack.push({ file: next, index: 0 });
      }
    } else {
      color.set(top.file, BLACK);
      stack.pop();
      path.pop();
    }
  }
}

let edgeCount = 0;
for (const list of edges.values()) edgeCount += list.length;

if (cycles.length > 0) {
  for (const cycle of cycles) {
    violations.push(
      `CYCLE: ${cycle.map((f) => f.slice(SRC.length + 1)).join(' -> ')}`,
    );
  }
}

if (violations.length > 0) {
  for (const violation of violations) console.log(violation);
  console.log(
    `check-wallet-cycles: FAIL (${violations.length} violation(s); ${files.length} files, ${edgeCount} edges)`,
  );
  process.exit(1);
}
console.log(
  `check-wallet-cycles: OK (${files.length} files, ${edgeCount} edges, 0 cycles, 0 layer violations)`,
);
