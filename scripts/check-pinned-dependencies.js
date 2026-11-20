#!/usr/bin/env node
// check-pinned-dependencies.js — publish/build-time dependency-version
// check (repo-study Phase 3, item 30).
//
// A bad inter-package version must not ship silently. This check runs at
// publish/build time (CI `apps/web` job; see docs/release-procedure.md
// §2) and verifies the pins that have to agree across the repo:
//
//   1. `@trustwallet/wallet-core` is exactly 4.9.3 in BOTH package.json
//      files (apps/web, tools/hdwallet-gen) and BOTH lockfiles resolve
//      4.9.3 (spec + resolved). The lockfile half overlaps
//      scripts/check-lockfiles.mjs on purpose: that script runs BEFORE
//      `npm ci` (pre-install gate); this one runs at publish time.
//   2. The WASM hash in apps/web/scripts/wasm-integrity.mjs equals the
//      hash recorded in docs/adr/0001-wallet-core-pin.md (ADR-0001).
//      This is the pin the 4.8.4/4.9.3 prebuild incident showed was
//      missing: a stale WASM served with new glue.
//   3. The `@bawa/contracts` file: dependency in apps/web/package.json
//      matches packages/contracts/package.json version.
//   4. Every direct Python dependency in requirements.txt appears at
//      the same version in requirements.lock.
//   5. Every file in patches/ names its target package and version, and
//      the target is still at that version. A patch whose target moved
//      fails until it is updated or removed — patches are replayable
//      records, not undocumented local edits.
//
// Usage: node scripts/check-pinned-dependencies.js [repo-root]
// Exit 0 = all pins agree; exit 1 = at least one mismatch (names the
// file and the values). No network access; reads local files only.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const failures = [];
const fail = (message) => failures.push(message);

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

// 1. wallet-core pin: package.json specs + lockfile resolutions.
const WALLET_CORE = '4.9.3';
const packageJsons = ['apps/web/package.json', 'tools/hdwallet-gen/package.json'];
const lockfiles = ['apps/web/package-lock.json', 'tools/hdwallet-gen/package-lock.json'];
for (const file of packageJsons) {
  const pkg = readJson(file);
  const spec = pkg?.dependencies?.['@trustwallet/wallet-core'];
  if (spec !== WALLET_CORE) {
    fail(`${file}: @trustwallet/wallet-core spec must be exactly ${WALLET_CORE} (got ${spec ?? 'missing'})`);
  }
}
for (const file of lockfiles) {
  const lock = readJson(file);
  const spec = lock?.packages?.['']?.dependencies?.['@trustwallet/wallet-core'];
  const resolved = lock?.packages?.['node_modules/@trustwallet/wallet-core']?.version;
  if (spec !== WALLET_CORE || resolved !== WALLET_CORE) {
    fail(`${file}: @trustwallet/wallet-core must resolve ${WALLET_CORE} (spec: ${spec ?? 'missing'}, resolved: ${resolved ?? 'missing'})`);
  }
}

// 2. WASM hash agreement: wasm-integrity.mjs vs ADR-0001.
const wasmIntegrity = readText('apps/web/scripts/wasm-integrity.mjs');
const hashMatch = wasmIntegrity.match(/EXPECTED_WASM_SHA256\s*=\s*'([0-9a-f]{64})'/);
if (!hashMatch) {
  fail('apps/web/scripts/wasm-integrity.mjs: EXPECTED_WASM_SHA256 not found');
} else {
  const adr = readText('docs/adr/0001-wallet-core-pin.md');
  if (!adr.includes(hashMatch[1])) {
    fail(`docs/adr/0001-wallet-core-pin.md: does not record the WASM hash ${hashMatch[1]} from wasm-integrity.mjs`);
  }
}

// 3. @bawa/contracts file: dependency matches the local package version.
const webPkg = readJson('apps/web/package.json');
const contractsSpec = webPkg?.dependencies?.['@bawa/contracts'];
const contractsPkg = readJson('packages/contracts/package.json');
if (contractsSpec !== `file:../../packages/contracts`) {
  fail(`apps/web/package.json: @bawa/contracts must be file:../../packages/contracts (got ${contractsSpec ?? 'missing'})`);
}
if (typeof contractsPkg?.version !== 'string' || contractsPkg.version.length === 0) {
  fail('packages/contracts/package.json: version missing');
}

// 4. Python direct deps: requirements.txt vs requirements.lock.
const txtPins = new Map();
for (const line of readText('requirements.txt').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const match = trimmed.match(/^([A-Za-z0-9_.-]+)==([^\s;]+)/);
  if (match) txtPins.set(match[1].toLowerCase(), match[2]);
}
const lockText = readText('requirements.lock');
for (const [name, version] of txtPins) {
  const pattern = new RegExp(`^${name}==${version.replace(/\./g, '\\.')}(\\s|\\\\|$)`, 'mi');
  if (!pattern.test(lockText)) {
    fail(`requirements.lock: ${name}==${version} from requirements.txt is not pinned at the same version`);
  }
}

// 5. Recorded patches: each names its target; the target is still there.
const patchesDir = join(root, 'patches');
if (existsSync(patchesDir)) {
  for (const entry of readdirSync(patchesDir)) {
    if (!entry.endsWith('.patch')) continue;
    const content = readText(join('patches', entry));
    const target = content.match(/^# Target:\s*(\S+)@(\S+)\s*$/m);
    if (!target) {
      fail(`patches/${entry}: must start with a "# Target: <package>@<version>" header`);
      continue;
    }
    const [, pkg, version] = target;
    const inWebLock = (() => {
      try {
        const lock = readJson('apps/web/package-lock.json');
        return lock?.packages?.[`node_modules/${pkg}`]?.version === version;
      } catch {
        return false;
      }
    })();
    const inToolsLock = (() => {
      try {
        const lock = readJson('tools/hdwallet-gen/package-lock.json');
        return lock?.packages?.[`node_modules/${pkg}`]?.version === version;
      } catch {
        return false;
      }
    })();
    const inPythonLock = new RegExp(`^${pkg}==${version.replace(/\./g, '\\.')}(\\s|\\\\|$)`, 'mi').test(lockText);
    if (!inWebLock && !inToolsLock && !inPythonLock) {
      fail(`patches/${entry}: target ${pkg}@${version} is not at that version in any lockfile — update or remove the patch`);
    }
  }
}

if (failures.length > 0) {
  console.error('check-pinned-dependencies: FAILED');
  for (const message of failures) console.error(`  ${message}`);
  process.exit(1);
}
console.log('check-pinned-dependencies: all pins agree');
