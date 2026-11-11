import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = 'Usage: node scripts/build.mjs [--platform web|android|all] [--skip-install]';

function usageError() {
  console.error(usage);
  process.exit(2);
}

const args = process.argv.slice(2);
let platform = 'all';
let platformSeen = false;
let skipInstall = false;

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--platform' && !platformSeen) {
    const value = args[++i];
    if (!['web', 'android', 'all'].includes(value)) usageError();
    platform = value;
    platformSeen = true;
  } else if (args[i] === '--skip-install' && !skipInstall) {
    skipInstall = true;
  } else {
    usageError();
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'apps', 'web');
const androidDir = join(root, 'apps', 'android');
let failures = 0;

function run(command, commandArgs, cwd) {
  let result;
  try {
    result = spawnSync(command, commandArgs, {
      cwd,
      stdio: 'inherit',
      env: process.env
    });
  } catch {
    result = null;
  }

  if (!result || result.error) {
    console.error(
      `Unable to start ${command}; check its availability, permissions and working directory.`
    );
    return false;
  }

  return result.status === 0;
}

if (platform !== 'android') {
  const installed = skipInstall || run('npm', ['install'], webDir);
  const ok = installed && run('npm', ['run', 'build'], webDir);
  console.log(`build web: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failures += 1;
}

if (platform !== 'web') {
  const missing = ['JAVA_HOME', 'ANDROID_HOME'].filter((name) => !process.env[name]);
  let ok = false;

  if (missing.length > 0) {
    console.error(
      `Android build requires ${missing.join(' and ')} to be set. ` +
      'Set JAVA_HOME to a JDK 17 and ANDROID_HOME to an Android SDK with platform 35.'
    );
  } else {
    ok = run('./gradlew', ['assembleDebug'], androidDir);
  }

  console.log(`build android: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failures += 1;
}

console.log(failures === 0 ? 'build: OK' : 'build: FAILED');
process.exitCode = failures === 0 ? 0 : 1;
