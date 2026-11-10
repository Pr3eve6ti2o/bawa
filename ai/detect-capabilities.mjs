// Bawa AI Wallet Builder: inspect local toolchain and manifest capabilities.
// Usage: node ai/detect-capabilities.mjs
// Exit 0: all required capability checks pass.
// Exit 1: one or more required capability checks fail.
// Read-only and offline; never expose secrets or raw command errors.
// Missing files and failed commands become status results, not exceptions.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(process.argv[1] ?? 'ai/detect-capabilities.mjs'),
  '..'
);

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      cwd: ROOT, encoding: 'utf8', timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } // Prevent index refresh writes.
    }).trim();
  } catch { return null; }
}

function readJson(path) {
  try {
    const text = readText(path);
    return text === null ? null : JSON.parse(text);
  } catch { return null; }
}

function readText(path) {
  try { return fs.readFileSync(path, 'utf8'); } catch { return null; }
}

function parseVersion(text) {
  return typeof text === 'string' ? text.match(/\d+\.\d+\.\d+/)?.[0] ?? null : null;
}

// Compare numeric X.Y.Z strings: min inclusive, max exclusive; null max is unbounded.
function inRange(version, min, max) {
  const v = parseVersion(version), lo = parseVersion(min), hi = parseVersion(max);
  if (!v || !lo || (max != null && !hi)) return false;
  const compare = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    }
    return 0;
  };
  return compare(v, lo) >= 0 && (hi === null || compare(v, hi) < 0);
}

function detectNode() {
  const version = parseVersion(process.version);
  return {
    status: version === null ? 'missing' : inRange(version, '22.0.0', '23.0.0') ? 'ok' : 'out-of-range',
    detail: `Node ${version ?? 'unavailable'}; required >=22.0.0 <23.0.0`
  };
}

function detectPython() {
  const output = run('python3', ['--version']);
  const version = parseVersion(output);
  return {
    status: version === null ? 'missing' : inRange(version, '3.11.0', null) ? 'ok' : 'out-of-range',
    detail: `Python ${version ?? (output === null ? 'unavailable' : 'version unparseable')}; required >=3.11.0`
  };
}

function detectGit() {
  const head = run('git', ['rev-parse', 'HEAD']) || null;
  const changes = run('git', ['status', '--porcelain']);
  const dirty = changes !== null && changes.length > 0;
  return {
    status: head === null || changes === null ? 'missing' : dirty ? 'dirty' : 'ok',
    detail: `Git HEAD ${head?.slice(0, 8) ?? 'unavailable'}; ${
      changes === null ? 'clean/dirty unknown' : dirty ? 'dirty' : 'clean'}`,
    head,
    dirty
  };
}

function detectEngine() {
  const pkg = readJson(path.join(ROOT, 'tools', 'hdwallet-gen', 'package.json'));
  const declared = pkg?.dependencies?.['@trustwallet/wallet-core'];
  const version = typeof declared === 'string' ? declared.trim() || null : null;
  const requirements = readText(path.join(ROOT, 'requirements.txt')) ?? '';
  const pin = name => requirements.match(
    new RegExp(`^[\\t ]*${name}[\\t ]*==[\\t ]*([^\\s#;=]+)`, 'mi')
  )?.[1] ?? null;
  return {
    status: version === null ? 'missing' : 'ok',
    detail: `@trustwallet/wallet-core ${version ?? 'missing'} (tools/hdwallet-gen/package.json)`,
    version,
    pythonPins: { cryptography: pin('cryptography'), 'bip-utils': pin('bip-utils') }
  };
}

function detectFiles() {
  const check = (items) => {
    const found = [];
    const missing = [];
    for (const item of items) {
      (fs.existsSync(path.join(ROOT, item)) ? found : missing).push(item);
    }
    return {
      status: missing.length === 0 ? "ok" : found.length > 0 ? "partial" : "missing",
      detail: `Found: ${found.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}`,
    };
  };

  // Phase 3: profiles live in registry/profiles.json and registries are
  // JSON (plan section 3 file list). Section 2.2's .yaml names and
  // ai/profiles/*.md were OPEN proposed allocations, superseded.
  return {
    entryPoints: check(["AGENTS.md", "WALLET_BUILDER.md"]),
    plan: check(["docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md"]),
    profiles: check(["registry/profiles.json"]),
    registries: check([
      "registry/engines.json",
      "registry/ui.json",
      "registry/capabilities.json",
      "registry/schemas/profile.schema.json",
      "registry/schemas/registry.schema.json",
    ]),
    templates: check(["templates/web", "templates/android", "templates/shared"]),
    starters: check(["apps/web", "apps/android"]),
    catalogue: check(["docs/UI-UX-CATALOGUE.md", "docs/UI-TEMPLATE-REGISTRY.yaml"]),
    ci: check([".github/workflows/ci.yml"]),
  };
}

function detectNpm() {
  const version = run("npm", ["--version"]);
  return version
    ? { status: "ok", detail: `npm ${version}` }
    : { status: "missing", detail: "npm unavailable: npm --version failed or returned no output" };
}

function main() {
  const node = detectNode();
  const python = detectPython();
  const npm = detectNpm();
  const git = detectGit();
  const engine = detectEngine();
  const files = detectFiles();

  const report = {
    node,
    python,
    npm,
    git,
    engine,
    pythonPins: engine.pythonPins,
    ...files,
  };

  const core = [
    ["node", node.status === "ok"],
    ["git", git.head != null],
    ["engine", engine.status === "ok"],
    ["entryPoints", files.entryPoints.status === "ok"],
  ];
  const missing = core.filter(([, ok]) => !ok).map(([name]) => name);

  console.log(JSON.stringify(report, null, 2));
  console.error(
    `Core capabilities: ${core.length - missing.length} ok, ${missing.length} missing` +
    (missing.length ? ` (${missing.join(", ")})` : "")
  );
  process.exitCode = missing.length === 0 ? 0 : 1;
}

main();
