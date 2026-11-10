import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Slow end-to-end tests: npm install and Gradle builds.
// Run standalone: node --test tests/clean-checkout.test.mjs
// These tests are not part of the fast test:all gate.

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const excludedDirectories = [
  'apps/web/dist',
  'apps/android/app/build',
  'apps/android/.gradle',
  'reports',
];

let temporaryRoot;
let checkout;

function includeInCheckout(source) {
  const parts = relative(repositoryRoot, source).split(sep);

  // This also excludes apps/web/node_modules and any nested node_modules.
  if (parts.includes('node_modules') || parts.includes('.git')) {
    return false;
  }

  const relativePath = parts.join('/');
  return !relativePath.endsWith('.log') &&
    !excludedDirectories.some(directory =>
      relativePath === directory || relativePath.startsWith(`${directory}/`)
    );
}

before(() => {
  temporaryRoot = fs.mkdtempSync(join(tmpdir(), 'bawa-clean-checkout-'));
  checkout = join(temporaryRoot, 'checkout');
  fs.cpSync(repositoryRoot, checkout, {
    recursive: true,
    filter: includeInCheckout,
  });
});

after(() => {
  if (temporaryRoot) {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

function runRequest(request, reportName) {
  const reportPath = join(temporaryRoot, reportName);
  assert.equal(fs.existsSync(reportPath), false, 'Report path must be fresh');

  const result = spawnSync(
    process.execPath,
    ['scripts/build-wallet.mjs', request, '--out', reportPath],
    {
      cwd: checkout,
      env: process.env,
      encoding: 'utf8',
      timeout: 600000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  const output = `stdout:\n${result.stdout ?? ''}\nstderr:\n${result.stderr ?? ''}`;
  assert.ifError(result.error);
  assert.equal(result.signal, null, output);

  return { result, reportPath, output };
}

function readReport(reportPath) {
  assert.ok(fs.existsSync(reportPath), `Expected report at ${reportPath}`);
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function recordedSteps(report) {
  assert.ok(Array.isArray(report.steps), 'Expected report.steps to be an array');
  assert.ok(report.steps.length > 0, 'Expected recorded workflow steps');
  return report.steps;
}

function assertEveryStepVerified(report) {
  for (const step of recordedSteps(report)) {
    assert.equal(
      step.status,
      'VERIFIED',
      `Unexpected step result: ${JSON.stringify(step)}`,
    );
  }
}

test('web wallet request verifies from a clean checkout', () => {
  const { result, reportPath, output } = runRequest(
    'Create a Web wallet',
    'web-report.json',
  );

  assert.equal(result.status, 0, output);
  const report = readReport(reportPath);
  assert.equal(report.profile, 'web-wallet');
  assert.deepEqual(report.platforms, ['web']);
  assertEveryStepVerified(report);
});

test(
  'android wallet request verifies from a clean checkout (or skips without a toolchain)',
  () => {
    const toolchainConfigured = Boolean(
      process.env.JAVA_HOME && process.env.ANDROID_HOME,
    );
    const { result, reportPath, output } = runRequest(
      'Create an Android wallet',
      'android-report.json',
    );

    if (toolchainConfigured) {
      assert.equal(result.status, 0, output);
    } else {
      assert.ok(result.status === 0 || result.status === 1, output);
    }

    const report = readReport(reportPath);
    assert.equal(report.profile, 'android-wallet');
    assert.deepEqual(report.platforms, ['android']);

    if (toolchainConfigured) {
      assertEveryStepVerified(report);
    } else {
      const setup = recordedSteps(report).find(
        step =>
          step.platform === 'android' &&
          (step.step ?? step.phase ?? step.name) === 'setup',
      );
      assert.ok(setup, 'Expected the Android setup step in the report');
      assert.equal(setup.status, 'SKIPPED', JSON.stringify(setup));
    }
  },
);

test('an unclassifiable request fails cleanly', () => {
  const { result, reportPath, output } = runRequest(
    'What is the weather?',
    'unclassifiable-report.json',
  );

  assert.ok(Number.isInteger(result.status) && result.status !== 0, output);
  assert.equal(
    fs.existsSync(reportPath),
    false,
    'An unclassifiable request must not create a report',
  );
});
