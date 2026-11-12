#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, readFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { secretScan } from './secret-scan.mjs';
import { verdict } from './gate-verdict.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--skip-android')) {
  console.error('Usage: node scripts/quality-gates.mjs [--skip-android]');
  process.exit(1);
}

let failures = 0;
const skipped = [];

// F-41: skips are tracked so the verdict can say so. report() records
// FAILs in `failures` and SKIPs in `skipped`.
function report(name, status, detail = '') {
  if (status === 'FAIL') failures += 1;
  if (status === 'SKIP') skipped.push(name);
  console.log(`${name}: ${status}${detail ? ` (${detail})` : ''}`);
}

function check(name, work) {
  try {
    report(name, work() ? 'PASS' : 'FAIL');
  } catch {
    report(name, 'FAIL', 'check could not be completed');
  }
}

function runCommand(name, executable, commandArgs, cwd = root) {
  check(name, () => {
    const result = spawnSync(executable, commandArgs, { cwd, stdio: 'inherit' });
    if (result.error) console.error(`  ${name}: command could not be started`);
    return !result.error && result.status === 0 && !result.signal;
  });
}

// Reject symlinked parent directories rather than reading outside the worktree.
function inspect(file) {
  const parts = file.split('/');
  if (isAbsolute(file) || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid repository path');
  }
  let absolute = root;
  for (let index = 0; index < parts.length; index += 1) {
    absolute = join(absolute, parts[index]);
    const stat = lstatSync(absolute);
    if (index === parts.length - 1) return { absolute, stat };
    if (!stat.isDirectory()) throw new Error('Non-directory parent');
  }
}

function lockfiles() {
  const files = [
    'apps/web/package-lock.json',
    'tools/hdwallet-gen/package-lock.json',
  ];
  // F-27: parse each lockfile as JSON and verify BOTH the spec and the
  // resolution are 4.8.4. A string-presence check would pass a lockfile
  // that merely mentions the pin in a comment or another entry.
  let passed = true;
  for (const file of files) {
    try {
      if (!existsSync(join(root, file))) throw new Error('Missing lockfile');
      const { absolute, stat } = inspect(file);
      if (!stat.isFile()) throw new Error('Not a regular lockfile');
      const lock = JSON.parse(readFileSync(absolute, 'utf8'));
      const spec = lock?.packages?.['']?.dependencies?.['@trustwallet/wallet-core'];
      const resolved = lock?.packages?.['node_modules/@trustwallet/wallet-core']?.version;
      if (spec !== '4.8.4' || resolved !== '4.8.4') {
        console.error(
          `  ${file}: wallet-core pin must be 4.8.4 (spec: ${spec ?? 'missing'}, resolved: ${resolved ?? 'missing'})`,
        );
        passed = false;
      }
    } catch {
      console.error(`  ${file}: lockfile is missing or unreadable`);
      passed = false;
    }
  }
  return passed;
}

// The engine-dependent gates (negative-inputs shells out to derive.js /
// compare.js; the engine suite needs the tools) require the
// tools/hdwallet-gen dependencies installed. F-24: run npm ci
// unconditionally — a partial/corrupt/wrong-version wallet-core dir must
// not skip the install and get VERIFIED. Runs first: negative-inputs
// failed in a fresh clone when this setup ran after it.
const engineDir = join(root, 'tools', 'hdwallet-gen');
runCommand('engine-setup', 'npm', ['ci', '--no-audit', '--no-fund'], engineDir);
runCommand('registry-validate', process.execPath, ['scripts/validate-registry.mjs']);
runCommand('registry-tests', process.execPath, ['--test', 'tests/registry.test.mjs']);
runCommand('negative-inputs', process.execPath, ['--test', 'tests/negative-inputs.test.mjs']);
runCommand('engine-suite', process.execPath, ['--test', 'test/smoke.test.js']);
runCommand('phase9-tests', process.execPath, ['--test', 'tests/chain-fixtures.test.mjs', 'tests/mainnet-derivation-vectors.test.mjs', 'tests/failure-modes.test.mjs', 'tests/stale-data.test.mjs', 'tests/secrets-dir.test.mjs']);

const web = join(root, 'apps/web');
// The web gates run the pinned toolchain from apps/web/node_modules.
// F-24: run npm ci unconditionally (same reason as engine-setup).
runCommand('web-setup', 'npm', ['ci', '--no-audit', '--no-fund'], web);
runCommand('web-typecheck', 'npm', ['run', 'typecheck'], web);
runCommand('web-tests', 'npm', ['test'], web);
runCommand('web-build', 'npm', ['run', 'build'], web);

if (args.includes('--skip-android')) {
  report('android-tests', 'SKIP', 'requested with --skip-android');
} else if (!process.env.JAVA_HOME || !process.env.ANDROID_HOME) {
  const missingVars = ['JAVA_HOME', 'ANDROID_HOME'].filter((name) => !process.env[name]);
  report(
    'android-tests',
    'FAIL',
    `Unset environment variables: ${missingVars.join(', ')}; JDK 17 and SDK platform 35 required`,
  );
} else {
  // A configured toolchain must pass: never turn Gradle failures into skips.
  runCommand('android-tests', './gradlew', ['testDebugUnitTest'], join(root, 'apps/android'));
}

check('secret-scan', () => secretScan(root));
check('lockfiles', lockfiles);

// F-41: the verdict names skips. 'quality-gates: OK' only with no
// failures AND no skips; exit 0 is preserved for intentional
// --skip-android.
console.log(verdict(failures, skipped));
process.exitCode = failures === 0 ? 0 : 1;
