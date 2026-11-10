#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, readdirSync, readFileSync, readlinkSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--skip-android')) {
  console.error('Usage: node scripts/quality-gates.mjs [--skip-android]');
  process.exit(1);
}

let failures = 0;

function report(name, status, detail = '') {
  if (status === 'FAIL') failures += 1;
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

const excludedTrees = [
  'apps/web/dist', 'apps/android/app/build', 'apps/android/.gradle', 'reports',
];

function excluded(file, directory = false) {
  return file.split('/').some(part => part === 'node_modules' || part === '.git') ||
    excludedTrees.some(tree => file === tree || file.startsWith(`${tree}/`)) ||
    (!directory && /\.(?:log|png)$/.test(file));
}

function* walk(directory = '') {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const file = directory ? `${directory}/${entry.name}` : entry.name;
    if (excluded(file, entry.isDirectory())) continue;
    if (entry.isDirectory()) yield* walk(file);
    else yield file;
  }
}

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
  // If Git cannot provide a list, a full walk is the conservative fallback.
  const files = !result.error && result.status === 0 && !result.signal
    ? result.stdout.split('\0').filter(Boolean)
    : [...walk()];
  return [...new Set(files)].filter(file => !excluded(file)).sort();
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

function readText(file) {
  const { absolute, stat } = inspect(file);
  if (stat.isDirectory()) return null; // Submodule gitlinks are not text files.
  // Inspect the tracked symlink text, never the contents of its target.
  if (stat.isSymbolicLink()) return readlinkSync(absolute, 'utf8');
  if (!stat.isFile()) throw new Error('Not a regular file');
  const data = readFileSync(absolute);
  // Recognise BOM-marked UTF-16 before applying the binary NUL-byte check.
  if (data[0] === 0xff && data[1] === 0xfe) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(data);
  }
  if (data[0] === 0xfe && data[1] === 0xff) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(data);
  }
  return data.includes(0) ? null : data.toString('utf8');
}

const secretPatterns = [
  /xprv[1-9A-HJ-NP-Za-km-z]{100,}/,
  /zprv[1-9A-HJ-NP-Za-km-z]{100,}/,
  /^\s*(mnemonic|seed|private[_ ]?key)\s*[:=]\s*\S+/i,
];
// By-design exceptions (pattern index -> files). These are NOT leaks:
// - test/smoke.test.js holds the published NEGATIVE xprv/zprv test vectors
//   (documented "never for funds"); the negative tests need the literals.
// - tools/decrypt_seed.py is the recovery tool; it holds the decrypted
//   mnemonic in memory for the recovery operation only.
// - docs/android-wallet/ANDROID-GUIDE.md and docs/web-wallet/WEB-GUIDE.md
//   quote the same published NEGATIVE xprv/zprv vectors to document the
//   rejection behaviour.
// - test/differential_test.py uses the published 15-word test-vector
//   mnemonic ("ripple scissors kick mammal ...") to verify derivation
//   against bip-utils; it is public test data, never for funds.
// - test/test_make_wallet.py uses the published "abandon" x23 + "art"
//   BIP-39 test mnemonic to verify bundle decryption; it is public test
//   data, never for funds.
// Known published BIP-32 test vectors ("test vector, never for funds"):
// TV1 root xprv, TV5 bad-checksum xprv, the abandon-mnemonic zprv, and the
// TV1 path xprv (seed 000102..., m/0'/1/2'/2/1000000000).
// Stripped from a line before the xprv/zprv patterns are tested, so any
// OTHER private extended key literal anywhere still fails the gate.
const knownTestVectors = [
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHL',
  'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE',
  'xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76',
];
const secretAllowlist = [
  { file: 'tools/decrypt_seed.py', patterns: [2] },
  { file: 'test/differential_test.py', patterns: [2] },
  { file: 'test/test_make_wallet.py', patterns: [2] },
];
const displayPath = file => JSON.stringify(file).slice(1, -1);

function secretScan() {
  let passed = true;
  for (const file of trackedFiles()) {
    let text;
    try {
      text = readText(file);
    } catch {
      console.error(`  ${displayPath(file)}: file could not be read safely`);
      passed = false;
      continue;
    }
    if (text === null) continue;
    const lines = text.split(/\r\n?|\n/);
    const allowed = secretAllowlist.find(entry => entry.file === file);
    for (let index = 0; index < lines.length; index += 1) {
      const scrubbed = knownTestVectors.reduce(
        (line, vector) => line.split(vector).join(''),
        lines[index],
      );
      if (secretPatterns.some((pattern, patternIndex) => {
        if (allowed?.patterns.includes(patternIndex)) return false;
        // Patterns 0/1 (xprv/zprv) test the scrubbed line; pattern 2
        // (secret assignment) tests the raw line.
        return pattern.test(patternIndex < 2 ? scrubbed : lines[index]);
      })) {
        // Report locations only, never the matching text.
        console.error(`  ${displayPath(file)}:${index + 1}`);
        passed = false;
      }
    }
  }
  return passed;
}

function lockfiles() {
  const files = [
    'apps/web/package-lock.json',
    'tools/hdwallet-gen/package-lock.json',
  ];
  const pin = '"@trustwallet/wallet-core": "4.8.4"';
  let passed = true;
  for (const file of files) {
    try {
      if (!existsSync(join(root, file))) throw new Error('Missing lockfile');
      const { absolute, stat } = inspect(file);
      if (!stat.isFile()) throw new Error('Not a regular lockfile');
      if (!readFileSync(absolute, 'utf8').includes(pin)) {
        console.error(`  ${file}: required wallet-core 4.8.4 pin is missing`);
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
// tools/hdwallet-gen dependencies installed. Install them when missing
// so the gates pass from a genuinely clean checkout (no manual npm ci
// first). Runs first: negative-inputs failed in a fresh clone when this
// setup ran after it.
const engineDir = join(root, 'tools', 'hdwallet-gen');
if (existsSync(join(engineDir, 'node_modules', '@trustwallet', 'wallet-core'))) {
  report('engine-setup', 'PASS', 'tools/hdwallet-gen dependencies already installed');
} else {
  runCommand('engine-setup', 'npm', ['ci', '--no-audit', '--no-fund'], engineDir);
}
runCommand('registry-validate', process.execPath, ['scripts/validate-registry.mjs']);
runCommand('registry-tests', process.execPath, ['--test', 'tests/registry.test.mjs']);
runCommand('negative-inputs', process.execPath, ['--test', 'tests/negative-inputs.test.mjs']);
runCommand('engine-suite', process.execPath, ['--test', 'test/smoke.test.js']);
runCommand('phase9-tests', process.execPath, ['--test', 'tests/chain-fixtures.test.mjs', 'tests/failure-modes.test.mjs', 'tests/stale-data.test.mjs', 'tests/secrets-dir.test.mjs']);

const web = join(root, 'apps/web');
// The web gates run the pinned toolchain from apps/web/node_modules.
// Install the dependencies when missing so the gates pass from a
// genuinely clean checkout (no manual npm ci first).
if (existsSync(join(web, 'node_modules'))) {
  report('web-setup', 'PASS', 'apps/web dependencies already installed');
} else {
  runCommand('web-setup', 'npm', ['ci', '--no-audit', '--no-fund'], web);
}
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

check('secret-scan', secretScan);
check('lockfiles', lockfiles);

console.log(failures === 0
  ? 'quality-gates: OK'
  : `quality-gates: FAILED (${failures} gates failed)`);
process.exitCode = failures === 0 ? 0 : 1;
