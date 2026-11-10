import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = 'Usage: node scripts/setup.mjs [--platform web|android|all]';

function usageError() {
  console.error(usage);
  process.exit(2);
}

const args = process.argv.slice(2);
let platform = 'all';
let platformSeen = false;

for (let i = 0; i < args.length; i += 1) {
  if (args[i] !== '--platform' || platformSeen) usageError();
  const value = args[++i];
  if (!['web', 'android', 'all'].includes(value)) usageError();
  platform = value;
  platformSeen = true;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'apps', 'web');
const androidDir = join(root, 'apps', 'android');
let failures = 0;

function report(status, message) {
  console.log(`${status} ${message}`);
  if (status === 'FAIL') failures += 1;
}

function probe(command, commandArgs) {
  try {
    return spawnSync(command, commandArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    return null;
  }
}

function succeeded(result) {
  return Boolean(result && !result.error && result.status === 0);
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isExecutableFile(path) {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const nodeVersion = /^v(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(process.version);
const nodeMajor = nodeVersion ? Number(nodeVersion[1]) : NaN;
report(
  nodeMajor >= 22 && nodeMajor < 23 ? 'PASS' : 'FAIL',
  `Node.js ${process.version}: required >=22 <23`
);

for (const command of ['git', 'npm']) {
  const ok = succeeded(probe(command, ['--version']));
  report(
    ok ? 'PASS' : 'FAIL',
    `${command}: ${ok ? 'available' : '--version failed or command is unavailable'}`
  );
}

if (platform !== 'android') {
  try {
    const manifest = JSON.parse(readFileSync(join(webDir, 'package.json'), 'utf8'));
    const ok = manifest?.engines?.node === '>=22 <23';
    report(
      ok ? 'PASS' : 'FAIL',
      ok
        ? 'apps/web/package.json: engines.node is ">=22 <23"'
        : 'apps/web/package.json: engines.node must be ">=22 <23"'
    );
  } catch {
    report('FAIL', 'apps/web/package.json: missing, unreadable or invalid JSON');
  }

  const modulesExist = existsSync(join(webDir, 'node_modules'));
  report(
    modulesExist ? 'PASS' : 'SKIP',
    modulesExist
      ? 'apps/web/node_modules: exists'
      : 'apps/web/node_modules: missing; run npm install in apps/web'
  );
} else {
  report('SKIP', 'apps/web/package.json: web not selected');
  report('SKIP', 'apps/web/node_modules: web not selected');
}

if (platform !== 'web') {
  const javaHome = process.env.JAVA_HOME;
  if (!javaHome) {
    report('FAIL', 'JAVA_HOME: unset; point it at a JDK 17');
  } else {
    const result = probe(join(javaHome, 'bin', 'java'), ['-version']);
    const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
    const version = /^(?:openjdk|java) version "(\d+)(?:[._+-][^"]*)?"/m.exec(output);
    const ok = succeeded(result) && version !== null && Number(version[1]) === 17;
    report(
      ok ? 'PASS' : 'FAIL',
      ok
        ? 'JAVA_HOME: bin/java -version reports Java 17'
        : 'JAVA_HOME: bin/java -version failed or did not report Java 17'
    );
  }

  const androidHome = process.env.ANDROID_HOME;
  if (!androidHome) {
    report('FAIL', 'ANDROID_HOME: unset; point it at an Android SDK with platform 35');
  } else {
    const ok = isDirectory(join(androidHome, 'platforms', 'android-35'));
    report(
      ok ? 'PASS' : 'FAIL',
      ok
        ? 'ANDROID_HOME: platforms/android-35 exists'
        : 'ANDROID_HOME: platforms/android-35 is missing or not a directory'
    );
  }

  const wrapperOK = isExecutableFile(join(androidDir, 'gradlew'));
  report(
    wrapperOK ? 'PASS' : 'FAIL',
    wrapperOK
      ? 'apps/android/gradlew: exists and is executable'
      : 'apps/android/gradlew: missing, not a file or not executable'
  );
} else {
  report('SKIP', 'JAVA_HOME: android not selected');
  report('SKIP', 'ANDROID_HOME: android not selected');
  report('SKIP', 'apps/android/gradlew: android not selected');
}

console.log(failures === 0 ? 'setup: OK' : `setup: FAILED (${failures} checks failed)`);
process.exitCode = failures === 0 ? 0 : 1;
