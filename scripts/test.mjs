#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suites = [
  { name: 'web', command: 'npm', args: ['test'] },
  { name: 'android', command: './gradlew', args: ['testDebugUnitTest'] },
];

function runSuite({ name, command, args }) {
  if (name === 'android') {
    const missing = ['JAVA_HOME', 'ANDROID_HOME'].filter(
      (key) => !process.env[key]?.trim(),
    );

    if (missing.length > 0) {
      console.error(
        `Cannot run Android tests: set ${missing.join(' and ')}. ` +
        'JAVA_HOME must point to JDK 17 and ANDROID_HOME to an Android SDK with platform 35.',
      );
      return 'NOT-RUN';
    }
  }

  try {
    // The child inherits the environment, including JAVA_HOME and ANDROID_HOME.
    const result = spawnSync(command, args, {
      cwd: fileURLToPath(new URL(`../apps/${name}/`, import.meta.url)),
      stdio: 'inherit',
    });

    if (result.error) {
      console.error(
        `Could not start ${name} tests (${result.error.code ?? 'spawn error'}).`,
      );
      return 'NOT-RUN';
    }

    if (result.signal) {
      console.error(`${name} tests were terminated by ${result.signal}.`);
      return 'FAIL';
    }

    return result.status === 0 ? 'PASS' : 'FAIL';
  } catch {
    console.error(`Could not start ${name} tests.`);
    return 'NOT-RUN';
  }
}

const argv = process.argv.slice(2);
const validArguments = argv.length === 0 || (
  argv.length === 2 &&
  argv[0] === '--platform' &&
  ['web', 'android', 'all'].includes(argv[1])
);
const platform = argv[1] ?? 'all';
let ok = validArguments;

if (!validArguments) {
  console.error('Usage: node scripts/test.mjs [--platform web|android|all]');
}

for (const suite of suites) {
  const selected = validArguments &&
    (platform === 'all' || platform === suite.name);
  const status = selected ? runSuite(suite) : 'NOT-RUN';

  console.log(`test ${suite.name}: ${status}`);
  if (selected && status !== 'PASS') {
    ok = false;
  }
}

console.log(`test: ${ok ? 'OK' : 'FAILED'}`);
process.exitCode = ok ? 0 : 1;
