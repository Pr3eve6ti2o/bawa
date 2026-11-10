#!/usr/bin/env node
// build-wallet.mjs — the one-prompt workflow: classify a plain-language
// wallet request, generate a differentiated project for its profile,
// verify that project, and write a JSON report.
// Usage: node scripts/build-wallet.mjs "<request>" [--out <report-path>]
// Hand-applied by the coordinator from the prescribed design (acceptance
// programme, 2026-11-10): Astra stalled 3x on code prompts in this lane
// (a01, a01b, a02 — 3 x 600s kills, 0 output), so the coordinator wrote
// this rewrite directly and verified it first-hand, per the A-3 precedent.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const notes = [
  'send/sign/broadcast is not implemented in either starter',
  'balances, prices and transaction history are unavailable — no provider selected',
  'on-device address derivation is not implemented on Android — no Trust Wallet Core AAR exists',
  'a successful build on one platform does not imply success on the other',
];

// Platform-aware fallback for the registry's implemented/missing lists.
// Mirrors scripts/generate-project.mjs; dead code once the registry
// carries implemented/missing for every profile (a04/a05).
const fallbackImplemented = {
  cli: ['Derivation primitives via the repository tools (see security notes)'],
  web: ['Watch-only address derivation in the browser (BTC, ETH, TRX, indices 0-4) via the vendored wallet-core 4.8.4 WASM boundary', '14-screen UI navigation with mock data and unavailable actions labelled as such', 'Receive-screen QR display of a derived address'],
  android: ['Extended-public-key validation (no secrets, no derivation on-device)', '14-screen UI navigation with mock data and unavailable actions labelled as such', 'QR display of an address'],
};
const fallbackMissing = {
  cli: ['send', 'sign', 'broadcast', 'balances', 'prices', 'history'],
  web: ['send', 'sign', 'broadcast', 'balances', 'prices', 'history', 'wallet creation and backup (repository tools only)'],
  android: ['on-device derivation', 'send', 'sign', 'broadcast', 'balances', 'prices', 'history', 'wallet creation and backup (repository tools only)'],
};

function usageError(message) {
  console.error('Usage: node scripts/build-wallet.mjs "<request>" [--out <report-path>]');
  if (message) console.error('build-wallet: ' + message);
  return 2;
}

function listFiles(dir, base) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...listFiles(path, base));
    else out.push(relative(base, path));
  }
  return out.sort();
}

function runStep(record, command, args, cwd) {
  let result;
  try {
    result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  } catch (error) {
    result = { status: null, error };
  }
  record.exitCode = result.status ?? null;
  record.status = result.status === 0 && !result.error ? 'VERIFIED' : 'FAILED';
  if (result.error) {
    console.error(`build-wallet: could not run ${record.step} for ${record.platform}: ${result.error.message}`);
  }
  return record.status === 'VERIFIED';
}

function writeReport(report, outArg) {
  const generatedAt = new Date().toISOString();
  report.generatedAt = generatedAt;
  const reportPath = resolve(
    repoRoot,
    outArg ?? `reports/build-wallet-${generatedAt.replace(/[:.]/g, '-')}.json`,
  );
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function main() {
  const [request, ...args] = process.argv.slice(2);
  if (
    request === undefined ||
    (args.length !== 0 &&
      (args.length !== 2 || args[0] !== '--out' || !args[1]?.trim()))
  ) {
    return usageError();
  }
  const outArg = args.length === 2 ? args[1] : null;

  const profiles = JSON.parse(
    readFileSync(resolve(repoRoot, 'registry/profiles.json'), 'utf8'),
  );
  if (!Array.isArray(profiles)) {
    throw new Error('registry/profiles.json must contain a JSON array');
  }

  const lower = request.toLowerCase();
  // Short tokens match as whole words only: substring matching would
  // false-positive ("eth" inside "something", "cli" inside "click").
  const word = (token) => new RegExp(`\\b${token}\\b`).test(lower);
  const hasWeb = word('web') || word('website') || word('browser');
  const hasAndroid = word('android');
  const hasWatchOnly =
    lower.includes('watch-only') ||
    lower.includes('watch only') ||
    word('xpub') ||
    lower.includes('extended public key');

  // Classification, ordered, first match wins. No "wallet" word required.
  let profileId = null;
  let ambiguous = null;
  if (hasWeb && hasAndroid) {
    ambiguous = 'split';
    console.error('build-wallet: split this request into one web-wallet build and one android-wallet build');
  } else if (hasAndroid) {
    profileId = 'android-wallet';
  } else if (hasWeb) {
    profileId = 'web-wallet';
  } else if (word('multi-chain') || word('multichain')) {
    profileId = 'multichain-wallet';
  } else if (
    word('hd') ||
    lower.includes('hierarchical deterministic') ||
    word('cli') ||
    lower.includes('command-line') ||
    lower.includes('command line')
  ) {
    profileId = 'hd-wallet-cli';
  } else if (word('bitcoin') || word('btc')) {
    const generationLanguage =
      lower.includes('generat') ||
      lower.includes('mnemonic') ||
      lower.includes('seed') ||
      lower.includes('recovery') ||
      lower.includes('recover') ||
      word('cli') ||
      lower.includes('command-line') ||
      lower.includes('command line');
    if (hasWatchOnly && !generationLanguage) {
      ambiguous = 'bitcoin-watch-only';
      console.error('build-wallet: ambiguous request — do you want the Bitcoin profile\u2019s 6-confirmation contract or the extended-public-key-only watch-only profile?');
    } else {
      profileId = 'bitcoin-wallet';
    }
  } else if (word('evm') || word('ethereum') || word('eth')) {
    profileId = 'evm-wallet';
  } else if (hasWatchOnly) {
    profileId = 'watch-only-wallet';
  } else {
    console.error('cannot classify request');
    return 2;
  }

  if (ambiguous) {
    const reportPath = writeReport(
      {
        request,
        profile: null,
        platforms: [],
        steps: [],
        generatedPath: null,
        generatedFiles: [],
        capabilities: { implemented: [], missing: [], chains: [] },
        verification: null,
        ambiguous,
        notes,
      },
      outArg,
    );
    console.log(reportPath);
    console.log('build-wallet: AMBIGUOUS');
    return 2;
  }

  const profile = profiles.find((entry) => entry?.id === profileId);
  if (!profile) {
    throw new Error(`profile not found in registry: ${profileId}`);
  }
  const platform = profile.platform;
  const generatedPath = join(repoRoot, 'generated', profileId);

  const steps = [];
  let blocked = false;

  // Generate.
  const generate = { step: 'generate', platform, status: 'NOT-RUN' };
  steps.push(generate);
  const generated = runStep(generate, process.execPath,
    ['scripts/generate-project.mjs', profileId, '--out', generatedPath], repoRoot);
  if (!generated) blocked = true;

  // Verify inside the generated directory.
  if (!blocked && platform === 'cli') {
    const verify = { step: 'verify', platform, status: 'NOT-RUN' };
    steps.push(verify);
    if (!runStep(verify, process.execPath, ['verify.mjs'], generatedPath)) blocked = true;
  } else if (!blocked && platform === 'web') {
    for (const [step, command, stepArgs] of [
      ['setup', 'npm', ['install', '--no-audit', '--no-fund']],
      ['build', 'npm', ['run', 'build']], ['test', 'npx', ['vitest', 'run']],
    ]) {
      const record = { step, platform, status: 'NOT-RUN' };
      steps.push(record);
      if (blocked) continue;
      if (!runStep(record, command, stepArgs, generatedPath)) blocked = true;
    }
  } else if (!blocked && platform === 'android') {
    // Setup is an environment check only: it verifies, it does not build.
    const setup = { step: 'setup', platform, status: 'NOT-RUN' };
    steps.push(setup);
    if (!process.env.JAVA_HOME || !process.env.ANDROID_HOME) {
      setup.status = 'SKIPPED';
      setup.reason = 'JAVA_HOME or ANDROID_HOME is unset';
      blocked = true;
    } else {
      setup.status = 'VERIFIED';
    }
    const build = { step: 'build', platform, status: 'NOT-RUN' };
    steps.push(build);
    if (!blocked && !runStep(build, './gradlew', ['assembleDebug', '--console=plain', '-q'], generatedPath)) {
      blocked = true;
    }
    const test = { step: 'test', platform, status: 'NOT-RUN' };
    steps.push(test);
    if (!blocked && !runStep(test, './gradlew', ['testDebugUnitTest', '--console=plain', '-q'], generatedPath)) {
      blocked = true;
    }
  }

  const capabilities = {
    implemented: Array.isArray(profile.implemented) ? profile.implemented : fallbackImplemented[platform],
    missing: Array.isArray(profile.missing) ? profile.missing : fallbackMissing[platform],
    chains: profile.chains,
  };
  const reportPath = writeReport(
    {
      request,
      profile: profile.id,
      platforms: [platform],
      steps,
      generatedPath,
      generatedFiles: listFiles(generatedPath, generatedPath),
      capabilities,
      verification: profile.status,
      ambiguous: null,
      notes,
    },
    outArg,
  );

  const summaries = [platform].map((entry) => {
    const entries = steps.filter((step) => step.platform === entry);
    let status = 'NOT-RUN';
    if (entries.some((step) => step.status === 'FAILED')) status = 'FAILED';
    else if (entries.some((step) => step.status === 'SKIPPED')) status = 'SKIPPED';
    else if (entries.length > 0 && entries.every((step) => step.status === 'VERIFIED')) status = 'VERIFIED';
    return { platform: entry, status };
  });

  console.log(reportPath);
  console.log(
    `build-wallet: ${summaries.map(({ platform: p, status }) => `${status} ${p}`).join(', ')}`,
  );
  return summaries.every(({ status }) => status === 'VERIFIED') ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(
    `build-wallet: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
