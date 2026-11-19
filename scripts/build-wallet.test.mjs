// scripts/build-wallet.test.mjs — tests for the PR2 Lane C wiring: the
// planner gate in scripts/build-wallet.mjs and the classifyRequest
// chain check behind it.
// Run: node scripts/build-wallet.test.mjs
// Plain node:test; no dependencies. The CLI runs below never generate:
// rejections exit before generation, and the valid-request runs stop at
// the BUILD_WALLET_STOP_AFTER_PLAN test hook. The generate step itself
// is exercised directly (fast file copy, no npm/gradle) in the last test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFromNaturalLanguage } from './plan-build.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_DIR = join(REPO_ROOT, 'registry');
const BUILD_WALLET = join(REPO_ROOT, 'scripts', 'build-wallet.mjs');
const GENERATE_PROJECT = join(
  REPO_ROOT,
  'scripts',
  'generate-project.mjs',
);
const GENERATED_WEB = join(REPO_ROOT, 'generated', 'web-wallet');

function makeTempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'bawa-build-wallet-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function runBuild(t, request, extraEnv = {}) {
  const dir = makeTempDir(t);
  const reportPath = join(dir, 'report.json');
  const result = spawnSync(
    process.execPath,
    [BUILD_WALLET, request, '--out', reportPath],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
  return { result, reportPath };
}

function readReport(reportPath) {
  assert.ok(existsSync(reportPath), `expected a report at ${reportPath}`);
  return JSON.parse(readFileSync(reportPath, 'utf8'));
}

function assertNoGeneratedOutput() {
  assert.equal(
    existsSync(GENERATED_WEB),
    false,
    'no generated/web-wallet output must be created',
  );
}

test('Solana web-wallet request exits 2 with a rejection naming solana + web-wallet, and generates nothing', (t) => {
  assert.equal(
    existsSync(GENERATED_WEB),
    false,
    'generated/web-wallet must not exist before this test; remove it to run it',
  );
  const { result, reportPath } = runBuild(t, 'Build a web wallet for Solana');
  assert.equal(
    result.status,
    2,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /build-wallet: (UNCLASSIFIABLE|PLAN REJECTED)/);
  const report = readReport(reportPath);
  // Either layer may fire: the classifier's unclassifiable reason, or
  // the planner's CHAIN_NOT_SUPPORTED error. Both name the chain and
  // the profile.
  const rejectionText = JSON.stringify(
    report.classificationFailure ?? report.planRejection ?? {},
  );
  assert.match(rejectionText, /solana/);
  assert.match(rejectionText, /web-wallet/);
  assert.equal(report.generatedPath, null);
  assert.deepEqual(report.generatedFiles, []);
  assertNoGeneratedOutput();
});

test('Cosmos web-wallet request exits 2 with a rejection naming cosmos + web-wallet, and generates nothing', (t) => {
  assert.equal(
    existsSync(GENERATED_WEB),
    false,
    'generated/web-wallet must not exist before this test; remove it to run it',
  );
  const { result, reportPath } = runBuild(t, 'Build a web wallet for Cosmos');
  assert.equal(
    result.status,
    2,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /build-wallet: (UNCLASSIFIABLE|PLAN REJECTED)/);
  const report = readReport(reportPath);
  const rejectionText = JSON.stringify(
    report.classificationFailure ?? report.planRejection ?? {},
  );
  assert.match(rejectionText, /cosmos/);
  assert.match(rejectionText, /web-wallet/);
  assert.equal(report.generatedPath, null);
  assert.deepEqual(report.generatedFiles, []);
  assertNoGeneratedOutput();
});

test('the planner gate itself rejects Solana on web-wallet with CHAIN_NOT_SUPPORTED', () => {
  const result = planFromNaturalLanguage(
    'web-wallet',
    ['solana'],
    ['create'],
    'opt-in-read-only',
    'disabled',
    REGISTRY_DIR,
  );
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.ok(
    result.errors.some((e) => e.code === 'CHAIN_NOT_SUPPORTED'),
    JSON.stringify(result.errors),
  );
});

test('a valid request passes the planner gate (Bitcoin web wallet)', (t) => {
  assert.equal(
    existsSync(GENERATED_WEB),
    false,
    'generated/web-wallet must not exist before this test; remove it to run it',
  );
  const { result } = runBuild(t, 'Build a web wallet for Bitcoin', {
    BUILD_WALLET_STOP_AFTER_PLAN: '1',
  });
  assert.equal(
    result.status,
    0,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /build-wallet: PLAN OK web-wallet btc/);
  // The test hook stops before generation: the gate passed, nothing
  // was generated.
  assertNoGeneratedOutput();
});

test('a valid request naming no chain passes the gate (profile chains, incl. TON)', (t) => {
  const { result } = runBuild(t, 'Build a web wallet', {
    BUILD_WALLET_STOP_AFTER_PLAN: '1',
  });
  assert.equal(
    result.status,
    0,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /build-wallet: PLAN OK web-wallet btc,eth,trx,ton/);
  assertNoGeneratedOutput();
});

test('generation itself still runs for the gated profile (generate-project, no npm/gradle)', (t) => {
  // generate-project refuses to write outside generated/ (F-23
  // containment), so the output goes to a gitignored generated/ dir
  // that this test removes afterwards.
  const out = join(REPO_ROOT, 'generated', 'build-wallet-test-web');
  assert.equal(
    existsSync(out),
    false,
    'generated/build-wallet-test-web must not exist before this test; remove it to run it',
  );
  t.after(() => {
    rmSync(out, { recursive: true, force: true });
    // Remove the parent too when it is left empty, so the test leaves
    // no trace behind (generated/ itself is gitignored, but an empty
    // dir is still litter).
    try {
      rmdirSync(join(REPO_ROOT, 'generated'));
    } catch {
      // Non-empty: another run owns the remaining output; leave it.
    }
  });
  const result = spawnSync(
    process.execPath,
    [GENERATE_PROJECT, 'web-wallet', '--out', out, '--force'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
  assert.equal(
    result.status,
    0,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.ok(existsSync(join(out, 'profile.json')));
  assert.ok(existsSync(join(out, 'README.md')));
});
