#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { secretScan } from './secret-scan.mjs';
import { lockfiles } from './check-lockfiles.mjs';
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

// The lockfile pin check runs FIRST (T44-F5): it used to run last,
// after `npm ci` had already installed — and the suites had already
// executed — whatever a tampered lockfile said. A wrong pin, a
// non-registry resolved URL or a missing integrity hash must fail the
// run before any dependency code is installed or run.
check('lockfiles', () => lockfiles(root));

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
// T01: register-row regression tests (M-05/M-06/M-07/M-09 guide claims).
runCommand('register-t01-tests', process.execPath, ['--test', 'tests/register-t01.test.mjs']);
runCommand('negative-inputs', process.execPath, ['--test', 'tests/negative-inputs.test.mjs']);
runCommand('engine-suite', process.execPath, ['--test', 'test/smoke.test.js']);
runCommand('phase9-tests', process.execPath, ['--test', 'tests/chain-fixtures.test.mjs', 'tests/mainnet-derivation-vectors.test.mjs', 'tests/failure-modes.test.mjs', 'tests/stale-data.test.mjs', 'tests/secrets-dir.test.mjs', 'tests/mainnet-guards.test.mjs', 'tests/mainnet-unsigned-tx.test.mjs', 'tests/publish-lock.test.mjs', 'tests/lockfiles.test.mjs', 'tests/secret-scan.test.mjs']);
runCommand('mainnet-fees-tests', process.execPath, ['--test', 'tests/mainnet-fees.test.mjs']);

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

// F-41: the verdict names skips. 'quality-gates: OK' only with no
// failures AND no skips; exit 0 is preserved for intentional
// --skip-android.
console.log(verdict(failures, skipped));
process.exitCode = failures === 0 ? 0 : 1;
